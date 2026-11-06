// 水の中に見えるクジラの色。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと: 水の中では赤い光がいちばん先に吸いこまれ、5mほどでほとんど見えなくなる。
// 青い光は50mでも届くので、深いものほど青く見える。
// ここでは、色ごとに光が半分ほどに弱まる深さ(m)を決めて、深さに合わせて色をうすめる。
// 海の濁りで見えなくなる深さ(visibleDepth)は、海面のゆらぎや映りこみもあるので、短めにしている。

export const UNDERWATER = Object.freeze({
  fade: Object.freeze([2.2, 7, 20]),   // 赤・緑・青が 1/e になる深さ(m)
  visibleDepth: 12,                    // これより深いと、ほとんど見えない
  wobble: 0.3,                         // 波のレンズで形がゆらぐ大きさ(m)
});

// 海面から見た水の中のクジラは、はっきりした姿ではなく、ぼやけた影に見える。
// 細かい模様は見えず、背中は海より暗いかげ、白い胸びれやおなかは水色にぼうっと光って見える。
// edge: ふちがぼやける幅(0〜1。大きいほど、ふちから広く消えていく)
// maxAlpha: いちばん濃い所の濃さ(1ならはっきりした影絵)
// contrast: 明るい所と暗い所の差がどれだけ残るか
export function shadowLook(depth) {
  const d = Math.max(0, depth);
  return {
    edge: Math.min(0.95, 0.35 + 0.6 * (1 - Math.exp(-d / 4))),
    maxAlpha: 0.55 * Math.exp(-d / (UNDERWATER.visibleDepth / 2.2)),
    contrast: 0.45 * Math.exp(-d / 5),
  };
}

// 色 [r, g, b](0〜1)の物が depth m の深さにあるとき、海面から見える色と、見える濃さ [r, g, b, a]
export function underwaterTint(color, depth) {
  const d = Math.max(0, depth);
  const [fr, fg, fb] = UNDERWATER.fade;
  const alpha = Math.exp(-d / (UNDERWATER.visibleDepth / 2.2));
  return [color[0] * Math.exp(-d / fr), color[1] * Math.exp(-d / fg), color[2] * Math.exp(-d / fb), alpha];
}
