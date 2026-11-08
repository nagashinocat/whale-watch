const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8766/test.html');
  await p.waitForFunction(() => document.querySelectorAll('.thumb img[src^="blob:"]').length === 17, null, { timeout: 60000 });
  const imgs = await p.evaluate(async () => Promise.all([...document.querySelectorAll('.card')].map(async c => {
    const src = c.querySelector('img').src; const blob = await (await fetch(src)).blob();
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x);
    return { name: c.querySelector('small').textContent.split(' · ')[1], data: btoa(s) };
  })));
  for (const i of imgs) fs.writeFileSync('out/' + i.name, Buffer.from(i.data, 'base64'));
  await p.screenshot({ path: 'page.png', fullPage: false });
  console.log(imgs.length, errs.filter(e => !/fonts.g/.test(e)), await p.locator('#status').textContent());
  await b.close();
})();
