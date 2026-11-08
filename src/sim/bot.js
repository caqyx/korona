import { BTN } from './state.js';
import { SKINS, BOSSES, HERO, AI_LEVELS } from './config.js';
import { zoneContains } from './zones.js';
import { bossRadius } from './combat.js';
import { getMap, inHazard } from './maps.js';

/**
 * Proste AI inputu (boty w trybie lokalnym, AI-boss w trybach, testy E2E, balans).
 * Deterministyczne względem przekazanego RNG (osobny od RNG świata).
 * @param {any} state @param {string} id @param {import('./rng.js').Rng} rng
 * @param {'easy'|'normal'|'hard'} [level]
 * @returns {import('./state.js').Input}
 */
export function botInput(state, id, rng, level = 'normal') {
  const me = state.players.find((p) => p.id === id);
  const L = AI_LEVELS[level] || AI_LEVELS.normal;
  if (!me) return idle();
  if (state.offers && state.offers[id]) return pickOffer(state.offers[id], rng);
  if (!me.alive) return idle();
  return me.boss ? bossBot(state, me, rng, L) : heroBot(state, me, rng, L);
}

const idle = () => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 });

/** Bot wybiera ulepszenie: chwilę „myśli”, potem zatwierdza. */
function pickOffer(o, rng) {
  if (o.picked !== null) return idle();
  const r = rng.next();
  if (r < 0.04) return { ...idle(), moveX: rng.next() < 0.5 ? -1 : 1 };
  if (r < 0.07) return { ...idle(), buttons: BTN.ATTACK };
  return idle();
}

/** Cel bohatera-bota: boss, a gdy go nie ma — najbliższy minion (tryby z falami), potem korona. */
function heroTarget(state, me) {
  // drużyny: wrogi bohater w pobliżu ma pierwszeństwo przed bossem
  if (me.team !== undefined) {
    let foe = null;
    let fd = 5;
    for (const o of state.players) {
      if (o.boss || !o.alive || o.team === me.team || o.ai) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < fd && !(o.hidden && d > 2.5)) {
        fd = d;
        foe = o;
      }
    }
    if (foe) return { x: foe.x, y: foe.y, r: HERO.radius };
  }
  let bossP = null;
  let bd = Infinity;
  for (const p of state.players) {
    if (!p.boss || p.boss.dying || p.id === me.id || (me.team !== undefined && p.team === me.team)) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) {
      bd = d;
      bossP = p;
    }
  }
  if (bossP) return { x: bossP.x, y: bossP.y, r: bossRadius() };
  let best = null;
  let md = Infinity;
  for (const m of state.minions) {
    const d = Math.hypot(m.x - me.x, m.y - me.y);
    if (d < md) {
      md = d;
      best = m;
    }
  }
  return best ? { x: best.x, y: best.y, r: best.r } : null;
}

