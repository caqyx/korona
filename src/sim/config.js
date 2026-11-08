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
  /** tryb lokalny (ludzie + boty na jednym ekranie) */
  maxPlayersLocal: 8,
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
  /** przejście korony: losowanie w stylu skrzynki (spin) + odsłonięcie */
  transitionTime: 3.2,
  slowmoScale: 0.3,
  startCountdown: 3,
};

export const SCORE = {
  perCrownSecond: 1,
  /** co ile sekund w koronie przyznawany jest perCrownSecond (strojenie, patrz docs/decisions.md) */
  crownInterval: 3,
  bossKillsHero: 2,
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
    attack: { kind: 'melee', dmg: 17.5, cd: 1.8, range: 1.7, arc: 120 },
    ability: { cd: 8, duration: 1.5, arc: 140, reflectDmg: 8 },
  },
  lucznik: {
    name: 'Łucznik',
    color: '#7dff6a',
    attack: { kind: 'projectile', dmg: 4, cd: 1.25, range: 9, speed: 20, r: 0.15 },
    ability: { cd: 7, charge: 0.6, dmg: 20, range: 16, speed: 30, r: 0.25 },
  },
  lotrzyk: {
    name: 'Łotrzyk',
    color: '#c77dff',
    attack: { kind: 'melee', dmg: 8.5, cd: 1.4, range: 1.4, arc: 60 },
    ability: { cd: 10, range: 5, mult: 3, buffTime: 3 },
  },
  kaplan: {
    name: 'Kapłan',
    color: '#ffe066',
    attack: { kind: 'projectile', dmg: 8, cd: 1.3, range: 5, speed: 14, r: 0.2 },
    ability: { cd: 14, radius: 3, heal: 1 },
  },
  inzynier: {
    name: 'Inżynier',
    color: '#ff9f43',
    attack: { kind: 'melee', dmg: 14, cd: 1.8, range: 1.5, arc: 90 },
    ability: { cd: 15, life: 6, dmg: 5.5, fireEvery: 1.6, range: 8, speed: 18 },
  },
};

Object.assign(SKINS, {
  mag: {
    name: 'Mag',
    color: '#6f8bff',
    attack: { kind: 'projectile', dmg: 6.2, cd: 1.5, range: 7, speed: 12, r: 0.25, proj: 'fireorb' },
    ability: { cd: 11, range: 8, telegraph: 0.7, radius: 1.6, dmg: 20 },
  },
  barbarzynca: {
    name: 'Barbarzyńca',
    color: '#ff5a3c',
    attack: { kind: 'melee', dmg: 12.5, cd: 2.0, range: 1.6, arc: 150 },
    ability: { cd: 12, duration: 4, atkCdMul: 0.45, speedMul: 1.2 },
  },
  druid: {
    name: 'Druid',
    color: '#55d36b',
    attack: { kind: 'projectile', dmg: 5.8, cd: 1.3, range: 7.5, speed: 15, r: 0.18, proj: 'thorn' },
    ability: { cd: 12, range: 8, telegraph: 0.4, radius: 2.2, life: 3, slow: 0.45, dmg: 2.8, tick: 0.5 },
  },
});

export const SKIN_IDS = /** @type {const} */ (['rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid']);

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

BOSSES.kolos.rarity = 'blue';
BOSSES.burza.rarity = 'blue';
BOSSES.cien.rarity = 'purple';
BOSSES.nekromanta.rarity = 'purple';

Object.assign(BOSSES, {
  smok: {
    name: 'Smok',
    color: '#ff6a2b',
    rarity: 'red',
    speedMul: 0.9,
    hpMul: 1,
    dmgTakenMul: 1,
    knockbackImmune: false,
    passive: { every: 4, radius: 1.4, telegraph: 0.6, life: 2.5 },
    atk: { cd: 1.2, telegraph: 0.4, speed: 13, range: 10, r: 0.3 },
    q: { cd: 6, telegraph: 0.6, range: 7, arc: 70 },
    e: { cd: 10, telegraph: 0.8, range: 9, radius: 3, knock: 6 },
    r: { cd: 13, telegraph: 0.8, count: 6, radius: 1.5, spread: 8 },
  },
  szron: {
    name: 'Szron',
    color: '#9fe8ff',
    rarity: 'pink',
    speedMul: 1,
    hpMul: 1,
    dmgTakenMul: 1,
    knockbackImmune: false,
    passive: { slow: 0.3, duration: 1.5 },
    atk: { cd: 1.0, telegraph: 0.4, speed: 15, range: 9, r: 0.22 },
    q: { cd: 7, telegraph: 0.6, radius: 4 },
    e: { cd: 10, telegraph: 0.7, len: 10, width: 1.2, life: 3, slow: 0.5 },
    r: { cd: 15, telegraph: 0.8, radius: 5, range: 10, life: 4, tick: 1.5, slow: 0.4 },
  },
  pajeczyca: {
    name: 'Pajęczyca',
    color: '#d4ff3b',
    rarity: 'pink',
    speedMul: 1.15,
    hpMul: 0.9,
    dmgTakenMul: 1,
    knockbackImmune: false,
    atk: { cd: 0.9, telegraph: 0.4, range: 2.4, arc: 80 },
    q: { cd: 7, telegraph: 0.5, speed: 14, range: 10, r: 0.45, stun: 1.2 },
    e: { cd: 9, telegraph: 0.7, range: 8, radius: 2 },
    r: { cd: 14, telegraph: 0.6, count: 4, max: 8, hp: 8, speed: 4.2, radius: 0.3, atkRange: 0.7, atkTelegraph: 0.5, atkCd: 1.6 },
  },
  widmo: {
    name: 'Widmo',
    color: '#c9c9ff',
    rarity: 'red',
    speedMul: 1.05,
    hpMul: 1,
    dmgTakenMul: 1,
    knockbackImmune: false,
    passive: { healOnKill: 0.06 },
    atk: { cd: 1.4, telegraph: 0.5, range: 3.0, arc: 150 },
    q: { cd: 7, telegraph: 0.5, speed: 14, range: 18, r: 0.4 },
    e: { cd: 11, telegraph: 0.6, radius: 5, knock: 10 },
    r: { cd: 12, telegraph: 0.8, from: 11, duration: 1.2, width: 0.8 },
  },
});

