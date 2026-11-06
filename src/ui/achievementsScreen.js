/** Ekran Osiągnięć: lista z postępem, nagrody (na razie „wkrótce”). */
import { $, esc, showScreen } from './dom.js';
import { getAchievements } from './achievements.js';

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
          <span class="ach-reward">Nagroda: ${esc(a.reward)} <em>(wkrótce)</em></span>
        </div>
      </div>`;
    })
    .join('');
  $('#btn-ach-back').onclick = o.onBack;
  showScreen('#screen-ach');
  $('#screen-ach').scrollTop = 0;
}
