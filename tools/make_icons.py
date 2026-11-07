# アプリのアイコン(いろいろな大きさ)と、リンクを送ったときに出る横長の絵を作る。
#   python3 tools/make_icons.py
# もとの絵は tools/icon.svg(デザインの案D「見守る月」)。ブラウザで描いて、画像にする
import pathlib, base64
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/icons'
svg = (ROOT / 'tools/icon.svg').read_text()
src = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()

def shot(page, html, w, h):
    page.set_viewport_size({'width': w, 'height': h})
    page.set_content(html)
    page.wait_for_timeout(300)
    return Image.open(BytesIO(page.screenshot(type='png'))).convert('RGB')

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(device_scale_factor=1)
    # アイコン(四角。角の丸めは端末がする)。大きく描いて縮める
    big = shot(page, f'<body style="margin:0"><img src="{src}" width="1024" height="1024" style="display:block"></body>', 1024, 1024)
    for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (32, 'favicon-32.png')]:
        big.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    # 丸く切りとられても目が切れないアイコン(まん中の8割に収め、まわりは夜空と海の色でうめる)
    mask = shot(page, f'<body style="margin:0;background:linear-gradient(#0a1a2e 0 808px, #2a6d9e 808px)"><img src="{src}" width="820" height="820" style="display:block;margin:102px"></body>', 1024, 1024)
    mask.resize((512, 512), Image.LANCZOS).save(OUT / 'icon-maskable-512.png', optimize=True)
    # リンクを送ったときに出る絵(横長)
    og = shot(page, f'''<body style="margin:0">
      <div style="width:1200px;height:630px;background:#0a1a2e;position:relative;overflow:hidden;font-family:'Noto Sans CJK JP',sans-serif">
        <svg width="1200" height="630" style="position:absolute;inset:0" viewBox="0 0 1200 630">
          <g fill="#fdf6e3">{''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in [(80,70,2),(260,40,1.5),(520,90,1.8),(700,50,1.4),(1120,80,2.2),(980,140,1.4),(620,170,1.2),(380,150,1.4),(1150,240,1.6)])}</g>
          <path d="M0 520 Q75 500 150 520 T300 520 T450 520 T600 520 T750 520 T900 520 T1050 520 T1200 520 V630 H0 Z" fill="#2a6d9e"/>
          <path d="M0 520 Q75 500 150 520 T300 520 T450 520 T600 520 T750 520 T900 520 T1050 520 T1200 520" stroke="#9fd3e6" stroke-width="5" fill="none"/>
        </svg>
        <img src="{src}" width="300" height="300" style="position:absolute;left:96px;top:120px;border-radius:68px;box-shadow:0 18px 60px rgba(0,0,0,.45)">
        <div style="position:absolute;left:460px;top:170px;color:#fdf6e3">
          <div style="font-size:92px;font-weight:700;letter-spacing:4px">クジラが<span style="color:#ffd28a">見</span>てる</div>
          <div style="font-size:30px;letter-spacing:10px;color:#9fb8cc;margin-top:6px">WHALE WATCH</div>
          <div style="font-size:32px;margin-top:34px;color:#e8eef5">波の音と、ときどきクジラ。</div>
        </div>
      </div></body>''', 1200, 630)
    og.save(OUT / 'og.png', optimize=True)
    b.close()
print('ok')
