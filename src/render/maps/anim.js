/**
 * Tanie animowane detale map rysowane co klatkę na buforze niskiej rozdzielczości:
 * bąble i iskry lawy, wir ruchomych piasków, błyski lodu (+ płatki śniegu), świetliki w lesie,
 * mgła na cmentarzu, drgania gorąca na pustyni, pulsujące runy na kamiennej arenie.
 * Wyłącznie fillRect na całkowitych współrzędnych; ~100–400 wywołań na klatkę.
 * Moduł nie tworzy elementów DOM (przyjmuje gotowy kontekst g), więc da się go testować na atrapie.
 */
import { PPM } from '../sprites.js';
import { hash } from './noise.js';
import { HAZARD_PALETTES } from './ground.js';

const LP = HAZARD_PALETTES.lava;
const QP = HAZARD_PALETTES.quicksand;

/** Krótki stan per mapa (pozycje cząstek w metrach). @type {Map<string, any>} */
const stateCache = new Map();

function inside(map, x, y, pad = 0) {
  if (map.shape === 'rect') return Math.abs(x) < (map.hw ?? 16) - pad && Math.abs(y) < (map.hh ?? 16) - pad;
  return Math.hypot(x, y) < (map.radius ?? 16) - pad;
}

function stateFor(map) {
  let st = stateCache.get(map.id);
  if (st) return st;
  const ext = map.shape === 'rect' ? Math.max(map.hw ?? 16, map.hh ?? 16) : map.radius ?? 16;
  const pts = (n, seed, pad) => {
    const out = [];
    for (let i = 0; out.length < n && i < n * 20; i++) {
      const x = (hash(i, 1, seed) * 2 - 1) * ext;
      const y = (hash(i, 2, seed) * 2 - 1) * ext;
      if (inside(map, x, y, pad)) out.push({ x, y, h: hash(i, 3, seed) });
    }
    return out;
  };
  st = {
    fireflies: map.biome === 'forest' ? pts(16, 401, 1.5) : [],
    wisps: map.biome === 'graveyard' ? pts(8, 402, 1) : [],
    shimmer: map.biome === 'desert' ? pts(26, 403, 1) : [],
    flakes: map.biome === 'ice' ? pts(34, 404, -1) : [],
    embers: map.biome === 'volcano' ? pts(14, 405, 0) : [],
  };
  // chmurka mgły: stały rozrzut pikseli w elipsie
  st.wispShape = [];
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 0, 406) * Math.PI * 2;
    const d = Math.sqrt(hash(i, 1, 406));
    st.wispShape.push([Math.round(Math.cos(a) * d * 16), Math.round(Math.sin(a) * d * 3.5), hash(i, 2, 406) < 0.4 ? 1 : 0]);
  }
  stateCache.set(map.id, st);
  return st;
}

/**
 * @param {CanvasRenderingContext2D} g kontekst bufora sztuki
 * @param {import('../../sim/maps.js').MapDef} map
 * @param {(x:number, y:number) => [number, number]} toArt świat → całkowite px sztuki
 * @param {number} time sekundy
 */
