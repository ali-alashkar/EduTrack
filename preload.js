const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer
contextBridge.exposeInMainWorld('api', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  // Auth
  auth: {
    login: (data) => ipcRenderer.invoke('auth:login', data),
  },
  // Users
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (data) => ipcRenderer.invoke('users:create', data),
    delete: (id) => ipcRenderer.invoke('users:delete', id),
    updatePassword: (data) => ipcRenderer.invoke('users:update-password', data),
  },
  // Levels
  levels: {
    list: () => ipcRenderer.invoke('levels:list'),
    create: (data) => ipcRenderer.invoke('levels:create', data),
    update: (data) => ipcRenderer.invoke('levels:update', data),
    delete: (id) => ipcRenderer.invoke('levels:delete', id),
  },
  // Centers
  centers: {
    list: () => ipcRenderer.invoke('centers:list'),
    create: (data) => ipcRenderer.invoke('centers:create', data),
    update: (data) => ipcRenderer.invoke('centers:update', data),
    delete: (id) => ipcRenderer.invoke('centers:delete', id),
  },
  // Students
  students: {
    list: () => ipcRenderer.invoke('students:list'),
    create: (data) => ipcRenderer.invoke('students:create', data),
    update: (data) => ipcRenderer.invoke('students:update', data),
    delete: (id) => ipcRenderer.invoke('students:delete', id),
    byBarcode: (barcode) => ipcRenderer.invoke('students:by-barcode', barcode),
    block: (data) => ipcRenderer.invoke('students:block', data),
    unblock: (id) => ipcRenderer.invoke('students:unblock', id),
  },
  // Groups
  groups: {
    list: () => ipcRenderer.invoke('groups:list'),
    create: (data) => ipcRenderer.invoke('groups:create', data),
    update: (data) => ipcRenderer.invoke('groups:update', data),
    delete: (id) => ipcRenderer.invoke('groups:delete', id),
    addStudent: (data) => ipcRenderer.invoke('groups:add-student', data),
    removeStudent: (data) => ipcRenderer.invoke('groups:remove-student', data),
  },
  // Sessions
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    create: (data) => ipcRenderer.invoke('sessions:create', data),
    update: (data) => ipcRenderer.invoke('sessions:update', data),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
  },
  // Attendance
  attendance: {
    list: () => ipcRenderer.invoke('attendance:list'),
    bySession: (sessionId) => ipcRenderer.invoke('attendance:by-session', sessionId),
    scan: (data) => ipcRenderer.invoke('attendance:scan', data),
    update: (data) => ipcRenderer.invoke('attendance:update', data),
    manualAdd: (data) => ipcRenderer.invoke('attendance:manual-add', data),
    remove: (id) => ipcRenderer.invoke('attendance:remove', id),
  },
  // Quiz Scores
  quizzes: {
    list: () => ipcRenderer.invoke('quizzes:list'),
    bySession: (sessionId) => ipcRenderer.invoke('quizzes:by-session', sessionId),
    upsert: (data) => ipcRenderer.invoke('quizzes:upsert', data),
    remove: (id) => ipcRenderer.invoke('quizzes:remove', id),
  },
  // Reports
  reports: {
    studentSummary: (studentId) => ipcRenderer.invoke('reports:student-summary', studentId),
    sessionSummary: (sessionId) => ipcRenderer.invoke('reports:session-summary', sessionId),
    dashboard: () => ipcRenderer.invoke('reports:dashboard'),
  },
  // WhatsApp
  whatsapp: {
    init: () => ipcRenderer.invoke('whatsapp:init'),
    status: () => ipcRenderer.invoke('whatsapp:status'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    updateSettings: (data) => ipcRenderer.invoke('whatsapp:update-settings', data),
    getSettings: () => ipcRenderer.invoke('whatsapp:get-settings'),
    sendAttendance: (data) => ipcRenderer.invoke('whatsapp:send-attendance', data),
    sendHomework: (data) => ipcRenderer.invoke('whatsapp:send-homework', data),
    sendQuiz: (data) => ipcRenderer.invoke('whatsapp:send-quiz', data),
    sendSessionSummary: (data) => ipcRenderer.invoke('whatsapp:send-session-summary', data),
    sendSessionBatch: (data) => ipcRenderer.invoke('whatsapp:send-session-batch', data),
    getLog: (filters) => ipcRenderer.invoke('whatsapp:get-log', filters),
    retry: (messageId) => ipcRenderer.invoke('whatsapp:retry', messageId),
    resend: (messageId) => ipcRenderer.invoke('whatsapp:resend', messageId),
    getSessionStatus: (sessionId) => ipcRenderer.invoke('whatsapp:get-session-status', sessionId),
    onQr: (cb) => ipcRenderer.on('whatsapp:qr', (_, qr) => cb(qr)),
    onReady: (cb) => ipcRenderer.on('whatsapp:ready', () => cb()),
    onDisconnected: (cb) => ipcRenderer.on('whatsapp:disconnected', () => cb()),
    onMessageSent: (cb) => ipcRenderer.on('whatsapp:message-sent', (_, data) => cb(data)),
    onStatusChange: (cb) => ipcRenderer.on('whatsapp:status-change', (_, status) => cb(status)),
  }
});
