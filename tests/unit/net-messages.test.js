import { describe, it, expect } from 'vitest';
import { MSG, LIMITS, validateMessage, parseMessage, validatePresence, validateInput, validateSnapshotState, encodeMessage, envelope } from '../../src/net/messages.js';
import { createMatchState } from '../../src/sim/state.js';
import { SKIN_IDS } from '../../src/sim/config.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, nick: `Gracz${i}`, skin: SKIN_IDS[i % SKIN_IDS.length] }));
/** Stan przepuszczony przez JSON (tak jak po sieci). */
const snap = (n = 3) => JSON.parse(encodeMessage(createMatchState({ seed: 42, players: players(n) })));
const input = (o = {}) => ({ seq: 1, moveX: 0.5, moveY: -1, aimX: 3, aimY: -4, buttons: 5, ...o });
const presence = (o = {}) => ({ userId: 'u1', nick: 'Ala', skin: 'rycerz', deviceScore: 120.5, joinedAt: 1_700_000_000_000, ready: false, ...o });
const msg = (type, payload, from = 'u1', to) => envelope(type, from, payload, to);

/** Komplet poprawnych wiadomości — po jednej na typ. */
const valid = () => ({
  [MSG.SIGNAL]: [
    msg(MSG.SIGNAL, { kind: 'offer', sdp: 'v=0', epoch: 0 }, 'u1', 'u2'),
    msg(MSG.SIGNAL, { kind: 'answer', sdp: 'v=0', epoch: 3 }, 'u2', 'u1'),
    msg(MSG.SIGNAL, { kind: 'ice', candidate: { candidate: 'candidate:1 1 udp', sdpMid: '0', sdpMLineIndex: 0 }, epoch: 1 }),
    msg(MSG.SIGNAL, { kind: 'ice', candidate: null, epoch: 1 }),
  ],
  [MSG.HOST_CLAIM]: [msg(MSG.HOST_CLAIM, { epoch: 2, hostId: 'u1', tick: 100 }), msg(MSG.HOST_CLAIM, { epoch: 2, hostId: 'u1' })],
  [MSG.HANDOFF]: [msg(MSG.HANDOFF, { to: 'u2', epoch: 2, state: snap() }, 'u1', 'u2')],
  [MSG.INPUT]: [msg(MSG.INPUT, input()), msg(MSG.INPUT, input({ skin: 'kaplan' }))],
  [MSG.SNAPSHOT]: [msg(MSG.SNAPSHOT, { epoch: 1, state: snap() })],
  [MSG.EVENTS]: [msg(MSG.EVENTS, { epoch: 1, tick: 5, events: [{ type: 'kill', killer: 'u1', victim: 'u2' }] }), msg(MSG.EVENTS, { epoch: 1, events: [] })],
  [MSG.START]: [msg(MSG.START, { epoch: 1, hostId: 'u1', matchId: 'mabc', state: snap(6) })],
  [MSG.RESUME]: [msg(MSG.RESUME, { epoch: 2, countdown: 3 }), msg(MSG.RESUME, { epoch: 2, countdown: 0 })],
  [MSG.HELLO]: [msg(MSG.HELLO, { epoch: 1 }, 'u2', 'u1')],
  [MSG.RELAY]: [msg(MSG.RELAY, { kind: 'state', msg: msg(MSG.INPUT, input()) }, 'u1', 'u2'), msg(MSG.RELAY, { kind: 'events', msg: msg(MSG.HELLO, { epoch: 1 }) })],
  [MSG.LOBBY_CMD]: [msg(MSG.LOBBY_CMD, { cmd: 'start' }), msg(MSG.LOBBY_CMD, { cmd: 'rematch' }), msg(MSG.LOBBY_CMD, { cmd: 'close' })],
  [MSG.RESULT]: [msg(MSG.RESULT, { matchId: 'm1' }), msg(MSG.RESULT, {})],
});

