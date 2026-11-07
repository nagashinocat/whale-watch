// 出方ごとの長さ・必要なモデル・鳴らす声。
export const PATTERNS = Object.freeze({
  voice: { durationMs: 60000, needs: null, sound: 'humpback' },
  spout: { durationMs: 40000, needs: 'humpback', sound: null },
  // 何回か潮を吹いてから、尾びれを上げて潜る(潮吹きの回数で長さが変わるので、いちばん長いときに合わせる)
  fluke: { durationMs: 88000, needs: 'humpback', sound: null },
  motherCalf: { durationMs: 60000, needs: 'humpback', sound: null },
  // 眠っているあいだは音を出さない(目をさますとカチカチ鳴く。音は動きの中で鳴らす)
  sleeping: { durationMs: 110000, needs: 'sperm', sound: null },
  breach: { durationMs: 25000, needs: 'humpback', sound: null },
  bigBreach: { durationMs: 25000, needs: 'humpback', sound: null },
  // 群れでスパイホップ: 3〜4頭がまとまって、少しずつずれて頭を出し、それぞれまわりを見回す
  groupSpyhop: { durationMs: 36000, needs: 'humpback', sound: null },
  // 群れでジャンプ: 2〜3頭がならんで、少しずつずれて跳ぶ
  groupBreach: { durationMs: 28000, needs: 'humpback', sound: null },
  // 親子でジャンプ: 子どもが何度も練習して跳び、最後は母親といっしょに跳ぶ
  calfBreach: { durationMs: 52000, needs: 'humpback', sound: null },
  // 群れで泳ぐ: 母親・子ども・付きそいのオスなどが、ばらばらに息をしながらゆっくり進む
  pod: { durationMs: 68000, needs: 'humpback', sound: null },
  // 呼んだクジラは近くに着いてから(songAtMs)歌い始める
  // スパイホップ: 体を縦にしてゆっくり上がり、頭だけを出してまわりを見回す
  spyhop: { durationMs: 32000, needs: 'humpback', sound: null },
  // 横に転がって、長い胸びれで水面をたたく
  pecSlap: { durationMs: 36000, needs: 'humpback', sound: null },
  // 尾びれを持ち上げて、水面に強く打ちつける
  lobtail: { durationMs: 32000, needs: 'humpback', sound: null },
  // 捕食: 泡の輪の中から口を開けて飛び出し、水ごとのみこむ。水をこし出して、潮吹きで終わる
  feeding: { durationMs: 90000, needs: 'humpback', sound: null },
  // バブルネット: 群れで泡の網を作り、いっしょに口を開けて飛び出す。そのあと1頭ずつ潜る
  bubbleNet: { durationMs: 90000, needs: 'humpback', sound: null },
  // 目が合う: 間近のカメラのすぐ前で頭を出し、目が画面いっぱいになる近さで、こちらをじっと見る
  eyeContact: { durationMs: 46000, needs: 'humpback', sound: null },
  summon: { durationMs: 120000, needs: 'humpback', sound: null, songAtMs: 40000 },
});

// 必要なモデルが読めていなければ「鳴き声だけ」に置き換える。
// summon がモデルなしで「鳴き声だけ」になる場合も、歌は voice の sound で届く。
export function resolvePattern(name, models) {
  const needs = PATTERNS[name]?.needs;
  if (!needs) return name in PATTERNS ? name : 'voice';
  return models[needs] ? name : 'voice';
}

// 「鳴き声だけ」のときの声を選ぶ。長い歌(humpback)と短い一声(humpback-call)をまぜて、
// 毎回ちがう聞こえ方にする。available は { 音の名前: 読み込めたか }。
export function voiceSound(rng, available) {
  const song = !!available.humpback, call = !!available['humpback-call'];
  if (song && call) return rng() < 0.4 ? 'humpback-call' : 'humpback';
  return call && !song ? 'humpback-call' : 'humpback';
}

// 出方の日本語の名前(動作確認ボタンに使う)
export const PATTERN_LABELS = Object.freeze({
  voice: '鳴き声だけ',
  spout: '潮吹きと背中',
  fluke: '尾びれを上げて潜る',
  motherCalf: '親子で泳ぐ',
  sleeping: '寝ているクジラ',
  breach: 'ジャンプ',
  bigBreach: '大ジャンプ(体全体が出る)',
  groupBreach: '群れでジャンプ',
  calfBreach: '親子でジャンプ',
  pod: '群れで泳ぐ',
  spyhop: 'スパイホップ(顔を出す)',
  groupSpyhop: '群れでスパイホップ',
  pecSlap: '胸びれで水面をたたく',
  lobtail: '尾びれで水面をたたく',
  feeding: '捕食(水ごとのみこむ)',
  bubbleNet: 'バブルネット(群れで捕食)',
  eyeContact: '目が合う(すぐ目の前)',
  summon: '呼んだクジラ',
});
