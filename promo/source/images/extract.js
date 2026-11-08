// デザインの HTML を開いて、「何をどこに描くか」の一覧(描く順)を取り出す。
// 文字は、本物の文字の形で描きなおすので、位置・大きさ・色・行の分け方だけを取り出す
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

async function extract(page) {
  return await page.evaluate(() => {
    const root = document.body.firstElementChild;
    const R = root.getBoundingClientRect();
    const px = v => parseFloat(v) || 0;
    const ops = [];
    const svgs = [];
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
    const radius = (cs, b) => {
      const v = cs.borderTopLeftRadius;
      if (v.endsWith('%')) return { rx: b.w * px(v) / 100, ry: b.h * px(v) / 100 };
      return { rx: px(v), ry: px(v) };
    };
    const shadow = s => {
      if (!s || s === 'none') return null;
      const m = s.match(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
      return m ? { color: m[1], x: +m[2], y: +m[3], blur: +m[4] } : null;
    };
    const isTextBlock = el => [...el.childNodes].some(n => (n.nodeType === 3 && n.textContent.trim()) || n.nodeName === 'BR');
    function runsOf(el, color, weight) {
      const out = [];
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { if (n.textContent) out.push({ t: n.textContent.replace(/\s+/g, ' '), color, weight }); }
        else if (n.nodeName === 'BR') out.push({ br: true });
        else if (n.nodeType === 1) { const cs = getComputedStyle(n); out.push(...runsOf(n, cs.color, cs.fontWeight)); }
      }
      return out;
    }
    function lineCount(el) {
      const range = document.createRange(); range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].filter(r => r.width > 0.5).map(r => Math.round(r.top)));
      return Math.max(1, tops.size);
    }
    function walk(el) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      let b = box(el);
      const tr = el.style.transform || '';
      let rot = 0;
      if (tr) { const m = tr.match(/rotate\((-?[\d.]+)deg\)/); if (m) rot = +m[1]; el.style.transform = 'none'; b = box(el); el.style.transform = tr; }
      const opacity = px(cs.opacity === '' ? 1 : cs.opacity) || (cs.opacity === '0' ? 0 : 1);
      const rad = radius(cs, b);
      if (el.nodeName === 'IMG') {
        ops.push({ op: 'img', src: el.getAttribute('src'), ...b, rot, opacity, filter: cs.filter === 'none' ? '' : cs.filter, radius: rad,
          fit: cs.objectFit, pos: cs.objectPosition, nw: el.naturalWidth, nh: el.naturalHeight, shadow: shadow(cs.boxShadow) });
        return;
      }
      if (el.nodeName === 'svg') {
        const c = el.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.removeAttribute('style');
        c.setAttribute('width', b.w); c.setAttribute('height', b.h);
        svgs.push(c.outerHTML);
        ops.push({ op: 'svg', id: svgs.length - 1, ...b, opacity });
        return;
      }
      const bg = cs.backgroundColor, bgi = cs.backgroundImage;
      const bw = px(cs.borderTopWidth);
      const sh = shadow(cs.boxShadow);
      if ((bg && bg !== 'rgba(0, 0, 0, 0)') || (bgi && bgi !== 'none') || bw > 0 || sh) {
        ops.push({ op: 'box', ...b, rot, bg, grad: bgi !== 'none' ? bgi : '', radius: rad, border: bw ? { w: bw, color: cs.borderTopColor, style: cs.borderTopStyle } : null, shadow: sh, opacity });
      }
      const clip = cs.overflow === 'hidden' && el !== root;
      if (clip) ops.push({ op: 'clip', ...b, radius: rad });
      if (isTextBlock(el)) {
        const pl = px(cs.paddingLeft) + bw, pr = px(cs.paddingRight) + bw, pt = px(cs.paddingTop) + bw, pb = px(cs.paddingBottom) + bw;
        const content = { x: b.x + pl, y: b.y + pt, w: b.w - pl - pr, h: b.h - pt - pb };
        const runs = runsOf(el, cs.color, cs.fontWeight);
        const explicit = runs.filter(r => r.br).length + 1;
        const lines = lineCount(el);
        const lh = cs.lineHeight === 'normal' ? content.h / lines : px(cs.lineHeight);
        const boxed = (bg && bg !== 'rgba(0, 0, 0, 0)') || bw > 0;
        ops.push({ op: 'text', ...content, runs, size: px(cs.fontSize), weight: cs.fontWeight, ls: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
          lh, align: boxed ? 'center' : (() => { const ps = getComputedStyle(el.parentElement); const col = ps.display.includes('flex') && ps.flexDirection.startsWith('column'); if (col && ps.alignItems === 'center') return 'center'; if (col && ps.alignItems === 'flex-end') return 'right'; return cs.textAlign === 'start' ? 'left' : cs.textAlign; })(), wrap: lines > explicit, shadow: shadow(cs.textShadow), opacity });
      } else {
        for (const ch of el.children) walk(ch);
      }
      if (clip) ops.push({ op: 'unclip' });
    }
    ops.push({ op: 'clip', x: 0, y: 0, w: R.width, h: R.height, radius: { rx: 0, ry: 0 } });
    const rcs = getComputedStyle(root);
    ops.push({ op: 'box', x: 0, y: 0, w: R.width, h: R.height, rot: 0, bg: rcs.backgroundColor, grad: rcs.backgroundImage !== 'none' ? rcs.backgroundImage : '', radius: { rx: 0, ry: 0 }, border: null, shadow: null, opacity: 1 });
    for (const ch of root.children) walk(ch);
    ops.push({ op: 'unclip' });
    return { w: R.width, h: R.height, ops, svgs };
  });
}

(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const f of fs.readdirSync(path.join(DIR, 'src')).filter(f => f.endsWith('.html')).sort()) {
    const p = await b.newPage({ viewport: { width: 1600, height: 1920 } });
    await p.goto('http://localhost:8766/src/' + f); await p.waitForTimeout(300);
    const name = f.replace('.html', '');
    const d = await extract(p);
    d.svgs.forEach((s, i) => fs.writeFileSync(path.join(DIR, 'img', `${name}-${i}.svg`), s));
    d.svgs = d.svgs.map((_, i) => `img/${name}-${i}.svg`);
    out[name] = d;
    await p.locator('body > *').first().screenshot({ path: path.join(DIR, 'ref', name + '.png') });
    await p.close();
  }
  fs.writeFileSync(path.join(DIR, 'designs.json'), JSON.stringify(out));
  await b.close();
  console.log(Object.keys(out).map(k => `${k}:${out[k].ops.length}`).join(' '));
})();