describe('messages: poprawne wiadomości (każdy typ)', () => {
  it('pokrywa wszystkie typy MSG', () => {
    expect(Object.keys(valid()).sort()).toEqual(Object.values(MSG).sort());
  });
  for (const [type, list] of Object.entries(valid())) {
    it(`${type}: validateMessage i parseMessage(encodeMessage) akceptują`, () => {
      for (const m of list) {
        expect(validateMessage(m)).toBe(true);
        const parsed = parseMessage(encodeMessage(m));
        expect(parsed).not.toBeNull();
        expect(parsed.type).toBe(type);
      }
    });
  }
  it('snapshot z 1 i 6 graczami jest poprawny', () => {
    expect(validateSnapshotState(snap(1))).toBe(true);
    expect(validateSnapshotState(snap(6))).toBe(true);
  });
  it('snapshot prosto z createMatchState (bez JSON) też jest poprawny', () => {
    expect(validateSnapshotState(createMatchState({ seed: 7, players: players(2) }))).toBe(true);
  });
  it('presence poprawne (z opcjonalnymi polami)', () => {
    expect(validatePresence(presence())).toBe(true);
    expect(validatePresence(presence({ owner: true, status: 'match' }))).toBe(true);
    expect(validatePresence(presence({ deviceScore: 0 }))).toBe(true);
  });
  it('input na krańcach zakresów', () => {
    expect(validateInput(input({ moveX: -1, moveY: 1, aimX: -100, aimY: 100, buttons: 63, seq: 0 }))).toBe(true);
    expect(validateInput(input({ buttons: 0 }))).toBe(true);
  });
});

describe('messages: koperta', () => {
  it('odrzuca nieznane typy i brak typu', () => {
    for (const type of ['nope', 'SNAPSHOT', '', 'toString', '__proto__', 'constructor', 'hasOwnProperty']) {
      expect(validateMessage({ type, from: 'u1', payload: { epoch: 1 } })).toBe(false);
    }
    expect(validateMessage({ from: 'u1', payload: {} })).toBe(false);
    expect(validateMessage({ type: 5, from: 'u1', payload: {} })).toBe(false);
  });
  it('odrzuca brak lub zły `from`', () => {
    const p = { epoch: 1 };
    for (const from of [undefined, null, '', 5, {}, ['u1'], 'a b', 'u1;drop', '<script>', 'x'.repeat(65), 'ż', '../u1']) {
      expect(validateMessage({ type: MSG.HELLO, from, payload: p })).toBe(false);
    }
    expect(validateMessage({ type: MSG.HELLO, from: 'x'.repeat(64), payload: p })).toBe(true);
  });
  it('odrzuca zły `to`', () => {
    expect(validateMessage({ type: MSG.HELLO, from: 'u1', to: 'bad id', payload: { epoch: 1 } })).toBe(false);
    expect(validateMessage({ type: MSG.HELLO, from: 'u1', to: 7, payload: { epoch: 1 } })).toBe(false);
    expect(validateMessage({ type: MSG.HELLO, from: 'u1', to: null, payload: { epoch: 1 } })).toBe(true);
  });
  it('odrzuca nie-obiekty', () => {
    for (const m of [null, undefined, 1, 'x', true, [], [{ type: MSG.HELLO, from: 'u1', payload: { epoch: 1 } }]]) expect(validateMessage(m)).toBe(false);
  });
});

describe('messages: klucze prototypowe (przez JSON.parse)', () => {
  const raws = [
    '{"type":"hello","from":"u1","payload":{"epoch":1,"__proto__":{"admin":true}}}',
    '{"type":"hello","from":"u1","payload":{"epoch":1,"constructor":{"prototype":{"x":1}}}}',
    '{"type":"hello","from":"u1","payload":{"epoch":1,"prototype":1}}',
    '{"type":"events","from":"u1","payload":{"epoch":1,"events":[{"a":{"b":{"__proto__":{"polluted":1}}}}]}}',
    '{"type":"input","from":"u1","payload":{"seq":1,"moveX":0,"moveY":0,"aimX":0,"aimY":0,"buttons":0,"__proto__":{"buttons":63}}}',
    '{"type":"relay","from":"u1","payload":{"kind":"state","msg":{"type":"input","from":"u1","payload":{"constructor":1}}}}',
  ];
  it('parseMessage zwraca null i nie zanieczyszcza Object.prototype', () => {
    for (const raw of raws) expect(parseMessage(raw)).toBeNull();
    expect(/** @type {any} */ ({}).admin).toBeUndefined();
    expect(/** @type {any} */ ({}).polluted).toBeUndefined();
  });
  it('validateMessage na obiekcie z JSON.parse też odrzuca', () => {
    for (const raw of raws) expect(validateMessage(JSON.parse(raw))).toBe(false);
  });
  it('__proto__ w graczu snapshotu', () => {
    const s = snap();
    const raw = JSON.stringify(msg(MSG.SNAPSHOT, { epoch: 1, state: s })).replace('"nick":"Gracz0"', '"nick":"Gracz0","__proto__":{"x":1}');
    expect(raw).toContain('__proto__');
    expect(parseMessage(raw)).toBeNull();
  });
});

