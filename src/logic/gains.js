import { AUDIO } from './config.js';

// 波の音の目標音量。音量を0〜1に収める。
export function waveTargetGain(volume) {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(1, Math.max(0, volume));
}

// クジラの音の目標音量。おやすみモードでは0、ふつうモードでも波の音の0.8倍まで。
export function whaleTargetGain({ mode, volume }) {
  if (mode === 'sleep') return 0;
  return waveTargetGain(volume) * AUDIO.whaleMaxRatio;
}

// クジラの音の、距離による小さくなり方。ブラウザの音の部品(PannerNode)の「inverse」と同じ式。
// refDistance より近いときは小さくしないので、近くても今の音量の上限より大きくはならない
export const AUDIO_DISTANCE = Object.freeze({ refDistance: 25, rolloffFactor: 1 });
export function whaleDistanceGain(distance) {
  const { refDistance: ref, rolloffFactor: k } = AUDIO_DISTANCE;
  return ref / (ref + k * (Math.max(distance, ref) - ref));
}
