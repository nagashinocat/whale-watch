# クジラの見える海 Web試作品 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 波の音と海の定点カメラ映像を流しっぱなしにでき、ときどきクジラが現れるブラウザ用の試作品を作る。

**Architecture:** ビルド不要の ES Modules 構成。ロジック(出番係・設定・音量計算・空の計算・出現位置)は three.js に依存しない純粋なモジュールにして Node の標準テストランナーで検証し、描画(three.js)と音(Web Audio)はそれらを呼ぶ薄い層にする。出番係はイベントを返すだけで、演出と音は main.js がつなぐ。

**Tech Stack:** HTML + JavaScript (ES Modules)、three.js 0.170.0(CDN の importmap 経由、`Water` / `Sky` / `GLTFLoader`)、Web Audio API、テストは `node --test`(Node 22、追加パッケージなし)

**Spec:** `docs/superpowers/specs/2026-11-05-whale-ocean-prototype-design.md`

## Global Constraints

- npm パッケージのインストールなし。テストは Node 22 標準の `node --test tests/` のみで動くこと
- three.js は `https://cdn.jsdelivr.net/npm/three@0.170.0/` から importmap で読む。`src/logic/` 配下のファイルは three.js を import しない
- 画面の文言: 起動画面「タップしてはじめる」、呼んでいる間「呼んでいます…」
- モード: `'sleep'`(おやすみ)/ `'normal'`(ふつう)
- カメラ: `'cliff'`(崖の上)/ `'boat'`(船の上)/ `'beach'`(浜辺)/ `'surface'`(水面すれすれ)
- 初期設定: ふつうモード・崖の上・音量 0.5
- 自然出現の間隔: 30〜90分の一様ランダム
- 出方と重み: voice 25 / spout 20 / fluke 15 / motherCalf 10 / sleeping 10 / breach 20。直前と同じ出方は選ばない
- 呼んだクジラ: 10〜30秒後に到着。到着中は自然出現タイマーを止め、帰ったあとに残り時間から再開
- クジラの音は波の音より大きくしない(クジラの目標音量 ≤ 波の目標音量 × 0.8)。クジラの音の経路には必ずコンプレッサー(リミッター)を通す
- モード・カメラ切り替え時の音の変化は 3 秒かけてフェード
- メニューは操作がなければ 4 秒で自動的に隠れる
- 画面が見えていないとき(`document.hidden`)は描画ループを止める。音と出番係は止めない
- 素材の配置: `assets/audio/` と `assets/models/`。出典とライセンスは `assets/CREDITS.md` に記録し、メニューにも表示する

## Review Focus

1. **保存データが壊れている・localStorage が使えない**(プライベートブラウズなど): 初期設定で起動し、エラーで止まらない → Task 1 のテスト
2. **タブを何時間も裏にしていた**(タイマーが間引かれる): 戻ったときにクジラが何頭も一気に出ず、出るのは最大1回 → Task 2 のテスト
3. **自然のクジラが出ている最中に「呼ぶ」を押す**: ボタンは受け付け、今のクジラが帰ってから呼んだクジラが来る。二重には来ない → Task 2 のテスト
4. **モードや音量を素早く何度も切り替える**: フェードが重なって音が跳ね上がらない。目標音量は常に上限以下 → Task 4 のテスト
5. **深夜0時をまたぐ**: 空の明るさが急に変わらない → Task 3 のテスト

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `package.json` | `"type": "module"` と `npm test` 用スクリプトだけ |
| `index.html` | importmap、起動画面、メニューの HTML/CSS、`src/main.js` の読み込み |
| `src/logic/config.js` | 仕様で決まった数値・名前をまとめる |
| `src/logic/settings.js` | 設定の読み込み・保存・検証 |
| `src/logic/scheduler.js` | クジラの出番係(いつ・どの出方) |
| `src/logic/sky.js` | 時刻から太陽の高さ・明るさを計算 |
| `src/logic/spawn.js` | どのカメラからも見える出現位置を決める |
| `src/logic/gains.js` | モードと音量から各音の目標音量を計算 |
| `src/logic/patterns.js` | 出方ごとの長さ・必要なモデル・音、モデルがないときの置き換え |
| `src/scene/cameras.js` | 4つのカメラ位置 |
| `src/scene/ocean.js` | three.js の海・空・カメラ・描画ループ |
| `src/scene/whales.js` | モデル読み込みと出方ごとのアニメーション |
| `src/scene/effects.js` | 潮吹き・水しぶき・泡 |
| `src/audio/mixer.js` | Web Audio の音の経路とフェード |
| `src/ui/menu.js` | 起動画面とメニュー |
| `src/main.js` | 全部をつなぐ。開発用ボタン(`?debug=1`) |
| `tests/*.test.js` | `src/logic/` のテスト |
| `assets/CREDITS.md` | 素材の出典とライセンス |

