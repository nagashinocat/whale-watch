import { SCHEDULE, SUMMON } from './config.js';

const between = (rng, min, max) => min + rng() * (max - min);

// 重み付きで出方を選ぶ。直前と同じ出方なら選び直す。
export function pickPattern(prev, rng, weights = SCHEDULE.weights) {
  let entries = Object.entries(weights).filter(([name]) => name !== prev);
  // 出方が1種類しかないときは、同じ出方が続いてもよい
  if (entries.length === 0) entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [name, w] of entries) {
    r -= w;
    if (r < 0) return name;
  }
  return entries[entries.length - 1][0];
}

// クジラの出番係。いつ・どの出方で出すかだけを決め、描画や音には触らない。
export function createScheduler({ now, rng = Math.random, intervalScale = 1 }) {
  const weights = SCHEDULE.weights;
  const nextInterval = () =>
    between(rng, SCHEDULE.minIntervalMs, SCHEDULE.maxIntervalMs) * intervalScale;

  let busy = null;          // 'natural' | 'summon' | null
  let summonAt = null;      // 呼んだクジラの到着予定
  let pausedRemaining = 0;  // 呼んだクジラがいる間に止めた自然出現の残り時間
  let prevPattern = null;
  let quiet = false;        // タイマーのあいだは、自然には出さない(呼んだクジラは来る)

  const s = {
    nextAt: now + nextInterval(),

    tick(t) {
      if (busy) return null;
      if (summonAt !== null && t >= summonAt) {
        summonAt = null;
        busy = 'summon';
        pausedRemaining = Math.max(0, s.nextAt - t);
        return { kind: 'summon', pattern: 'summon' };
      }
      if (summonAt === null && !quiet && t >= s.nextAt) {
        busy = 'natural';
        prevPattern = pickPattern(prevPattern, rng, weights);
        return { kind: 'natural', pattern: prevPattern };
      }
      return null;
    },

    summon(t) {
      if (summonAt !== null || busy === 'summon') return false;
      summonAt = t + between(rng, SUMMON.minDelayMs, SUMMON.maxDelayMs);
      return true;
    },

    endEvent(t) {
      if (busy === 'summon') s.nextAt = t + pausedRemaining;
      else if (busy === 'natural') s.nextAt = t + nextInterval();
      busy = null;
    },

    // タイマーを決めているあいだは、自然にはクジラを出さない。
    // タイマーが終わったら、そこからまた30〜90分待つ(知らせのすぐあとに、別のクジラが来ないように)
    setQuiet(on, t) {
      if (quiet && !on) s.nextAt = Math.max(s.nextAt, t + nextInterval());
      quiet = on;
    },

    isSummoning() {
      return summonAt !== null || busy === 'summon';
    },
  };
  return s;
}
