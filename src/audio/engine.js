/**
 * Silnik WebAudio: leniwy kontekst, szyny (music/sfx → kompresor → master), fale pulsowe
 * (PeriodicWave, ograniczone pasmo = czysto, nie ostro), bufory szumu (biały + „metaliczny” LFSR)
 * oraz jednorazowe prymitywy tone()/noise() dla efektów.
 */
import { envelopePoints } from './theory.js';

/** Bazowe poziomy szyn (przed ustawieniami użytkownika) — zostawiają zapas przed kompresorem. */
const MUSIC_BASE = 0.9;
const SFX_BASE = 0.9;

/** Wyrównanie głośności fal (RMS po normalizacji szczytowej) względem pulsu 25%. */
export const WAVE_GAIN = { p12: 1.4, p25: 1.0, p50: 0.6, tri: 1.0, sine: 0.8 };

/**
 * Stan silnika (pojedynczy kontekst na stronę).
 * @type {{ ac: AudioContext|null, master: GainNode|null, comp: DynamicsCompressorNode|null,
 *   music: GainNode|null, sfx: GainNode|null, waves: Record<string, PeriodicWave>,
 *   white: AudioBuffer|null, metal: AudioBuffer|null }}
 */
export const E = { ac: null, master: null, comp: null, music: null, sfx: null, waves: {}, white: null, metal: null };

/** Fala pulsowa o wypełnieniu `duty` z `harmonics` harmonicznymi (szereg Fouriera). */
function pulseWave(ac, duty, harmonics = 40) {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return ac.createPeriodicWave(real, imag);
}

/** Szum NES w trybie „short” (15-bit LFSR, sprzężenie z bitu 6) — metaliczny, tonalny. */
function lfsrBuffer(ac, seconds = 0.5) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let reg = 1;
  const hold = Math.max(1, Math.round(ac.sampleRate / 22050)); // ~22 kHz zegar LFSR
  for (let i = 0; i < len; i++) {
    if (i % hold === 0) {
      const bit = (reg ^ (reg >> 6)) & 1;
      reg = (reg >> 1) | (bit << 14);
    }
    d[i] = reg & 1 ? 0.6 : -0.6;
  }
  return buf;
}

function whiteBuffer(ac, seconds = 1) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Tworzy kontekst i graf (jednorazowo). Zwraca kontekst albo null, gdy brak WebAudio. */
export function ensureContext() {
  if (E.ac) return E.ac;
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!Ctx) return null;
  let ac;
  try {
    ac = /** @type {AudioContext} */ (new Ctx({ latencyHint: 'interactive' }));
  } catch {
    return null;
  }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 8;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  const master = ac.createGain();
  master.gain.value = 0;
  const music = ac.createGain();
  const sfx = ac.createGain();
  music.connect(comp);
  sfx.connect(comp);
  comp.connect(master).connect(ac.destination);
  Object.assign(E, {
    ac,
    comp,
    master,
    music,
    sfx,
    waves: { p12: pulseWave(ac, 0.125), p25: pulseWave(ac, 0.25), p50: pulseWave(ac, 0.5) },
    white: whiteBuffer(ac),
    metal: lfsrBuffer(ac),
  });
  return ac;
}

/**
 * Ustawia głośności szyn płynnie (bez trzasków).
 * @param {{master: number, music: number, sfx: number, muted: boolean}} g wzmocnienia 0..1 (już po krzywej)
 */
export function applyGains(g) {
  if (!E.ac || !E.master || !E.music || !E.sfx) return;
  const t = E.ac.currentTime;
  E.master.gain.setTargetAtTime(g.muted ? 0 : g.master, t, 0.03);
  E.music.gain.setTargetAtTime(g.music * MUSIC_BASE, t, 0.05);
  E.sfx.gain.setTargetAtTime(g.sfx * SFX_BASE, t, 0.03);
}

/** Nadaje oscylatorowi kształt fali. @param {OscillatorNode} o @param {string} wave */
export function setWave(o, wave) {
  const w = E.waves[wave];
  if (w) o.setPeriodicWave(w);
  else o.type = wave === 'sine' ? 'sine' : 'triangle';
}

