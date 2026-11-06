import { SCORE, MATCH, HERO, BOSS_COMMON, BOSSES, BOSS_IDS, RARITY, CASE } from './config.js';
import { spawnPoint } from './state.js';
import { resolveStatic } from './physics.js';
import { onModeBossKilled, onModeHeroKilled, scaleModeBoss } from './modes.js';

/** @typedef {import('./state.js').MatchState} MatchState */
/** @typedef {import('./state.js').Player} Player */
/** @typedef {import('./rng.js').Rng} Rng */

/** Waga losowania typu wg rzadkości. @param {string} type */
export const bossWeight = (type) => RARITY[/** @type {keyof typeof RARITY} */ (/** @type {any} */ (BOSSES)[type].rarity)]?.weight ?? 1;

/** Losowanie ważone rzadkością. @param {Rng} rng @param {string[]} pool */
function weightedPick(rng, pool) {
  const total = pool.reduce((a, t) => a + bossWeight(t), 0);
  let x = rng.next() * total;
  for (const t of pool) {
    x -= bossWeight(t);
    if (x < 0) return t;
  }
  return pool[pool.length - 1];
}

/**
 * Losuje typ bossa (ważony rzadkością, bez powtórki poprzedniego) i taśmę
 * „skrzynki” w stylu CS2: karta `win` to wylosowany boss, `offset` to miejsce zatrzymania w karcie.
 * @param {Rng} rng @param {string|null} lastType
 * @returns {{type:string, strip:string[], win:number, offset:number}}
 */
export function drawBossType(rng, lastType) {
  const pool = BOSS_IDS.filter((t) => t !== lastType);
  const type = weightedPick(rng, pool);
  const strip = [];
  for (let i = 0; i < CASE.stripLength; i++) strip.push(i === CASE.winIndex ? type : weightedPick(rng, pool));
  const offset = 0.12 + rng.next() * 0.76;
  return { type, strip, win: CASE.winIndex, offset: Math.round(offset * 1000) / 1000 };
}

/** HP bossa = 120 × liczba bohaterów × mnożnik typu. @param {MatchState} state @param {string} bossId @param {string} type */
export function bossMaxHp(state, bossId, type) {
  const heroes = state.players.filter((p) => p.id !== bossId && p.connected && !p.dnf && !p.ai).length;
  return Math.round(BOSS_COMMON.hpPerHero * Math.max(1, heroes) * BOSSES[/** @type {keyof typeof BOSSES} */ (type)].hpMul);
}

/** Rozpoczyna slow-mo i ruletkę. @param {MatchState} state @param {Rng} rng */
export function startTransition(state, rng, newBossId, prevBossId, bonus) {
  const { type, strip, win, offset } = drawBossType(rng, state.lastBossType);
  state.crown.state = 'held';
  state.crown.holderId = newBossId;
  state.transition = { t: MATCH.transitionTime, total: MATCH.transitionTime, newBossId, prevBossId, bossType: type, strip, win, offset, bonus };
  state.phase = 'transition';
  state.events.push({ t: 'crownTaken', id: newBossId, prev: prevBossId, bossType: type, bonus });
}

/** Kończy przejście: poprzedni boss staje się bohaterem, nowy — bossem. @param {MatchState} state @param {Rng} rng */
export function finishTransition(state, rng) {
  const tr = state.transition;
  if (!tr) return;
  const prev = tr.prevBossId ? state.players.find((p) => p.id === tr.prevBossId) : null;
  if (prev) demoteToHero(state, prev, rng);
  const nb = state.players.find((p) => p.id === tr.newBossId);
  state.transition = null;
  state.zones = [];
  state.minions = [];
  state.projectiles = state.projectiles.filter((pr) => pr.team === 'hero');
  if (!nb || !nb.connected) {
    dropCrown(state);
    state.phase = 'playing';
    return;
  }
  promoteToBoss(state, nb, tr.bossType);
  if (nb.ai) scaleModeBoss(state, nb);
  state.lastBossType = tr.bossType;
  for (const p of state.players) p.dmgToBoss = 0;
  state.phase = 'playing';
}

