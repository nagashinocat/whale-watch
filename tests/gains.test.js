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
