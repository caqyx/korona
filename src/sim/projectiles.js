import { PROJECTILE_MAX, HERO } from './config.js';
import { nextId } from './state.js';
import { hitsPillar, outsideArena } from './physics.js';
import { bossRadius, hurtBoss, hurtHero, damageMinion, shieldBlocks, sameTeam, canHitMinion, heroesHostile } from './combat.js';
import { SKINS } from './config.js';

/**
 * @typedef {Object} Projectile
 * @property {number} id
 * @property {'hero'|'boss'} team
 * @property {string} ownerId
 * @property {string} kind
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} r
 * @property {number} range
 * @property {number} traveled
 * @property {number} dmg
 * @property {boolean} pierce
 * @property {(string|number)[]} hit
 * @property {number} [stun]       ogłuszenie przy trafieniu (Sieć)
 * @property {boolean} [boomerang] wraca do właściciela po połowie zasięgu (Kosa)
 * @property {boolean} [back]
 */

/** @param {import('./state.js').MatchState} state @param {Partial<Projectile>} p */
export function spawnProjectile(state, p) {
  if (state.projectiles.length >= PROJECTILE_MAX) return null;
  const pr = /** @type {Projectile} */ ({ id: nextId(state), team: 'hero', kind: 'bolt', r: 0.2, range: 8, traveled: 0, dmg: 1, pierce: false, hit: [], vx: 0, vy: 0, x: 0, y: 0, ownerId: '', ...p });
  state.projectiles.push(pr);
  return pr;
}

/** @param {import('./state.js').MatchState} state @param {number} dt */
export function updateProjectiles(state, dt) {
  const keep = [];
  const bosses = state.players.filter((p) => p.boss && !p.boss.dying);
  for (const pr of state.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.traveled += Math.hypot(pr.vx, pr.vy) * dt;
    if (pr.boomerang && steerBack(state, pr)) continue;
    if (pr.traveled > pr.range || outsideArena(pr.x, pr.y, 0)) continue;
    if (!pr.pierce && hitsPillar(pr.x, pr.y, pr.r)) continue;
    const owner = state.players.find((p) => p.id === pr.ownerId) || null;
    const alive = pr.team === 'hero' ? heroProjectileHits(state, pr, bosses, owner) : bossProjectileHits(state, pr, bosses, owner);
    if (alive) keep.push(pr);
  }
  state.projectiles = keep;
}

/** @returns {boolean} czy pocisk leci dalej */
function heroProjectileHits(state, pr, bosses, owner) {
  for (const bossP of bosses) {
    if (owner && (owner === bossP || sameTeam(owner, bossP))) continue;
    if (pr.hit.includes(bossP.id) || Math.hypot(pr.x - bossP.x, pr.y - bossP.y) > bossRadius() + pr.r) continue;
    hurtBoss(state, bossP, pr.dmg, pr.ownerId);
    if (!pr.pierce) return false;
    pr.hit.push(bossP.id);
  }
  for (const m of state.minions) {
    if (m.hp <= 0 || pr.hit.includes(m.id) || (owner && !canHitMinion(state, owner, m))) continue;
    if (Math.hypot(pr.x - m.x, pr.y - m.y) <= m.r + pr.r) {
      damageMinion(state, m, pr.dmg, pr.ownerId);
      if (!pr.pierce) return false;
      pr.hit.push(m.id);
    }
  }
  if (owner) {
    // drużyny: pocisk bohatera trafia wrogiego bohatera (1 dmg)
    for (const o of state.players) {
      if (o === owner || o.boss || !o.alive || pr.hit.includes(o.id) || !heroesHostile(owner, o)) continue;
      if (Math.hypot(pr.x - o.x, pr.y - o.y) > HERO.radius + pr.r) continue;
      if (hurtHero(state, o, 1, owner.id, pr.x - pr.vx, pr.y - pr.vy)) {
        if (!pr.pierce) return false;
        pr.hit.push(o.id);
      }
    }
  }
  return true;
}

/** @returns {boolean} */
function bossProjectileHits(state, pr, bosses, owner) {
  for (const h of state.players) {
    if (h.boss || !h.alive) continue;
    if (owner && sameTeam(owner, h)) continue;
    if (Math.hypot(pr.x - h.x, pr.y - h.y) > HERO.radius + pr.r) continue;
    const target = owner?.boss ? owner : bosses.find((b) => !sameTeam(b, h));
    if (shieldBlocks(h, pr.x - pr.vx, pr.y - pr.vy) && target) {
      reflect(state, pr, h, target);
      return true;
    }
    if (pr.hit.includes(h.id)) continue;
    if (hurtHero(state, h, pr.dmg, pr.ownerId, pr.x - pr.vx, pr.y - pr.vy)) {
      if (pr.stun) h.stunT = Math.max(h.stunT, pr.stun);
      if (!pr.pierce) return false;
      pr.hit.push(h.id);
    }
  }
  return true;
}

/** Tarcza Rycerza odbija pocisk w bossa. */
function reflect(state, pr, knight, bossP) {
  const dx = bossP.x - pr.x;
  const dy = bossP.y - pr.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = Math.max(12, Math.hypot(pr.vx, pr.vy));
  pr.team = 'hero';
  pr.ownerId = knight.id;
  pr.vx = (dx / d) * sp;
  pr.vy = (dy / d) * sp;
  pr.dmg = SKINS.rycerz.ability.reflectDmg;
  pr.traveled = 0;
  pr.range = d + 4;
  pr.kind = 'reflected';
  pr.hit = [];
  state.events.push({ t: 'reflect', id: knight.id, x: pr.x, y: pr.y });
}
/** Bumerang: po połowie zasięgu zawraca do właściciela. Zwraca true, gdy wrócił. */
function steerBack(state, pr) {
  if (!pr.back && pr.traveled >= pr.range / 2) {
    pr.back = true;
    pr.hit = [];
  }
  if (!pr.back) return false;
  const owner = state.players.find((p) => p.id === pr.ownerId && p.boss);
  if (!owner) return true;
  const dx = owner.x - pr.x;
  const dy = owner.y - pr.y;
  const d = Math.hypot(dx, dy);
  if (d < bossRadius()) return true;
  const sp = Math.hypot(pr.vx, pr.vy);
  pr.vx = (dx / d) * sp;
  pr.vy = (dy / d) * sp;
  pr.traveled = Math.min(pr.traveled, pr.range - 0.01);
  return false;
}
