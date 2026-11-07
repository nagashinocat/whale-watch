// 回遊(季節ごとの長い旅)の記録。はじめて会ったクジラにタグを付け、仮想の回遊ルートを決める。
// 図鑑では、いまどのあたりにいるかが見られ、もう一度会うと、そのあいだに回ってきた道すじがのる。
// three.js も画面も使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・沖縄の海は、ザトウクジラが冬に子育てをする場所。夏は北の海(ロシアの沿岸など)で、たくさん食べる。
//     沖縄・ロシア・フィリピンの海で、同じクジラが尾びれの写真で何頭も見つかっている
//   ・ロシアの餌場から南へ下る途中で、北海道の釧路沖を通ったクジラが記録されている(3,000kmをこえる大回遊)
//   ・餌場のまわりでは、あちこち寄り道しながら食べ、長い移動では1日に100km前後進む
// 本物は1年かけて回るが、このアプリでは時間を早回しして、TIME_SCALE 倍の速さで旅をする

import { onLand, distanceKm, nearestRegion } from './northPacific.js';

export const MIGRATION = Object.freeze({
  loopHours: 72,     // 1周(沖縄 → 北の海 → 沖縄)にかかる、ほんとうの時間
  maxTrips: 5,       // 図鑑に残す旅の数
});
// クジラの時間は、何倍の速さか(1年 ÷ 1周の時間)
export const TIME_SCALE = (365 * 24) / MIGRATION.loopHours;

// 通り道(海の上の点。[経度, 緯度])
const P = {
  OKI: [127.5, 26.55], OKI_N: [127.75, 27.25], OKI_S: [127.4, 25.8], AMAMI: [130, 28], CHOSHI: [142, 35.9], TANE: [131.4, 30.2], KOCHI: [133.8, 32.4], KII: [136.2, 33], BOSO: [141.3, 34.6],
  SANRIKU: [143, 39], KUSHIRO: [144.9, 42.3], NEMURO: [146.8, 42.9], KURIL_S: [148.4, 44.2], KURIL_C: [152.5, 46.6], KURIL_N: [157, 49.8],
  AVACHA: [159.8, 52.4], KRONOTSKY: [163.8, 54], KAMCHATSKY: [164.6, 56.3], KARAGINSKY: [164.4, 58.3], COMMANDER: [167.5, 55.6],
  ATTU: [173.5, 53.4], OLYUTORSKY: [169.8, 59.4], ANADYR: [177.8, 61.9], OGASAWARA: [141.5, 27.6], BABUYAN: [122, 19.9],
  TAIWAN_E: [122.4, 23.6], OPEN: [150, 40],
};
const NORTH = ['OKI', 'OKI_N', 'AMAMI', 'TANE', 'KOCHI', 'KII', 'BOSO', 'CHOSHI', 'SANRIKU', 'KUSHIRO', 'NEMURO', 'KURIL_S', 'KURIL_C', 'KURIL_N', 'AVACHA'];
const SOUTH_KUSHIRO = ['AVACHA', 'KURIL_N', 'KURIL_C', 'KURIL_S', 'NEMURO', 'KUSHIRO', 'SANRIKU', 'CHOSHI', 'BOSO'];

