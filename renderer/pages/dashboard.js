// Dashboard
async function renderDashboard() {
  const stats = await window.api.reports.dashboard();
  const sessions = await window.api.sessions.list();
  const attendance = await window.api.attendance.list();
  const reminder = await window.api.backup.checkReminder();

  // Admin-only: fetch financial summary and whatsapp status
  const isAdmin = State.user?.role === 'admin';
  let financeSummary = null;
  if (isAdmin) {
    try { financeSummary = await window.api.reports.financialSummary(); } catch (_) {}
  }

  let whatsappStatus = null;
  try {
    whatsappStatus = await window.api.whatsapp.status();
  } catch (_) {}

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions
    .filter(s => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const recentAtt = attendance
    .sort((a, b) => b.checkInTime.localeCompare(a.checkInTime))
    .slice(0, 6);

  const homeworkDone = attendance.filter(a => a.homeworkStatus === 'done').length;
  const hwRate = attendance.length ? Math.round(homeworkDone / attendance.length * 100) : 0;
  const sessionInsights = stats.sessionRevenue || [];

  // Parse chronological data for charts (last 8 sessions)
  const chronologicalInsights = [...sessionInsights].reverse().slice(-8);
  
  // Draw SVG Revenue Chart
  let revenueSvg = '';
  if (chronologicalInsights.length === 0) {
    revenueSvg = `
      <div class="antd-chart-empty">
        <svg viewBox="0 0 500 150" class="antd-chart-empty-svg">
          <line x1="55" y1="15" x2="480" y2="15" stroke="var(--border)" stroke-dasharray="4 4" />
          <line x1="55" y1="70" x2="480" y2="70" stroke="var(--border)" stroke-dasharray="4 4" />
          <line x1="55" y1="125" x2="480" y2="125" stroke="var(--border)" />
          <text x="267" y="75" fill="var(--text-muted)" font-size="12" text-anchor="middle" font-weight="500">No revenue data available yet</text>
        </svg>
      </div>
    `;
  } else {
    const maxRevenue = Math.max(...chronologicalInsights.map(d => d.revenue || 0), 100);
    const points = chronologicalInsights.map((d, i) => {
      const x = chronologicalInsights.length === 1 
        ? 55 + (500 - 55 - 20) / 2
        : 55 + (i / (chronologicalInsights.length - 1)) * (500 - 55 - 20);
      const y = 150 - 25 - ((d.revenue || 0) / maxRevenue) * (150 - 15 - 25);
      return { x, y, val: d.revenue || 0, label: d.date.slice(5) };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} 125 L ${points[0].x} 125 Z`
      : '';

    revenueSvg = `
      <svg viewBox="0 0 500 150" style="width:100%; height:150px; background:transparent; overflow: visible;">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.00"/>
          </linearGradient>
        </defs>
        <line x1="55" y1="15" x2="480" y2="15" stroke="var(--border)" stroke-dasharray="4 4" />
        <line x1="55" y1="70" x2="480" y2="70" stroke="var(--border)" stroke-dasharray="4 4" />
        <line x1="55" y1="125" x2="480" y2="125" stroke="var(--border)" />
        
        <text x="45" y="20" fill="var(--text-secondary)" font-size="9" text-anchor="end">${Math.round(maxRevenue).toLocaleString()}</text>
        <text x="45" y="75" fill="var(--text-secondary)" font-size="9" text-anchor="end">${Math.round(maxRevenue / 2).toLocaleString()}</text>
        <text x="45" y="128" fill="var(--text-secondary)" font-size="9" text-anchor="end">0</text>
        
        ${areaPath ? `<path d="${areaPath}" fill="url(#revGrad)" />` : ''}
        ${linePath ? `<path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" stroke="var(--bg-card)" stroke-width="2" class="antd-chart-dot" />
          <text x="${p.x}" y="142" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${p.label}</text>
          <text x="${p.x}" y="${p.y - 8}" fill="var(--text-primary)" font-size="8" font-weight="600" text-anchor="middle">${Math.round(p.val)}</text>
        `).join('')}
      </svg>
    `;
  }

  // Draw SVG Attendance Chart
  let attendanceSvg = '';
  if (chronologicalInsights.length === 0) {
    attendanceSvg = `
      <div class="antd-chart-empty">
        <svg viewBox="0 0 500 150" class="antd-chart-empty-svg">
          <line x1="55" y1="15" x2="480" y2="15" stroke="var(--border)" stroke-dasharray="4 4" />
          <line x1="55" y1="70" x2="480" y2="70" stroke="var(--border)" stroke-dasharray="4 4" />
          <line x1="55" y1="125" x2="480" y2="125" stroke="var(--border)" />
          <text x="267" y="75" fill="var(--text-muted)" font-size="12" text-anchor="middle" font-weight="500">No attendance data available yet</text>
        </svg>
      </div>
    `;
  } else {
    const maxAttended = Math.max(...chronologicalInsights.map(d => d.attended || 0), 5);
    const barWidth = 24;
    const points = chronologicalInsights.map((d, i) => {
      const chartWidth = 500 - 55 - 20;
      const x = chronologicalInsights.length === 1 
        ? 55 + chartWidth / 2 - barWidth / 2
        : 55 + (i / (chronologicalInsights.length - 1)) * (chartWidth - barWidth);
      const barHeight = ((d.attended || 0) / maxAttended) * (150 - 15 - 25);
      const y = 150 - 25 - barHeight;
      return { x, y, barHeight, val: d.attended || 0, label: d.date.slice(5) };
    });

    attendanceSvg = `
      <svg viewBox="0 0 500 150" style="width:100%; height:150px; background:transparent; overflow: visible;">
        <defs>
          <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--purple)"/>
            <stop offset="100%" stop-color="var(--purple)" stop-opacity="0.4"/>
          </linearGradient>
        </defs>
        <line x1="55" y1="15" x2="480" y2="15" stroke="var(--border)" stroke-dasharray="4 4" />
        <line x1="55" y1="70" x2="480" y2="70" stroke="var(--border)" stroke-dasharray="4 4" />
        <line x1="55" y1="125" x2="480" y2="125" stroke="var(--border)" />
        
        <text x="45" y="20" fill="var(--text-secondary)" font-size="9" text-anchor="end">${Math.round(maxAttended)}</text>
        <text x="45" y="75" fill="var(--text-secondary)" font-size="9" text-anchor="end">${Math.round(maxAttended / 2)}</text>
        <text x="45" y="128" fill="var(--text-secondary)" font-size="9" text-anchor="end">0</text>
        
        ${points.map(p => `
          <rect x="${p.x}" y="${p.y}" width="${barWidth}" height="${p.barHeight}" rx="4" fill="url(#attGrad)" class="antd-chart-bar" />
          <text x="${p.x + barWidth/2}" y="${p.y - 5}" fill="var(--text-primary)" font-size="8" font-weight="600" text-anchor="middle">${p.val}</text>
          <text x="${p.x + barWidth/2}" y="142" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${p.label}</text>
        `).join('')}
      </svg>
    `;
  }

  // Backup Reminder Alert Block
  let reminderHtml = '';
  if (reminder && reminder.showReminder) {
    const message = reminder.daysSince === null
      ? 'No backups have been created yet. Please create a backup to protect your database.'
      : `No backup has been created in the last ${reminder.daysSince} days. Please secure your data.`;
    reminderHtml = `
      <div class="antd-alert antd-alert-warning" style="margin-bottom: 24px; border-left: 4px solid var(--yellow); align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="antd-alert-icon" style="color: var(--yellow);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div class="antd-alert-message" style="font-weight: 600;">Backup Reminder</div>
            <div class="antd-alert-description">${message}</div>
          </div>
        </div>
        <button class="antd-btn antd-btn-primary" onclick="navigate('backup')">Backup Now</button>
      </div>
    `;
  }

  // Assemble Notifications Panel lists
  let alertsListHtml = '';
  if (reminder && reminder.showReminder) {
    alertsListHtml += `
      <div class="antd-alert antd-alert-warning">
        <span class="antd-alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>
        <div>
          <div class="antd-alert-message">Database Backup Overdue</div>
          <div class="antd-alert-description">Please execute backup.</div>
        </div>
      </div>
    `;
  }

  if (whatsappStatus) {
    if (whatsappStatus.status === 'connected') {
      alertsListHtml += `
        <div class="antd-alert antd-alert-success">
          <span class="antd-alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
          <div>
            <div class="antd-alert-message">WhatsApp Connected</div>
            <div class="antd-alert-description">Active Queue: ${whatsappStatus.queueLength || 0} messages</div>
          </div>
        </div>
      `;
    } else {
      const stateMap = {
        disconnected: 'Disconnected',
        qr: 'QR Code Pending',
        authenticating: 'Authenticating...'
      };
      alertsListHtml += `
        <div class="antd-alert antd-alert-error">
          <span class="antd-alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>
          <div>
            <div class="antd-alert-message">WhatsApp Offline</div>
            <div class="antd-alert-description">Status: ${stateMap[whatsappStatus.status] || 'Offline'}</div>
          </div>
        </div>
      `;
    }
  }

  if (State.isTrial) {
    alertsListHtml += `
      <div class="antd-alert antd-alert-info">
        <span class="antd-alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
        <div>
          <div class="antd-alert-message">Trial License Active</div>
          <div class="antd-alert-description">Max limit: ${State.trialLimit} students</div>
        </div>
      </div>
    `;
  }

  if (!alertsListHtml) {
    alertsListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 12px;">No active notifications</div>`;
  }

  // Generate Activity Timeline
  let timelineHtml = '';
  if (recentAtt.length) {
    timelineHtml = recentAtt.map(a => {
      const dotColor = {
        done: 'var(--green)',
        missed: 'var(--red)',
        partial: 'var(--yellow)',
        excused: 'var(--purple)'
      }[a.homeworkStatus] || 'var(--text-muted)';
      
      const hwLabel = {
        done: 'Completed homework',
        missed: 'Missed homework',
        partial: 'Partial homework',
        excused: 'Excused'
      }[a.homeworkStatus] || 'No homework status';

      return `
        <div class="antd-timeline-item">
          <div class="antd-timeline-dot" style="border-color: ${dotColor};"></div>
          <div class="antd-timeline-content">
            <div class="antd-timeline-title">${a.studentName}</div>
            <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
              <span>Barcode: <code style="color:var(--accent);">${a.barcode || '-'}</code></span>
              <span>&bull;</span>
              <span>${formatTime(a.checkInTime)}</span>
            </div>
            <div style="margin-top: 2px;">
              <span class="badge ${a.homeworkStatus === 'done' ? 'badge-green' : a.homeworkStatus === 'missed' ? 'badge-red' : a.homeworkStatus === 'partial' ? 'badge-yellow' : 'badge-muted'}" style="font-size: 10px; padding: 1px 6px;">${hwLabel}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    timelineHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 16px;">No recent check-ins today</div>`;
  }

  el('page-dashboard').innerHTML = `
    <style>
      .antd-dashboard {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .antd-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .antd-header-title h2 {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px 0;
        letter-spacing: -0.02em;
      }
      .antd-header-title p {
        font-size: 13px;
        color: var(--text-secondary);
        margin: 0;
      }
      .antd-stats-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 20px;
      }
      @media (max-width: 1400px) {
        .antd-stats-grid { grid-template-columns: repeat(3, 1fr); }
      }
      @media (max-width: 900px) {
        .antd-stats-grid { grid-template-columns: repeat(2, 1fr); }
      }
      .antd-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow: hidden;
      }
      .antd-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15);
        border-color: rgba(99, 102, 241, 0.4);
      }
      .antd-stat-card-wrapper {
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .antd-stat-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .antd-stat-icon svg {
        width: 22px;
        height: 22px;
      }
      .antd-stat-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .antd-stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.1;
      }
      .antd-stat-label {
        font-size: 12px;
        color: var(--text-secondary);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .antd-layout-grid {
        display: grid;
        grid-template-columns: 7fr 3fr;
        gap: 24px;
      }
      @media (max-width: 1200px) {
        .antd-layout-grid { grid-template-columns: 1fr; }
      }
      .antd-main-col {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .antd-sidebar-col {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .antd-card-header {
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .antd-card-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .antd-card-body {
        padding: 20px;
      }
      .antd-finance-section {
        display: grid;
        grid-template-columns: 4.5fr 5.5fr;
        gap: 24px;
      }
      @media (max-width: 992px) {
        .antd-finance-section { grid-template-columns: 1fr; }
      }
      .antd-finance-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      .antd-finance-item {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        transition: border-color 0.2s;
      }
      .antd-finance-item:hover {
        border-color: rgba(255, 255, 255, 0.1);
      }
      .antd-finance-item-val {
        font-size: 18px;
        font-weight: 700;
      }
      .antd-finance-item-lbl {
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .antd-attendance-section {
        display: grid;
        grid-template-columns: 6fr 4fr;
        gap: 24px;
      }
      @media (max-width: 992px) {
        .antd-attendance-section { grid-template-columns: 1fr; }
      }
      .antd-chart-container {
        position: relative;
        padding-top: 10px;
      }
      .antd-chart-empty {
        height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .antd-chart-empty-svg {
        width: 100%;
        height: 150px;
      }
      .antd-chart-dot {
        cursor: pointer;
        transition: r 0.2s;
      }
      .antd-chart-dot:hover {
        r: 6;
      }
      .antd-chart-bar {
        transition: opacity 0.2s;
        cursor: pointer;
      }
      .antd-chart-bar:hover {
        opacity: 0.85;
      }
      .antd-btn {
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 14px;
        border: 1px solid var(--border);
        background: var(--bg-surface);
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .antd-btn:hover {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--bg-hover);
      }
      .antd-btn-primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      .antd-btn-primary:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
        color: #fff;
      }
      .antd-actions-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .antd-action-btn {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 16px 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }
      .antd-action-btn:hover {
        background: var(--bg-hover);
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .antd-action-btn svg {
        width: 22px;
        height: 22px;
        transition: transform 0.2s;
      }
      .antd-action-btn:hover svg {
        transform: scale(1.1);
      }
      .antd-action-btn span {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
      }
      .antd-notification-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .antd-alert {
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid transparent;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 13px;
        line-height: 1.4;
      }
      .antd-alert-warning {
        background: rgba(245, 158, 11, 0.08);
        border-color: rgba(245, 158, 11, 0.2);
        color: var(--yellow);
      }
      .antd-alert-success {
        background: rgba(34, 197, 94, 0.08);
        border-color: rgba(34, 197, 94, 0.2);
        color: var(--green);
      }
      .antd-alert-info {
        background: rgba(6, 182, 212, 0.08);
        border-color: rgba(6, 182, 212, 0.2);
        color: var(--cyan);
      }
      .antd-alert-error {
        background: rgba(239, 68, 68, 0.08);
        border-color: rgba(239, 68, 68, 0.2);
        color: var(--red);
      }
      .antd-alert-icon {
        flex-shrink: 0;
        margin-top: 2px;
      }
      .antd-alert-icon svg {
        width: 16px;
        height: 16px;
      }
      .antd-alert-message {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 2px;
      }
      .antd-alert-description {
        font-size: 12px;
        color: var(--text-secondary);
      }
      .antd-timeline {
        display: flex;
        flex-direction: column;
        position: relative;
        padding-left: 20px;
      }
      .antd-timeline::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 6px;
        bottom: 6px;
        width: 2px;
        background: var(--border);
      }
      .antd-timeline-item {
        position: relative;
        padding-bottom: 20px;
      }
      .antd-timeline-item:last-child {
        padding-bottom: 0;
      }
      .antd-timeline-dot {
        position: absolute;
        left: -20px;
        top: 5px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--bg-card);
        border: 2.5px solid var(--accent);
      }
      .antd-timeline-content {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .antd-timeline-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .antd-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      .antd-table th {
        background: var(--bg-surface);
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 11px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .antd-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
        color: var(--text-primary);
      }
      .antd-table tr:hover td {
        background: rgba(255, 255, 255, 0.015);
      }
      .antd-table-empty {
        padding: 32px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
      }
      .upcoming-list-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        transition: background-color 0.2s;
      }
      .upcoming-list-row:hover {
        background: rgba(255, 255, 255, 0.015);
      }
      .upcoming-list-row:last-child {
        border-bottom: none;
      }
    </style>

    <div class="antd-dashboard">
      <!-- Dashboard Header -->
      <div class="antd-header">
        <div class="antd-header-title">
          <h2>Dashboard</h2>
          <p>Welcome back, ${State.user?.name} &bull; ${new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
        </div>
      </div>

      <!-- Overdue Backup Notification (if applicable) -->
      ${reminderHtml}

      <!-- 6 Key Statistics (KPIs) -->
      <div class="antd-stats-grid">
        ${renderStatCard('Students', stats.students, '#6366f1', 'rgba(99, 102, 241, 0.1)', `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`)}
        ${renderStatCard('Groups', stats.groups, '#8b5cf6', 'rgba(139, 92, 246, 0.1)', `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>`)}
        ${renderStatCard('Sessions', stats.sessions, '#06b6d4', 'rgba(6, 182, 212, 0.1)', `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>`)}
        ${renderStatCard('Centers', stats.centers, '#f59e0b', 'rgba(245, 158, 11, 0.1)', `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`)}
        ${renderStatCard('Levels', stats.levels, '#22c55e', 'rgba(34, 197, 94, 0.1)', `<path d="M2 20h20M6 20V10M12 20V4M18 20v-8"/>`)}
        ${renderStatCard('Attendance Records', stats.totalAttendance, '#f97316', 'rgba(249, 115, 22, 0.1)', `<polyline points="22 6 12 14 2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/>`)}
      </div>

      <!-- Main Layout Structure -->
      <div class="antd-layout-grid">
        <!-- Main Pane (Analytics and Details) -->
        <div class="antd-main-col">
          
          <!-- Financial Overview Card (Admin Only) -->
          ${isAdmin && financeSummary ? `
            <div class="antd-card">
              <div class="antd-card-header">
                <span class="antd-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="width: 18px; height: 18px; vertical-align: middle;"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Financial Overview & Revenue Trends
                </span>
                <button class="antd-btn" onclick="navigate('payments')">View Payments</button>
              </div>
              <div class="antd-card-body">
                <div class="antd-finance-section">
                  <!-- Grid Metrics -->
                  <div class="antd-finance-grid">
                    <div class="antd-finance-item">
                      <span class="antd-finance-item-lbl">Gross Revenue</span>
                      <span class="antd-finance-item-val" style="color: var(--accent);">${(Number(financeSummary.totalGross)||0).toLocaleString()} EGP</span>
                    </div>
                    <div class="antd-finance-item">
                      <span class="antd-finance-item-lbl">Discounts Offered</span>
                      <span class="antd-finance-item-val" style="color: var(--yellow);">${(Number(financeSummary.totalDiscount)||0).toLocaleString()} EGP</span>
                    </div>
                    <div class="antd-finance-item">
                      <span class="antd-finance-item-lbl">Collected Fees</span>
                      <span class="antd-finance-item-val" style="color: var(--green);">${(Number(financeSummary.totalCollected)||0).toLocaleString()} EGP</span>
                    </div>
                    <div class="antd-finance-item">
                      <span class="antd-finance-item-lbl">Outstanding Balance</span>
                      <span class="antd-finance-item-val" style="color: ${financeSummary.totalOutstanding > 0 ? 'var(--red)' : 'var(--green)'};">${(Number(financeSummary.totalOutstanding)||0).toLocaleString()} EGP</span>
                    </div>
                  </div>
                  <!-- Revenue Trend SVG Chart -->
                  <div class="antd-chart-container">
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; text-align: center;">Session Net Revenue Trend</div>
                    ${revenueSvg}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Attendance & Homework Analytics Card -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2" style="width: 18px; height: 18px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Attendance Analytics & Homework Performance
              </span>
            </div>
            <div class="antd-card-body">
              <div class="antd-attendance-section">
                <!-- Bar Chart column -->
                <div class="antd-chart-container">
                  <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; text-align: center;">Students Present Per Session</div>
                  ${attendanceSvg}
                </div>
                <!-- Homework ring column -->
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; border-left: 1px solid var(--border); padding-left: 20px;">
                  <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Global Homework Completion Rate</div>
                  <div style="display: flex; justify-content: space-around; align-items: center; gap: 20px; width: 100%;">
                    <div style="position: relative; width: 100px; height: 100px;">
                      <svg viewBox="0 0 36 36" style="width: 100px; height: 100px; transform: rotate(-90deg);">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--green)" stroke-width="3"
                          stroke-dasharray="${hwRate} ${100 - hwRate}" stroke-linecap="round"/>
                      </svg>
                      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <span style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${hwRate}%</span>
                        <span style="font-size: 8px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Rate</span>
                      </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--green);"></span>
                        <span style="color: var(--text-secondary);">Done:</span>
                        <strong style="color: var(--text-primary); font-weight: 600;">${homeworkDone}</strong>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--red);"></span>
                        <span style="color: var(--text-secondary);">Missed:</span>
                        <strong style="color: var(--text-primary); font-weight: 600;">${attendance.filter(a => a.homeworkStatus === 'missed').length}</strong>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--yellow);"></span>
                        <span style="color: var(--text-secondary);">Partial:</span>
                        <strong style="color: var(--text-primary); font-weight: 600;">${attendance.filter(a => a.homeworkStatus === 'partial').length}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Session Attendance Insights Table -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Session Attendance Insights
              </span>
              <button class="antd-btn" onclick="navigate('sessions')">View Sessions</button>
            </div>
            <div style="overflow-x: auto;">
              <table class="antd-table">
                <thead>
                  <tr>
                    <th>Session Name</th>
                    <th>Execution Date</th>
                    <th>Total Present</th>
                    <th>Same-Level Siblings</th>
                    <th>Discounted</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessionInsights.length ? sessionInsights.map(s => `
                    <tr>
                      <td style="font-weight: 600;">${s.title}</td>
                      <td style="color: var(--text-secondary);">${s.date}</td>
                      <td><span class="badge badge-cyan">${s.attended}</span></td>
                      <td><span class="badge badge-purple">${s.twinCount || 0}</span></td>
                      <td><span class="badge badge-yellow">${s.discountCount || 0}</span></td>
                    </tr>`).join('') : `<tr><td colspan="5" class="antd-table-empty">No attendance insights yet</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Detailed Recent Attendance Log -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Recent Attendance Log
              </span>
              <button class="antd-btn" onclick="navigate('attendance')">Manage Records</button>
            </div>
            <div style="overflow-x: auto;">
              <table class="antd-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Barcode</th>
                    <th>Check-in Date & Time</th>
                    <th>Homework Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentAtt.length ? recentAtt.map(a => `
                    <tr>
                      <td style="font-weight: 600;">${a.studentName}</td>
                      <td><code style="color: var(--accent); font-size: 12px;">${a.barcode || '-'}</code></td>
                      <td style="color: var(--text-secondary);">${formatDate(a.checkInTime)} &bull; ${formatTime(a.checkInTime)}</td>
                      <td>${hwBadge(a.homeworkStatus)}</td>
                    </tr>`).join('') : `<tr><td colspan="4" class="antd-table-empty">No attendance records yet</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Sidebar Pane (Quick Actions, Notifications & Timeline) -->
        <div class="antd-sidebar-col">
          
          <!-- Quick Actions Grid -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="width: 18px; height: 18px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Quick Actions
              </span>
            </div>
            <div class="antd-card-body">
              <div class="antd-actions-grid">
                <div class="antd-action-btn" onclick="navigate('students')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  <span>Add Student</span>
                </div>
                <div class="antd-action-btn" onclick="navigate('attendance')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>Take Attendance</span>
                </div>
                <div class="antd-action-btn" onclick="navigate('sessions')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>New Session</span>
                </div>
                <div class="antd-action-btn" onclick="navigate('backup')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Backup Data</span>
                </div>
                <div class="antd-action-btn" onclick="navigate('payments')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <span>Payments</span>
                </div>
                <div class="antd-action-btn" onclick="navigate('reports')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  <span>Reports</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Notification & Service Status Panel -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2" style="width: 18px; height: 18px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                Notifications & Status
              </span>
            </div>
            <div class="antd-card-body">
              <div class="antd-notification-panel">
                ${alertsListHtml}
              </div>
            </div>
          </div>

          <!-- Upcoming Sessions list card -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Upcoming Sessions
              </span>
              <button class="antd-btn" style="padding: 4px 10px;" onclick="navigate('sessions')">View All</button>
            </div>
            <div>
              ${upcoming.length ? upcoming.map(s => `
                <div class="upcoming-list-row">
                  <div>
                    <div style="font-weight: 600; font-size: 13px;">${s.title}</div>
                    <div style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">${s.date} &bull; ${s.time || '-'}</div>
                  </div>
                  <span class="badge badge-cyan" style="font-size: 11px; padding: 2px 6px;">${s.date === today ? 'Today' : s.date.slice(5)}</span>
                </div>`).join('') : `<div class="antd-table-empty">No upcoming sessions</div>`}
            </div>
          </div>

          <!-- Recent Activity Timeline Card -->
          <div class="antd-card">
            <div class="antd-card-header">
              <span class="antd-card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" style="width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Recent Activity
              </span>
            </div>
            <div class="antd-card-body" style="padding: 20px 20px 24px 20px;">
              <div class="antd-timeline">
                ${timelineHtml}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

function renderStatCard(label, value, color, bgColor, svgIcon) {
  return `
    <div class="antd-card" style="border-bottom: 3px solid ${color};">
      <div class="antd-stat-card-wrapper">
        <div class="antd-stat-icon" style="background: ${bgColor}; color: ${color};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${svgIcon}
          </svg>
        </div>
        <div class="antd-stat-info">
          <span class="antd-stat-value">${value}</span>
          <span class="antd-stat-label">${label}</span>
        </div>
      </div>
    </div>
  `;
}

function hwBadge(status) {
  const map = { done:'badge-green', missed:'badge-red', partial:'badge-yellow', excused:'badge-purple', pending:'badge-muted' };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status || 'pending'}</span>`;
}
