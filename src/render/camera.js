import { MATCH } from '../sim/config.js';
import { PPM } from './sprites.js';

/**
 * Kamera pixel art. Świat rysowany jest w buforze o niskiej rozdzielczości (PPM pikseli sztuki
 * na metr), a bufor powiększany na ekran współczynnikiem S bez wygładzania.
 *  - mode 'fit': cała arena (tryb lokalny),
 *  - mode 'follow': kamera za graczem z lekkim wyprzedzeniem w stronę celowania (online).
 */
export function createCamera() {
  return {
    x: 0,
    y: 0,
    /** piksele ekranu na piksel sztuki */
    S: 2,
    /** piksele ekranu na metr (S * PPM) — dla HUD i myszy */
    scale: 2 * PPM,
    w: 1,
    h: 1,
    aw: 1,
    ah: 1,
    mode: /** @type {'fit'|'follow'} */ ('fit'),
    shakeX: 0,
    shakeY: 0,
  };
}

/** Zaokrągla skalę: powyżej 2,5 do całkowitych (równe piksele), niżej do 0,25. @param {number} s */
function snapScale(s) {
  if (s >= 2.5) return Math.floor(s);
  return Math.max(1, Math.floor(s * 4) / 4);
}

/**
 * @param {ReturnType<typeof createCamera>} cam @param {number} w @param {number} h
 * @param {{x:number,y:number,fx?:number,fy?:number}|null} target @param {number} dt
 */
export function updateCamera(cam, w, h, target, dt) {
  cam.w = w;
  cam.h = h;
  const fitS = Math.min(w, h) / ((MATCH.arenaRadius * 2 + 2) * PPM);
  let S;
  if (cam.mode === 'fit' || !target) {
    S = snapScale(fitS);
    cam.x = 0;
    cam.y = 0;
  } else {
    S = snapScale(Math.max(fitS, Math.min(w, h * 1.6) / (22 * PPM)));
    const tx = target.x + (target.fx || 0) * 1.6;
    const ty = target.y + (target.fy || 0) * 1.6;
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }
  cam.S = S;
  cam.scale = S * PPM;
  cam.aw = Math.ceil(w / S);
  cam.ah = Math.ceil(h / S);
}

/** Świat -> piksele sztuki (całkowite, przyciągnięte do siatki). @param {ReturnType<typeof createCamera>} cam */
export function worldToArt(cam, x, y) {
  return [Math.round((x - cam.x) * PPM + cam.aw / 2 + cam.shakeX), Math.round((y - cam.y) * PPM + cam.ah / 2 + cam.shakeY)];
}

/** Świat -> piksele ekranu (dla napisów HUD). @param {ReturnType<typeof createCamera>} cam */
export function worldToScreen(cam, x, y) {
  const [ax, ay] = worldToArt(cam, x, y);
  return [ax * cam.S, ay * cam.S];
}

/** Ekran -> świat (celowanie myszą). @param {ReturnType<typeof createCamera>} cam */
export function screenToWorld(cam, sx, sy) {
  return [(sx / cam.S - cam.aw / 2 - cam.shakeX) / PPM + cam.x, (sy / cam.S - cam.ah / 2 - cam.shakeY) / PPM + cam.y];
}
