/** Drobne helpery DOM dla ekranów (ładowane na ekranie startowym — bez zależności od gry). */
export const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const SCREENS = ['#screen-start', '#screen-multi', '#screen-ach', '#screen-lobby', '#screen-modes', '#screen-local', '#screen-summary'];
/** @type {Set<(id:string|null)=>void>} */
const screenListeners = new Set();
let currentScreen = /** @type {string|null} */ (null);

/** Pokazuje jeden ekran (albo żaden — wtedy widać grę). @param {string|null} id */
export function showScreen(id) {
  for (const s of SCREENS) $(s)?.classList.toggle('hidden', s !== id);
  if (!id) closeModal();
  currentScreen = id;
  for (const cb of [...screenListeners]) cb(id);
}

export const getScreen = () => currentScreen;

/** Powiadomienie o zmianie ekranu (np. zamknięcie subskrypcji przy wyjściu). Zwraca funkcję wypisania. @param {(id:string|null)=>void} cb */
export function onScreen(cb) {
  screenListeners.add(cb);
  return () => screenListeners.delete(cb);
}

/** @param {string|null} text */
export function setOverlay(text) {
  $('#overlay').classList.toggle('hidden', !text);
  $('#overlay-text').textContent = text || '';
}

/** @param {string} s */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

/* ---------- okna modalne (Ustawienia, Bestiariusz) ---------- */

/** @type {{el:HTMLElement, onClose?:()=>void, prevFocus:Element|null}|null} */
let modal = null;

/**
 * Otwiera panel modalny w pikselowej ramce. Zamyka go Esc, klik w tło lub przycisk ✕.
 * @param {{title:string, body:string|Node, cls?:string, onClose?:()=>void}} o
 * @returns {HTMLElement} element `.modal-body`
 */
export function openModal(o) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal px-box ${o.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <div class="modal-head"><h2>${esc(o.title)}</h2><button class="btn-x" data-close aria-label="Zamknij">✕</button></div>
      <div class="modal-body"></div>
    </div>`;
  const body = /** @type {HTMLElement} */ (el.querySelector('.modal-body'));
  if (typeof o.body === 'string') body.innerHTML = o.body;
  else body.append(o.body);
  el.addEventListener('pointerdown', (e) => {
    if (e.target === el) closeModal();
  });
  /** @type {HTMLElement} */ (el.querySelector('[data-close]')).onclick = () => closeModal();
  document.body.append(el);
  modal = { el, onClose: o.onClose, prevFocus: document.activeElement };
  /** @type {HTMLElement} */ (el.querySelector('[data-close]')).focus({ preventScroll: true });
  return body;
}

export function closeModal() {
  if (!modal) return;
  const m = modal;
  modal = null;
  m.el.remove();
  m.onClose?.();
  if (m.prevFocus instanceof HTMLElement) m.prevFocus.focus({ preventScroll: true });
}

if (typeof document !== 'undefined') {
  // Esc zamyka okno (w fazie capture, żeby nie przełączać pauzy meczu).
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && modal) {
        e.stopImmediatePropagation();
        closeModal();
      }
    },
    true,
  );
  // Przyciski z data-open ładują swój panel dopiero po kliknięciu (start zostaje lekki).
  document.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-open]'));
    if (!btn) return;
    const what = btn.dataset.open;
    if (what === 'settings') import('./settings.js').then((m) => m.openSettings());
    else if (what === 'bestiary') import('./bestiary.js').then((m) => m.openBestiary());
  });
}
