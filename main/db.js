const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function getDataDir() {
  // In production, store next to the exe. In dev, store in project root.
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..', 'data');
  const dir = path.join(base, 'edutrack_data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getBackupsDir() {
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..', 'data');
  const dir = path.join(base, 'edutrack_backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dbPath(name) {
  return path.join(getDataDir(), `${name}.json`);
}

function readDB(name) {
  const p = dbPath(name);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return [];
  }
}

function writeDB(name, data) {
  fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// ── Device Identity ────────────────────────────────────────────────────────────
// Each device gets a permanent unique 12-character ID stored in sync_settings.
// This is embedded in every generated record ID so two devices can never
// accidentally create records with the same ID, even at the same millisecond.

let _deviceId = null;

function getDeviceId() {
  if (_deviceId) return _deviceId;

  // Try to read from sync_settings.json
  const settingsPath = dbPath('sync_settings');
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && !Array.isArray(data) && data.deviceId) {
        _deviceId = data.deviceId;
        return _deviceId;
      }
    }
  } catch { /* fall through to generate */ }

  // Generate a new device ID using built-in Node.js crypto (no extra packages)
  const { randomBytes } = require('crypto');
  _deviceId = randomBytes(6).toString('hex'); // 12-char hex string

  // Persist it so this device always uses the same ID
  try {
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
      if (typeof settings !== 'object' || Array.isArray(settings)) settings = {};
    }
    settings.deviceId = _deviceId;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('[DB] Failed to persist deviceId:', e.message);
  }

  return _deviceId;
}

/**
 * Creates a collision-safe record ID.
 * Format: <prefix>_<deviceId>_<timestamp>
 * Example: "s_a1b2c3_1722160000000"
 *
 * Using this instead of plain `s${Date.now()}` means two devices
 * registering a student at the exact same millisecond still get different IDs.
 *
 * @param {string} prefix - e.g. 's', 'ss', 'pay', 'att'
 * @returns {string}
 */
let _idCounter = 0;

function makeId(prefix) {
  _idCounter = (_idCounter + 1) % 1000000;
  return `${prefix}_${getDeviceId()}_${Date.now()}_${_idCounter}`;
}

function recordTombstones(dbName, recordIds) {
  const ids = Array.isArray(recordIds) ? recordIds.filter(Boolean) : [recordIds].filter(Boolean);
  if (!ids.length || !dbName) return;
  const current = readDB('deleted_records');
  const existingMap = new Map();
  if (Array.isArray(current)) {
    for (const item of current) {
      if (item && item.id && item.dbName) {
        existingMap.set(`${item.dbName}:${item.id}`, item);
      }
    }
  }
  const now = new Date().toISOString();
  for (const id of ids) {
    existingMap.set(`${dbName}:${id}`, { id, dbName, deletedAt: now });
  }
  writeDB('deleted_records', Array.from(existingMap.values()));
}

module.exports = {
  getDataDir,
  getBackupsDir,
  dbPath,
  readDB,
  writeDB,
  recordTombstones,
  getDeviceId,
  makeId,
};
