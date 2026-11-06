/**
 * Ekran Multiplayer: lista pokoi na żywo (katalog), dołączanie dwuklikiem / dwoma stuknięciami
 * albo zaznaczeniem i „Dołącz”, dołączanie kodem i tworzenie pokoju.
 */
import { $, esc, showScreen, onScreen, getScreen } from './dom.js';
import { openDirectory } from '../net/directory.js';

const DOUBLE_MS = 400;

/** @type {import('../net/directory.js').Directory|null} */
let dir = null;
/** @type {(() => void)|null} */
let unsub = null;
/** @type {(() => void)|null} */
let unScreen = null;
let ageTimer = 0;
let wired = false;

/** @type {import('../net/directory.js').RoomInfo[]} */
let rooms = [];
let selected = '';
let lastTap = { code: '', t: 0 };

/**
 * @param {{loadCore:()=>Promise<any>, withCore:(btn:HTMLElement, action:(core:any)=>any, msgSel?:string)=>()=>Promise<void>, online:boolean, onBack:()=>void}} o
 */
export function showMulti(o, keepMsg = false) {
  if (!keepMsg) $('#start-msg').textContent = '';
  $('#multi-net').textContent = o.online ? 'Supabase Realtime + WebRTC' : 'Transport lokalny (karty tej przeglądarki)';
  if (!wired) wire(o);
  showScreen('#screen-multi');
  render();
  open(o.online);
  unScreen?.();
  unScreen = onScreen((id) => {
    if (id !== '#screen-multi') close();
  });
  // rozgrzewka rdzenia (sieć, symulacja) w tle — klik „Utwórz” / „Dołącz” będzie natychmiastowy
  o.loadCore().catch(() => {});
}

/** @param {boolean} online */
async function open(online) {
  close();
  const token = {};
  openToken = token;
  try {
    const d = await openDirectory({ forceLocal: !online });
    if (openToken !== token) return d.close();
    dir = d;
    unsub = d.subscribe((list) => {
      rooms = list;
      render();
    });
  } catch {
    $('#start-msg').textContent = 'Nie udało się pobrać listy pokoi — możesz dołączyć kodem.';
  }
  clearInterval(ageTimer);
  ageTimer = window.setInterval(render, 15000);
}
let openToken = /** @type {object|null} */ (null);

function close() {
  openToken = null;
  unsub?.();
  unsub = null;
  dir?.close();
  dir = null;
  clearInterval(ageTimer);
  unScreen?.();
  unScreen = null;
}

/** @param {{loadCore:()=>Promise<any>, withCore:Function, onBack:()=>void}} o */
function wire(o) {
  wired = true;
  /** Wejście do pokoju; po nieudanej próbie wracamy na ten ekran (komunikat w #start-msg zostaje widoczny). */
  const enter = (create, code) => async (core) => {
    await core.enterOnline(create, code);
    if (getScreen() !== '#screen-lobby' && getScreen() !== null) showMulti(o, true);
  };
  const join = (code) => o.withCore($('#btn-join-sel'), enter(false, code), '#start-msg')();
  $('#btn-create').onclick = o.withCore($('#btn-create'), enter(true), '#start-msg');
  $('#btn-join').onclick = o.withCore($('#btn-join'), enter(false), '#start-msg');
  $('#join-code').addEventListener('keydown', (e) => /** @type {KeyboardEvent} */ (e).key === 'Enter' && $('#btn-join').click());
  $('#join-code').addEventListener('input', (e) => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    t.value = t.value.toUpperCase();
  });
  $('#btn-join-sel').onclick = () => {
    const r = rooms.find((x) => x.code === selected);
    if (r && r.status === 'lobby') join(r.code);
  };
  $('#btn-multi-back').onclick = () => {
    close();
    o.onBack();
  };
  const list = $('#room-list');
  list.addEventListener('click', (e) => {
    const li = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-room]'));
    if (!li) return;
    const code = li.dataset.room || '';
    const r = rooms.find((x) => x.code === code);
    const now = performance.now();
    const dbl = lastTap.code === code && now - lastTap.t < DOUBLE_MS;
    lastTap = { code, t: dbl ? 0 : now };
    selected = code;
    render();
    if (!r) return;
    if (r.status !== 'lobby') {
      $('#start-msg').textContent = 'W tym pokoju trwa mecz — dołączysz, gdy wróci do lobby.';
      return;
    }
    $('#start-msg').textContent = '';
    if (dbl) join(code);
  });
  list.addEventListener('keydown', (e) => {
    const k = /** @type {KeyboardEvent} */ (e).key;
    const li = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-room]'));
    if (!li) return;
    if (k === 'Enter') {
      selected = li.dataset.room || '';
      $('#btn-join-sel').click();
    } else if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      const sib = /** @type {HTMLElement|null} */ (k === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling);
      sib?.focus();
    }
  });
}

const age = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (!t || s < 60) return 'teraz';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
};

function render() {
  const list = $('#room-list');
  if (!list) return;
  if (selected && !rooms.some((r) => r.code === selected)) selected = '';
  const focused = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.room;
  list.innerHTML = rooms
    .map((r) => {
      const full = r.players >= r.max;
      const playing = r.status !== 'lobby';
      return `<li class="room ${r.code === selected ? 'sel' : ''} ${playing ? 'playing' : ''}" data-room="${esc(r.code)}" role="option" tabindex="0" aria-selected="${r.code === selected}">
        <span class="r-code">${esc(r.code)}</span>
        <span class="r-owner">♛ ${esc(r.ownerNick)}</span>
        <span class="r-players"><span class="pips">${Array.from({ length: r.max }, (_, i) => `<i class="${i < r.players ? 'on' : ''}"></i>`).join('')}</span>${r.players}/${r.max}</span>
        <span class="r-status"><span class="badge ${playing ? 'live' : full ? '' : 'ready'}">${playing ? 'W grze' : full ? 'Pełny' : 'Lobby'}</span></span>
        <span class="r-age">${age(r.createdAt)}</span>
      </li>`;
    })
    .join('');
  if (focused) /** @type {HTMLElement|null} */ (list.querySelector(`[data-room="${focused}"]`))?.focus({ preventScroll: true });
  $('#rooms-empty').classList.toggle('hidden', rooms.length > 0);
  const sel = rooms.find((r) => r.code === selected);
  /** @type {HTMLButtonElement} */ ($('#btn-join-sel')).disabled = !sel || sel.status !== 'lobby' || sel.players >= sel.max;
  $('#btn-join-sel').textContent = sel ? `Dołącz do ${sel.code}` : 'Dołącz';
}
