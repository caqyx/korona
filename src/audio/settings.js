/**
 * Ustawienia audio (czyste): domyślne, walidacja, odczyt/zapis przez wstrzykiwany storage.
 */
export const STORAGE_KEY = 'korona.audio';

export const DEFAULT_SETTINGS = Object.freeze({ master: 0.8, music: 0.5, sfx: 0.8, muted: false, haptics: true });

/** @typedef {{master: number, music: number, sfx: number, muted: boolean, haptics: boolean}} AudioSettings */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Scala `raw` z `base`, przyjmując tylko poprawne pola (liczby 0..1, booleany).
 * @param {any} raw @param {AudioSettings} [base]
 * @returns {AudioSettings}
 */
export function sanitizeSettings(raw, base = DEFAULT_SETTINGS) {
  const out = { ...base };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of /** @type {const} */ (['master', 'music', 'sfx'])) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = clamp01(v);
  }
  for (const k of /** @type {const} */ (['muted', 'haptics'])) {
    if (typeof raw[k] === 'boolean') out[k] = raw[k];
  }
  return out;
}

/** @param {Storage|null|undefined} storage @returns {AudioSettings} */
export function loadSettings(storage) {
  try {
    const s = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(s ? JSON.parse(s) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** @param {Storage|null|undefined} storage @param {AudioSettings} s @returns {boolean} */
export function saveSettings(storage, s) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(s)));
    return true;
  } catch {
    return false;
  }
}

/** localStorage przeglądarki albo null (Node, tryb prywatny, zablokowane dane strony). */
export function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Krzywa suwaka → wzmocnienie (kwadratowa: lepiej odpowiada słyszeniu niż liniowa). */
export const sliderToGain = (v) => clamp01(v) * clamp01(v);
