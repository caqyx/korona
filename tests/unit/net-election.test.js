import { describe, it, expect } from 'vitest';
import {
  computeDeviceScore,
  rankPeers,
  electHost,
  successorOf,
  resolveClaim,
  shouldPlannedMigrate,
  createStepMonitor,
  hostLost,
  runBenchmark,
  median,
  MIGRATION,
} from '../../src/net/election.js';

const dev = (o = {}) => ({ medianMsPerStep: 2, cores: 8, mobile: false, battery: null, effectiveType: '4g', hidden: false, ...o });
const peer = (userId, deviceScore, joinedAt) => ({ userId, deviceScore, joinedAt });

describe('computeDeviceScore (GDD 6.4)', () => {
  it('base * (0.8 + 0.2 * cores/8)', () => {
    // 1000/2 = 500; 8 rdzeni -> 500 * 1.0
    expect(computeDeviceScore(dev())).toBe(500);
    // 4 rdzenie -> 500 * 0.9
    expect(computeDeviceScore(dev({ cores: 4 }))).toBe(450);
    // 1 rdzeń -> 500 * (0.8 + 0.025)
    expect(computeDeviceScore(dev({ cores: 1 }))).toBe(412.5);
  });
  it('rdzenie ograniczone do 8', () => {
    expect(computeDeviceScore(dev({ cores: 64 }))).toBe(computeDeviceScore(dev({ cores: 8 })));
    expect(computeDeviceScore(dev({ cores: 16 }))).toBe(500);
  });
  it('mobile x0.6', () => {
    expect(computeDeviceScore(dev({ mobile: true }))).toBe(300);
  });
  it('bateria < 30% bez ładowania x0.5; ładowanie lub >= 30% bez kary', () => {
    expect(computeDeviceScore(dev({ battery: { charging: false, level: 0.2 } }))).toBe(250);
    expect(computeDeviceScore(dev({ battery: { charging: true, level: 0.2 } }))).toBe(500);
    expect(computeDeviceScore(dev({ battery: { charging: false, level: 0.3 } }))).toBe(500);
    expect(computeDeviceScore(dev({ battery: null }))).toBe(500);
  });
  it('2g/3g x0.5, 4g bez kary', () => {
    expect(computeDeviceScore(dev({ effectiveType: '2g' }))).toBe(250);
    expect(computeDeviceScore(dev({ effectiveType: '3g' }))).toBe(250);
    expect(computeDeviceScore(dev({ effectiveType: '4g' }))).toBe(500);
    expect(computeDeviceScore(dev({ effectiveType: null }))).toBe(500);
  });
  it('kary się mnożą', () => {
    // 500 * 0.6 * 0.5 * 0.5
    expect(computeDeviceScore(dev({ mobile: true, battery: { charging: false, level: 0.1 }, effectiveType: '3g' }))).toBe(75);
  });
  it('ukryta karta -> 0', () => {
    expect(computeDeviceScore(dev({ hidden: true }))).toBe(0);
    expect(computeDeviceScore(dev({ hidden: true, medianMsPerStep: 0.01 }))).toBe(0);
  });
  it('szybsze urządzenie ma wyższy wynik; mediana 0 nie daje Infinity', () => {
    expect(computeDeviceScore(dev({ medianMsPerStep: 1 }))).toBeGreaterThan(computeDeviceScore(dev({ medianMsPerStep: 4 })));
    expect(Number.isFinite(computeDeviceScore(dev({ medianMsPerStep: 0 })))).toBe(true);
  });
});

