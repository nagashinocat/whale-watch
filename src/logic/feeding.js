// ザトウクジラの捕食(突進して水ごとのみこむ食べ方)の流れ。three.js は使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・泡の網: 群れの下で泡を出しながらぐるぐる回り、直径3〜30mの泡の輪で魚を囲いこむ。
//     1頭が「食べるぞ」という声を出すと、輪のまん中から口を開けて上へ突進する
//   ・突進の速さは秒速3〜4m。口を開けたあとも尾びれを強くあおいで進む
//   ・下あごは最大90度近くまで開き、上あごも持ち上がる(上下あわせて約80度)
//   ・のどの畝が広がり、まわりの長さは約2.6倍にふくらむ。体より大きいくらいの水を10秒もかからずにのみこむ
//   ・口を閉じたら、ひげ板のすきまから水を押し出して、えさだけをこし取る(約46秒)
//   ・そのあと、ふつうに息をして(潮吹き)、また潜る
//
// 時間は秒。tipY は口先の高さ(m、水面が0)

const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

export const FEEDING = Object.freeze({
  ringStart: 0,       // 泡の輪ができはじめる
  ringEnd: 9,         // 輪ができあがる
  call: 6,            // 「食べるぞ」の声
  lunge: 9,           // 下から突進しはじめる
  open: 11.5,         // 水の中で口を開けはじめる
  surface: 13.2,      // 水面を割る
  closeStart: 18.3,   // 口を閉じはじめる(水面で口を開けたまま、しばらく見せる)
  closed: 21,
  fall: 20,           // 立った体が沈みはじめる
  filterStart: 32,    // 水面に横になって、水をこし出しはじめる
  filterEnd: 78,
  blow: 79,           // 潮吹き
  end: 90,
  ringRadius: 5,      // 泡の輪の半径(m)
  lowerJaw: 68 * D2R, // 下あごの開き(体に対して。90度近くまで開くが、上あごも持ち上がるので少し控えめ)
  upperJaw: 12 * D2R, // 上あご(頭)の持ち上がり(頭の骨が首のところで少し反る)
});

const F = FEEDING;

// t 秒目の口・のど・体の高さ。
// gape: 口の開き(0〜1)、pouch: のどのふくらみ(0〜1)、tipY: 口先の高さ、pitch: 体の立ち方(度、90で真上)
export function feedingPose(t) {
  const gape = ease((t - F.open) / (F.surface + 0.6 - F.open)) * (1 - ease((t - F.closeStart) / (F.closed - F.closeStart)));
  const fill = ease((t - F.open) / 4);
  const pouch = fill * (1 - ease((t - F.filterStart) / (F.filterEnd - F.filterStart - 2)));
  // 下から突進して水面を割り、頭を5mほど出して止まり、それから沈む
  let tipY;
  const peak = F.surface + 1.8;
  if (t < F.lunge) tipY = -16;
  else if (t < peak) {
    const k = (t - F.lunge) / (peak - F.lunge);
    // だんだん速度を落としながら上がる(水面で秒速3mくらい)
    tipY = lerp(-16, 6.2, 1 - (1 - k) ** 2);
  } else if (t < F.fall) tipY = 6.2 - 0.6 * ease((t - peak) / (F.fall - peak));
  else tipY = lerp(5.6, -9, ease((t - F.fall) / 6));
  // 沈みながら体を横にして、水面に浮かんでくる
  const pitch = lerp(82, 0, ease((t - (F.fall + 4)) / 6));
  const float = ease((t - (F.fall + 8)) / 4);   // 0 で水の中、1 で水面に浮かぶ
  const dive = ease((t - (F.blow + 3)) / 6);    // 潮吹きのあと潜る
  return { gape, pouch, tipY, pitch, float, dive };
}

// ---- 群れのバブルネットフィーディング ----
// 調べてわかったこと
//   ・ふつうは5〜7頭がいっしょに飛び出す(10頭くらいの群れも、40頭の記録もある)
//   ・泡の輪は直径20mほど。輪ができるときは、泡が水面ではじける「シュワシュワ」という音がする
//   ・飛び出すのは8秒ほど。1頭ずつ少しずつずれて、次々に水面を割る
//   ・小魚があちこちへ跳ね、カモメが集まってくる
//   ・飛び出したあとは何回か潮を吹き、背中を丸めて1頭ずつ潜っていく
export const BUBBLE_NET = Object.freeze({
  whales: [5, 7],
  ringRadius: 10,
  surface: FEEDING.surface,
  filterEnd: 48,     // 群れのときは、こし出しを短くして、潜るところまで見せる
  firstDive: 58,
  diveGap: [2, 2.8],
  end: 90,
});

// 群れの1頭ずつ。offset は輪のまん中からの [x, z](m)、delay は飛び出すずれ(秒)、
// scale は体の大きさ、blows は潮吹きの時刻、dive は潜りはじめる時刻
export function bubbleNetGroup(rng = Math.random) {
  const [lo, hi] = BUBBLE_NET.whales;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const group = [];
  // まん中に1頭、まわりに輪のように並ぶ(口がぶつからない間隔)
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n - 1)) * Math.PI * 2 + rng() * 0.15;
    const r = i === 0 ? 0 : 4 + rng() * 1.2;
    group.push({ offset: [Math.cos(a) * r, Math.sin(a) * r], delay: 0, scale: 0.85 + rng() * 0.2 });
  }
  // 飛び出す順番はばらばらで、0.3〜0.7秒ずつずれる(全体で2〜3秒くらい)
  const lunge = group.map((_, i) => i).sort(() => rng() - 0.5);
  let d = 0;
  for (const i of lunge) { group[i].delay = d; d += 0.3 + rng() * 0.4; }
  let t = BUBBLE_NET.firstDive;
  const order = group.map((_, i) => i).sort(() => rng() - 0.5);
  for (const i of order) {
    group[i].dive = t;
    const b1 = 32 + rng() * 4;
    group[i].blows = [b1, b1 + 9 + rng() * 2, Math.min(t - 3, b1 + 18 + rng() * 2)].filter((b, k, a) => b < t - 2 && (k === 0 || b - a[k - 1] > 4));
    t += BUBBLE_NET.diveGap[0] + rng() * (BUBBLE_NET.diveGap[1] - BUBBLE_NET.diveGap[0]);
  }
  return group;
}
