import { HERO, SKINS, SKIN_IDS } from '../config.js';
import { BTN } from '../state.js';
import { basicAttack } from './common.js';
import { respawnHero } from '../rules.js';
import { rycerz } from './rycerz.js';
import { lucznik } from './lucznik.js';
import { lotrzyk } from './lotrzyk.js';
import { kaplan } from './kaplan.js';
import { inzynier } from './inzynier.js';

export const HERO_ABILITIES = { rycerz, lucznik, lotrzyk, kaplan, inzynier };

/**
 * Pełna aktualizacja bohatera dla jednego kroku.
 * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h
 * @param {import('../state.js').Input} input @param {number} pressed @param {number} dt @param {import('../rng.js').Rng} rng
 */
export function updateHero(state, h, input, pressed, dt, rng) {
  tickHeroTimers(h, dt);
  if (!h.alive) {
    if (input.skin && SKIN_IDS.includes(/** @type {any} */ (input.skin))) h.skin = input.skin;
    h.respawnT -= dt;
    if (h.respawnT <= 0 && h.connected) respawnHero(state, h, rng, HERO.respawnInvuln);
    return;
  }
  const ab = HERO_ABILITIES[/** @type {keyof typeof HERO_ABILITIES} */ (h.skin)];
  aimAt(h, input.aimX, input.aimY);
  if (h.stunT > 0) return;
  if (pressed & BTN.DASH && h.dashCd <= 0) startDash(state, h, input);
  if (h.dashT <= 0) moveHero(h, input, dt, ab.moveMul(h));
  ab.update(state, h, dt);
  if (state.phase !== 'playing') return;
  if (input.buttons & BTN.ATTACK && h.atkCd <= 0 && h.dashT <= 0 && !ab.blocksAttack(h)) basicAttack(state, h);
  if (pressed & BTN.ABILITY && h.abilCd <= 0 && h.abilT <= 0) ab.start(state, h);
}

/** @param {import('../state.js').Player} h @param {number} dt */
function tickHeroTimers(h, dt) {
  h.atkCd = Math.max(0, h.atkCd - dt);
  h.abilCd = Math.max(0, h.abilCd - dt);
  h.dashCd = Math.max(0, h.dashCd - dt);
  h.invulnT = Math.max(0, h.invulnT - dt);
  h.stunT = Math.max(0, h.stunT - dt);
  h.slowT = Math.max(0, h.slowT - dt);
  if (h.slowT <= 0) h.slowMul = 1;
  if (h.buffT > 0) {
    h.buffT -= dt;
    if (h.buffT <= 0) h.buffMult = 1;
  }
  if (h.skin === 'rycerz' && h.abilT > 0) h.abilT = Math.max(0, h.abilT - dt);
  if (h.dashT > 0) h.dashT = Math.max(0, h.dashT - dt);
}

/** @param {import('../state.js').Player} p */
export function aimAt(p, ax, ay) {
  const dx = ax - p.x;
  const dy = ay - p.y;
  const l = Math.hypot(dx, dy);
  if (l > 0.05) {
    p.fx = dx / l;
    p.fy = dy / l;
  }
}

/** @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h @param {import('../state.js').Input} input */
function startDash(state, h, input) {
  let dx = input.moveX;
  let dy = input.moveY;
  let l = Math.hypot(dx, dy);
  if (l < 0.1) {
    dx = h.fx;
    dy = h.fy;
    l = 1;
  }
  h.dashX = dx / l;
  h.dashY = dy / l;
  h.dashT = HERO.dashDuration;
  h.dashCd = HERO.dashCooldown;
  state.events.push({ t: 'dash', id: h.id, x: h.x, y: h.y });
}

/** @param {import('../state.js').Player} h @param {import('../state.js').Input} input @param {number} dt @param {number} mul */
function moveHero(h, input, dt, mul) {
  let mx = input.moveX;
  let my = input.moveY;
  const l = Math.hypot(mx, my);
  if (l > 1) {
    mx /= l;
    my /= l;
  }
  const sp = HERO.speed * mul * (h.slowT > 0 ? h.slowMul : 1);
  h.x += mx * sp * dt;
  h.y += my * sp * dt;
}

/** Ruch dashu i odrzutu — wykonywany w fazie fizyki. @param {import('../state.js').Player} p @param {number} dt */
export function applyImpulses(p, dt) {
  if (p.dashT > 0) {
    p.x += p.dashX * HERO.dashSpeed * dt;
    p.y += p.dashY * HERO.dashSpeed * dt;
  }
  if (p.kx || p.ky) {
    p.x += p.kx * dt;
    p.y += p.ky * dt;
    const decay = Math.exp(-8 * dt);
    p.kx *= decay;
    p.ky *= decay;
    if (Math.abs(p.kx) + Math.abs(p.ky) < 0.05) p.kx = p.ky = 0;
  }
}

export { SKINS };
