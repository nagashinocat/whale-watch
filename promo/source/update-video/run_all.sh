#!/bin/bash
cd /home/claude/promo
srv(){ (curl -s -o /dev/null localhost:8765/ || (cd /home/claude/whale-watch && nohup python3 -m http.server 8765 >/dev/null 2>&1 &)); sleep 1; }
srv; TRIG='y>-17&&y>pv&&y<-5' SEED=0 node cap.js overhead 3 1.5 6.9 30 fr_A 1080 1920 > log_A.txt 2>&1
srv; TRIG='y>-4&&y>pv' node cap.js bigBreach 3 0.2 5.0 30 fr_B 1620 2880 > log_B.txt 2>&1
srv; TRIG='y>-4&&y>pv' node cap.js bubbleNet 6 2.0 6.5 30 fr_C 1620 2880 > log_C.txt 2>&1
srv; TRIG='y>-4&&y>pv' node cap.js feeding 3 4.0 8.0 30 fr_D 1620 2880 > log_D.txt 2>&1
srv; TRIG='y>-3&&y>pv' SEED=0 node cap.js eyeContact 6 5.0 9.0 30 fr_E 1080 1920 > log_E.txt 2>&1
srv; SEED=0 node cap.js overhead 3 1.0 1.04 30 fr_F 1080 1920 > log_F.txt 2>&1
echo ALLDONE > done.txt
