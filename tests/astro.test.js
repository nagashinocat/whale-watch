import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, moonPosition, equivalentHours } from '../src/logic/astro.js';
import { sunForTime } from '../src/logic/sky.js';

// 日本時間で日時を作る
const jst = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 9, min));
const TOKYO = { lat: 35.68, lon: 139.77 };
const NAHA = { lat: 26.21, lon: 127.68 };

test('夏至の東京: 南中のときの太陽の高さは約78度', () => {
  // 太陽の高さ = 90 - (緯度 - 太陽の赤緯 23.4度)
  let best = -90;
  for (let min = 0; min < 24 * 60; min += 2) {
    best = Math.max(best, sunPosition(jst(2026, 6, 21, 0, min), TOKYO.lat, TOKYO.lon).elevation);
  }
  assert.ok(Math.abs(best - (90 - 35.68 + 23.44)) < 0.6, `max ${best}`);
});

test('春分の日の出は、ほぼ真東から昇る', () => {
  let prev = sunPosition(jst(2026, 3, 20, 4), TOKYO.lat, TOKYO.lon);
  for (let min = 4 * 60; min < 8 * 60; min += 1) {
    const now = sunPosition(jst(2026, 3, 20, 0, min), TOKYO.lat, TOKYO.lon);
    if (prev.elevation < 0 && now.elevation >= 0) {
      assert.ok(Math.abs(now.azimuth - 90) < 3, `azimuth ${now.azimuth}`);
      return;
    }
    prev = now;
  }
  assert.fail('no sunrise found');
});

test('1月の那覇: 日の入りは18時ごろ、西南西に沈む', () => {
  assert.ok(sunPosition(jst(2026, 1, 15, 17, 20), NAHA.lat, NAHA.lon).elevation > 0, 'still up at 17:20');
  assert.ok(sunPosition(jst(2026, 1, 15, 18, 40), NAHA.lat, NAHA.lon).elevation < 0, 'down by 18:40');
  const az = sunPosition(jst(2026, 1, 15, 18, 0), NAHA.lat, NAHA.lon).azimuth;
  assert.ok(az > 240 && az < 260, `azimuth ${az}`);
});

test('月の満ち欠け: 2026年3月3日(皆既月食)は満月、2月17日(金環日食)は新月', () => {
  const full = moonPosition(new Date(Date.UTC(2026, 2, 3, 11, 33)), TOKYO.lat, TOKYO.lon);
  assert.ok(full.illumination > 0.97, `full ${full.illumination}`);
  const fresh = moonPosition(new Date(Date.UTC(2026, 1, 17, 12, 0)), TOKYO.lat, TOKYO.lon);
  assert.ok(fresh.illumination < 0.03, `new ${fresh.illumination}`);
});

test('満月は、太陽のほぼ反対側にある', () => {
  const d = new Date(Date.UTC(2026, 2, 3, 11, 33));
  const m = moonPosition(d, TOKYO.lat, TOKYO.lon), s = sunPosition(d, TOKYO.lat, TOKYO.lon);
  const diff = Math.abs(((m.azimuth - s.azimuth + 720) % 360) - 180);
  assert.ok(diff < 15, `azimuth gap from opposite ${diff}`);
  assert.ok(m.elevation > -s.elevation - 8 && m.elevation < -s.elevation + 8, 'elevation opposite');
});

test('本物の太陽の高さを、空の色の時刻に直せる(夕方と朝を区別する)', () => {
  for (const el of [-30, -10, -6, -2, 0, 4, 20, 45]) {
    const pm = equivalentHours(el, false), am = equivalentHours(el, true);
    assert.ok(Math.abs(sunForTime(pm).elevation - el) < 1e-6 && pm >= 12, `pm ${el}`);
    assert.ok(Math.abs(sunForTime(am).elevation - el) < 1e-6 && am <= 12, `am ${el}`);
  }
});
