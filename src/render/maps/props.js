/**
 * Przeszkody i krzaki map (czyste, bez DOM) — PixelBuffer + kotwica.
 * Przeszkody: kotwica = środek dołu podstawy (ox = floor(w/2), oy = h-1); renderer rysuje je
 * w świecie w (x, y + r·0.6), więc podstawa leży na kole kolizji.
 * Krzak: kotwica w środku (ox = w/2, oy = h/2), rysowany NAD postaciami.
 */
import { PixelBuffer, OUTLINE, layer, mod } from '../sprites/pixels.js';
import { buildPillar } from '../sprites/misc.js';
import { hash } from './noise.js';

export const OBSTACLE_KINDS = ['pillar', 'rock', 'crystal', 'tree', 'tomb', 'crypt', 'ruin', 'cactus'];
export const BUSH_FRAMES = 2;

/** Palety przeszkód (do testów i spójności). */
export const PROP_PALETTES = {
  basalt: ['#1a1420', '#2e2636', '#463a50', '#62546e', '#85769a'],
  ember: ['#7a2014', '#e0541c', '#ffa02a', '#ffe066'],
  crystal: ['#1f4a7e', '#3d8fc8', '#6cc4f0', '#a6e4ff', '#e6f8ff'],
  snow: ['#9fadc6', '#c5d0e2', '#eef4fb'],
  bark: ['#1e1410', '#3a2618', '#553824', '#6e4a2e', '#8a6038'],
  leaf: ['#0f2416', '#183a20', '#22502a', '#2f6834', '#448a42', '#6aa850'],
  grave: ['#2a2a38', '#3e3e50', '#575868', '#73748a', '#9496aa'],
  moss: ['#3e5a36', '#5a7a44'],
  slate: ['#22202e', '#2e2a3e', '#3e3852', '#524a68'],
  sandstone: ['#6e4a30', '#a87c52', '#c99e6c', '#e0bf8a', '#f4dcae'],
  cactus: ['#1e3a1e', '#2e5a2a', '#3f7a34', '#5a9a44', '#84c060'],
  spine: '#efe6c0',
  flower: ['#ff7ab0', '#ffd0e4'],
  bush: ['#10261a', '#1a3c22', '#26532c', '#356c36', '#4c8a42', '#74b058'],
  berry: ['#e0405a', '#ff9aa8'],
  gate: '#0c0b14',
  soul: '#39ff9f',
};
const P = PROP_PALETTES;

/** Pikselowy rozmiar podstawy dla promienia. */
const baseW = (r, ppm) => Math.max(8, Math.round(r * 2 * ppm));
const done = (b) => ({ buf: b, ox: Math.floor(b.w / 2), oy: b.h - 1 });

/** Wybór koloru z rampy wg oświetlenia (światło z lewej-góry). */
function lit(rmp, nx, ny, bias = 0) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const v = (-nx * 0.55 - ny * 0.65) * 0.8 + nz * 0.5 + bias;
  const i = v > 0.75 ? 4 : v > 0.42 ? 3 : v > 0.08 ? 2 : v > -0.3 ? 1 : 0;
  return rmp[Math.min(rmp.length - 1, i)];
}

// ---------------------------------------------------------------- skała wulkaniczna
function buildRock(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 4;
  const h = Math.round(W * 0.82) + 4;
  const b = new PixelBuffer(w, h);
  const cx = w / 2;
  const cy = h - 2 - (h - 4) * 0.47;
  const rx = W / 2;
  const ry = (h - 4) * 0.5;
  const pts = [];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const j = 0.82 + hash(i, W, 301) * 0.2;
    const sy = Math.sin(a) > 0.3 ? 1 : j; // płaski spód
    pts.push([cx + Math.cos(a) * rx * (Math.sin(a) > 0.3 ? 1 : j), cy + Math.sin(a) * ry * sy]);
  }
  b.poly(pts, (x, y) => {
    const nx = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx));
    const ny = Math.max(-1, Math.min(1, (y + 0.5 - cy) / ry));
    const sec = Math.floor(((Math.atan2(ny, nx) + Math.PI) / (Math.PI * 2)) * 7);
    const f = (hash(sec, 3, 302) - 0.5) * 0.45 + ((x + y) & 1 ? 0.02 : -0.02);
    return lit(P.basalt, nx * 0.9, ny * 0.9, f);
  });
  // żarzące się pęknięcia
  const E = P.ember;
  for (let k = 0; k < 3; k++) {
    let x = Math.round(cx + (hash(k, W, 303) - 0.5) * rx * 0.8);
    let y = Math.round(cy - ry * 0.2 + (hash(k, W, 304) - 0.5) * ry * 0.6);
    const len = Math.round(rx * (0.5 + hash(k, W, 305) * 0.4));
    for (let s = 0; s < len; s++) {
      if (!b.get(x, y) || !b.get(x + 1, y + 1)) break;
      b.set(x, y, s % 4 === 1 ? E[3] : s % 3 === 0 ? E[2] : E[1]);
      b.set(x + 1, y + 1, P.basalt[0]);
      x += hash(k, s, 306) < 0.55 ? 1 : 0;
      y += hash(k, s, 307) < 0.5 ? 1 : -1;
      if (hash(k, s, 308) < 0.3) x -= 2;
    }
  }
  // połysk krawędzi
  b.set(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.6), P.basalt[4]);
  b.outline(OUTLINE);
  return done(b);
}

