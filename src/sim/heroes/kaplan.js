import { SKINS, HERO } from '../config.js';

const A = SKINS.kaplan.ability;

/** Aura: leczy 1 HP wszystkim bohaterom w promieniu 3 m — także rywalom. */
export const kaplan = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    for (const o of state.players) {
      if (o.boss || !o.alive) continue;
      if (Math.hypot(o.x - h.x, o.y - h.y) <= A.radius + HERO.radius) o.hp = Math.min(o.maxHp ?? HERO.hp, o.hp + A.heal);
    }
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'kaplan', x: h.x, y: h.y, r: A.radius });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};
