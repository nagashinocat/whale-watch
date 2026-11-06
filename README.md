# クジラの見える海(Web試作品)

波の音と海の定点カメラ映像を流しっぱなしにでき、ときどきクジラが現れるブラウザ用の試作品です。

## 動かし方

このフォルダで次のコマンドを実行し、ブラウザで `http://localhost:8000/` を開きます。
(ファイルを直接ダブルクリックで開くと、素材が読み込めないので動きません)

```
python3 -m http.server 8000
```

インターネットにつながっている必要があります(three.js と海のテクスチャをネットから読み込むため)。

### スマホで見る

パソコンで上のコマンドを動かしたまま、同じ Wi-Fi のスマホから `http://<パソコンのIPアドレス>:8000/` を開きます。

## 確認用の機能

- `http://localhost:8000/?debug=1` … 画面右上にボタンが出て、各クジラの出方をすぐ再生できる
- `http://localhost:8000/?debug=1&fast=1` … 自然に出てくる間隔が 1/30(1〜3分おき)になる

## 素材の置き場所

素材がないあいだも、海と画面は動きます(音がない・クジラが鳴き声だけになる)。

| 置く場所 | ファイル |
|---|---|
| `assets/audio/` | `waves-cliff.wav`(崖の上・上空) `waves-surface.wav` `humpback-song.mp3` `sperm-clicks.mp3` `splash.wav` |
| `assets/models/` | `humpback.glb`(ザトウクジラ) `sperm_whale.glb`(マッコウクジラ) |

素材を追加したら、出典とライセンスを `assets/CREDITS.md` に書き、`src/main.js` の `CREDITS` も更新します。

モデルの向きや大きさが合わないときは、`src/scene/whales.js` の `MODEL_FIX` の数値を変えます。

## 調整できる数値

出る間隔・出方の割合・音量の上限などは `src/logic/config.js` にまとまっています。

## テスト

```
npm test
```
