// 海を見ている場所と、クジラのシーズン。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   慶良間諸島周辺(沖縄): ザトウクジラ。シーズンは冬(12〜2月)と春(3〜5月)。(環境省)
//   小笠原近海: ザトウクジラは11月下旬に現れ、2〜4月がいちばん多い。
//               マッコウクジラはメスと子どもが一年中いる。(観光庁)
// カメラが向いている方角(facing)は、クジラのシーズンの夕日が正面に沈むように、西南西にしている。

import { sunPosition, moonPosition, equivalentHours } from './astro.js';
import { SCHEDULE } from './config.js';

export const LOCATIONS = Object.freeze({
  okinawa: Object.freeze({
    label: '沖縄(慶良間)', lat: 26.21, lon: 127.30, facing: 255,
    humpback: { months: [12, 1, 2, 3, 4, 5], peak: [], from: null },
    residents: [],
  }),
  ogasawara: Object.freeze({
    label: '小笠原(父島)', lat: 27.09, lon: 142.19, facing: 255,
    // 11月は下旬(20日ごろ)から。終わりの月は資料になかったので、いちばん多い時期の4月までにしている
    humpback: { months: [11, 12, 1, 2, 3, 4], peak: [2, 3, 4], from: { month: 11, day: 20 } },
    residents: ['sperm'],
  }),
});

// 日本時間の月と日
function jstMonthDay(date) {
  const d = new Date(date.getTime() + 9 * 3600000);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// その日がシーズンかどうかと、クジラの出やすさ
export function seasonInfo(place, date) {
  const p = LOCATIONS[place] ?? LOCATIONS.okinawa;
  const { month, day } = jstMonthDay(date);
  const h = p.humpback;
  let inSeason = h.months.includes(month);
  if (inSeason && h.from && month === h.from.month && day < h.from.day) inSeason = false;
  if (inSeason) {
    const peak = h.peak.includes(month);
    return {
      state: peak ? 'peak' : 'season',
      label: peak ? 'ザトウクジラがいちばん多い時期' : 'ザトウクジラのシーズン中',
      intervalScale: peak ? 0.7 : 1,
      weights: SCHEDULE.weights,
    };
  }
  // シーズン外。一年中いるクジラがいれば、そのクジラだけが出る
  if (p.residents.includes('sperm')) {
    return { state: 'off', label: 'ザトウクジラのシーズン外(マッコウクジラはいます)', intervalScale: 1.5, weights: { sleeping: 1 } };
  }
  return { state: 'off', label: 'ザトウクジラのシーズン外(ごくまれに出ます)', intervalScale: 4, weights: SCHEDULE.weights };
}

// その日の太陽のいちばん高い高さ(度)。場所と日付ごとに覚えておく
const dayMaxCache = new Map();
function dayMaxElevation(p, date) {
  const { month, day } = jstMonthDay(date);
  const key = `${p.lat},${p.lon},${month},${day}`;
  if (!dayMaxCache.has(key)) {
    const start = Date.UTC(date.getUTCFullYear(), month - 1, day, -9);
    let best = -90;
    for (let m = 0; m < 24 * 60; m += 10) best = Math.max(best, sunPosition(new Date(start + m * 60000), p.lat, p.lon).elevation);
    dayMaxCache.set(key, best);
  }
  return dayMaxCache.get(key);
}

// 本物の太陽の高さを、空の色の高さにそろえる。地平線の近く(6度まで)は本物のまま、
// それより上は、その日のいちばん高い高さが空の色の昼(60度)になるようにのばす
function skyElevation(el, dayMax) {
  if (el <= 6 || dayMax <= 6) return el;
  return 6 + ((el - 6) * (60 - 6)) / (dayMax - 6);
}

// 方位を、カメラの正面が180度になる向きに直す
const toScene = (azimuth, facing) => ((180 + azimuth - facing) % 360 + 360) % 360;

// その場所・その時刻の本物の空。hours は空の色の時刻、sunAzimuth と moon.azimuth は画面の中の方位
export function realSky(place, date) {
  const p = LOCATIONS[place] ?? LOCATIONS.okinawa;
  const sun = sunPosition(date, p.lat, p.lon);
  const later = sunPosition(new Date(date.getTime() + 120000), p.lat, p.lon);
  const rising = later.elevation > sun.elevation;
  const moon = moonPosition(date, p.lat, p.lon);
  return {
    hours: equivalentHours(skyElevation(sun.elevation, dayMaxElevation(p, date)), rising),
    rising,
    sunElevation: sun.elevation,
    sunAzimuth: toScene(sun.azimuth, p.facing),
    moon: { elevation: moon.elevation, azimuth: toScene(moon.azimuth, p.facing), illumination: moon.illumination, waxing: moon.waxing },
  };
}