function heroBot(state, me, rng, L) {
  let aimX = state.crown.x;
  let aimY = state.crown.y;
  let buttons = 0;
  let mx = 0;
  let my = 0;
  const t = heroTarget(state, me);
  if (t) {
    const cfg = SKINS[me.skin].attack;
    const range = cfg.range * (me.mods?.range ?? 1);
    const want = cfg.kind === 'melee' ? t.r + range * 0.6 : Math.min(range * 0.75, 6);
    const dx = t.x - me.x;
    const dy = t.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    aimX = t.x + (rng.next() - 0.5) * 2 * L.aimErr;
    aimY = t.y + (rng.next() - 0.5) * 2 * L.aimErr;
    const radial = d > want + 0.3 ? 1 : d < want - 0.6 ? -1 : 0;
    const strafe = (strafeSign(me.id) ? 1 : -1) * 0.7;
    mx = (dx / d) * radial + (-dy / d) * strafe;
    my = (dy / d) * radial + (dx / d) * strafe;
    if (d < want + range + 1 && rng.next() < L.attack) buttons |= BTN.ATTACK;
    if (me.abilCd <= 0 && rng.next() < 0.05 * L.ability) buttons |= BTN.ABILITY;
  } else if (state.crown.state === 'center') {
    const dx = state.crown.x - me.x;
    const dy = state.crown.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  const esc = escapeVector(state, me, L);
  if (esc) {
    mx = esc.x;
    my = esc.y;
    if (esc.urgent && me.dashCd <= 0) buttons |= BTN.DASH;
  }
  [mx, my] = avoidTerrain(state, me, mx, my);
  return { moveX: mx, moveY: my, aimX, aimY, buttons: buttons | 0 };
}

/** Odpychanie od lawy i ruchomych piasków (bot omija groźny teren). */
function avoidTerrain(state, me, mx, my) {
  const m = getMap(state.mapId);
  for (const z of m.hazards) {
    if (z.kind !== 'lava' && z.kind !== 'quicksand') continue;
    if (!inHazard(z, me.x + mx * 0.9, me.y + my * 0.9, 0.6) && !inHazard(z, me.x, me.y, 0.6)) continue;
    const dx = me.x - z.x;
    const dy = me.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    return [mx * 0.3 + (dx / d) * 0.9, my * 0.3 + (dy / d) * 0.9];
  }
  return [mx, my];
}

/** Deterministyczny „rzut kością” dla pary (zagrożenie, bot) — decyzja raz na telegraf, nie co klatkę. */
function roll(zoneId, botId, salt) {
  let h = (zoneId * 2654435761) ^ salt;
  for (let i = 0; i < botId.length; i++) h = Math.imul(h ^ botId.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Kierunek ucieczki z zagrożenia albo null. Bot jest omylny: nie każdy telegraf zauważa,
 * reaguje z opóźnieniem, a dash wykonuje tylko czasem i z błędem w czasie.
 */
function escapeVector(state, me, L) {
  for (const z of state.zones) {
    if (z.dmg <= 0) continue;
    const ring = z.shape === 'ring';
    const inside = ring ? z.warn <= 0 && zoneContains(z, me.x, me.y, HERO.radius + 0.8) : z.warn > 0 && zoneContains(z, me.x, me.y, HERO.radius + 0.3);
    if (!inside) continue;
    if (roll(z.id, me.id, 11) > L.dodge) continue; // nie zauważył
    const elapsed = (z.warnTotal || 0) - Math.max(0, z.warn);
    if (!ring && elapsed < L.reaction) continue; // jeszcze nie zareagował
    const wantsDash = roll(z.id, me.id, 23) < L.dash;
    const dashAt = 0.12 + (roll(z.id, me.id, 37) - 0.5) * 2 * L.dashErr; // idealnie ~0,12 s przed uderzeniem
    if (ring) {
      // pierścień: dash w losowym momencie, gdy jest blisko
      const urgent = wantsDash && roll(z.id, me.id, 41 + Math.floor(state.time * 10)) < 0.35;
      return { x: 0, y: 0, urgent };
    }
    let dx = me.x - z.x;
    let dy = me.y - z.y;
    if (z.shape === 'line') {
      const nx = -Math.sin(z.ang);
      const ny = Math.cos(z.ang);
      const side = dx * nx + dy * ny >= 0 ? 1 : -1;
      dx = nx * side;
      dy = ny * side;
    }
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, urgent: wantsDash && z.warn <= Math.max(0.02, dashAt) };
  }
  return null;
}

function bossBot(state, me, rng, L) {
  let target = null;
  let bd = Infinity;
  for (const h of state.players) {
    if (h.boss || !h.alive || !h.connected || h.ai) continue;
    if (me.team !== undefined && h.team === me.team) continue;
    const d = Math.hypot(h.x - me.x, h.y - me.y);
    if (h.hidden && d > 2.5) continue; // krzaki: boss nie widzi
    if (d < bd) {
      bd = d;
      target = h;
    }
  }
  if (!target) return { moveX: -me.x * 0.1, moveY: -me.y * 0.1, aimX: 0, aimY: 0, buttons: 0 };
  const dx = target.x - me.x;
  const dy = target.y - me.y;
  const d = Math.hypot(dx, dy) || 1;
  const range = BOSSES[me.boss.type].atk.range ?? 3;
  const melee = ['kolos', 'cien', 'pajeczyca', 'widmo'].includes(me.boss.type);
  const want = melee ? range * 0.7 : 5;
  const radial = d > want ? 1 : -0.6;
  let buttons = 0;
  if (d < (melee ? range + 0.5 : 9) && rng.next() < L.attack) buttons |= BTN.ATTACK;
  const r = rng.next() / L.bossAbility;
  if (r < 0.04) buttons |= BTN.Q;
  else if (r < 0.07) buttons |= BTN.E;
  else if (r < 0.1) buttons |= BTN.R;
  const err = L.aimErr * 0.6;
  return {
    moveX: (dx / d) * radial,
    moveY: (dy / d) * radial,
    aimX: target.x + (rng.next() - 0.5) * 2 * err,
    aimY: target.y + (rng.next() - 0.5) * 2 * err,
    buttons,
  };
}

/** Kierunek okrążania celu zależny od id (nie od slotu — slot faworyzował jedną drużynę). */
function strafeSign(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 3) % 2 === 0;
}
