import { BTN } from '../sim/state.js';
import { autoAim } from './aim.js';

/**
 * Sterowanie dotykowe (PWA mobile): wirtualny joystick po lewej, przyciski po prawej.
 * Przeciągnięcie przycisku ataku = ręczne celowanie; bez przeciągania — auto-aim.
 * @param {HTMLElement} root kontener nakładki
 */
export function createTouch(root) {
  root.innerHTML = `
    <div class="tj-zone"><div class="tj-base"><div class="tj-knob"></div></div></div>
    <div class="tb-wrap">
      <button class="tb tb-attack" data-b="attack">ATAK</button>
      <button class="tb tb-dash" data-b="dash">DASH</button>
      <button class="tb tb-ability" data-b="ability">UMIEJ.</button>
      <button class="tb tb-q boss-only" data-b="q">Q</button>
      <button class="tb tb-e boss-only" data-b="e">E</button>
      <button class="tb tb-r boss-only" data-b="r">R</button>
    </div>`;
  const zone = /** @type {HTMLElement} */ (root.querySelector('.tj-zone'));
  const base = /** @type {HTMLElement} */ (root.querySelector('.tj-base'));
  const knob = /** @type {HTMLElement} */ (root.querySelector('.tj-knob'));
  const st = { mx: 0, my: 0, held: 0, pressed: 0, aimDX: 0, aimDY: 0, aiming: false, joyId: -1, ox: 0, oy: 0 };
  const bits = { attack: BTN.ATTACK, dash: BTN.DASH, ability: BTN.ABILITY, q: BTN.Q, e: BTN.E, r: BTN.R };

  zone.addEventListener('pointerdown', (e) => {
    st.joyId = e.pointerId;
    st.ox = e.clientX;
    st.oy = e.clientY;
    base.style.left = `${e.clientX - 50}px`;
    base.style.top = `${e.clientY - 50}px`;
    base.classList.add('on');
    zone.setPointerCapture(e.pointerId);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== st.joyId) return;
    const dx = e.clientX - st.ox;
    const dy = e.clientY - st.oy;
    const l = Math.hypot(dx, dy);
    const k = l > 45 ? 45 / l : 1;
    st.mx = (dx * k) / 45;
    st.my = (dy * k) / 45;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
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
      b.setPointerCapture(e.pointerId);
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
      if (bit === BTN.ATTACK) st.aiming = false;
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }

  return {
    kind: 'touch',
    label: 'Dotyk',
    /** Pokazuje przyciski bossa tylko po przejęciu korony. @param {boolean} isBoss */
    setBoss(isBoss) {
      root.classList.toggle('is-boss', isBoss);
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
      if (me) this.setBoss(!!me.boss);
      return { moveX: st.mx, moveY: st.my, aimX: ax, aimY: ay, buttons };
    },
  };
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
