// ── Groups ────────────────────────────────────────────────────────────────────
let groupsData = [];

async function renderGroups() {
  const [groups, students, levels, centers] = await Promise.all([
    window.api.groups.list(), window.api.students.list(), window.api.levels.list(), window.api.centers.list()
  ]);
  groupsData = groups;

  el('page-groups').innerHTML = `
    <div class="page-header">
      <div><h2>Groups</h2><p class="page-header-sub">Organize students into teaching groups</p></div>
      <button class="btn btn-primary" id="btn-add-group">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Group
      </button>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="group-search" type="text" placeholder="Search by group name…" />
      </div>
      <select class="form-select" id="group-level-filter" style="width:160px">
        <option value="">All Levels</option>
        ${levels.map(l=>`<option value="${l.name}">${l.name}</option>`).join('')}
      </select>
      <select class="form-select" id="group-center-filter" style="width:160px">
        <option value="">All Centers</option>
        ${centers.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Group Name</th><th>Level</th><th>Center</th><th>Day/Time</th><th>Students</th><th>Actions</th></tr></thead>
          <tbody id="groups-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderGroupsTable(groups);
  el('btn-add-group').addEventListener('click', () => openGroupModal(null, levels, centers));
  el('group-search').addEventListener('input', filterGroups);
  el('group-level-filter').addEventListener('change', filterGroups);
  el('group-center-filter').addEventListener('change', filterGroups);
}

function renderGroupsTable(groups) {
  const tbody = el('groups-tbody');
  tbody.innerHTML = groups.length ? groups.map((g, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td style="font-weight:600">${g.name}</td>
      <td><span class="badge badge-cyan">${g.level||'—'}</span></td>
      <td style="color:var(--text-secondary)">${g.center||'—'}</td>
      <td style="color:var(--text-secondary)">${g.dayOfWeek||'—'} ${g.time||''}</td>
      <td><span class="badge badge-accent">${(g.studentIds||[]).length} students</span></td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-secondary btn-sm" onclick="manageGroupStudents('${g.id}')">Members</button>
          <button class="btn btn-secondary btn-sm" onclick="editGroup('${g.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">✕</button>
        </div>
      </td>
    </tr>`).join('') : `<tr><td colspan="7" class="table-empty">No groups yet.</td></tr>`;
}

function filterGroups() {
  const q = el('group-search').value.toLowerCase();
  const lvl = el('group-level-filter').value;
  const ctr = el('group-center-filter').value;
  const filtered = groupsData.filter(g =>
    (!q || g.name.toLowerCase().includes(q)) &&
    (!lvl || g.level === lvl) &&
    (!ctr || g.center === ctr)
  );
  renderGroupsTable(filtered);
}

