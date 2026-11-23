# 字幕の画像(1080x1920、すける背景)を作る
from PIL import Image, ImageDraw, ImageFilter, ImageFont
W, H = 1080, 1920
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
MED = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'

def caption(path, main, chip=None, y=340):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    size = 74
    while True:   # 横はば 880 に収まる大きさにする(左右に余白を残す)
        f = ImageFont.truetype(BOLD, size, index=0)
        tw = d.textlength(main, font=f)
        if tw <= 880 or size <= 48: break
        size -= 2
    x = (W - tw) / 2
    # 文字のうしろに、うすい影(どんな背景でも読める)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + 4), main, font=f, fill=(0, 20, 40, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    im.alpha_composite(sh)
    d = ImageDraw.Draw(im)
    d.text((x, y), main, font=f, fill=(255, 255, 255, 255))
    if chip:
        cf = ImageFont.truetype(BOLD, 40, index=0)
        cw = d.textlength(chip, font=cf)
        cx, cy = (W - cw) / 2 - 28, y - 110
        d.rounded_rectangle((cx, cy, cx + cw + 56, cy + 68), radius=34, fill=(255, 255, 255, 235))
        d.text((cx + 28, cy + 6), chip, font=cf, fill=(10, 50, 85, 255))
    im.save(path)

caption('cap/A.png', '頭の上を、クジラが跳ぶ。', chip='アップデート')
caption('cap/B.png', 'ひねって、反って、大ジャンプ。')
caption('cap/C.png', '泡の網から、いっせいに。')
caption('cap/D.png', 'のどをふくらませて、ひと飲み。')
caption('cap/E.png', '目が合う、この近さ。')
print('ok')
