let importPreviewData = { valid: [], invalid: [] };

async function renderImport() {
  el('page-import').innerHTML = `
    <div class="page-header">
      <div><h2>Import Data</h2><p class="page-header-sub">Bulk import students from Excel or CSV files</p></div>
    </div>
    
    <div class="card" style="max-width:800px; margin:0 auto; padding: 24px; text-align: center;">
      <div style="margin-bottom: 24px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" style="width: 64px; height: 64px; margin-bottom: 16px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <h3 style="font-size: 18px; margin-bottom: 8px;">Upload Student List</h3>
        <p style="color: var(--text-muted); font-size: 14px; max-width: 400px; margin: 0 auto;">
          Import a list of students from an Excel (.xlsx, .xls) or .csv file. The first row must be headers.
        </p>
      </div>
      
      <div style="background: var(--bg-card-alt); border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13px;">
        <strong style="display:block; margin-bottom: 8px;">Supported Column Headers:</strong>
        <ul style="color: var(--text-secondary); margin-left: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <li><code>name</code> (Required)</li>
          <li><code>barcode</code></li>
          <li><code>phone</code></li>
          <li><code>parentPhone</code></li>
          <li><code>grade</code> or <code>level</code></li>
          <li><code>center</code></li>
          <li><code>discount</code> (%)</li>
        </ul>
      </div>

      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
        <button id="btn-download-template" class="btn btn-secondary" style="font-size: 16px; padding: 12px 24px;">
          Download Template
        </button>
        <button id="btn-select-file" class="btn btn-primary" style="font-size: 16px; padding: 12px 24px;">
          Select File to Import
        </button>
      </div>
    </div>
    
    <div id="import-preview-section" style="display:none; margin-top: 24px;"></div>
  `;

  el('btn-select-file').addEventListener('click', handleSelectFile);
  el('btn-download-template').addEventListener('click', handleDownloadTemplate);
}

async function handleDownloadTemplate() {
  const btn = el('btn-download-template');
  btn.disabled = true;
  btn.innerText = 'Preparing...';

  const res = await window.api.import.studentsTemplate();
  if (res?.success) {
    toast('Template saved successfully', 'success');
  } else if (res && !res.canceled) {
    toast(res.error || 'Failed to save template', 'error');
  }

  btn.disabled = false;
  btn.innerText = 'Download Template';
}

async function handleSelectFile() {
  const res = await window.api.import.studentsPreview();
  if (res.canceled) return;
  if (!res.success) {
    toast(res.error || 'Failed to read file', 'error');
    return;
  }

  importPreviewData = { valid: res.valid || [], invalid: res.invalid || [] };
  renderImportPreview(res.total);
}

