// カメラから何が見えるかの計算。three.js は使わない(テストからも使う)。

const deg = d => (d * Math.PI) / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

// カメラ(縦長画面を想定)から点が画面内に見えるか。fov は縦の視野角(度)
export function isVisibleFrom(preset, point, aspect = 9 / 16) {
  const forward = norm(sub(preset.target, preset.position));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(point, preset.position);
  const z = dot(d, forward);
  if (z <= 0) return false;
  const halfV = Math.tan(deg(preset.fov) / 2);
  return Math.abs(dot(d, up) / z) <= halfV && Math.abs(dot(d, right) / z) <= halfV * aspect;
}

// クジラが動く範囲(m)。体の長さ14m(胸びれ・尾びれ込みで少し大きめ)、
// 左右に泳ぐ距離(片側10m)、親子の子の位置、ジャンプでいちばん高く上がるところ(約6.6m)と水しぶきを入れてある
export const WHALE_BOX = Object.freeze({ halfWidth: 21, halfDepth: 12, up: 7.5 });

// クジラが出る場所 spot のまわりの、動く範囲の角の点
export function boxCorners(spot, box = WHALE_BOX) {
  const out = [];
  for (const x of [-box.halfWidth, box.halfWidth]) {
    for (const y of [0, box.up]) {
      for (const z of [-box.halfDepth, box.halfDepth]) out.push([spot[0] + x, spot[1] + y, spot[2] + z]);
    }
  }
  return out;
}

// 高さ height のカメラが、targetDistance 先の海面を見ているとき、
// クジラの動く範囲がまるごと画面に入る、いちばん近い距離(m)
export function nearestFullView({ height, targetDistance, fov, aspect = 9 / 16, box = WHALE_BOX }) {
  const preset = { position: [0, height, 0], target: [0, 0, -targetDistance], fov };
  for (let d = 5; d < 2000; d += 0.25) {
    if (boxCorners([0, 0, -d], box).every(p => isVisibleFrom(preset, p, aspect))) return d;
  }
  return Infinity;
}
