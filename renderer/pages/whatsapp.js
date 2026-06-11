// ── WhatsApp Integration Page ─────────────────────────────────────────────────
let waCurrentTab = 'connection';
let waStatusInterval = null;

async function renderWhatsApp() {
  const status = await window.api.whatsapp.status();
  const settings = await window.api.whatsapp.getSettings();

  el('page-whatsapp').innerHTML = `
    <div class="page-header">
      <div>
        <h2>WhatsApp Integration</h2>
        <p class="page-header-sub">Send attendance, homework & quiz notifications to parents</p>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div id="wa-status-badge" class="wa-status-badge wa-status-${status.status}">
          <span class="wa-status-dot"></span>
          <span id="wa-status-text">${waStatusLabel(status.status)}</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="wa-tabs">
      <button class="wa-tab ${waCurrentTab === 'connection' ? 'active' : ''}" onclick="switchWaTab('connection')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        Connection
      </button>
      <button class="wa-tab ${waCurrentTab === 'settings' ? 'active' : ''}" onclick="switchWaTab('settings')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Settings
      </button>
      <button class="wa-tab ${waCurrentTab === 'log' ? 'active' : ''}" onclick="switchWaTab('log')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Message Log
      </button>
    </div>

    <!-- Tab Content -->
    <div id="wa-tab-connection" class="wa-tab-content ${waCurrentTab === 'connection' ? '' : 'hidden'}"></div>
    <div id="wa-tab-settings" class="wa-tab-content ${waCurrentTab === 'settings' ? '' : 'hidden'}"></div>
    <div id="wa-tab-log" class="wa-tab-content ${waCurrentTab === 'log' ? '' : 'hidden'}"></div>
  `;

  renderWaConnection(status);
  renderWaSettings(settings);
  renderWaLog();
  setupWaListeners();
}

