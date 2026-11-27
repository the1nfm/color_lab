/** Чистые алгоритмы растеризации. Никаких примитивов рисования: только SetPixel. */
export interface IRasterTarget {
  setPixel(x: number, y: number, intensity: number): void;
}

const rnd = (v: number): number => Math.floor(v + 0.5);

/** Пошаговый алгоритм: y = y0 + k*(x-x0), шаг по ведущей оси (все октанты). */
export function stepLine(x0: number, y0: number, x1: number, y1: number, t: IRasterTarget): void {
  const dx = x1 - x0, dy = y1 - y0;
  if (dx === 0 && dy === 0) { t.setPixel(x0, y0, 1); return; }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const k = dy / dx, s = dx > 0 ? 1 : -1;
    for (let x = x0; x !== x1 + s; x += s) t.setPixel(x, rnd(y0 + k * (x - x0)), 1);
  } else {
    const k = dx / dy, s = dy > 0 ? 1 : -1;
    for (let y = y0; y !== y1 + s; y += s) t.setPixel(rnd(x0 + k * (y - y0)), y, 1);
  }
}

/** ЦДА: L = max(|dx|,|dy|), приращения dx/L, dy/L, накопление во float. */
export function ddaLine(x0: number, y0: number, x1: number, y1: number, t: IRasterTarget): void {
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.max(Math.abs(dx), Math.abs(dy));
  if (L === 0) { t.setPixel(x0, y0, 1); return; }
  const xi = dx / L, yi = dy / L;
  let x = x0, y = y0;
  for (let i = 0; i <= L; i++) {
    t.setPixel(rnd(x), rnd(y), 1);
    x += xi; y += yi;
  }
}

/** Брезенхем (линия), обобщённая целочисленная форма: работает во всех 8 октантах без ветвления по октантам. */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number, t: IRasterTarget): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    t.setPixel(x0, y0, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err << 1;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Брезенхем (окружность), метод средней точки, симметрия по 8 октантам. */
export function bresenhamCircle(cx: number, cy: number, r: number, t: IRasterTarget): void {
  if (r === 0) { t.setPixel(cx, cy, 1); return; }
  let x = 0, y = r, d = 3 - 2 * r;
  while (y >= x) {
    t.setPixel(cx + x, cy + y, 1); t.setPixel(cx - x, cy + y, 1);
    t.setPixel(cx + x, cy - y, 1); t.setPixel(cx - x, cy - y, 1);
    t.setPixel(cx + y, cy + x, 1); t.setPixel(cx - y, cy + x, 1);
    t.setPixel(cx + y, cy - x, 1); t.setPixel(cx - y, cy - x, 1);
    if (d < 0) d += 4 * x + 6;
    else { d += 4 * (x - y) + 10; y--; }
    x++;
  }
}

const fpart = (v: number) => v - Math.floor(v);
const rfpart = (v: number) => 1 - fpart(v);

/** Алгоритм Ву: яркость двух соседних пикселей = доле покрытия (дробная часть координаты). */
export function wuLine(x0: number, y0: number, x1: number, y1: number, t: IRasterTarget): void {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
  if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
  const plot = (x: number, y: number, c: number) => { if (c > 0) steep ? t.setPixel(y, x, c) : t.setPixel(x, y, c); };
  const dx = x1 - x0, dy = y1 - y0;
  const g = dx === 0 ? 1 : dy / dx;
  // начало
  let xe = rnd(x0), ye = y0 + g * (xe - x0), xg = rfpart(x0 + 0.5);
  const xp1 = xe, yp1 = Math.floor(ye);
  plot(xp1, yp1, rfpart(ye) * xg); plot(xp1, yp1 + 1, fpart(ye) * xg);
  let inter = ye + g;
  // конец
  xe = rnd(x1); ye = y1 + g * (xe - x1); xg = fpart(x1 + 0.5);
  const xp2 = xe, yp2 = Math.floor(ye);
  plot(xp2, yp2, rfpart(ye) * xg); plot(xp2, yp2 + 1, fpart(ye) * xg);
  for (let x = xp1 + 1; x < xp2; x++) {
    const yi = Math.floor(inter);
    plot(x, yi, rfpart(inter)); plot(x, yi + 1, fpart(inter));
    inter += g;
  }
}

/**
 * Целочисленный алгоритм типа Питвея (Pitteway) для конического сечения — эллипса
 * x²/a² + y²/b² = 1. Решающая функция F(x,y)=b²x²+a²y²−a²b² вычисляется
 * инкрементально, все величины умножены на 4, чтобы не было дробей (a²/4, (x+½)²).
 * Две области: |наклон| < 1 (шаг по x) и > 1 (шаг по y); симметрия 4 квадрантов.
 */
export function pittewayEllipse(cx: number, cy: number, a: number, b: number, t: IRasterTarget): void {
  const a2 = a * a, b2 = b * b;
  let x = 0, y = b;
  let dx = 2 * b2 * x, dy = 2 * a2 * y;
  let d = 4 * b2 - 4 * a2 * b + a2;               // 4*F(1, b-½)
  const plot4 = (px: number, py: number) => {
    t.setPixel(cx + px, cy + py, 1); t.setPixel(cx - px, cy + py, 1);
    t.setPixel(cx + px, cy - py, 1); t.setPixel(cx - px, cy - py, 1);
  };
  while (dx < dy) {
    plot4(x, y);
    x++; dx += 2 * b2;
    if (d < 0) d += 4 * (dx + b2);
    else { y--; dy -= 2 * a2; d += 4 * (dx - dy + b2); }
  }
  d = b2 * (2 * x + 1) * (2 * x + 1) + 4 * a2 * (y - 1) * (y - 1) - 4 * a2 * b2; // 4*F(x+½, y-1)
  while (y >= 0) {
    plot4(x, y);
    y--; dy -= 2 * a2;
    if (d > 0) d += 4 * (a2 - dy);
    else { x++; dx += 2 * b2; d += 4 * (dx - dy + a2); }
  }
}

/** Текстовая трассировка расчётов для отчёта (один пример с вычислениями). */
export function traceLine(x0: number, y0: number, x1: number, y1: number): string {
  const dx = x1 - x0, dy = y1 - y0, L = Math.max(Math.abs(dx), Math.abs(dy));
  let s = `Отрезок (${x0},${y0})–(${x1},${y1}); dx=${dx}, dy=${dy}\n\n== ЦДА: L=${L}, xi=${dx}/${L}=${(dx / (L || 1)).toFixed(4)}, yi=${dy}/${L}=${(dy / (L || 1)).toFixed(4)}\n i |   x      y   | (round x, round y)\n`;
  if (L > 0) { let x = x0, y = y0; for (let i = 0; i <= L; i++) { s += `${String(i).padStart(2)} | ${x.toFixed(3).padStart(8)} ${y.toFixed(3).padStart(8)} | (${rnd(x)}, ${rnd(y)})\n`; x += dx / L; y += dy / L; } }
  const ax = Math.abs(dx), ay = -Math.abs(dy); let err = ax + ay, X = x0, Y = y0;
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  s += `\n== Брезенхем: dx=${ax}, dy=${ay}, err0=dx+dy=${err}\n (x,y)    err  e2=2err\n`;
  for (let n = 0; n < 10000; n++) {
    const e2 = 2 * err; s += `(${X},${Y})`.padEnd(10) + String(err).padStart(4) + String(e2).padStart(6) + "\n";
    if (X === x1 && Y === y1) break;
    if (e2 >= ay) { err += ay; X += sx; }
    if (e2 <= ax) { err += ax; Y += sy; }
  }
  return s;
}
