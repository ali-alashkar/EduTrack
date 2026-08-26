// ── Students ─────────────────────────────────────────────────────────────────
let studentsData = [];
let studentsLookup = null;
let _studentsCheckboxDelegationHandler = null;

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
      <select class="form-select" id="bulk-action-select" style="width:170px;" disabled>
        <option value="">Bulk Actions</option>
        <option value="group">Assign Group</option>
        <option value="move-group">Move to Group</option>
        <option value="level">Update Level</option>
        <option value="center">Update Center</option>
        <option value="note">Add Note</option>
        <option value="whatsapp">WhatsApp Announcement</option>
        <option value="whatsapp-report">WhatsApp Performance Report</option>
        <option value="block">Block Students</option>
        <option value="unblock">Remove Block</option>
        <option value="delete">Delete Students</option>
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
    <div class="bulk-selection-bar hidden" id="student-selection-bar">
      <div>
        <strong id="student-selection-count">0 selected</strong>
        <span>Use Shift + click to select a range.</span>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" onclick="clearStudentSelection()">Clear</button>
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
  el('student-search').addEventListener('input', debounce(() => filterStudents(groups), 150));
  el('student-level-filter').addEventListener('change', () => filterStudents(groups));
  el('student-center-filter').addEventListener('change', () => filterStudents(groups));
  el('student-property-filter').addEventListener('change', () => filterStudents(groups));
  el('bulk-action-select')?.addEventListener('change', (e) => handleBulkAction(e.target.value, levels, centers, groups));

  // Event delegation for ALL student checkboxes — attached once, removed first to avoid duplicates
  // Uses 'click' (not 'change') because Electron fires 'change' on checkbox only after blur
  const pageEl = el('page-students');
  if (_studentsCheckboxDelegationHandler) {
    pageEl.removeEventListener('click', _studentsCheckboxDelegationHandler);
  }
  _studentsCheckboxDelegationHandler = function(e) {
    const cb = e.target && e.target.closest('input.student-checkbox');
    if (cb) {
      toggleStudent(cb, e);
    }
  };
  pageEl.addEventListener('click', _studentsCheckboxDelegationHandler);

  // Ensure bulk action dropdown reflects current selection after full page re-render
  updateBulkActionsVisibility();
}

let selectedStudentIds = new Set();

function setStudentCheckboxSelected(checkbox, checked) {
  if (!checkbox) return;
  checkbox.checked = checked;
  checkbox.closest?.('tr')?.classList.toggle('row-selected', checked);
  const val = String(checkbox.value || '');
  if (!val) return;
  if (checked) {
    selectedStudentIds.add(val);
  } else {
    selectedStudentIds.delete(val);
  }
}

window.toggleAllStudents = function(checkbox) {
  const isChecked = checkbox ? checkbox.checked : false;
  const checkboxes = document.querySelectorAll('.student-checkbox');
  checkboxes.forEach(cb => {
    setStudentCheckboxSelected(cb, isChecked);
  });
  updateBulkActionsVisibility();
};

let lastCheckedStudentCheckbox = null;

