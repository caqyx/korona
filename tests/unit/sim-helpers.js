import { createMatchState, BTN } from '../../src/sim/state.js';
import { promoteToBoss } from '../../src/sim/rules.js';
import { step } from '../../src/sim/step.js';

export { BTN };

/** @param {Partial<import('../../src/sim/state.js').Input>} [o] */
export const inp = (o = {}) => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0, ...o });

/**
 * Mecz w fazie 'playing'.
 * @param {{id:string,skin?:string}[]} specs
 * @param {object} [opts]
 */
export function makeMatch(specs, opts = {}) {
  const players = specs.map((s) => ({ id: s.id, nick: s.id, skin: s.skin || 'kaplan' }));
  const state = createMatchState({ seed: 42, countdown: 0, players, ...opts });
  state.phase = 'playing';
  return state;
}

/**
 * Boss 'B' w (0,0) patrzący w +x, korona trzymana, CD wyzerowane.
 * Bohaterowie ustawiani na podanych pozycjach.
 * @param {string} type @param {{id:string,skin?:string,x:number,y:number}[]} heroes
 */
export function bossArena(type, heroes, opts = {}) {
  const state = makeMatch([{ id: 'B', skin: 'rycerz' }, ...heroes], opts);
  const boss = state.players[0];
  promoteToBoss(state, boss, type);
  boss.x = 0;
  boss.y = 0;
  boss.fx = 1;
  boss.fy = 0;
  boss.boss.cd = { atk: 0, q: 0, e: 0, r: 0 };
  state.crown.state = 'held';
  state.crown.holderId = 'B';
  state.lastBossType = type;
  heroes.forEach((h, i) => {
    const p = state.players[i + 1];
    p.x = h.x;
    p.y = h.y;
  });
  return { state, boss, heroes: state.players.slice(1) };
}

/** Kroki z funkcją inputów. */
export function run(state, n, inputsFn = () => ({})) {
  for (let i = 0; i < n; i++) step(state, inputsFn(i));
  return state;
}

/** Wciska przycisk jednym krokiem (edge-detection), potem puszcza. */
export function press(state, id, buttons, aim = {}) {
  step(state, { [id]: inp({ ...aim, buttons }) });
}