// ---------------------------------------------------------------- kryształ lodu
function prism(b, bx, by, ang, len, wid, pal) {
  const ux = Math.sin(ang);
  const uy = -Math.cos(ang);
  const vx = -uy;
  const vy = ux;
  const hw = wid / 2;
  const pts = [
    [bx - vx * hw, by - vy * hw],
    [bx - vx * hw + ux * len * 0.72, by - vy * hw + uy * len * 0.72],
    [bx + ux * len, by + uy * len],
    [bx + vx * hw + ux * len * 0.72, by + vy * hw + uy * len * 0.72],
    [bx + vx * hw, by + vy * hw],
  ];
  layer(b, (w) => {
    w.poly(pts, (x, y) => {
      const rx = x + 0.5 - bx;
      const ry = y + 0.5 - by;
      const side = rx * vx + ry * vy; // <0 lewa ściana
      const along = (rx * ux + ry * uy) / len;
      if (Math.abs(side) < 0.7) return pal[4];
      if (side < 0) return along > 0.74 ? pal[4] : along < 0.15 ? pal[2] : pal[3];
      return along > 0.74 ? pal[3] : along < 0.2 ? pal[1] : pal[2];
    });
  });
}

function buildCrystal(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 6;
  const h = Math.round(W * 1.55) + 4;
  const b = new PixelBuffer(w, h);
  const cx = w / 2;
  const base = h - 4;
  // śnieżny kopczyk
  b.ellipse(cx, base, W / 2, 3.2, (x, y, nx, ny) => (ny < -0.2 ? P.snow[2] : nx < 0 ? P.snow[1] : P.snow[0]));
  const C = P.crystal;
  prism(b, cx - W * 0.3, base, -0.55, W * 0.62, W * 0.24, C);
  prism(b, cx + W * 0.3, base, 0.5, W * 0.7, W * 0.26, C);
  prism(b, cx + W * 0.05, base + 0.5, 0.06, W * 1.32, W * 0.36, C);
  prism(b, cx - W * 0.12, base + 1, -0.22, W * 0.85, W * 0.26, C);
  // śnieg na podstawie z przodu
  b.ellipse(cx, base + 1.5, W / 2 - 1, 1.8, (x, y, nx) => (nx < 0.2 ? P.snow[2] : P.snow[1]));
  b.outline(OUTLINE);
  // błysk
  const tx = Math.round(cx + W * 0.05 + Math.sin(0.06) * W * 1.1);
  const ty = Math.round(base - W * 1.12);
  b.set(tx - 1, ty, '#ffffff');
  return done(b);
}

