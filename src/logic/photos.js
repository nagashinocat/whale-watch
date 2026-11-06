// アプリの中で撮った写真の決まり。three.js も、ブラウザの保存場所も使わない(テストからも使う)。
// 写真はこの端末のブラウザの中(IndexedDB)に保存する。保存する量をおさえるため、大きさと枚数に上限がある

export const PHOTOS = Object.freeze({
  max: 60,          // とっておく枚数(多すぎたら古いものから消す)
  maxWidth: 1280,   // 横の大きさの上限(ピクセル)
  quality: 0.86,    // JPEG のきれいさ
});

// 枚数の上限をこえた分の、古い写真の番号
export function photosToDrop(list, max = PHOTOS.max) {
  if (list.length <= max) return [];
  return [...list].sort((a, b) => a.time - b.time).slice(0, list.length - max).map(p => p.id);
}

// そのクジラが写っている写真(新しい順)
export function photosOf(list, whaleId) {
  return list.filter(p => p.whales?.includes(whaleId)).sort((a, b) => b.time - a.time);
}

// 写真の説明: 「11月6日 21:05 ・ ユキ、ポチ」
export function photoCaption(photo, nameOf) {
  const d = new Date(photo.time);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const names = (photo.whales ?? []).map(nameOf).filter(Boolean);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm} ・ ${names.length ? names.join('、') : '海'}`;
}
