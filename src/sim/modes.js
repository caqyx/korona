/**
 * Tryby z botami (lokalnie):
 *  - survival: fale przeciwników, co 5. fala boss (AI), między falami wybór ulepszeń, koniec gdy zginą wszyscy;
 *  - bossrush: 8 bossów (AI) po kolei, każdy silniejszy, losowanych skrzynką; ulepszenia między bossami.
 * Boss sterowany przez AI to gracz z flagą `ai` (id 'AI') — korzysta z tych samych kitów bossów.
 */
import { MODES, MINIONS, UPGRADE_IDS, BOSS_IDS, BOSS_COMMON, BOSSES, bossrushLives } from './config.js';
import { createPlayer, heroMaxHp } from './state.js';
import { round3 } from './vec.js';
import { startTransition, respawnHero, endMatch, leader, topDamageDealer, promoteToBoss, drawBossType, resetClaims } from './rules.js';
import { makeRng } from './rng.js';
import { spawnWaveMinion } from './minions.js';
import { edgePoint } from './physics.js';
import { addZone } from './zones.js';

export const AI_ID = 'AI';

/** Uczestnicy-bohaterowie (bez AI). @param {any} state */
export const heroesOf = (state) => state.players.filter((p) => !p.ai && p.connected && !p.dnf);

/** Przygotowanie stanu trybu (wywoływane w createMatchState). @param {any} state */
export function initMode(state) {
  if (state.mode === 'crown') return;
  if (state.mode === 'teams') return initTeams(state);
  const ai = createPlayer(AI_ID, 'Boss', 'rycerz', state.players.length, state.mapId);
  ai.ai = true;
  ai.alive = false;
  ai.benched = true;
  state.players.push(ai);
  state.crown = { state: 'none', holderId: null, x: 0, y: 0 };
  state.modeData = state.mode === 'survival' ? { wave: 0, stage: 'pre', t: 1, queue: [], pending: [], spawnT: 0, kills: 0, bossWave: false, hpMul: 1 } : bossrushData(state);
}

/**
 * Stan Boss Rush. `lives`/`livesMax` — pula „drugich szans” drużyny (kontrakt HUD: liczby całkowite ≥ 0);
 * `downed` — trwa już rozliczona wspólna śmierć (do pierwszego odrodzenia nie zabiera kolejnego życia).
 * @param {any} state
 */
function bossrushData(state) {
  const lives = bossrushLives(heroesOf(state).length);
  return { stage: 'pre', t: 1, defeated: 0, total: MODES.bossrush.bosses, kills: 0, lives, livesMax: lives, downed: false };
}

/** Krok trybu (po aktualizacji świata). @param {any} state @param {number} dt @param {import('./rng.js').Rng} rng */
export function modeStep(state, dt, rng) {
  if (state.phase !== 'playing' || !state.mode || state.mode === 'crown' || !state.modeData) return;
  if (state.mode === 'teams') return teamsStep(state);
  if (state.mode === 'survival') survivalStep(state, dt, rng);
  else if (state.mode === 'bossrush') bossrushStep(state, dt, rng);
  checkWipe(state);
}

/**
 * Wszyscy bohaterowie martwi jednocześnie (w trakcie walki) = koniec — chyba że Boss Rush ma jeszcze
 * „drugą szansę”: wtedy drużyna traci jedno życie i odradza się normalnie.
 * @param {any} state
 */
function checkWipe(state) {
  const md = state.modeData;
  if (md.stage === 'intermission' || md.stage === 'pre') return;
  const heroes = heroesOf(state);
  if (!heroes.length) return;
  if (heroes.some((h) => h.alive)) {
    md.downed = false;
    return;
  }
  if (md.downed || spendLife(state)) return;
  md.result = state.mode === 'survival' ? { wave: md.wave, kills: md.kills } : { defeated: md.defeated, kills: md.kills };
  endMatch(state, leader(state)?.id ?? null, 'wipe');
}

/**
 * Zużywa „drugą szansę” (tylko Boss Rush): odejmuje życie i oznacza wspólną śmierć jako rozliczoną —
 * bohaterowie wracają zwykłym odliczaniem `MODES.bossrush.respawn`.
 * @param {any} state @returns {boolean} czy życie zostało zużyte (mecz trwa dalej)
 */
