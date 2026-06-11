// Dashboard
async function renderDashboard() {
  const stats = await window.api.reports.dashboard();
  const sessions = await window.api.sessions.list();
  const attendance = await window.api.attendance.list();

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

  el('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p class="page-header-sub">Welcome back, ${State.user?.name} &middot; ${new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
      </div>
    </div>

    <div class="stats-grid">
      ${statCard('Students', stats.students, '#6366f1', `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`)}
      ${statCard('Groups', stats.groups, '#8b5cf6', `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>`)}
      ${statCard('Sessions', stats.sessions, '#06b6d4', `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>`)}
      ${statCard('Centers', stats.centers, '#f59e0b', `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`)}
      ${statCard('Levels', stats.levels, '#22c55e', `<path d="M2 20h20M6 20V10M12 20V4M18 20v-8"/>`)}
      ${statCard('Attendance Records', stats.totalAttendance, '#f97316', `<polyline points="22 6 12 14 2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/>`)}
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Upcoming Sessions</span>
          <button class="btn btn-secondary btn-sm" onclick="navigate('sessions')">View All</button>
        </div>
        <div class="card-body">
          ${upcoming.length ? upcoming.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);">
              <div>
                <div style="font-weight:600;font-size:13px;">${s.title}</div>
                <div style="color:var(--text-secondary);font-size:12px;">${s.date} &middot; ${s.time || '-'}</div>
              </div>
              <span class="badge badge-cyan">${s.date === today ? 'Today' : s.date}</span>
            </div>`).join('') : `<div class="table-empty">No upcoming sessions</div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Homework Rate</span>
          <span class="badge badge-green">${hwRate}% done</span>
        </div>
        <div class="card-body" style="padding:20px;">
          <div style="display:flex;justify-content:center;align-items:center;flex-direction:column;gap:10px;">
            <div style="position:relative;width:120px;height:120px;">
              <svg viewBox="0 0 36 36" style="width:120px;height:120px;transform:rotate(-90deg)">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--green)" stroke-width="3"
                  stroke-dasharray="${hwRate} ${100 - hwRate}" stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;">${hwRate}%</div>
            </div>
            <div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap;justify-content:center">
              <span><span style="color:var(--green)">&bull;</span> Done: ${homeworkDone}</span>
              <span><span style="color:var(--red)">&bull;</span> Missed: ${attendance.filter(a => a.homeworkStatus === 'missed').length}</span>
              <span><span style="color:var(--yellow)">&bull;</span> Partial: ${attendance.filter(a => a.homeworkStatus === 'partial').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title">Session Attendance Insights</span>
        <button class="btn btn-secondary btn-sm" onclick="navigate('sessions')">View Sessions</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Session</th><th>Date</th><th>Attended</th><th>Same-Level Siblings</th><th>Discounted</th></tr></thead>
          <tbody>
            ${sessionInsights.length ? sessionInsights.map(s => `
              <tr>
                <td style="font-weight:600;">${s.title}</td>
                <td style="color:var(--text-secondary);">${s.date}</td>
                <td><span class="badge badge-cyan">${s.attended}</span></td>
                <td><span class="badge badge-purple">${s.twinCount || 0}</span></td>
                <td><span class="badge badge-yellow">${s.discountCount || 0}</span></td>
              </tr>`).join('') : `<tr><td colspan="5" class="table-empty">No attendance insights yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title">Recent Attendance</span>
        <button class="btn btn-secondary btn-sm" onclick="navigate('attendance')">Manage</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Barcode</th><th>Check-in Time</th><th>Homework</th></tr></thead>
          <tbody>
            ${recentAtt.length ? recentAtt.map(a => `
              <tr>
                <td style="font-weight:600;">${a.studentName}</td>
                <td><code style="color:var(--accent);font-size:12px;">${a.barcode || '-'}</code></td>
                <td style="color:var(--text-secondary);">${formatDate(a.checkInTime)} ${formatTime(a.checkInTime)}</td>
                <td>${hwBadge(a.homeworkStatus)}</td>
              </tr>`).join('') : `<tr><td colspan="4" class="table-empty">No attendance records yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function statCard(label, value, color, svgPath) {
  return `
    <div class="stat-card">
      <div class="stat-card-icon" style="background:${color}22;">
        <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${svgPath}</svg>
      </div>
      <div class="stat-card-value" style="color:${color}">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>`;
}

function hwBadge(status) {
  const map = { done:'badge-green', missed:'badge-red', partial:'badge-yellow', excused:'badge-purple', pending:'badge-muted' };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status || 'pending'}</span>`;
}
