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
| `assets/audio/` | `waves-cliff.wav`(崖の上・上空) `waves-surface.wav` `humpback-song.wav` `humpback-call.wav` `sperm-clicks.wav` `splash.wav` |

素材を追加したら、出典とライセンスを `assets/CREDITS.md` に書き、`src/main.js` の `CREDITS` も更新します。

クジラの形はファイルではなく、`src/logic/whaleShape.js` で計算して作っています。体の太さや胸びれの長さなどの比率は、このファイルの `WHALE_SPECS` にまとめてあります。

## 調整できる数値

出る間隔・出方の割合・音量の上限などは `src/logic/config.js` にまとまっています。

## テスト

```
npm test
```

## 公開する前に

1. 音を変えたら `tools/audio/compress.sh` で軽い m4a を作りなおす
2. `python3 tools/build_sw.py` で `sw.js`(電波がなくても動くための仕組み)を作りなおす(テストでも確かめる)
3. `npm test`
4. 公開するのは、このフォルダの `index.html` `about.html` `manifest.webmanifest` `sw.js` `src/` `assets/`

アイコンと、リンクを送ったときの絵は `tools/make_icons.py` で作る。
