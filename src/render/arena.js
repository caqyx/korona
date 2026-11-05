/**
 * Podłoga areny w pixel art: kamienne płyty, pęknięcia, mech, runy w centrum,
 * ceglany mur na obwodzie. Renderowana raz do bufora i cachowana.
 */
import { MATCH } from '../sim/config.js';
import { PPM } from './sprites.js';

/** Deterministyczny szum (hash) — ta sama arena u wszystkich graczy. */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FLOOR = ['#23243a', '#272842', '#2b2c48', '#1f2034'];
const GROUT = '#15151f';
const WALL = ['#3a3550', '#2c2840', '#4a4466'];
const MOSS = '#2f4a3a';
const RUNE = '#4b3f8a';

let cached = /** @type {{img:HTMLCanvasElement, off:number}|null} */ (null);

/** Zwraca bufor areny i przesunięcie środka (w pikselach sztuki). */
export function getArenaCanvas() {
  if (cached) return cached;
  const R = MATCH.arenaRadius * PPM;
  const wall = PPM;
  const off = Math.ceil(R + wall + 2);
  const size = off * 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const tile = PPM; // płyta 1 m
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - off + 0.5;
      const dy = y - off + 0.5;
      const d = Math.hypot(dx, dy);
      if (d > R + wall) continue;
      if (d > R) {
        // mur: cegły układane wzdłuż obwodu
        const a = Math.atan2(dy, dx);
        const row = Math.floor((d - R) / 4);
        const brick = Math.floor((a * R) / 7 + row * 0.5);
        const frac = ((((a * R) / 7 + row * 0.5) % 1) + 1) % 1;
        const edge = (d - R) % 4 < 1 || frac < 0.12;
        g.fillStyle = edge ? GROUT : WALL[(((brick + row) % 2) + 2) % 2];
        if (d - R < 1.2) g.fillStyle = WALL[2];
        g.fillRect(x, y, 1, 1);
        continue;
      }
      const tx = Math.floor((x - off) / tile);
      const ty = Math.floor((y - off) / tile);
      const lx = (x - off) - tx * tile;
      const ly = (y - off) - ty * tile;
      const n = hash(tx, ty);
      let col = FLOOR[Math.floor(n * 3)];
      if (lx === 0 || ly === 0) col = GROUT;
      else if (lx === 1 || ly === 1) col = '#30314f';
      else {
        const p = hash(x, y);
        if (p < 0.04) col = FLOOR[3];
        else if (p > 0.985) col = '#34355a';
        if (n > 0.9 && hash(x * 3, y * 7) < 0.3) col = MOSS;
        // pęknięcia
        if (n < 0.06 && Math.abs(lx - ly - Math.floor(n * 80) % 5) < 0.6) col = GROUT;
      }
      // ciemniej przy murze (winieta)
      if (d > R - 18 && hash(x + 7, y + 3) < (d - (R - 18)) / 30) col = FLOOR[3];
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  // krąg run w centrum (miejsce korony)
  g.fillStyle = RUNE;
  for (let i = 0; i < 360; i += 1) {
    const a = (i * Math.PI) / 180;
    for (const rr of [2.2 * PPM, 2.2 * PPM + 1]) g.fillRect(Math.round(off + Math.cos(a) * rr), Math.round(off + Math.sin(a) * rr), 1, 1);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rx = Math.round(off + Math.cos(a) * 3.1 * PPM);
    const ry = Math.round(off + Math.sin(a) * 3.1 * PPM);
    g.fillRect(rx - 1, ry - 2, 3, 1);
    g.fillRect(rx, ry - 2, 1, 5);
    g.fillRect(rx - 1, ry + 2, 3, 1);
  }
  cached = { img: c, off };
  return cached;
}
