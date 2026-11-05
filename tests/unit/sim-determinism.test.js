import { describe, it, expect } from 'vitest';
import { createMatchState } from '../../src/sim/state.js';
import { step } from '../../src/sim/step.js';
import { makeRng } from '../../src/sim/rng.js';
import { botInput } from '../../src/sim/bot.js';

const PLAYERS = [
  { id: 'a', nick: 'A', skin: 'rycerz' },
  { id: 'b', nick: 'B', skin: 'lucznik' },
  { id: 'c', nick: 'C', skin: 'lotrzyk' },
  { id: 'd', nick: 'D', skin: 'kaplan' },
  { id: 'e', nick: 'E', skin: 'inzynier' },
];

function newMatch(seed) {
  return createMatchState({ seed, players: PLAYERS, countdown: 0.5 });
}

function botInputs(state, rng) {
  const inputs = {};
  for (const p of state.players) inputs[p.id] = botInput(state, p.id, rng);
  return inputs;
}

function simulate(seed, steps, inputSeed = 777) {
  const state = newMatch(seed);
  const rng = makeRng({ s: inputSeed });
  const seenBosses = new Set();
  for (let i = 0; i < steps; i++) {
    step(state, botInputs(state, rng));
    for (const p of state.players) if (p.boss) seenBosses.add(p.id);
  }
  return { state, seenBosses };
}

/** Szuka wartości, które JSON zgubiłby lub zmienił (NaN, Infinity, undefined, funkcje). */
function nonJsonValues(v, path = '$', out = []) {
  if (typeof v === 'number' && !Number.isFinite(v)) out.push(path);
  else if (v === undefined || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') out.push(path);
  else if (v && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== Array.prototype) out.push(path + ' (class ' + proto?.constructor?.name + ')');
    for (const k of Object.keys(v)) nonJsonValues(v[k], path + '.' + k, out);
  }
  return out;
}

describe('determinism', () => {
  it('same seed + same inputs -> identical state after 2000 steps', () => {
    const r1 = simulate(1234, 2000);
    const r2 = simulate(1234, 2000);
    expect(r1.state.tick).toBe(2000);
    // sanity: the simulation actually did something (crown taken, boss existed)
    expect(r1.seenBosses.size).toBeGreaterThan(0);
    expect(JSON.stringify(r1.state)).toBe(JSON.stringify(r2.state));
  });

  it('different seed -> different state', () => {
    const r1 = simulate(1234, 2000);
    const r2 = simulate(98765, 2000);
    expect(JSON.stringify(r1.state)).not.toBe(JSON.stringify(r2.state));
  });
});

describe('snapshot', () => {
  it('state is JSON-serializable (no NaN/Infinity/undefined/functions/classes)', () => {
    const { state } = simulate(55, 1500);
    expect(nonJsonValues(state)).toEqual([]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('JSON round-trip clone keeps stepping identically to the original', () => {
    const original = newMatch(4242);
    const rngA = makeRng({ s: 9 });
    for (let i = 0; i < 900; i++) step(original, botInputs(original, rngA));

    const clone = JSON.parse(JSON.stringify(original));
    const inputRngState = { s: 31337 };
    const rngOrig = makeRng({ ...inputRngState });
    const rngClone = makeRng({ ...inputRngState });
    for (let i = 0; i < 1200; i++) {
      step(original, botInputs(original, rngOrig));
      step(clone, botInputs(clone, rngClone));
    }
    expect(JSON.stringify(clone)).toBe(JSON.stringify(original));
  });

  it('rng state lives in the snapshot and advances deterministically', () => {
    const a = makeRng({ s: 5 });
    const b = makeRng({ s: 5 });
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
