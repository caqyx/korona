/**
 * Wskaźniki krawędziowe (kamera „follow”): znacznik z koroną na brzegu ekranu, gdy boss albo
 * korona leżąca na środku są poza kadrem, oraz czerwony „!” dla najbliższego telegrafu spoza
 * kadru, który sięga gracza. Rysowane w pełnej rozdzielczości, przed HUD-em; nigdy na panelach
 * HUD ani na przyciskach dotykowych (geometria z hudLayout.js). Stan gry tylko czytają.
 */
import { BOSSES, HERO } from '../sim/config.js';
import { zoneContains } from '../sim/zones.js';
import { worldToScreen } from './camera.js';
import { CROWN, TELEGRAPH, TEAM_COLORS } from './palette.js';
import { PANEL, WHITE, panel, icon } from './hudBase.js';
import { hudScale, HUD_CHIPS_U, FEED_TOP_U, FEED_LINE_U, FEED_W_U, MODE_PANEL_X, TEAMS_PANEL_U, touchClusterRect, touchButtonPx, skillSlotsRect, deathPanelRect } from './hudLayout.js';
import { isOutside, placeBadge, dir8 } from './edgeGeometry.js';

/** Bok znacznika (jednostki HUD). */
const BADGE_U = 22;
/** Grot: liczba schodków, bok schodka i odstęp od znacznika (jednostki HUD). */
const ARROW_STEPS = 4;
const ARROW_PX_U = 2;
const ARROW_GAP_U = 2;
/** Odstęp czubka grota od krawędzi ekranu / pasa HUD (jednostki HUD). */
const EDGE_PAD_U = 4;
/** Środek znacznika nie zbliża się do krawędzi bardziej niż na tyle (mieści się znacznik z grotem). */
const HALF_U = BADGE_U / 2 + ARROW_GAP_U + ARROW_STEPS * ARROW_PX_U + EDGE_PAD_U;
/**
 * O ile pikseli sztuki punkt celu musi wyjść za boczną / dolną krawędź ekranu, żeby uznać go za
 * niewidoczny (boss jest duży — z nogami tuż za krawędzią nadal go widać). Pod górnym pasem HUD
 * cel jest zasłonięty od razu.
 */
const HIDE_ART = Object.freeze({ boss: 30, crown: 8, zone: 0 });
/** Odstęp znacznika od wykluczonych paneli (jednostki HUD). */
const EXCL_PAD_U = BADGE_U / 2 + 6;
/** Dodatkowy promień (m) przy sprawdzaniu, czy telegraf sięga gracza. */
const REACH_PAD_M = 0.6;
/** Podpowiedź joysticka (lewy dolny róg na dotyku): bok w rozmiarach przycisku i stały zapas (px). */
const JOY_HINT_TB = 1.7;
const JOY_HINT_PAD = 40;
/** Miganie znacznika zagrożenia (1/s). */
const DANGER_BLINK_HZ = 8;
const DANGER_FILL = '#4a0f1e';

/** Robocze prostokąty wykluczeń i bufory wyników (bez alokacji co klatkę). */
const EXCL_MAX = 5;
const excl = Array.from({ length: EXCL_MAX }, () => ({ x: 0, y: 0, w: 0, h: 0 }));
const safe = { l: 0, t: 0, r: 0, b: 0 };
/** Widoczna część ekranu (pod górnym pasem HUD) — powiększana o zapas celu w `hidden`. */
const seen = { l: 0, t: 0, r: 0, b: 0 };
const pos = { x: 0, y: 0 };
const dir = { x: 0, y: 0 };

/** Kopiuje prostokąt do roboczej tablicy wykluczeń. @returns {number} nowa liczba wykluczeń */
function exclude(n, x, y, w, h) {
  const r = excl[n];
  r.x = x;
  r.y = y;
  r.w = w;
  r.h = h;
  return n + 1;
}

/** Wykluczenie na kill feed, jeśli jego wpisy schodzą poniżej górnego pasa HUD. */
function excludeFeed(n, cam, lines, u) {
  const bottom = (FEED_TOP_U + (lines - 1) * FEED_LINE_U + 6) * u;
  const top = HUD_CHIPS_U * u;
  return lines > 0 && bottom > top ? exclude(n, cam.w - FEED_W_U * u, top, FEED_W_U * u, bottom - top) : n;
}