// 回遊ルートの種類(北へ上る → 餌場で食べる → 南へ下る)
export const ROUTES = Object.freeze({
  kamchatka: { ja: 'カムチャツカの海へ', en: 'To Kamchatka', path: [...NORTH, 'KRONOTSKY', 'KAMCHATSKY', 'KARAGINSKY', '*', 'KAMCHATSKY', 'KRONOTSKY', ...SOUTH_KUSHIRO, 'OGASAWARA', 'OKI_S', 'OKI'], feed: 'KARAGINSKY' },
  aleutian: { ja: 'アリューシャン列島へ', en: 'To the Aleutians', path: [...NORTH, 'KRONOTSKY', 'COMMANDER', 'ATTU', '*', 'COMMANDER', ...SOUTH_KUSHIRO, 'KII', 'KOCHI', 'TANE', 'AMAMI', 'OKI_N', 'OKI'], feed: 'ATTU' },
  bering: { ja: 'ベーリング海へ', en: 'To the Bering Sea', path: [...NORTH, 'KRONOTSKY', 'KAMCHATSKY', 'OLYUTORSKY', 'ANADYR', '*', 'OLYUTORSKY', 'COMMANDER', 'OPEN', 'OGASAWARA', 'BABUYAN', 'TAIWAN_E', 'OKI'], feed: 'ANADYR' },
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

// 角を丸くする(となりの線の上の点だけを使うので、大きくはみださない)
function chaikin(pts, times = 2) {
  let p = pts;
  for (let k = 0; k < times; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

const cache = new Map();
// 1頭の1回の旅の道すじ(点の列と、はじめからの距離 km)。seed で、ルートの種類と寄り道が決まる
export function routeFor(seed) {
  if (cache.has(seed)) return cache.get(seed);
  const rng = seeded(seed * 2654435761);
  const names = Object.keys(ROUTES);
  const kind = names[Math.floor(rng() * names.length)];
  const def = ROUTES[kind];
  const pts = [];
  for (const name of def.path) {
    if (name === '*') {
      // 餌場のまわりで寄り道しながら食べる(海の上の点だけ)
      const c = P[def.feed];
      for (let k = 0; k < 6; k++) {
        const p = [c[0] + (rng() - 0.5) * 3.2, c[1] + (rng() - 0.5) * 1.6];
        if (!onLand(p)) pts.push(p);
      }
      continue;
    }
    const base = P[name];
    // 沖縄(あなたの海)以外は、1頭ずつ少しずつちがう道を通る
    const j = name.startsWith('OKI') ? 0 : 0.35;
    const p = [base[0] + (rng() - 0.5) * 2 * j, base[1] + (rng() - 0.5) * 2 * j];
    pts.push(onLand(p) ? base : p);
  }
  const line = chaikin(pts);
  const dist = [0];
  for (let i = 1; i < line.length; i++) dist.push(dist[i - 1] + distanceKm(line[i - 1], line[i]));
  const route = { kind, line, dist, length: dist[dist.length - 1] };
  cache.set(seed, route);
  return route;
}

// 道すじの上の、はじめから k(0〜1)の場所
export function pointAt(route, k) {
  const target = Math.min(1, Math.max(0, k)) * route.length;
  let i = 1;
  while (i < route.dist.length - 1 && route.dist[i] < target) i++;
  const d0 = route.dist[i - 1], d1 = route.dist[i];
  const t = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
  const [a, b] = [route.line[i - 1], route.line[i]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// 道すじの、はじめから k までの部分(地図に描く線)
export function pathUntil(route, k) {
  const target = Math.min(1, Math.max(0, k)) * route.length;
  const out = [];
  for (let i = 0; i < route.line.length && route.dist[i] <= target; i++) out.push(route.line[i]);
  out.push(pointAt(route, k));
  return out;
}

// 道すじの、k から終わり(沖縄)までの部分
export function pathFrom(route, k) {
  const target = Math.min(1, Math.max(0, k)) * route.length;
  const out = [pointAt(route, k)];
  for (let i = 0; i < route.line.length; i++) if (route.dist[i] > target) out.push(route.line[i]);
  return out;
}

// タグを付けてから、どこまで進んだか(0〜1)。1周したら、また北へ向かう
export const progress = (tag, now) => {
  const k = (now - tag.at) / (MIGRATION.loopHours * 3600000);
  return Math.max(0, k);
};

// いまの様子: 場所・いちばん近い地名・沖縄からの距離・旅のどの段階か
export function whereNow(tag, now) {
  const route = routeFor(tag.seed);
  const total = progress(tag, now);
  const laps = Math.floor(total), k = total - laps;
  const p = pointAt(route, k);
  // 旅の段階(北へ上る・餌場で食べる・南へ下る・沖縄の近く)
  const stage = k < 0.04 ? 'leaving' : k < 0.38 ? 'north' : k < 0.6 ? 'feeding' : k < 0.96 ? 'south' : 'home';
  return { point: p, region: nearestRegion(p), fromHomeKm: Math.round(distanceKm(p, ROUTE_HOME)), k, laps, route, stage };
}
export const ROUTE_HOME = P.OKI;

// 会ったときの記録。はじめて会ったときにタグを付け、2回目からは、そのあいだの旅を記録してタグを付けなおす
export function tagOnSighting(entry, id, now) {
  const seedOf = at => ((id * 7919) ^ Math.floor(at / 1000)) >>> 0;
  const next = { ...entry };
  if (entry.tag) {
    const trip = { from: entry.tag.at, to: now, seed: entry.tag.seed };
    next.trips = [...(entry.trips ?? []), trip].slice(-MIGRATION.maxTrips);
  }
  next.tag = { at: now, seed: seedOf(now) };
  return next;
}

// 終わった旅のようす: 通った道(会ったところで沖縄へもどってくる)・距離・日数
export function tripSummary(trip) {
  const route = routeFor(trip.seed);
  const total = progress({ at: trip.from }, trip.to);
  const laps = Math.floor(total), k = total - laps;
  // 1周以上していたら、道すじ全部。とちゅうで会ったら、そこから道すじの残りを急いでたどって、あなたの海へもどってきた
  const path = laps > 0 ? route.line.slice() : pathUntil(route, k);
  const back = laps > 0 ? [] : pathFrom(route, k);
  const km = Math.round(route.length * (laps + (laps > 0 ? 0 : 1)) + (laps > 0 ? route.length * k : 0));
  const days = ((trip.to - trip.from) / 86400000) * TIME_SCALE;
  const far = path.reduce((m, p) => Math.max(m, distanceKm(p, ROUTE_HOME)), 0);
  const farthest = path.reduce((best, p) => (distanceKm(p, ROUTE_HOME) > distanceKm(best, ROUTE_HOME) ? p : best), path[0]);
  return { path, back, km, whaleDays: days, laps, kind: route.kind, farKm: Math.round(far), farthest: nearestRegion(farthest) };
}

// 図鑑の記録を読みこむときに、タグと旅の記録を確かめる(こわれたものは捨てる)
export function cleanMigration(v) {
  const out = {};
  const ok = t => t && Number.isFinite(t.at) && Number.isFinite(t.seed);
  if (ok(v?.tag)) out.tag = { at: v.tag.at, seed: v.tag.seed >>> 0 };
  if (Array.isArray(v?.trips)) {
    const trips = v.trips.filter(t => t && Number.isFinite(t.from) && Number.isFinite(t.to) && t.to >= t.from && Number.isFinite(t.seed))
      .map(t => ({ from: t.from, to: t.to, seed: t.seed >>> 0 })).slice(-MIGRATION.maxTrips);
    if (trips.length) out.trips = trips;
  }
  return out;
}
