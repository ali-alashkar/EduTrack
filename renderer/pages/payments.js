// ── Payments & Finance Page (Admin-Only) ─────────────────────────────────────

let _paymentsData = [];
let _paymentsStudents = [];
let _paymentsSearch = '';
let _paymentsMethodFilter = '';

async function renderPayments() {
  const pageEl = el('page-payments');
  pageEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-secondary)">Loading financial data…</div>`;

  try {
    const [payments, students, summary] = await Promise.all([
      window.api.payments.list(),
      window.api.students.list(),
      window.api.reports.financialSummary(),
    ]);
    _paymentsData = payments;
    _paymentsStudents = students;
    _paymentsSearch = '';
    _paymentsMethodFilter = '';
    _renderPaymentsPage(summary);
  } catch (e) {
    pageEl.innerHTML = `<div class="alert alert-error">Failed to load payments: ${e.message}</div>`;
  }
}

function _renderPaymentsPage(summary) {
  const pageEl = el('page-payments');

  const fmt = (n) => (Number(n) || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const outstandingColor = (summary.totalOutstanding > 0) ? 'var(--red)' : 'var(--green)';

  pageEl.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Payments &amp; Finance</h2>
        <p class="page-header-sub">Track student payments and financial balance — admin only</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" id="btn-export-payments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV/Excel
        </button>
        <button class="btn btn-primary" id="btn-record-payment">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Record Payment
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px;">
      ${_finCard('Gross Revenue', fmt(summary.totalGross) + ' EGP', '#6366f1', `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`)}
      ${_finCard('Total Discounts', fmt(summary.totalDiscount) + ' EGP', '#f59e0b', `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`)}
      ${_finCard('Total Collected', fmt(summary.totalCollected) + ' EGP', '#22c55e', `<polyline points="20 6 9 17 4 12"/>`)}
      ${_finCard('Outstanding Balance', fmt(summary.totalOutstanding) + ' EGP', outstandingColor, `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`)}
    </div>

    <!-- Filters -->
    <div class="filter-bar" style="margin-bottom:16px;">
      <div class="search-wrap" style="flex:1;max-width:360px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input id="payments-search" type="text" class="form-input search-input" placeholder="Search by student name…" value="">
      </div>
      <select id="payments-method-filter" class="form-input" style="width:180px;">
        <option value="">All Methods</option>
        <option value="cash">Cash</option>
        <option value="transfer">Bank Transfer</option>
        <option value="other">Other</option>
      </select>
    </div>

    <!-- Payments Table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Payment Records</span>
        <span class="badge badge-muted" id="payments-count-badge">${_paymentsData.length} records</span>
      </div>
      <div class="table-wrap" id="payments-table-wrap">
        ${_buildPaymentsTable(_paymentsData)}
      </div>
    </div>

    <!-- Student Balances Table -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title">Student Balances</span>
        <span class="badge badge-muted">${summary.studentBalances ? summary.studentBalances.length : 0} students with activity</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Student</th>
            <th>Sessions</th>
            <th>Amount Due</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${summary.studentBalances && summary.studentBalances.length
              ? summary.studentBalances.map(b => {
                  const statusBadge = b.remaining <= 0
                    ? `<span class="badge badge-green">Paid</span>`
                    : `<span class="badge badge-red">Owes ${(Number(b.remaining)||0).toLocaleString()} EGP</span>`;
                  return `<tr>
                    <td style="font-weight:600;">${b.studentName}</td>
                    <td><span class="badge badge-cyan">${b.sessionsAttended}</span></td>
                    <td>${(Number(b.due)||0).toLocaleString()} EGP</td>
                    <td style="color:var(--green)">${(Number(b.paid)||0).toLocaleString()} EGP</td>
                    <td style="color:${b.remaining > 0 ? 'var(--red)' : 'var(--green)'}; font-weight:600;">${(Number(b.remaining)||0).toLocaleString()} EGP</td>
                    <td>${statusBadge}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="openStudentBalance('${b.studentId}')">Details</button>
                    </td>
                  </tr>`;
                }).join('')
              : `<tr><td colspan="7" class="table-empty">No student financial activity yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('btn-record-payment').addEventListener('click', openRecordPaymentModal);
  document.getElementById('btn-export-payments').addEventListener('click', exportPaymentsExcel);

  document.getElementById('payments-search').addEventListener('input', e => {
    _paymentsSearch = e.target.value.toLowerCase().trim();
    _refreshPaymentsTable();
  });

  document.getElementById('payments-method-filter').addEventListener('change', e => {
    _paymentsMethodFilter = e.target.value;
    _refreshPaymentsTable();
  });
}

function _finCard(label, value, color, svgPath) {
  return `
    <div class="stat-card">
      <div class="stat-card-icon" style="background:${color}22;">
        <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${svgPath}</svg>
      </div>
      <div class="stat-card-value" style="color:${color};font-size:20px;">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>`;
}

function _buildPaymentsTable(data) {
  const methodLabel = { cash: 'Cash', transfer: 'Bank Transfer', other: 'Other' };
  const methodBadge = { cash: 'badge-green', transfer: 'badge-cyan', other: 'badge-muted' };

  if (!data.length) {
    return `<table><thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Date</th><th>Note</th><th></th></tr></thead>
            <tbody><tr><td colspan="6" class="table-empty">No payments recorded yet</td></tr></tbody></table>`;
  }

  const rows = data.map(p => `
    <tr>
      <td>
        <span style="font-weight:600;cursor:pointer;color:var(--accent);" onclick="openStudentBalance('${p.studentId}')">${p.studentName}</span>
      </td>
      <td style="font-weight:700;color:var(--green);">${(Number(p.amount)||0).toLocaleString()} EGP</td>
      <td><span class="badge ${methodBadge[p.method] || 'badge-muted'}">${methodLabel[p.method] || p.method}</span></td>
      <td style="color:var(--text-secondary);">${p.date || formatDate(p.createdAt)}</td>
      <td style="color:var(--text-secondary);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.note || '—'}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deletePayment('${p.id}', '${p.studentName.replace(/'/g, "\\'")}')">Delete</button>
      </td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>Student</th><th>Amount</th><th>Method</th><th>Date</th><th>Note</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function _refreshPaymentsTable() {
  let filtered = _paymentsData;
  if (_paymentsSearch) {
    filtered = filtered.filter(p => p.studentName.toLowerCase().includes(_paymentsSearch));
  }
  if (_paymentsMethodFilter) {
    filtered = filtered.filter(p => p.method === _paymentsMethodFilter);
  }
  const wrap = document.getElementById('payments-table-wrap');
  const badge = document.getElementById('payments-count-badge');
  if (wrap) wrap.innerHTML = _buildPaymentsTable(filtered);
  if (badge) badge.textContent = `${filtered.length} records`;
}

async function deletePayment(id, studentName) {
  if (!confirmAction(`Delete this payment record for ${studentName}? This cannot be undone.`)) return;
  const res = await window.api.payments.delete(id);
  if (res.success) {
    _paymentsData = _paymentsData.filter(p => p.id !== id);
    _refreshPaymentsTable();
    toast('Payment deleted', 'success');
    // Refresh the page to update totals
    await renderPayments();
  } else {
    toast('Failed to delete payment', 'error');
  }
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

function openRecordPaymentModal() {
  const studentOptions = _paymentsStudents
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `<option value="${s.id}">${s.name}</option>`)
    .join('');

  const today = new Date().toISOString().slice(0, 10);

  openModal({
    title: 'Record Payment',
    body: `
      <div class="form-group">
        <label class="form-label">Student *</label>
        <select id="pay-student-id" class="form-input">
          <option value="">— Select student —</option>
          ${studentOptions}
        </select>
      </div>
      <div id="pay-balance-preview" style="display:none;margin-bottom:12px;padding:12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius-sm);font-size:13px;"></div>
      <div class="form-group">
        <label class="form-label">Amount (EGP) *</label>
        <input id="pay-amount" type="number" min="1" class="form-input" placeholder="e.g. 500">
      </div>
      <div class="form-group">
        <label class="form-label">Payment Method</label>
        <select id="pay-method" class="form-input">
          <option value="cash">Cash</option>
          <option value="transfer">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input id="pay-date" type="date" class="form-input" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Note (optional)</label>
        <input id="pay-note" type="text" class="form-input" placeholder="e.g. April sessions payment">
      </div>
      <div id="pay-error" class="alert alert-error hidden"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="pay-submit-btn">Save Payment</button>
    `,
  });

  // Show balance preview when student selected
  document.getElementById('pay-student-id').addEventListener('change', async (e) => {
    const preview = document.getElementById('pay-balance-preview');
    if (!e.target.value) { preview.style.display = 'none'; return; }
    try {
      const bal = await window.api.payments.studentBalance(e.target.value);
      if (bal.success) {
        const statusColor = bal.remaining > 0 ? 'var(--red)' : 'var(--green)';
        preview.style.display = '';
        preview.innerHTML = `
          <strong>${bal.student.name}</strong> — ${bal.sessionsAttended} sessions attended<br>
          <span style="color:var(--text-secondary)">Due: ${(bal.totalDue||0).toLocaleString()} EGP</span> &middot;
          <span style="color:var(--green)">Paid: ${(bal.totalPaid||0).toLocaleString()} EGP</span> &middot;
          <span style="color:${statusColor};font-weight:600;">Remaining: ${(bal.remaining||0).toLocaleString()} EGP</span>
        `;
      }
    } catch (_) { preview.style.display = 'none'; }
  });

  document.getElementById('pay-submit-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('pay-error');
    errEl.classList.add('hidden');

    const studentId = document.getElementById('pay-student-id').value;
    const amount    = document.getElementById('pay-amount').value;
    const method    = document.getElementById('pay-method').value;
    const date      = document.getElementById('pay-date').value;
    const note      = document.getElementById('pay-note').value;

    if (!studentId) { errEl.textContent = 'Please select a student.'; errEl.classList.remove('hidden'); return; }
    if (!amount || Number(amount) <= 0) { errEl.textContent = 'Amount must be greater than zero.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('pay-submit-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const res = await window.api.payments.create({ studentId, amount: Number(amount), method, date, note });
    if (res.success) {
      closeModal();
      toast('Payment recorded successfully!', 'success');
      await renderPayments();
    } else {
      errEl.textContent = res.message || 'Failed to save payment.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Save Payment';
    }
  });
}

// ── Student Balance Modal ─────────────────────────────────────────────────────

async function openStudentBalance(studentId) {
  openModal({ title: 'Loading…', body: '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Loading balance…</div>', wide: true });

  try {
    const bal = await window.api.payments.studentBalance(studentId);
    if (!bal.success) { document.getElementById('modal-title').textContent = 'Error'; document.getElementById('modal-body').innerHTML = `<div class="alert alert-error">${bal.message}</div>`; return; }

    const remainColor = bal.remaining > 0 ? 'var(--red)' : 'var(--green)';
    const methodLabel = { cash: 'Cash', transfer: 'Bank Transfer', other: 'Other' };
    const methodBadge = { cash: 'badge-green', transfer: 'badge-cyan', other: 'badge-muted' };

    document.getElementById('modal-title').textContent = `${bal.student.name} — Balance`;
    document.getElementById('modal-body').innerHTML = `
      <!-- Summary Row -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        ${_balCard('Sessions Attended', bal.sessionsAttended, '#6366f1')}
        ${_balCard('Amount Due', (bal.totalDue||0).toLocaleString() + ' EGP', '#f59e0b')}
        ${_balCard('Total Paid', (bal.totalPaid||0).toLocaleString() + ' EGP', '#22c55e')}
        ${_balCard('Remaining', (bal.remaining||0).toLocaleString() + ' EGP', remainColor)}
      </div>
      ${bal.totalDiscount > 0 ? `<div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary)">Discount applied: <strong style="color:var(--yellow)">${(bal.totalDiscount||0).toLocaleString()} EGP</strong> (${bal.student.discountPercent || 0}%)</div>` : ''}

      <!-- Session Details -->
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--text-primary);">Session Breakdown</div>
        ${bal.sessionDetails && bal.sessionDetails.length ? `
          <div class="table-wrap"><table>
            <thead><tr><th>Session</th><th>Date</th><th>Fee</th><th>After Discount</th></tr></thead>
            <tbody>
              ${bal.sessionDetails.map(s => `<tr>
                <td style="font-weight:500;">${s.sessionTitle || '—'}</td>
                <td style="color:var(--text-secondary);">${s.sessionDate || '—'}</td>
                <td>${(s.fee||0).toLocaleString()} EGP</td>
                <td style="color:var(--green)">${(s.netFee||0).toLocaleString()} EGP</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="table-empty">No sessions attended yet</div>`}
      </div>

      <!-- Payment History -->
      <div>
        <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--text-primary);">Payment History</div>
        ${bal.payments && bal.payments.length ? `
          <div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Note</th></tr></thead>
            <tbody>
              ${bal.payments.map(p => `<tr>
                <td style="color:var(--text-secondary);">${p.date || formatDate(p.createdAt)}</td>
                <td style="color:var(--green);font-weight:600;">${(p.amount||0).toLocaleString()} EGP</td>
                <td><span class="badge ${methodBadge[p.method] || 'badge-muted'}">${methodLabel[p.method] || p.method}</span></td>
                <td style="color:var(--text-secondary);font-size:12px;">${p.note || '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="table-empty">No payments recorded yet</div>`}
      </div>
    `;

    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-primary" onclick="closeModal();openRecordPaymentModal();">+ Record Payment</button>
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    `;
    document.getElementById('modal').classList.add('modal-wide');
  } catch (e) {
    document.getElementById('modal-title').textContent = 'Error';
    document.getElementById('modal-body').innerHTML = `<div class="alert alert-error">Failed to load balance: ${e.message}</div>`;
  }
}

function _balCard(label, value, color) {
  return `
    <div style="background:${color}15;border:1px solid ${color}30;border-radius:var(--radius-md);padding:14px;text-align:center;">
      <div style="font-size:18px;font-weight:800;color:${color};margin-bottom:4px;">${value}</div>
      <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </div>`;
}

async function exportPaymentsExcel() {
  if (!_paymentsData.length) return toast('No payments to export', 'error');
  
  let filtered = _paymentsData;
  if (_paymentsSearch) filtered = filtered.filter(p => p.studentName.toLowerCase().includes(_paymentsSearch));
  if (_paymentsMethodFilter) filtered = filtered.filter(p => p.method === _paymentsMethodFilter);
  
  const rows = filtered.map(p => ({
    studentName: p.studentName,
    amount: p.amount,
    method: p.method,
    date: p.date || p.createdAt.slice(0, 10),
    note: p.note || ''
  }));
  
  const cols = [
    { key: 'studentName', label: 'Student Name' },
    { key: 'amount', label: 'Amount (EGP)' },
    { key: 'method', label: 'Payment Method' },
    { key: 'date', label: 'Date' },
    { key: 'note', label: 'Note' }
  ];
  
  const res = await window.api.export.excel({ sheetName: 'Payments', columns: cols, rows, filename: 'Payments_Export.xlsx' });
  if (res?.success) toast('Exported successfully', 'success');
  else if (res && !res.canceled) toast(res.error || 'Export failed', 'error');
}
