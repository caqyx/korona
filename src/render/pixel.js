/**
 * Prymitywy pixel art: wszystko rysowane fillRect na całkowitych współrzędnych (bez antyaliasingu).
 * Wypełnienia „półprzezroczyste” robione są ditheringiem (macierz Bayera 4×4).
 */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patterns = new Map();

/**
 * Wzór ditheringu: kolor z pokryciem level 0..1 (krok 1/16).
 * @param {CanvasRenderingContext2D} g @param {string} color @param {number} level
 */
export function dither(g, color, level) {
  const lv = Math.max(0, Math.min(16, Math.round(level * 16)));
  const key = `${color}:${lv}`;
  let p = patterns.get(key);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const cg = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    cg.fillStyle = color;
    for (let i = 0; i < 16; i++) if (BAYER[i] < lv) cg.fillRect(i % 4, Math.floor(i / 4), 1, 1);
    p = /** @type {CanvasPattern} */ (g.createPattern(c, 'repeat'));
    patterns.set(key, p);
  }
  return p;
}

/** Wypełnione koło (analityczne spany). */
export function fillCircle(g, cx, cy, r) {
  r = Math.max(0, Math.round(r));
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

/** Okrąg (obrys, algorytm punktu środkowego). */
export function strokeCircle(g, cx, cy, r) {
  r = Math.max(1, Math.round(r));
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    const pts = [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ];
    for (const [px, py] of pts) g.fillRect(cx + px, cy + py, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Pierścień (wypełnienie między r0 a r1). */
export function fillRing(g, cx, cy, r0, r1) {
  r0 = Math.max(0, Math.round(r0));
  r1 = Math.max(r0 + 1, Math.round(r1));
  for (let dy = -r1; dy <= r1; dy++) {
    const outer = Math.floor(Math.sqrt(Math.max(0, r1 * r1 - dy * dy)));
    const innerSq = r0 * r0 - dy * dy;
    if (innerSq <= 0) {
      g.fillRect(cx - outer, cy + dy, outer * 2 + 1, 1);
    } else {
      const inner = Math.ceil(Math.sqrt(innerSq));
      if (outer >= inner) {
        g.fillRect(cx - outer, cy + dy, outer - inner + 1, 1);
        g.fillRect(cx + inner, cy + dy, outer - inner + 1, 1);
      }
    }
  }
}

/** Elipsa wypełniona (cienie). */
export function fillEllipse(g, cx, cy, rx, ry) {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

/** Linia Bresenhama. */
export function line(g, x0, y0, x1, y1, step = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let i = 0;
  for (let n = 0; n < 2000; n++) {
    if (i++ % step === 0) g.fillRect(x0, y0, 1, 1);
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
}

/**
 * Wypełnienie wielokąta wypukłego (scanline). pts: [[x,y],...]
 */
export function fillPolygon(g, pts) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  minY = Math.ceil(minY);
  maxY = Math.floor(maxY);
  for (let y = minY; y <= maxY; y++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by >= y) || (by <= y && ay >= y)) {
        const x = ay === by ? Math.min(ax, bx) : ax + ((y - ay) * (bx - ax)) / (by - ay);
        const x2 = ay === by ? Math.max(ax, bx) : x;
        lo = Math.min(lo, x, x2);
        hi = Math.max(hi, x, x2);
      }
    }
    if (hi >= lo) g.fillRect(Math.round(lo), y, Math.round(hi) - Math.round(lo) + 1, 1);
  }
}

/** Obrys wielokąta. */
export function strokePolygon(g, pts) {
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    line(g, ax, ay, bx, by);
  }
}

/** Wierzchołki wycinka koła (stożka) jako wielokąt wypukły (dla łuku ≤ 180°). */
export function sectorPoints(cx, cy, r, ang, arc, segs = 14) {
  const pts = [[cx, cy]];
  for (let i = 0; i <= segs; i++) {
    const a = ang - arc / 2 + (arc * i) / segs;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Wierzchołki prostokąta-linii (od punktu, kąt, długość, szerokość). */
export function linePoints(x, y, ang, len, w) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const hw = w / 2;
  return [
    [x - sa * hw, y + ca * hw],
    [x - sa * hw + ca * len, y + ca * hw + sa * len],
    [x + sa * hw + ca * len, y - ca * hw + sa * len],
    [x + sa * hw, y - ca * hw],
  ];
}

/** Rysuje sprite z punktem zaczepienia, opcjonalnie odbity w poziomie. */
export function drawSprite(g, sprite, x, y, flip = false) {
  if (!sprite) return;
  if (!flip) {
    g.drawImage(sprite.img, Math.round(x - sprite.ox), Math.round(y - sprite.oy));
    return;
  }
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(-1, 1);
  g.drawImage(sprite.img, -sprite.ox, -sprite.oy);
  g.restore();
}
