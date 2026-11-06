import { $, esc, showScreen } from './dom.js';
import { SKINS, SKIN_IDS, MATCH, BOSS_COMMON, AI_LEVELS } from '../sim/config.js';
import { MAPS, MAP_IDS } from '../sim/maps.js';
import { slotColor } from '../render/palette.js';
import { connectedPads } from '../input/gamepad.js';
import { SKIN_TEXT } from './codex.js';
import { heroPreview, mount } from './previews.js';
import { getProfile } from './profile.js';

const MAX = MATCH.maxPlayersLocal;

/** Ekran konfiguracji trybu lokalnego (2–8 graczy: ludzie i boty). */
export function showLocalSetup(nick, onStart, onBack, firstDevice = 'kbm') {
  const devOptions = () => {
    const pads = connectedPads();
    return [
      ['kbm', 'Klawiatura + mysz'],
      ['kb2', 'Klawiatura 2 (IJKL)'],
      ...[0, 1, 2, 3].map((i) => [`pad${i}`, `Pad ${i + 1}${pads.includes(i) ? '' : ' (niepodł.)'}`]),
      ['touch', 'Dotyk'],
      ['bot', 'Bot'],
    ];
  };
  const slots = [
    { nick: nick || 'Gracz 1', skin: getProfile().skin, device: firstDevice },
    { nick: 'Bot 1', skin: 'lucznik', device: 'bot' },
  ];
  const who = (s, i) => `P${i + 1} · ${s.device === 'bot' ? 'Bot' : 'Gracz'}`;
  const render = () => {
    const root = $('#local-slots');
    root.innerHTML =
      slots
        .map((s, i) => {
          const t = SKIN_TEXT[s.skin];
          return `<div class="slot" style="--c:${slotColor(i)};--c2:${SKINS[s.skin].color}" data-slot="${i}">
          <div class="slot-head"><span class="who">${who(s, i)}</span>${slots.length > 2 ? `<button class="btn-x" data-rm="${i}" aria-label="Usuń gracza ${i + 1}" title="Usuń">✕</button>` : ''}</div>
          <div class="slot-pv" title="${esc(`${t.ability} (${t.cd} s): ${t.abilityDesc}`)}"></div>
          <div class="skin-pick">
            <button class="arrow" data-skin-step="-1" data-i="${i}" aria-label="Poprzedni bohater">‹</button>
            <span class="sname">${SKINS[s.skin].name}</span>
            <button class="arrow" data-skin-step="1" data-i="${i}" aria-label="Następny bohater">›</button>
          </div>
          <div class="srole">${esc(t.ability)} · ${t.cd} s</div>
          <input data-i="${i}" data-k="nick" value="${esc(s.nick)}" maxlength="16" aria-label="Nick gracza ${i + 1}" spellcheck="false" />
          <select data-i="${i}" data-k="device" aria-label="Sterowanie gracza ${i + 1}">${devOptions().map(([v, l]) => `<option value="${v}" ${v === s.device ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>`;
        })
        .join('') + (slots.length < MAX ? `<button class="slot add-slot" data-add aria-label="Dodaj bota">+ Dodaj bota</button>` : '');
    root.querySelectorAll('.slot-pv').forEach((el, i) => mount(el, heroPreview(slots[i].skin, slotColor(i), { w: 72, h: 64, maxScale: 3 })));
    for (const el of root.querySelectorAll('[data-k]')) {
      el.addEventListener('change', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        const i = Number(t.dataset.i);
        slots[i][/** @type {'nick'} */ (t.dataset.k)] = t.value;
        if (t.dataset.k === 'device') {
          const w = root.querySelector(`[data-slot="${i}"] .who`);
          if (w) w.textContent = who(slots[i], i);
        }
      });
    }
    for (const el of root.querySelectorAll('[data-skin-step]')) {
      el.addEventListener('click', () => {
        const b = /** @type {HTMLElement} */ (el);
        const s = slots[Number(b.dataset.i)];
        const n = SKIN_IDS.length;
        s.skin = SKIN_IDS[(SKIN_IDS.indexOf(/** @type {any} */ (s.skin)) + Number(b.dataset.skinStep) + n) % n];
        render();
        /** @type {HTMLElement|null} */ (root.querySelector(`[data-i="${b.dataset.i}"][data-skin-step="${b.dataset.skinStep}"]`))?.focus({ preventScroll: true });
      });
    }
    for (const el of root.querySelectorAll('[data-rm]')) {
      el.addEventListener('click', () => {
        slots.splice(Number(/** @type {HTMLElement} */ (el).dataset.rm), 1);
        render();
      });
    }
    root.querySelector('[data-add]')?.addEventListener('click', () => $('#btn-local-add').click());
    /** @type {HTMLButtonElement} */ ($('#btn-local-add')).disabled = slots.length >= MAX;
    /** @type {HTMLButtonElement} */ ($('#btn-local-fill')).disabled = slots.length >= MAX;
    const heroes = slots.length - 1;
    $('#local-info').textContent = `Graczy: ${slots.length}/${MAX} · HP bossa = ${BOSS_COMMON.hpPerHero} × ${heroes} bohaterów = ${BOSS_COMMON.hpPerHero * heroes} (× mnożnik typu)`;
  };
  const addBot = () => slots.push({ nick: `Bot ${slots.length}`, skin: SKIN_IDS[slots.length % 5], device: 'bot' });
  $('#btn-local-add').onclick = () => {
    if (slots.length >= MAX) return;
    addBot();
    render();
  };
  $('#btn-local-fill').onclick = () => {
    while (slots.length < MAX) addBot();
    render();
  };
  $('#btn-local-start').onclick = () =>
    onStart(
      slots.map((s) => ({ ...s })),
      { mode: 'crown', mapId: /** @type {HTMLSelectElement} */ ($('#local-map')).value, aiLevel: /** @type {HTMLSelectElement} */ ($('#local-level')).value },
    );
  $('#local-map').innerHTML = `<option value="random">Losowa mapa</option>${MAP_IDS.map((id) => `<option value="${id}">${MAPS[id].name}</option>`).join('')}`;
  $('#local-level').innerHTML = Object.entries(AI_LEVELS)
    .map(([k, v]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>Boty: ${v.name}</option>`)
    .join('');
  $('#btn-local-back').onclick = onBack;
  window.addEventListener('gamepadconnected', render);
  render();
  showScreen('#screen-local');
}
