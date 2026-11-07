import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIAL, SOLO_PATTERNS, specialChance, specialMotif, specialBodyColor, FIREWORK_BURSTS } from '../src/logic/specialCoats.js';
import { population, nextVisitor, bookTotal, individual } from '../src/logic/flukeId.js';
import { traitBodyColor, traitsText } from '../src/logic/traits.js';
import { commentFor } from '../src/logic/zukan.js';
import { SCHEDULE } from '../src/logic/config.js';
import { pickPattern } from '../src/logic/scheduler.js';

const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const lum = c => 0.3 * c[0] + 0.6 * c[1] + 0.1 * c[2];
const specials = () => population().filter(i => i.special);

test('とくべつな3頭: 銀河・彗星・花火。図鑑は24頭と合わせて27頭', () => {
  const s = specials();
  assert.deepEqual(s.map(i => i.traits.coat), ['galaxy', 'comet', 'fireworks']);
  assert.deepEqual(s.map(i => i.id), [25, 26, 27]);
  // 図鑑の分母は、ふつうの24頭に、会えたとくべつな子だけを足していく
  assert.equal(bookTotal(), 24);
  assert.equal(bookTotal([{ id: 3 }, { id: 25, special: true }]), 25);
  assert.equal(bookTotal(s.map(i => ({ ...i }))), 27);
  assert.deepEqual(s.map(i => i.name), ['ギンガ', 'ホウキボシ', 'ハナビ']);
  for (const i of s) {
    assert.equal(i.category, 5, '尾びれの裏も真っ黒');
    assert.ok(traitsText(i)[0].includes('真っ黒'));
    assert.ok(commentFor(i).includes('夜に会うと、模様だけが光る'));
    // ほかの個性(傷・フジツボ・背びれの形)はつけない
    assert.deepEqual([i.traits.scars, i.traits.barnacles, i.traits.dorsal, i.traits.fluke], ['normal', 'normal', 'normal', 'normal']);
  }
  assert.ok(population().filter(i => !i.special).every(i => !SPECIAL.coats.includes(i.traits.coat)));
});

// 体じゅうの点で、模様の光る点の割合と場所を調べる
function survey(coat) {
  const lit = [];
  let n = 0, dark = 0;
  for (let u = 0.01; u < 1; u += 0.01) for (let th = 0; th < 2 * Math.PI; th += 0.04) {
    n++;
    const m = specialMotif(coat, u, th);
    if (m.glow > 0.3) lit.push([u, th]);
    else if (lum(specialBodyColor(coat, u, th)) < 0.08) dark++;
  }
  return { lit, n, dark };
}

test('全身はほぼ真っ黒で、模様のところだけが色づいて光る', () => {
  for (const coat of SPECIAL.coats) {
    const { lit, n, dark } = survey(coat);
    assert.ok(dark / n > 0.6, `${coat}: 黒いところ ${(dark / n).toFixed(2)}`);
    assert.ok(lit.length / n > 0.01 && lit.length / n < 0.35, `${coat}: 光るところ ${(lit.length / n).toFixed(3)}`);
  }
  // おなかの白も、なくなる(ふつうのクジラのおなかは白い)
  const galaxy = specials()[0];
  assert.ok(lum(traitBodyColor(galaxy, 0.3, Math.PI, [0.9, 0.9, 0.9])) < 0.1);
});

test('銀河と彗星は左右両方のわき腹に、花火は体じゅうに', () => {
  const sides = lit => ({ right: lit.filter(([, t]) => t > 0.6 && t < 2.5).length, left: lit.filter(([, t]) => t > 3.8 && t < 5.7).length });
  for (const coat of ['galaxy', 'comet']) {
    const big = survey(coat).lit.filter(([u, t]) => specialMotif(coat, u, t).glow > 0.6);
    const s = sides(big);
    assert.ok(s.right > 10 && s.left > 10 && Math.abs(s.right - s.left) / (s.right + s.left) < 0.3, `${coat} ${JSON.stringify(s)}`);
  }
  const fw = survey('fireworks').lit;
  const s = sides(fw);
  assert.ok(s.right > 20 && s.left > 20);
  assert.ok(fw.some(([, t]) => t < 0.4 || t > 5.9), '背中にも');
  assert.ok(fw.some(([, t]) => Math.abs(t - Math.PI) < 0.4), 'おなかにも');
  assert.ok(Math.max(...fw.map(([u]) => u)) - Math.min(...fw.map(([u]) => u)) > 0.55, '頭のほうから尾のほうまで');
  assert.ok(FIREWORK_BURSTS.length >= 12);
});

