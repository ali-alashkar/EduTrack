/**
 * cloud-sync.js
 * Google Drive Cloud Sync Engine for EduTrack
 *
 * Responsibilities:
 *  - OAuth 2.0 authentication (Desktop App flow)
 *  - On startup: compare local vs Drive snapshot timestamp → auto-download if Drive is newer
 *  - Background: every 3 minutes, upload a snapshot if any local file changed
 *  - IPC: expose status, connect, disconnect, forceUpload, forceDownload
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { shell } = require('electron');
const { readDB, writeDB, getDataDir, makeId } = require('./db');
const { mergeSnapshots } = require('./merge');
const context = require('./context');

// ── Constants ─────────────────────────────────────────────────────────────────
const SYNC_SETTINGS_DB = 'sync_settings';
const DRIVE_FOLDER_NAME = 'EduTrack Sync';
const SNAPSHOT_FILENAME = 'edutrack_sync_snapshot.json';
const SYNC_INTERVAL_MS = 10 * 1000; // 10 seconds
const DATA_FILES_EXCLUDED = new Set(['sync_settings']); // don't sync the sync settings itself

// ── Status values ──────────────────────────────────────────────────────────────
const STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  UPLOADING: 'uploading',
  DOWNLOADING: 'downloading',
  ERROR: 'error',
  DISCONNECTED: 'disconnected',
  OFFLINE: 'offline',   // internet not available – will retry automatically
  PENDING: 'pending',   // changes exist locally but not yet uploaded (offline)
};

// ─── Lazy-load googleapis to avoid crashing if not installed ──────────────────
function getGoogleAPIs() {
  try {
    return require('googleapis');
  } catch (e) {
    return null;
  }
}

// ─── Lightweight online check (DNS lookup to Google's DNS) ────────────────────
function isOnline() {
  return new Promise((resolve) => {
    dns.lookup('www.googleapis.com', (err) => {
      resolve(!err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
class CloudSyncService {
  constructor() {
    this._status = STATUS.DISCONNECTED;
    this._lastError = null;
    this._syncTimer = null;
    this._oauth2Client = null;
    this._drive = null;
    this._driveFolderId = null;
    this._lastLocalMtime = null;  // mtime at last successful upload
    this._pendingUpload = false; // true when local changes exist but we're offline
  }

  // ── Settings helpers ────────────────────────────────────────────────────────
  _readSettings() {
    const defaults = {
      enabled: false,
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      lastUpload: null,
      lastDownload: null,
      driveFileId: null,
      driveFolderId: null,
    };
    const stored = readDB(SYNC_SETTINGS_DB);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults;
    return { ...defaults, ...stored };
  }

  _writeSettings(partial) {
    const current = this._readSettings();
    writeDB(SYNC_SETTINGS_DB, { ...current, ...partial });
  }

  // ── Status broadcast ────────────────────────────────────────────────────────
  _setStatus(status, error = null) {
    this._status = status;
    this._lastError = error;
    const win = context.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('sync:status-change', this.getStatus());
    }
  }

  getStatus() {
    const s = this._readSettings();
    return {
      enabled: s.enabled,
      connected: !!s.refreshToken,
      lastUpload: s.lastUpload,
      lastDownload: s.lastDownload,
      status: this._status,
      error: this._lastError,
    };
  }

  // ── OAuth Client ────────────────────────────────────────────────────────────
  _buildOAuthClient(clientId, clientSecret) {
    const gapis = getGoogleAPIs();
    if (!gapis) throw new Error('googleapis package is not installed. Run: npm install googleapis');
    const { google } = gapis;
    const client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // Desktop app redirect
    );
    return client;
  }

  _buildDriveClient(oauth2Client) {
    const { google } = require('googleapis');
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // ── Connect (OAuth flow) ────────────────────────────────────────────────────
  /**
   * Step 1: Build auth URL and open it in the user's browser.
   * Returns the URL so the renderer can display it / open it.
   */
  async getAuthUrl(clientId, clientSecret) {
    const client = this._buildOAuthClient(clientId, clientSecret);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent',
    });
    return url;
  }

  /**
   * Step 2: Exchange the authorization code for tokens and persist them.
   */
  async exchangeCodeForToken(clientId, clientSecret, code) {
    const client = this._buildOAuthClient(clientId, clientSecret);
    const { tokens } = await client.getToken(code.trim());
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Make sure you revoked previous access at myaccount.google.com/permissions and try again.');
    }
    this._writeSettings({
      enabled: true,
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    });
    await this._initDriveClient();
    this._setStatus(STATUS.IDLE);
    this._startBackgroundSync();
    return { success: true };
  }

  // ── Initialize Drive client from stored settings ────────────────────────────
  async _initDriveClient() {
    const s = this._readSettings();
    if (!s.clientId || !s.clientSecret || !s.refreshToken) return false;
    try {
      const client = this._buildOAuthClient(s.clientId, s.clientSecret);
      client.setCredentials({ refresh_token: s.refreshToken });
      this._oauth2Client = client;
      this._drive = this._buildDriveClient(client);
      this._driveFolderId = s.driveFolderId || null;
      return true;
    } catch (e) {
      this._setStatus(STATUS.ERROR, e.message);
      return false;
    }
  }

  // ── Drive folder helpers ────────────────────────────────────────────────────
  async _ensureDriveFolder() {
    if (this._driveFolderId) return this._driveFolderId;

    // Search for existing folder
    const res = await this._drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });
    if (res.data.files && res.data.files.length > 0) {
      this._driveFolderId = res.data.files[0].id;
      this._writeSettings({ driveFolderId: this._driveFolderId });
      return this._driveFolderId;
    }

    // Create folder
    const folder = await this._drive.files.create({
      requestBody: {
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    this._driveFolderId = folder.data.id;
    this._writeSettings({ driveFolderId: this._driveFolderId });
    return this._driveFolderId;
  }

  // ── Build local snapshot (async — never blocks main thread) ─────────────────
  async _buildSnapshot() {
    const fsp = fs.promises;
    const dataDir = getDataDir();
    const files = (await fsp.readdir(dataDir)).filter(f => f.endsWith('.json'));
    const dbs = {};
    let latestMtime = 0;
    await Promise.all(files.map(async (file) => {
      const dbName = path.basename(file, '.json');
      if (DATA_FILES_EXCLUDED.has(dbName)) return;
      const filePath = path.join(dataDir, file);
      try {
        const [content, stat] = await Promise.all([
          fsp.readFile(filePath, 'utf-8'),
          fsp.stat(filePath),
        ]);
        dbs[dbName] = JSON.parse(content);
        if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
      } catch (e) {
        console.error(`[CloudSync] Error reading ${file} for snapshot:`, e.message);
      }
    }));
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      dbs,
      _latestMtime: latestMtime,
    };
  }

  // ── Get latest local mtime (async) ─────────────────────────────────────────
  async _getLocalLatestMtime() {
    const fsp = fs.promises;
    const dataDir = getDataDir();
    let files;
    try { files = (await fsp.readdir(dataDir)).filter(f => f.endsWith('.json')); }
    catch { return 0; }
    const mtimes = await Promise.all(files.map(async (file) => {
      const dbName = path.basename(file, '.json');
      if (DATA_FILES_EXCLUDED.has(dbName)) return 0;
      try { return (await fsp.stat(path.join(dataDir, file))).mtimeMs; }
      catch { return 0; }
    }));
    return Math.max(0, ...mtimes);
  }

  // ── Restore snapshot to local (async — never blocks main thread) ──────────────
  async _restoreSnapshot(snapshot) {
    if (!snapshot || !snapshot.dbs) throw new Error('Invalid snapshot format');
    const fsp = fs.promises;
    const dataDir = getDataDir();
    await Promise.all(
      Object.entries(snapshot.dbs).map(([dbName, dbData]) => {
        if (DATA_FILES_EXCLUDED.has(dbName)) return Promise.resolve();
        const filePath = path.join(dataDir, `${dbName}.json`);
        return fsp.writeFile(filePath, JSON.stringify(dbData, null, 2), 'utf-8');
      })
    );
  }

  // ── Fetch remote snapshot (raw, no side effects) ──────────────────────────
  /**
   * Downloads the Drive snapshot and returns it, or null if none exists.
   * Does NOT update lastDownload or set status — used internally by merge logic.
   */
  async _fetchRemoteSnapshot() {
    const s = this._readSettings();
    let fileId = s.driveFileId;

    if (!fileId) {
      const folderId = await this._ensureDriveFolder();
      const res = await this._drive.files.list({
        q: `name='${SNAPSHOT_FILENAME}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
      });
      if (!res.data.files || res.data.files.length === 0) return null;
      fileId = res.data.files[0].id;
      this._writeSettings({ driveFileId: fileId });
    }

    const res = await this._drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    return JSON.parse(res.data);
  }

  // ── Merge remote snapshot into local files ────────────────────────────────
  /**
   * Downloads the Drive snapshot, merges it with local data, and writes
   * the merged result back to local files if the remote had newer/additional
   * records. Auto-resolved conflicts are logged to audit_log.
   *
   * @returns {boolean} true if local files were updated
   */
  async _mergeRemoteIntoLocal() {
    let remoteSnapshot = null;
    try {
      remoteSnapshot = await this._fetchRemoteSnapshot();
    } catch (e) {
      console.warn('[CloudSync] Could not fetch remote for merge (will upload local only):', e.message);
      return false;
    }

    if (!remoteSnapshot || !remoteSnapshot.dbs) return false;

    const localSnapshot = await this._buildSnapshot();
    const { mergedDbs, allConflicts, localNeedsUpdate } = mergeSnapshots(
      localSnapshot.dbs,
      remoteSnapshot.dbs,
    );

    if (localNeedsUpdate) {
      console.log(`[CloudSync] Merge: ${allConflicts.length} conflict(s) auto-resolved. Writing merged data locally.`);
      await this._createPreSyncBackup();
      await this._restoreSnapshot({ dbs: mergedDbs });

      const win = context.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('sync:data-updated');
      }

      // Log resolved conflicts to audit_log
      if (allConflicts.length > 0) {
        try {
          const existing = readDB('audit_log') || [];
          const entries = allConflicts.map(c => ({
            id: makeId('al'),
            action: 'sync_conflict_resolved',
            dbName: c.dbName,
            recordId: c.recordId,
            winner: c.winner,
            localTs: c.localTs,
            remoteTs: c.remoteTs,
            timestamp: c.resolvedAt,
          }));
          writeDB('audit_log', [...existing, ...entries]);
        } catch (e) {
          console.warn('[CloudSync] Could not log conflicts to audit_log:', e.message);
        }
      }
    } else {
      console.log('[CloudSync] Merge: no remote changes to apply.');
    }

    return localNeedsUpdate;
  }

  // ── Upload snapshot to Drive (merge-aware) ────────────────────────────────
  /**
   * Before uploading, we pull the current Drive snapshot and merge it with
   * local data. This ensures:
   *  - Records added by another device since our last upload are preserved
   *  - Edit conflicts are resolved by latest-timestamp-wins
   *  - The uploaded snapshot is always the authoritative merged state
   */
  async _uploadSnapshot() {
    // — Offline guard —
    if (!(await isOnline())) {
      this._pendingUpload = true;
      this._setStatus(STATUS.PENDING);
      console.log('[CloudSync] Offline – upload skipped. Will retry on next tick.');
      return;
    }
    try {
      this._setStatus(STATUS.UPLOADING);

      // Step 1: Pull remote and merge into local (if Drive already has a snapshot)
      await this._mergeRemoteIntoLocal();

      // Step 2: Build the final (now-merged) local snapshot
      const folderId = await this._ensureDriveFolder();
      const snapshot = await this._buildSnapshot();
      const content = JSON.stringify(snapshot, null, 2);
      const s = this._readSettings();

      // Step 3: Upload merged snapshot to Drive
      let fileId = s.driveFileId;
      if (fileId) {
        // Update existing file
        await this._drive.files.update({
          fileId,
          media: { mimeType: 'application/json', body: content },
        });
      } else {
        // Create new file
        const res = await this._drive.files.create({
          requestBody: {
            name: SNAPSHOT_FILENAME,
            parents: [folderId],
          },
          media: { mimeType: 'application/json', body: content },
          fields: 'id',
        });
        fileId = res.data.id;
        this._writeSettings({ driveFileId: fileId });
      }

      this._pendingUpload = false;
      const now = new Date().toISOString();
      this._writeSettings({ lastUpload: now });
      this._lastLocalMtime = snapshot._latestMtime;
      this._setStatus(STATUS.IDLE);
      console.log('[CloudSync] Merge-upload complete at', now);
    } catch (e) {
      console.error('[CloudSync] Upload failed:', e.message);
      this._pendingUpload = true;
      this._setStatus(STATUS.ERROR, `Upload failed: ${e.message}`);
      throw e;
    }
  }

  // ── Download snapshot from Drive ──────────────────────────────────────────
  async _downloadSnapshot() {
    // — Offline guard —
    if (!(await isOnline())) {
      this._setStatus(STATUS.OFFLINE);
      console.log('[CloudSync] Offline – download skipped.');
      return null;
    }
    try {
      const s = this._readSettings();
      let fileId = s.driveFileId;

      if (!fileId) {
        // Try to find by name in folder
        const folderId = await this._ensureDriveFolder();
        const res = await this._drive.files.list({
          q: `name='${SNAPSHOT_FILENAME}' and '${folderId}' in parents and trashed=false`,
          fields: 'files(id)',
        });
        if (!res.data.files || res.data.files.length === 0) {
          this._setStatus(STATUS.IDLE);
          return null; // No snapshot on Drive yet
        }
        fileId = res.data.files[0].id;
        this._writeSettings({ driveFileId: fileId });
      }

      // Download file content
      const res = await this._drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );
      const snapshot = JSON.parse(res.data);
      const now = new Date().toISOString();
      this._writeSettings({ lastDownload: now });
      this._setStatus(STATUS.IDLE);
      return snapshot;
    } catch (e) {
      console.error('[CloudSync] Download failed:', e.message);
      this._setStatus(STATUS.ERROR, `Download failed: ${e.message}`);
      throw e;
    }
  }

  // ── Get Drive snapshot metadata (timestamp only) ────────────────────────────
  async _getDriveSnapshotTimestamp() {
    try {
      const s = this._readSettings();
      let fileId = s.driveFileId;

      if (!fileId) {
        const folderId = await this._ensureDriveFolder();
        const res = await this._drive.files.list({
          q: `name='${SNAPSHOT_FILENAME}' and '${folderId}' in parents and trashed=false`,
          fields: 'files(id, modifiedTime)',
        });
        if (!res.data.files || res.data.files.length === 0) return null;
        fileId = res.data.files[0].id;
        this._writeSettings({ driveFileId: fileId });
        return new Date(res.data.files[0].modifiedTime).getTime();
      }

      const meta = await this._drive.files.get({
        fileId,
        fields: 'modifiedTime',
      });
      return new Date(meta.data.modifiedTime).getTime();
    } catch (e) {
      console.error('[CloudSync] Failed to get Drive snapshot timestamp:', e.message);
      return null;
    }
  }

  // ── Startup check: merge Drive data and upload merged result ─────────────────
  /**
   * On startup we always merge rather than choosing one side.
   * This guarantees that any work done on another device while this one
   * was offline is pulled in, and any local changes not yet uploaded are
   * pushed out — all without losing anything.
   */
  async checkAndDownloadOnStartup() {
    const s = this._readSettings();
    if (!s.enabled || !s.refreshToken) return;

    const ready = await this._initDriveClient();
    if (!ready) return;

    // — Offline guard: skip startup sync silently, start background loop to retry —
    if (!(await isOnline())) {
      console.log('[CloudSync] Offline at startup – skipping sync check. Background loop will retry.');
      this._setStatus(STATUS.OFFLINE);
      this._startBackgroundSync();
      return;
    }

    this._setStatus(STATUS.SYNCING);
    console.log('[CloudSync] Startup: merging with Drive snapshot...');

    try {
      // Always attempt a merge-upload on startup.
      // _uploadSnapshot now does: pull remote → merge → write local → upload.
      await this._uploadSnapshot();
      this._lastLocalMtime = await this._getLocalLatestMtime();
    } catch (e) {
      console.error('[CloudSync] Startup sync error:', e.message);
      this._setStatus(STATUS.ERROR, e.message);
    }

    this._startBackgroundSync();
  }

  // ── Create a pre-sync backup (async — never blocks main thread) ──────────────
  async _createPreSyncBackup() {
    try {
      const { createBackupData } = require('./backup');
      const { getBackupsDir } = require('./db');
      const currentBackup = createBackupData();
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filePath = path.join(getBackupsDir(), `presync_backup_${dateStr}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(currentBackup, null, 2), 'utf-8');
      console.log('[CloudSync] Pre-sync local backup created:', path.basename(filePath));
    } catch (e) {
      console.error('[CloudSync] Failed to create pre-sync backup:', e.message);
    }
  }

  // ── Background sync loop ────────────────────────────────────────────────────
  _startBackgroundSync() {
    if (this._syncTimer) return; // already running
    this._syncTimer = setInterval(async () => {
      await this._backgroundSyncTick();
    }, SYNC_INTERVAL_MS);
    console.log('[CloudSync] Background sync started (every 30 seconds).');
  }

  _stopBackgroundSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  async _backgroundSyncTick() {
    const s = this._readSettings();
    if (!s.enabled || !s.refreshToken) return;
    // Skip if a sync is already in progress
    if (this._status === STATUS.UPLOADING || this._status === STATUS.DOWNLOADING || this._status === STATUS.SYNCING) return;

    // — Offline guard: mark as pending and silently skip —
    if (!(await isOnline())) {
      this._pendingUpload = true;
      if (this._status !== STATUS.PENDING) this._setStatus(STATUS.PENDING);
      console.log('[CloudSync] Offline – background sync skipped. Will retry in 30 seconds.');
      return;
    }

    // Always run a full merge cycle every tick so ALL devices converge within 30s:
    //   pull Drive snapshot → merge with local → write merged locally → push merged back
    // The merge engine detects if there are actually any remote changes; if nothing
    // changed on either side the result is a no-op write (same data).
    try {
      await this._uploadSnapshot();
    } catch (e) {
      // Error already handled inside _uploadSnapshot
    }
  }

  // ── Public API (called from IPC handlers) ───────────────────────────────────

  /** Called on app close to flush final changes */
  async shutdown() {
    this._stopBackgroundSync();
    const s = this._readSettings();
    if (!s.enabled || !s.refreshToken) return;
    const currentMtime = await this._getLocalLatestMtime();
    const hasChanges = this._lastLocalMtime === null || currentMtime > this._lastLocalMtime || this._pendingUpload;
    if (hasChanges) {
      // Only try if online – don't hang app close on a network request
      if (await isOnline()) {
        try { await this._uploadSnapshot(); } catch { /* ignore on shutdown */ }
      } else {
        console.log('[CloudSync] Offline at shutdown – local changes not uploaded. Will sync on next launch.');
      }
    }
  }

  async forceUpload() {
    const s = this._readSettings();
    if (!s.enabled || !s.refreshToken) throw new Error('Cloud sync is not connected.');
    if (!(await isOnline())) throw new Error('No internet connection. Please check your WiFi and try again.');
    if (!this._drive) await this._initDriveClient();
    await this._uploadSnapshot();
    return this.getStatus();
  }

  async forceDownload() {
    const s = this._readSettings();
    if (!s.enabled || !s.refreshToken) throw new Error('Cloud sync is not connected.');
    if (!(await isOnline())) throw new Error('No internet connection. Please check your WiFi and try again.');
    if (!this._drive) await this._initDriveClient();

    // Use full merge-upload instead of a plain overwrite.
    // This pulls the Drive snapshot, merges it record-by-record with local data
    // (latest-timestamp-wins, keeps records unique to either side), writes the
    // merged result locally, then uploads the authoritative merged snapshot back.
    this._setStatus(STATUS.DOWNLOADING);
    try {
      await this._uploadSnapshot(); // internally: pull → merge → write local → push
      const now = new Date().toISOString();
      this._writeSettings({ lastDownload: now });
      this._setStatus(STATUS.IDLE);
    } catch (e) {
      this._setStatus(STATUS.ERROR, `Merge-download failed: ${e.message}`);
      throw e;
    }
    return this.getStatus();
  }

  async disconnect() {
    this._stopBackgroundSync();
    this._writeSettings({
      enabled: false,
      refreshToken: '',
      driveFileId: null,
      driveFolderId: null,
    });
    this._oauth2Client = null;
    this._drive = null;
    this._driveFolderId = null;
    this._setStatus(STATUS.DISCONNECTED);
    return { success: true };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const cloudSyncService = new CloudSyncService();
module.exports = cloudSyncService;
