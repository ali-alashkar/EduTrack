const { ipcMain } = require('electron');
const { readDB, writeDB, makeId } = require('../db');
const context = require('../context');
const { TEMPLATES } = require('../../whatsapp-templates');
const {
  saveWaLogRecord,
  readWhatsappTemplates
} = require('../helpers');

function getOrCreateSummaryQuizRecord(session, studentId, studentName) {
  if (!session?.hasQuiz) return null;

  const quizzes = readDB('quiz_scores');
  const existing = quizzes.find(q => q.sessionId === session.id && q.studentId === studentId);
  if (existing) return existing;

  const maxScore = Number(session.quizMaxScore ?? 10) || 10;
  const record = {
    id: makeId('qz'),
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

function registerWhatsAppHandlers() {
  ipcMain.handle('whatsapp:init', async () => {
    const waService = context.getWaService();
    if (!waService) return { success: false, error: 'Service not initialized' };
    return await waService.init();
  });

  ipcMain.handle('whatsapp:status', () => {
    const waService = context.getWaService();
    if (!waService) return { status: 'disconnected', queueLength: 0, isProcessing: false, settings: {} };
    return waService.getStatus();
  });

  ipcMain.handle('whatsapp:disconnect', async () => {
    const waService = context.getWaService();
    if (!waService) return { success: true };
    return await waService.disconnect();
  });

  ipcMain.handle('whatsapp:clear-auth', () => {
    const waService = context.getWaService();
    if (!waService) return { success: false, error: 'Service not initialized' };
    waService.clearAuth();
    return { success: true };
  });

  ipcMain.handle('whatsapp:update-settings', (_, newSettings) => {
    const saved = readDB('whatsapp_settings') || {};
    const merged = { ...saved, ...newSettings };
    writeDB('whatsapp_settings', merged);
    const waService = context.getWaService();
    if (waService) waService.updateSettings(merged);
    return { success: true, settings: merged };
  });

  ipcMain.handle('whatsapp:get-settings', () => {
    return readDB('whatsapp_settings') || {};
  });

  ipcMain.handle('whatsapp:send-attendance', (_, { studentId, sessionId }) => {
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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

  ipcMain.handle('whatsapp:send-session-summary', (_, { studentId, sessionId }) => {
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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
    const waService = context.getWaService();
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

  // ── Send Barcode via WhatsApp ──
  ipcMain.handle('whatsapp:send-barcode', async (_, { studentId }) => {
    const waService = context.getWaService();
    if (!waService) return { success: false, error: 'WhatsApp service not initialized' };
    if (waService.status !== 'connected') return { success: false, error: 'WhatsApp is not connected' };

    const student = readDB('students').find(s => s.id === studentId);
    if (!student) return { success: false, error: 'Student not found' };
    if (!student.barcode) return { success: false, error: 'Student has no barcode' };

    // Pick the best phone: student phone first, then parent phone
    const phone = student.phone || student.parentPhone;
    if (!phone) return { success: false, error: 'No phone number available for this student' };

    const message =
      `📋 بيانات الطالب\n` +
      `الاسم: ${student.name}\n` +
      `رقم الكود: ${student.barcode}\n\n` +
      `──────────────────\n` +
      `📋 Student ID Card\n` +
      `Name: ${student.name}\n` +
      `Barcode: ${student.barcode}`;

    const result = await waService.sendMessage(phone, message);
    if (result.success) {
      // Log it so it appears in the WA log tab
      const logRecord = {
        id: makeId('wm'),
        studentId: student.id,
        studentName: student.name,
        parentPhone: phone,
        sessionId: '',
        sessionTitle: '— Barcode Card —',
        type: 'barcode',
        messageText: message,
        templateId: 'barcode',
        templateIndex: 0,
        status: 'sent',
        error: '',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const { saveWaLogRecord } = require('../helpers');
      saveWaLogRecord(logRecord);
      return { success: true };
    }
    return { success: false, error: result.error };
  });

  // ── Send Student History Report via WhatsApp ──
  ipcMain.handle('whatsapp:send-report', async (_, { studentId }) => {
    const waService = context.getWaService();
    if (!waService) return { success: false, error: 'WhatsApp service not initialized' };
    if (waService.status !== 'connected') return { success: false, error: 'WhatsApp is not connected' };

    const student = readDB('students').find(s => s.id === studentId);
    if (!student) return { success: false, error: 'Student not found' };

    const phone = student.parentPhone || student.phone;
    if (!phone) return { success: false, error: 'No phone number available for this student' };

    // ── Gather all data ──
    const sessions   = readDB('sessions');
    const attendance = readDB('attendance').filter(a => a.studentId === studentId);
    const quizzes    = readDB('quiz_scores').filter(q => q.studentId === studentId);

    // Attendance stats
    const totalSessions = attendance.length;

    // Homework stats
    const hwRecords  = attendance.filter(a => a.homeworkStatus && a.homeworkStatus !== 'pending');
    const hwDone     = hwRecords.filter(a => a.homeworkStatus === 'done').length;
    const hwDoneRate = hwRecords.length > 0
      ? `${Math.round((hwDone / hwRecords.length) * 100)}%`
      : 'N/A';

    // Quiz stats
    let avgQuizScore   = 'N/A';
    let avgQuizPercent = 'N/A';
    if (quizzes.length > 0) {
      const totalPct = quizzes.reduce((sum, q) => {
        const max = Number(q.maxScore) || 1;
        return sum + (Number(q.score) / max) * 100;
      }, 0);
      const avgPct = Math.round(totalPct / quizzes.length);
      // Weighted average score representation
      const lastMaxScore = Number(quizzes[quizzes.length - 1]?.maxScore) || 10;
      const avgRaw = ((avgPct / 100) * lastMaxScore).toFixed(1);
      avgQuizScore   = `${avgRaw}/${lastMaxScore}`;
      avgQuizPercent = `${avgPct}`;
    }

    // Attendance rate vs. sessions in their group(s)
    const groups = readDB('groups');
    const studentGroups = groups.filter(g => (g.studentIds || []).includes(studentId));
    const groupSessionIds = new Set();
    for (const g of studentGroups) {
      sessions.filter(s => s.groupId === g.id).forEach(s => groupSessionIds.add(s.id));
    }
    const possibleSessions = groupSessionIds.size || totalSessions;
    const attendanceRate = possibleSessions > 0
      ? `${Math.round((totalSessions / possibleSessions) * 100)}%`
      : totalSessions > 0 ? '100%' : '0%';

    // Performance summary
    let performancePct = 0;
    let factors = 0;
    if (possibleSessions > 0) { performancePct += (totalSessions / possibleSessions) * 100; factors++; }
    if (hwRecords.length > 0) { performancePct += (hwDone / hwRecords.length) * 100; factors++; }
    if (quizzes.length > 0) {
      const totalPct = quizzes.reduce((sum, q) => sum + (Number(q.score) / (Number(q.maxScore) || 1)) * 100, 0);
      performancePct += totalPct / quizzes.length;
      factors++;
    }
    const overallPct = factors > 0 ? performancePct / factors : 0;
    const performanceSummary =
      overallPct >= 90 ? '🌟 ممتاز / Excellent' :
      overallPct >= 75 ? '✅ جيد جداً / Very Good' :
      overallPct >= 60 ? '📈 جيد / Good' :
      overallPct >= 40 ? '⚠️ مقبول / Acceptable' :
                         '❗ يحتاج متابعة / Needs Attention';

    const reportPeriod = 'منذ التسجيل / All Time';

    // Pick template
    const { getRandomTemplate } = require('../../whatsapp-templates');
    const customTemplates = readDB('whatsapp_templates') || null;
    let messageText;
    try {
      const { text } = getRandomTemplate('student_report', {
        studentName:        student.name,
        level:              student.level || '—',
        reportPeriod,
        totalSessions:      String(totalSessions),
        attendanceRate,
        hwDoneRate,
        avgQuizScore,
        avgQuizPercent,
        performanceSummary,
      }, customTemplates);
      messageText = text;
    } catch (e) {
      return { success: false, error: 'Could not generate report template' };
    }

    const result = await waService.sendMessage(phone, messageText);
    if (result.success) {
      const { saveWaLogRecord } = require('../helpers');
      saveWaLogRecord({
        id: makeId('wm'),
        studentId:     student.id,
        studentName:   student.name,
        parentPhone:   phone,
        sessionId:     '',
        sessionTitle:  '— Student Report —',
        type:          'student_report',
        messageText,
        templateId:    'student_report',
        templateIndex: 0,
        status:        'sent',
        error:         '',
        sentAt:        new Date().toISOString(),
        createdAt:     new Date().toISOString(),
      });
      return {
        success: true,
        stats: { totalSessions, attendanceRate, hwDoneRate, avgQuizScore, avgQuizPercent, performanceSummary },
      };
    }
    return { success: false, error: result.error };
  });

  // ── Queue Student History Report via WhatsApp (for bulk actions) ──
  ipcMain.handle('whatsapp:queue-report', async (_, { studentId }) => {
    const waService = context.getWaService();
    if (!waService) return { success: false, error: 'WhatsApp service not initialized' };

    const student = readDB('students').find(s => s.id === studentId);
    if (!student) return { success: false, error: 'Student not found' };

    const phone = student.parentPhone || student.phone;
    if (!phone) return { success: false, error: 'No phone number available for this student' };

    // ── Gather all data ──
    const sessions   = readDB('sessions');
    const attendance = readDB('attendance').filter(a => a.studentId === studentId);
    const quizzes    = readDB('quiz_scores').filter(q => q.studentId === studentId);

    // Attendance stats
    const totalSessions = attendance.length;

    // Homework stats
    const hwRecords  = attendance.filter(a => a.homeworkStatus && a.homeworkStatus !== 'pending');
    const hwDone     = hwRecords.filter(a => a.homeworkStatus === 'done').length;
    const hwDoneRate = hwRecords.length > 0
      ? `${Math.round((hwDone / hwRecords.length) * 100)}%`
      : 'N/A';

    // Quiz stats
    let avgQuizScore   = 'N/A';
    let avgQuizPercent = 'N/A';
    if (quizzes.length > 0) {
      const totalPct = quizzes.reduce((sum, q) => {
        const max = Number(q.maxScore) || 1;
        return sum + (Number(q.score) / max) * 100;
      }, 0);
      const avgPct = Math.round(totalPct / quizzes.length);
      const lastMaxScore = Number(quizzes[quizzes.length - 1]?.maxScore) || 10;
      const avgRaw = ((avgPct / 100) * lastMaxScore).toFixed(1);
      avgQuizScore   = `${avgRaw}/${lastMaxScore}`;
      avgQuizPercent = `${avgPct}`;
    }

    // Attendance rate vs. sessions in their group(s)
    const groups = readDB('groups');
    const studentGroups = groups.filter(g => (g.studentIds || []).includes(studentId));
    const groupSessionIds = new Set();
    for (const g of studentGroups) {
      sessions.filter(s => s.groupId === g.id).forEach(s => groupSessionIds.add(s.id));
    }
    const possibleSessions = groupSessionIds.size || totalSessions;
    const attendanceRate = possibleSessions > 0
      ? `${Math.round((totalSessions / possibleSessions) * 100)}%`
      : totalSessions > 0 ? '100%' : '0%';

    // Performance summary
    let performancePct = 0;
    let factors = 0;
    if (possibleSessions > 0) { performancePct += (totalSessions / possibleSessions) * 100; factors++; }
    if (hwRecords.length > 0) { performancePct += (hwDone / hwRecords.length) * 100; factors++; }
    if (quizzes.length > 0) {
      const totalPct = quizzes.reduce((sum, q) => sum + (Number(q.score) / (Number(q.maxScore) || 1)) * 100, 0);
      performancePct += totalPct / quizzes.length;
      factors++;
    }
    const overallPct = factors > 0 ? performancePct / factors : 0;
    const performanceSummary =
      overallPct >= 90 ? '🌟 ممتاز / Excellent' :
      overallPct >= 75 ? '✅ جيد جداً / Very Good' :
      overallPct >= 60 ? '📈 جيد / Good' :
      overallPct >= 40 ? '⚠️ مقبول / Acceptable' :
                         '❗ يحتاج متابعة / Needs Attention';

    const reportPeriod = 'منذ التسجيل / All Time';

    // Pick template
    const { getRandomTemplate } = require('../../whatsapp-templates');
    const customTemplates = readDB('whatsapp_templates') || null;
    let messageText;
    try {
      const { text } = getRandomTemplate('student_report', {
        studentName:        student.name,
        level:              student.level || '—',
        reportPeriod,
        totalSessions:      String(totalSessions),
        attendanceRate,
        hwDoneRate,
        avgQuizScore,
        avgQuizPercent,
        performanceSummary,
      }, customTemplates);
      messageText = text;
    } catch (e) {
      return { success: false, error: 'Could not generate report template' };
    }

    const record = {
      id: makeId('wm'),
      studentId:     student.id,
      studentName:   student.name,
      parentPhone:   phone,
      sessionId:     '',
      sessionTitle:  '— Student Report —',
      type:          'student_report',
      messageText,
      templateId:    'student_report',
      templateIndex: 0,
      status:        'queued',
      error:         '',
      sentAt:        '',
      createdAt:     new Date().toISOString(),
    };

    const { saveWaLogRecord } = require('../helpers');
    saveWaLogRecord(record);
    waService.queueMessage(record);
    return { success: true };
  });
}

module.exports = registerWhatsAppHandlers;
