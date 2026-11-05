/** Proste operacje 2D na liczbach (bez alokacji obiektów w gorących ścieżkach). */

export const TAU = Math.PI * 2;

/** @param {number} x @param {number} y */
export const len = (x, y) => Math.hypot(x, y);

/** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** @param {number} v @param {number} a @param {number} b */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Różnica kątów w zakresie [-PI, PI]. @param {number} a @param {number} b */
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Normalizuje wektor; zwraca [0,0] dla zerowego. @param {number} x @param {number} y @returns {[number, number]} */
export function norm(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? [x / l, y / l] : [0, 0];
}

/** Zaokrągla do 1e-4 — trzyma snapshot krótki i stabilny. @param {number} v */
export const q = (v) => Math.round(v * 1e4) / 1e4;

/** Odległość punktu od odcinka. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
