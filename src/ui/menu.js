/**
 * Panel „Twoja klasa” na ekranie startowym. Ładowany leniwie (po pierwszym malowaniu),
 * bo ciągnie za sobą sprite'y i opisy klas.
 */
import { $, esc } from './dom.js';
import { SKINS } from '../sim/config.js';
import { SKIN_TEXT } from './codex.js';
import { heroPreview, mount } from './previews.js';
import { getProfile, onProfileChange } from './profile.js';

let started = false;

/** Rysuje panel klasy i odświeża go przy każdej zmianie profilu. */
export function initClassPanel() {
  if (started) return;
  started = true;
  render(getProfile().skin);
  onProfileChange((p) => render(p.skin));
}

/** @param {string} skin */
function render(skin) {
  const s = /** @type {any} */ (SKINS)[skin] || SKINS.rycerz;
  const t = SKIN_TEXT[skin] || SKIN_TEXT.rycerz;
  const panel = $('.class-panel');
  panel?.style.setProperty('--c', s.color);
  mount($('#class-pv'), heroPreview(skin, s.color, { w: 120, h: 104, maxScale: 5 }));
  $('#class-name').textContent = s.name;
  $('#class-role').textContent = t.role;
  $('#class-abil').innerHTML = `<b>${esc(t.ability)}</b> <span class="cd">${t.cd} s</span><br>${esc(t.abilityDesc)}`;
}
