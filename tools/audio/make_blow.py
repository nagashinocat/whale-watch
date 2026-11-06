"""潮吹きの息の音を合成する(素材は使わない)。

使い方: python3 tools/audio/make_blow.py 出力.wav
クジラの息は、強く吐く「プシュー」(約1.5秒、低めの太い音に、しぶきの細かい音がまざる)と、
少し間をおいて大きく吸う「スーッ」(約1秒、吐く音より小さい)でできている。
音量は tools/audio/make_voice.sh でほかのクジラの声とそろえる。
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 32000
rng = np.random.default_rng(7)


def band(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)


def low(x, hi, order=2):
    return sosfilt(butter(order, hi, btype='low', fs=SR, output='sos'), x)


def noise(sec):
    return rng.standard_normal(int(SR * sec))


# 吐く: すばやく立ち上がって、ゆっくり消える
ex_len = 1.7
t = np.arange(int(SR * ex_len)) / SR
env = (1 - np.exp(-t / 0.035)) * np.exp(-t / 0.5)
wet = 1 + 0.35 * low(noise(ex_len), 25) / 0.05   # 水まじりのゆらぎ
wet = np.clip(wet, 0.4, 1.8)
body = band(noise(ex_len), 110, 1600) * env * wet
spray = band(noise(ex_len), 1800, 7000) * np.exp(-t / 0.22) * (1 - np.exp(-t / 0.01)) * 0.35
thump = np.sin(2 * np.pi * (85 - 30 * t) * t) * np.exp(-t / 0.1) * 0.5
exhale = body / np.max(np.abs(body)) + spray / np.max(np.abs(spray)) * 0.3 + thump

# 吸う: ふくらんでから止まる
in_len = 1.0
t2 = np.arange(int(SR * in_len)) / SR
env2 = np.sin(np.pi * np.clip(t2 / in_len, 0, 1)) ** 1.4 * (1 - np.exp(-(in_len - t2) / 0.04))
inhale = band(noise(in_len), 260, 1400) * env2
inhale = inhale / np.max(np.abs(inhale)) * 0.32

gap = np.zeros(int(SR * 0.35))
tail = np.zeros(int(SR * 0.4))
out = np.concatenate([exhale, gap, inhale, tail])
out = out / np.max(np.abs(out)) * 0.8
wavfile.write(sys.argv[1], SR, (out * 32767).astype(np.int16))
# 音量そろえ(始まりの勢いを残すため、フェードインはしない):
#   ffmpeg -i 生成.wav -af "highpass=f=30,aresample=16000" -ac 1 一時.wav
#   一時.wav を -26 LUFS にして、ピーク 0.7 で抑え、終わりの 0.25 秒だけフェードアウト → assets/audio/blow.wav
