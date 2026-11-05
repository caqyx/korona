import { BOSSES, BOSS_COMMON, SKINS, HERO } from '../sim/config.js';
import { slotColor, CROWN } from './palette.js';
import { feverMultiplier } from '../sim/combat.js';

/** HUD: pasek punktów u góry, HP bossa, cooldowny, licznik czasu, nakładki. */
export function drawHud(ctx, cam, view, o) {
  drawScores(ctx, cam, view);
  drawBossBar(ctx, cam, view, o.time);
  drawTimer(ctx, cam, view);
  for (const id of o.meIds) drawCooldowns(ctx, cam, view, id, o.meIds.length > 1);
  if (view.phase === 'countdown') bigText(ctx, cam, String(Math.ceil(view.countdown)), 'Zdobądź koronę!');
  if (view.phase === 'transition' && view.transition) drawRoulette(ctx, cam, view, o.time);
  if (o.fx.banner && view.phase !== 'transition') bigText(ctx, cam, o.fx.banner.text, '', 0.25, 30);
  if (o.overlay) bigText(ctx, cam, o.overlay, '', 0.5, 34);
}

function drawScores(ctx, cam, view) {
  const list = [...view.players].sort((a, b) => b.score - a.score);
  const w = Math.min(150, (cam.w - 40) / Math.max(1, list.length));
  let x = (cam.w - w * list.length) / 2;
  ctx.font = '600 13px system-ui, sans-serif';
  for (const p of list) {
    ctx.fillStyle = 'rgba(10,10,20,0.75)';
    ctx.fillRect(x + 2, 8, w - 4, 30);
    ctx.fillStyle = slotColor(p.slot);
    ctx.fillRect(x + 2, 8, 4, 30);
    const pct = Math.min(1, p.score / view.targetScore);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 8, 32, (w - 14) * pct, 4);
    ctx.fillStyle = p.dnf ? '#777' : '#fff';
    const name = (p.boss ? '♛ ' : '') + p.nick + (p.dnf ? ' DNF' : '');
    ctx.fillText(name.slice(0, 14), x + 10, 26);
    ctx.textAlign = 'right';
    ctx.fillText(String(p.score), x + w - 8, 26);
    ctx.textAlign = 'left';
    x += w;
  }
}

function drawBossBar(ctx, cam, view, time) {
  const b = view.players.find((p) => p.boss);
  if (!b) return;
  const def = BOSSES[b.boss.type];
  const w = Math.min(520, cam.w * 0.6);
  const x = (cam.w - w) / 2;
  const y = 48;
  const pct = Math.max(0, b.boss.hp / b.boss.maxHp);
  const low = pct <= BOSS_COMMON.lowHpPulse;
  ctx.fillStyle = 'rgba(10,10,20,0.8)';
  ctx.fillRect(x, y, w, 16);
  ctx.fillStyle = low ? `rgba(255,${80 + Math.sin(time * 18) * 60},90,1)` : def.color;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = low ? 20 : 8;
  ctx.fillRect(x, y, w * pct, 16);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x, y, w, 16);
  ctx.fillStyle = '#fff';
  ctx.font = '600 12px system-ui, sans-serif';
  const fever = feverMultiplier(b.boss.reign);
  const label = `${def.name} · ${b.nick} · ${Math.ceil(b.boss.hp)}/${b.boss.maxHp}` + (fever > 1 ? `  GORĄCZKA +${Math.round((fever - 1) * 100)}%` : '');
  ctx.fillText(label, x + 6, y + 12);
}

function drawTimer(ctx, cam, view) {
  const left = Math.max(0, view.timeLimit - view.matchTime);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  ctx.fillStyle = left < 30 ? '#ff5470' : '#cfd3ff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${m}:${String(s).padStart(2, '0')}`, cam.w - 14, 64);
  ctx.textAlign = 'left';
}

function cdIcon(ctx, x, y, r, frac, label, color) {
  ctx.fillStyle = 'rgba(10,10,20,0.8)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = frac <= 0 ? color : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (frac > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 4);
  ctx.textAlign = 'left';
}

function drawCooldowns(ctx, cam, view, id, compact) {
  const p = view.players.find((x) => x.id === id);
  if (!p) return;
  const color = slotColor(p.slot);
  const baseX = compact ? 20 + p.slot * 150 : 30;
  const y = cam.h - 34;
  if (!p.alive) {
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(`${p.nick}: odrodzenie ${Math.max(0, p.respawnT).toFixed(1)} s`, baseX, y + 4);
    return;
  }
  if (p.boss) {
    const def = BOSSES[p.boss.type];
    ['atk', 'q', 'e', 'r'].forEach((k, i) => {
      cdIcon(ctx, baseX + i * 36, y, 15, p.boss.cd[k] / def[k].cd, k === 'atk' ? 'LPM' : k.toUpperCase(), def.color);
    });
    return;
  }
  const s = SKINS[p.skin];
  cdIcon(ctx, baseX, y, 15, p.atkCd / s.attack.cd, 'LPM', color);
  cdIcon(ctx, baseX + 36, y, 15, p.dashCd / HERO.dashCooldown, 'DASH', color);
  cdIcon(ctx, baseX + 72, y, 15, p.abilCd / s.ability.cd, 'PPM', color);
}

function drawRoulette(ctx, cam, view, time) {
  const tr = view.transition;
  const elapsed = 1.5 - tr.t;
  const p = view.players.find((x) => x.id === tr.newBossId);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = CROWN;
  ctx.font = '800 30px system-ui, sans-serif';
  const by = Math.max(110, cam.h * 0.3);
  ctx.fillText(`${p ? p.nick : '?'} — nowy boss`, cam.w / 2, by - 24);
  const choices = tr.choices;
  const spin = elapsed < 1.0;
  const idx = spin ? Math.floor(time * 14) % choices.length : choices.indexOf(tr.bossType);
  choices.forEach((c, i) => {
    const x = cam.w / 2 + (i - (choices.length - 1) / 2) * 120;
    const active = i === idx;
    ctx.fillStyle = active ? BOSSES[c].color : 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - 48, by, 96, 56);
    ctx.fillStyle = active ? '#000' : '#aaa';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(BOSSES[c].name, x, by + 34);
  });
  if (!spin) {
    ctx.fillStyle = BOSSES[tr.bossType].color;
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(BOSSES[tr.bossType].name.toUpperCase(), cam.w / 2, by + 104);
  }
  ctx.textAlign = 'left';
}

function bigText(ctx, cam, text, sub, yf = 0.4, size = 72) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#6c7bff';
  ctx.shadowBlur = 20;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.fillText(text, cam.w / 2, cam.h * yf);
  ctx.shadowBlur = 0;
  if (sub) {
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(sub, cam.w / 2, cam.h * yf + 40);
  }
  ctx.textAlign = 'left';
}