function openGroupModal(group = null, levels = [], centers = []) {
  const days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
  openModal({
    title: group ? 'Edit Group' : 'New Group',
    body: `
      <div class="form-group">
        <label class="form-label">Group Name *</label>
        <input id="g-name" class="form-input" placeholder="e.g. Group A - Morning" value="${group?.name||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Level</label>
          <select id="g-level" class="form-select">
            <option value="">— Select Level —</option>
            ${levels.map(l=>`<option value="${l.name}" ${group?.level===l.name?'selected':''}>${l.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Center</label>
          <select id="g-center" class="form-select">
            <option value="">— Select Center —</option>
            ${centers.map(c=>`<option value="${c.name}" ${group?.center===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Day</label>
          <select id="g-day" class="form-select">
            <option value="">— Day —</option>
            ${days.map(d=>`<option value="${d}" ${group?.dayOfWeek===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input id="g-time" type="time" class="form-input" value="${group?.time||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Max Capacity</label>
          <input id="g-cap" type="number" class="form-input" placeholder="e.g. 30" value="${group?.capacity||''}" />
        </div>
        <div class="form-group"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="g-notes" class="form-textarea" placeholder="Optional notes">${group?.notes||''}</textarea>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-group-btn">${group ? 'Update' : 'Create'}</button>`,
  });
  el('save-group-btn').addEventListener('click', async () => {
    const name = el('g-name').value.trim();
    if (!name) { toast('Group name is required', 'error'); return; }
    const data = {
      name, level: el('g-level').value, center: el('g-center').value, dayOfWeek: el('g-day').value,
      time: el('g-time').value, capacity: el('g-cap').value, notes: el('g-notes').value.trim()
    };
    const res = group ? await window.api.groups.update({ id: group.id, ...data }) : await window.api.groups.create(data);
    if (!res.success) { toast(res.message, 'error'); return; }
    toast(group ? 'Group updated' : 'Group created', 'success');
    closeModal(); renderGroups();
  });
}

async function editGroup(id) {
  const [groups, levels, centers] = await Promise.all([window.api.groups.list(), window.api.levels.list(), window.api.centers.list()]);
  const group = groups.find(g => g.id === id);
  if (group) openGroupModal(group, levels, centers);
}

async function deleteGroup(id) {
  if (!confirmAction('Delete this group?')) return;
  await window.api.groups.delete(id);
  toast('Group deleted', 'success');
  renderGroups();
}

async function manageGroupStudents(groupId) {
  const [groups, allStudents] = await Promise.all([window.api.groups.list(), window.api.students.list()]);
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const renderMemberList = () => {
    const members = (group.studentIds || []).map(id => allStudents.find(s => s.id === id)).filter(Boolean);
    const nonMembers = allStudents.filter(s => !group.studentIds.includes(s.id));
    el('member-list').innerHTML = members.length ? members.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${s.name[0]}</div>
          <div><div style="font-weight:600;font-size:13px">${s.name}</div><div style="font-size:11px;color:var(--text-muted)">${s.barcode||''}</div></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="removeFromGroup('${groupId}','${s.id}')">Remove</button>
      </div>`).join('') : `<p style="color:var(--text-muted);text-align:center;padding:16px 0">No members yet</p>`;

    el('add-student-select').innerHTML = `<option value="">— Select student to add —</option>` +
      nonMembers.map(s => `<option value="${s.id}">${s.name} (${s.level||'?'})</option>`).join('');
  };

  openModal({
    title: `Members: ${group.name}`,
    wide: true,
    body: `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <select id="add-student-select" class="form-select" style="flex:1"></select>
        <button class="btn btn-primary" id="btn-add-member">Add</button>
      </div>
      <div id="member-list"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Done</button>`,
  });

  renderMemberList();

  el('btn-add-member').addEventListener('click', async () => {
    const studentId = el('add-student-select').value;
    if (!studentId) return;
    await window.api.groups.addStudent({ groupId, studentId });
    const updatedGroups = await window.api.groups.list();
    const g = updatedGroups.find(x => x.id === groupId);
    group.studentIds = g.studentIds;
    toast('Student added to group', 'success');
    renderMemberList();
  });

  window.removeFromGroup = async (gId, sId) => {
    await window.api.groups.removeStudent({ groupId: gId, studentId: sId });
    const updatedGroups = await window.api.groups.list();
    const g = updatedGroups.find(x => x.id === gId);
    group.studentIds = g.studentIds;
    toast('Student removed', 'success');
    renderMemberList();
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────────
let sessionsData = [];

async function renderSessions() {
  const [sessions, groups] = await Promise.all([window.api.sessions.list(), window.api.groups.list()]);
  sessionsData = sessions;

  el('page-sessions').innerHTML = `
    <div class="page-header">
      <div><h2>Sessions</h2><p class="page-header-sub">Schedule and manage teaching sessions</p></div>
      <button class="btn btn-primary" id="btn-add-session">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Session
      </button>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="session-search" type="text" placeholder="Search by title or topic…" />
      </div>
      <select class="form-select" id="session-group-filter" style="width:160px">
        <option value="">All Groups</option>
        ${groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('')}
      </select>
      <select class="form-select" id="session-date-filter" style="width:160px">
        <option value="">All Dates</option>
        <option value="today">Today</option>
        <option value="upcoming">Upcoming</option>
        <option value="past">Past</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Group</th><th>Date</th><th>Time</th><th>Fee</th><th>Topic</th><th>Quiz</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="sessions-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderSessionsTable(sessions, groups);
  el('btn-add-session').addEventListener('click', () => openSessionModal(null, groups));
  el('session-search').addEventListener('input', () => filterSessions(groups));
  el('session-group-filter').addEventListener('change', () => filterSessions(groups));
  el('session-date-filter').addEventListener('change', () => filterSessions(groups));
}

function renderSessionsTable(sessions, groups) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const tbody = el('sessions-tbody');
  
  tbody.innerHTML = sorted.length ? sorted.map((s, i) => {
    const group = groups.find(g => g.id === s.groupId);
    const today = new Date().toISOString().slice(0,10);
    const statusColor = s.date < today ? 'badge-muted' : s.date === today ? 'badge-green' : 'badge-cyan';
    const statusLabel = s.date < today ? 'Past' : s.date === today ? 'Today' : 'Upcoming';
    return `
      <tr>
        <td style="color:var(--text-muted)">${i+1}</td>
        <td style="font-weight:600">${s.title}</td>
        <td><span class="badge badge-purple">${group?.name||'—'}</span></td>
        <td style="color:var(--text-secondary)">${s.date}</td>
        <td style="color:var(--text-secondary)">${s.time||'—'}</td>
        <td style="font-weight:600">${s.sessionFee ? formatSessionMoney(s.sessionFee) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td style="color:var(--text-muted);font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.topic||'—'}</td>
        <td>${s.hasQuiz ? `<span class="badge badge-accent">Max ${s.quizMaxScore||10}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td><span class="badge ${statusColor}">${statusLabel}</span></td>
        <td>
          <div style="display:flex;gap:5px;">
            <button class="btn btn-success btn-sm" onclick="navigate('attendance');setTimeout(()=>selectSessionForAttendance('${s.id}'),200)">Attend</button>
            ${s.hasQuiz ? `<button class="btn btn-secondary btn-sm" onclick="navigate('quizzes');setTimeout(()=>selectSessionForQuizzes('${s.id}'),200)">Quiz</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="editSession('${s.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSession('${s.id}')">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('') : `<tr><td colspan="10" class="table-empty">No sessions found.</td></tr>`;
}

function filterSessions(groups) {
  const q = el('session-search').value.toLowerCase();
  const groupId = el('session-group-filter').value;
  const dateFilter = el('session-date-filter').value;
  const today = new Date().toISOString().slice(0, 10);

  const filtered = sessionsData.filter(s => {
    const queryMatch = !q || s.title.toLowerCase().includes(q) || (s.topic||'').toLowerCase().includes(q);
    const groupMatch = !groupId || s.groupId === groupId;
    
    let dateMatch = true;
    if (dateFilter === 'today') {
      dateMatch = s.date === today;
    } else if (dateFilter === 'upcoming') {
      dateMatch = s.date > today;
    } else if (dateFilter === 'past') {
      dateMatch = s.date < today;
    }

    return queryMatch && groupMatch && dateMatch;
  });

  renderSessionsTable(filtered, groups);
}

function openSessionModal(session = null, groups = []) {
  openModal({
    title: session ? 'Edit Session' : 'New Session',
    wide: true,
    body: `
      <div class="form-group">
        <label class="form-label">Session Title *</label>
        <input id="ss-title" class="form-input" placeholder="e.g. Algebra - Chapter 3" value="${session?.title||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Group *</label>
          <select id="ss-group" class="form-select">
            <option value="">— Select Group —</option>
            ${groups.map(g=>`<option value="${g.id}" ${session?.groupId===g.id?'selected':''}>${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input id="ss-date" type="date" class="form-input" value="${session?.date||new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Time</label>
          <input id="ss-time" type="time" class="form-input" value="${session?.time||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Duration (mins)</label>
          <input id="ss-duration" type="number" class="form-input" placeholder="e.g. 60" value="${session?.duration||''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Session Fee</label>
        <input id="ss-fee" type="number" class="form-input" min="0" step="1" placeholder="e.g. 200" value="${session?.sessionFee ?? ''}" />
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Amount each attending student pays for this session (before individual discounts).</p>
      </div>
      <div class="form-group">
        <label class="form-label">Topic / Lesson</label>
        <input id="ss-topic" class="form-input" placeholder="Topic covered in this session" value="${session?.topic||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Homework Assignment</label>
        <textarea id="ss-hw" class="form-textarea" placeholder="Describe the homework given…">${session?.homework||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">
          <input type="checkbox" id="ss-has-quiz" ${session?.hasQuiz ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent)" />
          This session includes a quiz
        </label>
      </div>
      <div class="form-group" id="ss-quiz-max-wrap" style="${session?.hasQuiz ? '' : 'display:none'}">
        <label class="form-label">Quiz Max Score</label>
        <input id="ss-quiz-max" type="number" class="form-input" placeholder="e.g. 10" value="${session?.quizMaxScore || 10}" min="1" />
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-session-btn">${session ? 'Update' : 'Create'}</button>`,
  });

  const hasQuizCheckbox = el('ss-has-quiz');
  const quizMaxWrap = el('ss-quiz-max-wrap');
  hasQuizCheckbox.addEventListener('change', () => {
    quizMaxWrap.style.display = hasQuizCheckbox.checked ? '' : 'none';
  });

  el('save-session-btn').addEventListener('click', async () => {
    const title = el('ss-title').value.trim();
    const groupId = el('ss-group').value;
    const date = el('ss-date').value;
    if (!title || !groupId || !date) { toast('Title, Group and Date are required', 'error'); return; }
    const hasQuiz = hasQuizCheckbox.checked;
    const quizMaxScore = hasQuiz ? Number(el('ss-quiz-max').value) || 10 : null;
    const data = { title, groupId, date, time: el('ss-time').value, duration: el('ss-duration').value, sessionFee: Number(el('ss-fee').value) || 0, topic: el('ss-topic').value.trim(), homework: el('ss-hw').value.trim(), hasQuiz, quizMaxScore };
    const res = session ? await window.api.sessions.update({ id: session.id, ...data }) : await window.api.sessions.create(data);
    if (!res.success) { toast(res.message, 'error'); return; }
    toast(session ? 'Session updated' : 'Session created', 'success');
    closeModal(); renderSessions();
  });
}

async function editSession(id) {
  const [sessions, groups] = await Promise.all([window.api.sessions.list(), window.api.groups.list()]);
  const session = sessions.find(s => s.id === id);
  if (session) openSessionModal(session, groups);
}

function formatSessionMoney(amount) {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

async function deleteSession(id) {
  if (!confirmAction('Delete this session?')) return;
  await window.api.sessions.delete(id);
  toast('Session deleted', 'success');
  renderSessions();
}
