// みんなのギャラリーのデータ置き場(Supabase)の住所と鍵。
// 空のあいだは、ギャラリーのボタンは出ない。key は「公開してよい鍵」(anon / publishable key)を入れる。
// この鍵でできるのは、表と写真置き場に決めた「読む」「新しく載せる」だけ(tools/gallery_setup.sql で決めている)。
export const GALLERY_CONFIG = Object.freeze({
  url: '',   // 例: 'https://abcdefghijkl.supabase.co'
  key: '',
});
