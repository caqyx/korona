/**
 * Mapy (areny). Każda ma biom (styl graficzny), kształt granicy, przeszkody (koła blokujące
 * ruch i pociski) oraz mechanikę terenu (hazardy). Środek (0,0) jest zawsze wolny — tam leży korona.
 *
 * @typedef {{x:number,y:number,r:number,kind:string}} Obstacle
 * @typedef {{kind:'lava'|'ice'|'bush'|'quicksand', shape:'circle'|'rect', x:number, y:number, r?:number, w?:number, h?:number}} Hazard
 * @typedef {{kind:'graveHands', every:number, count:number, radius:number, telegraph:number}} MapEvent
 * @typedef {{id:string, name:string, biome:string, desc:string,
 *   shape:'circle'|'rect', radius?:number, hw?:number, hh?:number,
 *   obstacles:Obstacle[], hazards:Hazard[], events:MapEvent[]}} MapDef
 */

/** @type {Record<string, MapDef>} */
export const MAPS = {
  arena: {
    id: 'arena',
    name: 'Kamienna Arena',
    biome: 'stone',
    desc: 'Klasyczna okrągła arena z pięcioma filarami. Bez pułapek.',
    shape: 'circle',
    radius: 16,
    obstacles: [
      { x: 0, y: -8.5, r: 1.1, kind: 'pillar' },
      { x: 8.1, y: -2.6, r: 1.1, kind: 'pillar' },
      { x: 5.0, y: 6.9, r: 1.1, kind: 'pillar' },
      { x: -5.0, y: 6.9, r: 1.1, kind: 'pillar' },
      { x: -8.1, y: -2.6, r: 1.1, kind: 'pillar' },
    ],
    hazards: [],
    events: [],
  },
  wulkan: {
    id: 'wulkan',
    name: 'Krater Wulkanu',
    biome: 'volcano',
    desc: 'Jeziorka lawy parzą bohaterów (1 dmg co sekundę). Dash nad lawą jest bezpieczny.',
    shape: 'circle',
    radius: 16,
    obstacles: [
      { x: -6, y: -6, r: 1.2, kind: 'rock' },
      { x: 6.5, y: -5.5, r: 1.0, kind: 'rock' },
      { x: 6, y: 6.5, r: 1.2, kind: 'rock' },
      { x: -6.5, y: 6, r: 1.0, kind: 'rock' },
    ],
    hazards: [
      { kind: 'lava', shape: 'circle', x: 0, y: -10.5, r: 2.3 },
      { kind: 'lava', shape: 'circle', x: 10, y: 3.5, r: 2.0 },
      { kind: 'lava', shape: 'circle', x: -10, y: 3.5, r: 2.0 },
      { kind: 'lava', shape: 'circle', x: 0, y: 10.5, r: 1.7 },
    ],
    events: [],
  },
  tundra: {
    id: 'tundra',
    name: 'Lodowa Tundra',
    biome: 'ice',
    desc: 'Prostokątna arena. Na tafli lodu wszyscy się ślizgają — trudniej hamować i uciekać.',
    shape: 'rect',
    hw: 18,
    hh: 12,
    obstacles: [
      { x: -7, y: -5, r: 0.9, kind: 'crystal' },
      { x: 7, y: -5, r: 0.9, kind: 'crystal' },
      { x: -7, y: 5, r: 0.9, kind: 'crystal' },
      { x: 7, y: 5, r: 0.9, kind: 'crystal' },
      { x: 0, y: -8.5, r: 1.1, kind: 'crystal' },
      { x: 0, y: 8.5, r: 1.1, kind: 'crystal' },
    ],
    hazards: [
      { kind: 'ice', shape: 'rect', x: -12.5, y: 0, w: 7, h: 16 },
      { kind: 'ice', shape: 'rect', x: 12.5, y: 0, w: 7, h: 16 },
      { kind: 'ice', shape: 'circle', x: 0, y: 0, r: 4.5 },
    ],
    events: [],
  },
  las: {
    id: 'las',
    name: 'Mroczny Las',
    biome: 'forest',
    desc: 'Drzewa blokują strzały, a w krzakach bohater jest ukryty przed bossem (do czasu ataku).',
    shape: 'circle',
    radius: 16,
    obstacles: [
      { x: -4, y: -9, r: 1.0, kind: 'tree' },
      { x: 5, y: -8.5, r: 1.1, kind: 'tree' },
      { x: 10, y: -1, r: 1.0, kind: 'tree' },
      { x: 7.5, y: 7.5, r: 1.1, kind: 'tree' },
      { x: -1.5, y: 10, r: 1.0, kind: 'tree' },
      { x: -9, y: 6, r: 1.1, kind: 'tree' },
      { x: -10, y: -3, r: 1.0, kind: 'tree' },
    ],
    hazards: [
      { kind: 'bush', shape: 'circle', x: -6.5, y: -3.5, r: 2.0 },
      { kind: 'bush', shape: 'circle', x: 6, y: -3, r: 1.8 },
      { kind: 'bush', shape: 'circle', x: 2.5, y: 6.5, r: 2.0 },
      { kind: 'bush', shape: 'circle', x: -4.5, y: 5.5, r: 1.6 },
      { kind: 'bush', shape: 'circle', x: 0.5, y: -12, r: 1.8 },
    ],
    events: [],
  },
  cmentarz: {
    id: 'cmentarz',
    name: 'Stary Cmentarz',
    biome: 'graveyard',
    desc: 'Nagrobki dają osłonę. Co kilka sekund z ziemi wyrastają ręce umarłych (telegraf 0,8 s).',
    shape: 'rect',
    hw: 16,
    hh: 13,
    obstacles: [
      { x: -9, y: -7, r: 0.6, kind: 'tomb' },
      { x: -5, y: -8, r: 0.6, kind: 'tomb' },
      { x: 5, y: -8, r: 0.6, kind: 'tomb' },
      { x: 9, y: -7, r: 0.6, kind: 'tomb' },
      { x: -11, y: 0, r: 0.6, kind: 'tomb' },
      { x: 11, y: 0, r: 0.6, kind: 'tomb' },
      { x: -9, y: 7, r: 0.6, kind: 'tomb' },
      { x: -4, y: 8, r: 0.6, kind: 'tomb' },
      { x: 4, y: 8, r: 0.6, kind: 'tomb' },
      { x: 9, y: 7, r: 0.6, kind: 'tomb' },
      { x: -5.5, y: 0, r: 1.2, kind: 'crypt' },
      { x: 5.5, y: 0, r: 1.2, kind: 'crypt' },
    ],
    hazards: [],
    events: [{ kind: 'graveHands', every: 5, count: 3, radius: 1.3, telegraph: 0.8 }],
  },
  pustynia: {
    id: 'pustynia',
    name: 'Ruiny na Pustyni',
    biome: 'desert',
    desc: 'Ruchome piaski spowalniają o 50% i wciągają do środka. Kaktusy i ruiny jako osłony.',
    shape: 'circle',
    radius: 17,
    obstacles: [
      { x: -8, y: -8, r: 1.3, kind: 'ruin' },
      { x: 8.5, y: 7.5, r: 1.3, kind: 'ruin' },
      { x: 9, y: -6, r: 0.6, kind: 'cactus' },
      { x: -9.5, y: 6, r: 0.6, kind: 'cactus' },
      { x: 2, y: 11.5, r: 0.6, kind: 'cactus' },
      { x: -2, y: -12, r: 0.6, kind: 'cactus' },
    ],
    hazards: [
      { kind: 'quicksand', shape: 'circle', x: -10, y: -1, r: 2.6 },
      { kind: 'quicksand', shape: 'circle', x: 10.5, y: 0.5, r: 2.4 },
      { kind: 'quicksand', shape: 'circle', x: 0, y: 7, r: 2.2 },
    ],
    events: [],
  },
};

