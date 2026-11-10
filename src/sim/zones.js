import { distToSegment, angleDiff, mergeKept } from './vec.js';
import { HERO } from './config.js';
import { nextId } from './state.js';
import { hurtHero, hurtBoss, damageMinion, bossRadius, sameTeam, canHitMinion, heroesHostile } from './combat.js';

/**
 * Strefa z telegrafem. Najpierw `warn` sekund ostrzeżenia (czerwony kształt, brak efektu),
 * potem `life` sekund aktywności.
 * shape: 'circle' | 'ring' | 'arc' | 'line'
 * @typedef {Object} Zone
 * @property {number} id
 * @property {string} kind
 * @property {string} shape
 * @property {string|null} ownerId
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {number} ang
 * @property {number} arc  pełny kąt (rad) dla 'arc'
 * @property {number} len
 * @property {number} w
 * @property {number} warn
 * @property {number} warnTotal
 * @property {number} life
 * @property {number} lifeTotal
 * @property {number} dmg
 * @property {number} tick    0 = jednorazowo na cel
 * @property {number} tickT
 * @property {number} slow
 * @property {number} knock
 * @property {number} stun
 * @property {number} rMax    dla 'ring'
 * @property {string[]} hit
 * @property {number} born    tick utworzenia (telegraf nie skraca się w kroku utworzenia)
 */

/** @param {import('./state.js').MatchState} state @param {Partial<Zone>} z @returns {Zone} */
export function addZone(state, z) {
  const zone = /** @type {Zone} */ ({
    id: nextId(state),
    kind: 'zone',
    shape: 'circle',
    ownerId: null,
    x: 0,
    y: 0,
    r: 1,
    ang: 0,
    arc: Math.PI,
    len: 0,
    w: 0.5,
    warn: 0.5,
    life: 0.05,
    dmg: 0,
    tick: 0,
    tickT: 0,
    slow: 0,
    knock: 0,
    stun: 0,
    rMax: 0,
    hit: [],
    ...z,
  });
  zone.born = state.tick;
  zone.warnTotal = zone.warn;
  zone.lifeTotal = zone.life;
  state.zones.push(zone);
  return zone;
}

/** Bieżący promień pierścienia. @param {Zone} z */
export function ringRadius(z) {
  const p = z.lifeTotal > 0 ? 1 - z.life / z.lifeTotal : 1;
  return z.r + (z.rMax - z.r) * p;
}

/** @param {Zone} z @param {number} px @param {number} py @param {number} pr */
export function zoneContains(z, px, py, pr) {
  const d = Math.hypot(px - z.x, py - z.y);
  switch (z.shape) {
    case 'circle':
      return d <= z.r + pr;
    case 'ring': {
      const rr = ringRadius(z);
      return Math.abs(d - rr) <= z.w / 2 + pr;
    }
    case 'arc': {
      if (d > z.r + pr) return false;
      if (d < pr) return true;
      const a = Math.atan2(py - z.y, px - z.x);
      return Math.abs(angleDiff(a, z.ang)) <= z.arc / 2 + Math.asin(Math.min(1, pr / d));
    }
    case 'line': {
      const ex = z.x + Math.cos(z.ang) * z.len;
      const ey = z.y + Math.sin(z.ang) * z.len;
      return distToSegment(px, py, z.x, z.y, ex, ey) <= z.w / 2 + pr;
    }
    default:
      return false;
  }
}

/** @param {import('./state.js').MatchState} state @param {number} dt */
export function updateZones(state, dt) {
  const keep = [];
  const before = state.zones;
  for (const z of before) {
    // lista podmieniona w trakcie pętli (strefa dobiła bossa — jego strefy wyczyszczone): pomijamy usunięte
    if (state.zones !== before && !state.zones.includes(z)) continue;
    if (z.warn > 0) {
      if (z.born !== state.tick) z.warn -= dt;
      if (z.warn <= 1e-9) {
        z.warn = 0;
        if (z.dmg > 0 || z.slow > 0 || z.knock > 0) state.events.push({ t: 'zoneFire', kind: z.kind, x: z.x, y: z.y, r: z.r });
      } else {
        keep.push(z);
        continue;
      }
    }
    applyZone(state, z, dt);
    z.life -= dt;
    if (z.life > 0) keep.push(z);
  }
  state.zones = mergeKept(before, state.zones, keep);
}

