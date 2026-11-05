import { MATCH, HERO, BOSS_COMMON, BOSSES, SKINS } from '../sim/config.js';
import { ringRadius } from '../sim/zones.js';
import { BG, TELEGRAPH, CROWN, slotColor } from './palette.js';
import { worldToScreen } from './camera.js';
import { drawHud } from './hud.js';

const BOSS_R = HERO.radius * BOSS_COMMON.radiusMul;

/**
 * Renderer Canvas 2D. Rysuje wyłącznie na podstawie przekazanego widoku (stan/interpolacja)
 * — żadnej logiki gry.
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return [w, h];
  }
  return {
    resize,
    /**
     * @param {any} view stan do narysowania
     * @param {{cam:any, fx:any, meIds:string[], time:number, overlay?:string|null, mode:'local'|'online'}} o
     */
    draw(view, o) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { cam, fx } = o;
      cam.shakeX = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 10 : 0;
      cam.shakeY = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 10 : 0;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cam.w, cam.h);
      drawArena(ctx, cam, o.time);
      drawZones(ctx, cam, view.zones, o.time);
      drawCrown(ctx, cam, view, o.time);
      drawTurrets(ctx, cam, view);
      drawMinions(ctx, cam, view.minions);
      drawProjectiles(ctx, cam, view);
      drawPlayers(ctx, cam, view, o);
      drawFx(ctx, cam, fx);
      if (fx.flash > 0) {
        ctx.fillStyle = `rgba(255,40,72,${fx.flash * 0.5})`;
        ctx.fillRect(0, 0, cam.w, cam.h);
      }
      drawHud(ctx, cam, view, o);
    },
  };
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