describe('rankPeers / electHost', () => {
  it('deviceScore DESC', () => {
    const r = rankPeers([peer('a', 100, 1), peer('b', 300, 2), peer('c', 200, 3)]);
    expect(r.map((p) => p.userId)).toEqual(['b', 'c', 'a']);
  });
  it('remis wyniku -> joinedAt ASC', () => {
    const r = rankPeers([peer('a', 100, 30), peer('b', 100, 10), peer('c', 100, 20)]);
    expect(r.map((p) => p.userId)).toEqual(['b', 'c', 'a']);
  });
  it('remis wyniku i joinedAt -> userId ASC', () => {
    const r = rankPeers([peer('zed', 100, 5), peer('alf', 100, 5), peer('mid', 100, 5)]);
    expect(r.map((p) => p.userId)).toEqual(['alf', 'mid', 'zed']);
  });
  it('kolejność wejścia nie zmienia wyniku (deterministycznie u wszystkich)', () => {
    const list = [peer('a', 50, 3), peer('b', 100, 2), peer('c', 100, 1), peer('d', 100, 1), peer('e', 0, 0)];
    const expected = ['c', 'd', 'b', 'a', 'e'];
    for (let i = 0; i < list.length; i++) {
      const rotated = [...list.slice(i), ...list.slice(0, i)];
      expect(rankPeers(rotated).map((p) => p.userId)).toEqual(expected);
      expect(rankPeers(rotated.reverse()).map((p) => p.userId)).toEqual(expected);
    }
  });
  it('nie mutuje wejścia', () => {
    const list = [peer('a', 1, 1), peer('b', 2, 2)];
    rankPeers(list);
    expect(list.map((p) => p.userId)).toEqual(['a', 'b']);
  });
  it('electHost: host = 1., następca = 2.', () => {
    const e = electHost([peer('a', 100, 1), peer('b', 300, 2), peer('c', 200, 3)]);
    expect(e).toEqual({ hostId: 'b', successorId: 'c', ranking: ['b', 'c', 'a'] });
  });
  it('electHost: 1 gracz i pusta lista', () => {
    expect(electHost([peer('a', 1, 1)])).toEqual({ hostId: 'a', successorId: null, ranking: ['a'] });
    expect(electHost([])).toEqual({ hostId: null, successorId: null, ranking: [] });
  });
});

describe('successorOf', () => {
  const list = [peer('h', 500, 1), peer('s', 400, 2), peer('t', 300, 3), peer('u', 200, 4)];
  it('pomija wykluczonych', () => {
    expect(successorOf(list, ['h'])).toBe('s');
    expect(successorOf(list, ['h', 's'])).toBe('t');
    expect(successorOf(list, [])).toBe('h');
  });
  it('lista dozwolonych (tylko uczestnicy meczu)', () => {
    expect(successorOf(list, ['h'], ['t', 'u'])).toBe('t');
    expect(successorOf(list, ['h', 't'], ['t', 'u'])).toBe('u');
    expect(successorOf(list, ['h'], [])).toBeNull();
  });
  it('null gdy nikt nie zostaje', () => {
    expect(successorOf(list, ['h', 's', 't', 'u'])).toBeNull();
    expect(successorOf([], [])).toBeNull();
  });
});

describe('resolveClaim (split-brain)', () => {
  const ranking = ['a', 'b', 'c'];
  it('wyższy epoch wygrywa niezależnie od rankingu', () => {
    const a = { epoch: 2, hostId: 'c' };
    const b = { epoch: 1, hostId: 'a' };
    expect(resolveClaim(a, b, ranking)).toBe(a);
    expect(resolveClaim(b, a, ranking)).toBe(a);
  });
  it('równy epoch -> lepsza pozycja w rankingu', () => {
    const a = { epoch: 3, hostId: 'b' };
    const b = { epoch: 3, hostId: 'a' };
    expect(resolveClaim(a, b, ranking)).toBe(b);
    expect(resolveClaim(b, a, ranking)).toBe(b);
  });
  it('nieznany host przegrywa ze znanym', () => {
    const known = { epoch: 3, hostId: 'c' };
    const unknown = { epoch: 3, hostId: 'zzz' };
    expect(resolveClaim(known, unknown, ranking)).toBe(known);
    expect(resolveClaim(unknown, known, ranking)).toBe(known);
  });
  it('dwóch nieznanych -> deterministycznie po userId', () => {
    const x = { epoch: 1, hostId: 'x1' };
    const y = { epoch: 1, hostId: 'y1' };
    expect(resolveClaim(x, y, ranking)).toBe(x);
    expect(resolveClaim(y, x, ranking)).toBe(x);
  });
  it('ten sam host i epoch -> pierwszy (bez zmiany)', () => {
    const a = { epoch: 2, hostId: 'a' };
    const b = { epoch: 2, hostId: 'a' };
    expect(resolveClaim(a, b, ranking)).toBe(a);
  });
});

