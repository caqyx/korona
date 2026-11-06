/**
 * Publiczne API audio KORONY: proceduralne efekty chiptune, muzyka, ustawienia, haptyka.
 * Bez plików audio — wszystko WebAudio. Kontekst tworzony leniwie przy pierwszym geście użytkownika.
 *
 * unlockAudio()              — rejestruje nasłuch gestów (tworzy/wznawia kontekst)
 * play(name, {volume, pitch}) — efekt (losowa wariacja wysokości, limity głosów)
 * setMusicMode(mode)         — 'menu'|'hero'|'boss'|'survival'|'bossrush'|'case'|'victory'|'defeat'|'off'
 *                              (crossfade, wyrównanie do taktu; tryby z kilkoma utworami rotują po ~2 pętlach)
 * listSongs(mode?)           — lista utworów trybu (debug)
 * getSettings()/setSettings(partial) — {master, music, sfx (0..1), muted, haptics}, localStorage 'korona.audio'
 * setMuted(bool), vibrate(ms|pattern)
 */
import { E, ensureContext, applyGains, tone, noise } from './engine.js';
import { setMode, getMode, onContextReady, currentSong, listSongs, MUSIC_MODES } from './music.js';
import { noteToFreq as N, jitter } from './theory.js';
import { VoiceLimiter } from './voices.js';
import { loadSettings, saveSettings, sanitizeSettings, defaultStorage, sliderToGain } from './settings.js';

export { MUSIC_MODES, listSongs };

let settings = loadSettings(defaultStorage());
const limiter = new VoiceLimiter(32);

/**
 * Definicje efektów. dur — przybliżona długość (do limitu głosów), gap — min. odstęp powtórzeń [s],
 * max — równoczesne głosy, pv — rozrzut wysokości (±). fn(T, Z) dostaje tone/noise z wbudowaną
 * wysokością i głośnością danego odtworzenia.
 * @type {Record<string, {dur: number, gap?: number, max?: number, pv?: number, fn: (T: (o: any) => void, Z: (o: any) => void) => void}>}
 */
