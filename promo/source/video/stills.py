import sys
from playwright.sync_api import sync_playwright
from PIL import Image
ts = [3.6, 8.6, 12.0, 18.6, 24.0, 29.5]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1080, 'height': 1920})
    pg.goto('http://localhost:8790/' + sys.argv[1]); pg.wait_for_function('window.ready', timeout=20000)
    ims = []
    for t in ts:
        pg.evaluate(f'frame({t})'); pg.screenshot(path='_s.png'); ims.append(Image.open('_s.png').convert('RGB').resize((360, 640)))
    b.close()
W = Image.new('RGB', (360 * 6 + 50, 640), 'white')
for i, im in enumerate(ims): W.paste(im, (i * 370, 0))
W.save(sys.argv[2])