export const MAP_IDS = /** @type {const} */ (['arena', 'wulkan', 'tundra', 'las', 'cmentarz', 'pustynia']);

/** Parametry mechanik terenu. */
export const HAZARD = {
  lava: { dmg: 1, every: 1.0 },
  ice: { accel: 2.4 },
  quicksand: { slow: 0.5, pull: 1.3 },
  bush: { revealAfterAttack: 1.0, bossSeeRange: 2.5 },
};

/** Losuje mapę deterministycznie z ziarna. @param {number} seed */
export function pickMapId(seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return MAP_IDS[h % MAP_IDS.length];
}

/** @param {string|undefined|null} id @returns {MapDef} */
export const getMap = (id) => MAPS[id ?? 'arena'] ?? MAPS.arena;

/** Półrozmiar areny (do kamery). @param {MapDef} m */
export const mapExtent = (m) => (m.shape === 'rect' ? { hw: m.hw ?? 16, hh: m.hh ?? 16 } : { hw: m.radius ?? 16, hh: m.radius ?? 16 });

/** Czy punkt (z promieniem pr) jest w hazardzie. @param {Hazard} z */
export function inHazard(z, x, y, pr = 0) {
  if (z.shape === 'circle') return Math.hypot(x - z.x, y - z.y) <= (z.r ?? 0) + pr * 0.3;
  return Math.abs(x - z.x) <= (z.w ?? 0) / 2 && Math.abs(y - z.y) <= (z.h ?? 0) / 2;
}