// ---------------------------------------------------------------- drzewo
function buildTree(r, ppm) {
  const W = baseW(r, ppm);
  const CW = Math.round(W * 1.55);
  const w = CW + 4;
  const h = Math.round(W * 2.05) + 4;
  const b = new PixelBuffer(w, h);
  const cx = w / 2;
  const base = h - 2;
  const tw = Math.max(5, Math.round(W * 0.36));
  const LP = [P.leaf[0], P.leaf[1], P.leaf[2], P.leaf[3], P.leaf[4]];
  // korzenie + pień
  layer(b, (t) => {
    t.ellipse(cx, base - 1.5, tw * 0.95, 2.6, (x, y, nx) => (nx < -0.3 ? P.bark[3] : nx < 0.4 ? P.bark[2] : P.bark[1]));
    for (let y = Math.round(base - W * 1.05); y <= base - 1; y++) {
      const flare = Math.max(0, (y - (base - 6)) * 0.6);
      for (let x = Math.floor(cx - tw / 2 - flare); x < Math.ceil(cx + tw / 2 + flare); x++) {
        const nx = (x + 0.5 - cx) / (tw / 2 + flare);
        let i = nx < -0.5 ? 3 : nx < 0.1 ? 2 : nx < 0.6 ? 1 : 0;
        if ((x * 3 + Math.floor(y / 3)) % 5 === 0) i = Math.max(0, i - 1);
        if (Math.abs(nx + 0.55) < 0.12 && y % 4) i = 4;
        t.set(x, y, P.bark[i]);
      }
    }
  });
  // korona z kilku kęp liści (od tyłu do przodu)
  const top = 2;
  const cr = CW / 2;
  const canopyCy = top + cr * 0.95;
  const blobs = [
    [cx, canopyCy - cr * 0.15, cr * 0.82, cr * 0.7, 0.05],
    [cx - cr * 0.45, canopyCy + cr * 0.15, cr * 0.55, cr * 0.48, 0],
    [cx + cr * 0.45, canopyCy + cr * 0.12, cr * 0.55, cr * 0.5, -0.05],
    [cx - cr * 0.15, canopyCy - cr * 0.5, cr * 0.5, cr * 0.42, 0.15],
    [cx + cr * 0.05, canopyCy + cr * 0.42, cr * 0.62, cr * 0.42, -0.1],
  ];
  layer(b, (t) => {
    // cień pod koroną na pniu
    for (const [bx, by, rx, ry, bias] of blobs) {
      t.ellipse(bx, by, rx, ry, (x, y, nx, ny) => {
        const tex = hash(x, y, 311);
        let c = lit(LP, nx, ny, bias + (tex < 0.12 ? -0.3 : tex > 0.93 ? 0.3 : 0));
        if (ny > 0.75) c = LP[0];
        return c;
      });
    }
    // pojedyncze jasne liście na górze
    for (let k = 0; k < 9; k++) {
      const x = Math.round(cx - cr * 0.6 + hash(k, W, 312) * cr * 0.9);
      const y = Math.round(canopyCy - cr * 0.55 + hash(k, W, 313) * cr * 0.7);
      if (t.get(x, y)) {
        t.set(x, y, P.leaf[5]);
        t.set(x + 1, y, P.leaf[4]);
      }
    }
  });
  // cień korony na pniu
  for (let x = Math.floor(cx - tw / 2); x < cx + tw / 2; x++) {
    const y = Math.round(canopyCy + cr * 0.85);
    if (b.get(x, y + 1) && b.get(x, y + 1) !== OUTLINE) b.set(x, y + 1, P.bark[0]);
  }
  b.outline(OUTLINE);
  return done(b);
}

// ---------------------------------------------------------------- nagrobek
function buildTomb(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 2;
  const sw = W - 3; // szerokość płyty
  const sh = Math.round(W * 1.05);
  const h = sh + 6;
  const b = new PixelBuffer(w, h);
  const G = P.grave;
  const x0 = Math.round((w - sw) / 2);
  const y0 = 1;
  // cokół
  b.rect(x0 - 1, h - 4, sw + 2, 3, G[1]);
  b.rect(x0 - 1, h - 4, sw + 2, 1, G[3]);
  b.rect(x0 + sw - 1, h - 3, 2, 2, G[0]);
  // płyta z zaokrągloną górą
  const rr = sw / 2;
  for (let y = y0; y < h - 4; y++) {
    for (let x = x0; x < x0 + sw; x++) {
      const dx = x + 0.5 - (x0 + rr);
      const dy = y + 0.5 - (y0 + rr);
      if (dy < 0 && dx * dx + dy * dy > rr * rr) continue;
      const nx = dx / rr;
      let c = nx < -0.6 ? G[3] : nx < 0.5 ? G[2] : G[1];
      if (dy < 0 && dx * dx + dy * dy > (rr - 1.3) * (rr - 1.3) && dx < 1) c = G[4];
      if (hash(x, y, 321) < 0.06) c = G[1];
      b.set(x, y, c);
    }
  }
  // wyryty krzyż
  const kx = Math.round(x0 + rr - 0.5);
  const ky = y0 + Math.round(rr * 0.55);
  const ch = Math.max(5, Math.round(sh * 0.5));
  for (let i = 0; i < ch; i++) {
    b.set(kx, ky + i, G[0]);
    b.set(kx + 1, ky + i, G[3]);
  }
  for (let i = -2; i <= 2; i++) {
    b.set(kx + i, ky + 2, G[0]);
    b.set(kx + i, ky + 3, G[3]);
  }
  b.set(kx + 1, ky + 2, G[0]);
  // pęknięcie i mech
  b.line(x0 + sw - 2, y0 + rr, x0 + sw - 4, y0 + rr + 4, G[0]);
  for (let i = 0; i < 6; i++) b.set(x0 + Math.floor(hash(i, W, 322) * sw), h - 5 - Math.floor(hash(i, W, 323) * 3), P.moss[i & 1]);
  b.set(x0, h - 5, P.moss[0]);
  b.set(x0 + 1, h - 5, P.moss[1]);
  b.outline(OUTLINE);
  return done(b);
}

