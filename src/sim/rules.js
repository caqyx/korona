import { SCORE, MATCH, HERO, BOSS_COMMON, BOSSES, BOSS_IDS, RARITY, CASE, CLAIM } from './config.js';
import { spawnPoint, heroMaxHp } from './state.js';
import { round3 } from './vec.js';
import { resolveStatic } from './physics.js';
import { onModeBossKilled, onModeHeroKilled, scaleModeBoss } from './modes.js';

/** @typedef {import('./state.js').MatchState} MatchState */
/** @typedef {import('./state.js').Player} Player */
/** @typedef {import('./rng.js').Rng} Rng */

/** Tryb Korony (stan bez pola `mode` też jest Koroną). @param {{mode?: string}} state */
const isCrownMode = (state) => !state.mode || state.mode === 'crown';

/**
 * Bohaterowie liczący się w ekonomii korony: podłączeni, bez DNF, nie boss i nie AI
 * (martwi czekający na odrodzenie też się liczą).
 * @param {MatchState} state
 */
export const crownHeroes = (state) => state.players.filter((p) => !p.boss && !p.ai && p.connected && !p.dnf);

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
  return { type, strip, win: CASE.winIndex, offset: round3(offset) };
}

/** HP bossa = BOSS_COMMON.hpPerHero (140) × liczba bohaterów × mnożnik typu. @param {MatchState} state @param {string} bossId @param {string} type */
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
  // roszczenia przenoszą się tylko po śmierci bossa w Koronie; HP pokonanego trzeba odczytać, zanim przestanie być bossem
  const oldMaxHp = isCrownMode(state) && tr.bonus && prev?.boss ? prev.boss.maxHp : 0;
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
  carryClaims(state, nb, prev, oldMaxHp);
  state.phase = 'playing';
}

/**
 * Początek nowego panowania: bohater, który nie przejął korony i nie był pokonanym bossem,
 * zaczyna z roszczeniem `CLAIM.carry` × swój udział ŚWIEŻYCH obrażeń w HP poprzedniego bossa × HP nowego
 * (pole `claim0`). Roszczenie przeniesione wcześniej nie jest bazą — nie przechodzi kaskadowo dalej.
 * Nowy boss, były boss i wszyscy przy `oldMaxHp = 0` (korona podniesiona ze środka, tryby z AI) zaczynają od zera.
 * `dmgTotal` (statystyka) nie jest ruszane — przeniesione roszczenie to nie zadane obrażenia.
 * @param {MatchState} state @param {Player} newBoss @param {Player|null|undefined} prevBoss @param {number} oldMaxHp
 */
function carryClaims(state, newBoss, prevBoss, oldMaxHp) {
  const newMaxHp = newBoss.boss ? newBoss.boss.maxHp : 0;
  for (const p of state.players) {
    const carries = oldMaxHp > 0 && p !== newBoss && p !== prevBoss && !p.ai && p.connected && !p.dnf;
    p.claim0 = carries ? round3(CLAIM.carry * (freshDamage(p) / oldMaxHp) * newMaxHp) : 0;
    p.dmgToBoss = p.claim0;
  }
}

/** Obrażenia zadane bossowi w bieżącym panowaniu, bez roszczenia przeniesionego z poprzedniego. @param {Player} p */
const freshDamage = (p) => p.dmgToBoss - p.claim0;

