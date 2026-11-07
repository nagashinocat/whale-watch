// とくべつなクジラ(全身が真っ黒で、星空のような模様をもつ3頭)の模様と、出会える確率。
// three.js は使わない(テストからも使う)。
//
//   galaxy(ギンガ): 左右のわき腹に、うずを巻く銀河。体じゅうに星と、きらりと光る十字の星
//   comet(ホウキボシ): 左右のわき腹に、頭のうしろから尾びれのつけ根まで、2本の尾を引く彗星
//   fireworks(ハナビ): 体じゅうに、いろいろな種類の打ち上げ花火が開く
//
// 調べてわかったこと(本物の見え方を、アニメくらい大げさにして使う)
//   ・渦巻銀河: 中心のふくらみは古い星で黄色く、いちばん明るい。うでは若い星で青い。
//     うでの進む側のふちには、ピンクに光るガス(星が生まれる場所)が点々とならび、反対側のふちには黒っぽいちりの筋がある
//   ・彗星: 尾は2本。青くまっすぐで筋の入った「ガスの尾」と、白く幅が広く、曲がった「ちりの尾」。
//     頭(コマ)は、ガスの光で緑がかって見えることが多い
//   ・花火: ぼたん(星だけの丸い玉)・菊(星が光の尾を引く)・柳(金色の長い尾が垂れる)・
//     リング(輪)・クロセット(星が先で十字に4つに割れる)・ヤシ(太い尾が弧を描く)。
//     色は、赤(ストロンチウム)・緑(バリウム)・青(銅)・金(炭や鉄の火花)・白(マグネシウム)。
//     日本の花火は、まん中に色のちがう輪(芯)が入るものが多い
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
const gauss = (x, w) => Math.exp(-((x / w) ** 2));

export const SPECIAL_BLACK = hex(0x0b0c10);
// 体の半径(体長1)のおおよそ。わき腹の上の距離を、u と同じ物差しにするのに使う
const R = 0.09;
// 目のまわり(目の部品は別に作るので、模様をのせない)
const EYE = { u: 0.285, theta: 1.6 };

// 光を足しあわせる入れ物(重なったところは、より明るく)
function light() {
  const c = [0, 0, 0];
  let tw = 0, best = 0;
  return {
    add(color, g, twinkle = 0) {
      if (g <= 0.002) return;
      for (let i = 0; i < 3; i++) c[i] += color[i] * g;
      if (g > best) { best = g; tw = twinkle; }
    },
    done() {
      const glow = Math.max(...c);
      if (glow < 0.04) return { color: [0, 0, 0], glow: 0, twinkle: 0 };
      // 1 をこえる明るさは、白くとばす(アニメのような、まぶしい中心)
      const g = Math.min(1.6, glow);
      const color = c.map(v => v / glow);
      const over = smoothstep(1, 1.6, glow);
      return { color: mix(color, [1, 1, 1], 0.6 * over), glow: g, twinkle: tw };
    },
  };
}

// わき腹の上の平らな座標(x: 前後、y: 上下。背中のほうが +)。side: 1 右、-1 左
function flank(u, theta, side) {
  const center = side > 0 ? Math.PI / 2 : 1.5 * Math.PI;
  const d = wrap(theta - center) * side;   // 左右で同じ向きにそろえる(+ がおなか側)
  return [u, -d * R];
}

// 小さな星: ところどころでまたたく
function dust(L, u, theta, density) {
  const i = Math.round(u / 0.011), j = Math.round(theta / 0.05);
  if (hash(i, j) < 1 - density) return;
  const tint = hash(j, i);
  const c = tint < 0.5 ? hex(0xf4f6ff) : tint < 0.75 ? hex(0x9fd0ff) : tint < 0.9 ? hex(0xffe0a8) : hex(0xffa8e0);
  L.add(c, 0.5 + 0.6 * hash(i + 3, j), hash(i + 7, j + 1));
}

// アニメの星: まるい光に、上下左右へのびる十字の光
function sparkle(L, dx, dy, size, color, k) {
  const r = Math.hypot(dx, dy);
  if (r > size * 1.3) return;
  const core = gauss(r, size * 0.22) * 1.5;
  const spikes = gauss(dy, size * 0.07) * Math.exp(-3 * Math.abs(dx) / size) + gauss(dx, size * 0.07) * Math.exp(-3 * Math.abs(dy) / size);
  L.add(mix(color, [1, 1, 1], 0.5), core, k);
  L.add(color, spikes * 0.9, k);
}

