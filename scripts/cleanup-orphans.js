/**
 * One-time cleanup: removes attendance, quiz_scores, and whatsapp_log records
 * that reference session IDs which no longer exist in sessions.json.
 */
const fs   = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'edutrack_data');

function read(name) {
  const p = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
}

function write(name, data) {
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2), 'utf-8');
}

const sessions     = read('sessions');
const validIds     = new Set(sessions.map(s => s.id));

const attendance   = read('attendance');
const quizScores   = read('quiz_scores');
const whatsappLog  = read('whatsapp_log');

const cleanAtt  = attendance.filter(a => validIds.has(a.sessionId));
const cleanQuiz = quizScores.filter(q => validIds.has(q.sessionId));
const cleanLog  = whatsappLog.filter(m => !m.sessionId || validIds.has(m.sessionId));

console.log(`Sessions:      ${sessions.length}`);
console.log(`Attendance:    ${attendance.length} -> ${cleanAtt.length}  (removed ${attendance.length  - cleanAtt.length})`);
console.log(`Quiz scores:   ${quizScores.length} -> ${cleanQuiz.length}  (removed ${quizScores.length - cleanQuiz.length})`);
console.log(`WhatsApp log:  ${whatsappLog.length} -> ${cleanLog.length}  (removed ${whatsappLog.length - cleanLog.length})`);

write('attendance',   cleanAtt);
write('quiz_scores',  cleanQuiz);
write('whatsapp_log', cleanLog);

console.log('\nCleanup done. Restart the app to see updated dashboard counts.');
