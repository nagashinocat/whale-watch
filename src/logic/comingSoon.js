// 「もうすぐクジラが来てくれるかも?」の知らせ。three.js も画面も使わない(テストからも使う)。
//
// ・アプリを使っていないとき(ほかのタブやアプリを見ている・画面に出したまましばらく触っていない)に、
//   自然に来るクジラの1分前くらいに、1頭につき1回だけ知らせる
// ・裏にあるときは通知(画面のすみに出るお知らせ)、画面に出ているときはアプリの中に出す
// ・知らせてから5分のあいだ触らなかったら、はじめのページにもどす
// ・おやすみモード・タイマー・おやすみタイマーのあいだは知らせない(寝かしつけのじゃまをしない)
// ブラウザのしくみで、スマホでほかのアプリに切りかえたり画面を消したりすると、アプリは止まるので知らせられない

export const COMING = Object.freeze({
  leadMs: 60 * 1000,          // クジラが来るどれくらい前に知らせるか
  windowMs: 75 * 1000,        // この時間より近くなったら知らせる(裏では1分に1回しか動かないことがあるので、少し広め)
  lateMs: 5 * 1000,           // これより近いと、もう間に合わないので知らせない
  idleMs: 2 * 60 * 1000,      // 画面に出ているとき、これだけ触っていなければ「使っていない」
  backAfterMs: 5 * 60 * 1000, // 知らせてから、これだけ触らなかったら、はじめのページにもどす
  text: Object.freeze({ ja: 'もうすぐクジラが来てくれるかも?', en: 'A whale may be coming soon…' }),
  title: Object.freeze({ ja: 'クジラが見てる', en: 'Whale Watch' }),
});

// 知らせるか、どう知らせるか。'notify'(通知)・'hint'(アプリの中に出す)・null(知らせない)
// nextAt: 自然にクジラが来る予定の時刻(来ないときは null) / lastFor: 前に知らせたクジラの nextAt
// blocked: おやすみモード・タイマーなどで知らせないとき / hidden: アプリが裏にある / lastTouch: 最後に触った時刻
export function heraldWay({ enabled, blocked, now, nextAt, lastFor = null, hidden, lastTouch }) {
  if (!enabled || blocked || nextAt == null || nextAt === lastFor) return null;
  const left = nextAt - now;
  if (left > COMING.windowMs || left < COMING.lateMs) return null;
  if (hidden) return 'notify';
  if (now - lastTouch >= COMING.idleMs) return 'hint';
  return null;   // 使っているところなので、知らせなくても見られる
}

// はじめのページにもどすか: 知らせたあと、一度も触らずに5分たった
export function shouldGoBack({ now, heraldAt, lastTouch }) {
  return heraldAt != null && lastTouch < heraldAt && now - heraldAt >= COMING.backAfterMs;
}
