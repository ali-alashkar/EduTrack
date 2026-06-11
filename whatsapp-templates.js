// ── WhatsApp Message Templates ────────────────────────────────────────────────
// 5+ variations per category to avoid WhatsApp ban detection.
// Each call picks a random template and fills placeholders.

const TEMPLATES = {
  // ── Attendance (sent when student is marked present) ──
  attendance: [
    {
      id: 'att_1',
      text: `السلام عليكم 🌟
نفيدكم بحضور الطالب/ة *{studentName}* لحصة *{sessionTitle}* اليوم
📅 التاريخ: {date}
⏰ الوقت: {time}
جزاكم الله خيراً`
    },
    {
      id: 'att_2',
      text: `مرحباً 👋
تم تسجيل حضور *{studentName}* في حصة *{sessionTitle}*
📅 {date} - ⏰ {time}
شكراً لكم`
    },
    {
      id: 'att_3',
      text: `أهلاً وسهلاً ✅
نود إعلامكم أن *{studentName}* حضر/ت حصة *{sessionTitle}*
بتاريخ {date} الساعة {time}
مع تحياتنا`
    },
    {
      id: 'att_4',
      text: `تحية طيبة 📚
*{studentName}* حضر/ت اليوم حصة *{sessionTitle}*
📅 {date}  ⏰ {time}
نشكر تعاونكم`
    },
    {
      id: 'att_5',
      text: `السلام عليكم ورحمة الله ✨
يسرنا إبلاغكم بحضور *{studentName}* لحصة *{sessionTitle}* اليوم
التاريخ: {date}
الوقت: {time}
بارك الله فيكم`
    },
    {
      id: 'att_6',
      text: `مساء الخير 🌙
نعلمكم أن الطالب/ة *{studentName}* قد حضر/ت حصة اليوم
📖 الحصة: *{sessionTitle}*
📅 التاريخ: {date}
مع أطيب التحيات`
    },
    {
      id: 'att_7',
      text: `أهلا بكم 📝
تم تأكيد حضور *{studentName}*
الحصة: *{sessionTitle}*
التاريخ: {date} | الوقت: {time}
شكراً لمتابعتكم`
    }
  ],

  // ── Homework Status ──
  homework: [
    {
      id: 'hw_1',
      text: `السلام عليكم 📝
تحديث الواجب المنزلي للطالب/ة *{studentName}*
📖 الحصة: *{sessionTitle}*
📋 حالة الواجب: *{homeworkStatus}*
{homeworkNote}
جزاكم الله خيراً`
    },
    {
      id: 'hw_2',
      text: `مرحباً 👋
بخصوص الواجب المنزلي:
الطالب/ة: *{studentName}*
الحصة: *{sessionTitle}*
الحالة: *{homeworkStatus}*
{homeworkNote}
شكراً لمتابعتكم`
    },
    {
      id: 'hw_3',
      text: `تحية طيبة ✏️
نود إبلاغكم عن حالة الواجب:
*{studentName}* - حصة *{sessionTitle}*
📋 الواجب: *{homeworkStatus}*
{homeworkNote}
مع تحياتنا`
    },
    {
      id: 'hw_4',
      text: `أهلاً وسهلاً 📚
تقرير الواجب المنزلي:
الطالب/ة: *{studentName}*
📖 *{sessionTitle}*
الحالة: *{homeworkStatus}*
{homeworkNote}
نشكر تعاونكم`
    },
    {
      id: 'hw_5',
      text: `السلام عليكم ورحمة الله 🌟
ملاحظة بخصوص الواجب:
*{studentName}* في حصة *{sessionTitle}*
حالة الواجب: *{homeworkStatus}*
{homeworkNote}
بارك الله فيكم`
    }
  ],

  // ── Quiz Score ──
  quiz: [
    {
      id: 'qz_1',
      text: `السلام عليكم 📊
نتيجة الاختبار القصير للطالب/ة *{studentName}*
📖 الحصة: *{sessionTitle}*
📝 الدرجة: *{quizScore} / {quizMax}*
📈 النسبة: *{quizPercent}%*
جزاكم الله خيراً`
    },
    {
      id: 'qz_2',
      text: `مرحباً 🎓
نتيجة الكويز:
الطالب/ة: *{studentName}*
الحصة: *{sessionTitle}*
الدرجة: *{quizScore}/{quizMax}* ({quizPercent}%)
شكراً لمتابعتكم`
    },
    {
      id: 'qz_3',
      text: `تحية طيبة ✨
نتائج الاختبار:
*{studentName}* - *{sessionTitle}*
📝 حصل/ت على: *{quizScore}* من *{quizMax}*
📊 النسبة المئوية: *{quizPercent}%*
مع تحياتنا`
    },
    {
      id: 'qz_4',
      text: `أهلاً بكم 📋
تقرير الاختبار القصير:
الطالب/ة: *{studentName}*
📖 *{sessionTitle}*
النتيجة: *{quizScore} / {quizMax}* = *{quizPercent}%*
نشكر تعاونكم`
    },
    {
      id: 'qz_5',
      text: `السلام عليكم ورحمة الله 🌟
إليكم نتيجة الاختبار:
*{studentName}*
الحصة: *{sessionTitle}*
الدرجة: *{quizScore}* من أصل *{quizMax}*
النسبة: *{quizPercent}%*
بارك الله فيكم`
    }
  ],

  // ── Combined: Attendance + Homework (when homework is set at check-in) ──
  attendance_homework: [
    {
      id: 'atthw_1',
      text: `السلام عليكم 🌟
نفيدكم بحضور الطالب/ة *{studentName}* لحصة *{sessionTitle}*
📅 التاريخ: {date} | ⏰ الوقت: {time}
📋 حالة الواجب: *{homeworkStatus}*
{homeworkNote}
جزاكم الله خيراً`
    },
    {
      id: 'atthw_2',
      text: `مرحباً 👋
*{studentName}* حضر/ت حصة *{sessionTitle}* اليوم
📅 {date} - ⏰ {time}
📝 الواجب: *{homeworkStatus}*
{homeworkNote}
شكراً لكم`
    },
    {
      id: 'atthw_3',
      text: `أهلاً وسهلاً ✅
تقرير حصة اليوم للطالب/ة *{studentName}*:
📖 الحصة: *{sessionTitle}* ({date})
✅ الحضور: تم التسجيل
📋 الواجب: *{homeworkStatus}*
{homeworkNote}
مع تحياتنا`
    },
    {
      id: 'atthw_4',
      text: `تحية طيبة 📚
ملخص حصة اليوم:
الطالب/ة: *{studentName}*
الحصة: *{sessionTitle}*
التاريخ: {date} | الوقت: {time}
حالة الواجب: *{homeworkStatus}*
{homeworkNote}
نشكر تعاونكم`
    },
    {
      id: 'atthw_5',
      text: `السلام عليكم ورحمة الله ✨
إليكم تقرير حضور اليوم:
*{studentName}* ✅ حاضر/ة
📖 *{sessionTitle}* - {date}
📝 الواجب: *{homeworkStatus}*
{homeworkNote}
بارك الله فيكم`
    }
  ],
  session_summary: [
  {
    id: 'sum_1',
    text: `السلام عليكم 🌟
تقرير حصة *{sessionTitle}*
📅 {date}{time_line}

👤 الطالب/ة: *{studentName}*
✅ الحضور: حاضر/ة{hw_line}{quiz_line}

جزاكم الله خيراً`
  },
  {
    id: 'sum_2',
    text: `مرحباً 👋
ملخص حصة اليوم لـ *{studentName}*
📖 *{sessionTitle}* — {date}{time_line}
─────────────────
✅ الحضور: مسجّل{hw_line}{quiz_line}
─────────────────
شكراً لمتابعتكم`
  },
  {
    id: 'sum_3',
    text: `أهلاً وسهلاً ✨
تقرير *{studentName}* — *{sessionTitle}*
📅 {date}{time_line}

- الحضور ✅ حاضر/ة{hw_line}{quiz_line}

مع تحياتنا`
  },
  {
    id: 'sum_4',
    text: `تحية طيبة 📚
*{sessionTitle}* | {date}{time_line}

الطالب/ة: *{studentName}*
الحضور: ✅ تم التسجيل{hw_line}{quiz_line}

نشكر تعاونكم`
  },
  {
    id: 'sum_5',
    text: `السلام عليكم ورحمة الله 🌙
إليكم تقرير اليوم:

👤 *{studentName}*
📖 الحصة: *{sessionTitle}*
📅 {date}{time_line}
✅ الحضور: حاضر/ة{hw_line}{quiz_line}

بارك الله فيكم`
  },
]
};

