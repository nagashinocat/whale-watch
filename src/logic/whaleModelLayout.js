// ザトウクジラの3Dモデル(assets/models/humpback.glb)の、頂点ごとの「体のどこか」を求める。three.js は使わない(テストからも使う)。
//
// いまの色の決め方(traits.js・flukeId.js・specialCoats.js)は、計算で作った体の網目の場所(u, θ)や、
// 胸びれ・尾びれの場所(s, c)を使う。モデルの頂点にも同じ場所を付ければ、同じ色の決め方がそのまま使える。
//
//   体:     u は頭 0 〜 尾 1、θ は背中 0 から右回り(右のわき腹 π/2、おなか π)
//   胸びれ: s はつけ根 0 〜 先 1、top は上の面か
//   尾びれ: s は左のはし -1 〜 右のはし 1、c は前のふち 0 〜 うしろのふち 1、under は裏(おなか側)か
//
// モデルは tools/build_whale_model.py で、頭が -z、体長 1、まん中が原点になるように作ってある。

import { skinColor, jawWeights } from './whaleShape.js';
import { traitBodyColor, traitFinColor, flukeBite } from './traits.js';
import { flukeWhiteness } from './flukeId.js';

export const MODEL = Object.freeze({
  url: 'assets/models/humpback.glb',
  flukeRoot: 0.915,                 // これよりうしろは尾びれ
  finRange: Object.freeze([0.25, 0.68]),   // 胸びれがつく範囲(u)
  // 目のまん中の高さと前後の場所(モデルを横から写して決めた)。目の玉の大きさ(体長1)
  eye: Object.freeze({ y: 0.032, z: -0.212, radius: 0.0062 }),
});

// 目の場所(左右)。頭の横で、決めた高さ・前後にいちばん近い肌の点と、そこでの外向きの向き
export function eyeSpots(pos, nrm, at = MODEL.eye) {
  return [1, -1].map(side => {
    // 決めた高さ・前後のまわり(半径 near の中)で、いちばん外側の肌の点。なければ、いちばん近い点
    let best = -1, bestX = -Infinity, nearest = -1, nearD = Infinity;
    const near = 0.004;
    for (let i = 0; i < pos.length / 3; i++) {
      if (Math.sign(pos[i * 3]) !== side) continue;
      const d = Math.hypot(pos[i * 3 + 1] - at.y, pos[i * 3 + 2] - at.z);
      if (d < nearD) { nearD = d; nearest = i; }
      if (d < near && Math.abs(pos[i * 3]) > bestX) { bestX = Math.abs(pos[i * 3]); best = i; }
    }
    if (best < 0) best = nearest;
    // 目のまん中は決めた高さ・前後のまま、横の位置だけ肌(まぶたのふち)の高さにする
    const p = best === nearest && bestX === -Infinity ? [pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]] : [side * bestX, at.y, at.z];
    const n = [0, 0, 0];
    for (let i = 0; i < pos.length / 3; i++) {
      if (Math.sign(pos[i * 3]) !== side) continue;
      if (Math.hypot(pos[i * 3] - p[0], pos[i * 3 + 1] - p[1], pos[i * 3 + 2] - p[2]) > 0.02) continue;
      for (let k = 0; k < 3; k++) n[k] += nrm[i * 3 + k];
    }
    const len = Math.hypot(...n) || 1;
    return { side, point: p, normal: n.map(v => v / len) };
  });
}

// とくべつな子の素材。texture: 体の模様の画像 / colors: 頂点ごとの色 / decor: 体の上に重ねる部品(体はふつうの子と同じ)
//   ギンガ・ハナビ(ファンタジー版)は模様の画像、ホシゾラ・ボタン(宇宙版)は頂点の色、
//   ホウキボシ・リュウセイは彗星の部品(頭・尾・光の粒)
export function specialAssets(coat, style) {
  if (coat === 'comet') return { decor: `assets/models/special-comet-${style}.glb` };
  return style === 'cosmic' ? { colors: `assets/models/special-${coat}-cosmic.bin` } : { texture: `assets/models/special-${coat}-fantasy.jpg` };
}

