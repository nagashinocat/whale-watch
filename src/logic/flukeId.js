// 尾びれの裏の模様で、ザトウクジラを1頭ずつ見分ける(クジラ図鑑)。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・尾びれの裏の模様は1頭ずつちがい、人の指紋のように見分けに使われている
//   ・白さで5段階に分ける(1: ほぼ白 〜 5: ほぼ黒)。北半球のザトウクジラは、南半球より黒っぽい尾びれが多い
//   ・傷あと(シャチの歯のあと、フジツボのあと、網のあと)は、黒いところでは白く、白いところでは黒い線になって残る
//   ・研究者は、模様や傷の形から名前を付ける。子クジラは模様が変わっていくので名前を付けない
//
// 尾びれの上の場所: s は左のはし -1 〜 右のはし 1、c は前のふち 0 〜 うしろのふち 1

import { tr, lang } from './i18n.js';
import { rollTraits, traitWord, traitFlukeWhite, TRAITS, traitsText } from './traits.js';
import { SPECIAL, specialChance } from './specialCoats.js';
import { tagOnSighting, cleanMigration } from './migration.js';

const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const FLUKE_ID = Object.freeze({
  size: 24,   // この海に来るクジラの数(図鑑にのる数)
  // 段階ごとの白い部分の割合
  whiteness: Object.freeze({ 1: 0.9, 2: 0.7, 3: 0.5, 4: 0.28, 5: 0.07 }),
  // 段階の出やすさ(北太平洋は黒っぽいほうが多い)
  categoryWeights: Object.freeze([0.1, 0.15, 0.25, 0.25, 0.25]),
  returnChance: 0.45,
  // この海のなじみの子(シロ)。いちばんよく来て、はじめての人に写真と図鑑の案内をしてくれる
  guideId: 11,
  guideFavor: 0.3,      // 来るクジラを決めるとき、まずこの割合でなじみの子にする
  whiteId: 17,          // 真っ白なクジラの番号   // 図鑑にのっているクジラが、もう一度来る割合
  calvesNamed: false,
});

// 決まった種から、いつも同じ乱数の並びを作る
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

// 模様のもとになる、なめらかな値(しきい値より大きいところが白)
function field(ind, s, c) {
  const p = ind.phases;
  let v = 0.5
    + 0.22 * Math.sin(3.1 * p[0] * s + p[1]) * Math.sin(2.3 * p[2] * c + p[3])
    + 0.18 * Math.sin(5.7 * (s * Math.cos(p[4]) + c * Math.sin(p[4])) + p[5])
    + 0.1 * Math.sin(11 * s + 7 * c + p[6]);
  // うしろのふちと左右の先は黒い。まん中の切れこみのあたりも黒っぽい。前のふちのほうは白っぽい
  v -= 0.35 * smoothstep(0.8, 1, c) + 0.3 * smoothstep(0.8, 1, Math.abs(s));
  v -= (ind.category > 1 ? 0.25 : 0.08) * (1 - smoothstep(0, 0.12, Math.abs(s)));
  v += 0.15 * (1 - c);
  return v;
}

// 点と線分の距離
function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// 尾びれの裏の (s, c) の白さ(0 が黒、1 が白)
export function flukeWhiteness(ind, s, c) {
  let w = smoothstep(ind.threshold - 0.03, ind.threshold + 0.03, field(ind, s, c));
  // 傷あと: その場所の色と反対の色の線
  for (const sc of ind.scars) {
    if (segmentDistance(s, c * 0.5, [sc.from[0], sc.from[1] * 0.5], [sc.to[0], sc.to[1] * 0.5]) < sc.width) { w = 1 - w; break; }
  }
  // フジツボのあとの白い点(黒いところに目立つ)
  for (const d of ind.spots) if (Math.hypot(s - d[0], (c - d[1]) * 0.5) < 0.022) w = Math.max(w, 0.95);
  // 真っ白な子、尾びれの先にフジツボがたくさんの子
  return ind.traits ? traitFlukeWhite(ind, s, c, w) : w;
}

// 尾びれの白さを表す名前の後ろの言葉(英語は、名前らしく聞こえる言葉にしている)
const COLOR_WORDS = () => tr({ ja: { 1: 'シロ', 2: 'ハナ', 3: 'マダラ', 4: 'クロ', 5: 'スミ' }, en: { 1: 'Frost', 2: 'Blossom', 3: 'Dapple', 4: 'Shadow', 5: 'Ink' } });

