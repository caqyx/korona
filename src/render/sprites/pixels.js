/**
 * Czyste (bez DOM) narzędzia pixel art: bufor pikseli, kolory, siatki ASCII, obrys.
 * Bufor przechowuje kolory jako '#rrggbb' albo null (przezroczysty).
 */

export const OUTLINE = '#1a1c2c';

// ---------- kolory ----------

/** @param {string} hex @returns {[number, number, number]} */
export function hexToRgb(hex) {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return [255, 0, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param {number} r @param {number} g @param {number} b */
export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Liniowe mieszanie dwóch kolorów. @param {string} a @param {string} b @param {number} t */
export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Normalizuje dowolny zapis koloru do '#rrggbb'. @param {string} hex */
export const norm = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r, g, b);
};

const SHADOW_HUE = '#2b1d4a';
const LIGHT_HUE = '#fff6d8';

/**
 * Rampa 5 odcieni (od najciemniejszego do najjaśniejszego) z przesunięciem barwy:
 * cienie w stronę fioletu, światła w stronę ciepłej bieli — klasyczny trik pixel art.
 * @param {string} base @returns {string[]}
 */
export function ramp(base) {
  const b = norm(base);
  return [mix(b, SHADOW_HUE, 0.62), mix(b, SHADOW_HUE, 0.32), b, mix(b, LIGHT_HUE, 0.38), mix(b, LIGHT_HUE, 0.72)];
}

// ---------- siatki ASCII ----------

/**
 * Parsuje siatkę znaków. '.' i ' ' = przezroczyste.
 * @param {string[]} rows
 * @returns {{w: number, h: number, cells: string[][]}}
 */
export function parseGrid(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('parseGrid: empty grid');
  const w = Math.max(...rows.map((r) => r.length));
  const cells = rows.map((r) => {
    const out = [];
    for (let x = 0; x < w; x++) {
      const ch = r[x] ?? '.';
      out.push(ch === ' ' ? '.' : ch);
    }
    return out;
  });
  return { w, h: rows.length, cells };
}

/**
 * Sprawdza, że każdy znak siatki (poza '.') ma kolor w palecie. Zwraca listę brakujących znaków.
 * @param {string[]} rows @param {Record<string, string>} palette
 */
export function missingChars(rows, palette) {
  const miss = new Set();
  for (const r of rows) for (const ch of r) if (ch !== '.' && ch !== ' ' && !(ch in palette)) miss.add(ch);
  return [...miss];
}

// ---------- bufor ----------

export class PixelBuffer {
  /** @param {number} w @param {number} h */
  constructor(w, h) {
    this.w = w | 0;
    this.h = h | 0;
    /** @type {(string|null)[]} */
    this.px = new Array(this.w * this.h).fill(null);
  }

