import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelLayout, PART, MODEL, specialAssets } from '../src/logic/whaleModelLayout.js';

// 体長1の、かんたんなクジラ(体はだ円の輪のならび、右と左に胸びれ、うしろに尾びれ)
function toyWhale() {
  const pos = [], nrm = [];
  const put = (p, n) => { pos.push(...p); nrm.push(...n); };
  for (let k = 0; k <= 50; k++) {
    const u = k / 50, z = u - 0.5;
    const r = 0.1 * Math.sin(Math.PI * Math.min(0.98, u * 0.95 + 0.02));
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2;
      put([r * Math.sin(a), r * Math.cos(a), z], [Math.sin(a), Math.cos(a), 0]);
    }
  }
  // 胸びれ: u = 0.4 のあたりから、右下と左下へのびる板(上の面と下の面)
  for (const side of [1, -1]) for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    for (const up of [1, -1]) put([side * (0.11 + 0.2 * t), -0.03 - 0.06 * t + up * 0.004, -0.1 + 0.08 * t], [0, up, 0]);
  }
  // 尾びれ: u = 0.94 〜 1 で、左右に 0.15 ずつ広がる板
  for (let i = -10; i <= 10; i++) for (const zz of [0.44, 0.47, 0.5]) for (const up of [1, -1]) {
    const x = (i / 10) * 0.15;
    put([x, up * 0.003, zz + Math.abs(x) * 0.1 - 0.015], [0, up, 0]);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm) };
}

test('体・胸びれ・尾びれを見分ける', () => {
  const { pos, nrm } = toyWhale();
  const L = modelLayout(pos, nrm);
  const at = (x, y, z) => {
    let best = 0, d = Infinity;
    for (let i = 0; i < pos.length / 3; i++) {
      const e = (pos[i * 3] - x) ** 2 + (pos[i * 3 + 1] - y) ** 2 + (pos[i * 3 + 2] - z) ** 2;
      if (e < d) { d = e; best = i; }
    }
    return best;
  };
  assert.equal(L.part[at(0, 0.1, -0.1)], PART.body);           // 背中
  assert.equal(L.part[at(0.3, -0.09, -0.02)], PART.fin);       // 右の胸びれの先
  assert.equal(L.part[at(-0.3, -0.09, -0.02)], PART.fin);      // 左の胸びれの先
  assert.equal(L.part[at(0.15, 0.003, 0.5)], PART.fluke);      // 尾びれの右の先
});

test('体の場所(頭 0 〜 尾 1、背中 0 から右回りの角度)', () => {
  const { pos, nrm } = toyWhale();
  const L = modelLayout(pos, nrm);
  for (let i = 0; i < pos.length / 3; i++) {
    if (L.part[i] !== PART.body) continue;
    assert.ok(Math.abs(L.u[i] - (pos[i * 3 + 2] + 0.5)) < 1e-6);
    assert.ok(L.theta[i] >= 0 && L.theta[i] < Math.PI * 2 + 1e-6);
  }
  // 背中のまん中は 0 に近く、右のわき腹は π/2、おなかは π
  const find = (x, y) => [...Array(pos.length / 3).keys()].find(i => L.part[i] === PART.body && Math.abs(pos[i * 3 + 2] + 0.1) < 0.011 && Math.abs(pos[i * 3] - x) < 0.02 && Math.abs(pos[i * 3 + 1] - y) < 0.02);
  const right = find(0.098, 0), back = find(0, 0.098), belly = find(0, -0.098);
  assert.ok(Math.abs(L.theta[right] - Math.PI / 2) < 0.3);
  assert.ok(Math.min(L.theta[back], Math.PI * 2 - L.theta[back]) < 0.3);
  assert.ok(Math.abs(L.theta[belly] - Math.PI) < 0.3);
});

test('胸びれは、つけ根 0 〜 先 1。上の面と下の面がわかる', () => {
  const { pos, nrm } = toyWhale();
  const L = modelLayout(pos, nrm);
  const fins = [...Array(pos.length / 3).keys()].filter(i => L.part[i] === PART.fin);
  assert.ok(fins.length > 20);
  const tip = fins.reduce((a, b) => (Math.abs(pos[b * 3]) > Math.abs(pos[a * 3]) ? b : a));
  assert.ok(L.s[tip] > 0.9);
  for (const i of fins) {
    assert.ok(L.s[i] >= 0 && L.s[i] <= 1);
    assert.equal(L.top[i], nrm[i * 3 + 1] > 0 ? 1 : 0);
  }
});

