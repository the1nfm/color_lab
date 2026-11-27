import { VirtualGrid } from "./VirtualGrid";
import { GridPainter, Layer } from "./GridPainter";
import { stepLine, ddaLine, bresenhamLine, wuLine, bresenhamCircle, pittewayEllipse, traceLine } from "./RasterEngine";
import { runBenchmark } from "./Benchmark";
import { drawChart } from "./Chart";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const num = (id: string) => Math.round(Number($<HTMLInputElement>(id).value) || 0);
const canvas = $<HTMLCanvasElement>("grid");
const painter = new GridPainter(canvas);
const SZ = 801;
let layers: Layer[] = [];
let markers: [number, number][] = [];
let clickIdx = 0;

const mk = (color: string): Layer => ({ grid: new VirtualGrid(SZ, SZ), color });
const redraw = () => painter.render(layers, markers);
const setMarkers = () => { markers = [[num("x0"), num("y0")], [num("x1"), num("y1")]]; };

function timeIt(name: string, f: () => void): string {   // замер одного вызова (повтор для разрешения таймера)
  const n = 2000, t0 = performance.now(); for (let i = 0; i < n; i++) f();
  return `${name}: ${(((performance.now() - t0) / n) * 1000).toFixed(2)} мкс/вызов`;
}

$("drawLine").onclick = () => {
  const x0 = num("x0"), y0 = num("y0"), x1 = num("x1"), y1 = num("y1");
  const a = $<HTMLSelectElement>("lineAlgo").value;
  const defs: [string, string, typeof stepLine, string][] = [
    ["step", "Пошаговый", stepLine, "#8e44ad"], ["dda", "ЦДА", ddaLine, "#d62728"],
    ["bres", "Брезенхем", bresenhamLine, "#1f77b4"], ["wu", "Ву", wuLine, "#000000"],
  ];
  layers = []; let info = "";
  for (const [id, name, f, col] of defs) {
    if (a !== "all" && a !== id) continue;
    const L = mk(col); f(x0, y0, x1, y1, L.grid); layers.push(L);
    info += timeIt(name, () => f(x0, y0, x1, y1, L.grid)) + "\n";
  }
  setMarkers();
  $("trace").textContent = traceLine(x0, y0, x1, y1) + "\n" + info;
  redraw();
};
$("drawCircle").onclick = () => {
  const L = mk("#1f77b4"); const cx = num("cx"), cy = num("cy"), r = Math.max(0, num("rad"));
  bresenhamCircle(cx, cy, r, L.grid); layers = [L]; markers = [[cx, cy]];
  $("trace").textContent = `Окружность центр (${cx},${cy}), R=${r}\nd0 = 3-2R = ${3 - 2 * r}; если d<0: d+=4x+6, иначе d+=4(x-y)+10, y--\nЗакрашено клеток (с учётом повторов симметрии): ${L.grid.painted}`;
  redraw();
};
$("drawEllipse").onclick = () => {
  const L = mk("#ff7f0e"); const a = Math.max(0, num("ea")), b = Math.max(0, num("eb"));
  pittewayEllipse(num("cx"), num("cy"), a, b, L.grid); layers = [L]; markers = [];
  $("trace").textContent = `Эллипс a=${a}, b=${b}; целочисленная решающая функция F=b²x²+a²y²−a²b² (×4)\n${timeIt("Питвей", () => pittewayEllipse(0, 0, a, b, L.grid))}`;
  redraw();
};
$("clear").onclick = () => { layers = []; markers = []; $("trace").textContent = ""; redraw(); };
$("reset").onclick = () => { painter.cx = 0; painter.cy = 0; painter.scale = 22; $<HTMLInputElement>("zoom").value = "22"; redraw(); };
$<HTMLInputElement>("zoom").oninput = e => { painter.scale = Number((e.target as HTMLInputElement).value); redraw(); };

let drag: { x: number; y: number; moved: boolean } | null = null;
canvas.onmousedown = e => { drag = { x: e.offsetX, y: e.offsetY, moved: false }; };
window.onmouseup = e => {
  if (drag && !drag.moved && e.target === canvas) {
    const [lx, ly] = painter.toLogical((e as MouseEvent).offsetX, (e as MouseEvent).offsetY);
    const [ix, iy] = clickIdx === 0 ? ["x0", "y0"] : ["x1", "y1"];
    $<HTMLInputElement>(ix).value = String(lx); $<HTMLInputElement>(iy).value = String(ly); clickIdx ^= 1;
    setMarkers(); redraw();
  }
  drag = null;
};
canvas.onmousemove = e => {
  const [lx, ly] = painter.toLogical(e.offsetX, e.offsetY);
  $("mouse").textContent = `Клетка: (${lx}, ${ly})  intensity=${layers.length ? layers[layers.length - 1].grid.get(lx, ly).toFixed(3) : "0"}`;
  if (drag) {
    if (Math.abs(e.offsetX - drag.x) + Math.abs(e.offsetY - drag.y) > 3) drag.moved = true;
    if (drag.moved) { painter.cx -= (e.offsetX - drag.x) / painter.scale; painter.cy += (e.offsetY - drag.y) / painter.scale; drag.x = e.offsetX; drag.y = e.offsetY; redraw(); }
  }
};
canvas.onwheel = e => {
  e.preventDefault(); painter.scale = Math.max(2, Math.min(60, painter.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  $<HTMLInputElement>("zoom").value = String(Math.round(painter.scale)); redraw();
};

$("bench").onclick = async () => {
  const btn = $<HTMLButtonElement>("bench"); btn.disabled = true;
  const res = await runBenchmark(s => ($("benchStatus").textContent = s));
  const box = $("charts"); box.innerHTML = "";
  const add = (t: string, xl: string, s: any) => {
    const c = document.createElement("canvas"); c.width = 440; c.height = 300; box.appendChild(c);
    drawChart(c, t, xl, "время, мс", s);
  };
  add("Отрезки: время от числа (L=300)", "число отрезков", res.counts);
  add("Отрезки: время от длины (N=20000)", "длина отрезка, px", res.lengths);
  add("Окружности: время от числа (R≤200)", "число окружностей", res.circCount);
  add("Окружности: время от R (N=20000)", "максимальный радиус", res.circRadius);
  $("trace").textContent = res.summary; btn.disabled = false;
};
redraw();
