export type Picture = { width: number; height: number; data: Uint8ClampedArray };
export type Edge = 'clamp' | 'reflect';
export function coordinate(n: number, size: number, edge: Edge): number {
  if (edge === 'clamp') return Math.max(0, Math.min(size - 1, n));
  if (size === 1) return 0;
  // Отражение с повторением крайнего пикселя.
  while (n < 0 || n >= size) n = n < 0 ? -n - 1 : 2 * size - n - 1;
  return n;
}
export function pixel(image: Picture, x: number, y: number, c: number, edge: Edge): number {
  x = coordinate(x, image.width, edge); y = coordinate(y, image.height, edge);
  return image.data[(y * image.width + x) * 4 + c];
}
export function grayscale(image: Picture): Uint8Array {
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(.299 * image.data[p] + .587 * image.data[p + 1] + .114 * image.data[p + 2]);
  }
  return gray;
}
export function binary(image: Picture, gray: Uint8Array, threshold: (i: number) => number): Picture {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] > threshold(i) ? 255 : 0;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = image.data[i * 4 + 3];
  }
  return { width: image.width, height: image.height, data };
}
