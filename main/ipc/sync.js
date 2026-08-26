/**
 * ipc/sync.js
 * IPC handlers for Google Drive Cloud Sync feature.
 */

const { ipcMain, shell } = require('electron');
const cloudSync = require('../cloud-sync');

function registerSyncHandlers() {
  // ── Get current sync status ─────────────────────────────────────────────────
  ipcMain.handle('sync:get-status', () => {
    return cloudSync.getStatus();
  });

  // ── Step 1: Get the OAuth URL (open in browser) ─────────────────────────────
  ipcMain.handle('sync:get-auth-url', async (_, { clientId, clientSecret }) => {
    try {
      if (!clientId || !clientSecret) {
        return { success: false, error: 'Client ID and Client Secret are required.' };
      }
      const url = await cloudSync.getAuthUrl(clientId.trim(), clientSecret.trim());
      // Open the URL in the default browser automatically
      shell.openExternal(url);
      return { success: true, url };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Step 2: Exchange authorization code for tokens ──────────────────────────
  ipcMain.handle('sync:exchange-code', async (_, { clientId, clientSecret, code }) => {
    try {
      if (!clientId || !clientSecret || !code) {
        return { success: false, error: 'Client ID, Client Secret, and authorization code are required.' };
      }
      const result = await cloudSync.exchangeCodeForToken(
        clientId.trim(),
        clientSecret.trim(),
        code.trim()
      );
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Disconnect (clear credentials) ──────────────────────────────────────────
  ipcMain.handle('sync:disconnect', async () => {
    try {
      return await cloudSync.disconnect();
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Force upload now ────────────────────────────────────────────────────────
  ipcMain.handle('sync:force-upload', async () => {
    try {
      const status = await cloudSync.forceUpload();
      return { success: true, status };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ── Force download now ──────────────────────────────────────────────────────
  ipcMain.handle('sync:force-download', async () => {
    try {
      const status = await cloudSync.forceDownload();
      return { success: true, status };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = registerSyncHandlers;
