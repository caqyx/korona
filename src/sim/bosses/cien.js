import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { bossRadius } from '../combat.js';
import { meleeTelegraph, aimAngle, clampAim, safeBossPoint, bossShot, RAD } from './helpers.js';

const C = BOSSES.cien;

/** Cień (zabójca): 1,3× prędkości, 0,7× HP. */
export const cien = {
  atk: {
    telegraph: (state, p, cast) => meleeTelegraph(state, p, cast, C.atk),
    fire: () => {},
  },
  /** Teleport do kursora (do 7 m), wybuch w punkcie startu. */
  q: {
    telegraph: (state, p, cast) => {
      const [tx, ty] = clampAim(p, cast.ax, cast.ay, C.q.range);
      const [x, y] = safeBossPoint(tx, ty);
      cast.data = { x, y };
      addZone(state, { kind: 'blast', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: C.q.blastR * cast.area, warn: C.q.telegraph, life: 0.08, dmg: 1 });
      addZone(state, { kind: 'blinkDest', shape: 'circle', ownerId: p.id, x, y, r: bossRadius(), warn: C.q.telegraph, life: 0, dmg: 0 });
    },
    fire: (state, p, cast) => {
      state.events.push({ t: 'blink', id: p.id, fromX: p.x, fromY: p.y, x: cast.data.x, y: cast.data.y });
      p.x = cast.data.x;
      p.y = cast.data.y;
    },
  },
  /** Zasłona: niewidzialność 2,5 s, przerywana zadaniem obrażeń. */
  e: {
    telegraph: (state, p, cast) => addZone(state, { kind: 'veil', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: bossRadius() + 0.6, warn: cast.total, life: 0, dmg: 0 }),
    fire: (state, p) => {
      p.boss.invisT = C.e.duration;
    },
  },
  /** Wachlarz ostrzy: 7 pocisków w stożku 90°. */
  r: {
    telegraph: (state, p, cast) => {
      cast.data = { ang: aimAngle(p, cast) };
      addZone(state, { kind: 'fan', shape: 'arc', ownerId: p.id, x: p.x, y: p.y, r: C.r.range * 0.6, ang: cast.data.ang, arc: Math.min(180, C.r.arc * cast.area) * RAD, warn: C.r.telegraph, life: 0, dmg: 0 });
    },
    fire: (state, p, cast) => {
      const arc = Math.min(180, C.r.arc * cast.area) * RAD;
      for (let i = 0; i < C.r.count; i++) {
        const a = cast.data.ang - arc / 2 + (arc * i) / (C.r.count - 1);
        bossShot(state, p, a, C.r, 'blade');
      }
    },
  },
  channel() {},
};
