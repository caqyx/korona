/**
 * Test balansu: N meczów bot vs bot w samej symulacji (bez renderu i sieci).
 * Wypisuje średni czas meczu, średni czas w koronie per boss i ostatnie ciosy per skin.
 * Użycie: npm run balance [-- --matches 200 --seed 1]
 */
import { createMatchState, step, botInput, makeRng, SKIN_IDS, BOSS_IDS, DT } from '../src/sim/index.js';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const MATCHES = arg('matches', 200);
const SEED = arg('seed', 1);

export function runMatch(seed) {
  const meta = makeRng({ s: seed * 7919 + 13 });
  const n = 3 + meta.int(4); // 3..6 graczy
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `bot${i}`, skin: SKIN_IDS[meta.int(SKIN_IDS.length)] }));
  const state = createMatchState({ seed, players, countdown: 0 });
  const rngs = Object.fromEntries(players.map((p, i) => [p.id, makeRng({ s: seed * 31 + i + 1 })]));
  const reign = Object.fromEntries(BOSS_IDS.map((b) => [b, { time: 0, count: 0 }]));
  const lastHitsBySkin = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  const skinPresence = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  for (const p of players) skinPresence[p.skin]++;
  let steps = 0;
  while (state.phase !== 'ended' && steps < 60 * 60 * 12) {
    const inputs = {};
    for (const p of state.players) inputs[p.id] = botInput(state, p.id, rngs[p.id]);
    step(state, inputs);
    steps++;
    const boss = state.players.find((p) => p.boss && !p.boss.dying);
    if (boss && state.phase === 'playing') reign[boss.boss.type].time += DT;
    for (const e of state.events) {
      if (e.t === 'crownTaken') reign[e.bossType].count++;
      if (e.t === 'lastHit') lastHitsBySkin[state.players.find((p) => p.id === e.id).skin]++;
    }
  }
  return { minutes: state.matchTime / 60, reign, lastHitsBySkin, skinPresence, endReason: state.endReason, players: n };
}

function main() {
  const t0 = Date.now();
  const total = { minutes: 0, reign: Object.fromEntries(BOSS_IDS.map((b) => [b, { time: 0, count: 0 }])), lh: Object.fromEntries(SKIN_IDS.map((s) => [s, 0])), pres: Object.fromEntries(SKIN_IDS.map((s) => [s, 0])), reasons: {} };
  const mins = [];
  for (let i = 0; i < MATCHES; i++) {
    const r = runMatch(SEED * 100000 + i);
    mins.push(r.minutes);
    total.minutes += r.minutes;
    total.reasons[r.endReason] = (total.reasons[r.endReason] || 0) + 1;
    for (const b of BOSS_IDS) {
      total.reign[b].time += r.reign[b].time;
      total.reign[b].count += r.reign[b].count;
    }
    for (const s of SKIN_IDS) {
      total.lh[s] += r.lastHitsBySkin[s];
      total.pres[s] += r.skinPresence[s];
    }
  }
  const avg = total.minutes / MATCHES;
  mins.sort((a, b) => a - b);
  console.log(`KORONA balans: ${MATCHES} meczów (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(`Średni czas meczu: ${avg.toFixed(2)} min (mediana ${mins[Math.floor(MATCHES / 2)].toFixed(2)}, min ${mins[0].toFixed(2)}, max ${mins[MATCHES - 1].toFixed(2)})`);
  console.log(`Zakończenia: ${JSON.stringify(total.reasons)}`);
  console.log('Średni czas w koronie per boss (na panowanie):');
  for (const b of BOSS_IDS) {
    const r = total.reign[b];
    console.log(`  ${b.padEnd(11)} ${(r.time / Math.max(1, r.count)).toFixed(1)} s  (panowań: ${r.count})`);
  }
  const lhTotal = Object.values(total.lh).reduce((a, b) => a + b, 0) || 1;
  console.log('Ostatnie ciosy per skin (udział; ostatnie ciosy na wystąpienie skina):');
  let worst = 0;
  for (const s of SKIN_IDS) {
    const share = total.lh[s] / lhTotal;
    worst = Math.max(worst, share);
    console.log(`  ${s.padEnd(9)} ${String(total.lh[s]).padStart(5)}  ${(share * 100).toFixed(1)}%  (${(total.lh[s] / Math.max(1, total.pres[s])).toFixed(2)}/gracza)`);
  }
  const okTime = avg >= 4 && avg <= 10;
  const okShare = worst <= 0.35;
  console.log(`\nBramki: czas meczu 4–10 min: ${okTime ? 'OK' : 'POZA'}; max udział skina ≤35%: ${okShare ? 'OK' : 'POZA'}`);
  process.exitCode = okTime && okShare ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
