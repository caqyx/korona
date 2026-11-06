import { $, esc, showScreen } from './dom.js';
import { slotColor } from '../render/palette.js';
import { SKINS } from '../sim/config.js';
import { heroPreview, mount } from './previews.js';
import { saveRecord } from './records.js';

/**
 * Ekran podsumowania: pikselowe podium (sprite'y top 3) i statystyki.
 * @param {any} state końcowy stan meczu @param {{onRematch:()=>void,onBack:()=>void, canRematch:boolean, msg?:string}} o
 */
export function showSummary(state, o) {
  const sorted = [...state.players].filter((p) => !p.ai).sort((a, b) => (a.dnf === b.dnf ? b.score - a.score : a.dnf ? 1 : -1));
  const winner = state.players.find((p) => p.id === state.winnerId);
  const md = state.modeData;
  const record = state.mode && state.mode !== 'crown' ? saveRecord(state) : false;
  $('#summary-title').textContent =
    state.mode === 'survival'
      ? `Przetrwaliście do fali ${md?.wave ?? 0}${record ? ' — nowy rekord!' : ''}`
      : state.mode === 'bossrush'
        ? state.endReason === 'victory'
          ? `Zwycięstwo! Pokonano wszystkich ${md.total} bossów`
          : `Pokonani bossowie: ${md?.defeated ?? 0}/${md?.total ?? 8}${record ? ' — nowy rekord!' : ''}`
        : winner
          ? `Wygrywa ${winner.nick}!`
          : 'Koniec meczu';
  const top = sorted.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const podium = $('#podium');
  podium.innerHTML = order
    .map((p) => {
      const place = sorted.indexOf(p) + 1;
      return `<div class="pod p${place}" style="--c:${slotColor(p.slot)}">
        ${place === 1 ? '<div class="crown-art" aria-hidden="true"><i></i></div>' : ''}
        <div class="pod-pv"></div>
        <div class="who"><span class="n">${esc(p.nick)}</span><span class="s">${p.score} pkt</span></div>
        <div class="block">${place}</div>
      </div>`;
    })
    .join('');
  podium.querySelectorAll('.pod-pv').forEach((el, i) => {
    const p = order[i];
    mount(el, heroPreview(p.skin, slotColor(p.slot), { w: 96, h: 84, maxScale: 4, look: p.look, anim: sorted.indexOf(p) === 0 ? 'attack' : 'idle' }));
  });
  $('#summary-table').innerHTML =
    (state.mode && state.mode !== 'crown'
      ? '<tr><th>#</th><th>Gracz</th><th>Skin</th><th>Pkt</th><th>—</th><th>Bossowie dobici</th><th>—</th><th>Śmierci</th></tr>'
      : '<tr><th>#</th><th>Gracz</th><th>Skin</th><th>Pkt</th><th>Korona (s)</th><th>Przejęte korony</th><th>Zabójstwa bossa</th><th>Śmierci</th></tr>') +
    sorted
      .map(
        (p, i) =>
          `<tr class="${p.id === state.winnerId ? 'win' : ''}"><td class="place">${i + 1}.</td><td style="color:${slotColor(p.slot)}"><span class="mini" data-i="${i}"></span>${esc(p.nick)}${p.dnf ? ' (DNF)' : ''}</td><td>${SKINS[p.skin]?.name ?? esc(p.skin)}</td><td>${p.score}</td><td>${Math.round(p.crownTime)}</td><td>${p.lastHits}</td><td>${p.bossKills}</td><td>${p.deaths}</td></tr>`,
      )
      .join('');
  for (const el of $('#summary-table').querySelectorAll('.mini')) {
    const p = sorted[Number(/** @type {HTMLElement} */ (el).dataset.i)];
    if (p && SKINS[p.skin]) mount(el, heroPreview(p.skin, slotColor(p.slot), { w: 48, h: 44, maxScale: 2, look: p.look }));
  }
  $('#summary-msg').textContent = o.msg || '';
  const rb = /** @type {HTMLButtonElement} */ ($('#btn-rematch'));
  rb.disabled = !o.canRematch;
  rb.onclick = o.onRematch;
  $('#btn-summary-back').onclick = o.onBack;
  showScreen('#screen-summary');
}
