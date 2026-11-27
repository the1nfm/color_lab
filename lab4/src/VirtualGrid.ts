import type { IRasterTarget } from "./RasterEngine";

/** Виртуальный растр. Логические координаты: x∈[-W/2, W/2), y∈[-H/2, H/2), Y вверх. */
export class VirtualGrid implements IRasterTarget {
  data: Float32Array;
  readonly ox: number;
  readonly oy: number;
  painted = 0;
  constructor(public readonly width: number, public readonly height: number) {
    this.data = new Float32Array(width * height);
    this.ox = width >> 1; this.oy = height >> 1;
  }
  setPixel(x: number, y: number, intensity: number): void {
    const i = x + this.ox, j = y + this.oy;
    if (i < 0 || j < 0 || i >= this.width || j >= this.height) return;
    const k = j * this.width + i;
    if (intensity > this.data[k]) this.data[k] = intensity;
    this.painted++;
  }
  get(x: number, y: number): number {
    const i = x + this.ox, j = y + this.oy;
    return i < 0 || j < 0 || i >= this.width || j >= this.height ? 0 : this.data[j * this.width + i];
  }
  clear(): void { this.data.fill(0); this.painted = 0; }
}
