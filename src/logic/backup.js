// 図鑑と写真のバックアップ(1つのファイルに書き出して、あとで読み込む)。
// 読み込むときは、いまの図鑑と合わせる(どちらかで会った回数の多いほう・撮った写真は両方とも残す)
import { loadBook } from './flukeId.js';

export const BACKUP = Object.freeze({ format: 'whale-ocean-backup', version: 1, maxPhotoChars: 8_000_000 });

export function makeBackup({ book, photos, now = Date.now() }) {
  return {
    format: BACKUP.format,
    version: BACKUP.version,
    savedAt: now,
    book,
    photos: photos.map(p => ({ time: p.time, whales: p.whales ?? [], camera: p.camera, src: p.src })),
  };
}

export const backupFileName = (now = new Date()) => {
  const d = new Date(now);
  const pad = n => String(n).padStart(2, '0');
  return `whale-ocean-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
};

const okPhoto = p => p && typeof p.src === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p.src)
  && p.src.length < BACKUP.maxPhotoChars && Number.isFinite(p.time);

// ファイルの中身を読む。ちがうファイル・こわれたファイルなら Error(reason: 'notBackup' | 'broken')
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('broken'), { reason: 'broken' }); }
  if (!data || data.format !== BACKUP.format) throw Object.assign(new Error('notBackup'), { reason: 'notBackup' });
  // 図鑑は、ふつうに読み込むときと同じ確かめ方をする(知らないクジラや、おかしな数は捨てる)
  const raw = JSON.stringify(data.book ?? {});
  const book = loadBook({ getItem: () => raw });
  const photos = (Array.isArray(data.photos) ? data.photos : []).filter(okPhoto).map(p => ({
    time: p.time,
    whales: Array.isArray(p.whales) ? p.whales.filter(Number.isFinite) : [],
    camera: typeof p.camera === 'string' ? p.camera : undefined,
    src: p.src,
  }));
  return { book, photos, savedAt: Number(data.savedAt) || 0 };
}

// 2つの図鑑を合わせる。名前は、いまの図鑑で付けた名前を先にする
export function mergeBooks(now, incoming) {
  const out = { ...now };
  for (const [id, b] of Object.entries(incoming)) {
    const a = out[id];
    if (!a) { out[id] = { ...b }; continue; }
    const firsts = [a.first, b.first].filter(x => x > 0);
    const merged = {
      count: Math.max(a.count, b.count),
      first: firsts.length ? Math.min(...firsts) : 0,
      last: Math.max(a.last, b.last),
    };
    if (a.photographed || b.photographed) { merged.photographed = true; merged.photoAt = Math.max(a.photoAt ?? 0, b.photoAt ?? 0); }
    const nick = a.nickname ?? b.nickname;
    if (nick) merged.nickname = nick;
    // 回遊のタグは、あとで会ったほうのもの。旅の記録は両方(同じ旅は1つに)
    const tag = (a.last ?? 0) >= (b.last ?? 0) ? a.tag ?? b.tag : b.tag ?? a.tag;
    if (tag) merged.tag = tag;
    const trips = [...(a.trips ?? []), ...(b.trips ?? [])].filter((t, i, all) => all.findIndex(u => u.from === t.from && u.to === t.to) === i).sort((x, y) => x.from - y.from).slice(-5);
    if (trips.length) merged.trips = trips;
    out[id] = merged;
  }
  return out;
}

// まだ持っていない写真だけ(同じ時刻に撮った同じ写真は、もう持っている)
export function newPhotos(existing, incoming) {
  const have = new Set(existing.map(p => `${p.time}:${p.src?.length}`));
  return incoming.filter(p => !have.has(`${p.time}:${p.src.length}`));
}
