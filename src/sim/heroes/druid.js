import { SKINS } from '../config.js';
import { addZone } from '../zones.js';
import { aimPoint } from './mag.js';

const A = SKINS.druid.ability;

/** Korzenie: strefa 2,2 m na 3 s — spowalnia bossa o 45%, unieruchamia miniony, ability.dmg obrażeń co 0,5 s. */
export const druid = {
  /** @param {any} state @param {any} h @param {any} input */
  start(state, h, input) {
    const [x, y] = aimPoint(h, input, A.range);
    addZone(state, { kind: 'roots', team: 'hero', shape: 'circle', ownerId: h.id, x, y, r: A.radius, warn: A.telegraph, life: A.life, dmg: A.dmg * (h.mods?.dmg ?? 1), tick: A.tick, tickT: 0, slow: A.slow });
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'druid', x, y });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};
