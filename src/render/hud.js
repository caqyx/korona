/**
 * HUD w pełnej rozdzielczości, w stylu pixel art (font Pixelify Sans, ramki „schodkowe”,
 * ikony ze sprites.js powiększane bez wygładzania). Tu: stałe panele (wyniki, pasek bossa,
 * wyścig obrażeń, zegar, kill feed, cooldowny); nakładki chwilowe są w hudOverlays.js.
 */
import { BOSSES, BOSS_COMMON, SKINS, HERO, RARITY, SCORE } from '../sim/config.js';
import { slotColor, CROWN, TEAM_COLORS } from './palette.js';
import { bossKillValue } from '../sim/rules.js';
import { feverMultiplier } from '../sim/combat.js';
import { getBossSprite, getHeroSprite } from './sprites.js';
import { PANEL, PANEL_HI, EDGE, WHITE, RED, panel, text, icon, dec1 } from './hudBase.js';
import { hudScale, TOUCH_PAUSE_PX, MODE_PANEL_X, MODE_PANEL_W_U, FEED_TOP_U, FEED_LINE_U, SLOT_U, SLOT_GAP_U, SLOT_X_U, SLOT_BOTTOM_U } from './hudLayout.js';
import { pointsLabel } from './hudText.js';
import { isBenched, worldToScreen } from './camera.js';
import { CHIP_FLASH, CD_FLASH } from './fx.js';
import { TICK_LAST_S } from './feedback.js';
import { drawCountdown, drawBanner, drawDeathPanel, drawHint, drawCase, drawModeInfo, drawModeStage } from './hudOverlays.js';

/** Miejsce po każdej stronie pasków dwóch bossów: zegar z marginesami (jednostki HUD). */
const TIMER_SIDE_U = 70;
/** Szerokość portretu bossa po lewej stronie paska (jednostki HUD). */
const BOSS_PORTRAIT_U = 34;
/** Ile chipów obrażeń mieści się pod paskiem bossa. */
const MAX_DAMAGE_CHIPS = 6;
/** Od jakiej części celu punktowego chip wyniku pulsuje („piłka meczowa”). */
const MATCH_POINT = 0.9;
/** Ostatnie sekundy meczu, w których zegar pulsuje. */
const TIMER_WARN_S = 30;
/** Odnowienia krótsze niż tyle sekund nie pokazują liczby (zwykły atak tylko by migał). */
const CD_NUMBER_MIN_S = 1;

