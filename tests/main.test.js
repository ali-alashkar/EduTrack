/**
 * ============================================================
 *  EduTrack – Comprehensive Unit Test Suite
 *  Tests every IPC handler registered in main.js
 *  Run: npm test
 * ============================================================
 *
 *  How it works:
 *  1. `mockMemStore` is prefixed with "mock" so Jest allows it
 *     inside jest.mock() factory functions (hoisting rule).
 *  2. `electron` is mocked: ipcMain.handle/on calls are captured
 *     into `ipcHandlers` so we can invoke them directly.
 *  3. `fs` is mocked with an in-memory store — no real disk I/O.
 *  4. main.js is required once → all handlers are registered.
 *  5. Each test calls handlers directly via ipcHandlers[channel].
 * ============================================================
 */

'use strict';

// ── In-memory filesystem  ────────────────────────────────────
// MUST be prefixed "mock" for Jest's hoisting to allow its use
// inside jest.mock() factory functions.
let mockMemStore = {};

// ── IPC handler registry ─────────────────────────────────────
const ipcHandlers = {};

// ── Fake Electron event (first arg of every handle callback) ─
const fakeEvent = {};

// ── Mock `electron` ──────────────────────────────────────────
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    on: jest.fn(),
    quit: jest.fn(),
    commandLine: {
      appendSwitch: jest.fn(),
    },
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    minimize: jest.fn(),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    isMaximized: jest.fn(() => false),
    close: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn((channel, handler) => { ipcHandlers[channel] = handler; }),
    on: jest.fn((channel, handler) => { ipcHandlers[channel] = handler; }),
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(() => ({})),
  },
  dialog: { showOpenDialog: jest.fn() },
}));


// ── Mock `fs` with in-memory key-value store ─────────────────
jest.mock('fs', () => {
  const path = require('path');
  return {
    existsSync: jest.fn((p) => Object.prototype.hasOwnProperty.call(mockMemStore, p)),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((p) => {
      if (Object.prototype.hasOwnProperty.call(mockMemStore, p)) return mockMemStore[p];
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    }),
    writeFileSync: jest.fn((p, data) => { mockMemStore[p] = data; }),
    readdirSync: jest.fn((dir) => {
      const normalizedDir = path.normalize(dir);
      return Object.keys(mockMemStore)
        .map(p => path.normalize(p))
        .filter(p => p.startsWith(normalizedDir) && p !== normalizedDir)
        .map(p => p.substring(normalizedDir.length).replace(/^[\\/]/, ''))
        .filter(name => !name.includes(path.sep));
    }),
    statSync: jest.fn((p) => ({
      size: (mockMemStore[p] || '').length,
      mtime: new Date()
    })),
    unlinkSync: jest.fn((p) => {
      delete mockMemStore[p];
    }),
  };
});

