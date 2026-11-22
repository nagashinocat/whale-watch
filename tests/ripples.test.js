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
