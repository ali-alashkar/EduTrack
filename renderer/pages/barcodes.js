// ── Barcodes ──────────────────────────────────────────────────────────────────

function renderBarcodes() {
  el('page-barcodes').innerHTML = `
    <div class="page-header">
      <div><h2>Barcode Generator</h2><p class="page-header-sub">Generate and print barcodes for student ID cards</p></div>
      <button class="btn btn-primary" id="btn-print-barcodes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
        Print Barcodes
      </button>
    </div>
    
    <div class="card" style="padding: 24px; margin-bottom: 24px;">
      <div class="form-row" style="align-items: flex-end; grid-template-columns: 1fr 1fr 1fr 1fr;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Template</label>
          <select id="bc-template" class="form-select">
            <option value="id-card">Student ID Card</option>
            <option value="sticker">Small Sticker</option>
            <option value="simple">Simple Barcode</option>
            <option value="custom">Custom Image Background</option>
          </select>
        </div>
        <div class="form-group" id="custom-bg-group" style="display: none; margin-bottom: 0;">
          <label class="form-label">Background Image</label>
          <input type="file" id="bc-custom-bg" class="form-input" accept="image/*" style="padding: 6px 12px;" />
        </div>
        <div class="form-group" id="prefix-group" style="margin-bottom: 0;">
          <label class="form-label">Barcode Prefix</label>
          <input id="bc-prefix" class="form-input" placeholder="e.g. STU-" value="STU-" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Number of Barcodes</label>
          <input id="bc-count" type="number" class="form-input" value="10" min="1" max="100" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <button class="btn btn-secondary btn-full" id="btn-generate-barcodes">Generate Random</button>
        </div>
      </div>
      
      <div id="custom-position-group" style="display: none; margin-top: 16px; padding: 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;">
        <label style="display:block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Barcode Position Tuning</label>
        <div style="display: flex; gap: 24px;">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
              <span>Horizontal (X)</span> <span style="color:var(--accent); font-weight:bold;"><span id="pos-x-val">50</span>%</span>
            </div>
            <input type="range" id="bc-pos-x" min="0" max="100" value="50" style="width: 100%; cursor: pointer;" />
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
              <span>Vertical (Y)</span> <span style="color:var(--accent); font-weight:bold;"><span id="pos-y-val">85</span>%</span>
            </div>
            <input type="range" id="bc-pos-y" min="0" max="100" value="85" style="width: 100%; cursor: pointer;" />
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <label class="form-label">Or generate specific barcode</label>
        <div style="display:flex; gap:10px;">
          <input id="bc-specific" class="form-input" placeholder="Enter specific ID (e.g. STU-12345)" style="flex:1" />
          <button class="btn btn-secondary" id="btn-add-specific">Add to Grid</button>
        </div>
      </div>
    </div>
    
    <div id="barcodes-grid" style="display: flex; flex-wrap: wrap; gap: 20px;">
    </div>
  `;

  let barcodeCounter = 0;
  let customBgDataUrl = '';

  el('bc-template').addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    el('custom-bg-group').style.display = isCustom ? 'block' : 'none';
    el('prefix-group').style.display = isCustom ? 'none' : 'block';
    el('custom-position-group').style.display = isCustom ? 'block' : 'none';
    
    // We repurpose the grid layout space for the custom file input by hiding prefix
    if (isCustom && !customBgDataUrl) {
      toast('Please upload a background image first.', 'info');
    }
  });

  el('bc-pos-x').addEventListener('input', (e) => {
    el('pos-x-val').textContent = e.target.value;
    document.querySelectorAll('.custom-bc-wrapper').forEach(w => w.style.left = e.target.value + '%');
  });

  el('bc-pos-y').addEventListener('input', (e) => {
    el('pos-y-val').textContent = e.target.value;
    document.querySelectorAll('.custom-bc-wrapper').forEach(w => w.style.top = e.target.value + '%');
  });

  el('bc-custom-bg').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        customBgDataUrl = evt.target.result;
        toast('Custom background loaded!', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  function addBarcodeToGrid(code) {
    const grid = el('barcodes-grid');
    const template = el('bc-template').value;
    const id = `bc-${barcodeCounter++}`;
    const div = document.createElement('div');
    
    // Add a remove button (hidden when printing)
    const removeBtn = `<button class="no-print" style="position: absolute; top: 4px; right: 8px; background: rgba(0,0,0,0.1); border: none; color: #333; cursor: pointer; font-size: 14px; width: 24px; height: 24px; border-radius: 50%; z-index: 10;" onclick="this.parentElement.remove()">✕</button>`;

    if (template === 'id-card') {
      div.className = 'card bc-item';
      div.style = 'width: 320px; height: 200px; background: #fff; position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #ccc; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.1); flex-shrink: 0;';
      div.innerHTML = `
        ${removeBtn}
        <div style="background: #6366f1; color: #fff; padding: 12px 16px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
          <span>EduTrack</span>
          <span style="font-size: 12px; font-weight: 500; opacity: 0.9;">Student ID</span>
        </div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px;">
          <svg id="${id}"></svg>
        </div>
        <div style="background: #f8f9fa; color: #666; padding: 8px 16px; font-size: 11px; border-top: 1px solid #eee; text-align: center;">
          Please present this card for attendance scan
        </div>
      `;
    } else if (template === 'sticker') {
      div.className = 'card bc-item';
      div.style = 'padding: 10px; text-align: center; background: #fff; position: relative; width: 180px; border-radius: 6px; border: 2px dashed #aaa; flex-shrink: 0;';
      div.innerHTML = `
        ${removeBtn}
        <div style="font-size: 11px; color: #444; margin-bottom: 4px; font-weight: 800; letter-spacing: 0.5px;">EduTrack ID</div>
        <svg id="${id}"></svg>
      `;
    } else if (template === 'custom') {
      const bg = customBgDataUrl ? `url('${customBgDataUrl}') center/cover no-repeat` : '#e2e8f0';
      const posX = el('bc-pos-x').value;
      const posY = el('bc-pos-y').value;
      
      div.className = 'card bc-item';
      div.style = `width: 320px; height: 200px; background: ${bg}; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #ccc; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`;
      div.innerHTML = `
        ${removeBtn}
        <div class="custom-bc-wrapper" style="position: absolute; left: ${posX}%; top: ${posY}%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.9); padding: 5px 10px; border-radius: 8px; display: inline-block;">
          <svg id="${id}"></svg>
        </div>
      `;
    } else {
      div.className = 'card bc-item';
      div.style = 'padding: 20px; text-align: center; background: #fff; position: relative; border: 1px solid #ddd; flex-shrink: 0;';
      div.innerHTML = `
        ${removeBtn}
        <svg id="${id}"></svg>
      `;
    }

    grid.appendChild(div);
    
    try {
      if (typeof JsBarcode === 'undefined') {
        toast('Barcode library is loading, please wait.', 'error');
        return;
      }
      JsBarcode(`#${id}`, code, {
        format: "CODE128",
        width: template === 'sticker' ? 1.5 : 2,
        height: template === 'sticker' ? 40 : 60,
        displayValue: true,
        fontSize: template === 'sticker' ? 12 : 16,
        margin: 0
      });
    } catch(e) {
      console.error("Barcode gen error", e);
    }
  }

  el('btn-generate-barcodes').addEventListener('click', () => {
    const prefix = el('bc-prefix').value.trim();
    const count = parseInt(el('bc-count').value, 10) || 10;
    
    el('barcodes-grid').innerHTML = ''; // clear previous randomly generated ones
    
    for (let i = 0; i < count; i++) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const code = `${prefix}${rand}`;
      addBarcodeToGrid(code);
    }
  });

  el('btn-add-specific').addEventListener('click', () => {
    const val = el('bc-specific').value.trim();
    if (!val) {
      toast('Please enter a specific ID', 'error');
      return;
    }
    addBarcodeToGrid(val);
    el('bc-specific').value = '';
  });

  el('btn-print-barcodes').addEventListener('click', () => {
    const gridHtml = el('barcodes-grid').innerHTML;
    if (!gridHtml) {
      toast('Please generate barcodes first', 'error');
      return;
    }
    
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; margin: 0; background: #fff; }
            .grid { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 20px; 
              justify-content: flex-start;
            }
            .bc-item {
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
            .no-print { display: none !important; }
            @media print {
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="grid">${gridHtml}</div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  });
  
  // We can try to generate immediately, but JsBarcode might still be downloading from CDN
  // Use a small timeout or rely on the user to click
  setTimeout(() => el('btn-generate-barcodes').click(), 500);
}
