// 本物の太陽と月の位置。three.js は使わない(テストからも使う)。
// 天文の計算をかんたんにした式を使っている(太陽は0.1度、月は1度くらいのずれ)。
// azimuth(方位)は北が0度、東が90度、南が180度、西が270度。elevation は地平線からの高さ(度)。

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = x => ((x % 360) + 360) % 360;

// 2000年1月1日12時(世界時)からの日数
const daysSinceJ2000 = date => date.getTime() / 86400000 + 2440587.5 - 2451545.0;

// 赤道座標(赤経・赤緯)から、その場所で見た高さと方位へ
function toHorizon(ra, dec, d, lat, lon) {
  const gmst = norm360(280.46061837 + 360.98564736629 * d);   // グリニッジの恒星時(度)
  const h = (gmst + lon - ra) * D2R;                         // 時角
  const la = lat * D2R, de = dec * D2R;
  const el = Math.asin(Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h), Math.tan(de) * Math.cos(la) - Math.sin(la) * Math.cos(h));
  return { elevation: el * R2D, azimuth: norm360(az * R2D) };
}

// 黄道座標(黄経・黄緯)から赤道座標へ
function eclipticToEquatorial(lon, lat, d) {
  const e = (23.439 - 0.0000004 * d) * D2R;
  const l = lon * D2R, b = lat * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: norm360(ra * R2D), dec: dec * R2D };
}

function sunLongitude(d) {
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  return norm360(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

// 太陽の高さと方位
export function sunPosition(date, lat, lon) {
  const d = daysSinceJ2000(date);
  const { ra, dec } = eclipticToEquatorial(sunLongitude(d), 0, d);
  return toHorizon(ra, dec, d, lat, lon);
}

// 月の高さと方位、光っている割合(0 が新月、1 が満月)、満ちていくところか
export function moonPosition(date, lat, lon) {
  const d = daysSinceJ2000(date);
  const L = 218.316 + 13.176396 * d;               // 平均黄経
  const M = (134.963 + 13.064993 * d) * D2R;       // 平均近点角
  const F = (93.272 + 13.229350 * d) * D2R;        // 緯度引数
  const Ms = (357.529 + 0.98560028 * d) * D2R;     // 太陽の平均近点角
  const D = (297.850 + 12.190749 * d) * D2R;       // 太陽との離角の平均
  // おもな揺れを足す(出差・二均差・年差)
  const lonM = norm360(L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms));
  const latM = 5.128 * Math.sin(F);
  const { ra, dec } = eclipticToEquatorial(lonM, latM, d);
  const pos = toHorizon(ra, dec, d, lat, lon);
  const elong = Math.acos(Math.cos(latM * D2R) * Math.cos((lonM - sunLongitude(d)) * D2R));
  return {
    ...pos,
    illumination: (1 - Math.cos(elong)) / 2,
    waxing: norm360(lonM - sunLongitude(d)) < 180,
  };
}

// 本物の太陽の高さを、このアプリの空の色の時刻(sunForTime の時刻)に直す。
// 同じ高さでも朝と夕方で空の色はちがうので、昇っているところか(rising)で分ける
export function equivalentHours(elevation, rising) {
  const x = Math.max(-1, Math.min(1, elevation / 60));
  const t = Math.asin(x);
  const theta = rising ? t : Math.PI - t;
  return (((6 + (theta * 24) / (2 * Math.PI)) % 24) + 24) % 24;
}
