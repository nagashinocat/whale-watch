// 仕様で決まった数値と名前をまとめる場所。
// 調整したいときはここを変える。

export const MODES = ['sleep', 'normal'];

export const CAMERAS = ['sky', 'cliff', 'near'];

import { SKY_MOMENTS } from './skyPalette.js';

// 空の時間帯。auto は実際の時刻、それ以外はその時刻(時)に固定する。
// golden(ゴールデンアワー)と blue(ブルーアワー)は特別にきれいな時間
export const TIME_PRESETS = Object.freeze({
  auto: null,
  morning: 7,
  day: 12,
  evening: SKY_MOMENTS.sunset,
  night: 22,
  golden: SKY_MOMENTS.golden,
  blue: SKY_MOMENTS.blue,
});


export const DEFAULTS = Object.freeze({ mode: 'normal', camera: 'cliff', volume: 0.5, time: 'auto', hours: 12, interval: 'often', shutter: 'center', lang: 'auto', whisper: true, hydrophone: false, herald: false });

// 操作パネルを閉じても画面に残る、写真のボタンの場所(off は出さない)
export const SHUTTER_SPOTS = Object.freeze({
  left: { ja: '左下', en: 'Left' }, center: { ja: '真ん中', en: 'Center' }, right: { ja: '右下', en: 'Right' }, off: { ja: '出さない', en: 'Hide' },
});

// クジラが自然に来る間隔(分)。自分で選べる。前のクジラが帰ってから、min〜max 分のどこかで次が来る
export const INTERVALS = Object.freeze({
  often: Object.freeze({ label: { ja: 'よく来る', en: 'Often' }, min: 5, max: 15 }),
  more: Object.freeze({ label: { ja: '多め', en: 'More' }, min: 15, max: 45 }),
  normal: Object.freeze({ label: { ja: 'ふつう', en: 'Normal' }, min: 30, max: 90 }),
  rare: Object.freeze({ label: { ja: 'ときどき', en: 'Rarely' }, min: 60, max: 180 }),
});

// 出方のめずらしさ(1 よくある・2 ときどき・3 めったにない)。使い方ガイドの ★ と同じ(tools/make_guide.py)
export const RARITY = Object.freeze({
  voice: 1, spout: 1, fluke: 1, breach: 1,
  motherCalf: 2, sleeping: 2, pod: 2, bigBreach: 2, calfBreach: 2, spyhop: 2, pecSlap: 2, lobtail: 2,
  groupBreach: 3, groupSpyhop: 3, feeding: 3, bubbleNet: 3, eyeContact: 3, bubbleRing: 3,
});
// 待つ時間が長いほど、めずらしい出方が出やすくなる。fromMin 分まではいつもどおり、toMin 分で最大
// (★★ は tier2 倍、★★★ は tier3 倍)。その間は少しずつ増える
export const RARE_BOOST = Object.freeze({ fromMin: 10, toMin: 120, tier2: 2, tier3: 5 });

export const SCHEDULE = Object.freeze({
  minIntervalMs: 30 * 60 * 1000,
  maxIntervalMs: 90 * 60 * 1000,
  weights: Object.freeze({
    voice: 25,
    spout: 20,
    fluke: 15,
    motherCalf: 10,
    sleeping: 10,
    // ジャンプは見ごたえがあるが、多すぎると落ち着かないので少なめ
    breach: 12,
    // 体全体が水から出る大ジャンプ(ふつうのジャンプより少ない)
    bigBreach: 4,
    // 子育ての海でよく見られる群れ(母親・子ども・付きそい)と、子どものジャンプの練習
    pod: 10,
    calfBreach: 6,
    // 群れでならんで跳ぶのは、まれ
    groupBreach: 2,
    groupSpyhop: 3,
    // 近くで見ると迫力のある出方(ときどき)
    spyhop: 5,
    pecSlap: 5,
    lobtail: 5,
    // 間近のカメラのすぐ前まで来て、目が合う(めったにない)
    eyeContact: 3,
    // 泡の輪のあいさつ(人の近くで泡の輪を吹く。とてもめずらしい)
    bubbleRing: 1,
    // 捕食。沖縄の海は子育ての場所で、ザトウクジラはほとんど食べない(えさは夏に北の海で食べる)ので、ごくまれ
    feeding: 2,
    bubbleNet: 1,
  }),
});

export const SUMMON = Object.freeze({ minDelayMs: 10 * 1000, maxDelayMs: 30 * 1000 });

export const AUDIO = Object.freeze({ whaleMaxRatio: 0.8, fadeMs: 3000 });


export const STORAGE_KEY = 'whale-ocean-settings';
