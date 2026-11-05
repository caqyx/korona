import { MATCH } from './config.js';

/**
 * Wypycha okrąg z filarów i trzyma go w arenie. Mutuje e.x/e.y.
 * @param {{x:number,y:number}} e @param {number} r
 * @returns {boolean} czy była kolizja z filarem
 */
export function resolveStatic(e, r) {
  let hit = false;
  for (const p of MATCH.pillars) {
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
  const maxR = MATCH.arenaRadius - r;
  const d = Math.hypot(e.x, e.y);
  if (d > maxR) {
    e.x = (e.x / d) * maxR;
    e.y = (e.y / d) * maxR;
  }
  return hit;
}

/** @param {number} x @param {number} y @param {number} r */
export function hitsPillar(x, y, r) {
  for (const p of MATCH.pillars) if (Math.hypot(x - p.x, y - p.y) < p.r + r) return true;
  return false;
}

/** @param {number} x @param {number} y @param {number} r */
export const outsideArena = (x, y, r) => Math.hypot(x, y) > MATCH.arenaRadius - r;

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

/** Losowy punkt w arenie, poza filarami. @param {import('./rng.js').Rng} rng @param {number} r @param {number} [maxR] */
export function randomArenaPoint(rng, r, maxR = MATCH.arenaRadius - 2) {
  for (let i = 0; i < 20; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * maxR;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    if (!hitsPillar(x, y, r + 0.3)) return [x, y];
  }
  return [0, 0];
}
