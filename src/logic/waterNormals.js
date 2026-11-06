// 海面の細かい凹凸を表す法線マップの画素を作る(外部の画像を読まずに済ませるため)。
//
// 本物の海の波は風の向きにそろっていて、長い波ほど高く、短い波ほど低い。
// そこで、風の向き(横方向)を中心に ±35度の範囲に向きをそろえた波を、
// 長い波ほど大きく重ねる。整数の周波数だけを使うので、端と端が継ぎ目なくつながる。
// 重ねる波の一覧。縦や横にぴったりそろった波は格子模様に見えるので入れない
export function waveSet(rng = Math.random) {
  const WIND = 12 * Math.PI / 180;                   // 風の向き(横から少し傾ける)
  const waves = [];
  while (waves.length < 48) {
    const k = 2 + rng() * 16;                        // 1枚の中に入る波の数(波長の逆数)
    const spreadAngle = (rng() * 2 - 1) * (35 * Math.PI / 180);
    const angle = WIND + spreadAngle;
    const kx = Math.round(k * Math.cos(angle));
    const ky = Math.round(k * Math.sin(angle));
    if (kx === 0 || ky === 0) continue;
    const len = Math.hypot(kx, ky);
    const spread = Math.cos(spreadAngle) ** 2;       // 風の向きに近い波ほど強い
    waves.push({ kx, ky, amp: spread * len ** -1.6, phase: rng() * Math.PI * 2 });
  }
  return waves;
}

export function waterNormalPixels(size = 256, rng = Math.random) {
  const waves = waveSet(rng);

  // まず各画素の傾きを計算し、あとで全体の傾きの大きさをそろえる
  const tau = (2 * Math.PI) / size;
  const dxs = new Float32Array(size * size);
  const dys = new Float32Array(size * size);
  let sum = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const c = Math.cos(tau * (w.kx * x + w.ky * y) + w.phase) * w.amp;
        dx += c * w.kx;
        dy += c * w.ky;
      }
      const i = y * size + x;
      dxs[i] = dx;
      dys[i] = dy;
      sum += dx * dx + dy * dy;
    }
  }
  const scale = 0.45 / Math.sqrt(sum / (size * size) || 1); // 傾きの大きさ(平均)

  const px = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const dx = dxs[i] * scale, dy = dys[i] * scale;
    const len = Math.hypot(dx, dy, 1);
    px[i * 4] = (-dx / len * 0.5 + 0.5) * 255;
    px[i * 4 + 1] = (-dy / len * 0.5 + 0.5) * 255;
    px[i * 4 + 2] = (1 / len * 0.5 + 0.5) * 255;
    px[i * 4 + 3] = 255;
  }
  return px;
}
