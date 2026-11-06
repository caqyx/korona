import { describe, it, expect } from 'vitest';
import { MAPS, MAP_IDS } from '../../src/sim/maps.js';
import { PPM } from '../../src/render/sprites.js';
import { BIOME_PALETTES, BIOME_IDS, HAZARD_PALETTES, HAZARD_PAINTERS, HAZARD_KINDS, MARGIN_M, WALL_M, mapGeometry, biomePainter, buildMapRaster } from '../../src/render/maps/ground.js';
import { OBSTACLE_KINDS, PROP_PALETTES, buildObstacle, buildBush, BUSH_FRAMES } from '../../src/render/maps/props.js';
import { drawHazardsAnimated } from '../../src/render/maps/anim.js';
import { hash, vnoise, Raster, pack, unpack } from '../../src/render/maps/noise.js';
import { buildMinion, MINION_FRAMES } from '../../src/render/sprites/misc.js';
import { EXTRA_ICON_NAMES, GLYPHS, resolveIcon, buildIcon } from '../../src/render/sprites/icons.js';

const HEX = /^#[0-9a-f]{6}$/;
const allHexDeep = (o) => (typeof o === 'string' ? HEX.test(o) : Array.isArray(o) ? o.every(allHexDeep) : Object.values(o).every(allHexDeep));

describe('map art: palettes and coverage', () => {
  it('every palette colour is #rrggbb', () => {
    expect(allHexDeep(BIOME_PALETTES)).toBe(true);
    expect(allHexDeep(HAZARD_PALETTES)).toBe(true);
    expect(allHexDeep(PROP_PALETTES)).toBe(true);
  });
  it('every MAPS entry has a dedicated biome renderer', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      expect(BIOME_IDS, id).toContain(m.biome);
      expect(BIOME_PALETTES[m.biome], id).toBeTruthy();
      const p = biomePainter(m);
      for (const fn of ['floor', 'wall', 'outer']) expect(typeof p[fn], `${id}.${fn}`).toBe('function');
    }
    // biomy różne od kamiennego nie dostają domyślnego paintera
    const used = new Set(MAP_IDS.map((id) => biomePainter(MAPS[id])));
    expect(used.size).toBe(MAP_IDS.length);
  });
  it('every hazard and obstacle kind used in MAPS is supported', () => {
    for (const id of MAP_IDS) {
      for (const z of MAPS[id].hazards) {
        expect(HAZARD_KINDS, `${id}:${z.kind}`).toContain(z.kind);
        expect(typeof HAZARD_PAINTERS[z.kind]).toBe('function');
      }
      for (const o of MAPS[id].obstacles) expect(OBSTACLE_KINDS, `${id}:${o.kind}`).toContain(o.kind);
    }
  });
});

describe('map art: noise + raster', () => {
  it('hash and noise are deterministic and in range', () => {
    expect(hash(3, 4, 5)).toBe(hash(3, 4, 5));
    for (let i = 0; i < 200; i++) {
      const h = hash(i, -i * 7, 3);
      const v = vnoise(i * 0.37, i * 0.11, 2);
      expect(h >= 0 && h < 1).toBe(true);
      expect(v >= 0 && v <= 1).toBe(true);
    }
  });
  it('pack/unpack round trip and raster blend', () => {
    expect(unpack(pack('#102030'))).toEqual([16, 32, 48, 255]);
    const r = new Raster(2, 1);
    r.set(0, 0, '#000000');
    r.blend(0, 0, '#ffffff', 0.5);
    r.blend(1, 0, '#ffffff', 0.5); // przezroczysty zostaje
    expect(unpack(r.get(0, 0)).slice(0, 3)).toEqual([128, 128, 128]);
    expect(r.get(1, 0)).toBe(0);
  });
});