window.switchWaTab = function(tab) {
  waCurrentTab = tab;
  document.querySelectorAll('.wa-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.wa-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelector(`.wa-tab-content#wa-tab-${tab}`)?.classList.remove('hidden');
  document.querySelector(`.wa-tab[onclick="switchWaTab('${tab}')"]`)?.classList.add('active');

  if (tab === 'log') renderWaLog();
};

function waStatusLabel(status) {
  const map = {
    'disconnected': '🔴 Disconnected',
    'connecting': '🟡 Connecting...',
    'qr_ready': '🟡 Scan QR Code',
    'connected': '🟢 Connected',
  };
  return map[status] || status;
}

// ── Connection Tab ──
function renderWaConnection(status) {
  const container = el('wa-tab-connection');
  const isConnected = status.status === 'connected';
  const isConnecting = status.status === 'connecting' || status.status === 'qr_ready';

  container.innerHTML = `
    <div class="wa-connection-grid">
      <!-- Left: QR / Status -->
      <div class="card wa-qr-card">
        <div class="card-header">
          <span class="card-title" style="display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 24 24" fill="none" style="width:20px;height:20px">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D366" stroke-width="1.5" fill="none"/>
            </svg>
            WhatsApp Connection
          </span>
        </div>
        <div style="padding:24px;text-align:center">
          ${isConnected ? `
            <div class="wa-connected-display">
              <div class="wa-connected-icon">✅</div>
              <h3 style="color:var(--green);margin:12px 0 4px">Connected</h3>
              <p style="color:var(--text-secondary);font-size:13px">WhatsApp is ready to send messages</p>
              <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
                <span class="badge badge-green" style="font-size:12px;padding:4px 12px">Queue: ${status.queueLength}</span>
                ${status.isProcessing ? '<span class="badge badge-yellow" style="font-size:12px;padding:4px 12px">⏳ Sending...</span>' : ''}
              </div>
              <button class="btn btn-danger" style="margin-top:20px" onclick="disconnectWhatsApp()">Disconnect</button>
            </div>
          ` : isConnecting ? `
            <div class="wa-qr-display">
              <div id="wa-qr-image" class="wa-qr-placeholder">
                <div class="wa-spinner"></div>
                <p style="color:var(--text-muted);font-size:13px;margin-top:12px">Waiting for QR code...</p>
              </div>
              <p style="color:var(--text-secondary);font-size:13px;margin-top:16px">Open WhatsApp on your phone → Settings → Linked Devices → Link a Device</p>
            </div>
          ` : `
            <div class="wa-disconnected-display">
              <div style="font-size:48px;margin-bottom:12px;opacity:0.5">📱</div>
              <h3 style="color:var(--text-secondary);margin-bottom:8px">Not Connected</h3>
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">Connect your WhatsApp to start sending messages to parents</p>
              <button class="btn btn-primary wa-connect-btn" onclick="connectWhatsApp()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Connect WhatsApp
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Right: How it works -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 How It Works</span>
        </div>
        <div style="padding:20px">
          <div class="wa-how-step">
            <div class="wa-how-num">1</div>
            <div>
              <div style="font-weight:600;font-size:13px">Connect WhatsApp</div>
              <div style="color:var(--text-muted);font-size:12px">Scan the QR code with your phone to link this app</div>
            </div>
          </div>
          <div class="wa-how-step">
            <div class="wa-how-num">2</div>
            <div>
              <div style="font-weight:600;font-size:13px">Take Attendance</div>
              <div style="color:var(--text-muted);font-size:12px">Messages are queued automatically when students check in</div>
            </div>
          </div>
          <div class="wa-how-step">
            <div class="wa-how-num">3</div>
            <div>
              <div style="font-weight:600;font-size:13px">Set Homework & Quiz</div>
              <div style="color:var(--text-muted);font-size:12px">Updates are sent to parents with homework status and quiz scores</div>
            </div>
          </div>
          <div class="wa-how-step">
            <div class="wa-how-num">4</div>
            <div>
              <div style="font-weight:600;font-size:13px">Anti-Ban Protection</div>
              <div style="color:var(--text-muted);font-size:12px">Random delays & template rotation keep your account safe</div>
            </div>
          </div>

          <div style="margin-top:20px;padding:14px;background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.2);border-radius:8px">
            <div style="font-weight:600;font-size:12px;color:#25D366;margin-bottom:4px">🛡️ Anti-Ban Features</div>
            <ul style="color:var(--text-secondary);font-size:12px;margin:0;padding-left:16px;line-height:1.8">
              <li>5–7 message template variations per type</li>
              <li>Random 5–15 second delays between sends</li>
              <li>Duplicate message prevention</li>
              <li>One-by-one sequential sending (no bulk blast)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Settings Tab ──
function renderWaSettings(settings) {
  const container = el('wa-tab-settings');
  container.innerHTML = `
    <div class="card" style="max-width:640px">
      <div class="card-header">
        <span class="card-title">⚙️ WhatsApp Settings</span>
      </div>
      <div style="padding:20px">
        <div class="wa-setting-group">
          <div class="wa-setting-header">Auto-Send Messages</div>
          <label class="wa-toggle-label">
            <input type="checkbox" id="wa-auto-attendance" ${settings.autoSendAttendance ? 'checked' : ''} onchange="saveWaSettings()" />
            <span class="wa-toggle-text">
              <strong>Attendance Check-in</strong>
              <small>Automatically send message when a student is marked present</small>
            </span>
          </label>
          <label class="wa-toggle-label">
            <input type="checkbox" id="wa-auto-homework" ${settings.autoSendHomework ? 'checked' : ''} onchange="saveWaSettings()" />
            <span class="wa-toggle-text">
              <strong>Homework Updates</strong>
              <small>Send message when homework status is changed from the check-in panel</small>
            </span>
          </label>
          <label class="wa-toggle-label">
            <input type="checkbox" id="wa-auto-quiz" ${settings.autoSendQuiz ? 'checked' : ''} onchange="saveWaSettings()" />
            <span class="wa-toggle-text">
              <strong>Quiz Scores</strong>
              <small>Send quiz result when a score is saved</small>
            </span>
          </label>
        </div>

        <div class="wa-setting-group" style="margin-top:24px">
          <div class="wa-setting-header">Phone Number Format</div>
          <div class="form-group">
            <label class="form-label">Country Code (without +)</label>
            <input id="wa-country-code" type="text" class="form-input" style="width:120px" value="${settings.countryCode || '20'}" onblur="saveWaSettings()" placeholder="20" />
            <p style="color:var(--text-muted);font-size:11px;margin-top:4px">Egypt = 20 | Saudi = 966 | UAE = 971</p>
          </div>
        </div>

        <div class="wa-setting-group" style="margin-top:24px">
          <div class="wa-setting-header">Anti-Ban Delay (seconds between messages)</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Min Delay (sec)</label>
              <input id="wa-min-delay" type="number" class="form-input" style="width:100px" value="${(settings.minDelay || 5000) / 1000}" min="2" max="60" onblur="saveWaSettings()" />
            </div>
            <div class="form-group">
              <label class="form-label">Max Delay (sec)</label>
              <input id="wa-max-delay" type="number" class="form-input" style="width:100px" value="${(settings.maxDelay || 15000) / 1000}" min="5" max="120" onblur="saveWaSettings()" />
            </div>
          </div>
          <p style="color:var(--text-muted);font-size:11px;margin-top:4px">A random delay in this range is used between each message. Higher = safer but slower.</p>
        </div>

        <button class="btn btn-primary" style="margin-top:20px" onclick="saveWaSettings(); toast('Settings saved', 'success')">Save Settings</button>
      </div>
    </div>
  `;
}

// ── Message Log Tab ──
async function renderWaLog() {
  const container = el('wa-tab-log');
  const sessions = await window.api.sessions.list();
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="wa-log-toolbar">
      <div class="search-box" style="margin:0;width:220px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="wa-log-search" type="text" placeholder="Search student..." oninput="filterWaLog()" />
      </div>
      <select id="wa-log-session-filter" class="form-select" style="width:200px" onchange="filterWaLog()">
        <option value="">All Sessions</option>
        ${sortedSessions.map(s => `<option value="${s.id}">${s.date} · ${s.title}</option>`).join('')}
      </select>
      <select id="wa-log-status-filter" class="form-select" style="width:140px" onchange="filterWaLog()">
        <option value="">All Status</option>
        <option value="sent">✅ Sent</option>
        <option value="failed">❌ Failed</option>
        <option value="queued">⏳ Queued</option>
        <option value="no_phone">⚠️ No Phone</option>
      </select>
      <select id="wa-log-type-filter" class="form-select" style="width:140px" onchange="filterWaLog()">
        <option value="">All Types</option>
        <option value="session_summary">Session Summary</option>
        <option value="attendance">📋 Attendance</option>
        <option value="homework">📝 Homework</option>
        <option value="quiz">📊 Quiz</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="renderWaLog()">🔄 Refresh</button>
    </div>

    <!-- Stats -->
    <div id="wa-log-stats" class="wa-log-stats"></div>

    <!-- Table -->
    <div class="card" style="margin-top:16px">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Parent Phone</th>
              <th>Session</th>
              <th>Type</th>
              <th>Status</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="wa-log-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  await filterWaLog();
}

window.filterWaLog = async function() {
  const search = (el('wa-log-search')?.value || '').toLowerCase().trim();
  const sessionId = el('wa-log-session-filter')?.value || '';
  const status = el('wa-log-status-filter')?.value || '';
  const type = el('wa-log-type-filter')?.value || '';

  const filters = {};
  if (sessionId) filters.sessionId = sessionId;
  if (status) filters.status = status;
  if (type) filters.type = type;

  let log = await window.api.whatsapp.getLog(Object.keys(filters).length ? filters : null);

  if (search) {
    log = log.filter(m =>
      m.studentName.toLowerCase().includes(search) ||
      (m.parentPhone || '').includes(search)
    );
  }

  // Stats
  const allLog = await window.api.whatsapp.getLog(null);
  const statsEl = el('wa-log-stats');
  if (statsEl) {
    const sent = allLog.filter(m => m.status === 'sent').length;
    const failed = allLog.filter(m => m.status === 'failed').length;
    const queued = allLog.filter(m => m.status === 'queued').length;
    const noPhone = allLog.filter(m => m.status === 'no_phone').length;
    statsEl.innerHTML = `
      <div class="wa-stat-card wa-stat-sent"><div class="wa-stat-num">${sent}</div><div class="wa-stat-label">Sent ✅</div></div>
      <div class="wa-stat-card wa-stat-failed"><div class="wa-stat-num">${failed}</div><div class="wa-stat-label">Failed ❌</div></div>
      <div class="wa-stat-card wa-stat-queued"><div class="wa-stat-num">${queued}</div><div class="wa-stat-label">Queued ⏳</div></div>
      <div class="wa-stat-card wa-stat-nophone"><div class="wa-stat-num">${noPhone}</div><div class="wa-stat-label">No Phone ⚠️</div></div>
    `;
  }

  // Table
  const tbody = el('wa-log-tbody');
  if (!tbody) return;

  if (!log.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">No messages found.</td></tr>`;
    return;
  }

  tbody.innerHTML = log.slice(0, 200).map((m, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td style="font-weight:600">${m.studentName}</td>
      <td style="color:var(--text-secondary);font-size:12px">${m.parentPhone || '—'}</td>
      <td style="font-size:12px">${m.sessionTitle || m.sessionId}</td>
      <td>${waTypeBadge(m.type)}</td>
      <td>${waStatusBadgeFull(m.status, m.error)}</td>
      <td style="color:var(--text-muted);font-size:11px">${m.sentAt ? new Date(m.sentAt).toLocaleString() : m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          ${m.status === 'failed' ? `<button class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px" onclick="retryWaMessage('${m.id}')">Retry</button>` : ''}
          ${m.status === 'sent' ? `<button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px" onclick="resendWaMessage('${m.id}')">Resend</button>` : ''}
          <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 8px" onclick="viewWaMessage('${m.id}', \`${escapeHtml(m.messageText)}\`)">View</button>
        </div>
      </td>
    </tr>
  `).join('');
};

function waTypeBadge(type) {
  const map = {
    'session_summary': '<span class="badge badge-green" style="font-size:10px">Summary</span>',
    'attendance': '<span class="badge badge-green" style="font-size:10px">📋 Attendance</span>',
    'homework': '<span class="badge badge-yellow" style="font-size:10px">📝 Homework</span>',
    'quiz': '<span class="badge badge-accent" style="font-size:10px">📊 Quiz</span>',
  };
  return map[type] || `<span class="badge badge-muted" style="font-size:10px">${type}</span>`;
}

function waStatusBadgeFull(status, error) {
  const map = {
    'sent': '<span class="badge badge-green" style="font-size:10px">✅ Sent</span>',
    'failed': `<span class="badge badge-red" style="font-size:10px" title="${error || ''}">❌ Failed</span>`,
    'queued': '<span class="badge badge-yellow" style="font-size:10px">⏳ Queued</span>',
    'no_phone': '<span class="badge badge-muted" style="font-size:10px">⚠️ No Phone</span>',
  };
  return map[status] || `<span class="badge badge-muted" style="font-size:10px">${status}</span>`;
}

function escapeHtml(str) {
  return (str || '').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
}

window.retryWaMessage = async function(messageId) {
  const res = await window.api.whatsapp.retry(messageId);
  if (res.success) {
    toast('Message re-queued', 'success');
    setTimeout(() => filterWaLog(), 1000);
  } else {
    toast(res.error || 'Retry failed', 'error');
  }
};

window.resendWaMessage = async function(messageId) {
  const res = await window.api.whatsapp.resend(messageId);
  if (res.success) {
    toast('New message queued (fresh template)', 'success');
    setTimeout(() => filterWaLog(), 500);
  } else {
    toast(res.error || 'Resend failed', 'error');
  }
};

window.viewWaMessage = function(id, messageText) {
  const text = messageText.replace(/\\n/g, '\n');
  openModal({
    title: 'Message Preview',
    body: `
      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.7;direction:rtl;text-align:right;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif">${text}</div>
      <p style="color:var(--text-muted);font-size:11px;margin-top:12px;text-align:center">Message ID: ${id}</p>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`,
  });
};

// ── WhatsApp Actions ──
window.connectWhatsApp = async function() {
  toast('Connecting to WhatsApp...', 'info');
  const res = await window.api.whatsapp.init();
  if (!res.success) {
    toast(res.error || 'Connection failed', 'error');
  }
};

window.disconnectWhatsApp = async function() {
  if (!confirmAction('Disconnect WhatsApp? You will need to scan QR again.')) return;
  await window.api.whatsapp.disconnect();
  toast('WhatsApp disconnected', 'info');
  const status = await window.api.whatsapp.status();
  renderWaConnection(status);
  updateWaGlobalStatus(status.status);
};

window.saveWaSettings = async function() {
  const settings = {
    autoSendAttendance: el('wa-auto-attendance')?.checked ?? true,
    autoSendHomework: el('wa-auto-homework')?.checked ?? true,
    autoSendQuiz: el('wa-auto-quiz')?.checked ?? true,
    countryCode: el('wa-country-code')?.value?.trim() || '20',
    minDelay: Math.max(2, Number(el('wa-min-delay')?.value) || 5) * 1000,
    maxDelay: Math.max(5, Number(el('wa-max-delay')?.value) || 15) * 1000,
  };
  await window.api.whatsapp.updateSettings(settings);
};

// ── Event Listeners (setup once) ──
let waListenersSetup = false;

function setupWaListeners() {
  if (waListenersSetup) return;
  waListenersSetup = true;

  window.api.whatsapp.onQr((qrDataUrl) => {
    const qrEl = el('wa-qr-image');
    if (qrEl) {
      qrEl.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" class="wa-qr-img" />`;
    }
    updateWaGlobalStatus('qr_ready');
  });

  window.api.whatsapp.onReady(() => {
    toast('✅ WhatsApp Connected!', 'success');
    updateWaGlobalStatus('connected');
    if (State.currentPage === 'whatsapp') {
      window.api.whatsapp.status().then(s => renderWaConnection(s));
    }
  });

  window.api.whatsapp.onDisconnected(() => {
    updateWaGlobalStatus('disconnected');
    if (State.currentPage === 'whatsapp') {
      window.api.whatsapp.status().then(s => renderWaConnection(s));
    }
  });

  window.api.whatsapp.onStatusChange((status) => {
    updateWaGlobalStatus(status);
  });

  window.api.whatsapp.onMessageSent((record) => {
    if (record.status === 'sent') {
      // Subtle indicator, don't spam toasts
    } else if (record.status === 'failed') {
      toast(`❌ Message to ${record.studentName}'s parent failed`, 'error');
    }
  });
}

// ── Global Status Indicator (sidebar) ──
function updateWaGlobalStatus(status) {
  const dot = document.getElementById('wa-sidebar-dot');
  if (dot) {
    dot.className = `wa-sidebar-status-dot wa-dot-${status}`;
  }
  const badge = el('wa-status-badge');
  if (badge) {
    badge.className = `wa-status-badge wa-status-${status}`;
    const text = el('wa-status-text');
    if (text) text.textContent = waStatusLabel(status);
  }
}

// Initialize listeners on first load
if (typeof window._waListenerInit === 'undefined') {
  window._waListenerInit = true;
  // Fetch initial status and set sidebar dot
  window.api.whatsapp.status().then(s => updateWaGlobalStatus(s.status));
  setupWaListeners();
}
