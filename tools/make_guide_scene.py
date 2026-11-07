# 説明書の画面写真の背景に使う、海の絵(縦長のスマホの画面の大きさ)。アイコンと同じ描き方
import math, random
from PIL import Image, ImageDraw, ImageFilter
W, H = 780, 1688
def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(int(x + (y - x) * t) for x, y in zip(a, b))
img = Image.new('RGB', (W, H)); d = ImageDraw.Draw(img)
hz = int(H * 0.46)
for y in range(H):
    if y < hz:
        t = y / hz; c = mix(hexc('#2a5fd6'), hexc('#9cc1f2'), t ** 1.4)
    else:
        t = (y - hz) / (H - hz); c = mix(hexc('#1a66a8'), hexc('#06325a'), t ** 0.8)
    d.line([(0, y), (W, y)], fill=c)
# 波のきらめき
rnd = random.Random(3)
for k in range(260):
    y = hz + (H - hz) * rnd.random() ** 1.8
    x = rnd.random() * W; w = 6 + 30 * (y - hz) / (H - hz)
    d.line([(x, y), (x + w, y)], fill=mix(hexc('#2d7cc0'), hexc('#cfe4f7'), rnd.random() * 0.6), width=2)
# クジラの背中と背びれ、潮吹き
cx, cy = W * 0.52, hz + 120
body = hexc('#15181b')
# 水の上に出ている背中(上半分だけ)
d.chord([cx - 210, cy - 34, cx + 210, cy + 34], 180, 360, fill=body)
d.polygon([(cx + 40, cy - 26), (cx + 74, cy - 64), (cx + 90, cy - 22)], fill=body)
# 泡
for k in range(40):
    x = cx - 225 + rnd.random() * 450; y = cy - 2 + rnd.random() * 8; r = 3 + rnd.random() * 8
    d.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=hexc('#e8f2fa'))
spout = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(spout)
for k in range(220):
    t = rnd.random(); x = cx - 165 + (rnd.random() - 0.5) * (20 + 120 * t); y = cy - 30 - 230 * t
    r = 8 + 26 * t
    sd.ellipse([x - r, y - r, x + r, y + r], fill=int(120 * (1 - t * 0.6)))
spout = spout.filter(ImageFilter.GaussianBlur(10))
img = Image.composite(Image.new('RGB', (W, H), (245, 249, 252)), img, spout)
img.save('assets/guide/scene.jpg', quality=88)
print('ok')
