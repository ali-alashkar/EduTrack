// ── Backup & Restore Center (Admin Only) ───────────────────────────────────────
async function renderBackup() {
  if (State.user?.role !== 'admin') {
    el('page-backup').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <p>Access denied. Admin only.</p>
      </div>`;
    return;
  }

  // Load data
  const [settings, list] = await Promise.all([
    window.api.backup.getSettings(),
    window.api.backup.list()
  ]);

  const autoCount = list.filter(b => b.type === 'auto').length;
  const manualCount = list.filter(b => b.type === 'manual').length;
  const preRestoreCount = list.filter(b => b.type === 'prerestore').length;

  // Render HTML structure
  el('page-backup').innerHTML = `
    <div class="page-header">
      <div>
        <h2>Backup & Restore Center</h2>
        <p class="page-header-sub">Manage system recovery points, schedule automatic backups, and export database files</p>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" id="btn-export-backup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Export Database File...
        </button>
        <button class="btn btn-secondary" id="btn-import-backup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import Database File...
        </button>
        <button class="btn btn-primary" id="btn-create-backup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-spin">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span>Create Instant Backup</span>
        </button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-icon" style="background:var(--accent-glow);color:var(--accent)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="stat-card-value">${list.length}</div>
        <div class="stat-card-label">Total Backups Available</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background:rgba(6, 182, 212, 0.15);color:var(--cyan)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="stat-card-value">${settings?.enabled ? (settings.frequency.charAt(0).toUpperCase() + settings.frequency.slice(1)) : 'Disabled'}</div>
        <div class="stat-card-label">Auto Scheduled Backup</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background:rgba(34, 197, 94, 0.15);color:var(--green)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-card-value" style="font-size:13px;font-weight:600;padding-top:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="last-backup-value">
          ${settings?.lastBackup ? formatDate(settings.lastBackup) + ' · ' + formatTime(settings.lastBackup) : 'Never'}
        </div>
        <div class="stat-card-label">Last Automated Backup</div>
      </div>
    </div>

    <div class="two-col" style="margin-bottom:28px">
      <!-- Backup Schedule Settings -->
      <div class="card" style="flex:1">
        <div class="card-header">
          <span class="card-title">⚙️ Auto Backup Settings</span>
        </div>
        <div class="card-body" style="padding:20px">
          <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <input type="checkbox" id="backup-enabled" style="width:20px;height:20px;cursor:pointer;" ${settings?.enabled ? 'checked' : ''} />
            <label for="backup-enabled" style="font-weight:600;font-size:13px;cursor:pointer;margin-bottom:0">Enable Automated Scheduled Backups</label>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Backup Frequency</label>
              <select id="backup-frequency" class="form-select">
                <option value="daily" ${settings?.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                <option value="weekly" ${settings?.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="monthly" ${settings?.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Max Backups to Retain</label>
              <input type="number" id="backup-max-keep" class="form-input" min="1" max="100" value="${settings?.maxKeep || 10}" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-primary" id="btn-save-settings">Save Schedule Settings</button>
          </div>
        </div>
      </div>

      <!-- Quick Info / Safety Notice -->
      <div class="card" style="flex:1;background:rgba(99, 102, 241, 0.03);border:1px dashed var(--accent)">
        <div class="card-header" style="border-bottom:1px dashed var(--accent)">
          <span class="card-title" style="color:var(--accent)">🛡️ Safety Guardrails</span>
        </div>
        <div class="card-body" style="padding:20px;font-size:13px;line-height:1.6;color:var(--text-secondary)">
          <p style="margin-bottom:12px">
            EduTrack protects your business operations from accidental data loss:
          </p>
          <ul style="padding-left:20px;margin-bottom:12px;list-style-type:disc">
            <li style="margin-bottom:6px"><strong style="color:var(--text-primary)">Automatic pre-restore backup:</strong> Every time you restore a backup or import a file, the system instantly makes a safety copy of your current data. You can restore it if anything goes wrong.</li>
            <li style="margin-bottom:6px"><strong style="color:var(--text-primary)">Local storage backups:</strong> All automated and manual recovery points are kept securely inside the application directory.</li>
            <li><strong style="color:var(--text-primary)">File Import/Export:</strong> Keep secondary backup copies on an external flash drive or cloud folder.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Backup History List -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">🕒 Backup History & Recovery Points</span>
        <span class="badge badge-muted">${list.length} Backups Found</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Backup Type</th>
              <th>Filename</th>
              <th>File Size</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(b => `
              <tr>
                <td style="font-weight:600">${formatDate(b.timestamp)} · <span style="color:var(--text-secondary)">${formatTime(b.timestamp)}</span></td>
                <td>${renderBackupTypeBadge(b.type)}</td>
                <td><code style="color:var(--accent);font-size:12px">${b.filename}</code></td>
                <td style="color:var(--text-secondary)">${formatBytes(b.size)}</td>
                <td style="text-align:right">
                  <div style="display:flex;justify-content:flex-end;gap:8px">
                    <button class="btn btn-success btn-sm" onclick="restoreBackup('${b.filename}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      Restore
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBackup('${b.filename}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="5" class="table-empty">No backups found. Create one to secure your data!</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  // Bind Page Action Event Listeners
  el('btn-create-backup').addEventListener('click', handleCreateBackup);
  el('btn-save-settings').addEventListener('click', handleSaveSettings);
  el('btn-export-backup').addEventListener('click', handleExportBackup);
  el('btn-import-backup').addEventListener('click', handleImportBackup);
}

// ── Event Handlers ──────────────────────────────────────────────────────────

async function handleCreateBackup() {
  const btn = el('btn-create-backup');
  btn.disabled = true;
  btn.querySelector('svg').classList.add('animate-spin'); // Add spin animation style to SVG
  btn.querySelector('span').textContent = 'Creating Backup...';

  try {
    const res = await window.api.backup.create();
    if (res.success) {
      toast(`Backup successfully created: ${res.filename}`, 'success');
      await renderBackup();
    } else {
      toast(`Failed to create backup: ${res.error}`, 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('svg').classList.remove('animate-spin');
    btn.querySelector('span').textContent = 'Create Instant Backup';
  }
}

async function handleSaveSettings() {
  const enabled = el('backup-enabled').checked;
  const frequency = el('backup-frequency').value;
  const maxKeep = parseInt(el('backup-max-keep').value) || 10;

  try {
    const res = await window.api.backup.updateSettings({ enabled, frequency, maxKeep });
    if (res.success) {
      toast('Backup schedule settings saved successfully', 'success');
      await renderBackup();
    } else {
      toast('Failed to save settings', 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  }
}

async function handleExportBackup() {
  try {
    const res = await window.api.backup.export();
    if (res.success) {
      toast('Database successfully exported to backup file', 'success');
    } else if (res.canceled) {
      // do nothing
    } else {
      toast(`Failed to export database: ${res.error}`, 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  }
}

async function handleImportBackup() {
  if (!confirmAction('WARNING: Importing an external database file will overwrite all current system data. Are you sure you want to proceed?')) {
    return;
  }

  try {
    const res = await window.api.backup.import();
    if (res.success) {
      toast('Database successfully imported and restored. A safety pre-restore backup was created.', 'success');
      await renderBackup();
    } else if (res.canceled) {
      // do nothing
    } else {
      toast(`Failed to import database: ${res.error}`, 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  }
}

async function restoreBackup(filename) {
  const displayType = filename.startsWith('auto_') ? 'automated scheduled' : filename.startsWith('prerestore_') ? 'pre-restore safety' : 'manual';
  if (!confirmAction(`Are you sure you want to restore the database to this ${displayType} backup? Your current database state will be overwritten (a safety pre-restore backup will be created first).`)) {
    return;
  }

  try {
    const res = await window.api.backup.restore(filename);
    if (res.success) {
      toast('System database restored successfully!', 'success');
      await renderBackup();
    } else {
      toast(`Restoration failed: ${res.error}`, 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  }
}

async function deleteBackup(filename) {
  if (!confirmAction(`Are you sure you want to permanently delete backup "${filename}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await window.api.backup.delete(filename);
    if (res.success) {
      toast('Backup deleted successfully', 'success');
      await renderBackup();
    } else {
      toast(`Deletion failed: ${res.error}`, 'error');
    }
  } catch (e) {
    toast(`Error: ${e.message}`, 'error');
  }
}

// ── UI Helpers ──────────────────────────────────────────────────────────────

function renderBackupTypeBadge(type) {
  if (type === 'auto') {
    return `<span class="badge badge-cyan">Auto Schedule</span>`;
  } else if (type === 'prerestore') {
    return `<span class="badge badge-orange">Pre-Restore Safety</span>`;
  } else {
    return `<span class="badge badge-purple">Manual Point</span>`;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
