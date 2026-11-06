// 時刻ごとの空と海の色。キーの間はなめらかにつなぐ。
// zenith: 真上 / middle: 中ほど / horizon: 地平線 / water: 海の色 / light: 太陽や月の光の色
//
// 夕方の流れは実際の空の順番に合わせてある(太陽の高さは src/logic/sky.js)。
//   ゴールデンアワー(太陽が0〜6度): 低い日差しが金色になり、海に金色の光の道ができる
//   日の入り直後: 地平線がオレンジ、上空がピンクから薄紫に染まる
//   ブルーアワー(太陽が-4〜-8度): 上空のオゾンが赤い光を吸い、空全体が深い青になる
// 朝はこの逆の順番になる。

// 特別な時間(メニューの「ゴールデンアワー」「ブルーアワー」と「夕方」で使う時刻)
export const SKY_MOMENTS = Object.freeze({ golden: 17.75, sunset: 18.05, blue: 18.45 });

const NIGHT = { zenith: 0x050b1e, middle: 0x0a1632, horizon: 0x16264a, water: 0x000a16, light: 0x9fb0d8 };
const DAY = { zenith: 0x2557cc, middle: 0x2e74db, horizon: 0x90b6ef, water: 0x0a4f8a, light: 0xffffff };

export const SKY_KEYS = Object.freeze([
  { at: 4.6, ...NIGHT },
  { at: 5.2, zenith: 0x0f1a48, middle: 0x1c2c62, horizon: 0x3a3e6a, water: 0x0a1430, light: 0x7a88b8 },
  { at: 5.55, zenith: 0x1c2f78, middle: 0x3a56a0, horizon: 0x9a7f9a, water: 0x14244a, light: 0x6a80c0 },  // 朝のブルーアワー
  { at: 5.82, zenith: 0x5a4e9c, middle: 0xb06890, horizon: 0xe8806a, water: 0x3a2a4e, light: 0xd07890 },
  { at: 5.95, zenith: 0x6f78c0, middle: 0xe892a0, horizon: 0xffa868, water: 0x4a3a5e, light: 0xff9a68 },  // 朝焼け
  { at: 6.25, zenith: 0x4a6cc0, middle: 0xe8bc98, horizon: 0xffbc60, water: 0x2a3d5a, light: 0xffb45c },  // 朝のゴールデンアワー
  { at: 6.8, zenith: 0x3561c2, middle: 0x7a9ad6, horizon: 0xe8d4b8, water: 0x1a4a72, light: 0xffe6c4 },
  { at: 8.5, zenith: 0x2f62cf, middle: 0x5a8fe0, horizon: 0xb8d0f0, water: 0x0a4a80, light: 0xfff8ee },
  { at: 10, ...DAY },
  { at: 15, ...DAY },
  { at: 16.6, zenith: 0x2c5cc4, middle: 0x5a86d6, horizon: 0xd8cfc8, water: 0x154a78, light: 0xfff0d8 },
  { at: 17.35, zenith: 0x3561c2, middle: 0x7a96d0, horizon: 0xf0c890, water: 0x1f4a6e, light: 0xffd9a0 },
  { at: SKY_MOMENTS.golden, zenith: 0x4a62b8, middle: 0xe8b888, horizon: 0xffb45a, water: 0x2a3a5a, light: 0xffb060 },
  { at: SKY_MOMENTS.sunset, zenith: 0x8a7fc8, middle: 0xec7f9c, horizon: 0xf8a066, water: 0x5a3a5e, light: 0xff9070 },
  { at: 18.18, zenith: 0x5a4e9c, middle: 0xb06890, horizon: 0xe8806a, water: 0x3a2a4e, light: 0xd07890 }, // 残照
  { at: SKY_MOMENTS.blue, zenith: 0x1c2f78, middle: 0x3a56a0, horizon: 0x9a7f9a, water: 0x14244a, light: 0x6a80c0 },
  { at: 18.8, zenith: 0x0f1a48, middle: 0x1c2c62, horizon: 0x3a3e6a, water: 0x0a1430, light: 0x7a88b8 },
  { at: 19.3, ...NIGHT },
]);

const PARTS = ['zenith', 'middle', 'horizon', 'water', 'light'];

function mixHex(a, b, t) {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255, cb = (b >> shift) & 255;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

// 時刻(0〜24の小数)の空と海の色を返す。
export function skyPalette(hours) {
  const h = ((hours % 24) + 24) % 24;
  const keys = SKY_KEYS;
  let i = keys.findIndex(k => k.at > h) - 1;
  if (i === -2) i = keys.length - 1;     // 最後のキーより後(夜)
  const a = i === -1 ? keys[keys.length - 1] : keys[i];
  const b = i === -1 ? keys[0] : keys[(i + 1) % keys.length];
  const span = ((b.at - a.at) + 24) % 24 || 24;
  const t = ((((h - a.at) + 24) % 24) / span);
  const out = {};
  for (const k of PARTS) out[k] = mixHex(a[k], b[k], t);
  return out;
}
