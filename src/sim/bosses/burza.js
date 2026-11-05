import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { aimAngle, lineMarker, bossShot, clampAim, nearestHero } from './helpers.js';
import { HERO } from '../config.js';

const C = BOSSES.burza;

/** Burza (obszar). Pasywka: co 3 trafienia Przeciążenie (+50% obszaru następnej umiejętności). */
export const burza = {
  atk: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, C.atk.range * 0.6, 0.5),
    fire: (state, p, cast) => bossShot(state, p, aimAngle(p, cast), C.atk, 'spark'),
  },
  /** Piorun: punkt, telegraf 0,6 s, promień 2 m. */
  q: {
    telegraph: (state, p, cast) => {
      const [x, y] = clampAim(p, cast.ax, cast.ay, C.q.range);
      addZone(state, { kind: 'lightning', shape: 'circle', ownerId: p.id, x, y, r: C.q.radius * cast.area, warn: C.q.telegraph, life: 0.08, dmg: 1 });
    },
    fire: () => {},
  },
  /** Wir: 2 s przyciągania w promieniu 6 m. */
  e: {
    telegraph: (state, p, cast) => {
      cast.data = { radius: C.e.radius * cast.area };
      addZone(state, { kind: 'vortexMark', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: cast.data.radius, warn: C.e.telegraph, life: 0, dmg: 0 });
    },
    fire: (state, p, cast) => {
      p.boss.channel = { kind: 'vortex', t: C.e.duration, radius: cast.data.radius };
    },
  },
  /** Łańcuch błyskawic: najbliższy bohater + do 4 skoków w promieniu 4 m. */
  r: {
    telegraph: (state, p, cast) => {
      const chain = [];
      let cur = nearestHero(state, p.x, p.y, C.r.range);
      while (cur && chain.length < C.r.jumps + 1) {
        chain.push(cur);
        cur = nearestHero(state, cur.x, cur.y, C.r.jumpRadius * cast.area, chain.map((c) => c.id));
      }
      cast.data = { pts: chain.map((h) => [h.x, h.y]) };
      for (const h of chain) addZone(state, { kind: 'chain', shape: 'circle', ownerId: p.id, x: h.x, y: h.y, r: HERO.radius + 0.6, warn: C.r.telegraph, life: 0.08, dmg: 1 });
      if (!chain.length) addZone(state, { kind: 'chain', shape: 'circle', ownerId: p.id, x: p.x, y: p.y, r: 1.4, warn: C.r.telegraph, life: 0, dmg: 0 });
    },
    fire: (state, p, cast) => {
      state.events.push({ t: 'chain', id: p.id, pts: [[p.x, p.y], ...cast.data.pts] });
    },
  },
  channel(state, p, dt) {
    const ch = p.boss.channel;
    if (ch.kind !== 'vortex') return;
    for (const h of state.players) {
      if (h.boss || !h.alive || h.dashT > 0) continue;
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d > ch.radius || d < 0.1) continue;
      h.x += (dx / d) * C.e.pull * dt;
      h.y += (dy / d) * C.e.pull * dt;
    }
  },
};
