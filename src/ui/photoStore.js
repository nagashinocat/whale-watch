import { PHOTOS, photosToDrop } from '../logic/photos.js';

// 写真の保存場所(この端末のブラウザの IndexedDB)。使えないときは、ページを開いているあいだだけ覚えておく。
// 写真は { id, time, whales: [クジラの番号], camera, src }。src は画像そのものを文字にしたもの(data: で始まる)。
// 画像のファイル(blob)のまま保存して「blob:」のアドレスで見せると、公開ページでは安全のために画像を出せないことがあり、
// iPhone のブラウザでは保存そのものに失敗することもあるので、文字にして保存する
// (前に blob のまま保存した写真は、読み出すときに文字に直す)
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

// 画像のファイルを、data: で始まる文字にする
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// 見せられる形にそろえる(blob だけの古い写真は、文字に直す。直せなければ見せない)
async function viewable(photo) {
  if (typeof photo.src === 'string' && photo.src.startsWith('data:image/')) return photo;
  if (photo.blob) {
    try { return { ...photo, src: await blobToDataUrl(photo.blob) }; } catch { return null; }
  }
  return null;
}

export function createPhotoStore() {
  let dbPromise = openDb().catch(() => null);
  const memory = [];   // IndexedDB が使えないとき
  let nextId = 1;
  const converted = new Map();   // blob から文字に直した写真(作ったら使い回す)

  async function rawList() {
    const db = await dbPromise;
    if (!db) return [...memory];
    try { return [...await tx(db, 'readonly', s => s.getAll()), ...memory]; } catch { return [...memory]; }
  }

  async function list() {
    const out = [];
    const db = await dbPromise;
    for (const p of await rawList()) {
      if (typeof p.src === 'string' && p.src.startsWith('data:image/')) { out.push(p); continue; }
      if (!converted.has(p.id)) {
        const v = await viewable(p);
        converted.set(p.id, v);
        // 直したものを保存しなおす(次からは直さなくてよい)
        if (v && db) { const { blob, ...keep } = v; try { await tx(db, 'readwrite', s => s.put(keep)); } catch { /* そのままでも見られる */ } }
      }
      const v = converted.get(p.id);
      if (v) out.push(v);
    }
    return out;
  }

  async function remove(id) {
    const db = await dbPromise;
    converted.delete(id);
    const k = memory.findIndex(p => p.id === id);
    if (k >= 0) memory.splice(k, 1);
    if (db) { try { await tx(db, 'readwrite', s => s.delete(id)); } catch { /* 消せなくても動きつづける */ } }
  }

  async function add(input) {
    const { blob, ...rest } = input;
    const photo = { ...rest, src: input.src ?? await blobToDataUrl(blob) };
    const db = await dbPromise;
    let saved = false;
    if (db) {
      try { photo.id = await tx(db, 'readwrite', s => s.add(photo)); saved = true; } catch { saved = false; }
    }
    // 保存できないときは、ページを開いているあいだだけ覚えておく(番号が保存した写真とぶつからないように大きな番号)
    if (!saved) { photo.id = 1e9 + nextId++; memory.push(photo); }
    // 多すぎたら古いものから消す
    for (const id of photosToDrop(await rawList())) await remove(id);
    return { photo, saved };
  }

  return {
    list,
    add,
    remove,
    // 写真を見せるアドレス(data: で始まる文字)
    url(photo) {
      return photo.src ?? converted.get(photo.id)?.src ?? '';
    },
    max: PHOTOS.max,
  };
}
