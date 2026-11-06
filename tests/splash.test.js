import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPLASH, splashParticles, apexHeight } from '../src/logic/splash.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const byPart = (list, part) => list.filter(p => p.part === part);

test('大きな水しぶきは、王冠のような水の膜・水滴・細かいしぶきの3つでできている', () => {
  const list = splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(3));
  for (const part of ['crown', 'droplets', 'mist']) assert.ok(byPart(list, part).length > 50, part);
});

test('水の膜は、クジラが落ちたところのまわりから、輪になって持ち上がる', () => {
  const crown = byPart(splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(5)), 'crown');
  for (const p of crown) {
    // 外向きに広がりながら上がる
    const outward = p.p[0] * p.v[0] + p.p[2] * p.v[2];
    assert.ok(outward > 0, 'spreads outward');
    assert.ok(p.v[1] > 0, 'rises');
  }
  // クジラの体に沿って細長い(進む向き = x のほうに長い)
  const along = Math.max(...crown.map(p => Math.abs(p.p[0])));
  const across = Math.max(...crown.map(p => Math.abs(p.p[2])));
  assert.ok(along > across * 1.8, `along ${along} across ${across}`);
});

test('水の膜は決めた高さまで上がり、そのあと水滴になって落ちてくる(水滴は膜より少しあと)', () => {
  const list = splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(7));
  const crownTop = Math.max(...byPart(list, 'crown').map(p => apexHeight(p)));
  assert.ok(Math.abs(crownTop - SPLASH.large.crownHeight) < SPLASH.large.crownHeight * 0.15, `crown ${crownTop}`);
  const crownDelay = Math.min(...byPart(list, 'crown').map(p => p.delay));
  const dropDelay = Math.min(...byPart(list, 'droplets').map(p => p.delay));
  assert.ok(dropDelay > crownDelay, 'droplets come after the crown');
});

test('細かいしぶきは、水滴より長くただよう', () => {
  const list = splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(9));
  const avg = (part, k) => byPart(list, part).reduce((a, p) => a + p[k], 0) / byPart(list, part).length;
  assert.ok(avg('mist', 'life') > avg('droplets', 'life') * 1.5);
  assert.ok(avg('mist', 'gravity') < avg('droplets', 'gravity'));
});

test('尾びれの小さな水しぶきは、ジャンプの水しぶきよりずっと小さい', () => {
  assert.ok(SPLASH.small.crownHeight < SPLASH.large.crownHeight / 2);
  const small = splashParticles('small', [0, 0, 0], [1, 0, 0], seeded(11));
  const large = splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(11));
  assert.ok(small.length < large.length / 2);
});

test('粒の数は、画面に出せる数の上限におさまる', () => {
  assert.ok(splashParticles('large', [0, 0, 0], [1, 0, 0], seeded(13)).length <= 2600);
});
