"""泡の網の「シュワシュワ」という音を合成する(素材は使わない)。

使い方: python3 tools/audio/make_bubbles.py 出力.wav
水面で泡がはじける小さな「ぷちっ」という音(高い音がすぐ消える)を、たくさん重ねる。
はじめは少なく、だんだん増えて、最後はまた減る(約10秒)。
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 32000
rng = np.random.default_rng(3)
L = 10.0
n = int(SR * L)
out = np.zeros(n)
t_all = np.arange(n) / SR
# はじける数(1秒あたり): 0〜3秒で増え、8秒から減る
rate = 30 + 110 * np.clip(t_all / 3, 0, 1) * np.clip((L - t_all) / 2, 0, 1)
t = 0.0
while t < L - 0.05:
    t += rng.exponential(1 / rate[int(t * SR)])
    if t >= L - 0.05:
        break
    f = rng.uniform(900, 4500)
    d = rng.uniform(0.006, 0.02)
    m = int(SR * d * 5)
    tt = np.arange(m) / SR
    pop = np.sin(2 * np.pi * f * (1 + 0.3 * tt / d) * tt) * np.exp(-tt / d) * rng.uniform(0.2, 1.0)
    i = int(t * SR)
    out[i:i + m] += pop[: n - i]
hiss = sosfilt(butter(2, [2500, 7000], btype='band', fs=SR, output='sos'), rng.standard_normal(n))
env = np.clip(t_all / 2.5, 0, 1) * np.clip((L - t_all) / 2, 0, 1)
out += hiss / np.max(np.abs(hiss)) * 0.12 * env
out = out / np.max(np.abs(out)) * 0.8
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
