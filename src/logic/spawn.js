// クジラの出現位置。three.js を使わずに計算する。

const deg = d => (d * Math.PI) / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

// カメラ(縦長画面を想定)から点が画面内に見えるか。
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

// どのカメラからも見える範囲で、ランダムな出現位置を返す。
export function spawnPosition(rng) {
  const z = -160 - rng() * 260;   // 160〜420m先。遠すぎると小さくて見つけられない
  const maxX = Math.abs(z) * Math.tan(deg(14));
  const x = (rng() * 2 - 1) * maxX;
  return [x, 0, z];
}
