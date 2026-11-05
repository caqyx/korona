import { BTN } from '../sim/state.js';
import { SKINS, BOSSES, HERO } from '../sim/config.js';
import { autoAim } from './aim.js';
import { iconCanvas, mount } from '../ui/previews.js';

/** @type {Promise<any>|null} */
let sfx = null;
/** Krótka wibracja przy naciśnięciu (moduł audio ładowany leniwie, respektuje ustawienie haptyki). */
function haptic(ms) {
  sfx ??= import('../audio/sfx.js').catch(() => null);
  sfx.then((m) => m?.vibrate?.(ms));
}

const BUTTONS = [
  ['attack', 'ATAK', 'tb-attack'],
  ['dash', 'DASH', 'tb-dash hero-only'],
  ['ability', 'UMIEJ.', 'tb-ability hero-only'],
  ['q', 'Q', 'tb-q boss-only'],
  ['e', 'E', 'tb-e boss-only'],
  ['r', 'R', 'tb-r boss-only'],
];

/**
 * Sterowanie dotykowe (PWA mobile): pływający joystick po lewej, przyciski po prawej.
 * Przeciągnięcie przycisku ataku = ręczne celowanie; bez przeciągania — auto-aim.
 * Przyciski mają ikony ze sprites.js i nakładkę cooldownu (odczyt z `me` w read()).
 * @param {HTMLElement} root kontener nakładki
 */
