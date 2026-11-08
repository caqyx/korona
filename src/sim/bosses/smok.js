import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { randomArenaPoint } from '../physics.js';
import { aimAngle, lineMarker, bossShot, clampAim, safeBossPoint, RAD } from './helpers.js';

const C = BOSSES.smok;

/** Smok (czerwony). Pasywka Żar: co 4 s zostawia pod sobą płonącą plamę (z telegrafem). */
export const smok = {
  atk: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, 6, 0.6),
    fire: (state, p, cast) => bossShot(state, p, aimAngle(p, cast), C.atk, 'fireball'),
  },
  /** Zionięcie: stożek ognia 70°, 7 m. */
  q: {
    telegraph: (state, p, cast) =>
      addZone(state, { kind: 'breath', shape: 'arc', ownerId: p.id, x: p.x, y: p.y, r: C.q.range * cast.area, ang: aimAngle(p, cast), arc: C.q.arc * RAD, warn: C.q.telegraph, life: 0.5, dmg: 1 }),
    fire: () => {},
  },
  /** Lot: skok do punktu (do 9 m), lądowanie z falą i odrzutem. */
  e: {
    telegraph: (state, p, cast) => {
      const [tx, ty] = clampAim(p, cast.ax, cast.ay, C.e.range);
      const [x, y] = safeBossPoint(tx, ty);
      cast.data = { x, y };
      addZone(state, { kind: 'landing', shape: 'circle', ownerId: p.id, x, y, r: C.e.radius * cast.area, warn: C.e.telegraph, life: 0.08, dmg: 1, knock: C.e.knock });
    },
    fire: (state, p, cast) => {
      state.events.push({ t: 'blink', id: p.id, fromX: p.x, fromY: p.y, x: cast.data.x, y: cast.data.y });
      p.x = cast.data.x;
      p.y = cast.data.y;
    },
  },
  /** Deszcz meteorów: 6 stref w pobliżu bossa, telegraf 0,8 s. */
  r: {
    telegraph: (state, p, cast, rng) => {
      const heroes = state.players.filter((h) => !h.boss && h.alive && h.connected && (h.team === undefined || h.team !== p.team) && Math.hypot(h.x - p.x, h.y - p.y) <= C.r.spread * 1.5);
      for (let i = 0; i < C.r.count; i++) {
        // połowa meteorów celuje w bohaterów, reszta spada losowo w pobliżu
        if (i < Math.ceil(C.r.count / 2) && heroes.length) {
          const h = heroes[i % heroes.length];
          addZone(state, { kind: 'meteor', shape: 'circle', ownerId: p.id, x: h.x, y: h.y, r: C.r.radius * cast.area, warn: C.r.telegraph, life: 0.08, dmg: 1 });
          continue;
        }
        let [x, y] = randomArenaPoint(rng, C.r.radius, 14);
        const dx = x - p.x;
        const dy = y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > C.r.spread) [x, y] = [p.x + (dx / d) * C.r.spread * rng.next(), p.y + (dy / d) * C.r.spread * rng.next()];
        addZone(state, { kind: 'meteor', shape: 'circle', ownerId: p.id, x, y, r: C.r.radius * cast.area, warn: C.r.telegraph, life: 0.08, dmg: 1 });
      }
    },
    fire: () => {},
  },
  passive(state, p, dt) {
    const b = p.boss;
    b.passiveT += dt;
    if (b.passiveT < C.passive.every) return;
    b.passiveT = 0;
    addZone(state, { kind: 'embers', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: C.passive.radius, warn: C.passive.telegraph, life: C.passive.life, dmg: 1, tick: 1, tickT: 0 });
  },
  channel() {},
};