export const PART = Object.freeze({ body: 0, fin: 1, fluke: 2 });

const BINS = 100;
const binOf = u => Math.min(BINS, Math.max(0, Math.round(u * BINS)));

// pos・nrm: 頂点の位置と法線(x, y, z のならび)
export function modelLayout(pos, nrm) {
  const n = pos.length / 3;
  const part = new Uint8Array(n), top = new Uint8Array(n), under = new Uint8Array(n);
  const u = new Float32Array(n), theta = new Float32Array(n), s = new Float32Array(n), c = new Float32Array(n);
  // 体の太さ: u ごとに、上半分(胸びれのない側)のいちばん外側。体のまん中の高さ: 背骨のあたりの上下のまん中
  const halfWidth = new Float32Array(BINS + 1);
  const yMin = new Float32Array(BINS + 1).fill(Infinity), yMax = new Float32Array(BINS + 1).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], b = binOf(pos[i * 3 + 2] + 0.5);
    if (Math.abs(x) < 0.03) { yMin[b] = Math.min(yMin[b], y); yMax[b] = Math.max(yMax[b], y); }
  }
  const center = new Float32Array(BINS + 1);
  for (let b = 0; b <= BINS; b++) center[b] = Number.isFinite(yMin[b]) ? (yMin[b] + yMax[b]) / 2 : NaN;
  fillGaps(center);
  for (let i = 0; i < n; i++) {
    const b = binOf(pos[i * 3 + 2] + 0.5);
    if (pos[i * 3 + 1] >= center[b]) halfWidth[b] = Math.max(halfWidth[b], Math.abs(pos[i * 3]));
  }
  // となりの区切りとならして、でこぼこを減らす
  const hw = halfWidth.map((v, b) => Math.max(v, halfWidth[b - 1] ?? 0, halfWidth[b + 1] ?? 0));

  let finReach = 0, flukeReach = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], uu = pos[i * 3 + 2] + 0.5, b = binOf(uu);
    u[i] = uu;
    if (uu > MODEL.flukeRoot) {
      part[i] = PART.fluke;
      flukeReach = Math.max(flukeReach, Math.abs(x));
    } else if (uu > MODEL.finRange[0] && uu < MODEL.finRange[1] && y < center[b] && Math.abs(x) > hw[b] * 1.05 + 0.004) {
      part[i] = PART.fin;
      finReach = Math.max(finReach, Math.abs(x));
    }
    theta[i] = (Math.atan2(x, y - center[b]) + Math.PI * 2) % (Math.PI * 2);
  }
  // 尾びれの前と後ろのふち(左右の場所ごと)
  const S = 40, zLead = new Float32Array(S + 1).fill(Infinity), zTrail = new Float32Array(S + 1).fill(-Infinity);
  const sBin = x => Math.round(((x / (flukeReach || 1)) + 1) / 2 * S);
  for (let i = 0; i < n; i++) {
    if (part[i] !== PART.fluke) continue;
    const k = sBin(pos[i * 3]), z = pos[i * 3 + 2];
    zLead[k] = Math.min(zLead[k], z); zTrail[k] = Math.max(zTrail[k], z);
  }
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2], ny = nrm[i * 3 + 1];
    if (part[i] === PART.fin) {
      const base = hw[binOf(u[i])];
      s[i] = Math.min(1, Math.max(0, (Math.abs(x) - base) / Math.max(1e-6, finReach - base)));
      top[i] = ny > 0 ? 1 : 0;
    } else if (part[i] === PART.fluke) {
      s[i] = Math.max(-1, Math.min(1, x / (flukeReach || 1)));
      const k = sBin(x), span = zTrail[k] - zLead[k];
      c[i] = span > 1e-6 ? Math.min(1, Math.max(0, (z - zLead[k]) / span)) : 0;
      under[i] = ny < 0 ? 1 : 0;
    }
  }
  return { part, u, theta, s, c, top, under };
}

