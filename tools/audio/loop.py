# 使い方: python3 loop.py 入力.wav 出力.wav 重ねる秒数
# 終わりの数秒と始まりの数秒を1サンプル単位で重ねる。
# 出力の最後のサンプルは元の (重ねる秒数) の直前、最初のサンプルはその直後になるので、
# くり返したときに途切れなくつながる。
import sys, wave, struct, math
src, dst, xf = sys.argv[1], sys.argv[2], float(sys.argv[3])
w = wave.open(src); sr = w.getframerate(); n = w.getnframes()
assert w.getnchannels() == 1 and w.getsampwidth() == 2
x = struct.unpack('<%dh' % n, w.readframes(n))
N = int(sr * xf)
body = list(x[N:n - N])
seam = []
for i in range(N):
    t = (i + 0.5) / N
    a, b = math.cos(t * math.pi / 2), math.sin(t * math.pi / 2)   # 同じ大きさのまま入れかわる
    v = x[n - N + i] * a + x[i] * b
    seam.append(max(-32768, min(32767, int(round(v)))))
out = body + seam
o = wave.open(dst, 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr)
o.writeframes(struct.pack('<%dh' % len(out), *out)); o.close()
