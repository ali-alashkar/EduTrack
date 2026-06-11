/**
 * WhatsApp templates & phone formatting unit tests
 */

'use strict';

const { getRandomTemplate, TEMPLATES, HW_STATUS_AR } = require('../whatsapp-templates');

describe('WhatsApp Templates', () => {
  const sampleData = {
    studentName: 'محمد',
    sessionTitle: 'Algebra Ch3',
    date: '2024-03-01',
    time: '10:00',
    homeworkStatus: 'done',
    homeworkNote: 'Excellent work',
    quizScore: 8,
    quizMax: 10,
    quizPercent: 80,
  };

  test('attendance category has 5+ template variations', () => {
    expect(TEMPLATES.attendance.length).toBeGreaterThanOrEqual(5);
  });

  test('homework category has 5+ template variations', () => {
    expect(TEMPLATES.homework.length).toBeGreaterThanOrEqual(5);
  });

  test('quiz category has 5+ template variations', () => {
    expect(TEMPLATES.quiz.length).toBeGreaterThanOrEqual(5);
  });

  test('session summary category has 5+ template variations', () => {
    expect(TEMPLATES.session_summary.length).toBeGreaterThanOrEqual(5);
  });

  test('getRandomTemplate fills attendance placeholders', () => {
    const { text, templateId } = getRandomTemplate('attendance', sampleData);
    expect(text).toContain('محمد');
    expect(text).toContain('Algebra Ch3');
    expect(text).toContain('2024-03-01');
    expect(templateId).toMatch(/^att_/);
  });

  test('getRandomTemplate translates homework status to Arabic', () => {
    const { text } = getRandomTemplate('homework', sampleData);
    expect(text).toContain(HW_STATUS_AR.done);
    expect(text).toContain('Excellent work');
  });

  test('getRandomTemplate fills quiz score placeholders', () => {
    const { text } = getRandomTemplate('quiz', sampleData);
    expect(text).toContain('8');
    expect(text).toContain('10');
    expect(text).toContain('80');
  });

  test('getRandomTemplate fills optional summary lines', () => {
    const { text, templateId } = getRandomTemplate('session_summary', sampleData);
    expect(templateId).toMatch(/^sum_/);
    expect(text).toContain('Algebra Ch3');
    expect(text).toContain(HW_STATUS_AR.done);
    expect(text).toContain('Excellent work');
    expect(text).toContain('8/10');
    expect(text).not.toContain('{hw_line}');
    expect(text).not.toContain('{quiz_line}');
  });

  test('getRandomTemplate picks different templates over multiple calls', () => {
    const ids = new Set();
    for (let i = 0; i < 30; i++) {
      ids.add(getRandomTemplate('attendance', sampleData).templateId);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  test('unknown category throws', () => {
    expect(() => getRandomTemplate('invalid', {})).toThrow(/Unknown template category/);
  });
});

describe('WhatsApp Phone Formatting', () => {
  // Test formatPhone logic without loading whatsapp-web.js
  function formatPhone(phone, countryCode = '20') {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = countryCode + cleaned.substring(1);
    }
    if (!cleaned.startsWith(countryCode) && cleaned.length <= 10) {
      cleaned = countryCode + cleaned;
    }
    return cleaned + '@c.us';
  }

  test('Egyptian format 01033334444 → 201033334444@c.us', () => {
    expect(formatPhone('01033334444')).toBe('201033334444@c.us');
  });

  test('strips non-digit characters', () => {
    expect(formatPhone('+20 10-3333-4444')).toBe('201033334444@c.us');
  });

  test('empty phone returns null', () => {
    expect(formatPhone('')).toBeNull();
    expect(formatPhone(null)).toBeNull();
  });

  test('custom country code', () => {
    expect(formatPhone('0501234567', '966')).toBe('966501234567@c.us');
  });
});
