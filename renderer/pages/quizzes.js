// ── Quiz Scores Page ──────────────────────────────────────────────────────────
let currentQuizSessionId = null;

async function renderQuizzes() {
  const sessions = await window.api.sessions.list();
  const quizSessions = sessions.filter(s => s.hasQuiz);
  const otherSessions = sessions.filter(s => !s.hasQuiz);
  const sortedQuiz = [...quizSessions].sort((a, b) => b.date.localeCompare(a.date));
  const sortedOther = [...otherSessions].sort((a, b) => b.date.localeCompare(a.date));

  el('page-quizzes').innerHTML = `
    <div class="page-header">
      <div><h2>Quiz Scores</h2><p class="page-header-sub">Record quiz results for students who attended the session</p></div>
    </div>
    <div class="two-col" style="margin-bottom:20px">
      <div class="form-group">
        <label class="form-label">Select Session</label>
        <select id="quiz-session-select" class="form-select">
          <option value="">— Select a session —</option>
          ${sortedQuiz.length ? `<optgroup label="Quiz Sessions">${sortedQuiz.map(s => `<option value="${s.id}">${s.date} · ${s.title}</option>`).join('')}</optgroup>` : ''}
          ${sortedOther.length ? `<optgroup label="Other Sessions">${sortedOther.map(s => `<option value="${s.id}">${s.date} · ${s.title}</option>`).join('')}</optgroup>` : ''}
        </select>
      </div>
      <div id="quiz-session-info" style="display:flex;align-items:flex-end">
        <p style="color:var(--text-muted);font-size:13px">Select a session to record scores</p>
      </div>
    </div>
    <div id="quiz-main" class="hidden"></div>`;

  el('quiz-session-select').addEventListener('change', async () => {
    await selectSessionForQuizzes(el('quiz-session-select').value);
  });
}