/** @param {any} o */
export function drawHud(ctx, cam, view, o) {
  const u = hudScale(cam.w, cam.h);
  ctx.imageSmoothingEnabled = false;
  const me = view.players.find((p) => p.id === o.meIds[0]);
  const solo = o.meIds.length === 1 ? me : null;
  if (me && me.alive && !me.boss && me.hp === 1) lowHpVignette(ctx, cam, o.time);
  if (o.fx.redFlash > 0) {
    ctx.fillStyle = `rgba(255,40,72,${o.fx.redFlash * 0.6})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  // na dotyku prawy górny róg zajmuje przycisk pauzy — wyniki i zegar ustępują mu miejsca
  const inset = o.touch ? TOUCH_PAUSE_PX : 0;
  const modal = view.mode && view.mode !== 'crown';
  drawScores(ctx, cam, view, o, u, inset);
  drawBossBar(ctx, cam, view, o, solo, u, inset);
  drawTimer(ctx, cam, view, o.time, u, inset);
  if (modal) drawModeInfo(ctx, cam, view, o, u);
  drawFeed(ctx, cam, o.fx, u);
  drawAllCooldowns(ctx, cam, view, o, me, u);
  const playing = view.phase === 'playing';
  if (solo && !solo.alive && playing) drawDeathPanel(ctx, cam, solo, o, u);
  else if (o.hint && playing) drawHint(ctx, cam, o.hint, o, u);
  if (view.phase === 'countdown') drawCountdown(ctx, cam, view, u, o);
  if (modal && playing) drawModeStage(ctx, cam, view, o, u);
  drawBanner(ctx, cam, o.fx.banner, u);
  if (view.phase === 'transition' && view.transition) drawCase(ctx, cam, view, o.time, o.sound, u);
  if (o.overlay) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, cam.w, cam.h);
    text(ctx, o.overlay, cam.w / 2, cam.h * 0.5, 34 * u, WHITE, 'center');
  }
}

function lowHpVignette(ctx, cam, time) {
  const a = 0.25 + Math.sin(time * 6) * 0.1;
  const g = ctx.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.35, cam.w / 2, cam.h / 2, Math.max(cam.w, cam.h) * 0.7);
  g.addColorStop(0, 'rgba(255,0,40,0)');
  g.addColorStop(1, `rgba(255,0,40,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cam.w, cam.h);
}

/** Kolor ramki chipu wyniku: piłka meczowa pulsuje, własny chip jest biały, potem drużyna / korona. */
function scoreEdge(view, p, own, time) {
  const crownMode = !view.mode || view.mode === 'crown';
  if (crownMode && !p.dnf && p.score >= view.targetScore * MATCH_POINT && Math.floor(time * 4) % 2) return RED;
  if (own) return WHITE;
  if (p.team !== undefined) return TEAM_COLORS[p.team] ?? EDGE;
  return p.boss ? CROWN : EDGE;
}

/** Górny pasek wyników; `inset` = miejsce zostawione po bokach (przycisk pauzy na dotyku). */
function drawScores(ctx, cam, view, o, u, inset) {
  const list = view.players.filter((p) => !p.ai).sort((a, b) => b.score - a.score);
  const h = 26 * u;
  const w = Math.min(132 * u, (cam.w - 16 - inset * 2) / Math.max(1, list.length));
  let x = (cam.w - w * list.length) / 2;
  for (const p of list) {
    const c = slotColor(p.slot);
    const own = o.meIds.includes(p.id);
    panel(ctx, x + 1, 4, w - 2, h, own ? PANEL_HI : PANEL, scoreEdge(view, p, own, o.time));
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + 4), 7, 3 * u, h - 6);
    const pct = Math.min(1, p.score / view.targetScore);
    ctx.fillStyle = '#1e1c33';
    ctx.fillRect(Math.round(x + 6 + 3 * u), 4 + h - 6 * u, Math.round(w - 14 - 3 * u), 3 * u);
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + 6 + 3 * u), 4 + h - 6 * u, Math.round((w - 14 - 3 * u) * pct), 3 * u);
    const lx = x + 8 + 3 * u;
    if (p.boss) icon(ctx, 'crown', lx, 7, u);
    const name = (p.dnf ? '✕ ' : '') + p.nick;
    text(ctx, name.slice(0, 11), lx + (p.boss ? 14 * u : 0), 4 + h * 0.55, 11 * u, p.dnf ? '#777' : WHITE);
    text(ctx, String(p.score), x + w - 8, 4 + h * 0.55, 12 * u, CROWN, 'right');
    if (own) {
      // znacznik „to ty”: biały ząbek pod chipem
      ctx.fillStyle = WHITE;
      ctx.fillRect(Math.round(x + w / 2 - 4 * u), 4 + h, 8 * u, 2 * u);
    }
    const flash = o.fx.chipFlash[p.id];
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash / CHIP_FLASH) * 0.65})`;
      ctx.fillRect(Math.round(x + 3), 6, Math.round(w - 6), h - 4);
    }
    x += w;
  }
}

function drawBossBar(ctx, cam, view, o, solo, u, inset) {
  const bosses = view.players.filter((p) => p.boss);
  if (!bosses.length) return;
  const n = bosses.length;
  // >1 boss: zostaw miejsce na zegar; Przetrwanie / Boss Rush: pasek nie wchodzi pod ramkę trybu po lewej
  const framed = view.mode === 'survival' || view.mode === 'bossrush';
  const room = framed ? cam.w - 2 * (MODE_PANEL_X + (MODE_PANEL_W_U + 6 + BOSS_PORTRAIT_U) * u) : Infinity;
  const total = Math.min(460 * u * (n > 1 ? 1.6 : 1), n > 1 ? cam.w - 2 * (TIMER_SIDE_U * u + inset) : cam.w * 0.62, room);
  const gap = 46 * u;
  const w = (total - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = (cam.w - total) / 2 + i * (w + gap) + BOSS_PORTRAIT_U * u * (n > 1 ? 0.5 : 0);
    drawOneBossBar(ctx, cam, view, bosses[i], x, 36 * u, w - (n > 1 ? 17 * u : 0), o, solo, u);
  }
}

/** Zasięg postaci na ekranie względem punktu stóp (piksele sztuki): pół szerokości, w górę (z paskiem/nickiem), w dół. */
const HERO_BOX = { hw: 9, up: 28, down: 5 };
const BOSS_BOX = { hw: 22, up: 64, down: 14 };
/** Krycie chipów obrażeń, gdy stoi pod nimi postać (chipy są wtórne wobec walki). */
const CHIPS_FADED = 0.28;

/** Czy jakaś żywa postać jest na ekranie pod prostokątem HUD-u (wtedy panel robi się półprzezroczysty). */
function actionUnder(cam, view, x, y, w, h) {
  for (const p of view.players) {
    if (!p.alive || !p.connected) continue;
    const box = p.boss ? BOSS_BOX : HERO_BOX;
    const [sx, sy] = worldToScreen(cam, p.x, p.y);
    if (sx + box.hw * cam.S > x && sx - box.hw * cam.S < x + w && sy + box.down * cam.S > y && sy - box.up * cam.S < y + h) return true;
  }
  return false;
}

function drawOneBossBar(ctx, cam, view, b, x, y, w, o, solo, u) {
  const time = o.time;
  const def = BOSSES[b.boss.type];
  const rar = RARITY[def.rarity] || RARITY.blue;
  const pct = Math.max(0, b.boss.hp / b.boss.maxHp);
  const low = pct <= BOSS_COMMON.lowHpPulse;
  const edge = TEAM_COLORS[b.team] ?? rar.color;
  panel(ctx, x - 34 * u, y - 2, w + 36 * u, 26 * u, PANEL, edge);
  const spr = getBossSprite(b.boss.type, 'idle', Math.floor(time * 5));
  const ps = (22 * u) / Math.max(spr.w, spr.h);
  ctx.drawImage(spr.img, Math.round(x - 31 * u), Math.round(y + 1), Math.round(spr.w * ps), Math.round(spr.h * ps));
  ctx.fillStyle = '#1e1c33';
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round(w - 6), 8 * u);
  ctx.fillStyle = low && Math.floor(time * 12) % 2 ? WHITE : def.color;
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round((w - 6) * pct), 8 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round((w - 6) * pct), 2 * u);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 1; i < 10; i++) ctx.fillRect(Math.round(x + ((w - 6) * i) / 10), y + 12 * u, 1, 8 * u);
  text(ctx, `${def.name} — ${b.nick}`, x, y + 9 * u, 10 * u, WHITE);
  text(ctx, `${Math.ceil(b.boss.hp)}/${b.boss.maxHp}`, x + w - 8, y + 9 * u, 10 * u, WHITE, 'right');
  const left = x - 34 * u;
  const full = w + 36 * u;
  const chips = damageChips(view, b, solo);
  // wyścig obrażeń ustępuje akcji: postać pod chipami (górna krawędź areny) — chipy bledną
  if (actionUnder(cam, view, left, y + 28 * u, Math.min(full, Math.max(1, chips.length) * CHIP_W_MAX * u), (CHIP_H + 14) * u)) ctx.globalAlpha = CHIPS_FADED;
  drawDamageChips(ctx, chips, b, solo, left, y + 28 * u, full, u);
  const capY = y + 28 * u + CHIP_H * u + 11 * u;
  const caption = raceCaption(view, b, chips, solo);
  if (caption) text(ctx, caption.text, left + 2 * u, capY, 10 * u, caption.color);
  const fever = feverMultiplier(b.boss.reign);
  if (fever > 1 && b.team === undefined) text(ctx, `GORĄCZKA +${Math.round((fever - 1) * 100)}%`, left + full - 2 * u, capY, 10 * u, Math.floor(time * 4) % 2 ? '#ff8a3d' : CROWN, 'right');
  ctx.globalAlpha = 1;
}

/** Wysokość chipu obrażeń (jednostki HUD) — tekst + pasek udziału — i jego największa szerokość. */
const CHIP_H = 18;
const CHIP_W_MAX = 110;

/** Udział gracza w HP bossa w procentach (jak w zdarzeniu `lastHit`). */
const sharePct = (p, b) => Math.round(((p.dmgToBoss ?? 0) / Math.max(1, b.boss.maxHp)) * 100);

/** Czy `p` ściga się o koronę bossa `b` (bohater-człowiek spoza drużyny bossa). */
const isRival = (p, b) => !p.boss && !p.ai && (b.team === undefined || p.team !== b.team);
const byDamage = (p, q) => q.dmgToBoss - p.dmgToBoss;
/** Robocza lista chipów — jedna, używana od razu po zbudowaniu (bez alokacji co klatkę). */
const chipList = /** @type {any[]} */ ([]);

/**
 * Gracze pokazani w wyścigu obrażeń: najlepsi w tym panowaniu, a lokalny gracz zawsze
 * (jeśli nie mieści się w czołówce, zajmuje ostatnie miejsce listy). Pierwszy = lider.
 * Zwraca współdzieloną tablicę — ważną do następnego wywołania.
 * @param {any} view @param {any} b boss @param {any} solo lokalny gracz (albo null)
 */
function damageChips(view, b, solo) {
  const mine = solo && isRival(solo, b) ? solo : null;
  chipList.length = 0;
  for (const p of view.players) if (isRival(p, b) && (p.dmgToBoss > 0 || p === mine)) chipList.push(p);
  chipList.sort(byDamage);
  if (chipList.length > MAX_DAMAGE_CHIPS) {
    const cut = mine && chipList.indexOf(mine) >= MAX_DAMAGE_CHIPS;
    chipList.length = MAX_DAMAGE_CHIPS;
    if (cut) chipList[MAX_DAMAGE_CHIPS - 1] = mine;
  }
  return chipList;
}

/**
 * Procent obrażeń zadanych bossowi w tym panowaniu (kto ile % maks. HP). Lider — korona:
 * to on przejmie koronę, gdy boss padnie. Własny chip ma białą ramkę; część przeniesiona
 * z poprzedniego panowania (`claim0`) to ciemniejszy odcinek paska i znaczek „↺”.
 */
function drawDamageChips(ctx, chips, b, solo, x, y, w, u) {
  if (!chips.length) return;
  const chipW = Math.min(CHIP_W_MAX * u, w / chips.length);
  for (let i = 0; i < chips.length; i++) {
    const p = chips[i];
    const cx = x + i * chipW;
    const lead = i === 0 && p.dmgToBoss > 0;
    const own = p === solo;
    const c = slotColor(p.slot);
    panel(ctx, cx + 1, y, chipW - 2, CHIP_H * u, lead || own ? PANEL_HI : PANEL, own ? WHITE : lead ? CROWN : EDGE);
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + 4), Math.round(y + 3 * u), 3 * u, 8 * u);
    const crowned = lead && b.team === undefined;
    if (crowned) icon(ctx, 'crown', cx + 6 + 3 * u, y + 1, u);
    text(ctx, p.nick.slice(0, 8), cx + 8 + 3 * u + (crowned ? 13 * u : 0), y + 11 * u, 9 * u, WHITE);
    text(ctx, `${sharePct(p, b)}%`, cx + chipW - 6, y + 11 * u, 10 * u, lead ? CROWN : '#cfd3ff', 'right');
    drawShareStrip(ctx, p, b, c, cx + 5, y + 13 * u, chipW - 10, u);
  }
}

/** Pasek udziału w chipie: całość = obrażenia gracza / HP bossa, ciemniejszy początek = przeniesione. */
function drawShareStrip(ctx, p, b, color, x, y, w, u) {
  const max = Math.max(1, b.boss.maxHp);
  const dmg = Math.min(max, p.dmgToBoss ?? 0);
  const carried = Math.min(dmg, p.claim0 ?? 0);
  ctx.fillStyle = '#1e1c33';
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 2 * u);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round((w * dmg) / max), 2 * u);
  if (carried <= 0) return;
  ctx.fillStyle = 'rgba(8,8,16,0.6)';
  ctx.fillRect(Math.round(x), Math.round(y), Math.round((w * carried) / max), 2 * u);
  carryGlyph(ctx, Math.round(x + w - 30 * u), Math.round(y - 9 * u), u);
}

/** Znaczek „↺” (5×5 pikseli HUD): obrażenia przeniesione z poprzedniego panowania. */
const CARRY_GLYPH = ['.###.', '#...#', '#....', '#..#.', '.###.'];
function carryGlyph(ctx, x, y, u) {
  ctx.fillStyle = '#9b8fbd';
  CARRY_GLYPH.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i * u, y + j * u, u, u);
  });
}

/** Rodzaje podpisu pod chipami. */
const CAP_BOSS = 0;
const CAP_LEAD = 1;
const CAP_BEHIND = 2;
/** Ostatnio zbudowany podpis: tekst powstaje od nowa tylko, gdy zmienią się liczby (nie co klatkę). */
const cap = { kind: -1, a: NaN, b: NaN, text: '', color: '' };

/** Tekst podpisu: `a` = wartość zabójstwa (boss) albo różnica w % (wyścig), `b` = % przeniesione. */
function captionText(kind, a, b) {
  if (kind === CAP_BOSS) return `Jako boss: +${SCORE.perCrownSecond} pkt co ${SCORE.crownInterval} s · ${pointsLabel(a)} za pokonanego bohatera`;
  const note = b > 0 ? ` · w tym ${b}% przeniesione z poprzedniej walki` : '';
  return kind === CAP_LEAD ? `Prowadzisz: +${a}%${note}` : `Do lidera: −${a}%${note}`;
}

/** @returns {{text:string,color:string}} współdzielony obiekt podpisu */
function caption(kind, a, b) {
  if (cap.kind !== kind || cap.a !== a || cap.b !== b) {
    cap.kind = kind;
    cap.a = a;
    cap.b = b;
    cap.text = captionText(kind, a, b);
    cap.color = kind === CAP_BEHIND ? '#cfd3ff' : CROWN;
  }
  return cap;
}

/**
 * Podpis pod chipami dla lokalnego gracza: przewaga lidera / strata do lidera, a dla bossa —
 * za co dostaje punkty. Tylko tryb korony (tam obrażenia decydują o koronie).
 * @returns {{text:string,color:string}|null}
 */
function raceCaption(view, b, chips, solo) {
  if (!solo || (view.mode && view.mode !== 'crown')) return null;
  // wartość zabójstwa zależy od liczby bohaterów w meczu — bierzemy ją z symulacji, nie ze stałej
  if (solo === b) return caption(CAP_BOSS, bossKillValue(view), 0);
  if (solo.boss || !chips.length || !(chips[0].dmgToBoss > 0)) return null;
  const mine = sharePct(solo, b);
  const carried = Math.round((Math.min(solo.dmgToBoss ?? 0, solo.claim0 ?? 0) / Math.max(1, b.boss.maxHp)) * 100);
  if (chips[0] === solo) return caption(CAP_LEAD, mine - (chips[1] ? sharePct(chips[1], b) : 0), carried);
  return caption(CAP_BEHIND, sharePct(chips[0], b) - mine, carried);
}

/** Zegar: w trybie korony czas do końca; ostatnie 30 s pulsuje, ostatnie 10 s — szybciej i większy. */
function drawTimer(ctx, cam, view, time, u, inset) {
  const modal = view.mode && view.mode !== 'crown';
  const left = modal ? view.matchTime : Math.max(0, view.timeLimit - view.matchTime);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  const warn = !modal && left < TIMER_WARN_S && view.phase !== 'countdown';
  const last = warn && left <= TICK_LAST_S;
  const on = warn && Math.floor(time * (last ? 4 : 2)) % 2 === 0;
  const x = cam.w - 64 * u - inset;
  panel(ctx, x, 34 * u, 56 * u, 20 * u, on ? '#4a0f1e' : PANEL, on ? RED : EDGE);
  text(ctx, `${m}:${String(s).padStart(2, '0')}`, x + 28 * u, 48 * u + (last ? u : 0), (last ? 15 : 13) * u, warn ? RED : '#cfd3ff', 'center');
}

function drawFeed(ctx, cam, fx, u) {
  let y = FEED_TOP_U * u;
  for (const f of fx.feed) {
    ctx.globalAlpha = Math.min(1, f.life);
    text(ctx, f.text, cam.w - 10, y, 11 * u, f.color, 'right');
    y += FEED_LINE_U * u;
  }
  ctx.globalAlpha = 1;
}

/** Cooldowny: na dotyku pokazują je same przyciski; jeden gracz — duże sloty; wspólny ekran — rząd małych. */
function drawAllCooldowns(ctx, cam, view, o, me, u) {
  if (o.touch) return;
  if (o.mode === 'online' || o.meIds.length === 1) {
    if (me) drawCooldowns(ctx, o.fx, me, SLOT_X_U * u, cam.h - SLOT_BOTTOM_U * u, u, true);
    return;
  }
  o.meIds.forEach((id, i) => {
    const p = view.players.find((x) => x.id === id);
    if (p) drawCooldowns(ctx, o.fx, p, 10 + i * 168 * u * 0.75, cam.h - 40 * u, Math.max(1, u * 0.75), false);
  });
}

/**
 * Slot umiejętności: wypełnienie odnowienia, liczba sekund (dla dłuższych odnowień) i biały
 * błysk w chwili gotowości.
 * @param {{left:number,total:number,flash:number}} cd
 */
function cdSlot(ctx, x, y, s, cd, iconName, label, color, u) {
  const frac = cd.total > 0 ? cd.left / cd.total : 0;
  panel(ctx, x, y, s, s, PANEL, frac <= 0 ? color : EDGE);
  icon(ctx, iconName, x + (s - 12 * u * 1.5) / 2, y + (s - 12 * u * 1.5) / 2, u * 1.5);
  if (frac > 0) {
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    const hh = Math.round((s - 4) * Math.min(1, frac));
    ctx.fillRect(x + 2, y + s - 2 - hh, s - 4, hh);
    if (cd.total >= CD_NUMBER_MIN_S) text(ctx, cd.left < 1 ? dec1(cd.left) : String(Math.ceil(cd.left)), x + s / 2, y + s / 2 + 5 * u, 13 * u, WHITE, 'center');
  }
  if (cd.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, cd.flash / CD_FLASH) * 0.85})`;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  }
  text(ctx, label, x + s / 2, y + s + 10 * u, 8 * u, '#b9b6e0', 'center');
}