// ── Homework status translation map ──
const HW_STATUS_AR = {
  'done': '✅ تم التسليم',
  'partial': '⚠️ تسليم جزئي',
  'missed': '❌ لم يسلم',
  'excused': '🔵 معذور',
  'pending': '⏳ قيد المراجعة',
};

/**
 * Get a random template for the given category, filled with the provided data.
 * @param {'attendance'|'homework'|'quiz'|'attendance_homework'|'session_summary'} category
 * @param {Object} data - Placeholder values
 * @returns {{ text: string, templateId: string }}
 */
function getRandomTemplate(category, data = {}) {
  const templates = TEMPLATES[category];
  if (!templates || !templates.length) {
    throw new Error(`Unknown template category: ${category}`);
  }

  const idx = Math.floor(Math.random() * templates.length);
  const template = templates[idx];

  // Translate homework status to Arabic
  const hwStatusAr = data.homeworkStatus ? (HW_STATUS_AR[data.homeworkStatus] || data.homeworkStatus) : '';
  const homeworkNote = data.homeworkNote ? `📌 ملاحظة: ${data.homeworkNote}` : '';

  const timeLine = data.time ? ` | ${data.time}` : '';
  const hwLine = data.homeworkStatus && data.homeworkStatus !== 'pending'
    ? `\n📋 الواجب: *${hwStatusAr}*${homeworkNote ? `\n${homeworkNote}` : ''}`
    : '';
  const quizLine = data.quizScore !== '' && data.quizScore != null && data.quizMax !== '' && data.quizMax != null
    ? `\n📊 الكويز: *${data.quizScore}/${data.quizMax}* (${data.quizPercent}%)`
    : '';

  let text = template.text
    .replace(/\{studentName\}/g, data.studentName || '')
    .replace(/\{sessionTitle\}/g, data.sessionTitle || '')
    .replace(/\{date\}/g, data.date || '')
    .replace(/\{time\}/g, data.time || '')
    .replace(/\{homeworkStatus\}/g, hwStatusAr)
    .replace(/\{homeworkNote\}/g, homeworkNote)
    .replace(/\{quizScore\}/g, data.quizScore ?? '')
    .replace(/\{quizMax\}/g, data.quizMax ?? '')
    .replace(/\{quizPercent\}/g, data.quizPercent ?? '')
    .replace(/\{time_line\}/g, timeLine)
    .replace(/\{hw_line\}/g, hwLine)
    .replace(/\{quiz_line\}/g, quizLine);

  // Clean up empty lines from missing optional fields
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return {
    text,
    templateId: template.id,
    templateIndex: idx,
  };
}

module.exports = { getRandomTemplate, TEMPLATES, HW_STATUS_AR };
