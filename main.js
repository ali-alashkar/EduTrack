const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const WhatsAppService = require('./whatsapp-service');
const { TEMPLATES } = require('./whatsapp-templates');

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
  ['levels', 'centers', 'students', 'groups', 'sessions', 'attendance', 'quiz_scores', 'whatsapp_log'].forEach(db => {
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
  seedData();
  initWhatsAppService();
  createWindow();
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
  const levels = readDB('levels').map(l => l.id === id ? { ...l, ...data } : l);
  writeDB('levels', levels);
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
  const centers = readDB('centers').map(c => c.id === id ? { ...c, ...data } : c);
  writeDB('centers', centers);
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
ipcMain.handle('students:block', (_, { id, reason }) => {
  const note = String(reason || '').trim();
  if (!note) return { success: false, message: 'Block reason is required' };
  let blockedStudent = null;
  const blockedAt = new Date().toISOString();
  const students = readDB('students').map(s => {
    if (s.id !== id) return s;
    blockedStudent = {
      ...s,
      isBlocked: true,
      blockReason: note,
      blockedAt,
    };
    return blockedStudent;
  });
  if (!blockedStudent) return { success: false, message: 'Student not found' };
  writeDB('students', students);
  const blockNotification = queueStudentBlockNotification(blockedStudent, note);
  return { success: true, blockNotification };
});
ipcMain.handle('students:unblock', (_, id) => {
  const students = readDB('students').map(s => s.id === id ? {
    ...s,
    isBlocked: false,
    blockReason: '',
    blockedAt: '',
  } : s);
  writeDB('students', students);
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
