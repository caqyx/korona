/**
 * Grafika map (biomów): tło statyczne, przeszkody, krzaki, animowane detale i miniatury do menu.
 *
 *  - getArenaCanvas(map) → {img, cx, cy}: całe tło w skali PPM; (cx, cy) = piksel świata (0,0).
 *    Zawiera podłogę, mur granicy, ≥2 m marginesu, podłoże hazardów i cienie przeszkód
 *    (renderer NIE musi już rysować cienia pod przeszkodami).
 *  - drawHazardsAnimated(g, map, toArt, time): animacje na buforze sztuki (po tle, przed postaciami).
 *  - getObstacleSprite(kind, r) → Sprite, kotwica = środek dołu podstawy; rysować w świecie (x, y + r·0.6).
 *  - getBushSprite(r, frame) → Sprite, kotwica w środku; rysować w (x, y) NAD postaciami.
 *  - getMapPreview(map, w, h) → kanwa miniatury (najbliższy sąsiad).
 */
import { PPM, getPillarSprite, bufferToSprite } from '../sprites.js';
import { buildMapRaster } from './ground.js';
import { buildObstacle, buildBush, BUSH_FRAMES } from './props.js';
import { mod } from '../sprites/pixels.js';

export { drawHazardsAnimated } from './anim.js';
export { OBSTACLE_KINDS } from './props.js';

/** @typedef {import('../sprites.js').Sprite} Sprite */

/** @type {Map<string, {img: HTMLCanvasElement, cx: number, cy: number}>} */
const arenaCache = new Map();
/** @type {Map<string, Sprite>} */
const spriteCache = new Map();
/** @type {Map<string, HTMLCanvasElement>} */
const previewCache = new Map();

/**
 * @param {import('../../sim/maps.js').MapDef} map
 * @returns {{img: HTMLCanvasElement, cx: number, cy: number}}
 */
export function getArenaCanvas(map) {
  const key = map?.id ?? 'arena';
  let a = arenaCache.get(key);
  if (a) return a;
  const { raster, cx, cy } = buildMapRaster(map);
  const c = document.createElement('canvas');
  c.width = raster.w;
  c.height = raster.h;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.putImageData(new ImageData(raster.rgba(), raster.w, raster.h), 0, 0);
  a = { img: c, cx, cy };
  arenaCache.set(key, a);
  return a;
}

/**
 * Sprite przeszkody. Szerokość ≈ 2·r·PPM (+ obrys; drzewo ma szerszą koronę i jest wysokie).
 * @param {string} kind pillar|rock|crystal|tree|tomb|crypt|ruin|cactus
 * @param {number} radius metry
 * @returns {Sprite}
 */
export function getObstacleSprite(kind, radius) {
  if (kind === 'pillar') return getPillarSprite(radius);
  const key = `${kind}:${radius}`;
  let s = spriteCache.get(key);
  if (!s) {
    const { buf, ox, oy } = buildObstacle(kind, radius, PPM);
    s = bufferToSprite(buf, ox, oy);
    spriteCache.set(key, s);
  }
  return s;
}

/**
 * Czubek krzaka (rysowany nad postaciami), 2 klatki kołysania.
 * @param {number} radius metry @param {number} frame
 * @returns {Sprite}
 */
export function getBushSprite(radius, frame) {
  const f = mod(frame, BUSH_FRAMES);
  const key = `bush:${radius}:${f}`;
  let s = spriteCache.get(key);
  if (!s) {
    const { buf, ox, oy } = buildBush(radius, f, PPM);
    s = bufferToSprite(buf, ox, oy);
    spriteCache.set(key, s);
  }
  return s;
}

/**
 * Pełny obraz mapy (tło + przeszkody + krzaki, posortowane po Y) w skali PPM.
 * @param {import('../../sim/maps.js').MapDef} map
 */
export function composeMap(map) {
  const a = getArenaCanvas(map);
  const c = document.createElement('canvas');
  c.width = a.img.width;
  c.height = a.img.height;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.imageSmoothingEnabled = false;
  g.drawImage(a.img, 0, 0);
  const items = [];
  for (const o of map.obstacles) items.push({ y: o.y + o.r * 0.6, s: getObstacleSprite(o.kind, o.r), x: o.x, yy: o.y + o.r * 0.6 });
  for (const z of map.hazards) if (z.kind === 'bush') items.push({ y: z.y + 99, s: getBushSprite(z.r ?? 1, 0), x: z.x, yy: z.y });
  items.sort((p, q) => p.y - q.y);
  for (const it of items) g.drawImage(it.s.img, Math.round(a.cx + it.x * PPM) - it.s.ox, Math.round(a.cy + it.yy * PPM) - it.s.oy);
  return { img: c, cx: a.cx, cy: a.cy };
}

/**
 * Miniatura mapy do kart w menu (najbliższy sąsiad, proporcje zachowane, tło #07070d).
 * @param {import('../../sim/maps.js').MapDef} map @param {number} [w] @param {number} [h]
 * @returns {HTMLCanvasElement}
 */
export function getMapPreview(map, w = 160, h = 100) {
  const key = `${map?.id}:${w}x${h}`;
  let c = previewCache.get(key);
  if (c) return c;
  const full = composeMap(map);
  // przytnij do granicy + 1,5 m (bez wygaszanego marginesu)
  const ext = map.shape === 'rect' ? { hw: map.hw ?? 16, hh: map.hh ?? 16 } : { hw: map.radius ?? 16, hh: map.radius ?? 16 };
  const sw = Math.min(full.img.width, Math.round((ext.hw + 1.5) * 2 * PPM));
  const sh = Math.min(full.img.height, Math.round((ext.hh + 1.5) * 2 * PPM));
  const sx = Math.round(full.cx - sw / 2);
  const sy = Math.round(full.cy - sh / 2);
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = '#07070d';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  const k = Math.min(w / sw, h / sh);
  const dw = Math.round(sw * k);
  const dh = Math.round(sh * k);
  g.drawImage(full.img, sx, sy, sw, sh, Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
  previewCache.set(key, c);
  return c;
}