/** @param {MatchState} state @param {Player} p @param {string} type */
export function promoteToBoss(state, p, type) {
  const maxHp = bossMaxHp(state, p.id, type);
  p.boss = {
    type,
    hp: maxHp,
    maxHp,
    reign: 0,
    cd: { atk: 0, q: 1, e: 1, r: 1 },
    cast: null,
    channel: null,
    hits: 0,
    overloaded: false,
    invisT: 0,
    dying: false,
    passiveT: 0,
  };
  p.alive = true;
  p.hp = HERO.hp;
  p.dashT = 0;
  p.abilT = 0;
  p.stunT = 0;
  p.kx = p.ky = 0;
  p.invulnT = 0;
  state.turrets = state.turrets.filter((t) => t.ownerId !== p.id);
  resolveStatic(p, HERO.radius * BOSS_COMMON.radiusMul);
}

/** @param {MatchState} state @param {Player} p @param {Rng} rng */
export function demoteToHero(state, p, rng) {
  p.boss = null;
  respawnHero(state, p, rng, HERO.formerBossInvuln);
}

/** @param {MatchState} state @param {Player} p @param {Rng} rng @param {number} invuln */
export function respawnHero(state, p, rng, invuln) {
  const [x, y] = spawnPoint(rng.int(MATCH.spawnCount), state.mapId);
  p.x = x;
  p.y = y;
  p.hp = p.maxHp ?? HERO.hp;
  p.alive = true;
  p.respawnT = 0;
  p.vx = 0;
  p.vy = 0;
  p.invulnT = invuln;
  p.kx = p.ky = 0;
  p.stunT = 0;
  p.slowT = 0;
  p.abilT = 0;
  p.buffT = 0;
  p.buffMult = 1;
  state.events.push({ t: 'respawn', id: p.id, x, y });
}

/** Ostatni cios w bossa. @param {MatchState} state @param {Player} bossP @param {string} killerId */
export function onBossKilled(state, bossP, killerId) {
  if (state.mode && state.mode !== 'crown') return onModeBossKilled(state, bossP, killerId);
  const b = /** @type {import('./state.js').BossState} */ (bossP.boss);
  b.dying = true;
  b.cast = null;
  b.channel = null;
  const killer = state.players.find((p) => p.id === killerId && !p.boss);
  for (const p of state.players) {
    if (p.boss || p.id === killerId) continue;
    if (p.dmgToBoss >= SCORE.assistThreshold * b.maxHp) {
      p.score += SCORE.assist;
      state.events.push({ t: 'assist', id: p.id });
    }
  }
  if (killer) {
    killer.score += SCORE.lastHit;
    killer.lastHits += 1;
    state.events.push({ t: 'lastHit', id: killer.id, boss: bossP.id, bossType: b.type });
    startTransitionRng(state, killer.id, bossP.id, true);
  } else {
    dropCrownAfterBossDeath(state, bossP);
  }
}

/** Ustawiany przez step.js — rules nie zna RNG poza krokiem. */
let currentRng = /** @type {Rng|null} */ (null);
/** @param {Rng|null} rng */
export const bindRng = (rng) => {
  currentRng = rng;
};
function startTransitionRng(state, newId, prevId, bonus) {
  if (!currentRng) throw new Error('rng not bound');
  startTransition(state, currentRng, newId, prevId, bonus);
}

/** @param {MatchState} state @param {Player} bossP */
function dropCrownAfterBossDeath(state, bossP) {
  if (!currentRng) throw new Error('rng not bound');
  demoteToHero(state, bossP, currentRng);
  dropCrown(state);
}

/** Bohater zginął. @param {MatchState} state @param {Player} h @param {string|null} sourceId */
export function onHeroKilled(state, h, sourceId) {
  h.alive = false;
  h.hp = 0;
  h.respawnT = HERO.respawnTime;
  if (state.mode && state.mode !== 'crown') onModeHeroKilled(state, h);
  h.deaths += 1;
  h.abilT = 0;
  h.dashT = 0;
  state.events.push({ t: 'heroDie', id: h.id, x: h.x, y: h.y, by: sourceId });
  const src = sourceId ? state.players.find((p) => p.id === sourceId) : null;
  if (src && src.boss) {
    src.score += SCORE.bossKillsHero;
    src.bossKills += 1;
    const heal = /** @type {any} */ (BOSSES)[src.boss.type].passive?.healOnKill;
    if (heal && !src.boss.dying) src.boss.hp = Math.min(src.boss.maxHp, src.boss.hp + heal * src.boss.maxHp);
  }
}

