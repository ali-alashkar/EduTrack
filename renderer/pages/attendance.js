// ── Attendance Page ───────────────────────────────────────────────────────────
let currentSessionId = null;

async function renderAttendance() {
  const sessions = await window.api.sessions.list();
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(s => s.date === today).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const allSorted = [...sessions].sort((a,b) => b.date.localeCompare(a.date));

  el('page-attendance').innerHTML = `
    <div class="page-header">
      <div><h2>Attendance</h2><p class="page-header-sub">Scan barcodes and track session attendance</p></div>
    </div>
    <div class="two-col" style="margin-bottom:20px">
      <div class="form-group">
        <label class="form-label">Select Session</label>
        <select id="att-session-select" class="form-select">
          <option value="">— Select a session —</option>
          <optgroup label="Today">
            ${todaySessions.map(s=>`<option value="${s.id}">${s.title} (${s.time||'no time'})</option>`).join('')}
          </optgroup>
          <optgroup label="All Sessions">
            ${allSorted.map(s=>`<option value="${s.id}">${s.date} · ${s.title}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div id="session-info-box" style="display:flex;align-items:flex-end">
        <p style="color:var(--text-muted);font-size:13px">Select a session to start</p>
      </div>
    </div>

    <div id="att-main" class="hidden">
      <!-- Scanner & Search Row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        <!-- Scanner -->
        <div class="scan-box" id="scan-box" style="margin-bottom:0">
          <div class="scan-icon">📷</div>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:10px">Scan student barcode</p>
          <input id="barcode-input" type="text" placeholder="Waiting for scan…" autocomplete="off" />
        </div>
        <!-- Search Check-In -->
        <div class="scan-box" id="search-checkin-box" style="margin-bottom:0;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:20px;position:relative;text-align:left">
          <div class="scan-icon" style="align-self:center">🔍</div>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:10px;text-align:center">Search by Name or Phone</p>
          <div style="position:relative">
            <input id="attendance-student-search" type="text" placeholder="Type name or phone…" autocomplete="off" style="width:100%" />
            <div id="attendance-student-suggestions" class="suggestions-list hidden"></div>
          </div>
        </div>
      </div>
      <div id="scan-result-area" style="margin-bottom:20px"></div>

      <!-- Attendance Table -->
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <span class="card-title" id="att-count">Attendance (0)</span>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="search-box" style="margin:0;width:180px;height:32px;padding:0 8px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="att-search" type="text" placeholder="Search present list…" style="font-size:12px;padding:4px 0" />
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-manual-add">+ Manual Add</button>
            <button class="btn btn-secondary btn-sm" id="btn-wa-send-all" style="background:rgba(37,211,102,0.1);color:#25D366;border-color:rgba(37,211,102,0.25)">📱 Send All WhatsApp</button>
            <button class="btn btn-secondary btn-sm" id="btn-wa-send-absence" style="background:rgba(239,68,68,0.1);color:#EF4444;border-color:rgba(239,68,68,0.25)">📵 Send Absence</button>
            <button class="btn btn-secondary btn-sm" id="btn-export-att">Export CSV</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Student</th><th>Barcode</th><th>Check-in</th><th>Homework</th><th>Note</th><th>📱 WA</th><th>Actions</th></tr>
            </thead>
            <tbody id="att-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  el('att-session-select').addEventListener('change', async () => {
    const id = el('att-session-select').value;
    await selectSessionForAttendance(id);
  });
}

let attendanceRecords = [];

