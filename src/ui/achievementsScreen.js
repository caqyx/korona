/** Ekran Osiągnięć: lista z postępem, nagrody (na razie „wkrótce”). */
import { $, esc, showScreen } from './dom.js';
import { getAchievements } from './achievements.js';
import { findCosmetic } from '../sim/cosmetics.js';

const fmt = (n) => (n >= 1000 ? `${Math.floor(n / 100) / 10}`.replace('.', ',') + 'k' : String(n));

/** @param {{onBack:()=>void}} o */
export function showAchievements(o) {
  const list = getAchievements();
  const done = list.filter((a) => a.unlocked).length;
  $('#ach-sum').innerHTML = `<span class="ach-count"><b>${done}</b>/${list.length}</span>
    <span class="pbar big" aria-hidden="true"><i style="width:${(done / list.length) * 100}%"></i></span>`;
  const sorted = [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.value / b.goal - a.value / a.goal);
  $('#ach-list').innerHTML = sorted
    .map((a) => {
      const pct = Math.round((a.value / a.goal) * 100);
      return `<div class="ach ${a.unlocked ? 'done' : ''}">
        <span class="ach-ico ${a.unlocked ? 'ok' : 'lock'}" aria-label="${a.unlocked ? 'Odblokowane' : 'Zablokowane'}"></span>
        <div class="ach-body">
          <span class="ach-name">${esc(a.name)}</span>
          <span class="ach-desc">${esc(a.desc)}</span>
          <span class="ach-prog"><span class="pbar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="ach-val">${fmt(a.value)}/${fmt(a.goal)}</span></span>
          <span class="ach-reward"><span class="rw-ico" data-rw="${esc(a.rewardId || '')}"></span>${a.unlocked ? `<span>Odblokowano: <b>${esc(a.reward)}</b> — załóż w Customize</span><button class="btn-sm rw-btn" data-wear="${esc(a.rewardId || '')}">Załóż</button>` : `<span>Nagroda: ${esc(a.reward)}</span>`}</span>
        </div>
      </div>`;
    })
    .join('');
  paintRewards(o);
  $('#btn-ach-back').onclick = o.onBack;
  showScreen('#screen-ach');
  $('#screen-ach').scrollTop = 0;
}

/** Ikony nagród (sprite kosmetyku, gdy renderer go ma; inaczej próbka koloru / znak) i przyciski „Załóż”. */
function paintRewards(o) {
  const root = $('#ach-list');
  for (const el of root.querySelectorAll('[data-rw]')) {
    const [kind, id] = (/** @type {HTMLElement} */ (el).dataset.rw || ':').split(':');
    const c = findCosmetic(/** @type {any} */ (kind), id);
    const h = /** @type {HTMLElement} */ (el);
    if (!c) {
      h.remove();
      continue;
    }
    h.classList.add(`g-${kind}`);
    if (kind === 'color' && c.swatch) h.style.background = c.swatch;
  }
  // sprite'y ikon dopiero po narysowaniu listy (moduł podglądów jest cięższy)
  import('./previews.js')
    .then(({ cosmeticIcon, mount }) => {
      for (const el of root.querySelectorAll('[data-rw]')) {
        const [kind, id] = (/** @type {HTMLElement} */ (el).dataset.rw || ':').split(':');
        const icon = cosmeticIcon(/** @type {any} */ (kind), id, 2);
        if (icon) {
          el.classList.add('has-ico');
          /** @type {HTMLElement} */ (el).style.background = '';
          mount(el, icon);
        }
      }
    })
    .catch(() => {});
  for (const b of root.querySelectorAll('[data-wear]')) {
    b.addEventListener('click', () => {
      const kind = (/** @type {HTMLElement} */ (b).dataset.wear || 'color:').split(':')[0];
      import('./customize.js').then((m) => m.openCustomize({ tab: /** @type {any} */ (kind), onAchievements: () => showAchievements(o) }));
    });
  }
}
