/**
 * db.js — IndexedDB 数据存储层
 * 替代 Python SQLite，4 个 store：config、references、preferences、contents
 */

const DB_NAME = 'BeiboAgent';
const DB_VERSION = 2;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('references')) {
        const s = db.createObjectStore('references', { keyPath: 'id', autoIncrement: true });
        s.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains('preferences')) {
        const s = db.createObjectStore('preferences', { keyPath: 'id', autoIncrement: true });
        s.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains('contents')) {
        const s = db.createObjectStore('contents', { keyPath: 'id', autoIncrement: true });
        s.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains('favorites')) {
        const s = db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
        s.createIndex('created_at', 'created_at');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ── Config ──

async function getConfig() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('config', 'readonly');
    const req = tx.objectStore('config').get('main');
    req.onsuccess = () => resolve(req.result || {
      key: 'main',
      industry_name: '',
      company_name: '',
      company_desc: '',
      writing_guide: ''
    });
  });
}

async function saveConfig(cfg) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('config', 'readwrite');
    tx.objectStore('config').put({ key: 'main', ...cfg });
    tx.oncomplete = () => resolve();
  });
}

// ── References ──

async function getReferences() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('references', 'readonly');
    const req = tx.objectStore('references').getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.id - a.id));
  });
}

async function addReference(title, content, analysis) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('references', 'readwrite');
    const req = tx.objectStore('references').add({
      title, content, analysis: analysis || '',
      created_at: new Date().toISOString()
    });
    req.onsuccess = () => resolve(req.result);
  });
}

async function deleteReference(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('references', 'readwrite');
    tx.objectStore('references').delete(id);
    tx.oncomplete = () => resolve();
  });
}

// ── Preferences ──

async function getPreferences() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('preferences', 'readonly');
    const req = tx.objectStore('preferences').getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.id - a.id));
  });
}

async function addPreference(rule, source_feedback) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('preferences', 'readwrite');
    const req = tx.objectStore('preferences').add({
      rule, source_feedback: source_feedback || '',
      created_at: new Date().toISOString()
    });
    req.onsuccess = () => resolve(req.result);
  });
}

async function deletePreference(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('preferences', 'readwrite');
    tx.objectStore('preferences').delete(id);
    tx.oncomplete = () => resolve();
  });
}

// ── Contents ──

async function getContents(limit = 50) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('contents', 'readonly');
    const req = tx.objectStore('contents').getAll();
    req.onsuccess = () => {
      const sorted = req.result.sort((a, b) => b.id - a.id);
      resolve(sorted.slice(0, limit));
    };
  });
}

async function saveContent(topic, content, content_type) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('contents', 'readwrite');
    const req = tx.objectStore('contents').add({
      topic, content, content_type: content_type || 'oral',
      created_at: new Date().toISOString()
    });
    req.onsuccess = () => resolve(req.result);
  });
}

async function getContentById(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('contents', 'readonly');
    const req = tx.objectStore('contents').get(id);
    req.onsuccess = () => resolve(req.result || null);
  });
}

async function updateContent(id, newContent) {
  const db = await openDB();
  const item = await getContentById(id);
  if (!item) return;
  return new Promise((resolve) => {
    const tx = db.transaction('contents', 'readwrite');
    tx.objectStore('contents').put({ ...item, content: newContent });
    tx.oncomplete = () => resolve();
  });
}

async function getRecentTopics(days = 7) {
  const db = await openDB();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Promise((resolve) => {
    const tx = db.transaction('contents', 'readonly');
    const req = tx.objectStore('contents').getAll();
    req.onsuccess = () => {
      const topics = new Set();
      for (const c of req.result) {
        if (new Date(c.created_at) >= cutoff && c.topic) {
          topics.add(c.topic);
        }
      }
      resolve([...topics]);
    };
  });
}

// ── Favorites ──

async function getFavorites() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('favorites', 'readonly');
    const req = tx.objectStore('favorites').getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.id - a.id));
  });
}

async function addFavorite(topic, content) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('favorites', 'readwrite');
    const req = tx.objectStore('favorites').add({
      topic, content, created_at: new Date().toISOString()
    });
    req.onsuccess = () => resolve(req.result);
  });
}

async function deleteFavorite(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('favorites', 'readwrite');
    tx.objectStore('favorites').delete(id);
    tx.oncomplete = () => resolve();
  });
}

// 导出
window.DB = {
  openDB, getConfig, saveConfig,
  getReferences, addReference, deleteReference,
  getPreferences, addPreference, deletePreference,
  getContents, saveContent, getContentById, updateContent, getRecentTopics,
  getFavorites, addFavorite, deleteFavorite
};
