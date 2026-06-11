// ── Students ─────────────────────────────────────────────────────────────────
let studentsData = [];

async function renderStudents() {
  const [students, levels, centers, groups] = await Promise.all([
    window.api.students.list(), window.api.levels.list(), window.api.centers.list(), window.api.groups.list()
  ]);
  studentsData = students;

  el('page-students').innerHTML = `
    <div class="page-header">
      <div><h2>Students</h2><p class="page-header-sub">${students.length} registered students</p></div>
      <button class="btn btn-primary" id="btn-add-student">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Register Student
      </button>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="student-search" type="text" placeholder="Search by name, barcode or phone…" />
      </div>
      <select class="form-select" id="student-level-filter" style="width:160px">
        <option value="">All Levels</option>
        ${levels.map(l=>`<option value="${l.name}">${l.name}</option>`).join('')}
      </select>
      <select class="form-select" id="student-center-filter" style="width:160px">
        <option value="">All Centers</option>
        ${centers.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
      </select>
      <select class="form-select" id="student-property-filter" style="width:190px">
        <option value="">All Properties</option>
        <option value="siblings">Siblings</option>
        <option value="twins">Twins / Same Level</option>
        <option value="discount">Has Discount</option>
        <option value="no-discount">No Discount</option>
        <option value="blocked">Blocked</option>
        <option value="active">Not Blocked</option>
        <option value="no-group">No Group</option>
        <option value="has-group">Has Group</option>
        <option value="has-phone">Has Student Phone</option>
        <option value="missing-phone">Missing Student Phone</option>
        <option value="has-parent-phone">Has Parent Phone</option>
        <option value="missing-parent-phone">Missing Parent Phone</option>
        <option value="has-email">Has Email</option>
        <option value="has-notes">Has Notes</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Name</th><th>Barcode</th><th>Phone</th><th>Level</th><th>Center</th><th>Discount</th><th>Groups</th><th>Registered</th><th>Actions</th></tr>
          </thead>
          <tbody id="students-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderStudentsTable(students, groups);
  el('btn-add-student').addEventListener('click', () => openStudentModal(null, levels, centers, groups));
  el('student-search').addEventListener('input', () => filterStudents(groups));
  el('student-level-filter').addEventListener('change', () => filterStudents(groups));
  el('student-center-filter').addEventListener('change', () => filterStudents(groups));
  el('student-property-filter').addEventListener('change', () => filterStudents(groups));
}

function normalizeStudentPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getStudentPropertyMeta(student, allStudents, groups) {
  const parentPhone = normalizeStudentPhone(student.parentPhone);
  const siblings = parentPhone
    ? allStudents.filter(s => s.id !== student.id && normalizeStudentPhone(s.parentPhone) === parentPhone)
    : [];
  const twins = siblings.filter(s => s.level && student.level && s.level === student.level);
  const groupCount = (groups || []).filter(g => (g.studentIds || []).includes(student.id)).length;
  return {
    hasSiblings: siblings.length > 0,
    hasTwins: twins.length > 0,
    groupCount,
  };
}

function studentMatchesPropertyFilter(student, prop, allStudents, groups) {
  if (!prop) return true;
  const meta = getStudentPropertyMeta(student, allStudents, groups);
  const map = {
    siblings: meta.hasSiblings,
    twins: meta.hasTwins,
    discount: !!student.hasDiscount,
    'no-discount': !student.hasDiscount,
    blocked: !!student.isBlocked,
    active: !student.isBlocked,
    'no-group': meta.groupCount === 0,
    'has-group': meta.groupCount > 0,
    'has-phone': !!normalizeStudentPhone(student.phone),
    'missing-phone': !normalizeStudentPhone(student.phone),
    'has-parent-phone': !!normalizeStudentPhone(student.parentPhone),
    'missing-parent-phone': !normalizeStudentPhone(student.parentPhone),
    'has-email': !!String(student.email || '').trim(),
    'has-notes': !!String(student.notes || '').trim(),
  };
  return !!map[prop];
}

function renderStudentsTable(students, groups) {
  const tbody = el('students-tbody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="table-empty">No students found.</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map((s, i) => {
    // Find groups this student belongs to
    const studentGroups = (groups || []).filter(g => (g.studentIds || []).includes(s.id));
    const groupBadges = studentGroups.length
      ? studentGroups.map(g => `<span class="badge badge-purple" style="margin:1px 2px;font-size:10px">${g.name}</span>`).join('')
      : '<span style="color:var(--text-muted)">—</span>';

    return `
    <tr>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">${s.name[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${s.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.email||''}</div>
          </div>
        </div>
      </td>
      <td><code style="color:var(--accent);font-size:12px;background:var(--bg-hover);padding:2px 8px;border-radius:4px">${s.barcode||'—'}</code></td>
      <td style="color:var(--text-secondary)">${s.phone||'—'}</td>
      <td><span class="badge badge-cyan">${s.level||'—'}</span></td>
      <td style="color:var(--text-secondary)">${s.center||'—'}</td>
      <td>${formatStudentDiscount(s)}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:2px;max-width:180px">${groupBadges}</div></td>
      <td style="color:var(--text-muted);font-size:12px">${formatDate(s.createdAt)}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-secondary btn-sm" onclick="viewStudent('${s.id}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="editStudent('${s.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function filterStudents(groups) {
  const q = el('student-search').value.toLowerCase();
  const lvl = el('student-level-filter').value;
  const ctr = el('student-center-filter').value;
  const prop = el('student-property-filter')?.value || '';
  // Refresh groups if not passed
  const grps = groups || await window.api.groups.list();
  const filtered = studentsData.filter(s =>
    (!q ||
      s.name.toLowerCase().includes(q) ||
      (s.barcode||'').toLowerCase().includes(q) ||
      (s.phone||'').toLowerCase().includes(q) ||
      (s.parentPhone||'').toLowerCase().includes(q) ||
      (s.email||'').toLowerCase().includes(q) ||
      (s.notes||'').toLowerCase().includes(q)) &&
    (!lvl || s.level === lvl) &&
    (!ctr || s.center === ctr) &&
    studentMatchesPropertyFilter(s, prop, studentsData, grps)
  );
  renderStudentsTable(filtered, grps);
}

function openStudentModal(student = null, levels = [], centers = [], allGroups = []) {
  // Determine which groups the student is currently in
  const currentGroupIds = student
    ? allGroups.filter(g => (g.studentIds || []).includes(student.id)).map(g => g.id)
    : [];

  openModal({
    title: student ? 'Edit Student' : 'Register Student',
    wide: true,
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input id="st-name" class="form-input" placeholder="Student full name" value="${student?.name||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Barcode / ID *</label>
          <input id="st-barcode" class="form-input" placeholder="Scan or type barcode" value="${student?.barcode||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input id="st-phone" class="form-input" placeholder="Student phone" value="${student?.phone||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Parent Phone</label>
          <input id="st-parent-phone" class="form-input" placeholder="Parent phone" value="${student?.parentPhone||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Level</label>
          <select id="st-level" class="form-select">
            <option value="">— Select Level —</option>
            ${levels.map(l=>`<option value="${l.name}" ${student?.level===l.name?'selected':''}>${l.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Center</label>
          <select id="st-center" class="form-select">
            <option value="">— Select Center —</option>
            ${centers.map(c=>`<option value="${c.name}" ${student?.center===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Group Selection Section -->
      <div class="form-group" id="st-groups-section">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--purple)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Assign to Groups
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);font-size:11px">(filtered by level & center)</span>
        </label>
        <div id="st-groups-hint" style="color:var(--text-muted);font-size:12px;margin-bottom:8px;">
          Select a level and center above to see available groups.
        </div>
        <div id="st-groups-list" class="group-checkbox-list">
          <!-- dynamically filled -->
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">
          <input type="checkbox" id="st-has-discount" ${student?.hasDiscount ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent)" />
          Student has a discount
        </label>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Session fee is set per session. Discount applies to this student when they attend.</p>
      </div>
      <div class="form-group" id="st-discount-wrap" style="${student?.hasDiscount ? '' : 'display:none'}">
        <label class="form-label">Discount Percent (%)</label>
        <input id="st-discount-pct" type="number" class="form-input" min="0" max="100" step="1" placeholder="e.g. 20" value="${student?.discountPercent ?? ''}" />
      </div>
    
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input id="st-dob" type="date" class="form-input" value="${student?.dob||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input id="st-email" class="form-input" placeholder="student@email.com" value="${student?.email||''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="st-notes" class="form-textarea" placeholder="Any notes…">${student?.notes||''}</textarea>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-student-btn">${student ? 'Update' : 'Register'}</button>`,
  });

  // Store allGroups and currentGroupIds for later use
  window._studentModalGroups = allGroups;
  window._studentModalCurrentGroupIds = new Set(currentGroupIds);

  // Function to render filtered groups as checkboxes
  function renderGroupCheckboxes() {
    const selectedLevel = el('st-level').value;
    const selectedCenter = el('st-center').value;
    const container = el('st-groups-list');
    const hint = el('st-groups-hint');

    if (!selectedLevel && !selectedCenter) {
      hint.style.display = '';
      hint.textContent = 'Select a level and center above to see available groups.';
      container.innerHTML = '';
      return;
    }

    // Filter groups by the selected level and center
    const filtered = allGroups.filter(g => {
      const levelMatch = !selectedLevel || g.level === selectedLevel;
      const centerMatch = !selectedCenter || g.center === selectedCenter;
      return levelMatch && centerMatch;
    });

    if (!filtered.length) {
      hint.style.display = '';
      hint.textContent = selectedLevel && selectedCenter
        ? `No groups found for "${selectedLevel}" at "${selectedCenter}".`
        : selectedLevel
          ? `No groups found for level "${selectedLevel}".`
          : `No groups found for center "${selectedCenter}".`;
      container.innerHTML = '';
      return;
    }

    hint.style.display = 'none';
    container.innerHTML = filtered.map(g => {
      const isChecked = window._studentModalCurrentGroupIds.has(g.id);
      const memberCount = (g.studentIds || []).length;
      const capacityInfo = g.capacity ? ` / ${g.capacity}` : '';
      const isFull = g.capacity && memberCount >= parseInt(g.capacity);

      return `
        <label class="group-checkbox-item ${isChecked ? 'checked' : ''} ${isFull && !isChecked ? 'full' : ''}" for="grp-${g.id}">
          <input type="checkbox" id="grp-${g.id}" value="${g.id}"
            ${isChecked ? 'checked' : ''}
            ${isFull && !isChecked ? 'disabled' : ''}
            onchange="toggleGroupCheckbox(this)" />
          <div class="group-checkbox-info">
            <div class="group-checkbox-name">${g.name}</div>
            <div class="group-checkbox-meta">
              ${g.dayOfWeek ? `<span>${g.dayOfWeek}</span>` : ''}
              ${g.time ? `<span>${g.time}</span>` : ''}
              <span class="${isFull && !isChecked ? 'group-full-tag' : ''}">${memberCount}${capacityInfo} students</span>
            </div>
          </div>
          <div class="group-checkbox-indicator">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </label>`;
    }).join('');
  }

  // Toggle visual state on checkbox change
  window.toggleGroupCheckbox = function(checkbox) {
    const label = checkbox.closest('.group-checkbox-item');
    if (checkbox.checked) {
      label.classList.add('checked');
      window._studentModalCurrentGroupIds.add(checkbox.value);
    } else {
      label.classList.remove('checked');
      window._studentModalCurrentGroupIds.delete(checkbox.value);
    }
  };

  // Listen for level/center changes to re-filter groups
  el('st-level').addEventListener('change', renderGroupCheckboxes);
  el('st-center').addEventListener('change', renderGroupCheckboxes);

  // Initial render
  renderGroupCheckboxes();

  const hasDiscountEl = el('st-has-discount');
  const discountWrap = el('st-discount-wrap');
  const discountPctEl = el('st-discount-pct');

  hasDiscountEl.addEventListener('change', () => {
    discountWrap.style.display = hasDiscountEl.checked ? '' : 'none';
  });
 

  el('save-student-btn').addEventListener('click', async () => {
    const name = el('st-name').value.trim();
    const barcode = el('st-barcode').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    if (!barcode) { toast('Barcode/ID is required', 'error'); return; }

    const data = {
      name, barcode, phone: el('st-phone').value.trim(), parentPhone: el('st-parent-phone').value.trim(),
      level: el('st-level').value, center: el('st-center').value,
      dob: el('st-dob').value, email: el('st-email').value.trim(), notes: el('st-notes').value.trim(),
      hasDiscount: hasDiscountEl.checked,
      discountPercent: hasDiscountEl.checked ? Number(discountPctEl.value) || 0 : 0,
      
    };

    // Collect selected group IDs
    const selectedGroupIds = [...window._studentModalCurrentGroupIds];

    let res = student ? await window.api.students.update({ id: student.id, ...data }) : await window.api.students.create(data);
    if (!res.success && res.duplicatePhone) {
      const approved = confirmAction(`${res.message}.\n\nApprove saving this duplicate number?`);
      if (!approved) {
        toast('Student was not saved', 'info');
        return;
      }
      res = student
        ? await window.api.students.update({ id: student.id, ...data, allowDuplicatePhone: true })
        : await window.api.students.create({ ...data, allowDuplicatePhone: true });
    }
    if (!res.success) { toast(res.message, 'error'); return; }

    // Get the student ID (either existing or newly created)
    const studentId = student ? student.id : res.student.id;

    // Sync group memberships
    // First, find which groups the student was previously in
    const previousGroupIds = student
      ? allGroups.filter(g => (g.studentIds || []).includes(student.id)).map(g => g.id)
      : [];

    // Groups to add student to
    const toAdd = selectedGroupIds.filter(gId => !previousGroupIds.includes(gId));
    // Groups to remove student from
    const toRemove = previousGroupIds.filter(gId => !selectedGroupIds.includes(gId));

    // Execute all add/remove operations
    const ops = [
      ...toAdd.map(groupId => window.api.groups.addStudent({ groupId, studentId })),
      ...toRemove.map(groupId => window.api.groups.removeStudent({ groupId, studentId }))
    ];
    await Promise.all(ops);

    const groupChangeMsg = toAdd.length || toRemove.length
      ? ` (${toAdd.length ? `added to ${toAdd.length} group(s)` : ''}${toAdd.length && toRemove.length ? ', ' : ''}${toRemove.length ? `removed from ${toRemove.length} group(s)` : ''})`
      : '';

    toast((student ? 'Student updated' : 'Student registered') + groupChangeMsg, 'success');
    if (res.warning) toast(res.warning, 'info');
    closeModal(); renderStudents();
  });
}

async function viewStudent(id) {
  const [students, attendance, sessions, groups] = await Promise.all([
    window.api.students.list(), window.api.attendance.list(), window.api.sessions.list(), window.api.groups.list()
  ]);
  const s = students.find(st => st.id === id);
  if (!s) return;
  const records = attendance.filter(a => a.studentId === id);
  const attended = records.length;
  const hwDone = records.filter(r => r.homeworkStatus === 'done').length;

  // Groups this student belongs to
  const studentGroups = groups.filter(g => (g.studentIds || []).includes(id));
  const groupsHtml = studentGroups.length
    ? studentGroups.map(g => `
        <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:20px;font-size:12px;color:var(--purple);font-weight:600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${g.name}
          <span style="color:var(--text-muted);font-weight:400">${g.dayOfWeek ? '· ' + g.dayOfWeek : ''} ${g.time || ''}</span>
        </div>`).join('')
    : '<span style="color:var(--text-muted);font-size:12px">Not assigned to any group</span>';

  openModal({
    title: `Student Profile`,
    wide: true,
    body: `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;flex-shrink:0;">${s.name[0].toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px">${s.name} ${s.isBlocked ? '<span class="badge badge-red">Blocked</span>' : ''}</div>
          <div style="color:var(--text-secondary)">${s.level||'—'} · ${s.center||'—'}</div>
          <code style="color:var(--accent);font-size:12px">${s.barcode}</code>
        </div>
      </div>

      ${s.isBlocked ? `
        <div style="margin-bottom:16px;padding:12px 14px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.08);border-radius:8px">
          <div style="font-weight:700;color:var(--red);font-size:13px;margin-bottom:4px">Block reason</div>
          <div style="color:var(--text-secondary);font-size:13px;white-space:pre-wrap">${s.blockReason || 'No reason recorded'}</div>
        </div>` : ''}


      <!-- Groups -->
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-bottom:8px">Assigned Groups</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${groupsHtml}</div>
      </div>

      <div class="form-row" style="margin-bottom:16px">
        <div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--accent)">${attended}</div>
          <div style="color:var(--text-secondary);font-size:12px">Sessions Attended</div>
        </div>
        <div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--green)">${hwDone}</div>
          <div style="color:var(--text-secondary);font-size:12px">Homework Done</div>
        </div>
        <div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--yellow)">${formatStudentDiscount(s)}</div>
          <div style="color:var(--text-secondary);font-size:12px">Discount</div>
        </div>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Session</th>
          <th style="text-align:left;padding:8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Date</th>
          <th style="text-align:left;padding:8px;color:var(--text-muted);border-bottom:1px solid var(--border)">Homework</th>
        </tr></thead>
        <tbody>
          ${records.slice(0,10).map(r => {
            const sess = sessions.find(ss => ss.id === r.sessionId);
            return `<tr>
              <td style="padding:8px;border-bottom:1px solid var(--border)">${sess?.title||r.sessionId}</td>
              <td style="padding:8px;border-bottom:1px solid var(--border);color:var(--text-secondary)">${formatDate(r.checkInTime)}</td>
              <td style="padding:8px;border-bottom:1px solid var(--border)">${hwBadge(r.homeworkStatus)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text-muted)">No attendance yet</td></tr>`}
        </tbody>
      </table>`,
        footer: `
          ${s.isBlocked
            ? `<button class="btn btn-secondary" onclick="unblockStudent('${s.id}')">Remove Block</button>`
            : `<button class="btn btn-danger" onclick="openBlockStudentModal('${s.id}', '${s.name.replace(/'/g, "\\'")}')">Block Student</button>`}
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>`,

  });
}

window.openBlockStudentModal = function(id, name) {
  openModal({
    title: `Block ${name}`,
    body: `
      <div class="form-group">
        <label class="form-label">Reason *</label>
        <textarea id="block-reason" class="form-textarea" placeholder="Write why this student is blocked..."></textarea>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="blockStudent('${id}')">Save Block</button>`,
  });
};

window.blockStudent = async function(id) {
  const reason = el('block-reason')?.value?.trim() || '';
  const res = await window.api.students.block({ id, reason });
  if (!res.success) { toast(res.message || 'Could not block student', 'error'); return; }
  toast('Student blocked', 'success');
  closeModal();
  renderStudents();
};

window.unblockStudent = async function(id) {
  await window.api.students.unblock(id);
  toast('Block removed', 'success');
  closeModal();
  renderStudents();
};



async function editStudent(id) {
  const [students, levels, centers, groups] = await Promise.all([
    window.api.students.list(), window.api.levels.list(), window.api.centers.list(), window.api.groups.list()
  ]);
  const s = students.find(st => st.id === id);
  if (s) openStudentModal(s, levels, centers, groups);
}

function formatStudentDiscount(s) {
  if (!s.hasDiscount) return '<span style="color:var(--text-muted)">None</span>';
  return `<span class="badge badge-yellow">-${s.discountPercent || 0}%</span>`;
}

async function deleteStudent(id) {
  if (!confirmAction('Delete this student? All attendance records will remain.')) return;

  // Also remove the student from all groups
  const groups = await window.api.groups.list();
  const groupsWithStudent = groups.filter(g => (g.studentIds || []).includes(id));
  await Promise.all(groupsWithStudent.map(g => window.api.groups.removeStudent({ groupId: g.id, studentId: id })));

  await window.api.students.delete(id);
  toast('Student deleted', 'success');
  renderStudents();
}