function renderImportPreview(totalRows) {
  const previewSection = el('import-preview-section');
  previewSection.style.display = 'block';
  
  const validCount = importPreviewData.valid.length;
  const invalidCount = importPreviewData.invalid.length;

  previewSection.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 16px;">
        <div>
          <h3 style="font-size: 16px;">Import Preview</h3>
          <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
            Found ${totalRows} rows. <span style="color: var(--green); font-weight: 600;">${validCount} valid</span>, <span style="color: var(--red); font-weight: 600;">${invalidCount} skipped</span>.
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="btn-cancel-import" class="btn btn-secondary">Cancel</button>
          <button id="btn-commit-import" class="btn btn-primary" ${validCount === 0 ? 'disabled' : ''}>
            Import ${validCount} Students
          </button>
        </div>
      </div>
      
      ${invalidCount > 0 ? `
        <div class="alert alert-error" style="margin-bottom: 16px;">
          <strong>${invalidCount} row(s) cannot be imported:</strong>
          <ul style="margin-top: 8px; margin-left: 20px; font-size: 13px;">
            ${importPreviewData.invalid.slice(0, 5).map(inv => `<li>Row ${inv.rowNum}: ${inv.reason}</li>`).join('')}
            ${invalidCount > 5 ? `<li>...and ${invalidCount - 5} more.</li>` : ''}
          </ul>
        </div>
      ` : ''}

      ${validCount > 0 ? `
        <h4 style="font-size: 14px; margin-bottom: 12px;">Valid Rows (Previewing first 100)</h4>
        <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
          <table>
            <thead style="position: sticky; top: 0; background: var(--bg-card); z-index: 1;">
              <tr><th>Row</th><th>Name</th><th>Barcode</th><th>Phone</th><th>Parent Phone</th><th>Grade / Level</th><th>Center</th><th>Discount</th></tr>
            </thead>
            <tbody>
              ${importPreviewData.valid.slice(0, 100).map(v => `
                <tr>
                  <td style="color: var(--text-muted)">${v.rowNum}</td>
                  <td style="font-weight: 600">${v.name}</td>
                  <td style="font-family: monospace; color: var(--text-secondary)">${v.barcode || '—'}</td>
                  <td>${v.phone || '—'}</td>
                  <td>${v.parentPhone || '—'}</td>
                  <td>${v.levelName ? `<span class="badge badge-cyan">${v.levelName}</span>` : '—'}</td>
                  <td>${v.centerName || '—'}</td>
                  <td>${v.hasDiscount ? `<span class="badge badge-accent">${v.discountPercent}%</span>` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="text-align: center; color: var(--text-muted); padding: 24px;">No valid rows found to import.</p>'}
    </div>
  `;

  if (el('btn-cancel-import')) {
    el('btn-cancel-import').addEventListener('click', () => {
      importPreviewData = { valid: [], invalid: [] };
      previewSection.style.display = 'none';
      el('btn-select-file').innerText = 'Select File to Import';
    });
  }

  if (el('btn-commit-import')) {
    el('btn-commit-import').addEventListener('click', async () => {
      const btn = el('btn-commit-import');
      btn.disabled = true;
      btn.innerText = 'Importing...';
      
      const res = await window.api.import.studentsCommit({ rows: importPreviewData.valid });
      if (res.success) {
        toast(`Successfully imported ${res.created} students`, 'success');
        showImportCompletionNotice(res);
        importPreviewData = { valid: [], invalid: [] };
      } else {
        toast(res.error || 'Import failed', 'error');
        btn.disabled = false;
        btn.innerText = `Import ${importPreviewData.valid.length} Students`;
      }
    });
  }
}

function showImportCompletionNotice(res) {
  const previewSection = el('import-preview-section');
  const createdLevels = res.createdLevels || [];
  const createdCenters = res.createdCenters || [];
  const updatedCenters = res.updatedCenters || [];

  const levelNames = createdLevels.map(l => l.name).join(', ');
  const centerNames = createdCenters.map(c => c.name).join(', ');
  const updatedCenterText = updatedCenters.map(c => `${c.name} (${c.grade})`).join(', ');

  previewSection.style.display = 'block';
  previewSection.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0 0 6px 0;color:var(--text-primary);">🎉 Import Completed Successfully!</h3>
          <p style="margin:0;color:var(--text-secondary);font-size:13px;">Imported <strong>${res.created || 0}</strong> students.</p>
        </div>
        <button class="btn btn-primary" onclick="navigate('students')">
          Go to Students Page →
        </button>
      </div>
      ${res.needsCompletion ? `
        <div class="alert alert-warning" style="margin-top:16px;margin-bottom:0;">
          <strong>Setup data needs review:</strong>
          <div style="margin-top:6px;font-size:13px;line-height:1.6;">
            ${levelNames ? `<div>New grades/levels added: <strong>${levelNames}</strong>.</div>` : ''}
            ${centerNames ? `<div>New centers added: <strong>${centerNames}</strong>.</div>` : ''}
            ${updatedCenterText ? `<div>Centers assigned new grades: <strong>${updatedCenterText}</strong>.</div>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
