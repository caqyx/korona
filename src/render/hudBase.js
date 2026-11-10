/**
 * Prymitywy HUD-u w stylu pixel art: ramka ze „schodkowymi” narożnikami, tekst z cieniem,
 * ikony ze sprites.js powiększane bez wygładzania. Wspólne dla hud.js i hudOverlays.js.
 */
import { getIcon } from './sprites.js';

const FONT = '"Pixelify Sans", monospace';
export const PANEL = 'rgba(14,13,26,0.86)';
export const EDGE = '#3d3a63';
export const WHITE = '#ffffff';
/** Czerwień ostrzeżeń HUD (śmierć, końcówka czasu, „DOBIJ!”). */
export const RED = '#ff5470';
/** Tło wyróżnionych elementów (lider obrażeń, własny chip, wybrana karta). */
export const PANEL_HI = '#2b2348';
/** Największe przesunięcie cienia tekstu (px) — przy wielkich napisach cień nie może „odjeżdżać”. */
const SHADOW_MAX = 4;

/** Ramka z „pikselowymi” narożnikami. */
export function panel(ctx, x, y, w, h, fill = PANEL, edge = EDGE) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.fillStyle = edge;
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

export function text(ctx, str, x, y, size, color, align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = /** @type {CanvasTextAlign} */ (align);
  if (shadow) {
    const d = Math.min(SHADOW_MAX, Math.max(1, Math.round(size / 10)));
    ctx.fillStyle = '#000';
    ctx.fillText(str, x + d, y + d);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

/** Szerokość napisu w pikselach dla danego rozmiaru fontu HUD. */
export function textWidth(ctx, str, size) {
  ctx.font = `${size}px ${FONT}`;
  return ctx.measureText(str).width;
}

export function icon(ctx, name, x, y, scale) {
  const s = getIcon(name);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, Math.round(x), Math.round(y), s.w * scale, s.h * scale);
}

/** Tekst łamany na słowach do szerokości `maxW`. */
export function wrap(ctx, str, x, y, maxW, size, color) {
  ctx.font = `${size}px ${FONT}`;
  let line = '';
  let yy = y;
  for (const w of str.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      text(ctx, line, x, yy, size, color);
      line = w;
      yy += size * 1.25;
    } else line = t;
  }
  if (line) text(ctx, line, x, yy, size, color);
}

/** Liczba po polsku z jednym miejscem po przecinku: 2.1 → „2,1”. @param {number} n */
export const dec1 = (n) => n.toFixed(1).replace('.', ',');
