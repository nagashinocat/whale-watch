// 出方ごとの長さ・必要なモデル・鳴らす声。
export const PATTERNS = Object.freeze({
  voice: { durationMs: 60000, needs: null, sound: 'humpback' },
  spout: { durationMs: 40000, needs: 'humpback', sound: null },
  fluke: { durationMs: 30000, needs: 'humpback', sound: null },
  motherCalf: { durationMs: 60000, needs: 'humpback', sound: null },
  sleeping: { durationMs: 90000, needs: 'sperm', sound: 'sperm' },
  breach: { durationMs: 25000, needs: 'humpback', sound: null },
  // 呼んだクジラは近くに着いてから(songAtMs)歌い始める
  // スパイホップ: 体を縦にしてゆっくり上がり、頭だけを出してまわりを見回す
  spyhop: { durationMs: 32000, needs: 'humpback', sound: null },
  // 横に転がって、長い胸びれで水面をたたく
  pecSlap: { durationMs: 36000, needs: 'humpback', sound: null },
  // 尾びれを持ち上げて、水面に強く打ちつける
  lobtail: { durationMs: 32000, needs: 'humpback', sound: null },
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
  spyhop: 'スパイホップ(顔を出す)',
  pecSlap: '胸びれで水面をたたく',
  lobtail: '尾びれで水面をたたく',
  eyeContact: '目が合う(すぐ目の前)',
  summon: '呼んだクジラ',
});
