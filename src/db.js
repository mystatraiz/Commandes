/* Stockage des commandes.

   IndexedDB est la base principale : elle survit à un plantage, à une fermeture
   brutale de l'onglet et garde l'historique nécessaire aux statistiques.
   Si elle est indisponible (navigation privée, réglage restrictif), on bascule
   sur localStorage plutôt que de perdre le service. */

const DB_NAME = 'grill-commandes';
const DB_VERSION = 1;
const STORE = 'commandes';
const FALLBACK_KEY = 'grill.commandes.secours';

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
        store.createIndex('creeeA', 'creeeA');
        store.createIndex('statut', 'statut');
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

/* ---------- Secours localStorage ---------- */
function lireSecours() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
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

/* ---------- API ---------- */

export async function toutesLesCommandes() {
  const db = await openDB();
  if (!db || useFallback) return lireSecours();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function lire(id) {
  const db = await openDB();
  if (!db || useFallback) return lireSecours().find((c) => c.id === id) || null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function enregistrer(commande) {
  const db = await openDB();
  if (!db || useFallback) {
    const list = lireSecours().filter((c) => c.id !== commande.id);
    list.push(commande);
    ecrireSecours(list);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(commande);
      tx.oncomplete = () => resolve();
      tx.onerror = () => { ecrireSecours([...lireSecours().filter((c) => c.id !== commande.id), commande]); resolve(); };
    } catch {
      resolve();
    }
  });
}

export async function supprimer(id) {
  const db = await openDB();
  if (!db || useFallback) {
    ecrireSecours(lireSecours().filter((c) => c.id !== id));
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

/** Purge l'historique au-delà de la durée de rétention. */
export async function purger(avantTimestamp) {
  const toutes = await toutesLesCommandes();
  const vieilles = toutes.filter((c) => c.statut === 'servie' && c.creeeA < avantTimestamp);
  for (const c of vieilles) await supprimer(c.id);
  return vieilles.length;
}

/* ---------- Brouillon de la commande en cours de saisie ----------
   Petit et modifié à chaque geste : localStorage est ici le bon outil, il est
   synchrone et survit donc même à une fermeture immédiate. */

const BROUILLON = 'grill.brouillon';

export function lireBrouillon() {
  try {
    const x = JSON.parse(localStorage.getItem(BROUILLON) || 'null');
    if (!x || typeof x !== 'object') return null;
    return { table: x.table || null, lignes: Array.isArray(x.lignes) ? x.lignes : [] };
  } catch {
    return null;
  }
}

export function ecrireBrouillon(brouillon) {
  try {
    if (!brouillon) localStorage.removeItem(BROUILLON);
    else localStorage.setItem(BROUILLON, JSON.stringify(brouillon));
  } catch {}
}
