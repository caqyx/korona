/**
 * Pętla klienta: input 30 Hz do hosta, render z bufora interpolacji opóźnionego o 100 ms.
 */
import { createInterpBuffer } from './interp.js';
import { HERO, BOSS_COMMON, BOSSES } from '../sim/config.js';

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
  /** ostatni wysłany input — do predykcji własnego ruchu */

  function sendTick() {
    const view = lastView || buffer.latest();
    if (!view) return;
    const me = view.players.find((p) => p.id === o.selfId);
    const inp = o.readInput(view, me);
    seq = (seq + 1) % 2 ** 31;
    const msg = { seq, moveX: clamp1(inp.moveX), moveY: clamp1(inp.moveY), aimX: clampA(inp.aimX), aimY: clampA(inp.aimY), buttons: inp.buttons & 63 };
    o.sendInput(msg);
    inputRef.moveX = msg.moveX;
    inputRef.moveY = msg.moveY;
  }

  selfIdRef.id = o.selfId;
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
      const t = now();
      const v = buffer.sample(t);
      if (v) lastView = predictSelf(v, buffer.latest(), t - lastSnapshotAt);
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

/**
 * Własna postać: zamiast pozycji sprzed 100 ms bierzemy najnowszy snapshot i dokładamy ruch
 * z bieżącego inputu za czas od jego odbioru (maks. 120 ms). Pozostali gracze — interpolacja.
 */
function predictSelf(view, latest, sinceMs) {
  const me = latest?.players.find((p) => p.id === selfIdRef.id);
  if (!me || !me.alive || me.stunT > 0 || latest.phase === 'countdown') return view;
  const dt = Math.min(0.12, Math.max(0, sinceMs / 1000));
  const sp = me.boss ? BOSS_COMMON.speed * (BOSSES[me.boss.type]?.speedMul ?? 1) : HERO.speed * (me.slowT > 0 ? me.slowMul : 1);
  const l = Math.hypot(inputRef.moveX, inputRef.moveY);
  const k = l > 1 ? 1 / l : 1;
  const x = me.x + inputRef.moveX * k * sp * dt;
  const y = me.y + inputRef.moveY * k * sp * dt;
  return { ...view, players: view.players.map((p) => (p.id === me.id ? { ...me, x, y } : p)) };
}
const selfIdRef = { id: '' };
const inputRef = { moveX: 0, moveY: 0 };