---

### Task 1: 設定値と設定の保存

**Files:**
- Create: `package.json`, `src/logic/config.js`, `src/logic/settings.js`
- Test: `tests/settings.test.js`

**Interfaces:**
- Produces:
  - `config.js`: `MODES = ['sleep','normal']`, `CAMERAS = ['cliff','boat','beach','surface']`, `DEFAULTS = { mode:'normal', camera:'cliff', volume:0.5 }`, `SCHEDULE = { minIntervalMs: 1800000, maxIntervalMs: 5400000, weights: { voice:25, spout:20, fluke:15, motherCalf:10, sleeping:10, breach:20 } }`, `SUMMON = { minDelayMs: 10000, maxDelayMs: 30000 }`, `AUDIO = { whaleMaxRatio: 0.8, fadeMs: 3000 }`, `MENU_HIDE_MS = 4000`, `STORAGE_KEY = 'whale-ocean-settings'`
  - `settings.js`: `loadSettings(storage) -> {mode, camera, volume}`, `saveSettings(storage, settings) -> void`。`storage` は `getItem`/`setItem` を持つオブジェクト(本番は `localStorage`)

- [ ] **Step 1: `package.json` を作る**

`{ "name": "whale-ocean", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`

- [ ] **Step 2: 失敗するテストを書く**

```js
// tests/settings.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings } from '../src/logic/settings.js';
import { DEFAULTS } from '../src/logic/config.js';

const mem = (init = {}) => { const d = { ...init }; return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };

test('何も保存されていなければ初期設定', () => {
  assert.deepEqual(loadSettings(mem()), DEFAULTS);
});
test('保存した設定を読み戻せる', () => {
  const s = mem();
  saveSettings(s, { mode: 'sleep', camera: 'beach', volume: 0.3 });
  assert.deepEqual(loadSettings(s), { mode: 'sleep', camera: 'beach', volume: 0.3 });
});
test('壊れたJSONなら初期設定', () => {
  assert.deepEqual(loadSettings(mem({ 'whale-ocean-settings': '{oops' })), DEFAULTS);
});
test('不正な項目だけ初期値に戻す', () => {
  const s = mem({ 'whale-ocean-settings': JSON.stringify({ mode: 'party', camera: 'beach', volume: 7 }) });
  assert.deepEqual(loadSettings(s), { mode: 'normal', camera: 'beach', volume: 0.5 });
});
test('storageが例外を投げても止まらない', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(bad), DEFAULTS);
  assert.doesNotThrow(() => saveSettings(bad, DEFAULTS));
});
```

- [ ] **Step 3: 失敗を確認** — Run: `node --test tests/settings.test.js` / Expected: FAIL(モジュールが見つからない)

- [ ] **Step 4: `config.js` と `settings.js` を実装**

volume は 0〜1 の有限な数値のみ有効。範囲外・非数値は初期値に戻す(丸めない)。

- [ ] **Step 5: 通過を確認** — Run: `node --test tests/settings.test.js` / Expected: 5 pass

- [ ] **Step 6: Commit** — `git add package.json src/logic tests && git commit -m "feat: 設定値と設定の保存"`

---

### Task 2: クジラの出番係

