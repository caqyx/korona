import { getMap, inHazard } from './maps.js';
import { MATCH } from './config.js';
import { distToSegment, q } from './vec.js';

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

/**
 * Pierwsza przeszkoda mapy przecinająca odcinek A–B (z zapasem r, np. promień pocisku) albo null.
 * Służy botom i minionom do sprawdzania linii strzału; mapę podaje się jawnie, bo boty liczą
 * input także poza krokiem symulacji (bez bindMap).
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} r
 * @param {import('./maps.js').MapDef} [m]
 * @returns {import('./maps.js').Obstacle|null}
 */
export function obstacleOnSegment(ax, ay, bx, by, r, m = current) {
  for (const o of m.obstacles) if (distToSegment(o.x, o.y, ax, ay, bx, by) < o.r + r) return o;
  return null;
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
/** Czy w punkcie nie można postawić bohatera (przeszkoda z zapasem albo groźny hazard). */
const spawnBlocked = (x, y, m) => m.obstacles.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + 0.8) || inBadHazard(x, y, m);

/** Punkt odrodzenia nr i dla mapy (deterministyczny, poza przeszkodami i hazardami). @param {number} i @param {string} [mapId] */
export function mapSpawnPoint(i, mapId) {
  const m = mapId ? getMap(mapId) : current;
  const base = (i % SPAWNS) / SPAWNS;
  for (let k = 0; k < 16; k++) {
    const a = (base + k * 0.021) * Math.PI * 2 + Math.PI / 8;
    const f = 0.78 - (k % 4) * 0.06;
    const x = m.shape === 'rect' ? Math.cos(a) * (m.hw ?? 16) * f : Math.cos(a) * (m.radius ?? 16) * f;
    const y = m.shape === 'rect' ? Math.sin(a) * (m.hh ?? 16) * f : Math.sin(a) * (m.radius ?? 16) * f;
    if (!spawnBlocked(x, y, m)) return [q(x), q(y)];
  }
  return [0, 0];
}

const START_TURNS = 48;
const START_RINGS = 16;
/** Promień „korytarza” (m) na prostej drodze do korony: promień bohatera (0,4) + minimalny luz. */
const START_PATH_MARGIN = 0.42;

/** Czy prosta droga z (x, y) do korony w (0, 0) zahacza o przeszkodę albo groźny hazard. */
function pathToCrownBlocked(x, y, m) {
  if (obstacleOnSegment(x, y, 0, 0, START_PATH_MARGIN, m)) return true;
  const steps = Math.ceil(Math.hypot(x, y) / 0.5);
  for (let i = 1; i < steps; i++) if (inBadHazard((x * i) / steps, (y * i) / steps, m)) return true;
  return false;
}

/** Czy punkt leży na lodzie (start z lodu = wolniejsze ruszenie z miejsca). */
const onIce = (x, y, m) => m.hazards.some((z) => z.kind === 'ice' && inHazard(z, x, y, 0.4));

/**
 * Szuka układu n punktów równo co 1/n okręgu, na wspólnym promieniu, w którym każdy punkt spełnia `ok`.
 * Gdy któryś punkt odpada, obracany jest CAŁY układ (a potem zmniejszany promień) — nigdy pojedynczy gracz.
 * @returns {[number, number][]|null}
 */
function startLayout(m, count, ok) {
  const base = m.shape === 'rect' ? Math.min(m.hw ?? 16, m.hh ?? 16) : (m.radius ?? 16);
  for (let ring = 0; ring < START_RINGS; ring++) {
    const R = base * (MATCH.startRing - ring * 0.03);
    for (let k = 0; k < START_TURNS; k++) {
      const turn = k / (START_TURNS * count);
      const pts = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count + turn) * Math.PI * 2 + Math.PI / 8;
        pts.push(/** @type {[number, number]} */ ([q(Math.cos(a) * R), q(Math.sin(a) * R)]));
      }
      if (pts.every(([x, y]) => ok(x, y))) return pts;
    }
  }
  return null;
}

/**
 * Punkty startowe meczu — „równy start”: n graczy równo co 1/n okręgu, wszyscy w tej samej odległości
 * od korony (mapy prostokątne: promień od krótszego półboku, nie elipsa), poza przeszkodami, lawą,
 * piaskami i lodem, z wolną prostą drogą do środka. Jeśli taki układ nie istnieje, wystarcza sam
 * wolny punkt startu. Punkty odrodzeń (mapSpawnPoint) pozostają bez zmian.
 * @param {number} n liczba graczy @param {string} [mapId]
 * @returns {[number, number][]}
 */
export function mapStartPoints(n, mapId) {
  const m = mapId ? getMap(mapId) : current;
  const count = Math.max(1, Math.floor(n));
  const fair = startLayout(m, count, (x, y) => !spawnBlocked(x, y, m) && !onIce(x, y, m) && !pathToCrownBlocked(x, y, m));
  const pts = fair ?? startLayout(m, count, (x, y) => !spawnBlocked(x, y, m));
  // awaryjnie (nie zdarza się na żadnej z map — pilnuje tego test) zwykłe punkty odrodzeń
  return pts ?? Array.from({ length: count }, (_, i) => /** @type {[number, number]} */ (mapSpawnPoint(i, mapId)));
}