// ---------------------------------------------------------------- krypta (mauzoleum)
function buildCrypt(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 2;
  const bw = W - 4; // korpus
  const roofH = Math.round(W * 0.42);
  const bodyH = Math.round(W * 0.62);
  const h = roofH + bodyH + 8;
  const b = new PixelBuffer(w, h);
  const G = P.grave;
  const SL = P.slate;
  const cx = w / 2;
  const x0 = Math.round(cx - bw / 2);
  const bodyTop = roofH + 3;
  const bodyBot = bodyTop + bodyH;
  // schody
  b.rect(x0 - 1, bodyBot, bw + 2, 2, G[2]);
  b.rect(x0 - 1, bodyBot, bw + 2, 1, G[3]);
  b.rect(x0 + 2, bodyBot + 2, bw - 4, 2, G[1]);
  b.rect(x0 + 2, bodyBot + 2, bw - 4, 1, G[2]);
  // korpus (ściana frontowa)
  for (let y = bodyTop; y < bodyBot; y++) {
    for (let x = x0; x < x0 + bw; x++) {
      const lx = x - x0;
      let c = G[2];
      if (lx < 3) c = G[3];
      else if (lx >= bw - 3) c = G[1];
      else if ((y - bodyTop) % 5 === 0 || ((lx + (Math.floor((y - bodyTop) / 5) % 2) * 4) % 8 === 0)) c = G[1];
      if (hash(x, y, 331) < 0.05) c = P.moss[0];
      b.set(x, y, c);
    }
  }
  // drzwi z łukiem i kratą
  const dw = Math.max(7, Math.round(bw * 0.42));
  const dx0 = Math.round(cx - dw / 2);
  const dTop = bodyTop + 3;
  for (let y = dTop; y < bodyBot; y++) {
    for (let x = dx0; x < dx0 + dw; x++) {
      const ax = x + 0.5 - cx;
      const ay = y + 0.5 - (dTop + dw / 2);
      if (ay < 0 && ax * ax + ay * ay > (dw / 2) * (dw / 2)) continue;
      const bars = (x - dx0) % 2 === 1 || (y - dTop) === Math.round(dw * 0.75);
      b.set(x, y, bars ? SL[2] : P.gate);
    }
  }
  b.set(Math.round(cx) - 2, bodyBot - 4, P.soul);
  b.set(Math.round(cx) + 1, bodyBot - 4, P.soul);
  // obramowanie drzwi
  b.arc(cx, dTop + dw / 2, dw / 2 + 1, G[4], Math.PI, Math.PI * 2);
  // gzyms
  b.rect(x0 - 2, bodyTop - 1, bw + 4, 2, G[3]);
  b.rect(x0 - 2, bodyTop, bw + 4, 1, G[1]);
  // dach dwuspadowy (widok z góry 3/4)
  for (let y = 2; y < bodyTop - 1; y++) {
    const t = (y - 2) / (bodyTop - 3);
    const half = bw / 2 + 2 - (1 - t) * 3;
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const ridge = y === 3 || y === 4;
      let c = t < 0.4 ? SL[3] : SL[2];
      if ((y - 2) % 3 === 2) c = SL[1];
      if (((x + (y % 2) * 2) % 4) === 0 && !ridge) c = SL[1];
      if (ridge) c = G[3];
      if (x < cx - half + 1.5) c = SL[0];
      b.set(x, y, c);
    }
  }
  // krzyż na szczycie
  const kx = Math.round(cx) - 1;
  b.rect(kx, -1 + 0, 2, 4, G[4]);
  b.rect(kx - 1, 1, 4, 1, G[4]);
  b.set(kx + 1, 2, G[2]);
  b.outline(OUTLINE);
  return done(b);
}

