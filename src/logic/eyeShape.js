// ザトウクジラの目。間近で見ても本物らしく見えるように、目のまわりの肌(まぶた・しわ)を細かい網目で作る。
// three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・目の玉は直径約13cm(ナガスクジラを測った値。ザトウクジラもほぼ同じ大きさ)。体にくらべると小さい
//   ・まつげのない、厚いまぶた。落ち着いているときは、まぶたが目の多くをおおう
//   ・ひとみは明るいところでは馬のひづめ(U字)の形に細くなる。暗いと横長の楕円
//   ・まわりの色(虹彩)は茶色。そのまわりに白っぽい輪がのぞく
//   ・人に近づくクジラは、船のすぐ横で頭を出し(スパイホップ)、片目で人をじっと見る
//
// 長さの単位: EYE はメートル。網目は体長を1とした大きさ(体長14mのおとなのザトウクジラ基準)

import { bodyPoint, skinColor, faceFeatures, WHALE_SPECS, ringU, aroundTheta, eyeCells, bodySection, BODY_GRID, jawWeights } from './whaleShape.js';

const REF = WHALE_SPECS.humpback.lengthMeters;
const TAU = Math.PI * 2;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map(v => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => scale(a, 1 / Math.hypot(...a));

export const EYE = Object.freeze({
  eyeball: 0.065,       // 目の玉の半径
  width: 0.095,         // 目の開きの横の長さ(体の前後の向き)
  height: 0.05,         // 目の開きの縦の高さ(いっぱいに開いたとき)
  protrude: 0.012,      // 目の玉が、まわりの肌から出る高さ
  lidRise: 0.016,       // まぶたのふちの盛り上がり
  rimOut: 0.01,         // まぶたのいちばん高いところの、目の開きからの距離
  rimWidth: 0.014,      // まぶたの盛り上がりの幅
  depth: 0.08,          // 目の開きの内側で、肌を奥へ引っこめる深さ(目の玉が見えるように)
  wrinkle: 0.0022,      // 目のまわりのしわの深さ
  relaxedOpen: 0.75,    // ふだんの開き(落ち着いているときは少し閉じぎみ)
  contactDistance: 0.17, // 目が合うときの、カメラから目までの距離(目が画面の半分以上になる)
});

// 目の開きの、横の位置 x での半分の高さ。アーモンド形で、目じりに向かって細くなる
function halfOpening(x, open) {
  const k = 1 - (2 * x / EYE.width) ** 2;
  if (k <= 0) return 0;
  return (EYE.height / 2 * open + 0.0004) * k ** 0.6;
}

// 目の開きのふちからの距離(m)。内側はマイナス
function edgeDistance(x, y, open) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax >= EYE.width / 2) return Math.hypot(ax - EYE.width / 2, ay);
  return ay - halfOpening(x, open);
}

// 目の中心から x(体の前後)・y(上下) の場所の肌が、体の表面から外へ出る量(m)。open は 0(閉じる)〜1(開く)
export function lidOffset(x, y, open) {
  const q = edgeDistance(x, y, open);
  const r = Math.hypot(x / (EYE.width / 2), y / (EYE.height / 2));   // 目からの離れぐあい(楕円)
  const fade = 1 - smoothstep(2.5, 5.5, r);
  // まぶたのふちの、まるい盛り上がり
  let d = EYE.lidRise * Math.exp(-(((q - EYE.rimOut) / EYE.rimWidth) ** 2));
  // 目のまわりの、ふっくらしたふくらみ
  d += 0.006 * Math.exp(-(((r - 1.6) / 1.0) ** 2)) * fade;
  // 目をかこむように重なるしわと、目じりから広がるしわ
  const around = Math.sin((q * TAU) / 0.018) * smoothstep(0.012, 0.03, q);
  const rays = Math.sin(Math.atan2(y * 2, x) * 14 + r * 1.3) * smoothstep(1.4, 2.2, r);
  d += (EYE.wrinkle * around + 0.0012 * rays) * fade;
  // 目の開きの内側は奥へ引っこめる(そこに目の玉がのぞく)
  if (q < 0) d -= EYE.depth * smoothstep(0, 0.008, -q);
  return d;
}

// 右目(side = 1)・左目(-1)の場所と向き(体長1の大きさ)。
// normal は外向き、along は体の前後(尾の向き)、up は背中の向き
export function eyeFrame(side) {
  const e = faceFeatures('humpback').eye;
  const theta = side > 0 ? e.theta : TAU - e.theta;
  const P = (u, t) => bodyPoint('humpback', u, t);
  const center = P(e.u, theta);
  const du = 0.002, dt = 0.01;
  const tu = sub(P(e.u + du, theta), P(e.u - du, theta));
  const tt = sub(P(e.u, theta + dt), P(e.u, theta - dt));
  let normal = norm(cross(tu, tt));
  const axis = [0, bodySection('humpback', e.u).centerY, center[2]];
  if (dot(normal, sub(center, axis)) < 0) normal = scale(normal, -1);
  // 背中の向き: 右目は θ を小さく、左目は大きくすると上へ行く
  let up = side > 0 ? scale(tt, -1) : tt;
  up = norm(sub(up, scale(normal, dot(up, normal))));
  const along = norm(cross(up, normal));
  return { center, normal, up, along: along[2] < 0 ? scale(along, -1) : along, theta };
}

// 目の玉の中心と半径(体長1の大きさ)。basis は目の玉の向き [x, y, z]。
// 鏡に映した向きにならないよう、x は y と z から作る(z が外向き、y が背中の向き)
export function eyeballPlacement(side) {
  const f = eyeFrame(side);
  const basis = [cross(f.up, f.normal), f.up, f.normal];
  return { ...f, basis, eyeCenter: add(f.center, scale(f.normal, (EYE.protrude - EYE.eyeball) / REF)), radius: EYE.eyeball / REF };
}