function buildCheckInResultHtml(student, record, historyHtml) {
  const hwOptions = ['pending', 'done', 'partial', 'missed', 'excused'];
  return `
    <div class="scan-result" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;align-items:center;gap:12px;width:100%">
        <div class="scan-result-avatar">${student.name[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px">${student.name}</div>
          <div style="color:var(--text-secondary);font-size:12px">${student.level || ''} · ${student.center || ''}</div>
        </div>
        <span class="badge badge-green">✓ Present</span>
      </div>
      <div class="checkin-hw-panel">
        <div class="checkin-hw-label">Homework Status</div>
        <div class="checkin-hw-row">
          <select id="checkin-hw-status" class="form-select checkin-hw-select" onchange="saveCheckinHw('${record.id}', this.value, el('checkin-hw-note')?.value || '')">
            ${hwOptions.map(s => `<option value="${s}" ${record.homeworkStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <input id="checkin-hw-note" type="text" class="form-input checkin-hw-note"
            placeholder="Optional note…" value="${record.homeworkNote || ''}"
            onblur="saveCheckinHw('${record.id}', el('checkin-hw-status')?.value || 'pending', this.value)" />
        </div>
      </div>
      ${historyHtml}
    </div>`;
}

async function showCheckInResult(student, record, groupId) {
  const historyHtml = await getStudentHistoryHtml(student.id, groupId, currentSessionId);
  const resultArea = el('scan-result-area');
  if (resultArea) resultArea.innerHTML = buildCheckInResultHtml(student, record, historyHtml);
}

window.saveCheckinHw = async (id, status, note) => {
  await window.api.attendance.update({ id, homeworkStatus: status, homeworkNote: note || '' });
  const record = attendanceRecords.find(r => r.id === id);
  if (record) {
    record.homeworkStatus = status;
    record.homeworkNote = note || '';
    if (status !== 'pending' && record.studentId && currentSessionId) {
      autoSendWhatsAppHomework(record.studentId, currentSessionId);
    }
  }
  renderAttTableFiltered();
};

async function selectSessionForAttendance(sessionId) {
  if (!sessionId) return;
  currentSessionId = sessionId;
  const [sessions, students] = await Promise.all([
    window.api.sessions.list(),
    window.api.students.list()
  ]);
  const session = sessions.find(s => s.id === sessionId);

  const select = el('att-session-select');
  if (select) select.value = sessionId;

  el('session-info-box').innerHTML = session ? `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;flex:1">
      <div style="font-weight:700;font-size:15px">${session.title}</div>
      <div style="color:var(--text-secondary);font-size:12px">${session.date} ${session.time||''} · ${session.topic||'No topic'}</div>
      ${session.homework ? `<div style="color:var(--yellow);font-size:12px;margin-top:4px">📝 HW: ${session.homework}</div>` : ''}
    </div>` : '';

  el('att-main').classList.remove('hidden');

  const resultArea = el('scan-result-area');
  if (resultArea) resultArea.innerHTML = '';

  const barcodeInput = el('barcode-input');
  barcodeInput.value = '';
  barcodeInput.focus();

  barcodeInput.onkeydown = async (e) => {
    if (e.key !== 'Enter') return;
    const barcode = barcodeInput.value.trim();
    if (!barcode) return;
    barcodeInput.value = '';

    const res = await window.api.attendance.scan({ sessionId: currentSessionId, barcode });
    const resultArea = el('scan-result-area');

    if (res.success) {
      toast(`${res.student.name} checked in!`, 'success');
      await loadAttTable();
      await showCheckInResult(res.student, res.record, session.groupId);
      showBlockedStudentWarning(res.blockWarning);
      // Auto-send WhatsApp attendance message
      autoSendWhatsAppAttendance(res.student.id, currentSessionId);
    } else if (res.student) {
      await loadAttTable();
      const existing = attendanceRecords.find(a => a.studentId === res.student.id);
      if (existing) {
        await showCheckInResult(res.student, existing, session.groupId);
        toast(`${res.student.name} is already present — update homework below`, 'info');
      } else {
        resultArea.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
        toast(res.message, 'error');
      }
    } else {
      resultArea.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
      toast(res.message, 'error');
    }
    barcodeInput.focus();
  };

  // ── Search & Check-in by Name / Phone ──
  const studentSearch = el('attendance-student-search');
  const suggestionsBox = el('attendance-student-suggestions');

  if (studentSearch && suggestionsBox) {
    studentSearch.value = '';
    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.add('hidden');

    studentSearch.oninput = () => {
      const q = studentSearch.value.trim().toLowerCase();
      if (!q) {
        suggestionsBox.innerHTML = '';
        suggestionsBox.classList.add('hidden');
        return;
      }

      const matches = students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.barcode||'').toLowerCase().includes(q) ||
        (s.phone||'').includes(q)
      );

      if (!matches.length) {
        suggestionsBox.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:12px;text-align:center">No students found</div>`;
        suggestionsBox.classList.remove('hidden');
        return;
      }

      suggestionsBox.innerHTML = matches.slice(0, 15).map(s => `
        <div class="suggestion-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="checkInBySearch('${s.id}', '${s.name.replace(/'/g, "\\'")}', '${s.barcode||''}')">
          <div>
            <div style="font-weight:600;font-size:13px">${s.name}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${s.level||'—'} · ${s.center||'—'} · Phone: ${s.phone||'—'}</div>
          </div>
          <button class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size:11px">Check In</button>
        </div>`).join('');
      suggestionsBox.classList.remove('hidden');
    };
  }

  // Handle clicking outside suggestions
  document.addEventListener('click', (e) => {
    if (studentSearch && suggestionsBox && e.target !== studentSearch && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });

  window.checkInBySearch = async (studentId, studentName, barcode) => {
    if (studentSearch) studentSearch.value = '';
    if (suggestionsBox) {
      suggestionsBox.innerHTML = '';
      suggestionsBox.classList.add('hidden');
    }

    const res = await window.api.attendance.manualAdd({ sessionId: currentSessionId, studentId });
    const resultArea = el('scan-result-area');

    if (res.success) {
      const s = res.student || { id: studentId, name: studentName, barcode };
      toast(`${s.name} checked in!`, 'success');
      await loadAttTable();
      await showCheckInResult(s, res.record, session.groupId);
      showBlockedStudentWarning(res.blockWarning);
      // Auto-send WhatsApp attendance message
      autoSendWhatsAppAttendance(s.id, currentSessionId);
    } else if (res.student || studentId) {
      await loadAttTable();
      const s = res.student || { id: studentId, name: studentName, barcode };
      const existing = attendanceRecords.find(a => a.studentId === s.id);
      if (existing) {
        await showCheckInResult(s, existing, session.groupId);
        toast(`${s.name} is already present — update homework below`, 'info');
      } else {
        resultArea.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
        toast(res.message, 'error');
      }
    } else {
      resultArea.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
      toast(res.message, 'error');
      await loadAttTable();
    }
    if (barcodeInput) barcodeInput.focus();
  };

  el('btn-manual-add').onclick = () => manualAttAdd();
  el('btn-wa-send-all').onclick = () => batchSendWhatsAppAttendance();
  el('btn-wa-send-absence').onclick = () => batchSendAbsenceNotifications();
  el('btn-export-att').onclick = () => exportAttCSV();

  if (!window._waAttMsgListener) {
    window._waAttMsgListener = true;
    window.api.whatsapp.onMessageSent((record) => {
      if (record.type === 'attendance' && record.sessionId === currentSessionId) {
        updateWaAttIndicator(record.studentId, record.status);
      }
    });
  }
  
  const attSearch = el('att-search');
  if (attSearch) {
    attSearch.value = '';
    attSearch.oninput = () => renderAttTableFiltered();
  }

  await loadAttTable();
}