test('尾びれは、左 -1 〜 右 1、前のふち 0 〜 うしろのふち 1。裏(おなか側)がわかる', () => {
  const { pos, nrm } = toyWhale();
  const L = modelLayout(pos, nrm);
  const fl = [...Array(pos.length / 3).keys()].filter(i => L.part[i] === PART.fluke && Math.abs(pos[i * 3]) > 0.03);
  assert.ok(fl.length > 20);
  for (const i of fl) {
    assert.ok(L.s[i] >= -1 && L.s[i] <= 1);
    assert.equal(Math.sign(L.s[i]), Math.sign(pos[i * 3]));
    assert.ok(L.c[i] >= 0 && L.c[i] <= 1);
    assert.equal(L.under[i], nrm[i * 3 + 1] < 0 ? 1 : 0);
  }
  const front = fl.find(i => Math.abs(pos[i * 3] - 0.075) < 0.01 && pos[i * 3 + 2] < 0.44);
  const back = fl.find(i => Math.abs(pos[i * 3] - 0.075) < 0.01 && pos[i * 3 + 2] > 0.49);
  assert.ok(L.c[front] < 0.2 && L.c[back] > 0.8);
});

test('モデルのファイルは assets/models/ にあり、とくべつな子は姿ごとの素材をもつ(彗星は体の上に重ねる部品)', () => {
  assert.match(MODEL.url, /^assets\/models\/.+\.glb$/);
  for (const coat of ['galaxy', 'fireworks']) {
    assert.match(specialAssets(coat, 'fantasy').texture, new RegExp(`special-${coat}-fantasy\\.jpg$`));
    assert.match(specialAssets(coat, 'cosmic').colors, new RegExp(`special-${coat}-cosmic\\.bin$`));
  }
  for (const style of ['fantasy', 'cosmic']) {
    const a = specialAssets('comet', style);
    assert.match(a.decor, new RegExp(`special-comet-${style}\\.glb$`));
    assert.equal(a.texture, undefined);
    assert.equal(a.colors, undefined);
  }
});

test('その子の色: ふつうの子の体はテクスチャのまま。真っ白な子・胸びれの表が黒い子・尾びれの裏は、その子の色になる', async () => {
  const { individualColors } = await import('../src/logic/whaleModelLayout.js');
  const { population } = await import('../src/logic/flukeId.js');
  const { pos, nrm } = toyWhale();
  const L = modelLayout(pos, nrm);
  const n = pos.length / 3;
  const lum = (c, i) => 0.2126 * c[i * 3] + 0.7152 * c[i * 3 + 1] + 0.0722 * c[i * 3 + 2];
  const plain = population().find(i => i.id === 11);   // シロ(体に個性はない)
  const a = individualColors(plain, L);
  const body = [...Array(n).keys()].filter(i => L.part[i] === PART.body && L.u[i] > 0.3 && L.u[i] < 0.6);
  assert.ok(body.every(i => a.mix[i] < 0.05), '体はテクスチャのまま');
  const under = [...Array(n).keys()].filter(i => L.part[i] === PART.fluke && L.under[i] && Math.abs(L.s[i]) > 0.1);
  assert.ok(under.length && under.every(i => a.mix[i] === 1), '尾びれの裏は、その子の模様');
  const white = population().find(i => i.traits.coat === 'white');
  const w = individualColors(white, L);
  assert.ok([...Array(n).keys()].every(i => w.mix[i] === 1 && lum(w.color, i) > 0.45), '真っ白な子は全身白い');
  const darkTop = population().find(i => i.traits.pec === 'darkTop');
  const d = individualColors(darkTop, L);
  const finTop = [...Array(n).keys()].filter(i => L.part[i] === PART.fin && L.top[i] && L.s[i] < 0.8);
  assert.ok(finTop.every(i => d.mix[i] > 0.5 && lum(d.color, i) < 0.05), '胸びれの表が黒い');
  for (let i = 0; i < n; i++) assert.ok(a.base[i] > 0);
});

test('目の場所: 左右それぞれ、頭の横の肌の上の点と、外向きの向き', async () => {
  const { eyeSpots } = await import('../src/logic/whaleModelLayout.js');
  const { pos, nrm } = toyWhale();
  const spots = eyeSpots(pos, nrm, { y: 0.03, z: -0.2 });
  assert.equal(spots.length, 2);
  for (const e of spots) {
    assert.equal(Math.sign(e.point[0]), e.side);
    assert.ok(Math.abs(e.point[2] + 0.2) < 0.02 && Math.abs(e.point[1] - 0.03) < 0.03);
    assert.ok(e.normal[0] * e.side > 0.5, '外を向いている');
    assert.ok(Math.abs(Math.hypot(...e.normal) - 1) < 1e-6);
  }
});