test('目のまわりには模様をのせない(目は別の部品で作るので、光がずれない)', () => {
  for (const coat of SPECIAL.coats) for (const th of [1.6, 2 * Math.PI - 1.6]) assert.equal(specialMotif(coat, 0.285, th).glow, 0);
});

test('とくべつな子は、1頭で来る出かたのときだけ来る(群れ・親子では来ない)', () => {
  const ids = new Set(specials().map(i => i.id));
  const rng = seeded(3);
  let solo = 0, group = 0;
  for (let k = 0; k < 60000; k++) {
    if (ids.has(nextVisitor({}, rng, { solo: true }))) solo++;
    if (ids.has(nextVisitor({}, rng))) group++;
  }
  assert.equal(group, 0);
  const expect = 60000 * 3 * specialChance();
  assert.ok(Math.abs(solo - expect) < expect * 0.25, `${solo} / ${expect.toFixed(0)}`);
  // 1頭で来る出かたは、ほんとうに1頭(図鑑にのるおとなが1頭だけ)の出かた
  for (const n of ['pod', 'groupBreach', 'groupSpyhop', 'bubbleNet', 'motherCalf', 'calfBreach', 'voice', 'sleeping']) assert.ok(!SOLO_PATTERNS.includes(n));
});

test('図鑑にのったあとも、とくべつな子は「また来る」で来ない(ずっとまれなまま)', () => {
  const book = Object.fromEntries(specials().map(i => [i.id, { count: 1, first: 1, last: 1 }]));
  const rng = seeded(9);
  for (let k = 0; k < 5000; k++) assert.ok(!individual(nextVisitor(book, rng)).special);
});

test('出会い1000回に1回くらい、それぞれの子に会える(ふだんの出かたの割合で計算)', () => {
  // ふだんの出かたを選ぶのと同じ方法で、たくさん出会ってみる
  const ids = specials().map(i => i.id);
  const met = Object.fromEntries(ids.map(id => [id, 0]));
  const rng = seeded(21);
  let prev = null, encounters = 0;
  const N = 400000;
  for (let k = 0; k < N; k++) {
    prev = pickPattern(prev, rng, SCHEDULE.weights);
    if (prev === 'voice') continue;
    encounters++;
    if (!SOLO_PATTERNS.includes(prev)) continue;
    const id = nextVisitor({}, rng, { solo: true });
    if (id in met) met[id]++;
  }
  for (const id of ids) {
    const per = encounters / met[id];
    assert.ok(per > 700 && per < 1400, `${id}: ${per.toFixed(0)}回に1回`);
  }
});

test('ホウキボシの彗星は、頭のうしろから尾びれのつけ根まで大きくのびる(左右とも)', () => {
  for (const th of [Math.PI / 2, 1.5 * Math.PI]) {
    const lit = [];
    for (let u = 0.3; u < 1; u += 0.005) for (let d = -0.6; d <= 0.6; d += 0.02) if (specialMotif('comet', u, th + d).glow > 0.35) lit.push(u);
    assert.ok(Math.min(...lit) < 0.4, `はじまり ${Math.min(...lit)}`);
    assert.ok(Math.max(...lit) > 0.92, `おわり ${Math.max(...lit)}`);
  }
  // うしろのほうは、幅が広い(ちりの尾が広がる)
  const width = u => { let n = 0; for (let d = -1; d <= 1; d += 0.01) if (specialMotif('comet', u, Math.PI / 2 + d).glow > 0.2) n++; return n; };
  assert.ok(width(0.8) > width(0.45) * 1.5, `${width(0.45)} → ${width(0.8)}`);
});

test('銀河: まん中は黄色く、うでは青く、うでのふちにピンクの光', () => {
  const at = (u, th) => specialMotif('galaxy', u, th);
  const c = at(0.47, Math.PI / 2);
  assert.ok(c.glow > 1, 'まん中はまぶしい');
  let blue = 0, pink = 0;
  for (let u = 0.3; u < 0.65; u += 0.005) for (let th = 1; th < 2.2; th += 0.02) {
    const m = at(u, th);
    if (m.glow < 0.4 || m.glow > 1) continue;
    if (m.color[2] > m.color[0] + 0.15) blue++;
    if (m.color[0] > 0.8 && m.color[2] > 0.5 && m.color[1] < 0.6) pink++;
  }
  assert.ok(blue > 30 && pink > 5, `青 ${blue} ピンク ${pink}`);
});
