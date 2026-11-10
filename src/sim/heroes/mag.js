import { SKINS } from '../config.js';
import { addZone } from '../zones.js';

const A = SKINS.mag.ability;

/** Celuje w punkt w zasięgu (od bohatera). */
export function aimPoint(h, input, range) {
  const dx = (input?.aimX ?? h.x + h.fx) - h.x;
  const dy = (input?.aimY ?? h.y + h.fy) - h.y;
  const d = Math.hypot(dx, dy);
  if (d <= range) return [h.x + dx, h.y + dy];
  return [h.x + (dx / d) * range, h.y + (dy / d) * range];
}

/** Meteor: po 0,7 s spada w wybrany punkt (do 8 m), ability.dmg obrażeń w promieniu 1,6 m (boss i miniony). */
export const mag = {
  /** @param {any} state @param {any} h @param {any} input */
  start(state, h, input) {
    const [x, y] = aimPoint(h, input, A.range);
    addZone(state, { kind: 'meteorHero', team: 'hero', shape: 'circle', ownerId: h.id, x, y, r: A.radius, warn: A.telegraph, life: 0.08, dmg: A.dmg * (h.mods?.dmg ?? 1) });
    h.abilCd = A.cd;
    state.events.push({ t: 'ability', id: h.id, skin: 'mag', x, y });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};
