const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { getBackupsDir } = require('../db');
const context = require('../context');
const { IS_TRIAL } = require('../helpers');
const {
  createBackupData,
  restoreBackupData,
  getBackupsList,
  formatDateStamp,
} = require('../backup');

function registerBackupHandlers() {
  // ── Backup Settings ──────────────────────────────────────────────────────────
  const { readDB, writeDB } = require('../db');

  ipcMain.handle('backup:get-settings', () => readDB('backup_settings'));

  ipcMain.handle('backup:update-settings', (_, settings) => {
    const current = readDB('backup_settings');
    const updated = { ...current, ...settings };
    writeDB('backup_settings', updated);
    return { success: true };
  });

  // ── Backup CRUD ──────────────────────────────────────────────────────────────
  ipcMain.handle('backup:list', () => getBackupsList());

  ipcMain.handle('backup:create', () => {
    if (IS_TRIAL) {
      return { success: false, error: 'عذراً، ميزة النسخ الاحتياطي غير متوفرة في النسخة التجريبية.' };
    }
    try {
      const backupData = createBackupData();
      const dir = getBackupsDir();
      const filename = `manual_backup_${formatDateStamp()}.json`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
      return { success: true, filename };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:delete', (_, filename) => {
    try {
      const filePath = path.join(getBackupsDir(), filename);
      if (path.dirname(filePath) !== getBackupsDir()) {
        return { success: false, error: 'Invalid path' };
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: 'File not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:restore', async (_, filename) => {
    if (IS_TRIAL) {
      return { success: false, error: 'عذراً، ميزة استعادة النسخ الاحتياطي غير متوفرة في النسخة التجريبية.' };
    }
    try {
      const filePath = path.join(getBackupsDir(), filename);
      if (path.dirname(filePath) !== getBackupsDir() || !fs.existsSync(filePath)) {
        return { success: false, error: 'Backup file not found' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const backupObj = JSON.parse(content);

      // Create a safety pre-restore snapshot first
      try {
        const currentBackup = createBackupData();
        const preRestorePath = path.join(getBackupsDir(), `prerestore_backup_${formatDateStamp()}.json`);
        fs.writeFileSync(preRestorePath, JSON.stringify(currentBackup, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to create pre-restore backup, but continuing:', err);
      }

      restoreBackupData(backupObj);
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:data-updated');
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Export / Import (file dialog) ────────────────────────────────────────────
  ipcMain.handle('backup:export', async () => {
    if (IS_TRIAL) {
      return { success: false, error: 'عذراً، ميزة تصدير النسخ الاحتياطي غير متوفرة في النسخة التجريبية.' };
    }
    try {
      const defaultName = `edutrack_backup_${formatDateStamp()}.json`;
      const mainWindow = context.getMainWindow();
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Backup',
        defaultPath: defaultName,
        filters: [{ name: 'EduTrack Backup (*.json)', extensions: ['json'] }],
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      const backupData = createBackupData();
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:import', async () => {
    if (IS_TRIAL) {
      return { success: false, error: 'عذراً، ميزة استيراد النسخ الاحتياطي غير متوفرة في النسخة التجريبية.' };
    }
    try {
      const mainWindow = context.getMainWindow();
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Backup',
        filters: [{ name: 'EduTrack Backup (*.json)', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };

      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const backupObj = JSON.parse(content);

      if (!backupObj || typeof backupObj !== 'object' || !backupObj.dbs) {
        return { success: false, error: 'Invalid file format. This is not a valid EduTrack backup.' };
      }

      // Create a safety pre-restore snapshot first
      try {
        const currentBackup = createBackupData();
        const preRestorePath = path.join(getBackupsDir(), `prerestore_backup_${formatDateStamp()}.json`);
        fs.writeFileSync(preRestorePath, JSON.stringify(currentBackup, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to create pre-restore backup, but continuing:', err);
      }

      restoreBackupData(backupObj);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:data-updated');
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Backup Reminder ──────────────────────────────────────────────────────────
  ipcMain.handle('backup:check-reminder', () => {
    try {
      const list = getBackupsList();
      if (list.length === 0) {
        return { showReminder: true, daysSince: null };
      }

      const latest = list[0];
      const lastBackupDate = new Date(latest.timestamp);
      const diffDays = (Date.now() - lastBackupDate) / (1000 * 60 * 60 * 24);

      if (diffDays >= 3) {
        return { showReminder: true, daysSince: Math.floor(diffDays) };
      }
      return { showReminder: false, daysSince: Math.floor(diffDays) };
    } catch (e) {
      console.error('Error in backup:check-reminder handler:', e);
      return { showReminder: false, error: e.message };
    }
  });
}

module.exports = registerBackupHandlers;
