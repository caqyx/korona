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
  /** promień okręgu startowego jako część promienia areny (mapy prostokątne: krótszego półboku) */
  startRing: 0.78,
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
  /** przy tylu bohaterach (lub mniej) zabójstwo jest warte pełne bossKillsHero; powyżej wartość maleje jak killRefHeroes / bohaterowie */
  killRefHeroes: 3,
  lastHit: 10,
  assist: 2,
  /** asysta: świeże obrażenia ≥ min(assistThreshold, assistPool / bohaterowie) × maks. HP bossa */
  assistThreshold: 0.25,
  /** łączna część HP bossa „do podziału” na asysty — przy wielu bohaterach próg spada poniżej assistThreshold */
  assistPool: 0.75,
  /**
   * Na ile równych części dzielony jest punkt w liczniku `killAcc` (NWW liczb 1..maxPlayersLocal = 840):
   * ułamkowa wartość zabójstwa (np. 6/7 pkt) jest wtedy liczbą całkowitą — bez zaokrągleń i dryfu w snapshotach.
   */
  killUnits: lcmUpTo(MATCH.maxPlayersLocal),
};

/** Największy wspólny dzielnik. @param {number} a @param {number} b @returns {number} */
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

/** Najmniejsza wspólna wielokrotność liczb 1..n. @param {number} n */
function lcmUpTo(n) {
  let l = 1;
  for (let i = 2; i <= n; i++) l = (l * i) / gcd(l, i);
  return l;
}

/**
 * Roszczenie do korony: po śmierci bossa bohater, który nie przejął korony (i nie był bossem),
 * przenosi do następnego panowania `carry` swojego udziału w HP poprzedniego bossa.
 * Strojenie: 0,25–0,4 (patrz docs/decisions.md).
 */
export const CLAIM = { carry: 0.3 };

export const FEVER = {
  startAfter: 40,
  every: 10,
  step: 0.1,
  max: 0.5,
};

export const HERO = {
  radius: 0.4,
  speed: 6,
  /** bazowe HP klasy bez własnego pola `hp` w SKINS (klasy wręcz mają 4 — patrz heroBaseHp) */
  hp: 3,
  /** odrodzenie w Koronie i Bitwie bossów (Boss Rush i Przetrwanie mają własne stałe w MODES) */
  respawnTime: 2,
  respawnInvuln: 2,
  dashCooldown: 1.2,
  dashDuration: 0.15,
  dashSpeed: 22,
  formerBossInvuln: 2,
};

export const BOSS_COMMON = {
  radiusMul: 3,
  /** wartość z GDD; BOSS_BUFF na końcu pliku podnosi ją do 140 */
  hpPerHero: 120,
  speed: 5,
  castMoveMul: 0.5,
  lowHpPulse: 0.1,
  heroDamage: 1,
};

/**
 * Skiny bohaterów. attack.kind: 'melee' | 'projectile'.
 * arc = pełny kąt stożka w stopniach.
 * `hp` (opcjonalne) = bazowe maks. HP klasy; bez pola obowiązuje HERO.hp. Klasy wręcz mają 4:
 * walczą w zasięgu ataków bossa i przy 3 HP ginęły ~2,5× częściej niż dystansowe (docs/decisions.md).
 */
export const SKINS = {
  rycerz: {
    name: 'Rycerz',
    color: '#4fc3ff',
    hp: 4,
    attack: { kind: 'melee', dmg: 19, cd: 1.8, range: 1.7, arc: 120 },
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
    hp: 4,
    attack: { kind: 'melee', dmg: 8.5, cd: 1.4, range: 1.4, arc: 60 },
    // mult 3 → 3,6: przy samych 4 HP Łotrzyk wygrywał ~11% meczów (4 graczy, Trudny); +20% do ataku dawało aż 48%
    ability: { cd: 10, range: 5, mult: 3.6, buffTime: 3 },
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
    hp: 4,
    attack: { kind: 'melee', dmg: 16.5, cd: 1.8, range: 1.5, arc: 90 },
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
    hp: 4,
    attack: { kind: 'melee', dmg: 13.5, cd: 2.0, range: 1.6, arc: 150 },
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

/** Bazowe maks. HP klasy (bez ulepszeń): `SKINS[skin].hp`, a gdy klasa go nie podaje — HERO.hp. @param {string} skin */
export const heroBaseHp = (skin) => /** @type {any} */ (SKINS)[skin]?.hp ?? HERO.hp;

/**
 * Bossy: telegraph w sekundach (zawsze 0.4..0.8).
 * `aroundBoss: true` = strefa wokół samego bossa (jej `radius` to zasięg akcji — korzysta z tego bot, patrz bossAbilityReach).
 */
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
    hpMul: 0.9,
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
    e: { cd: 11, telegraph: 0.5, radius: 6, duration: 2, pull: 3.6, aroundBoss: true },
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
    q: { cd: 7, telegraph: 0.6, radius: 4, aroundBoss: true },
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
    e: { cd: 11, telegraph: 0.6, radius: 5, knock: 10, aroundBoss: true },
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
    /** na fali z bossem AI zabity bohater wraca po tylu sekundach (na zwykłych falach czeka „na ławce” do przerwy) */
    bossWaveRespawn: 8,
  },
  teams: { name: 'Bitwa bossów', hpMul: 4.5, respawnSide: true, teamNames: ['Niebieska', 'Czerwona'], killScore: 10 },
  bossrush: {
    name: 'Boss Rush',
    bosses: 8,
    hpGrowth: 0.3,
    cdShrink: 0.06,
    minCdMul: 0.6,
    respawn: 5,
    intermission: 12,
    /** pauza (s) między wyborem ulepszeń a wejściem kolejnego bossa */
    preBoss: 1.2,
    killScore: 10,
    /** „drugie szanse” drużyny wg liczby bohaterów: [1 bohater, 2, 3 i więcej] — patrz bossrushLives */
    lives: [3, 2, 1],
  },
};

/**
 * Pula „drugich szans” w Boss Rush: ile razy cała drużyna może zginąć jednocześnie, zanim mecz się skończy.
 * @param {number} heroes liczba bohaterów (ludzie i boty, bez bossa AI)
 */
export function bossrushLives(heroes) {
  const table = MODES.bossrush.lives;
  return table[Math.min(table.length, Math.max(1, Math.floor(heroes))) - 1];
}

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
  // dodge: szansa, że bot w ogóle zauważy dany telegraf (dla aktywnej strefy tykającej: szansa na każdy jej tick);
  // reaction: ile s po pojawieniu się telegrafu zaczyna uciekać;
  // dash: szansa użycia dasha przeciw danemu zagrożeniu; dashErr: rozrzut momentu dasha (s) — za wcześnie = trafienie;
  // lead: wyprzedzenie celowania bossa-bota (s) — celuje w pozycję celu + prędkość × lead.
  easy: { name: 'Łatwy', aimErr: 1.8, dodge: 0.3, reaction: 0.45, dash: 0.2, dashErr: 0.35, ability: 0.4, attack: 0.65, bossAbility: 0.5, lead: 0 },
  normal: { name: 'Normalny', aimErr: 0.8, dodge: 0.55, reaction: 0.3, dash: 0.4, dashErr: 0.25, ability: 0.8, attack: 0.9, bossAbility: 0.85, lead: 0.15 },
  hard: { name: 'Trudny', aimErr: 0.2, dodge: 0.85, reaction: 0.15, dash: 0.75, dashErr: 0.12, ability: 1.4, attack: 1, bossAbility: 1.3, lead: 0.35 },
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
