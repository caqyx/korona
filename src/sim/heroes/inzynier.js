import { SKINS } from '../config.js';
import { nextId } from '../state.js';
import { spawnProjectile } from '../projectiles.js';
import { hitsPillar } from '../physics.js';
import { enemyBosses } from '../combat.js';

const A = SKINS.inzynier.ability;

/** Wieżyczka: stoi ability.life s i strzela w bossa (ability.dmg); jej obrażenia liczą się Inżynierowi. */
export const inzynier = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    let x = h.x + h.fx * 0.9;
    let y = h.y + h.fy * 0.9;
    if (hitsPillar(x, y, 0.35)) {
      x = h.x;
      y = h.y;
    }
    state.turrets = state.turrets.filter((t) => t.ownerId !== h.id);
    state.turrets.push({ id: nextId(state), ownerId: h.id, x, y, life: A.life, cd: 0.2 });
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'inzynier', x, y });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};

/** @param {import('../state.js').MatchState} state @param {number} dt */
export function updateTurrets(state, dt) {
  const keep = [];
  for (const t of state.turrets) {
    t.life -= dt;
    if (t.life <= 0) continue;
    keep.push(t);
    t.cd -= dt;
    const owner0 = state.players.find((p) => p.id === t.ownerId) || {};
    const bossP = enemyBosses(state, owner0).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    if (t.cd > 0 || !bossP) continue;
    const dx = bossP.x - t.x;
    const dy = bossP.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d > A.range + 1.2) continue;
    t.cd = A.fireEvery;
    const owner = state.players.find((p) => p.id === t.ownerId);
    spawnProjectile(state, { team: 'hero', ownerId: t.ownerId, kind: 'turret', x: t.x, y: t.y, vx: (dx / d) * A.speed, vy: (dy / d) * A.speed, r: 0.12, range: A.range + 2, dmg: A.dmg * (owner?.mods?.dmg ?? 1) });
  }
  state.turrets = keep;
}