function drawArena(ctx, cam, time) {
  const [cx, cy] = worldToScreen(cam, 0, 0);
  const R = MATCH.arenaRadius * cam.scale;
  const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#11121f');
  g.addColorStop(1, '#0a0a14');
  ctx.fillStyle = g;
  circle(ctx, cx, cy, R);
  ctx.fill();
  ctx.save();
  circle(ctx, cx, cy, R);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,130,255,0.06)';
  ctx.lineWidth = 1;
  const step = 2 * cam.scale;
  for (let x = cx - R; x <= cx + R; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, cy - R);
    ctx.lineTo(x, cy + R);
    ctx.stroke();
  }
  for (let y = cy - R; y <= cy + R; y += step) {
    ctx.beginPath();
    ctx.moveTo(cx - R, y);
    ctx.lineTo(cx + R, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.shadowColor = '#6c7bff';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = `rgba(108,123,255,${0.7 + Math.sin(time * 2) * 0.1})`;
  ctx.lineWidth = 3;
  circle(ctx, cx, cy, R);
  ctx.stroke();
  for (const p of MATCH.pillars) {
    const [px, py] = worldToScreen(cam, p.x, p.y);
    ctx.fillStyle = '#15162a';
    circle(ctx, px, py, p.r * cam.scale);
    ctx.fill();
    ctx.strokeStyle = '#8f9bff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawZones(ctx, cam, zones, time) {
  for (const z of zones) {
    const [x, y] = worldToScreen(cam, z.x, z.y);
    const telegraph = z.warn > 0;
    const p = telegraph && z.warnTotal > 0 ? 1 - z.warn / z.warnTotal : 1;
    const marker = z.dmg <= 0 && z.slow <= 0;
    ctx.save();
    ctx.strokeStyle = TELEGRAPH;
    ctx.fillStyle = telegraph ? `rgba(255,40,72,${0.1 + p * 0.3})` : marker ? 'rgba(255,40,72,0.1)' : 'rgba(255,40,72,0.55)';
    ctx.lineWidth = 2;
    if (marker) ctx.setLineDash([6, 6]);
    if (z.kind === 'ossuary' && !telegraph) ctx.fillStyle = `rgba(150,20,50,${0.35 + Math.sin(time * 6) * 0.08})`;
    ctx.shadowColor = TELEGRAPH;
    ctx.shadowBlur = telegraph ? 6 : 14;
    pathZone(ctx, cam, z, x, y, telegraph);
    ctx.fill();
    ctx.stroke();
    if (telegraph && z.shape !== 'line' && z.shape !== 'ring') {
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([]);
      const zz = { ...z, r: z.r * p };
      pathZone(ctx, cam, zz, x, y, true);
      ctx.fill();
    }
    ctx.restore();
  }
}

function pathZone(ctx, cam, z, x, y, telegraph) {
  const s = cam.scale;
  ctx.beginPath();
  if (z.shape === 'circle') ctx.arc(x, y, Math.max(0.1, z.r * s), 0, Math.PI * 2);
  else if (z.shape === 'arc') {
    ctx.moveTo(x, y);
    ctx.arc(x, y, Math.max(0.1, z.r * s), z.ang - z.arc / 2, z.ang + z.arc / 2);
    ctx.closePath();
  } else if (z.shape === 'line') {
    const ca = Math.cos(z.ang);
    const sa = Math.sin(z.ang);
    const hw = (z.w / 2) * s;
    const L = z.len * s;
    ctx.moveTo(x - sa * hw, y + ca * hw);
    ctx.lineTo(x - sa * hw + ca * L, y + ca * hw + sa * L);
    ctx.lineTo(x + sa * hw + ca * L, y - ca * hw + sa * L);
    ctx.lineTo(x + sa * hw, y - ca * hw);
    ctx.closePath();
  } else if (z.shape === 'ring') {
    const r = telegraph ? z.rMax : ringRadius(z);
    const w = telegraph ? 0.15 : z.w;
    ctx.arc(x, y, Math.max(0.2, (r + w / 2) * s), 0, Math.PI * 2);
    ctx.arc(x, y, Math.max(0.1, (r - w / 2) * s), 0, Math.PI * 2, true);
  }
}

function drawCrownShape(ctx, x, y, size, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = CROWN;
  ctx.shadowColor = CROWN;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.moveTo(-size, size * 0.5);
  ctx.lineTo(-size, -size * 0.4);
  ctx.lineTo(-size * 0.5, size * 0.05);
  ctx.lineTo(0, -size * 0.7);
  ctx.lineTo(size * 0.5, size * 0.05);
  ctx.lineTo(size, -size * 0.4);
  ctx.lineTo(size, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrown(ctx, cam, view, time) {
  if (view.crown.state !== 'center') return;
  const [x, y] = worldToScreen(cam, view.crown.x, view.crown.y + Math.sin(time * 3) * 0.12);
  ctx.strokeStyle = 'rgba(255,210,63,0.35)';
  ctx.lineWidth = 2;
  circle(ctx, x, y, (MATCH.crownPickupRadius + 0.2 + Math.sin(time * 4) * 0.1) * cam.scale);
  ctx.stroke();
  drawCrownShape(ctx, x, y, 0.6 * cam.scale, 24);
}

function drawTurrets(ctx, cam, view) {
  for (const t of view.turrets) {
    const owner = view.players.find((p) => p.id === t.ownerId);
    const [x, y] = worldToScreen(cam, t.x, t.y);
    const s = 0.35 * cam.scale;
    ctx.fillStyle = '#161616';
    ctx.strokeStyle = owner ? slotColor(owner.slot) : '#ff9f43';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
    ctx.strokeRect(x - s, y - s, s * 2, s * 2);
    ctx.shadowBlur = 0;
  }
}

function drawMinions(ctx, cam, minions) {
  for (const m of minions) {
    const [x, y] = worldToScreen(cam, m.x, m.y);
    const r = m.r * cam.scale;
    ctx.fillStyle = '#e8e8e8';
    ctx.strokeStyle = TELEGRAPH;
    ctx.lineWidth = 2;
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    circle(ctx, x - r * 0.35, y - r * 0.1, r * 0.22);
    ctx.fill();
    circle(ctx, x + r * 0.35, y - r * 0.1, r * 0.22);
    ctx.fill();
  }
}

function drawProjectiles(ctx, cam, view) {
  for (const pr of view.projectiles) {
    const [x, y] = worldToScreen(cam, pr.x, pr.y);
    const r = Math.max(2, pr.r * cam.scale);
    if (pr.team === 'boss') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = TELEGRAPH;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = TELEGRAPH;
      ctx.shadowBlur = 8;
      circle(ctx, x, y, r);
      ctx.fill();
      ctx.stroke();
    } else {
      const owner = view.players.find((p) => p.id === pr.ownerId);
      const c = owner ? slotColor(owner.slot) : '#fff';
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = pr.kind === 'pierce' ? 20 : 8;
      if (pr.kind === 'pierce' || pr.kind === 'bolt') {
        const a = Math.atan2(pr.vy, pr.vx);
        const L = (pr.kind === 'pierce' ? 1.2 : 0.5) * cam.scale;
        ctx.strokeStyle = c;
        ctx.lineWidth = r * 1.4;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      circle(ctx, x, y, r);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

/** Sylwetka skina. */
function heroPath(ctx, skin, x, y, r, ang) {
  ctx.beginPath();
  const pts = { rycerz: 4, lucznik: 3, lotrzyk: 4, kaplan: 0, inzynier: 6 }[skin] ?? 0;
  if (!pts) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  const rot = skin === 'lotrzyk' ? ang : skin === 'rycerz' ? ang + Math.PI / 4 : ang;
  const rr = skin === 'lotrzyk' ? r * 1.15 : r * 1.12;
  for (let i = 0; i < pts; i++) {
    const a = rot + (i / pts) * Math.PI * 2;
    const px = x + Math.cos(a) * rr * (skin === 'lotrzyk' && i % 2 ? 0.6 : 1);
    const py = y + Math.sin(a) * rr * (skin === 'lotrzyk' && i % 2 ? 0.6 : 1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function bossPath(ctx, type, x, y, r, ang, time) {
  ctx.beginPath();
  if (type === 'kolos') {
    for (let i = 0; i < 8; i++) {
      const a = ang + (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  } else if (type === 'cien') {
    for (let i = 0; i < 10; i++) {
      const a = ang + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r * 0.55 : r * 1.05;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  } else if (type === 'nekromanta') {
    ctx.moveTo(x + Math.cos(ang) * r * 1.1, y + Math.sin(ang) * r * 1.1);
    ctx.lineTo(x + Math.cos(ang + 2.4) * r, y + Math.sin(ang + 2.4) * r);
    ctx.lineTo(x + Math.cos(ang + Math.PI) * r * 0.5, y + Math.sin(ang + Math.PI) * r * 0.5);
    ctx.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
  } else {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + time * 2;
      const rr = i % 2 ? r * 0.75 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  ctx.closePath();
}

function drawPlayers(ctx, cam, view, o) {
  for (const p of view.players) {
    if (!p.alive || !p.connected) continue;
    const [x, y] = worldToScreen(cam, p.x, p.y);
    const ang = Math.atan2(p.fy, p.fx);
    const color = slotColor(p.slot);
    const isMe = o.meIds.includes(p.id);
    ctx.save();
    if (p.boss) {
      const def = BOSSES[p.boss.type];
      const r = BOSS_R * cam.scale;
      if (p.boss.invisT > 0) ctx.globalAlpha = isMe ? 0.45 : 0.08;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#0d0d16';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 4;
      bossPath(ctx, p.boss.type, x, y, r, ang, o.time);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      circle(ctx, x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55, r * 0.16);
      ctx.fill();
      if (p.boss.channel?.kind === 'drain') {
        const t = view.players.find((h) => h.id === p.boss.channel.targetId);
        if (t) {
          const [tx, ty] = worldToScreen(cam, t.x, t.y);
          ctx.strokeStyle = '#39ff9f';
          ctx.lineWidth = 4 + Math.sin(o.time * 30) * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
      if (p.boss.channel?.kind === 'vortex') {
        ctx.strokeStyle = 'rgba(59,213,255,0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          circle(ctx, x, y, p.boss.channel.radius * cam.scale * (((o.time * 1.5 + i / 3) % 1) || 0.01));
          ctx.stroke();
        }
      }
      if (p.boss.overloaded) {
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([4, 6]);
        circle(ctx, x, y, r * 1.25);
        ctx.stroke();
      }
      ctx.globalAlpha = p.boss.invisT > 0 ? (isMe ? 0.45 : 0.15) : 1;
      drawCrownShape(ctx, x, y - r - 0.5 * cam.scale, 0.55 * cam.scale, 16);
    } else {
      const r = HERO.radius * cam.scale;
      const blink = p.invulnT > 0 && Math.floor(o.time * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 0.45 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = isMe ? 18 : 10;
      ctx.fillStyle = color;
      heroPath(ctx, p.skin, x, y, r, ang);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isMe ? 2 : 1;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r * 1.2, y + Math.sin(ang) * r * 1.2);
      ctx.lineTo(x + Math.cos(ang) * r * 1.9, y + Math.sin(ang) * r * 1.9);
      ctx.stroke();
      if (p.skin === 'rycerz' && p.abilT > 0) {
        const half = (SKINS.rycerz.ability.arc / 2) * (Math.PI / 180);
        ctx.strokeStyle = '#9be7ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.8, ang - half, ang + half);
        ctx.stroke();
      }
      if (p.skin === 'lucznik' && p.abilT > 0) {
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * 8 * cam.scale, y + Math.sin(ang) * 8 * cam.scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.buffT > 0) {
        ctx.strokeStyle = '#c77dff';
        circle(ctx, x, y, r * 1.5);
        ctx.stroke();
      }
      if (p.stunT > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(r)}px sans-serif`;
        ctx.fillText('✶', x - r * 0.4, y - r * 1.6);
      }
      ctx.shadowBlur = 0;
      for (let i = 0; i < HERO.hp; i++) {
        ctx.fillStyle = i < p.hp ? color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x - r + i * ((2 * r) / 3) + 1, y + r * 1.5, (2 * r) / 3 - 2, Math.max(2, r * 0.25));
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const ny = p.boss ? y - BOSS_R * cam.scale - 1.1 * cam.scale : y - HERO.radius * cam.scale - 8;
    if (!(p.boss && p.boss.invisT > 0 && !isMe)) ctx.fillText(p.nick, x, ny);
    ctx.textAlign = 'left';
  }
}

function drawFx(ctx, cam, fx) {
  for (const p of fx.parts) {
    const [x, y] = worldToScreen(cam, p.x, p.y);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(x - 2, y - 2, Math.max(2, p.size * cam.scale), Math.max(2, p.size * cam.scale));
  }
  ctx.globalAlpha = 1;
  for (const b of fx.bolts) {
    ctx.strokeStyle = `rgba(150,230,255,${b.life / 0.35})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#3bd5ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    b.pts.forEach(([wx, wy], i) => {
      const [x, y] = worldToScreen(cam, wx + (Math.random() - 0.5) * 0.3, wy + (Math.random() - 0.5) * 0.3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