// 十字の星を置く場所(u, θ, 大きさ, 色)
const SPARKLES = Object.freeze([
  [0.22, 1.2, 0.022], [0.3, 0.7, 0.018], [0.62, 0.9, 0.026], [0.78, 1.7, 0.02], [0.7, 2.3, 0.016], [0.88, 1.2, 0.015],
  [0.24, 5.1, 0.02], [0.33, 5.6, 0.017], [0.6, 5.4, 0.025], [0.8, 4.6, 0.02], [0.68, 4.0, 0.016], [0.9, 5.1, 0.015],
  [0.45, 0.1, 0.02], [0.55, 6.1, 0.018], [0.4, 3.1, 0.016],
]).map(([u, t, s], k) => [u, t, s, [hex(0xffffff), hex(0x9fe6ff), hex(0xffc8f0), hex(0xfff0b0)][k % 4]]);

function sparkles(L, u, theta, scale = 1) {
  SPARKLES.forEach(([su, st, s, col], k) => sparkle(L, u - su, wrap(theta - st) * R, s * scale, col, hash(k, 5)));
}

// ---- 銀河 ----
function galaxyAt(u, theta) {
  const L = light();
  for (const side of [1, -1]) {
    const [x, y] = flank(u, theta, side);
    const size = 0.17;
    // 少し傾けて、ななめから見た銀河にする
    const tilt = 0.35;
    const qx = (x - 0.47) / size, qy = y / size;
    const px = qx * Math.cos(tilt) - qy * Math.sin(tilt), py = (qx * Math.sin(tilt) + qy * Math.cos(tilt)) * 1.25;
    const r = Math.hypot(px, py);
    if (r > 1.6) continue;
    const ang = Math.atan2(py, px);
    // 2本のうでが、中心から1回半ほど巻く
    const phi = ang - 2.9 * Math.log(r + 0.05) + (side > 0 ? 0 : 1.3);
    const env = smoothstep(1.35, 0.2, r) * smoothstep(0.06, 0.28, r);
    const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * phi), 4) * env;
    // 進む側のふち: ピンクの星の生まれる場所(つぶつぶ)/ 反対側のふち: 黒いちりの筋
    const lead = Math.pow(0.5 + 0.5 * Math.cos(2 * phi - 0.55), 12) * env;
    const lane = Math.pow(0.5 + 0.5 * Math.cos(2 * phi + 0.75), 14) * env;
    const knot = hash(Math.round(r * 10), Math.round(ang * 4) + side * 50) > 0.45 ? 1 : 0.2;
    const bulge = gauss(r, 0.26), center = gauss(r, 0.08);
    const dim = 1 - 0.85 * lane;
    L.add(hex(0x5b3cff), 0.22 * gauss(r, 0.8) * smoothstep(1.35, 0.85, r));       // まわりのもや
    L.add(mix(hex(0x2f7dff), hex(0x9ff0ff), clamp01(1.2 - r)), arm * 1.05 * dim, 0.5 + 0.5 * Math.sin(r * 7)); // 青いうで
    L.add(hex(0xff4fa8), lead * knot * 1.1 * dim, hash(Math.round(r * 10), 2));      // ピンクのつぶ
    L.add(hex(0xffc95e), bulge * 1.25 * dim);                                       // 黄色いふくらみ
    L.add(hex(0xfff8ea), center * 1.4);                                             // まぶしい中心
  }
  dust(L, u, theta, 0.035);
  sparkles(L, u, theta);
  return L.done();
}

// ---- 彗星 ----
function cometAt(u, theta) {
  const L = light();
  for (const side of [1, -1]) {
    const [x, y] = flank(u, theta, side);
    const H = [0.37, 0.012];    // 頭(目のすぐうしろ)
    const end = 0.985;          // 尾は尾びれのつけ根まで
    const t = (x - H[0]) / (end - H[0]);
    // 頭: まぶしい核と、緑がかった大きな光の玉(コマ)
    const dh = Math.hypot(x - H[0], (y - H[1]) * 1.1);
    L.add(hex(0xffffff), gauss(dh, 0.013) * 1.8, 0.1);
    L.add(hex(0x8affd8), gauss(dh, 0.045) * 0.95, 0.2);
    L.add(hex(0x5fc8ff), gauss(dh, 0.08) * 0.3);
    if (t > -0.02 && t < 1.02) {
      const tt = clamp01(t);
      const fade = smoothstep(1.02, 0.85, t);
      // ガスの尾: まっすぐ、少し上へ。細めで、すじが入る
      const ionY = H[1] + 0.022 * tt;
      const wI = 0.007 + 0.034 * tt;
      const offI = (y - ionY) / wI;
      const rays = 0.55 + 0.45 * Math.cos(offI * 4.2) ** 2;
      const ion = Math.pow(1 - tt, 0.5) * gauss(offI, 1) * rays * fade;
      L.add(mix(mix(hex(0xd8f4ff), hex(0x3d8bff), smoothstep(0, 0.45, tt)), hex(0x7a4cff), smoothstep(0.45, 1, tt)), ion * 1.3, tt);
      // ちりの尾: 白から金へ。おなかのほうへ大きく弧を描き、うしろほど広がる
      const dustY = H[1] - 0.075 * tt * tt;
      const wD = 0.012 + 0.075 * tt;
      const offD = (y - dustY) / wD;
      const dustTail = Math.pow(1 - tt, 0.75) * gauss(offD, 1) * fade;
      L.add(mix(mix(hex(0xfffbf0), hex(0xffd58a), smoothstep(0, 0.5, tt)), hex(0xff9a70), smoothstep(0.5, 1, tt)), dustTail * 1.15, 0.3 + tt);
      // 尾の中にまじる、きらきらしたちり
      const gi = Math.round(x / 0.013), gj = Math.round(y / 0.006);
      if (dustTail > 0.15 && hash(gi, gj + side * 31) > 0.9) L.add(hex(0xffffff), 0.9 * dustTail + 0.3, hash(gj, gi));
    }
  }
  dust(L, u, theta, 0.025);
  sparkles(L, u, theta, 0.85);
  return L.done();
}

