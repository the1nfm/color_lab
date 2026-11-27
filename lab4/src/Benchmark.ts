import { VirtualGrid } from "./VirtualGrid";
import { IRasterTarget, stepLine, ddaLine, bresenhamLine, wuLine, bresenhamCircle, pittewayEllipse } from "./RasterEngine";
import { Series } from "./Chart";

const SIZE = 1024;
type LineFn = (a: number, b: number, c: number, d: number, t: IRasterTarget) => void;
const LINES: [string, string, LineFn][] = [
  ["Пошаговый", "#888", stepLine], ["ЦДА", "#d62728", ddaLine], ["Брезенхем", "#1f77b4", bresenhamLine], ["Ву", "#2ca02c", wuLine],
];
const tick = () => new Promise<void>(r => setTimeout(r, 0));

/** Случайные отрезки: равномерный угол => все 8 октантов. Генерация данных вне замера. */
function genSegments(n: number, len: number): Int32Array {
  const a = new Int32Array(n * 4), lim = SIZE / 2 - len / 2 - 2;
  for (let i = 0; i < n; i++) {
    const cx = (Math.random() * 2 - 1) * lim, cy = (Math.random() * 2 - 1) * lim, ang = Math.random() * 2 * Math.PI;
    const h = len / 2;
    a[4 * i] = Math.round(cx - h * Math.cos(ang)); a[4 * i + 1] = Math.round(cy - h * Math.sin(ang));
    a[4 * i + 2] = Math.round(cx + h * Math.cos(ang)); a[4 * i + 3] = Math.round(cy + h * Math.sin(ang));
  }
  return a;
}
function timeLines(g: VirtualGrid, f: LineFn, s: Int32Array): number {
  g.clear(); const n = s.length / 4, t0 = performance.now();
  for (let i = 0; i < n; i++) f(s[4 * i], s[4 * i + 1], s[4 * i + 2], s[4 * i + 3], g);
  return performance.now() - t0;
}
function genRadii(n: number, rmax: number): Int32Array {
  const r = new Int32Array(n), lim = SIZE / 2 - rmax - 2;
  for (let i = 0; i < n; i++) r[i] = 1 + Math.floor(Math.random() * rmax);
  void lim; return r;
}
function timeCircles(g: VirtualGrid, kind: "c" | "e", r: Int32Array): number {
  g.clear(); const t0 = performance.now();
  for (let i = 0; i < r.length; i++) {
    const cx = ((i * 7919) % 200) - 100, cy = ((i * 104729) % 200) - 100;   // детерминированные центры
    if (kind === "c") bresenhamCircle(cx, cy, r[i], g); else pittewayEllipse(cx, cy, r[i], Math.max(1, (r[i] * 0.6) | 0), g);
  }
  return performance.now() - t0;
}

export interface BenchResult { counts: Series[]; lengths: Series[]; circCount: Series[]; circRadius: Series[]; summary: string; }

export async function runBenchmark(status: (s: string) => void): Promise<BenchResult> {
  const g = new VirtualGrid(SIZE, SIZE);
  const best = (fn: () => number) => { fn(); return Math.min(fn(), fn(), fn()); };   // прогрев + минимум из 3
  const counts = LINES.map(([n, c]) => ({ name: n, color: c, pts: [] as [number, number][] }));
  const lengths = LINES.map(([n, c]) => ({ name: n, color: c, pts: [] as [number, number][] }));
  const NS = [10000, 25000, 50000, 75000, 100000];
  for (const n of NS) {
    status(`Отрезки: N=${n}, L=300`); await tick();
    const s = genSegments(n, 300);
    LINES.forEach(([, , f], k) => counts[k].pts.push([n, best(() => timeLines(g, f, s))]));
  }
  for (const L of [10, 50, 100, 200, 400, 600]) {
    status(`Отрезки: N=20000, L=${L}`); await tick();
    const s = genSegments(20000, L);
    LINES.forEach(([, , f], k) => lengths[k].pts.push([L, best(() => timeLines(g, f, s))]));
  }
  const circCount: Series[] = [{ name: "Брезенхем (окр.)", color: "#1f77b4", pts: [] }, { name: "Питвей (эллипс)", color: "#ff7f0e", pts: [] }];
  const circRadius: Series[] = [{ name: "Брезенхем (окр.)", color: "#1f77b4", pts: [] }, { name: "Питвей (эллипс)", color: "#ff7f0e", pts: [] }];
  for (const n of [10000, 20000, 30000, 40000, 50000]) {
    status(`Окружности: N=${n}, R≤200`); await tick();
    const r = genRadii(n, 200);
    circCount[0].pts.push([n, best(() => timeCircles(g, "c", r))]); circCount[1].pts.push([n, best(() => timeCircles(g, "e", r))]);
  }
  for (const R of [10, 25, 50, 100, 200, 400]) {
    status(`Окружности: N=20000, R≤${R}`); await tick();
    const r = genRadii(20000, R);
    circRadius[0].pts.push([R, best(() => timeCircles(g, "c", r))]); circRadius[1].pts.push([R, best(() => timeCircles(g, "e", r))]);
  }
  let summary = "Время, мс (100 000 отрезков, L=300):\n";
  counts.forEach(s => summary += `  ${s.name}: ${s.pts[s.pts.length - 1][1].toFixed(1)}\n`);
  summary += "50 000 окружностей R≤200:\n";
  circCount.forEach(s => summary += `  ${s.name}: ${s.pts[s.pts.length - 1][1].toFixed(1)}\n`);
  status("Готово");
  return { counts, lengths, circCount, circRadius, summary };
}
