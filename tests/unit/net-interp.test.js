import { describe, it, expect, vi, afterEach } from 'vitest';
import { interpolateState, createInterpBuffer } from '../../src/net/interp.js';
import { createRelay } from '../../src/net/relay.js';
import { MSG, envelope, validateMessage } from '../../src/net/messages.js';

const st = (tick, players, extra = {}) => ({ tick, phase: 'playing', players, projectiles: [], minions: [], ...extra });
const p = (id, x, y, extra = {}) => ({ id, x, y, ...extra });

describe('interpolateState', () => {
  it('lerp pozycji po id (kolejność list nie ma znaczenia)', () => {
    const a = st(1, [p('a', 0, 0), p('b', 10, 10)]);
    const b = st(2, [p('b', 12, 10), p('a', 2, -2)]);
    const v = interpolateState(a, b, 0.5);
    expect(v.players.find((x) => x.id === 'a')).toMatchObject({ x: 1, y: -1 });
    expect(v.players.find((x) => x.id === 'b')).toMatchObject({ x: 11, y: 10 });
    expect(v.tick).toBe(2);
  });
  it('pozostałe pola z nowszego snapshotu', () => {
    const a = st(1, [p('a', 0, 0, { hp: 10 })]);
    const b = st(2, [p('a', 2, 0, { hp: 5 })], { phase: 'ended' });
    const v = interpolateState(a, b, 0.25);
    expect(v.players[0]).toEqual({ id: 'a', x: 0.5, y: 0, hp: 5 });
    expect(v.phase).toBe('ended');
  });
  it('bez lerpa przy dużym skoku (teleport/odrodzenie)', () => {
    const a = st(1, [p('a', 0, 0)]);
    const b = st(2, [p('a', 5, 0)]);
    expect(interpolateState(a, b, 0.5).players[0]).toEqual(p('a', 5, 0));
    const c = st(2, [p('a', 3, 0)]);
    expect(interpolateState(a, c, 0.5).players[0]).toEqual(p('a', 1.5, 0));
  });
  it('nowe encje bez odpowiednika są brane z b; pociski i miniony też interpolowane', () => {
    const a = st(1, [], { projectiles: [p(1, 0, 0)], minions: [p(7, 0, 0)] });
    const b = st(2, [], { projectiles: [p(1, 1, 0), p(2, 9, 9)], minions: [p(7, 0, 2)] });
    const v = interpolateState(a, b, 0.5);
    expect(v.projectiles).toEqual([p(1, 0.5, 0), p(2, 9, 9)]);
    expect(v.minions).toEqual([p(7, 0, 1)]);
  });
  it('t poza 0..1 i brak a', () => {
    const a = st(1, [p('a', 0, 0)]);
    const b = st(2, [p('a', 2, 0)]);
    expect(interpolateState(null, b, 0.5)).toBe(b);
    expect(interpolateState(a, b, 1)).toBe(b);
    expect(interpolateState(a, b, 2)).toBe(b);
    expect(interpolateState(a, b, -1).players[0].x).toBe(0);
  });
  it('nie mutuje snapshotów', () => {
    const a = st(1, [p('a', 0, 0)]);
    const b = st(2, [p('a', 2, 0)]);
    interpolateState(a, b, 0.5);
    expect(a.players[0].x).toBe(0);
    expect(b.players[0].x).toBe(2);
  });
});

describe('createInterpBuffer (100 ms za czasem)', () => {
  it('pusty -> null; jeden snapshot -> on sam', () => {
    const buf = createInterpBuffer(100);
    expect(buf.sample(0)).toBeNull();
    expect(buf.latest()).toBeNull();
    const s = st(1, [p('a', 0, 0)]);
    buf.push(s, 1000);
    expect(buf.sample(1000)).toBe(s);
    expect(buf.sample(5000)).toBe(s);
  });
  it('próbkuje 100 ms wstecz z interpolacją', () => {
    const buf = createInterpBuffer(100);
    let clock = 1000;
    buf.push(st(1, [p('a', 0, 0)]), clock);
    clock += 50;
    buf.push(st(2, [p('a', 1, 0)]), clock);
    clock += 50;
    buf.push(st(3, [p('a', 2, 0)]), clock); // t=1100
    // now=1100 -> target 1000 -> dokładnie pierwszy
    expect(buf.sample(1100).players[0].x).toBe(0);
    // now=1125 -> target 1025 -> połowa między 1 i 2
    expect(buf.sample(1125).players[0].x).toBeCloseTo(0.5);
    // now=1175 -> target 1075 -> połowa między 2 i 3
    expect(buf.sample(1175).players[0].x).toBeCloseTo(1.5);
    // now=1300 -> target 1200 -> ostatni, bez ekstrapolacji
    expect(buf.sample(1300).players[0].x).toBe(2);
    expect(buf.sample(1300).tick).toBe(3);
    // przed buforem -> najstarszy
    expect(buf.sample(900).tick).toBe(1);
  });
  it('odrzuca stare/zdublowane ticki (snapshoty bez kolejności)', () => {
    const buf = createInterpBuffer(100);
    expect(buf.push(st(5, []), 0)).toBe(true);
    expect(buf.push(st(5, []), 10)).toBe(false);
    expect(buf.push(st(3, []), 20)).toBe(false);
    expect(buf.push(st(6, []), 30)).toBe(true);
    expect(buf.latest().tick).toBe(6);
  });
  it('trzyma maks. 40 snapshotów i clear()', () => {
    const buf = createInterpBuffer(100);
    for (let i = 1; i <= 100; i++) buf.push(st(i, []), i * 50);
    // najstarszy zachowany to tick 61 -> próbka daleko w przeszłości zwraca go
    expect(buf.sample(0).tick).toBe(61);
    buf.clear();
    expect(buf.latest()).toBeNull();
  });
});

