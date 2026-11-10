import { describe, it, expect } from 'vitest';
import { isOutside, placeBadge, dir8 } from '../../src/render/edgeGeometry.js';
import { hudScale, HUD_CHIPS_U, touchClusterRect, skillSlotsRect, deathPanelRect } from '../../src/render/hudLayout.js';

const box = { l: 50, t: 200, r: 1230, b: 670 };
const out = { x: 0, y: 0 };

describe('isOutside', () => {
  it('punkt w prostokącie i na jego brzegu nie jest poza kadrem', () => {
    expect(isOutside(box, 640, 400)).toBe(false);
    expect(isOutside(box, 50, 200)).toBe(false);
    expect(isOutside(box, 1230, 670)).toBe(false);
  });
  it('każda z czterech stron jest wykrywana', () => {
    expect(isOutside(box, 49, 400)).toBe(true);
    expect(isOutside(box, 1231, 400)).toBe(true);
    expect(isOutside(box, 640, 199)).toBe(true);
    expect(isOutside(box, 640, 671)).toBe(true);
  });
  it('zapas (slack) daje histerezę przy granicy', () => {
    expect(isOutside(box, 40, 400, 20)).toBe(false);
    expect(isOutside(box, 29, 400, 20)).toBe(true);
  });
});

describe('placeBadge', () => {
  it('cel w kadrze zostaje na miejscu', () => {
    expect(placeBadge(box, [], 0, 600, 300, 10, out)).toEqual({ x: 600, y: 300 });
  });
  it('cel poza kadrem ląduje na najbliższym brzegu / w narożniku', () => {
    expect(placeBadge(box, [], 0, 640, -500, 10, out)).toEqual({ x: 640, y: 200 });
    expect(placeBadge(box, [], 0, 5000, 400, 10, out)).toEqual({ x: 1230, y: 400 });
    expect(placeBadge(box, [], 0, -90, 9000, 10, out)).toEqual({ x: 50, y: 670 });
  });
  it('wypycha znacznik z wykluczenia najkrótszą drogą, z odstępem pad', () => {
    const slots = [{ x: 0, y: 600, w: 330, h: 120 }];
    // cel pod lewym dolnym rogiem: po przyciągnięciu (200, 670) leży na slotach — bliżej w górę niż w bok
    expect(placeBadge(box, slots, 1, 200, 900, 20, out)).toEqual({ x: 200, y: 580 });
    // tuż przy prawej krawędzi slotów bliżej jest w bok
    expect(placeBadge(box, slots, 1, 340, 900, 20, out)).toEqual({ x: 350, y: 670 });
  });
  it('wynik nigdy nie leży w wykluczeniu ani poza bezpiecznym prostokątem', () => {
    const excl = [
      { x: 0, y: 600, w: 330, h: 120 },
      { x: 900, y: 420, w: 380, h: 300 },
      { x: 780, y: 196, w: 500, h: 60 },
    ];
    const pad = 20;
    for (let a = 0; a < 360; a += 3) {
      const tx = 640 + Math.cos((a * Math.PI) / 180) * 3000;
      const ty = 400 + Math.sin((a * Math.PI) / 180) * 3000;
      const p = placeBadge(box, excl, excl.length, tx, ty, pad, out);
      expect(isOutside(box, p.x, p.y)).toBe(false);
      for (const e of excl) {
        const inside = p.x > e.x - pad && p.x < e.x + e.w + pad && p.y > e.y - pad && p.y < e.y + e.h + pad;
        expect(inside, `kąt ${a}: (${p.x}, ${p.y})`).toBe(false);
      }
    }
  });
  it('wykluczenie, z którego nie ma wyjścia w kadrze, zostawia punkt przyciągnięty', () => {
    const all = [{ x: -100, y: -100, w: 5000, h: 5000 }];
    expect(placeBadge(box, all, 1, 640, -50, 10, out)).toEqual({ x: 640, y: 200 });
  });
  it('bierze pod uwagę tylko pierwsze n wykluczeń (tablica robocza bywa dłuższa)', () => {
    const excl = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 600, w: 330, h: 120 }];
    expect(placeBadge(box, excl, 1, 200, 900, 20, out)).toEqual({ x: 200, y: 670 });
  });
});

describe('dir8', () => {
  it('zaokrągla kierunek do 8 stron', () => {
    expect(dir8(10, 0, out)).toEqual({ x: 1, y: 0 });
    expect(dir8(-3, 0.2, out)).toEqual({ x: -1, y: 0 });
    expect(dir8(0, -7, out)).toEqual({ x: 0, y: -1 });
    expect(dir8(0.1, 5, out)).toEqual({ x: 0, y: 1 });
    expect(dir8(4, 4, out)).toEqual({ x: 1, y: 1 });
    expect(dir8(-4, 5, out)).toEqual({ x: -1, y: 1 });
    expect(dir8(6, -5, out)).toEqual({ x: 1, y: -1 });
    expect(dir8(-2, -2, out)).toEqual({ x: -1, y: -1 });
  });
  it('wektor zerowy nie ma kierunku', () => {
    expect(dir8(0, 0, out)).toEqual({ x: 0, y: 0 });
  });
});

describe('geometria HUD używana przez wskaźniki', () => {
  const sizes = [
    [1280, 720],
    [844, 390],
    [1920, 1080],
    [667, 375],
  ];
  it('sloty umiejętności i panel śmierci leżą na dole ekranu i nie nachodzą na siebie', () => {
    for (const [w, h] of sizes) {
      const s = skillSlotsRect(w, h);
      const d = deathPanelRect(w, h, true);
      expect(s.y + s.h).toBe(h);
      expect(d.y + d.h).toBeLessThan(h);
      expect(d.x, `${w}x${h}`).toBeGreaterThanOrEqual(s.x + s.w);
      expect(d.x + d.w).toBeLessThanOrEqual(w - d.x + 1);
    }
  });
  it('panel śmierci nie nachodzi na klaster przycisków dotykowych', () => {
    for (const [w, h] of sizes) {
      const d = deathPanelRect(w, h, true);
      expect(d.x + d.w, `${w}x${h}`).toBeLessThanOrEqual(touchClusterRect(w, h).x);
    }
  });
  it('panel śmierci bez zabójcy jest niższy', () => {
    expect(deathPanelRect(1280, 720, false).h).toBeLessThan(deathPanelRect(1280, 720, true).h);
  });
  it('pod górnym pasem HUD zostaje miejsce na akcję', () => {
    for (const [w, h] of sizes) expect(HUD_CHIPS_U * hudScale(w, h)).toBeLessThan(h * 0.3);
  });
});
