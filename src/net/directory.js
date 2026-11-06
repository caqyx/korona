/**
 * Katalog pokoi (lista dla ekranu Multiplayer). Właściciel pokoju ogłasza go, a ekran listy
 * subskrybuje zmiany. Dwie implementacje jak w transport.js:
 *  - Supabase Realtime Presence na kanale `rooms` (bez zmian w bazie),
 *  - BroadcastChannel `korona:rooms` (karty jednej przeglądarki; w E2E przez most).
 *
 * @typedef {{code:string, ownerNick:string, players:number, max:number, status:'lobby'|'playing', mapId?:string, createdAt:number}} RoomInfo
 * @typedef {{ subscribe:(cb:(rooms:RoomInfo[])=>void)=>()=>void, announce:(room:RoomInfo|null)=>void, close:()=>void }} Directory
 */
import { hasSupabaseConfig } from './supabaseConfig.js';

const HEARTBEAT_MS = 1000;
const TIMEOUT_MS = 3500;
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;

/** Walidacja wpisu z sieci (dane od innych graczy). @param {any} r @returns {RoomInfo|null} */
export function sanitizeRoom(r) {
  if (!r || typeof r !== 'object' || typeof r.code !== 'string' || !CODE_RE.test(r.code)) return null;
  const n = (v, a, b, d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d);
  return {
    code: r.code,
    ownerNick: typeof r.ownerNick === 'string' ? r.ownerNick.slice(0, 16) : '?',
    players: n(r.players, 0, 8, 1),
    max: n(r.max, 2, 8, 6),
    status: r.status === 'playing' ? 'playing' : 'lobby',
    mapId: typeof r.mapId === 'string' ? r.mapId.slice(0, 16) : undefined,
    createdAt: n(r.createdAt, 0, 1e15, 0),
  };
}

/** Sortowanie: otwarte lobby najpierw, potem najnowsze. @param {RoomInfo[]} list */
export function sortRooms(list) {
  return [...list].sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'lobby' ? -1 : 1));
}

/** Otwiera katalog właściwy dla konfiguracji. @param {{forceLocal?:boolean}} [o] @returns {Promise<Directory>} */
export async function openDirectory(o = {}) {
  if (hasSupabaseConfig() && !o.forceLocal) {
    try {
      const { getSupabase } = await import('./supabase.js');
      const sb = await getSupabase();
      if (sb) return createSupabaseDirectory(sb);
    } catch {
      /* fallback lokalny */
    }
  }
  return createLocalDirectory();
}

/** @returns {Directory} */
export function createLocalDirectory() {
  const key = 'korona:rooms';
  const selfId = Math.random().toString(36).slice(2);
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(key) : null;
  /** @type {Map<string,{room:RoomInfo, seen:number}>} */
  const rooms = new Map();
  const subs = new Set();
  /** @type {RoomInfo|null} */
  let mine = null;
  const post = (data) => {
    bc?.postMessage(data);
    const bridge = /** @type {any} */ (globalThis).__koronaBridgeSend;
    if (typeof bridge === 'function') bridge(key, data);
  };
  const emit = () => {
    const now = Date.now();
    for (const [id, x] of rooms) if (now - x.seen > TIMEOUT_MS) rooms.delete(id);
    const list = sortRooms([...rooms.values()].map((x) => x.room).concat(mine ? [mine] : []));
    for (const cb of subs) cb(list);
  };
  const receive = (d) => {
    if (!d || d.id === selfId) return;
    if (d.k === 'room') {
      const r = sanitizeRoom(d.room);
      if (r) rooms.set(d.id, { room: r, seen: Date.now() });
      emit();
    } else if (d.k === 'gone') {
      rooms.delete(d.id);
      emit();
    } else if (d.k === 'ask' && mine) post({ k: 'room', id: selfId, room: mine });
  };
  if (bc) bc.onmessage = (e) => receive(e.data);
  const g = /** @type {any} */ (globalThis);
  const prev = g.__koronaBridgeReceive;
  g.__koronaBridgeReceive = (k, data) => {
    if (k === key) receive(data);
    else if (typeof prev === 'function') prev(k, data);
  };
  const hb = setInterval(() => {
    if (mine) post({ k: 'room', id: selfId, room: mine });
    emit();
  }, HEARTBEAT_MS);
  post({ k: 'ask', id: selfId });
  return {
    subscribe(cb) {
      subs.add(cb);
      emit();
      return () => subs.delete(cb);
    },
    announce(room) {
      mine = room ? sanitizeRoom(room) : null;
      post(mine ? { k: 'room', id: selfId, room: mine } : { k: 'gone', id: selfId });
      emit();
    },
    close() {
      if (mine) post({ k: 'gone', id: selfId });
      clearInterval(hb);
      bc?.close();
      subs.clear();
    },
  };
}

/** @param {any} sb @returns {Directory} */
export function createSupabaseDirectory(sb) {
  const key = Math.random().toString(36).slice(2);
  const ch = sb.channel('rooms', { config: { presence: { key } } });
  const subs = new Set();
  /** @type {RoomInfo|null} */
  let mine = null;
  let subscribed = false;
  const emit = () => {
    const state = ch.presenceState();
    const list = [];
    for (const k of Object.keys(state)) {
      const metas = /** @type {any[]} */ (state[k]);
      const r = sanitizeRoom(metas[metas.length - 1]?.room);
      if (r) list.push(r);
    }
    const sorted = sortRooms(list);
    for (const cb of subs) cb(sorted);
  };
  ch.on('presence', { event: 'sync' }, emit);
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      if (mine) ch.track({ room: mine });
    }
  });
  return {
    subscribe(cb) {
      subs.add(cb);
      if (subscribed) emit();
      return () => subs.delete(cb);
    },
    announce(room) {
      mine = room ? sanitizeRoom(room) : null;
      if (!subscribed) return;
      if (mine) ch.track({ room: mine });
      else ch.untrack();
    },
    close() {
      subs.clear();
      ch.untrack?.();
      sb.removeChannel(ch);
    },
  };
}