// ── 16. IMPORT (Phase 3) ─────────────────────────────────────
describe('IMPORT - student commit creates missing setup data', () => {
  beforeEach(() => {
    resetStore();
    seed('students', []);
    seed('levels', []);
    seed('centers', []);
  });

  test('import:students-commit creates missing grade and center records', () => {
    const res = call('import:students-commit', {
      rows: [
        {
          name: 'Imported Student',
          barcode: 'IMP001',
          phone: '01000000000',
          parentPhone: '01100000000',
          levelName: 'Grade 9',
          centerName: 'New Center',
          hasDiscount: true,
          discountPercent: 10,
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.created).toBe(1);
    expect(res.needsCompletion).toBe(true);
    expect(res.createdLevels.map(l => l.name)).toEqual(['Grade 9']);
    expect(res.createdCenters.map(c => c.name)).toEqual(['New Center']);

    const levels = read('levels');
    const centers = read('centers');
    const students = read('students');
    expect(levels[0]).toMatchObject({ name: 'Grade 9', needsCompletion: true });
    expect(centers[0]).toMatchObject({ name: 'New Center', grades: ['Grade 9'], needsCompletion: true });
    expect(students[0]).toMatchObject({
      name: 'Imported Student',
      levelId: levels[0].id,
      level: 'Grade 9',
      centerId: centers[0].id,
      center: 'New Center',
    });
  });

  test('import:students-commit generates unique IDs for all imported students in tight loop', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      name: `Student ${i + 1}`,
      barcode: `IMP_UNIQUE_${i + 1}`,
      phone: `010000000${i}`,
      parentPhone: `011000000${i}`,
      levelName: 'Grade 10',
      centerName: 'Center A',
    }));

    const res = call('import:students-commit', { rows });
    expect(res.success).toBe(true);
    expect(res.created).toBe(10);

    const students = read('students');
    const ids = students.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
  });

  test('import:students-commit assigns a new grade to an existing center', () => {
    seed('levels', [{ id: 'lv1', name: 'Grade 10', createdAt: '2024-01-01T00:00:00Z' }]);
    seed('centers', [{ id: 'c1', name: 'Main Center', grades: [], createdAt: '2024-01-01T00:00:00Z' }]);

    const res = call('import:students-commit', {
      rows: [
        {
          name: 'Imported Student',
          barcode: 'IMP002',
          levelName: 'Grade 10',
          centerName: 'Main Center',
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.createdLevels).toEqual([]);
    expect(res.createdCenters).toEqual([]);
    expect(res.updatedCenters).toEqual([{ id: 'c1', name: 'Main Center', grade: 'Grade 10' }]);
    expect(read('centers')[0].grades).toEqual(['Grade 10']);
    expect(read('students')[0]).toMatchObject({ levelId: 'lv1', centerId: 'c1' });
  });
});

// ── 16. IMPORT (Phase 3) ─────────────────────────────────────
// ── Mock WhatsApp service (avoids loading puppeteer/whatsapp-web.js) ──
const mockWaInstance = {
  init: jest.fn().mockResolvedValue({ success: true, status: 'disconnected' }),
  disconnect: jest.fn().mockResolvedValue({ success: true }),
  getStatus: jest.fn(() => ({ status: 'disconnected', queueLength: 0, isProcessing: false, settings: {} })),
  updateSettings: jest.fn(),
  createMessageRecord: jest.fn(({ type, student, session, attendanceRecord, quizScore, quizMax }) => ({
    id: `wm_${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    parentPhone: student.parentPhone || '',
    sessionId: session.id,
    sessionTitle: session.title,
    type,
    messageText: type === 'block'
      ? `Test block message for ${student.name}: ${student.blockReason}`
      : `Test ${type} message for ${student.name}`,
    templateIndex: 0,
    status: 'queued',
    error: '',
    sentAt: '',
    createdAt: new Date().toISOString(),
    homeworkStatus: attendanceRecord?.homeworkStatus,
    quizScore,
    quizMax,
  })),
  queueMessage: jest.fn(),
};

jest.mock('../whatsapp-service', () => {
  return jest.fn().mockImplementation(() => mockWaInstance);
});

// ── Load main.js → registers all IPC handlers ────────────────
require('../main');

// ── Helpers ──────────────────────────────────────────────────
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data', 'edutrack_data');

function dbPath(name) { return path.join(DATA_DIR, `${name}.json`); }

/** Call a registered ipcMain handler */
function call(channel, payload) {
  const handler = ipcHandlers[channel];
  if (!handler) throw new Error(`No IPC handler registered for "${channel}"`);
  return handler(fakeEvent, payload);
}

/** Seed a DB file in the in-memory store */
function seed(name, rows) {
  mockMemStore[dbPath(name)] = JSON.stringify(rows);
}

/** Read back a DB from the in-memory store */
function read(name) {
  return JSON.parse(mockMemStore[dbPath(name)] || '[]');
}

/** Clear all in-memory state between tests */
function resetStore() { mockMemStore = {}; }

// =============================================================
//  TEST SUITES
// =============================================================

// ── 1. AUTH ──────────────────────────────────────────────────
describe('AUTH – auth:login', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
    seed('users', [
      { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', name: 'System Admin', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'u2', username: 'assistant', password: 'asst123', role: 'assistant', name: 'Demo Assistant', createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('✓ valid admin login → success, no password in response', () => {
    const res = call('auth:login', { username: 'admin', password: 'admin123' });
    expect(res.success).toBe(true);
    expect(res.user.username).toBe('admin');
    expect(res.user.role).toBe('admin');
    expect(res.user).not.toHaveProperty('password');
  });

  test('✓ valid assistant login → success', () => {
    const res = call('auth:login', { username: 'assistant', password: 'asst123' });
    expect(res.success).toBe(true);
    expect(res.user.role).toBe('assistant');
  });

  test('✗ wrong password → failure + message', () => {
    const res = call('auth:login', { username: 'admin', password: 'wrongpass' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/invalid/i);
  });

  test('✗ non-existent user → failure', () => {
    const res = call('auth:login', { username: 'ghost', password: 'any' });
    expect(res.success).toBe(false);
  });

  test('✗ empty credentials → failure', () => {
    const res = call('auth:login', { username: '', password: '' });
    expect(res.success).toBe(false);
  });
});

// ── 2. USERS ─────────────────────────────────────────────────
describe('USERS – CRUD + password', () => {
  beforeEach(() => {
    resetStore();
    seed('users', [
      { id: 'u1', username: 'admin', password: 'secret', role: 'admin', name: 'Admin', createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('users:list – strips password field', () => {
    const users = call('users:list');
    expect(Array.isArray(users)).toBe(true);
    expect(users[0]).not.toHaveProperty('password');
    expect(users[0].username).toBe('admin');
  });

  test('users:create – creates new user', () => {
    const res = call('users:create', { username: 'teacher1', password: 'pass123', role: 'assistant', name: 'Teacher One' });
    expect(res.success).toBe(true);
    expect(read('users')).toHaveLength(2);
  });

  test('users:create – rejects duplicate username', () => {
    const res = call('users:create', { username: 'admin', password: 'other', role: 'admin', name: 'Dup' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already exists/i);
  });

  test('users:delete – removes the user', () => {
    const res = call('users:delete', 'u1');
    expect(res.success).toBe(true);
    expect(read('users')).toHaveLength(0);
  });

  test('users:delete – non-existent id is idempotent', () => {
    const res = call('users:delete', 'u999');
    expect(res.success).toBe(true);
    expect(read('users')).toHaveLength(1); // original still there
  });

  test('users:update-password – persists new password', () => {
    call('users:update-password', { id: 'u1', newPassword: 'newSecret99' });
    expect(read('users')[0].password).toBe('newSecret99');
  });
});

// ── 3. LEVELS ────────────────────────────────────────────────
describe('LEVELS – CRUD', () => {
  beforeEach(() => {
    resetStore();
    seed('levels', [
      { id: 'lv1', name: 'Beginner', description: 'Entry level', createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('levels:list – returns all levels', () => {
    expect(call('levels:list')).toHaveLength(1);
  });

  test('levels:create – creates level + returns it', () => {
    const res = call('levels:create', { name: 'Intermediate', description: 'Mid level' });
    expect(res.success).toBe(true);
    expect(res.level).toHaveProperty('id');
    expect(read('levels')).toHaveLength(2);
  });

  test('levels:create – rejects duplicate name', () => {
    const res = call('levels:create', { name: 'Beginner' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already exists/i);
  });

  test('levels:update – changes level name', () => {
    call('levels:update', { id: 'lv1', name: 'Beginner+', description: 'Updated' });
    expect(read('levels')[0].name).toBe('Beginner+');
  });

  test('levels:update - syncs renamed level to students, groups, and center grades', () => {
    seed('students', [
      { id: 's1', name: 'Linked Student', levelId: 'lv1', level: 'Beginner' },
      { id: 's2', name: 'Name-only Student', level: 'Beginner' },
      { id: 's3', name: 'Other Student', levelId: 'lv2', level: 'Other' },
    ]);
    seed('groups', [
      { id: 'g1', name: 'Linked Group', levelId: 'lv1', level: 'Beginner' },
      { id: 'g2', name: 'Name-only Group', level: 'Beginner' },
    ]);
    seed('centers', [
      { id: 'c1', name: 'Main Center', grades: ['Beginner', 'Other'] },
    ]);

    call('levels:update', { id: 'lv1', name: 'Beginner+' });

    expect(read('students')).toEqual([
      { id: 's1', name: 'Linked Student', levelId: 'lv1', level: 'Beginner+' },
      { id: 's2', name: 'Name-only Student', level: 'Beginner+' },
      { id: 's3', name: 'Other Student', levelId: 'lv2', level: 'Other' },
    ]);
    expect(read('groups').map(g => g.level)).toEqual(['Beginner+', 'Beginner+']);
    expect(read('centers')[0].grades).toEqual(['Beginner+', 'Other']);
  });

  test('levels:delete – removes level', () => {
    call('levels:delete', 'lv1');
    expect(read('levels')).toHaveLength(0);
  });
});

// ── 4. CENTERS ───────────────────────────────────────────────
describe('CENTERS – CRUD', () => {
  beforeEach(() => {
    resetStore();
    seed('centers', [
      { id: 'c1', name: 'Downtown Center', city: 'Cairo', grades: ['A', 'B'], createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('centers:list – returns all centers', () => {
    expect(call('centers:list')).toHaveLength(1);
  });

  test('centers:create – creates center with grades', () => {
    const res = call('centers:create', { name: 'Uptown Center', city: 'Alexandria', grades: ['C'] });
    expect(res.success).toBe(true);
    expect(res.center.grades).toEqual(['C']);
    expect(read('centers')).toHaveLength(2);
  });

  test('centers:create – no grades defaults to []', () => {
    const res = call('centers:create', { name: 'Empty Center' });
    expect(res.center.grades).toEqual([]);
  });

  test('centers:update – changes city, keeps name', () => {
    call('centers:update', { id: 'c1', city: 'Giza' });
    const stored = read('centers')[0];
    expect(stored.city).toBe('Giza');
    expect(stored.name).toBe('Downtown Center');
  });

  test('centers:update - syncs renamed center to students and groups', () => {
    seed('students', [
      { id: 's1', name: 'Linked Student', centerId: 'c1', center: 'Downtown Center' },
      { id: 's2', name: 'Name-only Student', center: 'Downtown Center' },
      { id: 's3', name: 'Other Student', centerId: 'c2', center: 'Other Center' },
    ]);
    seed('groups', [
      { id: 'g1', name: 'Linked Group', centerId: 'c1', center: 'Downtown Center' },
      { id: 'g2', name: 'Name-only Group', center: 'Downtown Center' },
    ]);

    call('centers:update', { id: 'c1', name: 'Downtown Branch', city: 'Giza' });

    expect(read('students')).toEqual([
      { id: 's1', name: 'Linked Student', centerId: 'c1', center: 'Downtown Branch' },
      { id: 's2', name: 'Name-only Student', center: 'Downtown Branch' },
      { id: 's3', name: 'Other Student', centerId: 'c2', center: 'Other Center' },
    ]);
    expect(read('groups').map(g => g.center)).toEqual(['Downtown Branch', 'Downtown Branch']);
  });

  test('centers:delete – removes center', () => {
    call('centers:delete', 'c1');
    expect(read('centers')).toHaveLength(0);
  });
});

// ── 5. STUDENTS ──────────────────────────────────────────────
describe('STUDENTS – CRUD + barcode lookup', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
    seed('students', [
      { id: 's1', name: 'Alice Smith', barcode: 'BC001', phone: '01011112222', parentPhone: '01033334444', levelId: 'lv1', centerId: 'c1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 's2', name: 'Bob Jones', barcode: 'BC002', phone: '01055556666', parentPhone: '01077778888', levelId: 'lv1', centerId: 'c1', createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('students:list – returns all students', () => {
    expect(call('students:list')).toHaveLength(2);
  });

  test('students:create – creates with unique barcode', () => {
    const res = call('students:create', { name: 'Carol', barcode: 'BC003', levelId: 'lv1', centerId: 'c1' });
    expect(res.success).toBe(true);
    expect(read('students')).toHaveLength(3);
  });

  test('students:create – rejects duplicate barcode', () => {
    const res = call('students:create', { name: 'Dup', barcode: 'BC001', levelId: 'lv1', centerId: 'c1' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/barcode/i);
  });

  test('students:create – no barcode (walk-in) is allowed', () => {
    const res = call('students:create', { name: 'Walk-in', levelId: 'lv1', centerId: 'c1' });
    expect(res.success).toBe(true);
  });

  test('students:update – changes name', () => {
    call('students:update', { id: 's1', name: 'Alice Updated' });
    expect(read('students').find(s => s.id === 's1').name).toBe('Alice Updated');
  });

  test('students:create - requires approval for duplicate student phone', () => {
    const res = call('students:create', { name: 'Phone Dup', barcode: 'BC009', phone: '010 1111 2222' });
    expect(res.success).toBe(false);
    expect(res.duplicatePhone).toBe(true);
    expect(res.message).toMatch(/student phone/i);
    expect(read('students')).toHaveLength(2);

    const approved = call('students:create', { name: 'Phone Dup', barcode: 'BC009', phone: '010 1111 2222', allowDuplicatePhone: true });
    expect(approved.success).toBe(true);
    expect(approved.warning).toMatch(/student phone/i);
    expect(read('students')).toHaveLength(3);
  });

  test('students:create - requires approval when parent phone matches another student phone', () => {
    const res = call('students:create', { name: 'Parent Dup', barcode: 'BC010', parentPhone: '01055556666' });
    expect(res.success).toBe(false);
    expect(res.duplicatePhone).toBe(true);
    expect(res.message).toMatch(/parent phone/i);
  });

  test('students:update - requires approval for duplicate parent phone', () => {
    const res = call('students:update', { id: 's1', parentPhone: '01077778888' });
    expect(res.success).toBe(false);
    expect(res.duplicatePhone).toBe(true);

    const approved = call('students:update', { id: 's1', parentPhone: '01077778888', allowDuplicatePhone: true });
    expect(approved.success).toBe(true);
    expect(approved.warning).toMatch(/parent phone/i);
  });

  test('students:create - requires approval when student and parent phone are identical', () => {
    const res = call('students:create', { name: 'Same Phone', barcode: 'BC011', phone: '01099990000', parentPhone: '01099990000' });
    expect(res.success).toBe(false);
    expect(res.duplicatePhone).toBe(true);
    expect(res.message).toMatch(/same/i);
  });

  test('students:block and students:unblock - stores and clears block reason', () => {
    const blockRes = call('students:block', { id: 's1', reason: 'Needs admin review' });
    expect(blockRes.success).toBe(true);
    let stored = read('students').find(s => s.id === 's1');
    expect(stored.isBlocked).toBe(true);
    expect(stored.blockReason).toBe('Needs admin review');

    const unblockRes = call('students:unblock', 's1');
    expect(unblockRes.success).toBe(true);
    stored = read('students').find(s => s.id === 's1');
    expect(stored.isBlocked).toBe(false);
    expect(stored.blockReason).toBe('');
  });

  test('students:block - queues parent WhatsApp message with block reason', () => {
    const res = call('students:block', { id: 's1', reason: 'Payment overdue' });
    expect(res.success).toBe(true);
    expect(res.blockNotification.status).toBe('queued');

    const log = read('whatsapp_log');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      studentId: 's1',
      studentName: 'Alice Smith',
      parentPhone: '01033334444',
      type: 'block',
      status: 'queued',
    });
    expect(log[0].messageText).toContain('Payment overdue');
    expect(mockWaInstance.queueMessage).toHaveBeenCalledWith(log[0]);
  });

  test('students:delete – removes student', () => {
    call('students:delete', 's2');
    expect(read('students')).toHaveLength(1);
  });

  test('students:bulk-delete removes students and related records', () => {
    seed('groups', [
      { id: 'g1', name: 'Group 1', studentIds: ['s1', 's2', 's3'] },
    ]);
    seed('attendance', [
      { id: 'att1', studentId: 's1' },
      { id: 'att2', studentId: 's3' },
    ]);
    seed('quiz_scores', [
      { id: 'q1', studentId: 's2' },
      { id: 'q2', studentId: 's3' },
    ]);
    seed('payments', [
      { id: 'p1', studentId: 's1' },
      { id: 'p2', studentId: 's3' },
    ]);
    seed('block_history', [
      { id: 'bh1', studentId: 's2' },
      { id: 'bh2', studentId: 's3' },
    ]);
    seed('whatsapp_log', [
      { id: 'wm1', studentId: 's1' },
      { id: 'wm2', studentId: 's3' },
    ]);

    const res = call('students:bulk-delete', { studentIds: ['s1', 's2'] });

    expect(res).toMatchObject({ success: true, count: 2 });
    expect(read('students').map(s => s.id)).toEqual([]);
    expect(read('groups')[0].studentIds).toEqual(['s3']);
    expect(read('attendance').map(r => r.studentId)).toEqual(['s3']);
    expect(read('quiz_scores').map(r => r.studentId)).toEqual(['s3']);
    expect(read('payments').map(r => r.studentId)).toEqual(['s3']);
    expect(read('block_history').map(r => r.studentId)).toEqual(['s3']);
    expect(read('whatsapp_log').map(r => r.studentId)).toEqual(['s3']);
  });

  test('students:bulk-block and students:bulk-unblock update selected students', () => {
    seed('block_history', []);
    seed('whatsapp_log', []);

    const blockRes = call('students:bulk-block', { studentIds: ['s1', 's2'], reason: 'Batch review' });
    expect(blockRes.success).toBe(true);
    expect(blockRes.count).toBe(2);
    expect(read('students').every(s => s.isBlocked)).toBe(true);
    expect(read('block_history').filter(h => h.action === 'block')).toHaveLength(2);

    const unblockRes = call('students:bulk-unblock', { studentIds: ['s1'] });
    expect(unblockRes.success).toBe(true);
    expect(unblockRes.count).toBe(1);
    expect(read('students').find(s => s.id === 's1').isBlocked).toBe(false);
    expect(read('students').find(s => s.id === 's2').isBlocked).toBe(true);
    expect(read('block_history').filter(h => h.action === 'unblock')).toHaveLength(1);
  });

  test('students:by-barcode – returns matching student', () => {
    const s = call('students:by-barcode', 'BC002');
    expect(s).not.toBeNull();
    expect(s.name).toBe('Bob Jones');
  });

  test('students:by-barcode – unknown barcode returns null', () => {
    expect(call('students:by-barcode', 'UNKNOWN')).toBeNull();
  });

  test('students:create – stores discount fields only', () => {
    const res = call('students:create', {
      name: 'Carol', barcode: 'BC003',
      hasDiscount: true, discountPercent: 25,
    });
    expect(res.success).toBe(true);
    const created = res.student;
    expect(created.hasDiscount).toBe(true);
    expect(created.discountPercent).toBe(25);
  });

  test('students:create – clears discount percent when hasDiscount is false', () => {
    const res = call('students:create', {
      name: 'Dave', barcode: 'BC004',
      hasDiscount: false, discountPercent: 50,
    });
    expect(res.student.hasDiscount).toBe(false);
    expect(res.student.discountPercent).toBe(0);
  });

  test('students:update – normalizes discount percent to max 100', () => {
    call('students:update', { id: 's1', hasDiscount: true, discountPercent: 150 });
    expect(read('students').find(s => s.id === 's1').discountPercent).toBe(100);
  });
});

// ── 6. GROUPS ────────────────────────────────────────────────
describe('GROUPS – CRUD + membership', () => {
  beforeEach(() => {
    resetStore();
    seed('groups', [
      { id: 'g1', name: 'Monday Group', studentIds: ['s1'], createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('groups:list – returns all groups', () => {
    expect(call('groups:list')).toHaveLength(1);
  });

  test('groups:create – no students defaults to []', () => {
    const res = call('groups:create', { name: 'Wednesday Group' });
    expect(res.success).toBe(true);
    expect(res.group.studentIds).toEqual([]);
  });

  test('groups:create – pre-filled student ids', () => {
    const res = call('groups:create', { name: 'Friday Group', studentIds: ['s1', 's2'] });
    expect(res.group.studentIds).toHaveLength(2);
  });

  test('groups:update – changes name', () => {
    call('groups:update', { id: 'g1', name: 'Tuesday Group' });
    expect(read('groups')[0].name).toBe('Tuesday Group');
  });

  test('groups:add-student – adds student to group', () => {
    call('groups:add-student', { groupId: 'g1', studentId: 's2' });
    expect(read('groups')[0].studentIds).toContain('s2');
  });

  test('groups:add-student – adding same student twice does NOT duplicate', () => {
    call('groups:add-student', { groupId: 'g1', studentId: 's2' });
    call('groups:add-student', { groupId: 'g1', studentId: 's2' });
    const ids = read('groups')[0].studentIds;
    expect(ids.filter(id => id === 's2')).toHaveLength(1);
  });

  test('groups:remove-student – removes student from group', () => {
    call('groups:remove-student', { groupId: 'g1', studentId: 's1' });
    expect(read('groups')[0].studentIds).not.toContain('s1');
  });

  test('groups:delete – removes group', () => {
    call('groups:delete', 'g1');
    expect(read('groups')).toHaveLength(0);
  });
});

// ── 7. SESSIONS ──────────────────────────────────────────────
describe('SESSIONS – CRUD', () => {
  beforeEach(() => {
    resetStore();
    seed('sessions', [
      { id: 'ss1', title: 'Math – Week 1', groupId: 'g1', date: '2024-03-01', status: 'scheduled', createdAt: '2024-01-01T00:00:00Z' },
    ]);
  });

  test('sessions:list – returns all sessions', () => {
    expect(call('sessions:list')).toHaveLength(1);
  });

  test('sessions:create – auto-sets status to scheduled', () => {
    const res = call('sessions:create', { title: 'Math – Week 2', groupId: 'g1', date: '2024-03-08' });
    expect(res.success).toBe(true);
    expect(res.session.status).toBe('scheduled');
    expect(read('sessions')).toHaveLength(2);
  });

  test('sessions:create – stores session fee', () => {
    const res = call('sessions:create', { title: 'Paid Session', groupId: 'g1', date: '2024-03-09', sessionFee: 200 });
    expect(res.session.sessionFee).toBe(200);
  });

  test('sessions:update – marks session as completed', () => {
    call('sessions:update', { id: 'ss1', status: 'completed' });
    expect(read('sessions')[0].status).toBe('completed');
  });

  test('sessions:delete – removes session', () => {
    call('sessions:delete', 'ss1');
    expect(read('sessions')).toHaveLength(0);
  });
});

// ── 8. ATTENDANCE ────────────────────────────────────────────
describe('ATTENDANCE – scan, manual-add, update, remove', () => {
  beforeEach(() => {
    resetStore();
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001', centerId: 'c1' },
      { id: 's2', name: 'Bob', barcode: 'BC002', centerId: 'c1' },
    ]);
    seed('attendance', [
      {
        id: 'att1', sessionId: 'ss1', studentId: 's1', studentName: 'Alice',
        barcode: 'BC001', checkInTime: '2024-03-01T09:00:00Z',
        homeworkStatus: 'pending', homeworkNote: '', notes: '',
      },
    ]);
  });

  test('attendance:list – returns all records', () => {
    expect(call('attendance:list')).toHaveLength(1);
  });

  test('attendance:by-session – filters by session id', () => {
    const recs = call('attendance:by-session', 'ss1');
    expect(recs).toHaveLength(1);
    expect(recs[0].studentId).toBe('s1');
  });

  test('attendance:by-session – unknown session returns []', () => {
    expect(call('attendance:by-session', 'ss999')).toHaveLength(0);
  });

  test('attendance:scan – ✓ known barcode checks in student', () => {
    const res = call('attendance:scan', { sessionId: 'ss1', barcode: 'BC002' });
    expect(res.success).toBe(true);
    expect(res.record.studentId).toBe('s2');
    expect(res.student.name).toBe('Bob');
    expect(read('attendance')).toHaveLength(2);
  });

  test('attendance:scan - includes block warning for blocked student', () => {
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001', centerId: 'c1' },
      { id: 's2', name: 'Bob', barcode: 'BC002', centerId: 'c1', isBlocked: true, blockReason: 'Payment review' },
    ]);
    const res = call('attendance:scan', { sessionId: 'ss1', barcode: 'BC002' });
    expect(res.success).toBe(true);
    expect(res.blockWarning.reason).toBe('Payment review');
  });

  test('attendance:scan – ✗ already checked-in student rejected', () => {
    const res = call('attendance:scan', { sessionId: 'ss1', barcode: 'BC001' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already checked in/i);
  });

  test('attendance:scan – ✗ unknown barcode rejected', () => {
    const res = call('attendance:scan', { sessionId: 'ss1', barcode: 'UNKNOWN' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });

  test('attendance:update – updates homework status + note', () => {
    call('attendance:update', { id: 'att1', homeworkStatus: 'done', homeworkNote: 'All completed' });
    const updated = read('attendance')[0];
    expect(updated.homeworkStatus).toBe('done');
    expect(updated.homeworkNote).toBe('All completed');
  });

  test('attendance:manual-add – ✓ adds student manually', () => {
    const res = call('attendance:manual-add', { sessionId: 'ss1', studentId: 's2' });
    expect(res.success).toBe(true);
    expect(read('attendance')).toHaveLength(2);
  });

  test('attendance:manual-add – ✗ duplicate rejected', () => {
    const res = call('attendance:manual-add', { sessionId: 'ss1', studentId: 's1' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already added/i);
  });

  test('attendance:manual-add – ✗ unknown student rejected', () => {
    const res = call('attendance:manual-add', { sessionId: 'ss1', studentId: 's999' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });

  test('attendance:remove – removes record', () => {
    call('attendance:remove', 'att1');
    expect(read('attendance')).toHaveLength(0);
  });

  test('attendance:mark-group-absent – marks remaining group students as absent', () => {
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001' },
      { id: 's2', name: 'Bob', barcode: 'BC002' },
      { id: 's3', name: 'Carol', barcode: 'BC003' },
    ]);
    seed('groups', [
      { id: 'g1', name: 'Group 1', studentIds: ['s1', 's2', 's3'] },
    ]);
    seed('sessions', [
      { id: 'ss1', title: 'Session 1', groupId: 'g1', date: '2024-03-01' },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1', status: 'present' },
    ]);

    const res = call('attendance:mark-group-absent', { sessionId: 'ss1' });
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);

    const atts = read('attendance');
    expect(atts).toHaveLength(3);
    const absentRecords = atts.filter(a => a.status === 'absent');
    expect(absentRecords).toHaveLength(2);
    expect(absentRecords.map(a => a.studentId).sort()).toEqual(['s2', 's3']);
  });

  test('attendance:scan – converts previously absent student to present', () => {
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001' },
      { id: 's2', name: 'Bob', barcode: 'BC002' },
    ]);
    seed('attendance', [
      { id: 'att2', sessionId: 'ss1', studentId: 's2', status: 'absent', checkInTime: null, notes: 'Marked absent' },
    ]);

    const res = call('attendance:scan', { sessionId: 'ss1', barcode: 'BC002' });
    expect(res.success).toBe(true);
    expect(res.record.status).toBe('present');
    expect(res.record.checkInTime).toBeTruthy();

    const att = read('attendance').find(a => a.id === 'att2');
    expect(att.status).toBe('present');
    expect(att.checkInTime).toBeTruthy();
  });

  test('attendance:manual-add – converts previously absent student to present', () => {
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001' },
      { id: 's2', name: 'Bob', barcode: 'BC002' },
    ]);
    seed('attendance', [
      { id: 'att2', sessionId: 'ss1', studentId: 's2', status: 'absent', checkInTime: null, notes: 'Marked absent' },
    ]);

    const res = call('attendance:manual-add', { sessionId: 'ss1', studentId: 's2' });
    expect(res.success).toBe(true);
    expect(res.record.status).toBe('present');

    const att = read('attendance').find(a => a.id === 'att2');
    expect(att.status).toBe('present');
  });
});

// ── 9. QUIZ SCORES ───────────────────────────────────────────
describe('QUIZZES – upsert, list, remove', () => {
  beforeEach(() => {
    resetStore();
    seed('students', [
      { id: 's1', name: 'Alice', barcode: 'BC001' },
      { id: 's2', name: 'Bob', barcode: 'BC002' },
      { id: 's3', name: 'Carol', barcode: 'BC003' },
    ]);
    seed('sessions', [
      { id: 'ss1', title: 'Math Quiz', date: '2024-03-01', hasQuiz: true, quizMaxScore: 10 },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1', studentName: 'Alice', barcode: 'BC001', checkInTime: '2024-03-01T09:00:00Z', homeworkStatus: 'pending', homeworkNote: '', notes: '' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2', studentName: 'Bob', barcode: 'BC002', checkInTime: '2024-03-01T09:05:00Z', homeworkStatus: 'pending', homeworkNote: '', notes: '' },
    ]);
    seed('quiz_scores', [
      { id: 'qz1', sessionId: 'ss1', studentId: 's1', studentName: 'Alice', score: 8, maxScore: 10, notes: '', recordedAt: '2024-03-01T10:00:00Z' },
    ]);
  });

  test('quizzes:list – returns all quiz scores', () => {
    expect(call('quizzes:list')).toHaveLength(1);
  });

  test('quizzes:by-session – filters by session id', () => {
    const recs = call('quizzes:by-session', 'ss1');
    expect(recs).toHaveLength(1);
    expect(recs[0].studentId).toBe('s1');
  });

  test('quizzes:upsert – ✓ creates new score for student', () => {
    const res = call('quizzes:upsert', { sessionId: 'ss1', studentId: 's2', score: 7 });
    expect(res.success).toBe(true);
    expect(res.record.score).toBe(7);
    expect(read('quiz_scores')).toHaveLength(2);
  });

  test('quizzes:upsert – ✓ updates existing score', () => {
    const res = call('quizzes:upsert', { sessionId: 'ss1', studentId: 's1', score: 9, notes: 'Great' });
    expect(res.success).toBe(true);
    expect(res.record.score).toBe(9);
    expect(res.record.notes).toBe('Great');
    expect(read('quiz_scores')).toHaveLength(1);
  });

  test('quizzes:upsert – ✗ score above max rejected', () => {
    const res = call('quizzes:upsert', { sessionId: 'ss1', studentId: 's2', score: 15 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/between 0 and/i);
  });

  test('quizzes:upsert – ✗ unknown student rejected', () => {
    const res = call('quizzes:upsert', { sessionId: 'ss1', studentId: 's999', score: 5 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });

  test('quizzes:upsert – ✗ student who did not attend rejected', () => {
    const res = call('quizzes:upsert', { sessionId: 'ss1', studentId: 's3', score: 5 });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/did not attend/i);
  });

  test('quizzes:remove – removes score record', () => {
    call('quizzes:remove', 'qz1');
    expect(read('quiz_scores')).toHaveLength(0);
  });
});

// ── 10. REPORTS ──────────────────────────────────────────────
describe('REPORTS – student, session, dashboard', () => {
  beforeEach(() => {
    resetStore();
    seed('students', [{ id: 's1', name: 'Alice' }]);
    seed('sessions', [
      { id: 'ss1', title: 'Math – Week 1', date: '2024-03-01' },
      { id: 'ss2', title: 'Math – Week 2', date: '2024-03-08' },
    ]);
    seed('groups', [{ id: 'g1' }]);
    seed('centers', [{ id: 'c1' }]);
    seed('levels', [{ id: 'lv1' }]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1', homeworkStatus: 'done' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2', homeworkStatus: 'missed' },
      { id: 'att3', sessionId: 'ss1', studentId: 's3', homeworkStatus: 'partial' },
      { id: 'att4', sessionId: 'ss2', studentId: 's1', homeworkStatus: 'done' },
    ]);
    seed('quiz_scores', [
      { id: 'qz1', sessionId: 'ss1', studentId: 's1', score: 8, maxScore: 10 },
    ]);
  });

  test('reports:student-summary – lists sessions attended by student', () => {
    const summary = call('reports:student-summary', 's1');
    expect(summary).toHaveLength(2);
    expect(summary[0].sessionTitle).toBe('Math – Week 1');
    expect(summary[0].quizScore).toBe(8);
    expect(summary[1].sessionTitle).toBe('Math – Week 2');
  });

  test('reports:student-summary – student with no records returns []', () => {
    expect(call('reports:student-summary', 's999')).toHaveLength(0);
  });

  test('reports:session-summary – counts homework statuses correctly', () => {
    const res = call('reports:session-summary', 'ss1');
    expect(res.total).toBe(3);
    expect(res.homeworkDone).toBe(1);
    expect(res.homeworkMissed).toBe(1);
    expect(res.homeworkPartial).toBe(1);
    expect(res.records).toHaveLength(3);
    expect(res.quizScored).toBe(1);
    expect(res.quizAverage).toBe(80);
  });

  test('reports:session-summary – empty session returns all zeros', () => {
    const res = call('reports:session-summary', 'ss999');
    expect(res.total).toBe(0);
    expect(res.homeworkDone).toBe(0);
  });

  test('reports:dashboard – returns correct entity counts', () => {
    const dash = call('reports:dashboard');
    expect(dash.students).toBe(1);
    expect(dash.groups).toBe(1);
    expect(dash.sessions).toBe(2);
    expect(dash.centers).toBe(1);
    expect(dash.levels).toBe(1);
    expect(dash.totalAttendance).toBe(4);
    expect(dash.totalRevenue).toBe(0);
    expect(dash.totalGross).toBe(0);
    expect(dash.totalDiscount).toBe(0);
  });
});

// ── 11. DASHBOARD REVENUE ────────────────────────────────────
describe('DASHBOARD REVENUE – session fee × attended students', () => {
  beforeEach(() => resetStore());

  test('scenario: no discount – revenue equals session fee × attendances', () => {
    seed('sessions', [
      { id: 'ss1', title: 'Session A', date: '2024-03-01', sessionFee: 100 },
      { id: 'ss2', title: 'Session B', date: '2024-03-02', sessionFee: 100 },
    ]);
    seed('students', [{ id: 's1', name: 'Alice', hasDiscount: false, discountPercent: 0 }]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss2', studentId: 's1' },
    ]);
    const dash = call('reports:dashboard');
    expect(dash.totalGross).toBe(200);
    expect(dash.totalRevenue).toBe(200);
    expect(dash.totalDiscount).toBe(0);
    expect(dash.sessionRevenue).toHaveLength(2);
  });

  test('scenario: 20% student discount – applied to session fee', () => {
    seed('sessions', [
      { id: 'ss1', title: 'Session A', date: '2024-03-01', sessionFee: 100 },
      { id: 'ss2', title: 'Session B', date: '2024-03-02', sessionFee: 100 },
    ]);
    seed('students', [{ id: 's1', name: 'Alice', hasDiscount: true, discountPercent: 20 }]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss2', studentId: 's1' },
    ]);
    const dash = call('reports:dashboard');
    expect(dash.totalGross).toBe(200);
    expect(dash.totalRevenue).toBe(160);
    expect(dash.totalDiscount).toBe(40);
  });

  test('scenario: mixed students per session – sums correctly', () => {
    seed('sessions', [
      { id: 'ss1', title: 'Session A', date: '2024-03-01', sessionFee: 200 },
      { id: 'ss2', title: 'Session B', date: '2024-03-02', sessionFee: 100 },
    ]);
    seed('students', [
      { id: 's1', name: 'Alice', hasDiscount: false, discountPercent: 0 },
      { id: 's2', name: 'Bob', hasDiscount: true, discountPercent: 50 },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2' },
      { id: 'att3', sessionId: 'ss2', studentId: 's2' },
    ]);
    const dash = call('reports:dashboard');
    expect(dash.totalGross).toBe(500);
    expect(dash.totalRevenue).toBe(350);
    expect(dash.totalDiscount).toBe(150);
    expect(dash.sessionRevenue.find(s => s.sessionId === 'ss1').revenue).toBe(300);
    expect(dash.sessionRevenue.find(s => s.sessionId === 'ss2').revenue).toBe(50);
  });

  test('scenario: zero session fee – contributes nothing', () => {
    seed('sessions', [{ id: 'ss1', title: 'Free Session', date: '2024-03-01', sessionFee: 0 }]);
    seed('students', [{ id: 's1', name: 'Walk-in', hasDiscount: false, discountPercent: 0 }]);
    seed('attendance', [{ id: 'att1', sessionId: 'ss1', studentId: 's1' }]);
    const dash = call('reports:dashboard');
    expect(dash.totalRevenue).toBe(0);
    expect(dash.sessionRevenue).toHaveLength(1);
    expect(dash.sessionRevenue[0].revenue).toBe(0);
    expect(dash.sessionRevenue[0].attended).toBe(1);
  });

  test('scenario: missing student or session – skipped safely', () => {
    seed('sessions', [{ id: 'ss1', title: 'Session A', date: '2024-03-01', sessionFee: 100 }]);
    seed('students', [{ id: 's1', name: 'Alice', hasDiscount: false, discountPercent: 0 }]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's_missing' },
      { id: 'att3', sessionId: 'ss_missing', studentId: 's1' },
    ]);
    const dash = call('reports:dashboard');
    expect(dash.totalRevenue).toBe(100);
    expect(dash.totalGross).toBe(100);
  });

  test('scenario: per-session breakdown includes attended count', () => {
    seed('sessions', [{ id: 'ss1', title: 'Math', date: '2024-03-01', sessionFee: 150 }]);
    seed('students', [
      { id: 's1', name: 'Alice', hasDiscount: false, discountPercent: 0 },
      { id: 's2', name: 'Bob', hasDiscount: true, discountPercent: 10 },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2' },
    ]);
    const row = call('reports:dashboard').sessionRevenue[0];
    expect(row.attended).toBe(2);
    expect(row.discountCount).toBe(1);
    expect(row.twinCount).toBe(0);
    expect(row.gross).toBe(300);
    expect(row.revenue).toBe(285);
    expect(row.discount).toBe(15);
  });

  test('scenario: twin students in same session are counted', () => {
    seed('sessions', [{ id: 'ss1', title: 'Sibling Session', date: '2024-03-01', sessionFee: 100 }]);
    seed('students', [
      { id: 's1', name: 'Ali', parentPhone: '01000000000', level: 'Grade 10', hasDiscount: false, discountPercent: 0 },
      { id: 's2', name: 'Omar', parentPhone: '01000000000', level: 'Grade 10', hasDiscount: false, discountPercent: 0 },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2' },
    ]);
    const row = call('reports:dashboard').sessionRevenue[0];
    expect(row.attended).toBe(2);
    expect(row.twinCount).toBe(2);
    expect(row.discountCount).toBe(0);
    expect(row.discount).toBe(0);
  });

  test('scenario: same parent but different levels are not counted as twins', () => {
    seed('sessions', [{ id: 'ss1', title: 'Sibling Session', date: '2024-03-01', sessionFee: 100 }]);
    seed('students', [
      { id: 's1', name: 'Ali', parentPhone: '01000000000', level: 'Grade 10' },
      { id: 's2', name: 'Omar', parentPhone: '01000000000', level: 'Grade 11' },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2' },
    ]);
    const row = call('reports:dashboard').sessionRevenue[0];
    expect(row.twinCount).toBe(0);
  });
});

// ── 12. WHATSAPP ──────────────────────────────────────────────
describe('WHATSAPP – settings, send, log, retry, resend', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
    seed('whatsapp_settings', {
      autoSendAttendance: true,
      autoSendHomework: true,
      autoSendQuiz: true,
      countryCode: '20',
      minDelay: 5000,
      maxDelay: 15000,
    });
    seed('students', [
      { id: 's1', name: 'Ali', parentPhone: '01033334444', barcode: 'BC001' },
      { id: 's2', name: 'No Phone Kid', parentPhone: '', barcode: 'BC002' },
    ]);
    seed('sessions', [
      { id: 'ss1', title: 'Algebra Ch3', date: '2024-03-01', time: '10:00' },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1', studentName: 'Ali', homeworkStatus: 'done', homeworkNote: 'Great' },
    ]);
    seed('quiz_scores', [
      { id: 'qz1', sessionId: 'ss1', studentId: 's1', score: 8, maxScore: 10 },
    ]);
    seed('whatsapp_log', []);
  });

  test('whatsapp:get-settings – returns saved settings', () => {
    const settings = call('whatsapp:get-settings');
    expect(settings.countryCode).toBe('20');
    expect(settings.autoSendAttendance).toBe(true);
  });

  test('whatsapp:update-settings – merges and persists', () => {
    const res = call('whatsapp:update-settings', { countryCode: '966', autoSendQuiz: false });
    expect(res.success).toBe(true);
    expect(res.settings.countryCode).toBe('966');
    expect(res.settings.autoSendQuiz).toBe(false);
  });

  test('whatsapp:status – returns disconnected by default', () => {
    const status = call('whatsapp:status');
    expect(status.status).toBe('disconnected');
    expect(status.queueLength).toBe(0);
  });

  test('whatsapp:send-attendance – queues message and saves to log', () => {
    const res = call('whatsapp:send-attendance', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(true);
    expect(res.record.status).toBe('queued');
    expect(mockWaInstance.queueMessage).toHaveBeenCalled();
    const log = read('whatsapp_log');
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('attendance');
    expect(log[0].studentName).toBe('Ali');
  });

  test('whatsapp:send-attendance – deduplicates sent messages', () => {
    seed('whatsapp_log', [
      { id: 'wm1', studentId: 's1', sessionId: 'ss1', type: 'attendance', status: 'sent', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const res = call('whatsapp:send-attendance', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(false);
    expect(res.duplicate).toBe(true);
  });

  test('whatsapp:send-homework – queues homework update', () => {
    const res = call('whatsapp:send-homework', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(true);
    expect(read('whatsapp_log')[0].type).toBe('homework');
  });

  test('whatsapp:send-quiz – queues quiz score message', () => {
    const res = call('whatsapp:send-quiz', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(true);
    expect(read('whatsapp_log')[0].type).toBe('quiz');
  });

  test('whatsapp:send-session-batch – queues unsent attendance for session', () => {
    const res = call('whatsapp:send-session-batch', { sessionId: 'ss1', type: 'attendance' });
    expect(res.success).toBe(true);
    expect(res.queued).toBe(1);
    expect(read('whatsapp_log')).toHaveLength(1);
  });

  test('whatsapp:send-session-summary - non-quiz session sends attendance and homework only', () => {
    const res = call('whatsapp:send-session-summary', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(true);
    const log = read('whatsapp_log');
    expect(log[0].type).toBe('session_summary');
    expect(log[0].homeworkStatus).toBe('done');
    expect(log[0].quizScore).toBeUndefined();
    expect(read('quiz_scores')).toHaveLength(1);
  });

  test('whatsapp:send-session-summary - quiz session creates zero score when missing', () => {
    seed('sessions', [
      { id: 'ss1', title: 'Algebra Ch3', date: '2024-03-01', time: '10:00', hasQuiz: true, quizMaxScore: 10 },
    ]);
    seed('quiz_scores', []);

    const res = call('whatsapp:send-session-summary', { studentId: 's1', sessionId: 'ss1' });
    expect(res.success).toBe(true);

    const quizScores = read('quiz_scores');
    expect(quizScores).toHaveLength(1);
    expect(quizScores[0].score).toBe(0);
    expect(quizScores[0].maxScore).toBe(10);

    const log = read('whatsapp_log');
    expect(log[0].type).toBe('session_summary');
    expect(log[0].quizScore).toBe(0);
    expect(log[0].quizMax).toBe(10);
  });

  test('whatsapp:get-log – filters by session and status', () => {
    seed('whatsapp_log', [
      { id: 'wm1', sessionId: 'ss1', status: 'sent', type: 'attendance', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'wm2', sessionId: 'ss1', status: 'failed', type: 'quiz', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const filtered = call('whatsapp:get-log', { sessionId: 'ss1', status: 'sent' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('wm1');
  });

  test('whatsapp:retry – re-queues failed message', () => {
    seed('whatsapp_log', [
      { id: 'wm_fail', studentId: 's1', sessionId: 'ss1', type: 'attendance', status: 'failed', error: 'timeout', parentPhone: '01033334444', messageText: 'hi', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const res = call('whatsapp:retry', 'wm_fail');
    expect(res.success).toBe(true);
    expect(read('whatsapp_log')[0].status).toBe('queued');
    expect(mockWaInstance.queueMessage).toHaveBeenCalled();
  });

  test('whatsapp:resend – creates fresh message record', () => {
    seed('whatsapp_log', [
      { id: 'wm_old', studentId: 's1', sessionId: 'ss1', type: 'quiz', status: 'sent', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const res = call('whatsapp:resend', 'wm_old');
    expect(res.success).toBe(true);
    expect(read('whatsapp_log')).toHaveLength(2);
    expect(res.record.id).not.toBe('wm_old');
  });

  test('whatsapp:get-session-status – returns per-student status map', () => {
    seed('whatsapp_log', [
      { id: 'wm1', studentId: 's1', sessionId: 'ss1', type: 'attendance', status: 'sent', createdAt: '2024-01-01T00:00:00Z' },
    ]);
    const res = call('whatsapp:get-session-status', 'ss1');
    expect(res.totalAttended).toBe(1);
    expect(res.sent).toBe(1);
    expect(res.statusMap['s1_attendance'].status).toBe('sent');
  });
});

// ── 12. BACKUP & RESTORE ──────────────────────────────────────
describe('BACKUP & RESTORE – settings, list, create, delete, restore', () => {
  beforeEach(() => {
    resetStore();
    seed('backup_settings', {
      enabled: true,
      frequency: 'daily',
      maxKeep: 10,
      lastBackup: null
    });
    // Seed some other data files
    seed('students', [{ id: 's1', name: 'Alice' }]);
    seed('attendance', [{ id: 'att1', sessionId: 'ss1', studentId: 's1' }]);
  });

  test('backup:get-settings – returns seeded settings', () => {
    const res = call('backup:get-settings');
    expect(res.enabled).toBe(true);
    expect(res.frequency).toBe('daily');
  });

  test('backup:update-settings – updates settings', () => {
    const res = call('backup:update-settings', { enabled: false, frequency: 'weekly', maxKeep: 5 });
    expect(res.success).toBe(true);
    const settings = call('backup:get-settings');
    expect(settings.enabled).toBe(false);
    expect(settings.frequency).toBe('weekly');
    expect(settings.maxKeep).toBe(5);
  });

  test('backup:create – creates a manual backup file and lists it', () => {
    const createRes = call('backup:create');
    expect(createRes.success).toBe(true);
    expect(createRes.filename).toContain('manual_backup_');

    const listRes = call('backup:list');
    expect(listRes).toHaveLength(1);
    expect(listRes[0].filename).toBe(createRes.filename);
    expect(listRes[0].type).toBe('manual');
  });

  test('backup:delete – deletes an existing backup file', () => {
    const createRes = call('backup:create');
    expect(createRes.success).toBe(true);

    const deleteRes = call('backup:delete', createRes.filename);
    expect(deleteRes.success).toBe(true);

    const listRes = call('backup:list');
    expect(listRes).toHaveLength(0);
  });

  test('backup:restore – restores database and creates pre-restore backup', async () => {
    // 1. Create a backup of current state (Alice in students)
    const createRes = call('backup:create');
    expect(createRes.success).toBe(true);

    // 2. Change state (remove Alice, add Bob)
    seed('students', [{ id: 's2', name: 'Bob' }]);
    expect(read('students')[0].name).toBe('Bob');

    // 3. Restore from backup
    const restoreRes = await call('backup:restore', createRes.filename);
    expect(restoreRes.success).toBe(true);

    // 4. Verify Alice is back
    expect(read('students')[0].name).toBe('Alice');

    // 5. Verify a pre-restore backup was created
    const listRes = call('backup:list');
    const prerestoreBackup = listRes.find(b => b.type === 'prerestore');
    expect(prerestoreBackup).toBeDefined();
  });
});

// ── 13. DATA INTEGRITY & RECOVERY ──────────────────────────────
describe('DATA INTEGRITY & RECOVERY', () => {
  beforeEach(() => {
    resetStore();
  });

  test('system:get-corrupted-files – returns empty list when all files are valid', () => {
    seed('students', [{ id: 's1', name: 'Alice' }]);
    seed('users', [{ id: 'u1', username: 'admin' }]);
    const res = call('system:get-corrupted-files');
    expect(res).toEqual([]);
  });

  test('system:get-corrupted-files – detects empty json files as corrupted', () => {
    const p = dbPath('students');
    mockMemStore[p] = '   ';

    const res = call('system:get-corrupted-files');
    expect(res).toContain('students.json');
  });

  test('system:get-corrupted-files – detects invalid json files as corrupted', () => {
    const p = dbPath('students');
    mockMemStore[p] = '{ invalid json: [ }';

    const res = call('system:get-corrupted-files');
    expect(res).toContain('students.json');
  });

  test('system:reset-corrupted-files – deletes corrupted files and seeds defaults', () => {
    const p = dbPath('students');
    mockMemStore[p] = '{ invalid ';

    // First confirm it is corrupted
    let list = call('system:get-corrupted-files');
    expect(list).toContain('students.json');

    // Call reset
    const resetRes = call('system:reset-corrupted-files');
    expect(resetRes.success).toBe(true);

    // Verify file is recreated and is valid (seeded empty list)
    expect(mockMemStore[p]).toBe('[]');

    list = call('system:get-corrupted-files');
    expect(list).not.toContain('students.json');
  });
});

// ── 14. BACKUP REMINDERS ──────────────────────────────────────
describe('BACKUP REMINDERS', () => {
  beforeEach(() => {
    resetStore();
  });

  function seedBackupFile(filename, contentObj) {
    const backupsDir = path.join(__dirname, '..', 'data', 'edutrack_backups');
    const p = path.join(backupsDir, filename);
    mockMemStore[p] = JSON.stringify(contentObj);
  }

  test('backup:check-reminder – warns when no backup exists', () => {
    const res = call('backup:check-reminder');
    expect(res.showReminder).toBe(true);
    expect(res.daysSince).toBeNull();
  });

  test('backup:check-reminder – does not warn when backup is recent (e.g. 1 day old)', () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    seedBackupFile('manual_backup_recent.json', {
      timestamp: oneDayAgo.toISOString(),
      dbs: {}
    });

    const res = call('backup:check-reminder');
    expect(res.showReminder).toBe(false);
    expect(res.daysSince).toBe(1);
  });

  test('backup:check-reminder – warns when backup is old (e.g. 4 days old)', () => {
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    seedBackupFile('manual_backup_old.json', {
      timestamp: fourDaysAgo.toISOString(),
      dbs: {}
    });

    const res = call('backup:check-reminder');
    expect(res.showReminder).toBe(true);
    expect(res.daysSince).toBe(4);
  });
});

/*
// ── 15. PHASE 1 – Setup Wizard & Security ─────────────────────
describe('PHASE 1 – Setup Wizard & Security', () => {
... (tests commented out)
});
*/

// ── 15. PAYMENTS (Phase 2) ───────────────────────────────────
describe('PAYMENTS – create, list, by-student, balance, delete, financial summary', () => {
  beforeEach(() => {
    resetStore();
    seed('students', [
      { id: 's1', name: 'Alice', hasDiscount: false, discountPercent: 0 },
      { id: 's2', name: 'Bob', hasDiscount: true, discountPercent: 20 },
    ]);
    seed('sessions', [
      { id: 'ss1', title: 'Week 1', date: '2024-03-01', sessionFee: 200 },
      { id: 'ss2', title: 'Week 2', date: '2024-03-08', sessionFee: 200 },
    ]);
    seed('attendance', [
      { id: 'att1', sessionId: 'ss1', studentId: 's1' },
      { id: 'att2', sessionId: 'ss1', studentId: 's2' },
      { id: 'att3', sessionId: 'ss2', studentId: 's1' },
    ]);
    seed('payments', [
      { id: 'pay1', studentId: 's1', studentName: 'Alice', amount: 150, method: 'cash', note: 'Partial', date: '2024-03-05', createdAt: '2024-03-05T10:00:00Z' },
    ]);
    seed('system', { centerName: 'Bright Center', schemaVersion: 1 });
  });

  test('payments:list – returns all payments sorted by date', () => {
    const list = call('payments:list');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('pay1');
  });

  test('payments:create – creates a new payment record', () => {
    const res = call('payments:create', { studentId: 's1', amount: 200, method: 'transfer', note: 'March', date: '2024-03-10' });
    expect(res.success).toBe(true);
    expect(res.record.amount).toBe(200);
    expect(res.record.studentName).toBe('Alice');
    expect(res.record.method).toBe('transfer');
    expect(read('payments')).toHaveLength(2);
  });

  test('payments:create – rejects unknown student', () => {
    const res = call('payments:create', { studentId: 's999', amount: 100, method: 'cash' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });

  test('payments:create – rejects zero or negative amount', () => {
    const res = call('payments:create', { studentId: 's1', amount: 0, method: 'cash' });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/positive/i);
  });

  test('payments:by-student – returns only that student\'s payments', () => {
    const list = call('payments:by-student', 's1');
    expect(list).toHaveLength(1);
    expect(list[0].studentId).toBe('s1');
  });

  test('payments:by-student – returns empty for student with no payments', () => {
    const list = call('payments:by-student', 's2');
    expect(list).toHaveLength(0);
  });

  test('payments:receipt - returns printable receipt data with balance totals', () => {
    const res = call('payments:receipt', 'pay1');
    expect(res.success).toBe(true);
    expect(res.receipt).toMatchObject({
      id: 'pay1',
      receiptNo: 'PAY1',
      centerName: 'Bright Center',
      studentName: 'Alice',
      studentId: 's1',
      amount: 150,
      method: 'cash',
      date: '2024-03-05',
      note: 'Partial',
      totalDue: 400,
      totalPaid: 150,
      remaining: 250,
    });
    expect(res.receipt.generatedAt).toBeTruthy();
  });

  test('payments:receipt - rejects unknown payment', () => {
    const res = call('payments:receipt', 'pay999');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/payment not found/i);
  });

  test('payments:delete - removes the payment record', () => {
    const res = call('payments:delete', 'pay1');
    expect(res.success).toBe(true);
    expect(read('payments')).toHaveLength(0);
  });

  test('payments:student-balance – computes gross, due, paid, remaining correctly (no discount)', () => {
    // Alice attended ss1 (200 EGP) + ss2 (200 EGP) = 400 EGP gross/due; paid 150
    const bal = call('payments:student-balance', 's1');
    expect(bal.success).toBe(true);
    expect(bal.totalGross).toBe(400);
    expect(bal.totalDiscount).toBe(0);
    expect(bal.totalDue).toBe(400);
    expect(bal.totalPaid).toBe(150);
    expect(bal.remaining).toBe(250);
    expect(bal.sessionsAttended).toBe(2);
    expect(bal.sessionDetails).toHaveLength(2);
  });

  test('payments:student-balance – applies student discount correctly', () => {
    // Bob attended ss1 (200 EGP) with 20% discount → due 160 EGP; no payments
    const bal = call('payments:student-balance', 's2');
    expect(bal.success).toBe(true);
    expect(bal.totalGross).toBe(200);
    expect(bal.totalDiscount).toBe(40);
    expect(bal.totalDue).toBe(160);
    expect(bal.totalPaid).toBe(0);
    expect(bal.remaining).toBe(160);
  });

  test('payments:student-balance – returns failure for unknown student', () => {
    const bal = call('payments:student-balance', 's999');
    expect(bal.success).toBe(false);
    expect(bal.message).toMatch(/not found/i);
  });

  test('reports:financial-summary – returns correct totals', () => {
    // Alice: 400 gross, 0 discount → 400 due; Bob: 200 gross, 40 discount → 160 due
    // Total gross: 600, discount: 40, due: 560
    // Collected: 150 (Alice's payment), outstanding: 410
    const summary = call('reports:financial-summary');
    expect(summary.totalGross).toBe(600);
    expect(summary.totalDiscount).toBe(40);
    expect(summary.totalDue).toBe(560);
    expect(summary.totalCollected).toBe(150);
    expect(summary.totalOutstanding).toBe(410);
    expect(summary.paymentsCount).toBe(1);
    expect(Array.isArray(summary.studentBalances)).toBe(true);
    expect(summary.studentBalances.length).toBeGreaterThan(0);
  });

  test('reports:financial-summary – studentBalances has correct per-student data', () => {
    const summary = call('reports:financial-summary');
    const aliceBal = summary.studentBalances.find(b => b.studentId === 's1');
    expect(aliceBal).toBeDefined();
    expect(aliceBal.due).toBe(400);
    expect(aliceBal.paid).toBe(150);
    expect(aliceBal.remaining).toBe(250);

    const bobBal = summary.studentBalances.find(b => b.studentId === 's2');
    expect(bobBal).toBeDefined();
    expect(bobBal.due).toBe(160);
    expect(bobBal.paid).toBe(0);
    expect(bobBal.remaining).toBe(160);
  });
});