describe('map art: background raster', () => {
  it('geometry has ≥2 m margin and centre at world (0,0)', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      const g = mapGeometry(m);
      const hw = m.shape === 'rect' ? m.hw : m.radius;
      const hh = m.shape === 'rect' ? m.hh : m.radius;
      expect(g.cx).toBeGreaterThanOrEqual((hw + WALL_M + 2) * PPM);
      expect(g.cy).toBeGreaterThanOrEqual((hh + WALL_M + 2) * PPM);
      expect(MARGIN_M).toBeGreaterThanOrEqual(2);
      expect(g.sd(0, 0)).toBeGreaterThan(0);
      expect(g.sd(hw + 0.5, 0)).toBeLessThan(0);
    }
  });
  it('every map builds a deterministic, opaque playfield with readable hazards', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      const a = buildMapRaster(m);
      const b = buildMapRaster(m);
      expect(a.raster.px).toEqual(b.raster.px);
      const at = (x, y) => a.raster.get(Math.floor(a.cx + x * PPM), Math.floor(a.cy + y * PPM));
      expect(at(0, 0), id).not.toBe(0);
      expect(at(1.3, 1.3), id).not.toBe(0);
      for (const z of m.hazards) {
        const v = unpack(at(z.x, z.y));
        expect(v[3], `${id}:${z.kind}`).toBe(255);
        const pal = HAZARD_PALETTES[z.kind];
        // centrum hazardu ma kolor z palety hazardu
        const cols = new Set(JSON.stringify(pal).match(/#[0-9a-f]{6}/g).map((h) => pack(h)));
        if (z.kind !== 'bush') expect(cols.has(at(z.x + 0.4, z.y + 0.4)), `${id}:${z.kind}`).toBe(true);
      }
    }
  });
});

describe('map art: props and animation', () => {
  it('obstacle sprites: width ≈ 2r·PPM, anchor bottom-centre', () => {
    for (const id of MAP_IDS)
      for (const o of MAPS[id].obstacles) {
        const s = buildObstacle(o.kind, o.r, PPM);
        expect(s.buf.w).toBeGreaterThanOrEqual(Math.round(2 * o.r * PPM));
        expect(s.buf.w).toBeLessThanOrEqual(Math.round(2 * o.r * PPM * 1.6) + 6);
        expect(s.oy).toBe(s.buf.h - 1);
        expect(s.ox).toBe(Math.floor(s.buf.w / 2));
        expect(s.buf.count()).toBeGreaterThan(40);
        expect(s.buf.px.every((c) => c === null || HEX.test(c))).toBe(true);
      }
  });
  it('bush sprites: centre anchor, frames differ', () => {
    for (const r of [1.6, 2]) {
      const a = buildBush(r, 0, PPM);
      const b = buildBush(r, 1, PPM);
      expect(a.ox).toBe(Math.floor(a.buf.w / 2));
      expect(a.oy).toBe(Math.floor(a.buf.h / 2));
      expect(a.buf.w).toBe(Math.round(r * 2 * PPM) + 4);
      expect(a.buf.px).not.toEqual(b.buf.px);
      expect(buildBush(r, BUSH_FRAMES, PPM).buf.px).toEqual(a.buf.px);
    }
  });
  it('animated hazards stay cheap (fillRect budget) for every map', () => {
    for (const id of MAP_IDS) {
      let calls = 0;
      const g = { fillStyle: '', fillRect: () => calls++ };
      for (const t of [0, 1.234, 7.9, 33.3]) {
        calls = 0;
        drawHazardsAnimated(/** @type {any} */ (g), MAPS[id], (x, y) => [Math.round(400 + x * PPM), Math.round(300 + y * PPM)], t);
        expect(calls, `${id}@${t}`).toBeLessThan(500);
      }
    }
  });
});

describe('new minions and icons', () => {
  it('archer and brute render every frame', () => {
    expect(MINION_FRAMES.archer).toBeGreaterThanOrEqual(2);
    expect(MINION_FRAMES.brute).toBeGreaterThanOrEqual(2);
    for (const k of ['archer', 'brute', 'skeleton', 'spiderling'])
      for (let f = 0; f < MINION_FRAMES[k]; f++) {
        const { buf, ox, oy } = buildMinion(k, f);
        expect(buf.count(), `${k}:${f}`).toBeGreaterThan(30);
        expect(ox >= 0 && ox < buf.w && oy >= 0 && oy < buf.h).toBe(true);
      }
    const br = buildMinion('brute', 0).buf;
    expect([br.w, br.h]).toEqual([20, 20]);
  });
  it('upgrade and mode icons resolve to their own glyphs', () => {
    for (const n of EXTRA_ICON_NAMES) {
      const [glyph] = resolveIcon(n);
      expect(GLYPHS[glyph], n).toBeTruthy();
      expect(glyph, n).not.toBe('skull');
      const b = buildIcon(n);
      expect(b.w).toBe(12);
      expect(b.count(), n).toBeGreaterThan(20);
    }
    for (const g of Object.values(GLYPHS)) if (Array.isArray(g)) expect(g.length === 10 && g.every((r) => r.length === 10)).toBe(true);
  });
});
