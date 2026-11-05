import { SKINS, HERO } from '../config.js';
import { bossRadius } from '../combat.js';
import { resolveStatic } from '../physics.js';

const A = SKINS.lotrzyk.ability;

/** Krok cienia: teleport za plecy bossa (do 5 m), następny atak ×3. */
export const lotrzyk = {
  /** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
  start(state, h) {
    const bossP = state.players.find((p) => p.boss && !p.boss.dying);
    if (!bossP) return false;
    const d = Math.hypot(bossP.x - h.x, bossP.y - h.y) - bossRadius();
    if (d > A.range) return false;
    const back = bossRadius() + HERO.radius + 0.25;
    const fromX = h.x;
    const fromY = h.y;
    h.x = bossP.x - bossP.fx * back;
    h.y = bossP.y - bossP.fy * back;
    resolveStatic(h, HERO.radius);
    const [fx, fy] = [bossP.x - h.x, bossP.y - h.y];
    const l = Math.hypot(fx, fy) || 1;
    h.fx = fx / l;
    h.fy = fy / l;
    h.buffMult = A.mult;
    h.buffT = A.buffTime;
    h.abilCd = A.cd;
    h.atkCd = 0;
    state.events.push({ t: 'ability', id: h.id, skin: 'lotrzyk', fromX, fromY, x: h.x, y: h.y });
    return true;
  },
  update() {},
  blocksAttack: () => false,
  moveMul: () => 1,
};
