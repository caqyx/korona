/**
 * Podglądy sprite'ów w UI (lobby, sloty lokalne, Bestiariusz, podium, przyciski dotykowe).
 * Każdy podgląd to mały <canvas>, do którego sprite jest kopiowany w całkowitej skali
 * bez wygładzania. Animowane podglądy obsługuje jedna wspólna pętla (~8 kl./s),
 * która sama usuwa canvasy odpięte od DOM i zatrzymuje się, gdy nic nie ma.
 */
import * as sprites from '../render/sprites.js';

const { getHeroSprite, getBossSprite, getIcon } = sprites;

/** @typedef {import('../render/sprites.js').Sprite} Sprite */

const FPS = 8;
/** @type {Set<{c:HTMLCanvasElement, get:(f:number)=>Sprite, seen:boolean, born:number, maxScale:number}>} */
const live = new Set();
let raf = 0;
let frame = 0;
let acc = 0;
let last = 0;

/** Ogranicza v do przedziału między 0 a `room` (room może być ujemne). */
const clamp = (v, room) => Math.min(Math.max(0, room), Math.max(Math.min(0, room), v));

/** Rysuje sprite w canvasie: największa całkowita skala, wyśrodkowany, przy dolnej krawędzi. */
function paint(c, spr, maxScale = 6, shadow = true) {
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  if (!spr || !spr.img) return;
  const pad = shadow ? 2 : 0;
  const s = Math.max(1, Math.min(maxScale, Math.floor(Math.min(c.width / spr.w, (c.height - pad * 2) / spr.h))));
  const dw = spr.w * s;
  const dh = spr.h * s;
  // środek stóp (ox) na środku canvasu, ale sprite nie może wyjść poza krawędź
  const ox = Number.isFinite(spr.ox) ? spr.ox : spr.w / 2;
  const oy = Number.isFinite(spr.oy) ? spr.oy : spr.h - 1;
  const dx = Math.round(clamp(c.width / 2 - (ox + 0.5) * s, c.width - dw));
  const footY = c.height - pad * 2 - s;
  const dy = Math.round(clamp(footY - oy * s, c.height - dh));
  if (shadow) {
    // pikselowy cień pod stopami
    const fx = dx + Math.round((ox + 0.5) * s);
    const sw = Math.max(4, Math.round(spr.w > 32 ? dw * 0.5 : Math.min(dw, 12 * s) * 0.6));
    const sy = dy + oy * s + Math.round(s / 2);
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(fx - Math.round(sw / 2), sy, sw, s);
    g.fillRect(fx - Math.round(sw / 2) + s, sy - s, sw - 2 * s, s * 3);
  }
  g.drawImage(spr.img, 0, 0, spr.w, spr.h, dx, dy, dw, dh);
}

function loop(now) {
  raf = 0;
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
  last = now;
  acc += dt;
  const tick = acc >= 1 / FPS;
  if (tick) {
    acc %= 1 / FPS;
    frame++;
  }
  for (const it of live) {
    if (it.c.isConnected) it.seen = true;
    else if (it.seen || frame - it.born > FPS * 2) {
      live.delete(it);
      continue;
    }
    if (tick && it.c.isConnected) paint(it.c, safe(() => it.get(frame)), it.maxScale);
  }
  if (live.size) raf = requestAnimationFrame(loop);
  else last = 0;
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * @param {(f:number)=>Sprite} get @param {number} w @param {number} h @param {string} cls @param {number} maxScale
 */
function animated(get, w, h, cls, maxScale) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.className = `px-canvas ${cls}`;
  paint(c, safe(() => get(0)), maxScale);
  if (!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    live.add({ c, get, seen: false, born: frame, maxScale });
    if (!raf) raf = requestAnimationFrame(loop);
  }
  return c;
}

/**
 * Animowany podgląd bohatera (idle). `look` = wygląd {color, hat, nose} (kosmetyki).
 * @param {string} skin @param {string} accent
 * @param {{w?:number,h?:number,anim?:'idle'|'walk'|'attack'|'hurt'|'dash', maxScale?:number, look?:{color:string,hat:string,nose:string}|null}} [o]
 */
export function heroPreview(skin, accent, o = {}) {
  const anim = o.anim || 'idle';
  const look = o.look || undefined;
  const draw = /** @type {(...a:any[])=>Sprite} */ (getHeroSprite);
  return animated((f) => draw(skin, accent, anim, f, look), o.w ?? 64, o.h ?? 72, 'pv-hero', o.maxScale ?? 4);
}

/**
 * Ikona kosmetyku 12×12 (jeśli renderer ją udostępnia), inaczej null — UI pokazuje wtedy próbkę koloru / nazwę.
 * @param {'color'|'hat'|'nose'} kind @param {string} id @param {number} [scale]
 * @returns {HTMLCanvasElement|null}
 */
export function cosmeticIcon(kind, id, scale = 3) {
  const fn = /** @type {any} */ (sprites).getCosmeticIcon;
  if (typeof fn !== 'function') return null;
  const spr = safe(() => fn(kind, id));
  if (!spr || !spr.img) return null;
  const c = document.createElement('canvas');
  c.width = spr.w * scale;
  c.height = spr.h * scale;
  c.className = 'px-canvas pv-icon';
  paint(c, spr, scale, false);
  return c;
}

/** Animowany podgląd bossa (idle). @param {string} type @param {{w?:number,h?:number,maxScale?:number}} [o] */
export function bossPreview(type, o = {}) {
  return animated((f) => getBossSprite(type, 'idle', f), o.w ?? 128, o.h ?? 128, 'pv-boss', o.maxScale ?? 3);
}

/** Statyczna ikona 12×12 w skali. @param {string} name @param {number} [scale] */
export function iconCanvas(name, scale = 3) {
  const spr = safe(() => getIcon(name));
  const c = document.createElement('canvas');
  c.width = (spr?.w || 12) * scale;
  c.height = (spr?.h || 12) * scale;
  c.className = 'px-canvas pv-icon';
  paint(c, spr, scale, false);
  return c;
}

/** Zastępuje zawartość `el` pojedynczym elementem. @param {Element|null} el @param {Element} child */
export function mount(el, child) {
  if (el) el.replaceChildren(child);
}
