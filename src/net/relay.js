/**
 * Zapasowy przekaźnik bez WebRTC: wiadomości 'state' i 'events' idą przez transport
 * (Supabase Broadcast / BroadcastChannel). Stan jest dławiony do `hz` (10 Hz dla Supabase),
 * a wysyłany jest zawsze najnowszy snapshot.
 */
import { MSG, envelope } from './messages.js';

/**
 * @param {import('./transport.js').Transport} transport @param {number} hz
 */
export function createRelay(transport, hz) {
  /** @type {Map<string, any>} */
  const latestState = new Map();
  let timer = /** @type {any} */ (0);
  const flush = () => {
    for (const [to, msg] of latestState) transport.send(envelope(MSG.RELAY, transport.selfId, { kind: 'state', msg }, to));
    latestState.clear();
  };
  return {
    start() {
      if (!timer) timer = setInterval(flush, 1000 / hz);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
      latestState.clear();
    },
    /** @param {string} to @param {any} msg */
    sendState(to, msg) {
      const prev = latestState.get(to);
      // inputy łączone: krótkie wciśnięcia z odrzuconych wiadomości nie giną
      if (prev && prev.type === 'input' && msg.type === 'input') msg = { ...msg, payload: { ...msg.payload, buttons: msg.payload.buttons | prev.payload.buttons } };
      latestState.set(to, msg);
    },
    /** @param {string} to @param {any} msg */
    sendEvent(to, msg) {
      transport.send(envelope(MSG.RELAY, transport.selfId, { kind: 'events', msg }, to));
    },
  };
}
