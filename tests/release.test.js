import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root));

test('電波がなくても動くための sw.js が、いまのファイルに合わせて作りなおしてある(python3 tools/build_sw.py)', () => {
  const sw = read('sw.js').toString();
  const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]);
  const h = createHash('sha256');
  for (const f of files) { h.update(f); h.update(read(f === './' ? 'index.html' : f)); }
  assert.equal(sw.match(/const VERSION = '(\w+)'/)[1], h.digest('hex').slice(0, 12), 'sw.js が古い');
  // アプリのファイルがすべて入っている
  const walk = d => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}${e.name}/`) : [`${d}${e.name}`]);
  for (const f of walk('src/').filter(f => f.endsWith('.js'))) assert.ok(files.includes(f), `${f} が入っていない`);
  assert.ok(files.includes('about.html') && files.includes('manifest.webmanifest'));
});

test('ホーム画面のアイコンと、リンクを送ったときの絵がある', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'クジラの見える海');
  for (const icon of m.icons) assert.ok(existsSync(new URL(icon.src, root)), icon.src);
  const html = read('index.html').toString();
  for (const needle of ['rel="manifest"', 'apple-touch-icon', 'og:image', 'name="description"']) assert.ok(html.includes(needle), needle);
  assert.ok(existsSync(new URL('assets/icons/og.png', root)));
});

test('公開するページに、動作確認のボタンは出ない(?debug=1 のときだけ)', () => {
  const html = read('index.html').toString();
  assert.ok(!html.includes('WHALE_DEBUG'), 'index.html で動作確認がオンになっている');
  assert.ok(!html.includes('WHALE_TEST_SPOT'));
});
