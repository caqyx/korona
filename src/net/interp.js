/** Interpolacja widoku między dwoma snapshotami (bufor opóźniony o 100 ms). */

const lerp = (a, b, t) => a + (b - a) * t;

function lerpList(listA, listB, t) {
  if (!listA || !listB) return listB;
  const byId = new Map(listA.map((e) => [e.id, e]));
  return listB.map((e) => {
    const o = byId.get(e.id);
    if (!o) return e;
    const jump = Math.hypot(e.x - o.x, e.y - o.y) > 4; // teleport/odrodzenie — bez rozmazania
    return jump ? e : { ...e, x: lerp(o.x, e.x, t), y: lerp(o.y, e.y, t) };
  });
}

/**
 * @param {any} a starszy snapshot @param {any} b nowszy @param {number} t 0..1
 */
export function interpolateState(a, b, t) {
  if (!a || t >= 1) return b;
  if (t <= 0) t = 0;
  return {
    ...b,
    players: lerpList(a.players, b.players, t),
    projectiles: lerpList(a.projectiles, b.projectiles, t),
    minions: lerpList(a.minions, b.minions, t),
  };
}

/**
 * Bufor snapshotów indeksowany czasem odbioru.
 * @param {number} delayMs
 */
export function createInterpBuffer(delayMs = 100) {
  /** @type {{at:number, state:any}[]} */
  let buf = [];
  return {
    /** @param {any} state @param {number} now */
    push(state, now) {
      if (buf.length && state.tick <= buf[buf.length - 1].state.tick) return false;
      buf.push({ at: now, state });
      if (buf.length > 40) buf = buf.slice(-40);
      return true;
    },
    clear() {
      buf = [];
    },
    latest() {
      return buf.length ? buf[buf.length - 1].state : null;
    },
    /** @param {number} now */
    sample(now) {
      if (!buf.length) return null;
      const target = now - delayMs;
      let i = buf.length - 1;
      while (i > 0 && buf[i - 1].at > target) i--;
      if (i === 0) return buf[0].state;
      const a = buf[i - 1];
      const b = buf[i];
      if (b.at <= target) return b.state;
      const t = (target - a.at) / Math.max(1, b.at - a.at);
      return interpolateState(a.state, b.state, t);
    },
  };
}
