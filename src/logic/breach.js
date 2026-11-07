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

// 大ジャンプ(体全体が水から出る): 調べてわかったこと(記録計の研究)
//   ・ジャンプで水から出る体の割合は26〜100%。いちばん速い飛び出しは秒速約9m
//   ・体がまるごと出るジャンプでは、いちばん高いところで体がほぼ横になり、尾びれまで空中に出る
// peak: 体の中心のいちばん高いところ(m)。ふつうのジャンプは約0.6m(体の半分以上が出る)
export const FULL_BREACH = Object.freeze({ peak: 4.2, pitchFrom: 80, pitchTo: -30, roll: 95 });

// 飛び出してから L 秒目の姿勢。k は体の大きさ(おとなを1)。full は大ジャンプ(体全体が水から出る)。
// y は体の中心の高さ(m)、pitch は頭の上がり(度)、roll は横への倒れ(度)、along は前へ進んだ距離(m)
export function breachPose(L, k = 1, full = false) {
  let y, pitch, roll;
  if (L < 0) { y = -12; pitch = 20; roll = 0; }
  else if (L < BREACH.air) {
    const u = L / BREACH.air;
    if (full) {
      // 勢いよく飛び出し、いちばん高いところで体がほぼ横になって、尾びれまで空中に出る。背中から倒れこむ
      const a = 4 * (FULL_BREACH.peak + 8);
      y = -8 + a * u - a * u * u;
      pitch = lerp(FULL_BREACH.pitchFrom, FULL_BREACH.pitchTo, u ** 0.8);
      roll = lerp(0, FULL_BREACH.roll, u ** 1.2);
    } else {
      // 体を立てて飛び出し、いちばん高いところで体の半分以上が水から出る
      y = -8 + 34.4 * u - 34.4 * u * u;
      pitch = lerp(75, -10, u ** 1.6);
      roll = lerp(0, 80, u);
    }
  } else { y = -8 - ease((L - BREACH.air) / 6) * 6; pitch = full ? FULL_BREACH.pitchTo : -10; roll = full ? FULL_BREACH.roll : 80; }
  const along = L < 0 ? Math.max(0, L + BREACH.approach) * 0.3 : 2.4 + Math.min(L, 6) * 1.2;
  // 子クジラは体のわりに高く跳ぶ(高さは体の大きさの平方根に合わせる。そのぶん、落ちてくる速さもあまり落ちない)
  const h = Math.sqrt(k);
  return { y: y * h, pitch, roll, along: along * k };
}

// 群れでジャンプ: 2〜5頭が、0.3〜0.8秒ずつずれて次々に跳ぶ。跳び方は2とおり:
//   same(同じ向き): みんな同じ向きに泳いで、ならんで跳ぶ。倒れる向きもそろう
//   alternate(互い違い): となりどうしが反対の向きに跳ぶ。2列にならび、すれちがうように跳ぶ(ぶつからない)
// along は進む向きのずれ、side は横のずれ(m)、facing は向き(1 で前、-1 で反対)、
// launch は飛び出す時刻(秒)、rollSign は倒れる向き
export const GROUP_BREACH = Object.freeze({ whales: [2, 5], gap: [0.3, 0.8], spacing: 7, rowGap: 9, fullChance: 0.4 });

export function groupBreachPlan(rng = Math.random) {
  const [lo, hi] = GROUP_BREACH.whales;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const style = rng() < 0.5 ? 'same' : 'alternate';
  const roll = rng() < 0.5 ? 1 : -1;
  // 5頭でも画面からはみださないよう、頭数が多いほど少しつめる
  const spacing = GROUP_BREACH.spacing * (n >= 5 ? 0.85 : 1);
  const plan = [];
  for (let i = 0; i < n; i++) {
    const c = i - (n - 1) / 2;
    if (style === 'same') {
      // 横にならび(奥行きの方向)、少しずつ前後にずれる
      plan.push({ side: c * spacing + (rng() - 0.5) * 1.5, along: (rng() - 0.5) * 4, facing: 1, rollSign: roll, launch: 0, full: false });
    } else {
      // となりどうしが反対向き。向きごとに列を分けて、すれちがう
      const facing = i % 2 === 0 ? 1 : -1;
      plan.push({ side: facing * GROUP_BREACH.rowGap / 2 + (rng() - 0.5) * 1.2, along: c * spacing * 0.9, facing, rollSign: facing * roll, launch: 0, full: false });
    }
  }
  // 何頭かは、体全体が出る大ジャンプ
  for (const w of plan) w.full = rng() < GROUP_BREACH.fullChance;
  // 大ジャンプは空中で体がほぼ横になり、前後に長くのびる。同じ列で前後にならぶ2頭がどちらも大ジャンプだと
  // ぶつかるので、そのときは片方をふつうのジャンプにする
  for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) {
    const a = plan[i], b = plan[j];
    if (a.full && b.full && Math.abs(a.side - b.side) < 3 && Math.abs(a.along - b.along) < 15) b.full = false;
  }
  const order = plan.map((_, i) => i).sort(() => rng() - 0.5);
  let t = BREACH.approach;
  for (const i of order) { plan[i].launch = t; t += GROUP_BREACH.gap[0] + rng() * (GROUP_BREACH.gap[1] - GROUP_BREACH.gap[0]); }
  plan.style = style;
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

// 群れでスパイホップ: 3〜4頭がまとまって、0.4〜1.2秒ずつずれて頭を出す。
// 頭を出す高さも、見回す向きも、1頭ずつちがう。offset は群れのまん中からの [x, z](m)
export function groupSpyhopPlan(rng = Math.random) {
  const n = 3 + (rng() < 0.5 ? 1 : 0);
  // 頭どうしがぶつからない間隔(7m以上)
  const spots = (n === 3 ? [[-6, 1], [0, -3], [6, 1]] : [[-7.5, 2], [-2.5, -3], [2.5, 2.5], [7.5, -2]]).map(([x, z]) => [x * 1.25, z * 1.25]);
  const order = spots.map((_, i) => i).sort(() => rng() - 0.5);
  // 見回すタイミングは、1頭ずつ確実にちがうように均等に分けてから、少しずらす
  const g = spots.map(([x, z], i) => ({
    offset: [x + (rng() - 0.5) * 1.2, z + (rng() - 0.5) * 1.2],
    headOut: 3 + rng() * 1.3,
    lookPhase: (i / n) * Math.PI * 2 + rng() * 0.6,
    delay: 0,
  }));
  let d = 0;
  for (const i of order) { g[i].delay = d; d += 0.4 + rng() * 0.8; }
  return g;
}
