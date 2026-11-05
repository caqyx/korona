/**
 * Wybór hosta (GDD 6.4) i migracja (GDD 6.5).
 * Funkcje czyste (ranking, wynik urządzenia, konflikty epoch, warunki migracji planowanej)
 * + pomiar urządzenia w przeglądarce.
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {number} medianMsPerStep
 * @property {number} cores
 * @property {boolean} mobile
 * @property {{charging:boolean, level:number}|null} battery
 * @property {string|null} effectiveType
 * @property {boolean} hidden
 */

/** Wynik urządzenia według wzoru z GDD 6.4. @param {DeviceInfo} d */
export function computeDeviceScore(d) {
  if (d.hidden) return 0;
  const base = 1000 / Math.max(0.001, d.medianMsPerStep);
  const cores = Math.min(Math.max(1, d.cores || 1), 8) / 8;
  let score = base * (0.8 + 0.2 * cores);
  if (d.mobile) score *= 0.6;
  if (d.battery && !d.battery.charging && d.battery.level < 0.3) score *= 0.5;
  if (d.effectiveType === '2g' || d.effectiveType === '3g' || d.effectiveType === 'slow-2g') score *= 0.5;
  return Math.round(score * 100) / 100;
}

/**
 * Sortowanie deterministyczne: deviceScore DESC, joinedAt ASC, userId ASC.
 * @template {{userId:string, deviceScore:number, joinedAt:number}} T @param {T[]} list @returns {T[]}
 */
export function rankPeers(list) {
  return [...list].sort((a, b) => b.deviceScore - a.deviceScore || a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

/** Host = pierwszy, następca = drugi. @param {{userId:string,deviceScore:number,joinedAt:number}[]} list */
export function electHost(list) {
  const r = rankPeers(list);
  return { hostId: r[0]?.userId ?? null, successorId: r[1]?.userId ?? null, ranking: r.map((p) => p.userId) };
}

/**
 * Następca: pierwszy w rankingu z pominięciem wykluczonych (np. starego hosta).
 * @param {{userId:string,deviceScore:number,joinedAt:number}[]} list @param {string[]} exclude
 * @param {string[]} [allowed] tylko uczestnicy meczu
 */
export function successorOf(list, exclude, allowed) {
  const r = rankPeers(list).filter((p) => !exclude.includes(p.userId) && (!allowed || allowed.includes(p.userId)));
  return r[0]?.userId ?? null;
}

/**
 * Rozstrzyganie split-brain: wyższy epoch wygrywa; przy równym — wyższa pozycja w rankingu.
 * @param {{epoch:number, hostId:string}} a @param {{epoch:number, hostId:string}} b @param {string[]} ranking
 * @returns {{epoch:number, hostId:string}} zwycięzca
 */
export function resolveClaim(a, b, ranking) {
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;
  if (a.hostId === b.hostId) return a;
  const ia = ranking.indexOf(a.hostId);
  const ib = ranking.indexOf(b.hostId);
  const ra = ia < 0 ? Infinity : ia;
  const rb = ib < 0 ? Infinity : ib;
  if (ra !== rb) return ra < rb ? a : b;
  return a.hostId < b.hostId ? a : b;
}

export const MIGRATION = Object.freeze({
  snapshotTimeoutMs: 1500,
  hiddenMs: 1000,
  slowStepMs: 12,
  slowWindowMs: 5000,
  resumeCountdown: 3,
  helloWaitMs: 5000,
});

/**
 * Warunki migracji planowanej: karta ukryta > 1 s lub średni krok > 12 ms przez 5 s.
 * @param {{hiddenSince:number|null, now:number, slowSince:number|null}} s
 */
export function shouldPlannedMigrate(s) {
  if (s.hiddenSince !== null && s.now - s.hiddenSince > MIGRATION.hiddenMs) return 'hidden';
  if (s.slowSince !== null && s.now - s.slowSince >= MIGRATION.slowWindowMs) return 'slow';
  return null;
}

/**
 * Monitor średniego czasu kroku (okno kroczące ~1 s). Zwraca czas, od kiedy średnia > 12 ms.
 */
export function createStepMonitor(windowSize = 60) {
  const samples = [];
  let sum = 0;
  let slowSince = /** @type {number|null} */ (null);
  return {
    /** @param {number} ms @param {number} now */
    record(ms, now) {
      samples.push(ms);
      sum += ms;
      if (samples.length > windowSize) sum -= /** @type {number} */ (samples.shift());
      const avg = sum / samples.length;
      if (avg > MIGRATION.slowStepMs) slowSince ??= now;
      else slowSince = null;
      return avg;
    },
    get slowSince() {
      return slowSince;
    },
    get average() {
      return samples.length ? sum / samples.length : 0;
    },
  };
}

/**
 * Wykrywanie utraty hosta: zamknięty DataChannel LUB brak w Presence LUB brak snapshotu > 1500 ms.
 * @param {{lastSnapshotAt:number, now:number, hostInPresence:boolean, channelClosed:boolean}} s
 */
export function hostLost(s) {
  if (!s.hostInPresence) return 'presence';
  if (s.channelClosed) return 'channel';
  if (s.now - s.lastSnapshotAt > MIGRATION.snapshotTimeoutMs) return 'timeout';
  return null;
}

/** Mediana. @param {number[]} xs */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Benchmark: N kroków step() na najcięższym scenariuszu, mediana ms/krok.
 * @param {(state:any)=>void} stepFn @param {()=>any} makeState @param {()=>number} now @param {number} [n]
 */
export function runBenchmark(stepFn, makeState, now, n = 300) {
  const state = makeState();
  const times = [];
  for (let i = 0; i < n; i++) {
    const t0 = now();
    stepFn(state);
    times.push(now() - t0);
  }
  return Math.max(0.001, median(times));
}

/** Pomiar urządzenia w przeglądarce (~1 s). Override `?score=` dla testów. */
export async function measureDevice(stepFn, makeState) {
  const override = Number(new URLSearchParams(location.search).get('score'));
  if (override > 0) return { score: override, medianMsPerStep: 0, info: null };
  let med = runBenchmark(stepFn, makeState, () => performance.now(), 300);
  // timer w przeglądarkach bywa zaokrąglany — mierzymy też blokowo, by uniknąć mediany 0
  if (med < 0.01) {
    const st = makeState();
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) stepFn(st);
    med = Math.max(0.001, (performance.now() - t0) / 300);
  }
  const nav = /** @type {any} */ (navigator);
  let battery = null;
  try {
    if (nav.getBattery) {
      const b = await nav.getBattery();
      battery = { charging: b.charging, level: b.level };
    }
  } catch {
    battery = null;
  }
  const info = {
    medianMsPerStep: med,
    cores: nav.hardwareConcurrency || 2,
    mobile: /Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent) || (nav.userAgentData?.mobile ?? false),
    battery,
    effectiveType: nav.connection?.effectiveType ?? null,
    hidden: document.hidden,
  };
  return { score: computeDeviceScore(info), medianMsPerStep: med, info };
}
