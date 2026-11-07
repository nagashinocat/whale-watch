import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAY, isPhoneLike, awayPlan } from '../src/logic/away.js';

const mm = q => ({ matches: q === '(pointer: coarse)' ? 'coarse' : false });

test('スマホでは、見えなくなったら音を小さくして止め、もどったら大きくする', () => {
  assert.deepEqual(awayPlan({ hidden: true, phone: true }), { action: 'pause' });
  assert.deepEqual(awayPlan({ hidden: false, phone: true }), { action: 'show', resume: true });
  assert.deepEqual(awayPlan({ hidden: false, phone: true, resting: true }), { action: 'show', resume: false });
  assert.ok(AWAY.fadeOutMs < AWAY.fadeInMs);
});

test('パソコンでは、ほかのタブを見ていても鳴りつづける(何もしない)', () => {
  assert.equal(awayPlan({ hidden: true, phone: false }), null);
  assert.equal(awayPlan({ hidden: false, phone: false }), null);
});

test('指で操作してマウスのない端末だけを、スマホとみなす', () => {
  assert.equal(!!isPhoneLike(q => ({ matches: q === '(pointer: coarse)' })), true);
  assert.equal(isPhoneLike(q => ({ matches: true })), false);   // 指でもマウスでも使える(タッチのパソコン)
  assert.equal(isPhoneLike(() => ({ matches: false })), false);
  assert.equal(isPhoneLike(() => { throw new Error('x'); }), false);
  assert.ok(mm);
});

test('iPhone の「音の使い方」を切りかえる。ない端末や、こわれていても止まらない', async () => {
  const { setAudioSession } = await import('../src/logic/away.js');
  const nav = { audioSession: { type: 'auto' } };
  assert.equal(setAudioSession(nav, 'playback'), true);
  assert.equal(nav.audioSession.type, 'playback');
  assert.equal(setAudioSession({}, 'playback'), true);   // ない端末では何もしない
  const bad = { audioSession: { get type() { return 'auto'; }, set type(v) { throw new Error('x'); } } };
  assert.equal(setAudioSession(bad, 'playback'), false);
});