// ---- 花火 ----
// [u, θ, 大きさ, 種類, 色, 芯の色]。体じゅう(左右のわき腹・背中・おなか)に開く
const C = { red: 0xff3b5c, green: 0x3dff8f, blue: 0x3d9bff, gold: 0xffc23d, violet: 0xc06bff, pink: 0xff6fd8, white: 0xfff6e0, orange: 0xff8a2b, cyan: 0x4df2ff };
const BURSTS = Object.freeze([
  [0.4, 1.5, 0.075, 'kiku', C.red, C.gold],
  [0.6, 1.72, 0.085, 'yanagi', C.gold, C.white],
  [0.76, 1.4, 0.06, 'crossette', C.green, C.white],
  [0.52, 2.45, 0.05, 'botan', C.blue, C.pink],
  [0.42, 4.78, 0.075, 'kiku', C.gold, C.blue],
  [0.6, 4.55, 0.085, 'ring', C.pink, C.cyan],
  [0.77, 4.85, 0.06, 'palm', C.orange, C.gold],
  [0.52, 3.85, 0.05, 'botan', C.violet, C.green],
  [0.35, 0.22, 0.05, 'botan', C.green, C.red],
  [0.5, 6.05, 0.06, 'kiku', C.violet, C.white],
  [0.66, 0.15, 0.05, 'crossette', C.cyan, C.white],
  [0.86, 0.62, 0.042, 'ring', C.gold, C.red],
  [0.86, 5.62, 0.042, 'botan', C.red, C.white],
  [0.24, 3.14, 0.045, 'ring', C.orange, C.cyan],
  [0.66, 3.14, 0.06, 'kiku', C.green, C.pink],
  [0.2, 0.62, 0.04, 'botan', C.blue, C.white],
]);
export const FIREWORK_BURSTS = BURSTS;
const FIREWORK_SCALE = 1.3;

// 花火の形を、線(光の尾)と点(星)に分けて作る。座標は花火のまん中から、大きさ1。down は下(おなか側)の向き
function shellShape(type, down, k) {
  const lines = [], dots = [];
  const n = { kiku: 18, botan: 16, yanagi: 14, ring: 22, crossette: 10, palm: 7 }[type];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + k * 0.37;
    const dir = [Math.cos(a), Math.sin(a)];
    if (type === 'kiku') {
      // 星が光の尾を引く(まん中は細く、先ほど明るい)
      lines.push({ a: dir.map(v => v * 0.3), b: dir.map(v => v * 0.92), w: 0.045, from: 0.25, to: 1 });
      dots.push({ p: dir.map(v => v * 0.95), r: 0.075, g: 1.5 });
    } else if (type === 'botan') {
      dots.push({ p: dir.map(v => v * 0.9), r: 0.085, g: 1.4 });
      dots.push({ p: dir.map(v => v * 0.55), r: 0.06, g: 1.1, core: true });
    } else if (type === 'ring') {
      dots.push({ p: dir.map(v => v * 0.85), r: 0.07, g: 1.4 });
    } else if (type === 'yanagi') {
      // 金色の長い尾が、ゆっくり垂れる
      let p = [0, 0];
      const v = dir.map(x => x * 0.7);
      for (let s = 0; s < 7; s++) {
        const q = [p[0] + v[0] * 0.2, p[1] + v[1] * 0.2 + down * 0.035 * s];
        lines.push({ a: p, b: q, w: 0.04, from: s / 7, to: (s + 1) / 7, fadeTail: true });
        p = q;
      }
    } else if (type === 'crossette') {
      const tip = dir.map(v => v * 0.6);
      lines.push({ a: dir.map(v => v * 0.15), b: tip, w: 0.045, from: 0.3, to: 0.8 });
      for (let j = 0; j < 4; j++) {
        const b = a + Math.PI / 4 + (j * Math.PI) / 2;
        const end = [tip[0] + Math.cos(b) * 0.38, tip[1] + Math.sin(b) * 0.38];
        lines.push({ a: tip, b: end, w: 0.035, from: 0.5, to: 1 });
        dots.push({ p: end, r: 0.05, g: 1.2 });
      }
    } else if (type === 'palm') {
      // 太い尾が弧を描いて、先で少し垂れる
      let p = [0, 0];
      for (let s = 0; s < 6; s++) {
        const q = [p[0] + dir[0] * 0.17, p[1] + dir[1] * 0.17 + down * 0.02 * s * s * 0.3];
        lines.push({ a: p, b: q, w: 0.07, from: s / 6, to: (s + 1) / 6 });
        p = q;
      }
      dots.push({ p, r: 0.09, g: 1.5 });
    }
  }
  return { lines, dots };
}