function spendLife(state) {
  const md = state.modeData;
  if (state.mode !== 'bossrush' || !(md.lives > 0)) return false;
  md.lives -= 1;
  md.downed = true;
  state.events.push({ t: 'lifeLost', left: md.lives });
  return true;
}

// --- Przetrwanie -------------------------------------------------------------

/** Skład fali: budżet punktowy rozdzielany losowo między typy dostępne od danej fali. */
export function buildWave(n, heroCount, rng) {
  const C = MODES.survival;
  const scale = 0.6 + 0.4 * Math.max(1, heroCount);
  const bossWave = n % C.bossEvery === 0;
  let budget = Math.round((C.budgetBase + n * C.budgetPerWave) * scale * (bossWave ? 0.4 : 1));
  const kinds = Object.entries(MINIONS).filter(([, c]) => n >= c.minWave);
  const queue = [];
  while (budget > 0 && queue.length < 60) {
    const affordable = kinds.filter(([, c]) => c.cost <= budget);
    if (!affordable.length) break;
    const [kind, c] = affordable[rng.int(affordable.length)];
    queue.push(kind);
    budget -= c.cost;
  }
  return { queue, bossWave };
}

function survivalStep(state, dt, rng) {
  const md = state.modeData;
  const C = MODES.survival;
  md.t -= dt;
  if (md.stage === 'pre') {
    if (md.t <= 0) beginWave(state, rng);
    return;
  }
  if (md.stage === 'intermission') {
    if (md.t <= 0 || allPicked(state)) endIntermission(state, rng, C.preWave);
    return;
  }
  // walka: wypuszczanie kolejnych wrogów z telegrafem w miejscu pojawienia
  md.spawnT -= dt;
  if (md.queue.length && md.spawnT <= 0) {
    md.spawnT = C.spawnEvery;
    const kind = md.queue.shift();
    const [x, y] = edgePoint(rng);
    addZone(state, { kind: 'spawn', shape: 'circle', ownerId: null, x, y, r: MINIONS[kind].radius + 0.4, warn: C.spawnTelegraph, life: 0, dmg: 0 });
    md.pending.push({ kind, x, y, t: C.spawnTelegraph });
  }
  for (const p of md.pending) p.t -= dt;
  for (const p of md.pending.filter((q) => q.t <= 0)) spawnWaveMinion(state, p.kind, p.x, p.y, md.hpMul);
  md.pending = md.pending.filter((q) => q.t > 0);
  const bossAlive = state.players.some((p) => p.ai && p.boss && !p.boss.dying) || state.phase === 'transition';
  if (!md.queue.length && !md.pending.length && !state.minions.length && !bossAlive) waveCleared(state, rng);
}

function beginWave(state, rng) {
  const md = state.modeData;
  md.wave += 1;
  md.hpMul = 1 + MODES.survival.hpPerWave * (md.wave - 1);
  const { queue, bossWave } = buildWave(md.wave, heroesOf(state).length, rng);
  md.queue = queue;
  md.pending = [];
  md.spawnT = 0.3;
  md.bossWave = bossWave;
  md.stage = 'fight';
  state.events.push({ t: 'wave', n: md.wave, boss: bossWave });
  if (bossWave) startTransition(state, rng, AI_ID, null, false);
}

function waveCleared(state, rng) {
  const md = state.modeData;
  for (const h of heroesOf(state)) if (h.alive) h.score += MODES.survival.waveClearScore;
  state.events.push({ t: 'waveClear', n: md.wave });
  startIntermission(state, rng, MODES.survival.intermission);
}

// --- Boss Rush -------------------------------------------------------------

function bossrushStep(state, dt, rng) {
  const md = state.modeData;
  md.t -= dt;
  if (md.stage === 'pre') {
    if (md.t <= 0) {
      md.stage = 'fight';
      state.events.push({ t: 'bossStage', n: md.defeated + 1, total: md.total });
      startTransition(state, rng, AI_ID, null, false);
    }
    return;
  }
  if (md.stage === 'intermission' && (md.t <= 0 || allPicked(state))) endIntermission(state, rng, MODES.bossrush.preBoss);
}

// --- wspólne -------------------------------------------------------------

