/**
 * Statyczne tło map (czyste, bez DOM): podłoga biomu, mur/krawędź granicy, margines poza
 * granicą, dekoracje, podłoże hazardów (lawa, lód, ruchome piaski, cień krzaków) i cienie
 * przeszkód. Wynik to Raster (Uint32 RGBA) + pozycja środka świata (cx, cy) w pikselach sztuki.
 *
 * Konwencje: PPM px/m, piksel (px, py) pokrywa świat [(px-cx)/PPM, (px-cx+1)/PPM).
 * Mur ma grubość WALL_M i leży NA ZEWNĄTRZ granicy gry; dalej margines MARGIN_M (≥ 2 m)
 * z terenem biomu, który ditheringiem zanika do przezroczystości.
 */
import { PPM } from '../sprites.js';
import { hash, vnoise, fbm, voronoi, pairHash, frac, Raster } from './noise.js';

export const WALL_M = 1;
export const MARGIN_M = 2.5;
const VIG_M = 1.4;

// ---------------------------------------------------------------- palety

/** Palety biomów (wszystkie kolory '#rrggbb'). */
export const BIOME_PALETTES = {
  stone: {
    floor: ['#23243a', '#272842', '#2b2c48', '#1f2034'],
    grout: '#15151f',
    bevel: '#30314f',
    speck: '#34355a',
    moss: '#2f4a3a',
    rune: '#4b3f8a',
    wall: ['#3a3550', '#2c2840', '#4a4466'],
    outer: ['#121220', '#16162a', '#1e1f33'],
    vig: '#1f2034',
  },
  volcano: {
    cells: ['#2a2431', '#2f2837', '#25202c', '#332b3b'],
    seam: '#141019',
    bevelL: '#3c3346',
    bevelD: '#1d1922',
    crack: '#c2401c',
    crackHot: '#ffb02e',
    crackGlow: '#4a2226',
    ash: '#4a4252',
    ember: '#ff7a2a',
    wall: ['#140f18', '#2a2230', '#40364a', '#5a4c66', '#76668a'],
    wallSeam: '#0e0b12',
    magma: '#e0541c',
    outer: ['#140f17', '#1a141e', '#221a26'],
    river: '#a8341a',
    riverGlow: '#3e1818',
    obsidian: ['#120e18', '#1c1624', '#2e2640', '#4a3e66'],
    runeGlow: '#ff8a3d',
    runeDim: '#8a2a14',
    vig: '#1a1620',
  },
  ice: {
    snow: ['#aebbd2', '#bac6db', '#c5d0e2', '#d0daea'],
    streak: '#dfe7f3',
    shade: '#9fadc6',
    pebble: '#7e8ca8',
    sparkle: '#ffffff',
    wallFace: '#4f7fae',
    wallGrout: '#3d6a96',
    wallBlocks: ['#8ccbea', '#9fd6f0', '#7cbde2'],
    wallHi: '#c8ecfb',
    snowCap: ['#eef4fb', '#dde6f2'],
    outer: ['#8d9bb6', '#98a6bf', '#a3b0c8'],
    rock: ['#3e4660', '#56607a', '#76819c'],
    tuft: ['#6c7c74', '#8e9e90'],
    vig: '#a3b1c9',
  },
  forest: {
    grass: ['#264a2c', '#2c5530', '#326034', '#3a6a38'],
    blade: '#4a7e40',
    bladeDark: '#1f3f26',
    dirt: ['#4e3a2a', '#5a4430', '#664e36'],
    dirtEdge: '#3b5a2e',
    pebble: '#7a6a58',
    hedge: ['#0c1d12', '#132a18', '#1b3a20', '#24502a', '#2f6232'],
    trunk: '#2a1c14',
    outer: ['#08140c', '#0c1d12', '#132a18'],
    flowers: ['#e8e8f0', '#ffd23f', '#ff8ad0', '#7ab8ff'],
    flowerEye: '#ffb02e',
    leaves: ['#c86a2a', '#d8a03a', '#8a4a2a'],
    mushCap: '#c83a3a',
    mushDot: '#f2ecd6',
    stone: ['#4a5060', '#626a7a', '#3e5a3a'],
    vig: '#1d3a22',
  },
  graveyard: {
    grass: ['#3e3e30', '#46452f', '#4e4b34', '#575239'],
    tuft: '#6a6444',
    tuftDark: '#2e2e24',
    mud: ['#3a2e26', '#43352b', '#33281f'],
    mudEdge: '#3e3a2c',
    puddle: '#262838',
    puddleHi: '#3e4460',
    flag: ['#4a4856', '#545262', '#403e4c'],
    flagEdge: '#2a2834',
    wall: ['#565466', '#4c4a5a', '#605e70'],
    wallGrout: '#2a2834',
    wallFace: '#1c1a24',
    wallMoss: '#3e5a36',
    iron: '#16161e',
    ironHi: '#3a3a4c',
    post: ['#6e6c80', '#8a889c'],
    outer: ['#1e1c1a', '#24221e', '#2c2a24'],
    mound: ['#2e241c', '#3a2c22', '#4a3a2a'],
    bone: ['#d8d2bc', '#9a947e'],
    vig: '#33322a',
  },
  desert: {
    sand: ['#d39f58', '#dcaa62', '#e4b56e'],
    ripHi: '#efc888',
    ripLo: '#bf8c4a',
    pebble: '#9a7046',
    tile: ['#c2ad8e', '#b6a080', '#cdba9a'],
    tileGrout: '#8a6a48',
    tileHi: '#ddcdb0',
    mosaic: '#b8683a',
    mosaicHi: '#d8884a',
    wall: ['#b8875a', '#a87a4c', '#c4966a'],
    wallGrout: '#6e4e30',
    wallHi: '#d8b07e',
    wallFace: '#7a5434',
    outer: ['#b8854a', '#c08e52', '#a87a44'],
    shrub: ['#6a6a2e', '#8a8a44'],
    bone: ['#f2ecd6', '#b8ae8e'],
    vig: '#c8945a',
  },
};

