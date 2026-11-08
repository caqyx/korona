import { BOSSES } from '../config.js';
import { addZone } from '../zones.js';
import { bossRadius, hurtHero } from '../combat.js';
import { nextId } from '../state.js';
import { resolveStatic } from '../physics.js';
import { aimAngle, lineMarker, bossShot, clampAim, nearestHero } from './helpers.js';

const C = BOSSES.nekromanta;

/** Nekromanta (kontrola). Pasywka: miniony nie dają punktów i nie liczą się do obrażeń bossa. */
export const nekromanta = {
  atk: {
    telegraph: (state, p, cast) => lineMarker(state, p, cast, 6, 0.6),
    fire: (state, p, cast) => bossShot(state, p, aimAngle(p, cast), C.atk, 'necroBolt'),
  },
  /** Przywołanie: 3 szkielety (15 HP), maks. 6 naraz. */
  q: {
    telegraph: (state, p, cast) => {
      const base = aimAngle(p, cast);
      const spots = [];
      for (let i = 0; i < C.q.count; i++) {
        const a = base + (i - 1) * 0.9;
        const s = { x: p.x + Math.cos(a) * (bossRadius() + 1.2), y: p.y + Math.sin(a) * (bossRadius() + 1.2) };
        resolveStatic(s, C.q.radius);
        spots.push([s.x, s.y]);
        addZone(state, { kind: 'summon', shape: 'circle', ownerId: p.id, x: s.x, y: s.y, r: 0.7, warn: C.q.telegraph, life: 0, dmg: 0 });
      }
      cast.data = { spots };
    },
    fire: (state, p, cast) => {
      for (const [x, y] of cast.data.spots) {
        if (state.minions.length >= C.q.max) break;
        state.minions.push(makeMinion(state, p.id, x, y, C.q, 'skeleton'));
      }
    },
  },
  /** Wysysanie: promień 2 s, 1 dmg/s, leczy bossa 4% max HP/s. */
  e: {
    telegraph: (state, p, cast) => {
      const t = nearestHero(state, cast.ax, cast.ay, Infinity, [], p.team);
      const ok = t && Math.hypot(t.x - p.x, t.y - p.y) <= C.e.range;
      const target = ok ? t : nearestHero(state, p.x, p.y, C.e.range, [], p.team);
      cast.data = { targetId: target ? target.id : null };
      const ang = target ? Math.atan2(target.y - p.y, target.x - p.x) : aimAngle(p, cast);
      const len = target ? Math.hypot(target.x - p.x, target.y - p.y) : C.e.range;
      addZone(state, { kind: 'drainLine', shape: 'line', ownerId: p.id, x: p.x, y: p.y, ang, len, w: 0.5, warn: C.e.telegraph, life: 0, dmg: 0 });
    },
    fire: (state, p, cast) => {
      const t = state.players.find((h) => h.id === cast.data.targetId);
      if (!t || !t.alive || t.boss || Math.hypot(t.x - p.x, t.y - p.y) > C.e.breakRange) return;
      p.boss.channel = { kind: 'drain', t: C.e.duration, targetId: t.id, tickT: 1 };
    },
  },
  /** Kostnica: strefa 4 m, 4 s, spowolnienie 50%, 1 dmg/s. */
  r: {
    telegraph: (state, p, cast) => {
      const [x, y] = clampAim(p, cast.ax, cast.ay, C.r.range);
      addZone(state, { kind: 'ossuary', shape: 'circle', ownerId: p.id, x, y, r: C.r.radius * cast.area, warn: C.r.telegraph, life: C.r.duration, dmg: C.r.dps, tick: 1, tickT: 0, slow: C.r.slow });
    },
    fire: () => {},
  },
  channel(state, p, dt) {
    const ch = p.boss.channel;
    if (ch.kind !== 'drain') return;
    const t = state.players.find((h) => h.id === ch.targetId);
    if (!t || !t.alive || t.boss || Math.hypot(t.x - p.x, t.y - p.y) > C.e.breakRange) {
      ch.t = 0;
      state.events.push({ t: 'drainBreak', id: p.id });
      return;
    }
    p.boss.hp = Math.min(p.boss.maxHp, p.boss.hp + C.e.healPct * p.boss.maxHp * dt);
    ch.tickT -= dt;
    if (ch.tickT <= 1e-9) {
      ch.tickT += 1;
      hurtHero(state, t, C.e.dps, p.id, p.x, p.y);
    }
  },
};

/**
 * Tworzy miniona z własnymi statystykami (szkielet Nekromanty, pajęczak Pajęczycy).
 * @param {any} state @param {string} ownerId @param {number} x @param {number} y
 * @param {{hp:number,radius:number,speed:number,atkRange:number,atkTelegraph:number,atkCd:number}} cfg @param {string} kind
 */
export function makeMinion(state, ownerId, x, y, cfg, kind) {
  return { id: nextId(state), kind, ownerId, x, y, hp: cfg.hp, maxHp: cfg.hp, r: cfg.radius, cd: 0.6, windup: 0, fx: 1, fy: 0, speed: cfg.speed, atkRange: cfg.atkRange, atkTelegraph: cfg.atkTelegraph, atkCd: cfg.atkCd };
}

export { updateMinions } from '../minions.js';
