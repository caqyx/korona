import { $, esc, showScreen } from './dom.js';
import { SKINS, SKIN_IDS, MATCH, BOSS_COMMON } from '../sim/config.js';
import { slotColor } from '../render/palette.js';
import { connectedPads } from '../input/gamepad.js';

const MAX = MATCH.maxPlayersLocal;

/** Ekran konfiguracji trybu lokalnego (2–8 graczy: ludzie i boty). */
export function showLocalSetup(nick, onStart, onBack) {
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
    { nick: nick || 'Gracz 1', skin: 'rycerz', device: 'kbm' },
    { nick: 'Bot 1', skin: 'lucznik', device: 'bot' },
  ];
  const render = () => {
    $('#local-slots').innerHTML = slots
      .map(
        (s, i) => `<div class="slot" style="--c:${slotColor(i)}">
        <input data-i="${i}" data-k="nick" value="${esc(s.nick)}" maxlength="16" />
        <select data-i="${i}" data-k="skin">${SKIN_IDS.map((id) => `<option value="${id}" ${id === s.skin ? 'selected' : ''}>${SKINS[id].name}</option>`).join('')}</select>
        <select data-i="${i}" data-k="device">${devOptions().map(([v, l]) => `<option value="${v}" ${v === s.device ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${slots.length > 2 ? `<button class="small-btn" data-rm="${i}">Usuń</button>` : ''}
      </div>`,
      )
      .join('');
    for (const el of $('#local-slots').querySelectorAll('[data-k]')) {
      el.addEventListener('change', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        slots[Number(t.dataset.i)][/** @type {'nick'} */ (t.dataset.k)] = t.value;
      });
    }
    for (const el of $('#local-slots').querySelectorAll('[data-rm]')) {
      el.addEventListener('click', () => {
        slots.splice(Number(/** @type {HTMLElement} */ (el).dataset.rm), 1);
        render();
      });
    }
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
  $('#btn-local-start').onclick = () => onStart(slots.map((s) => ({ ...s })));
  $('#btn-local-back').onclick = onBack;
  window.addEventListener('gamepadconnected', render);
  render();
  showScreen('#screen-local');
}
