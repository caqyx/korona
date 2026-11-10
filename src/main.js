/**
 * Punkt wejścia: tylko lekkie menu startowe. Rdzeń gry (renderer, symulacja, sieć, audio)
 * ładuje się dopiero po wyborze Singleplayer / wejściu do pokoju. Panele menu (Multiplayer,
 * Osiągnięcia, Customize, podgląd klasy) to osobne, małe moduły ładowane na żądanie.
 */
import '@fontsource/pixelify-sans/400.css';
import './ui/style.css';
import { $, showScreen } from './ui/dom.js';
import { setupPwa } from './ui/pwa.js';
import { getProfile, setProfile } from './ui/profile.js';
import { hasSupabaseConfig } from './net/supabaseConfig.js';

const params = new URLSearchParams(location.search);
const nickInput = /** @type {HTMLInputElement} */ ($('#nick'));
nickInput.value = getProfile().nick;
nickInput.addEventListener('change', () => {
  const nick = nickInput.value.trim();
  setProfile({ nick });
  safeSet('korona.nick', nick);
});
const online = hasSupabaseConfig() && params.get('transport') !== 'local';
$('#transport-info').textContent = online ? 'Online przez Supabase Realtime + WebRTC' : 'Online przez transport lokalny (karty tej przeglądarki)';
setupPwa($('#btn-install'), $('#btn-update'));

/** @type {Promise<ReturnType<typeof import('./ui/core.js').createCore>>|null} */
let corePromise = null;
function loadCore() {
  corePromise ??= import('./ui/core.js').then((m) => m.createCore());
  corePromise.catch(() => (corePromise = null));
  return corePromise;
}

/** Klik w menu: pokazuje stan ładowania i wywołuje akcję rdzenia. */
function withCore(btn, action, msgSel = '#menu-msg') {
  return async () => {
    if (btn.classList.contains('loading')) return;
    const html = btn.innerHTML;
    btn.classList.add('loading');
    btn.textContent = 'Ładowanie…';
    try {
      await action(await loadCore());
    } catch (e) {
      $(msgSel).textContent = 'Nie udało się wczytać gry: ' + (/** @type {any} */ (e)?.message || e);
    } finally {
      btn.classList.remove('loading');
      btn.innerHTML = html;
    }
  };
}

/** Panele menu ładowane leniwie. */
const lazy = {
  multi: () => import('./ui/multiplayer.js'),
  ach: () => import('./ui/achievementsScreen.js'),
  custom: () => import('./ui/customize.js'),
  menu: () => import('./ui/menu.js'),
};
const fail = (e) => ($('#menu-msg').textContent = 'Nie udało się wczytać: ' + (e?.message || e));

function openMulti() {
  lazy
    .multi()
    .then((m) => m.showMulti({ loadCore, withCore, online, onBack: () => showScreen('#screen-start') }))
    .catch(fail);
}
const openAch = () => lazy.ach().then((m) => m.showAchievements({ onBack: () => showScreen('#screen-start') })).catch(fail);

$('#btn-local').onclick = withCore($('#btn-local'), (core) => core.openLocal());
$('#btn-multi').onclick = openMulti;
$('#btn-ach').onclick = openAch;
$('#btn-customize').onclick = () => lazy.custom().then((m) => m.openCustomize({ onAchievements: openAch })).catch(fail);

// Rozgrzewka: pobierz rdzeń, gdy użytkownik zbliża się do przycisku (nie blokuje startu).
for (const id of ['#btn-local', '#btn-multi']) {
  $(id).addEventListener('pointerenter', () => loadCore().catch(() => {}), { once: true });
  $(id).addEventListener('touchstart', () => loadCore().catch(() => {}), { once: true, passive: true });
}

showScreen('#screen-start');
const joinParam = params.get('join');
if (joinParam) {
  openMulti();
  const fill = () => {
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector('#join-code'));
    if (el) el.value = joinParam.toUpperCase().slice(0, 5);
  };
  fill();
}

// Podgląd klasy (sprite'y) dopiero po pierwszym malowaniu, gdy przeglądarka ma wolną chwilę.
const idle = /** @type {any} */ (window).requestIdleCallback || ((cb) => setTimeout(cb, 200));
idle(() => lazy.menu().then((m) => m.initClassPanel()).catch(() => {}), { timeout: 1500 });

function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* brak storage */
  }
}
