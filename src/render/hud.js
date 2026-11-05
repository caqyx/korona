/**
 * HUD w pełnej rozdzielczości, w stylu pixel art (font Pixelify Sans, ramki „schodkowe”,
 * ikony ze sprites.js powiększane bez wygładzania).
 */
import { BOSSES, BOSS_COMMON, SKINS, HERO, RARITY, CASE } from '../sim/config.js';
import { slotColor, CROWN } from './palette.js';
import { feverMultiplier } from '../sim/combat.js';
import { getIcon, getBossSprite, getHeroSprite } from './sprites.js';

const FONT = '"Pixelify Sans", monospace';
const PANEL = 'rgba(14,13,26,0.86)';
const EDGE = '#3d3a63';

/** Ramka z „pikselowymi” narożnikami. */
function panel(ctx, x, y, w, h, fill = PANEL, edge = EDGE) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.fillStyle = edge;
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}

function text(ctx, str, x, y, size, color, align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = /** @type {CanvasTextAlign} */ (align);
  if (shadow) {
    ctx.fillStyle = '#000';
    ctx.fillText(str, x + Math.max(1, size / 10), y + Math.max(1, size / 10));
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

function icon(ctx, name, x, y, scale) {
  const s = getIcon(name);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.img, Math.round(x), Math.round(y), s.w * scale, s.h * scale);
}

/** @param {any} o */
export function drawHud(ctx, cam, view, o) {
  const u = Math.max(1, Math.min(2, Math.round(Math.min(cam.w, cam.h * 1.5) / 640)));
  ctx.imageSmoothingEnabled = false;
  const me = view.players.find((p) => p.id === o.meIds[0]);
  if (me && me.alive && !me.boss && me.hp === 1) lowHpVignette(ctx, cam, o.time);
  if (o.fx.redFlash > 0) {
    ctx.fillStyle = `rgba(255,40,72,${o.fx.redFlash * 0.6})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  drawScores(ctx, cam, view, u);
  drawBossBar(ctx, cam, view, o.time, u);
  drawTimer(ctx, cam, view, u);
  drawFeed(ctx, cam, o.fx, u);
  if (o.mode === 'online' || o.meIds.length === 1) {
    if (me) drawCooldowns(ctx, cam, me, 12 * u, cam.h - 46 * u, u, true);
  } else {
    o.meIds.forEach((id, i) => {
      const p = view.players.find((x) => x.id === id);
      if (p) drawCooldowns(ctx, cam, p, 10 + i * 168 * u * 0.75, cam.h - 40 * u, Math.max(1, u * 0.75), false);
    });
  }
  if (me && !me.alive && view.phase === 'playing' && o.meIds.length === 1) {
    text(ctx, 'NIE ŻYJESZ', cam.w / 2, cam.h * 0.42, 28 * u, '#ff5470', 'center');
    text(ctx, `Odrodzenie za ${Math.max(0, me.respawnT).toFixed(1)} s`, cam.w / 2, cam.h * 0.42 + 26 * u, 14 * u, '#ffffff', 'center');
  }
  if (view.phase === 'countdown') countdown(ctx, cam, view, u, o);
  if (view.phase === 'transition' && view.transition) drawCase(ctx, cam, view, o.time, o.sound, u);
  if (o.overlay) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, cam.w, cam.h);
    text(ctx, o.overlay, cam.w / 2, cam.h * 0.5, 34 * u, '#ffffff', 'center');
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

let lastCount = -1;
function countdown(ctx, cam, view, u, o) {
  const n = Math.ceil(view.countdown);
  if (n !== lastCount) {
    lastCount = n;
    o.sound?.('countdown');
  }
  const k = view.countdown % 1;
  text(ctx, String(n), cam.w / 2, cam.h * 0.42, Math.round((56 + k * 30) * u), CROWN, 'center');
  text(ctx, 'Zdobądź koronę ze środka areny!', cam.w / 2, cam.h * 0.42 + 34 * u, 14 * u, '#ffffff', 'center');
}

function drawScores(ctx, cam, view, u) {
  const list = [...view.players].sort((a, b) => b.score - a.score);
  const h = 26 * u;
  const w = Math.min(132 * u, (cam.w - 16) / Math.max(1, list.length));
  let x = (cam.w - w * list.length) / 2;
  for (const p of list) {
    const c = slotColor(p.slot);
    panel(ctx, x + 1, 4, w - 2, h, PANEL, p.boss ? CROWN : EDGE);
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
    text(ctx, name.slice(0, 11), lx + (p.boss ? 14 * u : 0), 4 + h * 0.55, 11 * u, p.dnf ? '#777' : '#ffffff');
    text(ctx, String(p.score), x + w - 8, 4 + h * 0.55, 12 * u, CROWN, 'right');
    x += w;
  }
}

function drawBossBar(ctx, cam, view, time, u) {
  const b = view.players.find((p) => p.boss);
  if (!b) return;
  const def = BOSSES[b.boss.type];
  const rar = RARITY[def.rarity] || RARITY.blue;
  const w = Math.min(460 * u, cam.w * 0.62);
  const x = (cam.w - w) / 2;
  const y = 36 * u;
  const pct = Math.max(0, b.boss.hp / b.boss.maxHp);
  const low = pct <= BOSS_COMMON.lowHpPulse;
  panel(ctx, x - 34 * u, y - 2, w + 36 * u, 26 * u, PANEL, rar.color);
  const spr = getBossSprite(b.boss.type, 'idle', Math.floor(time * 5));
  const ps = (22 * u) / Math.max(spr.w, spr.h);
  ctx.drawImage(spr.img, Math.round(x - 31 * u), Math.round(y + 1), Math.round(spr.w * ps), Math.round(spr.h * ps));
  ctx.fillStyle = '#1e1c33';
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round(w - 6), 8 * u);
  ctx.fillStyle = low && Math.floor(time * 12) % 2 ? '#ffffff' : def.color;
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round((w - 6) * pct), 8 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(Math.round(x), y + 12 * u, Math.round((w - 6) * pct), 2 * u);
  // podziałka co 10%
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 1; i < 10; i++) ctx.fillRect(Math.round(x + ((w - 6) * i) / 10), y + 12 * u, 1, 8 * u);
  text(ctx, `${def.name} — ${b.nick}`, x, y + 9 * u, 10 * u, '#ffffff');
  text(ctx, `${Math.ceil(b.boss.hp)}/${b.boss.maxHp}`, x + w - 8, y + 9 * u, 10 * u, '#ffffff', 'right');
  const fever = feverMultiplier(b.boss.reign);
  if (fever > 1) text(ctx, `GORĄCZKA +${Math.round((fever - 1) * 100)}%`, cam.w / 2, y + 36 * u, 11 * u, Math.floor(time * 4) % 2 ? '#ff8a3d' : '#ffd23f', 'center');
}

function drawTimer(ctx, cam, view, u) {
  const left = Math.max(0, view.timeLimit - view.matchTime);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  panel(ctx, cam.w - 64 * u, 34 * u, 56 * u, 20 * u);
  text(ctx, `${m}:${String(s).padStart(2, '0')}`, cam.w - 36 * u, 48 * u, 13 * u, left < 30 ? '#ff5470' : '#cfd3ff', 'center');
}

function drawFeed(ctx, cam, fx, u) {
  let y = 70 * u;
  for (const f of fx.feed) {
    ctx.globalAlpha = Math.min(1, f.life);
    text(ctx, f.text, cam.w - 10, y, 11 * u, f.color, 'right');
    y += 15 * u;
  }
  ctx.globalAlpha = 1;
}

function cdSlot(ctx, x, y, s, frac, iconName, label, color, u) {
  panel(ctx, x, y, s, s, PANEL, frac <= 0 ? color : EDGE);
  icon(ctx, iconName, x + (s - 12 * u * 1.5) / 2, y + (s - 12 * u * 1.5) / 2, u * 1.5);
  if (frac > 0) {
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    const hh = Math.round((s - 4) * Math.min(1, frac));
    ctx.fillRect(x + 2, y + s - 2 - hh, s - 4, hh);
  }
  text(ctx, label, x + s / 2, y + s + 10 * u, 8 * u, '#b9b6e0', 'center');
}

/** Paski umiejętności (ikony z wypełnieniem cooldownu). */
function drawCooldowns(ctx, cam, p, x, y, u, big) {
  const s = Math.round((big ? 30 : 26) * u);
  const gap = s + 6 * u;
  const color = slotColor(p.slot);
  if (!p.alive) {
    text(ctx, `${p.nick}: odrodzenie ${Math.max(0, p.respawnT).toFixed(1)} s`, x, y + s / 2, 11 * u, '#ffffff');
    return;
  }
  if (!big) {
    const spr = getHeroSprite(p.skin, color, 'idle', 0);
    if (!p.boss) ctx.drawImage(spr.img, Math.round(x), Math.round(y), spr.w * u * 1.5, spr.h * u * 1.5);
    x += p.boss ? 0 : 24 * u;
  }
  if (p.boss) {
    const def = BOSSES[p.boss.type];
    ['atk', 'q', 'e', 'r'].forEach((k, i) => {
      cdSlot(ctx, x + i * gap, y, s, p.boss.cd[k] / def[k].cd, `boss:${p.boss.type}:${k}`, k === 'atk' ? 'LPM' : k.toUpperCase(), def.color, u);
    });
    return;
  }
  const sk = SKINS[p.skin];
  cdSlot(ctx, x, y, s, p.atkCd / sk.attack.cd, 'atk', 'LPM', color, u);
  cdSlot(ctx, x + gap, y, s, p.dashCd / HERO.dashCooldown, 'dash', 'SPACJA', color, u);
  cdSlot(ctx, x + gap * 2, y, s, p.abilCd / sk.ability.cd, `skin:${p.skin}`, 'PPM', color, u);
}

let lastTickIdx = -1;
const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);

/** Losowanie bossa w stylu skrzynki CS2 — karty z portretami i kolorami rzadkości. */
function drawCase(ctx, cam, view, time, sound, u) {
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
    panel(ctx, x + 3, top, cw - 6, ch, '#1a1930', isWin ? '#ffffff' : '#2b2946');
    const grad = ctx.createLinearGradient(0, top, 0, top + ch);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, rar.color + '88');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.round(x + 5), top + 2, cw - 10, ch - 4);
    const spr = getBossSprite(strip[i], isWin ? 'cast' : 'idle', Math.floor(time * 6));
    const sc = Math.max(1, Math.floor((ch * 0.62) / spr.h));
    ctx.drawImage(spr.img, Math.round(x + cw / 2 - (spr.w * sc) / 2), Math.round(top + ch * 0.08), spr.w * sc, spr.h * sc);
    ctx.fillStyle = rar.color;
    ctx.fillRect(Math.round(x + 5), top + ch - 7, cw - 10, 5);
    text(ctx, def.name, x + cw / 2, top + ch - 13, Math.round(cw / 9), '#ffffff', 'center');
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
