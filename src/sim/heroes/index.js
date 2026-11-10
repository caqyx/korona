import { HERO, SKINS, SKIN_IDS } from '../config.js';
import { BTN, changeSkin } from '../state.js';
import { HAZARD } from '../maps.js';
import { applyUpgradeEffect } from '../modes.js';
import { basicAttack } from './common.js';
import { respawnHero } from '../rules.js';
import { rycerz } from './rycerz.js';
import { lucznik } from './lucznik.js';
import { lotrzyk } from './lotrzyk.js';
import { kaplan } from './kaplan.js';
import { inzynier } from './inzynier.js';
import { mag } from './mag.js';
import { barbarzynca } from './barbarzynca.js';
import { druid } from './druid.js';

export const HERO_ABILITIES = { rycerz, lucznik, lotrzyk, kaplan, inzynier, mag, barbarzynca, druid };

/**
 * Pełna aktualizacja bohatera dla jednego kroku.
 * @param {import('../state.js').MatchState} state @param {import('../state.js').Player} h
 * @param {import('../state.js').Input} input @param {number} pressed @param {number} dt @param {import('../rng.js').Rng} rng
 */
export function updateHero(state, h, input, pressed, dt, rng) {
  tickHeroTimers(h, dt);
  if (state.offers && state.offers[h.id]) {
    pickUpgrade(state, h, input, pressed);
    return;
  }
  if (!h.alive) {
    if (input.skin && input.skin !== h.skin && SKIN_IDS.includes(/** @type {any} */ (input.skin))) changeSkin(h, input.skin);
    if (h.benched) return; // bez odliczania: przywraca go tryb (przerwa między falami) albo awans na bossa AI
    h.respawnT -= dt;
    if (h.respawnT <= 0 && h.connected) respawnHero(state, h, rng, HERO.respawnInvuln);
    return;
  }
  const ab = HERO_ABILITIES[/** @type {keyof typeof HERO_ABILITIES} */ (h.skin)];
  aimAt(h, input.aimX, input.aimY);
  // Ogłuszony nie może działać (dash, ruch, atak, umiejętność), ale liczniki umiejętności biegną dalej —
  // ogłuszenie nie przedłuża Szału ani ładowania strzału (ab.update dostaje `canAct`).
  const canAct = h.stunT <= 0;
  if (canAct) {
    if (pressed & BTN.DASH && h.dashCd <= 0) startDash(state, h, input);
    if (h.dashT <= 0) moveHero(h, input, dt, ab.moveMul(h));
  }
  ab.update(state, h, dt, canAct);
  if (!canAct || state.phase !== 'playing') return;
  if (input.buttons & BTN.ATTACK && h.atkCd <= 0 && h.dashT <= 0 && !ab.blocksAttack(h)) basicAttack(state, h);
  if (pressed & BTN.ABILITY && h.abilCd <= 0 && h.abilT <= 0 && ab.start(state, h, input)) {
    h.abilCd *= h.mods?.cd ?? 1;
    h.revealT = 1;
  }
}

/**
 * Wybór ulepszenia inputem (działa na każdym urządzeniu): ruch w lewo/prawo zmienia kartę,
 * atak zatwierdza. @param {any} state @param {any} h
 */
function pickUpgrade(state, h, input, pressed) {
  const o = state.offers[h.id];
  if (o.picked !== null) return;
  const dir = input.moveX > 0.5 ? 1 : input.moveX < -0.5 ? -1 : 0;
  if (dir !== 0 && dir !== o.lastDir) o.sel = (o.sel + dir + o.choices.length) % o.choices.length;
  o.lastDir = dir;
  if (pressed & BTN.ATTACK) applyUpgrade(state, h, o.choices[o.sel]);
}

/** @param {any} state @param {any} h @param {string} id */
export function applyUpgrade(state, h, id) {
  const o = state.offers?.[h.id];
  if (!o || o.picked !== null) return;
  o.picked = id;
  applyUpgradeEffect(h, id);
  state.events.push({ t: 'upgrade', id: h.id, upg: id });
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
  h.dashCd = HERO.dashCooldown * (h.mods?.dashCd ?? 1);
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
  const sp = HERO.speed * mul * (h.slowT > 0 ? h.slowMul : 1) * (h.mods?.spd ?? 1);
  glide(h, mx * sp, my * sp, dt);
}

/** Ruch z poślizgiem na lodzie (bezwładność), poza lodem natychmiastowy. */
export function glide(p, vx, vy, dt) {
  if (p.onIce) {
    const k = Math.min(1, ICE_ACCEL * dt);
    p.vx += (vx - p.vx) * k;
    p.vy += (vy - p.vy) * k;
  } else {
    p.vx = vx;
    p.vy = vy;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}
const ICE_ACCEL = HAZARD.ice.accel;

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
