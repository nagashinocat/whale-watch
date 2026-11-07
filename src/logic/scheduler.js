import { SCHEDULE, SUMMON, INTERVALS } from './config.js';

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

// 来る間隔(ミリ秒の [最短, 最長])
function rangeOf(name) {
  const r = INTERVALS[name];
  return r ? [r.min * 60000, r.max * 60000] : [SCHEDULE.minIntervalMs, SCHEDULE.maxIntervalMs];
}

// クジラの出番係。いつ・どの出方で出すかだけを決め、描画や音には触らない。
// frequency: 来る間隔の選び方(INTERVALS の名前)。決めていなければ SCHEDULE の間隔
export function createScheduler({ now, rng = Math.random, intervalScale = 1, frequency = null }) {
  const weights = SCHEDULE.weights;
  let range = rangeOf(frequency);
  const nextInterval = () => between(rng, range[0], range[1]) * intervalScale;

  let busy = null;          // 'natural' | 'summon' | null
  let summonAt = null;      // 呼んだクジラの到着予定
  let summonPattern = null; // えらんで呼んだ出かた(プラス)。null ならふつうの「呼ぶ」
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
        const pattern = summonPattern;
        summonPattern = null;
        return pattern ? { kind: 'pick', pattern } : { kind: 'summon', pattern: 'summon' };
      }
      if (summonAt === null && !quiet && t >= s.nextAt) {
        busy = 'natural';
        prevPattern = pickPattern(prevPattern, rng, weights);
        return { kind: 'natural', pattern: prevPattern };
      }
      return null;
    },

    // pattern を渡すと、その出かたで来る(プラスの「えらんで呼ぶ」。delay は [最短, 最長] ミリ秒)
    summon(t, pattern = null, delay = null) {
      if (summonAt !== null || busy === 'summon') return false;
      const [lo, hi] = delay ?? [SUMMON.minDelayMs, SUMMON.maxDelayMs];
      summonAt = t + between(rng, lo, hi);
      summonPattern = pattern;
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

    // 来る間隔を変える。次に来るまでの時間も、新しい間隔で決めなおす
    setFrequency(name, t) {
      range = rangeOf(name);
      if (!busy) s.nextAt = t + nextInterval();
    },

    // 自然にクジラが来る予定の時刻(いまクジラがいる・呼んでいる・タイマーなどで来ないときは null)
    upcoming() {
      return busy || quiet || summonAt !== null ? null : s.nextAt;
    },

    isSummoning() {
      return summonAt !== null || busy === 'summon';
    },
  };
  return s;
}