async function loadAttTable() {
  if (!currentSessionId) return;
  attendanceRecords = await window.api.attendance.bySession(currentSessionId);
  renderAttTableFiltered();
  // Load WhatsApp status indicators for this session
  loadWaAttendanceStatus();
}

function renderAttTableFiltered() {
  const tbody = el('att-tbody');
  const attSearch = el('att-search');
  const q = attSearch ? attSearch.value.toLowerCase().trim() : '';

  const filtered = attendanceRecords.filter(r =>
    !q || r.studentName.toLowerCase().includes(q) || (r.barcode||'').toLowerCase().includes(q)
  );

  el('att-count').textContent = `Attendance (${attendanceRecords.length}${q ? ` · ${filtered.length} matching` : ''})`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${q ? 'No matching records found.' : 'No attendance recorded yet. Start scanning!'}</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((r, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:600">${r.studentName}</td>
      <td><code style="color:var(--accent);font-size:12px">${r.barcode||'—'}</code></td>
      <td style="color:var(--text-secondary);font-size:12px">${formatTime(r.checkInTime)}</td>
      <td>
        <select class="form-select" style="width:110px;padding:4px 8px;font-size:12px" onchange="updateHwStatus('${r.id}',this.value)">
          ${['pending','done','partial','missed','excused'].map(s=>`<option value="${s}" ${r.homeworkStatus===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <input type="text" class="form-input" style="width:140px;padding:4px 8px;font-size:12px" value="${r.homeworkNote||''}" placeholder="Note…"
          onblur="updateHwNote('${r.id}',this.value)" />
      </td>
      <td><span id="wa-att-status-${r.studentId}" class="wa-msg-indicator wa-msg-queued">⏳</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="removeAttRecord('${r.id}')">✕</button>
      </td>
    </tr>`).join('');
}

async function updateHwStatus(id, status) {
  await window.api.attendance.update({ id, homeworkStatus: status });
  const record = attendanceRecords.find(r => r.id === id);
  if (record) {
    record.homeworkStatus = status;
    if (status !== 'pending' && record.studentId && currentSessionId) {
      autoSendWhatsAppHomework(record.studentId, currentSessionId);
    }
  }
  toast('Homework status updated', 'success');
}

async function updateHwNote(id, note) {
  await window.api.attendance.update({ id, homeworkNote: note });
  const record = attendanceRecords.find(r => r.id === id);
  if (record) {
    record.homeworkNote = note;
  }
}

async function removeAttRecord(id) {
  if (!confirmAction('Remove this attendance record?')) return;
  await window.api.attendance.remove(id);
  toast('Record removed', 'success');
  await loadAttTable();
}

async function manualAttAdd() {
  const [students, groups, sessions] = await Promise.all([
    window.api.students.list(), window.api.groups.list(), window.api.sessions.list()
  ]);
  const session = sessions.find(s => s.id === currentSessionId);
  const group = session ? groups.find(g => g.id === session.groupId) : null;
  const groupStudents = group ? students.filter(s => (group.studentIds||[]).includes(s.id)) : students;

  openModal({
    title: 'Manual Attendance',
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">Search by name or barcode to manually mark as present.</p>
      <div class="form-group" style="position:relative">
        <label class="form-label">Search Student Name or Barcode</label>
        <div class="search-box" style="margin-bottom:12px;width:100%">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="manual-student-search" type="text" placeholder="Type student name or barcode…" autocomplete="off" />
        </div>
        <div id="manual-student-list" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-surface)">
          <!-- filled dynamically -->
        </div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>`,
  });

  const searchInput = el('manual-student-search');
  const listContainer = el('manual-student-list');

  const renderList = (filterText = '') => {
    const q = filterText.toLowerCase().trim();
    const filtered = groupStudents.filter(s => 
      !q || s.name.toLowerCase().includes(q) || (s.barcode||'').toLowerCase().includes(q)
    );

    if (!filtered.length) {
      listContainer.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:16px 0;font-size:13px">No students found</p>`;
      return;
    }

    listContainer.innerHTML = filtered.map(s => `
      <div class="suggestion-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer" onclick="selectAndAddManualStudent('${s.id}')">
        <div>
          <div style="font-weight:600;font-size:13px">${s.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">Barcode: ${s.barcode||'—'} · ${s.level||'—'}</div>
        </div>
        <button class="btn btn-primary btn-sm">Add</button>
      </div>`).join('');
  };

  window.selectAndAddManualStudent = async (studentId) => {
    const res = await window.api.attendance.manualAdd({ sessionId: currentSessionId, studentId });
    if (!res.success) {
      toast(res.message, 'error');
      return;
    }
    toast(`${res.student.name} added manually`, 'success');
    closeModal();
    await loadAttTable();
    await showCheckInResult(res.student, res.record, session?.groupId);
    showBlockedStudentWarning(res.blockWarning);
    autoSendWhatsAppAttendance(res.student.id, currentSessionId);
  };

  searchInput.addEventListener('input', () => {
    renderList(searchInput.value);
  });

  renderList();
}

async function exportAttCSV() {
  if (!currentSessionId) return;
  if (!attendanceRecords.length) { toast('No records to export', 'error'); return; }
  const headers = ['#','Student Name','Barcode','Check-in Time','Homework Status','Note'];
  const rows = attendanceRecords.map((r, i) => [i+1, r.studentName, r.barcode||'', new Date(r.checkInTime).toLocaleString(), r.homeworkStatus, r.homeworkNote||'']);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `attendance_${currentSessionId}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported', 'success');
}

async function getStudentHistoryHtml(studentId, groupId, currentSessionId) {
  const [allSessions, allAttendance] = await Promise.all([
    window.api.sessions.list(),
    window.api.attendance.list()
  ]);

  // Find all sessions for this group, excluding the current session
  // Sort them descending by date
  const groupSessions = allSessions
    .filter(s => s.groupId === groupId && s.id !== currentSessionId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2); // 2 last sessions

  if (!groupSessions.length) {
    return `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center">No previous sessions for this group.</div>`;
  }

  const historyItems = groupSessions.map(sess => {
    // Find if this student has attendance for this session
    const record = allAttendance.find(a => a.sessionId === sess.id && a.studentId === studentId);
    const isPresent = !!record;
    const hwStatus = isPresent ? record.homeworkStatus : null;
    const hwNote = isPresent && record.homeworkNote ? ` (${record.homeworkNote})` : '';

    let badgeClass = 'badge-muted';
    let statusText = 'Absent';
    if (isPresent) {
      statusText = 'Present';
      if (hwStatus === 'done') badgeClass = 'badge-green';
      else if (hwStatus === 'partial' || hwStatus === 'excused') badgeClass = 'badge-yellow';
      else if (hwStatus === 'pending') badgeClass = 'badge-cyan';
      else badgeClass = 'badge-red'; // missed
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-top:6px;background:var(--bg-hover);padding:6px 10px;border-radius:4px;border:1px solid var(--border)">
        <span style="font-weight:600;color:var(--text-secondary)">${sess.date} · ${sess.title}</span>
        <span class="badge ${badgeClass}" style="font-size:10px;padding:2px 6px">
          ${statusText}${isPresent ? ` (HW: ${hwStatus}${hwNote})` : ''}
        </span>
      </div>`;
  }).join('');

  return `
    <div style="margin-top:12px;border-top:1px dashed var(--border);padding-top:10px;width:100%">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">Last 2 Sessions History:</div>
      ${historyItems}
    </div>`;
}

// ── WhatsApp Attendance Helpers ───────────────────────────────────────────────

async function autoSendWhatsAppAttendance(studentId, sessionId) {
  try {
    const settings = await window.api.whatsapp.getSettings();
    if (!settings.autoSendAttendance) return;
    const status = await window.api.whatsapp.status();
    if (status.status !== 'connected') return;

    const res = await window.api.whatsapp.sendAttendance({ studentId, sessionId });
    if (res.success) {
      updateWaAttIndicator(studentId, 'queued');
    } else if (res.duplicate) {
      updateWaAttIndicator(studentId, 'sent');
    } else if (res.record?.status === 'no_phone') {
      updateWaAttIndicator(studentId, 'no_phone');
    }
  } catch (e) {
    console.error('WhatsApp auto-send error:', e);
  }
}

async function autoSendWhatsAppHomework(studentId, sessionId) {
  try {
    const settings = await window.api.whatsapp.getSettings();
    if (!settings.autoSendHomework) return;
    const status = await window.api.whatsapp.status();
    if (status.status !== 'connected') return;

    await window.api.whatsapp.sendHomework({ studentId, sessionId });
  } catch (e) {
    console.error('WhatsApp homework auto-send error:', e);
  }
}

async function batchSendWhatsAppAttendance() {
  if (!currentSessionId) return;
  const status = await window.api.whatsapp.status();
  if (status.status !== 'connected') {
    toast('WhatsApp is not connected. Go to WhatsApp page to connect.', 'error');
    return;
  }
  if (!attendanceRecords.length) {
    toast('No attendance records to send', 'error');
    return;
  }

  const res = await window.api.whatsapp.sendSessionBatch({ sessionId: currentSessionId, type: 'session_summary' });
  if (res.success) {
    toast(`📱 Queued ${res.queued} message${res.queued !== 1 ? 's' : ''}${res.skipped ? ` (${res.skipped} skipped)` : ''}`, 'success');
    loadWaAttendanceStatus();
  } else {
    toast(res.error || 'Failed to queue messages', 'error');
  }
}

async function batchSendAbsenceNotifications() {
  if (!currentSessionId) return;
  const status = await window.api.whatsapp.status();
  if (status.status !== 'connected') {
    toast('WhatsApp is not connected. Go to WhatsApp page to connect.', 'error');
    return;
  }

  // Get session info to check group
  const [sessions, groups, students, attendance] = await Promise.all([
    window.api.sessions.list(),
    window.api.groups.list(),
    window.api.students.list(),
    window.api.attendance.bySession(currentSessionId)
  ]);

  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) { toast('Session not found', 'error'); return; }

  const group = groups.find(g => g.id === session.groupId);
  if (!group || !group.studentIds || !group.studentIds.length) {
    toast('No group assigned to this session or group has no students', 'error');
    return;
  }

  const attendedIds = new Set(attendance.map(a => a.studentId));
  const absentStudents = group.studentIds
    .map(id => students.find(s => s.id === id))
    .filter(s => s && !attendedIds.has(s.id));

  if (!absentStudents.length) {
    toast('All group students are present! No absence messages needed.', 'success');
    return;
  }

  // Confirm before sending
  const absentNames = absentStudents.map(s => s.name).join(', ');
  if (!confirmAction(`Send absence notifications for ${absentStudents.length} student(s)?\n\n${absentNames}`)) return;

  const res = await window.api.whatsapp.sendAbsenceBatch({ sessionId: currentSessionId });
  if (res.success) {
    toast(`📵 Queued ${res.queued} absence message${res.queued !== 1 ? 's' : ''}${res.skipped ? ` (${res.skipped} skipped)` : ''}`, 'success');
  } else {
    toast(res.error || 'Failed to send absence messages', 'error');
  }
}

function updateWaAttIndicator(studentId, status) {
  const el = document.getElementById(`wa-att-status-${studentId}`);
  if (!el) return;
  const map = {
    'sent': { cls: 'wa-msg-sent', text: '✅' },
    'failed': { cls: 'wa-msg-failed', text: '❌' },
    'queued': { cls: 'wa-msg-queued', text: '⏳' },
    'no_phone': { cls: 'wa-msg-nophone', text: '⚠️' },
  };
  const s = map[status] || map['queued'];
  el.className = `wa-msg-indicator ${s.cls}`;
  el.textContent = s.text;
}

function showBlockedStudentWarning(blockWarning) {
  if (!blockWarning) return;
  openModal({
    title: 'Blocked Student',
    body: `
      <div style="padding:12px 14px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.08);border-radius:8px">
        <div style="font-weight:700;color:var(--red);font-size:14px;margin-bottom:6px">${blockWarning.studentName} is blocked</div>
        <div style="color:var(--text-secondary);font-size:13px;line-height:1.6;white-space:pre-wrap">${blockWarning.reason || 'No reason recorded'}</div>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Leave Block</button>
      <button class="btn btn-danger" onclick="removeStudentBlockFromAttendance('${blockWarning.studentId}')">Remove Block</button>`,
  });
}

window.removeStudentBlockFromAttendance = async function(studentId) {
  await window.api.students.unblock(studentId);
  toast('Block removed', 'success');
  closeModal();
};

async function loadWaAttendanceStatus() {
  if (!currentSessionId) return;
  try {
    const waStatus = await window.api.whatsapp.getSessionStatus(currentSessionId);
    if (!waStatus || !waStatus.statusMap) return;
    for (const [key, msg] of Object.entries(waStatus.statusMap)) {
      if (key.endsWith('_attendance')) {
        const studentId = key.replace('_attendance', '');
        updateWaAttIndicator(studentId, msg.status);
      }
    }
  } catch (e) {
    console.error('Failed to load WA attendance status:', e);
  }
}