describe('relay: łączenie inputów i dławienie', () => {
  afterEach(() => vi.useRealTimers());

  const fakeTransport = () => {
    const sent = [];
    return { selfId: 'c1', sent, send: (m) => sent.push(m) };
  };
  const inputMsg = (seq, buttons) => envelope(MSG.INPUT, 'c1', { seq, moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons });

  it('wysyła tylko najnowszy stan na odbiorcę co 1/hz, w kopercie relay', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    r.start();
    r.sendState('h', envelope(MSG.SNAPSHOT, 'c1', { n: 1 }));
    r.sendState('h', envelope(MSG.SNAPSHOT, 'c1', { n: 2 }));
    r.sendState('x', envelope(MSG.SNAPSHOT, 'c1', { n: 3 }));
    expect(t.sent).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(t.sent).toHaveLength(2);
    const toH = t.sent.find((m) => m.to === 'h');
    expect(toH).toMatchObject({ type: MSG.RELAY, from: 'c1', to: 'h', payload: { kind: 'state' } });
    expect(toH.payload.msg.payload.n).toBe(2);
    vi.advanceTimersByTime(500);
    expect(t.sent).toHaveLength(2); // nic nowego -> nic nie wysyła
    r.stop();
  });

  it('łączy przyciski z nadpisanych inputów (krótkie wciśnięcia nie giną)', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    r.start();
    r.sendState('h', inputMsg(1, 1)); // ATTACK
    r.sendState('h', inputMsg(2, 2)); // DASH
    r.sendState('h', inputMsg(3, 0));
    vi.advanceTimersByTime(100);
    expect(t.sent).toHaveLength(1);
    const inner = t.sent[0].payload.msg;
    expect(inner.payload.seq).toBe(3);
    expect(inner.payload.buttons).toBe(3);
    expect(validateMessage(t.sent[0])).toBe(true);
    // po flushu bez łączenia z poprzednim oknem
    r.sendState('h', inputMsg(4, 4));
    vi.advanceTimersByTime(100);
    expect(t.sent[1].payload.msg.payload.buttons).toBe(4);
    r.stop();
  });

  it('nie mutuje oryginalnej wiadomości przy łączeniu', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    const second = inputMsg(2, 2);
    r.sendState('h', inputMsg(1, 1));
    r.sendState('h', second);
    expect(second.payload.buttons).toBe(2);
    r.start();
    vi.advanceTimersByTime(100);
    expect(t.sent[0].payload.msg.payload.buttons).toBe(3);
    r.stop();
  });

  it('nie łączy inputu ze snapshotem', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    r.start();
    r.sendState('h', envelope(MSG.SNAPSHOT, 'c1', { n: 1 }));
    r.sendState('h', inputMsg(1, 4));
    vi.advanceTimersByTime(100);
    expect(t.sent[0].payload.msg.payload.buttons).toBe(4);
    r.stop();
  });

  it('zdarzenia idą od razu (bez dławienia)', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    r.sendEvent('h', envelope(MSG.HELLO, 'c1', { epoch: 1 }));
    r.sendEvent('h', envelope(MSG.HELLO, 'c1', { epoch: 2 }));
    expect(t.sent).toHaveLength(2);
    expect(t.sent[0]).toMatchObject({ type: MSG.RELAY, to: 'h', payload: { kind: 'events' } });
  });

  it('stop() porzuca oczekujący stan', () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const r = createRelay(t, 10);
    r.start();
    r.sendState('h', inputMsg(1, 1));
    r.stop();
    vi.advanceTimersByTime(1000);
    expect(t.sent).toHaveLength(0);
  });
});