// 値のない区切りを、となりの値でうめる
function fillGaps(a) {
  let last = NaN;
  for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) a[i] = last; else last = a[i];
  last = NaN;
  for (let i = a.length - 1; i >= 0; i--) if (Number.isNaN(a[i])) a[i] = last; else last = a[i];
  for (let i = 0; i < a.length; i++) if (Number.isNaN(a[i])) a[i] = 0;
}

// ---- その子の色をモデルにのせる ----
// モデルのテクスチャは、しわ・傷・まだら模様まで描いてある。その子の色がふつうの子と同じところはテクスチャのまま使い、
// ちがうところ(真っ白な子、胸びれの表が黒い子、おなかの白が広い子、尾びれの裏の模様など)だけ、
// テクスチャの明るさのむら(しわや陰)を残したまま、その子の色に塗りかえる。
//   color: その子の色(計算用の色)/ base: ふつうの子の色の明るさ(テクスチャの明るさを、この明るさでわって、むらだけを取り出す)
//   mix: 0 はテクスチャのまま、1 はその子の色
const HB_WHITE = [0xe6 / 255, 0xe8 / 255, 0xea / 255], HB_BACK = [0x16 / 255, 0x18 / 255, 0x1b / 255];
const ALBINO = [0.93, 0.92, 0.9];
const FIN_TOP = [0.75, 0.77, 0.78];
const FLUKE_UNDER = [0.42, 0.44, 0.46];   // テクスチャの尾びれの裏の、だいたいの色
export const toLinear = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function individualColors(ind, L) {
  const n = L.part.length;
  const color = new Float32Array(n * 3), mix = new Float32Array(n), base = new Float32Array(n);
  const t = ind?.traits ?? {};
  const plain = { ...ind, traits: { ...t, coat: 'normal', pec: 'normal', scars: 'normal', barnacles: 'normal' } };
  const white = t.coat === 'white';
  for (let i = 0; i < n; i++) {
    let c, d, all = white;
    if (L.part[i] === PART.fluke) {
      if (L.under[i]) {
        const w = flukeWhiteness(ind, L.s[i], L.c[i]);
        c = HB_BACK.map((v, k) => v + (HB_WHITE[k] - v) * w);
        d = FLUKE_UNDER;
        all = true;
      } else { c = white ? ALBINO : HB_BACK; d = HB_BACK; }
    } else if (L.part[i] === PART.fin) {
      d = L.top[i] ? FIN_TOP : HB_WHITE;
      c = traitFinColor(ind, L.s[i], !!L.top[i], d);
      d = traitFinColor(plain, L.s[i], !!L.top[i], d);
    } else {
      const u = Math.min(1, Math.max(0, L.u[i]));
      d = skinColor('humpback', u, L.theta[i]);
      c = traitBodyColor(ind, u, L.theta[i], d);
      d = traitBodyColor(plain, u, L.theta[i], d);
    }
    const cl = c.map(toLinear), dl = d.map(toLinear);
    color.set(cl, i * 3);
    base[i] = Math.max(0.004, luminance(dl));
    if (all) mix[i] = 1;
    else {
      // 色のちがいの大きさ(明るさの感じ方に近づけるため、平方根でくらべる)
      let diff = 0;
      for (let k = 0; k < 3; k++) diff = Math.max(diff, Math.abs(Math.sqrt(cl[k]) - Math.sqrt(dl[k])));
      mix[i] = Math.min(1, diff * 6);
    }
  }
  return { color, mix, base };
}

// 口の動き(あご・のど)の重み。計算で作ったクジラと同じ決め方を、モデルの頂点の場所(u, θ)で使う。
// [下あご, 上あご, のどのふくらみ, 口の線より下か] のならび(シェーダーの aJaw)
export function modelJaw(L) {
  const n = L.part.length, out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    if (L.part[i] !== PART.body || L.u[i] > 0.6) continue;
    out.set(jawWeights('humpback', Math.max(0, L.u[i]), L.theta[i]), i * 4);
  }
  return out;
}