export const BOSS_IDS = /** @type {const} */ (['kolos', 'cien', 'nekromanta', 'burza', 'smok', 'szron', 'pajeczyca', 'widmo']);

/** Rzadkości jak w skrzynkach CS2: waga losowania i kolor karty. */
export const RARITY = {
  blue: { name: 'Niebieski', color: '#4b69ff', weight: 4 },
  purple: { name: 'Fioletowy', color: '#8847ff', weight: 3 },
  pink: { name: 'Różowy', color: '#d32ce6', weight: 2 },
  red: { name: 'Czerwony', color: '#eb4b4b', weight: 1.5 },
};

/** Taśma losowania (skrzynka). */
export const CASE = { stripLength: 40, winIndex: 33, spin: 2.6 };

export const PROJECTILE_MAX = 400;

/** Przeciwnicy fal (tryb Przetrwanie). Statystyki bazowe dla fali 1. */
export const MINIONS = {
  skeleton: { hp: 15, speed: 2.6, radius: 0.45, atkRange: 1.0, atkTelegraph: 0.6, atkCd: 2.4, score: 1, cost: 1, minWave: 1 },
  spiderling: { hp: 8, speed: 4.2, radius: 0.3, atkRange: 0.7, atkTelegraph: 0.5, atkCd: 1.6, score: 1, cost: 1, minWave: 2 },
  archer: { hp: 12, speed: 2.2, radius: 0.4, atkRange: 7, keep: 5.5, atkTelegraph: 0.6, atkCd: 2.8, shotSpeed: 9, score: 2, cost: 2, minWave: 3 },
  brute: { hp: 60, speed: 1.7, radius: 0.7, atkRange: 1.4, slamRadius: 1.9, atkTelegraph: 0.8, atkCd: 3.2, score: 4, cost: 4, minWave: 4 },
};

/** Tryby gry. */
export const MODES = {
  crown: { name: 'Korona' },
  survival: {
    name: 'Przetrwanie',
    budgetBase: 6,
    budgetPerWave: 3,
    hpPerWave: 0.12,
    bossEvery: 5,
    spawnEvery: 0.55,
    spawnTelegraph: 0.6,
    intermission: 12,
    preWave: 2.5,
    bossScore: 15,
    waveClearScore: 5,
  },
  bossrush: { name: 'Boss Rush', bosses: 8, hpGrowth: 0.3, cdShrink: 0.06, minCdMul: 0.6, respawn: 5, intermission: 12, killScore: 10 },
};

/** Ulepszenia między falami / bossami. */
export const UPGRADES = {
  vit: { name: '+1 serce', desc: 'Maks. HP +1 i pełne leczenie' },
  dmg: { name: 'Ostrze', desc: 'Obrażenia +20%' },
  cd: { name: 'Klepsydra', desc: 'Czasy odnowienia −15%' },
  spd: { name: 'Buty', desc: 'Prędkość ruchu +10%' },
  dash: { name: 'Skrzydła', desc: 'Dash odnawia się 25% szybciej' },
  range: { name: 'Celownik', desc: 'Zasięg ataku +25%' },
};
export const UPGRADE_IDS = /** @type {const} */ (['vit', 'dmg', 'cd', 'spd', 'dash', 'range']);

/** Poziomy trudności botów. */
export const AI_LEVELS = {
  // dodge: szansa, że bot w ogóle zauważy dany telegraf; reaction: ile s po pojawieniu się telegrafu zaczyna uciekać;
  // dash: szansa użycia dasha przeciw danemu zagrożeniu; dashErr: rozrzut momentu dasha (s) — za wcześnie = trafienie.
  easy: { name: 'Łatwy', aimErr: 1.8, dodge: 0.3, reaction: 0.45, dash: 0.2, dashErr: 0.35, ability: 0.4, attack: 0.65, bossAbility: 0.5 },
  normal: { name: 'Normalny', aimErr: 0.8, dodge: 0.55, reaction: 0.3, dash: 0.4, dashErr: 0.25, ability: 0.8, attack: 0.9, bossAbility: 0.85 },
  hard: { name: 'Trudny', aimErr: 0.2, dodge: 0.85, reaction: 0.15, dash: 0.75, dashErr: 0.12, ability: 1.4, attack: 1, bossAbility: 1.3 },
};

/**
 * Wzmocnienie bossów (strojenie po balansie): krótsze czasy odnowienia wszystkich akcji,
 * szybszy ruch i więcej HP na bohatera. Telegrafy bez zmian (GDD: 0,4–0,8 s).
 */
export const BOSS_BUFF = { cdMul: 0.82, speedMul: 1.1, hpPerHero: 140 };
for (const def of Object.values(BOSSES)) {
  for (const k of ['atk', 'q', 'e', 'r']) {
    const a = /** @type {any} */ (def)[k];
    a.cd = Math.round(a.cd * BOSS_BUFF.cdMul * 100) / 100;
  }
  def.speedMul = Math.round(def.speedMul * BOSS_BUFF.speedMul * 100) / 100;
}
BOSS_COMMON.hpPerHero = BOSS_BUFF.hpPerHero;
