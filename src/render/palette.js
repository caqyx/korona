/** Kolory graczy (sloty) i stałe czytelności z GDD 9. */
export const SLOT_COLORS = ['#4fc3ff', '#ff5ec4', '#7dff6a', '#ffd23f', '#b38cff', '#ff8a3d'];
export const TELEGRAPH = '#ff2848';
export const BG = '#07070d';
export const CROWN = '#ffd23f';
/** @param {number} slot */
export const slotColor = (slot) => SLOT_COLORS[slot % SLOT_COLORS.length];