/** Rozpisuje obwiednię na AudioParam od czasu t. */
export function applyEnvelope(param, t, dur, peak, adsr) {
  const pts = envelopePoints(dur, peak, adsr);
  param.setValueAtTime(0, t);
  for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t + pts[i][0]);
}

/** Vibrato przez LFO podłączone do detune (w centach). */
function addVibrato(target, t, end, rate, cents) {
  const ac = /** @type {AudioContext} */ (E.ac);
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = rate;
  depth.gain.value = cents;
  lfo.connect(depth).connect(target.detune);
  lfo.start(t);
  lfo.stop(end);
  lfo.onended = () => depth.disconnect();
}

const disconnectAll = (...nodes) => () => nodes.forEach((n) => n.disconnect());

/**
 * Jednorazowy ton efektu.
 * @param {{ t?: number, wave?: string, f?: number, to?: number, slide?: number, curve?: 'exp'|'lin',
 *   notes?: number[], step?: number, dur?: number, vol?: number, a?: number, d?: number, s?: number, r?: number,
 *   vib?: [number, number], dest?: AudioNode }} o
 * @param {number} [p] mnożnik wysokości  @param {number} [v] mnożnik głośności
 */
export function tone(o, p = 1, v = 1) {
  const ac = E.ac;
  if (!ac) return;
  const { wave = 'p25', dur = 0.1, vol = 0.2, curve = 'exp' } = o;
  const t0 = ac.currentTime + 0.005 + (o.t || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  setWave(osc, wave);
  const fq = osc.frequency;
  if (o.notes) {
    const step = o.step || 0.05;
    o.notes.forEach((f, i) => i * step < dur && fq.setValueAtTime(f * p, t0 + i * step));
  } else {
    fq.setValueAtTime((o.f || 440) * p, t0);
    if (o.to) {
      const end = t0 + (o.slide || dur);
      if (curve === 'exp') fq.exponentialRampToValueAtTime(Math.max(1, o.to * p), end);
      else fq.linearRampToValueAtTime(o.to * p, end);
    }
  }
  applyEnvelope(g.gain, t0, dur, vol * v * (WAVE_GAIN[wave] ?? 1), o);
  osc.connect(g).connect(o.dest || /** @type {GainNode} */ (E.sfx));
  if (o.vib) addVibrato(osc, t0, t0 + dur + 0.02, o.vib[0], o.vib[1]);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  osc.onended = disconnectAll(osc, g);
}

/**
 * Jednorazowy szum efektu przez filtr (z opcjonalnym przemiataniem częstotliwości).
 * @param {{ t?: number, kind?: 'white'|'metal', filter?: BiquadFilterType, f?: number, to?: number, q?: number,
 *   rate?: number, dur?: number, vol?: number, a?: number, d?: number, s?: number, r?: number, dest?: AudioNode }} o
 * @param {number} [p] @param {number} [v]
 */
export function noise(o, p = 1, v = 1) {
  const ac = E.ac;
  if (!ac) return;
  const { kind = 'white', filter = 'lowpass', dur = 0.1, vol = 0.2 } = o;
  const t0 = ac.currentTime + 0.005 + (o.t || 0);
  const src = ac.createBufferSource();
  const buf = /** @type {AudioBuffer} */ (kind === 'metal' ? E.metal : E.white);
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = (o.rate || 1) * (kind === 'metal' ? p : 1);
  const flt = ac.createBiquadFilter();
  flt.type = filter;
  flt.Q.value = o.q ?? 0.7;
  const nyq = ac.sampleRate / 2 - 100;
  flt.frequency.setValueAtTime(Math.min(nyq, (o.f || 1200) * p), t0);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(Math.min(nyq, Math.max(20, o.to * p)), t0 + dur);
  const g = ac.createGain();
  applyEnvelope(g.gain, t0, dur, vol * v, o);
  src.connect(flt).connect(g).connect(o.dest || /** @type {GainNode} */ (E.sfx));
  src.start(t0, Math.random() * (buf.duration - 0.05));
  src.stop(t0 + dur + 0.02);
  src.onended = disconnectAll(src, flt, g);
}
