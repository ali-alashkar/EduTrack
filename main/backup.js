const fs = require('fs');
const path = require('path');
const { getDataDir, getBackupsDir, readDB, writeDB } = require('./db');

/**
 * Returns a sortable date string in the format YYYYMMDD_HHMMSS.
 * Used consistently for all backup file names.
 * @param {Date} [date] - Defaults to now.
 * @returns {string}
 */
function formatDateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function createBackupData() {
  const files = fs.readdirSync(getDataDir());
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const dbs = {};
  for (const file of jsonFiles) {
    const dbName = path.basename(file, '.json');
    const filePath = path.join(getDataDir(), file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      dbs[dbName] = JSON.parse(content);
    } catch (e) {
      console.error(`Error reading ${file} for backup:`, e);
    }
  }
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dbs
  };
}

function restoreBackupData(backupObj) {
  if (!backupObj || typeof backupObj !== 'object' || !backupObj.dbs) {
    throw new Error('Invalid backup file structure.');
  }
  const { dbs } = backupObj;

  // Write each db to disk
  for (const [dbName, dbData] of Object.entries(dbs)) {
    const filePath = path.join(getDataDir(), `${dbName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dbData, null, 2), 'utf-8');
  }
}

function getBackupsList() {
  const dir = getBackupsDir();
  const files = fs.readdirSync(dir);
  const list = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    try {
      const stats = fs.statSync(filePath);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      list.push({
        filename: file,
        path: filePath,
        size: stats.size,
        timestamp: content.timestamp || stats.mtime.toISOString(),
        type: file.startsWith('auto_') ? 'auto' : file.startsWith('prerestore_') ? 'prerestore' : 'manual'
      });
    } catch (e) {
      // ignore invalid/partial files
    }
  }
  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function checkScheduledBackup() {
  try {
    const settings = readDB('backup_settings');
    if (!settings || !settings.enabled) return;

    const now = new Date();
    let isDue = false;

    if (!settings.lastBackup) {
      isDue = true;
    } else {
      const last = new Date(settings.lastBackup);
      const diffMs = now - last;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (settings.frequency === 'daily' && diffDays >= 1) isDue = true;
      else if (settings.frequency === 'weekly' && diffDays >= 7) isDue = true;
      else if (settings.frequency === 'monthly' && diffDays >= 30) isDue = true;
    }

    if (isDue) {
      const backupData = createBackupData();
      const dir = getBackupsDir();
      const filename = `auto_backup_${formatDateStamp(now)}.json`;
      const filePath = path.join(dir, filename);

      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

      // Update settings
      settings.lastBackup = now.toISOString();
      writeDB('backup_settings', settings);

      // Prune old auto backups
      const list = getBackupsList().filter(b => b.type === 'auto');
      const maxKeep = settings.maxKeep || 10;
      if (list.length > maxKeep) {
        const toDelete = list.slice(maxKeep);
        for (const item of toDelete) {
          try {
            fs.unlinkSync(item.path);
          } catch (e) {
            console.error('Failed to delete old automatic backup:', e);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error running scheduled backup:', e);
  }
}

module.exports = {
  createBackupData,
  restoreBackupData,
  getBackupsList,
  checkScheduledBackup,
  formatDateStamp,
};
