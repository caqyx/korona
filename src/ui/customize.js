/**
 * Customize: wybór klasy (8 klas z podglądem, rolą, atakiem i umiejętnością) oraz edytor wyglądu
 * (kolor / skin klasy, czapka, nos). Zablokowane przedmioty pokazują osiągnięcie, które je odblokowuje.
 * Wszystko zapisuje się w profilu (setProfile) — panel „Twoja klasa” odświeża się sam.
 */
import { openModal, closeModal, esc } from './dom.js';
import { SKINS, SKIN_IDS } from '../sim/config.js';
import { cosmeticsOf, isAvailable } from '../sim/cosmetics.js';
import { SKIN_TEXT } from './codex.js';
import { heroPreview, cosmeticIcon, mount } from './previews.js';
import { getProfile, setProfile } from './profile.js';
import { getAchievements } from './achievements.js';

const TABS = /** @type {const} */ ([
  ['color', 'Kolor'],
  ['hat', 'Czapka'],
  ['nose', 'Nos'],
]);
let tab = /** @type {'color'|'hat'|'nose'} */ ('color');

/** @param {{onAchievements?:()=>void, tab?:'color'|'hat'|'nose'}} [o] */
export function openCustomize(o = {}) {
  if (o.tab) tab = o.tab;
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
      <h3 class="look-h">Wygląd</h3>
      <section class="look-ed px-box inset" id="look-ed">
        <div class="look-side">
          <div class="look-pv" id="look-pv"></div>
          <span class="look-cls" id="look-cls"></span>
          <div class="look-sum" id="look-sum"></div>
        </div>
        <div class="look-main">
          <div class="look-tabs" role="tablist">${TABS.map(([k, l]) => `<button class="look-tab" role="tab" data-tab="${k}">${l}</button>`).join('')}</div>
          <div class="look-grid" id="look-grid" role="listbox"></div>
          <div class="look-info" id="look-info" aria-live="polite"></div>
        </div>
      </section>`,
  });
  const achs = getAchievements();
  const achName = (id) => achs.find((a) => a.id === id)?.name || id;
  const unlocked = () => new Set(getAchievements().filter((a) => a.unlocked).map((a) => a.id));

  const renderEditor = () => {
    const p = getProfile();
    const un = unlocked();
    const s = /** @type {any} */ (SKINS)[p.skin];
    const ed = /** @type {HTMLElement} */ (body.querySelector('#look-ed'));
    ed.style.setProperty('--c', s.color);
    mount(body.querySelector('#look-pv'), heroPreview(p.skin, s.color, { w: 168, h: 148, maxScale: 6, look: p.look }));
    /** @type {HTMLElement} */ (body.querySelector('#look-cls')).textContent = s.name;
    /** @type {HTMLElement} */ (body.querySelector('#look-sum')).innerHTML = TABS.map(([k, l]) => {
      const c = cosmeticsOf(k).find((x) => x.id === p.look[k]);
      return `<span><em>${l}:</em> ${esc(c?.name || '—')}</span>`;
    }).join('');
    for (const b of body.querySelectorAll('[data-tab]')) {
      const on = /** @type {HTMLElement} */ (b).dataset.tab === tab;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-selected', String(on));
    }
    const grid = /** @type {HTMLElement} */ (body.querySelector('#look-grid'));
    grid.innerHTML = cosmeticsOf(tab)
      .map((c) => {
        const wrongCls = !!(c.cls && c.cls !== p.skin);
        const ok = isAvailable(c, un, p.skin);
        const sel = p.look[tab] === c.id;
        const sub = wrongCls ? `Tylko: ${SKINS[/** @type {keyof typeof SKINS} */ (c.cls)]?.name ?? c.cls}` : !ok ? `Odblokuj: ${achName(c.unlock)}` : c.cls ? 'Skin klasy' : sel ? 'Założone' : '';
        return `<button class="look-tile ${sel ? 'sel' : ''} ${ok ? '' : 'locked'}" data-kind="${tab}" data-id="${c.id}" role="option" aria-selected="${sel}" title="${esc(c.name + (sub ? ' — ' + sub : ''))}">
          <span class="lt-ico" data-swatch="${esc(c.swatch || '')}"></span>
          <span class="lt-name">${esc(c.name)}</span>
          ${sub ? `<span class="lt-sub">${esc(sub)}</span>` : ''}
          ${ok ? '' : '<span class="lt-lock" aria-hidden="true"></span>'}
        </button>`;
      })
      .join('');
    for (const el of grid.querySelectorAll('.look-tile')) {
      const t = /** @type {HTMLElement} */ (el);
      const ico = /** @type {HTMLElement} */ (t.querySelector('.lt-ico'));
      const icon = cosmeticIcon(/** @type {any} */ (t.dataset.kind), t.dataset.id || '', 3);
      if (icon) mount(ico, icon);
      else if (t.dataset.kind === 'color') {
        ico.classList.add('swatch');
        if (ico.dataset.swatch) ico.style.background = ico.dataset.swatch;
        else ico.style.background = s.color;
      } else ico.classList.add(t.dataset.id === 'none' ? 'none' : 'glyph', `g-${t.dataset.kind}`);
      t.addEventListener('click', () => pick(t.dataset.kind || 'color', t.dataset.id || ''));
    }
  };

  const info = (html) => (/** @type {HTMLElement} */ (body.querySelector('#look-info')).innerHTML = html);
  /** @param {string} kind @param {string} id */
  const pick = (kind, id) => {
    const p = getProfile();
    const c = cosmeticsOf(/** @type {any} */ (kind)).find((x) => x.id === id);
    if (!c) return;
    if (c.cls && c.cls !== p.skin) {
      info(`<b>${esc(c.name)}</b> to skin klasy ${esc(SKINS[/** @type {keyof typeof SKINS} */ (c.cls)]?.name ?? c.cls)} — wybierz tę klasę powyżej.`);
      return;
    }
    if (!isAvailable(c, unlocked(), p.skin)) {
      const a = achs.find((x) => x.id === c.unlock);
      info(`<span class="li-lock" aria-hidden="true"></span><span><b>${esc(c.name)}</b> — odblokuj osiągnięciem <b class="gold">${esc(a?.name || c.unlock || '')}</b>${a ? `: ${esc(a.desc)} (${a.value}/${a.goal})` : ''}.</span><button class="btn-sm" data-ach>Osiągnięcia</button>`);
      const btn = /** @type {HTMLElement|null} */ (body.querySelector('#look-info [data-ach]'));
      if (btn)
        btn.onclick = () => {
          closeModal();
          o.onAchievements?.();
        };
      return;
    }
    info('');
    setProfile({ look: { ...p.look, [kind]: id } });
    renderEditor();
  };

  for (const b of body.querySelectorAll('[data-tab]')) {
    b.addEventListener('click', () => {
      tab = /** @type {any} */ (/** @type {HTMLElement} */ (b).dataset.tab);
      info('');
      renderEditor();
    });
  }
  for (const el of body.querySelectorAll('[data-class]')) {
    const id = /** @type {HTMLElement} */ (el).dataset.class || 'rycerz';
    mount(el.querySelector('.skin-pv'), heroPreview(id, SKINS[id].color, { w: 96, h: 84, maxScale: 4 }));
    const choose = () => {
      setProfile({ skin: id });
      for (const c of body.querySelectorAll('[data-class]')) {
        const on = /** @type {HTMLElement} */ (c).dataset.class === id;
        c.classList.toggle('sel', on);
        c.setAttribute('aria-pressed', String(on));
      }
      info('');
      renderEditor();
    };
    el.addEventListener('click', choose);
    el.addEventListener('keydown', (e) => {
      const k = /** @type {KeyboardEvent} */ (e).key;
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        choose();
      }
    });
  }
  renderEditor();
  if (o.tab) body.querySelector('#look-ed')?.scrollIntoView({ block: 'nearest' });
}
