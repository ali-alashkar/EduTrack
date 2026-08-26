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
    block: (data) => ipcRenderer.invoke('students:block', data),
    unblock: (data) => ipcRenderer.invoke('students:unblock', data),
    delete: (id) => ipcRenderer.invoke('students:delete', id),
    byBarcode: (barcode) => ipcRenderer.invoke('students:by-barcode', barcode),
    bulkAssignGroup: (data) => ipcRenderer.invoke('students:bulk-assign-group', data),
    bulkUpdateLevel: (data) => ipcRenderer.invoke('students:bulk-update-level', data),
    bulkUpdateCenter: (data) => ipcRenderer.invoke('students:bulk-update-center', data),
    bulkBlock: (data) => ipcRenderer.invoke('students:bulk-block', data),
    bulkUnblock: (data) => ipcRenderer.invoke('students:bulk-unblock', data),
    bulkDelete: (data) => ipcRenderer.invoke('students:bulk-delete', data),
    bulkNote: (data) => ipcRenderer.invoke('students:bulk-note', data),
    bulkMoveGroup: (data) => ipcRenderer.invoke('students:bulk-move-group', data),
    timeline: (studentId) => ipcRenderer.invoke('students:timeline', studentId),
    blockHistory: (studentId) => ipcRenderer.invoke('students:block-history', studentId),
    generateBarcode: (studentId) => ipcRenderer.invoke('students:generate-barcode', studentId),
    bulkGenerateBarcodes: () => ipcRenderer.invoke('students:bulk-generate-barcodes'),
    exportBarcodesZip: (data) => ipcRenderer.invoke('barcodes:export-zip', data),
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
    duplicate: (data) => ipcRenderer.invoke('sessions:duplicate', data),
    createRecurring: (data) => ipcRenderer.invoke('sessions:create-recurring', data),
  },
  // Attendance
  attendance: {
    list: () => ipcRenderer.invoke('attendance:list'),
    bySession: (sessionId) => ipcRenderer.invoke('attendance:by-session', sessionId),
    scan: (data) => ipcRenderer.invoke('attendance:scan', data),
    update: (data) => ipcRenderer.invoke('attendance:update', data),
    manualAdd: (data) => ipcRenderer.invoke('attendance:manual-add', data),
    remove: (id) => ipcRenderer.invoke('attendance:remove', id),
    transfer: (data) => ipcRenderer.invoke('attendance:transfer', data),
    reassignStudent: (data) => ipcRenderer.invoke('attendance:reassign-student', data),
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
    financialSummary: () => ipcRenderer.invoke('reports:financial-summary'),
  },
  // WhatsApp
  whatsapp: {
    init: () => ipcRenderer.invoke('whatsapp:init'),
    status: () => ipcRenderer.invoke('whatsapp:status'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    clearAuth: () => ipcRenderer.invoke('whatsapp:clear-auth'),
    updateSettings: (data) => ipcRenderer.invoke('whatsapp:update-settings', data),
    getSettings: () => ipcRenderer.invoke('whatsapp:get-settings'),
    sendAttendance: (data) => ipcRenderer.invoke('whatsapp:send-attendance', data),
    sendHomework: (data) => ipcRenderer.invoke('whatsapp:send-homework', data),
    sendQuiz: (data) => ipcRenderer.invoke('whatsapp:send-quiz', data),
    sendSessionSummary: (data) => ipcRenderer.invoke('whatsapp:send-session-summary', data),
    sendSessionBatch: (data) => ipcRenderer.invoke('whatsapp:send-session-batch', data),
    sendAbsenceBatch: (data) => ipcRenderer.invoke('whatsapp:send-absence-batch', data),
    sendBarcode: (data) => ipcRenderer.invoke('whatsapp:send-barcode', data),
    sendReport: (data) => ipcRenderer.invoke('whatsapp:send-report', data),
    queueReport: (data) => ipcRenderer.invoke('whatsapp:queue-report', data),
    getLog: (filters) => ipcRenderer.invoke('whatsapp:get-log', filters),
    retry: (messageId) => ipcRenderer.invoke('whatsapp:retry', messageId),
    resend: (messageId) => ipcRenderer.invoke('whatsapp:resend', messageId),
    getSessionStatus: (sessionId) => ipcRenderer.invoke('whatsapp:get-session-status', sessionId),
    onQr: (cb) => ipcRenderer.on('whatsapp:qr', (_, qr) => cb(qr)),
    onReady: (cb) => ipcRenderer.on('whatsapp:ready', () => cb()),
    onDisconnected: (cb) => ipcRenderer.on('whatsapp:disconnected', () => cb()),
    onMessageSent: (cb) => ipcRenderer.on('whatsapp:message-sent', (_, data) => cb(data)),
    onStatusChange: (cb) => ipcRenderer.on('whatsapp:status-change', (_, status) => cb(status)),

    // Templates
    listTemplates: () => ipcRenderer.invoke('templates:list'),
    saveTemplate: (data) => ipcRenderer.invoke('templates:save', data),
    deleteTemplate: (data) => ipcRenderer.invoke('templates:delete', data),
    resetTemplates: () => ipcRenderer.invoke('templates:reset'),
  },
  // Backup
  backup: {
    getSettings: () => ipcRenderer.invoke('backup:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('backup:update-settings', settings),
    list: () => ipcRenderer.invoke('backup:list'),
    create: () => ipcRenderer.invoke('backup:create'),
    delete: (filename) => ipcRenderer.invoke('backup:delete', filename),
    restore: (filename) => ipcRenderer.invoke('backup:restore', filename),
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
    checkReminder: () => ipcRenderer.invoke('backup:check-reminder'),
  },
  // System Data Integrity / Recovery + Phase 1 Setup
  system: {
    getCorruptedFiles: () => ipcRenderer.invoke('system:get-corrupted-files'),
    resetCorruptedFiles: () => ipcRenderer.invoke('system:reset-corrupted-files'),
    relaunch: () => ipcRenderer.send('system:relaunch'),
    quit: () => ipcRenderer.send('system:quit'),
    // Setup Wizard (Phase 1)
    getSetupState: () => ipcRenderer.invoke('system:get-setup-state'),
    completeSetup: (data) => ipcRenderer.invoke('system:complete-setup', data),
    // Security (Phase 1)
    hasDefaultCredentials: () => ipcRenderer.invoke('system:has-default-credentials'),
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
    getAppInfo: () => ipcRenderer.invoke('system:get-app-info'),
  },
  // Payments (Admin-Only – Phase 2)
  payments: {
    list:               ()         => ipcRenderer.invoke('payments:list'),
    byStudent:          (id)       => ipcRenderer.invoke('payments:by-student', id),
    create:             (data)     => ipcRenderer.invoke('payments:create', data),
    delete:             (id)       => ipcRenderer.invoke('payments:delete', id),
    studentBalance:     (id)       => ipcRenderer.invoke('payments:student-balance', id),
    receipt:            (id)       => ipcRenderer.invoke('payments:receipt', id),
    setSessionStatus:   (data)     => ipcRenderer.invoke('payments:set-session-status', data),
    getSessionStatuses: (id)       => ipcRenderer.invoke('payments:get-session-statuses', id),
    queueReminder:      (data)     => ipcRenderer.invoke('payments:queue-reminder', data),
  },
  // Expenses (Admin-Only – Phase 2)
  expenses: {
    categories:    ()       => ipcRenderer.invoke('expenses:categories'),
    list:          ()       => ipcRenderer.invoke('expenses:list'),
    create:        (data)   => ipcRenderer.invoke('expenses:create', data),
    update:        (data)   => ipcRenderer.invoke('expenses:update', data),
    delete:        (id)     => ipcRenderer.invoke('expenses:delete', id),
    profitSummary: (data)   => ipcRenderer.invoke('expenses:profit-summary', data),
  },
  // Books (Book Sales)
  books: {
    list:          ()       => ipcRenderer.invoke('books:list'),
    create:        (data)   => ipcRenderer.invoke('books:create', data),
    markPaid:      (data)   => ipcRenderer.invoke('books:mark-paid', data),
    delete:        (id)     => ipcRenderer.invoke('books:delete', id),
    summary:       ()       => ipcRenderer.invoke('books:summary'),
    queueReminder: (data)   => ipcRenderer.invoke('books:queue-reminder', data),
  },
  // Phase 3 – Excel Export
  export: {
    excel: (data) => ipcRenderer.invoke('export:excel', data),
  },
  // Phase 3 – Import
  import: {
    studentsPreview: ()       => ipcRenderer.invoke('import:students-preview'),
    studentsCommit:  (data)   => ipcRenderer.invoke('import:students-commit', data),
    studentsTemplate: ()      => ipcRenderer.invoke('import:students-template'),
  },
  // Cloud Sync (Google Drive)
  sync: {
    getStatus:      ()                           => ipcRenderer.invoke('sync:get-status'),
    getAuthUrl:     (data)                       => ipcRenderer.invoke('sync:get-auth-url', data),
    exchangeCode:   (data)                       => ipcRenderer.invoke('sync:exchange-code', data),
    disconnect:     ()                           => ipcRenderer.invoke('sync:disconnect'),
    forceUpload:    ()                           => ipcRenderer.invoke('sync:force-upload'),
    forceDownload:  ()                           => ipcRenderer.invoke('sync:force-download'),
    onStatusChange: (cb)                         => ipcRenderer.on('sync:status-change', (_, s) => cb(s)),
    onDataUpdated:  (cb)                         => ipcRenderer.on('sync:data-updated', () => cb()),
  },
});
