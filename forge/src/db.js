/* Stockage local des entrées (poids, jeûnes, sessions, réglages).

   IndexedDB est la base principale. Si elle est indisponible (navigation
   privée, réglage restrictif), on bascule sur localStorage plutôt que de
   perdre la saisie. */

const DB_NAME = 'forge';
const DB_VERSION = 1;
const STORE = 'entrees';
const FALLBACK_KEY = 'forge.entrees.secours';

let dbPromise = null;
let useFallback = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB absent'));
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      return reject(e);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('type', 'type');
        store.createIndex('jour', 'jour');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('ouverture impossible'));
    req.onblocked = () => reject(new Error('base bloquée par un autre onglet'));
  }).catch((err) => {
    console.warn('[db] IndexedDB indisponible, bascule sur localStorage :', err.message);
    useFallback = true;
    return null;
  });
  return dbPromise;
}

function lireSecours() {
  try {
    const arr = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function ecrireSecours(list) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[db] écriture de secours impossible :', e.message);
  }
}

export async function toutesLesEntrees() {
  const db = await openDB();
  if (!db || useFallback) return lireSecours();
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function lire(id) {
  const db = await openDB();
  if (!db || useFallback) return lireSecours().find((e) => e.id === id) || null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enregistrer(entree) {
  const db = await openDB();
  if (!db || useFallback) {
    ecrireSecours([...lireSecours().filter((e) => e.id !== entree.id), entree]);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entree);
      tx.oncomplete = () => resolve();
      tx.onerror = () => { ecrireSecours([...lireSecours().filter((e) => e.id !== entree.id), entree]); resolve(); };
    } catch {
      resolve();
    }
  });
}

export async function supprimerPhysiquement(id) {
  const db = await openDB();
  if (!db || useFallback) {
    ecrireSecours(lireSecours().filter((e) => e.id !== id));
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Efface tout en local (déconnexion). */
export async function vider() {
  const toutes = await toutesLesEntrees();
  for (const e of toutes) await supprimerPhysiquement(e.id);
}