/**
 * Ustawia bezpieczny prostokąt i wykluczenia dla bieżącego układu HUD.
 * @param {any} cam @param {any} view @param {any} me lokalny gracz @param {any} o opcje rysowania @param {number} u
 * @returns {number} liczba wykluczeń
 */
function layout(cam, view, me, o, u) {
  const half = HALF_U * u;
  safe.l = half;
  safe.r = cam.w - half;
  safe.t = HUD_CHIPS_U * u + half;
  safe.b = cam.h - half;
  let n = 0;
  if (o.touch) {
    const c = touchClusterRect(cam.w, cam.h);
    n = exclude(n, c.x, c.y, c.w, c.h);
    const joy = touchButtonPx(cam.w, cam.h) * JOY_HINT_TB + JOY_HINT_PAD;
    n = exclude(n, 0, cam.h - joy, joy, joy);
  } else {
    const s = skillSlotsRect(cam.w, cam.h);
    n = exclude(n, s.x, s.y, s.w, s.h);
  }
  n = excludeFeed(n, cam, o.fx.feed.length, u);
  if (view.mode === 'teams') n = exclude(n, MODE_PANEL_X, TEAMS_PANEL_U.y * u, TEAMS_PANEL_U.w * u, TEAMS_PANEL_U.h * u);
  if (!me.alive) {
    const d = deathPanelRect(cam.w, cam.h, !!o.fx.killedBy[me.id]);
    n = exclude(n, d.x, d.y, d.w, d.h);
  }
  return n;
}

/**
 * Schodkowy grot (same prostokąty — bez wygładzania) po stronie znacznika zwróconej do celu.
 * Na wprost: trójkąt z coraz szerszych pasków; po skosie: narożnik z czubkiem w rogu.
 */
function arrowHead(ctx, x, y, dx, dy, u, color) {
  const d = dir8(dx, dy, dir);
  if (!d.x && !d.y) return;
  const px = ARROW_PX_U * u;
  const reach = (BADGE_U / 2 + ARROW_GAP_U) * u;
  ctx.fillStyle = color;
  if (d.x && d.y) {
    // czubek w narożniku kwadratu ARROW_STEPS × ARROW_STEPS przylegającego do rogu znacznika
    const tipX = x + d.x * (reach + (ARROW_STEPS - 1) * px);
    const tipY = y + d.y * (reach + (ARROW_STEPS - 1) * px);
    for (let i = 0; i < ARROW_STEPS; i++) {
      const len = (ARROW_STEPS - i) * px;
      ctx.fillRect(Math.round(d.x > 0 ? tipX + px - len : tipX - px), Math.round(d.y > 0 ? tipY - i * px : tipY - px + i * px), len, px);
    }
    return;
  }
  for (let i = 0; i < ARROW_STEPS; i++) {
    // warstwa i licząc od czubka: coraz szersza
    const off = reach + (ARROW_STEPS - 1 - i) * px;
    const span = (i * 2 + 1) * px;
    const cx = x + d.x * off + (d.x < 0 ? -px : 0);
    const cy = y + d.y * off + (d.y < 0 ? -px : 0);
    if (d.x) ctx.fillRect(Math.round(cx), Math.round(y - span / 2), px, span);
    else ctx.fillRect(Math.round(x - span / 2), Math.round(cy), span, px);
  }
}

/** Znacznik z ikoną korony i grotem w stronę celu. */
function badge(ctx, sx, sy, n, u, color) {
  placeBadge(safe, excl, n, sx, sy, EXCL_PAD_U * u, pos);
  const s = BADGE_U * u;
  panel(ctx, pos.x - s / 2, pos.y - s / 2, s, s, PANEL, color);
  icon(ctx, 'crown', pos.x - 6 * u, pos.y - 6 * u, u);
  arrowHead(ctx, pos.x, pos.y, sx - pos.x, sy - pos.y, u, color);
}

