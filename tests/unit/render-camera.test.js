import { describe, it, expect } from 'vitest';
import { createCamera, updateCamera, cameraTarget, isBenched, worldToScreen, snapScale, clampAxis, followScale, fitScale } from '../../src/render/camera.js';
import { damageLeader } from '../../src/render/feedback.js';
import { hudChipsPx } from '../../src/render/hudLayout.js';

const hero = (id, o = {}) => ({ id, x: 0, y: 0, alive: true, connected: true, ai: false, boss: null, dnf: false, benched: false, respawnT: 0, dmgToBoss: 0, claim0: 0, ...o });

describe('isBenched', () => {
  it('tylko martwy gracz z flagą benched czeka „po fali”', () => {
    expect(isBenched(hero('a', { alive: false, benched: true }))).toBe(true);
    expect(isBenched(hero('a', { alive: false, respawnT: 3 }))).toBe(false);
    expect(isBenched(hero('a', { alive: true, benched: true }))).toBe(false);
    expect(isBenched(null)).toBe(false);
  });
  it('długie albo nieskończone odliczanie bez flagi nie jest już heurystyką', () => {
    expect(isBenched(hero('a', { alive: false, respawnT: 999 }))).toBe(false);
    expect(isBenched(hero('a', { alive: false, respawnT: Infinity }))).toBe(false);
  });
});

describe('cameraTarget', () => {
  it('żywy gracz: kamera idzie za nim', () => {
    const me = hero('me', { x: 3, y: 4 });
    expect(cameraTarget({ players: [me] }, me)).toBe(me);
  });
  it('martwy z odliczaniem: miejsce śmierci', () => {
    const me = hero('me', { x: 3, y: 4, alive: false, respawnT: 2 });
    const ally = hero('ally', { x: 9, y: 9 });
    expect(cameraTarget({ players: [me, ally] }, me)).toEqual({ x: 3, y: 4, dead: true });
  });
  it('czekający do końca fali (Przetrwanie): najbliższy żywy sojusznik, nie AI', () => {
    const me = hero('me', { x: 0, y: 0, alive: false, benched: true });
    const far = hero('far', { x: 10, y: 0 });
    const near = hero('near', { x: 2, y: 1 });
    const ai = hero('ai', { x: 1, y: 0, ai: true });
    const dead = hero('dead', { x: 0.5, y: 0, alive: false, benched: true });
    expect(cameraTarget({ players: [me, far, ai, dead, near] }, me)).toEqual({ x: 2, y: 1, dead: true });
  });
  it('czekający bez żywych sojuszników: miejsce śmierci', () => {
    const me = hero('me', { x: 5, y: 6, alive: false, benched: true });
    expect(cameraTarget({ players: [me] }, me)).toEqual({ x: 5, y: 6, dead: true });
  });
});

describe('kamera follow a górny pas HUD', () => {
  it('cel stoi w połowie wolnej części ekranu pod panelami', () => {
    for (const [w, h] of [[1280, 720], [844, 390]]) {
      const cam = createCamera();
      cam.mode = 'follow';
      cam.viewM = 22;
      cam.lookAhead = 0;
      const target = hero('me', { x: 0, y: 0 });
      updateCamera(cam, w, h, target, 0.016, undefined);
      const [, sy] = worldToScreen(cam, target.x, target.y);
      const hud = hudChipsPx(w, h);
      expect(Math.abs(sy - (hud + (h - hud) / 2)), `${w}x${h}`).toBeLessThanOrEqual(cam.S);
    }
  });
});

describe('damageLeader (wyścig o koronę w HUD)', () => {
  const view = (...players) => ({ players });
  it('samo przeniesione roszczenie nie daje prowadzenia', () => {
    expect(damageLeader(view(hero('a', { dmgToBoss: 50, claim0: 50 }), hero('b')))).toBe(null);
  });
  it('świeże obrażenia ponad przeniesione — lider', () => {
    const a = hero('a', { dmgToBoss: 51, claim0: 50 });
    expect(damageLeader(view(a, hero('b', { dmgToBoss: 20 })))).toBe(a);
  });
  it('lider z samym przeniesionym roszczeniem zasłania świeże, mniejsze obrażenia rywala', () => {
    expect(damageLeader(view(hero('a', { dmgToBoss: 50, claim0: 50 }), hero('b', { dmgToBoss: 20 })))).toBe(null);
  });
  it('remis rozstrzygany jak w symulacji (niższe id), niezależnie od kolejności', () => {
    const a = hero('a', { dmgToBoss: 30 });
    const b = hero('b', { dmgToBoss: 30 });
    expect(damageLeader(view(a, b))).toBe(a);
    expect(damageLeader(view(b, a))).toBe(a);
  });
  it('boss, AI, rozłączeni i DNF się nie liczą', () => {
    const players = [hero('boss', { boss: {}, dmgToBoss: 99 }), hero('ai', { ai: true, dmgToBoss: 99 }), hero('off', { connected: false, dmgToBoss: 99 }), hero('dnf', { dnf: true, dmgToBoss: 99 })];
    expect(damageLeader(view(...players))).toBe(null);
  });
});

describe('skala i ograniczenia kamery', () => {
  it('snapScale: od 2× całkowite, niżej ćwiartki, nigdy poniżej 1', () => {
    expect(snapScale(3.9)).toBe(3);
    expect(snapScale(2)).toBe(2);
    expect(snapScale(1.99)).toBe(1.75);
    expect(snapScale(1.3)).toBe(1.25);
    expect(snapScale(0.4)).toBe(1);
  });
  it('clampAxis: za celem, ale nie dalej niż granice; mała mapa wyśrodkowana', () => {
    expect(clampAxis(0, 5, -20, 20)).toBe(0);
    expect(clampAxis(-30, 5, -20, 20)).toBe(-15);
    expect(clampAxis(30, 5, -20, 20)).toBe(15);
    expect(clampAxis(7, 25, -20, 20)).toBe(0);
    expect(clampAxis(7, 25, -20, 30)).toBe(5);
  });
  it('followScale nie schodzi poniżej 2× i jest całkowita; fitScale mieści arenę pod pasem', () => {
    const ext = { hw: 16, hh: 12 };
    for (const [w, h] of [[1280, 720], [844, 390], [1920, 1080], [360, 640]]) {
      const s = followScale(w, h, ext, 30);
      expect(s).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(s)).toBe(true);
      const band = 62;
      const f = fitScale(w, h, ext, band);
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(fitScale(w, h, ext, 0));
    }
  });
});
