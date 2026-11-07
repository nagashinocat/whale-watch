// とくべつなクジラ(全身が真っ黒で、星空のような模様をもつ3頭)の模様と、出会える確率。
// three.js は使わない(テストからも使う)。
//
//   galaxy(ギンガ): 左右のわき腹に、うずを巻く銀河。体じゅうに小さな星
//   comet(ホウキボシ): 左右のわき腹に、前から後ろへ尾を引く彗星
//   fireworks(ハナビ): 体じゅうに、打ち上げ花火の輪がいくつも開く
//
// 模様は昼は色として見え、夜は模様だけが光る(光る強さ glow と、またたきの位置 twinkle を返す)。
// 体の場所: u は頭 0 〜 尾 1、θ は背中 0 から右回り(右のわき腹 π/2、左 3π/2)

import { SCHEDULE } from './config.js';

export const SPECIAL = Object.freeze({
  // 出会いの回数あたり、それぞれの子に会える割合(およそ1000回に1回)
  perEncounter: 1 / 1000,
  coats: Object.freeze(['galaxy', 'comet', 'fireworks']),
  firstId: 25,   // 図鑑の番号(ふつうの24頭のあと)
});

// 1頭だけで来る出かた(群れや親子では出さない)
export const SOLO_PATTERNS = Object.freeze(['spout', 'fluke', 'breach', 'bigBreach', 'spyhop', 'pecSlap', 'lobtail', 'feeding', 'eyeContact']);

// 1頭で来るときに、とくべつな子がそれぞれ来る確率。
// 出会い(鳴き声だけのとき以外)のうち、1頭で来る出かたは一部だけなので、そのぶん高くして、出会いあたり perEncounter にする
export function specialChance(weights = SCHEDULE.weights) {
  const encounters = Object.entries(weights).filter(([n]) => n !== 'voice').reduce((s, [, w]) => s + w, 0);
  const solo = SOLO_PATTERNS.reduce((s, n) => s + (weights[n] ?? 0), 0);
  return SPECIAL.perEncounter * encounters / solo;
}

const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = h => [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export const SPECIAL_BLACK = hex(0x0c0d10);
// 体の半径(体長1)のおおよそ。わき腹の上の距離を、u と同じ物差しにするのに使う
const R = 0.09;
// 目のまわり(目の部品は別に作るので、模様をのせない)
const EYE = { u: 0.285, theta: 1.6 };

// わき腹の上の平らな座標(x: 前後、y: 上下。背中のほうが +)。side: 1 右、-1 左
function flank(u, theta, side) {
  const center = side > 0 ? Math.PI / 2 : 1.5 * Math.PI;
  const d = wrap(theta - center) * side;   // 左右で同じ向きにそろえる(+ がおなか側)
  return [u, -d * R];
}

// 星: 小さな点が、ところどころでまたたく
function stars(u, theta, density) {
  const i = Math.round(u / 0.011), j = Math.round(theta / 0.05);
  const h = hash(i, j);
  if (h < 1 - density) return null;
  const tint = hash(j, i);
  return { color: tint < 0.5 ? hex(0xf4f6ff) : tint < 0.8 ? hex(0xbcd8ff) : hex(0xffe6b8), glow: 0.55 + 0.45 * hash(i + 3, j), twinkle: hash(i + 7, j + 1) };
}

function galaxyAt(u, theta) {
  let best = { color: [0, 0, 0], glow: 0, twinkle: 0 };
  for (const side of [1, -1]) {
    const [x, y] = flank(u, theta, side);
    // 銀河の中心: 体のまん中より少し前、わき腹のまん中より少し上
    const px = (x - 0.46) / 0.13, py = (y + 0.004) / 0.13;
    const r = Math.hypot(px, py);
    if (r > 1.3) continue;
    const ang = Math.atan2(py, px * 0.85);
    const phi = ang - 2.4 * Math.log(r + 0.06) + (side > 0 ? 0 : 1.1);
    const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * phi), 5) * smoothstep(1.15, 0.25, r) * smoothstep(0.04, 0.22, r);
    const core = Math.exp(-((r / 0.2) ** 2));
    const dust = 0.18 * smoothstep(1.2, 0.3, r);
    const glow = clamp01(core * 1.1 + arm * 0.9 + dust * 0.4);
    const color = mix(mix(hex(0x6a4cff), hex(0x47c6ff), clamp01(r * 1.1)), hex(0xfff0d8), clamp01(core * 1.3));
    const pink = 0.35 * Math.pow(0.5 + 0.5 * Math.cos(2 * phi + 0.9), 8) * smoothstep(1, 0.3, r);
    const c = mix(color, hex(0xff6fd0), pink);
    if (glow > best.glow) best = { color: c, glow, twinkle: 0.5 + 0.5 * Math.sin(r * 9) };
  }
  // 銀河のまわりほど、星が多い
  const s = stars(u, theta, 0.025 + 0.08 * best.glow);
  if (s && s.glow > best.glow) best = s;
  return best;
}

