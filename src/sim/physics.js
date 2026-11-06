import { getMap, inHazard } from './maps.js';

/**
 * Fizyka statyczna zależna od mapy: granica (koło lub prostokąt) i przeszkody (koła).
 * Mapa jest wiązana na czas kroku symulacji (bindMap), poza krokiem obowiązuje „arena”.
 */
let current = getMap('arena');

/** @param {string|null|undefined} mapId */
export const bindMap = (mapId) => {
  current = getMap(mapId);
};
export const currentMap = () => current;

/** Klampuje punkt do wnętrza areny (z promieniem r). Zwraca true, jeśli był poza. */
function clampToBounds(e, r, m = current) {
  if (m.shape === 'rect') {
    const hw = (m.hw ?? 16) - r;
    const hh = (m.hh ?? 16) - r;
    let out = false;
    if (e.x > hw) (e.x = hw), (out = true);
    if (e.x < -hw) (e.x = -hw), (out = true);
    if (e.y > hh) (e.y = hh), (out = true);
    if (e.y < -hh) (e.y = -hh), (out = true);
    return out;
  }
  const maxR = (m.radius ?? 16) - r;
  const d = Math.hypot(e.x, e.y);
  if (d > maxR) {
    e.x = (e.x / d) * maxR;
    e.y = (e.y / d) * maxR;
    return true;
  }
  return false;
}

/**
 * Wypycha okrąg z przeszkód i trzyma go w arenie. Mutuje e.x/e.y.
 * @param {{x:number,y:number}} e @param {number} r
 * @returns {boolean} czy była kolizja z przeszkodą
 */
export function resolveStatic(e, r) {
  let hit = false;
  for (const p of current.obstacles) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = p.r + r;
    if (d < min) {
      hit = true;
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      e.x = p.x + nx * min;
      e.y = p.y + ny * min;
    }
  }
  clampToBounds(e, r);
  return hit;
}

/** @param {number} x @param {number} y @param {number} r */
export function hitsPillar(x, y, r) {
  for (const p of current.obstacles) if (Math.hypot(x - p.x, y - p.y) < p.r + r) return true;
  return false;
}

/** @param {number} x @param {number} y @param {number} r */
export function outsideArena(x, y, r) {
  const m = current;
  if (m.shape === 'rect') return Math.abs(x) > (m.hw ?? 16) - r || Math.abs(y) > (m.hh ?? 16) - r;
  return Math.hypot(x, y) > (m.radius ?? 16) - r;
}

/** Wypycha a z b (b nieruchome). */
export function pushOut(a, ar, b, br) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  const min = ar + br;
  if (d < min) {
    const nx = d > 1e-6 ? dx / d : 1;
    const ny = d > 1e-6 ? dy / d : 0;
    a.x = b.x + nx * min;
    a.y = b.y + ny * min;
    return true;
  }
  return false;
}

/** Czy punkt leży w groźnym hazardzie (lawa, ruchome piaski). */
const inBadHazard = (x, y, m = current) => m.hazards.some((z) => (z.kind === 'lava' || z.kind === 'quicksand') && inHazard(z, x, y, 0.8));

/** Losowy punkt w arenie, poza przeszkodami i groźnymi hazardami. @param {import('./rng.js').Rng} rng @param {number} r */
export function randomArenaPoint(rng, r, margin = 2) {
  const m = current;
  for (let i = 0; i < 30; i++) {
    let x;
    let y;
    if (m.shape === 'rect') {
      x = (rng.next() * 2 - 1) * ((m.hw ?? 16) - margin);
      y = (rng.next() * 2 - 1) * ((m.hh ?? 16) - margin);
    } else {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * ((m.radius ?? 16) - margin);
      x = Math.cos(a) * d;
      y = Math.sin(a) * d;
    }
    if (!hitsPillar(x, y, r + 0.3) && !inBadHazard(x, y)) return [x, y];
  }
  return [0, 0];
}

/** Punkt na obrzeżu areny (wejścia fal przeciwników). @param {import('./rng.js').Rng} rng */
export function edgePoint(rng, inset = 1.5) {
  const m = current;
  for (let i = 0; i < 20; i++) {
    let x;
    let y;
    if (m.shape === 'rect') {
      const side = rng.int(4);
      const t = rng.next() * 2 - 1;
      const hw = (m.hw ?? 16) - inset;
      const hh = (m.hh ?? 16) - inset;
      [x, y] = side === 0 ? [t * hw, -hh] : side === 1 ? [hw, t * hh] : side === 2 ? [t * hw, hh] : [-hw, t * hh];
    } else {
      const a = rng.next() * Math.PI * 2;
      const R = (m.radius ?? 16) - inset;
      x = Math.cos(a) * R;
      y = Math.sin(a) * R;
    }
    if (!hitsPillar(x, y, 0.8) && !inBadHazard(x, y)) return [x, y];
  }
  return [0, 0];
}

const SPAWNS = 8;
/** Punkt odrodzenia nr i dla mapy (deterministyczny, poza przeszkodami i hazardami). @param {number} i @param {string} [mapId] */
export function mapSpawnPoint(i, mapId) {
  const m = mapId ? getMap(mapId) : current;
  const base = (i % SPAWNS) / SPAWNS;
  for (let k = 0; k < 16; k++) {
    const a = (base + k * 0.021) * Math.PI * 2 + Math.PI / 8;
    const f = 0.78 - (k % 4) * 0.06;
    const x = m.shape === 'rect' ? Math.cos(a) * (m.hw ?? 16) * f : Math.cos(a) * (m.radius ?? 16) * f;
    const y = m.shape === 'rect' ? Math.sin(a) * (m.hh ?? 16) * f : Math.sin(a) * (m.radius ?? 16) * f;
    const blocked = m.obstacles.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + 0.8) || inBadHazard(x, y, m);
    if (!blocked) return [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
  }
  return [0, 0];
}
