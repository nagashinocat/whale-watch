// マッコウクジラの休み方と眠り。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・マッコウクジラは5〜6頭の群れで、体を縦にして水面近くに浮かび、じっと眠る
//   ・頭は水面すれすれ(出ているか、少し下)。眠っているあいだも、ときどき頭が水面に出る。
//     1回の眠りは15分くらい。眠っているあいだは音を出さない
//   ・水面で丸太のように横になって休むこともある(ロギング)。船からは丸太が浮かんでいるように見える
//   ・夕方から夜中によく眠る(記録した時間の約7%)
// アプリでは、横になって休む → 縦になって眠る → ひとりずつ目をさまして泳ぎ去る、を約2分に縮めている。

export const SLEEP = Object.freeze({
  count: [5, 6],
  logEnd: 24,        // 横になって休むのはここまで(秒)
  sleepAt: 30,       // ここまでに縦になる
  wakeTurn: 6,       // 縦から横になるまでの秒数
  bob: 0.45,         // 眠っているあいだに、頭がときどき出る高さ(m)
  slicks: [34, 56],  // 眠っている頭のまわりに、なめらかな水面ができる時刻
  ringRadius: 7,     // 群れの広がり(m)
});

// 群れの並び。offset は群れのまん中からの [x, z](m)、scale は体の大きさ(おとなのオスを1)、
// top は頭のてっぺんの高さ(m)、logBlows は横になって休んでいるときの潮吹き、wake は目をさます時刻(秒)
export function sleepingGroup(rng = Math.random) {
  const n = SLEEP.count[0] + Math.floor(rng() * (SLEEP.count[1] - SLEEP.count[0] + 1));
  const group = [];
  for (let i = 0; i < n; i++) {
    // まん中に1頭、まわりに輪のように(ぶつからない間隔で、まとまって)
    const a = (i / Math.max(1, n - 1)) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const r = i === 0 ? 0 : SLEEP.ringRadius + (rng() - 0.5) * 0.6;
    // 群れはメスと子ども(おとなのメスは11mくらい、子どもはもっと小さい)
    const young = i === n - 1 && rng() < 0.6;
    group.push({
      offset: [Math.cos(a) * r, Math.sin(a) * r],
      scale: young ? 0.45 + rng() * 0.1 : 0.7 + rng() * 0.08,
      top: -0.3 + rng() * 0.9,
      yaw: rng() * 360,
      bobPhase: rng() * 17,
      logBlows: [5 + i * 1.9 + rng(), 15 + i * 1.6 + rng()],
      wake: 74 + i * 3.2 + rng() * 1.5,
    });
  }
  return group;
}

// t 秒目の頭のてっぺんの、眠っているあいだの上下(ときどき水面に出る)
export function headBob(g, t) {
  const s = Math.sin((2 * Math.PI * (t + g.bobPhase)) / 17);
  return SLEEP.bob * Math.max(0, s) ** 2;
}
