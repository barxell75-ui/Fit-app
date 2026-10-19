// Forja · Persistencia local (IndexedDB, con respaldo en localStorage)
// Almacenes: kv (perfil, ajustes, favoritos, ejercicios personalizados, sesión activa),
//            templates (rutinas), sessions (sesiones finalizadas).

const DB_NAME = 'forja';
const DB_VERSION = 1;
const STORES = ['kv', 'templates', 'sessions'];

let dbp = null;
let fallback = false;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de datos bloqueada por otra pestaña'));
  });
  return dbp;
}

function lsKey(store, key) { return `forja:${store}:${key}`; }

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
  });
}

function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export async function init() {
  try { await openDB(); fallback = false; }
  catch (e) { console.warn('Usando localStorage:', e); fallback = true; }
  // Pide almacenamiento persistente (el navegador puede concederlo o no)
  let persisted = null;
  try { if (navigator.storage && navigator.storage.persist) persisted = await navigator.storage.persist(); } catch { /* sin soporte */ }
  return { fallback, persisted };
}

export async function get(store, key) {
  if (fallback) { try { const v = localStorage.getItem(lsKey(store, key)); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
  return tx(store, 'readonly', s => reqP(s.get(key)));
}

export async function put(store, key, value) {
  if (fallback) { localStorage.setItem(lsKey(store, key), JSON.stringify(value)); return; }
  return tx(store, 'readwrite', s => reqP(s.put(value, key)));
}

export async function del(store, key) {
  if (fallback) { localStorage.removeItem(lsKey(store, key)); return; }
  return tx(store, 'readwrite', s => reqP(s.delete(key)));
}

export async function all(store) {
  if (fallback) {
    const out = [];
    const prefix = `forja:${store}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) { try { out.push(JSON.parse(localStorage.getItem(k))); } catch { /* ignora */ } }
    }
    return out;
  }
  return tx(store, 'readonly', s => reqP(s.getAll()));
}

export async function clearAll() {
  if (fallback) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('forja:')) keys.push(k); }
    keys.forEach(k => localStorage.removeItem(k));
    return;
  }
  for (const st of STORES) await tx(st, 'readwrite', s => reqP(s.clear()));
}

/** Reemplaza todo el contenido (restaurar copia de seguridad) en una sola pasada */
export async function replaceAll({ kv = {}, templates = [], sessions = [] }) {
  await clearAll();
  for (const [k, v] of Object.entries(kv)) await put('kv', k, v);
  for (const t of templates) await put('templates', t.id, t);
  for (const s of sessions) await put('sessions', s.id, s);
}

export function usingFallback() { return fallback; }

export async function estimate() {
  try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch { /* */ }
  return null;
}
