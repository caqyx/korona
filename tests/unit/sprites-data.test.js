import { describe, it, expect } from 'vitest';
import { PixelBuffer, parseGrid, missingChars, ramp, mix, mod, OUTLINE } from '../../src/render/sprites/pixels.js';
import { HEROES, HERO_FRAMES, HERO_W, HERO_H, buildHero } from '../../src/render/sprites/heroes.js';
import { BOSS_TYPES, BOSS_FRAMES, buildBoss } from '../../src/render/sprites/bosses.js';
import { GLYPHS, iconNames, buildIcon, resolveIcon } from '../../src/render/sprites/icons.js';
import { buildMinion, buildTurret, buildCrown, buildPillar, buildProjectile, PROJECTILE_KINDS } from '../../src/render/sprites/misc.js';
import { SKIN_IDS, BOSS_IDS, BOSSES } from '../../src/sim/config.js';

const HEX = /^#[0-9a-f]{6}$/;
const allHex = (b) => b.px.every((c) => c === null || HEX.test(c));

describe('pixels', () => {
  it('parseGrid pads rows and maps spaces to transparent', () => {
    const g = parseGrid(['ab', 'c', ' d']);
    expect(g.w).toBe(2);
    expect(g.h).toBe(3);
    expect(g.cells[1]).toEqual(['c', '.']);
    expect(g.cells[2][0]).toBe('.');
  });
  it('missingChars reports unknown palette chars', () => {
    expect(missingChars(['ab.', 'xk'], { a: '#000', b: '#fff', k: '#111' })).toEqual(['x']);
  });
  it('outline surrounds pixels (4-neighbour)', () => {
    const b = new PixelBuffer(3, 3).set(1, 1, '#ffffff').outline();
    expect(b.get(1, 0)).toBe(OUTLINE);
    expect(b.get(0, 0)).toBe(null);
    expect(b.count()).toBe(5);
  });
  it('runs merge horizontal same-colour pixels', () => {
    const b = new PixelBuffer(4, 1).rect(0, 0, 3, 1, '#ff0000');
    expect(b.runs()).toEqual([[0, 0, 3, '#ff0000']]);
  });
  it('colour helpers', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(ramp('#ff3b5c')).toHaveLength(5);
    expect(ramp('#abc').every((c) => HEX.test(c))).toBe(true);
    expect(mod(-1, 4)).toBe(3);
    expect(mod(NaN, 4)).toBe(0);
  });
});

describe('sprite data', () => {
  it('hero grids are 12 wide and use known palette chars', () => {
    for (const id of SKIN_IDS) {
      const h = HEROES[id];
      expect(h, id).toBeTruthy();
      expect(h.body.every((r) => r.length === 12), id).toBe(true);
      const pal = { k: 1, A: 1, a: 1, q: 1, f: 1, F: 1, ...h.pal };
      expect(missingChars(h.body, pal), id).toEqual([]);
    }
  });
  it('every hero animation frame renders within bounds', () => {
    for (const id of SKIN_IDS)
      for (const [anim, n] of Object.entries(HERO_FRAMES))
        for (let f = 0; f < n; f++) {
          const b = buildHero(id, '#4fc3ff', anim, f);
          expect(b.w).toBe(HERO_W);
          expect(b.h).toBe(HERO_H);
          expect(b.count()).toBeGreaterThan(80);
          expect(allHex(b)).toBe(true);
        }
  });
  it('accent colour is visible on every hero', () => {
    const acc = new Set(ramp('#ff00aa').slice(1, 4));
    for (const id of SKIN_IDS) expect(buildHero(id, '#ff00aa', 'idle', 0).px.filter((c) => acc.has(c)).length, id).toBeGreaterThanOrEqual(8);
  });
  it('every boss from config renders all animations', () => {
    expect([...BOSS_TYPES].sort()).toEqual([...BOSS_IDS].sort());
    for (const t of BOSS_IDS) {
      expect(BOSSES[t].color).toMatch(/^#/);
      for (const [anim, n] of Object.entries(BOSS_FRAMES))
        for (let f = 0; f < n; f++) {
          const b = buildBoss(t, anim, f, BOSSES[t].color);
          expect(b.count(), `${t}:${anim}:${f}`).toBeGreaterThan(500);
          expect(allHex(b)).toBe(true);
        }
    }
  });
  it('icons: glyphs are 10x10 and every name resolves to a real glyph', () => {
    for (const [k, g] of Object.entries(GLYPHS)) if (Array.isArray(g)) expect(g.length === 10 && g.every((r) => r.length === 10), k).toBe(true);
    const names = iconNames();
    expect(names).toHaveLength(5 + 5 + 32);
    for (const n of names) {
      expect(GLYPHS[resolveIcon(n)[0]], n).toBeTruthy();
      const b = buildIcon(n);
      expect(b.w).toBe(12);
      expect(b.count(), n).toBeGreaterThan(10);
    }
  });
  it('misc sprites', () => {
    for (const k of ['skeleton', 'spiderling']) for (let f = 0; f < 2; f++) expect(buildMinion(k, f).buf.count()).toBeGreaterThan(10);
    expect(buildTurret('#ff9f43', 1).buf.count()).toBeGreaterThan(10);
    const c = buildCrown(0).buf;
    expect([c.w, c.h]).toEqual([12, 9]);
    const p = buildPillar(1.1, 12);
    expect(p.buf.w).toBeGreaterThanOrEqual(26);
    expect(p.oy).toBe(p.buf.h - 1);
    for (const k of PROJECTILE_KINDS) for (let f = 0; f < 4; f++) expect(buildProjectile(k, '#4fc3ff', f), k).toBeTruthy();
    expect(buildProjectile('nope', '#fff', 0)).toBe(null);
  });
});
