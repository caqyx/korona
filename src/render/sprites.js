/**
 * Sprite'y pixel art generowane w kodzie (bez plików graficznych).
 *
 * Konwencje (wiążące dla całego renderera):
 *  - Świat rysowany jest w buforze o niskiej rozdzielczości: PPM pikseli sztuki na metr.
 *  - Sprite'y patrzą w PRAWO; renderer odbija je poziomo, gdy postać patrzy w lewo.
 *  - Punkt zaczepienia (ox, oy) = środek stóp / podstawy postaci, w pikselach sprite'a.
 *  - Rysowanie wyłącznie fillRect na całkowitych współrzędnych (zero antyaliasingu).
 *  - Wszystko cachowane po kluczu; wywołania są tanie.
 *
 * Grafika powstaje w czystych modułach src/render/sprites/*.js (bufor pikseli bez DOM),
 * a tutaj jest tylko zamieniana na kanwę i cachowana.
 *
 * Rozmiary i liczby klatek (frame zawsze brane modulo):
 *  - bohater 24×20, kotwica (10,17); idle 4, walk 4, attack 3 (zamach/cios/wybrzmienie), dash 2, hurt 2 (biały/czerwony)
 *  - boss 56×52, kotwica (28,48); idle 4, walk 4, cast 2, hurt 1 (biała sylwetka); bez korony i cienia
 *  - szkielet 12×14 (kotwica 5,12), pajączek 12×9 (6,7), wieżyczka 15×11 (6,10) — 2 klatki
 *  - korona 12×9 (6,8) — 4 klatki; filar (2·r·PPM+4) × (0.95·2·r·PPM+5), kotwica środek dołu
 *  - ikony 12×12 (kotwica 6,6); pociski 5–13 px, kotwica środek dołu (ox=w/2, oy=h-1), scythe 4 klatki obrotu
 *
 * @typedef {{img: HTMLCanvasElement, ox: number, oy: number, w: number, h: number}} Sprite
 */
import { buildHero, HERO_OX, HERO_OY, HERO_FRAMES } from './sprites/heroes.js';
import { buildBoss, BOSS_OX, BOSS_OY, BOSS_FRAMES } from './sprites/bosses.js';
import { buildMinion, buildTurret, buildCrown, buildPillar, buildProjectile } from './sprites/misc.js';
import { buildIcon } from './sprites/icons.js';
import { mod } from './sprites/pixels.js';

/** Piksele sztuki na metr świata. */
export const PPM = 12;

/** @type {Map<string, Sprite|null>} */
const cache = new Map();

/** @param {import('./sprites/pixels.js').PixelBuffer} buf @param {number} ox @param {number} oy @returns {Sprite} */
function toSprite(buf, ox, oy) {
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  for (const [x, y, w, col] of buf.runs()) {
    g.fillStyle = col;
    g.fillRect(x, y, w, 1);
  }
  return { img: c, ox, oy, w: buf.w, h: buf.h };
}

/**
 * @template T
 * @param {string} key @param {() => T} make
 * @returns {T}
 */
function cached(key, make) {
  let s = cache.get(key);
  if (s === undefined) {
    s = /** @type {any} */ (make());
    cache.set(key, /** @type {any} */ (s));
  }
  return /** @type {T} */ (s);
}

/**
 * @param {string} skin  rycerz|lucznik|lotrzyk|kaplan|inzynier
 * @param {string} accent kolor gracza (slot) — akcent (np. szal/peleryna/pas)
 * @param {'idle'|'walk'|'attack'|'hurt'|'dash'} anim
 * @param {number} frame licznik klatek (dowolna liczba całkowita; sprite bierze modulo)
 * @returns {Sprite}
 */
export function getHeroSprite(skin, accent, anim, frame) {
  const a = anim in HERO_FRAMES ? anim : 'idle';
  const f = mod(frame, HERO_FRAMES[a]);
  return cached(`h:${skin}:${accent}:${a}:${f}`, () => toSprite(buildHero(skin, accent, a, f), HERO_OX, HERO_OY));
}

/**
 * @param {string} type kolos|cien|nekromanta|burza|smok|szron|pajeczyca|widmo
 * @param {'idle'|'walk'|'cast'|'hurt'} anim  'hurt' = biały błysk
 * @param {number} frame
 * @returns {Sprite}
 */
export function getBossSprite(type, anim, frame) {
  const a = anim in BOSS_FRAMES ? anim : 'idle';
  const f = mod(frame, BOSS_FRAMES[a]);
  return cached(`b:${type}:${a}:${f}`, () => toSprite(buildBoss(type, a, f), BOSS_OX, BOSS_OY));
}

/** @param {'skeleton'|'spiderling'} kind @param {number} frame @returns {Sprite} */
export function getMinionSprite(kind, frame) {
  const f = mod(frame, 2);
  return cached(`m:${kind}:${f}`, () => {
    const { buf, ox, oy } = buildMinion(kind, f);
    return toSprite(buf, ox, oy);
  });
}

/** @param {string} accent @param {number} frame @returns {Sprite} */
export function getTurretSprite(accent, frame) {
  const f = mod(frame, 2);
  return cached(`t:${accent}:${f}`, () => {
    const { buf, ox, oy } = buildTurret(accent, f);
    return toSprite(buf, ox, oy);
  });
}

/** Korona (nad bossem i na środku areny). @param {number} frame @returns {Sprite} */
export function getCrownSprite(frame) {
  const f = mod(frame, 4);
  return cached(`c:${f}`, () => {
    const { buf, ox, oy } = buildCrown(f);
    return toSprite(buf, ox, oy);
  });
}

/** Filar (kolumna) dla promienia w metrach. @param {number} radius @returns {Sprite} */
export function getPillarSprite(radius) {
  return cached(`p:${radius}`, () => {
    const { buf, ox, oy } = buildPillar(radius, PPM);
    return toSprite(buf, ox, oy);
  });
}

/**
 * Ikony 12×12 do HUD / przycisków dotykowych.
 * name: 'atk' | 'dash' | `skin:${skin}` (umiejętność skina) | `boss:${type}:${'atk'|'q'|'e'|'r'}` | 'crown' | 'skull' | 'heart'
 * @param {string} name @returns {Sprite}
 */
export function getIcon(name) {
  return cached(`i:${name}`, () => toSprite(buildIcon(name), 6, 6));
}

/** Pocisk (opcjonalnie); kind z symulacji: bolt|pierce|turret|reflected|fireball|iceShard|web|scythe|blade|necroBolt|spark. @returns {Sprite|null} */
export function getProjectileSprite(kind, accent, frame) {
  const f = mod(frame, 4);
  return cached(`pr:${kind}:${accent}:${f}`, () => {
    const r = buildProjectile(kind, accent, f);
    return r ? toSprite(r.buf, r.ox, r.oy) : null;
  });
}
