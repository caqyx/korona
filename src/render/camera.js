import { MATCH } from '../sim/config.js';

/**
 * Kamera: mapuje metry na piksele. mode 'fit' pokazuje całą arenę (tryb lokalny),
 * 'follow' trzyma własną postać w centrum z widokiem ~22 m szerokości (online).
 */
export function createCamera() {
  return { x: 0, y: 0, scale: 30, w: 1, h: 1, mode: /** @type {'fit'|'follow'} */ ('fit'), shakeX: 0, shakeY: 0 };
}

/** @param {ReturnType<typeof createCamera>} cam @param {number} w @param {number} h @param {{x:number,y:number}|null} target */
export function updateCamera(cam, w, h, target, dt) {
  cam.w = w;
  cam.h = h;
  const fitScale = Math.min(w, h) / (MATCH.arenaRadius * 2 + 2);
  if (cam.mode === 'fit' || !target) {
    cam.scale = fitScale;
    cam.x = 0;
    cam.y = 0;
    return;
  }
  cam.scale = Math.max(fitScale, Math.min(w, h * 1.6) / 22);
  const k = 1 - Math.exp(-8 * dt);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
}

/** @param {ReturnType<typeof createCamera>} cam */
export function worldToScreen(cam, x, y) {
  return [(x - cam.x) * cam.scale + cam.w / 2 + cam.shakeX, (y - cam.y) * cam.scale + cam.h / 2 + cam.shakeY];
}

/** @param {ReturnType<typeof createCamera>} cam */
export function screenToWorld(cam, sx, sy) {
  return [(sx - cam.w / 2 - cam.shakeX) / cam.scale + cam.x, (sy - cam.h / 2 - cam.shakeY) / cam.scale + cam.y];
}
