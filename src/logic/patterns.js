// 出方ごとの長さ・必要なモデル・鳴らす声。
export const PATTERNS = Object.freeze({
  voice: { durationMs: 60000, needs: null, sound: 'humpback' },
  spout: { durationMs: 40000, needs: 'humpback', sound: null },
  fluke: { durationMs: 30000, needs: 'humpback', sound: null },
  motherCalf: { durationMs: 60000, needs: 'humpback', sound: null },
  sleeping: { durationMs: 90000, needs: 'sperm', sound: 'sperm' },
  breach: { durationMs: 25000, needs: 'humpback', sound: null },
  summon: { durationMs: 120000, needs: 'humpback', sound: 'humpback' },
});

// 必要なモデルが読めていなければ「鳴き声だけ」に置き換える。
export function resolvePattern(name, models) {
  const needs = PATTERNS[name]?.needs;
  if (!needs) return name in PATTERNS ? name : 'voice';
  return models[needs] ? name : 'voice';
}
