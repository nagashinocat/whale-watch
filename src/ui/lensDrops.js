// 画面(カメラのレンズ)にかかる水しぶき。近くで大きな水しぶきが上がると、しずくがついて流れ落ちる。
// 画面の操作をじゃましないよう、さわれない一番上の層に描く。

export function createLensDrops() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '4' });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  let drops = [];
  let running = false;
  let last = 0;

  function resize() {
    const r = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * r);
    canvas.height = Math.round(window.innerHeight * r);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawDrop(d, fade) {
    const { x, y, r } = d;
    // しずくは向こうの景色をゆがめて映すので、ふちが明るく、なかがうっすら明るい
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.18 * fade})`);
    g.addColorStop(0.7, `rgba(220,235,245,${0.08 * fade})`);
    g.addColorStop(0.92, `rgba(255,255,255,${0.35 * fade})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (1 + d.stretch), 0, 0, Math.PI * 2);
    ctx.fill();
    // 小さな光の点
    ctx.fillStyle = `rgba(255,255,255,${0.55 * fade})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, Math.max(1, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }

  function frame(t) {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drops = drops.filter(d => (d.age += dt) < d.life);
    for (const d of drops) {
      // 大きなしずくほど速く流れ落ち、流れたあとが少し伸びる
      d.y += d.speed * dt;
      d.stretch = Math.min(0.8, d.stretch + d.speed * dt * 0.002);
      drawDrop(d, 1 - d.age / d.life);
    }
    if (drops.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  return {
    // strength: 0〜1
    splatter(strength) {
      if (strength <= 0) return;
      const n = Math.round(6 + 34 * strength);
      const scale = canvas.width / 400;
      for (let i = 0; i < n; i++) {
        const r = (4 + Math.random() ** 2 * 22 * strength) * scale;
        drops.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height * 0.85,
          r, speed: (r > 12 * scale ? 40 + Math.random() * 60 : Math.random() * 8) * scale,
          stretch: 0, age: -Math.random() * 0.25, life: 2.5 + Math.random() * 2,
        });
      }
      if (!running) { running = true; last = 0; requestAnimationFrame(frame); }
    },
  };
}
