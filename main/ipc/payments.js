const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const { getSystemSettings } = require('../integrity');
const {
  roundMoney,
  getAttendanceFee,
  saveWaLogRecord,
} = require('../helpers');
const context = require('../context');

function buildStudentBalance(studentId) {
  const student = readDB('students').find(s => s.id === studentId);
  if (!student) return { success: false, message: 'Student not found' };

  const attendance = readDB('attendance').filter(a => a.studentId === studentId && a.status !== 'absent');
  const sessions = readDB('sessions');
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));
  const groups = readDB('groups');
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

  let totalGross = 0;
  let totalDiscount = 0;
  let totalTeacherDue = 0;
  const sessionDetails = [];

  for (const att of attendance) {
    const session = sessionMap[att.sessionId];
    if (!session) continue;
    const fee = Number(session.sessionFee) || 0;
    const net = getAttendanceFee(fee, student);
    const group = groupMap[session.groupId];

    let centerFee = 0;
    if (group?.centerFeePerStudent !== undefined && group?.centerFeePerStudent !== null && group?.centerFeePerStudent !== '') {
      centerFee = Number(group.centerFeePerStudent) || 0;
    } else if (group?.centerCommissionPercent) {
      centerFee = net * (Number(group.centerCommissionPercent) / 100);
    }
    const teacherCut = roundMoney(Math.max(0, net - centerFee));

    totalGross += fee;
    totalDiscount += (fee - net);
    totalTeacherDue += teacherCut;
    sessionDetails.push({
      sessionId: session.id,
      sessionTitle: session.title,
      sessionDate: session.date,
      fee,
      netFee: roundMoney(net),
      discount: roundMoney(fee - net),
      centerFee: roundMoney(centerFee),
      teacherCut,
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
    totalTeacherDue: roundMoney(totalTeacherDue),
    sessionsAttended: attendance.length,
    sessionDetails: sessionDetails.sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || '')),
    payments,
  };
}

