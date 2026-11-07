// はやり歌: ザトウクジラの歌は、季節の中で少しずつ形を変え、ときどき新しい歌にがらりと入れかわる。
// このアプリでは、月ごとに歌がかわり、聞いた歌を図鑑の「歌」に集められる。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・歌は、短い音の組み合わせ(フレーズ)をくり返す「テーマ」がいくつも、決まった順番でならんだもの
//   ・同じ海のオスはみんな同じ歌をうたい、歌は少しずつ形を変えていく(テーマがふえたり、へったり、入れかわったり)
//   ・ときどき、まったく新しい歌が別の海から伝わって、みんながいっせいに切りかえる(「歌の革命」)。
//     南太平洋では、新しい歌が群れから群れへ、西から東へ広がっていくことがわかっている
//   ・何年かけて、歌の高さが少しずつ低くなっていくことも報告されている
// 録音は1つなので、録音をテーマ(フレーズのかたまり)に分けて、ならべ方と高さをかえて、月ごとの歌にする

export const SONG = Object.freeze({
  themes: 6,                // 録音を分けるテーマの数
  themeSec: 8.2,            // 1つのテーマの長さ(秒)
  overlapSec: 0.6,          // テーマのつなぎ目を重ねる長さ(秒)
  firstMonth: [2026, 1],    // この月の歌から始まる
  revolutionMonth: 7,       // 毎年この月に、新しい歌に入れかわる(新しい歌は、夏の餌場で群れが出会うと伝わる)
  lowerPerYear: 0.015,      // 1年で、歌の高さがどれだけ低くなるか(再生の速さの割合)
  storageKey: 'whale-ocean-songs',
});

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seasonKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthsSinceStart = key => {
  const [y, m] = key.split('-').map(Number);
  return (y - SONG.firstMonth[0]) * 12 + (m - SONG.firstMonth[1]);
};

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const cache = new Map();
// その月の歌。order: 録音のどのテーマを、どの順でうたうか / letters: テーマの名前(A〜) / rate: 高さ / generation: 何回目の新しい歌か
export function songVersion(key = seasonKey()) {
  if (cache.has(key)) return cache.get(key);
  const n = Math.max(0, monthsSinceStart(key));
  let order = [0, 1, 2, 3, 4, 5], generation = 0, changed = 'first';
  for (let i = 1; i <= n; i++) {
    const rng = seeded(i * 7349 + 11);
    const month = ((SONG.firstMonth[1] - 1 + i) % 12) + 1;
    if (month === SONG.revolutionMonth) {
      // 歌の革命: まったく新しいならべ方に入れかわる
      generation++;
      order = shuffle([0, 1, 2, 3, 4, 5], rng).slice(0, 5 + Math.floor(rng() * 2));
      changed = 'revolution';
      continue;
    }
    // 少しずつ変わる: となりのテーマが入れかわる・テーマが1つふえる(くり返す)・1つへる
    const r = rng();
    const k = Math.floor(rng() * order.length);
    if (r < 0.45 && order.length > 1) { const j = Math.min(order.length - 1, k + 1); [order[k], order[j]] = [order[j], order[k]]; changed = 'swap'; }
    else if (r < 0.75 && order.length < 7) { order = [...order.slice(0, k + 1), order[k], ...order.slice(k + 1)]; changed = 'repeat'; }
    else if (order.length > 4) { order = order.filter((_, x) => x !== k); changed = 'drop'; }
    else { changed = 'same'; }
  }
  // テーマの名前: 新しい歌になるたびに、つぎの文字の組(A〜F → G〜L …)
  const base = (generation * 6) % 26;
  const letters = order.map(t => String.fromCharCode(65 + ((base + t) % 26)));
  const years = n / 12;
  const rate = Math.round((1 - SONG.lowerPerYear * years - (generation % 3) * 0.02 + 0.02) * 1000) / 1000;
  const v = { key, order, letters, rate, generation, changed };
  cache.set(key, v);
  return v;
}

// 歌の、テーマごとの再生の予定(録音の何秒目から何秒、いつ鳴らすか)。maxSec まで、最初からくり返す
export function songPlan(version, maxSec = 60) {
  const out = [];
  let t = 0;
  for (let k = 0; t < maxSec; k++) {
    const theme = version.order[k % version.order.length];
    const len = SONG.themeSec / version.rate;
    out.push({ at: t, offset: theme * SONG.themeSec, duration: SONG.themeSec, theme });
    t += len - SONG.overlapSec;
  }
  return out;
}

// 聞いた歌の記録: { 'YYYY-MM': はじめて聞いた時刻 }
export function loadSongs(storage) {
  try {
    const v = JSON.parse(storage.getItem(SONG.storageKey) || '{}');
    const out = {};
    for (const [k, at] of Object.entries(v ?? {})) if (/^\d{4}-\d{2}$/.test(k) && Number.isFinite(at)) out[k] = at;
    return out;
  } catch {
    return {};
  }
}
export function recordSong(storage, songs, key, now = Date.now()) {
  if (songs[key]) return { songs, first: false };
  const next = { ...songs, [key]: now };
  try { storage.setItem(SONG.storageKey, JSON.stringify(next)); } catch { /* 保存できなくても続ける */ }
  return { songs: next, first: true };
}
