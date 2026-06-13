// ── WhatsApp Service ──────────────────────────────────────────────────────────
// Manages the whatsapp-web.js client, message queue, and phone formatting.
// Runs entirely in the Electron main process.

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { getRandomTemplate } = require('./whatsapp-templates');

class WhatsAppService {
  constructor({ dataDir, onQr, onReady, onDisconnected, onMessageSent, onStatusChange, getTemplates }) {
    this.dataDir = dataDir;
    this.onQr = onQr || (() => {});
    this.onReady = onReady || (() => {});
    this.onDisconnected = onDisconnected || (() => {});
    this.onMessageSent = onMessageSent || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.getTemplates = getTemplates || (() => null);

    this.client = null;
    this.status = 'disconnected'; // disconnected | connecting | qr_ready | connected
    this.queue = [];
    this.isProcessingQueue = false;
    this.settings = {
      autoSendAttendance: true,
      autoSendHomework: true,
      autoSendQuiz: true,
      countryCode: '20', // Egypt
      minDelay: 5000,    // 5 seconds
      maxDelay: 15000,   // 15 seconds
    };
  }

  // ── Initialize Client ──
  async init() {
    if (this.client) {
      // Already initialized
      if (this.status === 'connected') return { success: true, status: 'connected' };
      // Destroy old one
      try { await this.client.destroy(); } catch (e) { /* ignore */ }
    }

    this._setStatus('connecting');

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(this.dataDir, 'whatsapp_auth'),
      }),
      puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // ← add this
        headless: true,
        timeout: 60000,          // ← wait up to 60s to launch
         protocolTimeout: 60000,  // ← wait up to 60s for CDP commands
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',      // ← add this
          '--disable-default-apps',    // ← add this
        ],
      },
    });

    this.client.on('qr', async (qr) => {
      this._setStatus('qr_ready');
      try {
        const qrDataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
        this.onQr(qrDataUrl);
      } catch (e) {
        console.error('QR generation error:', e);
      }
    });

    this.client.on('ready', () => {
      this._setStatus('connected');
      this.onReady();
      console.log('[WhatsApp] Client ready!');
    });

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] Auth failure:', msg);
      this._setStatus('disconnected');
      this.onDisconnected();
    });

    this.client.on('disconnected', (reason) => {
      console.log('[WhatsApp] Disconnected:', reason);
      this._setStatus('disconnected');
      this.onDisconnected();
    });

    try {
      await this.client.initialize();
      return { success: true, status: this.status };
    } catch (err) {
      console.error('[WhatsApp] Init error:', err);
      this._setStatus('disconnected');
      return { success: false, error: err.message };
    }
  }

  // ── Disconnect ──
  async disconnect() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (e) {
        try { await this.client.destroy(); } catch (e2) { /* ignore */ }
      }
      this.client = null;
    }
    this._setStatus('disconnected');
    this.onDisconnected();
    return { success: true };
  }

  // ── Status ──
  getStatus() {
    return {
      status: this.status,
      queueLength: this.queue.length,
      isProcessing: this.isProcessingQueue,
      settings: { ...this.settings },
    };
  }

  _setStatus(status) {
    this.status = status;
    this.onStatusChange(status);
  }

  // ── Phone Formatting ──
  formatPhone(phone) {
    if (!phone) return null;
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    // If starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      cleaned = this.settings.countryCode + cleaned.substring(1);
    }
    // If doesn't start with country code and is short, prepend it
    if (!cleaned.startsWith(this.settings.countryCode) && cleaned.length <= 10) {
      cleaned = this.settings.countryCode + cleaned;
    }
    return cleaned + '@c.us';
  }

  // ── Send Single Message ──
  async sendMessage(phone, text) {
    if (this.status !== 'connected') {
      return { success: false, error: 'WhatsApp not connected' };
    }
    if (!phone) {
      return { success: false, error: 'No phone number' };
    }

    const chatId = this.formatPhone(phone);
    if (!chatId) {
      return { success: false, error: 'Invalid phone number' };
    }

    try {
      await this.client.sendMessage(chatId, text);
      return { success: true, chatId };
    } catch (err) {
      console.error('[WhatsApp] Send error:', err);
      return { success: false, error: err.message };
    }
  }

  // ── Queue a Message ──
  queueMessage(messageRecord) {
    this.queue.push(messageRecord);
    if (!this.isProcessingQueue) {
      this._processQueue();
    }
  }

  // ── Process Queue (one-by-one with random delays) ──
  async _processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const record = this.queue.shift();

      // Skip if no phone
      if (!record.parentPhone) {
        record.status = 'no_phone';
        this.onMessageSent(record);
        continue;
      }

      // Skip if not connected
      if (this.status !== 'connected') {
        record.status = 'failed';
        record.error = 'WhatsApp not connected';
        this.onMessageSent(record);
        continue;
      }

      // Send the message
      const result = await this.sendMessage(record.parentPhone, record.messageText);

      if (result.success) {
        record.status = 'sent';
        record.sentAt = new Date().toISOString();
      } else {
        record.status = 'failed';
        record.error = result.error;
      }

      this.onMessageSent(record);

      // Random delay between messages (anti-ban)
      if (this.queue.length > 0) {
        const delay = this.settings.minDelay +
          Math.random() * (this.settings.maxDelay - this.settings.minDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.isProcessingQueue = false;
  }

  // ── Update Settings ──
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    return { success: true, settings: { ...this.settings } };
  }

  // ── Generate Message Record ──
  createMessageRecord({ type, student, session, attendanceRecord, quizScore, quizMax }) {
    let checkInTimeStr = '';
    if (attendanceRecord?.checkInTime) {
      const dt = new Date(attendanceRecord.checkInTime);
      if (!isNaN(dt.getTime())) {
        checkInTimeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
    }

    let blockReasonStr = '';
    if (student?.isBlocked) {
      blockReasonStr = type === 'block'
        ? (student.blockReason || 'No reason recorded')
        : `\n🚫 الطالب موقوف: ${student.blockReason || 'بدون سبب'}`;
    }

    const data = {
      studentName: student.name,
      sessionTitle: session.title,
      date: session.date,
      time: session.time || '',
      checkInTime: checkInTimeStr,
      blockReason: blockReasonStr,
      homeworkStatus: attendanceRecord?.homeworkStatus || '',
      homeworkNote: attendanceRecord?.homeworkNote || '',
      quizScore: quizScore ?? '',
      quizMax: quizMax ?? '',
      quizPercent: quizMax ? Math.round((quizScore / quizMax) * 100) : '',
    };

    // Determine template category
    let category = type;
    if (type === 'attendance' && attendanceRecord?.homeworkStatus && attendanceRecord.homeworkStatus !== 'pending') {
      category = 'attendance_homework';
    } else if (type === 'session_summary') {
      category = 'session_summary';
    } else if (type === 'absence') {
      category = 'absence';
    }

    const customTemplates = this.getTemplates();
    const { text, templateId, templateIndex } = getRandomTemplate(category, data, customTemplates);

    return {
      id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      studentId: student.id,
      studentName: student.name,
      parentPhone: student.parentPhone || '',
      sessionId: session.id,
      sessionTitle: session.title,
      type,
      messageText: text,
      templateId,
      templateIndex,
      status: 'queued',
      error: '',
      sentAt: '',
      createdAt: new Date().toISOString(),
    };
  }
}

module.exports = WhatsAppService;
