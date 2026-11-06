import { SKINS } from '../config.js';
import { heroMelee } from '../combat.js';
import { spawnProjectile } from '../projectiles.js';
import { HERO } from '../config.js';

/**
 * Atak podstawowy według configu skina.
 * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h
 */
export function basicAttack(state, h) {
  const cfg = SKINS[/** @type {keyof typeof SKINS} */ (h.skin)].attack;
  const mods = h.mods || { dmg: 1, cd: 1, range: 1 };
  const mult = (h.buffT > 0 ? h.buffMult : 1) * mods.dmg;
  if (cfg.kind === 'melee') {
    const hit = heroMelee(state, h, cfg.dmg * mult, cfg.range * mods.range + HERO.radius, cfg.arc);
    if (hit && h.buffT > 0 && h.buffMult > 1) consumeBuff(h);
  } else {
    fireHeroProjectile(state, h, cfg.dmg * mult, cfg.speed, cfg.range * mods.range, cfg.r, false, /** @type {any} */ (cfg).proj || 'bolt');
    if (h.buffT > 0 && h.buffMult > 1) consumeBuff(h);
  }
  h.atkCd = cfg.cd * mods.cd * (h.skin === 'barbarzynca' && h.abilT > 0 ? SKINS.barbarzynca.ability.atkCdMul : 1);
  h.revealT = 1;
}

/** @param {import('../state.js').Player} h */
function consumeBuff(h) {
  h.buffT = 0;
  h.buffMult = 1;
}

/** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h */
export function fireHeroProjectile(state, h, dmg, speed, range, r, pierce, kind) {
  spawnProjectile(state, {
    team: 'hero',
    ownerId: h.id,
    kind,
    x: h.x + h.fx * HERO.radius,
    y: h.y + h.fy * HERO.radius,
    vx: h.fx * speed,
    vy: h.fy * speed,
    r,
    range,
    dmg,
    pierce,
  });
}
