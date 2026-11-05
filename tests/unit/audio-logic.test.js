import { describe, it, expect } from 'vitest';
import { parseNote, noteToMidi, midiToFreq, envelopePoints, jitter, songStepAt, stepDuration, pickStartTime } from '../../src/audio/theory.js';
import { parseTrack, compileSong } from '../../src/audio/pattern.js';
import { SONGS } from '../../src/audio/songs.js';
import { VoiceLimiter } from '../../src/audio/voices.js';
import { STORAGE_KEY, DEFAULT_SETTINGS, sanitizeSettings, loadSettings, saveSettings, sliderToGain } from '../../src/audio/settings.js';

const fakeStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const throwingStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };

describe('teoria', () => {
  it('nuty i częstotliwości', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
    expect(parseNote('A3m').midis).toEqual([57, 60, 64]);
    expect(parseNote('E3M').midis).toEqual([52, 56, 59]);
    expect(parseNote('A2pw').midis).toEqual([45, 52, 57]);
    expect(parseNote('H4')).toBeNull();
    expect(parseNote('A4xyz')).toBeNull();
  });

  it('obwiednia: start i koniec w zerze, czasy niemalejące, szczyt zachowany', () => {
    for (const dur of [0.001, 0.01, 0.05, 0.3, 2]) {
      const pts = envelopePoints(dur, 0.5, { a: 0.01, d: 0.1, s: 0.6, r: 0.05 });
      expect(pts[0]).toEqual([0, 0]);
      expect(pts[pts.length - 1][1]).toBe(0);
      expect(pts[pts.length - 1][0]).toBeCloseTo(Math.max(0.002, dur));
      for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThanOrEqual(pts[i - 1][0]);
      expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(0.5);
    }
  });

  it('jitter mieści się w ±spread', () => {
    let s = 1;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
      const j = jitter(rng, 0.04);
      expect(j).toBeGreaterThanOrEqual(0.96);
      expect(j).toBeLessThanOrEqual(1.04);
    }
    expect(jitter(() => 0, 0.05)).toBeCloseTo(0.95);
    expect(jitter(() => 1, 0.05)).toBeCloseTo(1.05);
  });

  it('kroki utworu z pętlą i bez', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125);
    expect(songStepAt(5, 32, 0, true)).toBe(5);
    expect(songStepAt(32, 32, 0, true)).toBe(0);
    expect(songStepAt(40, 32, 16, true)).toBe(24);
    expect(songStepAt(48, 32, 16, true)).toBe(16);
    expect(songStepAt(32, 32, 0, false)).toBe(-1);
  });

  it('start nowego trybu: do taktu, do miary, albo od razu', () => {
    const cur = { t0: 10, stepDur: 0.125, stepsPerBar: 16, stepsPerBeat: 4 }; // takt 2 s, miara 0.5 s
    expect(pickStartTime(5, null)).toBeCloseTo(5.06);
    expect(pickStartTime(11.5, cur)).toBeCloseTo(12); // 0.5 s do taktu
    expect(pickStartTime(10.2, cur)).toBeCloseTo(10.5); // do taktu 1.8 s > maxWait → miara
    expect(pickStartTime(10.2, cur, { quantize: 'beat' })).toBeCloseTo(10.5);
    expect(pickStartTime(10.2, cur, { quantize: 'none' })).toBeCloseTo(10.26);
    expect(pickStartTime(11.97, cur)).toBeCloseTo(12.5); // zbyt blisko granicy → następna miara
    expect(pickStartTime(5, cur)).toBeCloseTo(5.06); // bieżący jeszcze nie wystartował
  });
});

describe('tracker', () => {
  it('parsuje nuty, przedłużenia i pauzy', () => {
    const { steps, events } = parseTrack('A4 - - . C5 | E5m - . .', 'tone');
    expect(steps).toBe(9);
    expect(events).toEqual([
      { step: 0, len: 3, midis: [69] },
      { step: 4, len: 1, midis: [72] },
      { step: 5, len: 2, midis: [76, 79, 83] },
    ]);
  });
  it('perkusja: len = odstęp do następnego uderzenia', () => {
    const { events } = parseTrack('X . x . . o . r', 'drum');
    expect(events.map((e) => [e.step, e.len, e.hit])).toEqual([[0, 2, 'X'], [2, 3, 'x'], [5, 2, 'o'], [7, 1, 'r']]);
  });
  it('odrzuca błędne tokeny', () => {
    expect(() => parseTrack('- A4', 'tone')).toThrow();
    expect(() => parseTrack('Q4', 'tone')).toThrow();
    expect(() => parseTrack('x y', 'drum')).toThrow();
  });

  for (const [name, song] of Object.entries(SONGS)) {
    it(`utwór '${name}' kompiluje się: równe ścieżki, pełne takty, rozsądne zakresy`, () => {
      const c = compileSong(song);
      expect(c.len % 16).toBe(0);
      expect(c.loopStart).toBeLessThan(c.len);
      for (const ch of c.channels) {
        expect(ch.byStep.length).toBe(c.len);
        expect(ch.def.vol).toBeGreaterThan(0);
        expect(ch.def.vol).toBeLessThanOrEqual(0.5);
        for (const e of ch.events) {
          expect(e.step + e.len).toBeLessThanOrEqual(c.len);
          for (const m of e.midis || []) {
            expect(m).toBeGreaterThanOrEqual(28); // ≥ E1
            expect(m).toBeLessThanOrEqual(96); // ≤ C7
          }
        }
      }
    });
  }

  it('case trwa 2 takty = 3.2 s, victory się nie zapętla', () => {
    const c = compileSong(SONGS.case);
    expect(c.len * c.stepDur).toBeCloseTo(3.2);
    expect(compileSong(SONGS.victory).loop).toBe(false);
    expect(SONGS.hero.bpm).toBe(140);
  });
});

