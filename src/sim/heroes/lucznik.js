import { SKINS } from '../config.js';
import { fireHeroProjectile } from './common.js';

const A = SKINS.lucznik.ability;

/** Przeszywający strzał: ładowanie 0,6 s, potem pocisk przebijający wszystko (30 dmg). */
export const lucznik = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    h.abilT = A.charge;
    h.abilCd = A.cd;
    state.events.push({ t: 'charge', id: h.id });
    return true;
  },
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h @param {number} dt */
  update(state, h, dt) {
    if (h.abilT <= 0) return;
    h.abilT -= dt;
    if (h.abilT <= 0) {
      h.abilT = 0;
      fireHeroProjectile(state, h, A.dmg, A.speed, A.range, A.r, true, 'pierce');
      state.events.push({ t: 'ability', id: h.id, skin: 'lucznik' });
    }
  },
  blocksAttack: (h) => h.abilT > 0,
  moveMul: (h) => (h.abilT > 0 ? 0.5 : 1),
};
