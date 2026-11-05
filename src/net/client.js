/**
 * Pętla klienta: input 30 Hz do hosta, render z bufora interpolacji opóźnionego o 100 ms.
 */
import { createInterpBuffer } from './interp.js';

export const INPUT_HZ = 30;

/**
 * @param {{selfId:string, readInput:(view:any, me:any)=>any, sendInput:(input:any)=>void, now?:()=>number}} o
 */
export function createClientLoop(o) {
  const now = o.now || (() => performance.now());
  const buffer = createInterpBuffer(100);
  let seq = 0;
  let lastView = /** @type {any} */ (null);
  let timer = /** @type {any} */ (0);
  /** @type {any[]} */
  let events = [];
  let lastSnapshotAt = now();

  function sendTick() {
    const view = lastView || buffer.latest();
    if (!view) return;
    const me = view.players.find((p) => p.id === o.selfId);
    const inp = o.readInput(view, me);
    seq = (seq + 1) % 2 ** 31;
    o.sendInput({ seq, moveX: clamp1(inp.moveX), moveY: clamp1(inp.moveY), aimX: clampA(inp.aimX), aimY: clampA(inp.aimY), buttons: inp.buttons & 63 });
  }

  return {
    start() {
      if (!timer) timer = setInterval(sendTick, 1000 / INPUT_HZ);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    /** @param {any} state */
    pushSnapshot(state) {
      lastSnapshotAt = now();
      buffer.push(state, lastSnapshotAt);
    },
    /** @param {any[]} evs */
    pushEvents(evs) {
      events.push(...evs);
      if (events.length > 400) events = events.slice(-400);
    },
    get lastSnapshotAt() {
      return lastSnapshotAt;
    },
    touch() {
      lastSnapshotAt = now();
    },
    latest() {
      return buffer.latest();
    },
    reset() {
      buffer.clear();
      lastView = null;
    },
    view() {
      const v = buffer.sample(now());
      if (v) lastView = v;
      return lastView;
    },
    drainEvents() {
      const e = events;
      events = [];
      return e;
    },
  };
}

const clamp1 = (v) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
const clampA = (v) => Math.max(-99, Math.min(99, Number.isFinite(v) ? v : 0));
