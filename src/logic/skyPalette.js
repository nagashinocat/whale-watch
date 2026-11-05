// 時刻ごとの空と海の色。キーの間はなめらかにつなぐ。
// zenith: 真上 / middle: 中ほど / horizon: 地平線 / water: 海の色 / light: クジラを照らす光
const NIGHT = { zenith: 0x060c1f, middle: 0x0b1733, horizon: 0x182848, water: 0x000a14, light: 0x8899bb };
const DAY = { zenith: 0x2557cc, middle: 0x2e74db, horizon: 0x90b6ef, water: 0x0a4f8a, light: 0xffffff };

export const SKY_KEYS = Object.freeze([
  { at: 4.5, ...NIGHT },
  { at: 5.5, zenith: 0x1e2a5a, middle: 0x5a5a92, horizon: 0xb07878, water: 0x1a2238, light: 0xffb08a },  // 夜明け
  { at: 6.5, zenith: 0x4a6cc0, middle: 0xe6a0a8, horizon: 0xffc690, water: 0x2a3d5a, light: 0xffd2a8 },  // 日の出
  { at: 8, zenith: 0x2f62cf, middle: 0x5a8fe0, horizon: 0xc0d6f2, water: 0x0a4a80, light: 0xfff2e0 },    // 朝
  { at: 10, ...DAY },
  { at: 15, ...DAY },
  { at: 16.5, zenith: 0x2c5cc4, middle: 0x5a86d6, horizon: 0xd0c8d8, water: 0x154a78, light: 0xffe8cc }, // 傾いた日
  { at: 17.5, zenith: 0x8a7fc8, middle: 0xec7f9c, horizon: 0xf8a066, water: 0x5a3a5e, light: 0xffa070 }, // 夕焼け
  { at: 18.25, zenith: 0x4a4590, middle: 0xa8628e, horizon: 0xe07a6a, water: 0x2e2240, light: 0xc07890 }, // 日没後
  { at: 19, zenith: 0x1a1c4a, middle: 0x3e3266, horizon: 0x7a4c6a, water: 0x101428, light: 0x8a7aaa },  // 薄明
  { at: 20, ...NIGHT },
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
