// ── Students ─────────────────────────────────────────────────────────────────
let studentsData = [];
let studentsLookup = null;

async function renderStudents() {
  const [students, levels, centers, groups] = await Promise.all([
    window.api.students.list(), window.api.levels.list(), window.api.centers.list(), window.api.groups.list()
  ]);
  studentsData = students;
  studentsLookup = buildStudentsLookup(students, groups);

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
      <button class="btn btn-secondary" onclick="exportStudentsExcel()" title="Export to Excel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="btn btn-secondary" onclick="generateMissingBarcodes()" title="Generate Missing Barcodes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M3 5v14M21 5v14M8 5v14M12 5v14M16 5v14"/></svg>
      </button>
      <select class="form-select" id="bulk-action-select" style="width:140px; display:none;">
        <option value="">Bulk Actions</option>
        <option value="group">Assign Group</option>
        <option value="level">Update Level</option>
        <option value="center">Update Center</option>
      </select>
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
            <tr>
              <th style="width:30px"><input type="checkbox" id="selectAllStudents" onchange="toggleAllStudents(this)" /></th>
              <th>#</th><th>Name</th><th>Barcode</th><th>Phone</th><th>Level</th><th>Center</th><th>Discount</th><th>Groups</th><th>Registered</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="students-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderStudentsTable(students, groups, studentsLookup);
  el('btn-add-student').addEventListener('click', () => openStudentModal(null, levels, centers, groups));
  el('student-search').addEventListener('input', () => filterStudents(groups));
  el('student-level-filter').addEventListener('change', () => filterStudents(groups));
  el('student-center-filter').addEventListener('change', () => filterStudents(groups));
  el('student-property-filter').addEventListener('change', () => filterStudents(groups));
  el('bulk-action-select')?.addEventListener('change', (e) => handleBulkAction(e.target.value, levels, centers, groups));
}

let selectedStudentIds = new Set();

window.toggleAllStudents = function(checkbox) {
  const checkboxes = document.querySelectorAll('.student-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checkbox.checked;
    if (checkbox.checked) selectedStudentIds.add(cb.value);
    else selectedStudentIds.delete(cb.value);
  });
  updateBulkActionsVisibility();
};

window.toggleStudent = function(checkbox) {
  if (checkbox.checked) selectedStudentIds.add(checkbox.value);
  else selectedStudentIds.delete(checkbox.value);
  const allChecked = document.querySelectorAll('.student-checkbox:not(:checked)').length === 0;
  el('selectAllStudents').checked = allChecked;
  updateBulkActionsVisibility();
};

function updateBulkActionsVisibility() {
  const select = el('bulk-action-select');
  if (select) {
    select.style.display = selectedStudentIds.size > 0 ? '' : 'none';
    select.value = ''; // Reset
  }
}

function normalizeStudentPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function buildStudentsLookup(students, groups) {
  const parentPhoneCounts = new Map();
  const parentPhoneLevelCounts = new Map();
  const groupsByStudent = new Map();

  (students || []).forEach(student => {
    const parentPhone = normalizeStudentPhone(student.parentPhone);
    if (parentPhone) {
      parentPhoneCounts.set(parentPhone, (parentPhoneCounts.get(parentPhone) || 0) + 1);
      const levelKey = `${parentPhone}::${student.level || ''}`;
      parentPhoneLevelCounts.set(levelKey, (parentPhoneLevelCounts.get(levelKey) || 0) + 1);
    }
  });

  (groups || []).forEach(group => {
    (group.studentIds || []).forEach(studentId => {
      if (!groupsByStudent.has(studentId)) groupsByStudent.set(studentId, []);
      groupsByStudent.get(studentId).push(group);
    });
  });

  return { parentPhoneCounts, parentPhoneLevelCounts, groupsByStudent };
}

