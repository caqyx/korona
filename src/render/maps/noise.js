/**
 * Czyste (bez DOM) narzędzia do generowania tła map: deterministyczny szum (hash, value noise,
 * fbm, Voronoi) i raster RGBA (Uint32) zamieniany potem na kanwę przez putImageData.
 * Ta sama mapa wygląda identycznie u wszystkich graczy.
 */
import { hexToRgb } from '../sprites/pixels.js';

/** Hash liczb całkowitych → [0, 1). @param {number} x @param {number} y @param {number} [s] ziarno */
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise (gładki, bilinearny). @param {number} x @param {number} y @param {number} [s] */
export function vnoise(x, y, s = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fraktalny szum (3 oktawy), wynik ~[0, 1]. @param {number} x @param {number} y @param {number} [s] */
export function fbm(x, y, s = 0) {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 17) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 43) * 0.15;
}

/**
 * Komórki Voronoi (jitterowana siatka). Zwraca odległość do najbliższego (d1) i drugiego (d2)
 * punktu oraz identyfikatory komórek — d2-d1 ≈ odległość od krawędzi komórki.
 * @param {number} x @param {number} y @param {number} cell @param {number} [s]
 */
export function voronoi(x, y, cell, s = 0) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  let d1 = 1e9;
  let d2 = 1e9;
  let id = 0;
  let id2 = 0;
  let fx = 0;
  let fy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i;
      const cy = gy + j;
      const px = (cx + 0.12 + hash(cx, cy, s) * 0.76) * cell;
      const py = (cy + 0.12 + hash(cx, cy, s + 1) * 0.76) * cell;
      const d = Math.hypot(x - px, y - py);
      const cid = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0;
      if (d < d1) {
        d2 = d1;
        id2 = id;
        d1 = d;
        id = cid;
        fx = px;
        fy = py;
      } else if (d < d2) {
        d2 = d;
        id2 = cid;
      }
    }
  }
  return { d1, d2, id, id2, fx, fy };
}

/** Wartość [0,1) dla pary komórek (niezależna od kolejności). @param {number} a @param {number} b @param {number} [s] */
export const pairHash = (a, b, s = 0) => hash(Math.min(a, b) | 0, Math.max(a, b) | 0, s);

/** Część ułamkowa (zawsze dodatnia). @param {number} v */
export const frac = (v) => v - Math.floor(v);

// ---------------------------------------------------------------- raster

const packCache = new Map();

/** '#rrggbb' → Uint32 w kolejności bajtów RGBA (little endian, jak ImageData). @param {string} hex */
export function pack(hex) {
  let v = packCache.get(hex);
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    packCache.set(hex, v);
  }
  return v;
}

/** Uint32 → [r, g, b, a]. @param {number} v */
export const unpack = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];

export class Raster {
  /** @param {number} w @param {number} h */
  constructor(w, h) {
    this.w = w | 0;
    this.h = h | 0;
    this.px = new Uint32Array(this.w * this.h);
  }

  /** @param {number} x @param {number} y */
  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** @param {number} x @param {number} y @param {string|null} c */
  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    this.px[y * this.w + x] = c ? pack(c) : 0;
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {string} c */
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** @param {number} x @param {number} y @returns {number} Uint32 (0 = przezroczysty) */
  get(x, y) {
    x |= 0;
    y |= 0;
    return this.inside(x, y) ? this.px[y * this.w + x] : 0;
  }

  /** Miesza piksel z kolorem (t ∈ [0,1]); nie rusza przezroczystych. @param {number} x @param {number} y @param {string} c @param {number} t */
  blend(x, y, c, t) {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    const v = this.px[i];
    if (!v) return;
    const [r0, g0, b0] = unpack(v);
    const [r1, g1, b1] = hexToRgb(c);
    const r = Math.round(r0 + (r1 - r0) * t);
    const g = Math.round(g0 + (g1 - g0) * t);
    const b = Math.round(b0 + (b1 - b0) * t);
    this.px[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  /** Nakłada PixelBuffer (sprite) — lewy górny róg w (dx, dy). @param {import('../sprites/pixels.js').PixelBuffer} b */
  stamp(b, dx, dy) {
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const c = b.px[y * b.w + x];
        if (c) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Bajty RGBA (widok na ten sam bufor). */
  rgba() {
    return new Uint8ClampedArray(this.px.buffer);
  }

  /** Liczba nieprzezroczystych pikseli. */
  count() {
    let n = 0;
    for (const v of this.px) if (v) n++;
    return n;
  }
}