/** Korona upada na środek. @param {MatchState} state */
export function dropCrown(state) {
  state.crown = { state: 'center', holderId: null, x: 0, y: 0 };
  state.zones = [];
  state.minions = [];
  state.transition = null;
  state.events.push({ t: 'crownDrop' });
}

/** Podniesienie korony ze środka (bez bonusu). @param {MatchState} state @param {Rng} rng */
export function checkCrownPickup(state, rng) {
  if (state.mode && state.mode !== 'crown') return;
  if (state.crown.state !== 'center' || state.phase !== 'playing') return;
  for (const p of state.players) {
    if (!p.alive || p.boss || !p.connected) continue;
    if (Math.hypot(p.x - state.crown.x, p.y - state.crown.y) <= MATCH.crownPickupRadius + HERO.radius) {
      startTransition(state, rng, p.id, null, false);
      return;
    }
  }
}

/** +1 pkt za każdą sekundę w koronie. @param {MatchState} state @param {number} dt */
export function accrueCrownTime(state, dt) {
  if (state.mode && state.mode !== 'crown') return;
  for (const p of state.players) {
    if (!p.boss || p.boss.dying) continue;
    p.boss.reign += dt;
    p.crownTime += dt;
    p.crownAcc += dt;
    while (p.crownAcc >= SCORE.crownInterval) {
      p.crownAcc -= SCORE.crownInterval;
      p.score += SCORE.perCrownSecond;
    }
  }
}

/** Lider: najwięcej punktów, potem czas w koronie, potem id. @param {MatchState} state */
export function leader(state) {
  const eligible = state.players.filter((p) => !p.dnf && !p.ai);
  const list = eligible.length ? eligible : state.players;
  return [...list].sort((a, b) => b.score - a.score || b.crownTime - a.crownTime || (a.id < b.id ? -1 : 1))[0] || null;
}

/** @param {MatchState} state */
export function checkWin(state) {
  if (state.phase === 'ended') return;
  if (state.mode && state.mode !== 'crown') return;
  const winner = state.players.find((p) => !p.dnf && p.score >= state.targetScore);
  if (winner) return endMatch(state, winner.id, 'score');
  if (state.matchTime >= state.timeLimit) return endMatch(state, leader(state)?.id ?? null, 'time');
  const connected = state.players.filter((p) => p.connected && !p.dnf);
  if (connected.length < 2 && state.players.length >= 2) return endMatch(state, leader(state)?.id ?? null, 'forfeit');
}

/** @param {MatchState} state @param {string|null} winnerId @param {string} reason */
export function endMatch(state, winnerId, reason) {
  state.phase = 'ended';
  state.winnerId = winnerId;
  state.endReason = reason;
  state.events.push({ t: 'matchEnd', winner: winnerId, reason });
}

/**
 * Gracz wyszedł z meczu: DNF, wynik zostaje w tabeli. Jeśli był bossem — korona upada.
 * @param {MatchState} state @param {string} id
 */
export function disconnectPlayer(state, id) {
  const p = state.players.find((x) => x.id === id);
  if (!p || !p.connected) return;
  p.connected = false;
  p.dnf = true;
  p.alive = false;
  const wasBoss = !!p.boss || state.transition?.newBossId === id;
  p.boss = null;
  state.turrets = state.turrets.filter((t) => t.ownerId !== id);
  state.projectiles = state.projectiles.filter((pr) => pr.ownerId !== id);
  if (state.transition?.prevBossId === id) state.transition.prevBossId = null;
  if (wasBoss) {
    dropCrown(state);
    if (state.phase === 'transition') state.phase = 'playing';
  }
  state.events.push({ t: 'leave', id });
  checkWin(state);
}
