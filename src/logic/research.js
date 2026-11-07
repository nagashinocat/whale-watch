// 研究者ごっこ: 海で撮った尾びれの写真が、図鑑のどの子かを当てる(本物の研究と同じ見分け方)。
// three.js も画面も使わない(テストからも使う)。
//
// 調べてわかったこと
//   ・研究者は、尾びれの裏の模様と傷あとで、ザトウクジラを1頭ずつ見分ける(人の指紋のように使える)
//   ・Happywhale のように、一般の人が撮った尾びれの写真を集めて、AI と人で照らし合わせる取り組みがあり、
//     何万頭ものクジラが見分けられている
//   ・海で撮った写真は、角度がかたむいていたり、暗かったり、しぶきがかかっていたりする

export const RESEARCH = Object.freeze({
  storageKey: 'whale-ocean-research',
  minWhales: 3,      // 図鑑に3頭以上いると遊べる
  choices: 3,        // えらぶ数
  ranks: Object.freeze([
    { at: 0, ja: '見習い研究員', en: 'Apprentice' },
    { at: 5, ja: '研究員', en: 'Researcher' },
    { at: 15, ja: '主任研究員', en: 'Lead researcher' },
    { at: 30, ja: 'クジラ博士', en: 'Whale scientist' },
  ]),
});

// 1問ぶん: 正解の子・えらぶ子(まぜた順)・写真の写り方(かたむき・大きさ・ずれ・暗さ・しぶき)
export function researchRound(entries, rng = Math.random) {
  if (entries.length < RESEARCH.minWhales) return null;
  const target = entries[Math.floor(rng() * entries.length)];
  // まちがえやすいように、尾びれの白さが近い子を先にえらぶ
  const others = entries.filter(e => e.id !== target.id)
    .map(e => ({ e, d: Math.abs((e.category ?? 3) - (target.category ?? 3)) + rng() * 1.5 }))
    .sort((a, b) => a.d - b.d).slice(0, RESEARCH.choices - 1).map(x => x.e);
  const choices = [target, ...others];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  const photo = {
    rot: (rng() - 0.5) * 0.4,            // かたむき(ラジアン)
    zoom: 1.05 + rng() * 0.3,
    shift: (rng() - 0.5) * 0.16,          // 横のずれ(幅の割合)
    dark: 0.1 + rng() * 0.3,              // 暗さ
    spray: Math.floor(rng() * 40),        // しぶきの粒の数
    seed: Math.floor(rng() * 1e9),
  };
  return { answer: target.id, choices: choices.map(e => e.id), photo };
}

export function loadResearch(storage) {
  try {
    const v = JSON.parse(storage.getItem(RESEARCH.storageKey) || 'null');
    const n = x => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    return { played: n(v?.played), correct: n(v?.correct), streak: n(v?.streak), best: n(v?.best) };
  } catch {
    return { played: 0, correct: 0, streak: 0, best: 0 };
  }
}
export function saveResearch(storage, s) {
  try { storage.setItem(RESEARCH.storageKey, JSON.stringify(s)); } catch { /* 保存できなくても続ける */ }
}

// こたえたあとの記録
export function answerResearch(s, ok) {
  const streak = ok ? s.streak + 1 : 0;
  return { played: s.played + 1, correct: s.correct + (ok ? 1 : 0), streak, best: Math.max(s.best, streak) };
}

// 正解の数からきまる肩書きと、つぎの肩書きまでの数
export function rankOf(correct) {
  const list = RESEARCH.ranks;
  let k = 0;
  while (k + 1 < list.length && correct >= list[k + 1].at) k++;
  const next = list[k + 1];
  return { rank: list[k], next: next ? { rank: next, more: next.at - correct } : null };
}
