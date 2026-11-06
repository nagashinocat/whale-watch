// 色ではなく、形として体に付くもの(フジツボ、盛り上がった傷あと)。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・ザトウクジラに付くフジツボ(オニフジツボのなかま)は、大きいもので高さ5cm・直径6cm。
//     6枚の板が王冠のように囲み、上に六角形の口がある。頭・尾びれ・胸びれ・のどの畝のみぞなどに付く
//   ・船のスクリューの傷は、背中の峰を横切る平行な切り傷が治ったあと。白っぽく残る
//   ・尾びれには、シャチの歯のあとの平行な線や、長い傷が残る
//
// 体と同じ「体長を1とした大きさ」で作り、体と同じ描き方(泳ぐしなり・あごの動き)で動かす。

import { BODY_GRID, ringU, aroundTheta, bodyPoint, jawWeights, headKnobs, flukeOutline, eyeHole, WHALE_SPECS } from './whaleShape.js';
import { flukeBite, propellerLines } from './traits.js';
import { flukeWhiteness } from './flukeId.js';

const REF = WHALE_SPECS.humpback.lengthMeters;
const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => scale(a, 1 / (Math.hypot(...a) || 1));

export const BARNACLE = Object.freeze({
  diameter: [0.03, 0.06],   // 直径(m)
  heightRatio: 0.8,         // 高さは直径の0.8倍(大きいもので5cm)
  height: [0.024, 0.048],
  color: [0.84, 0.81, 0.73],
  mouth: [0.16, 0.14, 0.13],
});

// 決まった種から、いつも同じ乱数の並び
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

// フジツボ1つの形(直径2・高さ約0.85の大きさ)。下のふち → 板の上のふち(王冠のように少しぎざぎざ) → 口のふち → 口の奥
export function barnacleShape() {
  const sides = 6;
  const positions = [], colors = [], indices = [];
  const ring = (r, y, jag, col) => {
    const first = positions.length / 3;
    for (let k = 0; k < sides; k++) {
      const a = (TAU * k) / sides;
      positions.push(Math.cos(a) * r, y + (k % 2 ? -jag : jag), Math.sin(a) * r);
      colors.push(...col);
    }
    return first;
  };
  const r0 = ring(1, 0, 0, BARNACLE.color);
  const r1 = ring(0.66, 0.85, 0.07, BARNACLE.color);
  const r2 = ring(0.42, 0.8, 0, BARNACLE.color.map(v => v * 0.8));
  const center = positions.length / 3;
  positions.push(0, 0.35, 0);
  colors.push(...BARNACLE.mouth);
  const band = (a, b) => {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      indices.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
    }
  };
  band(r0, r1);
  band(r1, r2);
  for (let k = 0; k < sides; k++) indices.push(r2 + k, center, r2 + ((k + 1) % sides));
  return { positions, colors, indices, center, sides };
}

// 体の頂点 k の外向き(となりの頂点から求める)
function bodyNormal(g, k) {
  const A = BODY_GRID.around, R = BODY_GRID.rings;
  const i = Math.floor(k / A), j = k % A;
  const P = (ii, jj) => { const q = Math.min(R - 1, Math.max(0, ii)) * A + ((jj % A) + A) % A; return [g.positions[q * 3], g.positions[q * 3 + 1], g.positions[q * 3 + 2]]; };
  let n = norm(cross(sub(P(i + 1, j), P(i - 1, j)), sub(P(i, j + 1), P(i, j - 1))));
  const p = P(i, j);
  if (dot(n, [p[0], p[1], 0]) < 0) n = scale(n, -1);
  return n;
}

