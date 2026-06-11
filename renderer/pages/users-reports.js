// ── Users (Admin Only) ────────────────────────────────────────────────────────
async function renderUsers() {
  if (State.user?.role !== 'admin') {
    el('page-users').innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><p>Access denied. Admin only.</p></div>`;
    return;
  }
  const users = await window.api.users.list();
  el('page-users').innerHTML = `
    <div class="page-header">
      <div><h2>User Management</h2><p class="page-header-sub">Manage admin and assistant accounts</p></div>
      <button class="btn btn-primary" id="btn-add-user">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add User
      </button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map((u, i) => `
              <tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${u.name[0].toUpperCase()}</div>
                    <span style="font-weight:600">${u.name}</span>
                  </div>
                </td>
                <td><code style="color:var(--accent);font-size:13px">@${u.username}</code></td>
                <td><span class="badge ${u.role==='admin'?'badge-accent':'badge-purple'}">${u.role}</span></td>
                <td style="color:var(--text-muted);font-size:12px">${formatDate(u.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:5px;">
                    <button class="btn btn-secondary btn-sm" onclick="changePassword('${u.id}','${u.name}')">Password</button>
                    ${u.id !== State.user.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button>` : `<span class="badge badge-green">You</span>`}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  el('btn-add-user').addEventListener('click', openAddUserModal);
}

function openAddUserModal() {
  openModal({
    title: 'Add User',
    body: `
      <div class="form-group">
        <label class="form-label">Full Name *</label>
        <input id="u-name" class="form-input" placeholder="John Doe" />
      </div>
      <div class="form-group">
        <label class="form-label">Username *</label>
        <input id="u-username" class="form-input" placeholder="johndoe" />
      </div>
      <div class="form-group">
        <label class="form-label">Password *</label>
        <input id="u-pass" type="password" class="form-input" placeholder="Min 6 chars" />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select id="u-role" class="form-select">
          <option value="assistant">Assistant</option>
          <option value="admin">Admin</option>
        </select>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-user-btn">Create User</button>`,
  });
  el('save-user-btn').addEventListener('click', async () => {
    const name = el('u-name').value.trim();
    const username = el('u-username').value.trim();
    const password = el('u-pass').value;
    const role = el('u-role').value;
    if (!name || !username || !password) { toast('All fields are required', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    const res = await window.api.users.create({ name, username, password, role });
    if (!res.success) { toast(res.message, 'error'); return; }
    toast('User created', 'success');
    closeModal(); renderUsers();
  });
}

function changePassword(id, name) {
  openModal({
    title: `Change Password — ${name}`,
    body: `
      <div class="form-group">
        <label class="form-label">New Password *</label>
        <input id="new-pass" type="password" class="form-input" placeholder="Min 6 characters" />
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password *</label>
        <input id="confirm-pass" type="password" class="form-input" placeholder="Repeat password" />
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-pass-btn">Update Password</button>`,
  });
  el('save-pass-btn').addEventListener('click', async () => {
    const np = el('new-pass').value;
    const cp = el('confirm-pass').value;
    if (!np || np.length < 6) { toast('Password min 6 characters', 'error'); return; }
    if (np !== cp) { toast('Passwords do not match', 'error'); return; }
    await window.api.users.updatePassword({ id, newPassword: np });
    toast('Password updated', 'success');
    closeModal();
  });
}

async function deleteUser(id) {
  if (!confirmAction('Delete this user permanently?')) return;
  await window.api.users.delete(id);
  toast('User deleted', 'success');
  renderUsers();
}

// ── Reports ────────────────────────────────────────────────────────────────────
async function renderReports() {
  const [sessions, students, groups, attendance, levels, centers] = await Promise.all([
    window.api.sessions.list(), window.api.students.list(),
    window.api.groups.list(), window.api.attendance.list(),
    window.api.levels.list(), window.api.centers.list()
  ]);

  el('page-reports').innerHTML = `
    <div class="page-header">
      <div><h2>Reports</h2><p class="page-header-sub">Analyze attendance and homework performance</p></div>
    </div>

    <div class="two-col" style="margin-bottom:20px">
      <!-- Session Report -->
      <div class="card">
        <div class="card-header"><span class="card-title">📅 Session Report</span></div>
        <div class="card-body" style="padding:16px">
          <div class="form-group">
            <label class="form-label">Select Session</label>
            <select id="rep-session-select" class="form-select">
              <option value="">— Choose session —</option>
              ${[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>`<option value="${s.id}">${s.date} · ${s.title}</option>`).join('')}
            </select>
          </div>
          <div id="rep-session-result"></div>
        </div>
      </div>

      <!-- Student Report -->
      <div class="card" style="position:relative">
        <div class="card-header"><span class="card-title">👤 Student Report</span></div>
        <div class="card-body" style="padding:16px">
          <div class="form-group" style="position:relative">
            <label class="form-label">Search / Select Student</label>
            <div class="search-box" style="margin-bottom:0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="rep-student-search" type="text" placeholder="Type name, barcode or phone…" autocomplete="off" />
            </div>
            <div id="rep-student-suggestions" class="suggestions-list hidden"></div>
          </div>
          <div id="rep-student-result"></div>
        </div>
      </div>
    </div>

    <!-- Overview table -->
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <span class="card-title">📊 Group Overview</span>
        <div style="display:flex;gap:8px">
          <select class="form-select" id="rep-group-level-filter" style="width:140px;padding:4px 8px;font-size:12px">
            <option value="">All Levels</option>
            ${levels.map(l=>`<option value="${l.name}">${l.name}</option>`).join('')}
          </select>
          <select class="form-select" id="rep-group-center-filter" style="width:140px;padding:4px 8px;font-size:12px">
            <option value="">All Centers</option>
            ${centers.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Group</th><th>Level</th><th>Center</th><th>Members</th><th>Total Sessions</th><th>Total Attendance</th><th>HW Done</th></tr></thead>
          <tbody id="rep-group-overview-tbody"></tbody>
        </table>
      </div>
    </div>`;

  el('rep-session-select').addEventListener('change', async () => {
    const id = el('rep-session-select').value;
    if (!id) return;
    const res = await window.api.reports.sessionSummary(id);
    const session = sessions.find(s => s.id === id);
    el('rep-session-result').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">
        ${miniStat('Present', res.total, 'var(--accent)')}
        ${miniStat('HW Done', res.homeworkDone, 'var(--green)')}
        ${miniStat('Partial', res.homeworkPartial, 'var(--yellow)')}
        ${miniStat('Missed', res.homeworkMissed, 'var(--red)')}
      </div>
      ${session?.hasQuiz ? `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">
          ${miniStat('Quiz Scored', res.quizScored, 'var(--purple)')}
          ${miniStat('Quiz Avg', res.quizScored ? res.quizAverage + '%' : '—', 'var(--cyan)')}
        </div>` : ''}`;
  });

  const studentSearch = el('rep-student-search');
  const suggestionsBox = el('rep-student-suggestions');

  studentSearch.addEventListener('input', () => {
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
      <div class="suggestion-item" onclick="loadStudentReport('${s.id}', '${s.name.replace(/'/g, "\\'")}')">
        <div style="font-weight:600">${s.name}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${s.level||'—'} · ${s.center||'—'} · Barcode: ${s.barcode||'—'}</div>
      </div>`).join('');
    suggestionsBox.classList.remove('hidden');
  });

  window.loadStudentReport = async (studentId, studentName) => {
    studentSearch.value = studentName;
    suggestionsBox.classList.add('hidden');

    const records = await window.api.reports.studentSummary(studentId);
    const hwDone = records.filter(r => r.homeworkStatus === 'done').length;
    const rate = records.length ? Math.round(hwDone/records.length*100) : 0;
    const quizRecords = records.filter(r => r.quizScore != null);
    const quizAvg = quizRecords.length
      ? Math.round(quizRecords.reduce((sum, r) => sum + (r.quizScore / r.quizMaxScore) * 100, 0) / quizRecords.length)
      : 0;
    el('rep-student-result').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
        ${miniStat('Sessions', records.length, 'var(--accent)')}
        ${miniStat('HW Done', hwDone, 'var(--green)')}
        ${miniStat('HW Rate', rate+'%', 'var(--cyan)')}
        ${miniStat('Quiz Avg', quizRecords.length ? quizAvg+'%' : '—', 'var(--purple)')}
      </div>
      <div style="max-height:180px;overflow-y:auto;margin-top:12px;border: 1px solid var(--border);border-radius:6px;padding:4px 8px;background:var(--bg-surface)">
        ${records.slice(0,8).map(r=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.sessionTitle||r.sessionId}</span>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="color:var(--text-muted)">${r.sessionDate||''}</span>
              ${r.quizScore != null ? `<span class="badge badge-accent">${r.quizScore}/${r.quizMaxScore}</span>` : ''}
              ${hwBadge(r.homeworkStatus)}
            </div>
          </div>`).join('') || `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px">No attendance records</div>`}
      </div>`;
  };

  // Close suggestions on clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== studentSearch && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });

  const renderGroupOverview = () => {
    const lvl = el('rep-group-level-filter').value;
    const ctr = el('rep-group-center-filter').value;
    
    const filteredGroups = groups.filter(g =>
      (!lvl || g.level === lvl) &&
      (!ctr || g.center === ctr)
    );

    el('rep-group-overview-tbody').innerHTML = filteredGroups.map(g => {
      const gSessions = sessions.filter(s => s.groupId === g.id);
      const gAtt = attendance.filter(a => gSessions.some(s => s.id === a.sessionId));
      const hwDone = gAtt.filter(a => a.homeworkStatus === 'done').length;
      const hwRate = gAtt.length ? Math.round(hwDone/gAtt.length*100) : 0;
      return `<tr>
        <td style="font-weight:600">${g.name}</td>
        <td><span class="badge badge-cyan">${g.level||'—'}</span></td>
        <td><span class="badge badge-purple">${g.center||'—'}</span></td>
        <td>${(g.studentIds||[]).length}</td>
        <td>${gSessions.length}</td>
        <td>${gAtt.length}</td>
        <td><span class="badge ${hwRate>=70?'badge-green':hwRate>=40?'badge-yellow':'badge-red'}">${hwRate}%</span></td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="table-empty">No groups match filters</td></tr>`;
  };

  el('rep-group-level-filter').addEventListener('change', renderGroupOverview);
  el('rep-group-center-filter').addEventListener('change', renderGroupOverview);
  renderGroupOverview();
}

function miniStat(label, val, color) {
  return `<div style="background:var(--bg-hover);border-radius:8px;padding:10px;text-align:center">
    <div style="font-size:20px;font-weight:800;color:${color}">${val}</div>
    <div style="font-size:11px;color:var(--text-muted)">${label}</div>
  </div>`;
}
