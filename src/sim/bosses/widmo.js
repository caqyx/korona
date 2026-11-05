import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { bossRadius } from '../combat.js';
import { spawnProjectile } from '../projectiles.js';
import { meleeTelegraph, aimAngle, lineMarker } from './helpers.js';

const C = BOSSES.widmo;

/** Widmo (czerwony). Pasywka Żniwiarz: zabicie bohatera leczy 6% max HP (w rules.js). */
export const widmo = {
  atk: {
    telegraph: (state, p, cast) => meleeTelegraph(state, p, cast, C.atk),
    fire: () => {},
  },
  /** Rzut kosą: bumerang — leci 9 m i wraca, przenika przez filary i trafia każdego raz w każdą stronę. */
  q: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, C.q.range / 2, 0.8, 'scytheLine'),
    fire: (state, p, cast) => {
      const a = aimAngle(p, cast);
      spawnProjectile(state, {
        team: 'boss',
        ownerId: p.id,
        kind: 'scythe',
        x: p.x + Math.cos(a) * bossRadius(),
        y: p.y + Math.sin(a) * bossRadius(),
        vx: Math.cos(a) * C.q.speed,
        vy: Math.sin(a) * C.q.speed,
        r: C.q.r * cast.area,
        range: C.q.range,
        dmg: 1,
        pierce: true,
        boomerang: true,
      });
    },
  },
  /** Strach: odpycha bohaterów w promieniu 5 m (bez obrażeń). */
  e: {
    telegraph: (state, p, cast) => addZone(state, { kind: 'fear', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: C.e.radius * cast.area, warn: C.e.telegraph, life: 0.08, dmg: 0, knock: C.e.knock, stun: 0.3 }),
    fire: () => {},
  },
  /** Żniwa: pierścień zaciskający się od 11 m do bossa — trzeba go przeskoczyć dashem. */
  r: {
    telegraph: (state, p, cast) =>
      addZone(state, { kind: 'harvest', shape: 'ring', ownerId: p.id, x: p.x, y: p.y, r: C.r.from * cast.area, rMax: bossRadius(), w: C.r.width, warn: C.r.telegraph, life: C.r.duration, dmg: 1 }),
    fire: () => {},
  },
  channel() {},
};