/** Klucze błysku slotów (`${id}:${slot}`, jak w fx.cdFlash) budowane raz na gracza, nie co klatkę. */
const flashKeys = /** @type {Map<string, Record<string, string>>} */ (new Map());
const FLASH_KEYS_MAX = 32;
function flashKey(id, key) {
  let keys = flashKeys.get(id);
  if (!keys) {
    if (flashKeys.size >= FLASH_KEYS_MAX) flashKeys.clear();
    keys = {};
    flashKeys.set(id, keys);
  }
  return (keys[key] ??= `${id}:${key}`);
}

/** Bufor opisu slotu (bez alokacji co klatkę). */
const cdInfo = { left: 0, total: 1, flash: 0 };
function slotInfo(fx, p, key, left, total) {
  cdInfo.left = Math.max(0, left || 0);
  cdInfo.total = total;
  cdInfo.flash = fx.cdFlash[flashKey(p.id, key)] ?? 0;
  return cdInfo;
}

/** Sloty bossa i ich podpisy klawiszy. */
const BOSS_KEYS = /** @type {const} */ (['atk', 'q', 'e', 'r']);
const BOSS_KEY_LABELS = ['LPM', 'Q', 'E', 'R'];

/** Nazwy ikon umiejętności bossa (`boss:typ:slot`) — budowane raz na typ. */
const bossIcons = /** @type {Record<string, Record<string, string>>} */ ({});
const bossIcon = (type, k) => ((bossIcons[type] ??= {})[k] ??= `boss:${type}:${k}`);

