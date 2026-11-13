import { binary, grayscale, pixel, type Picture, type Edge } from './pixels';
export type Method = 'median' | 'minimum' | 'maximum' | 'otsu' | 'iterative' | 'adaptive';
export type Options = { method: Method; radius: number; edge: Edge; offset: number };
export type Result = { image: Picture; threshold?: number };

function orderFilter(image: Picture, options: Options): Picture {
  const { radius, edge, method } = options;
  const data = new Uint8ClampedArray(image.data.length);
  const values = new Array<number>((2 * radius + 1) ** 2);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const p = (y * image.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let k = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            values[k++] = pixel(image, x + dx, y + dy, c, edge);
          }
        }
        if (method === 'median') {
          values.sort((a, b) => a - b);
          data[p + c] = values[Math.floor(values.length / 2)];
        } else {
          let chosen = values[0];
          for (let i = 1; i < values.length; i++) {
            if (method === 'minimum') chosen = Math.min(chosen, values[i]);
            else chosen = Math.max(chosen, values[i]);
          }
          data[p + c] = chosen;
        }
      }
      data[p + 3] = image.data[p + 3];
    }
  }
  return { width: image.width, height: image.height, data };
}
function histogram(gray: Uint8Array): Float64Array {
  const hist = new Float64Array(256);
  for (const value of gray) hist[value]++;
  return hist;
}
export function otsu(gray: Uint8Array): number {
  const hist = histogram(gray);
  let total = 0;
  for (let i = 0; i < 256; i++) total += i * hist[i];
  let threshold = Math.round(total / gray.length), best = -1, count = 0, sum = 0;
  for (let t = 0; t < 256; t++) {
    count += hist[t]; sum += t * hist[t];
    const other = gray.length - count;
    if (!count || !other) continue;
    const difference = sum / count - (total - sum) / other;
    const variance = count * other * difference * difference;
    if (variance > best) { best = variance; threshold = t; }
  }
  return threshold;
}
export function iterative(gray: Uint8Array): number {
  const hist = histogram(gray);
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let threshold = sum / gray.length;
  for (let step = 0; step < 100; step++) {
    let n0 = 0, n1 = 0, s0 = 0, s1 = 0;
    for (let i = 0; i < 256; i++) {
      if (i <= threshold) { n0 += hist[i]; s0 += i * hist[i]; }
      else { n1 += hist[i]; s1 += i * hist[i]; }
    }
    if (!n0 || !n1) break;
    const next = (s0 / n0 + s1 / n1) / 2;
    if (Math.abs(next - threshold) < .01) { threshold = next; break; }
    threshold = next;
  }
  return threshold;
}
function adaptive(image: Picture, gray: Uint8Array, radius: number, offset: number): Picture {
  const { width: w, height: h } = image;
  const stride = w + 1;
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      sat[(y + 1) * stride + x + 1] = rowSum + sat[y * stride + x + 1];
    }
  }
  return binary(image, gray, i => {
    const x = i % w, y = Math.floor(i / w);
    const x1 = Math.max(0, x - radius), x2 = Math.min(w, x + radius + 1);
    const y1 = Math.max(0, y - radius), y2 = Math.min(h, y + radius + 1);
    const sum = sat[y2 * stride + x2] - sat[y1 * stride + x2]
      - sat[y2 * stride + x1] + sat[y1 * stride + x1];
    return sum / ((x2 - x1) * (y2 - y1)) - offset;
  });
}
export function process(image: Picture, options: Options): Result {
  if (['median', 'minimum', 'maximum'].includes(options.method)) return { image: orderFilter(image, options) };
  const gray = grayscale(image);
  if (options.method === 'adaptive') return { image: adaptive(image, gray, options.radius, options.offset) };
  const threshold = options.method === 'otsu' ? otsu(gray) : iterative(gray);
  return { image: binary(image, gray, () => threshold), threshold };
}
