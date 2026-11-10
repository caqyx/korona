import { SKINS } from '../config.js';

const A = SKINS.barbarzynca.ability;

/** Szał: przez 4 s ataki ponad 2× szybciej i +20% prędkości ruchu. Licznik biegnie także podczas ogłuszenia. */
export const barbarzynca = {
  /** @param {any} state @param {any} h */
  start(state, h) {
    h.abilT = A.duration;
    h.abilCd = A.cd;
    h.atkCd = Math.min(h.atkCd, 0.2);
    state.events.push({ t: 'ability', id: h.id, skin: 'barbarzynca', x: h.x, y: h.y });
    return true;
  },
  /** @param {any} _state @param {any} h @param {number} dt */
  update(_state, h, dt) {
    if (h.abilT > 0) h.abilT = Math.max(0, h.abilT - dt);
  },
  blocksAttack: () => false,
  moveMul: (h) => (h.abilT > 0 ? A.speedMul : 1),
  /** mnożnik czasu odnowienia ataku w trakcie Szału */
  atkCdMul: (h) => (h.abilT > 0 ? A.atkCdMul : 1),
};
