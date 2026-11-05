import { BOSSES, HERO } from '../config.js';
import { addZone } from '../zones.js';
import { bossRadius, hurtHero } from '../combat.js';
import { resolveStatic, randomArenaPoint } from '../physics.js';
import { meleeTelegraph, aimAngle, lineMarker } from './helpers.js';

const C = BOSSES.kolos;

/** Kolos (tank): odporny na odrzut, -15% obrażeń, 0,7× prędkości. */
export const kolos = {
  atk: {
    telegraph: (state, p, cast) => meleeTelegraph(state, p, cast, C.atk, { knock: 4 }),
    fire: () => {},
  },
  /** Fala uderzeniowa: pierścień, który trzeba przeskoczyć dashem. */
  q: {
    telegraph: (state, p, cast) =>
      addZone(state, { kind: 'shockwave', shape: 'ring', ownerId: p.id, x: p.x, y: p.y, r: bossRadius(), rMax: C.q.maxR * cast.area, w: C.q.width, warn: C.q.telegraph, life: C.q.expand, dmg: 1, knock: 5 }),
    fire: () => {},
  },
  /** Szarża: linia 8 m, przewraca i odrzuca. */
  e: {
    telegraph: (state, p, cast) => {
      cast.data = { ang: aimAngle(p, cast) };
      lineMarker(state, p, cast, C.e.len * cast.area, C.e.width, 'chargeLine');
    },
    fire: (state, p, cast) => {
      p.boss.channel = { kind: 'charge', t: (C.e.len * cast.area) / C.e.speed, dx: Math.cos(cast.data.ang), dy: Math.sin(cast.data.ang), hit: [] };
    },
  },
  /** Deszcz głazów: 4 strefy w miejscach bohaterów. */
  r: {
    telegraph: (state, p, cast, rng) => {
      const spots = state.players.filter((h) => !h.boss && h.alive && h.connected).map((h) => [h.x, h.y]);
      while (spots.length < C.r.count) spots.push(randomArenaPoint(rng, 1));
      for (const [x, y] of spots.slice(0, C.r.count)) {
        addZone(state, { kind: 'boulder', shape: 'circle', ownerId: p.id, x, y, r: C.r.radius * cast.area, warn: C.r.telegraph, life: 0.08, dmg: 1 });
      }
    },
    fire: () => {},
  },
  /** @param {any} state @param {any} p @param {number} dt */
  channel(state, p, dt) {
    const ch = p.boss.channel;
    if (ch.kind !== 'charge') return;
    p.x += ch.dx * C.e.speed * dt;
    p.y += ch.dy * C.e.speed * dt;
    if (resolveStatic(p, bossRadius())) ch.t = 0;
    for (const h of state.players) {
      if (h.boss || !h.alive || ch.hit.includes(h.id)) continue;
      if (Math.hypot(h.x - p.x, h.y - p.y) > bossRadius() + HERO.radius + 0.2) continue;
      if (hurtHero(state, h, 1, p.id, p.x, p.y)) {
        ch.hit.push(h.id);
        const side = (h.x - p.x) * -ch.dy + (h.y - p.y) * ch.dx >= 0 ? 1 : -1;
        h.kx += (ch.dx * 0.5 - ch.dy * side) * C.e.knock;
        h.ky += (ch.dy * 0.5 + ch.dx * side) * C.e.knock;
        h.stunT = Math.max(h.stunT, C.e.stun);
      }
    }
  },
};