// ひれ(胸びれ・尾びれ)の頂点の外向き。rows×around のならびで、輪のまん中から外へ
function finNormal(g, start, around, k, rows) {
  const i = Math.floor(k / around), j = k % around;
  const P = (ii, jj) => { const q = start + Math.max(0, Math.min(rows - 1, ii)) * around + ((jj % around) + around) % around; return [g.positions[q * 3], g.positions[q * 3 + 1], g.positions[q * 3 + 2]]; };
  const here = P(i, j);
  let c = [0, 0, 0];
  for (let jj = 0; jj < around; jj++) c = add(c, P(i, jj));
  c = scale(c, 1 / around);
  const prev = P(i - 1, j), next = P(i + 1, j);
  let n = norm(cross(sub(next, prev), sub(P(i, j + 1), P(i, j - 1))));
  if (dot(n, sub(here, c)) < 0) n = scale(n, -1);
  return n;
}

// フジツボを付けられる場所(頂点の番号と外向き)
function candidates(g, ind) {
  const A = BODY_GRID.around;
  const out = { chin: [], knob: [], fin: [], fluke: [] };
  const knobs = headKnobs('humpback');
  for (let k = 0; k < g.bodyCount; k++) {
    const u = ringU(Math.floor(k / A)), theta = aroundTheta(k % A);
    if (u > 0.2 || eyeHole('humpback', u, theta)) continue;
    const down = -Math.cos(theta);
    const side = Math.abs(((theta + Math.PI) % TAU) - Math.PI);
    if (u > 0.004 && u < 0.07 && down > 0.25) out.chin.push({ k, u, theta });
    for (const kn of knobs) {
      if (Math.abs(u - kn.u) < 0.008 && Math.abs(side - Math.abs(((kn.theta + Math.PI) % TAU) - Math.PI)) < 0.07) { out.knob.push({ k, u, theta }); break; }
    }
  }
  for (const f of g.fins) {
    for (let k = 0; k < f.s.length; k++) {
      const j = k % 14;
      // 胸びれの先の、前のふちのこぶのあたり
      if (f.s[k] > 0.78 && (j <= 1 || j >= 13)) out.fin.push({ k: f.start + k, start: f.start, around: 14, local: k, rows: f.s.length / 14 });
    }
  }
  const fl = g.fluke;
  for (let k = 0; k < fl.s.length; k++) {
    if (Math.abs(fl.s[k]) > 0.86 && Math.abs(fl.s[k]) < 0.98) out.fluke.push({ k: fl.start + k, start: fl.start, around: 24, local: k, rows: fl.s.length / 24 });
  }
  return out;
}

// フジツボを、ごつごつしたかたまりで付ける(本物も、あちこちにかたまって付く)
function placeBarnacles(g, ind, rng) {
  const many = ind.traits?.barnacles === 'many';
  // [かたまりの数, フジツボの数]
  const plan = many
    ? { chin: [6, 80], knob: [6, 30], fin: [4, 60], fluke: [4, 40] }
    : { chin: [3, 24], knob: [2, 8], fin: [0, 0], fluke: [0, 0] };
  const R = 0.22 / REF;   // かたまりの広さ(半径22cm)
  const cand = candidates(g, ind);
  const at = c => [g.positions[c.k * 3], g.positions[c.k * 3 + 1], g.positions[c.k * 3 + 2]];
  const placed = [];
  for (const [region, [clusters, count]] of Object.entries(plan)) {
    const list = cand[region];
    if (!list.length || !clusters) continue;
    const groups = [];
    for (let k = 0; k < clusters; k++) {
      const center = at(list[Math.floor(rng() * list.length)]);
      const near = list.filter(c => Math.hypot(...sub(at(c), center)) < R);
      if (near.length) groups.push(near);
    }
    let tries = 0, made = 0;
    while (groups.length && made < count && tries < count * 40) {
      tries++;
      const group = groups[Math.floor(rng() * groups.length)];
      const c = group[Math.floor(rng() * group.length)];
      const d = (BARNACLE.diameter[0] + rng() * (BARNACLE.diameter[1] - BARNACLE.diameter[0])) / REF;
      const pos = at(c);
      // となりのフジツボと重なりすぎない(少しは重なって、ぎっしり付く)
      if (placed.some(p => Math.hypot(...sub(p.pos, pos)) < (p.size + d) * 0.35)) continue;
      const normal = region === 'chin' || region === 'knob' ? bodyNormal(g, c.k) : finNormal(g, c.start, c.around, c.local, c.rows);
      const jaw = [g.jaw[c.k * 4], g.jaw[c.k * 4 + 1], g.jaw[c.k * 4 + 2], g.jaw[c.k * 4 + 3]];
      placed.push({ region, host: c.k, pos, normal, size: d, jaw, spin: rng() * TAU, uv: c.u !== undefined ? [c.u, c.theta] : null });
      made++;
    }
  }
  return placed;
}

