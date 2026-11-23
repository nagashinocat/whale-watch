# 「これまで」→「いま」: 同じ動きの2つのクジラを、左から右へ切りかえて見せる
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
W, H, N = 1080, 1920, 150
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
os.makedirs('fr_CMP', exist_ok=True)
ease = lambda x: (lambda t: t * t * (3 - 2 * t))(min(1, max(0, x)))
def label(im, text, alpha):
    if alpha <= 0: return im
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    f = ImageFont.truetype(BOLD, 56, index=0); tw = d.textlength(text, font=f)
    x, y = (W - tw) / 2, 1420
    d.rounded_rectangle((x - 36, y - 14, x + tw + 36, y + 84), radius=48, fill=(255, 255, 255, int(225 * alpha)))
    d.text((x, y), text, font=f, fill=(10, 50, 85, int(255 * alpha)))
    return Image.alpha_composite(im, lay)
for k in range(N):
    t = k / 30
    old = Image.open(f'cmp_old/f{k:05d}.jpg').convert('RGBA'); new = Image.open(f'cmp_new/f{k:05d}.jpg').convert('RGBA')
    p = ease((t - 2.0) / 0.6)
    edge = int(W * p)
    im = old.copy()
    if edge > 0: im.paste(new.crop((0, 0, edge, H)), (0, 0))
    if 0 < p < 1:   # 切りかえの線
        d = ImageDraw.Draw(im); d.rectangle((edge - 3, 0, edge + 3, H), fill=(255, 255, 255, 230))
    im = label(im, 'これまで', 1 - ease((t - 1.9) / 0.3))
    im = label(im, 'いま', ease((t - 2.6) / 0.3))
    im.convert('RGB').save(f'fr_CMP/f{k:05d}.jpg', quality=92)
print('ok')
