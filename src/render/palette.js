/** Kolory graczy (sloty) i stałe czytelności z GDD 9. */
const SLOT_COLORS = ['#4fc3ff', '#ff5ec4', '#7dff6a', '#ffd23f', '#b38cff', '#ff8a3d', '#3dffe0', '#ff4d4d'];
export const TELEGRAPH = '#ff2848';
export const CROWN = '#ffd23f';
/** Kolory drużyn (tryb Bitwa bossów): niebieska, czerwona. */
export const TEAM_COLORS = ['#4f8bff', '#ff4f5e'];
/** @param {number} slot */
export const slotColor = (slot) => SLOT_COLORS[slot % SLOT_COLORS.length];