// 体の (u, θ) の点と外向き
function bodyFrame(u, theta) {
  const p = bodyPoint('humpback', u, theta);
  const du = 0.002, dt = 0.01;
  let n = norm(cross(sub(bodyPoint('humpback', u + du, theta), bodyPoint('humpback', u - du, theta)),
    sub(bodyPoint('humpback', u, theta + dt), bodyPoint('humpback', u, theta - dt))));
  if (dot(n, [p[0], p[1], 0]) < 0) n = scale(n, -1);
  return { p, n };
}

// 尾びれの裏の (s, c) の点と外向き(尾びれの形の式と同じ)
function flukeUnder(ind, s, c) {
  const f = WHALE_SPECS.humpback.fluke;
  const P = (ss, cc) => {
    const a = Math.min(1, Math.abs(ss));
    const o = flukeOutline('humpback', a);
    const zl = o.leading, zt = Math.max(zl + 0.003, Math.max(zl, o.trailing) - flukeBite(ind, ss));
    const thick = 0.012 * (1 - a) ** 0.8 + 0.0005;
    const sinPhi = -Math.sqrt(Math.max(0, 1 - (1 - 2 * cc) ** 2));
    return [(ss * f.span) / 2, thick * sinPhi * (1 - 0.6 * cc), zl + cc * (zt - zl)];
  };
  const p = P(s, c);
  let n = norm(cross(sub(P(s + 0.01, c), P(s - 0.01, c)), sub(P(s, c + 0.01), P(s, c - 0.01))));
  if (n[1] > 0) n = scale(n, -1);
  return { p, n };
}

// 線にそって、盛り上がった傷あと(帯)を作る。frames は {p, n} の列、width と raise はメートル
// color は色、または i 番目の点の色を返す関数
function ribbon(out, frames, width, raise, color, jaw) {
  const prof = [[-0.5, 0.15], [-0.25, 1], [0, 0.45], [0.25, 1], [0.5, 0.15]];   // まん中に細いみぞ
  const first = out.positions.length / 3;
  frames.forEach((f, i) => {
    const a = frames[Math.max(0, i - 1)].p, b = frames[Math.min(frames.length - 1, i + 1)].p;
    const tangent = norm(sub(b, a));
    const side = norm(cross(f.n, tangent));
    // 端の点は、細くしぼって傷の先をまるくする
    const taper = Math.min(1, i / 2, (frames.length - 1 - i) / 2) * 0.7 + 0.3;
    for (const [x, h] of prof) {
      const q = add(add(f.p, scale(side, (x * width * taper) / REF)), scale(f.n, (h * raise * taper + 0.002) / REF));
      out.positions.push(...q);
      out.colors.push(...(typeof color === 'function' ? color(i) : color));
      out.jaw.push(...jaw);
    }
  });
  const n = prof.length;
  for (let i = 0; i < frames.length - 1; i++) {
    for (let k = 0; k < n - 1; k++) {
      const a = first + i * n + k, b = a + 1, c = a + n, d = c + 1;
      out.indices.push(a, c, b, b, c, d);
    }
  }
}

const SCAR = [0.82, 0.8, 0.77];

