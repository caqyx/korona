import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { bossRadius } from '../combat.js';
import { resolveStatic } from '../physics.js';
import { spawnProjectile } from '../projectiles.js';
import { meleeTelegraph, aimAngle, lineMarker, clampAim, nearestHero, safeBossPoint } from './helpers.js';
import { makeMinion } from './nekromanta.js';

const C = BOSSES.pajeczyca;

/** Pajęczyca (różowy): szybka (1,15×), 0,9× HP. */
export const pajeczyca = {
  atk: {
    telegraph: (state, p, cast) => meleeTelegraph(state, p, cast, C.atk),
    fire: () => {},
  },
  /** Sieć: pocisk, który unieruchamia trafionego na 1,2 s. */
  q: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, C.q.range * 0.7, 0.9, 'webLine'),
    fire: (state, p, cast) => {
      const a = aimAngle(p, cast);
      spawnProjectile(state, {
        team: 'boss',
        ownerId: p.id,
        kind: 'web',
        x: p.x + Math.cos(a) * bossRadius(),
        y: p.y + Math.sin(a) * bossRadius(),
        vx: Math.cos(a) * C.q.speed,
        vy: Math.sin(a) * C.q.speed,
        r: C.q.r * cast.area,
        range: C.q.range,
        dmg: 0,
        stun: C.q.stun,
      });
    },
  },
  /** Skok: na bohatera najbliższego kursorowi (do 8 m), strefa lądowania 2 m. */
  e: {
    telegraph: (state, p, cast) => {
      const t = nearestHero(state, cast.ax, cast.ay, Infinity, [], p.team);
      const ok = t && Math.hypot(t.x - p.x, t.y - p.y) <= C.e.range;
      const [tx, ty] = ok ? [t.x, t.y] : clampAim(p, cast.ax, cast.ay, C.e.range);
      const [x, y] = safeBossPoint(tx, ty);
      cast.data = { x, y };
      addZone(state, { kind: 'pounce', shape: 'circle', ownerId: p.id, x, y, r: C.e.radius * cast.area, warn: C.e.telegraph, life: 0.08, dmg: 1 });
    },
    fire: (state, p, cast) => {
      state.events.push({ t: 'blink', id: p.id, fromX: p.x, fromY: p.y, x: cast.data.x, y: cast.data.y });
      p.x = cast.data.x;
      p.y = cast.data.y;
    },
  },
  /** Gniazdo: 4 pajęczaki (8 HP, szybkie), maks. 8 naraz. */
  r: {
    telegraph: (state, p, cast) => {
      const spots = [];
      for (let i = 0; i < C.r.count; i++) {
        const a = (i / C.r.count) * Math.PI * 2 + Math.PI / 4;
        const s = { x: p.x + Math.cos(a) * (bossRadius() + 1), y: p.y + Math.sin(a) * (bossRadius() + 1) };
        resolveStatic(s, C.r.radius);
        spots.push([s.x, s.y]);
        addZone(state, { kind: 'egg', shape: 'circle', ownerId: p.id, x: s.x, y: s.y, r: 0.6, warn: C.r.telegraph, life: 0, dmg: 0 });
      }
      cast.data = { spots };
    },
    fire: (state, p, cast) => {
      for (const [x, y] of cast.data.spots) {
        if (state.minions.length >= C.r.max) break;
        state.minions.push(makeMinion(state, p.id, x, y, C.r, 'spiderling'));
      }
    },
  },
  channel() {},
};
