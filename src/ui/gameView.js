import { createRenderer } from '../render/renderer.js';
import { createCamera, updateCamera } from '../render/camera.js';
import { createFx, applyEvents, updateFx } from '../render/fx.js';
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
  canvas.style.imageRendering = 'pixelated';
  const fx = createFx();
  /** @type {FrameSource|null} */
  let source = null;
  let raf = 0;
  let last = 0;
  let lastFrame = /** @type {any} */ (null);
  let time = 0;
  let music = '';
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
      const colorOf = (id) => {
        const p = fr.view.players.find((x) => x.id === id);
        return p ? slotColor(p.slot) : '#fff';
      };
      if (fr.events.length) applyEvents(fx, fr.events, fr.view, fr.meIds[0] ?? null, colorOf, { sound: play, vibrate });
      if (fx.hitStop <= 0 || !lastFrame) lastFrame = fr;
    }
    updateFx(fx, dt);
    if (!lastFrame) return;
    const me = lastFrame.view.players.find((p) => p.id === lastFrame.meIds[0]);
    updateCamera(cam, w, h, me && me.alive ? me : null, dt, lastFrame.view.mapId);
    const v = lastFrame.view;
    setMusic(musicFor(v, me, lastFrame.meIds));
    renderer.draw(v, { cam, fx, meIds: lastFrame.meIds, time, overlay: fr?.overlay ?? lastFrame.overlay, mode: cam.mode === 'fit' ? 'local' : 'online', sound: play, touch: touchVisible(), aim: touchVisible() && me ? api.aimSource?.(me) : null });
  }

  const api = {
    /** @type {((me:any)=>any)|null} podgląd celowania (dotyk) */
    aimSource: null,
    cam,
    fx,
    /** @param {FrameSource|null} s */
    setSource(s) {
      source = s;
      lastFrame = null;
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
