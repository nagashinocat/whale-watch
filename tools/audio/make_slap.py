"""水面をたたく音を合成する(素材は使わない)。

使い方: python3 tools/audio/make_slap.py 尾びれ.wav 胸びれ.wav
尾びれ: 幅4mの尾びれが水面を打つ「バシーン」。とても速く立ち上がる鋭い音(遠くまで届く)に、
        短い低い音と、はね上がった水が落ちる音が続く(約2.5秒)。
胸びれ: 長い胸びれが水面を打つ「ベチャン」。尾びれより軽く、低い音が少ない(約1.8秒)。
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 32000
rng = np.random.default_rng(23)


def flt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)


def slap(L, crack_f, body_f, low_amt, crack_amt, splash_len, rain_amt):
    n = int(SR * L)
    t = np.arange(n) / SR
    w = rng.standard_normal(n)
    # たたいた瞬間の、鋭い「パシッ」(とても短い)
    crack = norm(flt(w, 'band', crack_f)) * np.exp(-t / 0.012) * (1 - np.exp(-t / 0.0007))
    # 平たいものが水を打つ「バン」(少し長い)
    body = norm(flt(rng.standard_normal(n), 'band', body_f)) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.002))
    low = np.sin(2 * np.pi * (95 - 30 * np.clip(t / 0.2, 0, 1)) * t) * np.exp(-t / 0.09) * low_amt
    # はね上がった水しぶき
    spl = norm(flt(rng.standard_normal(n), 'band', [400, 7000])) * np.exp(-t / splash_len) * np.clip(t / 0.03, 0, 1)
    # 落ちてくる水の粒
    rain = np.zeros(n)
    k = 0.25
    while k < L - 0.3:
        k += rng.exponential(1 / (160 * np.exp(-(k - 0.3) / 0.7)))
        i = int(k * SR)
        if i >= n - 300:
            break
        m = int(SR * rng.uniform(0.003, 0.012))
        rain[i:i + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 3)) * rng.uniform(0.2, 1)
    rain = norm(flt(rain, 'band', [800, 7000])) * rain_amt
    out = crack_amt * crack + 0.9 * body + low + 0.45 * spl + rain
    out = norm(out) * 0.85 * np.clip((L - t) / 0.25, 0, 1)
    return out


tail = slap(2.5, [1500, 9000], [200, 1800], 0.6, 1.0, 0.3, 0.3)
pec = slap(1.8, [2000, 9000], [350, 2600], 0.25, 0.8, 0.22, 0.22)
for path, x in [(sys.argv[1], tail), (sys.argv[2], pec)]:
    wavfile.write(path, SR, (x * 32767).astype(np.int16))
# 音量そろえ(始まりの鋭さを残すため、フェードインはしない。22kHz):
#   尾びれ: -21 LUFS・ピーク 0.85 → assets/audio/tail-slap.wav
#   胸びれ: -23 LUFS・ピーク 0.8 → assets/audio/pec-slap.wav
