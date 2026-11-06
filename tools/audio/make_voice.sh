#!/bin/sh
# 使い方: make_voice.sh 入力 出力.wav 目標LUFS ピーク上限(0〜1) 追加フィルタ
# クジラの声を、モノラル16kHzにして音量をそろえ、始まりと終わりをなめらかにする。
set -e
IN="$1"; OUT="$2"; TARGET="$3"; LIMIT="$4"; EXTRA="$5"
TMP="$(dirname "$OUT")/.tmp_$(basename "$OUT")"
ffmpeg -v error -y -i "$IN" -af "highpass=f=30,${EXTRA}aresample=16000" -ac 1 -c:a pcm_s16le "$TMP"
I=$(ffmpeg -hide_banner -nostats -i "$TMP" -af ebur128 -f null - 2>&1 | grep -A2 "Integrated loudness" | grep "I:" | awk '{print $2}')
GAIN=$(echo "$TARGET - ($I)" | bc -l)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP")
OUTST=$(echo "$DUR - 0.6" | bc -l)
ffmpeg -v error -y -i "$TMP" -af "volume=${GAIN}dB,alimiter=limit=${LIMIT}:attack=1:release=150:level=disabled,afade=t=in:d=0.3,afade=t=out:st=${OUTST}:d=0.6" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT"
rm -f "$TMP"
