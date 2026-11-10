/**
 * Renderer pixel art. Świat rysowany w buforze niskiej rozdzielczości (PPM px/m),
 * powiększanym na ekran bez wygładzania; HUD rysowany w pełnej rozdzielczości fontem pikselowym.
 * Renderer tylko czyta stan — zero logiki gry.
 */
import { MATCH, HERO, BOSS_COMMON, BOSSES, SKINS, heroBaseHp } from '../sim/config.js';
import { ringRadius } from '../sim/zones.js';
import { slotColor, TELEGRAPH as RED, TEAM_COLORS } from './palette.js';
import { worldToArt } from './camera.js';
import { drawHud } from './hud.js';
import { drawOwnRing, drawOwnArrow, drawCrownGuide } from './markers.js';
import { drawEdgeIndicators } from './indicators.js';
import { getArenaCanvas, drawHazardsAnimated, getObstacleSprite, getBushSprite } from './maps/index.js';
import { getMap } from '../sim/maps.js';
import { PPM, getHeroSprite, getBossSprite, getMinionSprite, getTurretSprite, getCrownSprite, getProjectileSprite } from './sprites.js';
import { dither, fillCircle, strokeCircle, fillRing, fillEllipse, line, fillPolygon, strokePolygon, sectorPoints, linePoints, drawSprite } from './pixel.js';

