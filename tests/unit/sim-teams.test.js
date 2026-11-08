import { describe, it, expect } from 'vitest';
import { createMatchState } from '../../src/sim/state.js';
import { step } from '../../src/sim/step.js';
import { botInput } from '../../src/sim/bot.js';
import { makeRng } from '../../src/sim/rng.js';
import { hurtHero, hurtBoss } from '../../src/sim/combat.js';
import { bindRng } from '../../src/sim/rules.js';

function teams(n, opts = {}) {
  const players = [];
  for (let t = 0; t < 2; t++) for (let i = 0; i < n; i++) players.push({ id: `t${t}p${i}`, nick: `T${t}${i}`, skin: ['rycerz', 'mag', 'druid', 'lucznik'][i % 4], team: t, wantsBoss: opts.boss?.[t] === i });
  const st = createMatchState({ seed: opts.seed ?? 7, players, countdown: 0, mode: 'teams', mapId: 'arena' });
  st.phase = 'playing';
  return st;
}

describe('Bitwa bossów (drużyny)', () => {
  it('każda drużyna ma dokładnie jednego bossa, różnych typów; wybór „chcę być bossem” jest respektowany', () => {
    const st = teams(4, { boss: [2, 0] });
    const b0 = st.players.filter((p) => p.team === 0 && p.boss);
    const b1 = st.players.filter((p) => p.team === 1 && p.boss);
    expect(b0).toHaveLength(1);
    expect(b1).toHaveLength(1);
    expect(b0[0].id).toBe('t0p2');
    expect(b1[0].id).toBe('t1p0');
    expect(b0[0].boss.type).not.toBe(b1[0].boss.type);
    expect(st.players).toHaveLength(8);
  });

  it('brak ognia sojuszniczego: boss nie rani swoich, wrogi boss rani', () => {
    const st = teams(2);
    const boss0 = st.players.find((p) => p.team === 0 && p.boss);
    const ally = st.players.find((p) => p.team === 0 && !p.boss);
    const foe = st.players.find((p) => p.team === 1 && !p.boss);
    ally.invulnT = foe.invulnT = 0;
    expect(hurtHero(st, ally, 1, boss0.id, 0, 0)).toBe(false);
    expect(hurtHero(st, foe, 1, boss0.id, 0, 0)).toBe(true);
  });

  it('śmierć bossa = porażka jego drużyny', () => {
    const st = teams(2);
    const boss1 = st.players.find((p) => p.team === 1 && p.boss);
    const hero0 = st.players.find((p) => p.team === 0 && !p.boss);
    bindRng(makeRng(st.rng));
    hurtBoss(st, boss1, boss1.boss.maxHp * 10, hero0.id);
    bindRng(null);
    expect(st.phase).toBe('ended');
    expect(st.winnerTeam).toBe(0);
    expect(st.players.find((p) => p.id === st.winnerId).team).toBe(0);
  });

  it('mecz botów kończy się porażką jednej drużyny w rozsądnym czasie, bez przewagi kolejności na liście', () => {
    const wins = [0, 0];
    for (let k = 0; k < 8; k++) {
      const st = teams(3, { seed: 100 + k });
      const rngs = Object.fromEntries(st.players.map((p, i) => [p.id, makeRng({ s: i + 1 + k * 13 })]));
      let n = 0;
      while (st.phase !== 'ended' && n < 60 * 60 * 9) {
        const inp = {};
        for (const p of st.players) inp[p.id] = botInput(st, p.id, rngs[p.id], 'normal');
        step(st, inp);
        n++;
      }
      expect(st.phase).toBe('ended');
      wins[st.winnerTeam]++;
    }
    expect(Math.min(...wins)).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
