# 宣伝動画を、シーンごとに1つのファイルにして書き出し、つなげて音をのせる
import subprocess, os, sys
from playwright.sync_api import sync_playwright
S = sys.argv[1]
PFX = 'en-' if len(sys.argv) > 2 and 'en' in sys.argv[2] else ''
FPS = 30
enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1080, 'height': 1920})
    pg.goto('http://localhost:8790/' + (sys.argv[2] if len(sys.argv) > 2 else 'video.html')); pg.wait_for_function('window.ready', timeout=20000)
    scenes = pg.evaluate('SCENES')
    names = []
    for k, sc in enumerate(scenes):
        out = f'{S}/{PFX}scene{k}.mp4'
        tmp = f'{S}/{PFX}scene{k}.tmp.mp4'
        n = round((sc['to'] - sc['from']) * FPS)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', *enc, tmp], stdin=subprocess.PIPE)
        for i in range(n):
            pg.evaluate(f"frame({sc['from'] + i / FPS})")
            ff.stdin.write(pg.screenshot(type='jpeg', quality=92))
        ff.stdin.close()
        assert ff.wait() == 0
        os.replace(tmp, out); names.append(out)
        print('scene', k, n, 'frames', flush=True)
    b.close()
with open(f'{S}/{PFX}list.txt', 'w') as f:
    for n in names: f.write(f"file '{n}'\n")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{S}/{PFX}list.txt', '-c', 'copy', f'{S}/{PFX}silent.mp4'], check=True)
print('ok')
