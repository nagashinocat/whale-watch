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