**Files:**
- Create: `src/logic/scheduler.js`
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Consumes: `SCHEDULE`, `SUMMON`(Task 1)
- Produces:
  - `pickPattern(prev: string|null, rng: () => number) -> string` — 重み付き抽選。結果が `prev` と同じなら引き直す
  - `createScheduler({ now: number, rng?: () => number, intervalScale?: number }) -> Scheduler` — `intervalScale`(既定 1)は自然出現の間隔に掛ける倍率。開発用の `?fast=1` で `1/30` を渡す
  - `Scheduler.tick(t: number) -> { kind: 'natural'|'summon', pattern: string } | null` — 出番なら1件だけ返し、出演中(busy)になる
  - `Scheduler.summon(t: number) -> boolean` — 呼べたら true。すでに呼んでいる/呼んだクジラが来ているなら false
  - `Scheduler.endEvent(t: number) -> void` — 今のクジラが帰ったことを伝える
  - `Scheduler.isSummoning() -> boolean` — 呼んでから帰るまで true(メニューのボタン無効化用)
  - `Scheduler.nextAt: number` — 次の自然出現の時刻(テスト・デバッグ用)
- 呼んだクジラの出方名は `'summon'`

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/scheduler.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, pickPattern } from '../src/logic/scheduler.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const MIN = 60000;

