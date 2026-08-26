// ── Payments & Teacher Finance Page (Admin-Only) ───────────────────────────────────

let _expensesData = [];
let _expenseCategories = [];
let _booksData = [];
let _paymentsStudents = [];
let _paymentsTab = 'finance'; // 'finance' | 'books' | 'expenses' | 'profit'

function _payEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderPayments() {
  const pageEl = el('page-payments');
  pageEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-secondary)">Loading financial data…</div>`;

  try {
    const [students, summary, expenses, categories, books] = await Promise.all([
      window.api.students.list(),
      window.api.reports.financialSummary(),
      window.api.expenses.list(),
      window.api.expenses.categories(),
      window.api.books.list(),
    ]);
    _paymentsStudents = students;
    _expensesData = expenses;
    _expenseCategories = categories;
    _booksData = books;
    _renderPaymentsPage(summary);
  } catch (e) {
    pageEl.innerHTML = `<div class="alert alert-error">Failed to load payments: ${e.message}</div>`;
  }
}

function _renderPaymentsPage(summary) {
  const pageEl = el('page-payments');
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  pageEl.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Teacher Finance &amp; Accounting</h2>
        <p class="page-header-sub">Track attendance net income, book sales, expenses, and profit</p>
      </div>
      <div style="display:flex;gap:8px;" id="pay-header-actions">
        <button class="btn btn-secondary" id="btn-export-payments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Excel
        </button>
      </div>
    </div>

    <!-- Finance Tabs -->
    <div class="wa-tabs" style="margin-bottom:20px;">
      <button class="wa-tab ${_paymentsTab === 'finance' ? 'active' : ''}" onclick="switchPayTab('finance')">💰 Attendance Net Income</button>
      <button class="wa-tab ${_paymentsTab === 'books' ? 'active' : ''}" onclick="switchPayTab('books')">📚 Book Sales</button>
      <button class="wa-tab ${_paymentsTab === 'expenses' ? 'active' : ''}" onclick="switchPayTab('expenses')">💸 Expenses</button>
      <button class="wa-tab ${_paymentsTab === 'profit' ? 'active' : ''}" onclick="switchPayTab('profit')">📈 Profit Dashboard</button>
    </div>

    <!-- ── 1. Attendance Net Income Tab ── -->
    <div id="pay-tab-finance" class="${_paymentsTab === 'finance' ? '' : 'hidden'}">
      <!-- Summary Cards -->
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px;">
        ${_finCard('Teacher Net Income (إيرادي الصافي المستحق من الحصص)', fmt(summary.totalTeacherDue || 0) + ' EGP', '#22c55e', `<polyline points="20 6 9 17 4 12"/>`)}
        ${_finCard('Total Center Dues (إجمالي دخل الحصص بالسنتر)', fmt(summary.totalDue || 0) + ' EGP', '#6366f1', `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`)}
        ${_finCard('Total Discounts (إجمالي الخصومات الممنوحة للطلاب)', fmt(summary.totalDiscount || 0) + ' EGP', '#f59e0b', `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`)}
      </div>

      <!-- Quick Info / Explanation Box -->
      <div class="card" style="background:rgba(99, 102, 241, 0.03);border:1px dashed var(--accent)">
        <div class="card-header" style="border-bottom:1px dashed var(--accent)">
          <span class="card-title" style="color:var(--accent)">💡 كيف يُحسب إيراد الحصص الصافي للمدرس؟</span>
        </div>
        <div class="card-body" style="padding:20px;font-size:13px;line-height:1.6;color:var(--text-secondary)">
          <p style="margin-bottom:10px">
            يُحسب دخل المدرس الصافي تلقائياً بناءً على الحضور الفعلي للطلاب في كل جلسة مع الخصم المحدد للسنتر:
          </p>
          <ul style="padding-left:20px;list-style-type:disc">
            <li style="margin-bottom:6px"><strong style="color:var(--text-primary)">صافي إيرادك للحصة:</strong> (سعر الحصة للطالب بعد الخصم) - (مبلغ خصم السنتر الفردي المكتوب في المجموعة).</li>
            <li><strong style="color:var(--text-primary)">الكتب:</strong> يتم متابعتها وتذكير الطلاب غير المسددين في تبويب <strong>Book Sales</strong>.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ── 2. Book Sales Tab ── -->
    <div id="pay-tab-books" class="${_paymentsTab === 'books' ? '' : 'hidden'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-weight:600;font-size:16px">📚 Book Sales Tracker</div>
        <button class="btn btn-primary" id="btn-add-book-sale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Record Book Sale
        </button>
      </div>
      <div id="books-section">${_buildBooksSection()}</div>
    </div>

    <!-- ── 3. Expenses Tab ── -->
    <div id="pay-tab-expenses" class="${_paymentsTab === 'expenses' ? '' : 'hidden'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-weight:600;font-size:16px">💸 Teacher Expenses</div>
        <button class="btn btn-primary" id="btn-add-expense">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Expense
        </button>
      </div>
      ${_buildExpensesSection()}
    </div>

    <!-- ── 4. Profit Tab ── -->
    <div id="pay-tab-profit" class="${_paymentsTab === 'profit' ? '' : 'hidden'}">
      <div id="profit-section">Loading profit data…</div>
    </div>
  `;

  // Bind events
  document.getElementById('btn-export-payments').addEventListener('click', exportPaymentsExcel);

  const addBookSaleBtn = document.getElementById('btn-add-book-sale');
  if (addBookSaleBtn) addBookSaleBtn.addEventListener('click', openRecordBookSaleModal);

  const addExpenseBtn = document.getElementById('btn-add-expense');
  if (addExpenseBtn) addExpenseBtn.addEventListener('click', openAddExpenseModal);

  if (_paymentsTab === 'profit') _renderProfitSection();
}

window.switchPayTab = function (tab) {
  _paymentsTab = tab;
  ['finance', 'books', 'expenses', 'profit'].forEach(t => {
    const el2 = document.getElementById(`pay-tab-${t}`);
    if (el2) el2.classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.wa-tabs .wa-tab').forEach((btn, i) => {
    const tabs = ['finance', 'books', 'expenses', 'profit'];
    btn.classList.toggle('active', tabs[i] === tab);
  });
  if (tab === 'profit') _renderProfitSection();
  if (tab === 'books') {
    const btn = document.getElementById('btn-add-book-sale');
    if (btn) btn.onclick = openRecordBookSaleModal;
  }
  if (tab === 'expenses') {
    const addExpBtn = document.getElementById('btn-add-expense');
    if (addExpBtn) addExpBtn.onclick = openAddExpenseModal;
  }
};

// ── 2. Book Sales Section Builder ────────────────────────────────────────────
function _buildBooksSection() {
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const totalSales = _booksData.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const paidSales = _booksData.filter(b => b.paid).reduce((s, b) => s + (Number(b.price) || 0), 0);
  const unpaidSales = totalSales - paidSales;

  if (!_booksData.length) {
    return `<div class="card"><div class="table-empty" style="padding:40px">No book sales recorded yet. Click "Record Book Sale" to add student book purchases.</div></div>`;
  }

  const rows = _booksData.map(b => {
    const statusBadge = b.paid
      ? `<span class="badge badge-green">Paid</span>`
      : `<span class="badge badge-red">Unpaid</span>`;
    return `
      <tr>
        <td style="font-weight:600">${_payEscape(b.studentName)}</td>
        <td style="font-weight:500;color:var(--accent)">${_payEscape(b.bookTitle)}</td>
        <td style="font-weight:700">${fmt(b.price)} EGP</td>
        <td>${statusBadge}</td>
        <td style="color:var(--text-secondary)">${b.date || (b.createdAt || '').slice(0, 10)}</td>
        <td style="text-align:right">
          <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
            ${!b.paid ? `
              <button class="btn btn-sm" style="background:rgba(37,211,102,0.12);color:#25D366;border:1px solid rgba(37,211,102,0.3);font-size:11px;padding:3px 8px;"
                onclick="sendBookPaymentReminder('${b.id}', '${_payEscape(b.studentName)}', '${_payEscape(b.bookTitle)}', ${b.price})">
                📱 Remind
              </button>
              <button class="btn btn-sm btn-success" onclick="toggleBookPaid('${b.id}', true)">Mark Paid</button>
            ` : `
              <button class="btn btn-sm btn-secondary" onclick="toggleBookPaid('${b.id}', false)">Mark Unpaid</button>
            `}
            <button class="btn btn-danger btn-sm" onclick="deleteBookSale('${b.id}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      ${_finCard('Total Book Sales', fmt(totalSales) + ' EGP', '#6366f1', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>')}
      ${_finCard('Collected Book Payments', fmt(paidSales) + ' EGP', '#22c55e', '<polyline points="20 6 9 17 4 12"/>')}
      ${_finCard('Unpaid Book Balance', fmt(unpaidSales) + ' EGP', unpaidSales > 0 ? '#ef4444' : '#22c55e', '<circle cx="12" cy="12" r="10"/>')}
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Book Sales Records</span>
        <span class="badge badge-muted">${_booksData.length} records</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Book Title</th><th>Price</th><th>Status</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

window.toggleBookPaid = async function(id, paid) {
  const res = await window.api.books.markPaid({ id, paid });
  if (res.success) {
    toast(paid ? 'Book sale marked as paid' : 'Book sale marked as unpaid', 'success');
    await renderPayments();
  } else {
    toast('Failed to update book sale', 'error');
  }
};

window.deleteBookSale = async function(id) {
  if (!confirmAction('Delete this book sale record?')) return;
  const res = await window.api.books.delete(id);
  if (res.success) {
    toast('Book sale deleted', 'success');
    await renderPayments();
  } else {
    toast('Failed to delete book sale', 'error');
  }
};

window.sendBookPaymentReminder = function (bookSaleId, studentName, bookTitle, price) {
  openModal({
    title: `Send WhatsApp Reminder — ${studentName}`,
    body: `
      <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">A WhatsApp reminder will be queued to the parent's phone for unpaid book: <strong>${bookTitle} (${price} EGP)</strong>.</p>
      <div class="form-group">
        <label class="form-label">Custom Message (optional — leave blank for default)</label>
        <textarea id="book-reminder-msg" class="form-textarea" placeholder="Leave empty to send default book reminder message…" rows="4"></textarea>
      </div>
      <div id="book-reminder-error" class="alert alert-error hidden"></div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="book-reminder-send-btn" style="background:#25D366;border-color:#25D366">📱 Send WhatsApp Reminder</button>`,
  });

  document.getElementById('book-reminder-send-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('book-reminder-error');
    errEl.classList.add('hidden');
    const customMessage = document.getElementById('book-reminder-msg').value.trim() || undefined;
    const btn = document.getElementById('book-reminder-send-btn');
    btn.disabled = true; btn.textContent = 'Sending…';

    const res = await window.api.books.queueReminder({ bookSaleId, customMessage });
    if (res.success) {
      closeModal();
      toast('WhatsApp book reminder queued successfully!', 'success');
    } else {
      errEl.textContent = res.message || 'Failed to queue reminder.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = '📱 Send WhatsApp Reminder';
    }
  });
};

