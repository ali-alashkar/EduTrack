const { ipcMain, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB, dbPath, makeId } = require('../db');
const context = require('../context');
const {
  verifyDataIntegrity,
  getCorruptedFiles,
  seedData,
  getSystemSettings,
  writeSystemSettings
} = require('../integrity');
const { IS_TRIAL, TRIAL_STUDENT_LIMIT } = require('../helpers');

const DEFAULT_USER_IDS = new Set(['u1', 'u2']);
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

function registerSystemHandlers() {
  // ── System Data Integrity & Recovery IPC Handlers ──
  ipcMain.handle('system:get-corrupted-files', () => {
    verifyDataIntegrity();
    return getCorruptedFiles();
  });

  ipcMain.handle('system:reset-corrupted-files', () => {
    try {
      const corrupted = getCorruptedFiles();
      for (const file of corrupted) {
        const filePath = dbPath(path.basename(file, '.json'));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      verifyDataIntegrity();
      if (getCorruptedFiles().length === 0) {
        seedData();
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('system:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.on('system:quit', () => {
    app.quit();
  });

  ipcMain.handle('system:open-external', (_, url) => {
    if (!url || typeof url !== 'string') return { success: false, error: 'Invalid URL' };
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
        return { success: false, error: 'Unsupported link type' };
      }
      shell.openExternal(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('system:get-app-info', () => {
    const pkg = require('../../package.json');
    return {
      name: pkg.build?.productName || pkg.name,
      version: pkg.version,
      description: pkg.description || '',
      isTrial: IS_TRIAL,
      trialLimit: TRIAL_STUDENT_LIMIT,
    };
  });

  // ── Setup Wizard & Security IPC Handlers ──
  ipcMain.handle('system:get-setup-state', () => {
    try {
      const system = getSystemSettings();
      if (system.setupCompleted === true) return { needsSetup: false };

      const users = readDB('users');
      // If every user is one of the two defaults, setup has not been completed
      const hasRealUser = users.some(u => !DEFAULT_USER_IDS.has(u.id));
      return { needsSetup: !hasRealUser };
    } catch (e) {
      console.error('Error in system:get-setup-state:', e);
      return { needsSetup: false };
    }
  });

  ipcMain.handle('system:complete-setup', (_, data) => {
    try {
      const { ownerName, centerName, adminUsername, adminPassword, countryCode, defaultLevel, isDriveRestore } = data || {};

      // If completing setup via Google Drive Restore, simply mark setup as completed
      if (isDriveRestore) {
        const system = getSystemSettings();
        writeSystemSettings({ ...system, setupCompleted: true });
        return { success: true };
      }

      // Validate required fields for fresh setup
      if (!ownerName || !String(ownerName).trim()) return { success: false, message: 'Owner name is required' };
      if (!centerName || !String(centerName).trim()) return { success: false, message: 'Center name is required' };
      if (!adminUsername || !String(adminUsername).trim()) return { success: false, message: 'Admin username is required' };
      if (!adminPassword || String(adminPassword).length < 6) return { success: false, message: 'Password must be at least 6 characters' };

      // 1. Remove default seeded users
      const existingUsers = readDB('users').filter(u => !DEFAULT_USER_IDS.has(u.id));

      // 2. Create the first real admin
      if (existingUsers.find(u => u.username === adminUsername.trim())) {
        return { success: false, message: 'Username already exists' };
      }
      const firstAdmin = {
        id: makeId('u'),
        username: adminUsername.trim(),
        password: adminPassword,
        role: 'admin',
        name: ownerName.trim(),
        createdAt: new Date().toISOString(),
      };
      writeDB('users', [...existingUsers, firstAdmin]);

      // 3. Seed center from setup input
      if (centerName.trim()) {
        const centers = readDB('centers');
        if (!centers.find(c => c.name === centerName.trim())) {
          const center = { id: makeId('c'), name: centerName.trim(), grades: [], createdAt: new Date().toISOString() };
          writeDB('centers', [...centers, center]);
        }
      }

      // 4. Seed default academic level from setup input
      if (defaultLevel && String(defaultLevel).trim()) {
        const levels = readDB('levels');
        if (!levels.find(l => l.name === defaultLevel.trim())) {
          const level = { id: makeId('lv'), name: defaultLevel.trim(), createdAt: new Date().toISOString() };
          writeDB('levels', [...levels, level]);
        }
      }

      // 5. Update WhatsApp country code
      if (countryCode) {
        const waSettings = readDB('whatsapp_settings') || {};
        writeDB('whatsapp_settings', { ...waSettings, countryCode: String(countryCode).trim() });
      }

      // 6. Mark setup as completed in system settings
      const system = getSystemSettings();
      writeSystemSettings({ ...system, setupCompleted: true, ownerName: ownerName.trim(), centerName: centerName.trim() });

      return { success: true };
    } catch (e) {
      console.error('Error in system:complete-setup:', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('system:has-default-credentials', () => {
    try {
      const users = readDB('users');
      const hasDefault = users.some(
        u => u.username === DEFAULT_ADMIN_USERNAME && u.password === DEFAULT_ADMIN_PASSWORD
      );
      return { hasDefault };
    } catch (e) {
      console.error('Error in system:has-default-credentials:', e);
      return { hasDefault: false };
    }
  });
}

module.exports = registerSystemHandlers;
