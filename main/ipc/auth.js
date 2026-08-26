const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');

function registerAuthHandlers() {
  // ── Auth ──
  ipcMain.handle('auth:login', (_, { username, password }) => {
    const users = readDB('users');
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, message: 'Invalid credentials' };
    const { password: _pw, ...safe } = user;
    return { success: true, user: safe };
  });

  // ── Users ──
  ipcMain.handle('users:list', () => readDB('users').map(({ password: _pw, ...u }) => u));
  
  ipcMain.handle('users:create', (_, data) => {
    const users = readDB('users');
    if (users.find(u => u.username === data.username)) return { success: false, message: 'Username already exists' };
    const user = { id: makeId('u'), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeDB('users', [...users, user]);
    return { success: true };
  });
  
  ipcMain.handle('users:delete', (_, id) => {
    if (id) recordTombstones('users', id);
    const users = readDB('users').filter(u => u.id !== id);
    writeDB('users', users);
    return { success: true };
  });
  
  ipcMain.handle('users:update-password', (_, { id, newPassword }) => {
    const users = readDB('users').map(u => u.id === id ? { ...u, password: newPassword, updatedAt: new Date().toISOString() } : u);
    writeDB('users', users);
    return { success: true };
  });
}

module.exports = registerAuthHandlers;
