/** Drobne helpery DOM dla ekranów. */
export const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const SCREENS = ['#screen-start', '#screen-lobby', '#screen-local', '#screen-summary'];

/** Pokazuje jeden ekran (albo żaden — wtedy widać grę). @param {string|null} id */
export function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}

/** @param {string|null} text */
export function setOverlay(text) {
  $('#overlay').classList.toggle('hidden', !text);
  $('#overlay-text').textContent = text || '';
}

/** @param {string} s */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
