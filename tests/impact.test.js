import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impactSplash, whaleMass, PART_MASS, IMPACT } from '../src/logic/impact.js';

const adult = whaleMass(14);
const body = (mass, speed, L = 14) => impactSplash({ mass, speed, length: L, width: 0.23 * L });

test('ジャンプの着水: 秒速6〜9mで落ちる14mのクジラは、高さ4〜9mの水しぶき', () => {
  for (const v of [6, 7, 8, 9]) {
    const s = body(adult, v);
    assert.ok(s.crownHeight > 3.5 && s.crownHeight < 10, `${v} m/s → ${s.crownHeight}m`);
  }
});

test('しぶきの高さは速さで決まり(速さの2乗)、水の量は重さと速さ(勢い)で決まる', () => {
  const a = body(adult, 5), b = body(adult, 7.07);
  assert.ok(Math.abs(b.crownHeight / a.crownHeight - 2) < 0.05);
  // 同じ速さなら、重い大人のほうが粒(水の量)がずっと多い。高さは同じ
  const calf = body(whaleMass(5.6), 7, 5.6), big = body(adult, 7);
  assert.equal(calf.crownHeight, big.crownHeight);
  assert.ok(big.crown > calf.crown * 3, `${big.crown} ${calf.crown}`);
  assert.ok(big.foamRadius > calf.foamRadius && big.foamMs > calf.foamMs);
});

test('胸びれ・尾びれでたたくしぶきは、ジャンプの着水よりずっと小さい。水の柱はジャンプだけ', () => {
  const breach = body(adult, 7.5);
  const fin = impactSplash({ mass: adult * PART_MASS.fin, speed: 6, length: 4.3, width: 1.1, surface: 'fin' });
  const fluke = impactSplash({ mass: adult * PART_MASS.fluke, speed: 9, length: 4.6, width: 1.4, surface: 'fluke' });
  for (const s of [fin, fluke]) {
    assert.ok(s.crown < breach.crown * 0.6 && s.energy < breach.energy / 4);
    assert.equal(s.column, 0);
  }
  assert.ok(breach.column > 0 && breach.columnHeight < breach.crownHeight);
  // 速く打ちつける尾びれは、胸びれより高く飛ぶ
  assert.ok(fluke.crownHeight > fin.crownHeight);
});

test('粒の数には上限があり、高さにも上限がある', () => {
  const s = body(adult * 3, 30);
  assert.ok(s.crown + s.droplets + s.mist + s.column <= IMPACT.maxParticles + 2);
  assert.ok(s.crownHeight <= IMPACT.maxCrown);
});

test('落ちたところから広がる波の輪は、本物の波の速さ(秒速2〜6m)', () => {
  const s = body(adult, 7);
  assert.ok(s.waveSpeed > 2 && s.waveSpeed < 6, `${s.waveSpeed}`);
});
