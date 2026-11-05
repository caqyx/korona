import { bossRadius } from '../combat.js';
import { resolveStatic } from '../physics.js';
import { spawnProjectile } from '../projectiles.js';
import { addZone } from '../zones.js';

const RAD = Math.PI / 180;
export { RAD };

/** Punkt celowania ograniczony do zasięgu. */
export function clampAim(p, ax, ay, range) {
  const dx = ax - p.x;
  const dy = ay - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= range) return [ax, ay];
  return [p.x + (dx / d) * range, p.y + (dy / d) * range];
}

/** Kąt od bossa do punktu celowania (lub kierunek patrzenia). */
export function aimAngle(p, cast) {
  const dx = cast.ax - p.x;
  const dy = cast.ay - p.y;
  return Math.hypot(dx, dy) > 0.05 ? Math.atan2(dy, dx) : Math.atan2(p.fy, p.fx);
}

/** Najbliższy żywy bohater do punktu (opcjonalnie w zasięgu od (fx,fy)). */
export function nearestHero(state, x, y, maxD = Infinity, exclude = []) {
  let best = null;
  let bd = maxD;
  for (const h of state.players) {
    if (h.boss || !h.alive || !h.connected || exclude.includes(h.id)) continue;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}

/** Melee bossa: stożek z telegrafem. */
export function meleeTelegraph(state, p, cast, cfg, extra = {}) {
  addZone(state, {
    kind: 'bossMelee',
    shape: 'arc',
    ownerId: p.id,
    x: p.x,
    y: p.y,
    r: cfg.range,
    ang: aimAngle(p, cast),
    arc: cfg.arc * RAD,
    warn: cfg.telegraph,
    life: 0.06,
    dmg: 1,
    ...extra,
  });
}

/** Linia-znacznik (telegraf bez obrażeń) w kierunku celowania. */
export function lineMarker(state, p, cast, length, width, kind = 'aimLine') {
  addZone(state, { kind, shape: 'line', ownerId: p.id, x: p.x, y: p.y, ang: aimAngle(p, cast), len: length, w: width, warn: cast.total, life: 0, dmg: 0 });
}

/** Pocisk bossa w kierunku celowania. */
export function bossShot(state, p, ang, cfg, kind) {
  const r0 = bossRadius();
  spawnProjectile(state, {
    team: 'boss',
    ownerId: p.id,
    kind,
    x: p.x + Math.cos(ang) * r0,
    y: p.y + Math.sin(ang) * r0,
    vx: Math.cos(ang) * cfg.speed,
    vy: Math.sin(ang) * cfg.speed,
    r: cfg.r,
    range: cfg.range,
    dmg: 1,
  });
}

/** Bezpieczny punkt docelowy dla bossa (w arenie, poza filarami). */
export function safeBossPoint(x, y) {
  const e = { x, y };
  resolveStatic(e, bossRadius());
  return [e.x, e.y];
}
