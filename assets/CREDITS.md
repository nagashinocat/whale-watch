# 素材の出典とライセンス

アプリで使う素材を追加したら、ここに1行ずつ記録する。
ストアで配るアプリに使えるライセンスかどうかも確認しておく。

## 音 (`assets/audio/`)

| ファイル | 内容 | 元のページ | ライセンス | 作者 |
|---|---|---|---|---|
| humpback-song.mp3 | ザトウクジラの歌 | NOAA Fisheries「Sounds in the Ocean」 | パブリックドメイン(米国政府著作物) | NOAA |
| sperm-clicks.mp3 | マッコウクジラのクリック音 | (未定) | | |
| splash.wav | 水しぶき(ジャンプの着水) | https://freesound.org/people/Fission9/sounds/583348/ (Rock Splash) | CC0 | Fission9 |
| waves-cliff.wav | 遠くで岩に打ちよせる波(崖の上・上空) | https://freesound.org/s/156354 (oceanwaves-9) | CC0 | Rmutt |
| waves-surface.wav | 砂州に寄せる小さな波(水面) | https://freesound.org/people/plantmonkey/sounds/459813 (Waves on a sand bar) | CC0 | plantmonkey |

## 3Dモデル (`assets/models/`)

| ファイル | 内容 | 元のページ | ライセンス | 作者 |
|---|---|---|---|---|
| humpback.glb | ザトウクジラ(泳ぐ・潜る・ジャンプ) | (未定) | | |
| sperm_whale.glb | マッコウクジラ | (未定) | | |

## 画面に表示するクレジット

アプリのメニューには `src/main.js` の `CREDITS` に書いた文言が表示される。素材を追加したらそちらも更新する。

## 音の加工

波の音は、元の録音を次のように加工している(赤ちゃんを起こさないように、急に大きくならない音にするため)。

1. 大きな波の音だけをやさしく抑える(圧縮比 3、しきい値 -26dB)
2. モノラル・32kHz にする(ファイルを小さくするため)
3. 音量を -24 LUFS にそろえ、ピークを -3dB 以下に抑える
4. 終わりの4秒と始まりの4秒を重ねて、くり返しても継ぎ目が聞こえないようにする
