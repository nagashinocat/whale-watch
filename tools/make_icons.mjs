// アイコンと共有用の絵に使う、尾びれの形(アプリのクジラと同じ式)を書き出す
import { flukeOutline } from '../src/logic/whaleShape.js';
const pts = [];
for (let i = 0; i <= 200; i++) { const a = i / 200; const o = flukeOutline('humpback', a); pts.push([a, o.leading, o.trailing]); }
console.log(JSON.stringify(pts));
