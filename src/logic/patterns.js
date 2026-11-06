// 出方ごとの長さ・必要なモデル・鳴らす声。
export const PATTERNS = Object.freeze({
  voice: { durationMs: 60000, needs: null, sound: 'humpback' },
  spout: { durationMs: 40000, needs: 'humpback', sound: null },
  fluke: { durationMs: 30000, needs: 'humpback', sound: null },
  motherCalf: { durationMs: 60000, needs: 'humpback', sound: null },
  sleeping: { durationMs: 90000, needs: 'sperm', sound: 'sperm' },
  breach: { durationMs: 25000, needs: 'humpback', sound: null },
  // 呼んだクジラは近くに着いてから(songAtMs)歌い始める
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
