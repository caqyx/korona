/**
 * Test balansu: N meczów bot vs bot w samej symulacji (bez renderu i sieci).
 * Wypisuje średni czas meczu, średni czas w koronie per boss i ostatnie ciosy per skin.
 * Użycie: npm run balance [-- --matches 200 --seed 1]
 */
import { createMatchState, step, botInput, makeRng, SKIN_IDS, BOSS_IDS, DT } from '../src/sim/index.js';
import { MAP_IDS } from '../src/sim/maps.js';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const MATCHES = arg('matches', 200);
const SEED = arg('seed', 1);
// boty na poziomie „trudny” jako przybliżenie wprawnych graczy (normalny/łatwy są celowo omylne)
const LEVEL = process.argv.includes('--normal') ? 'normal' : 'hard';

export function runMatch(seed) {
  const meta = makeRng({ s: seed * 7919 + 13 });
  const n = 3 + meta.int(4); // 3..6 graczy
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `bot${i}`, skin: SKIN_IDS[meta.int(SKIN_IDS.length)] }));
  const mapId = MAP_IDS[meta.int(MAP_IDS.length)];
  const state = createMatchState({ seed, players, countdown: 0, mapId });
  const rngs = Object.fromEntries(players.map((p, i) => [p.id, makeRng({ s: seed * 31 + i + 1 })]));
  const reign = Object.fromEntries(BOSS_IDS.map((b) => [b, { time: 0, count: 0 }]));
  const lastHitsBySkin = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  const skinPresence = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  const dmgBySkin = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  const deathsBySkin = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  const scoreBySkin = Object.fromEntries(SKIN_IDS.map((s) => [s, 0]));
  for (const p of players) skinPresence[p.skin]++;
  let steps = 0;
  while (state.phase !== 'ended' && steps < 60 * 60 * 12) {
    const inputs = {};
    for (const p of state.players) inputs[p.id] = botInput(state, p.id, rngs[p.id], LEVEL);
    step(state, inputs);
    steps++;
    const boss = state.players.find((p) => p.boss && !p.boss.dying);
    if (boss && state.phase === 'playing') reign[boss.boss.type].time += DT;
    for (const e of state.events) {
      if (e.t === 'crownTaken') reign[e.bossType].count++;
      if (e.t === 'lastHit') lastHitsBySkin[state.players.find((p) => p.id === e.id).skin]++;
      if (e.t === 'bossHit') {
        const a = state.players.find((p) => p.id === e.by);
        if (a) dmgBySkin[a.skin] += e.dmg;
      }
      if (e.t === 'heroDie') deathsBySkin[state.players.find((p) => p.id === e.id).skin]++;
    }
  }
  for (const p of state.players) scoreBySkin[p.skin] += p.score;
  return { minutes: state.matchTime / 60, reign, lastHitsBySkin, skinPresence, dmgBySkin, deathsBySkin, scoreBySkin, endReason: state.endReason, players: n, mapId };
}

function main() {
  const t0 = Date.now();
  const per = { dmg: {}, deaths: {}, score: {}, pm: {} };
  const total = { minutes: 0, reign: Object.fromEntries(BOSS_IDS.map((b) => [b, { time: 0, count: 0 }])), lh: Object.fromEntries(SKIN_IDS.map((s) => [s, 0])), pres: Object.fromEntries(SKIN_IDS.map((s) => [s, 0])), reasons: {} };
  const mins = [];
  const byMap = {};
  for (let i = 0; i < MATCHES; i++) {
    const r = runMatch(SEED * 100000 + i);
    mins.push(r.minutes);
    (byMap[r.mapId] ??= []).push(r.minutes);
    total.minutes += r.minutes;
    total.reasons[r.endReason] = (total.reasons[r.endReason] || 0) + 1;
    for (const b of BOSS_IDS) {
      total.reign[b].time += r.reign[b].time;
      total.reign[b].count += r.reign[b].count;
    }
    for (const s of SKIN_IDS) {
      total.lh[s] += r.lastHitsBySkin[s];
      total.pres[s] += r.skinPresence[s];
      per.dmg[s] = (per.dmg[s] || 0) + r.dmgBySkin[s];
      per.deaths[s] = (per.deaths[s] || 0) + r.deathsBySkin[s];
      per.score[s] = (per.score[s] || 0) + r.scoreBySkin[s];
      per.pm[s] = (per.pm[s] || 0) + r.skinPresence[s] * r.minutes;
    }
  }
  const avg = total.minutes / MATCHES;
  mins.sort((a, b) => a - b);
  console.log(`KORONA balans: ${MATCHES} meczów (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(`Średni czas meczu: ${avg.toFixed(2)} min (mediana ${mins[Math.floor(MATCHES / 2)].toFixed(2)}, min ${mins[0].toFixed(2)}, max ${mins[MATCHES - 1].toFixed(2)})`);
  console.log(`Zakończenia: ${JSON.stringify(total.reasons)}`);
  console.log('Średni czas meczu per mapa:');
  for (const [m, xs] of Object.entries(byMap)) console.log(`  ${m.padEnd(11)} ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)} min  (${xs.length} meczów)`);
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
  console.log('Klasy (na gracza-minutę: obrażenia w bossa, śmierci; średnie pkt na mecz):');
  for (const s of SKIN_IDS) {
    const pm = per.pm[s] || 1;
    console.log(`  ${s.padEnd(12)} dmg/min ${(per.dmg[s] / pm).toFixed(1).padStart(6)}  śmierci/min ${(per.deaths[s] / pm).toFixed(2)}  pkt/mecz ${(per.score[s] / Math.max(1, total.pres[s])).toFixed(1)}`);
  }
  const okTime = avg >= 4 && avg <= 10;
  const okShare = worst <= 0.35;
  console.log(`\nBramki: czas meczu 4–10 min: ${okTime ? 'OK' : 'POZA'}; max udział skina ≤35%: ${okShare ? 'OK' : 'POZA'}`);
  process.exitCode = okTime && okShare ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
