/**
 * Customize: wybór klasy (8 klas z podglądem, rolą, atakiem i umiejętnością) zapisywany w profilu.
 * Wygląd (kolor, czapka, nos) — zablokowany do czasu nagród z osiągnięć.
 */
import { openModal, closeModal, esc } from './dom.js';
import { SKINS, SKIN_IDS } from '../sim/config.js';
import { SKIN_TEXT } from './codex.js';
import { heroPreview, mount } from './previews.js';
import { getProfile, setProfile } from './profile.js';

/** @param {{onAchievements?:()=>void}} [o] */
export function openCustomize(o = {}) {
  const cur = getProfile().skin;
  const body = openModal({
    title: 'Customize',
    cls: 'modal-custom',
    body: `<h3>Klasa</h3>
      <div class="skins custom-grid">${SKIN_IDS.map((id) => {
        const t = SKIN_TEXT[id];
        return `<div class="skin ${id === cur ? 'sel' : ''}" data-class="${id}" style="--c:${SKINS[id].color}" role="button" tabindex="0" aria-pressed="${id === cur}">
          <div class="skin-pv"></div>
          <span class="skin-name">${SKINS[id].name}</span>
          <span class="role">${esc(t.role)}</span>
          <span class="line"><span class="k">Atak:</span> ${esc(t.attack)}</span>
          <span class="abil"><b>${esc(t.ability)}</b> <span class="cd">${t.cd} s</span><br />${esc(t.abilityDesc)}</span>
        </div>`;
      }).join('')}</div>
      <div class="locked-sec">
        <span class="lock-ico" aria-hidden="true"></span>
        <div class="locked-txt"><b>Wygląd: kolor, czapka, nos — wkrótce</b><span>Odblokuj nagrody w Osiągnięciach.</span></div>
        <div class="locked-slots" aria-hidden="true"><i></i><i></i><i></i></div>
        <button class="btn-sm" data-ach>Osiągnięcia</button>
      </div>`,
  });
  for (const el of body.querySelectorAll('[data-class]')) {
    const id = /** @type {HTMLElement} */ (el).dataset.class || 'rycerz';
    mount(el.querySelector('.skin-pv'), heroPreview(id, SKINS[id].color, { w: 96, h: 84, maxScale: 4 }));
    const pick = () => {
      setProfile({ skin: id });
      for (const c of body.querySelectorAll('[data-class]')) {
        const on = /** @type {HTMLElement} */ (c).dataset.class === id;
        c.classList.toggle('sel', on);
        c.setAttribute('aria-pressed', String(on));
      }
    };
    el.addEventListener('click', pick);
    el.addEventListener('keydown', (e) => {
      const k = /** @type {KeyboardEvent} */ (e).key;
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        pick();
      }
    });
  }
  /** @type {HTMLElement} */ (body.querySelector('[data-ach]')).onclick = () => {
    closeModal();
    o.onAchievements?.();
  };
}