// 1頭ぶんの、形のある特徴をまとめた網目。g は buildWhaleGeometry('humpback') の結果
export function buildFeatures(g, ind) {
  const out = { positions: [], colors: [], jaw: [], indices: [], barnacles: 0, regions: { chin: 0, knob: 0, fin: 0, fluke: 0 },
    ribbons: { propeller: 0, fluke: 0 }, raise: { propeller: 0.016, fluke: 0.007 }, placed: [], flukeSideOk: true };
  if (!ind) return finish(out);
  const rng = seeded(ind.id * 7331 + 11);
  // フジツボ
  const shape = barnacleShape();
  for (const b of placeBarnacles(g, ind, rng)) {
    const up = b.normal;
    const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ax = norm(cross(ref, up));
    let az = cross(up, ax);
    const c = Math.cos(b.spin), s = Math.sin(b.spin);
    [ax, az] = [add(scale(ax, c), scale(az, s)), add(scale(az, c), scale(ax, -s))];
    const r = b.size / 2, h = b.size * BARNACLE.heightRatio / 0.85;
    const first = out.positions.length / 3;
    for (let k = 0; k < shape.positions.length / 3; k++) {
      const [x, y, z] = shape.positions.slice(k * 3, k * 3 + 3);
      // 少しだけ体にうめて、すきまができないようにする
      const q = add(add(add(b.pos, scale(ax, x * r)), scale(az, z * r)), scale(up, y * h - 0.004 / REF));
      out.positions.push(...q);
      out.colors.push(...shape.colors.slice(k * 3, k * 3 + 3));
      out.jaw.push(...b.jaw);
    }
    for (const i of shape.indices) out.indices.push(first + i);
    out.barnacles++;
    out.regions[b.region]++;
    out.placed.push(b);
  }
  // スクリューの傷(背中を横切る、盛り上がった平行な線)
  if (ind.traits?.scars === 'propeller') {
    for (const line of propellerLines(ind)) {
      const frames = line.map(([u, theta]) => bodyFrame(u, theta));
      if (frames.length < 3) continue;
      ribbon(out, frames, 0.12, out.raise.propeller, SCAR, [0, 0, 0, 0]);
      out.ribbons.propeller++;
    }
  }
  // 尾びれの裏の傷(シャチの歯のあと・長い傷)
  if (ind.traits?.coat !== 'white') {
    for (const sc of ind.scars ?? []) {
      const frames = [];
      for (let t = 0; t <= 1.0001; t += 1 / 14) {
        const s = sc.from[0] + (sc.to[0] - sc.from[0]) * t, c = sc.from[1] + (sc.to[1] - sc.from[1]) * t;
        if (Math.abs(s) > 0.97 || c < 0.03 || c > 0.97) continue;
        frames.push({ ...flukeUnder(ind, s, c), sc: [s, c] });
      }
      if (frames.length < 3) continue;
      if (frames.some(f => f.p[1] > 0)) out.flukeSideOk = false;
      // 尾びれの模様の色の反対の色(黒いところでは白く、白いところでは黒っぽく)になるのは、色の模様にまかせる。形は少し盛り上がるだけ
      // 黒いところでは白く、白いところでは黒っぽく残る(尾びれの模様の色の反対)
      const plain = { ...ind, scars: [] };
      const points = frames.map(f => f.sc);
      const col = i => (flukeWhiteness(plain, points[i][0], points[i][1]) > 0.5 ? [0.2, 0.21, 0.22] : SCAR);
      ribbon(out, frames, 0.035, out.raise.fluke, col, [0, 0, 0, 0]);
      out.ribbons.fluke++;
    }
  }
  return finish(out);
}

function finish(out) {
  out.positions = Float32Array.from(out.positions);
  out.colors = Float32Array.from(out.colors);
  out.jaw = Float32Array.from(out.jaw);
  out.indices = Uint32Array.from(out.indices);
  return out;
}