describe('shouldPlannedMigrate', () => {
  it('ukryta karta > 1 s', () => {
    expect(shouldPlannedMigrate({ hiddenSince: 0, now: 1000, slowSince: null })).toBeNull();
    expect(shouldPlannedMigrate({ hiddenSince: 0, now: 1001, slowSince: null })).toBe('hidden');
    expect(shouldPlannedMigrate({ hiddenSince: null, now: 1e9, slowSince: null })).toBeNull();
  });
  it('wolny krok przez >= 5 s', () => {
    expect(shouldPlannedMigrate({ hiddenSince: null, now: 4999, slowSince: 0 })).toBeNull();
    expect(shouldPlannedMigrate({ hiddenSince: null, now: 5000, slowSince: 0 })).toBe('slow');
  });
  it('ukryta ma pierwszeństwo', () => {
    expect(shouldPlannedMigrate({ hiddenSince: 0, now: 6000, slowSince: 0 })).toBe('hidden');
  });
  it('stałe z GDD', () => {
    expect(MIGRATION.hiddenMs).toBe(1000);
    expect(MIGRATION.slowStepMs).toBe(12);
    expect(MIGRATION.slowWindowMs).toBe(5000);
    expect(MIGRATION.snapshotTimeoutMs).toBe(1500);
  });
});

describe('createStepMonitor', () => {
  it('slowSince ustawione gdy średnia > 12 ms, nie przesuwa się dalej, reset gdy szybko', () => {
    const m = createStepMonitor(4);
    for (let i = 0; i < 4; i++) m.record(5, i);
    expect(m.slowSince).toBeNull();
    expect(m.average).toBe(5);
    m.record(30, 100); // (5+5+5+30)/4 = 11.25
    expect(m.slowSince).toBeNull();
    m.record(30, 200); // (5+5+30+30)/4 = 17.5
    expect(m.slowSince).toBe(200);
    m.record(30, 300);
    expect(m.slowSince).toBe(200);
    for (let i = 0; i < 4; i++) m.record(1, 400 + i);
    expect(m.slowSince).toBeNull();
    expect(m.average).toBe(1);
  });
  it('dokładnie 12 ms nie jest "wolne"', () => {
    const m = createStepMonitor(2);
    m.record(12, 0);
    m.record(12, 1);
    expect(m.slowSince).toBeNull();
  });
  it('okno kroczące ogranicza próbki', () => {
    const m = createStepMonitor(3);
    for (const x of [100, 100, 100, 1, 1, 1]) m.record(x, 0);
    expect(m.average).toBe(1);
    expect(createStepMonitor().average).toBe(0);
  });
  it('w połączeniu z shouldPlannedMigrate: 5 s wolnych kroków -> slow', () => {
    const m = createStepMonitor(60);
    let t = 0;
    for (; t <= 6000; t += 16) m.record(20, t);
    expect(shouldPlannedMigrate({ hiddenSince: null, now: t, slowSince: m.slowSince })).toBe('slow');
  });
});

describe('hostLost', () => {
  const base = { lastSnapshotAt: 0, now: 100, hostInPresence: true, channelClosed: false };
  it('wszystko ok -> null', () => {
    expect(hostLost(base)).toBeNull();
    expect(hostLost({ ...base, now: 1500 })).toBeNull();
  });
  it('brak w Presence', () => {
    expect(hostLost({ ...base, hostInPresence: false })).toBe('presence');
  });
  it('zamknięty kanał', () => {
    expect(hostLost({ ...base, channelClosed: true })).toBe('channel');
  });
  it('brak snapshotu > 1500 ms', () => {
    expect(hostLost({ ...base, now: 1501 })).toBe('timeout');
  });
  it('priorytet: presence > channel > timeout', () => {
    expect(hostLost({ lastSnapshotAt: 0, now: 5000, hostInPresence: false, channelClosed: true })).toBe('presence');
    expect(hostLost({ lastSnapshotAt: 0, now: 5000, hostInPresence: true, channelClosed: true })).toBe('channel');
  });
});

describe('runBenchmark / median', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5])).toBe(5);
  });
  it('mediana czasu kroku z fałszywym zegarem', () => {
    let clock = 0;
    const durations = [1, 9, 2, 2, 100];
    let i = 0;
    const now = () => clock;
    const stepFn = () => {
      clock += durations[i++ % durations.length];
    };
    let made = 0;
    const res = runBenchmark(stepFn, () => (made++, {}), now, 5);
    expect(res).toBe(2);
    expect(made).toBe(1);
    expect(i).toBe(5);
  });
  it('domyślnie 300 kroków, ten sam stan przekazywany do step', () => {
    let clock = 0;
    const seen = new Set();
    let n = 0;
    const state = { id: 1 };
    const res = runBenchmark((s) => {
      seen.add(s);
      n++;
      clock += 3;
    }, () => state, () => clock);
    expect(n).toBe(300);
    expect([...seen]).toEqual([state]);
    expect(res).toBe(3);
  });
  it('zerowy czas -> minimum 0.001', () => {
    expect(runBenchmark(() => {}, () => ({}), () => 0, 10)).toBe(0.001);
  });
});
