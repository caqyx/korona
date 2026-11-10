/**
 * Chwilowe nakładki HUD-u: odliczanie, banery, panel śmierci, podpowiedź dla nowego gracza,
 * skrzynka bossa i ekrany trybów (fala / karty ulepszeń). Tylko rysowanie — stan czytany.
 */
import { BOSSES, RARITY, CASE, UPGRADES } from '../sim/config.js';
import { getMap } from '../sim/maps.js';
import { slotColor, CROWN } from './palette.js';
import { getBossSprite } from './sprites.js';
import { PANEL, PANEL_HI, EDGE, WHITE, RED, panel, text, textWidth, icon, wrap, dec1 } from './hudBase.js';
import { HUD_TOP_U, MODE_PANEL_X, MODE_PANEL_W_U, TEAMS_PANEL_U, upgradeCardRect, deathPanelRect } from './hudLayout.js';
import { isBenched } from './camera.js';
import { createFitCache } from './textFit.js';
import { LIFE_FLASH } from './fx.js';

/** Pamięć dopasowanych rozmiarów napisów; po doładowaniu fontu pomiary są nieaktualne. */
const fitCache = createFitCache();
if (typeof document !== 'undefined') document.fonts?.addEventListener?.('loadingdone', fitCache.clear);
/** Kontekst bieżącego pomiaru (żeby nie tworzyć domknięcia co klatkę). */
let fitCtx = /** @type {CanvasRenderingContext2D|null} */ (null);
const measureFit = (str, size) => textWidth(fitCtx, str, size);

/** Tekst w jednej linii, zmniejszany, aż zmieści się w `maxW` (nie mniej niż `minSize`). */
function fitText(ctx, str, x, y, maxW, size, minSize, color, align = 'left') {
  fitCtx = ctx;
  text(ctx, str, x, y, fitCache.fit(measureFit, str, size, minSize, maxW), color, align);
}

/* ---------- odliczanie ---------- */

const TEAM_NAME = ['Niebieska', 'Czerwona'];

/** Jednozdaniowy cel meczu pokazywany przy odliczaniu. */
function goalLine(view, me) {
  if (view.mode === 'teams') {
    if (!me) return 'Bitwa bossów';
    return me.boss ? `Jesteś bossem drużyny ${TEAM_NAME[me.team]} — przetrwaj!` : `Drużyna ${TEAM_NAME[me.team]}: chroń swojego bossa, pokonaj wrogiego`;
  }
  if (view.mode === 'survival') return 'Przetrwaj fale przeciwników!';
  if (view.mode === 'bossrush') return 'Pokonaj wszystkich bossów!';
  return 'Zdobądź koronę ze środka areny!';
}

let lastCount = -1;
/**
 * Odliczanie w panelu u góry ekranu (nie zasłania korony ani postaci): cyfra, cel meczu, mapa.
 * Gdy są już paski bossów (Bitwa bossów), panel schodzi pod nie.
 */
export function drawCountdown(ctx, cam, view, u, o) {
  const n = Math.ceil(view.countdown);
  if (n !== lastCount) {
    lastCount = n;
    o.sound?.('countdown');
  }
  const k = view.countdown % 1;
  const map = getMap(view.mapId);
  const me = view.players.find((p) => p.id === o.meIds[0]);
  const w = Math.min(440 * u, cam.w - 24);
  const h = 60 * u;
  const x = Math.round((cam.w - w) / 2);
  const y = (view.players.some((p) => p.boss) ? 102 : 36) * u;
  panel(ctx, x, y, w, h, PANEL, CROWN);
  text(ctx, String(n), x + 34 * u, y + 46 * u, Math.round((40 + k * 8) * u), CROWN, 'center');
  const tx = x + 68 * u;
  const tw = w - 76 * u;
  fitText(ctx, goalLine(view, me), tx, y + 19 * u, tw, 14 * u, 9 * u, WHITE);
  fitText(ctx, `Mapa: ${map.name}`, tx, y + 35 * u, tw, 11 * u, 8 * u, '#b9b6e0');
  fitText(ctx, map.desc, tx, y + 50 * u, tw, 10 * u, 7 * u, '#8f88b8');
}

/* ---------- banery ---------- */

/** Czas „wskoczenia” i zanikania banera (s). */
const BANNER_POP = 0.12;
const BANNER_FADE = 0.25;

/**
 * Baner w górnej części ekranu (pod paskiem bossa, nad środkiem walki). `dim` przyciemnia
 * cały ekran (koniec meczu).
 * @param {import('./fx.js').Banner|null} b
 */
