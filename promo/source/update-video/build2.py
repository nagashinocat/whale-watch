# シーンごとに字幕をのせた mp4 を作り、つなげて、音をのせる
import subprocess, os, glob
FPS = 30
ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS)]
A = '/home/claude/whale-watch/assets/audio/'
# (フレームのフォルダ, 字幕, 切り抜き x, y(高解像度のときだけ))
SCENES = [('fr_A', 'cap/A.png', None), ('fr_CMP', 'cap/CMP.png', None), ('fr_B', 'cap/B.png', 'scale')]
OUT = 'out2'
os.makedirs(OUT, exist_ok=True)
files, durs = [], []
for k, (fr, cap, crop) in enumerate(SCENES):
    n = len(glob.glob(f'{fr}/f*.jpg')); d = n / FPS
    v = 'scale=1080:1920:flags=lanczos,' if crop == 'scale' else f'crop=1080:1920:{crop[0]}:{crop[1]},' if crop else ''
    tmp, out = f'{OUT}/s{k}.tmp.mp4', f'{OUT}/s{k}.mp4'
    fc = (f'[0:v]{v}format=yuv420p,setsar=1[v];'
          f'[1:v]format=rgba,fade=in:st=0.15:d=0.35:alpha=1,fade=out:st={d - 0.45:.2f}:d=0.35:alpha=1[c];'
          f'[v][c]overlay=0:0:shortest=1,format=yuv420p[o]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{fr}/f%05d.jpg',
                    '-loop', '1', '-t', f'{d:.3f}', '-framerate', str(FPS), '-i', cap,
                    '-filter_complex', fc, '-map', '[o]', *ENC, tmp], check=True)
    os.replace(tmp, out); files.append(out); durs.append(d)
# 最後の画面(3.5秒、ふわっと出る)
subprocess.run(['python3', 'endcard.py', sorted(glob.glob('fr_F/f*.jpg'))[0], OUT + '/end.jpg'], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', OUT + '/end.jpg',
                '-vf', 'format=yuv420p,loop=-1:1,trim=duration=3.5,fade=in:st=0:d=0.5', *ENC, OUT + '/s5.tmp.mp4'], check=True)
os.replace(OUT + '/s5.tmp.mp4', OUT + '/s5.mp4'); files.append(OUT + '/s5.mp4'); durs.append(3.5)
with open(OUT + '/list.txt', 'w') as f:
    for p in files: f.write(f"file '{os.path.abspath(p)}'\n")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', OUT + '/list.txt', '-c', 'copy', OUT + '/silent.mp4'], check=True)
total = sum(durs); start = [sum(durs[:i]) for i in range(len(durs))]
print('scene starts', [round(s, 2) for s in start], 'total', round(total, 2))
# 音: 波の音を流しっぱなしにして、ジャンプや水しぶきの音をシーンに合わせてのせる
ev = [('breach-rise', start[0] + 0.5, 1.0), ('breach', start[0] + 3.0, 1.0),
      ('humpback-call', start[1] + 0.4, 0.8),
      ('breach-rise', start[2] + 0.0, 0.9), ('breach', start[2] + 2.6, 1.0)]
inputs = ['-i', A + 'waves-surface.m4a']
for name, _, _ in ev: inputs += ['-i', A + name + '.m4a']
parts = [f'[0:a]atrim=0:{total:.2f},volume=0.75,afade=out:st={total - 1.5:.2f}:d=1.5[bed]']
mix = ['[bed]']
for i, (name, at, g) in enumerate(ev, 1):
    ms = int(at * 1000)
    parts.append(f'[{i}:a]volume={g},adelay={ms}|{ms}[e{i}]'); mix.append(f'[e{i}]')
parts.append(f'{"".join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,alimiter=limit=0.95[a]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(parts), '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', OUT + '/audio.m4a'], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', OUT + '/silent.mp4', '-i', OUT + '/audio.m4a', '-map', '0:v', '-map', '1:a',
                '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', OUT + '/whale-watch_new-whale_ja.tmp.mp4'], check=True)
os.replace(OUT + '/whale-watch_new-whale_ja.tmp.mp4', OUT + '/whale-watch_new-whale_ja.mp4')
print('ok')
