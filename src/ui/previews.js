/**
 * Podglądy sprite'ów w UI (lobby, sloty lokalne, Bestiariusz, podium, przyciski dotykowe).
 * Każdy podgląd to mały <canvas>, do którego sprite jest kopiowany w całkowitej skali
 * bez wygładzania. Animowane podglądy obsługuje jedna wspólna pętla (~8 kl./s),
 * która sama usuwa canvasy odpięte od DOM i zatrzymuje się, gdy nic nie ma.
 */
import { getHeroSprite, getBossSprite, getIcon } from '../render/sprites.js';

/** @typedef {import('../render/sprites.js').Sprite} Sprite */

const FPS = 8;
/** @type {Set<{c:HTMLCanvasElement, get:(f:number)=>Sprite, seen:boolean, born:number, maxScale:number}>} */
const live = new Set();
let raf = 0;
let frame = 0;
let acc = 0;
let last = 0;

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
  const dx = Math.floor((c.width - dw) / 2);
  const dy = Math.floor(c.height - pad * 2 - dh);
  if (shadow) {
    // pikselowy cień pod stopami
    const sw = Math.max(4, Math.round(dw * 0.6));
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(Math.floor((c.width - sw) / 2), c.height - pad * 2 - s, sw, s * 2);
    g.fillRect(Math.floor((c.width - sw) / 2) + s, c.height - pad * 2 - s * 2, sw - s * 2, s * 4);
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
 * Animowany podgląd bohatera (idle). @param {string} skin @param {string} accent
 * @param {{w?:number,h?:number,anim?:'idle'|'walk'|'attack'|'hurt'|'dash', maxScale?:number}} [o]
 */
export function heroPreview(skin, accent, o = {}) {
  const anim = o.anim || 'idle';
  return animated((f) => getHeroSprite(skin, accent, anim, f), o.w ?? 64, o.h ?? 72, 'pv-hero', o.maxScale ?? 4);
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
