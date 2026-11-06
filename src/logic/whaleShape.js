// クジラの形を計算で作る。three.js は使わない(テストからも使う)。
//
// 体長を 1 とした比率で作る(頭の先が z = -0.5、尾びれの先が z = +0.5、上が +y、右が +x)。
// 体は、頭(u = 0)から尾(u = 1)まで、輪切りの形を少しずつ変えながらつないで作る。
// 輪切りのまわりの角度 θ は、0 が背中のまん中、π/2 が右わき、π がおなかのまん中。
//
// 調べてわかった体の特徴(数値はこのファイルの中にまとめてある)
//   ザトウクジラ: 体長14〜15m。胸びれは体長の約3分の1。頭と胸びれの前のふちにこぶ(直径5〜10cm、高さ6.5cmまで)。
//                 あごの先からへそまで14〜35本の畝。背中は黒、おなか側は白黒まだら。胸びれは白いことが多い。
//                 尾びれのうしろのふちはギザギザ。背びれは小さく、体の3分の2あたり。
//   マッコウクジラ: 頭が体長の約3分の1で四角い。下あごは細く、頭の下に引っこむ。のどに2〜10本の短い溝。
//                 背びれはなく、体の3分の2あたりに低く丸いこぶ、そのうしろに小さなでこぼこが並ぶ。
//                 肌はしわしわ。濃い灰色か茶色がかった灰色で、口のまわりが白い。尾びれは三角形で切れこみが深く、うしろのふちはまっすぐ。

const TAU = Math.PI * 2;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const bump = (x, center, width) => Math.exp(-(((x - center) / width) ** 2));
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mixColor = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

// 体の z の範囲(尾びれは z = 0.42〜0.5 にあり、体の最後と重なる)
const BODY_START = -0.5;
const BODY_LENGTH = 0.94;
export const bodyZ = u => BODY_START + u * BODY_LENGTH;

export const WHALE_SPECS = Object.freeze({
  humpback: {
    lengthMeters: 14,
    // [u, 横の半分の幅, 縦の半分の高さ, 中心の高さ] — 体長に対する比率
    sections: [
      [0.0, 0.010, 0.006, -0.006],
      [0.03, 0.040, 0.026, -0.010],   // 口先は細く平たい
      [0.10, 0.068, 0.052, -0.018],
      [0.20, 0.098, 0.084, -0.026],   // ほお骨のあたりで横に広がり、のどがふくらむ
      [0.32, 0.116, 0.108, -0.016],   // いちばん太い(ほかのナガスクジラの仲間よりずっとがっしり)
      [0.42, 0.114, 0.112, -0.004],
      [0.55, 0.096, 0.100, 0.004],
      [0.68, 0.066, 0.076, 0.006],
      [0.80, 0.034, 0.052, 0.004],
      [0.90, 0.016, 0.036, 0.0],      // 尾の付け根は横からつぶれている
      [0.96, 0.011, 0.020, 0.0],
      [1.0, 0.004, 0.006, 0.0],
    ],
    headLength: 0.3,
    grooves: { count: 18, from: 0.02, to: 0.52, span: 0.38 },
    fin: { root: 0.3, theta: 1.95, length: 0.31, chord: 0.075, thickness: 0.014, knobs: 10,
           axis: [0.75, -0.45, 0.48], sweep: 0.04 },
    fluke: { span: 0.33, serration: 0.004, notchDepth: 0.03, notchWidth: 0.05 },
  },
  sperm: {
    lengthMeters: 15,
    sections: [
      [0.0, 0.012, 0.014, 0.0],
      [0.004, 0.050, 0.062, 0.0],
      [0.015, 0.072, 0.090, 0.0],     // 頭の前は切り立っている
      [0.06, 0.082, 0.102, 0.0],
      [0.18, 0.086, 0.108, -0.002],
      [0.30, 0.086, 0.106, -0.006],
      [0.36, 0.080, 0.097, -0.010],   // 頭と胴のさかい目が少しくびれる
      [0.48, 0.084, 0.098, -0.012],
      [0.62, 0.070, 0.083, -0.006],
      [0.76, 0.045, 0.062, -0.002],
      [0.88, 0.022, 0.042, 0.0],
      [0.95, 0.013, 0.024, 0.0],
      [1.0, 0.005, 0.008, 0.0],
    ],
    headLength: 0.33,
    grooves: { count: 4, from: 0.16, to: 0.32, span: 0.12 },
    fin: { root: 0.37, theta: 2.1, length: 0.07, chord: 0.045, thickness: 0.012, knobs: 0,
           axis: [0.8, -0.5, 0.3], sweep: 0.008 },
    fluke: { span: 0.25, serration: 0, notchDepth: 0.03, notchWidth: 0.04 },
  },
});

