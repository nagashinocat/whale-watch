"""ジャンプの音を合成する(素材は使わない)。

使い方: python3 tools/audio/make_breach.py 着水.wav 飛び出し.wav
着水: 体が水面を打つ「ドーン」という低く重い音(遠くまで届く)に、大きな水しぶきの音、
      そのあと高く上がった水が雨のように降ってくる音が続く(約4秒)。
飛び出し: 水を割って体が出てくる「ザバァ」という音(約1.5秒)。
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 32000
rng = np.random.default_rng(11)


def flt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-9)


# ---- 着水 ----
L = 4.2
t = np.arange(int(SR * L)) / SR
# ドーン: 低い音がすぐに立ち上がって、0.6秒ほどで消える。少し音程が下がる
boom = np.sin(2 * np.pi * (70 - 25 * np.clip(t / 0.5, 0, 1)) * t) * np.exp(-t / 0.28)
boom += 0.6 * norm(flt(noise(L), 'low', 160)) * np.exp(-t / 0.22)
boom *= 1 - np.exp(-t / 0.004)
# 水しぶき: 広い音のかたまりが、1秒ほどで弱まる
crash = norm(flt(noise(L), 'band', [250, 6000])) * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.01))
# 降ってくる水: 小さな粒の音がたくさん、1〜3.5秒
rain = np.zeros_like(t)
k = 0.6
while k < 3.6:
    k += rng.exponential(1 / (220 * np.exp(-(k - 0.8) / 1.4)))
    i = int(k * SR)
    if i >= len(t) - 400:
        break
    m = int(SR * rng.uniform(0.004, 0.015))
    rain[i:i + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 3)) * rng.uniform(0.2, 1)
rain = norm(flt(rain, 'band', [600, 7000]))
rain_env = np.clip((t - 0.5) / 0.4, 0, 1) * np.exp(-np.clip(t - 1.0, 0, None) / 1.1)
land = 1.0 * norm(boom) + 0.7 * crash + 0.35 * rain * rain_env
land = norm(land) * 0.85
fade = np.clip((L - t) / 0.3, 0, 1)
wavfile.write(sys.argv[1], SR, (land * fade * 32767).astype(np.int16))

# ---- 飛び出し ----
L2 = 1.6
t2 = np.arange(int(SR * L2)) / SR
swell = np.clip(t2 / 0.25, 0, 1) * np.exp(-np.clip(t2 - 0.3, 0, None) / 0.45)
rush = norm(flt(noise(L2), 'band', [180, 3500])) * swell
gurgle = norm(flt(noise(L2), 'low', 300)) * swell * (1 + 0.5 * np.sin(2 * np.pi * 9 * t2))
rise = norm(rush + 0.5 * gurgle) * 0.7 * np.clip((L2 - t2) / 0.2, 0, 1)
wavfile.write(sys.argv[2], SR, (rise * 32767).astype(np.int16))
# 音量そろえ(始まりの勢いを残すため、フェードインはしない。低い音を残すため 22kHz):
#   着水: -22 LUFS・ピーク 0.85 → assets/audio/breach.wav
#   飛び出し: -27 LUFS・ピーク 0.6 → assets/audio/breach-rise.wav
