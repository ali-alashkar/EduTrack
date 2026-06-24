const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const WhatsAppService = require('./whatsapp-service');
const { TEMPLATES } = require('./whatsapp-templates');
let XLSX;
try { XLSX = require('xlsx'); } catch (_) { XLSX = null; }

// Disable GPU cache to prevent "Unable to move the cache: Access is denied" errors on Windows
app.commandLine.appendSwitch('disable-gpu-cache');

// ─── Data directory (persists next to the exe) ─────────────────────────────
function getDataDir() {
  // In production, store next to the exe. In dev, store in project root.
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, 'data');
  const dir = path.join(base, 'edutrack_data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getBackupsDir() {
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, 'data');
  const dir = path.join(base, 'edutrack_backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
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
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `auto_backup_${dateStr}.json`;
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

function dbPath(name) {
  return path.join(getDataDir(), `${name}.json`);
}

function readDB(name) {
  const p = dbPath(name);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
}

function writeDB(name, data) {
  fs.writeFileSync(dbPath(name), JSON.stringify(data, null, 2), 'utf-8');
}

function syncLevelNameReferences(levelId, previousName, nextName) {
  if (!nextName || previousName === nextName) return;
  const matchesLevel = (item) => item?.levelId === levelId || (!item?.levelId && item?.level === previousName);
  writeDB('students', readDB('students').map(student => (
    matchesLevel(student) ? { ...student, level: nextName } : student
  )));
  writeDB('groups', readDB('groups').map(group => (
    matchesLevel(group) ? { ...group, level: nextName } : group
  )));
  writeDB('centers', readDB('centers').map(center => ({
    ...center,
    grades: (center.grades || []).map(grade => grade === previousName ? nextName : grade),
  })));
}

function syncCenterNameReferences(centerId, previousName, nextName) {
  if (!nextName || previousName === nextName) return;
  const matchesCenter = (item) => item?.centerId === centerId || (!item?.centerId && item?.center === previousName);
  writeDB('students', readDB('students').map(student => (
    matchesCenter(student) ? { ...student, center: nextName } : student
  )));
  writeDB('groups', readDB('groups').map(group => (
    matchesCenter(group) ? { ...group, center: nextName } : group
  )));
}

function normalizeStudentDiscount(data) {
  const hasDiscount = !!data.hasDiscount;
  const discountPercent = hasDiscount
    ? Math.min(100, Math.max(0, Number(data.discountPercent) || 0))
    : 0;
  return { hasDiscount, discountPercent };
}

function normalizePhoneForMatch(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function findDuplicateStudentPhone(students, data, currentId = null) {
  const ownPhone = normalizePhoneForMatch(data.phone);
  const ownParentPhone = normalizePhoneForMatch(data.parentPhone);
  if (ownPhone && ownParentPhone && ownPhone === ownParentPhone) {
    return {
      field: 'phone',
      message: 'student phone and parent phone are the same',
      duplicateStudentId: currentId || '',
      duplicateStudentName: data.name || '',
    };
  }

  const checks = [
    { field: 'phone', label: 'student phone', value: ownPhone },
    { field: 'parentPhone', label: 'parent phone', value: ownParentPhone },
  ].filter(item => item.value);

  for (const check of checks) {
    const duplicate = students.find(student => {
      if (student.id === currentId) return false;
      return normalizePhoneForMatch(student.phone) === check.value ||
        normalizePhoneForMatch(student.parentPhone) === check.value;
    });
    if (duplicate) {
      return {
        field: check.field,
        message: `${check.label} is already used by ${duplicate.name}`,
        duplicateStudentId: duplicate.id,
        duplicateStudentName: duplicate.name,
      };
    }
  }
  return null;
}

function studentBlockWarning(student) {
  if (!student?.isBlocked) return null;
  return {
    studentId: student.id,
    studentName: student.name,
    reason: student.blockReason || 'No reason recorded',
    blockedAt: student.blockedAt || '',
  };
}



function normalizeSessionFee(data) {
  return { sessionFee: Math.max(0, Number(data.sessionFee) || 0) };
}

function getAttendanceFee(sessionFee, student) {
  const fee = Number(sessionFee) || 0;
  if (!student?.hasDiscount) return fee;
  const pct = Number(student.discountPercent) || 0;
  return fee * (100 - pct) / 100;
}

function calcSessionRevenue(session, attendance, studentMap) {
  const sessionAtt = attendance.filter(a => a.sessionId === session.id);
  const fee = Number(session.sessionFee) || 0;
  let revenue = 0;
  let gross = 0;

  for (const att of sessionAtt) {
    const student = studentMap[att.studentId];
    if (!student) continue;
    gross += fee;
    revenue += getAttendanceFee(fee, student);
  }

  const discountCount = sessionAtt.reduce((count, att) => {
    const student = studentMap[att.studentId];
    return count + (student?.hasDiscount ? 1 : 0);
  }, 0);

  const siblingLevelCounts = {};
  for (const att of sessionAtt) {
    const student = studentMap[att.studentId];
    if (!student?.parentPhone || !student?.level) continue;
    const key = `${normalizePhoneForMatch(student.parentPhone)}|${student.level || ''}`;
    siblingLevelCounts[key] = (siblingLevelCounts[key] || 0) + 1;
  }

  const twinCount = sessionAtt.reduce((count, att) => {
    const student = studentMap[att.studentId];
    if (!student?.parentPhone || !student?.level) return count;
    const key = `${normalizePhoneForMatch(student.parentPhone)}|${student.level || ''}`;
    return count + (siblingLevelCounts[key] > 1 ? 1 : 0);
  }, 0);

  return {
    sessionId: session.id,
    title: session.title,
    date: session.date,
    sessionFee: fee,
    attended: sessionAtt.length,
    discountCount,
    twinCount,
    revenue: roundMoney(revenue),
    gross: roundMoney(gross),
    discount: roundMoney(gross - revenue),
  };
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function saveWaLogRecord(record) {
  const log = readDB('whatsapp_log');
  const existing = log.findIndex(m => m.id === record.id);
  if (existing >= 0) {
    log[existing] = record;
  } else {
    log.push(record);
  }
  writeDB('whatsapp_log', log);
}

function queueStudentBlockNotification(student, reason) {
  if (!student?.parentPhone) return { status: 'skipped', reason: 'missing_parent_phone' };
  if (!waService) return { status: 'skipped', reason: 'whatsapp_unavailable' };

  const record = waService.createMessageRecord({
    type: 'block',
    student: { ...student, blockReason: reason },
    session: { id: '', title: '', date: '', time: '' },
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { status: 'queued', record };
}

function readWhatsappTemplates() {
  const saved = readDB('whatsapp_templates');
  if (!saved || Array.isArray(saved)) return TEMPLATES;
  return { ...TEMPLATES, ...saved };
}

// ─── Seed default admin user ────────────────────────────────────────────────
function seedData() {
  const users = readDB('users');
  if (!users.length) {
    writeDB('users', [
      { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', name: 'System Admin', createdAt: new Date().toISOString() },
      { id: 'u2', username: 'assistant', password: 'asst123', role: 'assistant', name: 'Demo Assistant', createdAt: new Date().toISOString() }
    ]);
  }
  ['levels', 'centers', 'students', 'groups', 'sessions', 'attendance', 'quiz_scores', 'whatsapp_log', 'payments', 'block_history', 'audit_log'].forEach(db => {
    if (!fs.existsSync(dbPath(db))) writeDB(db, []);
  });
  // Seed default WhatsApp settings
  if (!fs.existsSync(dbPath('whatsapp_settings'))) {
    writeDB('whatsapp_settings', {
      autoSendAttendance: true,
      autoSendHomework: true,
      autoSendQuiz: true,
      countryCode: '20',
      minDelay: 5000,
      maxDelay: 15000,
    });
  }
  // Seed default WhatsApp templates
  if (!fs.existsSync(dbPath('whatsapp_templates'))) {
    writeDB('whatsapp_templates', TEMPLATES);
  }
  // Seed default backup settings
  if (!fs.existsSync(dbPath('backup_settings'))) {
    writeDB('backup_settings', {
      enabled: true,
      frequency: 'daily',
      maxKeep: 10,
      lastBackup: null
    });
  }
}

let corruptedFiles = [];

function verifyDataIntegrity() {
  corruptedFiles = [];
  const dir = getDataDir();
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.error('Failed to read data directory:', err);
    return corruptedFiles;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim() === '') {
        corruptedFiles.push(file);
        continue;
      }
      JSON.parse(content);
    } catch (e) {
      corruptedFiles.push(file);
    }
  }
  return corruptedFiles;
}

const TARGET_VERSION = 1;

function getSystemSettings() {
  const p = dbPath('system');
  if (!fs.existsSync(p)) {
    return { schemaVersion: 1 };
  }
  try {
    const content = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(content);
    return { schemaVersion: 1, ...data };
  } catch {
    return { schemaVersion: 1 };
  }
}

function writeSystemSettings(settings) {
  fs.writeFileSync(dbPath('system'), JSON.stringify(settings, null, 2), 'utf-8');
}

const MIGRATIONS = [
  // Registry of future schema migration functions
  // {
  //   version: 2,
  //   run: () => { ... }
  // }
];

function runMigrations() {
  const systemSettings = getSystemSettings();
  let currentVersion = systemSettings.schemaVersion || 1;
  const targetVersion = TARGET_VERSION;

  if (currentVersion < targetVersion) {
    try {
      const backupData = createBackupData();
      const dir = getBackupsDir();
      const now = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `premigration_backup_v${currentVersion}_to_v${targetVersion}_${dateStr}.json`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create pre-migration backup:', err);
      throw new Error(`Pre-migration backup failed: ${err.message}`);
    }

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion && migration.version <= targetVersion) {
        try {
          migration.run();
          currentVersion = migration.version;
          systemSettings.schemaVersion = currentVersion;
          writeSystemSettings(systemSettings);
        } catch (migrationErr) {
          console.error(`Migration to v${migration.version} failed:`, migrationErr);
          throw migrationErr;
        }
      }
    }
  }
}

// ─── Window ─────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    frame: false,
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// ─── WhatsApp Service ────────────────────────────────────────────────────────
let waService = null;

function initWhatsAppService() {
  const settings = readDB('whatsapp_settings');
  waService = new WhatsAppService({
    dataDir: getDataDir(),
    onQr: (qrDataUrl) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:qr', qrDataUrl);
      }
    },
    onReady: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:ready');
      }
    },
    onDisconnected: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:disconnected');
      }
    },
    onMessageSent: (record) => {
      saveWaLogRecord(record);
      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:message-sent', record);
      }
    },
    onStatusChange: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('whatsapp:status-change', status);
      }
    },
    getTemplates: () => readWhatsappTemplates(),
  });
  if (settings && typeof settings === 'object') {
    waService.updateSettings(settings);
  }
}

