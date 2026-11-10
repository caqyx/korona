import { BTN } from './state.js';
import { SKINS, BOSSES, HERO, AI_LEVELS } from './config.js';
import { zoneContains } from './zones.js';
import { bossRadius, sameTeam, heroesHostile } from './combat.js';
import { getMap, inHazard, HAZARD } from './maps.js';
import { obstacleOnSegment } from './physics.js';
import { auraWouldHeal } from './heroes/kaplan.js';

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

/** Z tej odległości widać ukrytych w krzakach i niewidzialnego bossa. */
const SEE_RANGE = HAZARD.bush.bossSeeRange;

/** Cel bohatera-bota: boss, a gdy go nie ma — najbliższy minion (tryby z falami), potem korona. */
function heroTarget(state, me) {
  // drużyny: wrogi bohater w pobliżu ma pierwszeństwo przed bossem
  if (me.team !== undefined) {
    let foe = null;
    let fd = 5;
    for (const o of state.players) {
      if (o.boss || !o.alive || o.team === me.team || o.ai) continue;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < fd && !(o.hidden && d > SEE_RANGE)) {
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
    if (p.boss.invisT > 0 && d > SEE_RANGE) continue; // Zasłona Cienia: niewidzialnego widać tylko z bliska (jak krzaki)
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
    // strzelec z zasłoniętą linią strzału nie strzela w filar, tylko odchodzi w bok, aż cel się odsłoni
    const los = cfg.kind === 'projectile' ? lineOfFire(state, me, t, cfg.r) : LOS_CLEAR;
    const strafe = los.side || (strafeSign(me.id) ? 1 : -1) * 0.7;
    mx = (dx / d) * radial + (-dy / d) * strafe;
    my = (dy / d) * radial + (dx / d) * strafe;
    if (d < want + range + 1 && rng.next() < L.attack && !los.blocked) buttons |= BTN.ATTACK;
    if (me.abilCd <= 0 && rng.next() < 0.05 * L.ability && abilityUseful(state, me)) buttons |= BTN.ABILITY;
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

const LOS_CLEAR = Object.freeze({ blocked: false, side: 0 });
/** Zapas (m), o jaki bot odsuwa linię strzału od przeszkody ponad promień pocisku — żeby nie drgać na samej krawędzi. */
const LOS_MARGIN = 0.4;

/**
 * Linia strzału do celu względem przeszkód mapy.
 *  - `blocked`: pocisk o promieniu `shotR` zahaczyłby o przeszkodę — nie strzelaj;
 *  - `side`: 0 albo ±1 — w którą stronę (względem kierunku do celu, +1 = w lewo) odejść, żeby oddalić
 *    linię od przeszkody; ustawiane też tuż przy przeszkodzie (LOS_MARGIN), gdy strzał już przechodzi.
 * Odcinek kończy się na krawędzi celu, więc filar stojący za bossem nie przeszkadza.
 */
function lineOfFire(state, me, t, shotR) {
  const dx = t.x - me.x;
  const dy = t.y - me.y;
  const d = Math.hypot(dx, dy);
  if (d <= t.r) return LOS_CLEAR;
  const k = (d - t.r) / d;
  const map = getMap(state.mapId);
  const o = obstacleOnSegment(me.x, me.y, me.x + dx * k, me.y + dy * k, shotR + LOS_MARGIN, map);
  if (!o) return LOS_CLEAR;
  const cross = dx * (o.y - me.y) - dy * (o.x - me.x); // > 0: przeszkoda po lewej stronie linii strzału
  const side = Math.abs(cross) < 1e-6 ? (strafeSign(me.id) ? 1 : -1) : cross > 0 ? -1 : 1;
  const blocked = !!obstacleOnSegment(me.x, me.y, me.x + dx * k, me.y + dy * k, shotR, map);
  return { blocked, side };
}

/** Czy umiejętność bohatera ma teraz sens (tabela wyjątków; brak wpisu = zawsze). */
const ABILITY_USEFUL = {
  /** Aura leczy tylko rannych — nie rzucaj jej, gdy nikt w zasięgu nie ma ubytku HP */
  kaplan: auraWouldHeal,
};
const abilityUseful = (state, me) => ABILITY_USEFUL[me.skin]?.(state, me) ?? true;

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
 * Czy strefa może zranić tego bota: strefy bossa/minionów — o ile nie własnej drużyny;
 * strefy umiejętności bohaterów (Meteor, Korzenie) — tylko wrogich bohaterów w trybie drużyn.
 */
function zoneThreatens(state, z, me) {
  const owner = z.ownerId ? state.players.find((p) => p.id === z.ownerId) : null;
  if (z.team === 'hero') return !!owner && heroesHostile(owner, me);
  return !(owner && sameTeam(owner, me));
}

/**
 * Czy bot zorientował się, że stoi w aktywnej strefie tykającej. Ta sama omylność co przy telegrafach
 * (`dodge`), ale szansa wraca z każdym tickiem strefy — kto przegapił telegraf, może „poczuć” kolejne
 * uderzenie. Rzuty są deterministyczne (hash strefy, bota i numeru ticku), więc raz zauważona strefa
 * zostaje zauważona.
 */
function noticesTicking(z, me, L) {
  if (roll(z.id, me.id, 11) <= L.dodge) return true; // widział już telegraf
  const ticks = 1 + Math.floor(Math.max(0, (z.lifeTotal || 0) - z.life) / z.tick);
  for (let i = 0; i < ticks; i++) if (roll(z.id, me.id, 53 + i) <= L.dodge) return true;
  return false;
}

/** Kierunek wyjścia ze strefy: od środka, a dla linii — prostopadle na bliższą stronę. */
function awayFrom(z, me) {
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
  return [dx / d, dy / d];
}

/**
 * Kierunek ucieczki z zagrożenia albo null. Bot jest omylny: nie każdy telegraf zauważa,
 * reaguje z opóźnieniem, a dash wykonuje tylko czasem i z błędem w czasie.
 * Telegrafy mają pierwszeństwo; gdy żaden nie grozi, bot wychodzi (bez dasha) z aktywnej strefy
 * tykającej, w której stoi (Kostnica, Zamieć, Żar) — o ile ją zauważył.
 */
function escapeVector(state, me, L) {
  let ticking = null;
  for (const z of state.zones) {
    if (z.dmg <= 0) continue;
    const ring = z.shape === 'ring';
    const lingering = !ring && z.warn <= 0 && z.tick > 0;
    const inside = ring ? z.warn <= 0 && zoneContains(z, me.x, me.y, HERO.radius + 0.8) : (z.warn > 0 || lingering) && zoneContains(z, me.x, me.y, HERO.radius + 0.3);
    if (!inside || !zoneThreatens(state, z, me)) continue;
    if (lingering) {
      if (!ticking && noticesTicking(z, me, L)) ticking = z;
      continue;
    }
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
    const [x, y] = awayFrom(z, me);
    return { x, y, urgent: wantsDash && z.warn <= Math.max(0.02, dashAt) };
  }
  if (!ticking) return null;
  const [x, y] = awayFrom(ticking, me);
  return { x, y, urgent: false };
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
  const def = /** @type {any} */ (BOSSES)[me.boss.type];
  const range = def.atk.range ?? 3;
  const melee = def.atk.arc !== undefined; // atak-stożek (bez pocisku)
  const want = melee ? range * 0.7 : 5;
  const radial = d > want ? 1 : -0.6;
  // wyprzedzenie: celuje tam, gdzie cel będzie za `lead` s (ogłuszony stoi — jego vx/vy to ostatni ruch)
  const lead = target.stunT > 0 ? 0 : (L.lead ?? 0);
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  let buttons = 0;
  if (d < (melee ? range + 0.5 : 9) && rng.next() < L.attack) buttons |= BTN.ATTACK;
  const r = rng.next() / L.bossAbility;
  const ab = r < 0.04 ? 'q' : r < 0.07 ? 'e' : r < 0.1 ? 'r' : null;
  // nie odpala umiejętności, która na pewno nie sięgnie celu
  if (ab && Math.hypot(tx - me.x, ty - me.y) <= bossAbilityReach(def[ab]) + HERO.radius) buttons |= ABILITY_BTN[ab];
  const err = L.aimErr * 0.6;
  return {
    moveX: (dx / d) * radial,
    moveY: (dy / d) * radial,
    aimX: tx + (rng.next() - 0.5) * 2 * err,
    aimY: ty + (rng.next() - 0.5) * 2 * err,
    buttons,
  };
}

const ABILITY_BTN = { q: BTN.Q, e: BTN.E, r: BTN.R };

/**
 * Zasięg akcji bossa wyliczony z jej configu (od środka bossa do środka celu), bez tabel per boss:
 *  - `range` — pocisk, stożek, promień albo punkt docelowy; strefa wokół punktu dokłada swój `radius`;
 *  - `len` — linia (Szarża, Lodowa ściana); `maxR` / `from` — pierścień (Fala, Żniwa);
 *  - `radius` z flagą `aroundBoss` — strefa wokół samego bossa (Nova, Wir, Strach).
 * Brak tych pól (przywołania, Zasłona, deszcze celowane w bohaterów) = Infinity, czyli bez ograniczenia.
 * Wartość bywa zawyżona (np. bumerang Kosy ma `range` liczony w obie strony) — chodzi tylko o to,
 * żeby bot nie odpalał akcji, która NA PEWNO nie sięgnie.
 * @param {Record<string, any>} cfg
 */
export function bossAbilityReach(cfg) {
  if (cfg.range !== undefined) return cfg.range + (cfg.radius ?? 0);
  for (const k of ['len', 'maxR', 'from']) if (cfg[k] !== undefined) return cfg[k];
  return cfg.aroundBoss ? cfg.radius : Infinity;
}

/** Kierunek okrążania celu zależny od id (nie od slotu — slot faworyzował jedną drużynę). */
function strafeSign(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 3) % 2 === 0;
}
