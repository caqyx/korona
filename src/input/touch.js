import { BTN } from '../sim/state.js';
import { autoAim } from './aim.js';
import { SKINS, BOSSES, HERO } from '../sim/config.js';
import { iconCanvas, mount } from '../ui/previews.js';
import { upgradeCardRect, UPGRADE_CARDS } from '../render/hudLayout.js';

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
 * Przycisk pauzy (prawy górny róg) woła `opts.onPause`; w czasie losowania bossa (skrzynka)
 * przyciski akcji i joystick są ukryte (klasa `in-case`), pauza zostaje.
 * @param {HTMLElement} root kontener nakładki
 * @param {{onPause?:()=>void}} [opts]
 */
export function createTouch(root, opts = {}) {
  root.innerHTML = `
    <div class="tu-pick" aria-hidden="true"></div>
    <button class="tp-pause" data-pause aria-label="Pauza"><i aria-hidden="true"></i></button>
    <div class="tj-zone"><div class="tj-hint"></div><div class="tj-base"><div class="tj-ring"></div><div class="tj-knob"></div></div></div>
    <div class="tb-wrap">
      ${BUTTONS.map(([b, lab, cls]) => `<button class="tb ${cls} ready" data-b="${b}" aria-label="${lab}"><span class="ico"></span><span class="sweep"></span><span class="cdn"></span><span class="lab">${lab}</span></button>`).join('')}
    </div>
    <div class="rotate" aria-live="polite"><div class="phone"></div>Obróć telefon<small>KORONA gra się poziomo</small></div>`;
  const zone = /** @type {HTMLElement} */ (root.querySelector('.tj-zone'));
  const base = /** @type {HTMLElement} */ (root.querySelector('.tj-base'));
  const knob = /** @type {HTMLElement} */ (root.querySelector('.tj-knob'));
  const hint = /** @type {HTMLElement} */ (root.querySelector('.tj-hint'));
  const pauseBtn = /** @type {HTMLElement} */ (root.querySelector('[data-pause]'));
  pauseBtn.addEventListener('click', () => opts.onPause?.());
  pauseBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  let inCase = false;
  /** Chowa przyciski akcji na czas skrzynki bossa (zapis do DOM tylko przy zmianie). @param {boolean} on */
  const setInCase = (on) => {
    if (on === inCase) return;
    inCase = on;
    root.classList.toggle('in-case', on);
  };
  /** @type {any} */
  const st = { mx: 0, my: 0, held: 0, pressed: 0, joyId: -1, ox: 0, oy: 0, jr: 50, touchedAim: false };
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

  // --- karty ulepszeń (przerwa między falami): dotknięcie karty = wybór i zatwierdzenie ---
  // Symulacja zna tylko „ruch w bok zmienia zaznaczenie, ATAK zatwierdza”, więc dotknięcie
  // zapamiętuje numer karty, a read() dochodzi do niej impulsami ruchu i wciska ATAK.
  st.pick = -1;
  st.pulse = true;
  st.tapCards = true;
  let inOffer = false;
  /** @param {boolean} on */
  const setInOffer = (on) => {
    if (on === inOffer) return;
    inOffer = on;
    root.classList.toggle('in-offer', on);
    if (!on) st.pick = -1;
  };
  /** @type {HTMLElement} */ (root.querySelector('.tu-pick')).addEventListener('pointerdown', (e) => {
    for (let i = 0; i < UPGRADE_CARDS; i++) {
      const r = upgradeCardRect(window.innerWidth, window.innerHeight, i);
      if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
        st.pick = i;
        st.pulse = true;
        haptic(12);
      }
    }
  });
  /**
   * Krok dochodzenia do dotkniętej karty. Zwraca ruch w bok do wstrzyknięcia (albo 0) i ustawia
   * `st.confirm`, gdy zaznaczenie jest już na miejscu.
   * @param {{sel:number, picked:any}} off
   */
  const stepPick = (off) => {
    st.confirm = false;
    if (st.pick < 0) return 0;
    if (off.sel === st.pick) {
      st.confirm = true;
      st.pick = -1;
      return 0;
    }
    // co drugi odczyt zero — symulacja reaguje na ZMIANĘ kierunku
    st.pulse = !st.pulse;
    return st.pulse ? 0 : Math.sign(st.pick - off.sel);
  };

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

  // --- celowanie jak w Brawl Stars -----------------------------------------
  // TAP (bez przeciągania) = automatyczny strzał w najbliższy cel.
  // PRZECIĄGNIJ = ręczne celowanie (podgląd linii), PUŚĆ = strzał tam, gdzie celujesz.
  // Powrót palcem na środek przycisku przed puszczeniem = anulowanie.
  // Dotyczy ATAKU, UMIEJĘTNOŚCI i Q/E/R bossa; DASH działa od razu.
  const DRAG_DEAD = 14;
  const DRAG_MAX = 90;
  const AIM_RANGE = 9;
  const aimBits = BTN.ATTACK | BTN.ABILITY | BTN.Q | BTN.E | BTN.R;
  st.dir = { x: 1, y: 0 };
  st.dist = 6;
  st.drag = null;
  /** @type {{bit:number, auto:boolean, dir:{x:number,y:number}, dist:number}[]} */
  st.queue = [];
  for (const el of root.querySelectorAll('.tb')) {
    const b = /** @type {HTMLElement} */ (el);
    const bit = bits[/** @type {keyof typeof bits} */ (b.dataset.b)];
    let sx = 0;
    let sy = 0;
    const aimable = (bit & aimBits) !== 0;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sx = e.clientX;
      sy = e.clientY;
      b.classList.add('pressed');
      b.setPointerCapture(e.pointerId);
      haptic(b.classList.contains('ready') ? 12 : 4);
      if (aimable) st.drag = { bit, dx: 0, dy: 0, k: 0, moved: false, cancel: false };
      else {
        st.held |= bit;
        st.pressed |= bit;
      }
    });
    b.addEventListener('pointermove', (e) => {
      if (!aimable || !st.drag || st.drag.bit !== bit) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const l = Math.hypot(dx, dy);
      if (l > DRAG_DEAD) {
        st.drag.moved = true;
        st.drag.cancel = false;
        st.drag.dx = dx;
        st.drag.dy = dy;
        st.drag.k = Math.min(1, l / DRAG_MAX);
        st.dir = { x: dx / l, y: dy / l };
        st.dist = Math.max(1.5, st.drag.k * AIM_RANGE);
      } else if (st.drag.moved) st.drag.cancel = true; // wrócił na środek — anuluj
    });
    const up = (cancelled) => {
      b.classList.remove('pressed');
      st.held &= ~bit;
      const d = st.drag;
      if (aimable && d?.bit === bit && !cancelled && !d.cancel) {
        st.queue.push({ bit, auto: !d.moved, dir: { ...st.dir }, dist: st.dist });
        if (st.queue.length > 4) st.queue.shift();
      }
      if (d?.bit === bit) st.drag = null;
    };
    b.addEventListener('pointerup', () => up(false));
    b.addEventListener('pointercancel', () => up(true));
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
    /** Podgląd celowania dla renderera (świat): null gdy nie celujesz. @param {any} me */
    aimPreview(me) {
      if (!me || !st.drag || !st.drag.moved || st.drag.cancel) return null;
      return { x: me.x + st.dir.x * st.dist, y: me.y + st.dir.y * st.dist, ability: st.drag.bit !== BTN.ATTACK };
    },
    /** Czy dotknięcie karty ulepszenia ma ją wybierać (tylko gdy dotyk to jedyny lokalny gracz). @param {boolean} on */
    setTapCards(on) {
      st.tapCards = on;
    },
    read(state, me) {
      setInCase(state?.phase === 'transition');
      const off = me ? state?.offers?.[me.id] : null;
      const offering = st.tapCards && !!off && off.picked === null;
      setInOffer(offering);
      const pickMove = offering ? stepPick(off) : 0;
      if (offering && (pickMove !== 0 || st.confirm)) {
        st.pressed = 0;
        const confirm = st.confirm;
        st.confirm = false;
        return { moveX: pickMove, moveY: 0, aimX: me.x + me.fx, aimY: me.y + me.fy, buttons: confirm ? BTN.ATTACK : 0 };
      }
      let buttons = st.held | st.pressed;
      st.pressed = 0;
      const mx0 = me?.x ?? 0;
      const my0 = me?.y ?? 0;
      let ax = mx0 + st.dir.x * st.dist;
      let ay = my0 + st.dir.y * st.dist;
      // jeden zakolejkowany strzał na odczyt: tap = auto-cel, przeciągnięcie = wycelowany punkt
      const shot = st.queue.shift();
      if (shot && me) {
        if (shot.auto) {
          [ax, ay] = autoAim(state, me);
          const l = Math.hypot(ax - mx0, ay - my0) || 1;
          st.dir = { x: (ax - mx0) / l, y: (ay - my0) / l };
        } else {
          ax = mx0 + shot.dir.x * shot.dist;
          ay = my0 + shot.dir.y * shot.dist;
        }
        buttons |= shot.bit;
      } else if (st.drag?.moved) {
        // podczas celowania postać patrzy w stronę celu
        ax = mx0 + st.dir.x * st.dist;
        ay = my0 + st.dir.y * st.dist;
      } else if (me) {
        ax = mx0 + me.fx * st.dist;
        ay = my0 + me.fy * st.dist;
      }
      if (me) {
        this.setBoss(!!me.boss);
        updateButtons(me);
      }
      return { moveX: st.mx, moveY: st.my, aimX: ax, aimY: ay, buttons };
    },
  };
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