// 目のまわりの肌の網目(パッチ)。体から抜いたマス目(eyeCells)とぴったり同じ広さで、
// ふちは体の網目の線そのものの上にあるので、すきまも重なりもない。
// 目に近いほど網目を細かくする(目の近くで約2mm)。
export function eyePatch(side, nu = 150, nt = 130) {
  const cells = eyeCells('humpback');
  const [j0, j1] = side > 0 ? cells.right : cells.left;
  const f = eyeFrame(side);
  const dense = s => s * (0.35 + 0.65 * s * s);   // -1〜1 を、まん中ほど細かく
  const P = (u, t) => bodyPoint('humpback', u, t);
  // 体の網目どおりの(折れ線の)面。ふちでは体とぴったり重なる
  const grid = new Map();
  const G = (i, j) => { const key = i * 1000 + j; if (!grid.has(key)) grid.set(key, P(ringU(i), aroundTheta(j))); return grid.get(key); };
  const coarse = (fi, fj) => {
    const i = Math.min(Math.floor(fi), cells.i1 - 1), j = Math.min(Math.floor(fj), j1 - 1);
    const a = fi - i, b = fj - j;
    const p00 = G(i, j), p01 = G(i, j + 1), p10 = G(i + 1, j), p11 = G(i + 1, j + 1);
    return p00.map((_, k) => (1 - a) * (1 - b) * p00[k] + (1 - a) * b * p01[k] + a * (1 - b) * p10[k] + a * b * p11[k]);
  };
  const count = nu * nt;
  const base = new Float32Array(count * 3);
  const lid = new Float32Array(count * 2);     // 目の中心からの x, y(m)
  const weight = new Float32Array(count);      // ふちで 0、内側で 1
  const colors = new Float32Array(count * 3);
  const jaw = new Float32Array(count * 4);     // あごの重み(体と同じ式。口を開けてもつなぎ目がずれない)
  for (let i = 0; i < nu; i++) {
    const a = 0.5 + 0.5 * dense((2 * i) / (nu - 1) - 1);
    const fi = cells.i0 + a * (cells.i1 - cells.i0);
    // 網目の間の u は、網目の番号から連続に決める(体の網目と同じ並び方)
    const u = 0.5 - 0.5 * Math.cos((Math.PI * fi) / (BODY_GRID.rings - 1));
    for (let j = 0; j < nt; j++) {
      const b = 0.5 + 0.5 * dense((2 * j) / (nt - 1) - 1);
      const fj = j0 + b * (j1 - j0);
      const theta = aroundTheta(fj);
      const k = i * nt + j;
      const w = smoothstep(0, 0.22, Math.min(a, 1 - a, b, 1 - b));
      const exact = P(u, theta), flat = coarse(fi, fj);
      const p = flat.map((v, m) => v + (exact[m] - v) * w);
      base.set(p, k * 3);
      const rel = sub(p, f.center);
      lid[k * 2] = dot(rel, f.along) * REF;
      lid[k * 2 + 1] = dot(rel, f.up) * REF;
      weight[k] = w;
      jaw.set(jawWeights('humpback', u, theta), k * 4);
      // 肌の色。目の開きの奥(まぶたの裏側)は暗い影
      let c = skinColor('humpback', u, theta);
      const q = edgeDistance(lid[k * 2], lid[k * 2 + 1], EYE.relaxedOpen);
      c = c.map((v, m) => v + ([0.025, 0.024, 0.028][m] - v) * smoothstep(0.004, -0.002, q));
      colors.set(c, k * 3);
    }
  }
  const indices = [];
  for (let i = 0; i < nu - 1; i++) {
    for (let j = 0; j < nt - 1; j++) {
      const a = i * nt + j, b = a + 1, c = a + nt, d = c + 1;
      indices.push(a, c, b, b, c, d);   // 体の網目と同じ巻き方
    }
  }
  const size = [
    Math.hypot(...sub(P(ringU(cells.i1), f.theta), P(ringU(cells.i0), f.theta))) * REF,
    (aroundTheta(j1) - aroundTheta(j0)) * 1.8,
  ];
  return { base, lid, weight, colors, jaw, indices: Uint32Array.from(indices), normal: f.normal, nu, nt, sizeMeters: size };
}

// まぶたの開きに合わせて、網目の頂点の位置を out に書く
export function applyLid(out, patch, open) {
  const { base, lid, weight, normal } = patch;
  for (let k = 0; k < weight.length; k++) {
    const d = (lidOffset(lid[k * 2], lid[k * 2 + 1], open) * weight[k]) / REF;
    out[k * 3] = base[k * 3] + normal[0] * d;
    out[k * 3 + 1] = base[k * 3 + 1] + normal[1] * d;
    out[k * 3 + 2] = base[k * 3 + 2] + normal[2] * d;
  }
  return out;
}

// カメラから distance m の目が、まぶたまで入れて画面の高さのどれだけをしめるか(fov は縦の視野角)
export function eyeScreenFraction(distance, fov) {
  const visible = 2 * distance * Math.tan((fov * Math.PI) / 360);
  return (EYE.height + 2 * (EYE.rimOut + EYE.rimWidth)) / visible;
}

// まばたき: t 秒目の開き。閉じるのはやや速く、開くのはゆっくり(全部で約1.2秒)
export function blinkOpen(t, base = EYE.relaxedOpen) {
  if (t < 0 || t > 1.2) return base;
  if (t < 0.4) return base * (1 - smoothstep(0, 0.4, t));
  if (t < 0.55) return 0;
  return base * smoothstep(0.55, 1.2, t);
}
