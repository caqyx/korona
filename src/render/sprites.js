/**
 * Sprite'y pixel art generowane w kodzie (bez plików graficznych). ZAŚLEPKA — implementacja docelowa w toku.
 *
 * Konwencje (wiążące dla całego renderera):
 *  - Świat rysowany jest w buforze o niskiej rozdzielczości: PPM pikseli sztuki na metr.
 *  - Sprite'y patrzą w PRAWO; renderer odbija je poziomo, gdy postać patrzy w lewo.
 *  - Punkt zaczepienia (ox, oy) = środek stóp / podstawy postaci, w pikselach sprite'a.
 *  - Rysowanie wyłącznie fillRect na całkowitych współrzędnych (zero antyaliasingu).
 *  - Wszystko cachowane po kluczu; wywołania są tanie.
 *
 * @typedef {{img: HTMLCanvasElement, ox: number, oy: number, w: number, h: number}} Sprite
 */

/** Piksele sztuki na metr świata. */
export const PPM = 12;

const cache = new Map();
function placeholder(key, w, h, color) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = color;
  g.fillRect(1, 1, w - 2, h - 2);
  const s = { img: c, ox: Math.floor(w / 2), oy: h - 1, w, h };
  cache.set(key, s);
  return s;
}

/**
 * @param {string} skin  rycerz|lucznik|lotrzyk|kaplan|inzynier
 * @param {string} accent kolor gracza (slot) — akcent (np. szal/peleryna/pas)
 * @param {'idle'|'walk'|'attack'|'hurt'|'dash'} anim
 * @param {number} frame licznik klatek (dowolna liczba całkowita; sprite bierze modulo)
 * @returns {Sprite}
 */
export function getHeroSprite(skin, accent, anim, frame) {
  return placeholder(`h:${skin}:${accent}:${anim}:${frame % 4}`, 14, 16, accent);
}

/**
 * @param {string} type kolos|cien|nekromanta|burza|smok|szron|pajeczyca|widmo
 * @param {'idle'|'walk'|'cast'|'hurt'} anim  'hurt' = biały błysk
 * @param {number} frame
 * @returns {Sprite}
 */
export function getBossSprite(type, anim, frame) {
  return placeholder(`b:${type}:${anim}:${frame % 4}`, 40, 40, '#f44');
}

/** @param {'skeleton'|'spiderling'} kind @param {number} frame @returns {Sprite} */
export function getMinionSprite(kind, frame) {
  return placeholder(`m:${kind}:${frame % 2}`, 10, 10, '#eee');
}

/** @param {string} accent @param {number} frame @returns {Sprite} */
export function getTurretSprite(accent, frame) {
  return placeholder(`t:${accent}:${frame % 2}`, 10, 10, accent);
}

/** Korona (nad bossem i na środku areny). @param {number} frame @returns {Sprite} */
export function getCrownSprite(frame) {
  return placeholder(`c:${frame % 4}`, 12, 9, '#ffd23f');
}

/** Filar (kolumna) dla promienia w metrach. @param {number} radius @returns {Sprite} */
export function getPillarSprite(radius) {
  return placeholder(`p:${radius}`, Math.round(radius * 2 * PPM), Math.round(radius * 2 * PPM) + 8, '#556');
}

/**
 * Ikony 12×12 do HUD / przycisków dotykowych.
 * name: 'atk' | 'dash' | `skin:${skin}` (umiejętność skina) | `boss:${type}:${'atk'|'q'|'e'|'r'}` | 'crown' | 'skull' | 'heart'
 * @param {string} name @returns {Sprite}
 */
export function getIcon(name) {
  return placeholder(`i:${name}`, 12, 12, '#aaa');
}

/** Pocisk (opcjonalnie); kind z symulacji: bolt|pierce|turret|reflected|fireball|iceShard|web|scythe|blade|necroBolt|spark. @returns {Sprite|null} */
export function getProjectileSprite(kind, accent, frame) {
  void kind;
  void frame;
  return placeholder(`pr:${kind}:${accent}`, 4, 4, accent);
}
