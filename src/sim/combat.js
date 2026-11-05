import { HERO, BOSS_COMMON, BOSSES, SKINS, FEVER } from './config.js';
import { angleDiff } from './vec.js';
import { onBossKilled, onHeroKilled } from './rules.js';

/** @typedef {import('./state.js').MatchState} MatchState */
/** @typedef {import('./state.js').Player} Player */

export const heroRadius = () => HERO.radius;
export const bossRadius = () => HERO.radius * BOSS_COMMON.radiusMul;
/** @param {Player} p */
export const radiusOf = (p) => (p.boss ? bossRadius() : HERO.radius);

/** Mnożnik gorączki korony dla czasu panowania. @param {number} reign */
export function feverMultiplier(reign) {
  if (reign < FEVER.startAfter) return 1;
  const steps = 1 + Math.floor((reign - FEVER.startAfter) / FEVER.every);
  return 1 + Math.min(FEVER.max, steps * FEVER.step);
}

/** Czy cel może otrzymać obrażenia jako bohater. @param {Player} h */
export const heroVulnerable = (h) => h.alive && !h.boss && h.invulnT <= 0 && h.dashT <= 0 && h.connected;

/**
 * Czy tarcza Rycerza blokuje atak nadchodzący z punktu (fromX, fromY).
 * @param {Player} h
 */
export function shieldBlocks(h, fromX, fromY) {
  if (h.skin !== 'rycerz' || h.abilT <= 0) return false;
  const a = Math.atan2(fromY - h.y, fromX - h.x);
  const f = Math.atan2(h.fy, h.fx);
  return Math.abs(angleDiff(a, f)) <= ((SKINS.rycerz.ability.arc / 2) * Math.PI) / 180;
}

/**
 * Zadaje obrażenia bohaterowi. Zwraca true, jeśli trafienie przeszło.
 * @param {MatchState} state @param {Player} h @param {number} dmg
 * @param {string|null} sourceId id gracza-bossa (lub właściciela miniona)
 */
export function hurtHero(state, h, dmg, sourceId, fromX, fromY) {
  if (!heroVulnerable(h)) return false;
  if (shieldBlocks(h, fromX, fromY)) {
    state.events.push({ t: 'block', id: h.id, x: h.x, y: h.y });
    return false;
  }
  h.hp -= dmg;
  state.events.push({ t: 'heroHit', id: h.id, x: h.x, y: h.y, src: sourceId });
  const src = sourceId ? state.players.find((p) => p.id === sourceId) : null;
  if (src && src.boss) {
    src.boss.invisT = 0; // zadanie obrażeń przerywa Zasłonę
    if (src.boss.type === 'burza') countOverloadHit(src);
    if (src.boss.type === 'szron' && h.hp > dmg - 1) {
      // pasywka Szronu: wychłodzenie
      h.slowT = Math.max(h.slowT, BOSSES.szron.passive.duration);
      h.slowMul = 1 - BOSSES.szron.passive.slow;
    }
  }
  if (h.hp <= 0) onHeroKilled(state, h, sourceId);
  return true;
}

/** @param {Player} bossP */
function countOverloadHit(bossP) {
  const b = /** @type {import('./state.js').BossState} */ (bossP.boss);
  b.hits += 1;
  if (b.hits >= BOSSES.burza.overloadHits) {
    b.hits = 0;
    b.overloaded = true;
  }
}

/**
 * Zadaje obrażenia bossowi, uwzględnia pasywkę i gorączkę.
 * @param {MatchState} state @param {Player} bossP @param {number} dmg @param {string} attackerId
 */
export function hurtBoss(state, bossP, dmg, attackerId) {
  const b = bossP.boss;
  if (!b || b.dying || state.phase !== 'playing') return false;
  const def = BOSSES[/** @type {keyof typeof BOSSES} */ (b.type)];
  const amount = dmg * def.dmgTakenMul * feverMultiplier(b.reign);
  b.hp = Math.max(0, b.hp - amount);
  const attacker = state.players.find((p) => p.id === attackerId);
  if (attacker && !attacker.boss) attacker.dmgToBoss += amount;
  state.events.push({ t: 'bossHit', id: bossP.id, by: attackerId, x: bossP.x, y: bossP.y, dmg: Math.round(amount * 10) / 10 });
  if (b.hp <= 0) onBossKilled(state, bossP, attackerId);
  return true;
}

/** Czy punkt (tx,ty) o promieniu tr jest w stożku. arcDeg = pełny kąt. */
export function inCone(ox, oy, ang, range, arcDeg, tx, ty, tr) {
  const d = Math.hypot(tx - ox, ty - oy);
  if (d > range + tr) return false;
  if (d < tr) return true;
  const a = Math.atan2(ty - oy, tx - ox);
  const half = (arcDeg / 2) * (Math.PI / 180);
  const slack = Math.asin(Math.min(1, tr / Math.max(d, 1e-6)));
  return Math.abs(angleDiff(a, ang)) <= half + slack;
}

/**
 * Atak wręcz bohatera: trafia bossa i miniony w stożku.
 * @param {MatchState} state @param {Player} h @param {number} dmg @param {number} range @param {number} arc
 */
export function heroMelee(state, h, dmg, range, arc) {
  const ang = Math.atan2(h.fy, h.fx);
  let hit = false;
  const bossP = state.players.find((p) => p.boss && !p.boss.dying);
  if (bossP && inCone(h.x, h.y, ang, range, arc, bossP.x, bossP.y, bossRadius())) {
    hurtBoss(state, bossP, dmg, h.id);
    hit = true;
  }
  for (const m of state.minions) {
    if (m.hp > 0 && inCone(h.x, h.y, ang, range, arc, m.x, m.y, m.r)) {
      damageMinion(state, m, dmg);
      hit = true;
    }
  }
  state.events.push({ t: 'swing', id: h.id, x: h.x, y: h.y, a: ang, range, arc, hit });
  return hit;
}

/** @param {MatchState} state @param {any} m @param {number} dmg */
export function damageMinion(state, m, dmg) {
  m.hp -= dmg;
  if (m.hp <= 0) state.events.push({ t: 'minionDie', x: m.x, y: m.y });
}
