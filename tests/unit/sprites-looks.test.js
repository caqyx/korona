import { describe, it, expect } from 'vitest';
import { HERO_FRAMES, HERO_W, HERO_H, HERO_BODY_ORIGIN, buildHero } from '../../src/render/sprites/heroes.js';
import { HEAD, HAT_IDS, NOSE_IDS, hatSize, resolveLook, buildCosmeticIcon } from '../../src/render/sprites/cosmetics.js';
import { COSMETICS, DEFAULT_LOOK, cosmeticsOf } from '../../src/sim/cosmetics.js';

const CLASSES = ['rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid'];
const HEX = /^#[0-9a-f]{6}$/;
const MARKER = /^#fe00f/;
const frames = () => Object.entries(HERO_FRAMES).flatMap(([a, n]) => Array.from({ length: n }, (_, f) => [a, f]));
const same = (a, b) => a.px.length === b.px.length && a.px.every((c, i) => c === b.px[i]);

describe('hero cosmetics', () => {
  it('catalog ids are all supported by the sprite code', () => {
    for (const c of cosmeticsOf('hat')) if (c.id !== 'none') expect(HAT_IDS, c.id).toContain(c.id);
    for (const c of cosmeticsOf('nose')) if (c.id !== 'none') expect(NOSE_IDS, c.id).toContain(c.id);
    for (const id of CLASSES) expect(HEAD[id], id).toBeTruthy();
  });

  it('default look gives exactly the same pixels as no look', () => {
    for (const id of CLASSES)
      for (const [a, f] of frames()) {
        const base = buildHero(id, '#4fc3ff', a, f);
        expect(same(base, buildHero(id, '#4fc3ff', a, f, DEFAULT_LOOK)), `${id}:${a}:${f}`).toBe(true);
        expect(same(base, buildHero(id, '#4fc3ff', a, f, { color: 'default', hat: 'none', nose: 'none' }))).toBe(true);
      }
  });

  it('every class × colour/hat/nose renders all frames on the canvas', () => {
    const looks = [
      ...cosmeticsOf('color').map((c) => ({ color: c.id, hat: 'none', nose: 'none' })),
      ...cosmeticsOf('hat').map((c) => ({ color: 'default', hat: c.id, nose: 'none' })),
      ...cosmeticsOf('nose').map((c) => ({ color: 'default', hat: 'none', nose: c.id })),
      { color: 'rainbow', hat: 'party', nose: 'clown' },
    ];
    for (const id of CLASSES)
      for (const lk of looks)
        for (const [a, f] of frames()) {
          const b = buildHero(id, '#ff5ec4', a, f, lk);
          expect(b.w).toBe(HERO_W);
          expect(b.h).toBe(HERO_H);
          expect(b.count()).toBeGreaterThan(80);
          expect(b.px.every((c) => c === null || (HEX.test(c) && !MARKER.test(c))), `${id}:${JSON.stringify(lk)}:${a}${f}`).toBe(true);
        }
  });

  it('cosmetics actually change the sprite', () => {
    for (const id of CLASSES) {
      const base = buildHero(id, '#4fc3ff', 'idle', 0);
      for (const c of COSMETICS) {
        if (c.id === 'none' || c.id === 'default' || (c.cls && c.cls !== id)) continue;
        const lk = { ...DEFAULT_LOOK, [c.kind]: c.id };
        expect(same(base, buildHero(id, '#4fc3ff', 'idle', 0, lk)), `${id} ${c.kind}:${c.id}`).toBe(false);
      }
    }
  });

  it('hats fit inside the canvas for every class (incl. walk bob and dash lean)', () => {
    for (const id of CLASSES)
      for (const hat of HAT_IDS) {
        const { w, h } = hatSize(hat);
        const [cx, base] = HEAD[id].hat;
        const top = HERO_BODY_ORIGIN.y + base - h + 1 - 1; // bob -1
        const left = HERO_BODY_ORIGIN.x + cx - Math.floor(w / 2) - 1; // walk/attack -1
        const right = HERO_BODY_ORIGIN.x + cx - Math.floor(w / 2) + w - 1 + 1 + 2; // attack +1, dash lean +2
        expect(top, `${id}:${hat}`).toBeGreaterThanOrEqual(0);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThan(HERO_W);
      }
  });

  it('class skins work only on their own class', () => {
    for (const c of COSMETICS.filter((x) => x.cls)) {
      for (const id of CLASSES) {
        const lk = { color: c.id, hat: 'none', nose: 'none' };
        expect(resolveLook(lk, id).color).toBe(c.cls === id ? c.id : 'default');
        if (c.cls !== id) expect(same(buildHero(id, '#4fc3ff', 'walk', 1, lk), buildHero(id, '#4fc3ff', 'walk', 1)), `${c.id} on ${id}`).toBe(true);
      }
    }
  });

  it('unknown ids fall back to defaults', () => {
    expect(resolveLook({ color: 'nope', hat: 'nope', nose: 'nope' }, 'mag')).toEqual(DEFAULT_LOOK);
    expect(resolveLook(null, 'mag')).toEqual(DEFAULT_LOOK);
  });

  it('cosmetic icons are 12×12 and non-empty', () => {
    for (const c of COSMETICS) {
      const b = buildCosmeticIcon(c.kind, c.id);
      expect([b.w, b.h]).toEqual([12, 12]);
      expect(b.count(), `${c.kind}:${c.id}`).toBeGreaterThan(8);
    }
  });
});