// ---------------------------------------------------------------- ruina kolumny
function buildRuin(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 4;
  const shaftW = Math.round(W * 0.62);
  const shaftH = Math.round(W * 0.85);
  const h = shaftH + 12;
  const b = new PixelBuffer(w, h);
  const SS = P.sandstone;
  const cx = w / 2;
  const plTop = h - 8;
  const pw = Math.round(W * 0.9);
  const px0 = Math.round(cx - pw / 2);
  // plinta: blok z widoczną górną ścianą
  layer(b, (t) => {
    t.rect(px0, plTop, pw, 3, SS[3]);
    t.rect(px0, plTop + 3, pw, 4, SS[2]);
    t.rect(px0 + pw - 4, plTop + 3, 4, 4, SS[1]);
    t.rect(px0, plTop, pw, 1, SS[4]);
    t.set(px0 + 4, plTop + 5, SS[1]);
    t.set(px0 + 5, plTop + 4, SS[1]);
  });
  // trzon (walec) ze złamanym, poszarpanym szczytem
  layer(b, (t) => {
    const x0 = Math.round(cx - shaftW / 2);
    const bot = plTop + 1;
    for (let x = x0; x < x0 + shaftW; x++) {
      const lx = x - x0;
      const nx = ((lx + 0.5) / shaftW) * 2 - 1;
      const jag = Math.floor(hash(Math.floor(lx / 3), W, 341) * 5);
      const top = plTop - shaftH + 2 + jag + Math.round(Math.max(0, nx) * 8);
      for (let y = top; y < bot; y++) {
        let i = nx < -0.65 ? 3 : nx < -0.1 ? 2 : nx < 0.55 ? 1 : 0;
        if (nx < -0.45 && nx > -0.62) i = 4;
        if (y - top < 2) i = y === top ? 4 : 3; // przełam
        else if ((bot - y) % 9 === 0) i = Math.max(0, i - 1); // spoiny bębnów
        if (hash(x, y, 342) < 0.04 && y - top > 2) i = Math.max(0, i - 1);
        t.set(x, y, SS[i]);
      }
    }
    // dolny łuk trzonu na plincie
    for (let x = x0; x < x0 + shaftW; x++) t.set(x, bot, SS[1]);
  });
  // odłamki u podstawy
  layer(b, (t) => {
    t.rect(1, h - 5, 5, 3, SS[2]);
    t.rect(1, h - 5, 5, 1, SS[4]);
    t.rect(w - 6, h - 4, 4, 2, SS[3]);
    t.set(w - 3, h - 3, SS[1]);
    t.rect(w - 9, h - 2, 2, 1, SS[2]);
  });
  b.outline(OUTLINE);
  return done(b);
}

// ---------------------------------------------------------------- kaktus
function buildCactus(r, ppm) {
  const W = baseW(r, ppm);
  const w = W + 6;
  const h = Math.round(W * 1.9) + 3;
  const b = new PixelBuffer(w, h);
  const C = P.cactus;
  const cx = Math.floor(w / 2);
  const tw = Math.max(5, Math.round(W * 0.42));
  const base = h - 2;
  const col = (x, x0, ww) => {
    const nx = (x + 0.5 - x0) / ww;
    return nx < 0.25 ? C[3] : nx < 0.55 ? C[2] : nx < 0.8 ? C[1] : C[0];
  };
  layer(b, (t) => {
    // pień
    const x0 = cx - Math.floor(tw / 2);
    const topY = 3;
    for (let y = topY; y < base; y++)
      for (let x = x0; x < x0 + tw; x++) {
        if (y === topY && (x === x0 || x === x0 + tw - 1)) continue;
        t.set(x, y, col(x, x0, tw));
      }
    // lewe ramię (niżej)
    const aw = Math.max(3, tw - 2);
    const ly = Math.round(h * 0.55);
    for (let x = 1; x < x0; x++) for (let y = ly; y < ly + aw; y++) t.set(x, y, C[2]);
    for (let y = Math.round(h * 0.3); y < ly + aw; y++) for (let x = 1; x < 1 + aw; x++) t.set(x, y, col(x, 1, aw));
    // prawe ramię (wyżej)
    const ry = Math.round(h * 0.38);
    for (let x = x0 + tw; x < w - 1; x++) for (let y = ry; y < ry + aw; y++) t.set(x, y, C[1]);
    for (let y = Math.round(h * 0.16); y < ry + aw; y++) for (let x = w - 1 - aw; x < w - 1; x++) t.set(x, y, col(x, w - 1 - aw, aw));
  });
  // żeberka i kolce
  b.map((c, x, y) => {
    if (c === OUTLINE) return c;
    if (hash(x, y, 351) < 0.07) return P.spine;
    return c;
  });
  const x0 = cx - Math.floor(tw / 2);
  for (let y = 5; y < base - 1; y += 2) b.set(x0 + Math.floor(tw / 2), y, C[1]);
  // kwiat
  b.set(cx, 1, P.flower[0]);
  b.set(cx - 1, 2, P.flower[0]);
  b.set(cx + 1, 2, P.flower[0]);
  b.set(cx, 2, P.flower[1]);
  // piasek u podstawy
  b.rect(cx - Math.floor(tw / 2) - 1, base, tw + 2, 1, '#c08c4a');
  b.outline(OUTLINE);
  return done(b);
}