// 番号 id のクジラ。いつも同じ模様と名前になる
function makeIndividual(id) {
  const rng = seeded(id * 9973 + 7);
  let r = rng(), category = 1;
  for (let k = 0; k < 5; k++) { r -= FLUKE_ID.categoryWeights[k]; if (r <= 0) { category = k + 1; break; } category = 5; }
  const phases = Array.from({ length: 7 }, (_, k) => (k % 2 === 0 && k !== 4 ? 0.7 + rng() * 0.8 : rng() * Math.PI * 2));
  // 傷あと: シャチの歯のあと(平行な3本の線)か、1本の長い線
  const scars = [];
  const kind = rng();
  if (kind < 0.35) {
    const s0 = -0.7 + rng() * 1.4, c0 = 0.2 + rng() * 0.4, ang = (rng() - 0.5) * 1.2, len = 0.25 + rng() * 0.2;
    for (let k = 0; k < 3; k++) {
      const o = (k - 1) * 0.07;
      scars.push({ from: [s0 + o, c0], to: [s0 + o + Math.sin(ang) * len, c0 + Math.cos(ang) * len], width: 0.012, type: 'rake' });
    }
  } else if (kind < 0.6) {
    const s0 = -0.8 + rng() * 1.6, c0 = 0.15 + rng() * 0.5;
    scars.push({ from: [s0, c0], to: [s0 + (rng() - 0.5) * 0.9, c0 + 0.1 + rng() * 0.3], width: 0.014, type: 'line' });
  }
  const spotCount = rng() < 0.4 ? 3 + Math.floor(rng() * 5) : Math.floor(rng() * 2);
  const spots = Array.from({ length: spotCount }, () => [-0.85 + rng() * 1.7, 0.1 + rng() * 0.75]);
  const ind = { id, category, phases, scars, spots, threshold: 0 };
  // 白い部分が段階どおりの割合になるしきい値を、模様の値の並びから決める
  const values = [];
  for (let s = -0.95; s <= 0.95; s += 0.05) for (let c = 0.02; c <= 0.98; c += 0.04) values.push(field(ind, s, c));
  values.sort((a, b) => a - b);
  ind.threshold = values[Math.min(values.length - 1, Math.floor((1 - FLUKE_ID.whiteness[category]) * values.length))];
  // ひと目でわかる個性(尾びれの模様を決めたあとに決めるので、模様はこれまでと変わらない)
  ind.traits = rollTraits(rng);
  ind.mark = scars[0]?.type === 'rake' ? tr({ ja: 'ツメ', en: 'Claw' }) : scars[0]?.type === 'line' ? tr({ ja: 'イナズマ', en: 'Bolt' }) : spots.length >= 3 ? tr({ ja: 'ホシ', en: 'Star' }) : '';
  return ind;
}

// 名前: いちばん目立つ個性(なければ尾びれの傷の形)と、尾びれの白さから付ける。真っ白な子は「ユキ」
function autoName(ind) {
  const word = traitWord(ind);
  if (ind.traits.coat === 'white' || SPECIAL.coats.includes(ind.traits.coat)) return word;
  const color = COLOR_WORDS()[ind.category];
  const head = word || ind.mark;
  return tr({ ja: head + color, en: head ? `${head} ${color}` : color });
}

let cache = null;
// この海に来るクジラ全員(名前は重ならないように番号を付ける)
export function population() {
  // 名前は言語ごとにちがうので、言語が変わったら作りなおす
  if (cache && cache.lang === lang()) return cache.list;
  const list = Array.from({ length: FLUKE_ID.size }, (_, k) => makeIndividual(k + 1));
  // 真っ白な子は1頭だけ。ほかの個性も、この海に1頭以上はいるようにする(個性の少ない子に足す)
  for (const ind of list) if (ind.traits.coat === 'white') ind.traits.coat = 'normal';
  const plain = () => [...list].sort((a, b) => traitsText(a).length - traitsText(b).length || a.id - b.id);
  const white = list[FLUKE_ID.whiteId - 1];
  white.traits = { ...white.traits, coat: 'white', pec: 'normal', scars: 'normal', barnacles: 'normal' };
  white.category = 1;   // 尾びれの裏も真っ白
  for (const [key, values] of Object.entries(TRAITS)) {
    for (const v of values) {
      if (v === 'normal' || v === 'white' || list.some(i => i.traits[key] === v)) continue;
      const target = plain().find(i => i !== white && i.traits[key] === 'normal');
      if (target) target.traits[key] = v;
    }
  }
  // とくべつな3頭(全身真っ黒に、銀河・彗星・花火の模様)。ほかの個性はつけない
  SPECIAL.coats.forEach((coat, k) => {
    const ind = makeIndividual(SPECIAL.firstId + k);
    ind.traits = { ...ind.traits, coat, pec: 'normal', dorsal: 'normal', fluke: 'normal', scars: 'normal', barnacles: 'normal', size: 'normal' };
    ind.category = 5;   // 尾びれの裏も真っ黒
    ind.scars = []; ind.spots = [];
    ind.special = true;
    list.push(ind);
  });
  const used = {};
  for (const ind of list) {
    ind.baseName = autoName(ind);
    used[ind.baseName] = (used[ind.baseName] ?? 0) + 1;
    ind.name = used[ind.baseName] === 1 ? ind.baseName : tr({ ja: `${ind.baseName}${used[ind.baseName]}`, en: `${ind.baseName} ${used[ind.baseName]}` });
  }
  cache = { lang: lang(), list };
  return list;
}

// 図鑑の分母: ふつうの24頭に、会えたとくべつな子の数を足す(会うまでは、いることもひみつ)。
// met は図鑑にのっているクジラの一覧(bookEntries)
export const bookTotal = (met = []) => population().filter(i => !i.special).length + met.filter(e => e.special).length;

