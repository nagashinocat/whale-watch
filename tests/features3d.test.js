import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARNACLE, barnacleShape, buildFeatures } from '../src/logic/features3d.js';
import { buildWhaleGeometry, jawWeights } from '../src/logic/whaleShape.js';
import { population } from '../src/logic/flukeId.js';

const g = buildWhaleGeometry('humpback');
const L = 14;
const find = (key, v) => population().find(i => i.traits[key] === v);
const plain = population().find(i => i.traits.barnacles === 'normal' && i.traits.scars === 'normal' && i.traits.coat !== 'white');

test('フジツボは本物の大きさ(高さ5cm・直径6cmまで)で、六角形の王冠の形。上に口があいている', () => {
  assert.ok(BARNACLE.diameter[1] <= 0.065 && BARNACLE.height[1] <= 0.055);
  const s = barnacleShape();
  const ys = [];
  for (let k = 1; k < s.positions.length; k += 3) ys.push(s.positions[k]);
  const rimTop = Math.max(...ys);
  assert.ok(rimTop > 0.7, 'tall rim');
  // まん中(口)は、ふちより低い
  assert.ok(s.positions[s.center * 3 + 1] < rimTop - 0.3);
  assert.equal(s.sides, 6);
});

test('ふつうのおとなにも、あごの先に少しフジツボがある。フジツボの多い子は、胸びれや尾びれの先にもたくさん', () => {
  const few = buildFeatures(g, plain);
  const many = buildFeatures(g, find('barnacles', 'many'));
  assert.ok(few.barnacles >= 10 && few.barnacles <= 60, `${few.barnacles}`);
  assert.ok(many.barnacles >= few.barnacles * 3, `${many.barnacles}`);
  assert.ok(many.regions.fin > 0 && many.regions.fluke > 0 && few.regions.fin === 0);
  // 子クジラ(名前のないクジラ)には付けない
  assert.equal(buildFeatures(g, null).barnacles, 0);
});

test('あごの先のフジツボは、口を開けると下あごといっしょに動く', () => {
  const f = buildFeatures(g, plain);
  const chin = f.placed.filter(p => p.region === 'chin');
  assert.ok(chin.length > 5);
  assert.ok(chin.filter(p => p.jaw[0] > 0.9).length >= chin.length * 0.5);
});

test('フジツボは体の表面に付いている(浮いていない・めりこんでいない)', () => {
  const f = buildFeatures(g, find('barnacles', 'many'));
  for (const p of f.placed) {
    const k = p.host;
    const d = Math.hypot(p.pos[0] - g.positions[k * 3], p.pos[1] - g.positions[k * 3 + 1], p.pos[2] - g.positions[k * 3 + 2]) * L;
    assert.ok(d < 0.01, `${p.region} ${d}`);
  }
});

test('スクリューの傷は、背中に盛り上がった平行な線(形がある)。傷のない子にはない', () => {
  const ind = find('scars', 'propeller');
  const f = buildFeatures(g, ind);
  assert.ok(f.ribbons.propeller >= 3, `${f.ribbons.propeller}`);
  assert.ok(f.raise.propeller >= 0.01 && f.raise.propeller <= 0.03);
  assert.equal(buildFeatures(g, plain).ribbons.propeller, 0);
});

test('尾びれのシャチの歯のあとも、尾びれの裏に盛り上がった線として付く', () => {
  const ind = population().find(i => i.scars.some(s => s.type === 'rake') && i.traits.coat !== 'white');
  const f = buildFeatures(g, ind);
  assert.ok(f.ribbons.fluke >= 3);
  assert.ok(f.flukeSideOk, 'on the underside');
});

test('部品はすべて体のしなり・あごの動きの重みを持ち、数字がこわれていない', () => {
  const f = buildFeatures(g, find('barnacles', 'many'));
  assert.equal(f.jaw.length / 4, f.positions.length / 3);
  assert.equal(f.colors.length, f.positions.length);
  for (const v of f.positions) assert.ok(Number.isFinite(v));
  assert.ok(Math.max(...f.indices) < f.positions.length / 3);
});

test('目のまわり(目の部品のところ)には付けない', async () => {
  const { eyeHole } = await import('../src/logic/whaleShape.js');
  const f = buildFeatures(g, find('barnacles', 'many'));
  for (const p of f.placed.filter(p => p.uv)) assert.equal(eyeHole('humpback', p.uv[0], p.uv[1]), false);
  assert.ok(jawWeights('humpback', 0.05, Math.PI)[0] > 0.9);
});
