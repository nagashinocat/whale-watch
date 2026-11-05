const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 時刻(0〜24の小数)から太陽の位置と画面の明るさを計算する。
// 6時に日の出、12時に最も高く(60度)、18時に日の入り、0時に最も低い。
export function sunForTime(hours) {
  const h = ((hours % 24) + 24) % 24;
  const elevation = 60 * Math.sin((2 * Math.PI * (h - 6)) / 24);
  const azimuth = 90 + h * 7.5; // 朝は東寄り、夕方は西寄り
  const exposure = 0.12 + (0.5 - 0.12) * smoothstep(-6, 10, elevation);
  // 日中の度合い。1 で晴れた昼の青空と青い海、0 に近いほど朝夕・夜の色
  const daylight = smoothstep(2, 25, elevation);
  return { elevation, azimuth, exposure, daylight, isNight: elevation < -4 };
}
