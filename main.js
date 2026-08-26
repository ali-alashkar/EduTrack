const { app, BrowserWindow, ipcMain , Menu} = require('electron');
const path = require('path');
const context = require('./main/context');
const { readDB, getDataDir } = require('./main/db');
const { verifyDataIntegrity, getCorruptedFiles, seedData, runMigrations, purgeOrphanedRecords } = require('./main/integrity');
const { checkScheduledBackup } = require('./main/backup');
const { saveWaLogRecord, readWhatsappTemplates } = require('./main/helpers');
const WhatsAppService = require('./whatsapp-service');
const cloudSync = require('./main/cloud-sync');

// Disable GPU cache to prevent "Unable to move the cache: Access is denied" errors on Windows
app.commandLine.appendSwitch('disable-gpu-cache');

// ─── WhatsApp Service ────────────────────────────────────────────────────────
function initWhatsAppService() {
  const settings = readDB('whatsapp_settings');
  const waService = new WhatsAppService({
    dataDir: getDataDir(),
    onQr: (qrDataUrl) => {
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:qr', qrDataUrl);
      }
    },
    onReady: () => {
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:ready');
      }
    },
    onDisconnected: () => {
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:disconnected');
      }
    },
    onMessageSent: (record) => {
      saveWaLogRecord(record);
      // Notify renderer
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:message-sent', record);
      }
    },
    onStatusChange: (status) => {
      const mainWindow = context.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:status-change', status);
      }
    },
    getTemplates: () => readWhatsappTemplates(),
  });
  
  if (settings && typeof settings === 'object') {
    waService.updateSettings(settings);
  }
  
  context.setWaService(waService);
}

// ─── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,

    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        backgroundThrottling: false,
        devTools: true
    },

    titleBarStyle: "hidden",
    frame: false,
    backgroundColor: "#0f1117",
    icon: path.join(__dirname, "assets", "icon.png"),
    show: false
});

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  context.setMainWindow(mainWindow);
  if (mainWindow.webContents) {
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }
}

// ─── App lifecycle ───
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  verifyDataIntegrity();

  if (getCorruptedFiles().length === 0) {
    try {
      runMigrations();
      seedData();
      purgeOrphanedRecords();
      initWhatsAppService();
    } catch (err) {
      console.error('Error running migrations or seeding data:', err);
    }
  }

  // ── Cloud Sync: check Drive for newer data BEFORE opening the window ────────
  try {
    await cloudSync.checkAndDownloadOnStartup();
  } catch (err) {
    console.error('[CloudSync] Startup check failed (non-fatal):', err.message);
  }

  createWindow();

  // Initial scheduled backup check
  setTimeout(() => {
    if (getCorruptedFiles().length === 0) {
      checkScheduledBackup();
    }
  }, 5000);

  // Hourly check for scheduled backup
  setInterval(() => {
    if (getCorruptedFiles().length === 0) {
      checkScheduledBackup();
    }
  }, 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── On quit: flush any unsaved changes to Drive ──────────────────────────────
app.on('before-quit', async () => {
  try {
    await cloudSync.shutdown();
  } catch (err) {
    console.error('[CloudSync] Shutdown sync failed (non-fatal):', err.message);
  }
});

// ─── IPC Handlers Mounting ───────────────────────────────────────────────────

// Window controls
ipcMain.on('window:minimize', () => {
  const win = context.getMainWindow();
  if (win) win.minimize();
});

ipcMain.on('window:maximize', () => {
  const win = context.getMainWindow();
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on('window:close', () => {
  const win = context.getMainWindow();
  if (win) win.close();
});

// Load and register all domain-specific handlers
require('./main/ipc/auth')();
require('./main/ipc/academic')();
require('./main/ipc/students')();
require('./main/ipc/sessions')();
require('./main/ipc/payments')();
require('./main/ipc/expenses')();
require('./main/ipc/books')();
require('./main/ipc/reports')();
require('./main/ipc/whatsapp')();
require('./main/ipc/system')();
require('./main/ipc/sync')();
require('./main/ipc/backup')();