const RED_DARK = '#a3122e';
const BOSS_R = HERO.radius * BOSS_COMMON.radiusMul;

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const buf = document.createElement('canvas');
  const g = /** @type {CanvasRenderingContext2D} */ (buf.getContext('2d'));
  let dpr = 1;
  /** poprzednie pozycje (animacja chodu, smugi pocisków) */
  const prevPos = new Map();
  const moving = new Map();
  const trails = new Map();

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

  function trackMotion(view) {
    for (const p of view.players) {
      const prev = prevPos.get(p.id);
      const d = prev ? Math.hypot(p.x - prev[0], p.y - prev[1]) : 0;
      moving.set(p.id, d > 0.004 ? 0.12 : Math.max(0, (moving.get(p.id) || 0) - 0.016));
      prevPos.set(p.id, [p.x, p.y]);
    }
    const alive = new Set();
    for (const pr of view.projectiles) {
      alive.add(pr.id);
      const t = trails.get(pr.id) || [];
      t.push([pr.x, pr.y]);
      if (t.length > 4) t.shift();
      trails.set(pr.id, t);
    }
    for (const id of trails.keys()) if (!alive.has(id)) trails.delete(id);
  }

  return {
    resize,
    /**
     * @param {any} view
     * @param {{cam:any, fx:any, meIds:string[], time:number, overlay?:string|null, mode:'local'|'online', device?:string|null,
     *   hint?:string|null, touch?:boolean, aim?:any, sound?:(n:string)=>void}} o
     *   `device`: rodzaj urządzenia jedynego lokalnego gracza (podpowiedzi sterowania w HUD)
     */
    draw(view, o) {
      const { cam, fx } = o;
      if (buf.width !== cam.aw || buf.height !== cam.ah) {
        buf.width = cam.aw;
        buf.height = cam.ah;
      }
      g.imageSmoothingEnabled = false;
      cam.shakeX = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
      cam.shakeY = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
      trackMotion(view);

      g.fillStyle = '#0b0b14';
      g.fillRect(0, 0, cam.aw, cam.ah);
      drawStars(g, cam, o.time);
      const map = getMap(view.mapId);
      const arena = getArenaCanvas(map);
      const [ox, oy] = worldToArt(cam, 0, 0);
      g.drawImage(arena.img, ox - arena.cx, oy - arena.cy);
      drawHazardsAnimated(g, map, (x, y) => worldToArt(cam, x, y), o.time);

      drawZones(g, cam, view.zones, o.time, view);
      drawRings(g, cam, fx);
      drawCrownCenter(g, cam, view, o.time);
      drawCrownGuide(g, cam, view, o.meIds, o.time);
      drawEntities(g, cam, view, o, { moving, fx, map });
      drawProjectiles(g, cam, view, o.time, trails);
      drawBushes(g, cam, map, o.time);
      drawFxWorld(g, cam, fx);
      if (o.aim) drawAimPreview(g, cam, view, o);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(buf, 0, 0, cam.aw, cam.ah, 0, 0, Math.round(cam.aw * cam.S * dpr), Math.round(cam.ah * cam.S * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScreenWorldText(ctx, cam, view, o);
      drawEdgeIndicators(ctx, cam, view, o);
      drawHud(ctx, cam, view, o);
    },
  };
}

function drawStars(g, cam, time) {
  g.fillStyle = '#2a2b4a';
  for (let i = 0; i < 70; i++) {
    const x = ((i * 97.3 + cam.x * -2) % cam.aw + cam.aw) % cam.aw;
    const y = ((i * 57.9 + cam.y * -2) % cam.ah + cam.ah) % cam.ah;
    if ((i + Math.floor(time * 2)) % 9 === 0) continue;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

/** Telegrafy: ditherowane wypełnienie rośnie z postępem, obrys miga szybciej pod koniec. */
function drawZones(g, cam, zones, time, view) {
  for (const z of zones) {
    if (z.team === 'hero') {
      drawHeroZone(g, cam, z, time, view);
      continue;
    }
    const [x, y] = worldToArt(cam, z.x, z.y);
    const telegraph = z.warn > 0;
    const p = telegraph && z.warnTotal > 0 ? 1 - z.warn / z.warnTotal : 1;
    const marker = z.dmg <= 0 && z.slow <= 0 && !(z.knock > 0);
    const r = z.r * PPM;
    const persistent = !telegraph && z.lifeTotal > 0.3;
    let fill;
    let level;
    if (telegraph) {
      fill = RED;
      level = marker ? 0.15 : 0.12 + p * 0.45;
    } else if (persistent) {
      fill = z.kind === 'blizzard' || z.kind === 'iceWall' ? '#9fe8ff' : z.kind === 'embers' ? '#ff8a3d' : '#a3122e';
      level = 0.35 + Math.sin(time * 6) * 0.06;
    } else {
      fill = '#ffd0d8';
      level = 0.75;
    }
    g.fillStyle = dither(g, fill, level);
    const blink = telegraph && p > 0.6 && Math.floor(time * (p > 0.85 ? 24 : 12)) % 2 === 0;
    const outline = blink ? '#ffffff' : telegraph ? RED : fill;
    switch (z.shape) {
      case 'circle':
        fillCircle(g, x, y, r);
        if (telegraph && !marker) {
          g.fillStyle = dither(g, RED, 0.6);
          fillCircle(g, x, y, r * p);
        }
        g.fillStyle = outline;
        strokeCircle(g, x, y, r);
        break;
      case 'ring': {
        const rr = (telegraph ? Math.max(z.r, z.rMax) : ringRadius(z)) * PPM;
        const w = Math.max(1, (telegraph ? 0.2 : z.w) * PPM);
        if (telegraph) {
          g.fillStyle = outline;
          strokeCircle(g, x, y, rr);
          g.fillStyle = dither(g, RED, 0.25 + p * 0.3);
          fillRing(g, x, y, rr - 2, rr + 1);
        } else {
          g.fillStyle = dither(g, '#ffd0d8', 0.8);
          fillRing(g, x, y, rr - w / 2, rr + w / 2);
          g.fillStyle = '#ffffff';
          strokeCircle(g, x, y, rr);
        }
        break;
      }
      case 'arc': {
        const pts = sectorPoints(x, y, r, z.ang, Math.min(z.arc, Math.PI));
        fillPolygon(g, pts);
        if (telegraph && !marker) {
          g.fillStyle = dither(g, RED, 0.6);
          fillPolygon(g, sectorPoints(x, y, r * p, z.ang, Math.min(z.arc, Math.PI)));
        }
        g.fillStyle = outline;
        strokePolygon(g, pts);
        break;
      }
      case 'line': {
        const pts = linePoints(x, y, z.ang, z.len * PPM, Math.max(2, z.w * PPM));
        fillPolygon(g, pts);
        if (telegraph && !marker) {
          g.fillStyle = dither(g, RED, 0.6);
          fillPolygon(g, linePoints(x, y, z.ang, z.len * PPM * p, Math.max(2, z.w * PPM)));
        }
        g.fillStyle = outline;
        strokePolygon(g, pts);
        break;
      }
      default:
        break;
    }
  }
}

function drawRings(g, cam, fx) {
  for (const r of fx.rings) {
    const [x, y] = worldToArt(cam, r.x, r.y);
    const k = 1 - r.life / r.total;
    g.fillStyle = dither(g, r.color, 1 - k);
    strokeCircle(g, x, y, r.max * k * PPM);
  }
}

function drawCrownCenter(g, cam, view, time) {
  if (view.crown.state !== 'center') return;
  const [x, y] = worldToArt(cam, view.crown.x, view.crown.y);
  const pulse = (MATCH.crownPickupRadius + 0.15 + Math.sin(time * 4) * 0.12) * PPM;
  g.fillStyle = dither(g, '#ffd23f', 0.25);
  fillCircle(g, x, y, pulse);
  g.fillStyle = '#ffd23f';
  strokeCircle(g, x, y, pulse);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  fillEllipse(g, x, y + 2, 5, 2);
  const bob = Math.round(Math.sin(time * 3) * 2);
  drawSprite(g, getCrownSprite(Math.floor(time * 6)), x, y - 3 + bob);
  if (Math.floor(time * 8) % 3 === 0) {
    g.fillStyle = '#fff6c2';
    g.fillRect(x + Math.round(Math.sin(time * 5) * 6), y - 8 + bob + Math.round(Math.cos(time * 7) * 3), 1, 1);
  }
}

/** Postacie, bossowie, miniony, wieżyczki i filary — sortowane po Y (głębia). */
function drawEntities(g, cam, view, o, st) {
  /** @type {{y:number, draw:()=>void}[]} */
  const list = [];
  // przeszkody mapy (cienie są już w tle areny)
  for (const pl of st.map.obstacles) {
    list.push({
      y: pl.y + pl.r * 0.6,
      draw: () => {
        const [x, y] = worldToArt(cam, pl.x, pl.y + pl.r * 0.6);
        drawSprite(g, getObstacleSprite(pl.kind, pl.r), x, y);
      },
    });
  }
  for (const t of view.turrets) {
    const owner = view.players.find((p) => p.id === t.ownerId);
    list.push({
      y: t.y,
      draw: () => {
        const [x, y] = worldToArt(cam, t.x, t.y);
        g.fillStyle = 'rgba(0,0,0,0.4)';
        fillEllipse(g, x, y + 1, 4, 2);
        drawSprite(g, getTurretSprite(owner ? slotColor(owner.slot) : '#ff9f43', Math.floor(o.time * 4)), x, y + 2);
        // pasek życia wieżyczki
        const k = Math.max(0, t.life / 6);
        g.fillStyle = '#111';
        g.fillRect(x - 4, y - 11, 8, 1);
        g.fillStyle = owner ? slotColor(owner.slot) : '#ff9f43';
        g.fillRect(x - 4, y - 11, Math.round(8 * k), 1);
      },
    });
  }
  for (const m of view.minions) {
    list.push({
      y: m.y,
      draw: () => {
        const [x, y] = worldToArt(cam, m.x, m.y);
        g.fillStyle = 'rgba(0,0,0,0.4)';
        fillEllipse(g, x, y + 2, 4, 2);
        drawSprite(g, getMinionSprite(m.kind || 'skeleton', Math.floor(o.time * 6 + m.id)), x, y + 3, (m.fx || 1) < 0);
        if (m.hp < m.maxHp) {
          g.fillStyle = '#111';
          g.fillRect(x - 4, y - 10, 8, 1);
          g.fillStyle = '#e8e8e8';
          g.fillRect(x - 4, y - 10, Math.max(1, Math.round((8 * m.hp) / m.maxHp)), 1);
        }
      },
    });
  }
  for (const p of view.players) {
    if (!p.alive || !p.connected) continue;
    list.push({ y: p.y, draw: () => (p.boss ? drawBoss(g, cam, view, p, o, st) : drawHero(g, cam, view, p, o, st)) });
  }
  for (const gh of st.fx.ghosts) {
    const p = view.players.find((x) => x.id === gh.id);
    if (!p || p.boss) continue;
    list.push({
      y: gh.y - 0.01,
      draw: () => {
        const [x, y] = worldToArt(cam, gh.x, gh.y);
        g.globalAlpha = Math.max(0, gh.life / 0.2) * 0.5;
        drawSprite(g, getHeroSprite(p.skin, slotColor(p.slot), 'dash', 0, p.look), x, y + 4, p.fx < 0);
        g.globalAlpha = 1;
      },
    });
  }
  list.sort((a, b) => a.y - b.y);
  for (const e of list) e.draw();
}

function heroAnim(p, st) {
  if (st.fx.flash[p.id] > 0) return 'hurt';
  if (p.dashT > 0) return 'dash';
  const cfg = SKINS[p.skin];
  if (p.atkCd > cfg.attack.cd - 0.18 || (p.skin === 'lucznik' && p.abilT > 0)) return 'attack';
  if ((st.moving.get(p.id) || 0) > 0) return 'walk';
  return 'idle';
}

function drawHero(g, cam, view, p, o, st) {
  const [x, y] = worldToArt(cam, p.x, p.y);
  // ukryty w krzakach: dla innych prawie niewidoczny (boss/AI go nie widzi), dla siebie półprzezroczysty
  if (p.hidden) {
    const viewer = view.players.find((v) => o.meIds.includes(v.id));
    const viewerIsEnemy = viewer && (p.team !== undefined ? viewer.team !== p.team : viewer.boss);
    if (!o.meIds.includes(p.id) && viewerIsEnemy) return;
    g.globalAlpha = 0.55;
  }
  const color = slotColor(p.slot);
  const isMe = o.meIds.includes(p.id);
  // cień + znacznik gracza pod stopami
  g.fillStyle = 'rgba(0,0,0,0.45)';
  fillEllipse(g, x, y + 3, 5, 2);
  if (p.team !== undefined) {
    // znacznik drużyny pod stopami
    g.fillStyle = TEAM_COLORS[p.team];
    strokeCircle(g, x, y + 3, 6);
  }
  // „to ty”: pierścień pod stopami, a po starcie/odrodzeniu puls i strzałka nad głową
  const mark = isMe ? st.fx.mark[p.id] || 0 : 0;
  if (isMe) drawOwnRing(g, x, y, color, mark);
  // tarcza Rycerza
  if (p.skin === 'rycerz' && p.abilT > 0) {
    g.fillStyle = dither(g, '#9be7ff', 0.5);
    const a = Math.atan2(p.fy, p.fx);
    const half = (SKINS.rycerz.ability.arc / 2) * (Math.PI / 180);
    const pts = sectorPoints(x, y - 3, 11, a, half * 2, 10);
    fillPolygon(g, pts);
    g.fillStyle = '#d6f6ff';
    for (let i = 1; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
  // celownik: 3 kropki w stronę celowania
  g.fillStyle = color;
  for (let i = 1; i <= 3; i++) g.fillRect(Math.round(x + p.fx * (6 + i * 3)), Math.round(y - 4 + p.fy * (6 + i * 3)), 1, 1);
  if (p.skin === 'lucznik' && p.abilT > 0) {
    g.fillStyle = dither(g, color, 0.6);
    line(g, x, y - 4, x + p.fx * 16 * PPM * 0.5, y - 4 + p.fy * 16 * PPM * 0.5, 2);
  }
  const blink = p.invulnT > 0 && Math.floor(o.time * 14) % 2 === 0;
  if (blink) g.globalAlpha = 0.4;
  const anim = heroAnim(p, st);
  drawSprite(g, getHeroSprite(p.skin, color, anim, Math.floor(o.time * (anim === 'walk' ? 10 : 5)), p.look), x, y + 4, p.fx < 0);
  g.globalAlpha = 1;
  if (p.buffT > 0 && Math.floor(o.time * 10) % 2 === 0) {
    g.fillStyle = '#c77dff';
    g.fillRect(x - 6, y - 14, 1, 1);
    g.fillRect(x + 6, y - 10, 1, 1);
  }
  if (p.stunT > 0) {
    g.fillStyle = '#ffffff';
    const a = o.time * 8;
    g.fillRect(Math.round(x + Math.cos(a) * 5), y - 17, 1, 1);
    g.fillRect(Math.round(x + Math.cos(a + Math.PI) * 5), y - 17, 1, 1);
  }
  if (p.slowT > 0) {
    g.fillStyle = '#9fe8ff';
    g.fillRect(x - 5, y + 2, 1, 1);
    g.fillRect(x + 4, y + 1, 1, 1);
  }
  // serca HP nad głową
  const maxHp = p.maxHp ?? heroBaseHp(p.skin);
  for (let i = 0; i < maxHp; i++) {
    const hx = x - Math.round(maxHp * 2) + i * 4;
    const hy = y - 19;
    g.fillStyle = i < p.hp ? '#ff4d6d' : '#3a3550';
    g.fillRect(hx, hy, 1, 1);
    g.fillRect(hx + 2, hy, 1, 1);
    g.fillRect(hx, hy + 1, 3, 1);
    g.fillRect(hx + 1, hy + 2, 1, 1);
  }
  if (isMe && (mark > 0 || view.phase === 'countdown')) drawOwnArrow(g, x, y, color, o.time);
}

function drawBoss(g, cam, view, p, o, st) {
  const [x, y] = worldToArt(cam, p.x, p.y);
  const def = BOSSES[p.boss.type];
  const isMe = o.meIds.includes(p.id);
  const invis = p.boss.invisT > 0;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  fillEllipse(g, x, y + Math.round(BOSS_R * PPM * 0.7), Math.round(BOSS_R * PPM), Math.round(BOSS_R * PPM * 0.4));
  if (p.team !== undefined) {
    g.fillStyle = TEAM_COLORS[p.team];
    strokeCircle(g, x, y + Math.round(BOSS_R * PPM * 0.7), Math.round(BOSS_R * PPM) + 2);
  }
  if (invis) g.globalAlpha = isMe ? 0.45 : 0.1;
  // kanały
  const ch = p.boss.channel;
  if (ch?.kind === 'drain') {
    const t = view.players.find((h) => h.id === ch.targetId);
    if (t) {
      const [tx, ty] = worldToArt(cam, t.x, t.y);
      g.fillStyle = '#39ff9f';
      const wob = Math.round(Math.sin(o.time * 30));
      line(g, x, y - 8, tx, ty - 4 + wob);
      g.fillStyle = dither(g, '#39ff9f', 0.5);
      line(g, x + 1, y - 8, tx + 1, ty - 4 - wob);
    }
  }
  if (ch?.kind === 'vortex') {
    g.fillStyle = '#3bd5ff';
    const R = ch.radius * PPM;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + o.time * 3;
      const rr = R * (((o.time * 0.8 + i / 24) % 1) || 0.01);
      g.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1);
    }
  }
  if (ch?.kind === 'charge') {
    g.fillStyle = dither(g, '#ffffff', 0.5);
    for (let i = 0; i < 6; i++) line(g, x - ch.dx * 22 + (i - 3) * 3 * ch.dy, y - ch.dy * 22 - (i - 3) * 3 * ch.dx, x - ch.dx * 34 + (i - 3) * 3 * ch.dy, y - ch.dy * 34 - (i - 3) * 3 * ch.dx);
  }
  const anim = st.fx.flash[p.id] > 0 ? 'hurt' : p.boss.cast ? 'cast' : (st.moving.get(p.id) || 0) > 0 ? 'walk' : 'idle';
  const spr = getBossSprite(p.boss.type, anim, Math.floor(o.time * 6));
  const footY = y + Math.round(BOSS_R * PPM * 0.75);
  drawSprite(g, spr, x, footY, p.fx < 0);
  if (p.boss.overloaded) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const a = o.time * 4 + i;
      g.fillRect(Math.round(x + Math.cos(a) * 18), Math.round(y - 6 + Math.sin(a) * 18), 1, 1);
    }
  }
  // korona nad głową
  const bob = Math.round(Math.sin(o.time * 3));
  drawSprite(g, getCrownSprite(Math.floor(o.time * 6)), x, footY - spr.h - 2 + bob);
  g.globalAlpha = 1;
  // pasek HP bossa w świecie
  const w = 34;
  const pct = Math.max(0, p.boss.hp / p.boss.maxHp);
  const by = footY - spr.h - 14;
  if (!(invis && !isMe)) {
    g.fillStyle = '#111018';
    g.fillRect(x - w / 2 - 1, by - 1, w + 2, 4);
    g.fillStyle = pct <= BOSS_COMMON.lowHpPulse && Math.floor(o.time * 10) % 2 ? '#ffffff' : def.color;
    g.fillRect(x - w / 2, by, Math.max(1, Math.round(w * pct)), 2);
  }
}

function drawProjectiles(g, cam, view, time, trails) {
  for (const pr of view.projectiles) {
    const [x, y] = worldToArt(cam, pr.x, pr.y);
    const owner = view.players.find((p) => p.id === pr.ownerId);
    const accent = pr.team === 'boss' ? '#ffffff' : owner ? slotColor(owner.slot) : '#ffffff';
    const tr = trails.get(pr.id) || [];
    // smuga
    for (let i = 0; i < tr.length - 1; i++) {
      const [ax, ay] = worldToArt(cam, tr[i][0], tr[i][1]);
      g.fillStyle = dither(g, pr.team === 'boss' ? RED : accent, 0.25 + i * 0.15);
      line(g, ax, ay - 3, x, y - 3);
    }
    if (pr.kind === 'pierce' || pr.kind === 'bolt') {
      const sp = Math.hypot(pr.vx, pr.vy) || 1;
      const L = pr.kind === 'pierce' ? 9 : 4;
      g.fillStyle = accent;
      line(g, x - (pr.vx / sp) * L, y - 3 - (pr.vy / sp) * L, x, y - 3);
      g.fillStyle = '#ffffff';
      g.fillRect(x, y - 3, 1, 1);
      continue;
    }
    const s = getProjectileSprite(pr.kind, accent, Math.floor(time * 12));
    if (s) drawSprite(g, s, x, y - 3 + Math.floor(s.h / 2));
    else {
      g.fillStyle = pr.team === 'boss' ? RED_DARK : accent;
      fillCircle(g, x, y - 3, Math.max(1, pr.r * PPM));
    }
  }
}

function drawFxWorld(g, cam, fx) {
  for (const s of fx.swings) {
    const [x, y] = worldToArt(cam, s.x, s.y);
    const k = s.life / 0.14;
    g.fillStyle = dither(g, '#ffffff', 0.4 + k * 0.6);
    const pts = sectorPoints(x, y - 3, s.range * PPM, s.a, Math.min(Math.PI, s.arc), 10);
    for (let i = 1; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    g.fillStyle = dither(g, s.color, 0.5 * k);
    const pts2 = sectorPoints(x, y - 3, s.range * PPM - 2, s.a, Math.min(Math.PI, s.arc), 10);
    for (let i = 1; i < pts2.length - 1; i++) line(g, pts2[i][0], pts2[i][1], pts2[i + 1][0], pts2[i + 1][1]);
  }
  for (const p of fx.parts) {
    const [x, y] = worldToArt(cam, p.x, p.y);
    g.fillStyle = p.life / p.max > 0.4 ? p.color : dither(g, p.color, 0.5);
    g.fillRect(x, y - 3, p.size, p.size);
  }
  for (const b of fx.bolts) {
    g.fillStyle = b.life > 0.2 ? '#ffffff' : '#9fe8ff';
    for (let i = 0; i < b.pts.length - 1; i++) {
      const [ax, ay] = worldToArt(cam, b.pts[i][0], b.pts[i][1]);
      const [bx, by] = worldToArt(cam, b.pts[i + 1][0], b.pts[i + 1][1]);
      const mx = (ax + bx) / 2 + (Math.random() - 0.5) * 8;
      const my = (ay + by) / 2 + (Math.random() - 0.5) * 8;
      line(g, ax, ay - 4, mx, my - 4);
      line(g, mx, my - 4, bx, by - 4);
    }
  }
}

/** Napisy w świecie (nicki, liczby obrażeń) — w pełnej rozdzielczości, fontem pikselowym. */
function drawScreenWorldText(ctx, cam, view, o) {
  const S = cam.S;
  ctx.textAlign = 'center';
  ctx.font = `${Math.max(10, Math.round(S * 4))}px "Pixelify Sans", monospace`;
  for (const p of view.players) {
    if (!p.alive || !p.connected) continue;
    if (p.boss && p.boss.invisT > 0 && !o.meIds.includes(p.id)) continue;
    const [ax, ay] = worldToArt(cam, p.x, p.y);
    const yOff = p.boss ? -Math.round(BOSS_R * PPM * 0.75) - 48 : -24;
    ctx.fillStyle = '#000';
    ctx.fillText(p.nick, ax * S + 1, (ay + yOff) * S + 1);
    ctx.fillStyle = o.meIds.includes(p.id) ? '#ffffff' : slotColor(p.slot);
    ctx.fillText(p.nick, ax * S, (ay + yOff) * S);
  }
  for (const t of o.fx.texts) {
    const [ax, ay] = worldToArt(cam, t.x, t.y);
    const k = t.life / t.max;
    const size = Math.round((t.big ? 7 : 5) * S * (k > 0.8 ? 1 + (k - 0.8) * 2 : 1));
    ctx.font = `${size}px "Pixelify Sans", monospace`;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.fillStyle = '#000';
    ctx.fillText(t.text, ax * S + 2, ay * S + 2);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, ax * S, ay * S);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/** Korony krzaków rysowane NAD postaciami (ukrycie). */
function drawBushes(g, cam, map, time) {
  for (const z of map.hazards) {
    if (z.kind !== 'bush') continue;
    const [x, y] = worldToArt(cam, z.x, z.y);
    drawSprite(g, getBushSprite(z.r ?? 1.5, Math.floor(time * 2)), x, y);
  }
}

/** Strefy umiejętności bohaterów (Meteor, Korzenie) — w kolorze gracza, nie czerwone. */
function drawHeroZone(g, cam, z, time, view) {
  const owner = view.players.find((p) => p.id === z.ownerId);
  const c = owner ? slotColor(owner.slot) : '#9be7ff';
  const [x, y] = worldToArt(cam, z.x, z.y);
  const r = z.r * PPM;
  const telegraph = z.warn > 0;
  const p = telegraph && z.warnTotal > 0 ? 1 - z.warn / z.warnTotal : 1;
  if (z.kind === 'roots' && !telegraph) {
    g.fillStyle = dither(g, '#3f8f3a', 0.45 + Math.sin(time * 5) * 0.08);
    fillCircle(g, x, y, r);
    g.fillStyle = '#6fe07a';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + time * 0.6;
      const rr = r * (0.3 + ((i * 37) % 10) / 14);
      g.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 2);
    }
  } else {
    g.fillStyle = dither(g, c, telegraph ? 0.15 + p * 0.35 : 0.8);
    fillCircle(g, x, y, telegraph ? r * p : r);
  }
  g.fillStyle = c;
  strokeCircle(g, x, y, r);
}

/** Podgląd celowania przeciąganiem (dotyk): linia z kropek i znacznik celu. */
function drawAimPreview(g, cam, view, o) {
  const me = view.players.find((p) => p.id === o.meIds[0]);
  if (!me || !me.alive) return;
  const [x0, y0] = worldToArt(cam, me.x, me.y);
  const [x1, y1] = worldToArt(cam, o.aim.x, o.aim.y);
  const c = slotColor(me.slot);
  g.fillStyle = c;
  line(g, x0, y0 - 4, x1, y1 - 4, 3);
  if (o.aim.ability) {
    g.fillStyle = dither(g, c, 0.3);
    fillCircle(g, x1, y1, 6);
    g.fillStyle = '#ffffff';
    strokeCircle(g, x1, y1, 6);
  } else {
    g.fillStyle = '#ffffff';
    g.fillRect(x1 - 2, y1 - 4, 5, 1);
    g.fillRect(x1, y1 - 6, 1, 5);
  }
}
