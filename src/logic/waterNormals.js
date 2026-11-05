// 海面の細かい凹凸を表す法線マップの画素を作る(外部の画像を読まずに済ませるため)。
// 整数の周波数の波だけを重ねるので、端と端が継ぎ目なくつながる。
export function waterNormalPixels(size = 256, rng = Math.random) {
  const waves = [];
  for (let i = 0; i < 24; i++) {
    let kx = 0, ky = 0;
    while (kx === 0 && ky === 0) {
      kx = Math.round(rng() * 16 - 8);
      ky = Math.round(rng() * 16 - 8);
    }
    const k = Math.hypot(kx, ky);
    waves.push({ kx, ky, amp: 1 / (k * k), phase: rng() * Math.PI * 2 });
  }

  const px = new Uint8ClampedArray(size * size * 4);
  const tau = (2 * Math.PI) / size;
  const strength = size / 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const c = Math.cos(tau * (w.kx * x + w.ky * y) + w.phase) * w.amp * tau * strength;
        dx += c * w.kx;
        dy += c * w.ky;
      }
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      px[i] = (-dx / len * 0.5 + 0.5) * 255;
      px[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      px[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      px[i + 3] = 255;
    }
  }
  return px;
}
