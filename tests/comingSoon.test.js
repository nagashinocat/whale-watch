import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMING, heraldWay, shouldGoBack } from '../src/logic/comingSoon.js';

const base = { enabled: true, blocked: false, now: 1_000_000, nextAt: 1_000_000 + 60_000, lastFor: null, hidden: true, lastTouch: 0 };

test('裏にあるときは、クジラが来る1分前くらいに通知で知らせる', () => {
  assert.equal(heraldWay(base), 'notify');
  assert.equal(heraldWay({ ...base, nextAt: base.now + COMING.windowMs + 1000 }), null, 'まだ早い');
  assert.equal(heraldWay({ ...base, nextAt: base.now + 2000 }), null, 'もう間に合わない');
});

test('画面に出ているときは、しばらく触っていなければアプリの中に出す。使っているときは出さない', () => {
  assert.equal(heraldWay({ ...base, hidden: false, lastTouch: base.now - COMING.idleMs }), 'hint');
  assert.equal(heraldWay({ ...base, hidden: false, lastTouch: base.now - 10_000 }), null);
});

test('1頭につき1回だけ。オフ・おやすみモードなど・クジラが来ないときは知らせない', () => {
  assert.equal(heraldWay({ ...base, lastFor: base.nextAt }), null);
  assert.equal(heraldWay({ ...base, enabled: false }), null);
  assert.equal(heraldWay({ ...base, blocked: true }), null);
  assert.equal(heraldWay({ ...base, nextAt: null }), null);
});

test('知らせてから5分触らなかったら、はじめのページにもどす。触ったらもどさない', () => {
  const heraldAt = 1_000_000;
  assert.equal(shouldGoBack({ now: heraldAt + COMING.backAfterMs, heraldAt, lastTouch: heraldAt - 1 }), true);
  assert.equal(shouldGoBack({ now: heraldAt + COMING.backAfterMs - 1000, heraldAt, lastTouch: heraldAt - 1 }), false);
  assert.equal(shouldGoBack({ now: heraldAt + COMING.backAfterMs, heraldAt, lastTouch: heraldAt + 1000 }), false);
  assert.equal(shouldGoBack({ now: heraldAt + COMING.backAfterMs, heraldAt: null, lastTouch: 0 }), false);
});

test('来る前の知らせは、はじめはオフ。スケジュールから次に来る時刻がわかる', async () => {
  const { DEFAULTS } = await import('../src/logic/config.js');
  const { createScheduler } = await import('../src/logic/scheduler.js');
  assert.equal(DEFAULTS.herald, false);
  const s = createScheduler({ now: 0, rng: () => 0.5 });
  assert.equal(s.upcoming(), s.nextAt);
  s.setQuiet(true, 0);
  assert.equal(s.upcoming(), null, 'タイマーのあいだは来ない');
  s.setQuiet(false, 0);
  s.summon(0);
  assert.equal(s.upcoming(), null, '呼んだクジラを待っているあいだは、知らせない');
});