/** Czerwony, migający znacznik „!” z grotem: nadciąga atak spoza kadru. */
function dangerBadge(ctx, sx, sy, n, u, time) {
  placeBadge(safe, excl, n, sx, sy, EXCL_PAD_U * u, pos);
  const s = BADGE_U * u;
  const on = Math.floor(time * DANGER_BLINK_HZ) % 2 === 0;
  panel(ctx, pos.x - s / 2, pos.y - s / 2, s, s, on ? DANGER_FILL : PANEL, TELEGRAPH);
  ctx.fillStyle = on ? WHITE : TELEGRAPH;
  ctx.fillRect(Math.round(pos.x - 1.5 * u), Math.round(pos.y - 7 * u), 3 * u, 8 * u);
  ctx.fillRect(Math.round(pos.x - 1.5 * u), Math.round(pos.y + 3 * u), 3 * u, 3 * u);
  arrowHead(ctx, pos.x, pos.y, sx - pos.x, sy - pos.y, u, TELEGRAPH);
}

/**
 * Czy cel o współrzędnych ekranu `(sx, sy)` jest niewidoczny: poza ekranem o więcej niż `art`
 * pikseli sztuki albo pod górnym pasem HUD.
 */
function hidden(cam, sx, sy, art, u) {
  const m = art * cam.S;
  seen.l = -m;
  seen.r = cam.w + m;
  seen.t = HUD_CHIPS_U * u;
  seen.b = cam.h + m;
  return isOutside(seen, sx, sy);
}

/** Najbliższy telegraf bossa, którego źródło jest poza kadrem, a pole obejmuje gracza. */
function offscreenThreat(cam, view, me, u) {
  let best = null;
  let bestD = Infinity;
  for (const z of view.zones) {
    if (z.team === 'hero' || !(z.warn > 0) || !(z.dmg > 0 || z.slow > 0 || z.knock > 0)) continue;
    if (!zoneContains(z, me.x, me.y, HERO.radius + REACH_PAD_M)) continue;
    const [sx, sy] = worldToScreen(cam, z.x, z.y);
    if (!hidden(cam, sx, sy, HIDE_ART.zone, u)) continue;
    const d = Math.hypot(z.x - me.x, z.y - me.y);
    if (d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}

/** Kolor znacznika bossa: w drużynach kolor drużyny, inaczej kolor typu bossa. */
const bossColor = (p) => (p.team !== undefined ? TEAM_COLORS[p.team] : BOSSES[p.boss.type]?.color) ?? CROWN;

/** Znaczniki bossów i leżącej korony, które są poza kadrem (albo pod górnym pasem HUD). */
function drawTargets(ctx, cam, view, me, n, u) {
  for (const p of view.players) {
    if (!p.boss || !p.alive || p.id === me.id || p.boss.invisT > 0) continue;
    const [sx, sy] = worldToScreen(cam, p.x, p.y);
    if (hidden(cam, sx, sy, HIDE_ART.boss, u)) badge(ctx, sx, sy, n, u, bossColor(p));
  }
  if (view.crown.state !== 'center' || (view.mode && view.mode !== 'crown')) return;
  const [sx, sy] = worldToScreen(cam, view.crown.x, view.crown.y);
  if (hidden(cam, sx, sy, HIDE_ART.crown, u)) badge(ctx, sx, sy, n, u, CROWN);
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {any} cam @param {any} view
 * @param {{meIds:string[], fx:any, touch?:boolean, time:number}} o
 */
export function drawEdgeIndicators(ctx, cam, view, o) {
  if (cam.mode !== 'follow' || o.meIds.length !== 1 || view.phase === 'transition' || view.phase === 'ended') return;
  const me = view.players.find((p) => p.id === o.meIds[0]);
  if (!me) return;
  const u = hudScale(cam.w, cam.h);
  const n = layout(cam, view, me, o, u);
  drawTargets(ctx, cam, view, me, n, u);
  if (!me.alive || me.boss) return;
  const z = offscreenThreat(cam, view, me, u);
  if (!z) return;
  const [sx, sy] = worldToScreen(cam, z.x, z.y);
  dangerBadge(ctx, sx, sy, n, u, o.time);
}
