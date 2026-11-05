/**
 * Typy wiadomości sieciowych i ich walidacja — w jednym miejscu.
 * Każda wiadomość przychodząca z sieci (Broadcast, DataChannel, BroadcastChannel)
 * przechodzi przez validateMessage() zanim trafi do logiki.
 */
import { SKIN_IDS } from '../sim/config.js';

export const MSG = Object.freeze({
  SIGNAL: 'signal',
  HOST_CLAIM: 'host_claim',
  HANDOFF: 'handoff',
  INPUT: 'input',
  SNAPSHOT: 'snapshot',
  EVENTS: 'events',
  START: 'start',
  RESUME: 'resume',
  HELLO: 'hello',
  RELAY: 'relay',
  LOBBY_CMD: 'lobby_cmd',
  RESULT: 'result',
});

export const LIMITS = Object.freeze({
  maxMessageBytes: 512 * 1024,
  maxIdLen: 64,
  maxNick: 16,
  maxSdp: 16 * 1024,
  maxEvents: 256,
  maxPlayers: 6,
  maxEntities: 600,
  maxDepth: 8,
  maxString: 16 * 1024,
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v, min = -1e9, max = 1e9) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isId = (v) => typeof v === 'string' && ID_RE.test(v);
const isBool = (v) => typeof v === 'boolean';

/** Odrzuca klucze prototypowe i zbyt głębokie struktury. */
function safeShape(v, depth = 0) {
  if (depth > LIMITS.maxDepth) return false;
  if (Array.isArray(v)) {
    if (v.length > LIMITS.maxEntities * 2) return false;
    return v.every((x) => safeShape(x, depth + 1));
  }
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (FORBIDDEN_KEYS.has(k)) return false;
      if (!safeShape(v[k], depth + 1)) return false;
    }
    return true;
  }
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= LIMITS.maxString;
  return v === null || typeof v === 'boolean';
}

/** @param {any} p */
export function validatePresence(p) {
  return (
    isObj(p) &&
    isId(p.userId) &&
    isStr(p.nick, LIMITS.maxNick) &&
    p.nick.trim().length > 0 &&
    SKIN_IDS.includes(p.skin) &&
    isNum(p.deviceScore, 0, 1e7) &&
    isNum(p.joinedAt, 0, 1e15) &&
    isBool(p.ready) &&
    (p.owner === undefined || isBool(p.owner)) &&
    (p.status === undefined || ['lobby', 'match'].includes(p.status))
  );
}

/** @param {any} i */
export function validateInput(i) {
  return (
    isObj(i) &&
    isInt(i.seq, 0, 2 ** 31) &&
    isNum(i.moveX, -1.01, 1.01) &&
    isNum(i.moveY, -1.01, 1.01) &&
    isNum(i.aimX, -100, 100) &&
    isNum(i.aimY, -100, 100) &&
    isInt(i.buttons, 0, 63) &&
    (i.skin === undefined || SKIN_IDS.includes(i.skin))
  );
}

/** Walidacja struktury snapshotu (host jest zaufany co do treści, ale nie co do kształtu). @param {any} s */
export function validateSnapshotState(s) {
  if (!isObj(s)) return false;
  if (!isInt(s.tick, 0, 2 ** 31) || !isNum(s.time, 0, 1e6) || !isNum(s.matchTime, 0, 1e6)) return false;
  if (!['countdown', 'playing', 'transition', 'ended'].includes(s.phase)) return false;
  if (!Array.isArray(s.players) || s.players.length < 1 || s.players.length > LIMITS.maxPlayers) return false;
  for (const p of s.players) {
    if (!isObj(p) || !isId(p.id) || !isStr(p.nick, LIMITS.maxNick) || !SKIN_IDS.includes(p.skin)) return false;
    if (!isNum(p.x, -100, 100) || !isNum(p.y, -100, 100) || !isInt(p.score, 0, 100000)) return false;
    // pola trafiające do UI (innerHTML podsumowania) i do match_results po migracji — muszą być liczbami
    if (!isInt(p.slot, 0, LIMITS.maxPlayers - 1) || !isNum(p.crownTime, 0, 1e6)) return false;
    if (!isInt(p.lastHits, 0, 1e6) || !isInt(p.bossKills, 0, 1e6) || !isInt(p.deaths, 0, 1e6)) return false;
  }
  for (const k of ['projectiles', 'zones', 'minions', 'turrets', 'events']) {
    if (!Array.isArray(s[k]) || s[k].length > LIMITS.maxEntities) return false;
  }
  if (!isObj(s.rng) || !isInt(s.rng.s, 0, 2 ** 32)) return false;
  if (!isObj(s.crown)) return false;
  return safeShape(s);
}

