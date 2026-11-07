#!/bin/sh
# 公開用に音を軽くする: wav(圧縮なし)から m4a(AAC)を作る。
# 波の音は細かいざわざわが多いので少し高めの質(96kbps)、ほかは64kbps。
# wav は、m4a を読めないブラウザのための予備として残す。
set -e
cd "$(dirname "$0")/../../assets/audio"
for f in *.wav; do
  case "$f" in waves-*) rate=96k ;; *) rate=64k ;; esac
  ffmpeg -v error -y -i "$f" -c:a aac -b:a "$rate" -movflags +faststart "${f%.wav}.m4a"
done
ls -l *.m4a