describe('messages: NaN / Infinity (obiekty spoza JSON)', () => {
  it('odrzuca nieskończone liczby w inputach', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(validateMessage(msg(MSG.INPUT, input({ moveX: bad })))).toBe(false);
      expect(validateMessage(msg(MSG.INPUT, input({ aimY: bad })))).toBe(false);
      expect(validateMessage(msg(MSG.INPUT, input({ seq: bad })))).toBe(false);
    }
  });
  it('odrzuca NaN w snapshocie, epoch i zdarzeniach', () => {
    const s = snap();
    s.players[0].hp = NaN;
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: 1, state: s }))).toBe(false);
    const s2 = snap();
    s2.players[1].x = Infinity;
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: 1, state: s2 }))).toBe(false);
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: NaN, state: snap() }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [{ dmg: Infinity }] }))).toBe(false);
    expect(validateMessage(msg(MSG.RESUME, { epoch: 1, countdown: NaN }))).toBe(false);
  });
  it('odrzuca funkcje, undefined w tablicy, symbole, BigInt', () => {
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [() => 1] }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [undefined] }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [Symbol('x')] }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [1n] }))).toBe(false);
  });
  it('getter rzucający wyjątkiem nie wysypuje walidacji', () => {
    const p = { epoch: 1 };
    Object.defineProperty(p, 'boom', { enumerable: true, get: () => { throw new Error('x'); } });
    expect(validateMessage({ type: MSG.HELLO, from: 'u1', payload: p })).toBe(false);
  });
});

describe('messages: rozmiary i głębokość', () => {
  it('za długi surowy tekst w parseMessage', () => {
    const big = JSON.stringify(msg(MSG.HELLO, { epoch: 1, pad: 'x'.repeat(LIMITS.maxMessageBytes) }));
    expect(big.length).toBeGreaterThan(LIMITS.maxMessageBytes);
    expect(parseMessage(big)).toBeNull();
  });
  it('za długie stringi w polach', () => {
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'offer', sdp: 'x'.repeat(LIMITS.maxSdp + 1), epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'ice', candidate: { candidate: 'x'.repeat(2049) }, epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.HOST_CLAIM, { epoch: 1, hostId: 'x'.repeat(65) }))).toBe(false);
    expect(validateMessage(msg(MSG.START, { epoch: 1, hostId: 'u1', matchId: 'm'.repeat(65), state: snap() }))).toBe(false);
    expect(validateMessage(msg(MSG.RELAY, { kind: 'x'.repeat(17), msg: {} }))).toBe(false);
    // dowolny string w ładunku (np. w zdarzeniu) ma limit
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [{ type: 'x'.repeat(LIMITS.maxString + 1) }] }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: [{ type: 'x'.repeat(LIMITS.maxString) }] }))).toBe(true);
    const s = snap();
    s.players[0].nick = 'x'.repeat(LIMITS.maxNick + 1);
    expect(validateSnapshotState(s)).toBe(false);
  });
  it('za duże tablice', () => {
    const events = Array.from({ length: LIMITS.maxEvents + 1 }, () => ({ type: 'hit' }));
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: events.slice(1) }))).toBe(true);
    for (const k of ['projectiles', 'zones', 'minions', 'turrets', 'events']) {
      const s = snap();
      s[k] = Array.from({ length: LIMITS.maxEntities + 1 }, (_, i) => ({ id: i, x: 0, y: 0 }));
      expect(validateSnapshotState(s)).toBe(false);
    }
    // ogólny limit tablic w safeShape
    expect(validateMessage(msg(MSG.HELLO, { epoch: 1, junk: new Array(LIMITS.maxEntities * 2 + 1).fill(0) }))).toBe(false);
  });
  it('za głębokie zagnieżdżenie', () => {
    let deep = { v: 1 };
    for (let i = 0; i < LIMITS.maxDepth + 2; i++) deep = { d: deep };
    expect(validateMessage(msg(MSG.HELLO, { epoch: 1, deep }))).toBe(false);
    let arr = [1];
    for (let i = 0; i < LIMITS.maxDepth + 2; i++) arr = [arr];
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: arr }))).toBe(false);
    expect(parseMessage(JSON.stringify(msg(MSG.HELLO, { epoch: 1, deep })))).toBeNull();
    // bardzo głęboki JSON nie wysypuje parsera
    const huge = '{"type":"hello","from":"u1","payload":' + '['.repeat(5000) + ']'.repeat(5000) + '}';
    expect(parseMessage(huge)).toBeNull();
  });
});

