import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveTargetGain, whaleTargetGain } from '../src/logic/gains.js';

test('おやすみモードではクジラの音は0', () => {
  assert.equal(whaleTargetGain({ mode: 'sleep', volume: 1 }), 0);
});

test('クジラの音は波の音の0.8倍まで', () => {
  for (const v of [0, 0.1, 0.5, 1]) {
    assert.ok(whaleTargetGain({ mode: 'normal', volume: v }) <= waveTargetGain(v) * 0.8 + 1e-9);
  }
});

test('範囲外の音量は0〜1に収める', () => {
  assert.equal(waveTargetGain(5), 1);
  assert.equal(waveTargetGain(-1), 0);
  assert.equal(waveTargetGain(NaN), 0);
  assert.ok(whaleTargetGain({ mode: 'normal', volume: 99 }) <= 0.8);
});

test('クジラの音は、遠いほど小さくなる。近くても今の上限より大きくはならない', async () => {
  const { whaleDistanceGain, AUDIO_DISTANCE } = await import('../src/logic/gains.js');
  assert.equal(whaleDistanceGain(5), 1);
  assert.equal(whaleDistanceGain(AUDIO_DISTANCE.refDistance), 1);
  assert.ok(whaleDistanceGain(80) < whaleDistanceGain(30));
  for (let d = 0; d < 500; d += 5) assert.ok(whaleDistanceGain(d) <= 1 && whaleDistanceGain(d + 5) <= whaleDistanceGain(d));
});

test('水の音は遠いほどくぐもる(近くは高い音まで、遠くは低い音だけ)', async () => {
  const { muffleFrequency } = await import('../src/audio/mixer.js');
  assert.ok(muffleFrequency(20) >= 15000);
  assert.ok(muffleFrequency(100) < muffleFrequency(40));
  assert.ok(muffleFrequency(5000) >= 900);
});
