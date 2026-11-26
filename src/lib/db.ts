import { INITIAL_STORE } from '../data/seedData';
import { SubPulseStore } from '../types/subpulse';

const DB_NAME = 'subpulse-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'primary';
const LS_FALLBACK_KEY = 'subpulse_fallback_state_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSubPulseStore(): Promise<SubPulseStore> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as SubPulseStore);
        } else {
          resolve(structuredClone(INITIAL_STORE));
        }
      };
      req.onerror = () => resolve(structuredClone(INITIAL_STORE));
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) return JSON.parse(raw) as SubPulseStore;
    } catch {
      // ignore
    }
    return structuredClone(INITIAL_STORE);
  }
}

export async function saveSubPulseStore(state: SubPulseStore): Promise<void> {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // localStorage already saved
  }
}

export async function clearSubPulseStore(): Promise<void> {
  try {
    localStorage.removeItem(LS_FALLBACK_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
