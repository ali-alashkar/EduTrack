const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const {
  normalizeSessionFee,
  studentBlockWarning
} = require('../helpers');

function registerSessionHandlers() {
  // ── Sessions ──
  ipcMain.handle('sessions:list', () => readDB('sessions'));

  ipcMain.handle('sessions:create', (_, data) => {
    const sessions = readDB('sessions');
    const fee = normalizeSessionFee(data);
    const session = { id: makeId('ss'), ...data, ...fee, status: 'scheduled', createdAt: new Date().toISOString() };
    writeDB('sessions', [...sessions, session]);
    return { success: true, session };
  });

  ipcMain.handle('sessions:update', (_, { id, ...data }) => {
    const fee = normalizeSessionFee({ ...readDB('sessions').find(s => s.id === id), ...data });
    const updatedAt = new Date().toISOString();
    const sessions = readDB('sessions').map(s => s.id === id ? { ...s, ...data, ...fee, updatedAt } : s);
    writeDB('sessions', sessions);
    return { success: true };
  });

  ipcMain.handle('sessions:delete', (_, id) => {
    if (id) {
      recordTombstones('sessions', id);
      const attIds = readDB('attendance').filter(a => a.sessionId === id).map(a => a.id);
      const qzIds = readDB('quiz_scores').filter(q => q.sessionId === id).map(q => q.id);
      if (attIds.length) recordTombstones('attendance', attIds);
      if (qzIds.length) recordTombstones('quiz_scores', qzIds);
    }
    writeDB('sessions', readDB('sessions').filter(s => s.id !== id));
    writeDB('attendance', readDB('attendance').filter(a => a.sessionId !== id));
    writeDB('quiz_scores', readDB('quiz_scores').filter(q => q.sessionId !== id));
    writeDB('whatsapp_log', readDB('whatsapp_log').filter(m => m.sessionId !== id));
    return { success: true };
  });

  // ── Attendance ──
  ipcMain.handle('attendance:list', () => readDB('attendance'));

  ipcMain.handle('attendance:by-session', (_, sessionId) =>
    readDB('attendance').filter(a => a.sessionId === sessionId)
  );

  ipcMain.handle('attendance:scan', (_, { sessionId, barcode }) => {
    const student = readDB('students').find(s => s.barcode === barcode);
    if (!student) return { success: false, message: 'Student not found for this barcode' };

    const attendance = readDB('attendance');
    const existing = attendance.find(a => a.sessionId === sessionId && a.studentId === student.id);
    if (existing) return { success: false, message: 'Student already checked in', student };

    const record = {
      id: makeId('att'),
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
    const updatedAt = new Date().toISOString();
    const attendance = readDB('attendance').map(a => a.id === id ? { ...a, ...data, updatedAt } : a);
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
      id: makeId('att'),
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
    if (id) recordTombstones('attendance', id);
    writeDB('attendance', readDB('attendance').filter(a => a.id !== id));
    return { success: true };
  });

  // ── Quiz Scores ──
  ipcMain.handle('quizzes:list', () => readDB('quiz_scores'));

  ipcMain.handle('quizzes:by-session', (_, sessionId) =>
    readDB('quiz_scores').filter(q => q.sessionId === sessionId)
  );

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
      id: makeId('qz'),
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
    if (id) recordTombstones('quiz_scores', id);
    writeDB('quiz_scores', readDB('quiz_scores').filter(q => q.id !== id));
    return { success: true };
  });

  // ── Session Duplication ──
  ipcMain.handle('sessions:duplicate', (_, { sessionId, newDate }) => {
    const sessions = readDB('sessions');
    const source = sessions.find(s => s.id === sessionId);
    if (!source) return { success: false, message: 'Session not found' };
    if (!newDate) return { success: false, message: 'New date is required' };
    const { id: _id, createdAt: _c, ...rest } = source;
    const newSession = { ...rest, id: makeId('ss'), date: newDate, status: 'scheduled', createdAt: new Date().toISOString(), duplicatedFrom: sessionId };
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
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
        created.push({ id: makeId('ss'), title, groupId, date: dateStr, time: time || '', duration: duration || '', sessionFee: Number(sessionFee) || 0, topic: topic || '', homework: homework || '', hasQuiz: hasQuiz || false, quizMaxScore: hasQuiz ? (Number(quizMaxScore) || 10) : null, status: 'scheduled', createdAt, isRecurring: true });
        sessionNum++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (!created.length) return { success: false, message: 'No sessions generated — check date range and days' };
    writeDB('sessions', [...sessions, ...created]);
    return { success: true, count: created.length, sessions: created };
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
      writeDB('audit_log', [...audit, { id: makeId('al'), action: 'attendance_transfer', studentId: rec.studentId, studentName: rec.studentName, attendanceId, fromSessionId: oldSessionId, toSessionId: newSessionId, actorId: actorId || '', actorName: actorName || '', timestamp: new Date().toISOString() }]);
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
      writeDB('audit_log', [...audit, { id: makeId('al'), action: 'attendance_reassign', fromStudentId: oldStudentId, toStudentId: newStudentId, studentName: newStudent.name, attendanceId, sessionId: rec.sessionId, actorId: actorId || '', actorName: actorName || '', timestamp: new Date().toISOString() }]);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = registerSessionHandlers;
