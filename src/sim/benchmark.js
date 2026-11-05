import { createMatchState } from './state.js';
import { promoteToBoss } from './rules.js';
import { spawnProjectile } from './projectiles.js';
import { nextId } from './state.js';
import { makeRng } from './rng.js';
import { SKIN_IDS } from './config.js';

/** Najcięższy syntetyczny scenariusz: 6 graczy, boss, 150 pocisków, 6 minionów (GDD 6.4). */
export function createBenchmarkState() {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: 'b' + i, nick: 'bench' + i, skin: SKIN_IDS[i % 5] }));
  const state = createMatchState({ seed: 1234, players, countdown: 0 });
  state.phase = 'playing';
  promoteToBoss(state, state.players[0], 'nekromanta');
  state.crown.state = 'held';
  state.crown.holderId = 'b0';
  const rng = makeRng({ s: 99 });
  for (let i = 0; i < 150; i++) {
    const a = rng.next() * Math.PI * 2;
    spawnProjectile(state, { team: i % 2 ? 'hero' : 'boss', ownerId: i % 2 ? 'b1' : 'b0', x: Math.cos(a) * 6, y: Math.sin(a) * 6, vx: Math.cos(a + 2) * 0.01, vy: Math.sin(a + 2) * 0.01, range: 1e9, dmg: 0 });
  }
  for (let i = 0; i < 6; i++) state.minions.push({ id: nextId(state), ownerId: 'b0', x: i - 3, y: 4, hp: 1e9, maxHp: 15, r: 0.45, cd: 1, windup: 0, fx: 1, fy: 0 });
  return state;
}
