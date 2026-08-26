const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const { roundMoney } = require('../helpers');

// Valid expense categories
const EXPENSE_CATEGORIES = [
  'مرتب أسيستنت (Assistant Salary)',
  'طباعة وتصوير (Printing & Copies)',
  'مواد تعليمية (Educational Materials)',
  'إيجار قاعة (Hall Rent)',
  'تسويق ودعاية (Marketing)',
  'برامج وتقنية (Software & Tech)',
  'أخرى (Other)',
];

function registerExpenseHandlers() {
  ipcMain.handle('expenses:categories', () => EXPENSE_CATEGORIES);

  ipcMain.handle('expenses:list', () => {
    return readDB('expenses').sort((a, b) =>
      (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')
    );
  });

  ipcMain.handle('expenses:create', (_, data) => {
    const { category, description, amount, date, createdBy } = data || {};
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0)
      return { success: false, message: 'Amount must be a positive number' };
    if (!category)
      return { success: false, message: 'Category is required' };

    const expenses = readDB('expenses');
    const record = {
      id: makeId('exp'),
      category: String(category).trim(),
      description: String(description || '').trim(),
      amount: roundMoney(numAmount),
      date: date || new Date().toISOString().slice(0, 10),
      createdBy: String(createdBy || '').trim(),
      createdAt: new Date().toISOString(),
    };
    writeDB('expenses', [...expenses, record]);
    return { success: true, record };
  });

  ipcMain.handle('expenses:update', (_, { id, ...data }) => {
    const expenses = readDB('expenses');
    const existing = expenses.find(e => e.id === id);
    if (!existing) return { success: false, message: 'Expense not found' };

    const numAmount = data.amount != null ? Number(data.amount) : null;
    if (numAmount !== null && (isNaN(numAmount) || numAmount <= 0))
      return { success: false, message: 'Amount must be a positive number' };

    const updated = expenses.map(e =>
      e.id === id
        ? {
            ...e,
            ...data,
            amount: numAmount !== null ? roundMoney(numAmount) : e.amount,
            updatedAt: new Date().toISOString(),
          }
        : e
    );
    writeDB('expenses', updated);
    return { success: true };
  });

  ipcMain.handle('expenses:delete', (_, id) => {
    if (id) recordTombstones('expenses', id);
    writeDB('expenses', readDB('expenses').filter(e => e.id !== id));
    return { success: true };
  });

  // ── Profit Summary ─────────────────────────────────────────────────────────
  ipcMain.handle('expenses:profit-summary', (_, { month } = {}) => {
    const expenses = readDB('expenses');
    const payments = readDB('payments');
    const books = readDB('books_sales').filter(b => b.paid); // Only collected book sales

    // Helper to get YYYY-MM from a date string
    const toMonth = (dateStr) => (dateStr || '').slice(0, 7);

    const filterByMonth = (items, dateField) =>
      month
        ? items.filter(i => toMonth(i[dateField] || i.createdAt) === month)
        : items;

    const filteredExpenses = filterByMonth(expenses, 'date');
    const filteredPayments = filterByMonth(payments, 'date');
    const filteredBooks = filterByMonth(books, 'date');

    const totalExpenses = roundMoney(
      filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    );
    const centerRevenue = roundMoney(
      filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    );
    const bookRevenue = roundMoney(
      filteredBooks.reduce((sum, b) => sum + (Number(b.price) || 0), 0)
    );

    const totalRevenue = roundMoney(centerRevenue + bookRevenue);
    const netProfit = roundMoney(totalRevenue - totalExpenses);

    // Build monthly breakdown from ALL data (regardless of filter)
    const monthMap = new Map();
    for (const e of expenses) {
      const m = toMonth(e.date || e.createdAt);
      if (!m) continue;
      const cur = monthMap.get(m) || { month: m, expenses: 0, centerRevenue: 0, bookRevenue: 0, revenue: 0 };
      cur.expenses = roundMoney(cur.expenses + (Number(e.amount) || 0));
      monthMap.set(m, cur);
    }
    for (const p of payments) {
      const m = toMonth(p.date || p.createdAt);
      if (!m) continue;
      const cur = monthMap.get(m) || { month: m, expenses: 0, centerRevenue: 0, bookRevenue: 0, revenue: 0 };
      cur.centerRevenue = roundMoney(cur.centerRevenue + (Number(p.amount) || 0));
      cur.revenue = roundMoney(cur.revenue + (Number(p.amount) || 0));
      monthMap.set(m, cur);
    }
    for (const b of books) {
      const m = toMonth(b.date || b.createdAt);
      if (!m) continue;
      const cur = monthMap.get(m) || { month: m, expenses: 0, centerRevenue: 0, bookRevenue: 0, revenue: 0 };
      cur.bookRevenue = roundMoney(cur.bookRevenue + (Number(b.price) || 0));
      cur.revenue = roundMoney(cur.revenue + (Number(b.price) || 0));
      monthMap.set(m, cur);
    }

    const byMonth = [...monthMap.values()]
      .map(r => ({ ...r, profit: roundMoney(r.revenue - r.expenses) }))
      .sort((a, b) => b.month.localeCompare(a.month));

    // Category breakdown for filtered period
    const byCategory = {};
    for (const e of filteredExpenses) {
      byCategory[e.category] = roundMoney(
        (byCategory[e.category] || 0) + (Number(e.amount) || 0)
      );
    }

    return {
      success: true,
      centerRevenue,
      bookRevenue,
      totalRevenue,
      totalExpenses,
      netProfit,
      byMonth,
      byCategory,
    };
  });
}

module.exports = registerExpenseHandlers;
