import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIPPLE, rippleHeight, rippleAmplitude, rippleGrid } from '../src/logic/ripples.js';

test('落ちたところから、波の輪が外へ広がる(はじまる前は平ら、時間がたつと遠くへ)', () => {
  assert.equal(rippleHeight(3, -0.5, 1), 0);
  const crest = t => {
    let best = 0, r0 = 0;
    for (let r = 0; r < 80; r += 0.1) { const h = Math.abs(rippleHeight(r, t, 1)); if (h > best) { best = h; r0 = r; } }
    return r0;
  };
  assert.ok(crest(4) > crest(1) + 3, `${crest(1)} → ${crest(4)}`);
  assert.ok(crest(8) > crest(4) + 3);
});

test('波は遠くへ行くほど、時間がたつほど小さくなり、やがて消える', () => {
  const peak = t => Math.max(...Array.from({ length: 800 }, (_, i) => Math.abs(rippleHeight(i * 0.1, t, 1))));
  assert.ok(peak(2) > peak(6) && peak(6) > peak(12));
  assert.ok(peak(RIPPLE.life + 0.5) < 1e-6);
});

test('波の高さは、落ちたものの勢いで決まる(大ジャンプは大きく、ひれは小さく)。上限もある', () => {
  assert.ok(rippleAmplitude(40000, 8) > rippleAmplitude(2000, 6));
  assert.ok(rippleAmplitude(1e9, 50) <= RIPPLE.maxAmp);
  assert.equal(rippleAmplitude(0, 0), 0);
});

test('海の網目: まん中(クジラの出るあたり)ほど細かく、遠くはあらい。はしは海の広さまで', () => {
  const g = rippleGrid([0, -60]);
  const n = g.positions.length / 3;
  assert.ok(n < 30000, `${n} 点(スマホで重くならない数)`);
  let far = 0;
  for (let i = 0; i < n; i++) far = Math.max(far, Math.hypot(g.positions[i * 3], g.positions[i * 3 + 2] + 60));
  assert.ok(far > 15000);
  // まん中の近くの点の間かくは 1m 以下
  const near = [];
  for (let i = 0; i < n; i++) { const r = Math.hypot(g.positions[i * 3], g.positions[i * 3 + 2] + 60); if (r > 9 && r < 11) near.push(i); }
  assert.ok(near.length > 60);
  assert.ok(g.indices.length % 3 === 0 && Math.max(...g.indices) < n);
});

test('泡がはじけると、大きい泡ほど海面がもり上がる(小さい泡は波を立てない)', async () => {
  const { bubbleBoil } = await import('../src/logic/ripples.js');
  assert.equal(bubbleBoil(0.005), 0);
  assert.ok(bubbleBoil(0.04) > bubbleBoil(0.02) && bubbleBoil(0.02) > 0);
  assert.ok(bubbleBoil(1) <= 0.15);
});

test('波の高さは、ジャンプの着水(28トン・秒速7m)で約1m', () => {
  const a = rippleAmplitude(28500, 7);
  assert.ok(a > 0.9 && a < 1.3, String(a));
});

test('バブルネットの泡のかたまりは、海面をはっきりもり上げる(泡が多いほど高く、深いほどなだらか)', async () => {
  const { bubblePlumeBoil } = await import('../src/logic/ripples.js');
  assert.ok(bubblePlumeBoil(45, 8) > 0.2);
  assert.ok(bubblePlumeBoil(45, 8) > bubblePlumeBoil(20, 8));
  assert.ok(bubblePlumeBoil(45, 16) < bubblePlumeBoil(45, 8));
  // マイナスの高さで渡すと、まん中はへこまずにもり上がってはじまる
  assert.ok(rippleHeight(0, 0.2, -0.5) > 0);
});