const SHAPES = BURSTS.map(([, theta, , type], k) => {
  // 右のわき腹では θ が増えるほうがおなか、左では減るほうがおなか。背中とおなかでは垂れない
  const down = Math.abs(wrap(theta - Math.PI / 2)) < 0.9 ? 1 : Math.abs(wrap(theta - 1.5 * Math.PI)) < 0.9 ? -1 : 0;
  return shellShape(type, down, k);
});

function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp01(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1));
  return [Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy), t];
}

function fireworksAt(u, theta) {
  const L = light();
  BURSTS.forEach(([bu, bt, size, , col, core], k) => {
    // 体の網目は前後に粗いので、花火は大きめに開かせる(形がつぶれないように)
    const big = size * FIREWORK_SCALE;
    const px = (u - bu) / big, py = (wrap(theta - bt) * R) / big;
    if (Math.hypot(px, py) > 1.5) return;
    const { lines, dots } = SHAPES[k];
    const c = hex(col), cc = hex(core);
    const tw = hash(k, 3);
    // 光の尾: 根もとは白っぽく、先ほどその花火の色。ところどころ火花がまたたく
    for (const ln of lines) {
      const [d, t] = segDist(px, py, ln.a, ln.b);
      if (d > ln.w * 3) continue;
      const along = ln.from + (ln.to - ln.from) * t;
      const g = gauss(d, ln.w) * (ln.fadeTail ? 1.2 * (1 - along * 0.6) : 0.35 + 0.85 * along);
      const spark = hash(Math.round(px * 40), Math.round(py * 40) + k) > 0.8 ? 1.5 : 1;
      L.add(mix(hex(0xfff3d8), c, smoothstep(0.1, 0.6, along)), g * spark, tw + along * 0.5);
    }
    for (const dt of dots) {
      const g = gauss(Math.hypot(px - dt.p[0], py - dt.p[1]), dt.r) * dt.g;
      L.add(dt.core ? cc : c, g, tw);
    }
    // まん中の芯(色ちがいの小さな光)
    L.add(mix(cc, [1, 1, 1], 0.4), gauss(Math.hypot(px, py), 0.12) * 1.2, tw);
  });
  dust(L, u, theta, 0.015);
  return L.done();
}

// 模様: { color(sRGB 0〜1), glow(0〜1.6 光る強さ。1 をこえるところは白くまぶしい), twinkle(0〜1 またたきのずれ) }
export function specialMotif(coat, u, theta) {
  const none = { color: [0, 0, 0], glow: 0, twinkle: 0 };
  if (!SPECIAL.coats.includes(coat)) return none;
  // 目のまわり・口先・尾の先(彗星だけは尾びれのつけ根まで)には、のせない
  const eye = Math.min(...[EYE.theta, 2 * Math.PI - EYE.theta].map(t => Math.hypot(u - EYE.u, wrap(theta - t) * R)));
  const tailEnd = coat === 'comet' ? 0.99 : 0.93;
  if (eye < 0.04 || u < 0.03 || u > tailEnd) return none;
  const m = coat === 'galaxy' ? galaxyAt(u, theta) : coat === 'comet' ? cometAt(u, theta) : fireworksAt(u, theta);
  return m.glow < 0.04 ? none : m;
}

// 昼に見える体の色: 真っ黒に、模様の色をのせる(アニメのように、昼でもはっきり)
export function specialBodyColor(coat, u, theta) {
  const m = specialMotif(coat, u, theta);
  return mix(SPECIAL_BLACK, m.color, 0.8 * Math.min(1, m.glow));
}
