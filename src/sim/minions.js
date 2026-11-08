/**
 * Miniony: szkielety i pajęczaki (wręcz), łucznicy (strzał z telegrafem linii) i osiłki
 * (uderzenie obszarowe z telegrafem). Każdy atak ma telegraf — zgodnie z filarem 2 GDD.
 */
import { HERO, BOSSES, MINIONS } from './config.js';
import { addZone } from './zones.js';
import { resolveStatic } from './physics.js';
import { spawnProjectile } from './projectiles.js';
import { nextId } from './state.js';
import { sameTeam } from './combat.js';

const RAD = Math.PI / 180;
const NECRO = BOSSES.nekromanta.q;

/** Najbliższy cel-bohater (ukryci w krzakach widoczni tylko z bliska). */
function target(state, m) {
  let best = null;
  let bd = Infinity;
  const owner = m.ownerId ? state.players.find((p) => p.id === m.ownerId) : null;
  for (const h of state.players) {
    if (h.boss || !h.alive || !h.connected || h.ai) continue;
    if (owner && sameTeam(owner, h)) continue;
    const d = Math.hypot(h.x - m.x, h.y - m.y);
    if (h.hidden && d > 2.5) continue;
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}

/**
 * Tworzy miniona fali. @param {any} state @param {string} kind @param {number} x @param {number} y @param {number} hpMul
 */
export function spawnWaveMinion(state, kind, x, y, hpMul = 1) {
  const c = MINIONS[/** @type {keyof typeof MINIONS} */ (kind)];
  const hp = Math.round(c.hp * hpMul);
  const m = { id: nextId(state), kind, ownerId: null, x, y, hp, maxHp: hp, r: c.radius, cd: 1.0, windup: 0, fx: 1, fy: 0, speed: c.speed, atkRange: c.atkRange, atkTelegraph: c.atkTelegraph, atkCd: c.atkCd, shot: null };
  state.minions.push(m);
  return m;
}

/** @param {any} state @param {number} dt */
export function updateMinions(state, dt) {
  state.minions = state.minions.filter((m) => m.hp > 0);
  for (const m of state.minions) {
    m.cd -= dt;
    if (m.rootT > 0) m.rootT -= dt;
    if (m.windup > 0) {
      m.windup -= dt;
      if (m.windup <= 0 && m.shot) fireShot(state, m);
      continue;
    }
    const h = target(state, m);
    if (!h) continue;
    const dx = h.x - m.x;
    const dy = h.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    m.fx = dx / d;
    m.fy = dy / d;
    if (m.kind === 'archer') archer(state, m, d, dt);
    else melee(state, m, d, dx, dy, dt);
  }
}

function step(m, dir, dt) {
  if (m.rootT > 0) return;
  m.x += m.fx * dir * (m.speed ?? NECRO.speed) * dt;
  m.y += m.fy * dir * (m.speed ?? NECRO.speed) * dt;
  resolveStatic(m, m.r);
}

function melee(state, m, d, dx, dy, dt) {
  const atkRange = m.atkRange ?? NECRO.atkRange;
  const tel = m.atkTelegraph ?? NECRO.atkTelegraph;
  if (d > atkRange + HERO.radius + m.r) return step(m, 1, dt);
  if (m.cd > 0) return;
  if (m.kind === 'brute') {
    addZone(state, { kind: 'bruteSlam', shape: 'circle', ownerId: m.ownerId, x: m.x + m.fx * 0.6, y: m.y + m.fy * 0.6, r: MINIONS.brute.slamRadius, warn: tel, life: 0.08, dmg: 1, knock: 5 });
  } else {
    addZone(state, { kind: 'minionMelee', shape: 'arc', ownerId: m.ownerId, x: m.x, y: m.y, r: atkRange + m.r + 0.3, ang: Math.atan2(dy, dx), arc: 100 * RAD, warn: tel, life: 0.06, dmg: 1 });
  }
  m.windup = tel;
  m.cd = m.atkCd ?? NECRO.atkCd;
}

function archer(state, m, d, dt) {
  const c = MINIONS.archer;
  if (d > c.atkRange) step(m, 1, dt);
  else if (d < c.keep - 1) step(m, -0.8, dt);
  if (m.cd > 0 || d > c.atkRange + 0.5) return;
  const ang = Math.atan2(m.fy, m.fx);
  addZone(state, { kind: 'aimLine', shape: 'line', ownerId: m.ownerId, x: m.x, y: m.y, ang, len: c.atkRange, w: 0.4, warn: c.atkTelegraph, life: 0, dmg: 0 });
  m.shot = { ang };
  m.windup = c.atkTelegraph;
  m.cd = c.atkCd;
}

function fireShot(state, m) {
  const c = MINIONS.archer;
  const a = m.shot.ang;
  m.shot = null;
  spawnProjectile(state, { team: 'boss', ownerId: m.ownerId || '', kind: 'bonearrow', x: m.x + Math.cos(a) * 0.5, y: m.y + Math.sin(a) * 0.5, vx: Math.cos(a) * c.shotSpeed, vy: Math.sin(a) * c.shotSpeed, r: 0.18, range: c.atkRange + 2, dmg: 1 });
}
