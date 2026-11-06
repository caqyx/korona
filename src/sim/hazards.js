/**
 * Mechaniki terenu map: lawa (obrażenia), lód (poślizg), krzaki (ukrycie), ruchome piaski
 * (spowolnienie i wciąganie) oraz zdarzenia mapy (ręce z grobów z telegrafem).
 */
import { getMap, inHazard, HAZARD } from './maps.js';
import { hurtHero } from './combat.js';
import { addZone } from './zones.js';

/** Statusy terenu dla graczy (onIce, hidden, lawa, piaski). @param {any} state @param {number} dt */
export function updateHazards(state, dt) {
  const m = getMap(state.mapId);
  for (const p of state.players) {
    p.onIce = false;
    const wasHidden = p.hidden;
    p.hidden = false;
    if (!p.alive || !p.connected) continue;
    p.revealT = Math.max(0, (p.revealT || 0) - dt);
    let inLava = false;
    for (const z of m.hazards) {
      if (!inHazard(z, p.x, p.y, 0.4)) continue;
      if (z.kind === 'ice') p.onIce = true;
      else if (z.kind === 'bush' && !p.boss && p.revealT <= 0) p.hidden = true;
      else if (z.kind === 'lava' && !p.boss && p.dashT <= 0) inLava = true;
      else if (z.kind === 'quicksand' && p.dashT <= 0) {
        p.slowT = Math.max(p.slowT, 0.2);
        p.slowMul = Math.min(p.slowMul || 1, 1 - HAZARD.quicksand.slow);
        if (!p.boss) {
          const dx = z.x - p.x;
          const dy = z.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.2) {
            p.x += (dx / d) * HAZARD.quicksand.pull * dt;
            p.y += (dy / d) * HAZARD.quicksand.pull * dt;
          }
        }
      }
    }
    if (inLava && state.phase === 'playing') {
      p.hazT = (p.hazT ?? 0.4) - dt;
      if (p.hazT <= 0) {
        p.hazT = HAZARD.lava.every;
        // źródło „pod stopami”: od tyłu, żeby tarcza nie blokowała
        if (hurtHero(state, p, HAZARD.lava.dmg, null, p.x - p.fx, p.y - p.fy)) state.events.push({ t: 'burn', id: p.id, x: p.x, y: p.y });
      }
    } else p.hazT = 0.4;
    if (wasHidden !== p.hidden && !p.boss) state.events.push({ t: p.hidden ? 'hide' : 'unhide', id: p.id });
  }
}

/** Zdarzenia mapy (np. ręce z grobów). @param {any} state @param {number} dt @param {import('./rng.js').Rng} rng */
export function updateMapEvents(state, dt, rng) {
  const m = getMap(state.mapId);
  if (!m.events.length || state.phase !== 'playing') return;
  state.mapT = (state.mapT || 0) + dt;
  for (const ev of m.events) {
    if (ev.kind !== 'graveHands' || state.mapT < ev.every) continue;
    state.mapT = 0;
    const heroes = state.players.filter((h) => !h.boss && h.alive && h.connected && !h.ai);
    for (let i = 0; i < ev.count && heroes.length; i++) {
      const h = heroes[rng.int(heroes.length)];
      const a = rng.next() * Math.PI * 2;
      const d = rng.next() * 1.6;
      addZone(state, { kind: 'graveHand', shape: 'circle', ownerId: null, x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, r: ev.radius, warn: ev.telegraph, life: 0.1, dmg: 1 });
    }
  }
}
