import { BTN } from './state.js';
import { SKINS, BOSSES, HERO } from './config.js';
import { zoneContains } from './zones.js';
import { bossRadius } from './combat.js';

/**
 * Proste AI inputu (testy E2E, balans, tryb lokalny). Deterministyczne względem
 * przekazanego RNG (osobny od RNG symulacji).
 * @param {import('./state.js').MatchState} state @param {string} id @param {import('./rng.js').Rng} rng
 * @returns {import('./state.js').Input}
 */
export function botInput(state, id, rng) {
  const me = state.players.find((p) => p.id === id);
  if (!me || !me.alive) return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
  return me.boss ? bossBot(state, me, rng) : heroBot(state, me, rng);
}

function heroBot(state, me, rng) {
  const bossP = state.players.find((p) => p.boss && !p.boss.dying);
  let tx = state.crown.x;
  let ty = state.crown.y;
  let aimX = tx;
  let aimY = ty;
  let buttons = 0;
  let mx = 0;
  let my = 0;
  if (bossP) {
    const cfg = SKINS[me.skin].attack;
    const want = cfg.kind === 'melee' ? bossRadius() + cfg.range * 0.6 : Math.min(cfg.range * 0.75, 6);
    const dx = bossP.x - me.x;
    const dy = bossP.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    aimX = bossP.x;
    aimY = bossP.y;
    const radial = d > want + 0.3 ? 1 : d < want - 0.6 ? -1 : 0;
    const strafe = (me.slot % 2 ? 1 : -1) * 0.7;
    mx = (dx / d) * radial + (-dy / d) * strafe;
    my = (dy / d) * radial + (dx / d) * strafe;
    if (d < want + cfg.range + 1) buttons |= BTN.ATTACK;
    if (me.abilCd <= 0 && rng.next() < 0.05) buttons |= BTN.ABILITY;
  } else if (state.crown.state === 'center') {
    const dx = tx - me.x;
    const dy = ty - me.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  if (inDanger(state, me) && me.dashCd <= 0) {
    buttons |= BTN.DASH;
    mx = -my || 1;
    my = mx;
  }
  if (rng.next() < 0.02) buttons |= BTN.DASH * (rng.next() < 0.3 ? 1 : 0);
  return { moveX: mx, moveY: my, aimX, aimY, buttons: buttons | 0 };
}

function inDanger(state, me) {
  for (const z of state.zones) {
    if (z.dmg <= 0) continue;
    if (z.warn > 0 && z.warn < 0.25 && zoneContains(z, me.x, me.y, HERO.radius)) return true;
    if (z.shape === 'ring' && z.warn <= 0 && zoneContains(z, me.x, me.y, HERO.radius + 0.6)) return true;
  }
  return false;
}

function bossBot(state, me, rng) {
  let target = null;
  let bd = Infinity;
  for (const h of state.players) {
    if (h.boss || !h.alive || !h.connected) continue;
    const d = Math.hypot(h.x - me.x, h.y - me.y);
    if (d < bd) {
      bd = d;
      target = h;
    }
  }
  if (!target) return { moveX: -me.x * 0.1, moveY: -me.y * 0.1, aimX: 0, aimY: 0, buttons: 0 };
  const dx = target.x - me.x;
  const dy = target.y - me.y;
  const d = Math.hypot(dx, dy) || 1;
  const range = BOSSES[me.boss.type].atk.range ?? 3;
  const melee = me.boss.type === 'kolos' || me.boss.type === 'cien';
  const want = melee ? range * 0.7 : 5;
  const radial = d > want ? 1 : -0.6;
  let buttons = 0;
  if (d < (melee ? range + 0.5 : 9)) buttons |= BTN.ATTACK;
  const r = rng.next();
  if (r < 0.04) buttons |= BTN.Q;
  else if (r < 0.07) buttons |= BTN.E;
  else if (r < 0.1) buttons |= BTN.R;
  return { moveX: (dx / d) * radial, moveY: (dy / d) * radial, aimX: target.x, aimY: target.y, buttons };
}
