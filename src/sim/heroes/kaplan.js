import { SKINS, HERO } from '../config.js';
import { heroesHostile } from '../combat.js';
import { heroMaxHp } from '../state.js';

const A = SKINS.kaplan.ability;

/**
 * Bohaterowie w zasięgu Aury, których Kapłan `h` może leczyć: w Koronie (i trybach bez drużyn)
 * wszyscy — także rywale (dylemat z GDD); w Bitwie bossów tylko własna drużyna.
 * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h
 */
export function auraTargets(state, h) {
  return state.players.filter((o) => !o.boss && o.alive && !heroesHostile(h, o) && Math.hypot(o.x - h.x, o.y - h.y) <= A.radius + HERO.radius);
}

/** Czy Aura rzucona teraz kogokolwiek uleczy (bot nie marnuje umiejętności). */
export const auraWouldHeal = (state, h) => auraTargets(state, h).some((o) => o.hp < (heroMaxHp(o)));

/** Aura: leczy 1 HP bohaterom w promieniu 3 m — w Koronie także rywalom, w drużynach tylko swoim. */
export const kaplan = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    for (const o of auraTargets(state, h)) o.hp = Math.min(heroMaxHp(o), o.hp + A.heal);
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'kaplan', x: h.x, y: h.y, r: A.radius });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};