export function drawBanner(ctx, cam, b, u) {
  if (!b) return;
  const age = b.max - b.life;
  const pop = Math.min(1, age / BANNER_POP);
  const fade = Math.min(1, b.life / BANNER_FADE);
  if (b.dim) {
    ctx.fillStyle = `rgba(4,4,10,${0.5 * pop})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  const cy = Math.round(Math.max((HUD_TOP_U + 52) * u, cam.h * 0.26));
  const top = cy - 26 * u;
  const hh = (b.sub ? 50 : 36) * u;
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  ctx.fillRect(0, top, cam.w, hh);
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, top, cam.w, 2);
  ctx.fillRect(0, top + hh - 2, cam.w, 2);
  fitText(ctx, b.text, cam.w / 2, cy, cam.w - 24, Math.round((24 + (1 - pop) * 8) * u), 12 * u, b.color, 'center');
  if (b.sub) fitText(ctx, b.sub, cam.w / 2, cy + 16 * u, cam.w - 24, 11 * u, 8 * u, WHITE, 'center');
  ctx.globalAlpha = 1;
}

/* ---------- śmierć i podpowiedzi ---------- */

/**
 * Panel śmierci jednego lokalnego gracza: wąski pasek na dole ekranu (nie zasłania walki, którą
 * martwy gracz ogląda) — „NIE ŻYJESZ” i licznik odrodzenia w jednym wierszu, niżej zabójca.
 */
export function drawDeathPanel(ctx, cam, me, o, u) {
  const killer = o.fx.killedBy[me.id];
  const { x, y, w, h } = deathPanelRect(cam.w, cam.h, !!killer);
  panel(ctx, x, y, w, h, PANEL, RED);
  text(ctx, 'NIE ŻYJESZ', x + 10 * u, y + 16 * u, 13 * u, RED);
  const wait = isBenched(me) ? 'wracasz po fali' : `odrodzenie za ${dec1(Math.max(0, me.respawnT))} s`;
  text(ctx, wait, x + w - 10 * u, y + 16 * u, 11 * u, WHITE, 'right');
  if (killer) fitText(ctx, `Pokonał cię: ${killer.name}`, x + w / 2, y + 31 * u, w - 16 * u, 10 * u, 8 * u, killer.color, 'center');
}

/** Pasek podpowiedzi (pierwszy mecz): na dole, na desktopie nad slotami umiejętności. */
export function drawHint(ctx, cam, str, o, u) {
  const size = 11 * u;
  const w = Math.min(cam.w - 24, textWidth(ctx, str, size) + 24 * u);
  const h = 20 * u;
  const x = Math.round((cam.w - w) / 2);
  const y = cam.h - (o.touch ? 30 : 76) * u;
  panel(ctx, x, y, w, h, PANEL, CROWN);
  fitText(ctx, str, cam.w / 2, y + 14 * u, w - 16 * u, size, 8 * u, WHITE, 'center');
}

/* ---------- skrzynka bossa ---------- */

let lastTickIdx = -1;
const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);

/** Losowanie bossa w stylu skrzynki CS2 — karty z portretami i kolorami rzadkości. */
export function drawCase(ctx, cam, view, time, sound, u) {
  const tr = view.transition;
  const total = tr.total || 3.2;
  const elapsed = total - tr.t;
  const p = view.players.find((x) => x.id === tr.newBossId);
  const strip = tr.strip || [tr.bossType];
  const cw = Math.round(Math.min(150, Math.max(92, cam.w / 7)));
  const ch = Math.round(cw * 0.95);
  const cx = Math.round(cam.w / 2);
  const top = Math.round(Math.max(110, cam.h * 0.3));
  const progress = Math.min(1, elapsed / CASE.spin);
  const pos = easeOutQuart(progress) * (tr.win + tr.offset) * cw;

  ctx.fillStyle = 'rgba(4,4,10,0.7)';
  ctx.fillRect(0, 0, cam.w, cam.h);
  text(ctx, `${p ? p.nick : '?'} otwiera skrzynkę bossa`, cx, top - 30, 20 * u, CROWN, 'center');
  ctx.fillStyle = '#0d0c18';
  ctx.fillRect(0, top - 8, cam.w, ch + 16);
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, top - 8, cam.w, 2);
  ctx.fillRect(0, top + ch + 6, cam.w, 2);
  const first = Math.max(0, Math.floor((pos - cx) / cw) - 1);
  const last = Math.min(strip.length - 1, Math.ceil((pos + cx) / cw) + 1);
  const done = progress >= 1;
  for (let i = first; i <= last; i++) {
    const x = cx + i * cw - pos;
    const def = BOSSES[strip[i]];
    const rar = RARITY[def.rarity] || RARITY.blue;
    const isWin = done && i === tr.win;
    ctx.globalAlpha = done && !isWin ? 0.3 : 1;
    panel(ctx, x + 3, top, cw - 6, ch, '#1a1930', isWin ? WHITE : '#2b2946');
    const grad = ctx.createLinearGradient(0, top, 0, top + ch);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, rar.color + '88');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.round(x + 5), top + 2, cw - 10, ch - 4);
    const spr = getBossSprite(strip[i], isWin ? 'cast' : 'idle', Math.floor(time * 6));
    const sc = Math.max(1, Math.floor(Math.min((ch * 0.78) / spr.h, (cw - 12) / spr.w)));
    ctx.drawImage(spr.img, Math.round(x + cw / 2 - (spr.w * sc) / 2), Math.round(top + 4), spr.w * sc, spr.h * sc);
    ctx.fillStyle = rar.color;
    ctx.fillRect(Math.round(x + 5), top + ch - 7, cw - 10, 5);
    text(ctx, def.name, x + cw / 2, top + ch - 13, Math.round(cw / 9), WHITE, 'center');
  }
  ctx.globalAlpha = 1;
  // znacznik
  ctx.fillStyle = CROWN;
  ctx.fillRect(cx - 1, top - 14, 3, ch + 28);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(cx - 6 + i, top - 18 + i, 13 - i * 2, 1);
    ctx.fillRect(cx - 6 + i, top + ch + 17 - i, 13 - i * 2, 1);
  }
  const idx = Math.floor(pos / cw);
  if (!done && idx !== lastTickIdx) {
    lastTickIdx = idx;
    sound?.('tick');
  }
  if (done) {
    if (lastTickIdx !== -2) {
      lastTickIdx = -2;
      sound?.('reveal');
    }
    const def = BOSSES[tr.bossType];
    const rar = RARITY[def.rarity] || RARITY.blue;
    const pop = Math.min(1, (elapsed - CASE.spin) * 6);
    text(ctx, def.name.toUpperCase(), cx, top + ch + 52 * u, Math.round((26 + pop * 10) * u), def.color, 'center');
    text(ctx, `★ ${rar.name}`, cx, top + ch + 72 * u, 12 * u, rar.color, 'center');
  } else if (lastTickIdx === -2) lastTickIdx = -1;
}

/* ---------- tryby z botami ---------- */

/** Ramka trybu: fala / boss X z Y, liczba wrogów. */
export function drawModeInfo(ctx, cam, view, o, u) {
  const md = view.modeData;
  if (!md) return;
  if (view.mode === 'teams') {
    // pod paskami bossów, chipami procentów i ich podpisem
    const T = TEAMS_PANEL_U;
    panel(ctx, MODE_PANEL_X, T.y * u, T.w * u, T.h * u);
    text(ctx, 'BITWA BOSSÓW', MODE_PANEL_X + 8, (T.y + 16) * u, 12 * u, CROWN);
    text(ctx, 'Chroń swojego bossa!', MODE_PANEL_X + 8, (T.y + 29) * u, 9 * u, '#b9b6e0');
    return;
  }
  const enemies = (md.queue?.length || 0) + (md.pending?.length || 0) + view.minions.length;
  const title = view.mode === 'survival' ? `FALA ${md.wave}` : `BOSS ${Math.min(md.total, md.defeated + 1)}/${md.total}`;
  const lives = view.mode === 'bossrush' && md.livesMax > 0 && Number.isFinite(md.lives);
  const sub = view.mode === 'survival' ? (md.stage === 'fight' ? `wrogów: ${enemies}${md.bossWave ? ' + BOSS' : ''}` : 'przerwa') : lives ? 'szanse' : `pokonani: ${md.defeated}`;
  const tx = MODE_PANEL_X + 8;
  panel(ctx, MODE_PANEL_X, 34 * u, MODE_PANEL_W_U * u, 34 * u);
  text(ctx, title, tx, 50 * u, 14 * u, CROWN);
  text(ctx, sub, tx, 63 * u, 10 * u, '#b9b6e0');
  if (lives) drawLives(ctx, tx + 40 * u, 53 * u, md.lives, md.livesMax, o.fx.lifeFlash, o.time, u);
}

/** Najwięcej ikon „drugich szans” w ramce trybu (więcej się nie mieści — reszta jako liczba). */
const LIVES_ICONS_MAX = 5;
/** Odstęp ikon (jednostki HUD) i częstotliwość migania właśnie straconej (1/s). */
const LIFE_STEP_U = 13;
const LIFE_BLINK_HZ = 8;

/**
 * Licznik „drugich szans” (Boss Rush): serce za każdą szansę z puli, stracone przygaszone;
 * przez `flash` sekund po utracie właśnie stracone serce miga.
 * @param {number} lives pozostałe @param {number} max pula na start @param {number} flash pozostały czas błysku (s)
 */
function drawLives(ctx, x, y, lives, max, flash, time, u) {
  const n = Math.min(max, LIVES_ICONS_MAX);
  for (let i = 0; i < n; i++) {
    const lost = i >= lives;
    const blink = lost && i === lives && flash > 0 && flash <= LIFE_FLASH && Math.floor(time * LIFE_BLINK_HZ) % 2 === 0;
    ctx.globalAlpha = blink ? 1 : lost ? 0.22 : 1;
    icon(ctx, 'heart', x + i * LIFE_STEP_U * u, y, u);
  }
  ctx.globalAlpha = 1;
  if (max > n) text(ctx, `${lives}/${max}`, x + n * LIFE_STEP_U * u + 2 * u, y + 10 * u, 10 * u, WHITE);
}

/** Jak wybrać kartę ulepszenia — zależnie od urządzenia jedynego lokalnego gracza. */
const PICK_HINT = {
  kbm: 'A / D — wybór · LPM zatwierdza',
  kb2: 'J / L — wybór · U zatwierdza',
  pad: 'gałka ← → — wybór · RT zatwierdza',
  touch: 'dotknij karty, by ją wybrać',
};
const PICK_HINT_SHARED = '← → wybór · ATAK zatwierdza';

/** Przerwa (karty ulepszeń) i zapowiedź fali/bossa. */
export function drawModeStage(ctx, cam, view, o, u) {
  const md = view.modeData;
  if (!md) return;
  if (md.stage === 'pre') {
    const label = view.mode === 'survival' ? `FALA ${md.wave + 1}` : `BOSS ${md.defeated + 1}/${md.total}`;
    text(ctx, label, cam.w / 2, cam.h * 0.4, 40 * u, CROWN, 'center');
    text(ctx, view.mode === 'survival' && (md.wave + 1) % 5 === 0 ? 'Nadchodzi boss!' : 'Przygotuj się…', cam.w / 2, cam.h * 0.4 + 28 * u, 14 * u, WHITE, 'center');
    return;
  }
  if (md.stage !== 'intermission' || !view.offers) return;
  ctx.fillStyle = 'rgba(4,4,10,0.6)';
  ctx.fillRect(0, 0, cam.w, cam.h);
  const humans = o.meIds.filter((id) => view.offers[id]);
  const rows = humans.length ? humans : Object.keys(view.offers).slice(0, 1);
  const how = (humans.length === 1 && PICK_HINT[o.device]) || PICK_HINT_SHARED;
  text(ctx, 'WYBIERZ ULEPSZENIE', cam.w / 2, 104 * u, 22 * u, CROWN, 'center');
  text(ctx, `${how} · ${Math.ceil(Math.max(0, md.t))} s`, cam.w / 2, 122 * u, 11 * u, '#b9b6e0', 'center');
  rows.forEach((id, r) => drawOfferRow(ctx, cam, view, id, r, rows.length > 1, u));
}

/** Jeden wiersz kart ulepszeń (oferta gracza `id`). */
function drawOfferRow(ctx, cam, view, id, row, showNick, u) {
  const off = view.offers[id];
  const p = view.players.find((x) => x.id === id);
  if (showNick) {
    const first = upgradeCardRect(cam.w, cam.h, 0, row);
    text(ctx, p?.nick ?? '', first.x - 4, first.y - 6, 11 * u, p ? slotColor(p.slot) : WHITE);
  }
  off.choices.forEach((upg, i) => {
    const { x, y, w, h } = upgradeCardRect(cam.w, cam.h, i, row);
    const sel = off.picked === null ? i === off.sel : off.picked === upg;
    ctx.globalAlpha = off.picked !== null && off.picked !== upg ? 0.35 : 1;
    panel(ctx, x, y, w, h, sel ? PANEL_HI : PANEL, sel ? CROWN : EDGE);
    icon(ctx, `upg:${upg}`, x + 10, y + 10, 2 * u);
    text(ctx, UPGRADES[upg].name, x + 14 + 24 * u, y + 24 * u, 13 * u, sel ? CROWN : WHITE);
    wrap(ctx, UPGRADES[upg].desc, x + 10, y + 48 * u, w - 20, 11 * u, '#d6cbea');
    if (off.picked === upg) text(ctx, '✓ WYBRANO', x + w / 2, y + h - 10, 11 * u, '#5ce07a', 'center');
    ctx.globalAlpha = 1;
  });
}
