/**
 * Proceduralne efekty dźwiękowe WebAudio (MVP, bez plików audio).
 * Kontekst tworzony leniwie po pierwszej interakcji użytkownika.
 */
let ac = /** @type {AudioContext|null} */ (null);
let master = /** @type {GainNode|null} */ (null);
let muted = false;
const lastPlayed = new Map();

export function unlockAudio() {
  if (ac || typeof window === 'undefined') return;
  const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!Ctx) return;
  ac = new Ctx();
  master = ac.createGain();
  master.gain.value = 0.35;
  master.connect(ac.destination);
}

/** @param {boolean} m */
export const setMuted = (m) => {
  muted = m;
};

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
  if (!ac || !master) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = /** @type {OscillatorType} */ (type);
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, filterFreq = 1200) {
  if (!ac || !master) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

const SOUNDS = {
  hit: () => tone(320, 0.06, 'square', 0.12, -120),
  swing: () => noise(0.06, 0.12, 3000),
  hurt: () => tone(180, 0.18, 'sawtooth', 0.25, -100),
  die: () => (noise(0.35, 0.35, 800), tone(120, 0.4, 'sawtooth', 0.2, -80)),
  boom: () => noise(0.25, 0.3, 600),
  block: () => tone(900, 0.08, 'triangle', 0.2, 300),
  dash: () => noise(0.1, 0.12, 2400),
  ability: () => tone(520, 0.18, 'triangle', 0.2, 400),
  cast: () => tone(140, 0.25, 'sawtooth', 0.12, 80),
  zap: () => (noise(0.2, 0.25, 5000), tone(1400, 0.15, 'square', 0.1, -900)),
  crown: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.22), i * 90)),
  win: () => [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'square', 0.18), i * 120)),
  go: () => tone(880, 0.2, 'square', 0.2),
  click: () => tone(660, 0.05, 'square', 0.12),
};

/** Odtwarza efekt (z prostym ograniczeniem częstotliwości). @param {string} name */
export function play(name) {
  if (muted || !ac) return;
  const now = ac.currentTime;
  if (now - (lastPlayed.get(name) || 0) < 0.04) return;
  lastPlayed.set(name, now);
  const fn = /** @type {any} */ (SOUNDS)[name];
  if (fn) fn();
}
