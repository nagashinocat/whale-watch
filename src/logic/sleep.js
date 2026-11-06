// マッコウクジラの眠り。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・マッコウクジラは5〜6頭の群れで、体を縦にして水面近くに浮かび、じっと眠る
//   ・頭は水面すれすれ(出ているか、少し下)。1回の眠りは15分くらい。眠っているあいだは音を出さない
//   ・夕方から夜中によく眠る(記録した時間の約7%)
//   ・強い刺激があると目をさます
// アプリでは15分を約1分半に縮めている。

export const SLEEP = Object.freeze({
  count: [5, 6],
  wakeTurn: 6,       // 縦から横になるまでの秒数
});

// 群れの並び。offset は群れのまん中からの [x, z](m)、scale は体の大きさ(おとなのオスを1)、
// top は頭のてっぺんの高さ(m)、wake は目をさます時刻(秒)
export function sleepingGroup(rng = Math.random) {
  const n = SLEEP.count[0] + Math.floor(rng() * (SLEEP.count[1] - SLEEP.count[0] + 1));
  const group = [];
  let tries = 0;
  while (group.length < n && tries < 500) {
    tries++;
    const a = rng() * Math.PI * 2, r = group.length === 0 ? 0 : 6 + rng() * 4;
    const offset = [Math.cos(a) * r, Math.sin(a) * r];
    if (group.some(g => Math.hypot(g.offset[0] - offset[0], g.offset[1] - offset[1]) < 6)) continue;
    // 群れはメスと子ども(おとなのメスは11mくらい、子どもはもっと小さい)
    const young = group.length === n - 1 && rng() < 0.6;
    group.push({
      offset,
      scale: young ? 0.45 + rng() * 0.1 : 0.7 + rng() * 0.08,
      top: -0.3 + rng() * 0.9,
      yaw: rng() * 360,
      wake: 66 + group.length * 3.2 + rng() * 1.5,
    });
  }
  return group;
}