function cometAt(u, theta) {
  let best = { color: [0, 0, 0], glow: 0, twinkle: 0 };
  for (const side of [1, -1]) {
    const [x, y] = flank(u, theta, side);
    // 彗星の頭は前(目より後ろ)、尾は後ろへ、背中のほうへ少し上がりながら広がる
    for (const tail of [{ to: [0.8, -0.032], w: 0.05, color: [hex(0xdff6ff), hex(0x5fd8ff), hex(0x3a6bff)], k: 1 },
      { to: [0.74, -0.06], w: 0.032, color: [hex(0xeee6ff), hex(0xb48cff), hex(0x6a4cff)], k: 0.6 }]) {
      const H = [0.36, 0.004];
      const ax = tail.to[0] - H[0], ay = tail.to[1] - H[1];
      const len = Math.hypot(ax, ay);
      const t = ((x - H[0]) * ax + (y - H[1]) * ay) / (len * len);
      const perp = Math.abs((x - H[0]) * ay - (y - H[1]) * ax) / len;
      const head = Math.exp(-((Math.hypot(x - H[0], (y - H[1]) * 1.2) / 0.016) ** 2));
      let glow = head * 1.2;
      let color = hex(0xffffff);
      if (t > 0 && t < 1) {
        const w = 0.006 + tail.w * t;
        const body = tail.k * Math.pow(1 - t, 0.8) * Math.exp(-((perp / w) ** 2));
        if (body > glow) { glow = body; color = t < 0.35 ? mix(tail.color[0], tail.color[1], t / 0.35) : mix(tail.color[1], tail.color[2], (t - 0.35) / 0.65); }
      }
      glow = clamp01(glow);
      if (glow > best.glow) best = { color, glow, twinkle: clamp01(t) };
    }
  }
  const s = stars(u, theta, 0.02);
  if (s && s.glow > best.glow) best = s;
  return best;
}

// 花火の輪の場所(体じゅう: 左右のわき腹・背中・おなか)と色
const BURSTS = Object.freeze([
  [0.4, 1.5, 0.07, 0xff4d6d], [0.58, 1.75, 0.08, 0xffd24d], [0.74, 1.4, 0.055, 0x4dff9a], [0.5, 2.5, 0.05, 0x4dc3ff],
  [0.42, 4.75, 0.07, 0xffd24d], [0.6, 4.5, 0.08, 0xff7ae6], [0.76, 4.85, 0.055, 0x4dc3ff], [0.52, 3.8, 0.05, 0xff4d6d],
  [0.36, 0.25, 0.05, 0x4dff9a], [0.5, 6.05, 0.06, 0xffa04d], [0.66, 0.15, 0.05, 0xff7ae6], [0.86, 0.6, 0.04, 0xffd24d],
  [0.86, 5.6, 0.04, 0xff4d6d], [0.24, 3.14, 0.045, 0xffa04d], [0.64, 3.14, 0.06, 0x4dff9a], [0.2, 0.6, 0.04, 0x4dc3ff],
]);
export const FIREWORK_BURSTS = BURSTS;

function fireworksAt(u, theta) {
  let best = { color: [0, 0, 0], glow: 0, twinkle: 0 };
  BURSTS.forEach(([bu, bt, size, col], k) => {
    const px = (u - bu) / size, py = (wrap(theta - bt) * R) / size;
    const r = Math.hypot(px, py);
    if (r > 1.25) return;
    const n = 12 + (k % 3) * 2, off = k * 0.7;
    const ang = Math.atan2(py, px) + off;
    const spoke = Math.pow(0.5 + 0.5 * Math.cos(n * ang), 8);
    const rays = spoke * smoothstep(0.15, 0.35, r) * smoothstep(1.05, 0.55, r);
    const tips = Math.pow(0.5 + 0.5 * Math.cos(n * ang), 3) * Math.exp(-(((r - 0.95) / 0.12) ** 2));
    const core = Math.exp(-((r / 0.16) ** 2)) * 0.8;
    const glow = clamp01(rays + tips * 1.1 + core);
    if (glow <= best.glow) return;
    // まん中は白っぽく、外ほどその花火の色
    best = { color: mix(hex(0xfff6e0), hex(col), smoothstep(0.1, 0.6, r)), glow, twinkle: hash(k, 3) };
  });
  const s = stars(u, theta, 0.012);
  if (s && s.glow > best.glow) best = s;
  return best;
}

// 模様: { color(sRGB 0〜1), glow(0〜1 光る強さ), twinkle(0〜1 またたきのずれ) }
export function specialMotif(coat, u, theta) {
  const none = { color: [0, 0, 0], glow: 0, twinkle: 0 };
  if (!SPECIAL.coats.includes(coat)) return none;
  // 目のまわり・口先・尾の付け根には、のせない
  const eye = Math.min(...[EYE.theta, 2 * Math.PI - EYE.theta].map(t => Math.hypot(u - EYE.u, wrap(theta - t) * R)));
  if (eye < 0.04 || u < 0.03 || u > 0.93) return none;
  const m = coat === 'galaxy' ? galaxyAt(u, theta) : coat === 'comet' ? cometAt(u, theta) : fireworksAt(u, theta);
  return m.glow < 0.04 ? none : m;
}

// 昼に見える体の色: 真っ黒に、模様の色を少しのせる
export function specialBodyColor(coat, u, theta) {
  const m = specialMotif(coat, u, theta);
  return mix(SPECIAL_BLACK, m.color, 0.7 * m.glow);
}
