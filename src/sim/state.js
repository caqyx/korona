import { MATCH, HERO, SKIN_IDS } from './config.js';
import { createRngState } from './rng.js';

/**
 * @typedef {Object} Input
 * @property {number} moveX  -1..1
 * @property {number} moveY  -1..1
 * @property {number} aimX   punkt celowania w świecie (m)
 * @property {number} aimY
 * @property {number} buttons maska BTN
 * @property {string} [skin]  zmiana skina (stosowana tylko gdy martwy)
 */

export const BTN = Object.freeze({ ATTACK: 1, DASH: 2, ABILITY: 4, Q: 8, E: 16, R: 32 });

/** @returns {Input} */
export const emptyInput = () => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });

/**
 * @typedef {Object} BossState
 * @property {string} type
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} reign      sekundy w koronie (bieżące panowanie)
 * @property {{atk:number,q:number,e:number,r:number}} cd
 * @property {null|{ab:string,t:number,total:number,ax:number,ay:number,area:number,data:any}} cast
 * @property {null|{kind:string,t:number,[k:string]:any}} channel
 * @property {number} hits       licznik trafień (Burza: Przeciążenie)
 * @property {boolean} overloaded
 * @property {number} invisT
 * @property {boolean} dying
 * @property {number} passiveT
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} nick
 * @property {string} skin
 * @property {number} slot
 * @property {number} x
 * @property {number} y
 * @property {number} fx facing
 * @property {number} fy
 * @property {number} hp
 * @property {boolean} alive
 * @property {number} respawnT
 * @property {number} invulnT
 * @property {number} dashT
 * @property {number} dashCd
 * @property {number} dashX
 * @property {number} dashY
 * @property {number} atkCd
 * @property {number} abilCd
 * @property {number} abilT
 * @property {number} buffMult
 * @property {number} buffT
 * @property {number} stunT
 * @property {number} slowT
 * @property {number} slowMul
 * @property {number} kx
 * @property {number} ky
 * @property {number} prevButtons
 * @property {number} score
 * @property {number} crownTime
 * @property {number} crownAcc
 * @property {number} lastHits
 * @property {number} bossKills
 * @property {number} deaths
 * @property {number} dmgToBoss
 * @property {boolean} connected
 * @property {boolean} dnf
 * @property {BossState|null} boss
 */

/**
 * @param {string} id @param {string} nick @param {string} skin @param {number} slot
 * @returns {Player}
 */
export function createPlayer(id, nick, skin, slot) {
  const [x, y] = spawnPoint(slot);
  return {
    id,
    nick: String(nick).slice(0, 16),
    skin: SKIN_IDS.includes(/** @type {any} */ (skin)) ? skin : 'rycerz',
    slot,
    x,
    y,
    fx: -x / (Math.hypot(x, y) || 1),
    fy: -y / (Math.hypot(x, y) || 1),
    hp: HERO.hp,
    alive: true,
    respawnT: 0,
    invulnT: 0,
    dashT: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 0,
    atkCd: 0,
    abilCd: 0,
    abilT: 0,
    buffMult: 1,
    buffT: 0,
    stunT: 0,
    slowT: 0,
    slowMul: 1,
    kx: 0,
    ky: 0,
    prevButtons: 0,
    score: 0,
    crownTime: 0,
    crownAcc: 0,
    lastHits: 0,
    bossKills: 0,
    deaths: 0,
    dmgToBoss: 0,
    connected: true,
    dnf: false,
    boss: null,
  };
}

/** @param {number} i */
export function spawnPoint(i) {
  const a = (i / MATCH.spawnCount) * Math.PI * 2 + Math.PI / 8;
  return [Math.round(Math.cos(a) * MATCH.spawnRadius * 1e4) / 1e4, Math.round(Math.sin(a) * MATCH.spawnRadius * 1e4) / 1e4];
}

/**
 * @typedef {Object} MatchOptions
 * @property {number} seed
 * @property {{id:string,nick:string,skin:string}[]} players
 * @property {number} [targetScore]
 * @property {number} [timeLimit]
 * @property {number} [countdown]
 * @property {number} [maxPlayers]
 */

/** @param {MatchOptions} opts */
export function createMatchState(opts) {
  const players = opts.players.slice(0, opts.maxPlayers ?? MATCH.maxPlayers).map((p, i) => createPlayer(p.id, p.nick, p.skin, i));
  return {
    v: 1,
    tick: 0,
    time: 0,
    matchTime: 0,
    phase: /** @type {'countdown'|'playing'|'transition'|'ended'} */ ('countdown'),
    countdown: opts.countdown ?? MATCH.startCountdown,
    targetScore: opts.targetScore ?? MATCH.targetScore,
    timeLimit: opts.timeLimit ?? MATCH.timeLimit,
    rng: createRngState(opts.seed),
    players,
    crown: { state: /** @type {'center'|'held'} */ ('center'), holderId: /** @type {string|null} */ (null), x: 0, y: 0 },
    lastBossType: /** @type {string|null} */ (null),
    /** @type {null|{t:number,total:number,newBossId:string,prevBossId:string|null,bossType:string,strip:string[],win:number,offset:number,bonus:boolean}} */
    transition: null,
    /** @type {any[]} */ projectiles: [],
    /** @type {any[]} */ zones: [],
    /** @type {any[]} */ minions: [],
    /** @type {any[]} */ turrets: [],
    /** @type {any[]} */ events: [],
    nextId: 1,
    winnerId: /** @type {string|null} */ (null),
    endReason: /** @type {string|null} */ (null),
  };
}

/** @typedef {ReturnType<typeof createMatchState>} MatchState */

/** @param {MatchState} state */
export const nextId = (state) => state.nextId++;

/** @param {MatchState} state @param {string} id */
export const getPlayer = (state, id) => state.players.find((p) => p.id === id) || null;

/** @param {MatchState} state */
export const getBoss = (state) => state.players.find((p) => p.boss !== null) || null;

/** @param {MatchState} state */
export const activeHeroes = (state) => state.players.filter((p) => !p.boss && p.alive && p.connected);

/** Głęboka kopia przez JSON — snapshot jest zawsze serializowalny. @param {MatchState} state @returns {MatchState} */
export const cloneState = (state) => JSON.parse(JSON.stringify(state));
