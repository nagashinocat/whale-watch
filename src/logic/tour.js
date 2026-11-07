// はじめて使う人への、ボタンの紹介(チュートリアル)。画面を暗くして、ボタンを1つずつ明るく照らして説明する。
// はじめてスタートを押したときに1回だけ出す。パネルの「使い方」から、いつでも見返せる。three.js も画面も使わない(テストからも使う)
import { tr } from './i18n.js';

export const TOUR = Object.freeze({ storageKey: 'whale-ocean-tour' });

// target: 照らすボタン(data 属性の名前)。null なら、まん中に説明だけ出す
// panel: このステップのとき、操作パネルを開いておく
export const TOUR_STEPS = Object.freeze([
  { id: 'hello', target: null, panel: false,
    text: { ja: 'ようこそ!ここは、クジラが見守る海です。海をタップすると、操作パネルが出たり消えたりします。ボタンをかんたんに紹介しますね', en: 'Welcome to a sea where whales keep watch. Tap the sea to show or hide the control panel. Here is a quick look at the buttons.' } },
  { id: 'sky', target: 'skybar', panel: true,
    text: { ja: '空の時間。バーを押すと、朝・昼・夕方・夜に変わります。「自動」は、いまの本物の空です', en: 'Time of day. Tap the bar for morning, day, evening or night. “Auto” follows the real sky.' } },
  { id: 'cams', target: 'cams', panel: true,
    text: { ja: '見る場所。崖の上・上空・間近の3つのカメラから選べます', en: 'Where to watch from: the cliff, the sky, or close up.' } },
  { id: 'book', target: 'zukan-open', panel: true,
    text: { ja: '図鑑。会えたクジラが、尾びれの模様で1頭ずつ記録されます。歌や、研究者ごっこもここに', en: 'Your Whale Book. Each whale you meet is recorded by its fluke pattern. Songs and the research game are here too.' } },
  { id: 'photo', target: 'photo', panel: true,
    text: { ja: '写真を撮るボタン。クジラが写ると、図鑑にのります', en: 'Take a photo. If a whale is in it, it goes into your Book.' } },
  { id: 'summon', target: 'summon', panel: true,
    text: { ja: 'クジラは30〜90分に1回くらい来ます。待てないときは「呼ぶ」を押してね', en: 'Whales come about once every 30–90 minutes. Can’t wait? Tap “Call”.' } },
  { id: 'timer', target: 'timer', panel: true,
    text: { ja: 'タイマーと、クジラが来る間隔。寝かしつけの「おやすみタイマー」もここです', en: 'Timers and how often whales come, including the sleep timer for bedtime.' } },
  { id: 'sound', target: 'sound', panel: true,
    text: { ja: '音量。水中マイクや、親子のささやきも、ここで切りかえます', en: 'Volume. Turn the hydrophone and mother–calf whispers on or off here.' } },
  { id: 'dark', target: 'dark', panel: true,
    text: { ja: '真っ暗画面。音はそのままで、画面だけ暗くします', en: 'Dark screen. The sound keeps playing while the screen goes dark.' } },
  { id: 'sleep', target: 'sleep', panel: true,
    text: { ja: 'おやすみモード。クジラの大きな声を止めて、波の音だけにします', en: 'Sleep mode. Loud whale calls stop and only the waves remain.' } },
  { id: 'help', target: 'help', panel: true, guide: true,
    text: { ja: 'この「使い方」から、いつでもこの説明を見返せます。くわしいガイドもどうぞ', en: 'Tap “How to use” anytime to see this again, or open the full guide.' } },
]);

export const tourText = step => tr(step.text);

export function loadTourDone(storage) {
  try { return storage.getItem(TOUR.storageKey) === 'done'; } catch { return false; }
}
export function markTourDone(storage) {
  try { storage.setItem(TOUR.storageKey, 'done'); } catch { /* 保存できなくても続ける */ }
}

// 照らすボタンが見つからない(かくれている)ステップはとばす
export function tourSteps(isAvailable = () => true) {
  return TOUR_STEPS.filter(s => s.target === null || isAvailable(s.target));
}