/** Zeruje roszczenia do korony (upadek korony, koniec bossa w trybach z AI). @param {MatchState} state */
export function resetClaims(state) {
  for (const p of state.players) {
    p.dmgToBoss = 0;
    p.claim0 = 0;
  }
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
  p.benched = false;
  p.respawnT = 0;
  p.hp = heroMaxHp(p);
  if (!p.ai) p.bossTypes = (p.bossTypes || []).includes(type) ? p.bossTypes : [...(p.bossTypes || []), type];
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
  let [x, y] = spawnPoint(rng.int(MATCH.spawnCount), state.mapId);
  // drużyny: odrodzenie po swojej stronie areny
  if (p.team !== undefined && Math.sign(x) !== (p.team === 0 ? -1 : 1)) x = -x;
  p.x = x;
  p.y = y;
  p.hp = heroMaxHp(p);
  p.alive = true;
  p.benched = false;
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

/**
 * Bohater z największym roszczeniem (`dmgToBoss` = obrażenia w bieżącym panowaniu + przeniesione `claim0`);
 * remis: zabójca, potem id. To on przejmuje koronę — nie ten, kto zadał ostatni cios.
 * @param {MatchState} state @param {string} killerId
 */
export function topDamageDealer(state, killerId) {
  let best = null;
  for (const p of state.players) {
    if (p.boss || p.ai || !p.connected || p.dnf || p.dmgToBoss <= 0) continue;
    if (!best || p.dmgToBoss > best.dmgToBoss + 1e-9) best = p;
    else if (Math.abs(p.dmgToBoss - best.dmgToBoss) <= 1e-9 && (p.id === killerId || (best.id !== killerId && p.id < best.id))) best = p;
  }
  return best;
}

/**
 * Próg asysty jako część maks. HP bossa: zwykle `assistThreshold`, ale przy wielu bohaterach
 * nie więcej niż `assistPool / bohaterowie` (inaczej w 6–8 osób asysta byłaby prawie nieosiągalna).
 * @param {number} heroes liczba bohaterów uprawnionych w chwili śmierci bossa
 */
export const assistShare = (heroes) => Math.min(SCORE.assistThreshold, SCORE.assistPool / Math.max(1, heroes));

/**
 * Boss pokonany: koronę i +10 dostaje gracz z największym roszczeniem; asystę (+2) pozostali,
 * którzy w TYM panowaniu zadali dość świeżych obrażeń (przeniesione roszczenie się nie liczy).
 * @param {MatchState} state @param {Player} bossP @param {string} killerId
 */
export function onBossKilled(state, bossP, killerId) {
  if (!isCrownMode(state)) return onModeBossKilled(state, bossP, killerId);
  const b = /** @type {import('./state.js').BossState} */ (bossP.boss);
  b.dying = true;
  b.cast = null;
  b.channel = null;
  const top = topDamageDealer(state, killerId);
  const heroes = crownHeroes(state);
  const need = assistShare(heroes.length) * b.maxHp;
  for (const p of heroes) {
    if (top && p.id === top.id) continue;
    if (freshDamage(p) >= need - 1e-9) {
      p.score += SCORE.assist;
      state.events.push({ t: 'assist', id: p.id });
    }
  }
  if (top) {
    top.score += SCORE.lastHit;
    top.lastHits += 1;
    const pct = Math.round((top.dmgToBoss / Math.max(1, b.maxHp)) * 100);
    state.events.push({ t: 'lastHit', id: top.id, killer: killerId, pct, boss: bossP.id, bossType: b.type });
    startTransitionRng(state, top.id, bossP.id, true);
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
  if (!isCrownMode(state)) onModeHeroKilled(state, h);
  h.deaths += 1;
  h.abilT = 0;
  h.dashT = 0;
  const src = sourceId ? state.players.find((p) => p.id === sourceId) : null;
  const pts = src && src.boss ? creditBossKill(state, src) : 0;
  state.events.push({ t: 'heroDie', id: h.id, x: h.x, y: h.y, by: sourceId, pts });
}

/**
 * Wartość (w punktach, bywa ułamkowa) zabójstwa bohatera przez bossa. W Koronie do `killRefHeroes` bohaterów
 * pełne `bossKillsHero`, powyżej proporcjonalnie mniej (więcej celów = więcej zabójstw; bez tego punkty
 * bossa/min rosły z liczbą graczy). Czyta tylko `mode` i pola graczy (`boss`, `ai`, `connected`, `dnf`),
 * więc działa także na widoku/snapshocie o kształcie stanu (HUD).
 * @param {{mode?: string, players: {boss?: any, ai?: boolean, connected: boolean, dnf: boolean}[]}} state
 */
export function bossKillValue(state) {
  if (!isCrownMode(state)) return SCORE.bossKillsHero;
  const heroes = crownHeroes(/** @type {any} */ (state)).length;
  return SCORE.bossKillsHero * Math.min(1, SCORE.killRefHeroes / Math.max(1, heroes));
}

/** Wartość zabójstwa w jednostkach licznika `killAcc` (1/SCORE.killUnits punktu) — liczba całkowita. @param {MatchState} state */
const bossKillUnits = (state) => Math.round(bossKillValue(state) * SCORE.killUnits);

/**
 * Boss (lub jego minion/strefa) zabił bohatera: statystyka, punkty i pasywka „leczenie za zabójstwo”.
 * Ułamki punktów zbiera `killAcc` — całkowity licznik w jednostkach 1/SCORE.killUnits punktu, więc suma jest
 * dokładna (7 zabójstw po 6/7 pkt = 6 pkt) i nie dryfuje w snapshotach; do `score` trafiają tylko całe punkty.
 * Boss już pokonany (`dying`, trwa przejście korony) nie zarabia punktów ani leczenia — zabójstwo
 * liczy się mu tylko w statystyce `bossKills`.
 * @param {MatchState} state @param {Player} bossP
 * @returns {number} całe punkty dopisane do wyniku tym zabójstwem
 */
function creditBossKill(state, bossP) {
  const b = /** @type {import('./state.js').BossState} */ (bossP.boss);
  bossP.bossKills += 1;
  if (b.dying) return 0;
  const acc = bossP.killAcc + bossKillUnits(state);
  const whole = Math.floor(acc / SCORE.killUnits);
  bossP.killAcc = acc - whole * SCORE.killUnits;
  bossP.score += whole;
  // boss AI w Boss Rush nie leczy się za zabójstwa: bohaterowie odradzają się tam bez końca, więc
  // Widmo potrafiło odrabiać HP szybciej, niż drużyna je zdejmowała (bieg bez końca — brak limitu czasu)
  const heal = bossP.ai && state.mode === 'bossrush' ? 0 : /** @type {any} */ (BOSSES)[b.type].passive?.healOnKill;
  if (heal) b.hp = Math.min(b.maxHp, b.hp + heal * b.maxHp);
  return whole;
}

/** Korona upada na środek. @param {MatchState} state */
export function dropCrown(state) {
  state.crown = { state: 'center', holderId: null, x: 0, y: 0 };
  state.zones = [];
  state.minions = [];
  state.transition = null;
  resetClaims(state);
  state.events.push({ t: 'crownDrop' });
}

/** Podniesienie korony ze środka (bez bonusu). @param {MatchState} state @param {Rng} rng */
export function checkCrownPickup(state, rng) {
  if (!isCrownMode(state)) return;
  if (state.crown.state !== 'center' || state.phase !== 'playing') return;
  const reach = MATCH.crownPickupRadius + HERO.radius;
  const within = (r) => state.players.filter((p) => p.alive && !p.boss && p.connected && Math.hypot(p.x - state.crown.x, p.y - state.crown.y) <= r);
  if (!within(reach).length) return;
  // kilku bohaterów w tym samym kroku: losuje seeded RNG, a nie kolejność w tablicy (slot 0 nie ma pierwszeństwa).
  // Tolerancja 1 mm (dokładność snapshotu): przy równym starcie o „pierwszeństwie” nie może decydować zaokrąglenie.
  // Przy jednym kandydacie RNG nie jest ruszany, więc dotychczasowe sekwencje losowań się nie zmieniają.
  const near = within(reach + 1e-3);
  const taker = near.length === 1 ? near[0] : near[rng.int(near.length)];
  startTransition(state, rng, taker.id, null, false);
}

/** +perCrownSecond pkt co crownInterval sekund w koronie. @param {MatchState} state @param {number} dt */
export function accrueCrownTime(state, dt) {
  if (!isCrownMode(state)) return;
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

/** Kolejność w tabeli: najwięcej punktów, potem dłuższy czas w koronie, potem id. @param {Player} a @param {Player} b */
const byStanding = (a, b) => b.score - a.score || b.crownTime - a.crownTime || (a.id < b.id ? -1 : 1);

/** Lider: najwięcej punktów, potem czas w koronie, potem id. @param {MatchState} state */
export function leader(state) {
  const eligible = state.players.filter((p) => !p.dnf && !p.ai);
  const list = eligible.length ? eligible : state.players;
  return [...list].sort(byStanding)[0] || null;
}

/** @param {MatchState} state */
export function checkWin(state) {
  if (state.phase === 'ended') return;
  if (!isCrownMode(state)) return;
  // kilku graczy z celem w tym samym kroku: wygrywa wyższy w tabeli, nie pierwszy w tablicy
  const winner = state.players.filter((p) => !p.dnf && p.score >= state.targetScore).sort(byStanding)[0];
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
