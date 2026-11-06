import { flukeOutline } from '../logic/whaleShape.js';
import { flukeWhiteness } from '../logic/flukeId.js';
import { flukeBite } from '../logic/traits.js';

// 図鑑の尾びれの絵。潜るときに後ろから見た尾びれの裏(うしろのふちが上)を描く。
// 3Dの尾びれと同じ模様の式を使う
export function drawFluke(canvas, ind) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const s = (px + 0.5) / w * 2 - 1;
      const a = Math.abs(s);
      const o = flukeOutline('humpback', Math.min(1, a));
      // 縦の位置: 上がうしろのふち(0.5)、下が前のふち(0.405)
      const z = 0.5 - ((py + 0.5) / h) * (0.5 - 0.405);
      const k = (py * w + px) * 4;
      // うしろのふちの欠け(個性)
      const trailing = Math.max(o.leading + 0.003, o.trailing - flukeBite(ind, s));
      if (a > 1 || z > trailing || z < o.leading) { img.data[k + 3] = 0; continue; }
      const c = (z - o.leading) / Math.max(1e-6, trailing - o.leading);
      const white = flukeWhiteness(ind, s, c);
      const v = 0x16 + (0xe6 - 0x16) * white;
      img.data[k] = v; img.data[k + 1] = v + 2 * white; img.data[k + 2] = v + 4 * white; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
