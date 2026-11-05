import { createRenderer } from '../render/renderer.js';
import { createCamera, updateCamera } from '../render/camera.js';
import { createFx, applyEvents, updateFx } from '../render/fx.js';
import { slotColor } from '../render/palette.js';
import { play } from '../audio/sfx.js';

/**
 * @typedef {Object} FrameSource
 * @property {(dt:number, cam:any)=>{view:any, events:any[], meIds:string[], overlay?:string|null}|null} frame
 */

/**
 * Pętla rysowania (requestAnimationFrame). Logikę gry dostarcza `source`.
 * @param {HTMLCanvasElement} canvas @param {'local'|'online'} mode
 */
export function createGameView(canvas, mode) {
  const renderer = createRenderer(canvas);
  const cam = createCamera();
  cam.mode = mode === 'local' ? 'fit' : 'follow';
  const fx = createFx();
  /** @type {FrameSource|null} */
  let source = null;
  let raf = 0;
  let last = 0;
  let lastFrame = /** @type {any} */ (null);
  let time = 0;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    const [w, h] = renderer.resize();
    if (!source) return;
    const fr = source.frame(dt, cam);
    if (fr) {
      const colorOf = (id) => {
        const p = fr.view.players.find((x) => x.id === id);
        return p ? slotColor(p.slot) : '#fff';
      };
      if (fr.events.length) applyEvents(fx, fr.events, fr.view, fr.meIds[0] ?? null, colorOf, play);
      if (fx.hitStop <= 0 || !lastFrame) lastFrame = fr;
    }
    updateFx(fx, dt);
    if (!lastFrame) return;
    const me = lastFrame.view.players.find((p) => p.id === lastFrame.meIds[0]);
    updateCamera(cam, w, h, me && me.alive ? me : null, dt);
    renderer.draw(lastFrame.view, { cam, fx, meIds: lastFrame.meIds, time, overlay: fr?.overlay ?? lastFrame.overlay, mode });
  }

  return {
    cam,
    fx,
    /** @param {FrameSource|null} s */
    setSource(s) {
      source = s;
      lastFrame = null;
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
}
