/**
 * Wszystkie liczby balansu z GDD w jednym miejscu.
 * Jednostki: metry, sekundy, HP. Zmiany balansu zapisuj w docs/decisions.md.
 */
export const DT = 1 / 60;
export const SNAPSHOT_EVERY = 3; // 60 Hz / 3 = 20 Hz

export const MATCH = {
  targetScore: 100,
  timeLimit: 8 * 60,
  minPlayers: 2,
  maxPlayers: 6,
  arenaRadius: 16,
  /** @type {{x:number,y:number,r:number}[]} */
  pillars: [
    { x: 0, y: -8.5, r: 1.1 },
    { x: 8.1, y: -2.6, r: 1.1 },
    { x: 5.0, y: 6.9, r: 1.1 },
    { x: -5.0, y: 6.9, r: 1.1 },
    { x: -8.1, y: -2.6, r: 1.1 },
  ],
  spawnRadius: 12.5,
  spawnCount: 8,
  crownPickupRadius: 1.1,
  transitionTime: 1.5,
  slowmoScale: 0.3,
  startCountdown: 3,
};

export const SCORE = {
  perCrownSecond: 1,
  /** co ile sekund w koronie przyznawany jest perCrownSecond (strojenie, patrz docs/decisions.md) */
  crownInterval: 3,
  bossKillsHero: 3,
  lastHit: 10,
  assist: 2,
  assistThreshold: 0.25,
};

export const FEVER = {
  startAfter: 40,
  every: 10,
  step: 0.1,
  max: 0.5,
};

export const HERO = {
  radius: 0.4,
  speed: 6,
  hp: 3,
  respawnTime: 3,
  respawnInvuln: 2,
  dashCooldown: 1.2,
  dashDuration: 0.15,
  dashSpeed: 22,
  formerBossInvuln: 2,
};

export const BOSS_COMMON = {
  radiusMul: 3,
  hpPerHero: 120,
  speed: 5,
  castMoveMul: 0.5,
  lowHpPulse: 0.1,
  heroDamage: 1,
};

/**
 * Skiny bohaterów. attack.kind: 'melee' | 'projectile'.
 * arc = pełny kąt stożka w stopniach.
 */
export const SKINS = {
  rycerz: {
    name: 'Rycerz',
    color: '#4fc3ff',
    attack: { kind: 'melee', dmg: 10, cd: 1.8, range: 1.7, arc: 120 },
    ability: { cd: 8, duration: 1.5, arc: 140, reflectDmg: 8 },
  },
  lucznik: {
    name: 'Łucznik',
    color: '#7dff6a',
    attack: { kind: 'projectile', dmg: 6, cd: 1.25, range: 9, speed: 20, r: 0.15 },
    ability: { cd: 7, charge: 0.6, dmg: 30, range: 16, speed: 30, r: 0.25 },
  },
  lotrzyk: {
    name: 'Łotrzyk',
    color: '#c77dff',
    attack: { kind: 'melee', dmg: 8, cd: 1.4, range: 1.4, arc: 60 },
    ability: { cd: 10, range: 5, mult: 3, buffTime: 3 },
  },
  kaplan: {
    name: 'Kapłan',
    color: '#ffe066',
    attack: { kind: 'projectile', dmg: 7, cd: 1.3, range: 5, speed: 14, r: 0.2 },
    ability: { cd: 14, radius: 3, heal: 1 },
  },
  inzynier: {
    name: 'Inżynier',
    color: '#ff9f43',
    attack: { kind: 'melee', dmg: 9, cd: 1.8, range: 1.5, arc: 90 },
    ability: { cd: 15, life: 6, dmg: 4, fireEvery: 1.6, range: 8, speed: 18 },
  },
};

export const SKIN_IDS = /** @type {const} */ (['rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier']);

/** Bossy: telegraph w sekundach (zawsze 0.4..0.8). */
export const BOSSES = {
  kolos: {
    name: 'Kolos',
    color: '#ff3b5c',
    speedMul: 0.7,
    hpMul: 1,
    dmgTakenMul: 0.85,
    knockbackImmune: true,
    atk: { cd: 1.6, telegraph: 0.4, range: 2.8, arc: 110 },
    q: { cd: 6, telegraph: 0.6, maxR: 9, expand: 0.9, width: 0.7 },
    e: { cd: 9, telegraph: 0.6, len: 8, width: 2.0, speed: 22, knock: 9, stun: 0.5 },
    r: { cd: 14, telegraph: 0.8, count: 4, radius: 1.6 },
  },
  cien: {
    name: 'Cień',
    color: '#b14dff',
    speedMul: 1.3,
    hpMul: 0.7,
    dmgTakenMul: 1,
    knockbackImmune: false,
    atk: { cd: 1.0, telegraph: 0.4, range: 2.5, arc: 90 },
    q: { cd: 7, telegraph: 0.5, range: 7, blastR: 2.5 },
    e: { cd: 12, telegraph: 0.4, duration: 2.5 },
    r: { cd: 8, telegraph: 0.5, count: 7, arc: 90, speed: 14, range: 11, r: 0.25 },
  },
  nekromanta: {
    name: 'Nekromanta',
    color: '#39ff9f',
    speedMul: 0.95,
    hpMul: 1,
    dmgTakenMul: 1,
    knockbackImmune: false,
    atk: { cd: 1.3, telegraph: 0.4, speed: 7, range: 11, r: 0.3 },
    q: { cd: 10, telegraph: 0.5, count: 3, max: 6, hp: 15, speed: 2.6, radius: 0.45, atkRange: 1.0, atkTelegraph: 0.6, atkCd: 2.4 },
    e: { cd: 12, telegraph: 0.5, range: 7, breakRange: 8.5, duration: 2, dps: 1, healPct: 0.04 },
    r: { cd: 15, telegraph: 0.6, radius: 4, duration: 4, slow: 0.5, dps: 1, range: 10 },
  },
  burza: {
    name: 'Burza',
    color: '#3bd5ff',
    speedMul: 1,
    hpMul: 1,
    dmgTakenMul: 1,
    knockbackImmune: false,
    overloadHits: 3,
    overloadArea: 1.5,
    atk: { cd: 1.1, telegraph: 0.4, speed: 16, range: 8, r: 0.22 },
    q: { cd: 4, telegraph: 0.6, radius: 2, range: 11 },
    e: { cd: 11, telegraph: 0.5, radius: 6, duration: 2, pull: 3.6 },
    r: { cd: 9, telegraph: 0.5, jumpRadius: 4, jumps: 4, range: 9 },
  },
};

export const BOSS_IDS = /** @type {const} */ (['kolos', 'cien', 'nekromanta', 'burza']);

export const PROJECTILE_MAX = 400;
