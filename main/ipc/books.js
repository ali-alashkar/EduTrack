const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const { roundMoney, saveWaLogRecord } = require('../helpers');

function registerBookHandlers() {
  // List all book sales
  ipcMain.handle('books:list', () => {
    return readDB('books_sales').sort((a, b) =>
      (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')
    );
  });

  // Create book sale record
  ipcMain.handle('books:create', (_, data) => {
    const { studentId, bookTitle, price, paid, date } = data || {};
    const student = readDB('students').find(s => s.id === studentId);
    if (!student) return { success: false, message: 'Student not found' };

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return { success: false, message: 'Price must be a valid non-negative number' };
    }
    if (!bookTitle || !String(bookTitle).trim()) {
      return { success: false, message: 'Book title is required' };
    }

    const books = readDB('books_sales');
    const isPaid = !!paid;
    const record = {
      id: makeId('book'),
      studentId: student.id,
      studentName: student.name,
      bookTitle: String(bookTitle).trim(),
      price: roundMoney(numPrice),
      paid: isPaid,
      paidAt: isPaid ? new Date().toISOString() : null,
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    writeDB('books_sales', [...books, record]);
    return { success: true, record };
  });

  // Toggle or set paid status for a book sale
  ipcMain.handle('books:mark-paid', (_, { id, paid }) => {
    const books = readDB('books_sales');
    const existing = books.find(b => b.id === id);
    if (!existing) return { success: false, message: 'Book sale record not found' };

    const isPaid = paid !== undefined ? !!paid : !existing.paid;
    const updated = books.map(b =>
      b.id === id
        ? {
            ...b,
            paid: isPaid,
            paidAt: isPaid ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    writeDB('books_sales', updated);
    return { success: true };
  });

  // Delete book sale record
  ipcMain.handle('books:delete', (_, id) => {
    if (id) recordTombstones('books_sales', id);
    writeDB('books_sales', readDB('books_sales').filter(b => b.id !== id));
    return { success: true };
  });

  // Summary stats for book sales
  ipcMain.handle('books:summary', () => {
    const books = readDB('books_sales');
    let totalSales = 0;
    let totalCollected = 0;
    let totalUnpaid = 0;

    for (const b of books) {
      const price = Number(b.price) || 0;
      totalSales += price;
      if (b.paid) {
        totalCollected += price;
      } else {
        totalUnpaid += price;
      }
    }

    return {
      success: true,
      totalSales: roundMoney(totalSales),
      totalCollected: roundMoney(totalCollected),
      totalUnpaid: roundMoney(totalUnpaid),
      count: books.length,
      unpaidCount: books.filter(b => !b.paid).length,
    };
  });

  // WhatsApp Reminder for Unpaid Book
  ipcMain.handle('books:queue-reminder', (_, { bookSaleId, customMessage }) => {
    const context = require('../context');
    const books = readDB('books_sales');
    const bookSale = books.find(b => b.id === bookSaleId);
    if (!bookSale) return { success: false, message: 'Book sale record not found' };
    if (bookSale.paid) return { success: false, message: 'Book is already paid for' };

    const student = readDB('students').find(s => s.id === bookSale.studentId);
    if (!student) return { success: false, message: 'Student not found' };
    if (!student.parentPhone) return { success: false, message: 'No parent phone recorded for this student' };

    const messageText = customMessage ||
      `السلام عليكم ورحمة الله وبركاته،\n` +
      `تذكير بشأن استلام كتاب/ملزمة:\n` +
      `اسم الطالب: ${student.name}\n` +
      `اسم الكتاب: ${bookSale.bookTitle}\n` +
      `المبلغ المستحق: ${bookSale.price.toLocaleString()} ج.م\n\n` +
      `يرجى سداد قيمة الكتاب في أقرب وقت. شكراً لكم!`;

    const waService = context.getWaService();
    if (!waService) return { success: false, message: 'WhatsApp service is not available' };

    const record = {
      id: makeId('wa_book'),
      type: 'book_reminder',
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone,
      sessionId: '',
      sessionTitle: bookSale.bookTitle,
      messageText,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    saveWaLogRecord(record);
    waService.queueMessage(record);
    return { success: true, record };
  });
}

module.exports = registerBookHandlers;
