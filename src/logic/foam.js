// 白波(波の頭が崩れてできる白い泡)の模様の画素を作る。
// 上から見た海の白波は、風の向き(横方向)に細長く伸びて、ところどころにだけ立つ。
// 横と縦で細かさを変えた、端と端がつながるノイズを重ねて作る。

const smooth = t => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

// 格子の数 fx × fy で1周する、なめらかなノイズ
function periodicNoise(fx, fy, rng) {
  const grid = Array.from({ length: fx * fy }, () => rng());
  const at = (i, j) => grid[(((j % fy) + fy) % fy) * fx + (((i % fx) + fx) % fx)];
  return (u, v) => {
    const x = u * fx, y = v * fy;
    const i = Math.floor(x), j = Math.floor(y);
    const tx = smooth(x - i), ty = smooth(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export function foamPixels(size = 256, rng = Math.random) {
  // 横に長く、縦に細かい(風に沿って伸びる筋)
  const layers = [
    { n: periodicNoise(3, 12, rng), amp: 0.55 },
    { n: periodicNoise(6, 24, rng), amp: 0.3 },
    { n: periodicNoise(12, 48, rng), amp: 0.15 },
  ];
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let n = 0;
      for (const l of layers) n += l.n(u, v) * l.amp;
      const foam = smoothstep(0.58, 0.8, n);
      const i = (y * size + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = foam * 255;
      px[i + 3] = 255;
    }
  }
  return px;
}
