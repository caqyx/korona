/**
 * Singleplayer: tryby z botami (Klasyczny vs boty, Przetrwanie, Boss Rush) jako główny wybór,
 * a pod nimi opcje: mapa, trudność botów, liczba botów/sojuszników, sterowanie, bohater.
 * „Tryb custom” (pełna konfiguracja slotów) to osobny przycisk na dole ekranu (#btn-mode-custom).
 */
import { $, esc, showScreen } from './dom.js';
import { SKINS, SKIN_IDS, AI_LEVELS, MODES } from '../sim/config.js';
import { MAPS, MAP_IDS } from '../sim/maps.js';
import { slotColor } from '../render/palette.js';
import { heroPreview, iconCanvas, mount } from './previews.js';
import { getBest } from './records.js';
import { getProfile } from './profile.js';

const MODE_CARDS = [
  { id: 'crown', icon: 'mode:crown', name: 'Klasyczny vs boty', desc: 'Zasady korony: zabij bossa, przejmij koronę, pierwszy do 100 pkt. Ty kontra boty.', bots: [1, 7, 3], allies: false },
  { id: 'survival', icon: 'mode:survival', name: 'Przetrwanie', desc: 'Fale szkieletów, pająków, łuczników i osiłków. Co 5. fala boss. Między falami wybierasz ulepszenie.', bots: [0, 3, 1], allies: true },
  { id: 'teams', icon: 'mode:crown', name: 'Bitwa bossów', desc: 'Dwie drużyny, w każdej jeden boss. Pokonaj wrogiego bossa — drużyna, która straci swojego, przegrywa.', bots: null, teams: true },
  { id: 'bossrush', icon: 'mode:bossrush', name: 'Boss Rush', desc: 'Wszystkie 8 bossów po kolei, każdy silniejszy. Między walkami ulepszenia. Pokonaj wszystkich!', bots: [0, 3, 1], allies: true },
];

const DEVICES = [
  ['kbm', 'Klawiatura + mysz'],
  ['kb2', 'Klawiatura 2 (IJKL)'],
  ['pad0', 'Pad 1'],
  ['touch', 'Dotyk'],
];

/**
 * @param {{nick:string, firstDevice:string, onStart:(slots:any[], opts:any)=>void, onCustom:()=>void, onBack:()=>void}} o
 */
