import { BTN } from '../sim/state.js';
import { screenToWorld } from '../render/camera.js';
import { autoAim } from './aim.js';

/** Globalny stan klawiatury i myszy (jedna instancja na stronę). */
const keys = new Set();
const pressedKeys = new Set();
const mouse = { x: 0, y: 0, buttons: 0, pressed: 0, seen: false };
let installed = false;

/** @param {HTMLElement} target */
export function installKeyboard(target) {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!keys.has(e.code)) pressedKeys.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  target.addEventListener('mousemove', (e) => {
    const r = target.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.seen = true;
  });
  target.addEventListener('mousedown', (e) => {
    const bit = e.button === 2 ? 2 : 1;
    mouse.buttons |= bit;
    mouse.pressed |= bit;
  });
  window.addEventListener('mouseup', (e) => {
    mouse.buttons &= ~(e.button === 2 ? 2 : 1);
  });
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** Czyści zatrzaśnięte wciśnięcia (po pauzie/menu, żeby nie odpaliły akcji po powrocie do gry). */
export function clearLatchedInput() {
  pressedKeys.clear();
  mouse.pressed = 0;
}

const KB1 = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', dash: 'Space', ability: 'KeyF', attack: null, q: 'KeyQ', e: 'KeyE', r: 'KeyR' };
const KB2 = { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', dash: 'KeyP', ability: 'KeyO', attack: 'KeyU', q: 'Digit7', e: 'Digit8', r: 'Digit9' };

/** Pobiera i czyści zatrzaśnięte wciśnięcia (żeby szybki tap nie zginął między klatkami). */
function takePressed(map) {
  let b = 0;
  const bits = { dash: BTN.DASH, ability: BTN.ABILITY, attack: BTN.ATTACK, q: BTN.Q, e: BTN.E, r: BTN.R };
  for (const [k, bit] of Object.entries(bits)) {
    const code = map[k];
    if (code && pressedKeys.has(code)) {
      b |= bit;
      pressedKeys.delete(code);
    }
  }
  return b;
}

function heldButtons(map) {
  let b = 0;
  if (map.dash && keys.has(map.dash)) b |= BTN.DASH;
  if (map.ability && keys.has(map.ability)) b |= BTN.ABILITY;
  if (map.attack && keys.has(map.attack)) b |= BTN.ATTACK;
  if (keys.has(map.q)) b |= BTN.Q;
  if (keys.has(map.e)) b |= BTN.E;
  if (keys.has(map.r)) b |= BTN.R;
  return b;
}

function moveFrom(map) {
  return [(keys.has(map.right) ? 1 : 0) - (keys.has(map.left) ? 1 : 0), (keys.has(map.down) ? 1 : 0) - (keys.has(map.up) ? 1 : 0)];
}

/**
 * Klawiatura + mysz (gracz 1). Zwraca urządzenie z metodą read().
 * @param {{cam:any}} ctx
 */
export function createKeyboardMouse(ctx) {
  return {
    kind: 'kbm',
    label: 'Klawiatura + mysz',
    read(state, me) {
      const [mx, my] = moveFrom(KB1);
      let buttons = heldButtons(KB1) | takePressed(KB1);
      if (mouse.buttons & 1 || mouse.pressed & 1) buttons |= BTN.ATTACK;
      if (mouse.buttons & 2 || mouse.pressed & 2) buttons |= BTN.ABILITY;
      mouse.pressed = 0;
      const [ax, ay] = mouse.seen ? screenToWorld(ctx.cam, mouse.x, mouse.y) : autoAim(state, me);
      return { moveX: mx, moveY: my, aimX: ax, aimY: ay, buttons };
    },
  };
}

/** Druga klawiatura (IJKL), celowanie automatyczne. */
export function createKeyboard2() {
  return {
    kind: 'kb2',
    label: 'Klawiatura 2 (IJKL)',
    read(state, me) {
      const [mx, my] = moveFrom(KB2);
      const buttons = heldButtons(KB2) | takePressed(KB2);
      const [ax, ay] = autoAim(state, me);
      return { moveX: mx, moveY: my, aimX: ax, aimY: ay, buttons };
    },
  };
}