/** Boss AI zginął. @param {any} state @param {any} bossP @param {string} killerId */
export function onModeBossKilled(state, bossP, killerId) {
  if (state.mode === 'teams') return teamsBossKilled(state, bossP, killerId);
  const md = state.modeData;
  const b = bossP.boss;
  b.dying = true;
  b.cast = null;
  b.channel = null;
  const killer = topDamageDealer(state, killerId);
  if (killer) {
    killer.lastHits += 1;
    killer.score += state.mode === 'survival' ? MODES.survival.bossScore : MODES.bossrush.killScore;
    state.events.push({ t: 'lastHit', id: killer.id, killer: killerId, pct: Math.round((killer.dmgToBoss / Math.max(1, b.maxHp)) * 100), boss: bossP.id, bossType: b.type });
  }
  resetClaims(state);
  state.events.push({ t: 'bossDie', x: bossP.x, y: bossP.y, bossType: b.type });
  bossP.boss = null;
  bossP.alive = false;
  bossP.benched = true;
  bossP.respawnT = 0;
  state.lastBossType = b.type;
  state.zones = state.zones.filter((z) => z.ownerId !== bossP.id);
  state.projectiles = state.projectiles.filter((p) => p.team === 'hero');
  if (state.mode === 'bossrush') {
    md.defeated += 1;
    state.minions = [];
    if (md.defeated >= md.total) {
      md.result = { defeated: md.defeated, kills: md.kills, victory: true };
      endMatch(state, leader(state)?.id ?? null, 'victory');
      return;
    }
    startIntermission(state, currentRng(), MODES.bossrush.intermission);
  }
}

let rngRef = null;
/** RNG wiązany przez step (jak w rules.js). */
export const bindModeRng = (r) => {
  rngRef = r;
};
const currentRng = () => {
  if (!rngRef) throw new Error('rng not bound');
  return rngRef;
};

/** Skalowanie bossa AI po zakończeniu ruletki. @param {any} state @param {any} p */
export function scaleModeBoss(state, p) {
  const md = state.modeData;
  const heroes = heroesOf(state).length;
  const survival = state.mode === 'survival';
  const mul = survival ? 0.5 + 0.12 * md.wave : 1 + MODES.bossrush.hpGrowth * md.defeated;
  const cdMul = survival ? 1 : Math.max(MODES.bossrush.minCdMul, 1 - MODES.bossrush.cdShrink * md.defeated);
  const base = BOSS_COMMON.hpPerHero * Math.max(1, heroes);
  p.boss.maxHp = Math.round(base * mul * (p.boss.maxHp / Math.max(1, base)));
  p.boss.hp = p.boss.maxHp;
  p.boss.cdMul = round3(cdMul);
  p.x = 0;
  p.y = 0;
}

/**
 * Bohater zginął w trybie: Boss Rush — odrodzenie po 5 s; Przetrwanie — na fali z bossem odrodzenie po
 * `bossWaveRespawn` s, na zwykłej „na ławce” do przerwy (flaga `benched` zamiast `respawnT = Infinity`:
 * Infinity nie przechodzi przez JSON, a snapshot musi).
 */
export function onModeHeroKilled(state, h) {
  if (state.mode === 'teams') return;
  if (state.mode === 'bossrush') h.respawnT = MODES.bossrush.respawn;
  else if (state.modeData.bossWave) h.respawnT = MODES.survival.bossWaveRespawn;
  else {
    h.benched = true;
    h.respawnT = 0;
  }
}

function startIntermission(state, rng, seconds) {
  const md = state.modeData;
  md.stage = 'intermission';
  md.t = seconds;
  state.zones = [];
  state.projectiles = state.projectiles.filter((p) => p.team === 'hero');
  state.offers = {};
  for (const h of heroesOf(state)) {
    if (!h.alive) respawnHero(state, h, rng, 2);
    h.hp = heroMaxHp(h);
    const pool = [...UPGRADE_IDS];
    const choices = [];
    for (let i = 0; i < 3; i++) choices.push(pool.splice(rng.int(pool.length), 1)[0]);
    state.offers[h.id] = { choices, sel: 1, picked: null, lastDir: 0 };
  }
  state.events.push({ t: 'intermission', seconds });
}

function allPicked(state) {
  return Object.values(state.offers || {}).every((o) => o.picked !== null);
}

function endIntermission(state, rng, preT) {
  const md = state.modeData;
  // nie wybrane — zostaje zaznaczona karta
  for (const h of heroesOf(state)) {
    const o = state.offers?.[h.id];
    if (o && o.picked === null) autoPick(state, h, o);
  }
  state.offers = null;
  md.stage = 'pre';
  md.t = preT;
}

