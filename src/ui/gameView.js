import { createRenderer } from '../render/renderer.js';
import { createCamera, updateCamera, cameraTarget, VIEW_M, LOOK_AHEAD_M } from '../render/camera.js';
import { createFx, applyEvents, updateFx } from '../render/fx.js';
import { updateFeedback } from '../render/feedback.js';
import { slotColor } from '../render/palette.js';
import { play, vibrate, setMusicMode } from '../audio/sfx.js';

/**
 * @typedef {Object} FrameSource
 * @property {(dt:number, cam:any)=>{view:any, events:any[], meIds:string[], overlay?:string|null}|null} frame
 */

/**
 * Pętla rysowania (requestAnimationFrame). Logikę gry dostarcza `source`.
 * @param {HTMLCanvasElement} canvas @param {'local'|'online'} mode
 */
/** Podkład dla stanu gry: wygrana/porażka, skrzynka, boss, tryb z botami albo walka. */
function musicFor(v, me, meIds) {
  if (v.phase === 'ended') {
    const won = meIds.includes(v.winnerId) || v.endReason === 'victory';
    return won && v.endReason !== 'wipe' ? 'victory' : 'defeat';
  }
  if (v.phase === 'transition') return 'case';
  if (me?.boss) return 'boss';
  if (v.mode === 'survival') return 'survival';
  if (v.mode === 'bossrush') return 'bossrush';
  return 'hero';
}

const touchVisible = () => {
  const t = document.getElementById('touch');
  return !!t && !t.classList.contains('hidden');
};

export function createGameView(canvas, mode) {
  const renderer = createRenderer(canvas);
  const cam = createCamera();
  cam.mode = mode === 'local' ? 'fit' : 'follow';
  /** bieżący widok — dla `colorOf` bez tworzenia domknięcia co klatkę */
  let eventView = /** @type {any} */ (null);
  const colorOf = (id) => {
    const p = eventView?.players.find((x) => x.id === id);
    return p ? slotColor(p.slot) : '#fff';
  };
  const eventOut = { sound: play, vibrate, meIds: /** @type {string[]} */ ([]) };
  canvas.style.imageRendering = 'pixelated';
  const fx = createFx();
  /** @type {FrameSource|null} */
  let source = null;
  let raf = 0;
  let last = 0;
  let lastFrame = /** @type {any} */ (null);
  let time = 0;
  let music = '';
  /** rodzaj urządzenia jedynego lokalnego gracza ('kbm'|'kb2'|'pad'|'touch'); null = wspólny ekran / nieznane */
  let device = /** @type {string|null} */ (null);
  /** Przełącza podkład tylko przy zmianie trybu. @param {string} m */
  const setMusic = (m) => {
    if (m === music) return;
    music = m;
    setMusicMode(m);
  };

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    const [w, h] = renderer.resize();
    if (!source) {
      setMusic('menu');
      return;
    }
    const fr = source.frame(dt, cam);
    if (fr) {
      eventView = fr.view;
      eventOut.meIds = fr.meIds;
      if (fr.events.length) applyEvents(fx, fr.events, fr.view, fr.meIds[0] ?? null, colorOf, eventOut);
      updateFeedback(fx, fr.view, fr.meIds, eventOut);
      api.onFrame?.(fr.view, fr.meIds);
      if (fx.hitStop <= 0 || !lastFrame) lastFrame = fr;
    }
    updateFx(fx, dt);
    if (!lastFrame) return;
    const me = lastFrame.view.players.find((p) => p.id === lastFrame.meIds[0]);
    const v = lastFrame.view;
    updateCamera(cam, w, h, cameraTarget(v, me), dt, v.mapId);
    setMusic(musicFor(v, me, lastFrame.meIds));
    const touch = touchVisible();
    renderer.draw(v, { cam, fx, meIds: lastFrame.meIds, time, overlay: fr?.overlay ?? lastFrame.overlay, mode: cam.mode === 'fit' ? 'local' : 'online', device, hint: api.hint, sound: play, touch, aim: touch && me ? api.aimSource?.(me) : null });
  }

  const api = {
    /** @type {((me:any)=>any)|null} podgląd celowania (dotyk) */
    aimSource: null,
    cam,
    fx,
    /** podpowiedź dla nowego gracza rysowana nad cooldownami (ustawia onboarding) @type {string|null} */
    hint: null,
    /** wołane po każdej nowej klatce symulacji (onboarding) @type {((view:any, meIds:string[])=>void)|null} */
    onFrame: null,
    /**
     * Ustawia kamerę na mecz: `solo` = jeden człowiek (kamera za nim, szerszy widok), inaczej cała arena.
     * @param {{local:boolean, solo:boolean, device?:string|null}} o `device`: kind urządzenia gracza ('kbm'|'touch'|…)
     */
    setCamera(o) {
      device = o.device ?? null;
      cam.mode = o.solo ? 'follow' : 'fit';
      cam.viewM = o.local ? VIEW_M.solo : VIEW_M.online;
      cam.lookAhead = o.device === 'kbm' ? LOOK_AHEAD_M.mouse : LOOK_AHEAD_M.other;
      cam.touch = o.device === 'touch';
      cam.snap = true;
    },
    /** @param {FrameSource|null} s */
    setSource(s) {
      source = s;
      lastFrame = null;
      eventView = null;
      cam.snap = true;
      Object.assign(fx, createFx());
    },
    start() {
      if (!raf) raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    },
  };
  return api;
}