describe('messages: złe typy pól i zakresy', () => {
  it('input poza zakresem', () => {
    expect(validateInput(input({ moveX: 5 }))).toBe(false);
    expect(validateInput(input({ moveY: -1.5 }))).toBe(false);
    expect(validateInput(input({ buttons: 999 }))).toBe(false);
    expect(validateInput(input({ buttons: 64 }))).toBe(false);
    expect(validateInput(input({ buttons: -1 }))).toBe(false);
    expect(validateInput(input({ buttons: 1.5 }))).toBe(false);
    expect(validateInput(input({ aimX: 1e6 }))).toBe(false);
    expect(validateInput(input({ aimY: -1e6 }))).toBe(false);
    expect(validateInput(input({ seq: -1 }))).toBe(false);
    expect(validateInput(input({ seq: 2 ** 31 + 1 }))).toBe(false);
    expect(validateMessage(msg(MSG.INPUT, input({ moveX: 5 })))).toBe(false);
  });
  it('input ze złymi typami', () => {
    expect(validateInput(input({ moveX: '0.5' }))).toBe(false);
    expect(validateInput(input({ buttons: '1' }))).toBe(false);
    expect(validateInput(input({ buttons: true }))).toBe(false);
    expect(validateInput(input({ aimX: null }))).toBe(false);
    expect(validateInput({ seq: 1 })).toBe(false);
    expect(validateInput(input({ skin: 'smok' }))).toBe(false);
    expect(validateInput(input({ skin: 5 }))).toBe(false);
    expect(validateInput(null)).toBe(false);
    expect(validateInput([])).toBe(false);
  });
  it('epoch: zły typ / zakres', () => {
    for (const epoch of [-1, 1.5, '1', null, undefined, 1e6 + 1]) {
      expect(validateMessage(msg(MSG.HELLO, { epoch }))).toBe(false);
      expect(validateMessage(msg(MSG.HOST_CLAIM, { epoch, hostId: 'u1' }))).toBe(false);
    }
  });
  it('signal: zły rodzaj, brak sdp, zły kandydat', () => {
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'bye', sdp: 'x', epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'offer', epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'offer', sdp: 5, epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'ice', candidate: 'str', epoch: 0 }))).toBe(false);
    expect(validateMessage(msg(MSG.SIGNAL, { kind: 'ice', candidate: { candidate: 5 }, epoch: 0 }))).toBe(false);
  });
  it('pozostałe typy: złe pola', () => {
    expect(validateMessage(msg(MSG.HOST_CLAIM, { epoch: 1, hostId: 'bad id' }))).toBe(false);
    expect(validateMessage(msg(MSG.HOST_CLAIM, { epoch: 1, hostId: 'u1', tick: -5 }))).toBe(false);
    expect(validateMessage(msg(MSG.HANDOFF, { to: 'u2', epoch: 1, state: {} }))).toBe(false);
    expect(validateMessage(msg(MSG.HANDOFF, { epoch: 1, state: snap() }))).toBe(false);
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: 1 }))).toBe(false);
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: 1, state: 'x' }))).toBe(false);
    expect(validateMessage(msg(MSG.EVENTS, { epoch: 1, events: {} }))).toBe(false);
    expect(validateMessage(msg(MSG.START, { epoch: 1, hostId: 'u1', state: {} }))).toBe(false);
    expect(validateMessage(msg(MSG.START, { epoch: 1, matchId: 'm', state: snap() }))).toBe(false);
    expect(validateMessage(msg(MSG.RESUME, { epoch: 1, countdown: 11 }))).toBe(false);
    expect(validateMessage(msg(MSG.RESUME, { epoch: 1, countdown: -1 }))).toBe(false);
    expect(validateMessage(msg(MSG.RELAY, { kind: 'admin', msg: {} }))).toBe(false);
    expect(validateMessage(msg(MSG.RELAY, { kind: 'state', msg: 'x' }))).toBe(false);
    expect(validateMessage(msg(MSG.LOBBY_CMD, { cmd: 'kick' }))).toBe(false);
    expect(validateMessage(msg(MSG.RESULT, { matchId: 5 }))).toBe(false);
    for (const t of Object.values(MSG)) {
      expect(validateMessage({ type: t, from: 'u1' })).toBe(false);
      expect(validateMessage({ type: t, from: 'u1', payload: null })).toBe(false);
      expect(validateMessage({ type: t, from: 'u1', payload: [] })).toBe(false);
    }
  });
});