test('次の出現は30〜90分後', () => {
  const rng = seeded(7);
  for (let i = 0; i < 500; i++) {
    const s = createScheduler({ now: 0, rng });
    assert.ok(s.nextAt >= 30 * MIN && s.nextAt <= 90 * MIN);
  }
});
test('出方の割合がおおむね重みどおり(直前と同じは出ない)', () => {
  const rng = seeded(3); const count = {}; let prev = null;
  for (let i = 0; i < 20000; i++) { const p = pickPattern(prev, rng); assert.notEqual(p, prev); count[p] = (count[p] ?? 0) + 1; prev = p; }
  const pct = k => count[k] / 200;
  assert.ok(pct('voice') > 20 && pct('voice') < 30);
  assert.ok(pct('breach') > 15 && pct('breach') < 25);
  assert.ok(pct('motherCalf') > 7 && pct('motherCalf') < 14);
});
test('時刻前はnull、時刻を過ぎたら1件だけ', () => {
  const s = createScheduler({ now: 0, rng: seeded(5) });
  assert.equal(s.tick(s.nextAt - 1), null);
  const e = s.tick(s.nextAt);
  assert.equal(e.kind, 'natural');
  assert.equal(s.tick(s.nextAt + 1), null);
});
test('何時間も止まっていても一度に出るのは1件', () => {
  const s = createScheduler({ now: 0, rng: seeded(9) });
  assert.ok(s.tick(10 * 60 * MIN));
  assert.equal(s.tick(10 * 60 * MIN + 1000), null);
  s.endEvent(10 * 60 * MIN + 5000);
  assert.ok(s.nextAt >= 10 * 60 * MIN + 5000 + 30 * MIN);
});
test('呼ぶと10〜30秒後に来て、来ている間は二重に呼べない', () => {
  const s = createScheduler({ now: 0, rng: seeded(11) });
  assert.equal(s.summon(1000), true);
  assert.equal(s.summon(2000), false);
  assert.equal(s.tick(1000 + 9999), null);
  const e = s.tick(1000 + 30000);
  assert.deepEqual(e, { kind: 'summon', pattern: 'summon' });
  assert.equal(s.isSummoning(), true);
});
test('呼んだクジラが帰ったら自然出現タイマーは残り時間から再開', () => {
  const s = createScheduler({ now: 0, rng: seeded(13) });
  const remaining = s.nextAt - 1000;
  s.summon(1000); s.tick(31000); s.endEvent(100000);
  assert.equal(s.isSummoning(), false);
  assert.equal(s.nextAt, 100000 + (remaining - 30000));
});
test('自然のクジラが出ている最中に呼ぶと、帰ってから来る', () => {
  const s = createScheduler({ now: 0, rng: seeded(17) });
  const t = s.nextAt; s.tick(t);
  assert.equal(s.summon(t + 1000), true);
  assert.equal(s.tick(t + 60000), null);
  s.endEvent(t + 70000);
  assert.deepEqual(s.tick(t + 70001), { kind: 'summon', pattern: 'summon' });
});
```

注: 「残り時間から再開」の残り時間は、**呼んだクジラが到着した時刻**(`tick` が summon を返した時刻)での `nextAt - t`。上のテストでは到着は 31000 だが、`remaining - 30000` は到着時刻 31000 から計算した残り(`nextAt - 31000`)と一致する。

- [ ] **Step 2: 失敗を確認** — Run: `node --test tests/scheduler.test.js` / Expected: FAIL

- [ ] **Step 3: 実装**

状態は `busy`(自然 or 呼んだクジラが出演中)、`summonAt`(呼んだクジラの到着予定。null なら呼んでいない)、`pausedRemaining`、`prevPattern`。`tick` は busy 中は常に null。busy でなければ `summonAt` を先に判定し、次に `nextAt` を判定する。呼んだクジラの到着時に `pausedRemaining = nextAt - t` を記録し、`endEvent` で `nextAt = t + pausedRemaining`。自然のクジラの `endEvent` では `nextAt = t + ランダム間隔`。

- [ ] **Step 4: 通過を確認** — Run: `node --test tests/` / Expected: すべて pass

- [ ] **Step 5: Commit** — `git commit -m "feat: クジラの出番係"`

---

### Task 3: 海と空(時刻・カメラ位置)

**Files:**
- Create: `src/logic/sky.js`, `src/scene/cameras.js`, `src/scene/ocean.js`, `index.html`(最小限: importmap と `<canvas>`)
- Test: `tests/sky.test.js`

**Interfaces:**
- Produces:
  - `sunForTime(hours: number) -> { elevation: number /*度*/, azimuth: number, exposure: number, isNight: boolean }` — `hours` は 0〜24 の小数
  - `CAMERA_PRESETS: Record<camera, { position:[x,y,z], target:[x,y,z], fov: number /*縦の度数*/, sway: number }>` — cliff `[0,40,0]`、boat `[0,4,0]` sway 0.5、beach `[0,2,60]`、surface `[0,0.6,0]`。target はすべて `[0,0,-500]`、fov 55
  - `createOcean(canvas) -> { setCamera(name), setTime(hours), render(dt), start(), stop(), scene, camera }`

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/sky.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunForTime } from '../src/logic/sky.js';

test('昼は太陽が高く、夜は沈んでいる', () => {
  assert.ok(sunForTime(12).elevation > 30);
  assert.ok(sunForTime(0).elevation < 0);
  assert.equal(sunForTime(1).isNight, true);
  assert.equal(sunForTime(12).isNight, false);
});
test('夜は昼より暗い', () => {
  assert.ok(sunForTime(1).exposure < sunForTime(12).exposure / 2);
});
test('0時をまたいでも急に変わらない', () => {
  const a = sunForTime(23.999), b = sunForTime(0);
  assert.ok(Math.abs(a.elevation - b.elevation) < 0.5);
  assert.ok(Math.abs(a.exposure - b.exposure) < 0.01);
});
test('どの時刻でも1分の差で大きく変わらない', () => {
  for (let h = 0; h < 24; h += 1 / 60) {
    assert.ok(Math.abs(sunForTime(h).exposure - sunForTime(h + 1 / 60).exposure) < 0.02);
  }
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node --test tests/sky.test.js` / Expected: FAIL

- [ ] **Step 3: `sunForTime` を実装**

太陽の高さは 6時に0度・12時に最大60度・18時に0度・0時に最低になる余弦カーブ。exposure は太陽の高さから滑らかに補間し、夜は 0.12、昼は 0.5。`isNight` は elevation < -4。

- [ ] **Step 4: 通過を確認** — Run: `node --test tests/sky.test.js` / Expected: 4 pass

- [ ] **Step 5: `cameras.js` と `ocean.js` を実装**

