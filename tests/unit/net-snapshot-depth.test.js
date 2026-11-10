import { describe, it, expect } from 'vitest';
import { MSG, validateMessage, parseMessage, encodeMessage, envelope } from '../../src/net/messages.js';
import { createMatchState, step, botInput, makeRng, SKIN_IDS } from '../../src/sim/index.js';
import { MAP_IDS } from '../../src/sim/maps.js';

/**
 * Regresja: limit głębokości w walidacji odrzucał prawdziwe snapshoty (rzuty bossów trzymają
 * zagnieżdżone dane, np. boss.cast.data.spots[j][k]) — klienci widzieli zamrożony świat, a handoff
 * i końcowy snapshot potrafiły zginąć. Każdy snapshot z prawdziwej symulacji musi przejść walidację
 * zarówno bezpośrednio (WebRTC), jak i opakowany w RELAY (przekaźnik).
 */
describe('snapshoty z prawdziwej symulacji przechodzą walidację', () => {
  const MATCHES = 8;
  const SECONDS = 90;

  it(`${MATCHES} meczów botów × ${SECONDS} s: 0 odrzuconych (direct, RELAY, HANDOFF)`, () => {
    let total = 0;
    let casts = 0;
    const rejected = [];
    for (let seed = 1; seed <= MATCHES; seed++) {
      const n = 3 + (seed % 4);
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `bot${i}`, skin: SKIN_IDS[(seed + i) % SKIN_IDS.length] }));
      const state = createMatchState({ seed, players, countdown: 0, mapId: MAP_IDS[seed % MAP_IDS.length] });
      const rngs = players.map((_, i) => makeRng({ s: seed * 31 + i + 1 }));
      for (let s = 1; s <= SECONDS * 60 && state.phase !== 'ended'; s++) {
        const inputs = {};
        players.forEach((p, i) => (inputs[p.id] = botInput(state, p.id, rngs[i], 'hard')));
        step(state, inputs);
        if (s % 3) continue; // 20 Hz jak host
        const boss = state.players.find((p) => p.boss)?.boss;
        if (boss?.cast || boss?.channel) casts++;
        total++;
        const snapshot = parseMessage(encodeMessage(envelope(MSG.SNAPSHOT, 'p0', { epoch: 1, state })));
        const relayed = snapshot && validateMessage(envelope(MSG.RELAY, 'p0', { kind: 'state', msg: snapshot }, 'p1'));
        const handoff = validateMessage(JSON.parse(encodeMessage(envelope(MSG.HANDOFF, 'p0', { to: 'p1', epoch: 2, state }, 'p1'))));
        if (!snapshot || !relayed || !handoff) rejected.push({ seed, tick: state.tick, boss: boss?.type, cast: boss?.cast?.ab ?? boss?.channel?.kind });
      }
    }
    expect(total).toBeGreaterThan(1000);
    expect(casts).toBeGreaterThan(100); // test faktycznie obejmuje rzuty bossów
    expect(rejected).toEqual([]);
  }, 60_000);
});