/** Tekst odrodzenia dla gracza na wspólnym ekranie. */
const respawnText = (p) => (isBenched(p) ? 'wraca po fali' : `odrodzenie ${dec1(Math.max(0, p.respawnT))} s`);

/** Paski umiejętności (ikony z wypełnieniem cooldownu). */
function drawCooldowns(ctx, fx, p, x, y, u, big) {
  const s = Math.round((big ? SLOT_U : 26) * u);
  const gap = s + SLOT_GAP_U * u;
  const color = slotColor(p.slot);
  if (!p.alive) {
    // jeden gracz ma panel śmierci (hudOverlays.js) — tu tylko wspólny ekran
    if (!big) text(ctx, `${p.nick}: ${respawnText(p)}`, x, y + s / 2, 11 * u, WHITE);
    return;
  }
  if (!big) {
    const spr = getHeroSprite(p.skin, color, 'idle', 0, p.look);
    if (!p.boss) ctx.drawImage(spr.img, Math.round(x), Math.round(y), spr.w * u * 1.5, spr.h * u * 1.5);
    x += p.boss ? 0 : 24 * u;
  }
  if (p.boss) {
    const def = BOSSES[p.boss.type];
    for (let i = 0; i < BOSS_KEYS.length; i++) {
      const k = BOSS_KEYS[i];
      cdSlot(ctx, x + i * gap, y, s, slotInfo(fx, p, k, p.boss.cd[k], def[k].cd), bossIcon(p.boss.type, k), BOSS_KEY_LABELS[i], def.color, u);
    }
    return;
  }
  const sk = SKINS[p.skin];
  cdSlot(ctx, x, y, s, slotInfo(fx, p, 'atk', p.atkCd, sk.attack.cd), 'atk', 'LPM', color, u);
  cdSlot(ctx, x + gap, y, s, slotInfo(fx, p, 'dash', p.dashCd, HERO.dashCooldown), 'dash', 'SPACJA', color, u);
  cdSlot(ctx, x + gap * 2, y, s, slotInfo(fx, p, 'abil', p.abilCd, sk.ability.cd), `skin:${p.skin}`, 'PPM', color, u);
}
