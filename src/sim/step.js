import { DT, MATCH, HERO } from './config.js';
import { emptyInput } from './state.js';
import { makeRng } from './rng.js';
import { updateHero, applyImpulses } from './heroes/index.js';
import { updateTurrets } from './heroes/inzynier.js';
import { updateBoss } from './bosses/index.js';
import { updateMinions } from './bosses/nekromanta.js';
import { updateProjectiles } from './projectiles.js';
import { updateZones } from './zones.js';
import { resolveStatic, pushOut } from './physics.js';
import { bossRadius } from './combat.js';
import { bindRng, checkCrownPickup, accrueCrownTime, checkWin, finishTransition } from './rules.js';

/**
 * Jeden krok symulacji (stały krok 1/60 s). Czysta funkcja względem świata zewnętrznego:
 * nie używa DOM, sieci, zegara ani Math.random. Mutuje i zwraca `state`.
 *
 * @param {import('./state.js').MatchState} state
 * @param {Record<string, import('./state.js').Input>} inputsByPlayer
 * @param {number} [dt]
 * @param {import('./rng.js').Rng} [rng]
 */
export function step(state, inputsByPlayer, dt = DT, rng = makeRng(state.rng)) {
  state.events = [];
  state.tick += 1;
  if (state.phase === 'ended') return state;
  if (state.phase === 'countdown') {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.countdown = 0;
      state.phase = 'playing';
      state.events.push({ t: 'go' });
    }
    return state;
  }
  bindRng(rng);
  try {
    const sdt = state.phase === 'transition' ? dt * MATCH.slowmoScale : dt;
    state.time += sdt;
    if (state.phase === 'playing') state.matchTime += dt;
    updatePlayers(state, inputsByPlayer, sdt, rng);
    updateTurrets(state, sdt);
    updateMinions(state, sdt);
    updateProjectiles(state, sdt);
    updateZones(state, sdt);
    resolveBodies(state);
    if (state.phase === 'transition') advanceTransition(state, dt, rng);
    else {
      accrueCrownTime(state, sdt);
      checkCrownPickup(state, rng);
    }
    checkWin(state);
  } finally {
    bindRng(null);
  }
  return state;
}

function updatePlayers(state, inputsByPlayer, dt, rng) {
  for (const p of state.players) {
    if (!p.connected) continue;
    const input = inputsByPlayer[p.id] || emptyInput();
    const buttons = input.buttons | 0;
    const pressed = buttons & ~p.prevButtons;
    p.prevButtons = buttons;
    if (p.boss) updateBoss(state, p, input, pressed, dt, rng);
    else updateHero(state, p, input, pressed, dt, rng);
    if (p.alive) applyImpulses(p, dt);
  }
}

function resolveBodies(state) {
  const bossP = state.players.find((p) => p.boss);
  for (const p of state.players) {
    if (!p.alive || !p.connected) continue;
    resolveStatic(p, p.boss ? bossRadius() : HERO.radius);
  }
  if (!bossP || bossP.boss.dying) return;
  for (const h of state.players) {
    if (h.boss || !h.alive) continue;
    if (pushOut(h, HERO.radius, bossP, bossRadius())) resolveStatic(h, HERO.radius);
  }
}

function advanceTransition(state, dt, rng) {
  state.transition.t -= dt;
  if (state.transition.t <= 0) finishTransition(state, rng);
}

/**
 * Wykonuje wiele kroków (testy, benchmark).
 * @param {import('./state.js').MatchState} state @param {number} n
 * @param {(state:any, i:number)=>Record<string, import('./state.js').Input>} inputsFn
 */
export function runSteps(state, n, inputsFn) {
  for (let i = 0; i < n; i++) step(state, inputsFn(state, i));
  return state;
}
