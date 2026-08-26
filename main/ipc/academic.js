const { ipcMain } = require('electron');
const { readDB, writeDB, recordTombstones, makeId } = require('../db');
const { syncLevelNameReferences, syncCenterNameReferences } = require('../helpers');

function registerAcademicHandlers() {
  // ── Levels ──
  ipcMain.handle('levels:list', () => readDB('levels'));
  
  ipcMain.handle('levels:create', (_, data) => {
    const levels = readDB('levels');
    if (levels.find(l => l.name === data.name)) return { success: false, message: 'Level already exists' };
    const level = { id: makeId('lv'), ...data, createdAt: new Date().toISOString() };
    writeDB('levels', [...levels, level]);
    return { success: true, level };
  });
  
  ipcMain.handle('levels:update', (_, { id, ...data }) => {
    const existingLevel = readDB('levels').find(l => l.id === id);
    const updatedAt = new Date().toISOString();
    const levels = readDB('levels').map(l => l.id === id ? { ...l, ...data, updatedAt } : l);
    writeDB('levels', levels);
    syncLevelNameReferences(id, existingLevel?.name, data.name);
    return { success: true };
  });
  
  ipcMain.handle('levels:delete', (_, id) => {
    if (id) recordTombstones('levels', id);
    writeDB('levels', readDB('levels').filter(l => l.id !== id));
    return { success: true };
  });

  // ── Centers ──
  ipcMain.handle('centers:list', () => readDB('centers'));
  
  ipcMain.handle('centers:create', (_, data) => {
    const centers = readDB('centers');
    const center = { id: makeId('c'), ...data, grades: data.grades || [], createdAt: new Date().toISOString() };
    writeDB('centers', [...centers, center]);
    return { success: true, center };
  });
  
  ipcMain.handle('centers:update', (_, { id, ...data }) => {
    const existingCenter = readDB('centers').find(c => c.id === id);
    const updatedAt = new Date().toISOString();
    const centers = readDB('centers').map(c => c.id === id ? { ...c, ...data, updatedAt } : c);
    writeDB('centers', centers);
    syncCenterNameReferences(id, existingCenter?.name, data.name);
    return { success: true };
  });
  
  ipcMain.handle('centers:delete', (_, id) => {
    if (id) recordTombstones('centers', id);
    writeDB('centers', readDB('centers').filter(c => c.id !== id));
    return { success: true };
  });

  // ── Groups ──
  ipcMain.handle('groups:list', () => readDB('groups'));
  
  ipcMain.handle('groups:create', (_, data) => {
    const groups = readDB('groups');
    const group = { id: makeId('g'), ...data, studentIds: data.studentIds || [], createdAt: new Date().toISOString() };
    writeDB('groups', [...groups, group]);
    return { success: true, group };
  });
  
  ipcMain.handle('groups:update', (_, { id, ...data }) => {
    const updatedAt = new Date().toISOString();
    const groups = readDB('groups').map(g => g.id === id ? { ...g, ...data, updatedAt } : g);
    writeDB('groups', groups);
    return { success: true };
  });
  
  ipcMain.handle('groups:delete', (_, id) => {
    if (id) recordTombstones('groups', id);
    writeDB('groups', readDB('groups').filter(g => g.id !== id));
    return { success: true };
  });
  
  ipcMain.handle('groups:add-student', (_, { groupId, studentId }) => {
    const updatedAt = new Date().toISOString();
    const groups = readDB('groups').map(g => {
      if (g.id !== groupId) return g;
      const ids = new Set(g.studentIds || []);
      ids.add(studentId);
      return { ...g, studentIds: [...ids], updatedAt };
    });
    writeDB('groups', groups);
    return { success: true };
  });
  
  ipcMain.handle('groups:remove-student', (_, { groupId, studentId }) => {
    const updatedAt = new Date().toISOString();
    const groups = readDB('groups').map(g => {
      if (g.id !== groupId) return g;
      return { ...g, studentIds: (g.studentIds || []).filter(id => id !== studentId), updatedAt };
    });
    writeDB('groups', groups);
    return { success: true };
  });
}

module.exports = registerAcademicHandlers;
