// 海の上でのクジラのふるまいと見え方。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ザトウクジラの潮吹き: もこもこした形で、高さ 10〜16フィート(約3〜5m)。
//   マッコウクジラの潮吹き: 鼻の穴が頭の前の左寄りにあるので、左前に約45度かたむいて上がる。
//   潜るときの順番: 潮を吹く → 背中を丸めて、背中の上と背びれを見せる → 深く潜るときは尾びれを真上に立て、裏の模様を見せる。
//   足あと(フットプリント): 潜ったあとに残る、なめらかな楕円形の跡。尾びれの動きが細かいさざ波を消してできる。数分残る。

// height: 高さ(m) / spread: 横へのひろがり(m/秒) / tiltDeg: まっすぐ上からのかたむき / gravity: 粒子が落ちる速さ(m/秒²)
export const BLOW = Object.freeze({
  humpback: Object.freeze({ height: 4, spread: 1.6, tiltDeg: 0, gravity: 6 }),
  // マッコウクジラの高さは資料になかったので、控えめにしている
  sperm: Object.freeze({ height: 3, spread: 0.9, tiltDeg: 45, gravity: 6 }),
});

// 足あとの大きさ(m)と残る時間。大きさは資料になかったので、尾びれの幅(約4.6m)の数倍にしている
export const FOOTPRINT = Object.freeze({ lengthMeters: 12, widthMeters: 7, lastsMs: 3 * 60 * 1000 });

// 決めた高さ(まっすぐ上への高さ)まで噴き上がる、噴き出す向きの最初の速さ(m/秒)。
// 上向きの動きは重力だけで止まるので、上向きの速さは √(2 × 重力 × 高さ)
export function blowSpeed(kind) {
  const b = BLOW[kind];
  const vy = Math.sqrt(2 * b.gravity * b.height);
  return vy / Math.cos((b.tiltDeg * Math.PI) / 180);
}

// 潮吹きの向き。forward はクジラが向いている水平の向き
export function blowDirection(kind, forward) {
  const tilt = (BLOW[kind].tiltDeg * Math.PI) / 180;
  if (tilt === 0) return [0, 1, 0];
  const len = Math.hypot(forward[0], forward[2]) || 1;
  const fx = forward[0] / len, fz = forward[2] / len;
  const left = [fz, 0, -fx];
  // 左前(前と左のまん中)へ、まっすぐ上から tilt だけかたむける
  const h = [(fx + left[0]) / Math.SQRT2, 0, (fz + left[2]) / Math.SQRT2];
  return [h[0] * Math.sin(tilt), Math.cos(tilt), h[2] * Math.sin(tilt)];
}

// 尾びれを上げて潜るときの向き(度)。0 はカメラから遠ざかる向き。
// 遠ざかりながら尾びれを立てると、裏の模様がこちらを向く
export function divingYaw(rng) {
  return (rng() * 2 - 1) * 30;
}