function getStudentPropertyMeta(student, allStudents, groups, lookup = null) {
  if (lookup) {
    const parentPhone = normalizeStudentPhone(student.parentPhone);
    const levelKey = `${parentPhone}::${student.level || ''}`;
    return {
      hasSiblings: !!parentPhone && (lookup.parentPhoneCounts.get(parentPhone) || 0) > 1,
      hasTwins: !!parentPhone && !!student.level && (lookup.parentPhoneLevelCounts.get(levelKey) || 0) > 1,
      groupCount: (lookup.groupsByStudent.get(student.id) || []).length,
    };
  }

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

function studentMatchesPropertyFilter(student, prop, allStudents, groups, lookup = null) {
  if (!prop) return true;
  const meta = getStudentPropertyMeta(student, allStudents, groups, lookup);
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

function renderStudentsTable(students, groups, lookup = null) {
  const tbody = el('students-tbody');
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">No students found.</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map((s, i) => {
    // Find groups this student belongs to
    const studentGroups = lookup
      ? (lookup.groupsByStudent.get(s.id) || [])
      : (groups || []).filter(g => (g.studentIds || []).includes(s.id));
    const groupBadges = studentGroups.length
      ? studentGroups.map(g => `<span class="badge badge-purple" style="margin:1px 2px;font-size:10px">${g.name}</span>`).join('')
      : '<span style="color:var(--text-muted)">—</span>';

    return `
    <tr>
      <td><input type="checkbox" class="student-checkbox" value="${s.id}" ${selectedStudentIds.has(s.id) ? 'checked' : ''} onchange="toggleStudent(this)" /></td>
      <td style="color:var(--text-muted)">${i+1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;color:white">${s.name[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${s.name} ${s.isBlocked ? '<span style="color:var(--red);margin-left:4px">●</span>' : ''}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.email||''}</div>
          </div>
        </div>
      </td>
      <td>
        ${s.barcode
          ? `<code style="color:var(--accent);font-size:12px;background:var(--bg-hover);padding:2px 8px;border-radius:4px">${s.barcode}</code>`
          : `<button class="btn btn-secondary btn-sm" onclick="generateBarcode('${s.id}')">Generate</button>`}
      </td>
      <td style="color:var(--text-secondary)">${s.phone||'—'}</td>
      <td><span class="badge badge-cyan">${s.level||'—'}</span></td>
      <td style="color:var(--text-secondary)">${s.center||'—'}</td>
      <td>${formatStudentDiscount(s)}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:2px;max-width:180px">${groupBadges}</div></td>
      <td style="color:var(--text-muted);font-size:12px">${formatDate(s.createdAt)}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-secondary btn-sm" onclick="viewStudentProfile('${s.id}')">Profile</button>
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
  const lookup = groups ? (studentsLookup || buildStudentsLookup(studentsData, grps)) : buildStudentsLookup(studentsData, grps);
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
    studentMatchesPropertyFilter(s, prop, studentsData, grps, lookup)
  );
  renderStudentsTable(filtered, grps, lookup);
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
  if (res.blockNotification?.status === 'queued') {
    toast('Student blocked and parent message queued', 'success');
  } else if (res.blockNotification?.reason === 'missing_parent_phone') {
    toast('Student blocked, but no parent phone was saved', 'warning');
  } else {
    toast('Student blocked', 'success');
  }
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

window.deleteStudent = async function(id) {
  if (!confirmAction('Delete this student?')) return;
  await window.api.students.delete(id);
  selectedStudentIds.delete(id);
  toast('Student deleted', 'success');
  await renderStudents();
};

function formatStudentDiscount(s) {
  if (!s.hasDiscount) return '<span style="color:var(--text-muted)">None</span>';
  return `<span class="badge badge-yellow">-${s.discountPercent || 0}%</span>`;
}

// ── Phase 3: Export & Barcodes ──
async function exportStudentsExcel() {
  const q = el('student-search').value.toLowerCase();
  const lvl = el('student-level-filter').value;
  const ctr = el('student-center-filter').value;
  const prop = el('student-property-filter')?.value || '';
  const groups = await window.api.groups.list();
  const lookup = buildStudentsLookup(studentsData, groups);
  const filtered = studentsData.filter(s =>
    (!q || s.name.toLowerCase().includes(q) || (s.barcode||'').toLowerCase().includes(q) || (s.phone||'').toLowerCase().includes(q) || (s.parentPhone||'').toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q) || (s.notes||'').toLowerCase().includes(q)) &&
    (!lvl || s.level === lvl) && (!ctr || s.center === ctr) && studentMatchesPropertyFilter(s, prop, studentsData, groups, lookup)
  );
  if (!filtered.length) return toast('No students to export', 'error');

  const rows = filtered.map(s => {
    const studentGroups = (lookup.groupsByStudent.get(s.id) || []).map(g => g.name).join(', ');
    return {
      name: s.name, barcode: s.barcode || '', phone: s.phone || '', parentPhone: s.parentPhone || '',
      level: s.level || '', center: s.center || '', discount: s.hasDiscount ? (s.discountPercent + '%') : '0%',
      groups: studentGroups, email: s.email || '', notes: s.notes || '',
      registered: s.createdAt.slice(0, 10),
      status: s.isBlocked ? `Blocked (${s.blockReason})` : 'Active'
    };
  });
  const cols = [
    { key: 'name', label: 'Name' }, { key: 'barcode', label: 'Barcode' }, { key: 'phone', label: 'Phone' },
    { key: 'parentPhone', label: 'Parent Phone' }, { key: 'level', label: 'Level' }, { key: 'center', label: 'Center' },
    { key: 'groups', label: 'Groups' }, { key: 'discount', label: 'Discount' }, { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' }, { key: 'registered', label: 'Registered' }, { key: 'notes', label: 'Notes' }
  ];
  const res = await window.api.export.excel({ sheetName: 'Students', columns: cols, rows, filename: 'Students_Export.xlsx' });
  if (res?.success) toast('Exported successfully', 'success');
  else if (res && !res.canceled) toast(res.error || 'Export failed', 'error');
}

async function generateBarcode(id) {
  const res = await window.api.students.generateBarcode(id);
  if (res.success) {
    toast('Barcode generated', 'success');
    renderStudents();
  } else {
    toast(res.message, 'error');
  }
}

async function generateMissingBarcodes() {
  if (!confirmAction('Generate random barcodes for all students missing one?')) return;
  const res = await window.api.students.bulkGenerateBarcodes();
  if (res.success) {
    toast(`Generated ${res.count} barcodes`, 'success');
    renderStudents();
  } else {
    toast(res.message, 'error');
  }
}

// ── Phase 3: Bulk Actions ──
async function handleBulkAction(action, levels, centers, groups) {
  const select = el('bulk-action-select');
  if (!action || selectedStudentIds.size === 0) { select.value = ''; return; }
  const studentIds = [...selectedStudentIds];

  if (action === 'group') {
    openModal({
      title: `Assign ${studentIds.length} Students to Group`,
      body: `<select id="bulk-group-id" class="form-select"><option value="">— Select Group —</option>${groups.map(g => `<option value="${g.id}">${g.name} (${g.level || 'Any'} / ${g.center || 'Any'})</option>`).join('')}</select>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-group">Assign</button>`
    });
    el('btn-bulk-group').addEventListener('click', async () => {
      const groupId = el('bulk-group-id').value;
      if (!groupId) return;
      const res = await window.api.students.bulkAssignGroup({ studentIds, groupId });
      if (res.success) { toast(`Assigned ${res.count} students`, 'success'); selectedStudentIds.clear(); el('selectAllStudents').checked = false; closeModal(); renderStudents(); }
    });
  } else if (action === 'level') {
    openModal({
      title: `Update Level for ${studentIds.length} Students`,
      body: `<select id="bulk-level-id" class="form-select"><option value="">— Select Level —</option>${levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-level">Update</button>`
    });
    el('btn-bulk-level').addEventListener('click', async () => {
      const levelId = el('bulk-level-id').value;
      if (!levelId) return;
      const levelName = levels.find(l => l.id === levelId)?.name || '';
      const res = await window.api.students.bulkUpdateLevel({ studentIds, levelId, levelName });
      if (res.success) { toast(`Updated ${res.count} students`, 'success'); selectedStudentIds.clear(); el('selectAllStudents').checked = false; closeModal(); renderStudents(); }
    });
  } else if (action === 'center') {
    openModal({
      title: `Update Center for ${studentIds.length} Students`,
      body: `<select id="bulk-center-id" class="form-select"><option value="">— Select Center —</option>${centers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-center">Update</button>`
    });
    el('btn-bulk-center').addEventListener('click', async () => {
      const centerId = el('bulk-center-id').value;
      if (!centerId) return;
      const centerName = centers.find(c => c.id === centerId)?.name || '';
      const res = await window.api.students.bulkUpdateCenter({ studentIds, centerId, centerName });
      if (res.success) { toast(`Updated ${res.count} students`, 'success'); selectedStudentIds.clear(); el('selectAllStudents').checked = false; closeModal(); renderStudents(); }
    });
  }

  // Reset dropdown
  select.value = '';
}

