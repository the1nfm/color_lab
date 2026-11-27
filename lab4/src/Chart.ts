export interface Series { name: string; color: string; pts: [number, number][]; }

export function drawChart(canvas: HTMLCanvasElement, title: string, xl: string, yl: string, series: Series[]): void {
  const c = canvas.getContext("2d")!, W = canvas.width, H = canvas.height;
  const m = { l: 60, r: 10, t: 28, b: 62 };
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  let mx = 0, my = 0;
  for (const s of series) for (const [x, y] of s.pts) { mx = Math.max(mx, x); my = Math.max(my, y); }
  if (mx === 0) mx = 1; if (my === 0) my = 1;
  const X = (x: number) => m.l + (x / mx) * (W - m.l - m.r), Y = (y: number) => H - m.b - (y / my) * (H - m.t - m.b);
  c.font = "12px Arial"; c.fillStyle = "#000"; c.textAlign = "center"; c.fillText(title, W / 2, 16);
  c.strokeStyle = "#ccc";
  for (let i = 0; i <= 5; i++) {
    const gx = X(mx * i / 5), gy = Y(my * i / 5);
    c.beginPath(); c.moveTo(gx, m.t); c.lineTo(gx, H - m.b); c.moveTo(m.l, gy); c.lineTo(W - m.r, gy); c.stroke();
    c.fillStyle = "#000"; c.textAlign = "center"; c.fillText(String(Math.round(mx * i / 5)), gx, H - m.b + 14);
    c.textAlign = "right"; c.fillText((my * i / 5).toFixed(1), m.l - 4, gy + 4);
  }
  c.textAlign = "center"; c.fillText(xl, W / 2, H - m.b + 30);
  c.save(); c.translate(12, H / 2); c.rotate(-Math.PI / 2); c.fillText(yl, 0, 0); c.restore();
  let lx = m.l;
  for (const s of series) {
    c.strokeStyle = s.color; c.lineWidth = 2; c.beginPath();
    s.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke();
    c.fillStyle = s.color; s.pts.forEach(([x, y]) => c.fillRect(X(x) - 2, Y(y) - 2, 4, 4));
    c.fillRect(lx, H - 14, 10, 10); c.fillStyle = "#000"; c.textAlign = "left"; c.fillText(s.name, lx + 14, H - 5); lx += 14 + c.measureText(s.name).width + 14;
  }
}
