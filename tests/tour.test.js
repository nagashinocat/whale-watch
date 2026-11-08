import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTRO_STEPS, TOUR_STEPS, tourSteps, tourText, loadTourDone, markTourDone } from '../src/logic/tour.js';

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

test('はじめはまだ見ていない。見たら覚えておく(2回目からは出さない)', () => {
  const s = mem();
  assert.equal(loadTourDone(s), false);
  markTourDone(s);
  assert.equal(loadTourDone(s), true);
});

test('保存できない端末でも止まらない', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadTourDone(bad), false);
  assert.doesNotThrow(() => markTourDone(bad));
});

test('はじめは、あいさつ1枚だけ。ボタンの説明より先に、まずクジラに会ってもらう', () => {
  assert.equal(INTRO_STEPS.length, 1);
  assert.equal(INTRO_STEPS[0].target, null);
  assert.ok(INTRO_STEPS[0].next.ja.includes('クジラ'));
  assert.ok(tourText(INTRO_STEPS[0]).length < 90, '長すぎる');
});

test('ボタンの紹介は、写真と図鑑(シロの案内で見せる)を入れずに、短く。最後は「使い方」', () => {
  assert.equal(TOUR_STEPS[0].target, null);
  assert.equal(TOUR_STEPS.at(-1).target, 'help');
  assert.ok(TOUR_STEPS.length <= 8);
  assert.ok(!TOUR_STEPS.some(s => s.target === 'photo' || s.target === 'zukan-open'));
  for (const s of TOUR_STEPS) {
    const ja = tourText(s, { lang: 'ja', interval: 'often' });
    assert.ok(ja && ja.length <= 70, `${s.id} が長い(${ja.length}文字)`);
  }
  const steps = tourSteps(t => t !== 'sleep');
  assert.equal(steps.length, TOUR_STEPS.length - 1);
  assert.ok(!steps.some(s => s.target === 'sleep'));
});

test('来る間隔のステップは、いま選んでいる間隔を言う。長くするとめずらしい動きに会いやすいことも伝える', () => {
  const step = TOUR_STEPS.find(s => s.id === 'timer');
  const often = tourText(step, { lang: 'ja', interval: 'often' });
  assert.ok(often.includes('よく来る') && often.includes('3〜5分'), often);
  assert.ok(tourText(step, { lang: 'ja', interval: 'rare' }).includes('ときどき'));
  assert.ok(often.includes('めずらしい'));
  assert.ok(tourText(step, { lang: 'en', interval: 'often' }).includes('Often'));
});

test('はじめは「よく来る」なので、画面や説明に「30〜90分に1回」と書かない', async () => {
  const { readFileSync } = await import('node:fs');
  const files = ['src/ui/menu.js', 'src/main.js', 'src/logic/hints.js', 'src/logic/tour.js', 'src/logic/firstWhale.js', 'about.html', 'guide.html', 'index.html', 'pages/trial.html'];
  for (const f of files) {
    const text = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(!/30〜90分に1回|every 30–90 minutes/.test(text), `${f} に「30〜90分に1回」が残っている`);
  }
});
