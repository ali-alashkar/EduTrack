const context = {
  mainWindow: null,
  waService: null,
  getMainWindow() { return this.mainWindow; },
  setMainWindow(win) { this.mainWindow = win; },
  getWaService() { return this.waService; },
  setWaService(svc) { this.waService = svc; }
};

module.exports = context;
