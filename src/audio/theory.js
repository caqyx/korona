/**
 * Czysta matematyka audio (bez WebAudio): nuty, akordy, obwiednie, takt/krok, losowa wariacja.
 * Wszystko tutaj jest testowalne w Node.
 */

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Interwały akordów (półtony od prymy). */
export const CHORDS = {
  '': [0],
  M: [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  M7: [0, 4, 7, 11],
  pw: [0, 7, 12],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
};

/**
 * Parsuje nazwę nuty z opcjonalnym sufiksem akordu, np. 'A4', 'C#5', 'Bb3', 'A3m', 'G2pw'.
 * @param {string} tok
 * @returns {{ midi: number, chord: string, midis: number[] } | null}
 */
export function parseNote(tok) {
  const m = /^([A-G])(#|b)?(-?\d)(.*)$/.exec(tok);
  if (!m) return null;
  const chord = m[4];
  if (!(chord in CHORDS)) return null;
  const midi = (Number(m[3]) + 1) * 12 + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { midi, chord, midis: CHORDS[chord].map((i) => midi + i) };
}

/** @param {string} name np. 'A4' → 69 */
export function noteToMidi(name) {
  const n = parseNote(name);
  if (!n) throw new Error(`Bad note: ${name}`);
  return n.midi;
}

/** @param {number} midi */
export const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/** @param {string} name */
export const noteToFreq = (name) => midiToFreq(noteToMidi(name));

/**
 * Punkty obwiedni ADSR (piecewise-linear) dla nuty o długości `dur`, kończące się zerem.
 * Za krótka nuta: atak/zwolnienie są proporcjonalnie skracane, decay pomijany.
 * @param {number} dur  @param {number} peak
 * @param {{a?: number, d?: number, s?: number, r?: number}} [adsr]
 * @returns {Array<[number, number]>} [czas od startu, wartość], czasy niemalejące
 */
export function envelopePoints(dur, peak, { a = 0.005, d = 0.05, s = 0.7, r = 0.03 } = {}) {
  dur = Math.max(0.002, dur);
  if (a + r > dur) {
    const k = dur / (a + r);
    a *= k;
    r *= k;
    d = 0;
  }
  d = Math.max(0, Math.min(d, dur - r - a));
  const sus = peak * s;
  /** @type {Array<[number, number]>} */
  const pts = [[0, 0], [a, peak]];
  if (d > 1e-6) pts.push([a + d, sus]);
  if (dur - r > pts[pts.length - 1][0] + 1e-6) pts.push([dur - r, sus]);
  pts.push([dur, 0]);
  return pts;
}

/**
 * Losowy mnożnik wysokości 1 ± spread (np. 0.04 → ±4%).
 * @param {() => number} rng  @param {number} spread
 */
export const jitter = (rng, spread) => 1 + (rng() * 2 - 1) * spread;

/** Długość kroku (1/16 przy 4 krokach na ćwierćnutę) w sekundach. */
export const stepDuration = (bpm, stepsPerBeat = 4) => 60 / bpm / stepsPerBeat;

/**
 * Indeks kroku w utworze dla globalnego licznika `i` (z pętlą od loopStart).
 * @returns {number} indeks 0..len-1 lub -1, gdy utwór bez pętli się skończył
 */
export function songStepAt(i, len, loopStart = 0, loop = true) {
  if (i < len) return i;
  if (!loop) return -1;
  const body = len - loopStart;
  if (body <= 0) return -1;
  return loopStart + ((i - len) % body);
}

/**
 * Czas startu nowego trybu muzyki: wyrównany do taktu bieżącego utworu (albo do miary,
 * gdy do taktu za daleko), z minimalnym wyprzedzeniem, by zdążyć zaplanować pierwsze nuty.
 * @param {number} now
 * @param {{t0: number, stepDur: number, stepsPerBar: number, stepsPerBeat: number} | null} cur
 * @param {{quantize?: 'bar'|'beat'|'none', maxWait?: number, minLead?: number}} [opts]
 */
export function pickStartTime(now, cur, { quantize = 'bar', maxWait = 0.9, minLead = 0.06 } = {}) {
  const earliest = now + minLead;
  if (!cur || quantize === 'none' || cur.t0 >= earliest) return earliest;
  const at = (unit) => cur.t0 + Math.ceil((earliest - cur.t0) / unit - 1e-9) * unit;
  if (quantize === 'bar') {
    const t = at(cur.stepsPerBar * cur.stepDur);
    if (t - now <= maxWait) return t;
  }
  const t = at(cur.stepsPerBeat * cur.stepDur);
  return t - now <= Math.max(maxWait, minLead) ? t : earliest;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** @param {number} midi → np. 69 → 'A4' (krzyżyki) */
export const midiToName = (midi) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
