import { $, esc, showScreen } from './dom.js';
import { slotColor } from '../render/palette.js';
import { SKINS } from '../sim/config.js';

/**
 * Ekran podsumowania: podium i statystyki.
 * @param {any} state końcowy stan meczu @param {{onRematch:()=>void,onBack:()=>void, canRematch:boolean, msg?:string}} o
 */
export function showSummary(state, o) {
  const sorted = [...state.players].sort((a, b) => (a.dnf === b.dnf ? b.score - a.score : a.dnf ? 1 : -1));
  const winner = state.players.find((p) => p.id === state.winnerId);
  $('#summary-title').textContent = winner ? `Wygrywa ${winner.nick}!` : 'Koniec meczu';
  const top = sorted.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  $('#podium').innerHTML = order
    .map((p) => {
      const place = sorted.indexOf(p) + 1;
      const h = place === 1 ? 120 : place === 2 ? 90 : 70;
      return `<div style="height:${h}px;border-top:3px solid ${slotColor(p.slot)}"><b>${place}.</b><br>${esc(p.nick)}<br>${p.score} pkt</div>`;
    })
    .join('');
  $('#summary-table').innerHTML =
    '<tr><th>Gracz</th><th>Skin</th><th>Pkt</th><th>Korona (s)</th><th>Ostatnie ciosy</th><th>Zabójstwa bossa</th><th>Śmierci</th></tr>' +
    sorted
      .map(
        (p) =>
          `<tr><td style="color:${slotColor(p.slot)}">${esc(p.nick)}${p.dnf ? ' (DNF)' : ''}</td><td>${SKINS[p.skin]?.name ?? p.skin}</td><td>${p.score}</td><td>${Math.round(p.crownTime)}</td><td>${p.lastHits}</td><td>${p.bossKills}</td><td>${p.deaths}</td></tr>`,
      )
      .join('');
  $('#summary-msg').textContent = o.msg || '';
  const rb = /** @type {HTMLButtonElement} */ ($('#btn-rematch'));
  rb.disabled = !o.canRematch;
  rb.onclick = o.onRematch;
  $('#btn-summary-back').onclick = o.onBack;
  showScreen('#screen-summary');
}
