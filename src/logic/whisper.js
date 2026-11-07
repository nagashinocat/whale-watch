// 親子のささやき: おやすみモードのとき、ときどき、とても小さな親子の声が聞こえる。
// 水中マイク: 水の中で聞く音(波はこもり、クジラの声は近く、遠くの歌が聞こえることがある)。
// three.js も音のしくみも使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・ザトウクジラの子どもとお母さんは、シャチに聞かれないように、とても小さな声(ささやき)でやりとりする。
//     ふつうの声よりずっと小さく(およそ40デシベル小さい)、短い「うなり」や「キュッ」という音
//   ・研究者は水中マイクで歌を録って、群れや季節を調べている。水の中では、波の音の高い音は届きにくく、
//     クジラの歌は遠くまで届く

export const WHISPER = Object.freeze({
  everySec: [90, 240],      // つぎのささやきまで(秒)
  calls: [3, 6],            // 1回のささやきの声の数
  spanSec: [6, 12],         // ささやきが続く時間(秒)
  callSec: [0.25, 0.6],     // 1つの声の長さ(秒)
  rate: [0.7, 0.92],        // 少し低く、ゆっくり
  lowpassHz: 700,           // 高い音を弱めて、やわらかく
  level: 0.16,              // 波の音にくらべた大きさ(とても小さい)
  sourceSec: 8.5,           // もとにする一声の録音の長さ
});

export const HYDROPHONE = Object.freeze({
  waveLowpassHz: 380,       // 波の音のこもり方
  waveLevel: 0.55,          // 波の音の大きさの倍率
  whaleBoost: 1.6,          // クジラの声の大きさの倍率
  distantSongEverySec: [150, 360],   // 遠くの歌が聞こえる間隔(秒)
  distantSongGain: 0.35,
  distantSongSec: 40,
});

const between = (rng, [a, b]) => a + rng() * (b - a);

// 1回ぶんのささやき: 声ごとの { at(秒), offset(録音の何秒目), duration, rate, gain }
export function whisperBout(rng = Math.random) {
  const n = Math.round(between(rng, WHISPER.calls));
  const span = between(rng, WHISPER.spanSec);
  const out = [];
  for (let k = 0; k < n; k++) {
    const duration = between(rng, WHISPER.callSec);
    out.push({
      at: (k / n) * span + rng() * (span / n) * 0.6,
      offset: rng() * (WHISPER.sourceSec - duration),
      duration,
      rate: between(rng, WHISPER.rate),
      gain: 0.5 + 0.5 * rng(),
    });
  }
  return out;
}

export const nextWhisperSec = (rng = Math.random) => between(rng, WHISPER.everySec);
export const nextDistantSongSec = (rng = Math.random) => between(rng, HYDROPHONE.distantSongEverySec);