// ── Phase 3: Comprehensive Profile Timeline ──
window.viewStudentProfile = async function(id) {
  const res = await window.api.students.timeline(id);
  if (!res.success) return toast(res.message, 'error');
  const { student: s, events } = res;

  const getEventIcon = (type) => {
    switch (type) {
      case 'attendance': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.1);color:var(--green);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>';
      case 'quiz': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(139,92,246,0.1);color:var(--purple);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>';
      case 'payment': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.1);color:var(--primary);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>';
      case 'whatsapp': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(34,197,94,0.1);color:var(--green);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>';
      case 'block': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(239,68,68,0.1);color:var(--red);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>';
      case 'unblock': return '<div style="width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.1);color:var(--green);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></div>';
      default: return '<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-hover);color:var(--text-secondary);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>';
    }
  };

  const timelineHtml = events.length ? events.map(e => `
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="padding-top:2px;">${getEventIcon(e.type)}</div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <strong style="font-size:13px;color:var(--text-main)">${e.title}</strong>
          <span style="font-size:11px;color:var(--text-muted)">${formatDate(e.date)}</span>
        </div>
        ${e.detail ? `<div style="font-size:12px;color:var(--text-secondary)">${e.detail}</div>` : ''}
      </div>
    </div>
  `).join('') : '<div style="text-align:center;padding:24px;color:var(--text-muted)">No history available for this student.</div>';

  openModal({
    title: `Student Profile`,
    wide: true,
    body: `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;background:var(--bg-card-alt);padding:16px;border-radius:12px;border:1px solid var(--border)">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;flex-shrink:0;color:white;box-shadow:0 4px 12px rgba(139,92,246,0.25)">${s.name[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px">${s.name} ${s.isBlocked ? '<span class="badge badge-red">Blocked</span>' : ''}</div>
          <div style="color:var(--text-secondary);margin-top:2px;display:flex;gap:12px;font-size:13px">
            <span>${s.level||'No Level'}</span>
            <span style="color:var(--border)">|</span>
            <span>${s.center||'No Center'}</span>
            <span style="color:var(--border)">|</span>
            <span>📞 ${s.phone||'N/A'}</span>
            ${s.parentPhone ? `<span style="color:var(--border)">|</span><span>👪 ${s.parentPhone}</span>` : ''}
          </div>
          <div style="margin-top:8px"><code style="color:var(--accent);font-size:12px;background:var(--bg-hover);padding:3px 8px;border-radius:6px;border:1px solid rgba(99,102,241,0.2)">${s.barcode || 'NO BARCODE'}</code></div>
        </div>
      </div>

      ${s.isBlocked ? `
        <div style="margin-bottom:20px;padding:12px 16px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.05);border-radius:8px">
          <div style="font-weight:600;color:var(--red);font-size:13px;margin-bottom:4px;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Blocked
          </div>
          <div style="color:var(--text-main);font-size:13px;white-space:pre-wrap">${s.blockReason || 'No reason provided'}</div>
        </div>` : ''}

      <div style="margin-bottom:20px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)">History Timeline</h3>
        <div style="max-height:400px;overflow-y:auto;padding-right:8px;" class="custom-scrollbar">
          ${timelineHtml}
        </div>
      </div>`,
    footer: `
      ${s.isBlocked
        ? `<button class="btn btn-secondary" onclick="unblockStudent('${s.id}')">Remove Block</button>`
        : `<button class="btn btn-danger" onclick="openBlockStudentModal('${s.id}', '${s.name.replace(/'/g, "\\'")}')">Block Student</button>`}
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>`,
  });
};