/** Palety podłoża hazardów. */
export const HAZARD_PALETTES = {
  lava: {
    rim: '#1a0c10',
    crust: ['#2e1216', '#4a1c14'],
    crustHi: '#7a2a16',
    hot: '#d8381a',
    orange: '#ff6a1f',
    amber: '#ffa02a',
    yellow: '#ffd23f',
    white: '#fff1a8',
    glow: '#ff5a1a',
  },
  ice: {
    deep: '#3d8fc8',
    base: '#5cb4e6',
    light: '#74c6ee',
    streak: '#c4efff',
    streak2: '#9adcf8',
    glint: '#f2fdff',
    crack: '#d8f4ff',
    bevel: '#a6e4ff',
    rimHi: '#e6f8ff',
    rimLo: '#2f78b4',
    outline: '#1f4a7e',
    drift: ['#eef4fb', '#dde6f2'],
  },
  quicksand: {
    base: ['#a8763e', '#9a6a36'],
    inner: '#8a5c30',
    groove: '#6a4422',
    sheen: '#c89050',
    pit: ['#3e2614', '#4a2e18'],
    rim: '#5a3a1e',
    ring: '#ecc488',
    ripple: '#c49050',
  },
  bush: {
    shadow: ['#132a18', '#183420'],
    litter: ['#2a4a26', '#5a4026'],
  },
};

export const HAZARD_KINDS = Object.keys(HAZARD_PALETTES);

// ---------------------------------------------------------------- geometria

/**
 * @param {import('../../sim/maps.js').MapDef} map
 * @returns {{w:number, h:number, cx:number, cy:number, sd:(x:number,y:number)=>number,
 *   edge:(x:number,y:number,c:any)=>void}}
 *   sd = odległość (m) do granicy, dodatnia wewnątrz; edge ustawia c.al (współrzędna wzdłuż muru, m) i c.corner
 */
export function mapGeometry(map) {
  if (map.shape === 'rect') {
    const hw = map.hw ?? 16;
    const hh = map.hh ?? 16;
    const W = Math.ceil((hw + WALL_M + MARGIN_M) * PPM) * 2;
    const H = Math.ceil((hh + WALL_M + MARGIN_M) * PPM) * 2;
    return {
      w: W,
      h: H,
      cx: W / 2,
      cy: H / 2,
      sd: (x, y) => -Math.max(Math.abs(x) - hw, Math.abs(y) - hh),
      edge: (x, y, c) => {
        const ox = Math.abs(x) - hw;
        const oy = Math.abs(y) - hh;
        c.corner = ox > 0 && oy > 0;
        c.al = ox > oy ? y : x;
      },
    };
  }
  const R = map.radius ?? 16;
  const S = Math.ceil((R + WALL_M + MARGIN_M) * PPM) * 2;
  return {
    w: S,
    h: S,
    cx: S / 2,
    cy: S / 2,
    sd: (x, y) => R - Math.hypot(x, y),
    edge: (x, y, c) => {
      c.corner = false;
      c.al = Math.atan2(y, x) * R;
    },
  };
}

/** Czy punkt świata jest wolny od hazardów i przeszkód (z zapasem pad, m). */
function isFree(map, x, y, pad = 0.4) {
  for (const o of map.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + pad + 0.3) return false;
  for (const z of map.hazards) {
    if (z.shape === 'circle' ? Math.hypot(x - z.x, y - z.y) < (z.r ?? 0) + pad : Math.abs(x - z.x) < (z.w ?? 0) / 2 + pad && Math.abs(y - z.y) < (z.h ?? 0) / 2 + pad) return false;
  }
  return true;
}

/**
 * Deterministyczny rozrzut punktów dekoracji (siatka step m z jitterem).
 * @returns {{x:number,y:number,h:number,px:number,py:number}[]}
 */
