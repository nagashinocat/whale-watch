// 水の中で吹いた泡が、浮かび上がって水面ではじけるまでを計算する。three.js は使わない(テストからも使う)。
//
// 泡の動きは、次のことから決まる。
//   ・泡は浮かぶ力で上がる。大きい泡ほど速い(数mmの泡は秒速25cmくらい。こぶし大の泡は秒速50cmくらい)
//   ・深いところは水におされているので、泡は上がるほどふくらむ(水深10mで2倍の圧力 → 体積が半分)
//   ・泡の柱は上がりながら少しずつ横に広がる(まわりの水をまきこむ)
// だから同じときに吹いた泡でも、大きい泡が先に水面へ着き、小さい泡が少しおくれてシュワシュワと着く。
// 水面に着いた泡は、はじけて小さな水滴を飛ばし、白い泡のあとと、小さな波を残す。

const G = 9.8;
const ATM_DEPTH = 10.3;   // 1気圧ぶんの水の深さ(m)

export const BUBBLE = Object.freeze({
  minR: 0.002, maxR: 0.04,   // 吹いたときの泡の大きさ(半径 m)
  spread: 0.12,              // 泡の柱が、上がる高さ1mあたりに横へ広がる長さ(m)
});

// 泡が水面に着いたときの半径。水深 depth で半径 r0 だった泡
export function surfaceRadius(r0, depth) {
  return r0 * Math.cbrt((ATM_DEPTH + depth) / ATM_DEPTH);
}

// 泡が上がる速さ(m/秒)。小さい泡は水のねばりで遅く、大きい泡はかさの形になって速い
export function riseSpeed(r) {
  const small = 0.25;                                // 数mmの泡
  const cap = 0.711 * Math.sqrt(G * 2 * r) * 0.9;    // 大きなかさ形の泡
  return Math.max(small, cap);
}

// 水深 depth から水面まで上がる秒数(上がるほどふくらんで速くなるので、少しずつ足し合わせる)
export function riseTime(r0, depth, steps = 20) {
  let t = 0;
  for (let k = 0; k < steps; k++) {
    const d = depth * (1 - (k + 0.5) / steps);
    const r = r0 * Math.cbrt((ATM_DEPTH + depth) / (ATM_DEPTH + d));   // その深さでの泡の半径
    t += (depth / steps) / riseSpeed(r);
  }
  return t;
}

// 水深 depth で一度に吹いた泡が、いつ・どこで水面に着くか。
// center: 吹いたところの真上 [x, 0, z] / count: 泡の数 / radius: 吹き出し口の広さ(m)
// 返すのは { at: 着く秒(いちばん早い泡が0), x, z, r: はじけるときの半径(m) } の一覧(早い順)
export function bubbleBurst(center, { depth = 12, count = 60, radius = 0.6, rng = Math.random } = {}) {
  const out = [];
  for (let k = 0; k < count; k++) {
    // 大きさは、小さい泡ほど多い(大きい泡は少ない)
    const r0 = BUBBLE.minR * Math.pow(BUBBLE.maxR / BUBBLE.minR, rng() ** 2);
    const a = rng() * Math.PI * 2;
    // 泡の柱は上がるほど広がる。小さい泡はおそいぶん、横の水の流れに長く流される
    const t = riseTime(r0, depth);
    const wide = radius + BUBBLE.spread * depth * Math.sqrt(rng()) * (0.6 + 0.4 * Math.min(2, t / 40));
    out.push({ at: t, x: center[0] + Math.cos(a) * wide, z: center[2] + Math.sin(a) * wide, r: surfaceRadius(r0, depth) });
  }
  out.sort((p, q) => p.at - q.at);
  const first = out.length ? out[0].at : 0;
  for (const p of out) p.at -= first;
  return out;
}

// はじけた泡の飛ばす水滴の数と勢い。大きい泡ほど多く、高く飛ぶ(はじけた穴に水がなだれこんで、まん中から細い水の柱が出る)
export function popJet(r) {
  const n = Math.max(1, Math.round(1 + r * 120));
  const speed = 0.8 + Math.min(2.2, r * 40);
  return { n, speed };
}

// 泡の広がり(海面の白い泡)の、まん中からの距離の分け方。0〜1 の乱数 u から、まん中からの距離(0〜1)にする。
// 大きなものが落ちたところでは、水がまん中から外へ押しやられ、泡はふちに寄って輪のようになる。
// まん中は、浮かび上がった水がなめらかにならした、つるっとした水面になる(ring: 0 だと一様、1 だとふちに寄る)
export function foamRadius(u, ring = 0.6) {
  const even = Math.sqrt(u);
  const edge = 1 - 0.45 * (1 - u) ** 2;
  return even * (1 - ring) + edge * ring;
}

// 重ねたときに真っ白にならないための、泡1粒のこさ。count 粒を半径 radius(m)に、大きさ size(m)で散らす
export function foamAlpha(count, radius, size, max = 0.6) {
  const cover = (count * size * size) / (Math.PI * radius * radius);   // 平均して何枚重なるか
  return Math.min(max, 1.3 / Math.max(cover, 0.01));
}