  /** @param {number} x @param {number} y */
  get(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  /** @param {number} x @param {number} y @param {string|null} c */
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {string} c */
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  /** Linia Bresenhama. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} c */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 512; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Linia w kierunku kąta (radiany). @returns {[number, number]} koniec */
  ray(x, y, ang, len, c) {
    const x1 = Math.round(x + Math.cos(ang) * len);
    const y1 = Math.round(y + Math.sin(ang) * len);
    this.line(x, y, x1, y1, c);
    return [x1, y1];
  }

  /**
   * Wypełniona elipsa. c: kolor albo funkcja (x, y, nx, ny) => kolor|null, nx/ny ∈ [-1,1].
   * @param {number} cx @param {number} cy @param {number} rx @param {number} ry
   * @param {string|((x:number,y:number,nx:number,ny:number)=>string|null)} c
   */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const col = typeof c === 'function' ? c(x, y, nx, ny) : c;
        if (col) this.set(x, y, col);
      }
    }
    return this;
  }

  /**
   * Elipsa cieniowana rampą (światło z lewej-góry), opcjonalny dithering na granicach odcieni.
   * @param {number} cx @param {number} cy @param {number} rx @param {number} ry @param {string[]} rmp
   * @param {{lx?: number, ly?: number, dither?: boolean, min?: number, max?: number}} [o]
   */
  shaded(cx, cy, rx, ry, rmp, o = {}) {
    const lx = o.lx ?? -0.55;
    const ly = o.ly ?? -0.65;
    const lo = o.min ?? 0;
    const hi = o.max ?? rmp.length - 1;
    const th = o.th ?? [-0.4, 0.2, 0.7, 0.88];
    return this.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = (nx * lx + ny * ly) * 0.8 + nz * 0.5;
      if (o.dither !== false) v += (x + y) & 1 ? 0.03 : -0.03;
      let i = 0;
      while (i < th.length && v > th[i]) i++;
      i = Math.round((i / th.length) * (rmp.length - 1));
      return rmp[Math.max(lo, Math.min(hi, i))];
    });
  }

  /** Wielokąt wypełniony (scanline, reguła parzystości). @param {[number, number][]} pts @param {string|((x:number,y:number)=>string|null)} c */
  poly(pts, c) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const col = typeof c === 'function' ? c(x, y) : c;
          if (col) this.set(x, y, col);
        }
      }
    }
    return this;
  }

  /** Okrąg (obwód). @param {number} cx @param {number} cy @param {number} r @param {string} c @param {number} [a0] @param {number} [a1] */
  arc(cx, cy, r, c, a0 = 0, a1 = Math.PI * 2) {
    const steps = Math.max(8, Math.ceil(r * 8 * Math.abs(a1 - a0) / (Math.PI * 2)) * 2);
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      this.set(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), c);
    }
    return this;
  }

  /**
   * Odbija siatkę ASCII na bufor.
   * @param {string[]} rows @param {Record<string, string|null>} pal @param {number} [dx] @param {number} [dy]
   * @param {{flipX?: boolean}} [o]
   */
  stamp(rows, pal, dx = 0, dy = 0, o = {}) {
    const g = parseGrid(rows);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const ch = g.cells[y][x];
        if (ch === '.') continue;
        const col = pal[ch];
        if (col === undefined) continue;
        this.set(dx + (o.flipX ? g.w - 1 - x : x), dy + y, col);
      }
    }
    return this;
  }

  /** Nakłada inny bufor (nieprzezroczyste piksele). @param {PixelBuffer} b @param {number} [dx] @param {number} [dy] */
  draw(b, dx = 0, dy = 0) {
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const c = b.px[y * b.w + x];
        if (c) this.set(x + dx, y + dy, c);
      }
    }
    return this;
  }

  /**
   * Dodaje 1 px obrys wokół nieprzezroczystych pikseli.
   * @param {string} [c] @param {boolean} [diagonal] także po skosie (grubszy obrys)
   */
  outline(c = OUTLINE, diagonal = false) {
    const src = this.px.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? null : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        let hit = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        if (!hit && diagonal) hit = at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
        if (hit) this.px[y * this.w + x] = c;
      }
    }
    return this;
  }

  /** Zmiana kolorów: fn(kolor, x, y) => kolor|null. @param {(c:string, x:number, y:number)=>string|null} fn */
  map(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const c = this.px[i];
        if (c) this.px[i] = fn(c, x, y);
      }
    }
    return this;
  }

  clone() {
    const b = new PixelBuffer(this.w, this.h);
    b.px = this.px.slice();
    return b;
  }

  /** Liczba nieprzezroczystych pikseli. */
  count() {
    let n = 0;
    for (const c of this.px) if (c) n++;
    return n;
  }

  /** Poziome odcinki jednego koloru — do rysowania minimalną liczbą fillRect. @returns {[number, number, number, string][]} */
  runs() {
    /** @type {[number, number, number, string][]} */
    const out = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.px[y * this.w + x];
        if (!c) {
          x++;
          continue;
        }
        let x2 = x + 1;
        while (x2 < this.w && this.px[y * this.w + x2] === c) x2++;
        out.push([x, y, x2 - x, c]);
        x = x2;
      }
    }
    return out;
  }
}

/**
 * Rysuje warstwę w osobnym buforze, obrysowuje ją i nakłada na cel — daje wewnętrzne
 * ciemne krawędzie między częściami (np. miecz na tle ciała).
 * @param {PixelBuffer} target @param {(b: PixelBuffer) => void} draw @param {string|null} [outline]
 */
export function layer(target, draw, outline = OUTLINE) {
  const b = new PixelBuffer(target.w, target.h);
  draw(b);
  if (outline) b.outline(outline);
  target.draw(b);
  return target;
}

/** Wynik "trafienia": biała sylwetka z zachowanym obrysem. @param {PixelBuffer} b */
export function whiteFlash(b) {
  return b.map((c) => (c === OUTLINE ? c : '#ffffff'));
}

/** Czerwony odcień (drugi kadr obrażeń). @param {PixelBuffer} b */
export function redTint(b) {
  return b.map((c) => (c === OUTLINE ? '#3a0c18' : mix(c, '#ff3048', 0.55)));
}

/** Modulo dodatnie dla dowolnej liczby całkowitej. @param {number} n @param {number} m */
export const mod = (n, m) => (((Math.floor(n) || 0) % m) + m) % m;