const BUILDERS = { rock: buildRock, crystal: buildCrystal, tree: buildTree, tomb: buildTomb, crypt: buildCrypt, ruin: buildRuin, cactus: buildCactus, pillar: buildPillar };

/**
 * @param {string} kind @param {number} radius metry @param {number} ppm
 * @returns {{buf: PixelBuffer, ox: number, oy: number}}
 */
export function buildObstacle(kind, radius, ppm) {
  const f = BUILDERS[kind] ?? buildPillar;
  return f(radius, ppm);
}

// ---------------------------------------------------------------- krzak
/**
 * Czubek krzaka (nad postaciami). Rozmiar w = 2·r·PPM + 4, h = round(1.7·r·PPM) + 4.
 * @param {number} radius @param {number} frame @param {number} ppm
 */
export function buildBush(radius, frame, ppm) {
  const f = mod(frame, BUSH_FRAMES);
  const R = radius * ppm;
  const w = Math.round(R * 2) + 4;
  const h = Math.round(R * 1.7) + 4;
  const b = new PixelBuffer(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = R;
  const ry = R * 0.85;
  const L = P.bush;
  const seed = Math.round(radius * 100);
  // kępy liści rozłożone w elipsie, rysowane od tyłu (góra) do przodu (dół)
  const blobs = [];
  const n = Math.round(6 + R * 0.45);
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed, 361) * Math.PI * 2;
    const d = Math.sqrt(hash(i, seed, 362)) * 0.62;
    const br = R * (0.3 + hash(i, seed, 363) * 0.14);
    blobs.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, br]);
  }
  blobs.push([cx, cy, R * 0.48]);
  blobs.sort((p, q) => p[1] - q[1]);
  // podkład (jednolita masa — żeby nic nie prześwitywało)
  b.ellipse(cx, cy + 1, rx - 3, ry - 3, L[1]);
  for (const [bx, by, br] of blobs) {
    const sway = f === 1 ? Math.round((1 - (by - (cy - ry)) / (ry * 2)) * 1.6) : 0;
    const x0 = bx + sway;
    layer(
      b,
      (t) =>
        t.ellipse(x0, by, br, br * 0.82, (x, y, nx, ny) => {
          const tex = hash(x - sway, y, 364 + seed);
          let c = lit(L, nx, ny, tex < 0.14 ? -0.35 : tex > 0.9 ? 0.25 : 0);
          if (ny > 0.6) c = L[1];
          return c;
        }),
      L[0],
    );
  }
  // pojedyncze jasne listki i jagody
  for (let i = 0; i < Math.round(R / 3); i++) {
    const x = Math.round(cx + (hash(i, seed, 365) - 0.5) * rx * 1.3);
    const y = Math.round(cy + (hash(i, seed, 366) - 0.6) * ry * 1.2);
    if (b.get(x, y) && b.get(x, y) !== L[0]) {
      b.set(x, y, L[5]);
      b.set(x + 1, y - 1, L[4]);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.round(cx + (hash(i, seed, 367) - 0.5) * rx);
    const y = Math.round(cy + (hash(i, seed, 368) - 0.3) * ry);
    if (b.get(x, y)) {
      b.set(x, y, P.berry[0]);
      b.set(x, y - 1, P.berry[1]);
    }
  }
  b.outline(OUTLINE);
  return { buf: b, ox: Math.floor(w / 2), oy: Math.floor(h / 2) };
}
