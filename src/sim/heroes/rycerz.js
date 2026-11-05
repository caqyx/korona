import { SKINS } from '../config.js';

const A = SKINS.rycerz.ability;

/** Tarcza: blokuje wszystko z przodu przez 1,5 s, odbija pociski w bossa. */
export const rycerz = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    h.abilT = A.duration;
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'rycerz' });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: (h) => (h.abilT > 0 ? 0.6 : 1),
};