前回の Three.js サンプル(`Water` + `Sky`)をベースにする。`setTime` は `sunForTime` の結果を Sky と Water の太陽方向、`renderer.toneMappingExposure` に反映。夜は Water の `sunColor` を月明かりの青白い色(`0x8899bb`)にする。boat の sway は sin 波でカメラを ±0.5 度ほど傾ける。`start/stop` は requestAnimationFrame ループの開始・停止。画面幅 768px 未満または `devicePixelRatio > 2` の端末では `setPixelRatio(1)` にする。

- [ ] **Step 6: ブラウザで確認**

Run: `python3 -m http.server 8000` を実行し `http://localhost:8000/` を開く。
Expected: 海と空が表示される。開発者ツールで `ocean.setTime(21)` を実行すると夜の海、`ocean.setCamera('surface')` で水面すれすれの視点になる(この確認用に `window.ocean` に一時的に入れておき、Task 5 で外す)。

- [ ] **Step 7: Commit** — `git commit -m "feat: 時刻とカメラ位置に合わせた海と空"`

---

### Task 4: 音

**Files:**
- Create: `src/logic/gains.js`, `src/audio/mixer.js`, `assets/CREDITS.md`
- Test: `tests/gains.test.js`

**Interfaces:**
- Consumes: `AUDIO`(Task 1)
- Produces:
  - `waveTargetGain(volume: number) -> number` — volume を 0〜1 に収めて返す
  - `whaleTargetGain({ mode, volume }) -> number` — sleep なら 0、normal なら `waveTargetGain(volume) * AUDIO.whaleMaxRatio`
  - `createMixer(ctx: AudioContext, buffers: Record<string, AudioBuffer|null>) -> Mixer`
  - `Mixer.start(camera)`, `Mixer.setMode(mode)`, `Mixer.setVolume(v)`, `Mixer.setCamera(camera)`, `Mixer.playWhale(name: 'humpback'|'sperm'|'splash', { gain?: number /*0〜1、既定1*/ }) -> void`
  - 音ファイル名: `assets/audio/waves-cliff.mp3`, `waves-boat.mp3`, `waves-beach.mp3`, `waves-surface.mp3`, `humpback-song.mp3`, `sperm-clicks.mp3`, `splash.mp3`。buffers のキーは `waves-cliff` など拡張子なしの名前

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/gains.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveTargetGain, whaleTargetGain } from '../src/logic/gains.js';