// ---- 形の個性(背びれのこぶ・かぎ形・欠け、尾びれのうしろのふちの欠け) ----
// 背びれ: 背中の線(背びれの前と後ろの背中の高さを結んだ線)より上に出ている、まん中の頂点。
// その高さ h を変えて形を作る。形を変えない子は null
export const DORSAL = Object.freeze({ from: 0.58, to: 0.735, halfWidth: 0.02 });
export function shapeForIndividual(pos, L, ind) {
  const t = ind?.traits ?? {};
  const dorsal = t.dorsal && t.dorsal !== 'normal' ? t.dorsal : null;
  const bite = t.fluke === 'bite';
  if (!dorsal && !bite) return null;
  const out = Float32Array.from(pos);
  const n = pos.length / 3;
  if (dorsal) {
    // 背びれのない前と後ろの背中の高さから、背びれの下の背中の線を2次式でなめらかにつなぐ
    const pts = [];
    for (const u0 of [0.48, 0.51, 0.54, 0.57, 0.745, 0.765, 0.785, 0.805]) {
      let y = -Infinity;
      for (let i = 0; i < n; i++) if (Math.abs(pos[i * 3]) < 0.01 && Math.abs(pos[i * 3 + 2] + 0.5 - u0) < 0.006) y = Math.max(y, pos[i * 3 + 1]);
      if (Number.isFinite(y)) pts.push([u0, y]);
    }
    const [a, b, c] = fitQuadratic(pts);
    const base = u => a * u * u + b * u + c;
    let hMax = 0;
    const fin = [];
    for (let i = 0; i < n; i++) {
      const u = pos[i * 3 + 2] + 0.5;
      if (u <= DORSAL.from || u >= DORSAL.to || Math.abs(pos[i * 3]) > DORSAL.halfWidth || pos[i * 3 + 1] < 0) continue;
      const h = pos[i * 3 + 1] - base(u);
      if (h <= 0.002) continue;
      fin.push([i, h]); hMax = Math.max(hMax, h);
    }
    for (const [i, h] of fin) {
      const k = h / (hMax || 1);   // 0 が背中、1 が背びれの先
      if (dorsal === 'knob') out[i * 3 + 1] -= h * 0.65;                         // 小さなこぶ
      else if (dorsal === 'hook') { out[i * 3 + 2] += hMax * 0.9 * k * k; out[i * 3 + 1] += hMax * 0.15 * k; }   // 先がうしろへ曲がる
      else if (dorsal === 'nick') {
        // 上が平らに切れ、まん中にV字の切れこみ
        const cut = hMax * 0.45;
        if (h > cut) out[i * 3 + 1] -= h - cut;
        const u = pos[i * 3 + 2] + 0.5, mid = (DORSAL.from + DORSAL.to) / 2 + 0.02;
        if (h > cut * 0.6) out[i * 3 + 1] -= hMax * 0.22 * Math.max(0, 1 - Math.abs(u - mid) / 0.015);
      }
    }
  }
  if (bite) {
    for (let i = 0; i < n; i++) {
      if (L.part[i] !== PART.fluke) continue;
      const d = flukeBite(ind, L.s[i]);
      if (d <= 0.0005) continue;
      // うしろのふちに近いほど、前へ引く(前のふちはそのまま)
      out[i * 3 + 2] -= d * L.c[i] * L.c[i];
    }
  }
  return out;
}

// 最小二乗で y = a u² + b u + c
function fitQuadratic(pts) {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
  for (const [u, y] of pts) { const u2 = u * u; s0++; s1 += u; s2 += u2; s3 += u2 * u; s4 += u2 * u2; t0 += y; t1 += u * y; t2 += u2 * y; }
  // [s4 s3 s2; s3 s2 s1; s2 s1 s0] [a b c] = [t2 t1 t0]
  const M = [[s4, s3, s2, t2], [s3, s2, s1, t1], [s2, s1, s0, t0]];
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = M[r][i] / M[i][i];
      for (let k = i; k < 4; k++) M[r][k] -= f * M[i][k];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}