// なめらかに点をつなぐ(間隔がばらばらな点でも使えるエルミート補間)
function interpolate(points, u, k) {
  const n = points.length;
  if (u <= points[0][0]) return points[0][k];
  if (u >= points[n - 1][0]) return points[n - 1][k];
  let i = 0;
  while (points[i + 1][0] < u) i++;
  const p0 = points[i], p1 = points[i + 1];
  const slope = (a, b) => (b[k] - a[k]) / (b[0] - a[0]);
  const m0 = i > 0 ? slope(points[i - 1], p1) : slope(p0, p1);
  const m1 = i + 2 < n ? slope(p0, points[i + 2]) : slope(p0, p1);
  const h = p1[0] - p0[0];
  const t = (u - p0[0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0[k] + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1[k] + (t3 - t2) * h * m1;
}

// 背中の出っぱり(ザトウクジラの背びれ、マッコウクジラのこぶとでこぼこ)
function dorsalRise(kind, u) {
  if (kind === 'humpback') {
    const fin = u < 0.665 ? smoothstep(0.6, 0.665, u) : 1 - smoothstep(0.665, 0.69, u);
    return 0.02 * fin + 0.005 * bump(u, 0.645, 0.04);
  }
  let knuckles = 0;
  for (let k = 0; k < 6; k++) knuckles += 0.005 * bump(u, 0.72 + k * 0.028, 0.006);
  return 0.016 * bump(u, 0.66, 0.05) + knuckles;
}

// u の位置の輪切りの形
export function bodySection(kind, u) {
  const s = WHALE_SPECS[kind].sections;
  const squareness = kind === 'sperm' ? mix(3.6, 2.2, smoothstep(0.28, 0.38, u)) : 2.2;
  // ザトウクジラの頭は上が平ら
  const squarenessTop = kind === 'humpback' ? mix(3.4, 2.2, smoothstep(0.22, 0.36, u)) : squareness;
  return {
    halfWidth: Math.max(0.002, interpolate(s, u, 1)),
    halfHeight: Math.max(0.002, interpolate(s, u, 2)),
    centerY: interpolate(s, u, 3),
    squareness,
    squarenessTop,
    dorsal: dorsalRise(kind, u),
  };
}

// 角度の差(-π〜π)
const angleDiff = (a, b) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// のどの畝(0〜1。1 が溝のまん中)
export function ventralGroove(kind, u, theta) {
  const g = WHALE_SPECS[kind].grooves;
  const span = Math.PI * g.span;
  const phi = (theta - (Math.PI - span)) / (2 * span);
  if (phi <= 0 || phi >= 1) return 0;
  const along = smoothstep(g.from, g.from + 0.03, u) * (1 - smoothstep(g.to - 0.06, g.to, u));
  const across = smoothstep(0, 0.08, phi) * smoothstep(1, 0.92, phi);
  return ((0.5 + 0.5 * Math.cos(TAU * g.count * phi)) ** 12) * along * across;
}

// ザトウクジラの頭のこぶの位置(u と θ)。まん中の列と、その両わきの列、あごの先
// size は大きさの倍率。こぶは頭の上だけでなく下あごにもあり、あごの先にはひとつ丸く大きなこぶがある
export function headKnobs(kind) {
  if (kind !== 'humpback') return [];
  const knobs = [];
  for (let i = 0; i < 10; i++) {
    const u = 0.03 + i * 0.018;
    knobs.push({ u, theta: 0, size: 1 });
    knobs.push({ u: u + 0.008, theta: 0.38, size: 1 });
    knobs.push({ u: u + 0.008, theta: -0.38, size: 1 });
  }
  for (let i = 0; i < 9; i++) {
    const u = 0.02 + i * 0.018;
    knobs.push({ u, theta: 2.3, size: 0.9 });
    knobs.push({ u, theta: -2.3, size: 0.9 });
  }
  knobs.push({ u: 0.015, theta: Math.PI, size: 2.5 });
  for (let i = 1; i < 4; i++) knobs.push({ u: 0.012 + i * 0.014, theta: Math.PI, size: 1 });
  return knobs;
}

// 口の線・目・鼻の穴の位置。θ は右側の値(左右対称に使う)。鼻の穴は左寄りなので θ が負
export function faceFeatures(kind) {
  if (kind === 'humpback') {
    // 口の線は口先から少し持ち上がり、口の端で下がる。目は口の端のすぐ上・うしろ
    const mouth = [];
    for (let i = 0; i <= 12; i++) {
      const u = 0.01 + (i / 12) * 0.25;
      mouth.push({ u, theta: 1.9 - 0.2 * Math.sin((Math.PI * u) / 0.3) });
    }
    return { mouth, eye: { u: 0.285, theta: 1.6 }, blowhole: null };
  }
  // マッコウクジラ: 口の線は頭の下を後ろへまっすぐ。目は口の端のすぐ上。鼻の穴はS字で、頭の前の左寄り
  const mouth = [];
  for (let i = 0; i <= 12; i++) mouth.push({ u: 0.06 + (i / 12) * 0.24, theta: 2.62 - 0.12 * (i / 12) });
  return { mouth, eye: { u: 0.32, theta: 2.0 }, blowhole: { u: 0.012, theta: -0.45 } };
}
const KNOBS = { humpback: headKnobs('humpback'), sperm: [] };
const FACES = { humpback: faceFeatures('humpback'), sperm: faceFeatures('sperm') };

// 口の線からの近さ(1 が線の上)
function mouthLine(kind, u, side) {
  const m = FACES[kind].mouth;
  if (u < m[0].u || u > m[m.length - 1].u + 0.006) return 0;
  let i = 0;
  while (i < m.length - 2 && m[i + 1].u < u) i++;
  const t = clamp01((u - m[i].u) / (m[i + 1].u - m[i].u));
  const theta = mix(m[i].theta, m[i + 1].theta, t);
  const end = 1 - smoothstep(m[m.length - 1].u, m[m.length - 1].u + 0.006, u);
  return bump(side, theta, 0.022) * end;
}

// 目(1 がまん中)
function eyeSpot(kind, u, side) {
  const e = FACES[kind].eye;
  return bump(u, e.u, 0.006) * bump(side, e.theta, 0.05);
}

// マッコウクジラのS字の鼻の穴
function blowholeSlit(kind, u, theta) {
  const b = FACES[kind].blowhole;
  if (!b) return 0;
  let best = 0;
  for (let v = -1; v <= 1; v += 0.1) {
    const cu = b.u + 0.006 * v, ct = b.theta + 0.08 * Math.sin(Math.PI * v);
    best = Math.max(best, bump(u, cu, 0.0025) * bump(angleDiff(theta, ct), 0, 0.02));
  }
  return best;
}

// フジツボの白い点(ザトウクジラのあごの先、頭のこぶ)
function barnacles(kind, u, theta) {
  if (kind !== 'humpback') return 0;
  const p = Math.sin(180 * u + 11 * theta) * Math.sin(140 * u - 13 * theta + 1);
  const spot = smoothstep(0.78, 0.86, 0.5 + 0.5 * p);
  const chin = (1 - smoothstep(0.05, 0.08, u)) * smoothstep(0.2, 0.6, -Math.cos(theta));
  let knob = 0;
  for (const k of KNOBS[kind]) knob = Math.max(knob, bump(u, k.u, 0.008) * bump(angleDiff(theta, k.theta), 0, 0.06));
  return spot * Math.max(chin, 0.6 * knob);
}


// 体の表面を外側に押し出す量(こぶ、畝、しわ、下あご)
function surfaceOffset(kind, u, theta) {
  let d = -0.0015 * ventralGroove(kind, u, theta);
  for (const k of KNOBS[kind]) {
    const w = Math.sqrt(k.size);
    d += 0.004 * k.size * bump(u, k.u, 0.01 * w) * bump(angleDiff(theta, k.theta), 0, 0.08 * w);
  }
  const side = Math.abs(angleDiff(theta, 0));
  d -= 0.0015 * mouthLine(kind, u, side);
  // ザトウクジラの目は、まぶたと目の玉を別の部品(eyeShape.js)で細かく作る
  if (kind !== 'humpback') d += 0.0015 * eyeSpot(kind, u, side);
  d -= 0.002 * blowholeSlit(kind, u, theta);
  if (kind === 'sperm') {
    // しわしわの肌(頭より後ろ)
    const wrinkleZone = smoothstep(0.33, 0.4, u) * (1 - smoothstep(0.85, 0.93, u));
    d += 0.0012 * Math.sin(u * 520) * Math.sin(theta * 7 + u * 40) * wrinkleZone;
    // 細い下あご(頭の下に棒のように出ている)
    const jaw = smoothstep(0.05, 0.09, u) * (1 - smoothstep(0.27, 0.31, u));
    d += 0.01 * bump(angleDiff(theta, Math.PI), 0, 0.14) * jaw;
  }
  return d;
}

// なめらかな模様(θ はつながるように整数倍だけ使う)
function mottle(u, theta, seed = 0) {
  return 0.5
    + 0.22 * Math.sin(37 * u + 3 * theta + seed)
    + 0.16 * Math.sin(23 * u - 5 * theta + 1.3 + seed)
    + 0.12 * Math.sin(71 * u + 9 * theta + 2.1 + seed);
}

const HB_BACK = hex(0x16181b), HB_WHITE = hex(0xe6e8ea), HB_GROOVE = hex(0x8a9096);
const SP_BODY = hex(0x423e3a), SP_LIGHT = hex(0x8a857e), SP_WHITE = hex(0xdcdad6), SP_CALLUS = hex(0xb0aba1);
const EYE = hex(0x050506), LINE = hex(0x0b0c0d), BARNACLE = hex(0xd9d4c8);

// 顔のつくり(口の線・目・鼻の穴)とフジツボを、体の色の上に重ねる
function faceColor(kind, u, theta, c) {
  const side = Math.abs(angleDiff(theta, 0));
  c = mixColor(c, BARNACLE, barnacles(kind, u, theta));
  c = mixColor(c, LINE, 0.85 * mouthLine(kind, u, side));
  if (kind !== 'humpback') c = mixColor(c, EYE, 0.95 * smoothstep(0.35, 0.8, eyeSpot(kind, u, side)));
  c = mixColor(c, EYE, 0.9 * smoothstep(0.3, 0.7, blowholeSlit(kind, u, theta)));
  return c;
}

// 体の色(sRGB の 0〜1)
export function skinColor(kind, u, theta) {
  const down = -Math.cos(theta); // 1 がおなかのまん中
  if (kind === 'humpback') {
    const zone = smoothstep(0.0, 0.03, u) * (1 - smoothstep(0.55, 0.75, u));
    const white = smoothstep(0.2, 0.55, down + 0.25 * (mottle(u, theta) - 0.5)) * zone;
    let c = mixColor(HB_BACK, HB_WHITE, white);
    c = mixColor(c, HB_GROOVE, 0.3 * ventralGroove(kind, u, theta) * white);
    return faceColor(kind, u, theta, c);
  }
  let c = mixColor(SP_BODY, SP_LIGHT, 0.15 * mottle(u, theta, 4));
  // 頭のひっかき傷(白い筋)
  const head = 1 - smoothstep(0.25, 0.34, u);
  const scratch = Math.abs(Math.sin(u * 90 + theta * 2 + 3 * mottle(u, theta, 7))) ** 40;
  c = mixColor(c, SP_LIGHT, 0.6 * scratch * head * smoothstep(-0.2, 0.4, -down));
  // 口のまわりと下あごは白い
  const mouth = smoothstep(0.03, 0.06, u) * (1 - smoothstep(0.28, 0.33, u));
  c = mixColor(c, SP_WHITE, bump(angleDiff(theta, Math.PI), 0, 0.3) * mouth);
  // おなかの白っぽいところ
  c = mixColor(c, SP_LIGHT, 0.4 * bump(u, 0.52, 0.06) * smoothstep(0.6, 0.95, down));
  // 多くの大人のメスは、背中のこぶに白っぽいたこがある
  c = mixColor(c, SP_CALLUS, 0.75 * bump(u, 0.66, 0.025) * bump(angleDiff(theta, 0), 0, 0.3));
  return faceColor(kind, u, theta, c);
}

// 体の表面の点
export function bodyPoint(kind, u, theta) {
  const s = bodySection(kind, u);
  const sx = Math.sin(theta), cy = Math.cos(theta);
  const e = 2 / (cy > 0 ? s.squarenessTop : s.squareness);
  let x = s.halfWidth * Math.sign(sx) * Math.abs(sx) ** e;
  let yScale = s.halfHeight;
  if (cy > 0) yScale += s.dorsal * cy ** 24;
  if (cy < 0 && kind === 'sperm') yScale *= mix(0.55, 1, smoothstep(0.0, 0.1, u)); // 下あごは頭の先より引っこむ
  let y = s.centerY + yScale * Math.sign(cy) * Math.abs(cy) ** e;
  const d = surfaceOffset(kind, u, theta);
  x += d * sx;
  y += d * cy;
  return [x, y, bodyZ(u)];
}

// 形を入れる入れもの。jaw は頂点ごとのあごの重み [下あご, 上あご, のど, 口の線より下か]
function meshBuilder() {
  const positions = [], colors = [], indices = [], jaw = [];
  return {
    positions, colors, indices, jaw,
    add(p, c, j = NO_JAW) { positions.push(...p); colors.push(...c); jaw.push(...j); return positions.length / 3 - 1; },
  };
}
const NO_JAW = [0, 0, 0, 0];

// ---- 口を開ける(ザトウクジラの捕食) ----
// 下あごは口の端のつけ根を軸に下へ開き、上あご(頭)は少し持ち上がる。
// のどからおなかの畝(うね)が広がって、のみこんだ水で大きくふくらむ。

// u の位置の口の線の θ(口先より前・口の端よりうしろは、はしの値)
function mouthTheta(kind, u) {
  const m = FACES[kind].mouth;
  if (u <= m[0].u) return m[0].theta;
  if (u >= m[m.length - 1].u) return m[m.length - 1].theta;
  let i = 0;
  while (m[i + 1].u < u) i++;
  return mix(m[i].theta, m[i + 1].theta, (u - m[i].u) / (m[i + 1].u - m[i].u));
}

// 頂点のあごの重み [下あご, 上あご, のど, 口の線より下か](0〜1)
export function jawWeights(kind, u, theta) {
  if (kind !== 'humpback') return NO_JAW;
  const side = Math.abs(angleDiff(theta, 0));
  const below = smoothstep(mouthTheta(kind, u) - 0.03, mouthTheta(kind, u) + 0.03, side);
  // 下あごの関節は口の端。そこまでに動きを弱め、うしろはのどの皮がのびてつながる
  const lower = below * (1 - smoothstep(0.17, 0.29, u));
  // 上あごは目より前だけ(目は動かさない)
  const upper = (1 - below) * (1 - smoothstep(0.16, 0.25, u));
  // のど: 畝のある、おなか側の下半分。おへそ(体の半分くらい)まで
  const pouch = smoothstep(1.75, 2.35, side) * smoothstep(0.02, 0.07, u) * (1 - smoothstep(0.42, 0.54, u));
  return [lower, upper, pouch, below];
}

// あごの軸(口の端)の [y, z](体長1の大きさ)。軸は左右(x)の向き
export function jawHinge(kind) {
  const c = FACES[kind].mouth[FACES[kind].mouth.length - 1];
  const p = bodyPoint(kind, c.u, c.theta);
  return [p[1], p[2]];
}

// のどのふくらむ向きと大きさ(体長1)。下へ大きく、横へも少し
export const POUCH_SWELL = 0.11;
export function pouchDirection(p) {
  const r = Math.hypot(p[0], p[1] + 0.02) || 1;
  const d = [(p[0] / r) * 0.7, (p[1] + 0.02) / r - 0.4, 0];
  const n = Math.hypot(...d) || 1;
  return d.map(v => v / n);
}

// あごを開いたときの、体の点の位置(体長1)。lower・upper はあごの角度(ラジアン)、pouch はのどのふくらみ(0〜1)
export function jawPoint(kind, u, theta, lower, upper = 0, pouch = 0) {
  const [wl, wu, wp] = jawWeights(kind, u, theta);
  let p = bodyPoint(kind, u, theta);
  const d = pouchDirection(p);
  p = p.map((v, i) => v + d[i] * POUCH_SWELL * pouch * wp);
  const [hy, hz] = jawHinge(kind);
  const a = lower * wl - upper * wu;   // 下あごは前が下がる向き、上あごはその反対
  const y = p[1] - hy, z = p[2] - hz;
  const c = Math.cos(a), s = Math.sin(a);
  // 頭は -z の向き。前(-z)が下がる回転
  return [p[0], hy + y * c + z * s, hz - y * s + z * c];
}

// 体の網目の細かさ。頭と尾の近くほど細かい
export const BODY_GRID = Object.freeze({ rings: 160, around: 176 });
export const ringU = i => 0.5 - 0.5 * Math.cos((Math.PI * i) / (BODY_GRID.rings - 1));
export const aroundTheta = j => (TAU * j) / BODY_GRID.around;

// ザトウクジラの目のまわりで、体の網目から抜いて、目の部品(パッチ)に置きかえるマス目。
// 網目の線にそろえてあるので、パッチのふちと体がすきまなくつながる。
// 前後は約1m、上下は約0.9m(間近で目を見ても、画面いっぱいがパッチになる広さ)
export function eyeCells(kind) {
  if (kind !== 'humpback') return null;
  const e = FACES[kind].eye;
  let ic = 0;
  for (let i = 0; i < BODY_GRID.rings; i++) if (Math.abs(ringU(i) - e.u) < Math.abs(ringU(ic) - e.u)) ic = i;
  const jc = Math.round(e.theta / aroundTheta(1));
  const i0 = ic - 4, i1 = ic + 4, j0 = jc - 7, j1 = jc + 7;
  return { i0, i1, right: [j0, j1], left: [BODY_GRID.around - j1, BODY_GRID.around - j0] };
}
const CELLS = { humpback: eyeCells('humpback'), sperm: null };
const inCells = (kind, i, j) => {
  const c = CELLS[kind];
  if (!c || i < c.i0 || i >= c.i1) return false;
  return (j >= c.right[0] && j < c.right[1]) || (j >= c.left[0] && j < c.left[1]);
};

// その場所が、体から抜いた目のまわりのマス目に入るか
export function eyeHole(kind, u, theta) {
  const c = CELLS[kind];
  if (!c || u < ringU(c.i0) || u > ringU(c.i1)) return false;
  const t = ((theta % TAU) + TAU) % TAU;
  const j = t / aroundTheta(1);
  return (j >= c.right[0] && j <= c.right[1]) || (j >= c.left[0] && j <= c.left[1]);
}

function bodyMesh(kind, out, rings = BODY_GRID.rings, around = BODY_GRID.around) {
  const first = out.positions.length / 3;
  for (let i = 0; i < rings; i++) {
    const u = ringU(i); // 頭と尾の近くを細かく
    for (let j = 0; j < around; j++) {
      const theta = aroundTheta(j);
      out.add(bodyPoint(kind, u, theta), skinColor(kind, u, theta), jawWeights(kind, u, theta));
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = first + i * around + j, b = first + i * around + ((j + 1) % around);
      const c = a + around, d = b + around;
      if (inCells(kind, i, j)) continue;   // 目のまわりは目の部品で描く
      out.indices.push(a, c, b, b, c, d);
    }
  }
  // 頭の先と尾の先をふさぐ
  const front = out.add([0, bodySection(kind, 0).centerY, bodyZ(0)], skinColor(kind, 0, 0), jawWeights(kind, 0, Math.PI / 2));
  const back = out.add([0, 0, bodyZ(1)], skinColor(kind, 1, 0));
  const last = first + (rings - 1) * around;
  for (let j = 0; j < around; j++) {
    const j2 = (j + 1) % around;
    out.indices.push(front, first + j, first + j2);
    out.indices.push(back, last + j2, last + j);
  }
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const addv = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map(v => v * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => scale(a, 1 / Math.hypot(...a));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 胸びれ(side: 1 が右、-1 が左)
export function finGeometry(kind, side, out = meshBuilder()) {
  const f = WHALE_SPECS[kind].fin;
  const first = out.positions.length / 3;
  const root = bodyPoint(kind, f.root, side * f.theta);
  const axis = norm([side * f.axis[0], f.axis[1], f.axis[2]]);
  // ひれの幅の向き(前のふち → うしろのふち)は、体のうしろ向きに近く、軸と直角
  const back = [0, 0, 1];
  const chordDir = norm(sub(back, scale(axis, dot(back, axis))));
  const thickDir = norm(cross(axis, chordDir));
  const steps = 48, around = 14;
  // ひれは、のどがふくらむとつけ根といっしょに動く(体からはなれない)。あごといっしょには回らない
  const rootJaw = [0, 0, jawWeights(kind, f.root, side * f.theta)[2], 0];
  let tip = root;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    let chord, thick;
    if (kind === 'humpback') {
      chord = f.chord * (1 - s) ** 0.6 + 0.008 * Math.max(0, Math.sin(Math.PI * f.knobs * s)) ** 2 * (1 - s);
      thick = f.thickness * (1 - 0.7 * s);
    } else {
      chord = f.chord * Math.sqrt(Math.max(0, 1 - s * s));     // しゃもじのような丸い先
      thick = f.thickness * (1 - 0.5 * s);
    }
    const center = addv(addv(root, scale(axis, f.length * s)), scale(chordDir, f.sweep * s * s));
    if (i === steps) tip = center;
    for (let j = 0; j < around; j++) {
      const phi = (TAU * j) / around;
      const along = 0.5 - 0.5 * Math.cos(phi);                 // 0 が前のふち、1 がうしろのふち
      const t = thick * Math.sin(phi) * (1 - 0.6 * along);
      const p = addv(addv(center, scale(chordDir, chord * (along - 0.3))), scale(thickDir, t));
      let color;
      if (kind === 'humpback') {
        const topSide = Math.sin(phi) * Math.sign(dot(thickDir, [0, 1, 0])) > 0;
        const dark = topSide ? 0.55 * (1 - smoothstep(0.05, 0.3, s)) : 0;
        color = mixColor(HB_WHITE, HB_BACK, dark);
      } else {
        color = SP_BODY;
      }
      out.add(p, color, rootJaw);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < around; j++) {
      const a = first + i * around + j, b = first + i * around + ((j + 1) % around);
      out.indices.push(a, a + around, b, b, a + around, b + around);
    }
  }
  return { ...out, length: Math.hypot(...sub(tip, root)), leadingEdgeKnobs: f.knobs };
}

// 尾びれの前のふちとうしろのふちの位置(a は 0 がまん中、1 が先)
export function flukeOutline(kind, a) {
  const f = WHALE_SPECS[kind].fluke;
  const notch = f.notchDepth * bump(a, 0, f.notchWidth);
  if (kind === 'humpback') {
    // うしろのふちには丸いこぶが並び、波のような形になる。先はとがる
    const knobs = f.serration * Math.abs(Math.sin(a * 38)) ** 0.6 * smoothstep(0.1, 0.3, a) * (1 - a);
    return { leading: 0.415 + 0.055 * a ** 1.4, trailing: 0.498 - 0.028 * a * a - notch + knobs };
  }
  // マッコウクジラ: 三角形で、うしろのふちはほぼまっすぐ。先は丸い
  const lead = 0.42 + 0.06 * a, trail = 0.498 - 0.018 * a;
  const mid = (lead + trail) / 2;
  let half = (trail - lead) / 2;
  if (a > 0.75) {
    const at = (0.498 - 0.018 * 0.75 - (0.42 + 0.06 * 0.75)) / 2;
    half = at * Math.sqrt(Math.max(0, 1 - ((a - 0.75) / 0.25) ** 2));
  }
  return { leading: mid - half, trailing: mid + half - notch };
}

// 尾びれ
export function flukeGeometry(kind, out = meshBuilder()) {
  const f = WHALE_SPECS[kind].fluke;
  const first = out.positions.length / 3;
  const leading = a => flukeOutline(kind, a).leading;
  const trailing = a => flukeOutline(kind, a).trailing;
  const steps = 64, around = 12;
  const edges = [];
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;           // -1 が左のはし、1 が右のはし
    const a = Math.abs(t);
    const zl = leading(a), zt = Math.max(zl, trailing(a));
    edges.push(zt);
    const thick = 0.012 * (1 - a) ** 0.8 + 0.0005;
    const x = (t * f.span) / 2;
    for (let j = 0; j < around; j++) {
      const phi = (TAU * j) / around;
      const along = 0.5 - 0.5 * Math.cos(phi);
      const y = thick * Math.sin(phi) * (1 - 0.6 * along);
      const z = mix(zl, zt, along);
      let color;
      if (kind === 'humpback') {
        const under = Math.sin(phi) < 0;
        // 裏側は白地に黒い模様(1頭ずつちがう)。ふちは黒い
        const pattern = smoothstep(0.4, 0.6, mottle(x * 0.9, (z - 0.42) * 9, 11));
        const rim = smoothstep(0.75, 0.95, along) + smoothstep(0.85, 1, a);
        color = under ? mixColor(HB_WHITE, HB_BACK, clamp01(1 - pattern + rim)) : HB_BACK;
      } else {
        color = SP_BODY;
      }
      out.add([x, y, z], color);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < around; j++) {
      const a = first + i * around + j, b = first + i * around + ((j + 1) % around);
      out.indices.push(a, b, a + around, b, b + around, a + around);
    }
  }
  // うしろのふちのギザギザの大きさ(切れこみのまわりは除く)
  let rough = 0, n = 0;
  for (let i = 1; i < steps; i++) {
    const a = Math.abs(-1 + (2 * i) / steps);
    if (a < 0.2 || a > 0.95) continue;
    rough += Math.abs(edges[i - 1] - 2 * edges[i] + edges[i + 1]); n++;
  }
  return { ...out, span: f.span, trailingRoughness: rough / n };
}

// 体・胸びれ2枚・尾びれをまとめた形
export function buildWhaleGeometry(kind) {
  const out = meshBuilder();
  bodyMesh(kind, out);
  finGeometry(kind, 1, out);
  finGeometry(kind, -1, out);
  flukeGeometry(kind, out);
  return {
    positions: Float32Array.from(out.positions), colors: Float32Array.from(out.colors),
    indices: Uint32Array.from(out.indices), jaw: Float32Array.from(out.jaw),
  };
}

// 泳ぐときの体のしなり。s は頭(0)から尾(1)までの位置、phase は動きの進み具合。
// クジラは尾びれを上下にあおいで泳ぐ。頭はほとんど動かず、尾に向かうほど大きく動き、
// 波が頭から尾へ伝わっていく。シェーダーでも同じ数値を使う。
export const SWIM = Object.freeze({ amplitude: 0.035, power: 2.5, wave: 5.0 });
export function swimBend(s, phase, amount) {
  return amount * SWIM.amplitude * s ** SWIM.power * Math.sin(phase - SWIM.wave * s);
}

// 海面に浮かんだときの体の中心の高さ(m)。背中のいちばん高いところが exposedMeters だけ海面から出る。
// 体の太さから計算するので、形を変えても浮かび方がずれない
export function surfacedCenterY(kind, lengthMeters, exposedMeters) {
  let top = -Infinity;
  for (let u = 0; u <= 1; u += 0.005) {
    const s = bodySection(kind, u);
    top = Math.max(top, (s.centerY + s.halfHeight) * lengthMeters);
  }
  return exposedMeters - top;
}

// 胸びれの付け根と先の位置(体長1の比率)。胸びれでたたく動きで、先の位置を使う
export function finTip(kind, side) {
  const f = WHALE_SPECS[kind].fin;
  const root = bodyPoint(kind, f.root, side * f.theta);
  const axis = norm([side * f.axis[0], f.axis[1], f.axis[2]]);
  const back = [0, 0, 1];
  const chordDir = norm(sub(back, scale(axis, dot(back, axis))));
  const tip = addv(addv(root, scale(axis, f.length)), scale(chordDir, f.sweep));
  return { root, tip };
}

// しなりの傾き(swimBend を s で微分したもの)。体の向きに合わせて陰をつけるのに使う
export function swimSlope(s, phase, amount) {
  const a = phase - SWIM.wave * s;
  return amount * SWIM.amplitude * (SWIM.power * s ** (SWIM.power - 1) * Math.sin(a) - SWIM.wave * s ** SWIM.power * Math.cos(a));
}
