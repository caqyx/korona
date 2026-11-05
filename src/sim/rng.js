/**
 * Seeded RNG (mulberry32). Stan to jedna liczba uint32 trzymana w snapshot,
 * dzięki czemu losowanie przetrwa migrację hosta.
 */

/** @param {number} seed */
export function createRngState(seed) {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

/**
 * Tworzy obiekt RNG operujący na przekazanym stanie (mutuje rngState.s).
 * @param {{s:number}} rngState
 */
export function makeRng(rngState) {
  const next = () => {
    let t = (rngState.s = (rngState.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** @param {number} a @param {number} b */
    range: (a, b) => a + (b - a) * next(),
    /** @param {number} n */
    int: (n) => Math.floor(next() * n),
    /** @template T @param {T[]} arr @returns {T} */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** @typedef {ReturnType<typeof makeRng>} Rng */
