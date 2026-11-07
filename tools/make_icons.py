# アイコン(ホーム画面)と、リンクを送ったときに出る絵を作る。
# 尾びれの形は、アプリのクジラと同じ式(node tools/make_icons.mjs の出力)を使う
#   node tools/make_icons.mjs > /tmp/fluke.json && python3 tools/make_icons.py /tmp/fluke.json
import json, sys, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

pts = json.load(open(sys.argv[1]))
OUT = 'assets/icons'

def lerp(a, b, t): return a + (b - a) * t
def mix(c1, c2, t): return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))
def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

SKY = [(0.0, hexc('#1c2f78')), (0.55, hexc('#7c6fa8')), (0.85, hexc('#f39a6a')), (1.0, hexc('#ffc27a'))]
SEA = [(0.0, hexc('#1a4c7e')), (1.0, hexc('#06223f'))]

def grad(stops, t):
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1: return mix(c0, c1, (t - t0) / max(1e-6, t1 - t0))
    return stops[-1][1]

def scene(w, h, horizon, fluke_cx, fluke_w, fluke_base):
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        c = grad(SKY, y / horizon) if y < horizon else grad(SEA, (y - horizon) / (h - horizon))
        d.line([(0, y), (w, y)], fill=c)
    # 夕日の光の道
    glow = Image.new('L', (w, h), 0)
    gd = ImageDraw.Draw(glow)
    for k in range(40):
        y = horizon + (h - horizon) * (k / 40) ** 1.6
        half = w * (0.02 + 0.10 * k / 40)
        gd.line([(w * 0.5 - half, y), (w * 0.5 + half, y)], fill=int(110 * (1 - k / 40)), width=max(1, h // 260))
    glow = glow.filter(ImageFilter.GaussianBlur(h / 200))
    img = Image.composite(Image.new('RGB', (w, h), hexc('#ffd59a')), img, glow)
    d = ImageDraw.Draw(img)
    # 尾びれ(うしろから見て、うしろのふちが上)。先は少し上に反る
    span = fluke_w
    chord = span / 0.33   # 尾びれのはば(体長の33%)を基準にした体長
    top, bottom = [], []
    for a, lead, trail in pts:
        lift = 0.06 * span * a ** 2
        for side in (1, -1):
            pass
    for s in (-1, 1):
        rng = pts if s == 1 else list(reversed(pts))
        for a, lead, trail in rng:
            x = fluke_cx + s * a * span / 2
            lift = 0.07 * span * a ** 2.2
            top.append((x, fluke_base - (trail - 0.40) * chord - lift))
            bottom.append((x, fluke_base - (lead - 0.40) * chord - lift))
    left = [p for p in top]   # 上のふち(左から右)
    # 上のふちを左→右、下のふちを右→左
    top_lr = sorted(top, key=lambda p: p[0])
    bot_lr = sorted(bottom, key=lambda p: p[0])
    poly = top_lr + list(reversed(bot_lr))
    body = hexc('#14171a')
    d.polygon(poly, fill=body)
    # 尾の付け根(水面へ)。上は細く、水面に近いほど太い
    wy = horizon + (h - horizon) * 0.28
    pw = span * 0.07
    yb = fluke_base - (0.415 - 0.40) * chord
    d.polygon([(fluke_cx - pw * 0.45, yb - 2), (fluke_cx + pw * 0.45, yb - 2), (fluke_cx + pw * 0.8, wy), (fluke_cx - pw * 0.8, wy)], fill=body)
    # 水面の白い泡
    d.ellipse([fluke_cx - span * 0.26, wy - span * 0.025, fluke_cx + span * 0.26, wy + span * 0.04], fill=hexc('#cfdde8'))
    d.ellipse([fluke_cx - span * 0.17, wy - span * 0.012, fluke_cx + span * 0.17, wy + span * 0.025], fill=hexc('#f4f8fb'))
    # 尾びれのふちから流れ落ちる水(先のほうと下のふちから、まばらに)
    import random
    rnd = random.Random(7)
    for k in range(18):
        a = 0.35 + 0.62 * rnd.random()
        s = rnd.choice((-1, 1))
        x = fluke_cx + s * a * span / 2
        lead = next(p for p in pts if p[0] >= a)[1]
        y0 = fluke_base - (lead - 0.40) * chord - 0.07 * span * a ** 2.2
        if rnd.random() < 0.45:
            # 細い水の筋
            L = span * (0.04 + 0.12 * rnd.random())
            d.line([(x, y0), (x, y0 + L)], fill=hexc('#e6f0f7'), width=max(1, int(span * 0.006)))
        else:
            yy = y0 + span * (0.02 + 0.16 * rnd.random())
            r = span * (0.004 + 0.006 * rnd.random())
            d.ellipse([x - r, yy - r, x + r, yy + r], fill=hexc('#e6f0f7'))
    return img

# アイコン(四角。角の丸めは端末がする)。大きく描いて縮める
big = scene(1024, 1024, 560, 512, 760, 500)
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (32, 'favicon-32.png')]:
    big.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}', optimize=True)
# 丸く切りとられても尾びれが切れないアイコン(まん中の8割に収める)
mask_big = scene(1024, 1024, 600, 512, 600, 560)
mask_big.resize((512, 512), Image.LANCZOS).save(f'{OUT}/icon-maskable-512.png', optimize=True)

# リンクを送ったときに出る絵(横長)
og = scene(1200, 630, 360, 940, 400, 300)
d = ImageDraw.Draw(og)
font_path = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
title = ImageFont.truetype(font_path, 76, index=0)
sub = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 34, index=0)
d.text((80, 170), 'クジラが見てる', font=title, fill=(255, 255, 255))
d.text((84, 280), '波の音と、ときどきクジラ。', font=sub, fill=(240, 244, 250))
og.save(f'{OUT}/og.png', optimize=True)
print('ok')
