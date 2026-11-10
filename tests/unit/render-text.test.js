import { describe, it, expect } from 'vitest';
import { createFitCache } from '../../src/render/textFit.js';
import { pointsLabel } from '../../src/render/hudText.js';

/** Sztuczny pomiar: każdy znak ma szerokość 0,5 × rozmiar; liczy wywołania. */
function fakeMeasure() {
  const m = (str, size) => {
    m.calls++;
    return str.length * size * 0.5;
  };
  m.calls = 0;
  return m;
}

describe('createFitCache', () => {
  it('zwraca rozmiar wyjściowy, gdy napis się mieści', () => {
    const c = createFitCache();
    expect(c.fit(fakeMeasure(), 'abcd', 20, 8, 100)).toBe(20);
  });
  it('zmniejsza rozmiar krokiem 1, aż napis się zmieści', () => {
    const c = createFitCache();
    // 10 znaków × s × 0,5 ≤ 60 → s ≤ 12
    expect(c.fit(fakeMeasure(), 'abcdefghij', 20, 8, 60)).toBe(12);
  });
  it('nie schodzi poniżej rozmiaru minimalnego', () => {
    const c = createFitCache();
    expect(c.fit(fakeMeasure(), 'abcdefghijabcdefghij', 20, 9, 10)).toBe(9);
  });
  it('drugi raz nie mierzy (wynik z pamięci)', () => {
    const c = createFitCache();
    const m = fakeMeasure();
    const first = c.fit(m, 'abcdefghij', 20, 8, 60);
    const calls = m.calls;
    expect(calls).toBeGreaterThan(0);
    expect(c.fit(m, 'abcdefghij', 20, 8, 60)).toBe(first);
    expect(m.calls).toBe(calls);
  });
  it('inny tekst, rozmiar, minimum albo szerokość to osobne wpisy', () => {
    const c = createFitCache();
    const m = fakeMeasure();
    c.fit(m, 'abcdefghij', 20, 8, 60);
    expect(c.fit(m, 'abcdefghij', 20, 8, 80)).toBe(16);
    expect(c.fit(m, 'abcdefghij', 14, 8, 60)).toBe(12);
    expect(c.fit(m, 'abcdefghij', 20, 13, 60)).toBe(13);
    expect(c.fit(m, 'abcde', 20, 8, 60)).toBe(20);
    expect(c.size()).toBe(5);
  });
  it('pamięć ma ograniczoną wielkość — wypada najstarszy wpis', () => {
    const c = createFitCache(3);
    const m = fakeMeasure();
    for (const s of ['a', 'b', 'c', 'd']) c.fit(m, s, 10, 5, 100);
    expect(c.size()).toBe(3);
    const calls = m.calls;
    c.fit(m, 'd', 10, 5, 100); // nadal w pamięci
    expect(m.calls).toBe(calls);
    c.fit(m, 'a', 10, 5, 100); // wypadł — mierzony od nowa
    expect(m.calls).toBeGreaterThan(calls);
    expect(c.size()).toBe(3);
  });
  it('clear unieważnia wszystko', () => {
    const c = createFitCache();
    const m = fakeMeasure();
    c.fit(m, 'abc', 10, 5, 100);
    c.clear();
    expect(c.size()).toBe(0);
    const calls = m.calls;
    c.fit(m, 'abc', 10, 5, 100);
    expect(m.calls).toBeGreaterThan(calls);
  });
});

describe('pointsLabel', () => {
  it('wartości całkowite bez tyldy', () => {
    expect(pointsLabel(2)).toBe('+2');
    expect(pointsLabel(1)).toBe('+1');
    expect(pointsLabel(1.0000001)).toBe('+1');
  });
  it('ułamki jako przybliżenie słowem, nigdy z przecinkiem ani tyldą', () => {
    expect(pointsLabel(1.5)).toBe('ok. +2');
    expect(pointsLabel(1.2)).toBe('ok. +1');
    expect(pointsLabel(2 * (3 / 7))).toBe('ok. +1'); // 7 bohaterów
    expect(pointsLabel(2 * (3 / 4))).toBe('ok. +2'); // 4 bohaterów
    for (let heroes = 1; heroes <= 7; heroes++) expect(pointsLabel(2 * Math.min(1, 3 / heroes))).toMatch(/^(ok\. )?\+\d$/);
  });
  it('poniżej jednego punktu i zero', () => {
    expect(pointsLabel(0.4)).toBe('poniżej +1');
    expect(pointsLabel(0)).toBe('+0');
    expect(pointsLabel(NaN)).toBe('+0');
  });
});
