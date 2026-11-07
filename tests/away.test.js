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

test('動作確認の止め方と、離れたときの記録(新しい60件まで)', async () => {
  const { loadAwayMode, saveAwayMode, logAway, readAwayLog, clearAwayLog } = await import('../src/logic/away.js');
  const m = {}; const st = { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } };
  assert.equal(loadAwayMode(st), 'fade');
  saveAwayMode(st, 'element'); assert.equal(loadAwayMode(st), 'element');
  saveAwayMode(st, 'xxx'); assert.equal(loadAwayMode(st), 'fade');
  for (let i = 0; i < 70; i++) logAway(st, { t: i, ev: 'blur' });
  const list = readAwayLog(st); assert.equal(list.length, 60); assert.equal(list[0].t, 10);
  clearAwayLog(st); assert.deepEqual(readAwayLog(st), []);
});

test('iPhone・iPad は <audio> を通して鳴らす(「ピン」が鳴らなかった止め方)。ほかは今まで', async () => {
  const { defaultAwayMode, isAppleTouch, loadAwayMode } = await import('../src/logic/away.js');
  assert.equal(defaultAwayMode({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'element');
  assert.equal(isAppleTouch({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }), true);   // iPad
  assert.equal(defaultAwayMode({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }), 'fade');
  assert.equal(defaultAwayMode({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), 'fade');
  assert.equal(loadAwayMode({ getItem: () => null }, 'element'), 'element');
});
