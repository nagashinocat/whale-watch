// みんなのギャラリー: 点数の高い(A以上)写真を、撮った人がえらんで載せる。クジラに付けた名前もいっしょに載る。
// 写真と点数は、インターネット上のデータ置き場(Supabase)に送る。置き場の住所と鍵は galleryConfig.js。
// three.js も画面も使わない(テストからも使う)。送り方は「何をどこへ送るか」を作るだけで、送るのは画面の側。

export const GALLERY = Object.freeze({
  ranks: Object.freeze(['S', 'A']),   // 載せられるランク
  imageMax: 960,                      // 送る写真の長い辺(ピクセル)
  quality: 0.82,
  bucket: 'gallery',                  // 写真を置く場所の名前
  table: 'gallery',                   // 点数や名前を置く表の名前
  nameMax: 12,
  whalesMax: 8,
  postedKey: 'whale-ocean-gallery-posted',
  pageSize: 60,
  bestDays: 7,                        // 「今週のベスト」は、この日数のあいだに載ったもの
});

// 置き場の住所と鍵がそろっているか(そろっていなければ、ギャラリーのボタンは出さない)
export const galleryReady = cfg => !!(cfg && /^https:\/\/[^/]+$/.test(cfg.url ?? '') && cfg.key);

// この写真を載せられるか
export const canPost = photo => !!photo?.score && GALLERY.ranks.includes(photo.score.rank);

// ---- 名前のチェック ----
// みんなが見るページに出るので、宣伝やいやな言葉が入った名前は載せない(そのときは、模様から付いた名前で載る)
const NG = ['死ね', 'しね', '殺す', 'ころす', 'きもい', 'うざい', 'ばか', 'バカ', 'アホ', 'ちんこ', 'まんこ', 'セックス', 'エロ',
  'fuck', 'shit', 'bitch', 'sex', 'porn', 'nigg', 'kill'];
export function galleryName(name) {
  if (typeof name !== 'string') return null;
  const s = Array.from(name.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').trim()).slice(0, GALLERY.nameMax).join('');
  if (!s) return null;
  const flat = s.toLowerCase().replace(/[\s._\-・]/g, '');
  if (/https?:|www|\.(com|net|jp|io|me)\b|@|#/.test(s.toLowerCase())) return null;   // アドレスや、アカウント名・ハッシュタグ
  if (NG.some(w => flat.includes(w.toLowerCase()))) return null;
  return s;
}

// 送る中身。whales: 写っていたクジラの番号、nickOf(id): その人が付けた名前(なければ空)
export function galleryEntry(photo, { nickOf = () => '', lang = 'ja', path }) {
  const ids = [...new Set(photo.whales ?? [])].slice(0, GALLERY.whalesMax);
  const s = photo.score;
  return {
    image_path: path,
    score: Math.max(0, Math.min(100, Math.round(s.total))),
    rank: s.rank,
    composition: Math.round(s.composition),
    rarity: Math.round(s.rarity),
    notes: (s.notes ?? []).slice(0, 3).map(n => ({ ja: String(n.ja ?? '').slice(0, 40), en: String(n.en ?? '').slice(0, 60) })),
    whales: ids.map(id => ({ id, nick: galleryName(nickOf(id)) })),
    lang: lang === 'en' ? 'en' : 'ja',
    taken_at: new Date(photo.time ?? Date.now()).toISOString(),
  };
}

// 写真のファイル名(ほかの人と重ならないように、でたらめな文字で)
export function imagePath(rng = Math.random, now = Date.now()) {
  const r = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rng() * 36)]).join('');
  return `${new Date(now).toISOString().slice(0, 7)}/${r}.jpg`;
}

const headers = (cfg, extra = {}) => ({ apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...extra });

// 送る手順: ① 写真を置く ② 点数と名前を表に書く
export function postRequests(cfg, entry) {
  return [
    { url: `${cfg.url}/storage/v1/object/${GALLERY.bucket}/${entry.image_path}`, method: 'POST', headers: headers(cfg, { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }), body: 'image' },
    { url: `${cfg.url}/rest/v1/${GALLERY.table}`, method: 'POST', headers: headers(cfg, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(entry) },
  ];
}

// ギャラリーのページで読む一覧。view: 'best'(今週のベスト)・'s'(Sランク)・'new'(新着)
export function listRequest(cfg, view = 'best', now = Date.now()) {
  const q = new URLSearchParams({ select: 'id,created_at,image_path,score,rank,composition,rarity,notes,whales', hidden: 'eq.false', limit: String(GALLERY.pageSize) });
  if (view === 'best') {
    q.set('created_at', `gte.${new Date(now - GALLERY.bestDays * 86400000).toISOString()}`);
    q.set('order', 'score.desc,created_at.desc');
  } else if (view === 's') {
    q.set('rank', 'eq.S');
    q.set('order', 'created_at.desc');
  } else {
    q.set('order', 'created_at.desc');
  }
  return { url: `${cfg.url}/rest/v1/${GALLERY.table}?${q}`, headers: headers(cfg) };
}

export const imageUrl = (cfg, path) => `${cfg.url}/storage/v1/object/public/${GALLERY.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

// ---- 載せた写真を覚えておく(同じ写真を2回載せないように)。写真の撮った時刻で覚える ----
export function loadPosted(storage) {
  try { const v = JSON.parse(storage.getItem(GALLERY.postedKey) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function markPosted(storage, time) {
  try {
    const list = loadPosted(storage).filter(t => t !== time);
    list.push(time);
    storage.setItem(GALLERY.postedKey, JSON.stringify(list.slice(-200)));
  } catch { /* 保存できなくても続ける */ }
}
export const isPosted = (storage, photo) => loadPosted(storage).includes(photo?.time);