function scatter(map, geo, step, chance, seed, opts = {}) {
  const out = [];
  const minS = opts.minS ?? 0.6;
  const pad = opts.pad ?? 0.4;
  const clear = opts.clear ?? 1.2;
  const ext = Math.max(geo.w, geo.h) / PPM / 2;
  for (let gy = -Math.ceil(ext / step); gy <= Math.ceil(ext / step); gy++) {
    for (let gx = -Math.ceil(ext / step); gx <= Math.ceil(ext / step); gx++) {
      const h = hash(gx, gy, seed);
      if (h > chance) continue;
      const x = (gx + hash(gx, gy, seed + 1)) * step;
      const y = (gy + hash(gx, gy, seed + 2)) * step;
      if (geo.sd(x, y) < minS || Math.hypot(x, y) < clear || !isFree(map, x, y, pad)) continue;
      out.push({ x, y, h: h / chance, px: Math.floor(geo.cx + x * PPM), py: Math.floor(geo.cy + y * PPM) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- biomy

/**
 * Painter biomu: floor/wall/outer dostają kontekst piksela c:
 *  {px, py, lx, ly (px względem środka), wx, wy (m), s (m w głąb areny), o (m w głąb muru / poza murem), al, corner}
 * decor(r, geo, map) dorysowuje elementy na rastrze.
 */
const S = BIOME_PALETTES.stone;
const V = BIOME_PALETTES.volcano;
const I = BIOME_PALETTES.ice;
const F = BIOME_PALETTES.forest;
const Gy = BIOME_PALETTES.graveyard;
const D = BIOME_PALETTES.desert;

/** Kamienne płyty 1 m — port oryginalnej areny. */
function stoneFloor(c) {
  const tx = Math.floor(c.lx / PPM);
  const ty = Math.floor(c.ly / PPM);
  const ix = c.lx - tx * PPM;
  const iy = c.ly - ty * PPM;
  const n = hash(tx, ty, 101);
  if (ix === 0 || iy === 0) return S.grout;
  if (ix === 1 || iy === 1) return S.bevel;
  let col = S.floor[Math.floor(n * 3)];
  const p = hash(c.px, c.py, 102);
  if (p < 0.04) col = S.floor[3];
  else if (p > 0.985) col = S.speck;
  if (n > 0.9 && hash(c.px * 3, c.py * 7, 103) < 0.3) col = S.moss;
  if (n < 0.06 && Math.abs(ix - iy - (Math.floor(n * 80) % 5)) < 0.6) col = S.grout;
  return col;
}

/** Cegły układane wzdłuż muru (rząd co 4 px, cegła 7 px). */
function brickWall(c, pal, grout, len = 7, rowH = 4) {
  const op = c.o * PPM;
  const row = Math.floor(op / rowH);
  const u = (c.al * PPM) / len + row * 0.5;
  const fr = frac(u);
  if (op % rowH < 1 || fr < 1 / len) return grout;
  return pal[(Math.floor(u) + row) & 1];
}

function runeCircle(r, geo, col, radius = 2.2, runeR = 3.1) {
  for (let i = 0; i < 360; i++) {
    const a = (i * Math.PI) / 180;
    for (const rr of [radius * PPM, radius * PPM + 1]) r.set(Math.round(geo.cx + Math.cos(a) * rr), Math.round(geo.cy + Math.sin(a) * rr), col);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rx = Math.round(geo.cx + Math.cos(a) * runeR * PPM);
    const ry = Math.round(geo.cy + Math.sin(a) * runeR * PPM);
    r.rect(rx - 1, ry - 2, 3, 1, col);
    r.rect(rx, ry - 2, 1, 5, col);
    r.rect(rx - 1, ry + 2, 3, 1, col);
  }
}

const stone = {
  floor: stoneFloor,
  vig: S.vig,
  wall(c) {
    if (c.o * PPM < 1.2) return S.wall[2];
    if (c.corner) return hash(c.px >> 2, c.py >> 2, 104) < 0.5 ? S.wall[0] : S.wall[2];
    return brickWall(c, S.wall, S.grout);
  },
  outer(c) {
    const h = hash(c.px, c.py, 105);
    return h < 0.08 ? S.outer[2] : S.outer[h < 0.6 ? 0 : 1];
  },
  decor(r, geo) {
    runeCircle(r, geo, S.rune);
  },
};

const volcano = {
  vig: V.vig,
  floor(c) {
    const v = voronoi(c.lx, c.ly, 13, 11);
    const e = v.d2 - v.d1;
    const ph = pairHash(v.id, v.id2, 3);
    const hot = ph < 0.09;
    if (e < 1.15) return hot ? (e < 0.55 ? V.crackHot : V.crack) : V.seam;
    if (hot && e < 2.3) return V.crackGlow;
    const h = hash(c.px, c.py, 12);
    if (h < 0.025) return V.ash;
    if (h > 0.996) return V.ember;
    if (e < 2.4) return c.lx - v.fx + (c.ly - v.fy) < 0 ? V.bevelL : V.bevelD;
    return V.cells[Math.floor(hash(v.id, 0, 5) * 4)];
  },
  wall(c) {
    const op = c.o * PPM;
    if (op < 1) return V.seam;
    const v = voronoi(c.lx, c.ly, 7, 23);
    const e = v.d2 - v.d1;
    if (e < 0.9) return pairHash(v.id, v.id2, 4) < 0.22 ? V.magma : V.wallSeam;
    if (op < 2.5) return V.wall[4];
    const lit = -(c.lx - v.fx + c.ly - v.fy) / 7 + hash(v.id, 1, 2) * 0.5 + (op < 6 ? 0.3 : -0.1);
    return V.wall[lit > 0.55 ? 4 : lit > 0.05 ? 3 : lit > -0.45 ? 2 : 1];
  },
  outer(c) {
    const n = fbm(c.lx / 40, c.ly / 40, 31);
    const q = Math.abs(n - 0.5);
    if (q < 0.022) return V.river;
    if (q < 0.045) return V.riverGlow;
    const h = hash(c.px, c.py, 32);
    return V.outer[h < 0.1 ? 2 : h < 0.6 ? 0 : 1];
  },
  decor(r, geo) {
    // dysk obsydianu z płonącymi runami pod koroną
    const R0 = 2.6 * PPM;
    for (let y = -R0 - 1; y <= R0 + 1; y++) {
      for (let x = -R0 - 1; x <= R0 + 1; x++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d > R0) continue;
        const px = geo.cx + x;
        const py = geo.cy + y;
        let col = V.obsidian[1];
        if (d > R0 - 1) col = V.obsidian[0];
        else if (d > R0 - 2.2) col = V.runeDim;
        else if (d > R0 - 3.2 && x + y < -R0 * 0.6) col = V.obsidian[2];
        else if (hash(px, py, 33) < 0.05) col = V.obsidian[0];
        else if (hash(px, py, 34) > 0.985) col = V.obsidian[3];
        r.set(px, py, col);
      }
    }
    runeCircle(r, geo, V.runeGlow, 1.75, 2.15);
  },
};

const tundra = {
  vig: I.vig,
  floor(c) {
    const n = fbm(c.lx / 30, c.ly / 22, 51);
    let col = I.snow[n < 0.38 ? 0 : n < 0.52 ? 1 : n < 0.66 ? 2 : 3];
    const st = vnoise(c.lx / 14, c.ly / 1.7, 52);
    if (st > 0.84) col = I.streak;
    else if (st < 0.1) col = I.shade;
    const h = hash(c.px, c.py, 53);
    if (h < 0.01) col = I.pebble;
    else if (h > 0.997) col = I.sparkle;
    return col;
  },
  wall(c) {
    const op = c.o * PPM;
    if (op < 2) return I.wallFace;
    const alp = c.al * PPM;
    const cap = vnoise(alp / 5, op / 3, 54);
    if (cap > 0.64 || (op > 10 && cap > 0.45)) return I.snowCap[hash(c.px, c.py, 55) < 0.7 ? 0 : 1];
    if (c.corner) return (c.px + c.py) % 6 === 0 ? I.wallHi : I.wallBlocks[1];
    const q = op - 2;
    const row = Math.floor(q / 5);
    const u = (alp + row * 7) / 14;
    const fu = frac(u) * 14;
    if (fu < 1 || q % 5 < 1) return I.wallGrout;
    if (fu < 2 || q % 5 < 2) return I.wallHi;
    return I.wallBlocks[Math.floor(hash(Math.floor(u), row, 56) * 3)];
  },
  outer(c) {
    const n = fbm(c.lx / 24, c.ly / 18, 57);
    const st = vnoise(c.lx / 12, c.ly / 1.6, 58);
    if (st > 0.86) return I.outer[2];
    return I.outer[n < 0.45 ? 0 : 1];
  },
  decor(r, geo, map) {
    for (const p of scatter(map, geo, 2.6, 0.32, 59, { clear: 2 })) {
      if (p.h < 0.5) {
        // kamień wystający spod śniegu
        const rx = 2 + Math.floor(p.h * 6);
        for (let y = -2; y <= 1; y++)
          for (let x = -rx; x <= rx; x++) {
            if ((x * x) / (rx * rx) + (y * y) / 4 > 1) continue;
            r.set(p.px + x, p.py + y, y <= -1 ? I.snowCap[0] : x < 0 ? I.rock[2] : I.rock[1]);
          }
        r.rect(p.px - rx + 1, p.py + 2, rx * 2 - 1, 1, I.rock[0]);
      } else {
        // zamarznięta kępka trawy
        for (let k = 0; k < 3; k++) {
          r.set(p.px + k * 2 - 2, p.py - (k === 1 ? 2 : 1), I.tuft[1]);
          r.set(p.px + k * 2 - 2, p.py, I.tuft[0]);
        }
      }
    }
  },
};

/** Las: polana w centrum + ścieżki (wartość > 0 = ziemia). */
const PATHS = [0.35, 3.0, -1.53];
function forestDirt(x, y) {
  const d = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  let v = 2.6 + (vnoise(a * 2 + 9, 0.5, 64) - 0.5) * 0.9 - d;
  for (let k = 0; k < PATHS.length; k++) {
    const ca = Math.cos(PATHS[k]);
    const sa = Math.sin(PATHS[k]);
    const t = x * ca + y * sa;
    if (t < 0) continue;
    const perp = -x * sa + y * ca + Math.sin(t * 0.8 + k * 2) * 0.55;
    v = Math.max(v, 0.5 + (vnoise(t * 1.3, k * 7, 63) - 0.5) * 0.35 - Math.abs(perp));
  }
  return v;
}

function foliage(c, pal, cell, seed, shift = 0) {
  const v = voronoi(c.lx, c.ly, cell, seed);
  if (v.d2 - v.d1 < 0.9) return pal[0];
  const dx = c.lx - v.fx;
  const dy = c.ly - v.fy;
  const t = v.d1 / cell;
  let i = 3 - Math.floor(t * 3.2) + (dx + dy < -1 ? 1 : 0) - shift;
  if (hash(c.px, c.py, seed + 5) < 0.08) i -= 1;
  return pal[Math.max(0, Math.min(pal.length - 1, i))];
}

const forest = {
  vig: F.vig,
  floor(c) {
    const dv = forestDirt(c.wx, c.wy);
    const h = hash(c.px, c.py, 62);
    if (dv > 0 || (dv > -0.18 && h < 0.45)) {
      if (dv < 0.12 && h < 0.3) return F.dirtEdge;
      if (h < 0.02) return F.pebble;
      const n = fbm(c.lx / 8, c.ly / 8, 65);
      return F.dirt[n < 0.42 ? 0 : n < 0.62 ? 1 : 2];
    }
    const n = fbm(c.lx / 18, c.ly / 18, 61);
    if (h < 0.07) return F.blade;
    if (h > 0.95) return F.bladeDark;
    return F.grass[n < 0.38 ? 0 : n < 0.5 ? 1 : n < 0.63 ? 2 : 3];
  },
  wall(c) {
    if (c.o * PPM < 1.5) return F.hedge[0];
    if (hash(c.px >> 1, c.py >> 1, 66) < 0.02) return F.trunk;
    return foliage(c, F.hedge, 9, 67);
  },
  outer(c) {
    return foliage(c, F.outer, 11, 68);
  },
  decor(r, geo, map) {
    // kępki kwiatów
    for (const p of scatter(map, geo, 2.2, 0.35, 69, { clear: 3 })) {
      const col = F.flowers[Math.floor(p.h * 4) % 4];
      const n = 2 + Math.floor(hash(p.px, p.py, 70) * 4);
      for (let k = 0; k < n; k++) {
        const fx = p.px + Math.round((hash(k, p.px, 71) - 0.5) * 14);
        const fy = p.py + Math.round((hash(k, p.py, 72) - 0.5) * 9);
        r.set(fx, fy - 1, col);
        r.set(fx - 1, fy, col);
        r.set(fx + 1, fy, col);
        r.set(fx, fy + 1, col);
        r.set(fx, fy, F.flowerEye);
        r.set(fx, fy + 2, F.blade);
      }
    }
    // opadłe liście
    for (const p of scatter(map, geo, 0.9, 0.3, 73, { clear: 0, minS: 0.2, pad: 0 })) {
      const col = F.leaves[Math.floor(p.h * 3) % 3];
      r.set(p.px, p.py, col);
      if (p.h > 0.5) r.set(p.px + 1, p.py, col);
    }
    // grzybki przy drzewach
    for (const o of map.obstacles) {
      if (o.kind !== 'tree') continue;
      const n = 1 + Math.floor(hash(o.x * 10, o.y * 10, 74) * 3);
      for (let k = 0; k < n; k++) {
        const a = hash(k, o.x * 10, 75) * Math.PI * 2;
        const px = Math.round(geo.cx + (o.x + Math.cos(a) * (o.r + 0.5)) * PPM);
        const py = Math.round(geo.cy + (o.y + Math.abs(Math.sin(a)) * (o.r * 0.6 + 0.4)) * PPM);
        r.rect(px - 1, py - 1, 3, 1, F.mushCap);
        r.set(px - 1, py - 2, F.mushCap);
        r.set(px, py - 2, F.mushDot);
        r.set(px + 1, py - 2, F.mushCap);
        r.set(px, py, F.mushDot);
        r.set(px, py + 1, F.dirt[0]);
      }
    }
    // krąg omszałych kamieni wokół polany
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.2;
      const px = Math.round(geo.cx + Math.cos(a) * 2.25 * PPM);
      const py = Math.round(geo.cy + Math.sin(a) * 2.25 * PPM);
      r.rect(px - 2, py - 1, 4, 3, F.stone[0]);
      r.rect(px - 2, py - 1, 3, 1, F.stone[1]);
      r.set(px + 1, py - 1, F.stone[2]);
      r.rect(px - 2, py + 2, 4, 1, F.hedge[0]);
    }
  },
};

/** Cmentarz: błotniste ścieżki w krzyż + plac z płyt w środku. */
function mudPath(x, y) {
  const wob = (t, s) => (vnoise(t * 0.9, s, 76) - 0.5) * 0.7;
  return Math.max(1.0 + wob(y, 1) - Math.abs(x), 1.0 + wob(x, 2) - Math.abs(y));
}

const graveyard = {
  vig: Gy.vig,
  floor(c) {
    const d = Math.hypot(c.wx, c.wy);
    const h = hash(c.px, c.py, 77);
    if (d < 2.3 + (h < 0.4 ? 0.06 : 0)) {
      const v = voronoi(c.lx, c.ly, 8, 78);
      if (v.d2 - v.d1 < 1 || d > 2.2) return Gy.flagEdge;
      if (h < 0.05) return Gy.wallMoss;
      return Gy.flag[Math.floor(hash(v.id, 0, 79) * 3)];
    }
    const mv = mudPath(c.wx, c.wy);
    if (mv > 0) {
      if (fbm(c.lx / 10, c.ly / 10, 80) > 0.74) return h < 0.08 ? Gy.puddleHi : Gy.puddle;
      const n = fbm(c.lx / 6, c.ly / 6, 81);
      return Gy.mud[n < 0.4 ? 2 : n < 0.58 ? 0 : 1];
    }
    if (mv > -0.2 && h < 0.5) return Gy.mudEdge;
    if (h < 0.06) return Gy.tuft;
    if (h > 0.97) return Gy.tuftDark;
    const n = fbm(c.lx / 16, c.ly / 16, 71);
    return Gy.grass[n < 0.38 ? 0 : n < 0.5 ? 1 : n < 0.62 ? 2 : 3];
  },
  wall(c) {
    const op = c.o * PPM;
    if (op < 1.5) return Gy.wallFace;
    const alp = c.al * PPM;
    // filary co 3 m (i w narożnikach)
    const seg = frac(alp / 36 + 0.5) * 36;
    if (c.corner || seg < 9) {
      if (op < 3 || seg < 1) return Gy.wallGrout;
      return (seg < 3 || op < 4.5) && !c.corner ? Gy.post[1] : Gy.post[0];
    }
    // żelazne sztachety (szpic do środka)
    if (op >= 4 && op < 5.5) return Gy.iron;
    if (op >= 2.5 && op < 4 && frac(alp / 4) < 0.3) return Gy.iron;
    if (op >= 1.5 && op < 2.5 && frac(alp / 4) < 0.3) return Gy.ironHi;
    if (op < 4) return Gy.wallFace;
    const col = brickWall({ o: (op - 4) / PPM, al: c.al }, Gy.wall, Gy.wallGrout, 8, 4);
    if (col !== Gy.wallGrout && hash(c.px, c.py, 82) < 0.12) return Gy.wallMoss;
    return col;
  },
  outer(c) {
    const h = hash(c.px, c.py, 83);
    if (h < 0.05) return Gy.tuft;
    return Gy.outer[h < 0.15 ? 2 : fbm(c.lx / 14, c.ly / 14, 84) < 0.5 ? 0 : 1];
  },
  decor(r, geo, map) {
    // groby (zaokrąglone kopczyki ziemi) przed nagrobkami
    for (const o of map.obstacles) {
      if (o.kind !== 'tomb') continue;
      const px = Math.round(geo.cx + o.x * PPM);
      const top = Math.round(geo.cy + (o.y + o.r * 0.6) * PPM);
      const rx = 4.6;
      const ry = 7;
      const my = top + ry;
      for (let y = Math.floor(my - ry); y <= Math.ceil(my + ry); y++)
        for (let x = Math.floor(px - rx - 1); x <= Math.ceil(px + rx + 1); x++) {
          const nx = (x + 0.5 - px) / rx;
          const ny = (y + 0.5 - my) / ry;
          const q = nx * nx + ny * ny;
          if (q > 1.25) continue;
          let col = q > 1 ? Gy.mound[0] : nx + ny * 0.5 < -0.35 ? Gy.mound[2] : nx + ny * 0.5 > 0.55 ? Gy.mound[0] : Gy.mound[1];
          const h = hash(x, y, 85);
          if (q <= 1 && h < 0.07) col = Gy.tuft;
          else if (q <= 1 && h > 0.95) col = Gy.mound[0];
          r.set(x, y, col);
        }
    }
    // rozsypane kości
    for (const p of scatter(map, geo, 3.4, 0.2, 86, { clear: 3 })) {
      const horiz = p.h < 0.5;
      const l = 2 + Math.floor(p.h * 3);
      for (let k = 0; k <= l; k++) r.set(p.px + (horiz ? k : 0), p.py + (horiz ? 0 : k), Gy.bone[0]);
      r.set(p.px - (horiz ? 1 : 0), p.py - (horiz ? 0 : 1), Gy.bone[1]);
      r.set(p.px + (horiz ? l + 1 : 0), p.py + (horiz ? 0 : l + 1), Gy.bone[1]);
    }
    // wytarty krzyż w płytach centrum
    const cc = Gy.flagEdge;
    for (let k = -14; k <= 14; k++) {
      r.set(geo.cx + k, geo.cy - 4, cc);
      r.set(geo.cx - 1, geo.cy + k - 2, cc);
      r.set(geo.cx, geo.cy + k - 2, cc);
    }
  },
};

/** Pustynia: płyty ruin (plac w centrum i wokół kolumn). */
function desertTiled(map, x, y) {
  if (Math.hypot(x, y) < 3.9) return true;
  for (const o of map.obstacles) if (o.kind === 'ruin' && Math.hypot(x - o.x, y - o.y) < 2.9) return true;
  return false;
}

function makeDesert(map) {
  return {
    vig: D.vig,
    floor(c) {
      const tiled = desertTiled(map, c.wx, c.wy);
      if (tiled) {
        const tx = Math.floor(c.lx / PPM);
        const ty = Math.floor(c.ly / PPM);
        const cover = fbm(c.lx / 16, c.ly / 16, 91) + (Math.hypot(c.wx, c.wy) < 3.9 ? -0.12 : 0.05);
        if (cover < 0.58 && hash(tx, ty, 92) > 0.12) {
          const ix = c.lx - tx * PPM;
          const iy = c.ly - ty * PPM;
          if (ix === 0 || iy === 0) return D.tileGrout;
          const d = Math.hypot(c.wx, c.wy);
          if (d > 1.25 && d < 1.55) return D.mosaic;
          if (d < 1.0 && (Math.abs(c.lx) < 1 || Math.abs(c.ly) < 1 || Math.abs(Math.abs(c.lx) - Math.abs(c.ly)) < 1)) return D.mosaicHi;
          if (ix === 1 || iy === 1) return D.tileHi;
          const n = hash(tx, ty, 93);
          if (n < 0.12 && Math.abs(ix - iy) < 0.6) return D.tileGrout;
          return D.tile[Math.floor(n * 3)];
        }
      }
      const n = fbm(c.lx / 60, c.ly / 40, 81);
      const rip = Math.sin((c.ly + c.lx * 0.35 + n * 40) / 2.6);
      const h = hash(c.px, c.py, 94);
      if (h < 0.006) return D.pebble;
      if (rip > 0.9) return D.ripHi;
      if (rip < -0.96) return D.ripLo;
      return D.sand[n < 0.42 ? 0 : n < 0.58 ? 1 : 2];
    },
    wall(c) {
      const op = c.o * PPM;
      const alp = c.al * PPM;
      const drift = vnoise(alp / 9, 0, 85);
      if (op < (drift - 0.55) * 26) return hash(c.px, c.py, 95) < 0.2 ? D.ripHi : D.sand[1];
      if (op < 1.5) return D.wallFace;
      const q = op - 1.5;
      const row = Math.floor(q / 5.5);
      const u = (alp + row * 9) / 18;
      const fu = frac(u) * 18;
      if (fu < 1 || q % 5.5 < 1) return D.wallGrout;
      if (fu < 2 || q % 5.5 < 2) return D.wallHi;
      if (hash(c.px, c.py, 96) < 0.04) return D.wallGrout;
      return D.wall[Math.floor(hash(Math.floor(u), row, 97) * 3)];
    },
    outer(c) {
      const n = fbm(c.lx / 50, c.ly / 34, 98);
      const rip = Math.sin((c.ly + c.lx * 0.35 + n * 40) / 2.6);
      if (rip > 0.88) return D.outer[1];
      return D.outer[n < 0.5 ? 0 : 2];
    },
    decor(r, geo) {
      for (const p of scatter(map, geo, 2.8, 0.35, 99, { clear: 4.5 })) {
        if (desertTiled(map, p.x, p.y)) continue;
        if (p.h < 0.6) {
          // suchy krzaczek
          for (let k = -2; k <= 2; k++) {
            r.set(p.px + k, p.py - (2 - Math.abs(k)), D.shrub[1]);
            r.set(p.px + k, p.py, D.shrub[0]);
          }
          r.rect(p.px - 2, p.py + 1, 5, 1, D.ripLo);
        } else {
          // wyschnięta kość
          r.rect(p.px - 2, p.py, 5, 1, D.bone[0]);
          r.set(p.px - 3, p.py - 1, D.bone[0]);
          r.set(p.px + 3, p.py - 1, D.bone[0]);
          r.set(p.px - 3, p.py + 1, D.bone[1]);
          r.set(p.px + 3, p.py + 1, D.bone[1]);
          r.rect(p.px - 2, p.py + 1, 5, 1, D.ripLo);
        }
      }
    },
  };
}

/** Painter biomu dla mapy. */
export function biomePainter(map) {
  switch (map.biome) {
    case 'volcano':
      return volcano;
    case 'ice':
      return tundra;
    case 'forest':
      return forest;
    case 'graveyard':
      return graveyard;
    case 'desert':
      return makeDesert(map);
    default:
      return stone;
  }
}

export const BIOME_IDS = ['stone', 'volcano', 'ice', 'forest', 'graveyard', 'desert'];

// ---------------------------------------------------------------- hazardy

const LP = HAZARD_PALETTES.lava;
const IP = HAZARD_PALETTES.ice;
const QP = HAZARD_PALETTES.quicksand;
const BP = HAZARD_PALETTES.bush;

/** Iteruje piksele w otoczeniu hazardu: fn(px, py, dx, dy) — dx/dy w px od środka hazardu. */
function around(r, geo, z, pad, fn) {
  const zx = geo.cx + z.x * PPM;
  const zy = geo.cy + z.y * PPM;
  const hx = (z.shape === 'circle' ? z.r ?? 0 : (z.w ?? 0) / 2) * PPM + pad;
  const hy = (z.shape === 'circle' ? z.r ?? 0 : (z.h ?? 0) / 2) * PPM + pad;
  for (let py = Math.floor(zy - hy); py <= Math.ceil(zy + hy); py++) {
    for (let px = Math.floor(zx - hx); px <= Math.ceil(zx + hx); px++) {
      if (r.inside(px, py)) fn(px, py, px + 0.5 - zx, py + 0.5 - zy);
    }
  }
}

/** Odległość (px) od krawędzi kształtu hazardu, dodatnia wewnątrz. */
function hazardEdge(z, dx, dy) {
  if (z.shape === 'circle') return (z.r ?? 0) * PPM - Math.hypot(dx, dy);
  return Math.min(((z.w ?? 0) / 2) * PPM - Math.abs(dx), ((z.h ?? 0) / 2) * PPM - Math.abs(dy));
}

function paintLava(r, geo, z) {
  const R = (z.r ?? 1) * PPM;
  const glowPx = 1.3 * PPM;
  const seed = Math.round(z.x * 13 + z.y * 7);
  around(r, geo, z, glowPx, (px, py, dx, dy) => {
    const d = Math.hypot(dx, dy);
    const rr = z.shape === 'circle' ? R + (vnoise(px / 5, py / 5, 111) - 0.5) * 2.2 : R;
    const e = z.shape === 'circle' ? rr - d : hazardEdge(z, dx, dy);
    if (e < 0) {
      const t = 1 + e / glowPx;
      if (t > 0 && hash(px, py, 112) < t * 0.75) r.blend(px, py, LP.glow, 0.18 + t * 0.32);
      return;
    }
    if (e < 1) return r.set(px, py, LP.rim);
    if (e < 3.2) return r.set(px, py, hash(px, py, 113) < 0.3 ? LP.crust[1] : LP.crust[0]);
    if (e < 4.2) return r.set(px, py, LP.hot);
    const t = Math.max(0, Math.min(1, e / rr));
    const n = fbm(px / 9, py / 9, seed) * 0.7 + t * 0.6 + Math.sin((dx + dy) / 4 + fbm(px / 20, py / 20, seed + 3) * 6) * 0.07;
    // pływające płyty zastygłej skorupy
    const v = voronoi(px, py, 11, seed + 9);
    const plate = hash(v.id, 7, seed) < 0.24 && v.d2 - v.d1 > 2.2 && t < 0.62 && t > 0.12;
    let col;
    if (plate) col = v.d2 - v.d1 < 3.2 ? LP.crustHi : (px + py) & 1 ? LP.crust[1] : LP.crust[0];
    else if (e < 6.5) col = hash(px, py, 114) < 0.5 ? LP.hot : LP.orange;
    else if (n > 1.02) col = LP.white;
    else if (n > 0.86) col = LP.yellow;
    else if (n > 0.68) col = LP.amber;
    else if (n > 0.5) col = LP.orange;
    else col = LP.hot;
    r.set(px, py, col);
  });
}

function paintIce(r, geo, z) {
  const seed = Math.round(z.x * 11 + z.y * 5) + 200;
  around(r, geo, z, 4, (px, py, dx, dy) => {
    const e = hazardEdge(z, dx, dy);
    if (e < 0) {
      if (e > -1) r.set(px, py, IP.outline);
      else if (e > -3.5 && vnoise(px / 3, py / 3, seed) > 0.55 + (-e - 1) * 0.12) r.set(px, py, IP.drift[hash(px, py, seed) < 0.6 ? 0 : 1]);
      return;
    }
    const lit = z.shape === 'circle' ? dx + dy < 0 : (Math.abs(dx) > Math.abs(dy) * ((z.w ?? 1) / (z.h ?? 1)) ? dx < 0 : dy < 0);
    if (e < 1) return r.set(px, py, lit ? IP.rimHi : IP.rimLo);
    if (e < 2) return r.set(px, py, lit ? IP.bevel : IP.deep);
    const v = fbm(px / 16, py / 16, seed);
    let col = v < 0.4 ? IP.deep : v < 0.62 ? IP.base : IP.light;
    const q = frac((px * 0.7 + py) / 21 + fbm(px / 34, py / 34, seed + 1) * 1.4);
    if (q < 0.055) col = q < 0.02 && hash(px, py, seed + 2) < 0.5 ? IP.glint : IP.streak;
    else if (q > 0.12 && q < 0.15) col = IP.streak2;
    const vc = voronoi(px, py, 28, seed + 3);
    if (vc.d2 - vc.d1 < 0.9 && pairHash(vc.id, vc.id2, seed) < 0.3) col = IP.crack;
    if (hash(px, py, seed + 4) < 0.003) col = IP.glint;
    r.set(px, py, col);
  });
}

function paintQuicksand(r, geo, z) {
  const R = (z.r ?? 1) * PPM;
  around(r, geo, z, 9, (px, py, dx, dy) => {
    const d = Math.hypot(dx, dy);
    const rr = R + (vnoise(px / 4, py / 4, 121) - 0.5) * 1.6;
    if (d >= rr) {
      const o = d - rr;
      if (o < 1) r.set(px, py, QP.rim);
      else if (o < 5 && hash(px, py, 122) < 0.6 - o * 0.08) r.set(px, py, QP.ring);
      else if (o > 6 && o < 7.2 && hash(px, py, 123) < 0.5) r.set(px, py, QP.ripple);
      return;
    }
    const t = d / rr;
    if (t < 0.14) return r.set(px, py, hash(px, py, 124) < 0.5 ? QP.pit[0] : QP.pit[1]);
    const a = Math.atan2(dy, dx);
    const ph = frac((a / (Math.PI * 2)) * 3 + Math.sqrt(t) * 2.4);
    let col = t < 0.45 ? QP.inner : QP.base[hash(px, py, 125) < 0.5 ? 0 : 1];
    if (ph < 0.17) col = t < 0.3 ? QP.pit[1] : QP.groove;
    else if (ph < 0.25) col = QP.sheen;
    if (rr - d < 1.5) col = QP.groove;
    r.set(px, py, col);
  });
}

function paintBushShadow(r, geo, z) {
  const R = (z.r ?? 1) * PPM;
  const zx = geo.cx + z.x * PPM + 1;
  const zy = geo.cy + z.y * PPM + R * 0.18;
  const rx = R * 1.02;
  const ry = R * 0.86;
  for (let py = Math.floor(zy - ry - 4); py <= Math.ceil(zy + ry + 4); py++) {
    for (let px = Math.floor(zx - rx - 4); px <= Math.ceil(zx + rx + 4); px++) {
      const nx = (px + 0.5 - zx) / rx;
      const ny = (py + 0.5 - zy) / ry;
      const q = nx * nx + ny * ny;
      if (q <= 1) r.set(px, py, hash(px, py, 131) < 0.7 ? BP.shadow[0] : BP.shadow[1]);
      else if (q < 1.45 && hash(px, py, 132) < 0.12) r.set(px, py, BP.litter[hash(px, py, 133) < 0.7 ? 0 : 1]);
    }
  }
}

export const HAZARD_PAINTERS = { lava: paintLava, ice: paintIce, quicksand: paintQuicksand, bush: paintBushShadow };

// ---------------------------------------------------------------- cienie przeszkód

/** Rozmiar cienia przeszkody (rx względem r). */
const SHADOW_SCALE = { tree: 1.55, crypt: 1.2, ruin: 1.15 };

function paintObstacleShadow(r, geo, o) {
  const rx = o.r * PPM * (SHADOW_SCALE[o.kind] ?? 1.02);
  const ry = rx * 0.45;
  const zx = geo.cx + o.x * PPM + 2;
  const zy = geo.cy + (o.y + o.r * 0.5) * PPM;
  for (let py = Math.floor(zy - ry); py <= Math.ceil(zy + ry); py++) {
    for (let px = Math.floor(zx - rx); px <= Math.ceil(zx + rx); px++) {
      const nx = (px + 0.5 - zx) / rx;
      const ny = (py + 0.5 - zy) / ry;
      const q = nx * nx + ny * ny;
      if (q > 1) continue;
      r.blend(px, py, '#05050a', q > 0.7 ? 0.3 : 0.45);
    }
  }
}

// ---------------------------------------------------------------- całość

/**
 * Buduje raster tła mapy.
 * @param {import('../../sim/maps.js').MapDef} map
 * @returns {{raster: Raster, cx: number, cy: number}}
 */
export function buildMapRaster(map) {
  const geo = mapGeometry(map);
  const B = biomePainter(map);
  const r = new Raster(geo.w, geo.h);
  const c = { px: 0, py: 0, lx: 0, ly: 0, wx: 0, wy: 0, s: 0, o: 0, al: 0, corner: false };
  const fade0 = MARGIN_M - 1.4;
  for (let py = 0; py < geo.h; py++) {
    for (let px = 0; px < geo.w; px++) {
      c.px = px;
      c.py = py;
      c.lx = px - geo.cx;
      c.ly = py - geo.cy;
      c.wx = (c.lx + 0.5) / PPM;
      c.wy = (c.ly + 0.5) / PPM;
      const s = geo.sd(c.wx, c.wy);
      c.s = s;
      let col = null;
      if (s >= 0) {
        col = B.floor(c);
        if (s < VIG_M && hash(px, py, 7) < (VIG_M - s) / (VIG_M * 1.5)) col = B.vig;
      } else if (s > -WALL_M) {
        c.o = -s;
        geo.edge(c.wx, c.wy, c);
        col = B.wall(c);
      } else {
        c.o = -s - WALL_M;
        if (c.o <= MARGIN_M && !(c.o > fade0 && hash(px, py, 9) < (c.o - fade0) / 1.4)) col = B.outer(c);
      }
      if (col) r.set(px, py, col);
    }
  }
  B.decor?.(r, geo, map);
  for (const z of map.hazards) HAZARD_PAINTERS[z.kind]?.(r, geo, z);
  for (const o of map.obstacles) paintObstacleShadow(r, geo, o);
  return { raster: r, cx: geo.cx, cy: geo.cy };
}
