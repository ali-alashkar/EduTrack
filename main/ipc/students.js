const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const zlib = require('zlib');
const context = require('../context');

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf) {
  if (typeof zlib.crc32 === 'function') {
    return zlib.crc32(buf);
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function buildZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const uncompressedData = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
    const crc = computeCrc32(uncompressedData);
    const compressedData = zlib.deflateRawSync(uncompressedData, { level: 9 });
    const useCompressed = compressedData.length < uncompressedData.length;
    const dataToWrite = useCompressed ? compressedData : uncompressedData;
    const method = useCompressed ? 8 : 0;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataToWrite.length, 18);
    localHeader.writeUInt32LE(uncompressedData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, dataToWrite);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataToWrite.length, 20);
    centralHeader.writeUInt32LE(uncompressedData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + dataToWrite.length;
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const {
  findDuplicateStudentPhone,
  normalizeStudentDiscount,
  queueStudentBlockNotification,
  IS_TRIAL,
  TRIAL_STUDENT_LIMIT
} = require('../helpers');

function normalizeStudentIds(studentIds) {
  return new Set((Array.isArray(studentIds) ? studentIds : []).filter(Boolean));
}

function deleteStudentsByIds(studentIds) {
  const selectedIds = normalizeStudentIds(studentIds);
  if (!selectedIds.size) return { success: true, count: 0 };

  const students = readDB('students');
  const existingIds = new Set(students.filter(s => selectedIds.has(s.id)).map(s => s.id));
  if (!existingIds.size) return { success: true, count: 0 };

  const deletedList = Array.from(existingIds);
  recordTombstones('students', deletedList);

  writeDB('students', students.filter(s => !existingIds.has(s.id)));
  writeDB('groups', readDB('groups').map(g => ({
    ...g,
    studentIds: (g.studentIds || []).filter(id => !existingIds.has(id)),
  })));

  for (const dbName of ['attendance', 'quiz_scores', 'payments', 'block_history', 'whatsapp_log']) {
    writeDB(dbName, readDB(dbName).filter(row => !existingIds.has(row.studentId)));
  }

  return { success: true, count: existingIds.size };
}

function getSanitizedStudents() {
  const students = readDB('students');
  const seenIds = new Set();
  let hasDuplicates = false;

  const sanitized = (students || []).map(s => {
    if (!s || typeof s !== 'object') return s;
    if (!s.id || seenIds.has(s.id)) {
      hasDuplicates = true;
      return { ...s, id: makeId('s') };
    }
    seenIds.add(s.id);
    return s;
  });

  if (hasDuplicates) {
    writeDB('students', sanitized);
  }
  return sanitized;
}

function registerStudentHandlers() {
  ipcMain.handle('students:list', () => getSanitizedStudents());

  ipcMain.handle('students:create', (_, data) => {
    const students = readDB('students');
    if (IS_TRIAL && students.length >= TRIAL_STUDENT_LIMIT) {
      return { success: false, message: `عذراً، هذه نسخة تجريبية وتدعم تسجيل ${TRIAL_STUDENT_LIMIT} طالب فقط. يرجى تفعيل النسخة الكاملة.` };
    }
    if (data.barcode && students.find(s => s.barcode === data.barcode)) {
      return { success: false, message: 'Barcode already used' };
    }
    const duplicatePhone = findDuplicateStudentPhone(students, data);
    if (duplicatePhone && !data.allowDuplicatePhone) {
      return { success: false, duplicatePhone: true, message: duplicatePhone.message, field: duplicatePhone.field };
    }
    const discount = normalizeStudentDiscount(data);
    const { allowDuplicatePhone: _allowDuplicatePhone, ...studentData } = data;
    const student = { id: makeId('s'), ...studentData, ...discount, createdAt: new Date().toISOString() };
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
    const updatedAt = new Date().toISOString();
    const students = existingStudents.map(s => s.id === id ? { ...s, ...studentData, ...discount, updatedAt } : s);
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
      blockedStudent = { ...s, isBlocked: true, blockReason: note, blockedAt, updatedAt: blockedAt };
      return blockedStudent;
    });
    if (!blockedStudent) return { success: false, message: 'Student not found' };
    writeDB('students', students);

    // Log block history
    const history = readDB('block_history');
    writeDB('block_history', [...history, {
      id: makeId('bh'),
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
    const updatedAt = new Date().toISOString();
    const students = readDB('students').map(s => s.id === studentId ? {
      ...s, isBlocked: false, blockReason: '', blockedAt: '', updatedAt,
    } : s);
    const student = readDB('students').find(s => s.id === studentId);
    writeDB('students', students);

    const history = readDB('block_history');
    writeDB('block_history', [...history, {
      id: makeId('bh'),
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

  ipcMain.handle('students:delete', (_, id) => deleteStudentsByIds([id]));

  ipcMain.handle('students:by-barcode', (_, barcode) => {
    const student = readDB('students').find(s => s.barcode === barcode);
    return student || null;
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

  ipcMain.handle('students:bulk-block', (_, { studentIds, reason, actorId, actorName }) => {
    try {
      const note = String(reason || '').trim();
      if (!note) return { success: false, message: 'Block reason is required' };
      const selectedIds = normalizeStudentIds(studentIds);
      const blockedAt = new Date().toISOString();
      let count = 0;
      let queued = 0;
      const historyEntries = [];

      const students = readDB('students').map(s => {
        if (!selectedIds.has(s.id)) return s;
        count++;
        const blockedStudent = { ...s, isBlocked: true, blockReason: note, blockedAt, updatedAt: blockedAt };
        historyEntries.push({
          id: makeId('bh'),
          studentId: s.id,
          studentName: s.name,
          action: 'block',
          reason: note,
          actorId: actorId || '',
          actorName: actorName || '',
          timestamp: blockedAt,
        });
        const blockNotification = queueStudentBlockNotification(blockedStudent, note);
        if (blockNotification?.status === 'queued') queued++;
        return blockedStudent;
      });

      writeDB('students', students);
      if (historyEntries.length) writeDB('block_history', [...readDB('block_history'), ...historyEntries]);
      return { success: true, count, queued };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('students:bulk-unblock', (_, { studentIds, actorId, actorName }) => {
    try {
      const selectedIds = normalizeStudentIds(studentIds);
      const timestamp = new Date().toISOString();
      let count = 0;
      const historyEntries = [];

      const students = readDB('students').map(s => {
        if (!selectedIds.has(s.id)) return s;
        count++;
        historyEntries.push({
          id: makeId('bh'),
          studentId: s.id,
          studentName: s.name,
          action: 'unblock',
          reason: '',
          actorId: actorId || '',
          actorName: actorName || '',
          timestamp,
        });
        return { ...s, isBlocked: false, blockReason: '', blockedAt: '', updatedAt: timestamp };
      });

      writeDB('students', students);
      if (historyEntries.length) writeDB('block_history', [...readDB('block_history'), ...historyEntries]);
      return { success: true, count };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('students:bulk-delete', (_, { studentIds }) => {
    try {
      return deleteStudentsByIds(studentIds);
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ── Bulk Note ──
  ipcMain.handle('students:bulk-note', (_, { studentIds, note }) => {
    try {
      const text = String(note || '').trim();
      if (!text) return { success: false, message: 'Note text is required' };
      const selectedIds = normalizeStudentIds(studentIds);
      if (!selectedIds.size) return { success: false, message: 'No students selected' };
      const now = new Date().toISOString();
      let count = 0;
      writeDB('students', readDB('students').map(s => {
        if (!selectedIds.has(s.id)) return s;
        count++;
        const existing = String(s.notes || '').trim();
        const separator = existing ? '\n---\n' : '';
        return { ...s, notes: `${existing}${separator}[${now.slice(0, 10)}] ${text}` };
      }));
      return { success: true, count };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ── Bulk Move Group ──
  ipcMain.handle('students:bulk-move-group', (_, { studentIds, fromGroupId, toGroupId }) => {
    try {
      const selectedIds = normalizeStudentIds(studentIds);
      if (!selectedIds.size) return { success: false, message: 'No students selected' };
      const groups = readDB('groups');
      if (toGroupId && !groups.find(g => g.id === toGroupId)) return { success: false, message: 'Target group not found' };

      writeDB('groups', groups.map(g => {
        let ids = [...(g.studentIds || [])];
        if (fromGroupId && g.id === fromGroupId) {
          ids = ids.filter(id => !selectedIds.has(id));
        }
        if (g.id === toGroupId) {
          const existing = new Set(ids);
          selectedIds.forEach(id => existing.add(id));
          ids = [...existing];
        }
        return { ...g, studentIds: ids };
      }));
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

  ipcMain.handle('barcodes:export-zip', async (_, { images, defaultFilename }) => {
    try {
      if (!Array.isArray(images) || !images.length) {
        return { success: false, error: 'No barcode images provided' };
      }

      const mainWindow = context.getMainWindow();
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Barcodes ZIP',
        defaultPath: defaultFilename || 'barcodes.zip',
        filters: [{ name: 'ZIP Archive (*.zip)', extensions: ['zip'] }],
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      const files = [];
      for (const img of images) {
        if (img && img.dataUrl && img.filename) {
          const base64Data = img.dataUrl.replace(/^data:image\/png;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          files.push({ name: img.filename, buffer });
        }
      }

      const zipBuffer = buildZipArchive(files);
      await fs.promises.writeFile(filePath, zipBuffer);

      return { success: true, filePath, count: files.length };
    } catch (e) {
      console.error('Error exporting barcodes zip:', e);
      return { success: false, error: e.message };
    }
  });
}

module.exports = registerStudentHandlers;