test('背びれと尾びれの形の個性: こぶは低く、かぎ形は先がうしろへ、欠けは先が平らに。尾びれの欠けは、うしろのふちが前へ', async () => {
  const { shapeForIndividual } = await import('../src/logic/whaleModelLayout.js');
  const { pos, nrm } = toyWhale();
  // 背びれ: u = 0.62〜0.70 の背中に、三角の板
  const fin = [];
  for (let k = 0; k <= 8; k++) for (let h = 0; h <= 4; h++) {
    const u = 0.62 + 0.08 * (k / 8), top = 0.1 * Math.sin(Math.PI * Math.min(0.98, u * 0.95 + 0.02));
    const height = 0.02 * Math.min(k / 6, 1) * (1 - Math.max(0, (k - 6) / 2)) * (h / 4);
    fin.push(0, top + height, u - 0.5);
  }
  const P = new Float32Array([...pos, ...fin]);
  const N = new Float32Array([...nrm, ...fin.map((_, i) => (i % 3 === 1 ? 1 : 0))]);
  const L = modelLayout(P, N);
  const n = P.length / 3, start = pos.length / 3;
  const finTop = p => Math.max(...[...Array(n - start).keys()].map(k => p[(start + k) * 3 + 1]));
  const tipZ = p => { let best = start; for (let i = start; i < n; i++) if (p[i * 3 + 1] > p[best * 3 + 1]) best = i; return p[best * 3 + 2]; };
  const withTraits = t => ({ id: 99, traits: { dorsal: 'normal', fluke: 'normal', bitePlace: 0.5, ...t } });
  assert.equal(shapeForIndividual(P, L, withTraits({})), null, 'ふつうの子は形を変えない');
  const knob = shapeForIndividual(P, L, withTraits({ dorsal: 'knob' }));
  assert.ok(finTop(knob) < finTop(P) - 0.008);
  const hook = shapeForIndividual(P, L, withTraits({ dorsal: 'hook' }));
  assert.ok(tipZ(hook) > tipZ(P) + 0.005, 'かぎ形の先は、うしろ(尾のほう)へ');
  const nick = shapeForIndividual(P, L, withTraits({ dorsal: 'nick' }));
  assert.ok(finTop(nick) < finTop(P) - 0.003 && finTop(nick) > finTop(knob));
  // 尾びれの欠けは、点を動かさずに、けずって描く(三角が裏返って黒く見えないように)
  assert.equal(shapeForIndividual(P, L, withTraits({ fluke: 'bite' })), null, '尾びれの欠けだけの子は、形を動かさない');
});

test('尾びれの欠け: 点ごとに、尾びれの左右の位置と、うしろのふちまでの長さを持つ', async () => {
  const { flukeEdge } = await import('../src/logic/whaleModelLayout.js');
  const { pos, nrm } = toyWhale();
  const P = new Float32Array(pos), L = modelLayout(P, new Float32Array(nrm));
  const e = flukeEdge(P, L);
  const n = P.length / 3;
  const fl = [...Array(n).keys()].filter(i => L.part[i] === PART.fluke);
  assert.ok(fl.length > 0);
  assert.ok(fl.every(i => e[i * 2] === L.s[i] && e[i * 2 + 1] >= 0));
  // うしろのふちの点は 0、前のふちほど長い
  const edge = fl.filter(i => L.c[i] > 0.97), front = fl.filter(i => L.c[i] < 0.1);
  assert.ok(edge.some(i => e[i * 2 + 1] < 0.002));
  const mean = list => list.reduce((s, i) => s + e[i * 2 + 1], 0) / list.length;
  assert.ok(front.length && mean(front) > mean(edge) + 0.01);
  const other = [...Array(n).keys()].find(i => L.part[i] !== PART.fluke);
  assert.deepEqual([e[other * 2], e[other * 2 + 1]], [0, 1]);
});

test('のどのふくらみの重みは、となりの点となじませる(同じ場所の点はそろう)', async () => {
  const { smoothOverMesh } = await import('../src/logic/whaleModelLayout.js');
  // 1列にならんだ4点(0と4は同じ場所)の三角2枚
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 0, 0, 0]);
  const index = [0, 1, 2, 1, 2, 3];
  const v = smoothOverMesh(new Float32Array([1, 0, 0, 0, 0]), pos, index, 1);
  assert.equal(v[0], v[4]);
  assert.ok(v[0] < 1 && v[1] > 0 && v[3] === 0);
});
