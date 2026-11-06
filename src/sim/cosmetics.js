/**
 * Katalog kosmetyków (wygląd bohatera): kolory, specjalne skiny klas, czapki i nosy.
 * Czysty moduł danych (bez DOM) — używany przez UI (edytor), renderer/sprite'y i walidację sieci.
 * `unlock` = id osiągnięcia z src/ui/achievements.js (null = dostępne od razu).
 * Skiny (`kind: 'color'` z `cls`) działają tylko dla wskazanej klasy.
 *
 * @typedef {{id:string, kind:'color'|'hat'|'nose', name:string, unlock:string|null, cls?:string, swatch?:string}} Cosmetic
 * @typedef {{color:string, hat:string, nose:string}} Look
 */

/** @type {Cosmetic[]} */
export const COSMETICS = [
  // kolory (przebarwienie głównego materiału stroju/zbroi)
  { id: 'default', kind: 'color', name: 'Klasyczny', unlock: null },
  { id: 'crimson', kind: 'color', name: 'Szkarłat', unlock: null, swatch: '#c8324a' },
  { id: 'forest', kind: 'color', name: 'Leśny', unlock: null, swatch: '#3f8f4a' },
  { id: 'copper', kind: 'color', name: 'Miedziany', unlock: 'first_match', swatch: '#c47a3a' },
  { id: 'royal', kind: 'color', name: 'Królewski fiolet', unlock: 'crowns_25', swatch: '#7a3fd1' },
  { id: 'bone', kind: 'color', name: 'Kościany', unlock: 'survival_5', swatch: '#e6dcc4' },
  { id: 'diamond', kind: 'color', name: 'Diamentowy', unlock: 'flawless', swatch: '#8ff0ff' },
  { id: 'rainbow', kind: 'color', name: 'Tęczowy', unlock: 'all_classes', swatch: 'linear-gradient(90deg,#ff4d4d,#ffd23f,#5ce07a,#4fc3ff,#b38cff)' },
  // specjalne skiny klas
  { id: 'gold_knight', kind: 'color', name: 'Złoty Rycerz', unlock: 'wins_10', cls: 'rycerz', swatch: '#ffd23f' },
  { id: 'fire_mage', kind: 'color', name: 'Płonący Mag', unlock: 'damage_10k', cls: 'mag', swatch: '#ff6a2b' },
  { id: 'shadow_rogue', kind: 'color', name: 'Cień Łotrzyka', unlock: 'all_bosses', cls: 'lotrzyk', swatch: '#2a1f3d' },
  { id: 'skeleton_archer', kind: 'color', name: 'Szkieletowy Łucznik', unlock: 'survival_10', cls: 'lucznik', swatch: '#d9d4c0' },
  { id: 'dragon_barb', kind: 'color', name: 'Smoczy Barbarzyńca', unlock: 'bossrush', cls: 'barbarzynca', swatch: '#c23b22' },
  // czapki
  { id: 'none', kind: 'hat', name: 'Bez czapki', unlock: null },
  { id: 'beanie', kind: 'hat', name: 'Czapka zimowa', unlock: null },
  { id: 'party', kind: 'hat', name: 'Czapeczka imprezowa', unlock: null },
  { id: 'paper_crown', kind: 'hat', name: 'Papierowa korona', unlock: 'first_win' },
  { id: 'diadem', kind: 'hat', name: 'Diadem', unlock: 'crown_time' },
  { id: 'traveler', kind: 'hat', name: 'Kapelusz podróżnika', unlock: 'all_maps' },
  { id: 'skull_helm', kind: 'hat', name: 'Hełm z czaszki', unlock: 'survival_20' },
  // nosy
  { id: 'none', kind: 'nose', name: 'Bez nosa', unlock: null },
  { id: 'round', kind: 'nose', name: 'Okrągły', unlock: null },
  { id: 'mustache', kind: 'nose', name: 'Wąsy', unlock: null },
  { id: 'horned', kind: 'nose', name: 'Rogaty', unlock: 'boss_kills_50' },
  { id: 'clown', kind: 'nose', name: 'Klaun', unlock: 'online_win' },
];

/** @type {Look} */
export const DEFAULT_LOOK = Object.freeze({ color: 'default', hat: 'none', nose: 'none' });

/** @param {'color'|'hat'|'nose'} kind */
export const cosmeticsOf = (kind) => COSMETICS.filter((c) => c.kind === kind);

/** @param {'color'|'hat'|'nose'} kind @param {string} id */
export const findCosmetic = (kind, id) => COSMETICS.find((c) => c.kind === kind && c.id === id) || null;

/** Kosmetyk będący nagrodą za osiągnięcie (do opisu nagrody). @param {string} achId */
export const rewardFor = (achId) => COSMETICS.find((c) => c.unlock === achId) || null;

/**
 * Czy przedmiot jest odblokowany i pasuje do klasy.
 * @param {Cosmetic} c @param {Set<string>|string[]} unlockedAch @param {string} [skin]
 */
export function isAvailable(c, unlockedAch, skin) {
  const set = unlockedAch instanceof Set ? unlockedAch : new Set(unlockedAch);
  if (c.cls && skin && c.cls !== skin) return false;
  return c.unlock === null || set.has(c.unlock);
}

/**
 * Normalizuje wygląd z dowolnego źródła (sieć, storage): nieznane id → domyślne;
 * skin klasy na innej klasie → kolor klasyczny. Nie sprawdza odblokowań (to robi UI lokalnie).
 * @param {any} look @param {string} [skin] @returns {Look}
 */
export function sanitizeLook(look, skin) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  for (const kind of /** @type {const} */ (['color', 'hat', 'nose'])) {
    const id = typeof look[kind] === 'string' ? look[kind] : '';
    const c = findCosmetic(kind, id);
    if (c && !(c.cls && skin && c.cls !== skin)) out[kind] = c.id;
  }
  return out;
}
