/**
 * Znaczniki „to ty” rysowane w buforze pixel art: pierścień pod stopami własnej postaci,
 * strzałka nad głową, puls po starcie/odrodzeniu oraz linia prowadząca do korony przy odliczaniu.
 */
import { worldToArt } from './camera.js';
import { dither } from './pixel.js';
import { slotColor, CROWN } from './palette.js';
import { MARK_PULSE } from './fx.js';

/** Półosie pierścienia pod stopami (piksele sztuki) — elipsa, bo arena jest widziana z góry pod kątem. */
const RING_RX = 9;
const RING_RY = 5;
/** Granice pasów pierścienia w znormalizowanym promieniu: biały środek, kolor gracza na zewnątrz. */
const RING_WHITE_FROM = 0.52;
const RING_COLOR_FROM = 0.76;
/** O ile pikseli sztuki rośnie puls znacznika. */
const PULSE_GROW = 22;
/** Wysokość strzałki nad punktem stóp (nad nickiem i sercami). */
const ARROW_LIFT = 35;

/** @type {Map<string, HTMLCanvasElement>} */
const ringCache = new Map();

/** Sprite pierścienia w kolorze gracza (budowany raz na kolor). @param {string} color */
function ringSprite(color) {
  let c = ringCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = RING_RX * 2 + 1;
  c.height = RING_RY * 2 + 1;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  for (let y = -RING_RY; y <= RING_RY; y++) {
    for (let x = -RING_RX; x <= RING_RX; x++) {
      const v = Math.hypot(x / (RING_RX + 0.5), y / (RING_RY + 0.5));
      if (v > 1 || v <= RING_WHITE_FROM) continue;
      g.fillStyle = v > RING_COLOR_FROM ? color : '#ffffff';
      g.fillRect(x + RING_RX, y + RING_RY, 1, 1);
    }
  }
  ringCache.set(color, c);
  return c;
}

/** Obrys elipsy punktami (puls). */
function strokeEllipse(g, cx, cy, rx, ry) {
  const n = Math.max(16, Math.round(rx * 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}

/**
 * Pierścień pod stopami własnej postaci (rysowany PRZED sprite'em) i rozchodzący się puls.
 * @param {CanvasRenderingContext2D} g @param {number} x @param {number} y punkt stóp (px sztuki)
 * @param {string} color @param {number} pulse pozostały czas pulsu (s), 0 = brak
 */
export function drawOwnRing(g, x, y, color, pulse) {
  g.drawImage(ringSprite(color), x - RING_RX, y + 3 - RING_RY);
  if (!(pulse > 0)) return;
  // dwa kręgi w odstępie pół cyklu, każdy rośnie i blednie
  for (let i = 0; i < 2; i++) {
    const k = ((1 - pulse / MARK_PULSE) * 2 + i * 0.5) % 1;
    g.fillStyle = dither(g, i ? '#ffffff' : color, 1 - k);
    strokeEllipse(g, x, y + 3, RING_RX + k * PULSE_GROW, RING_RY + k * PULSE_GROW * 0.55);
  }
}

/** Podskakująca strzałka nad głową własnej postaci (rysowana PO sprite'cie). */
export function drawOwnArrow(g, x, y, color, time) {
  const top = y - ARROW_LIFT + Math.round(Math.sin(time * 5) * 1.5);
  g.fillStyle = '#000000';
  g.fillRect(x - 4, top - 1, 9, 3);
  g.fillRect(x - 3, top + 2, 7, 1);
  g.fillRect(x - 2, top + 3, 5, 1);
  g.fillRect(x - 1, top + 4, 3, 1);
  g.fillStyle = '#ffffff';
  g.fillRect(x - 3, top, 7, 1);
  g.fillStyle = color;
  g.fillRect(x - 3, top + 1, 7, 1);
  g.fillRect(x - 2, top + 2, 5, 1);
  g.fillRect(x - 1, top + 3, 3, 1);
}

/** Odstęp kropek linii prowadzącej (px sztuki) i margines od postaci / korony. */
const GUIDE_STEP = 6;
const GUIDE_MARGIN = 14;

/**
 * Odliczanie w trybie korony: pulsująca linia z kropek od lokalnych postaci do korony na środku
 * („tam biegnij”), z grotem przy koronie.
 */
export function drawCrownGuide(g, cam, view, meIds, time) {
  if (view.phase !== 'countdown' || (view.mode && view.mode !== 'crown') || view.crown.state !== 'center') return;
  const [cx, cy] = worldToArt(cam, view.crown.x, view.crown.y);
  for (const p of view.players) {
    if (!meIds.includes(p.id) || !p.alive) continue;
    const [x, y] = worldToArt(cam, p.x, p.y);
    const len = Math.hypot(cx - x, cy - y);
    if (len < GUIDE_MARGIN * 2 + GUIDE_STEP) continue;
    const dx = (cx - x) / len;
    const dy = (cy - y) / len;
    const phase = (time * 14) % GUIDE_STEP;
    for (let d = GUIDE_MARGIN + phase; d < len - GUIDE_MARGIN; d += GUIDE_STEP) {
      const far = d / len;
      g.fillStyle = far > 0.5 ? CROWN : slotColor(p.slot);
      g.fillRect(Math.round(x + dx * d), Math.round(y + dy * d), 2, 2);
    }
    const tx = cx - dx * GUIDE_MARGIN;
    const ty = cy - dy * GUIDE_MARGIN;
    g.fillStyle = CROWN;
    for (let i = 0; i < 4; i++) {
      // grot: dwa ramiona odchylone od kierunku
      g.fillRect(Math.round(tx - dx * i - dy * i), Math.round(ty - dy * i + dx * i), 2, 2);
      g.fillRect(Math.round(tx - dx * i + dy * i), Math.round(ty - dy * i - dx * i), 2, 2);
    }
  }
}
