import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { aimAngle, lineMarker, bossShot, clampAim } from './helpers.js';

const C = BOSSES.szron;

/** Szron (różowy). Pasywka Wychłodzenie: każde trafienie spowalnia bohatera o 30% na 1,5 s (w combat.js). */
export const szron = {
  atk: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, 6, 0.5),
    fire: (state, p, cast) => bossShot(state, p, aimAngle(p, cast), C.atk, 'iceShard'),
  },
  /** Lodowa nova: krąg 4 m wokół bossa. */
  q: {
    telegraph: (state, p, cast) => addZone(state, { kind: 'nova', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: C.q.radius * cast.area, warn: C.q.telegraph, life: 0.08, dmg: 1 }),
    fire: () => {},
  },
  /** Lodowa ściana: linia 10 m, rani raz, potem 3 s spowalnia. */
  e: {
    telegraph: (state, p, cast) =>
      addZone(state, { kind: 'iceWall', shape: 'line', ownerId: p.id, x: p.x, y: p.y, ang: aimAngle(p, cast), len: C.e.len * cast.area, w: C.e.width, warn: C.e.telegraph, life: C.e.life, dmg: 1, slow: C.e.slow }),
    fire: () => {},
  },
  /** Zamieć: strefa 5 m, 4 s, spowolnienie i 1 dmg co 1,5 s. */
  r: {
    telegraph: (state, p, cast) => {
      const [x, y] = clampAim(p, cast.ax, cast.ay, C.r.range);
      addZone(state, { kind: 'blizzard', shape: 'circle', ownerId: p.id, x, y, r: C.r.radius * cast.area, warn: C.r.telegraph, life: C.r.life, dmg: 1, tick: C.r.tick, tickT: 0, slow: C.r.slow });
    },
    fire: () => {},
  },
  channel() {},
};
