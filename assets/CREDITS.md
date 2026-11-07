# 素材の出典とライセンス

アプリで使う素材を追加したら、ここに1行ずつ記録する。
ストアで配るアプリに使えるライセンスかどうかも確認しておく。

## 音 (`assets/audio/`)

| ファイル | 内容 | 元のページ | ライセンス | 作者 |
|---|---|---|---|---|
| humpback-song.wav | ザトウクジラの歌(約50秒) | NOAA Fisheries「Sounds in the Ocean」 https://www.fisheries.noaa.gov/s3/2023-04/Meno-song-NOAA-PAGroup-13-humpback-clip.mp3 | パブリックドメイン(米国政府著作物) | NOAA Fisheries Passive Acoustics Group |
| humpback-call.wav | ザトウクジラの短い鳴き声(約8秒、アメリカ領サモア) | NOAA PMEL Acoustics Program https://pmel.noaa.gov/acoustics/multimedia.html (HB-ship-AMSNP.wav) | 公開情報・自由に配布可(出典「NOAA PMEL Acoustics Program」とページのURLを記載すること) | NOAA PMEL |
| sperm-clicks.wav | マッコウクジラのクリック音(約6秒) | NOAA Fisheries「Sounds in the Ocean」(Phma-clicks-NOAA-PAGroup-01-sperm-clip.mp3) | パブリックドメイン(米国政府著作物) | NOAA Fisheries Passive Acoustics Group |
| splash.wav | 水しぶき(ジャンプの着水) | https://freesound.org/people/Fission9/sounds/583348/ (Rock Splash) | CC0 | Fission9 |
| waves-cliff.wav | 遠くで岩に打ちよせる波(崖の上・上空) | https://freesound.org/s/156354 (oceanwaves-9) | CC0 | Rmutt |
| waves-surface.wav | 砂州に寄せる小さな波(水面) | https://freesound.org/people/plantmonkey/sounds/459813 (Waves on a sand bar) | CC0 | plantmonkey |
| blow.wav | 潮吹きの息の音(吐く・吸う、約3秒) | このアプリで合成 `tools/audio/make_blow.py` | 自作(素材なし) | — |
| bubbles.wav | 泡の網の泡がはじける音(約10秒) | このアプリで合成 `tools/audio/make_bubbles.py` | 自作(素材なし) | — |
| breach.wav | ジャンプの着水の「ドーン」と水しぶき・降ってくる水(約4秒) | このアプリで合成 `tools/audio/make_breach.py` | 自作(素材なし) | — |
| breach-rise.wav | ジャンプで水を割って体が出てくる音(約1.5秒) | このアプリで合成 `tools/audio/make_breach.py` | 自作(素材なし) | — |
| tail-slap.wav | 尾びれで水面をたたく「バシーン」(約2.5秒) | このアプリで合成 `tools/audio/make_slap.py` | 自作(素材なし) | — |
| pec-slap.wav | 胸びれで水面をたたく「ベチャン」(約1.8秒) | このアプリで合成 `tools/audio/make_slap.py` | 自作(素材なし) | — |

## 公開用の軽い音

公開するページでは、上の wav から作った m4a(AAC)を使う(`tools/audio/compress.sh`)。
m4a を読めないブラウザでは、同じ名前の wav を読む。ライセンスは元の wav と同じ。

## 3Dモデル

ザトウクジラとマッコウクジラの形は、このアプリの中で計算して作っている(`src/logic/whaleShape.js`)。外部のモデルは使っていない。

## 画面に表示するクレジット

アプリのメニューには `src/main.js` の `CREDITS` に書いた文言が表示される。素材を追加したらそちらも更新する。

## 音の加工

波の音は、元の録音を次のように加工している(赤ちゃんを起こさないように、急に大きくならない音にするため)。

1. 大きな波の音だけをやさしく抑える(圧縮比 3、しきい値 -26dB)
2. モノラル・32kHz にする(ファイルを小さくするため)
3. 音量を -24 LUFS にそろえ、ピークを -3dB 以下に抑える
4. 終わりの4秒と始まりの4秒を重ねて、くり返しても継ぎ目が聞こえないようにする

クジラの声は `tools/audio/make_voice.sh` で、モノラル16kHzにして音量をそろえている
(歌 -26 LUFS、短い鳴き声 -27 LUFS、マッコウクジラ -30 LUFS。マッコウクジラは音の角を丸めるため 5kHz より高い音を落としている)。
