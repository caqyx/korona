/** Bestiariusz: galeria 8 bossów z podglądem sprite'a, rzadkością, pasywką i umiejętnościami. */
import { openModal, esc } from './dom.js';
import { BOSSES, BOSS_IDS, BOSS_COMMON, RARITY } from '../sim/config.js';
import { BOSS_TEXT, rarityOf, num } from './codex.js';
import { bossPreview, iconCanvas, mount } from './previews.js';

let selected = 'kolos';

export function openBestiary() {
  const body = openModal({
    title: 'Bestiariusz',
    cls: 'modal-bestiary',
    body: `<div class="best">
        <div class="best-list" role="listbox" aria-label="Bossowie">
          ${BOSS_IDS.map((id) => `<button class="best-tile" data-boss="${id}" style="--r:${rarityOf(id).color}" role="option"><span class="best-thumb"></span><span>${esc(BOSSES[id].name)}</span></button>`).join('')}
        </div>
        <div class="best-detail px-box inset"></div>
      </div>
      <p class="small best-foot">Rzadkość = szansa wylosowania (${Object.values(RARITY)
        .map((r) => `<b style="color:${r.color}">${r.name.toLowerCase()}</b>`)
        .join(' › ')}). Nigdy ten sam boss dwa razy z rzędu. HP bossa = ${BOSS_COMMON.hpPerHero} × liczba bohaterów.</p>`,
  });
  for (const t of body.querySelectorAll('.best-tile')) {
    const id = /** @type {HTMLElement} */ (t).dataset.boss || 'kolos';
    mount(t.querySelector('.best-thumb'), bossPreview(id, { w: 56, h: 56, maxScale: 1 }));
    t.addEventListener('click', () => show(body, id));
  }
  show(body, selected);
}

/** @param {HTMLElement} body @param {string} id */
function show(body, id) {
  selected = id;
  for (const t of body.querySelectorAll('.best-tile')) t.classList.toggle('sel', /** @type {HTMLElement} */ (t).dataset.boss === id);
  const b = /** @type {any} */ (BOSSES)[id];
  const tx = BOSS_TEXT[id];
  const r = rarityOf(id);
  const row = (key, name, desc, cd) =>
    `<li><span class="ab-ico" data-ico="boss:${id}:${key}"></span><span class="ab-key">${key === 'atk' ? 'ATK' : key.toUpperCase()}</span><span class="ab-txt"><b>${esc(name)}</b> ${esc(desc)}</span>${cd ? `<span class="cd">${num(cd)} s</span>` : ''}</li>`;
  const det = /** @type {HTMLElement} */ (body.querySelector('.best-detail'));
  det.style.setProperty('--r', r.color);
  det.innerHTML = `
    <div class="best-hero">
      <div class="best-sprite"></div>
      <div class="best-meta">
        <span class="rarity" style="--r:${r.color}">${esc(r.name)}</span>
        <h3>${esc(b.name)}</h3>
        <span class="small-l">${esc(tx.title)} · HP ${num(b.hpMul)}× · prędkość ${num(b.speedMul)}×</span>
      </div>
    </div>
    <div class="passive"><b>Pasywka — ${esc(tx.passive[0])}:</b> ${esc(tx.passive[1])}</div>
    <ul class="abilities">
      ${row('atk', 'Atak', tx.atk, b.atk.cd)}
      ${row('q', tx.q[0], tx.q[1], b.q.cd)}
      ${row('e', tx.e[0], tx.e[1], b.e.cd)}
      ${row('r', tx.r[0], tx.r[1], b.r.cd)}
    </ul>`;
  mount(det.querySelector('.best-sprite'), bossPreview(id, { w: 168, h: 160, maxScale: 3 }));
  for (const el of det.querySelectorAll('[data-ico]')) mount(el, iconCanvas(/** @type {HTMLElement} */ (el).dataset.ico || '', 2));
}