export function drawHazardsAnimated(g, map, toArt, time) {
  const st = stateFor(map);
  const [ox, oy] = toArt(0, 0);
  const T = time;
  const rect = (col, x, y, w = 1, h = 1) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };

  for (let zi = 0; zi < map.hazards.length; zi++) {
    const z = map.hazards[zi];
    const [zx, zy] = toArt(z.x, z.y);
    const R = (z.r ?? Math.min(z.w ?? 2, z.h ?? 2) / 2) * PPM;
    if (z.kind === 'lava') {
      // bąble: rosną i pękają w losowych miejscach
      const nb = Math.round(3 + R / 6);
      for (let i = 0; i < nb; i++) {
        const P = 1.3 + hash(i, zi, 410) * 1.4;
        const u = T / P + hash(i, zi, 411);
        const cyc = Math.floor(u);
        const ph = u - cyc;
        const a = hash(i, cyc, 412 + zi) * Math.PI * 2;
        const d = Math.sqrt(hash(i, cyc, 413 + zi)) * (R - 7);
        const bx = Math.round(zx + Math.cos(a) * d);
        const by = Math.round(zy + Math.sin(a) * d);
        if (ph < 0.62) {
          const s = ph < 0.25 ? 1 : 2;
          rect(LP.hot, bx - 1, by - 1, s + 2, s + 2);
          rect(LP.yellow, bx, by - 1, s, s + 1);
          rect(LP.white, bx, by - 1, 1, 1);
        } else if (ph < 0.8) {
          rect(LP.white, bx - 2, by - 1, 1, 1);
          rect(LP.white, bx + 2, by - 1, 1, 1);
          rect(LP.yellow, bx, by - 3, 1, 1);
          rect(LP.yellow, bx, by + 1, 1, 1);
        }
      }
      // iskry unoszące się nad jeziorkiem
      const ns = Math.round(3 + R / 8);
      for (let i = 0; i < ns; i++) {
        const P = 1.1 + hash(i, zi, 414) * 0.9;
        const u = T / P + hash(i, zi, 415);
        const cyc = Math.floor(u);
        const ph = u - cyc;
        if (ph > 0.85) continue;
        const a = hash(i, cyc, 416) * Math.PI * 2;
        const d = Math.sqrt(hash(i, cyc, 417)) * R * 0.8;
        const sx = Math.round(zx + Math.cos(a) * d + Math.sin(ph * 9 + i) * 1.5);
        const sy = Math.round(zy + Math.sin(a) * d - ph * 22);
        rect(ph < 0.4 ? LP.yellow : ph < 0.65 ? LP.amber : LP.hot, sx, sy);
      }
    } else if (z.kind === 'quicksand') {
      // obracający się wir (3 ramiona spirali, jasne i ciemne ziarna)
      const N = 20;
      for (let arm = 0; arm < 3; arm++) {
        for (let k = 1; k < N; k++) {
          const t = k / N;
          const a = (arm / 3) * Math.PI * 2 - Math.sqrt(t) * 2.4 * Math.PI * 2 / 3 + T * 1.1 + 0.35;
          const d = t * (R - 3);
          rect(k % 3 === 0 ? QP.sheen : QP.groove, Math.round(zx + Math.cos(a) * d), Math.round(zy + Math.sin(a) * d));
        }
      }
      // ziarna wciągane do środka
      for (let i = 0; i < 8; i++) {
        const P = 2.2 + hash(i, zi, 420);
        const u = T / P + hash(i, zi, 421);
        const ph = u - Math.floor(u);
        const a = hash(i, Math.floor(u), 422) * Math.PI * 2 + ph * 2.5;
        const d = (1 - ph) * (R + 4);
        rect(QP.ring, Math.round(zx + Math.cos(a) * d), Math.round(zy + Math.sin(a) * d));
      }
    } else if (z.kind === 'ice') {
      // migoczące błyski (krzyżyki)
      const hw = (z.shape === 'circle' ? z.r ?? 1 : (z.w ?? 2) / 2) * PPM - 4;
      const hh = (z.shape === 'circle' ? z.r ?? 1 : (z.h ?? 2) / 2) * PPM - 4;
      const ng = Math.round(3 + (hw * hh) / 900);
      for (let i = 0; i < ng; i++) {
        const P = 1.6 + hash(i, zi, 430) * 1.8;
        const u = T / P + hash(i, zi, 431);
        const cyc = Math.floor(u);
        const ph = u - cyc;
        if (ph > 0.3) continue;
        let gx = (hash(i, cyc, 432) * 2 - 1) * hw;
        let gy = (hash(i, cyc, 433) * 2 - 1) * hh;
        if (z.shape === 'circle' && gx * gx + gy * gy > hw * hw) {
          gx *= 0.6;
          gy *= 0.6;
        }
        const x = Math.round(zx + gx);
        const y = Math.round(zy + gy);
        const big = ph > 0.08 && ph < 0.22;
        rect('#ffffff', x, y);
        if (big) {
          rect('#c4efff', x - 2, y, 1, 1);
          rect('#c4efff', x + 2, y, 1, 1);
          rect('#c4efff', x, y - 2, 1, 1);
          rect('#c4efff', x, y + 2, 1, 1);
          rect('#ffffff', x - 1, y, 3, 1);
          rect('#ffffff', x, y - 1, 1, 3);
        }
      }
      // przesuwający się połysk (ukośna smuga co ~5 s)
      const sweep = ((T + zi * 1.7) % 5) / 5;
      if (sweep < 0.5) {
        const span = hw + hh;
        const k = (sweep / 0.5) * span * 2 - span;
        g.fillStyle = '#e6f8ff';
        for (let s = -hh; s <= hh; s += 2) {
          const x = Math.round(k - s * 0.7);
          if (Math.abs(x) > hw) continue;
          if (z.shape === 'circle' && x * x + s * s > hw * hw) continue;
          g.fillRect(Math.round(zx + x), Math.round(zy + s), 2, 1);
        }
      }
    }
  }

  // ---- biom
  if (map.biome === 'forest') {
    for (let i = 0; i < st.fireflies.length; i++) {
      const f = st.fireflies[i];
      const b = Math.sin(T * (1.3 + f.h) + i * 2.1);
      if (b < 0.1) continue;
      const x = Math.round(ox + (f.x + Math.sin(T * 0.45 + i) * 1.2) * PPM);
      const y = Math.round(oy + (f.y + Math.cos(T * 0.37 + i * 1.7) * 0.8) * PPM - 6);
      if (b > 0.6) {
        rect('#5a7a2a', x - 1, y, 3, 1);
        rect('#5a7a2a', x, y - 1, 1, 3);
      }
      rect(b > 0.5 ? '#f4ff9a' : '#c8e85a', x, y);
    }
  } else if (map.biome === 'graveyard') {
    const W = (map.hw ?? 16) * PPM;
    for (let i = 0; i < st.wisps.length; i++) {
      const w = st.wisps[i];
      const sp = 0.25 + w.h * 0.35;
      let wx = w.x * PPM + T * sp * PPM * (i % 2 ? 1 : -1);
      wx = ((((wx + W) % (W * 2)) + W * 2) % (W * 2)) - W;
      const x = Math.round(ox + wx);
      const y = Math.round(oy + w.y * PPM + Math.sin(T * 0.6 + i) * 2);
      const shimmer = Math.floor(T * 3 + i);
      for (let k = 0; k < st.wispShape.length; k++) {
        const [dx, dy, hi] = st.wispShape[k];
        if ((k + shimmer) % 5 === 0) continue;
        if (Math.abs(wx + dx) > W - 2) continue;
        rect(hi ? '#9a9eb8' : '#6e7290', x + dx, y + dy, 2, 1);
      }
    }
  } else if (map.biome === 'desert') {
    const slot = Math.floor(T * 7);
    for (let i = 0; i < st.shimmer.length; i++) {
      const s = st.shimmer[i];
      if (hash(i, slot, 440) < 0.45) continue;
      const x = Math.round(ox + s.x * PPM + Math.sin(T * 5 + i) * 1.5);
      const y = Math.round(oy + s.y * PPM);
      rect(hash(i, slot, 441) < 0.5 ? '#f6dca0' : '#fff0c8', x, y, 2 + (i % 3), 1);
    }
  } else if (map.biome === 'ice') {
    for (let i = 0; i < st.flakes.length; i++) {
      const f = st.flakes[i];
      const H = ((map.hh ?? 12) + 2) * 2 * PPM;
      const fy = ((((f.y + 14) * PPM + T * (8 + f.h * 8)) % H) + H) % H - H / 2;
      const x = Math.round(ox + f.x * PPM + Math.sin(T * 1.2 + i) * 3 - T * 3 * f.h);
      rect(f.h > 0.7 ? '#ffffff' : '#e6eef8', x, Math.round(oy + fy));
    }
  } else if (map.biome === 'volcano') {
    for (let i = 0; i < st.embers.length; i++) {
      const e = st.embers[i];
      const P = 3 + e.h * 3;
      const ph = ((T / P + e.h) % 1 + 1) % 1;
      const x = Math.round(ox + e.x * PPM + Math.sin(T * 2 + i) * 3);
      const y = Math.round(oy + e.y * PPM - ph * 40);
      rect(ph < 0.5 ? LP.amber : LP.hot, x, y);
    }
  } else if (map.biome === 'stone') {
    // runy wokół korony zapalają się po kolei
    const k = Math.floor(T * 2) % 8;
    for (const kk of [k, (k + 4) % 8]) {
      const a = (kk / 8) * Math.PI * 2;
      const rx = Math.round(ox + Math.cos(a) * 3.1 * PPM);
      const ry = Math.round(oy + Math.sin(a) * 3.1 * PPM);
      g.fillStyle = '#8f7fff';
      g.fillRect(rx - 1, ry - 2, 3, 1);
      g.fillRect(rx, ry - 2, 1, 5);
      g.fillRect(rx - 1, ry + 2, 3, 1);
    }
  }
}
