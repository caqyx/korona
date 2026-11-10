/**
 * Czyste funkcje tekstów HUD (bez canvasa — testowane jednostkowo).
 */

/** Tolerancja, przy której wartość punktową uznajemy za całkowitą. */
const WHOLE_EPS = 0.05;
/** Poniżej tej wartości „około +1” byłoby już naciągane. */
const NEAR_ONE = 0.75;

/**
 * Wartość punktowa bez mylących ułamków: całkowita → „+2”, ułamkowa → „ok. +1” (zaokrąglona;
 * słowem, bo tylda w foncie pikselowym wygląda jak minus), wyraźnie poniżej jednego punktu → „poniżej +1”.
 * @param {number} v punkty (np. `bossKillValue(state)`) @returns {string}
 */
export function pointsLabel(v) {
  if (!(v > 0)) return '+0';
  const whole = Math.round(v);
  if (Math.abs(v - whole) < WHOLE_EPS) return `+${whole}`;
  if (v < NEAR_ONE) return 'poniżej +1';
  return `ok. +${Math.max(1, whole)}`;
}
