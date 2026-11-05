/**
 * Pętla hosta: inputy -> step() 60 Hz -> snapshot 20 Hz (kanał 'state'),
 * zdarzenia od razu (kanał 'events').
 */
import { step } from '../sim/step.js';
import { DT, SNAPSHOT_EVERY } from '../sim/config.js';
import { emptyInput } from '../sim/state.js';

/**
 * @param {{state:any, selfId:string, speed?:number, readLocalInput:(state:any)=>any,
 *   sendSnapshot:(state:any)=>void, sendEvents:(events:any[], tick:number)=>void,
 *   onStepTime?:(ms:number, now:number)=>void, onEnd?:(state:any)=>void, now?:()=>number}} o
 */
export function createHostLoop(o) {
  const now = o.now || (() => performance.now());
  const state = o.state;
  /** @type {Record<string, any>} */
  const inputs = {};
  const speed = o.speed || 1;
  let paused = true;
  let acc = 0;
  let last = now();
  let timer = /** @type {any} */ (0);
  let ended = state.phase === 'ended';
  let afterEndSnapshots = 0;
  /** @type {any[]} */
  let localEvents = [];
  let stepCount = 0;
  let lastPausedSnap = 0;

  function runStep() {
    inputs[o.selfId] = o.readLocalInput(state) || emptyInput();
    const t0 = now();
    step(state, inputs);
    for (const k in inputs) if (inputs[k]) inputs[k].consumed = true;
    o.onStepTime?.(now() - t0, t0);
    stepCount++;
    if (state.events.length) {
      localEvents.push(...state.events);
      if (localEvents.length > 400) localEvents = localEvents.slice(-400);
      o.sendEvents(state.events, state.tick);
    }
    if (stepCount % SNAPSHOT_EVERY === 0) o.sendSnapshot(state);
    if (!ended && state.phase === 'ended') {
      ended = true;
      o.onEnd?.(state);
    }
  }

  function tick() {
    const t = now();
    const elapsed = Math.min(250, t - last);
    last = t;
    if (paused) {
      // podczas pauzy (migracja, odliczanie) klienci dalej widzą stan
      if (t - lastPausedSnap > 100) {
        lastPausedSnap = t;
        o.sendSnapshot(state);
      }
      return;
    }
    if (ended) {
      if (afterEndSnapshots++ < 20) o.sendSnapshot(state);
      return;
    }
    acc += (elapsed / 1000) * speed;
    let n = 0;
    while (acc >= DT && n < 8 * speed) {
      acc -= DT;
      n++;
      runStep();
      if (ended) break;
    }
  }

  return {
    state,
    start() {
      last = now();
      if (!timer) timer = setInterval(tick, 4);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      last = now();
      acc = 0;
    },
    get paused() {
      return paused;
    },
    /** @param {string} id @param {any} input */
    setInput(id, input) {
      if (id === o.selfId) return;
      const prev = inputs[id];
      // zachowaj krótkie wciśnięcia, które przyszły między krokami
      if (prev && !prev.consumed) input = { ...input, buttons: input.buttons | prev.buttons };
      inputs[id] = input;
    },
    drainEvents() {
      const e = localEvents;
      localEvents = [];
      return e;
    },
    forceSnapshot() {
      o.sendSnapshot(state);
    },
  };
}