export function individual(id) {
  return population().find(i => i.id === id) ?? null;
}

// つぎに来るクジラの番号。図鑑にのっているクジラが、ときどきもう一度来る。
// solo: 1頭だけで来る出かたのとき。とくべつな子は、そのときにだけ、ごくまれに来る(群れや親子では来ない)
export function nextVisitor(book, rng = Math.random, { solo = false } = {}) {
  if (solo) {
    const p = specialChance();
    for (const ind of population()) if (ind.special && rng() < p) return ind.id;
  }
  // とくべつな子は、図鑑にのったあとも、ふつうの「また来る」では来ない
  const all = population().filter(i => !i.special).map(i => i.id);
  const seen = Object.keys(book ?? {}).map(Number).filter(id => all.includes(id) && book[id]?.count > 0);   // 写真だけのクジラは、まだ会っていない
  // なじみの子(シロ)は、ほかの子よりよく来る
  if (all.includes(FLUKE_ID.guideId) && rng() < FLUKE_ID.guideFavor) return FLUKE_ID.guideId;
  if (seen.length && rng() < FLUKE_ID.returnChance) return seen[Math.floor(rng() * seen.length)];
  const fresh = all.filter(id => !seen.includes(id));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rng() * pool.length)];
}

// 見たことを図鑑に書く。first: はじめて見た、count: 見た回数
export function recordSighting(book, id, now = Date.now()) {
  const prev = book?.[id];
  // 写真だけ先に撮れていた(会えた回数0)クジラは、ここではじめて会ったことになる
  const met = prev && prev.count > 0;
  // はじめて会ったときにタグを付け、また会ったら、そのあいだの回遊の旅を記録する
  const entry = tagOnSighting(met
    ? { ...prev, count: prev.count + 1, last: now }
    : { ...prev, count: 1, first: now, last: now }, id, now);
  return { book: { ...book, [id]: entry }, first: !met, count: entry.count };
}

// 写真に写ったクジラを記録する(全身の姿が図鑑にのる)。写真を消しても、この記録は残る。
// まだ図鑑にいないクジラ(呼んで来たクジラなど)も記録だけしておき、あとで会えたときに姿がのっている。
// newly は、図鑑にいて、はじめて全身の姿がのったクジラ
export function recordPhoto(book, ids, now = Date.now()) {
  const next = { ...book };
  const newly = [];
  for (const id of new Set(ids)) {
    if (!individual(id)) continue;
    const prev = next[id];
    if (prev?.photographed) continue;
    next[id] = prev ? { ...prev, photographed: true, photoAt: now } : { count: 0, first: 0, last: 0, photographed: true, photoAt: now };
    if (prev?.count > 0) newly.push(id);
  }
  return { book: next, newly };
}

// ---- 図鑑の保存(この端末のブラウザに保存する) ----
export const ZUKAN_KEY = 'whale-ocean-zukan';

export function loadBook(storage) {
  try {
    const raw = JSON.parse(storage.getItem(ZUKAN_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const ids = new Set(population().map(i => i.id));
    const book = {};
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k);
      const photographed = v?.photographed === true;
      if (ids.has(id) && v && Number.isFinite(v.count) && (v.count > 0 || photographed)) {
        book[id] = { count: Math.max(0, v.count), first: Number(v.first) || 0, last: Number(v.last) || 0 };
        if (photographed) { book[id].photographed = true; book[id].photoAt = Number(v.photoAt) || 0; }
        const nick = cleanName(v.nickname);
        if (nick) book[id].nickname = nick;
        Object.assign(book[id], cleanMigration(v));
      }
    }
    return book;
  } catch {
    return {};
  }
}

export function saveBook(storage, book) {
  try {
    storage.setItem(ZUKAN_KEY, JSON.stringify(book));
  } catch { /* 保存できなくても動きつづける */ }
}

// ---- 自分で付ける名前 ----
export const NAME_MAX = 12;

// 名前をきれいにする(前後の空白と、見えない文字をとる。長すぎる名前は切る)
function cleanName(name) {
  if (typeof name !== 'string') return '';
  return Array.from(name.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, NAME_MAX).join('');
}

// 図鑑のクジラに名前を付ける(空にすると、模様から付けた名前にもどる)。見たことのないクジラには付けない
export function setNickname(book, id, name) {
  if (!book?.[id]) return book;
  const entry = { ...book[id] };
  const nick = cleanName(name);
  if (nick) entry.nickname = nick; else delete entry.nickname;
  return { ...book, [id]: entry };
}

// 表示する名前(自分で付けた名前があれば、それ)
export function displayName(id, book) {
  return book?.[id]?.nickname || individual(id)?.name || '';
}

// 図鑑にのせる順番(最後に見た順)
export function bookEntries(book) {
  return Object.entries(book)
    .map(([id, e]) => ({ ...individual(Number(id)), ...e, autoName: individual(Number(id))?.name, displayName: displayName(Number(id), book) }))
    .filter(e => e.name && e.count > 0)   // 写真だけで、まだ会っていないクジラは一覧に出さない
    .sort((a, b) => b.last - a.last);
}
