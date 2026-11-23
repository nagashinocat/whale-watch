# 最後の画面: 静かな海の上に、アプリのアイコンと言葉
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
import sys
W, H = 1080, 1920
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
MED = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
bg = Image.open(sys.argv[1]).convert('RGB').resize((W, H))
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(6))).enhance(0.55).convert('RGBA')
d = ImageDraw.Draw(bg)
icon = Image.open('/home/claude/whale-watch/assets/icons/icon-512.png').convert('RGBA').resize((260, 260))
mask = Image.new('L', (260, 260), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, 259, 259), radius=58, fill=255)
bg.paste(icon, ((W - 260) // 2, 520), mask)
def center(text, y, size, font=BOLD, fill=(255, 255, 255, 255)):
    f = ImageFont.truetype(font, size, index=0)
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)
center('クジラが、もっとリアルに。', 860, 72)
center('波の音と、ときどきクジラ。', 980, 52, MED, (225, 238, 248, 255))
center('ブラウザで、すぐに。', 1150, 46, MED, (225, 238, 248, 255))
center('インストール不要・無料', 1220, 46, MED, (225, 238, 248, 255))
center('#クジラが見てる', 1360, 50, BOLD, (170, 215, 245, 255))
bg.convert('RGB').save(sys.argv[2], quality=95)