describe('VoiceLimiter', () => {
  it('pilnuje odstępu i limitu głosów', () => {
    const l = new VoiceLimiter(3);
    expect(l.tryStart('hit', 0, 0.5, { gap: 0.05, max: 2 })).toBe(true);
    expect(l.tryStart('hit', 0.01, 0.5, { gap: 0.05, max: 2 })).toBe(false); // za szybko
    expect(l.tryStart('hit', 0.1, 0.5, { gap: 0.05, max: 2 })).toBe(true);
    expect(l.tryStart('hit', 0.2, 0.5, { gap: 0.05, max: 2 })).toBe(false); // 2 głosy aktywne
    expect(l.tryStart('hit', 0.6, 0.5, { gap: 0.05, max: 2 })).toBe(true); // pierwszy wybrzmiał
    expect(l.tryStart('boom', 0.61, 1, { gap: 0, max: 5 })).toBe(true);
    expect(l.tryStart('zap', 0.62, 1, { gap: 0, max: 5 })).toBe(true);
    expect(l.tryStart('dash', 0.63, 1, { gap: 0, max: 5 })).toBe(false); // globalny limit 3
  });
});

describe('ustawienia', () => {
  it('walidacja: zakres 0..1, typy, nieznane pola pomijane', () => {
    expect(sanitizeSettings({ master: 2, music: -1, sfx: 'x', muted: 1, haptics: false, evil: 1 })).toEqual({
      ...DEFAULT_SETTINGS,
      master: 1,
      music: 0,
      haptics: false,
    });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ sfx: NaN })).toEqual(DEFAULT_SETTINGS);
  });
  it('zapis i odczyt przez storage', () => {
    const st = fakeStorage();
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    const s = { ...DEFAULT_SETTINGS, music: 0.25, muted: true };
    expect(saveSettings(st, s)).toBe(true);
    expect(JSON.parse(st.m.get(STORAGE_KEY))).toEqual(s);
    expect(loadSettings(st)).toEqual(s);
    expect(STORAGE_KEY).toBe('korona.audio');
  });
  it('uszkodzony lub niedostępny storage nie rzuca', () => {
    expect(loadSettings(fakeStorage({ [STORAGE_KEY]: '{oops' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(throwingStorage)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwingStorage, DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });
  it('krzywa suwaka', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
    expect(sliderToGain(3)).toBe(1);
  });
});

describe('sfx.js w Node (bez WebAudio)', () => {
  it('importuje się i API jest bezpiecznym no-op', async () => {
    const m = await import('../../src/audio/sfx.js');
    expect(() => m.unlockAudio()).not.toThrow();
    expect(() => m.play('hit')).not.toThrow();
    expect(() => m.play('nope', { volume: 2, pitch: 0 })).not.toThrow();
    m.setMusicMode('hero');
    expect(m.getMusicMode()).toBe('hero');
    m.setMusicMode('bogus');
    expect(m.getMusicMode()).toBe('off');
    expect(m.setSettings({ music: 0.3 }).music).toBe(0.3);
    m.setMuted(true);
    expect(m.getSettings().muted).toBe(true);
    expect(m.vibrate(20)).toBe(false);
    for (const n of ['hit', 'swing', 'hurt', 'die', 'boom', 'block', 'dash', 'ability', 'cast', 'zap', 'crown', 'win', 'go', 'click', 'tick', 'reveal',
      'ui', 'pickup', 'respawn', 'lastHit', 'bossDie', 'warn', 'heal', 'turret', 'blink', 'web', 'freeze', 'roar', 'countdown', 'lowhp']) {
      expect(m.SOUND_NAMES).toContain(n);
    }
  });
});