const SOUNDS = {
  // --- walka
  hit: { dur: 0.09, gap: 0.03, max: 4, fn: (T, Z) => {
    T({ wave: 'p25', f: 380, to: 140, dur: 0.08, vol: 0.2, a: 0.001, d: 0.03, s: 0.45, r: 0.03 });
    Z({ filter: 'highpass', f: 2500, dur: 0.035, vol: 0.1, a: 0.001, d: 0.015, s: 0.3, r: 0.015 });
  } },
  swing: { dur: 0.1, gap: 0.04, max: 3, fn: (_T, Z) => {
    Z({ filter: 'bandpass', f: 900, to: 3200, q: 1.2, dur: 0.09, vol: 0.22, a: 0.012, d: 0.03, s: 0.6, r: 0.04 });
  } },
  hurt: { dur: 0.18, gap: 0.08, max: 2, fn: (T) => {
    T({ wave: 'p50', f: 320, to: 140, dur: 0.17, vol: 0.18, a: 0.002, d: 0.05, s: 0.6, r: 0.06, vib: [32, 45] });
  } },
  die: { dur: 0.45, gap: 0.12, max: 2, fn: (T, Z) => {
    T({ wave: 'p25', notes: ['E5', 'C5', 'A4', 'F4', 'D4', 'A3'].map(N), step: 0.055, dur: 0.36, vol: 0.14, a: 0.002, d: 0.1, s: 0.6, r: 0.08 });
    T({ wave: 'tri', f: 170, to: 40, dur: 0.32, vol: 0.3, a: 0.002, d: 0.1, s: 0.5, r: 0.12 });
    Z({ filter: 'lowpass', f: 1600, to: 200, dur: 0.42, vol: 0.18, a: 0.002, d: 0.12, s: 0.5, r: 0.2 });
  } },
  boom: { dur: 0.45, gap: 0.05, max: 3, fn: (T, Z) => {
    Z({ filter: 'lowpass', f: 2200, to: 150, dur: 0.45, vol: 0.32, a: 0.002, d: 0.1, s: 0.45, r: 0.28 });
    T({ wave: 'tri', f: 120, to: 35, dur: 0.3, vol: 0.38, a: 0.001, d: 0.08, s: 0.5, r: 0.15 });
  } },
  block: { dur: 0.1, gap: 0.04, max: 3, fn: (T, Z) => {
    T({ wave: 'p12', f: 1400, dur: 0.06, vol: 0.1, a: 0.001, d: 0.02, s: 0.4, r: 0.03 });
    T({ wave: 'p12', f: 2100, dur: 0.1, vol: 0.06, a: 0.001, d: 0.03, s: 0.35, r: 0.05 });
    Z({ kind: 'metal', filter: 'highpass', f: 3000, rate: 2, dur: 0.05, vol: 0.06, a: 0.001, d: 0.02, s: 0.3, r: 0.02 });
  } },
  dash: { dur: 0.14, gap: 0.06, max: 2, fn: (T, Z) => {
    Z({ filter: 'bandpass', f: 600, to: 2800, q: 1.5, dur: 0.14, vol: 0.22, a: 0.01, d: 0.04, s: 0.6, r: 0.06 });
    T({ wave: 'p12', f: 300, to: 700, dur: 0.1, vol: 0.04, a: 0.005, d: 0.03, s: 0.6, r: 0.04 });
  } },
  ability: { dur: 0.18, gap: 0.06, max: 2, fn: (T) => {
    T({ wave: 'p25', notes: ['A4', 'C#5', 'E5', 'A5'].map(N), step: 0.035, dur: 0.17, vol: 0.12, a: 0.002, d: 0.06, s: 0.6, r: 0.05 });
    T({ wave: 'tri', f: N('A3'), to: N('A4'), dur: 0.15, vol: 0.14, a: 0.004, d: 0.05, s: 0.6, r: 0.05 });
  } },
  cast: { dur: 0.27, gap: 0.08, max: 2, fn: (T) => {
    T({ wave: 'tri', f: 220, to: 440, dur: 0.26, vol: 0.2, a: 0.02, d: 0.08, s: 0.7, r: 0.08, vib: [7, 30] });
    T({ wave: 'p12', notes: [N('E5'), N('B5')], step: 0.06, dur: 0.2, vol: 0.045, a: 0.01, d: 0.05, s: 0.6, r: 0.06 });
  } },
  zap: { dur: 0.14, gap: 0.04, max: 3, fn: (T, Z) => {
    T({ wave: 'p12', f: 1800, to: 250, dur: 0.13, vol: 0.1, a: 0.001, d: 0.04, s: 0.5, r: 0.05 });
    Z({ kind: 'metal', filter: 'bandpass', f: 3000, q: 1, rate: 1.5, dur: 0.09, vol: 0.08, a: 0.001, d: 0.03, s: 0.4, r: 0.04 });
  } },
  turret: { dur: 0.08, gap: 0.04, max: 3, fn: (T, Z) => {
    T({ wave: 'p50', f: 1000, to: 420, dur: 0.07, vol: 0.08, a: 0.001, d: 0.02, s: 0.5, r: 0.03 });
    Z({ filter: 'highpass', f: 3000, dur: 0.03, vol: 0.04, a: 0.001, d: 0.01, s: 0.3, r: 0.01 });
  } },
  blink: { dur: 0.24, gap: 0.1, max: 2, fn: (T, Z) => {
    Z({ filter: 'bandpass', f: 500, to: 5000, q: 2, dur: 0.1, vol: 0.12, a: 0.02, d: 0.03, s: 0.7, r: 0.03 });
    Z({ t: 0.1, filter: 'bandpass', f: 5000, to: 800, q: 2, dur: 0.12, vol: 0.09, a: 0.005, d: 0.04, s: 0.6, r: 0.06 });
    T({ wave: 'p12', f: 600, to: 2400, dur: 0.18, vol: 0.045, a: 0.01, d: 0.05, s: 0.6, r: 0.08 });
  } },
  web: { dur: 0.23, gap: 0.1, max: 2, fn: (T, Z) => {
    T({ wave: 'p50', f: 260, to: 180, dur: 0.22, vol: 0.1, a: 0.004, d: 0.06, s: 0.6, r: 0.08, vib: [22, 80] });
    Z({ filter: 'lowpass', f: 900, dur: 0.15, vol: 0.08, a: 0.004, d: 0.05, s: 0.4, r: 0.06 });
  } },
  freeze: { dur: 0.36, gap: 0.15, max: 2, fn: (T, Z) => {
    Z({ kind: 'metal', filter: 'highpass', f: 5000, rate: 2.5, dur: 0.35, vol: 0.05, a: 0.005, d: 0.1, s: 0.5, r: 0.18 });
    T({ wave: 'p12', notes: ['B6', 'F#6', 'D#6', 'B5'].map(N), step: 0.045, dur: 0.3, vol: 0.05, a: 0.002, d: 0.06, s: 0.6, r: 0.1 });
    T({ wave: 'tri', f: N('B5'), dur: 0.3, vol: 0.08, a: 0.01, d: 0.08, s: 0.5, r: 0.12 });
  } },
  heal: { dur: 0.3, gap: 0.15, max: 2, fn: (T) => {
    T({ wave: 'tri', notes: ['C5', 'E5', 'G5'].map(N), step: 0.07, dur: 0.3, vol: 0.14, a: 0.005, d: 0.08, s: 0.6, r: 0.1 });
    T({ t: 0.035, wave: 'p12', notes: ['G5', 'C6', 'E6'].map(N), step: 0.07, dur: 0.27, vol: 0.035, a: 0.005, d: 0.06, s: 0.5, r: 0.1 });
  } },
  // --- korona / boss
  lastHit: { dur: 0.5, gap: 0.15, max: 1, fn: (T, Z) => {
    Z({ filter: 'lowpass', f: 4000, to: 300, dur: 0.35, vol: 0.28, a: 0.001, d: 0.08, s: 0.45, r: 0.2 });
    T({ wave: 'tri', f: 200, to: 40, dur: 0.3, vol: 0.42, a: 0.001, d: 0.08, s: 0.5, r: 0.15 });
    T({ wave: 'p25', f: N('A4'), dur: 0.24, vol: 0.11, a: 0.001, d: 0.06, s: 0.55, r: 0.1 });
    T({ wave: 'p25', f: N('E5'), dur: 0.24, vol: 0.09, a: 0.001, d: 0.06, s: 0.55, r: 0.1 });
    T({ t: 0.12, wave: 'p12', notes: ['A5', 'C#6', 'E6', 'A6'].map(N), step: 0.04, dur: 0.36, vol: 0.06, a: 0.002, d: 0.08, s: 0.6, r: 0.14, vib: [6, 12] });
  } },
  crown: { dur: 0.6, gap: 0.3, max: 1, pv: 0.015, fn: (T, Z) => {
    const ns = ['C5', 'E5', 'G5', 'C6'].map(N);
    T({ wave: 'p25', notes: ns, step: 0.08, dur: 0.58, vol: 0.13, a: 0.003, d: 0.1, s: 0.65, r: 0.16, vib: [6, 14] });
    T({ wave: 'tri', notes: ns.map((f) => f / 2), step: 0.08, dur: 0.58, vol: 0.18, a: 0.003, d: 0.1, s: 0.65, r: 0.16 });
    Z({ t: 0.24, filter: 'highpass', f: 8000, dur: 0.3, vol: 0.03, a: 0.02, d: 0.1, s: 0.5, r: 0.15 });
  } },
  roar: { dur: 0.95, gap: 1, max: 1, pv: 0.03, fn: (T, Z) => {
    T({ wave: 'p50', f: 110, to: 58, dur: 0.9, vol: 0.13, a: 0.08, d: 0.2, s: 0.8, r: 0.4, vib: [28, 120] });
    T({ wave: 'tri', f: 55, to: 45, dur: 0.9, vol: 0.32, a: 0.06, d: 0.2, s: 0.8, r: 0.4, vib: [28, 60] });
    Z({ filter: 'lowpass', f: 300, to: 800, q: 2, dur: 0.9, vol: 0.18, a: 0.2, d: 0.2, s: 0.7, r: 0.4 });
  } },
  bossDie: { dur: 1.4, gap: 0.6, max: 1, pv: 0.03, fn: (T, Z) => {
    Z({ filter: 'lowpass', f: 3000, to: 80, dur: 1.4, vol: 0.26, a: 0.005, d: 0.3, s: 0.6, r: 0.8 });
    T({ wave: 'tri', f: 300, to: 30, dur: 1.1, vol: 0.36, a: 0.003, d: 0.3, s: 0.6, r: 0.5 });
    const chrom = Array.from({ length: 12 }, (_, i) => N('E5') * Math.pow(2, -i / 12));
    T({ wave: 'p50', notes: chrom, step: 0.07, dur: 0.85, vol: 0.06, a: 0.002, d: 0.2, s: 0.7, r: 0.25, vib: [8, 20] });
    Z({ t: 0.3, filter: 'lowpass', f: 1500, to: 100, dur: 0.4, vol: 0.22, a: 0.002, d: 0.1, s: 0.4, r: 0.25 });
    Z({ t: 0.65, filter: 'lowpass', f: 1200, to: 80, dur: 0.5, vol: 0.2, a: 0.002, d: 0.1, s: 0.4, r: 0.3 });
  } },
  // --- przebieg meczu
  countdown: { dur: 0.13, gap: 0.3, max: 1, pv: 0.005, fn: (T) => {
    T({ wave: 'p25', f: N('A4'), dur: 0.12, vol: 0.13, a: 0.002, d: 0.04, s: 0.6, r: 0.04 });
    T({ wave: 'tri', f: N('A3'), dur: 0.12, vol: 0.14, a: 0.002, d: 0.04, s: 0.6, r: 0.04 });
  } },
  go: { dur: 0.32, gap: 0.3, max: 1, pv: 0.005, fn: (T) => {
    T({ wave: 'p25', f: N('A5'), dur: 0.3, vol: 0.15, a: 0.002, d: 0.1, s: 0.7, r: 0.1, vib: [6, 10] });
    T({ wave: 'tri', f: N('A4'), dur: 0.3, vol: 0.2, a: 0.002, d: 0.1, s: 0.7, r: 0.1 });
  } },
  win: { dur: 1, gap: 1, max: 1, pv: 0.005, fn: (T) => {
    T({ wave: 'p25', notes: ['G4', 'C5', 'E5', 'G5', 'C6'].map(N), step: 0.11, dur: 0.95, vol: 0.13, a: 0.003, d: 0.12, s: 0.65, r: 0.25, vib: [6, 12] });
    T({ wave: 'p12', notes: ['E4', 'G4', 'C5', 'E5', 'G5'].map(N), step: 0.11, dur: 0.95, vol: 0.05, a: 0.003, d: 0.12, s: 0.6, r: 0.25 });
    T({ wave: 'tri', notes: ['C3', 'C3', 'G3', 'G3', 'C4'].map(N), step: 0.11, dur: 0.95, vol: 0.22, a: 0.003, d: 0.12, s: 0.7, r: 0.25 });
  } },
  reveal: { dur: 0.46, gap: 0.3, max: 1, pv: 0.01, fn: (T, Z) => {
    T({ wave: 'p25', notes: ['E5', 'G#5', 'B5', 'E6'].map(N), step: 0.06, dur: 0.45, vol: 0.11, a: 0.002, d: 0.08, s: 0.6, r: 0.15, vib: [6, 12] });
    T({ t: 0.03, wave: 'p12', notes: ['B5', 'E6', 'G#6', 'B6'].map(N), step: 0.06, dur: 0.42, vol: 0.045, a: 0.002, d: 0.08, s: 0.5, r: 0.15 });
    Z({ filter: 'highpass', f: 6000, dur: 0.4, vol: 0.035, a: 0.1, d: 0.1, s: 0.5, r: 0.15 });
  } },
  respawn: { dur: 0.36, gap: 0.15, max: 2, fn: (T) => {
    T({ wave: 'tri', f: 220, to: 880, dur: 0.3, vol: 0.2, a: 0.01, d: 0.08, s: 0.7, r: 0.1 });
    T({ t: 0.1, wave: 'p12', notes: ['C5', 'G5', 'C6'].map(N), step: 0.06, dur: 0.26, vol: 0.06, a: 0.002, d: 0.06, s: 0.6, r: 0.08 });
  } },
  pickup: { dur: 0.2, gap: 0.05, max: 3, fn: (T) => {
    T({ wave: 'p25', notes: [N('B5'), N('E6')], step: 0.06, dur: 0.2, vol: 0.11, a: 0.002, d: 0.05, s: 0.6, r: 0.08 });
  } },
  warn: { dur: 0.08, gap: 0.12, max: 2, pv: 0.03, fn: (T) => {
    T({ wave: 'tri', f: N('E6'), dur: 0.07, vol: 0.1, a: 0.005, d: 0.03, s: 0.5, r: 0.03 });
  } },
  lowhp: { dur: 0.28, gap: 0.7, max: 1, pv: 0.02, fn: (T) => {
    T({ wave: 'tri', f: 90, to: 50, dur: 0.09, vol: 0.32, a: 0.003, d: 0.04, s: 0.5, r: 0.04 });
    T({ t: 0.16, wave: 'tri', f: 80, to: 45, dur: 0.1, vol: 0.25, a: 0.003, d: 0.04, s: 0.5, r: 0.05 });
  } },
  // --- interfejs
  click: { dur: 0.04, gap: 0.03, max: 2, pv: 0.03, fn: (T) => {
    T({ wave: 'p50', f: 1046, dur: 0.035, vol: 0.08, a: 0.001, d: 0.015, s: 0.4, r: 0.012 });
  } },
  ui: { dur: 0.03, gap: 0.035, max: 2, pv: 0.03, fn: (T) => {
    T({ wave: 'p25', f: N('G6'), dur: 0.025, vol: 0.055, a: 0.001, d: 0.01, s: 0.5, r: 0.01 });
  } },
  tick: { dur: 0.02, gap: 0.015, max: 3, pv: 0.03, fn: (T) => {
    T({ wave: 'p12', f: 2093, dur: 0.02, vol: 0.04, a: 0.001, d: 0.008, s: 0.4, r: 0.008 });
  } },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

/**
 * Odtwarza efekt. Ciche no-op przed odblokowaniem audio, przy wyciszeniu lub nieznanej nazwie.
 * @param {string} name
 * @param {{volume?: number, pitch?: number}} [opts] mnożniki (domyślnie 1)
 */
export function play(name, opts) {
  const ac = E.ac;
  if (settings.muted || !ac || ac.state !== 'running') return;
  const def = SOUNDS[name];
  if (!def) return;
  if (!limiter.tryStart(name, ac.currentTime, def.dur, def)) return;
  const v = Math.max(0, opts?.volume ?? 1);
  if (v <= 0) return;
  const p = Math.max(0.25, Math.min(4, opts?.pitch ?? 1)) * jitter(Math.random, def.pv ?? 0.04);
  try {
    def.fn((o) => tone(o, p, v), (o) => noise(o, p, v));
  } catch {
    /* audio nie może wywrócić gry */
  }
}

// ------------------------------------------------------------------ kontekst / odblokowanie

let listening = false;
let hiddenSuspended = false;

function onContextCreated() {
  pushGains();
  onContextReady();
}

function onGesture() {
  const had = !!E.ac;
  const ac = ensureContext();
  if (!ac) return;
  if (!had) onContextCreated();
  if (ac.state !== 'running' && !hiddenSuspended) ac.resume().catch(() => {});
}

/**
 * Rejestruje nasłuch gestów, który leniwie tworzy (i wznawia) AudioContext.
 * Wywołane w trakcie gestu — tworzy kontekst od razu.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!listening) {
    listening = true;
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.addEventListener(ev, onGesture, { capture: true, passive: true });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const ac = E.ac;
        if (!ac) return;
        if (document.hidden && ac.state === 'running') {
          hiddenSuspended = true;
          ac.suspend().catch(() => {});
        } else if (!document.hidden && hiddenSuspended) {
          hiddenSuspended = false;
          ac.resume().catch(() => {});
        }
      });
    }
  }
  const ua = typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).userActivation : null;
  if (E.ac || ua?.isActive) onGesture();
}

// ------------------------------------------------------------------ ustawienia

function pushGains() {
  applyGains({
    master: sliderToGain(settings.master),
    music: sliderToGain(settings.music),
    sfx: sliderToGain(settings.sfx),
    muted: settings.muted,
  });
}

export const getSettings = () => ({ ...settings });

/** Scala i zapisuje ustawienia, stosuje głośności na żywo. @param {Partial<typeof settings>} s */
export function setSettings(s) {
  settings = sanitizeSettings(s, settings);
  saveSettings(defaultStorage(), settings);
  pushGains();
  return getSettings();
}

/** @param {boolean} m */
export const setMuted = (m) => {
  setSettings({ muted: !!m });
};

// ------------------------------------------------------------------ muzyka / haptyka

/**
 * @param {'menu'|'hero'|'boss'|'survival'|'bossrush'|'case'|'victory'|'defeat'|'off'|string} mode
 * @param {{song?: string}} [opts] opcjonalnie konkretny utwór z playlisty trybu (debug/testy)
 */
export function setMusicMode(mode, opts) {
  setMode(mode, opts);
}

export const getMusicMode = getMode;

/** Id aktualnie prowadzącego utworu (debug) albo null. */
export const getMusicSong = currentSong;

/** Wibracja (mobile), jeśli włączona w ustawieniach i wspierana. @param {number|number[]} pattern */
export function vibrate(pattern) {
  if (!settings.haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
