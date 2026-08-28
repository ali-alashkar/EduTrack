const { readDB, writeDB } = require('./db');
const context = require('./context');
const { TEMPLATES } = require('../whatsapp-templates');

const IS_TRIAL = false;
const TRIAL_STUDENT_LIMIT = 15;

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

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function calcSessionRevenue(session, attendance, studentMap) {
  const sessionAtt = attendance.filter(a => a.sessionId === session.id && a.status !== 'absent');
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
  const waService = context.getWaService();
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

module.exports = {
  IS_TRIAL,
  TRIAL_STUDENT_LIMIT,
  syncLevelNameReferences,
  syncCenterNameReferences,
  normalizeStudentDiscount,
  normalizePhoneForMatch,
  findDuplicateStudentPhone,
  studentBlockWarning,
  normalizeSessionFee,
  getAttendanceFee,
  roundMoney,
  calcSessionRevenue,
  saveWaLogRecord,
  queueStudentBlockNotification,
  readWhatsappTemplates
};