export function createTouch(root) {
  root.innerHTML = `
    <div class="tj-zone"><div class="tj-hint"></div><div class="tj-base"><div class="tj-ring"></div><div class="tj-knob"></div></div></div>
    <div class="tb-wrap">
      ${BUTTONS.map(([b, lab, cls]) => `<button class="tb ${cls} ready" data-b="${b}" aria-label="${lab}"><span class="ico"></span><span class="sweep"></span><span class="cdn"></span><span class="lab">${lab}</span></button>`).join('')}
    </div>
    <div class="rotate" aria-live="polite"><div class="phone"></div>Obróć telefon<small>KORONA gra się poziomo</small></div>`;
  const zone = /** @type {HTMLElement} */ (root.querySelector('.tj-zone'));
  const base = /** @type {HTMLElement} */ (root.querySelector('.tj-base'));
  const knob = /** @type {HTMLElement} */ (root.querySelector('.tj-knob'));
  const hint = /** @type {HTMLElement} */ (root.querySelector('.tj-hint'));
  const st = { mx: 0, my: 0, held: 0, pressed: 0, aimDX: 0, aimDY: 0, aiming: false, joyId: -1, ox: 0, oy: 0, jr: 50 };
  const bits = { attack: BTN.ATTACK, dash: BTN.DASH, ability: BTN.ABILITY, q: BTN.Q, e: BTN.E, r: BTN.R };

  /** @type {Record<string, {el:HTMLElement, sweep:HTMLElement, cdn:HTMLElement, ico:HTMLElement, icon:string, frac:number, txt:string}>} */
  const ui = {};
  for (const el of root.querySelectorAll('.tb')) {
    const b = /** @type {HTMLElement} */ (el);
    ui[/** @type {string} */ (b.dataset.b)] = {
      el: b,
      sweep: /** @type {HTMLElement} */ (b.querySelector('.sweep')),
      cdn: /** @type {HTMLElement} */ (b.querySelector('.cdn')),
      ico: /** @type {HTMLElement} */ (b.querySelector('.ico')),
      icon: '',
      frac: -1,
      txt: '',
    };
  }
  /** @param {string} key @param {string} name */
  const setIcon = (key, name) => {
    const u = ui[key];
    if (u.icon === name) return;
    u.icon = name;
    mount(u.ico, iconCanvas(name, 4));
  };
  /** @param {string} key @param {number} left sekundy do końca @param {number} max */
  const setCd = (key, left, max) => {
    const u = ui[key];
    const frac = left > 0 && max > 0 ? Math.min(1, left / max) : 0;
    const q = Math.round(frac * 48) / 48;
    if (q !== u.frac) {
      if (q === 0 && u.frac > 0) {
        u.el.classList.remove('flash');
        void u.el.offsetWidth;
        u.el.classList.add('flash');
      }
      u.el.classList.toggle('ready', q === 0);
      u.sweep.style.setProperty('--cd', String(q));
      u.frac = q;
    }
    const txt = left > 0.05 ? (left < 1 ? left.toFixed(1).replace('.', ',') : String(Math.ceil(left))) : '';
    if (txt !== u.txt) {
      u.cdn.textContent = txt;
      u.txt = txt;
    }
  };
  setIcon('attack', 'atk');
  setIcon('dash', 'dash');

  zone.addEventListener('pointerdown', (e) => {
    st.joyId = e.pointerId;
    st.ox = e.clientX;
    st.oy = e.clientY;
    base.style.left = `${e.clientX}px`;
    base.style.top = `${e.clientY}px`;
    base.classList.add('on');
    hint.style.display = 'none';
    st.jr = (base.offsetWidth || 100) / 2;
    zone.setPointerCapture(e.pointerId);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== st.joyId) return;
    const dx = e.clientX - st.ox;
    const dy = e.clientY - st.oy;
    const l = Math.hypot(dx, dy);
    const max = st.jr * 0.75;
    const k = l > max ? max / l : 1;
    st.mx = (dx * k) / max;
    st.my = (dy * k) / max;
    knob.style.transform = `translate(${Math.round(dx * k)}px, ${Math.round(dy * k)}px)`;
  });
  const endJoy = (e) => {
    if (e.pointerId !== st.joyId) return;
    st.joyId = -1;
    st.mx = st.my = 0;
    knob.style.transform = '';
    base.classList.remove('on');
  };
  zone.addEventListener('pointerup', endJoy);
  zone.addEventListener('pointercancel', endJoy);

  for (const el of root.querySelectorAll('.tb')) {
    const b = /** @type {HTMLElement} */ (el);
    const bit = bits[/** @type {keyof typeof bits} */ (b.dataset.b)];
    let sx = 0;
    let sy = 0;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      st.held |= bit;
      st.pressed |= bit;
      sx = e.clientX;
      sy = e.clientY;
      b.classList.add('pressed');
      b.setPointerCapture(e.pointerId);
      haptic(b.classList.contains('ready') ? 12 : 4);
    });
    b.addEventListener('pointermove', (e) => {
      if (!(st.held & bit) || bit !== BTN.ATTACK) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 12) {
        st.aiming = true;
        st.aimDX = dx;
        st.aimDY = dy;
      }
    });
    const up = () => {
      st.held &= ~bit;
      b.classList.remove('pressed');
      if (bit === BTN.ATTACK) st.aiming = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Ikony i cooldowny z aktualnego stanu gracza. */
  function updateButtons(me) {
    if (!me) return;
    if (me.boss) {
      const t = me.boss.type;
      const cfg = /** @type {any} */ (BOSSES)[t];
      const cd = me.boss.cd || {};
      setIcon('attack', `boss:${t}:atk`);
      for (const k of ['q', 'e', 'r']) {
        setIcon(k, `boss:${t}:${k}`);
        setCd(k, cd[k] || 0, Math.max(cfg?.[k]?.cd || 1, cd[k] || 0));
      }
      setCd('attack', cd.atk || 0, Math.max(cfg?.atk?.cd || 1, cd.atk || 0));
    } else {
      const sk = /** @type {any} */ (SKINS)[me.skin];
      setIcon('attack', 'atk');
      setIcon('ability', `skin:${me.skin}`);
      setCd('attack', me.atkCd || 0, Math.max(sk?.attack?.cd || 1, me.atkCd || 0));
      setCd('ability', me.abilCd || 0, Math.max(sk?.ability?.cd || 1, me.abilCd || 0));
      setCd('dash', me.dashCd || 0, Math.max(HERO.dashCooldown, me.dashCd || 0));
    }
  }

  return {
    kind: 'touch',
    label: 'Dotyk',
    /** Pokazuje przyciski bossa tylko po przejęciu korony. @param {boolean} isBoss */
    setBoss(isBoss) {
      if (root.classList.contains('is-boss') !== isBoss) root.classList.toggle('is-boss', isBoss);
    },
    read(state, me) {
      const buttons = st.held | st.pressed;
      st.pressed = 0;
      let ax;
      let ay;
      if (st.aiming && me) {
        const l = Math.hypot(st.aimDX, st.aimDY) || 1;
        ax = me.x + (st.aimDX / l) * 6;
        ay = me.y + (st.aimDY / l) * 6;
      } else [ax, ay] = autoAim(state, me);
      if (me) {
        this.setBoss(!!me.boss);
        updateButtons(me);
      }
      return { moveX: st.mx, moveY: st.my, aimX: ax, aimY: ay, buttons };
    },
  };
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
