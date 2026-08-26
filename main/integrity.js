const fs = require('fs');
const path = require('path');
const { getDataDir, getBackupsDir, readDB, writeDB, dbPath } = require('./db');
const { createBackupData, formatDateStamp } = require('./backup');
const { TEMPLATES } = require('../whatsapp-templates');

let corruptedFiles = [];
const TARGET_VERSION = 1;
const MIGRATIONS = [];

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

function runMigrations() {
  const systemSettings = getSystemSettings();
  let currentVersion = systemSettings.schemaVersion || 1;
  const targetVersion = TARGET_VERSION;

  if (currentVersion < targetVersion) {
    try {
      const backupData = createBackupData();
      const dir = getBackupsDir();
      const filename = `premigration_backup_v${currentVersion}_to_v${targetVersion}_${formatDateStamp()}.json`;
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

function purgeOrphanedRecords() {
  try {
    const validIds = new Set(readDB('sessions').map(s => s.id));

    const attendance = readDB('attendance');
    const cleanAtt = attendance.filter(a => validIds.has(a.sessionId));
    if (cleanAtt.length !== attendance.length) {
      writeDB('attendance', cleanAtt);
      console.log(`[integrity] Purged ${attendance.length - cleanAtt.length} orphaned attendance record(s)`);
    }

    const quizScores = readDB('quiz_scores');
    const cleanQuiz = quizScores.filter(q => validIds.has(q.sessionId));
    if (cleanQuiz.length !== quizScores.length) {
      writeDB('quiz_scores', cleanQuiz);
      console.log(`[integrity] Purged ${quizScores.length - cleanQuiz.length} orphaned quiz score(s)`);
    }

    const log = readDB('whatsapp_log');
    const cleanLog = log.filter(m => !m.sessionId || validIds.has(m.sessionId));
    if (cleanLog.length !== log.length) {
      writeDB('whatsapp_log', cleanLog);
      console.log(`[integrity] Purged ${log.length - cleanLog.length} orphaned WhatsApp log entry/entries`);
    }
  } catch (err) {
    console.error('[integrity] purgeOrphanedRecords failed:', err);
  }
}

module.exports = {
  getCorruptedFiles: () => corruptedFiles,
  setCorruptedFiles: (val) => { corruptedFiles = val; },
  getSystemSettings,
  writeSystemSettings,
  verifyDataIntegrity,
  seedData,
  runMigrations,
  purgeOrphanedRecords
};