function syncStudentSelectionControls() {
  const checkboxes = Array.from(document.querySelectorAll('.student-checkbox'));
  
  // Keep each visible checkbox in sync with selectedStudentIds
  checkboxes.forEach(cb => {
    const val = String(cb.value || '');
    const isSel = !!val && selectedStudentIds.has(val);
    cb.checked = isSel;
    cb.closest?.('tr')?.classList.toggle('row-selected', isSel);
  });

  const selectAllEl = el('selectAllStudents');
  if (selectAllEl) {
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    selectAllEl.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllEl.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  const bar = el('student-selection-bar');
  const count = el('student-selection-count');
  if (bar && count) {
    const total = selectedStudentIds.size;
    count.textContent = `${total} selected`;
    bar.classList.toggle('hidden', total === 0);
  }
}

window.toggleStudent = function(checkbox, event) {
  if (!checkbox) return;
  
  if (event && event.shiftKey && lastCheckedStudentCheckbox && document.body.contains(lastCheckedStudentCheckbox)) {
    const checkboxes = Array.from(document.querySelectorAll('.student-checkbox'));
    const start = checkboxes.indexOf(checkbox);
    const end = checkboxes.indexOf(lastCheckedStudentCheckbox);
    
    if (start !== -1 && end !== -1) {
      const slice = checkboxes.slice(Math.min(start, end), Math.max(start, end) + 1);
      slice.forEach(cb => {
        setStudentCheckboxSelected(cb, checkbox.checked);
      });
    } else {
      setStudentCheckboxSelected(checkbox, checkbox.checked);
    }
  } else {
    setStudentCheckboxSelected(checkbox, checkbox.checked);
  }
  
  lastCheckedStudentCheckbox = checkbox;

  updateBulkActionsVisibility();
};

function updateBulkActionsVisibility() {
  const select = el('bulk-action-select');
  if (select) {
    const hasSelection = selectedStudentIds.size > 0;
    select.disabled = !hasSelection;
    if (select.removeAttribute && select.setAttribute) {
      if (hasSelection) {
        select.removeAttribute('disabled');
      } else {
        select.setAttribute('disabled', '');
      }
    }
    if (!hasSelection) select.value = '';
    select._syncSearchableSelect?.();
  }
  syncStudentSelectionControls();
}

window.clearStudentSelection = function() {
  selectedStudentIds.clear();
  lastCheckedStudentCheckbox = null;
  document.querySelectorAll('.student-checkbox').forEach(cb => {
    cb.checked = false;
    cb.closest?.('tr')?.classList.remove('row-selected');
  });
  updateBulkActionsVisibility();
};

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
    updateBulkActionsVisibility();
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

    const studentIdStr = String(s?.id || '');
    const isSelected = !!studentIdStr && selectedStudentIds.has(studentIdStr);
    return `
    <tr class="${isSelected ? 'row-selected' : ''}">
      <td><input type="checkbox" class="student-checkbox" value="${studentIdStr}" ${isSelected ? 'checked' : ''} /></td>
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
  updateBulkActionsVisibility();
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
async function completeBulkStudentAction(res, successMessage) {
  if (!res?.success) {
    toast(res?.message || res?.error || 'Bulk action failed', 'error');
    return;
  }
  toast(successMessage(res), 'success');
  selectedStudentIds.clear();
  lastCheckedStudentCheckbox = null;
  const selectAll = el('selectAllStudents');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  closeModal();
  await renderStudents();
}

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
      await completeBulkStudentAction(res, r => `Assigned ${r.count} students`);
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
      await completeBulkStudentAction(res, r => `Updated ${r.count} students`);
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
      await completeBulkStudentAction(res, r => `Updated ${r.count} students`);
    });
  } else if (action === 'block') {
    openModal({
      title: `Block ${studentIds.length} Students`,
      body: `
        <div class="form-group">
          <label class="form-label">Reason *</label>
          <textarea id="bulk-block-reason" class="form-textarea" placeholder="Write why these students are blocked..."></textarea>
        </div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-danger" id="btn-bulk-block">Block</button>`
    });
    el('btn-bulk-block').addEventListener('click', async () => {
      const reason = el('bulk-block-reason').value.trim();
      if (!reason) { toast('Block reason is required', 'error'); return; }
      const res = await window.api.students.bulkBlock({ studentIds, reason });
      await completeBulkStudentAction(res, r => `Blocked ${r.count} students`);
    });
  } else if (action === 'unblock') {
    if (!confirmAction(`Remove block from ${studentIds.length} selected students?`)) { select.value = ''; return; }
    const res = await window.api.students.bulkUnblock({ studentIds });
    await completeBulkStudentAction(res, r => `Removed block from ${r.count} students`);
  } else if (action === 'delete') {
    if (!confirmAction(`Delete ${studentIds.length} selected students? This also removes their attendance, quizzes, payments, block history, and messages.`)) { select.value = ''; return; }
    const res = await window.api.students.bulkDelete({ studentIds });
    await completeBulkStudentAction(res, r => `Deleted ${r.count} students`);
  } else if (action === 'move-group') {
    openModal({
      title: `Move ${studentIds.length} Students to Group`,
      body: `
        <div class="form-group">
          <label class="form-label">From Group (optional — leave blank to just add)</label>
          <select id="bulk-from-group-id" class="form-select"><option value="">— Any / None —</option>${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label class="form-label">To Group *</label>
          <select id="bulk-to-group-id" class="form-select"><option value="">— Select Target Group —</option>${groups.map(g => `<option value="${g.id}">${g.name} (${g.level || 'Any'} / ${g.center || 'Any'})</option>`).join('')}</select>
        </div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-move-group">Move</button>`
    });
    el('btn-bulk-move-group').addEventListener('click', async () => {
      const fromGroupId = el('bulk-from-group-id').value || null;
      const toGroupId = el('bulk-to-group-id').value;
      if (!toGroupId) { toast('Please select a target group', 'error'); return; }
      const res = await window.api.students.bulkMoveGroup({ studentIds, fromGroupId, toGroupId });
      await completeBulkStudentAction(res, r => `Moved ${r.count} students`);
    });
  } else if (action === 'note') {
    openModal({
      title: `Add Note to ${studentIds.length} Students`,
      body: `
        <div class="form-group">
          <label class="form-label">Note *</label>
          <textarea id="bulk-note-text" class="form-textarea" placeholder="Write note to append to selected students…" rows="4"></textarea>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Note will be appended to each student's existing notes with today's date.</p>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-note">Add Note</button>`
    });
    el('btn-bulk-note').addEventListener('click', async () => {
      const note = el('bulk-note-text').value.trim();
      if (!note) { toast('Note text is required', 'error'); return; }
      const res = await window.api.students.bulkNote({ studentIds, note });
      await completeBulkStudentAction(res, r => `Added note to ${r.count} students`);
    });
  } else if (action === 'whatsapp') {
    openModal({
      title: `Send WhatsApp Announcement to ${studentIds.length} Students' Parents`,
      body: `
        <div class="form-group">
          <label class="form-label">Message *</label>
          <textarea id="bulk-wa-message" class="form-textarea" placeholder="Write the announcement message…" rows="5"></textarea>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Will be sent to each selected student's parent phone (students without a parent phone will be skipped).</p>
        <div id="bulk-wa-error" class="alert alert-error hidden"></div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="btn-bulk-wa" style="background:#25D366;border-color:#25D366">📱 Queue Messages</button>`
    });
    el('btn-bulk-wa').addEventListener('click', async () => {
      const errEl = el('bulk-wa-error');
      errEl.classList.add('hidden');
      const message = el('bulk-wa-message').value.trim();
      if (!message) { errEl.textContent = 'Message is required.'; errEl.classList.remove('hidden'); return; }
      const allStudents = studentsData.filter(s => studentIds.includes(s.id));
      const eligible = allStudents.filter(s => s.parentPhone);
      const skipped = allStudents.length - eligible.length;
      if (!eligible.length) { errEl.textContent = 'None of the selected students have a parent phone.'; errEl.classList.remove('hidden'); return; }

      let queued = 0;
      for (const s of eligible) {
        try {
          await window.api.payments.queueReminder({ studentId: s.id, customMessage: message });
          queued++;
        } catch (_) {}
      }
      closeModal();
      selectedStudentIds.clear();
      lastCheckedStudentCheckbox = null;
      toast(`Queued ${queued} messages${skipped > 0 ? ` (${skipped} skipped — no parent phone)` : ''}`, 'success');
      await renderStudents();
    });
  } else if (action === 'whatsapp-report') {
    const allStudents = studentsData.filter(s => studentIds.includes(s.id));
    const eligible = allStudents.filter(s => s.parentPhone || s.phone);
    const skipped = allStudents.length - eligible.length;

    if (!eligible.length) {
      alert('None of the selected students have a phone or parent phone saved.');
      select.value = '';
      return;
    }

    openModal({
      title: `Send Performance Reports via WhatsApp`,
      body: `
        <p>You are about to queue performance report messages for <strong>${eligible.length} student(s)</strong>.</p>
        ${skipped > 0 ? `<p style="color:var(--yellow)">⚠️ ${skipped} student(s) will be skipped because they have no phone number saved.</p>` : ''}
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px">Note: Messages will be added to the WhatsApp queue and sent with standard anti-ban delays in the background.</p>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-bulk-wa-report" style="background:#25D366;border-color:#25D366">📱 Queue Reports</button>
      `
    });

    el('btn-bulk-wa-report').addEventListener('click', async () => {
      let queued = 0;
      for (const s of eligible) {
        try {
          const res = await window.api.whatsapp.queueReport({ studentId: s.id });
          if (res.success) queued++;
        } catch (e) {
          console.error(`Failed to queue report for ${s.name}:`, e);
        }
      }
      closeModal();
      selectedStudentIds.clear();
      lastCheckedStudentCheckbox = null;
      toast(`Queued ${queued} performance report(s)${skipped > 0 ? ` (${skipped} skipped — no phone)` : ''}`, 'success');
      await renderStudents();
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
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;background:var(--bg-card-alt);padding:16px;border-radius:12px;border:1px solid var(--border)">
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

      <!-- Barcode Visual + WhatsApp Send -->
      <div style="margin-bottom:24px;padding:20px;background:var(--bg-card-alt);border-radius:12px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:14px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);align-self:flex-start">Student Barcode</div>
        ${s.barcode
          ? `<div style="background:#fff;padding:16px 24px;border-radius:10px;border:1px solid #e5e7eb;display:inline-block">
               <svg id="profile-barcode-svg"></svg>
             </div>
             <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center">
               <code style="color:var(--text-secondary);font-size:13px;letter-spacing:1px">${s.barcode}</code>
               ${(s.phone || s.parentPhone)
                 ? `<button id="btn-send-barcode-wa" class="btn" style="background:#25D366;border-color:#25D366;color:#fff;display:flex;align-items:center;gap:7px;font-size:13px;padding:7px 16px;border-radius:8px;font-weight:600;transition:opacity .15s">
                      <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                      Send on WhatsApp
                    </button>`
                 : `<span style="font-size:12px;color:var(--red);background:rgba(239,68,68,0.08);padding:4px 10px;border-radius:6px">No phone — cannot send</span>`}
             </div>`
          : `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin:0 auto 8px;display:block;opacity:0.35"><path d="M3 5v14M21 5v14M8 5v14M12 5v14M16 5v14"/></svg>
               No barcode assigned yet
             </div>`}
      </div>

      <!-- History Analysis + Send Report -->
      <div id="profile-report-section" style="margin-bottom:24px;padding:20px;background:var(--bg-card-alt);border-radius:12px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary)">Performance Report</div>
          ${(s.phone || s.parentPhone)
            ? `<button id="btn-send-report-wa" class="btn" style="background:#128C7E;border-color:#128C7E;color:#fff;display:flex;align-items:center;gap:7px;font-size:12px;padding:6px 14px;border-radius:8px;font-weight:600">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                 📊 Send Report on WhatsApp
               </button>`
            : `<span style="font-size:12px;color:var(--red)">No phone — cannot send</span>`}
        </div>
        <div id="profile-report-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div style="background:var(--bg-hover);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--accent)" id="rstat-sessions">—</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Sessions Attended</div>
          </div>
          <div style="background:var(--bg-hover);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--green)" id="rstat-hw">—</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">HW Completion</div>
          </div>
          <div style="background:var(--bg-hover);border-radius:10px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--purple)" id="rstat-quiz">—</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Avg Quiz Score</div>
          </div>
        </div>
        <div id="rstat-performance" style="margin-top:12px;text-align:center;font-size:13px;font-weight:600;color:var(--text-secondary)"></div>
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
        : `<button class="btn btn-danger" onclick="openBlockStudentModal('${s.id}', '${s.name.replace(/'/g, "\\''")}')">Block Student</button>`}
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>`,
  });

  // Render the barcode SVG + report stats after the modal DOM exists
  setTimeout(() => {
    // ── Barcode SVG ──
    if (s.barcode) {
      const svgEl = document.getElementById('profile-barcode-svg');
      if (svgEl && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(svgEl, s.barcode, {
            format: 'CODE128',
            width: 2,
            height: 70,
            displayValue: true,
            fontSize: 14,
            margin: 4,
            background: '#ffffff',
            lineColor: '#111827',
          });
        } catch (e) {
          console.error('Profile barcode render error:', e);
        }
      }

      // Wire up the barcode WhatsApp send button
      const waBtnEl = document.getElementById('btn-send-barcode-wa');
      if (waBtnEl) {
        waBtnEl.addEventListener('click', async () => {
          waBtnEl.disabled = true;
          waBtnEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Sending…`;
          const res = await window.api.whatsapp.sendBarcode({ studentId: s.id });
          if (res.success) {
            toast('Barcode sent on WhatsApp ✓', 'success');
            waBtnEl.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px"><polyline points="20 6 9 17 4 12"/></svg>
              Sent!`;
          } else {
            toast(res.error || 'Failed to send barcode', 'error');
            waBtnEl.disabled = false;
            waBtnEl.innerHTML = `
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
              Send on WhatsApp`;
          }
        });
      }
    }

    // ── Report Stats (computed from already-loaded events) ──
    const attendanceEvents = events.filter(e => e.type === 'attendance');
    const quizEvents       = events.filter(e => e.type === 'quiz');

    // Sessions attended
    const totalSessions = attendanceEvents.length;
    const rstatSessions = document.getElementById('rstat-sessions');
    if (rstatSessions) rstatSessions.textContent = totalSessions;

    // HW completion
    const hwEvents  = attendanceEvents.filter(e => e.detail && !e.detail.includes('pending'));
    const hwDone    = hwEvents.filter(e => e.detail && e.detail.includes('done')).length;
    const hwPct     = hwEvents.length > 0 ? Math.round((hwDone / hwEvents.length) * 100) : null;
    const rstatHw   = document.getElementById('rstat-hw');
    if (rstatHw) rstatHw.textContent = hwPct !== null ? `${hwPct}%` : 'N/A';

    // Avg quiz score (parse "Score: X/Y" from detail)
    let quizAvgText = 'N/A';
    if (quizEvents.length > 0) {
      const scores = quizEvents.map(e => {
        const m = (e.detail || '').match(/Score:\s*([\d.]+)\/([\d.]+)/);
        return m ? { s: parseFloat(m[1]), max: parseFloat(m[2]) } : null;
      }).filter(Boolean);
      if (scores.length > 0) {
        const avgPct = Math.round(scores.reduce((sum, q) => sum + (q.s / q.max) * 100, 0) / scores.length);
        const lastMax = scores[scores.length - 1].max;
        quizAvgText = `${((avgPct / 100) * lastMax).toFixed(1)}/${lastMax}`;
      }
    }
    const rstatQuiz = document.getElementById('rstat-quiz');
    if (rstatQuiz) rstatQuiz.textContent = quizAvgText;

    // Performance summary label
    let perfPct = 0; let perfFactors = 0;
    if (hwPct !== null) { perfPct += hwPct; perfFactors++; }
    if (quizEvents.length > 0) {
      const scores = quizEvents.map(e => {
        const m = (e.detail || '').match(/Score:\s*([\d.]+)\/([\d.]+)/);
        return m ? (parseFloat(m[1]) / parseFloat(m[2])) * 100 : null;
      }).filter(n => n !== null);
      if (scores.length) { perfPct += scores.reduce((a, b) => a + b, 0) / scores.length; perfFactors++; }
    }
    const overallPct = perfFactors > 0 ? perfPct / perfFactors : 0;
    const perfLabel =
      overallPct >= 90 ? '🌟 ممتاز / Excellent' :
      overallPct >= 75 ? '✅ جيد جداً / Very Good' :
      overallPct >= 60 ? '📈 جيد / Good' :
      overallPct >= 40 ? '⚠️ مقبول / Acceptable' :
      perfFactors > 0  ? '❗ يحتاج متابعة / Needs Attention' : '—';
    const rstatPerf = document.getElementById('rstat-performance');
    if (rstatPerf) rstatPerf.textContent = perfLabel;

    // ── Wire up Send Report button ──
    const reportBtnEl = document.getElementById('btn-send-report-wa');
    if (reportBtnEl) {
      reportBtnEl.addEventListener('click', async () => {
        reportBtnEl.disabled = true;
        reportBtnEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Sending…`;
        const res = await window.api.whatsapp.sendReport({ studentId: s.id });
        if (res.success) {
          toast('Performance report sent on WhatsApp ✓', 'success');
          reportBtnEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>
            Report Sent!`;
        } else {
          toast(res.error || 'Failed to send report', 'error');
          reportBtnEl.disabled = false;
          reportBtnEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            📊 Send Report on WhatsApp`;
        }
      });
    }
  }, 80);
};