async function selectSessionForQuizzes(sessionId) {
  if (!sessionId) {
    currentQuizSessionId = null;
    el('quiz-main').classList.add('hidden');
    el('quiz-session-info').innerHTML = `<p style="color:var(--text-muted);font-size:13px">Select a session to record scores</p>`;
    return;
  }

  currentQuizSessionId = sessionId;
  const select = el('quiz-session-select');
  if (select) select.value = sessionId;

  const [sessions, groups, students, scores, attendance] = await Promise.all([
    window.api.sessions.list(),
    window.api.groups.list(),
    window.api.students.list(),
    window.api.quizzes.bySession(sessionId),
    window.api.attendance.bySession(sessionId),
  ]);

  const session = sessions.find(s => s.id === sessionId);
  const group = groups.find(g => g.id === session?.groupId);
  const maxScore = session?.quizMaxScore || 10;

  el('quiz-session-info').innerHTML = session ? `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;flex:1">
      <div style="font-weight:700;font-size:15px">${session.title}</div>
      <div style="color:var(--text-secondary);font-size:12px">${session.date} ${session.time || ''} · ${group?.name || 'No group'}</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        ${session.hasQuiz
          ? `<span class="badge badge-accent">Quiz · Max ${maxScore}</span>`
          : `<span class="badge badge-yellow">No quiz enabled</span>`}
        <span class="badge badge-green">${attendance.length} attended</span>
        <span class="badge badge-cyan">${scores.length} scored</span>
      </div>
    </div>` : '';

  if (!session?.hasQuiz) {
    el('quiz-main').innerHTML = `
      <div class="empty-state" style="padding:40px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;color:var(--text-muted)">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <p style="margin-top:12px">This session does not have a quiz.</p>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px">Edit the session in <strong>Sessions</strong> and enable "This session includes a quiz".</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="navigate('sessions')">Go to Sessions</button>
      </div>`;
    el('quiz-main').classList.remove('hidden');
    return;
  }

  const attendedIds = new Set(attendance.map(a => a.studentId));
  const attendedStudents = students
    .filter(s => attendedIds.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const scoreMap = Object.fromEntries(scores.map(q => [q.studentId, q]));
  const attendedScores = scores.filter(q => attendedIds.has(q.studentId));
  const avgPct = attendedScores.length
    ? Math.round(attendedScores.reduce((sum, q) => sum + (q.score / q.maxScore) * 100, 0) / attendedScores.length)
    : 0;

  if (!attendedStudents.length) {
    el('quiz-main').innerHTML = `
      <div class="empty-state" style="padding:40px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;color:var(--text-muted)">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        </svg>
        <p style="margin-top:12px">No students have checked in for this session yet.</p>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px">Check in students in <strong>Attendance</strong> before recording quiz scores.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="navigate('attendance');setTimeout(()=>selectSessionForAttendance('${sessionId}'),200)">Go to Attendance</button>
      </div>`;
    el('quiz-main').classList.remove('hidden');
    return;
  }

  el('quiz-main').innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      ${quizStatCard('Attended', attendedStudents.length, 'var(--accent)')}
      ${quizStatCard('Scored', attendedScores.length, 'var(--green)')}
      ${quizStatCard('Average', attendedScores.length ? avgPct + '%' : '—', 'var(--cyan)')}
    </div>
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <span class="card-title" id="quiz-count">Scores (0 / ${attendedStudents.length})</span>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="search-box" style="margin:0;width:200px;height:32px;padding:0 8px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="quiz-search" type="text" placeholder="Search students…" style="font-size:12px;padding:4px 0" />
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-all-quiz">Save All</button>
          <button class="btn btn-secondary btn-sm" id="btn-wa-send-quiz" style="background:rgba(37,211,102,0.1);color:#25D366;border-color:rgba(37,211,102,0.25)">📱 Send Quiz Results</button>
          <button class="btn btn-secondary btn-sm" id="btn-export-quiz">Export CSV/Excel</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Student</th><th>Level</th><th>Score</th><th>%</th><th>Note</th><th>Actions</th></tr>
          </thead>
          <tbody id="quiz-tbody"></tbody>
        </table>
      </div>
    </div>`;

  el('quiz-main').classList.remove('hidden');
  renderQuizTable(attendedStudents, scoreMap, maxScore);

  el('quiz-search').addEventListener('input', debounce(() => {
    const q = el('quiz-search').value.toLowerCase();
    const filtered = attendedStudents.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.barcode || '').toLowerCase().includes(q)
    );
    renderQuizTable(filtered, scoreMap, maxScore);
  }));

  el('btn-save-all-quiz').addEventListener('click', () => saveAllQuizScores(attendedStudents, maxScore));
  el('btn-wa-send-quiz').addEventListener('click', () => batchSendWhatsAppQuiz());
  el('btn-export-quiz').addEventListener('click', () => exportQuizzesExcel(attendedStudents, scoreMap, maxScore));

  window.saveQuizScore = async (studentId, maxScore) => {
    const input = el(`quiz-score-${studentId}`);
    const noteInput = el(`quiz-note-${studentId}`);
    if (!input || input.value === '') { toast('Enter a score first', 'error'); return; }

    const res = await window.api.quizzes.upsert({
      sessionId: currentQuizSessionId,
      studentId,
      score: Number(input.value),
      maxScore,
      notes: noteInput?.value?.trim() || '',
    });

    if (!res.success) { toast(res.message, 'error'); return; }
    toast('Score saved', 'success');
    // Auto-send WhatsApp quiz message
    autoSendWhatsAppQuiz(studentId, currentQuizSessionId);
    await selectSessionForQuizzes(currentQuizSessionId);
  };

  window.clearQuizScore = async (scoreId) => {
    if (!confirmAction('Remove this quiz score?')) return;
    await window.api.quizzes.remove(scoreId);
    toast('Score removed', 'success');
    await selectSessionForQuizzes(currentQuizSessionId);
  };
}

function renderQuizTable(students, scoreMap, maxScore) {
  const tbody = el('quiz-tbody');
  const scored = students.filter(s => scoreMap[s.id]).length;
  const countEl = el('quiz-count');
  if (countEl) countEl.textContent = `Scores (${scored} / ${students.length})`;

  tbody.innerHTML = students.length ? students.map((s, i) => {
    const record = scoreMap[s.id];
    const pct = record ? Math.round((record.score / record.maxScore) * 100) : null;
    const pctColor = pct === null ? 'var(--text-muted)' : pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
    return `
      <tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td>
          <div style="font-weight:600">${s.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${s.barcode || '—'}</div>
        </td>
        <td><span class="badge badge-cyan">${s.level || '—'}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <input id="quiz-score-${s.id}" type="number" class="form-input" style="width:72px;padding:4px 8px;font-size:13px"
              min="0" max="${maxScore}" step="0.5" placeholder="—"
              value="${record ? record.score : ''}" />
            <span style="color:var(--text-muted);font-size:12px">/ ${maxScore}</span>
          </div>
        </td>
        <td style="font-weight:700;color:${pctColor}">${pct !== null ? pct + '%' : '—'}</td>
        <td>
          <input id="quiz-note-${s.id}" type="text" class="form-input" style="padding:4px 8px;font-size:12px"
            placeholder="Optional note" value="${record?.notes || ''}" />
        </td>
        <td>
          <div style="display:flex;gap:5px;">
            <button class="btn btn-primary btn-sm" onclick="saveQuizScore('${s.id}', ${maxScore})">Save</button>
            ${record ? `<button class="btn btn-danger btn-sm" onclick="clearQuizScore('${record.id}')">✕</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('') : `<tr><td colspan="7" class="table-empty">No attended students for this session.</td></tr>`;
}

async function saveAllQuizScores(students, maxScore) {
  let saved = 0;
  let skipped = 0;

  for (const s of students) {
    const input = el(`quiz-score-${s.id}`);
    if (!input || input.value === '') { skipped++; continue; }
    const res = await window.api.quizzes.upsert({
      sessionId: currentQuizSessionId,
      studentId: s.id,
      score: Number(input.value),
      maxScore,
      notes: el(`quiz-note-${s.id}`)?.value?.trim() || '',
    });
    if (res.success) saved++;
  }

  if (saved) {
    toast(`Saved ${saved} score${saved > 1 ? 's' : ''}`, 'success');
    // Auto-send WhatsApp quiz messages for all saved
    for (const s of students) {
      const input = el(`quiz-score-${s.id}`);
      if (!input || input.value === '') continue;
      autoSendWhatsAppQuiz(s.id, currentQuizSessionId);
    }
    await selectSessionForQuizzes(currentQuizSessionId);
  } else {
    toast('No scores to save — enter at least one score', 'error');
  }
}

function quizStatCard(label, val, color) {
  return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px">
    <div style="font-size:22px;font-weight:800;color:${color}">${val}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${label}</div>
  </div>`;
}

// ── WhatsApp Quiz Helpers ───────────────────────────────────────────────────

async function autoSendWhatsAppQuiz(studentId, sessionId) {
  try {
    const settings = await window.api.whatsapp.getSettings();
    if (!settings.autoSendQuiz) return;
    const status = await window.api.whatsapp.status();
    if (status.status !== 'connected') return;

    await window.api.whatsapp.sendQuiz({ studentId, sessionId });
  } catch (e) {
    console.error('WhatsApp quiz auto-send error:', e);
  }
}

async function batchSendWhatsAppQuiz() {
  if (!currentQuizSessionId) return;
  const status = await window.api.whatsapp.status();
  if (status.status !== 'connected') {
    toast('WhatsApp is not connected. Go to WhatsApp page to connect.', 'error');
    return;
  }

  const res = await window.api.whatsapp.sendSessionBatch({ sessionId: currentQuizSessionId, type: 'quiz' });
  if (res.success) {
    toast(`📱 Queued ${res.queued} quiz message${res.queued !== 1 ? 's' : ''}${res.skipped ? ` (${res.skipped} skipped)` : ''}`, 'success');
  } else {
    toast(res.error || 'Failed to queue quiz messages', 'error');
  }
}

async function exportQuizzesExcel(students, scoreMap, maxScore) {
  if (!students.length) return toast('No students to export', 'error');
  const rows = students.map(s => {
    const record = scoreMap[s.id];
    const scoreVal = record ? record.score : '';
    const pct = record ? Math.round((record.score / record.maxScore) * 100) + '%' : '—';
    const note = record ? record.notes || '' : '';
    return {
      name: s.name,
      barcode: s.barcode || '',
      level: s.level || '',
      score: scoreVal,
      maxScore: record ? record.maxScore : maxScore,
      percentage: pct,
      note: note
    };
  });

  const cols = [
    { key: 'name', label: 'Student Name' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'level', label: 'Level' },
    { key: 'score', label: 'Score' },
    { key: 'maxScore', label: 'Max Score' },
    { key: 'percentage', label: 'Percentage' },
    { key: 'note', label: 'Note' }
  ];

  const res = await window.api.export.excel({ sheetName: 'Quiz Scores', columns: cols, rows, filename: `Quiz_Scores_Export.xlsx` });
  if (res?.success) toast('Quiz scores exported successfully', 'success');
  else if (res && !res.canceled) toast(res.error || 'Export failed', 'error');
}