function autoPick(state, h, o) {
  o.picked = o.choices[o.sel];
  state.events.push({ t: 'upgradeAuto', id: h.id, upg: o.picked });
  applyUpgradeEffect(h, o.picked);
}

/** Efekt ulepszenia (bez zdarzeń) — współdzielony z heroes/index applyUpgrade. */
export function applyUpgradeEffect(h, id) {
  const m = (h.mods ||= { dmg: 1, cd: 1, spd: 1, dashCd: 1, range: 1 });
  if (id === 'vit') {
    h.maxHp = heroMaxHp(h) + 1;
    h.hp = h.maxHp;
  } else if (id === 'dmg') m.dmg = round3(m.dmg * 1.2);
  else if (id === 'cd') m.cd = round3(m.cd * 0.85);
  else if (id === 'spd') m.spd = round3(m.spd * 1.1);
  else if (id === 'dash') m.dashCd = round3(m.dashCd * 0.75);
  else if (id === 'range') m.range = round3(m.range * 1.25);
}

export { BOSS_IDS };

// --- Bitwa bossów (drużyny) -------------------------------------------------

/** Dwie drużyny, w każdej jeden boss (gracz z `wantsBoss` albo losowy), różne typy bossów. @param {any} state */
function initTeams(state) {
  const rng = makeRng(state.rng);
  state.crown = { state: 'none', holderId: null, x: 0, y: 0 };
  const bossIds = [null, null];
  let lastType = null;
  for (const team of [0, 1]) {
    const members = state.players.filter((p) => p.team === team);
    if (!members.length) continue;
    const boss = members.find((p) => p.wantsBoss) || members[rng.int(members.length)];
    const { type } = drawBossType(rng, lastType);
    lastType = type;
    promoteToBoss(state, boss, type);
    const enemies = state.players.filter((p) => p.team !== team && p.connected).length - 1;
    boss.boss.maxHp = Math.round(BOSS_COMMON.hpPerHero * Math.max(1, enemies) * MODES.teams.hpMul * (BOSSES[type]?.hpMul ?? 1));
    boss.boss.hp = boss.boss.maxHp;
    // drużyny startują po przeciwnych stronach areny, boss z tyłu swojej drużyny
    const side = team === 0 ? -1 : 1;
    boss.x = side * 9;
    boss.y = 0;
    members
      .filter((m) => m !== boss)
      .forEach((m, i, arr) => {
        m.x = side * 5;
        m.y = (i - (arr.length - 1) / 2) * 2.2;
        m.fx = -side;
        m.fy = 0;
      });
    bossIds[team] = boss.id;
  }
  state.modeData = { bossIds, names: MODES.teams.teamNames };
}

function teamsBossKilled(state, bossP, killerId) {
  const b = bossP.boss;
  b.dying = true;
  b.cast = null;
  b.channel = null;
  const top = topDamageDealer(state, killerId);
  if (top) {
    top.score += MODES.teams.killScore;
    top.lastHits += 1;
    state.events.push({ t: 'lastHit', id: top.id, killer: killerId, pct: Math.round((top.dmgToBoss / Math.max(1, b.maxHp)) * 100), boss: bossP.id, bossType: b.type });
  }
  state.events.push({ t: 'bossDie', x: bossP.x, y: bossP.y, bossType: b.type });
  const winnerTeam = bossP.team === 0 ? 1 : 0;
  finishTeams(state, winnerTeam, 'boss');
}

function teamsStep(state) {
  const md = state.modeData;
  // boss rozłączony = jego drużyna przegrywa
  for (const team of [0, 1]) {
    const id = md.bossIds[team];
    const p = id && state.players.find((x) => x.id === id);
    if (id && (!p || !p.connected || !p.boss)) return finishTeams(state, team === 0 ? 1 : 0, 'forfeit');
  }
  if (state.matchTime >= state.timeLimit) {
    const pct = (team) => {
      const p = state.players.find((x) => x.id === md.bossIds[team]);
      return p?.boss ? p.boss.hp / p.boss.maxHp : 0;
    };
    finishTeams(state, pct(1) > pct(0) ? 1 : 0, 'time');
  }
}

function finishTeams(state, winnerTeam, reason) {
  state.winnerTeam = winnerTeam;
  const best = state.players.filter((p) => p.team === winnerTeam).sort((a, b) => b.score - a.score)[0];
  endMatch(state, best?.id ?? null, reason);
}
