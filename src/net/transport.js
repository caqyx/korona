/**
 * INTERFEJS transportu (lobby, presence, sygnalizacja, przekaźnik) + 2 implementacje:
 *  - SupabaseTransport: Realtime Presence + Broadcast na kanale `room:{code}`
 *  - LocalTransport: BroadcastChannel między kartami (dev bez kluczy, testy)
 *
 * @typedef {Object} PresenceInfo
 * @property {string} userId
 * @property {string} nick
 * @property {string} skin
 * @property {number} deviceScore
 * @property {number} joinedAt
 * @property {boolean} ready
 * @property {boolean} [owner]
 * @property {string} [status]   'lobby' | 'match'
 *
 * @typedef {Object} Transport
 * @property {'supabase'|'local'} kind
 * @property {string} selfId
 * @property {number} relayHz           częstotliwość przekaźnika snapshotów
 * @property {(room:string, presence:PresenceInfo)=>Promise<void>} join
 * @property {(presence:PresenceInfo)=>void} updatePresence
 * @property {(cb:(list:PresenceInfo[])=>void)=>void} onPresence
 * @property {(msg:{type:string,from:string,to?:string,payload:any})=>void} send
 * @property {(cb:(msg:any)=>void)=>void} onMessage
 * @property {()=>Promise<void>} leave
 */
import { parseMessage, encodeMessage, validatePresence } from './messages.js';

const HEARTBEAT_MS = 500;
const PRESENCE_TIMEOUT_MS = 2500;

/**
 * Transport lokalny przez BroadcastChannel. Opcjonalny most `window.__koronaBridgeSend`
 * pozwala testom E2E łączyć osobne konteksty przeglądarki.
 * @param {string} selfId
 * @returns {Transport}
 */
export function createLocalTransport(selfId) {
  /** @type {BroadcastChannel|null} */
  let bc = null;
  let key = '';
  /** @type {PresenceInfo|null} */
  let me = null;
  /** @type {Map<string,{p:PresenceInfo,seen:number}>} */
  const peers = new Map();
  const presenceCbs = [];
  const msgCbs = [];
  let hb = 0;
  let lastEmitted = '';

  const post = (data) => {
    bc?.postMessage(data);
    const bridge = /** @type {any} */ (globalThis).__koronaBridgeSend;
    if (typeof bridge === 'function') bridge(key, data);
  };
  const emitPresence = (force = false) => {
    const list = [...peers.values()].map((x) => x.p);
    if (me) list.push(me);
    const sig = JSON.stringify(list);
    if (!force && sig === lastEmitted) return;
    lastEmitted = sig;
    for (const cb of presenceCbs) cb(list);
  };
  const receive = (data) => {
    if (!data || typeof data !== 'object' || data.id === selfId) return;
    if (data._k === 'pres' && validatePresence(data.p) && data.p.userId === data.id) {
      const isNew = !peers.has(data.id);
      peers.set(data.id, { p: data.p, seen: Date.now() });
      if (isNew && me) post({ _k: 'pres', id: selfId, p: me });
      emitPresence();
    } else if (data._k === 'leave') {
      if (peers.delete(data.id)) emitPresence();
    } else if (data._k === 'msg') {
      const m = parseMessage(data.m);
      if (!m || m.from !== data.id) return;
      if (m.to && m.to !== selfId) return;
      for (const cb of msgCbs) cb(m);
    }
  };
  const onPageHide = () => post({ _k: 'leave', id: selfId });

  return {
    kind: 'local',
    selfId,
    relayHz: 20,
    async join(room, presence) {
      key = `korona:room:${room}`;
      me = presence;
      bc = new BroadcastChannel(key);
      bc.onmessage = (e) => receive(e.data);
      const g = /** @type {any} */ (globalThis);
      const prev = g.__koronaBridgeReceive;
      g.__koronaBridgeReceive = (k, data) => {
        if (k === key) receive(data);
        else if (typeof prev === 'function') prev(k, data);
      };
      post({ _k: 'pres', id: selfId, p: me });
      hb = /** @type {any} */ (setInterval(() => {
        if (me) post({ _k: 'pres', id: selfId, p: me });
        const now = Date.now();
        let changed = false;
        for (const [id, x] of peers) {
          if (now - x.seen > PRESENCE_TIMEOUT_MS) {
            peers.delete(id);
            changed = true;
          }
        }
        if (changed) emitPresence();
      }, HEARTBEAT_MS));
      window.addEventListener('pagehide', onPageHide);
      emitPresence(true);
    },
    updatePresence(p) {
      me = p;
      post({ _k: 'pres', id: selfId, p });
      emitPresence();
    },
    onPresence(cb) {
      presenceCbs.push(cb);
    },
    send(msg) {
      post({ _k: 'msg', id: selfId, m: encodeMessage(msg) });
    },
    onMessage(cb) {
      msgCbs.push(cb);
    },
    async leave() {
      post({ _k: 'leave', id: selfId });
      clearInterval(hb);
      window.removeEventListener('pagehide', onPageHide);
      bc?.close();
      bc = null;
      peers.clear();
      me = null;
    },
  };
}

/**
 * Transport Supabase Realtime: Presence (lista graczy + deviceScore) i Broadcast
 * (sygnalizacja WebRTC, host_claim, przekaźnik). Wiadomości z polem `to` są filtrowane po stronie odbiorcy.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase @param {string} selfId
 * @returns {Transport}
 */
export function createSupabaseTransport(supabase, selfId) {
  /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
  let ch = null;
  const presenceCbs = [];
  const msgCbs = [];
  /** @type {PresenceInfo|null} */
  let me = null;

  const emitPresence = () => {
    if (!ch) return;
    const state = ch.presenceState();
    const list = [];
    for (const key of Object.keys(state)) {
      const metas = /** @type {any[]} */ (state[key]);
      const p = metas[metas.length - 1];
      const clean = p && { userId: p.userId, nick: p.nick, skin: p.skin, deviceScore: p.deviceScore, joinedAt: p.joinedAt, ready: p.ready, owner: !!p.owner, status: p.status };
      if (clean && validatePresence(clean) && clean.userId === key) list.push(clean);
    }
    for (const cb of presenceCbs) cb(list);
  };

  return {
    kind: 'supabase',
    selfId,
    relayHz: 10,
    async join(room, presence) {
      me = presence;
      ch = supabase.channel(`room:${room}`, { config: { presence: { key: selfId }, broadcast: { self: false, ack: false } } });
      ch.on('presence', { event: 'sync' }, emitPresence);
      ch.on('broadcast', { event: 'm' }, ({ payload }) => {
        const m = parseMessage(payload?.d);
        if (!m) return;
        if (m.to && m.to !== selfId) return;
        for (const cb of msgCbs) cb(m);
      });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Realtime: timeout subskrypcji')), 10000);
        /** @type {any} */ (ch).subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(t);
            await ch?.track(/** @type {any} */ (me));
            resolve(undefined);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(t);
            reject(new Error('Realtime: ' + status));
          }
        });
      });
    },
    updatePresence(p) {
      me = p;
      ch?.track(/** @type {any} */ (p));
    },
    onPresence(cb) {
      presenceCbs.push(cb);
    },
    send(msg) {
      ch?.send({ type: 'broadcast', event: 'm', payload: { d: encodeMessage(msg) } });
    },
    onMessage(cb) {
      msgCbs.push(cb);
    },
    async leave() {
      if (ch) {
        await ch.untrack().catch(() => {});
        await supabase.removeChannel(ch).catch(() => {});
      }
      ch = null;
    },
  };
}