const SIGNAL_KINDS = ['offer', 'answer', 'ice'];

/** Walidatory per typ — payload (bez kopert). */
const VALIDATORS = {
  [MSG.SIGNAL]: (p) =>
    isObj(p) &&
    SIGNAL_KINDS.includes(p.kind) &&
    isInt(p.epoch, 0, 1e6) &&
    (p.kind === 'ice' ? isObj(p.candidate) || p.candidate === null : isStr(p.sdp, LIMITS.maxSdp)) &&
    (p.candidate === undefined || p.candidate === null || (isObj(p.candidate) && isStr(p.candidate.candidate ?? '', 2048))),
  [MSG.HOST_CLAIM]: (p) => isObj(p) && isInt(p.epoch, 0, 1e6) && isId(p.hostId) && isInt(p.tick ?? 0, 0, 2 ** 31),
  [MSG.HANDOFF]: (p) => isObj(p) && isId(p.to) && isInt(p.epoch, 0, 1e6) && validateSnapshotState(p.state),
  [MSG.INPUT]: (p) => validateInput(p),
  [MSG.SNAPSHOT]: (p) => isObj(p) && isInt(p.epoch, 0, 1e6) && validateSnapshotState(p.state),
  [MSG.EVENTS]: (p) => isObj(p) && isInt(p.epoch, 0, 1e6) && Array.isArray(p.events) && p.events.length <= LIMITS.maxEvents && safeShape(p.events),
  [MSG.START]: (p) =>
    isObj(p) &&
    isInt(p.epoch, 0, 1e6) &&
    isId(p.hostId) &&
    isStr(p.matchId ?? '', 64) &&
    validateSnapshotState(p.state),
  [MSG.RESUME]: (p) => isObj(p) && isInt(p.epoch, 0, 1e6) && isNum(p.countdown, 0, 10),
  [MSG.HELLO]: (p) => isObj(p) && isInt(p.epoch, 0, 1e6),
  [MSG.RELAY]: (p) => isObj(p) && isStr(p.kind, 16) && ['state', 'events'].includes(p.kind) && isObj(p.msg),
  [MSG.LOBBY_CMD]: (p) => isObj(p) && ['start', 'rematch', 'close'].includes(p.cmd),
  [MSG.RESULT]: (p) => isObj(p) && isStr(p.matchId ?? '', 64),
};

/**
 * Koperta: { type, from, to?, payload }.
 * @param {any} m @returns {boolean}
 */
export function validateMessage(m) {
  if (!isObj(m) || typeof m.type !== 'string') return false;
  const v = VALIDATORS[m.type];
  if (!v) return false;
  if (!isId(m.from)) return false;
  if (m.to !== undefined && m.to !== null && !isId(m.to)) return false;
  try {
    if (!safeShape(m.payload)) return false;
    return v(m.payload) === true;
  } catch {
    return false;
  }
}

/** Parsuje surowy tekst z kanału i waliduje. Zwraca null dla śmieci. @param {unknown} raw */
export function parseMessage(raw) {
  if (typeof raw !== 'string' || raw.length > LIMITS.maxMessageBytes) return null;
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  return validateMessage(m) ? m : null;
}

/** Kwantyzuje liczby do 3 miejsc — zmniejsza snapshot. */
export function encodeMessage(m) {
  return JSON.stringify(m, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}

/** Tworzy kopertę. */
export const envelope = (type, from, payload, to) => (to ? { type, from, to, payload } : { type, from, payload });
