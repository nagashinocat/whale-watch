// 水しぶきの粒の作り方。three.js は使わない(テストからも使う)。
//
// 大きなものが水に落ちたときの水しぶきは、次の順番でできる(水しぶきの研究より)。
//   1) 落ちたところの水がへこみ、空気の穴ができる
//   2) そのまわりの水が、輪になった膜(王冠のような形)になって持ち上がる
//   3) 膜がちぎれて、たくさんの水滴になって落ちてくる
// これに、風に流されてただよう細かいしぶき(霧)を足して作る。
// クジラの水しぶきの大きさを書いた資料は見つからなかったので、大きさは体の大きさに合わせて決めている。

const G = 9.8;

// length / width: 水しぶきの輪の長さと幅(m)。ジャンプの着水は横倒しなので、体の長さに沿って細長い
// crownHeight: 水の膜が上がる高さ(m)
export const SPLASH = Object.freeze({
  large: Object.freeze({ length: 12, width: 3.5, crownHeight: 6, crown: 900, droplets: 700, mist: 700, outward: 3.5, mistHeight: 3 }),
  small: Object.freeze({ length: 3, width: 1.5, crownHeight: 2, crown: 220, droplets: 120, mist: 140, outward: 1.8, mistHeight: 1 }),
});

// 粒がいちばん高く上がる高さ(上向きは重力だけで止まる)
export function apexHeight(p) {
  return p.p[1] + (p.v[1] > 0 ? (p.v[1] * p.v[1]) / (2 * p.gravity) : 0);
}

// 水しぶきの粒の一覧。center: 落ちたところ / heading: 体の向き(水平) / rng: 0〜1 の乱数
// 粒は { part, p: 位置, v: 速さ, delay: 出るまでの秒, life, size, alpha, gravity, wind, grow }
export function splashParticles(kind, center, heading, rng = Math.random) {
  const s = SPLASH[kind];
  const r = (a, b) => a + rng() * (b - a);
  const hl = Math.hypot(heading[0], heading[2]) || 1;
  const fx = heading[0] / hl, fz = heading[2] / hl;   // 体の向き
  const sx = -fz, sz = fx;                             // 体の横の向き
  const out = [];

  // 輪の上の点と、そこでの外向きの向き(楕円)
  // 膜の高さは場所によってちがい、いくつかの水の柱が高く立つ(てっぺんがぎざぎざになる)
  const phase = rng() * Math.PI * 2;
  const peaks = a => 0.72 + 0.28 * Math.sin(3 * a + phase) * Math.sin(5 * a + phase * 0.7);

  function ring(scale = 1) {
    const a = rng() * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = (s.length / 2) * scale, W = (s.width / 2) * scale;
    const lx = L * ca, lz = W * sa;
    let nx = ca / L, nz = sa / W;
    const nl = Math.hypot(nx, nz);
    nx /= nl; nz /= nl;
    return {
      a,
      x: center[0] + fx * lx + sx * lz, z: center[2] + fz * lx + sz * lz,
      ox: fx * nx + sx * nz, oz: fz * nx + sz * nz,
    };
  }

  // 2) 王冠のような水の膜
  for (let i = 0; i < s.crown; i++) {
    const q = ring(r(0.9, 1.1));
    const h = s.crownHeight * Math.min(1, peaks(q.a) * r(0.75, 1.15));
    const vy = Math.sqrt(2 * G * h);
    const o = s.outward * r(0.7, 1.3);
    out.push({
      part: 'crown', p: [q.x, center[1] + 0.1, q.z], v: [q.ox * o, vy, q.oz * o],
      delay: r(0, 0.25), life: (2 * vy) / G + 0.2, size: kind === 'large' ? r(1.0, 1.8) : r(0.5, 0.9),
      alpha: 0.9, gravity: G, wind: 0, grow: 1.3,
    });
  }

  // 3) 膜がちぎれてできる水滴(膜より少しあとに、膜の上のほうから外へ落ちていく)
  for (let i = 0; i < s.droplets; i++) {
    const q = ring(r(1.1, 1.4));
    const o = s.outward * r(0.9, 2.0);
    out.push({
      part: 'droplets', p: [q.x, center[1] + s.crownHeight * r(0.3, 0.85), q.z], v: [q.ox * o, r(0, 3), q.oz * o],
      delay: r(0.35, 0.9), life: r(1.6, 2.6), size: kind === 'large' ? r(0.35, 0.7) : r(0.2, 0.4),
      alpha: 0.85, gravity: G, wind: 0, grow: 1,
    });
  }

  // 風に流されてただよう細かいしぶき
  for (let i = 0; i < s.mist; i++) {
    const q = ring(r(0.8, 1.3));
    const o = s.outward * r(0.3, 1.1);
    out.push({
      part: 'mist', p: [q.x, center[1] + s.mistHeight * r(0.2, 1), q.z], v: [q.ox * o, r(1, 3), q.oz * o],
      delay: r(0.1, 0.8), life: r(4, 6.5), size: kind === 'large' ? r(0.9, 1.5) : r(0.5, 0.9),
      alpha: 0.2, gravity: 2, wind: 1.6, grow: 2.2,
    });
  }
  return out;
}
