import { PHOTOS, photosToDrop } from '../logic/photos.js';

// 写真の保存場所(この端末のブラウザの IndexedDB)。使えないときは、ページを開いているあいだだけ覚えておく。
// 写真は { id, time, whales: [クジラの番号], camera, blob }
const DB = 'whale-ocean-photos', STORE = 'photos';

function openDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

const tx = (db, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(STORE, mode);
  const out = fn(t.objectStore(STORE));
  t.oncomplete = () => resolve(out?.result ?? out);
  t.onerror = () => reject(t.error);
});

export function createPhotoStore() {
  let dbPromise = openDb().catch(() => null);
  const memory = [];   // IndexedDB が使えないとき
  let nextId = 1;
  const urls = new Map();   // 写真の表示用アドレス(作ったら使い回す)

  async function list() {
    const db = await dbPromise;
    if (!db) return [...memory];
    try { return await tx(db, 'readonly', s => s.getAll()); } catch { return [...memory]; }
  }

  async function remove(id) {
    const db = await dbPromise;
    if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    const k = memory.findIndex(p => p.id === id);
    if (k >= 0) memory.splice(k, 1);
    if (db) { try { await tx(db, 'readwrite', s => s.delete(id)); } catch { /* 消せなくても動きつづける */ } }
  }

  async function add(photo) {
    const db = await dbPromise;
    let saved = false;
    if (db) {
      try { photo.id = await tx(db, 'readwrite', s => s.add(photo)); saved = true; } catch { saved = false; }
    }
    if (!saved) { photo.id = nextId++; memory.push(photo); }
    // 多すぎたら古いものから消す
    for (const id of photosToDrop(await list())) await remove(id);
    return { photo, saved };
  }

  return {
    list,
    add,
    remove,
    url(photo) {
      if (!urls.has(photo.id)) urls.set(photo.id, URL.createObjectURL(photo.blob));
      return urls.get(photo.id);
    },
    max: PHOTOS.max,
  };
}
