/**
 * Ogranicznik głosów efektów (czysty): minimalny odstęp per dźwięk, limit równoczesnych
 * głosów per dźwięk i globalnie. Czas podawany z zewnątrz (AudioContext.currentTime).
 */
export class VoiceLimiter {
  /** @param {number} [maxTotal] */
  constructor(maxTotal = 32) {
    this.maxTotal = maxTotal;
    /** @type {Map<string, number[]>} końce aktywnych głosów */
    this.active = new Map();
    /** @type {Map<string, number>} */
    this.last = new Map();
  }

  /** Liczba aktywnych głosów (po usunięciu zakończonych). @param {number} now @param {string} [name] */
  count(now, name) {
    let total = 0;
    for (const [k, ends] of this.active) {
      const alive = ends.filter((e) => e > now);
      this.active.set(k, alive);
      if (!name || k === name) total += alive.length;
    }
    return total;
  }

  /**
   * Rezerwuje głos, jeśli pozwalają limity.
   * @param {string} name @param {number} now @param {number} dur
   * @param {{gap?: number, max?: number}} [lim]
   */
  tryStart(name, now, dur, { gap = 0.03, max = 4 } = {}) {
    const last = this.last.get(name);
    if (last !== undefined && now - last < gap && now >= last) return false;
    if (this.count(now, name) >= max) return false;
    if (this.count(now) >= this.maxTotal) return false;
    this.last.set(name, now);
    const ends = this.active.get(name) || [];
    ends.push(now + dur);
    this.active.set(name, ends);
    return true;
  }
}
