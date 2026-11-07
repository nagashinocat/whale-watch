// 図鑑の回遊の地図(北太平洋の西側)。いまの旅の道すじと、いまいる場所、前回の旅を描く
import { LAND, ISLETS, REGIONS, MAP_BOUNDS } from '../logic/northPacific.js';
import { ROUTE_HOME } from '../logic/migration.js';
import { tr } from '../logic/i18n.js';

const B = MAP_BOUNDS;
const K = Math.cos((40 * Math.PI) / 180);   // 緯度40度あたりで、たてよこの比をそろえる
export const MAP_ASPECT = ((B.north - B.south)) / ((B.east - B.west) * K);

// current: { path, point } いまの旅 / last: tripSummary() の結果(前回の旅)
export function drawMigrationMap(canvas, { current = null, last = null } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const X = lon => ((lon - B.west) / (B.east - B.west)) * W;
  const Y = lat => ((B.north - lat) / (B.north - B.south)) * H;
  const s = W / 600;   // 線や文字の太さの倍率
  // 海
  ctx.fillStyle = '#dbeef7';
  ctx.fillRect(0, 0, W, H);
  // 経線・緯線(10度ごと)
  ctx.strokeStyle = 'rgba(47, 93, 124, 0.12)';
  ctx.lineWidth = 1 * s;
  for (let lon = 120; lon <= 180; lon += 10) { ctx.beginPath(); ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), H); ctx.stroke(); }
  for (let lat = 20; lat <= 60; lat += 10) { ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(W, Y(lat)); ctx.stroke(); }
  // 陸と島
  ctx.fillStyle = '#efe3c6';
  ctx.strokeStyle = '#b9a57e';
  ctx.lineWidth = 1.2 * s;
  ctx.lineJoin = 'round';
  for (const poly of Object.values(LAND)) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const [lon, lat] of ISLETS) { ctx.beginPath(); ctx.arc(X(lon), Y(lat), 2.2 * s, 0, 7); ctx.fill(); ctx.stroke(); }
  // 地名
  ctx.font = `600 ${12 * s}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(70, 58, 36, 0.75)';
  ctx.textAlign = 'center';
  for (const r of REGIONS) if (r.label && r !== REGIONS[0]) ctx.fillText(tr(r.label), X(r.at[0]), Y(r.at[1]) + (r.at[1] > 50 ? -10 : 18) * s);

  const line = (pts, color, width, dash = []) => {
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash(dash.map(v => v * s));
    ctx.beginPath();
    pts.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
    ctx.stroke(); ctx.restore();
  };
  // 前回の旅(オレンジの点線)と、会いにもどってきた道
  if (last) {
    line(last.path, '#e0803a', 3, [7, 6]);
    line(last.back, '#e0803a', 2, [2, 6]);
  }
  // いまの旅(青い線)と、いまいる場所
  if (current) {
    line(current.path, 'rgba(255,255,255,0.9)', 6);
    line(current.path, '#1f6fa8', 3.2);
    const [lon, lat] = current.point;
    ctx.fillStyle = 'rgba(31, 111, 168, 0.22)';
    ctx.beginPath(); ctx.arc(X(lon), Y(lat), 14 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f6fa8'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(X(lon), Y(lat), 6.5 * s, 0, 7); ctx.fill(); ctx.stroke();
  }
  // あなたの海(沖縄)
  const [hx, hy] = [X(ROUTE_HOME[0]), Y(ROUTE_HOME[1])];
  ctx.fillStyle = '#d9534f'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.arc(hx, hy, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a2e2b'; ctx.font = `700 ${12.5 * s}px system-ui, sans-serif`; ctx.textAlign = 'left';
  ctx.fillText(tr({ ja: 'あなたの海', en: 'Your sea' }), hx + 10 * s, hy + 4 * s);
}
