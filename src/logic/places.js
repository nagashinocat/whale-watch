// 海を見ている場所(沖縄・慶良間に固定)と、その場所の本物の空。three.js は使わない(テストからも使う)。
// カメラが向いている方角(facing)は、クジラのシーズン(冬)の夕日が正面に沈むように、西南西にしている。

import { sunPosition, moonPosition, equivalentHours } from './astro.js';

export const LOCATION = Object.freeze({ label: '沖縄(慶良間)', lat: 26.21, lon: 127.30, facing: 255 });

// 日本時間の月と日
function jstMonthDay(date) {
  const d = new Date(date.getTime() + 9 * 3600000);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
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

// その時刻の本物の空。hours は空の色の時刻、sunAzimuth と moon.azimuth は画面の中の方位
export function realSky(date) {
  const p = LOCATION;
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
