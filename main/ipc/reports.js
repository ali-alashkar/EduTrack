const { ipcMain, dialog } = require('electron');
const { readDB, writeDB, makeId } = require('../db');
const context = require('../context');
const {
  getAttendanceFee,
  calcSessionRevenue,
  roundMoney,
  IS_TRIAL,
  TRIAL_STUDENT_LIMIT
} = require('../helpers');

let XLSX;
try { XLSX = require('xlsx'); } catch (_) { XLSX = null; }

function registerReportHandlers() {
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
      ? Math.round(quizScores.reduce((sum, q) => {
          const max = Number(q.maxScore) || 10;
          return sum + ((Number(q.score) || 0) / max) * 100;
        }, 0) / quizScored)
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

  // ── Excel Export ──
  ipcMain.handle('export:excel', async (_, { sheetName, columns, rows, filename }) => {
    if (IS_TRIAL) {
      return { success: false, error: 'عذراً، ميزة تصدير البيانات إلى إكسل غير متوفرة في النسخة التجريبية.' };
    }
    try {
      if (!XLSX) return { success: false, error: 'xlsx not available — run: npm install xlsx' };
      const defaultName = filename || `${sheetName || 'export'}_${new Date().toISOString().slice(0,10)}.xlsx`;
      const mainWindow = context.getMainWindow();
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
      const mainWindow = context.getMainWindow();
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

  // ── Student Import Template ──
  ipcMain.handle('import:students-template', async () => {
    try {
      if (!XLSX) return { success: false, error: 'xlsx not available - run: npm install xlsx' };
      const mainWindow = context.getMainWindow();
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

  // ── Student Import Commit ──
  ipcMain.handle('import:students-commit', (_, { rows }) => {
    if (IS_TRIAL) {
      const students = readDB('students');
      if ((students.length + rows.length) > TRIAL_STUDENT_LIMIT) {
        return { success: false, error: `عذراً، النسخة التجريبية تدعم تسجيل ${TRIAL_STUDENT_LIMIT} طالب فقط. الاستيراد سيتجاوز هذا الحد.` };
      }
    }
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
          id: makeId('lv'),
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
            id: makeId('c'),
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
          id: makeId('s'),
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
}

module.exports = registerReportHandlers;
