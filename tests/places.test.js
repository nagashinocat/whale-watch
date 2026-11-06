import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realSky } from '../src/logic/places.js';

const jst = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 9, min));

test('本物の空: 1月の慶良間の夕方は、夕日がほぼ正面(カメラは西南西を向いている)に沈む', () => {
  const s = realSky(jst(2026, 1, 15, 18, 0));
  assert.equal(s.rising, false);
  assert.ok(Math.abs(s.hours - 18) < 0.5, `hours ${s.hours}`);
  assert.ok(Math.abs(s.sunAzimuth - 180) < 15, `scene azimuth ${s.sunAzimuth}`);
  assert.ok(s.moon.illumination >= 0 && s.moon.illumination <= 1);
});

test('本物の空: 真夜中は夜の色、昼は昼の色の時刻になる', () => {
  assert.ok(realSky(jst(2026, 1, 15, 0)).hours < 3 || realSky(jst(2026, 1, 15, 0)).hours > 21);
  const noon = realSky(jst(2026, 1, 15, 12, 30)).hours;
  assert.ok(noon > 10 && noon < 14, `noon ${noon}`);
});