app.whenReady().then(() => {
  verifyDataIntegrity();

  if (corruptedFiles.length === 0) {
    try {
      runMigrations();
      seedData();
      initWhatsAppService();
    } catch (err) {
      console.error('Error running migrations or seeding data:', err);
    }
  }

  createWindow();

  // Initial scheduled backup check
  setTimeout(() => {
    if (corruptedFiles.length === 0) {
      checkScheduledBackup();
    }
  }, 5000);

  // Hourly check for scheduled backup
  setInterval(() => {
    if (corruptedFiles.length === 0) {
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

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Window controls
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// ── Auth ──
ipcMain.handle('auth:login', (_, { username, password }) => {
  const users = readDB('users');
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return { success: false, message: 'Invalid credentials' };
  const { password: _pw, ...safe } = user;
  return { success: true, user: safe };
});

// ── Users ──
ipcMain.handle('users:list', () => readDB('users').map(({ password: _pw, ...u }) => u));
ipcMain.handle('users:create', (_, data) => {
  const users = readDB('users');
  if (users.find(u => u.username === data.username)) return { success: false, message: 'Username already exists' };
  const user = { id: `u${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  writeDB('users', [...users, user]);
  return { success: true };
});
ipcMain.handle('users:delete', (_, id) => {
  const users = readDB('users').filter(u => u.id !== id);
  writeDB('users', users);
  return { success: true };
});
ipcMain.handle('users:update-password', (_, { id, newPassword }) => {
  const users = readDB('users').map(u => u.id === id ? { ...u, password: newPassword } : u);
  writeDB('users', users);
  return { success: true };
});

// ── Levels ──
ipcMain.handle('levels:list', () => readDB('levels'));
ipcMain.handle('levels:create', (_, data) => {
  const levels = readDB('levels');
  if (levels.find(l => l.name === data.name)) return { success: false, message: 'Level already exists' };
  const level = { id: `lv${Date.now()}`, ...data, createdAt: new Date().toISOString() };
  writeDB('levels', [...levels, level]);
  return { success: true, level };
});
ipcMain.handle('levels:update', (_, { id, ...data }) => {
  const existingLevel = readDB('levels').find(l => l.id === id);
  const levels = readDB('levels').map(l => l.id === id ? { ...l, ...data } : l);
  writeDB('levels', levels);
  syncLevelNameReferences(id, existingLevel?.name, data.name);
  return { success: true };
});
ipcMain.handle('levels:delete', (_, id) => {
  writeDB('levels', readDB('levels').filter(l => l.id !== id));
  return { success: true };
});

// ── Centers ──
ipcMain.handle('centers:list', () => readDB('centers'));
ipcMain.handle('centers:create', (_, data) => {
  const centers = readDB('centers');
  const center = { id: `c${Date.now()}`, ...data, grades: data.grades || [], createdAt: new Date().toISOString() };
  writeDB('centers', [...centers, center]);
  return { success: true, center };
});
ipcMain.handle('centers:update', (_, { id, ...data }) => {
  const existingCenter = readDB('centers').find(c => c.id === id);
  const centers = readDB('centers').map(c => c.id === id ? { ...c, ...data } : c);
  writeDB('centers', centers);
  syncCenterNameReferences(id, existingCenter?.name, data.name);
  return { success: true };
});
ipcMain.handle('centers:delete', (_, id) => {
  writeDB('centers', readDB('centers').filter(c => c.id !== id));
  return { success: true };
});

// ── Students ──
ipcMain.handle('students:list', () => readDB('students'));
ipcMain.handle('students:create', (_, data) => {
  const students = readDB('students');
  if (data.barcode && students.find(s => s.barcode === data.barcode)) return { success: false, message: 'Barcode already used' };
  const duplicatePhone = findDuplicateStudentPhone(students, data);
  if (duplicatePhone && !data.allowDuplicatePhone) {
    return { success: false, duplicatePhone: true, message: duplicatePhone.message, field: duplicatePhone.field };
  }
  const discount = normalizeStudentDiscount(data);
  const { allowDuplicatePhone: _allowDuplicatePhone, ...studentData } = data;
  const student = { id: `s${Date.now()}`, ...studentData, ...discount, createdAt: new Date().toISOString() };
  writeDB('students', [...students, student]);
  return { success: true, student, warning: duplicatePhone?.message || '', warningField: duplicatePhone?.field || '' };
});
ipcMain.handle('students:update', (_, { id, ...data }) => {
  const existingStudents = readDB('students');
  const currentStudent = existingStudents.find(s => s.id === id);
  const nextData = { ...currentStudent, ...data };
  const duplicatePhone = findDuplicateStudentPhone(existingStudents, nextData, id);
  if (duplicatePhone && !data.allowDuplicatePhone) {
    return { success: false, duplicatePhone: true, message: duplicatePhone.message, field: duplicatePhone.field };
  }
  const discount = normalizeStudentDiscount(nextData);
  const { allowDuplicatePhone: _allowDuplicatePhone, ...studentData } = data;
  const students = existingStudents.map(s => s.id === id ? { ...s, ...studentData, ...discount } : s);
  writeDB('students', students);
  return { success: true, warning: duplicatePhone?.message || '', warningField: duplicatePhone?.field || '' };
});
ipcMain.handle('students:block', (_, { id, reason, actorId, actorName }) => {
  const note = String(reason || '').trim();
  if (!note) return { success: false, message: 'Block reason is required' };
  let blockedStudent = null;
  const blockedAt = new Date().toISOString();
  const students = readDB('students').map(s => {
    if (s.id !== id) return s;
    blockedStudent = { ...s, isBlocked: true, blockReason: note, blockedAt };
    return blockedStudent;
  });
  if (!blockedStudent) return { success: false, message: 'Student not found' };
  writeDB('students', students);
  // Log block history
  const history = readDB('block_history');
  writeDB('block_history', [...history, {
    id: `bh${Date.now()}`,
    studentId: id,
    studentName: blockedStudent.name,
    action: 'block',
    reason: note,
    actorId: actorId || '',
    actorName: actorName || '',
    timestamp: blockedAt,
  }]);
  const blockNotification = queueStudentBlockNotification(blockedStudent, note);
  return { success: true, blockNotification };
});
ipcMain.handle('students:unblock', (_, payload) => {
  const studentId = typeof payload === 'string' ? payload : (payload?.id || '');
  const actorId = typeof payload === 'object' ? (payload?.actorId || '') : '';
  const actorName = typeof payload === 'object' ? (payload?.actorName || '') : '';
  const students = readDB('students').map(s => s.id === studentId ? {
    ...s, isBlocked: false, blockReason: '', blockedAt: '',
  } : s);
  const student = readDB('students').find(s => s.id === studentId);
  writeDB('students', students);
  const history = readDB('block_history');
  writeDB('block_history', [...history, {
    id: `bh${Date.now()}`,
    studentId,
    studentName: student?.name || '',
    action: 'unblock',
    reason: '',
    actorId,
    actorName,
    timestamp: new Date().toISOString(),
  }]);
  return { success: true };
});
ipcMain.handle('students:delete', (_, id) => {
  writeDB('students', readDB('students').filter(s => s.id !== id));
  return { success: true };
});
ipcMain.handle('students:by-barcode', (_, barcode) => {
  const student = readDB('students').find(s => s.barcode === barcode);
  return student || null;
});

// ── Groups ──
ipcMain.handle('groups:list', () => readDB('groups'));
ipcMain.handle('groups:create', (_, data) => {
  const groups = readDB('groups');
  const group = { id: `g${Date.now()}`, ...data, studentIds: data.studentIds || [], createdAt: new Date().toISOString() };
  writeDB('groups', [...groups, group]);
  return { success: true, group };
});
ipcMain.handle('groups:update', (_, { id, ...data }) => {
  const groups = readDB('groups').map(g => g.id === id ? { ...g, ...data } : g);
  writeDB('groups', groups);
  return { success: true };
});
ipcMain.handle('groups:delete', (_, id) => {
  writeDB('groups', readDB('groups').filter(g => g.id !== id));
  return { success: true };
});
ipcMain.handle('groups:add-student', (_, { groupId, studentId }) => {
  const groups = readDB('groups').map(g => {
    if (g.id !== groupId) return g;
    const ids = new Set(g.studentIds || []);
    ids.add(studentId);
    return { ...g, studentIds: [...ids] };
  });
  writeDB('groups', groups);
  return { success: true };
});
ipcMain.handle('groups:remove-student', (_, { groupId, studentId }) => {
  const groups = readDB('groups').map(g => {
    if (g.id !== groupId) return g;
    return { ...g, studentIds: (g.studentIds || []).filter(id => id !== studentId) };
  });
  writeDB('groups', groups);
  return { success: true };
});

// ── Sessions ──
ipcMain.handle('sessions:list', () => readDB('sessions'));
ipcMain.handle('sessions:create', (_, data) => {
  const sessions = readDB('sessions');
  const fee = normalizeSessionFee(data);
  const session = { id: `ss${Date.now()}`, ...data, ...fee, status: 'scheduled', createdAt: new Date().toISOString() };
  writeDB('sessions', [...sessions, session]);
  return { success: true, session };
});
ipcMain.handle('sessions:update', (_, { id, ...data }) => {
  const fee = normalizeSessionFee({ ...readDB('sessions').find(s => s.id === id), ...data });
  const sessions = readDB('sessions').map(s => s.id === id ? { ...s, ...data, ...fee } : s);
  writeDB('sessions', sessions);
  return { success: true };
});
ipcMain.handle('sessions:delete', (_, id) => {
  writeDB('sessions', readDB('sessions').filter(s => s.id !== id));
  return { success: true };
});

// ── Attendance ──
ipcMain.handle('attendance:list', () => readDB('attendance'));
ipcMain.handle('attendance:by-session', (_, sessionId) => readDB('attendance').filter(a => a.sessionId === sessionId));
ipcMain.handle('attendance:scan', (_, { sessionId, barcode }) => {
  const student = readDB('students').find(s => s.barcode === barcode);
  if (!student) return { success: false, message: 'Student not found for this barcode' };


  const attendance = readDB('attendance');
  const existing = attendance.find(a => a.sessionId === sessionId && a.studentId === student.id);
  if (existing) return { success: false, message: 'Student already checked in', student };

  const record = {
    id: `att${Date.now()}`,
    sessionId,
    studentId: student.id,
    studentName: student.name,
    barcode: student.barcode,
    checkInTime: new Date().toISOString(),
    homeworkStatus: 'pending',
    homeworkNote: '',
    notes: ''
  };
  writeDB('attendance', [...attendance, record]);
  return { success: true, record, student, blockWarning: studentBlockWarning(student) };
});
ipcMain.handle('attendance:update', (_, { id, ...data }) => {
  const attendance = readDB('attendance').map(a => a.id === id ? { ...a, ...data } : a);
  writeDB('attendance', attendance);
  return { success: true };
});
ipcMain.handle('attendance:manual-add', (_, { sessionId, studentId }) => {
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };

  const attendance = readDB('attendance');
  const existing = attendance.find(a => a.sessionId === sessionId && a.studentId === studentId);
  if (existing) return { success: false, message: 'Already added' };
  const record = {
    id: `att${Date.now()}`,
    sessionId, studentId,
    studentName: student.name,
    barcode: student.barcode || '',
    checkInTime: new Date().toISOString(),
    homeworkStatus: 'pending',
    homeworkNote: '',
    notes: ''
  };
  writeDB('attendance', [...attendance, record]);
  return { success: true, record, student, blockWarning: studentBlockWarning(student) };
});
ipcMain.handle('attendance:remove', (_, id) => {
  writeDB('attendance', readDB('attendance').filter(a => a.id !== id));
  return { success: true };
});

// ── Quiz Scores ──
ipcMain.handle('quizzes:list', () => readDB('quiz_scores'));
ipcMain.handle('quizzes:by-session', (_, sessionId) => readDB('quiz_scores').filter(q => q.sessionId === sessionId));
ipcMain.handle('quizzes:upsert', (_, { sessionId, studentId, score, maxScore, notes }) => {
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!session) return { success: false, message: 'Session not found' };

  const attended = readDB('attendance').some(a => a.sessionId === sessionId && a.studentId === studentId);
  if (!attended) return { success: false, message: 'Student did not attend this session' };

  const max = Number(maxScore ?? session.quizMaxScore ?? 100);
  const numScore = Number(score);
  if (Number.isNaN(numScore) || numScore < 0 || numScore > max) {
    return { success: false, message: `Score must be between 0 and ${max}` };
  }

  const quizzes = readDB('quiz_scores');
  const existing = quizzes.find(q => q.sessionId === sessionId && q.studentId === studentId);
  if (existing) {
    const updated = quizzes.map(q => q.id === existing.id
      ? { ...q, score: numScore, maxScore: max, notes: notes ?? q.notes, recordedAt: new Date().toISOString() }
      : q);
    writeDB('quiz_scores', updated);
    return { success: true, record: updated.find(q => q.id === existing.id) };
  }

  const record = {
    id: `qz${Date.now()}`,
    sessionId,
    studentId,
    studentName: student.name,
    score: numScore,
    maxScore: max,
    notes: notes || '',
    recordedAt: new Date().toISOString()
  };
  writeDB('quiz_scores', [...quizzes, record]);
  return { success: true, record };
});
ipcMain.handle('quizzes:remove', (_, id) => {
  writeDB('quiz_scores', readDB('quiz_scores').filter(q => q.id !== id));
  return { success: true };
});

// ── Reports ──
ipcMain.handle('reports:student-summary', (_, studentId) => {
  const att = readDB('attendance').filter(a => a.studentId === studentId);
  const sessions = readDB('sessions');
  const quizzes = readDB('quiz_scores').filter(q => q.studentId === studentId);
  return att.map(a => {
    const session = sessions.find(s => s.id === a.sessionId);
    const quiz = quizzes.find(q => q.sessionId === a.sessionId);
    return { ...a, sessionTitle: session?.title, sessionDate: session?.date, quizScore: quiz?.score, quizMaxScore: quiz?.maxScore };
  });
});

ipcMain.handle('reports:session-summary', (_, sessionId) => {
  const att = readDB('attendance').filter(a => a.sessionId === sessionId);
  const total = att.length;
  const homeworkDone = att.filter(a => a.homeworkStatus === 'done').length;
  const homeworkMissed = att.filter(a => a.homeworkStatus === 'missed').length;
  const homeworkPartial = att.filter(a => a.homeworkStatus === 'partial').length;
  const quizScores = readDB('quiz_scores').filter(q => q.sessionId === sessionId);
  const quizScored = quizScores.length;
  const quizAverage = quizScored
    ? Math.round(quizScores.reduce((sum, q) => sum + (q.score / q.maxScore) * 100, 0) / quizScored)
    : 0;
  return { total, homeworkDone, homeworkMissed, homeworkPartial, records: att, quizScored, quizAverage, quizScores };
});

ipcMain.handle('reports:dashboard', () => {
  const students = readDB('students');
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const sessions = readDB('sessions');
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));
  const attendance = readDB('attendance');

  let totalRevenue = 0;
  let totalGross = 0;

  for (const att of attendance) {
    const student = studentMap[att.studentId];
    const session = sessionMap[att.sessionId];
    if (!student || !session) continue;
    const gross = Number(session.sessionFee) || 0;
    const net = getAttendanceFee(gross, student);
    totalGross += gross;
    totalRevenue += net;
  }

  const sessionRevenue = sessions
    .map(s => calcSessionRevenue(s, attendance, studentMap))
    .filter(s => s.attended > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    students: students.length,
    groups: readDB('groups').length,
    sessions: sessions.length,
    centers: readDB('centers').length,
    levels: readDB('levels').length,
    totalAttendance: attendance.length,
    totalRevenue: roundMoney(totalRevenue),
    totalGross: roundMoney(totalGross),
    totalDiscount: roundMoney(totalGross - totalRevenue),
    sessionRevenue,
  };
});

// ── WhatsApp IPC Handlers ────────────────────────────────────────────────────

ipcMain.handle('whatsapp:init', async () => {
  if (!waService) initWhatsAppService();
  return await waService.init();
});

ipcMain.handle('whatsapp:status', () => {
  if (!waService) return { status: 'disconnected', queueLength: 0, isProcessing: false, settings: {} };
  return waService.getStatus();
});

ipcMain.handle('whatsapp:disconnect', async () => {
  if (!waService) return { success: true };
  return await waService.disconnect();
});

ipcMain.handle('whatsapp:update-settings', (_, newSettings) => {
  const saved = readDB('whatsapp_settings') || {};
  const merged = { ...saved, ...newSettings };
  writeDB('whatsapp_settings', merged);
  if (waService) waService.updateSettings(merged);
  return { success: true, settings: merged };
});

ipcMain.handle('whatsapp:get-settings', () => {
  return readDB('whatsapp_settings') || {};
});

ipcMain.handle('whatsapp:send-attendance', (_, { studentId, sessionId }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const student = readDB('students').find(s => s.id === studentId);
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!student || !session) return { success: false, error: 'Student or session not found' };
  const attendance = readDB('attendance').find(a => a.sessionId === sessionId && a.studentId === studentId);

  // Deduplication: check if we already sent attendance for this student+session
  const log = readDB('whatsapp_log');
  const alreadySent = log.find(m => m.studentId === studentId && m.sessionId === sessionId && m.type === 'attendance' && m.status === 'sent');
  if (alreadySent) return { success: false, error: 'Already sent', duplicate: true };

  const record = waService.createMessageRecord({
    type: 'attendance',
    student,
    session,
    attendanceRecord: attendance,
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { success: true, record };
});

ipcMain.handle('whatsapp:send-homework', (_, { studentId, sessionId }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const student = readDB('students').find(s => s.id === studentId);
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!student || !session) return { success: false, error: 'Student or session not found' };
  const attendance = readDB('attendance').find(a => a.sessionId === sessionId && a.studentId === studentId);
  if (!attendance) return { success: false, error: 'No attendance record' };

  const record = waService.createMessageRecord({
    type: 'homework',
    student,
    session,
    attendanceRecord: attendance,
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { success: true, record };
});

ipcMain.handle('whatsapp:send-quiz', (_, { studentId, sessionId }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const student = readDB('students').find(s => s.id === studentId);
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!student || !session) return { success: false, error: 'Student or session not found' };

  const quizRecord = readDB('quiz_scores').find(q => q.sessionId === sessionId && q.studentId === studentId);
  if (!quizRecord) return { success: false, error: 'No quiz score found' };

  // Deduplication
  const log = readDB('whatsapp_log');
  const alreadySent = log.find(m => m.studentId === studentId && m.sessionId === sessionId && m.type === 'quiz' && m.status === 'sent');
  if (alreadySent) return { success: false, error: 'Already sent', duplicate: true };

  const record = waService.createMessageRecord({
    type: 'quiz',
    student,
    session,
    quizScore: quizRecord.score,
    quizMax: quizRecord.maxScore,
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { success: true, record };
});

function getOrCreateSummaryQuizRecord(session, studentId, studentName) {
  if (!session?.hasQuiz) return null;

  const quizzes = readDB('quiz_scores');
  const existing = quizzes.find(q => q.sessionId === session.id && q.studentId === studentId);
  if (existing) return existing;

  const maxScore = Number(session.quizMaxScore ?? 10) || 10;
  const record = {
    id: `qz${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    sessionId: session.id,
    studentId,
    studentName,
    score: 0,
    maxScore,
    notes: 'Auto-set to zero when sending parent summary',
    recordedAt: new Date().toISOString()
  };
  writeDB('quiz_scores', [...quizzes, record]);
  return record;
}

ipcMain.handle('whatsapp:send-session-summary', (_, { studentId, sessionId }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const student = readDB('students').find(s => s.id === studentId);
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!student || !session) return { success: false, error: 'Student or session not found' };

  const attendance = readDB('attendance').find(a => a.sessionId === sessionId && a.studentId === studentId);
  if (!attendance) return { success: false, error: 'No attendance record' };

  const quizRecord = getOrCreateSummaryQuizRecord(session, studentId, student.name);
  const log = readDB('whatsapp_log');
  const alreadySent = log.find(m => m.studentId === studentId && m.sessionId === sessionId && m.type === 'session_summary' && m.status === 'sent');
  if (alreadySent) return { success: false, error: 'Already sent', duplicate: true };

  const record = waService.createMessageRecord({
    type: 'session_summary',
    student,
    session,
    attendanceRecord: attendance,
    quizScore: quizRecord?.score,
    quizMax: quizRecord?.maxScore,
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { success: true, record };
});

ipcMain.handle('whatsapp:send-session-batch', (_, { sessionId, type }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const students = readDB('students');
  const attendance = readDB('attendance').filter(a => a.sessionId === sessionId);
  const quizScores = readDB('quiz_scores').filter(q => q.sessionId === sessionId);
  const log = readDB('whatsapp_log');
  const batchType = type || 'attendance';

  let queued = 0;
  let skipped = 0;

  for (const att of attendance) {
    const student = students.find(s => s.id === att.studentId);
    if (!student) { skipped++; continue; }

    // Deduplication
    const alreadySent = log.find(m => m.studentId === student.id && m.sessionId === sessionId && m.type === batchType && m.status === 'sent');
    if (alreadySent) { skipped++; continue; }

    if (batchType === 'attendance') {
      const record = waService.createMessageRecord({
        type: 'attendance',
        student,
        session,
        attendanceRecord: att,
      });
      saveWaLogRecord(record);
      waService.queueMessage(record);
      queued++;
    } else if (batchType === 'quiz') {
      const quiz = quizScores.find(q => q.studentId === student.id);
      if (!quiz) { skipped++; continue; }
      const record = waService.createMessageRecord({
        type: 'quiz',
        student,
        session,
        quizScore: quiz.score,
        quizMax: quiz.maxScore,
      });
      saveWaLogRecord(record);
      waService.queueMessage(record);
      queued++;
    } else if (batchType === 'session_summary') {
      const quiz = session.hasQuiz
        ? getOrCreateSummaryQuizRecord(session, student.id, student.name)
        : null;
      const record = waService.createMessageRecord({
        type: 'session_summary',
        student,
        session,
        attendanceRecord: att,
        quizScore: quiz?.score,
        quizMax: quiz?.maxScore,
      });
      saveWaLogRecord(record);
      waService.queueMessage(record);
      queued++;
    }
  }

  return { success: true, queued, skipped };
});

ipcMain.handle('whatsapp:send-absence-batch', (_, { sessionId }) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const session = readDB('sessions').find(s => s.id === sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const groups = readDB('groups');
  const group = groups.find(g => g.id === session.groupId);
  if (!group || !group.studentIds || !group.studentIds.length) {
    return { success: false, error: 'No group or no students in group' };
  }

  const students = readDB('students');
  const attendance = readDB('attendance').filter(a => a.sessionId === sessionId);
  const attendedIds = new Set(attendance.map(a => a.studentId));
  const log = readDB('whatsapp_log');

  let queued = 0;
  let skipped = 0;

  for (const studentId of group.studentIds) {
    // Skip students who DID attend
    if (attendedIds.has(studentId)) { skipped++; continue; }

    const student = students.find(s => s.id === studentId);
    if (!student) { skipped++; continue; }

    // Deduplication: check if already sent absence for this student+session
    const alreadySent = log.find(m => m.studentId === studentId && m.sessionId === sessionId && m.type === 'absence' && m.status === 'sent');
    if (alreadySent) { skipped++; continue; }

    const record = waService.createMessageRecord({
      type: 'absence',
      student,
      session,
    });
    saveWaLogRecord(record);
    waService.queueMessage(record);
    queued++;
  }

  return { success: true, queued, skipped };
});

ipcMain.handle('whatsapp:get-log', (_, filters) => {
  let log = readDB('whatsapp_log');
  if (filters) {
    if (filters.sessionId) log = log.filter(m => m.sessionId === filters.sessionId);
    if (filters.studentId) log = log.filter(m => m.studentId === filters.studentId);
    if (filters.status) log = log.filter(m => m.status === filters.status);
    if (filters.type) log = log.filter(m => m.type === filters.type);
  }
  return log.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
});

ipcMain.handle('whatsapp:retry', (_, messageId) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const log = readDB('whatsapp_log');
  const msg = log.find(m => m.id === messageId);
  if (!msg) return { success: false, error: 'Message not found' };

  // Reset and re-queue
  msg.status = 'queued';
  msg.error = '';
  msg.sentAt = '';
  saveWaLogRecord(msg);
  waService.queueMessage(msg);
  return { success: true };
});

ipcMain.handle('whatsapp:resend', (_, messageId) => {
  if (!waService) return { success: false, error: 'Service not initialized' };
  const log = readDB('whatsapp_log');
  const msg = log.find(m => m.id === messageId);
  if (!msg) return { success: false, error: 'Message not found' };

  const student = readDB('students').find(s => s.id === msg.studentId);
  const session = readDB('sessions').find(s => s.id === msg.sessionId);
  if (!student || !session) return { success: false, error: 'Student or session not found' };

  const attendance = readDB('attendance').find(a => a.sessionId === msg.sessionId && a.studentId === msg.studentId);
  const quizRecord = readDB('quiz_scores').find(q => q.sessionId === msg.sessionId && q.studentId === msg.studentId);

  const record = waService.createMessageRecord({
    type: msg.type,
    student,
    session,
    attendanceRecord: attendance,
    quizScore: quizRecord?.score,
    quizMax: quizRecord?.maxScore,
  });
  saveWaLogRecord(record);
  waService.queueMessage(record);
  return { success: true, record };
});

ipcMain.handle('whatsapp:get-session-status', (_, sessionId) => {
  const log = readDB('whatsapp_log').filter(m => m.sessionId === sessionId);
  const attendance = readDB('attendance').filter(a => a.sessionId === sessionId);
  const statusMap = {};
  for (const m of log) {
    // Keep the most recent status per student+type
    const key = `${m.studentId}_${m.type}`;
    if (!statusMap[key] || m.createdAt > statusMap[key].createdAt) {
      statusMap[key] = m;
    }
  }
  return {
    log,
    statusMap,
    totalAttended: attendance.length,
    sent: log.filter(m => m.status === 'sent').length,
    failed: log.filter(m => m.status === 'failed').length,
    queued: log.filter(m => m.status === 'queued').length,
    noPhone: log.filter(m => m.status === 'no_phone').length,
  };
});

// ── Templates ──
ipcMain.handle('templates:list', () => {
  return readWhatsappTemplates();
});

ipcMain.handle('templates:save', (_, { category, id, text }) => {
  const templates = readWhatsappTemplates();
  if (!templates[category]) return { success: false, error: 'Invalid category' };

  if (id) {
    const idx = templates[category].findIndex(t => t.id === id);
    if (idx >= 0) {
      templates[category][idx].text = text;
    } else {
      return { success: false, error: 'Template not found' };
    }
  } else {
    // Generate new ID based on category prefix + timestamp
    const prefix = category.substring(0, 3);
    const newId = `${prefix}_${Date.now()}`;
    templates[category].push({ id: newId, text });
  }

  writeDB('whatsapp_templates', templates);
  return { success: true, templates };
});

ipcMain.handle('templates:delete', (_, { category, id }) => {
  const templates = readWhatsappTemplates();
  if (!templates[category]) return { success: false, error: 'Invalid category' };

  if (templates[category].length <= 1) {
    return { success: false, error: 'Cannot delete the last template in a category' };
  }

  templates[category] = templates[category].filter(t => t.id !== id);
  writeDB('whatsapp_templates', templates);
  return { success: true, templates };
});

ipcMain.handle('templates:reset', () => {
  writeDB('whatsapp_templates', TEMPLATES);
  return { success: true, templates: TEMPLATES };
});

// ── Backup IPC Handlers ──

ipcMain.handle('backup:get-settings', () => {
  return readDB('backup_settings');
});

ipcMain.handle('backup:update-settings', (_, settings) => {
  const current = readDB('backup_settings');
  const updated = { ...current, ...settings };
  writeDB('backup_settings', updated);
  return { success: true };
});

ipcMain.handle('backup:list', () => {
  return getBackupsList();
});

ipcMain.handle('backup:create', () => {
  try {
    const backupData = createBackupData();
    const dir = getBackupsDir();
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `manual_backup_${dateStr}.json`;
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
  try {
    const filePath = path.join(getBackupsDir(), filename);
    if (path.dirname(filePath) !== getBackupsDir() || !fs.existsSync(filePath)) {
      return { success: false, error: 'Backup file not found' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const backupObj = JSON.parse(content);

    // Create a pre-restore backup first for safety!
    try {
      const currentBackup = createBackupData();
      const now = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const preRestorePath = path.join(getBackupsDir(), `prerestore_backup_${dateStr}.json`);
      fs.writeFileSync(preRestorePath, JSON.stringify(currentBackup, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create pre-restore backup, but continuing:', err);
    }

    restoreBackupData(backupObj);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('backup:export', async () => {
  try {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const defaultName = `edutrack_backup_${dateStr}.json`;

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Backup',
      defaultPath: defaultName,
      filters: [{ name: 'EduTrack Backup (*.json)', extensions: ['json'] }]
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
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Backup',
      filters: [{ name: 'EduTrack Backup (*.json)', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };

    const content = fs.readFileSync(filePaths[0], 'utf-8');
    const backupObj = JSON.parse(content);

    if (!backupObj || typeof backupObj !== 'object' || !backupObj.dbs) {
      return { success: false, error: 'Invalid file format. This is not a valid EduTrack backup.' };
    }

    // Create a pre-restore backup first for safety!
    try {
      const currentBackup = createBackupData();
      const now = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const preRestorePath = path.join(getBackupsDir(), `prerestore_backup_${dateStr}.json`);
      fs.writeFileSync(preRestorePath, JSON.stringify(currentBackup, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to create pre-restore backup, but continuing:', err);
    }

    restoreBackupData(backupObj);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── System Data Integrity & Recovery IPC Handlers ──
ipcMain.handle('system:get-corrupted-files', () => {
  verifyDataIntegrity();
  return corruptedFiles;
});

ipcMain.handle('system:reset-corrupted-files', () => {
  try {
    for (const file of corruptedFiles) {
      const filePath = path.join(getDataDir(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    verifyDataIntegrity();
    if (corruptedFiles.length === 0) {
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

// ── Backup Reminder IPC Handler ──
ipcMain.handle('backup:check-reminder', () => {
  try {
    const list = getBackupsList();
    if (list.length === 0) {
      return { showReminder: true, daysSince: null };
    }

    // Sort logic is already in getBackupsList (descending timestamp)
    const latest = list[0];
    const lastBackupDate = new Date(latest.timestamp);
    const now = new Date();
    const diffMs = now - lastBackupDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 3) {
      return { showReminder: true, daysSince: Math.floor(diffDays) };
    }
    return { showReminder: false, daysSince: Math.floor(diffDays) };
  } catch (e) {
    console.error('Error in backup:check-reminder handler:', e);
    return { showReminder: false, error: e.message };
  }
});

// ── Phase 1 – Setup Wizard & Security IPC Handlers ──────────────────────────

// The two default seeded user IDs created by seedData()
const DEFAULT_USER_IDS = new Set(['u1', 'u2']);
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Returns { needsSetup: boolean }.
 * needsSetup is true when:
 *   1. system.json does NOT have setupCompleted = true, AND
 *   2. All existing users are the two default seeded accounts (or there are none).
 */
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

/**
 * Completes the first-run setup wizard.
 * Expects: { ownerName, centerName, adminUsername, adminPassword, countryCode, defaultLevel }
 * Returns: { success: boolean, message?: string }
 */
ipcMain.handle('system:complete-setup', (_, data) => {
  try {
    const { ownerName, centerName, adminUsername, adminPassword, countryCode, defaultLevel } = data || {};

    // Validate required fields
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
      id: `u${Date.now()}`,
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
        const center = { id: `c${Date.now()}`, name: centerName.trim(), grades: [], createdAt: new Date().toISOString() };
        writeDB('centers', [...centers, center]);
      }
    }

    // 4. Seed default academic level from setup input
    if (defaultLevel && String(defaultLevel).trim()) {
      const levels = readDB('levels');
      if (!levels.find(l => l.name === defaultLevel.trim())) {
        const level = { id: `lv${Date.now()}`, name: defaultLevel.trim(), createdAt: new Date().toISOString() };
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

/**
 * Returns { hasDefault: boolean }.
 * true when any user still has the original default admin credentials.
 */
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

// ── Payments (Admin-Only) ────────────────────────────────────────────────────

ipcMain.handle('payments:list', () => {
  return readDB('payments').sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
});

ipcMain.handle('payments:by-student', (_, studentId) => {
  return readDB('payments')
    .filter(p => p.studentId === studentId)
    .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
});

ipcMain.handle('payments:create', (_, data) => {
  const { studentId, amount, method, note, date } = data || {};
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) return { success: false, message: 'Amount must be a positive number' };
  const payments = readDB('payments');
  const record = {
    id: `pay${Date.now()}`,
    studentId,
    studentName: student.name,
    amount: roundMoney(numAmount),
    method: method || 'cash',
    note: String(note || '').trim(),
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  writeDB('payments', [...payments, record]);
  return { success: true, record };
});

ipcMain.handle('payments:delete', (_, id) => {
  writeDB('payments', readDB('payments').filter(p => p.id !== id));
  return { success: true };
});

ipcMain.handle('payments:student-balance', (_, studentId) => {
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };

  const attendance = readDB('attendance').filter(a => a.studentId === studentId);
  const sessions = readDB('sessions');
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

  let totalGross = 0;
  let totalDiscount = 0;
  const sessionDetails = [];

  for (const att of attendance) {
    const session = sessionMap[att.sessionId];
    if (!session) continue;
    const fee = Number(session.sessionFee) || 0;
    const net = getAttendanceFee(fee, student);
    totalGross += fee;
    totalDiscount += (fee - net);
    sessionDetails.push({
      sessionId: session.id,
      sessionTitle: session.title,
      sessionDate: session.date,
      fee,
      netFee: roundMoney(net),
      discount: roundMoney(fee - net),
    });
  }

  const totalDue = roundMoney(totalGross - totalDiscount);
  const payments = readDB('payments').filter(p => p.studentId === studentId);
  const totalPaid = roundMoney(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  const remaining = roundMoney(totalDue - totalPaid);

  return {
    success: true,
    student,
    totalGross: roundMoney(totalGross),
    totalDiscount: roundMoney(totalDiscount),
    totalDue,
    totalPaid,
    remaining,
    sessionsAttended: attendance.length,
    sessionDetails: sessionDetails.sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || '')),
    payments,
  };
});

ipcMain.handle('reports:financial-summary', () => {
  const students = readDB('students');
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const sessions = readDB('sessions');
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));
  const attendance = readDB('attendance');
  const payments = readDB('payments');

  let totalGross = 0;
  let totalDiscount = 0;
  const attendanceTotalsByStudent = new Map();
  const paymentsByStudent = new Map();

  for (const att of attendance) {
    const student = studentMap[att.studentId];
    const session = sessionMap[att.sessionId];
    if (!student || !session) continue;
    const fee = Number(session.sessionFee) || 0;
    const discount = fee - getAttendanceFee(fee, student);
    totalGross += fee;
    totalDiscount += discount;
    const current = attendanceTotalsByStudent.get(student.id) || { gross: 0, discount: 0, count: 0 };
    current.gross += fee;
    current.discount += discount;
    current.count += 1;
    attendanceTotalsByStudent.set(student.id, current);
  }

  const totalDue = roundMoney(totalGross - totalDiscount);
  let collected = 0;
  for (const payment of payments) {
    const amount = Number(payment.amount) || 0;
    collected += amount;
    paymentsByStudent.set(payment.studentId, (paymentsByStudent.get(payment.studentId) || 0) + amount);
  }
  const totalCollected = roundMoney(collected);
  const totalOutstanding = roundMoney(totalDue - totalCollected);

  const studentBalances = students.map(student => {
    const totals = attendanceTotalsByStudent.get(student.id) || { gross: 0, discount: 0, count: 0 };
    const gross = totals.gross;
    const discount = totals.discount;
    const due = roundMoney(gross - discount);
    const paid = roundMoney(paymentsByStudent.get(student.id) || 0);
    const remaining = roundMoney(due - paid);
    return { studentId: student.id, studentName: student.name, sessionsAttended: totals.count, due, paid, remaining };
  }).filter(b => b.due > 0 || b.paid > 0);

  return {
    totalGross: roundMoney(totalGross),
    totalDiscount: roundMoney(totalDiscount),
    totalDue,
    totalCollected,
    totalOutstanding,
    studentBalances,
    paymentsCount: payments.length,
  };
});

// ── Phase 3 – Daily Operations ───────────────────────────────────────────────

// ── Excel Export ──
ipcMain.handle('export:excel', async (_, { sheetName, columns, rows, filename }) => {
  try {
    if (!XLSX) return { success: false, error: 'xlsx not available — run: npm install xlsx' };
    const defaultName = filename || `${sheetName || 'export'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to Excel', defaultPath: defaultName,
      filters: [{ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    const header = columns.map(c => c.label || c.key);
    const data = rows.map(row => columns.map(c => row[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    XLSX.writeFile(wb, filePath);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Student Import Preview ──
ipcMain.handle('import:students-preview', async () => {
  try {
    if (!XLSX) return { success: false, error: 'xlsx not available — run: npm install xlsx' };
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Students from Excel',
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.length) return { success: false, canceled: true };
    const wb = XLSX.readFile(filePaths[0]);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const existingStudents = readDB('students');
    const existingBarcodes = new Set(existingStudents.map(s => s.barcode).filter(Boolean));
    const levels = readDB('levels');
    const centers = readDB('centers');
    const valid = [], invalid = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const rowNum = i + 2;
      const name = String(row['name'] || row['Name'] || row['الاسم'] || '').trim();
      const barcode = String(row['barcode'] || row['Barcode'] || row['الباركود'] || '').trim();
      const phone = String(row['phone'] || row['Phone'] || row['هاتف'] || '').trim();
      const parentPhone = String(row['parentPhone'] || row['parent_phone'] || row['هاتف ولي الأمر'] || '').trim();
      const levelName = String(row['level'] || row['Level'] || row['grade'] || row['Grade'] || row['المستوى'] || '').trim();
      const centerName = String(row['center'] || row['Center'] || row['المركز'] || '').trim();
      const discountPct = Number(row['discount'] || row['Discount'] || row['الخصم'] || 0);
      if (!name) { invalid.push({ rowNum, data: row, reason: 'Name is required' }); continue; }
      if (barcode && existingBarcodes.has(barcode)) { invalid.push({ rowNum, data: row, reason: `Barcode "${barcode}" already exists` }); continue; }
      const level = levelName ? levels.find(l => l.name.toLowerCase() === levelName.toLowerCase()) : null;
      const center = centerName ? centers.find(c => c.name.toLowerCase() === centerName.toLowerCase()) : null;
      valid.push({
        rowNum, name, barcode: barcode || null, phone, parentPhone,
        levelId: level?.id || null, levelName: level?.name || levelName || '',
        centerId: center?.id || null, centerName: center?.name || centerName || '',
        hasDiscount: discountPct > 0, discountPercent: discountPct > 0 ? Math.min(discountPct, 100) : 0,
      });
    }
    return { success: true, valid, invalid, total: raw.length };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Student Import Commit ──
ipcMain.handle('import:students-template', async () => {
  try {
    if (!XLSX) return { success: false, error: 'xlsx not available - run: npm install xlsx' };
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Student Import Template',
      defaultPath: 'EduTrack_Student_Import_Template.xlsx',
      filters: [
        { name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] },
        { name: 'Excel 97-2004 Workbook (*.xls)', extensions: ['xls'] },
        { name: 'CSV File (*.csv)', extensions: ['csv'] },
      ],
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    const headers = ['name', 'barcode', 'phone', 'parentPhone', 'grade', 'center', 'discount'];
    const rows = [
      headers,
      ['Ahmed Hassan', 'BC1001', '01012345678', '01087654321', 'Grade 10', 'Main Center', 0],
      ['Mona Ali', 'BC1002', '01112345678', '01187654321', 'Grade 11', 'Main Center', 15],
      ['Omar Samir', '', '01212345678', '01287654321', 'Grade 12', 'Branch Center', 0],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, filePath);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('import:students-commit', (_, { rows }) => {
  try {
    const students = readDB('students');
    let levels = readDB('levels');
    let centers = readDB('centers');
    const existingBarcodes = new Set(students.map(s => s.barcode).filter(Boolean));
    const created = [], skipped = [];
    const createdLevels = [];
    const createdCenters = [];
    const updatedCenters = [];
    const levelMap = new Map(levels.map(l => [String(l.name || '').trim().toLowerCase(), l]));
    const centerMap = new Map(centers.map(c => [String(c.name || '').trim().toLowerCase(), c]));
    const now = new Date().toISOString();

    const ensureLevel = (levelName) => {
      const name = String(levelName || '').trim();
      if (!name) return null;
      const key = name.toLowerCase();
      const existing = levelMap.get(key);
      if (existing) return existing;
      const level = {
        id: `lv${Date.now()}_${createdLevels.length + 1}`,
        name,
        description: '',
        needsCompletion: true,
        createdAt: now,
      };
      levels.push(level);
      levelMap.set(key, level);
      createdLevels.push(level);
      return level;
    };

    const ensureCenter = (centerName, gradeName) => {
      const name = String(centerName || '').trim();
      if (!name) return null;
      const key = name.toLowerCase();
      let center = centerMap.get(key);
      if (!center) {
        center = {
          id: `c${Date.now()}_${createdCenters.length + 1}`,
          name,
          location: '',
          contact: '',
          grades: gradeName ? [gradeName] : [],
          needsCompletion: true,
          createdAt: now,
        };
        centers.push(center);
        centerMap.set(key, center);
        createdCenters.push(center);
        return center;
      }

      if (gradeName && !(center.grades || []).includes(gradeName)) {
        center = { ...center, grades: [...(center.grades || []), gradeName] };
        centers = centers.map(c => c.id === center.id ? center : c);
        centerMap.set(key, center);
        updatedCenters.push({ id: center.id, name: center.name, grade: gradeName });
      }
      return center;
    };

    for (const row of rows) {
      if (row.barcode && existingBarcodes.has(row.barcode)) { skipped.push(row); continue; }
      const level = ensureLevel(row.levelName);
      const center = ensureCenter(row.centerName, level?.name || row.levelName || '');
      const student = {
        id: `s${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
        name: row.name, barcode: row.barcode || null, phone: row.phone || '',
        parentPhone: row.parentPhone || '', levelId: level?.id || row.levelId || null,
        level: level?.name || row.levelName || '', centerId: center?.id || row.centerId || null, center: center?.name || row.centerName || '',
        hasDiscount: row.hasDiscount || false, discountPercent: row.discountPercent || 0,
        isBlocked: false, blockReason: '', createdAt: new Date().toISOString(),
      };
      if (row.barcode) existingBarcodes.add(row.barcode);
      created.push(student);
    }
    if (createdLevels.length) writeDB('levels', levels);
    if (createdCenters.length || updatedCenters.length) writeDB('centers', centers);
    writeDB('students', [...students, ...created]);
    return {
      success: true,
      created: created.length,
      skipped: skipped.length,
      createdLevels: createdLevels.map(({ id, name }) => ({ id, name })),
      createdCenters: createdCenters.map(({ id, name }) => ({ id, name })),
      updatedCenters,
      needsCompletion: createdLevels.length > 0 || createdCenters.length > 0 || updatedCenters.length > 0,
    };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Session Duplication ──
ipcMain.handle('sessions:duplicate', (_, { sessionId, newDate }) => {
  const sessions = readDB('sessions');
  const source = sessions.find(s => s.id === sessionId);
  if (!source) return { success: false, message: 'Session not found' };
  if (!newDate) return { success: false, message: 'New date is required' };
  const { id: _id, createdAt: _c, ...rest } = source;
  const newSession = { ...rest, id: `ss${Date.now()}`, date: newDate, status: 'scheduled', createdAt: new Date().toISOString(), duplicatedFrom: sessionId };
  writeDB('sessions', [...sessions, newSession]);
  return { success: true, session: newSession };
});

// ── Recurring Sessions ──
ipcMain.handle('sessions:create-recurring', (_, data) => {
  const { groupId, titleTemplate, sessionFee, startDate, endDate, daysOfWeek, time, duration, topic, homework, hasQuiz, quizMaxScore } = data;
  if (!groupId || !titleTemplate || !startDate || !endDate || !daysOfWeek?.length)
    return { success: false, message: 'Group, title template, date range, and days are required' };
  const group = readDB('groups').find(g => g.id === groupId);
  if (!group) return { success: false, message: 'Group not found' };
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayIndices = daysOfWeek.map(d => typeof d === 'number' ? d : DAY_NAMES.indexOf(d)).filter(d => d >= 0);
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (start > end) return { success: false, message: 'Start date must be before end date' };
  const daysInRange = Math.floor((end - start) / 86400000) + 1;
  if (daysInRange > 730) return { success: false, message: 'Recurring sessions are limited to a 2-year date range' };
  const sessions = readDB('sessions');
  const created = [];
  const createdAt = new Date().toISOString();
  let sessionNum = 1;
  const cur = new Date(start);
  while (cur <= end) {
    if (dayIndices.includes(cur.getDay())) {
      if (created.length >= 500) return { success: false, message: 'Recurring session generation is limited to 500 sessions at a time' };
      const dateStr = cur.toISOString().slice(0, 10);
      const title = titleTemplate.replace('{n}', sessionNum).replace('{date}', dateStr).replace('{group}', group.name);
      created.push({ id: `ss${Date.now()}_r${sessionNum}`, title, groupId, date: dateStr, time: time || '', duration: duration || '', sessionFee: Number(sessionFee) || 0, topic: topic || '', homework: homework || '', hasQuiz: hasQuiz || false, quizMaxScore: hasQuiz ? (Number(quizMaxScore) || 10) : null, status: 'scheduled', createdAt, isRecurring: true });
      sessionNum++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (!created.length) return { success: false, message: 'No sessions generated — check date range and days' };
  writeDB('sessions', [...sessions, ...created]);
  return { success: true, count: created.length, sessions: created };
});

// ── Bulk Student Operations ──
ipcMain.handle('students:bulk-assign-group', (_, { studentIds, groupId }) => {
  try {
    const selectedIds = Array.isArray(studentIds) ? studentIds : [];
    const groups = readDB('groups');
    if (!groups.find(g => g.id === groupId)) return { success: false, message: 'Group not found' };
    writeDB('groups', groups.map(g => {
      if (g.id !== groupId) return g;
      const existing = new Set(g.studentIds || []);
      selectedIds.forEach(id => existing.add(id));
      return { ...g, studentIds: [...existing] };
    }));
    return { success: true, count: selectedIds.length };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('students:bulk-update-level', (_, { studentIds, levelId, levelName }) => {
  try {
    const selectedIds = new Set(Array.isArray(studentIds) ? studentIds : []);
    writeDB('students', readDB('students').map(s => selectedIds.has(s.id) ? { ...s, levelId: levelId || s.levelId, level: levelName || s.level } : s));
    return { success: true, count: selectedIds.size };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('students:bulk-update-center', (_, { studentIds, centerId, centerName }) => {
  try {
    const selectedIds = new Set(Array.isArray(studentIds) ? studentIds : []);
    writeDB('students', readDB('students').map(s => selectedIds.has(s.id) ? { ...s, centerId: centerId || s.centerId, center: centerName || s.center } : s));
    return { success: true, count: selectedIds.size };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Student Profile Timeline ──
ipcMain.handle('students:timeline', (_, studentId) => {
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };
  const sessionMap = Object.fromEntries(readDB('sessions').map(s => [s.id, s]));
  const events = [];
  for (const a of readDB('attendance').filter(a => a.studentId === studentId))
    events.push({ type: 'attendance', date: a.checkInTime, title: `Attended: ${sessionMap[a.sessionId]?.title || 'Unknown session'}`, detail: `Homework: ${a.homeworkStatus || 'pending'}${a.homeworkNote ? ' — ' + a.homeworkNote : ''}`, sessionId: a.sessionId });
  for (const q of readDB('quiz_scores').filter(q => q.studentId === studentId))
    events.push({ type: 'quiz', date: q.recordedAt, title: `Quiz: ${sessionMap[q.sessionId]?.title || 'Unknown session'}`, detail: `Score: ${q.score}/${q.maxScore}${q.notes ? ' — ' + q.notes : ''}`, sessionId: q.sessionId });
  for (const p of readDB('payments').filter(p => p.studentId === studentId))
    events.push({ type: 'payment', date: p.createdAt, title: 'Payment recorded', detail: `${(p.amount || 0).toLocaleString()} EGP via ${p.method}${p.note ? ' — ' + p.note : ''}` });
  for (const b of readDB('block_history').filter(b => b.studentId === studentId))
    events.push({ type: b.action, date: b.timestamp, title: b.action === 'block' ? 'Student blocked' : 'Student unblocked', detail: b.reason ? `Reason: ${b.reason}` : '' });
  for (const m of readDB('whatsapp_log').filter(m => m.studentId === studentId))
    events.push({ type: 'whatsapp', date: m.sentAt || m.createdAt, title: `WhatsApp: ${m.type}`, detail: `Status: ${m.status}` });
  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { success: true, student, events };
});

// ── Block History Query ──
ipcMain.handle('students:block-history', (_, studentId) => {
  const history = readDB('block_history');
  const filtered = studentId ? history.filter(b => b.studentId === studentId) : history;
  return filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
});

// ── Attendance Correction ──
ipcMain.handle('attendance:transfer', (_, { attendanceId, newSessionId, actorId, actorName }) => {
  try {
    const attendance = readDB('attendance');
    const rec = attendance.find(a => a.id === attendanceId);
    if (!rec) return { success: false, message: 'Attendance record not found' };
    const newSession = readDB('sessions').find(s => s.id === newSessionId);
    if (!newSession) return { success: false, message: 'Target session not found' };
    if (attendance.find(a => a.sessionId === newSessionId && a.studentId === rec.studentId))
      return { success: false, message: 'Student already checked in to the target session' };
    const oldSessionId = rec.sessionId;
    writeDB('attendance', attendance.map(a => a.id === attendanceId ? { ...a, sessionId: newSessionId } : a));
    const audit = readDB('audit_log');
    writeDB('audit_log', [...audit, { id: `al${Date.now()}`, action: 'attendance_transfer', studentId: rec.studentId, studentName: rec.studentName, attendanceId, fromSessionId: oldSessionId, toSessionId: newSessionId, actorId: actorId || '', actorName: actorName || '', timestamp: new Date().toISOString() }]);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('attendance:reassign-student', (_, { attendanceId, newStudentId, actorId, actorName }) => {
  try {
    const attendance = readDB('attendance');
    const rec = attendance.find(a => a.id === attendanceId);
    if (!rec) return { success: false, message: 'Attendance record not found' };
    const newStudent = readDB('students').find(s => s.id === newStudentId);
    if (!newStudent) return { success: false, message: 'Student not found' };
    if (attendance.find(a => a.sessionId === rec.sessionId && a.studentId === newStudentId && a.id !== attendanceId))
      return { success: false, message: 'Student already checked in to this session' };
    const oldStudentId = rec.studentId;
    writeDB('attendance', attendance.map(a => a.id === attendanceId ? { ...a, studentId: newStudentId, studentName: newStudent.name, barcode: newStudent.barcode || '' } : a));
    const audit = readDB('audit_log');
    writeDB('audit_log', [...audit, { id: `al${Date.now()}`, action: 'attendance_reassign', fromStudentId: oldStudentId, toStudentId: newStudentId, studentName: newStudent.name, attendanceId, sessionId: rec.sessionId, actorId: actorId || '', actorName: actorName || '', timestamp: new Date().toISOString() }]);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ── Barcode Generation ──
ipcMain.handle('students:generate-barcode', (_, studentId) => {
  const students = readDB('students');
  const student = students.find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };
  if (student.barcode) return { success: false, message: 'Student already has a barcode' };
  const existingBarcodes = new Set(students.map(s => s.barcode).filter(Boolean));
  let barcode;
  do { barcode = 'BC' + String(Math.floor(100000 + Math.random() * 900000)); } while (existingBarcodes.has(barcode));
  writeDB('students', students.map(s => s.id === studentId ? { ...s, barcode } : s));
  return { success: true, barcode };
});

ipcMain.handle('students:bulk-generate-barcodes', () => {
  const students = readDB('students');
  const existingBarcodes = new Set(students.map(s => s.barcode).filter(Boolean));
  let count = 0;
  const updated = students.map(s => {
    if (s.barcode) return s;
    let barcode;
    do { barcode = 'BC' + String(Math.floor(100000 + Math.random() * 900000)); } while (existingBarcodes.has(barcode));
    existingBarcodes.add(barcode);
    count++;
    return { ...s, barcode };
  });
  writeDB('students', updated);
  return { success: true, count };
});
