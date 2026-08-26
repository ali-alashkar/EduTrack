// ── Barcodes ──────────────────────────────────────────────────────────────────

function renderBarcodes() {
  el('page-barcodes').innerHTML = `
    <div class="page-header">
      <div><h2>Barcode Generator</h2><p class="page-header-sub">Generate and print barcodes for student ID cards</p></div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary" id="btn-export-zip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px; margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export ZIP (Images)
        </button>
        <button class="btn btn-primary" id="btn-print-barcodes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
          Print Barcodes
        </button>
      </div>
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
      
      <div id="custom-position-group" style="display: none; margin-top: 16px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;">
        <label style="display:block; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Card Dimensions & Barcode Customizer</label>
        
        <!-- Card Dimensions Row -->
        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--border);">
          <div>
            <label class="form-label" style="font-size: 12px;">Card Size Preset</label>
            <select id="bc-card-preset" class="form-select" style="font-size: 13px; padding: 6px 10px;">
              <option value="320x200">Standard Card (320 × 200 px)</option>
              <option value="325x204">CR80 ID Card (325 × 204 px)</option>
              <option value="400x250">Large ID Card (400 × 250 px)</option>
              <option value="280x175">Compact Card (280 × 175 px)</option>
              <option value="custom">Custom Dimensions</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size: 12px;">Card Length / Width (px)</label>
            <input type="number" id="bc-card-width" class="form-input" value="320" min="100" max="1000" style="font-size: 13px; padding: 6px 10px;" />
          </div>
          <div>
            <label class="form-label" style="font-size: 12px;">Card Height (px)</label>
            <input type="number" id="bc-card-height" class="form-input" value="200" min="100" max="1000" style="font-size: 13px; padding: 6px 10px;" />
          </div>
        </div>

        <!-- Position and Barcode Sizing Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; align-items: center;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Horizontal X</span> <span style="color:var(--accent); font-weight:bold;"><span id="pos-x-val">50</span>%</span>
            </div>
            <input type="range" id="bc-pos-x" min="0" max="100" value="50" style="width: 100%; cursor: pointer;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Vertical Y</span> <span style="color:var(--accent); font-weight:bold;"><span id="pos-y-val">85</span>%</span>
            </div>
            <input type="range" id="bc-pos-y" min="0" max="100" value="85" style="width: 100%; cursor: pointer;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Barcode Height</span> <span style="color:var(--accent); font-weight:bold;"><span id="bc-height-val">50</span>px</span>
            </div>
            <input type="range" id="bc-bar-height" min="20" max="120" value="50" style="width: 100%; cursor: pointer;" />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>Barcode Scale</span> <span style="color:var(--accent); font-weight:bold;"><span id="bc-scale-val">1.8</span>x</span>
            </div>
            <input type="range" id="bc-bar-width" min="1" max="4" step="0.1" value="1.8" style="width: 100%; cursor: pointer;" />
          </div>
        </div>

        <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="bc-bg-badge" checked style="cursor: pointer;" />
          <label for="bc-bg-badge" style="font-size: 12px; cursor: pointer; color: var(--text-secondary);">
            Add semi-transparent white background box around barcode (improves scanner readability on dark images)
          </label>
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
    
    if (isCustom && !customBgDataUrl) {
      toast('Please upload a background image first.', 'info');
    }
  });

  function updateAllCardsInGrid() {
    const template = el('bc-template').value;
    const cardW = el('bc-card-width') ? parseInt(el('bc-card-width').value, 10) || 320 : 320;
    const cardH = el('bc-card-height') ? parseInt(el('bc-card-height').value, 10) || 200 : 200;
    const posX = el('bc-pos-x').value;
    const posY = el('bc-pos-y').value;
    const barHeight = el('bc-bar-height') ? parseInt(el('bc-bar-height').value, 10) : 50;
    const barWidth = el('bc-bar-width') ? parseFloat(el('bc-bar-width').value) : 1.8;
    const showBadge = el('bc-bg-badge') ? el('bc-bg-badge').checked : true;

    document.querySelectorAll('#barcodes-grid .bc-item').forEach(div => {
      if (template === 'custom') {
        div.style.width = cardW + 'px';
        div.style.height = cardH + 'px';
        
        const wrapper = div.querySelector('.custom-bc-wrapper');
        if (wrapper) {
          wrapper.style.left = posX + '%';
          wrapper.style.top = posY + '%';
          wrapper.style.background = showBadge ? 'rgba(255,255,255,0.9)' : 'transparent';
          wrapper.style.padding = showBadge ? '5px 10px' : '0px';
          wrapper.style.borderRadius = showBadge ? '8px' : '0px';
        }
      }
      
      const svgId = div.dataset.svgId;
      const code = div.dataset.code;
      if (svgId && code && typeof JsBarcode !== 'undefined') {
        try {
          JsBarcode(`#${svgId}`, code, {
            format: "CODE128",
            width: template === 'sticker' ? 1.5 : (template === 'custom' ? barWidth : 2),
            height: template === 'sticker' ? 40 : (template === 'custom' ? barHeight : 60),
            displayValue: true,
            fontSize: template === 'sticker' ? 12 : 16,
            margin: 0
          });
        } catch (err) {
          console.error('Error re-rendering barcode:', err);
        }
      }
    });
  }

  el('bc-card-preset').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== 'custom') {
      const parts = val.split('x').map(Number);
      el('bc-card-width').value = parts[0];
      el('bc-card-height').value = parts[1];
    }
    updateAllCardsInGrid();
  });

  el('bc-card-width').addEventListener('input', () => {
    el('bc-card-preset').value = 'custom';
    updateAllCardsInGrid();
  });

  el('bc-card-height').addEventListener('input', () => {
    el('bc-card-preset').value = 'custom';
    updateAllCardsInGrid();
  });

  el('bc-pos-x').addEventListener('input', (e) => {
    el('pos-x-val').textContent = e.target.value;
    updateAllCardsInGrid();
  });

  el('bc-pos-y').addEventListener('input', (e) => {
    el('pos-y-val').textContent = e.target.value;
    updateAllCardsInGrid();
  });

  el('bc-bar-height').addEventListener('input', (e) => {
    el('bc-height-val').textContent = e.target.value;
    updateAllCardsInGrid();
  });

  el('bc-bar-width').addEventListener('input', (e) => {
    el('bc-scale-val').textContent = e.target.value;
    updateAllCardsInGrid();
  });

  el('bc-bg-badge').addEventListener('change', () => {
    updateAllCardsInGrid();
  });

  el('bc-custom-bg').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        customBgDataUrl = evt.target.result;
        toast('Custom background loaded!', 'success');
        updateAllCardsInGrid();
      };
      reader.readAsDataURL(file);
    }
  });

  function addBarcodeToGrid(code) {
    const grid = el('barcodes-grid');
    const template = el('bc-template').value;
    const countIndex = barcodeCounter++;
    const svgId = `bc-${countIndex}`;
    const div = document.createElement('div');
    
    // Add a remove button (hidden when printing)
    const removeBtn = `<button class="no-print" style="position: absolute; top: 4px; right: 8px; background: rgba(0,0,0,0.1); border: none; color: #333; cursor: pointer; font-size: 14px; width: 24px; height: 24px; border-radius: 50%; z-index: 10;" onclick="this.parentElement.remove()">✕</button>`;

    const cardW = el('bc-card-width') ? parseInt(el('bc-card-width').value, 10) || 320 : 320;
    const cardH = el('bc-card-height') ? parseInt(el('bc-card-height').value, 10) || 200 : 200;
    const posX = el('bc-pos-x') ? el('bc-pos-x').value : 50;
    const posY = el('bc-pos-y') ? el('bc-pos-y').value : 85;
    const barHeight = el('bc-bar-height') ? parseInt(el('bc-bar-height').value, 10) : 50;
    const barWidth = el('bc-bar-width') ? parseFloat(el('bc-bar-width').value) : 1.8;
    const showBadge = el('bc-bg-badge') ? el('bc-bg-badge').checked : true;

    div.dataset.code = code;
    div.dataset.svgId = svgId;

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
          <svg id="${svgId}"></svg>
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
        <svg id="${svgId}"></svg>
      `;
    } else if (template === 'custom') {
      const imgTag = customBgDataUrl
        ? `<img src="${customBgDataUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1;" />`
        : '';
      const bgStyle = showBadge ? 'background: rgba(255,255,255,0.9); padding: 5px 10px; border-radius: 8px;' : 'background: transparent; padding: 0;';
      
      div.className = 'card bc-item custom-card-item';
      div.style = `width: ${cardW}px; height: ${cardH}px; background: ${customBgDataUrl ? 'transparent' : '#e2e8f0'}; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #ccc; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`;
      div.innerHTML = `
        ${removeBtn}
        ${imgTag}
        <div class="custom-bc-wrapper" style="position: absolute; left: ${posX}%; top: ${posY}%; transform: translate(-50%, -50%); ${bgStyle} display: inline-block; z-index: 2;">
          <svg id="${svgId}"></svg>
        </div>
      `;
    } else {
      div.className = 'card bc-item';
      div.style = 'padding: 20px; text-align: center; background: #fff; position: relative; border: 1px solid #ddd; flex-shrink: 0;';
      div.innerHTML = `
        ${removeBtn}
        <svg id="${svgId}"></svg>
      `;
    }

    grid.appendChild(div);
    
    try {
      if (typeof JsBarcode === 'undefined') {
        toast('Barcode library is loading, please wait.', 'error');
        return;
      }
      JsBarcode(`#${svgId}`, code, {
        format: "CODE128",
        width: template === 'sticker' ? 1.5 : (template === 'custom' ? barWidth : 2),
        height: template === 'sticker' ? 40 : (template === 'custom' ? barHeight : 60),
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
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
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
            img { display: block; }
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
              const imgs = Array.from(document.querySelectorAll('img'));
              const promises = imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              });
              Promise.all(promises).then(() => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 100);
              });
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  });

  async function renderCardToCanvas(cardDiv, settings) {
    const template = settings.template;
    const cardW = settings.cardW;
    const cardH = settings.cardH;
    const posX = settings.posX;
    const posY = settings.posY;
    const showBadge = settings.showBadge;
    const bgImgObj = settings.bgImgObj;

    const canvas = document.createElement('canvas');
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext('2d');

    if (template === 'custom') {
      if (bgImgObj) {
        ctx.drawImage(bgImgObj, 0, 0, cardW, cardH);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, cardW, cardH);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cardW, cardH);
    }

    function fillRoundRect(x, y, w, h, r, fillStyle) {
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (template === 'id-card') {
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(0, 0, cardW, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('EduTrack', 16, 22);
      ctx.font = '500 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Student ID', cardW - 16, 22);

      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, cardH - 32, cardW, 32);
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cardH - 32);
      ctx.lineTo(cardW, cardH - 32);
      ctx.stroke();

      ctx.fillStyle = '#666666';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Please present this card for attendance scan', cardW / 2, cardH - 16);
    } else if (template === 'sticker') {
      ctx.fillStyle = '#444444';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('EduTrack ID', cardW / 2, 10);
    }

    const svg = cardDiv.querySelector('svg');
    if (svg) {
      const svgXml = new XMLSerializer().serializeToString(svg);
      const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);

      const barcodeImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = svgDataUrl;
      });

      const bcWidth = barcodeImg.width || 200;
      const bcHeight = barcodeImg.height || 60;

      if (template === 'custom') {
        const centerX = (posX / 100) * cardW;
        const centerY = (posY / 100) * cardH;

        if (showBadge) {
          const padX = 10;
          const padY = 5;
          const badgeW = bcWidth + padX * 2;
          const badgeH = bcHeight + padY * 2;
          const badgeX = centerX - badgeW / 2;
          const badgeY = centerY - badgeH / 2;
          fillRoundRect(badgeX, badgeY, badgeW, badgeH, 8, 'rgba(255,255,255,0.9)');
        }

        const drawX = centerX - bcWidth / 2;
        const drawY = centerY - bcHeight / 2;
        ctx.drawImage(barcodeImg, drawX, drawY);
      } else if (template === 'id-card') {
        const drawX = (cardW - bcWidth) / 2;
        const drawY = 44 + (cardH - 44 - 32 - bcHeight) / 2;
        ctx.drawImage(barcodeImg, drawX, drawY);
      } else if (template === 'sticker') {
        const drawX = (cardW - bcWidth) / 2;
        const drawY = 24 + (cardH - 24 - bcHeight) / 2;
        ctx.drawImage(barcodeImg, drawX, drawY);
      } else {
        const drawX = (cardW - bcWidth) / 2;
        const drawY = (cardH - bcHeight) / 2;
        ctx.drawImage(barcodeImg, drawX, drawY);
      }
    }

    return canvas;
  }

  async function exportBarcodesZip() {
    const items = Array.from(document.querySelectorAll('#barcodes-grid .bc-item'));
    if (!items.length) {
      toast('Please generate barcodes first', 'error');
      return;
    }

    toast('Generating barcode images...', 'info');

    const template = el('bc-template').value;
    const cardW = template === 'custom' ? (parseInt(el('bc-card-width').value, 10) || 320) : (template === 'id-card' ? 320 : (template === 'sticker' ? 180 : 320));
    const cardH = template === 'custom' ? (parseInt(el('bc-card-height').value, 10) || 200) : (template === 'id-card' ? 200 : (template === 'sticker' ? 100 : 150));
    const posX = el('bc-pos-x') ? parseFloat(el('bc-pos-x').value) : 50;
    const posY = el('bc-pos-y') ? parseFloat(el('bc-pos-y').value) : 85;
    const showBadge = el('bc-bg-badge') ? el('bc-bg-badge').checked : true;

    let bgImgObj = null;
    if (template === 'custom' && customBgDataUrl) {
      bgImgObj = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = customBgDataUrl;
      });
    }

    const settings = { template, cardW, cardH, posX, posY, showBadge, bgImgObj };
    const images = [];

    for (let i = 0; i < items.length; i++) {
      const div = items[i];
      const code = div.dataset.code || `barcode-${i + 1}`;
      try {
        const canvas = await renderCardToCanvas(div, settings);
        const dataUrl = canvas.toDataURL('image/png');
        images.push({ filename: `${code}.png`, dataUrl });
      } catch (err) {
        console.error(`Error rendering barcode ${code} to canvas:`, err);
      }
    }

    if (!images.length) {
      toast('Failed to render barcode images', 'error');
      return;
    }

    try {
      const defaultFilename = `barcodes_${cardW}x${cardH}.zip`;
      const res = await window.api.students.exportBarcodesZip({ images, defaultFilename });
      if (res && res.success) {
        toast(`Exported ${res.count} barcode image(s) to ZIP successfully!`, 'success');
      } else if (res && res.canceled) {
        // User canceled save dialog
      } else {
        toast(res?.error || 'Failed to export ZIP archive', 'error');
      }
    } catch (err) {
      console.error('Error exporting ZIP archive via IPC:', err);
      toast('Failed to export ZIP archive', 'error');
    }
  }

  el('btn-export-zip').addEventListener('click', exportBarcodesZip);
  
  setTimeout(() => el('btn-generate-barcodes').click(), 500);
}

