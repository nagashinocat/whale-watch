// ジャンプ(ブリーチ)と、群れで泳ぐときの予定。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・ジャンプでは体の半分以上が水から出て、ふつうは高さ4.5m、ときには6m以上。横向きに倒れて着水する
//   ・子クジラはジャンプを何度もくり返して練習する(1歳くらいの子が90分で100回以上跳んだ記録もある)
//   ・2頭や3頭がならんで、鏡に映したように跳ぶことがある(まれ)。母親が子どもに教えているとも言われる
//   ・子育ての海では、母親と子どもに、オスが1頭付きそうことが多い。母親がペースを決め、
//     子どもはぴったりくっつき、付きそいはうしろからついて行く。ゆっくり泳ぐ
//   ・群れは、みんながいっしょではなく、ばらばらに浮かんで息をする

const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const BREACH = Object.freeze({
  air: 4,        // 飛び出してから着水するまで(秒)
  approach: 8,   // 飛び出す前に、深いところから勢いをつける時間(秒)
  splashAt: 0.82, // 着水の大しぶき(飛んでいる時間のうちの割合)
});

// 飛び出してから L 秒目の姿勢。k は体の大きさ(おとなを1)。
// y は体の中心の高さ(m)、pitch は頭の上がり(度)、roll は横への倒れ(度)、along は前へ進んだ距離(m)
export function breachPose(L, k = 1) {
  let y, pitch, roll;
  if (L < 0) { y = -12; pitch = 20; roll = 0; }
  else if (L < BREACH.air) {
    // 体を立てて飛び出し、いちばん高いところで体の半分以上が水から出る
    const u = L / BREACH.air;
    y = -8 + 34.4 * u - 34.4 * u * u;
    pitch = lerp(75, -10, u ** 1.6);
    roll = lerp(0, 80, u);
  } else { y = -8 - ease((L - BREACH.air) / 6) * 6; pitch = -10; roll = 80; }
  const along = L < 0 ? Math.max(0, L + BREACH.approach) * 0.3 : 2.4 + Math.min(L, 6) * 1.2;
  return { y: y * k, pitch, roll, along: along * k };
}

// 群れでジャンプ: 2〜3頭が横にならび、0.3〜0.8秒ずつずれて跳ぶ。外側の2頭は鏡に映したように反対へ倒れる。
// side は横の位置(m)、launch は飛び出す時刻(秒)、rollSign は倒れる向き
export function groupBreachPlan(rng = Math.random) {
  const n = 2 + (rng() < 0.5 ? 1 : 0);
  const sides = n === 2 ? [-5.5, 5.5] : [-10, 0, 10];
  const order = sides.map((_, i) => i).sort(() => rng() - 0.5);
  const plan = sides.map(side => ({ side: side + (rng() - 0.5) * 2, launch: 0, rollSign: side < 0 ? -1 : 1 }));
  let t = BREACH.approach;
  for (const i of order) { plan[i].launch = t; t += 0.3 + rng() * 0.5; }
  return plan;
}

// 親子でジャンプ: 子どもが9秒ごとに何度も跳び、最後は母親とならんで跳ぶ
export function calfBreachPlan() {
  return { calf: [7, 16, 25, 34], mother: 34.4, motherBlows: [5, 16] };
}

// 群れで泳ぐ
export const POD = Object.freeze({ speed: 0.9 });

// 群れのなかま。role は mother(母親)・calf(子ども)・escort(付きそいのオス)・adult(ほかのおとな)。
// offset は群れの先頭からの [横(右が+), うしろ(+)](m)。blows は息をする時刻、dive は尾びれを上げて潜る時刻
export function podPlan(rng = Math.random) {
  const extra = Math.floor(rng() * 3);   // 0〜2頭
  const g = [
    { role: 'mother', offset: [0, 0], scale: 1, period: 16, first: 5 },
    { role: 'calf', offset: [3.5, 2], scale: 0.4, period: 8, first: 3.5 },
    { role: 'escort', offset: [-2, 14], scale: 1.05, period: 14, first: 8.3 },
  ];
  for (let k = 0; k < extra; k++) {
    g.push({ role: 'adult', offset: [k === 0 ? 9 : -9, 6 + rng() * 6], scale: 0.9 + rng() * 0.15, period: 13 + rng() * 4, first: 10.5 + k * 2.4 + rng() * 1.5 });
  }
  // 潜る順番: 母親(と子ども)、付きそい、ほかのおとな
  let d = 44;
  for (const w of g) {
    if (w.role === 'calf') continue;
    w.dive = d; d += 2.6 + rng() * 1.2;
  }
  const mom = g[0];
  g[1].dive = mom.dive + 0.8;
  for (const w of g) {
    w.blows = [];
    for (let t = w.first; t < w.dive - 4; t += w.period) w.blows.push(t);
  }
  return g;
}
