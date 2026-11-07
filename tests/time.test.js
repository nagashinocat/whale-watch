import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursFor, blendHours, hoursAtBar, clockOf, clampBarHours } from '../src/logic/time.js';
import { SKY_MOMENTS } from '../src/logic/skyPalette.js';

test('自動なら実際の時刻', () => {
  assert.equal(hoursFor('auto', new Date(2026, 10, 6, 3, 30)), 3.5);
});

test('時間帯を選ぶとその時刻に固定', () => {
  const d = new Date(2026, 10, 6, 3, 30);
  assert.equal(hoursFor('morning', d), 7);
  assert.equal(hoursFor('day', d), 12);
  assert.equal(hoursFor('evening', d), SKY_MOMENTS.sunset);
  assert.equal(hoursFor('golden', d), SKY_MOMENTS.golden);
  assert.equal(hoursFor('blue', d), SKY_MOMENTS.blue);
  assert.equal(hoursFor('night', d), 22);
});

test('知らない値なら自動と同じ', () => {
  assert.equal(hoursFor('midnight', new Date(2026, 10, 6, 9, 0)), 9);
});

test('切り替えは近い方向に移り変わる(0時をまたげる)', () => {
  assert.equal(blendHours(22, 7, 0), 22);
  assert.equal(blendHours(22, 7, 1), 7);
  assert.equal(blendHours(22, 7, 0.5), 2.5);
  assert.equal(blendHours(12, 17.5, 0.5), 14.75);
  for (let t = 0; t <= 1; t += 0.1) {
    const h = blendHours(23, 1, t);
    assert.ok(h >= 0 && h < 24);
  }
});

test('自動のときは秒まで反映する(空がなめらかに変わる)', () => {
  assert.equal(hoursFor('auto', new Date(2026, 10, 6, 18, 0, 36)), 18.01);
});

test('空の時間のバー: 左はしが朝5時、右はしが夜23時。15分きざみ', () => {
  assert.equal(hoursAtBar(0), 5);
  assert.equal(hoursAtBar(1), 23);
  assert.equal(hoursAtBar(0.5), 14);
  assert.equal(hoursAtBar(-1), 5);
  assert.equal(hoursAtBar(0.51) % 0.25, 0);
  assert.equal(clockOf(14.5), '14:30');
  assert.equal(clockOf(7), '7:00');
  assert.equal(clampBarHours(30), 23);
});
