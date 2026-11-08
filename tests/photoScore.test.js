import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePhoto, rankOf, lightOf, scoreLine, SCORE } from '../src/logic/photoScore.js';

// 体の点を、まんなか(cx, cy)に、はば size(画面に対する割合)で横にならべる
const body = (cx, cy, size, { above = true, n = 9 } = {}) => Array.from({ length: n }, (_, i) => {
  const x = cx - size + (2 * size * i) / (n - 1);
  return { x, y: cy, inFrame: Math.abs(x) <= 1 && Math.abs(cy) <= 1, above };
});

test('クジラがいない写真は低い点', () => {
  const s = scorePhoto({ subjects: [] });
  assert.ok(s.total < 20);
  assert.equal(s.rank, 'C');
});

test('写り方: まんなかに大きく写すと、小さく端に写すより高い', () => {
  const good = scorePhoto({ subjects: [{ pattern: 'spout', points: body(0, 0, 0.55) }] });
  const small = scorePhoto({ subjects: [{ pattern: 'spout', points: body(0.75, 0.6, 0.08) }] });
  assert.ok(good.composition > small.composition + 15, `${good.composition} > ${small.composition}`);
  assert.ok(good.notes.some(n => n.ja === 'ばっちりの構図'));
  assert.ok(small.notes.some(n => n.ja.includes('大きく')));
});

test('写り方: 体が画面から切れると下がる', () => {
  const whole = scorePhoto({ subjects: [{ pattern: 'spout', points: body(0, 0, 0.6) }] });
  const cut = scorePhoto({ subjects: [{ pattern: 'spout', points: body(0.9, 0, 0.6) }] });
  assert.ok(whole.composition > cut.composition);
  assert.ok(cut.notes.some(n => n.ja.includes('切れて')));
});

test('めずらしさ: ジャンプの空中・めずらしい出方・とくべつな子・夜は点が上がる。上限は40点', () => {
  const pts = body(0, 0, 0.5);
  const plain = scorePhoto({ subjects: [{ pattern: 'spout', points: pts }] });
  const air = scorePhoto({ subjects: [{ pattern: 'breach', points: pts, airborne: true }] });
  const ring = scorePhoto({ subjects: [{ pattern: 'bubbleRing', points: pts }] });
  const night = scorePhoto({ subjects: [{ pattern: 'spout', points: pts }], light: 'night' });
  const max = scorePhoto({ subjects: [{ pattern: 'bubbleRing', points: pts, airborne: true, special: true }, { pattern: 'bubbleRing', points: pts }], light: 'golden' });
  assert.ok(air.rarity > plain.rarity + 15);
  assert.ok(air.notes.some(n => n.ja.includes('ジャンプ')));
  assert.ok(ring.rarity > plain.rarity);
  assert.ok(night.rarity > plain.rarity);
  assert.equal(max.rarity, SCORE.rarity);
  assert.ok(max.total <= 100);
});

test('ランクと光と、ひとこと', () => {
  assert.equal(rankOf(95), 'S'); assert.equal(rankOf(80), 'A'); assert.equal(rankOf(60), 'B'); assert.equal(rankOf(10), 'C');
  assert.equal(lightOf(22), 'night'); assert.equal(lightOf(6), 'golden'); assert.equal(lightOf(12), 'day'); assert.equal(lightOf(18), 'golden');
  const line = scoreLine(scorePhoto({ subjects: [{ pattern: 'breach', points: body(0, 0, 0.5), airborne: true }] }));
  assert.match(line, /点|pts/);
  assert.equal(scoreLine(null), '');
});