function openRecordBookSaleModal() {
  const studentOptions = _paymentsStudents
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `<option value="${s.id}">${s.name}</option>`)
    .join('');

  const today = new Date().toISOString().slice(0, 10);

  openModal({
    title: 'Record Book Sale',
    body: `
      <div class="form-group">
        <label class="form-label">Student *</label>
        <select id="book-student-id" class="form-input">
          <option value="">— Select student —</option>
          ${studentOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Book Title *</label>
        <input id="book-title" type="text" class="form-input" placeholder="e.g. Physics WorkBook 2026">
      </div>
      <div class="form-group">
        <label class="form-label">Price (EGP) *</label>
        <input id="book-price" type="number" min="0" class="form-input" placeholder="e.g. 80">
      </div>
      <div class="form-group">
        <label class="form-label">Payment Status</label>
        <select id="book-paid-status" class="form-input">
          <option value="false">Unpaid (لم يدفع بعد)</option>
          <option value="true">Paid (تم الدفع)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input id="book-date" type="date" class="form-input" value="${today}">
      </div>
      <div id="book-error" class="alert alert-error hidden"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="book-submit-btn">Save Book Sale</button>
    `,
  });

  document.getElementById('book-submit-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('book-error');
    errEl.classList.add('hidden');

    const studentId = document.getElementById('book-student-id').value;
    const bookTitle = document.getElementById('book-title').value.trim();
    const price = document.getElementById('book-price').value;
    const paid = document.getElementById('book-paid-status').value === 'true';
    const date = document.getElementById('book-date').value;

    if (!studentId) { errEl.textContent = 'Please select a student.'; errEl.classList.remove('hidden'); return; }
    if (!bookTitle) { errEl.textContent = 'Please enter a book title.'; errEl.classList.remove('hidden'); return; }
    if (!price || Number(price) < 0) { errEl.textContent = 'Price must be a valid number.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('book-submit-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const res = await window.api.books.create({ studentId, bookTitle, price: Number(price), paid, date });
    if (res.success) {
      closeModal();
      toast('Book sale recorded successfully!', 'success');
      await renderPayments();
    } else {
      errEl.textContent = res.message || 'Failed to save book sale.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Save Book Sale';
    }
  });
}

