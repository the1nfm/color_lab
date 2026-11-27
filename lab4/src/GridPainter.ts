import { VirtualGrid } from "./VirtualGrid";

export interface Layer { grid: VirtualGrid; color: string; }

/** Только отображение: рисует увеличенные квадраты клеток VirtualGrid, сетку, оси и подписи. */
export class GridPainter {
  scale = 22; cx = 0; cy = 0;
  constructor(private canvas: HTMLCanvasElement) {}
  private sx(x: number) { return this.canvas.width / 2 + (x - this.cx) * this.scale; }
  private sy(y: number) { return this.canvas.height / 2 - (y - this.cy) * this.scale; }
  toLogical(px: number, py: number): [number, number] {
    return [Math.round((px - this.canvas.width / 2) / this.scale + this.cx),
            Math.round(-(py - this.canvas.height / 2) / this.scale + this.cy)];
  }
  render(layers: Layer[], markers: [number, number][] = []): void {
    const c = this.canvas.getContext("2d")!, W = this.canvas.width, H = this.canvas.height, s = this.scale;
    c.clearRect(0, 0, W, H);
    const x0 = Math.floor(this.cx - W / 2 / s) - 1, x1 = Math.ceil(this.cx + W / 2 / s) + 1;
    const y0 = Math.floor(this.cy - H / 2 / s) - 1, y1 = Math.ceil(this.cy + H / 2 / s) + 1;
    for (const L of layers) {
      c.fillStyle = L.color;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const v = L.grid.get(x, y);
        if (v > 0) { c.globalAlpha = Math.min(1, v); c.fillRect(this.sx(x - 0.5), this.sy(y + 0.5), s, s); }
      }
    }
    c.globalAlpha = 1;
    if (s >= 6) {   // линии сетки — границы клеток
      c.strokeStyle = "#ddd"; c.lineWidth = 1; c.beginPath();
      for (let x = x0; x <= x1; x++) { const p = Math.round(this.sx(x - 0.5)) + 0.5; c.moveTo(p, 0); c.lineTo(p, H); }
      for (let y = y0; y <= y1; y++) { const p = Math.round(this.sy(y + 0.5)) + 0.5; c.moveTo(0, p); c.lineTo(W, p); }
      c.stroke();
    }
    // оси через центры клеток x=0 и y=0
    c.strokeStyle = "#333"; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(0, this.sy(0)); c.lineTo(W, this.sy(0)); c.moveTo(this.sx(0), 0); c.lineTo(this.sx(0), H); c.stroke();
    // подписи
    const step = Math.max(1, Math.ceil(36 / s));
    c.fillStyle = "#000"; c.font = "11px Arial"; c.textAlign = "center";
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) if (x !== 0) c.fillText(String(x), this.sx(x), Math.min(H - 3, Math.max(12, this.sy(0) + 13)));
    c.textAlign = "right";
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) if (y !== 0) c.fillText(String(y), Math.min(W - 3, Math.max(24, this.sx(0) - 4)), this.sy(y) + 4);
    c.fillText("0", this.sx(0) - 4, this.sy(0) + 13);
    c.fillText("X", W - 6, this.sy(0) - 6); c.fillText("Y", this.sx(0) - 6, 12);
    for (const [mx, my] of markers) {
      c.strokeStyle = "#d00"; c.lineWidth = 2; c.strokeRect(this.sx(mx - 0.5), this.sy(my + 0.5), s, s);
    }
  }
}
