import { BTN } from '../sim/state.js';
import { autoAim } from './aim.js';

const DEAD = 0.2;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : v);

/** Mapowanie standardowego pada: A dash, RT atak, RB umiejętność, X/Y/B = Q/E/R. */
export function createGamepad(index) {
  return {
    kind: 'pad',
    index,
    label: `Pad ${index + 1}`,
    read(state, me) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads[index];
      if (!gp || !me) return { moveX: 0, moveY: 0, aimX: me?.x ?? 0, aimY: me?.y ?? 0, buttons: 0 };
      const btn = (i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4);
      let buttons = 0;
      if (btn(7) || btn(6)) buttons |= BTN.ATTACK;
      if (btn(0)) buttons |= BTN.DASH;
      if (btn(5) || btn(4)) buttons |= BTN.ABILITY;
      if (btn(2)) buttons |= BTN.Q;
      if (btn(3)) buttons |= BTN.E;
      if (btn(1)) buttons |= BTN.R;
      const rx = dz(gp.axes[2] || 0);
      const ry = dz(gp.axes[3] || 0);
      const [ax, ay] = Math.hypot(rx, ry) > 0 ? [me.x + rx * 6, me.y + ry * 6] : autoAim(state, me);
      return { moveX: dz(gp.axes[0] || 0), moveY: dz(gp.axes[1] || 0), aimX: ax, aimY: ay, buttons };
    },
  };
}

/** Indeksy podłączonych padów. */
export function connectedPads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return Array.from(pads).filter(Boolean).map((p) => /** @type {Gamepad} */ (p).index);
}
