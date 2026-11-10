/**
 * Menu meczu (DOM, nad canvasem): pauza w meczu lokalnym albo „wyjdź z meczu” online.
 * Osobna warstwa pod oknami modalnymi (Ustawienia otwierają się NAD nim), więc Esc zamyka
 * najpierw okno ustawień, a dopiero potem wznawia grę.
 */
import { esc } from './dom.js';

/**
 * @typedef {Object} MatchMenuOptions
 * @property {string} title nagłówek („Pauza” / „Menu meczu”)
 * @property {string} [note] dopisek pod nagłówkiem (np. że mecz online trwa dalej)
 * @property {string} resumeLabel
 * @property {string} leaveLabel
 * @property {()=>void} onResume wywoływane przy zamknięciu przyciskiem „wznów”/Esc
 * @property {()=>void} onLeave
 */

/** @type {{el:HTMLElement, opts:MatchMenuOptions, prevFocus:Element|null}|null} */
let open = null;

export const isMatchMenuOpen = () => !!open;

/** @param {MatchMenuOptions} opts */
export function openMatchMenu(opts) {
  if (open) return;
  const el = document.createElement('div');
  el.className = 'modal-backdrop match-menu-backdrop';
  el.id = 'match-menu';
  el.innerHTML = `<div class="modal px-box match-menu" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <div class="modal-head"><h2>${esc(opts.title)}</h2></div>
      <div class="modal-body match-menu-body">
        ${opts.note ? `<p class="small match-menu-note">${esc(opts.note)}</p>` : ''}
        <button class="primary big" data-act="resume">${esc(opts.resumeLabel)}</button>
        <button data-open="settings" data-act="controls">Sterowanie</button>
        <button class="danger" data-act="leave">${esc(opts.leaveLabel)}</button>
      </div>
    </div>`;
  /** @type {HTMLElement} */ (el.querySelector('[data-act="resume"]')).onclick = () => resumeMatchMenu();
  /** @type {HTMLElement} */ (el.querySelector('[data-act="leave"]')).onclick = () => {
    closeMatchMenu();
    opts.onLeave();
  };
  open = { el, opts, prevFocus: document.activeElement };
  document.body.append(el);
  /** @type {HTMLElement} */ (el.querySelector('[data-act="resume"]')).focus({ preventScroll: true });
}

/** Zamyka menu bez wywoływania akcji (koniec meczu, powrót do lobby, wyjście). */
export function closeMatchMenu() {
  if (!open) return;
  const m = open;
  open = null;
  m.el.remove();
  if (m.prevFocus instanceof HTMLElement && m.prevFocus.isConnected) m.prevFocus.focus({ preventScroll: true });
}

/** Zamyka menu i wraca do gry („Wznów”, Esc). */
export function resumeMatchMenu() {
  if (!open) return;
  const { opts } = open;
  closeMatchMenu();
  opts.onResume();
}