export function showModeSelect(o) {
  const st = { mode: 'crown', mapId: 'random', aiLevel: 'normal', skin: getProfile().skin, device: o.firstDevice, bots: 3, tsize: 3, role: 'hero' };
  const root = $('#mode-root');

  const card = (m) => {
    const best = getBest(m.id);
    return `<button class="mode-card ${st.mode === m.id ? 'sel' : ''}" data-mode="${m.id}">
      <span class="mode-ico" data-icon="${m.icon}"></span>
      <span class="mode-name">${m.name}</span>
      <span class="mode-desc">${m.desc}</span>
      ${best ? `<span class="mode-best">Rekord: ${esc(best)}</span>` : ''}
    </button>`;
  };

  const render = () => {
    const m = MODE_CARDS.find((x) => x.id === st.mode) || MODE_CARDS[0];
    const opts = `<div class="mode-opts px-box">
        <div class="opt"><span class="lbl">Mapa</span>
          <div class="map-pick">
            <button class="map-chip ${st.mapId === 'random' ? 'sel' : ''}" data-map="random"><span class="map-thumb rnd">?</span><span>Losowa</span></button>
            ${MAP_IDS.map((id) => `<button class="map-chip ${st.mapId === id ? 'sel' : ''}" data-map="${id}" title="${esc(MAPS[id].desc)}"><span class="map-thumb" data-thumb="${id}"></span><span>${MAPS[id].name}</span></button>`).join('')}
          </div>
          <p class="small map-desc">${st.mapId === 'random' ? 'Mapa losowana przy każdym meczu.' : esc(MAPS[st.mapId].desc)}</p>
        </div>
        <div class="opt-row">
          <div class="opt"><span class="lbl">Trudność botów</span>
            <div class="seg">${Object.entries(AI_LEVELS).map(([k, v]) => `<button class="seg-b ${st.aiLevel === k ? 'sel' : ''}" data-level="${k}">${v.name}</button>`).join('')}</div>
          </div>
          ${
            m.teams
              ? `<div class="opt"><span class="lbl">Wielkość drużyn</span>
            <div class="seg">${[2, 3, 4].map((n) => `<button class="seg-b ${st.tsize === n ? 'sel' : ''}" data-tsize="${n}">${n} vs ${n}</button>`).join('')}</div>
          </div>
          <div class="opt"><span class="lbl">Twoja rola</span>
            <div class="seg">${[['hero', 'Bohater'], ['boss', 'Boss'], ['random', 'Losowo']].map(([k, l]) => `<button class="seg-b ${st.role === k ? 'sel' : ''}" data-role="${k}">${l}</button>`).join('')}</div>
          </div>`
              : `<div class="opt"><span class="lbl">${m.allies ? 'Sojusznicy (boty)' : 'Liczba botów'}</span>
            <div class="seg">${range(m.bots[0], m.bots[1]).map((n) => `<button class="seg-b ${st.bots === n ? 'sel' : ''}" data-bots="${n}">${n}</button>`).join('')}</div>
          </div>`
          }
          <div class="opt"><span class="lbl">Sterowanie</span>
            <select id="mode-device">${DEVICES.map(([v, l]) => `<option value="${v}" ${v === st.device ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
        </div>
        <div class="opt"><span class="lbl">Twój bohater</span>
          <div class="hero-pick">${SKIN_IDS.map((id) => `<button class="hero-chip ${st.skin === id ? 'sel' : ''}" data-skin="${id}" style="--c:${SKINS[id].color}"><span class="hero-pv" data-pv="${id}"></span><span>${SKINS[id].name}</span></button>`).join('')}</div>
        </div>
      </div>`;
    root.innerHTML = `<div class="mode-cards">${MODE_CARDS.map(card).join('')}</div>${opts}`;
    root.querySelectorAll('[data-icon]').forEach((el) => mount(el, iconCanvas(/** @type {HTMLElement} */ (el).dataset.icon || '', 4)));
    root.querySelectorAll('[data-pv]').forEach((el) => mount(el, heroPreview(/** @type {HTMLElement} */ (el).dataset.pv || 'rycerz', slotColor(0), { w: 48, h: 44, maxScale: 2 })));
    paintThumbs(root);
    root.querySelectorAll('[data-mode]').forEach((el) =>
      el.addEventListener('click', () => {
        st.mode = /** @type {HTMLElement} */ (el).dataset.mode || 'crown';
        const mm = MODE_CARDS.find((x) => x.id === st.mode);
        if (mm?.bots) st.bots = Math.min(mm.bots[1], Math.max(mm.bots[0], mm.bots[2]));
        render();
      }),
    );
    root.querySelectorAll('[data-map]').forEach((el) => el.addEventListener('click', () => ((st.mapId = /** @type {HTMLElement} */ (el).dataset.map || 'random'), render())));
    root.querySelectorAll('[data-level]').forEach((el) => el.addEventListener('click', () => ((st.aiLevel = /** @type {HTMLElement} */ (el).dataset.level || 'normal'), render())));
    root.querySelectorAll('[data-tsize]').forEach((el) => el.addEventListener('click', () => ((st.tsize = Number(/** @type {HTMLElement} */ (el).dataset.tsize)), render())));
    root.querySelectorAll('[data-role]').forEach((el) => el.addEventListener('click', () => ((st.role = /** @type {HTMLElement} */ (el).dataset.role || 'hero'), render())));
    root.querySelectorAll('[data-bots]').forEach((el) => el.addEventListener('click', () => ((st.bots = Number(/** @type {HTMLElement} */ (el).dataset.bots)), render())));
    root.querySelectorAll('[data-skin]').forEach((el) => el.addEventListener('click', () => ((st.skin = /** @type {HTMLElement} */ (el).dataset.skin || 'rycerz'), render())));
    $('#mode-device')?.addEventListener('change', (e) => (st.device = /** @type {HTMLSelectElement} */ (e.target).value));
  };

  $('#btn-mode-start').onclick = () => {
    if (st.mode === 'teams') return o.onStart(teamSlots(), { mode: 'teams', mapId: st.mapId, aiLevel: st.aiLevel });
    const slots = [{ nick: o.nick || 'Gracz 1', skin: st.skin, device: st.device }];
    for (let i = 0; i < st.bots; i++) slots.push({ nick: `Bot ${i + 1}`, skin: SKIN_IDS[(SKIN_IDS.indexOf(/** @type {any} */ (st.skin)) + 1 + i) % SKIN_IDS.length], device: 'bot' });
    o.onStart(slots, { mode: st.mode, mapId: st.mapId, aiLevel: st.aiLevel });
  };
  /** Bitwa bossów: Ty + sojusznicy (drużyna Niebieska) kontra boty (Czerwona); po jednym bossie w drużynie. */
  function teamSlots() {
    const n = st.tsize;
    const meBoss = st.role === 'boss' || (st.role === 'random' && Math.random() < 1 / n);
    const pick = (i) => SKIN_IDS[(SKIN_IDS.indexOf(/** @type {any} */ (st.skin)) + 1 + i) % SKIN_IDS.length];
    const slots = [{ nick: o.nick || 'Gracz 1', skin: st.skin, device: st.device, team: 0, wantsBoss: meBoss }];
    for (let i = 1; i < n; i++) slots.push({ nick: `Sojusznik ${i}`, skin: pick(i), device: 'bot', team: 0, wantsBoss: !meBoss && i === 1 });
    for (let i = 0; i < n; i++) slots.push({ nick: `Wróg ${i + 1}`, skin: pick(i + 3), device: 'bot', team: 1, wantsBoss: i === 0 });
    return slots;
  }
  $('#btn-mode-custom').onclick = () => o.onCustom();
  $('#btn-mode-back').onclick = o.onBack;
  render();
  showScreen('#screen-modes');
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Miniatury map (grafika biomów ładowana leniwie; bez niej zostaje kolor biomu). */
function paintThumbs(root) {
  import('../render/maps/index.js')
    .then((mod) => {
      root.querySelectorAll('[data-thumb]').forEach((el) => {
        const id = /** @type {HTMLElement} */ (el).dataset.thumb || 'arena';
        try {
          const c = mod.getMapPreview(MAPS[id], 96, 60);
          c.classList.add('px-canvas');
          mount(el, c);
        } catch {
          /* brak miniatury */
        }
      });
    })
    .catch(() => {});
}

export { MODES };
