#!/bin/sh
# 使い方: make_loop.sh 入力.wav 出力.wav 重ねる秒数 目標LUFS
# 1) 大きな波の音だけをやさしく抑え、モノラル32kHzにする 2) 音量をそろえる
# 3) 終わりと始まりを重ねて、くり返しても継ぎ目が聞こえないようにする
set -e
IN="$1"; OUT="$2"; XF="$3"; TARGET="$4"
TMP="$(dirname "$OUT")/.tmp_$(basename "$OUT")"
ffmpeg -v error -y -i "$IN" -af "acompressor=threshold=-26dB:ratio=3:attack=150:release=1200:makeup=1,aresample=32000" -ac 1 -c:a pcm_s16le "$TMP"
I=$(ffmpeg -hide_banner -nostats -i "$TMP" -af ebur128 -f null - 2>&1 | grep -A2 "Integrated loudness" | grep "I:" | awk '{print $2}')
GAIN=$(echo "$TARGET - ($I)" | bc -l)
ffmpeg -v error -y -i "$TMP" -af "volume=${GAIN}dB,alimiter=limit=0.6:attack=5:release=200:level=disabled" -ar 32000 -ac 1 -c:a pcm_s16le "$TMP.lv.wav"
python3 -I "$(dirname "$0")/loop.py" "$TMP.lv.wav" "$OUT" "$XF"
rm -f "$TMP" "$TMP.lv.wav"
