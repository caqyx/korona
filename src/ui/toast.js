/** Powiadomienie o odblokowanych osiągnięciach (prosty toast; styl w style.css: .ach-toast). */
export function showAchievementToast(list) {
  for (const [i, a] of list.entries()) {
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = `<b>Osiągnięcie odblokowane!</b><span>${escapeHtml(a.name)}</span><small>Nagroda: <i>${escapeHtml(a.reward)}</i> — załóż w Customize</small>`;
    el.style.top = `${16 + i * 86}px`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 4200 + i * 600);
    setTimeout(() => el.remove(), 5000 + i * 600);
  }
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