// ── 3. Expense Section Builder ───────────────────────────────────────────────
function _buildExpensesSection() {
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const totalExp = _expensesData.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  if (!_expensesData.length) {
    return `<div class="card"><div class="table-empty" style="padding:40px">No expenses recorded yet. Click "Add Expense" to track teacher costs.</div></div>`;
  }

  const rows = _expensesData.map(e => `
    <tr>
      <td><span class="badge badge-purple" style="font-size:11px">${_payEscape(e.category)}</span></td>
      <td style="font-weight:500">${_payEscape(e.description || '—')}</td>
      <td style="font-weight:700;color:var(--red)">${fmt(e.amount)} EGP</td>
      <td style="color:var(--text-secondary)">${e.date || (e.createdAt || '').slice(0, 10)}</td>
      <td style="text-align:right">
        <button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')">Delete</button>
      </td>
    </tr>`).join('');

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">Expense Records</span>
        <span class="badge badge-muted">${_expensesData.length} records · Total: ${fmt(totalExp)} EGP</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function openAddExpenseModal() {
  const catOptions = _expenseCategories.map(c => `<option value="${_payEscape(c)}">${_payEscape(c)}</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);

  openModal({
    title: 'Add Teacher Expense',
    body: `
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select id="exp-category" class="form-input">
          <option value="">— Select Category —</option>
          ${catOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (EGP) *</label>
        <input id="exp-amount" type="number" min="1" class="form-input" placeholder="e.g. 1500">
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input id="exp-desc" type="text" class="form-input" placeholder="e.g. Assistant salary for April">
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input id="exp-date" type="date" class="form-input" value="${today}">
      </div>
      <div id="exp-error" class="alert alert-error hidden"></div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="exp-submit-btn">Save Expense</button>
    `,
  });

  document.getElementById('exp-submit-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('exp-error');
    errEl.classList.add('hidden');

    const category = document.getElementById('exp-category').value;
    const amount = document.getElementById('exp-amount').value;
    const description = document.getElementById('exp-desc').value;
    const date = document.getElementById('exp-date').value;

    if (!category) { errEl.textContent = 'Please select a category.'; errEl.classList.remove('hidden'); return; }
    if (!amount || Number(amount) <= 0) { errEl.textContent = 'Amount must be greater than zero.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('exp-submit-btn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const res = await window.api.expenses.create({ category, amount: Number(amount), description, date });
    if (res.success) {
      closeModal();
      toast('Expense recorded successfully!', 'success');
      await renderPayments();
    } else {
      errEl.textContent = res.message || 'Failed to save expense.';
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Save Expense';
    }
  });
}

// ── 4. Profit Dashboard ──────────────────────────────────────────────────────
async function _renderProfitSection() {
  const section = document.getElementById('profit-section');
  if (!section) return;
  section.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading profit dashboard…</div>';
  try {
    const [res, summary] = await Promise.all([
      window.api.expenses.profitSummary({}),
      window.api.reports.financialSummary(),
    ]);

    if (!res.success) { section.innerHTML = `<div class="alert alert-error">Failed to load profit data</div>`; return; }
    const fmt = (n) => (Number(n) || 0).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const attendanceIncome = summary?.totalTeacherDue || 0;
    const bookIncome = res.bookRevenue || 0;
    const totalExpenses = res.totalExpenses || 0;
    const netProfit = attendanceIncome + bookIncome - totalExpenses;

    const profitColor = netProfit >= 0 ? '#22c55e' : '#ef4444';

    const monthRows = (res.byMonth || []).map(m => `
      <tr>
        <td style="font-weight:600">${m.month}</td>
        <td style="color:var(--green)">${fmt(m.centerRevenue || 0)} EGP</td>
        <td style="color:var(--cyan)">${fmt(m.bookRevenue || 0)} EGP</td>
        <td style="color:var(--red)">${fmt(m.expenses)} EGP</td>
        <td style="font-weight:700;color:${m.profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(m.profit)} EGP</td>
      </tr>`).join('') || `<tr><td colspan="5" class="table-empty">No data yet</td></tr>`;

    const catRows = Object.entries(res.byCategory || {})
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `<tr><td><span class="badge badge-purple" style="font-size:11px">${_payEscape(cat)}</span></td><td style="color:var(--red);font-weight:600">${fmt(amt)} EGP</td></tr>`)
      .join('') || `<tr><td colspan="2" class="table-empty">No expenses</td></tr>`;

    section.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
        ${_finCard('Teacher Attendance Cut (إيراد الحصص)', fmt(attendanceIncome) + ' EGP', '#22c55e', '<polyline points="20 6 9 17 4 12"/>')}
        ${_finCard('Book Sales (وارد الكتب المحصل)', fmt(bookIncome) + ' EGP', '#06b6d4', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>')}
        ${_finCard('Total Expenses (المصاريف)', fmt(totalExpenses) + ' EGP', '#ef4444', '<line x1="5" y1="12" x2="19" y2="12"/>')}
        ${_finCard('Net Profit (صافي الربح)', fmt(netProfit) + ' EGP', profitColor, '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')}
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
        <div class="card">
          <div class="card-header"><span class="card-title">📅 Monthly Profit Breakdown</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Month</th><th>Attendance In</th><th>Books In</th><th>Expenses</th><th>Net Profit</th></tr></thead>
            <tbody>${monthRows}</tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📂 Expenses by Category</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Category</th><th>Total</th></tr></thead>
            <tbody>${catRows}</tbody>
          </table></div>
        </div>
      </div>`;
  } catch (e) {
    section.innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`;
  }
}

function _finCard(label, value, color, svgPath) {
  return `
    <div class="stat-card">
      <div class="stat-card-icon" style="background:${color}22;">
        <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${svgPath}</svg>
      </div>
      <div class="stat-card-value" style="color:${color};font-size:18px;">${value}</div>
      <div class="stat-card-label">${label}</div>
    </div>`;
}

async function exportPaymentsExcel() {
  if (!_booksData.length) return toast('No data to export', 'error');

  const rows = _booksData.map(b => ({
    studentName: b.studentName,
    bookTitle: b.bookTitle,
    price: b.price,
    status: b.paid ? 'Paid' : 'Unpaid',
    date: b.date || b.createdAt.slice(0, 10),
  }));

  const cols = [
    { key: 'studentName', label: 'Student Name' },
    { key: 'bookTitle', label: 'Book Title' },
    { key: 'price', label: 'Price (EGP)' },
    { key: 'status', label: 'Payment Status' },
    { key: 'date', label: 'Date' },
  ];

  const res = await window.api.export.excel({ sheetName: 'Book_Sales', columns: cols, rows, filename: 'Book_Sales_Export.xlsx' });
  if (res?.success) toast('Exported successfully', 'success');
  else if (res && !res.canceled) toast(res.error || 'Export failed', 'error');
}