describe('messages: snapshot', () => {
  it('7 graczy jest odrzucane, 0 graczy też', () => {
    const s = snap(6);
    s.players.push({ ...s.players[0], id: 'u6', slot: 0 });
    expect(s.players.length).toBe(7);
    expect(validateSnapshotState(s)).toBe(false);
    expect(validateMessage(msg(MSG.SNAPSHOT, { epoch: 1, state: s }))).toBe(false);
    expect(validateSnapshotState({ ...snap(), players: [] })).toBe(false);
  });
  it('nieznany skin gracza', () => {
    for (const skin of ['smok', '', 'RYCERZ', 1, null, '<img src=x onerror=alert(1)>']) {
      const s = snap();
      s.players[1].skin = skin;
      expect(validateSnapshotState(s)).toBe(false);
    }
  });
  it('złe pola gracza i stanu', () => {
    const cases = [
      (s) => (s.players[0].id = 'bad id'),
      (s) => (s.players[0].x = 1000),
      (s) => (s.players[0].score = -1),
      (s) => (s.players[0].score = 1.5),
      (s) => (s.players[0].nick = 5),
      // pola trafiające do innerHTML podsumowania / match_results
      (s) => (s.players[0].lastHits = '<img src=x onerror=alert(1)>'),
      (s) => (s.players[0].deaths = '<b>'),
      (s) => (s.players[0].bossKills = -1),
      (s) => (s.players[0].crownTime = '9'),
      (s) => (s.players[0].slot = 6),
      (s) => (s.phase = 'hacked'),
      (s) => (s.tick = -1),
      (s) => (s.time = '0'),
      (s) => (s.rng = { s: -1 }),
      (s) => (s.rng = null),
      (s) => (s.crown = null),
      (s) => delete s.projectiles,
    ];
    for (const mutate of cases) {
      const s = snap();
      mutate(s);
      expect(validateSnapshotState(s)).toBe(false);
    }
  });
});

describe('messages: parseMessage na nie-stringach i śmieciach', () => {
  it('nie-string', () => {
    for (const raw of [null, undefined, 1, true, {}, [], new ArrayBuffer(8), new Uint8Array([123, 125]), { type: 'hello', from: 'u1', payload: { epoch: 1 } }]) {
      expect(parseMessage(raw)).toBeNull();
    }
  });
  it('zły JSON', () => {
    for (const raw of ['', '{', 'null', '1', '"hello"', '[]', '{"type":"hello"', 'NaN', '{"type":"hello","from":"u1","payload":{"epoch":NaN}}']) {
      expect(parseMessage(raw)).toBeNull();
    }
  });
});

describe('messages: presence', () => {
  it('odrzuca złe presence', () => {
    const bad = [
      null,
      'u1',
      presence({ userId: 'bad id' }),
      presence({ userId: undefined }),
      presence({ nick: '' }),
      presence({ nick: '   ' }),
      presence({ nick: 'x'.repeat(17) }),
      presence({ nick: 5 }),
      presence({ skin: 'smok' }),
      presence({ deviceScore: -1 }),
      presence({ deviceScore: 1e8 }),
      presence({ deviceScore: NaN }),
      presence({ deviceScore: '100' }),
      presence({ joinedAt: -1 }),
      presence({ joinedAt: Infinity }),
      presence({ ready: 'yes' }),
      presence({ owner: 'true' }),
      presence({ status: 'admin' }),
    ];
    for (const p of bad) expect(validatePresence(p)).toBe(false);
  });
});