function registerPaymentHandlers() {
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
      id: makeId('pay'),
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
    if (id) recordTombstones('payments', id);
    writeDB('payments', readDB('payments').filter(p => p.id !== id));
    return { success: true };
  });

  ipcMain.handle('payments:student-balance', (_, studentId) => {
    return buildStudentBalance(studentId);
  });

  ipcMain.handle('payments:receipt', (_, paymentId) => {
    const payment = readDB('payments').find(p => p.id === paymentId);
    if (!payment) return { success: false, message: 'Payment not found' };

    const balance = buildStudentBalance(payment.studentId);
    if (!balance.success) return balance;

    const system = getSystemSettings();
    const receipt = {
      id: payment.id,
      receiptNo: String(payment.id).toUpperCase(),
      centerName: system.centerName || 'EduTrack',
      studentName: payment.studentName || balance.student.name,
      studentId: payment.studentId,
      amount: roundMoney(Number(payment.amount) || 0),
      method: payment.method || 'cash',
      date: payment.date || (payment.createdAt || '').slice(0, 10),
      note: payment.note || '',
      totalDue: balance.totalDue,
      totalPaid: balance.totalPaid,
      remaining: balance.remaining,
      generatedAt: new Date().toISOString(),
    };

    return { success: true, receipt };
  });

  ipcMain.handle('reports:financial-summary', () => {
    const students = readDB('students');
    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const sessions = readDB('sessions');
    const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));
    const groups = readDB('groups');
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));
    const attendance = readDB('attendance');
    const payments = readDB('payments');

    let totalGross = 0;
    let totalDiscount = 0;
    let totalTeacherDue = 0;
    const attendanceTotalsByStudent = new Map();
    const paymentsByStudent = new Map();

    for (const att of attendance) {
      if (att.status === 'absent') continue;
      const student = studentMap[att.studentId];
      const session = sessionMap[att.sessionId];
      if (!student || !session) continue;
      const fee = Number(session.sessionFee) || 0;
      const studentNet = getAttendanceFee(fee, student);
      const discount = fee - studentNet;
      const group = groupMap[session.groupId];

      let centerFee = 0;
      if (group?.centerFeePerStudent !== undefined && group?.centerFeePerStudent !== null && group?.centerFeePerStudent !== '') {
        centerFee = Number(group.centerFeePerStudent) || 0;
      } else if (group?.centerCommissionPercent) {
        centerFee = studentNet * (Number(group.centerCommissionPercent) / 100);
      }
      const teacherCut = roundMoney(Math.max(0, studentNet - centerFee));

      totalGross += fee;
      totalDiscount += discount;
      totalTeacherDue += teacherCut;

      const current = attendanceTotalsByStudent.get(student.id) || { gross: 0, discount: 0, count: 0, teacherDue: 0 };
      current.gross += fee;
      current.discount += discount;
      current.teacherDue += teacherCut;
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
    totalTeacherDue = roundMoney(totalTeacherDue);

    const studentBalances = students.map(student => {
      const totals = attendanceTotalsByStudent.get(student.id) || { gross: 0, discount: 0, count: 0, teacherDue: 0 };
      const gross = totals.gross;
      const discount = totals.discount;
      const due = roundMoney(gross - discount);
      const paid = roundMoney(paymentsByStudent.get(student.id) || 0);
      const remaining = roundMoney(due - paid);
      return { studentId: student.id, studentName: student.name, sessionsAttended: totals.count, due, paid, remaining, teacherDue: roundMoney(totals.teacherDue) };
    }).filter(b => b.due > 0 || b.paid > 0);

    return {
      totalGross: roundMoney(totalGross),
      totalDiscount: roundMoney(totalDiscount),
      totalDue,
      totalCollected,
      totalOutstanding,
      totalTeacherDue,
      studentBalances,
      paymentsCount: payments.length,
    };
  });

  // ── Session Payment Status ─────────────────────────────────────────────────
  // Status values: 'unpaid' | 'paid' | 'partial' | 'waived'
  ipcMain.handle('payments:set-session-status', (_, { studentId, sessionId, status }) => {
    if (!studentId || !sessionId) return { success: false, message: 'studentId and sessionId are required' };
    const valid = ['unpaid', 'paid', 'partial', 'waived'];
    if (!valid.includes(status)) return { success: false, message: 'Invalid status value' };
    const db = readDB('session_payment_status') || {};
    const key = `${studentId}__${sessionId}`;
    db[key] = { studentId, sessionId, status, updatedAt: new Date().toISOString() };
    writeDB('session_payment_status', db);
    return { success: true };
  });

  ipcMain.handle('payments:get-session-statuses', (_, studentId) => {
    const db = readDB('session_payment_status') || {};
    const result = {};
    for (const [key, val] of Object.entries(db)) {
      if (val.studentId === studentId) {
        result[val.sessionId] = val.status;
      }
    }
    return result;
  });

  // ── Payment Reminder via WhatsApp ──────────────────────────────────────────
  ipcMain.handle('payments:queue-reminder', (_, { studentId, customMessage }) => {
    const student = readDB('students').find(s => s.id === studentId);
    if (!student) return { success: false, message: 'Student not found' };
    if (!student.parentPhone) return { success: false, message: 'No parent phone for this student' };

    const balance = buildStudentBalance(studentId);
    if (!balance.success) return balance;
    if (balance.remaining <= 0) return { success: false, message: 'Student has no outstanding balance' };

    const system = getSystemSettings();
    const centerName = system.centerName || 'EduTrack';
    const messageText = customMessage ||
      `Hello, this is a reminder from ${centerName}.\n` +
      `Student: ${student.name}\n` +
      `Outstanding balance: ${balance.remaining.toLocaleString()} EGP\n` +
      `Total due: ${balance.totalDue.toLocaleString()} EGP\n` +
      `Total paid: ${balance.totalPaid.toLocaleString()} EGP\n\n` +
      `Please contact us to settle the balance. Thank you!`;

    const waService = context.getWaService();
    if (!waService) return { success: false, message: 'WhatsApp service is not available' };

    const record = {
      id: makeId('wa_rem'),
      type: 'payment_reminder',
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone,
      sessionId: '',
      sessionTitle: '',
      messageText,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    saveWaLogRecord(record);
    waService.queueMessage(record);
    return { success: true, record };
  });
}

module.exports = registerPaymentHandlers;
