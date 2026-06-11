// ── Levels ───────────────────────────────────────────────────────────────────
async function renderLevels() {
  const levels = await window.api.levels.list();
  el('page-levels').innerHTML = `
    <div class="page-header">
      <div><h2>Levels</h2><p class="page-header-sub">Manage academic levels (e.g. Grade 1, 2nd Secondary)</p></div>
      <button class="btn btn-primary" id="btn-add-level">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Level
      </button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Description</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody id="levels-tbody">
            ${levels.length ? levels.map((lv, i) => `
              <tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td><span class="badge badge-accent">${lv.name}</span></td>
                <td style="color:var(--text-secondary)">${lv.description||'—'}</td>
                <td style="color:var(--text-muted);font-size:12px">${formatDate(lv.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="editLevel('${lv.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteLevel('${lv.id}')">Delete</button>
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="5" class="table-empty">No levels yet. Add your first level!</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  el('btn-add-level').addEventListener('click', () => openLevelModal());
}

function openLevelModal(level = null) {
  openModal({
    title: level ? 'Edit Level' : 'Add Level',
    body: `
      <div class="form-group">
        <label class="form-label">Level Name *</label>
        <input id="lv-name" class="form-input" placeholder="e.g. 1st Secondary, Grade 5" value="${level?.name||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input id="lv-desc" class="form-input" placeholder="Optional description" value="${level?.description||''}" />
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-level-btn">${level ? 'Update' : 'Create'}</button>`,
  });
  el('save-level-btn').addEventListener('click', async () => {
    const name = el('lv-name').value.trim();
    if (!name) { toast('Level name is required', 'error'); return; }
    const data = { name, description: el('lv-desc').value.trim() };
    const res = level ? await window.api.levels.update({ id: level.id, ...data }) : await window.api.levels.create(data);
    if (!res.success) { toast(res.message, 'error'); return; }
    toast(level ? 'Level updated' : 'Level created', 'success');
    closeModal(); renderLevels();
  });
}

async function editLevel(id) {
  const levels = await window.api.levels.list();
  const level = levels.find(l => l.id === id);
  if (level) openLevelModal(level);
}

async function deleteLevel(id) {
  if (!confirmAction('Delete this level?')) return;
  await window.api.levels.delete(id);
  toast('Level deleted', 'success');
  renderLevels();
}

// ── Centers ──────────────────────────────────────────────────────────────────
async function renderCenters() {
  const [centers, levels] = await Promise.all([window.api.centers.list(), window.api.levels.list()]);
  el('page-centers').innerHTML = `
    <div class="page-header">
      <div><h2>Centers</h2><p class="page-header-sub">Manage teaching centers and assign grades</p></div>
      <button class="btn btn-primary" id="btn-add-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Center
      </button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Location</th><th>Grades / Levels</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${centers.length ? centers.map((c, i) => `
              <tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td style="font-weight:600">${c.name}</td>
                <td style="color:var(--text-secondary)">${c.location||'—'}</td>
                <td><div class="tags">${(c.grades||[]).map(g=>`<span class="badge badge-purple">${g}</span>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div></td>
                <td style="color:var(--text-muted);font-size:12px">${formatDate(c.createdAt)}</td>
                <td>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary btn-sm" onclick="editCenter('${c.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCenter('${c.id}')">Delete</button>
                  </div>
                </td>
              </tr>`).join('') : `<tr><td colspan="6" class="table-empty">No centers yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  el('btn-add-center').addEventListener('click', () => openCenterModal(null, levels));
}

function openCenterModal(center = null, levels = []) {
  const selected = center?.grades || [];
  openModal({
    title: center ? 'Edit Center' : 'Add Center',
    body: `
      <div class="form-group">
        <label class="form-label">Center Name *</label>
        <input id="c-name" class="form-input" placeholder="e.g. Nile Academy" value="${center?.name||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <input id="c-loc" class="form-input" placeholder="City / Address" value="${center?.location||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Contact</label>
        <input id="c-contact" class="form-input" placeholder="Phone / Email" value="${center?.contact||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Assigned Grades / Levels</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${levels.map(lv => `
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px 10px;background:var(--bg-hover);border:1px solid var(--border);border-radius:20px;font-size:12px;">
              <input type="checkbox" class="grade-check" value="${lv.name}" ${selected.includes(lv.name)?'checked':''} style="accent-color:var(--accent)" />
              ${lv.name}
            </label>`).join('')}
        </div>
        ${!levels.length ? '<p style="color:var(--text-muted);font-size:12px;">Add levels first to assign them to centers.</p>' : ''}
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-center-btn">${center ? 'Update' : 'Create'}</button>`,
  });
  el('save-center-btn').addEventListener('click', async () => {
    const name = el('c-name').value.trim();
    if (!name) { toast('Center name is required', 'error'); return; }
    const grades = [...document.querySelectorAll('.grade-check:checked')].map(cb => cb.value);
    const data = { name, location: el('c-loc').value.trim(), contact: el('c-contact').value.trim(), grades };
    const res = center ? await window.api.centers.update({ id: center.id, ...data }) : await window.api.centers.create(data);
    if (!res.success) { toast(res.message, 'error'); return; }
    toast(center ? 'Center updated' : 'Center created', 'success');
    closeModal(); renderCenters();
  });
}

async function editCenter(id) {
  const [centers, levels] = await Promise.all([window.api.centers.list(), window.api.levels.list()]);
  const center = centers.find(c => c.id === id);
  if (center) openCenterModal(center, levels);
}

async function deleteCenter(id) {
  if (!confirmAction('Delete this center?')) return;
  await window.api.centers.delete(id);
  toast('Center deleted', 'success');
  renderCenters();
}