/** @param {import('./state.js').MatchState} state @param {Zone} z @param {number} dt */
function applyZone(state, z, dt) {
  if (z.dmg <= 0 && z.slow <= 0 && z.knock <= 0) return;
  let tickNow = false;
  if (z.tick > 0) {
    z.tickT -= dt;
    if (z.tickT <= 0) {
      z.tickT += z.tick;
      tickNow = true;
    }
  }
  if (z.team === 'hero') return applyHeroZone(state, z, tickNow);
  const owner = z.ownerId ? state.players.find((p) => p.id === z.ownerId) : null;
  for (const h of state.players) {
    if (h.boss || !h.alive) continue;
    if (owner && sameTeam(owner, h)) continue;
    if (!zoneContains(z, h.x, h.y, HERO.radius)) continue;
    if (z.slow > 0) {
      h.slowT = 0.2;
      h.slowMul = 1 - z.slow;
    }
    if (z.dmg <= 0) {
      // strefa tylko odpychająca (np. Strach Widma)
      if (z.knock > 0 && !z.hit.includes(h.id) && h.invulnT <= 0 && h.dashT <= 0) {
        z.hit.push(h.id);
        applyKnock(h, z);
      }
      continue;
    }
    if (z.tick > 0) {
      if (tickNow) hurtHero(state, h, z.dmg, z.ownerId, z.x, z.y);
    } else if (!z.hit.includes(h.id)) {
      if (hurtHero(state, h, z.dmg, z.ownerId, z.x, z.y)) {
        z.hit.push(h.id);
        applyKnock(h, z);
      }
    }
  }
}

/** @param {import('./state.js').Player} h @param {Zone} z */
function applyKnock(h, z) {
  if (z.knock > 0) {
    const dx = h.x - z.x;
    const dy = h.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    h.kx += (dx / d) * z.knock;
    h.ky += (dy / d) * z.knock;
  }
  if (z.stun > 0) h.stunT = Math.max(h.stunT, z.stun);
}

/** Strefa umiejętności bohatera (Meteor, Korzenie): rani bossa i miniony, spowalnia bossa. */
function applyHeroZone(state, z, tickNow) {
  const once = z.tick <= 0;
  const owner = state.players.find((p) => p.id === z.ownerId) || { team: undefined };
  for (const bossP of state.players) {
    if (!bossP.boss || bossP.boss.dying || sameTeam(bossP, owner) || bossP.id === z.ownerId) continue;
    if (!zoneContains(z, bossP.x, bossP.y, bossRadius())) continue;
    if (z.slow > 0) {
      bossP.slowT = Math.max(bossP.slowT, 0.2);
      bossP.slowMul = 1 - z.slow;
    }
    if (z.dmg > 0 && (once ? !z.hit.includes(bossP.id) : tickNow)) {
      if (once) z.hit.push(bossP.id);
      hurtBoss(state, bossP, z.dmg, z.ownerId || '');
    }
  }
  for (const m of state.minions) {
    if (m.hp <= 0 || !canHitMinion(state, owner, m) || !zoneContains(z, m.x, m.y, m.r)) continue;
    if (z.slow > 0) m.rootT = 0.2;
    if (z.dmg > 0 && (once ? !z.hit.includes(m.id) : tickNow)) {
      if (once) z.hit.push(m.id);
      damageMinion(state, m, z.dmg, z.ownerId);
    }
  }
  // drużyny: wrodzy bohaterowie — spowolnienie i 1 dmg raz na strefę
  for (const h of state.players) {
    if (h.boss || !h.alive || !heroesHostile(owner, h) || !zoneContains(z, h.x, h.y, HERO.radius)) continue;
    if (z.slow > 0) {
      h.slowT = Math.max(h.slowT, 0.2);
      h.slowMul = 1 - z.slow;
    }
    if (z.dmg > 0 && !z.hit.includes(h.id) && hurtHero(state, h, 1, z.ownerId, z.x, z.y)) z.hit.push(h.id);
  }
}
