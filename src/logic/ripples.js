// 海面の波の輪。クジラが水に落ちたところから、海面がもり上がったりへこんだりしながら、輪になって外へ広がる。
// three.js は使わない(テストからも使う)。シェーダー(ocean.js)にも同じ式を書く。
//
// 調べてわかったこと(深い海の、水の重さでもどる波)
//   ・波の速さは波長で決まり、長い波ほど速い(位相の速さ = √(gλ/2π))。波のかたまりは、その半分の速さで進む
//   ・落ちたところでは、まず水がへこみ、もどるときに盛り上がる。そのあと、いくつもの山と谷が輪になって広がる
//   ・輪が広がるほど、エネルギーが長いふちに分かれるので、高さは距離の平方根に反比例して小さくなる
// アプリでは、波長 8m くらいの波のかたまり1つと、まん中のへこみ・もり上がりで作る

export const RIPPLE = Object.freeze({
  wavelength: 8,      // 波長(m)
  width: 6,           // 波のかたまりの幅(m)
  life: 14,           // 消えるまで(秒)
  maxAmp: 1.2,        // 高さの上限(m)
  max: 12,            // 同時に覚えておく波の輪の数(シェーダーの配列の大きさ)
  inner: 120,         // 細かい網目にする範囲(m)
});

const G = 9.8;
const K = (2 * Math.PI) / RIPPLE.wavelength;
const PHASE = Math.sqrt(G / K);        // 位相の速さ
const GROUP = PHASE / 2;               // 波のかたまりの速さ

// 落ちたところからの距離 r(m)、落ちてからの時間 t(秒)、高さ amp(m)での、海面の高さ(m)
export function rippleHeight(r, t, amp) {
  if (t <= 0 || t > RIPPLE.life || amp === 0) return 0;
  const fade = (1 - t / RIPPLE.life) ** 2;
  // 外へ広がる波のかたまり
  const front = GROUP * t + 2;
  const env = Math.exp(-(((r - front) / RIPPLE.width) ** 2));
  const ring = env * Math.cos(K * r - K * PHASE * t) / Math.sqrt(1 + r / 6);
  // まん中: はじめにへこみ、もどってもり上がり、ゆれながらおさまる
  const center = Math.exp(-((r / 4) ** 2)) * -Math.cos(t * 2.2) * Math.exp(-t * 0.6);
  return amp * fade * (ring + 0.8 * center);
}

// 落ちたものの重さ(kg)と、落ちる速さ(m/秒)からの波の高さ(m)。勢い(運動量)の平方根に比べる
export function rippleAmplitude(massKg, speed) {
  if (massKg <= 0 || speed <= 0) return 0;
  return Math.min(RIPPLE.maxAmp, 0.0012 * Math.sqrt(massKg * speed));
}

// 海の網目(まるい板)。center([x, z])のまわりは細かく、遠くはあらい。y = 0 の平らな面
export function rippleGrid(center, { spokes = 160, outer = 20000 } = {}) {
  const radii = [0];
  // まん中から inner までは、波長の 1/8 くらいから、だんだん広い間かくで
  let r = 0, step = 0.35;
  while (r < RIPPLE.inner) { r += step; radii.push(r); step = Math.min(step * 1.035, 2.5); }
  // その外は、海のはしまで一気に広げる
  for (let k = 1; k <= 14; k++) radii.push(RIPPLE.inner * (outer / RIPPLE.inner) ** (k / 14));
  const positions = [center[0], 0, center[1]];
  for (let i = 1; i < radii.length; i++) {
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * Math.PI * 2;
      positions.push(center[0] + Math.cos(a) * radii[i], 0, center[1] + Math.sin(a) * radii[i]);
    }
  }
  const indices = [];
  for (let s = 0; s < spokes; s++) indices.push(0, 1 + ((s + 1) % spokes), 1 + s);
  for (let i = 1; i < radii.length - 1; i++) {
    const a0 = 1 + (i - 1) * spokes, a1 = 1 + i * spokes;
    for (let s = 0; s < spokes; s++) {
      const s1 = (s + 1) % spokes;
      indices.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
    }
  }
  return { positions: new Float32Array(positions), indices };
}
