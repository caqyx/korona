/**
 * Punkt wejścia: tylko lekkie menu startowe. Rdzeń gry (renderer, symulacja, sieć, audio)
 * ładuje się dopiero po kliknięciu „Tryb lokalny” / „Stwórz pokój” / „Dołącz kodem”.
 */
import '@fontsource/pixelify-sans/400.css';
import './ui/style.css';
import { $, showScreen } from './ui/dom.js';
import { setupPwa } from './ui/pwa.js';
import { hasSupabaseConfig } from './net/supabaseConfig.js';

const params = new URLSearchParams(location.search);
const nickInput = /** @type {HTMLInputElement} */ ($('#nick'));
nickInput.value = safeGet('korona.nick') || '';
nickInput.addEventListener('change', () => safeSet('korona.nick', nickInput.value.trim()));
const joinParam = params.get('join');
if (joinParam) /** @type {HTMLInputElement} */ ($('#join-code')).value = joinParam.toUpperCase();
$('#transport-info').textContent =
  hasSupabaseConfig() && params.get('transport') !== 'local' ? 'Online przez Supabase Realtime + WebRTC' : 'Online przez transport lokalny (karty tej przeglądarki)';
setupPwa($('#btn-install'));

/** @type {Promise<ReturnType<typeof import('./ui/core.js').createCore>>|null} */
let corePromise = null;
function loadCore() {
  corePromise ??= import('./ui/core.js').then((m) => m.createCore());
  return corePromise;
}

/** Klik w menu: pokazuje stan ładowania i wywołuje akcję rdzenia. */
function withCore(btn, action) {
  return async () => {
    const label = btn.textContent;
    btn.classList.add('loading');
    btn.textContent = 'Ładowanie…';
    try {
      action(await loadCore());
    } catch (e) {
      $('#start-msg').textContent = 'Nie udało się wczytać gry: ' + (/** @type {any} */ (e)?.message || e);
      corePromise = null;
    } finally {
      btn.classList.remove('loading');
      btn.textContent = label;
    }
  };
}

$('#btn-local').onclick = withCore($('#btn-local'), (core) => core.openLocal());
$('#btn-create').onclick = withCore($('#btn-create'), (core) => core.enterOnline(true));
$('#btn-join').onclick = withCore($('#btn-join'), (core) => core.enterOnline(false));
$('#join-code').addEventListener('keydown', (e) => /** @type {KeyboardEvent} */ (e).key === 'Enter' && $('#btn-join').click());
// Rozgrzewka: pobierz rdzeń, gdy użytkownik zbliża się do przycisku (nie blokuje startu).
for (const id of ['#btn-local', '#btn-create', '#btn-join']) {
  $(id).addEventListener('pointerenter', () => loadCore().catch(() => {}), { once: true });
  $(id).addEventListener('touchstart', () => loadCore().catch(() => {}), { once: true, passive: true });
}
showScreen('#screen-start');

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* brak storage */
  }
}