test('おやすみモードではクジラの音は0', () => {
  assert.equal(whaleTargetGain({ mode: 'sleep', volume: 1 }), 0);
});
test('クジラの音は波の音の0.8倍まで', () => {
  for (const v of [0, 0.1, 0.5, 1]) {
    assert.ok(whaleTargetGain({ mode: 'normal', volume: v }) <= waveTargetGain(v) * 0.8 + 1e-9);
  }
});
test('範囲外の音量は0〜1に収める', () => {
  assert.equal(waveTargetGain(5), 1);
  assert.equal(waveTargetGain(-1), 0);
  assert.equal(waveTargetGain(NaN), 0);
  assert.ok(whaleTargetGain({ mode: 'normal', volume: 99 }) <= 0.8);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node --test tests/gains.test.js` / Expected: FAIL

- [ ] **Step 3: `gains.js` を実装し、通過を確認** — Run: `node --test tests/gains.test.js` / Expected: 3 pass

- [ ] **Step 4: `mixer.js` を実装**

経路: 波4種それぞれのループ再生 → 各 GainNode → 波バス GainNode → 出力。クジラの音 → クジラバス GainNode → DynamicsCompressorNode(threshold -24dB、ratio 12、attack 0.003、release 0.25)→ 出力。すべての音量変更は「`cancelScheduledValues(now)` → `setValueAtTime(現在値, now)` → `linearRampToValueAtTime(目標, now + AUDIO.fadeMs/1000)`」の形にして、連続で切り替えてもフェードが重ならないようにする。`setCamera` は旧カメラの波を0へ、新カメラの波を1へ同時にフェード。`playWhale` は 2秒のフェードインと、終わる2秒前からのフェードアウトをかける。`splash` は `BiquadFilterNode`(lowpass 800Hz)を通してくぐもらせ、gain 0.5 で鳴らす。buffer が null の音は何もしない。

- [ ] **Step 5: 素材をそろえて `assets/CREDITS.md` に記録**

ユーザーと一緒に用意する。NOAA の音(パブリックドメイン、出典「NOAA」)と、波の音(ライセンスが自由に使えるもの)。各ファイルについて「ファイル名・元のページURL・ライセンス・作者」を表で書く。

- [ ] **Step 6: ブラウザで確認**

一時的なボタンで `start` → `playWhale('humpback')` → `setMode('sleep')` を試す。Expected: 波の音が続き、クジラの声は波より小さく、sleep にすると3秒かけて消える。音量スライダーを素早く何度も動かしても音が跳ねない。

- [ ] **Step 7: Commit** — `git commit -m "feat: 波とクジラの音"`

---

### Task 5: 起動画面・メニュー・全体のつなぎ込み

**Files:**
- Create: `src/ui/menu.js`, `src/main.js`
- Modify: `index.html`(起動画面とメニューの HTML/CSS)、`src/scene/ocean.js`(`window.ocean` を外す)

**Interfaces:**
- Consumes: Task 1〜4 のすべて
- Produces:
  - `createMenu(root, handlers: { onStart, onMode, onSummon, onVolume, onCamera, onFullscreen }) -> { setValues(settings), setSummonEnabled(bool), setSummonStatus(text|null), showNotice(text), showCredits(lines: string[]) }`
  - `main.js` が持つ `handleEvent(event)`: 出番係のイベントを演出と音に渡し、終わったら `scheduler.endEvent` を呼ぶ(Task 6・7 でここに演出をつなぐ。この時点では voice だけ鳴らして 60 秒後に `endEvent`)

- [ ] **Step 1: 起動画面とメニューを作る**

起動画面は海の上に「タップしてはじめる」だけ。タップで AudioContext を作り音をフェードインして起動画面を消す。メニューは画面タップで下から表示、`MENU_HIDE_MS` 操作がなければ隠れる。項目は「おやすみ/ふつう」切り替え・「クジラを呼ぶ」・音量スライダー・カメラ4択・全画面。片すみにクレジット。

- [ ] **Step 2: `main.js` でつなぐ**

起動時に `loadSettings(localStorage)`。変更のたびに `saveSettings`。出番係の `tick(Date.now())` を `setInterval` で 1 秒ごとに呼ぶ(描画ループとは独立させ、画面が隠れていても動くようにする)。`visibilitychange` で `document.hidden` なら `ocean.stop()`、戻ったら `ocean.start()`。時刻は 1 分ごとに `ocean.setTime(現在時刻)`。呼ぶボタンは `scheduler.summon` の結果に応じて「呼んでいます…」を表示し、`isSummoning()` の間は無効にする。波の音ファイルが読めなかったら `showNotice('波の音を読み込めませんでした')`。

- [ ] **Step 3: ブラウザで確認**

Expected: 完成の基準 1・2・5 を満たす(起動→海だけの画面、カメラ4か所と時刻の空、おやすみモードで波の音だけ)。設定を変えて再読み込みすると同じ設定で始まる。

- [ ] **Step 4: Commit** — `git commit -m "feat: 起動画面とメニュー、全体のつなぎ込み"`

---

### Task 6: クジラのモデル・出現位置・開発用ボタン

**Files:**
- Create: `src/logic/spawn.js`, `src/logic/patterns.js`, `src/scene/whales.js`
- Modify: `src/main.js`
- Test: `tests/spawn.test.js`, `tests/patterns.test.js`

**Interfaces:**
- Consumes: `CAMERA_PRESETS`(Task 3)、`SCHEDULE.weights`(Task 1)
- Produces:
  - `spawnPosition(rng) -> [x, 0, z]` — z は -600〜-250、x はどのカメラからも見える範囲
  - `isVisibleFrom(preset, point, aspect = 9/16) -> boolean` — 横の視野角は縦 fov と縦長画面(aspect 9/16)から計算
  - `PATTERNS: Record<string, { durationMs: number, needs: 'humpback'|'sperm'|null, sound: 'humpback'|'sperm'|null }>` — キーは 6 つの出方と `'summon'`
  - `resolvePattern(name, models: { humpback: object|null, sperm: object|null }) -> string` — 必要なモデルがなければ `'voice'`
  - `createWhales(scene, loader) -> Promise<{ models, play(name, position) -> Promise<void>, update(dt) }>`
  - モデルファイル: `assets/models/humpback.glb`、`assets/models/sperm_whale.glb`

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/spawn.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnPosition, isVisibleFrom } from '../src/logic/spawn.js';
import { CAMERA_PRESETS } from '../src/scene/cameras.js';

test('出現位置はどのカメラからも縦長画面で見える', () => {
  let s = 42; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) {
    const p = spawnPosition(rng);
    for (const preset of Object.values(CAMERA_PRESETS)) assert.ok(isVisibleFrom(preset, p), JSON.stringify(p));
  }
});
```

```js
// tests/patterns.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, resolvePattern } from '../src/logic/patterns.js';
import { SCHEDULE } from '../src/logic/config.js';

test('すべての出方と summon が定義されている', () => {
  for (const k of [...Object.keys(SCHEDULE.weights), 'summon']) assert.ok(PATTERNS[k]?.durationMs > 0, k);
});
test('寝ているクジラはマッコウクジラ、鳴き声だけはモデル不要', () => {
  assert.equal(PATTERNS.sleeping.needs, 'sperm');
  assert.equal(PATTERNS.voice.needs, null);
});
test('モデルがなければ鳴き声だけに置き換える', () => {
  assert.equal(resolvePattern('breach', { humpback: null, sperm: {} }), 'voice');
  assert.equal(resolvePattern('sleeping', { humpback: {}, sperm: null }), 'voice');
  assert.equal(resolvePattern('breach', { humpback: {}, sperm: null }), 'breach');
});
```

注: `src/scene/cameras.js` は three.js を import しないこと(テストから読むため)。

- [ ] **Step 2: 失敗を確認** — Run: `node --test tests/` / Expected: 新しいテストが FAIL

- [ ] **Step 3: `spawn.js` と `patterns.js` を実装し、通過を確認**

`spawnPosition` の x は `±|z| × tan(14°)` の範囲(縦長画面での横の半視野角 約16度より内側)。
`durationMs`: voice 60000、spout 40000、fluke 30000、motherCalf 60000、sleeping 90000、breach 25000、summon 120000。sound: sleeping は `'sperm'`、voice・summon は `'humpback'`、他は null(しぶき音は演出側で鳴らす)。
Run: `node --test tests/` / Expected: すべて pass

- [ ] **Step 4: `whales.js` を実装(モデル読み込み)**

`GLTFLoader` で 2 つのモデルを読み、失敗したものは null。子クジラは humpback を `clone()` して 0.4 倍。アニメーションは `AnimationMixer` で、モデルに含まれるクリップのうち名前に swim を含むものを優先(なければ最初のクリップ)。`play` はこの時点では「位置に置いて durationMs 後に消す」だけにする(動きは Task 7)。

- [ ] **Step 5: 開発用ボタンを追加**

URL に `?debug=1` があるとき、画面右上に 7 つのボタン(6 つの出方 + summon)を出し、押すとその場で `handleEvent` を通して再生する。URL に `fast=1` もあるときは `createScheduler` に `intervalScale: 1/30` を渡す(Task 9 の確認用)。

- [ ] **Step 6: ブラウザで確認** — `?debug=1` で各ボタンを押し、4 つのカメラすべてでクジラが画面内に置かれることを確認する。モデルファイルを一時的に別名にすると、鳴き声だけに置き換わることも確認する。

- [ ] **Step 7: Commit** — `git commit -m "feat: クジラのモデル・出現位置・開発用ボタン"`

---

### Task 7: 水しぶき・潮吹き・泡

**Files:**
- Create: `src/scene/effects.js`
- Modify: `src/main.js`(描画ループで `effects.update(dt)`)

**Interfaces:**
- Produces: `createEffects(scene) -> { spout(position), splash(position, size: 'small'|'large'), foam(position, durationMs), update(dt) }`

- [ ] **Step 1: 実装**

すべて `THREE.Points` の粒子で作る。粒子数の上限は全体で 3000(スマホで重くならないように、終わった粒子は再利用する)。
- spout: 上向き 6〜9m まで噴き上がり、x 方向に風で流れながら 3 秒で消える白い霧
- splash: small は尾びれ用、large はジャンプ用。放射状に飛び散り重力で落ちる
- foam: 海面すぐ上に白い粒を円状に広げ、`durationMs` かけて薄くなる

- [ ] **Step 2: ブラウザで確認** — 開発者ツールから各エフェクトを呼び、崖の上と水面すれすれの両方から見えること、夜でも見えることを確認する

- [ ] **Step 3: Commit** — `git commit -m "feat: 潮吹き・水しぶき・泡"`

---

### Task 8: 出方ごとの動き

**Files:**
- Modify: `src/scene/whales.js`, `src/main.js`

**Interfaces:**
- Consumes: `createEffects`(Task 7)、`Mixer.playWhale`(Task 4)、`PATTERNS`(Task 6)
- Produces: `play(name, position)` が各出方の動きを再生し、`durationMs` 後に解決する Promise を返す

- [ ] **Step 1: 各出方の動きを実装**

動きは時間 t(0〜1)に対する位置・回転の関数で書く。
- voice: 姿は出さず、`mixer.playWhale('humpback')` のみ
- spout: 背中が浮上 → 潮吹き 2 回 → 背中が沈む。浮上後に foam
- fluke: 背中が見えて弓なりに潜り、最後に尾びれを海面上に上げて沈む。尾びれで splash small
- motherCalf: 親と子が並んで海面近くを横切る。子は親の斜め後ろ、親より少し頻繁に浮上
- sleeping: マッコウクジラが縦向きで頭を海面にわずかに出して揺れる。音は `'sperm'`
- breach: 海面から斜めに飛び出し、横倒しに着水。着水時に splash large、`playWhale('splash')`、foam
- summon: 遠くから正面近く(z = -250)まで泳いでくる → 止まって背中を見せ `playWhale('humpback')` → 沖へ向かい fluke と同じ動きで潜る

- [ ] **Step 2: `main.js` の `handleEvent` をつなぐ**

`resolvePattern` → `spawnPosition`(summon は固定経路)→ `whales.play` → 終わったら `scheduler.endEvent(Date.now())`。描画が止まっている(画面が隠れている)ときも、Promise は `setTimeout(durationMs)` で必ず解決させる。

- [ ] **Step 3: ブラウザで確認** — `?debug=1` で全 7 種を順に再生し、4 カメラで見え方を確認する。完成の基準 4(呼んだクジラが来て歌って帰る)を満たす

- [ ] **Step 4: Commit** — `git commit -m "feat: 出方ごとのクジラの動き"`

---

### Task 9: 仕上げの確認

**Files:**
- Modify: 確認で見つかった不具合に応じて

- [ ] **Step 1: 自動テスト** — Run: `node --test tests/` / Expected: すべて pass

- [ ] **Step 2: スマホで確認** — パソコンで `python3 -m http.server 8000` を動かし、同じ Wi-Fi のスマホから `http://<パソコンのIP>:8000/` を開く。Expected: 海がなめらかに動き(カクつかない)、メニューが指で操作できる(完成の基準 6)

- [ ] **Step 3: 1時間流す** — 開発用に `?debug=1&fast=1` で出現間隔を 1/30(1〜3分)にして 1 時間流し、メモを取る。Expected: 音が途切れない、急に大きくならない、クジラが次々ちゃんと出て帰る(完成の基準 3・7)。続けて通常速度でも 1 時間流す

- [ ] **Step 4: Commit** — `git commit -m "chore: 試作品の仕上げ確認"`
