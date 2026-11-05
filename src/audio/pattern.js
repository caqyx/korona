/**
 * Mini-tracker: parsowanie ścieżek tekstowych i kompilacja utworów (czyste, bez WebAudio).
 *
 * Ścieżka = tokeny rozdzielone spacjami, jeden token = jeden krok (1/16). '|' ignorowane (czytelność).
 *  tonalne: 'A4' nuta, 'A3m' akord (arpeggio), '-' przedłużenie poprzedniej, '.' cisza
 *  perkusja: 'x' uderzenie, 'X' akcent, 'g' ghost, 'o' otwarte/długie, 'r' werbel 2×/krok, '.' cisza
 */
import { parseNote, stepDuration } from './theory.js';

const DRUM_VEL = { x: 0.75, X: 1, g: 0.35, o: 0.8, r: 0.6 };

/** @param {string} str */
const tokens = (str) => str.trim().split(/\s+/).filter((t) => t && t !== '|');

/**
 * @param {string} str
 * @param {'tone'|'drum'} kind
 * @returns {{ steps: number, events: Array<{step: number, len: number, midis?: number[], hit?: string, vel?: number}> }}
 */
export function parseTrack(str, kind) {
  const toks = tokens(str);
  /** @type {Array<any>} */
  const events = [];
  let open = /** @type {any} */ (null);
  toks.forEach((t, step) => {
    if (kind === 'drum') {
      if (t === '.' || t === '-') return;
      if (!(t in DRUM_VEL)) throw new Error(`Bad drum token '${t}' at ${step}`);
      events.push({ step, len: 1, hit: t, vel: DRUM_VEL[t] });
      return;
    }
    if (t === '-') {
      if (!open) throw new Error(`Hold without note at ${step}`);
      open.len++;
    } else if (t === '.') {
      open = null;
    } else {
      const n = parseNote(t);
      if (!n) throw new Error(`Bad note token '${t}' at ${step}`);
      open = { step, len: 1, midis: n.midis };
      events.push(open);
    }
  });
  if (kind === 'drum') {
    // len = odstęp do następnego uderzenia (ogranicza wybrzmiewanie, żeby obwiednie się nie nakładały)
    events.forEach((e, i) => (e.len = (i + 1 < events.length ? events[i + 1].step : toks.length) - e.step));
  }
  return { steps: toks.length, events };
}

/**
 * Kompiluje utwór: indeksuje zdarzenia kanałów po kroku, sprawdza zgodność długości.
 * @param {any} song
 */
export function compileSong(song) {
  const stepsPerBeat = song.stepsPerBeat ?? 4;
  const stepsPerBar = stepsPerBeat * (song.beatsPerBar ?? 4);
  let len = -1;
  const channels = song.channels.map((/** @type {any} */ ch) => {
    const kind = ch.type === 'tone' ? 'tone' : 'drum';
    const { steps, events } = parseTrack(ch.track, kind);
    if (len < 0) len = steps;
    if (steps !== len) throw new Error(`${song.name}/${ch.id}: ${steps} steps, expected ${len}`);
    const byStep = new Array(steps).fill(null);
    for (const e of events) byStep[e.step] = e;
    return { def: ch, events, byStep };
  });
  if (len % stepsPerBar !== 0) throw new Error(`${song.name}: ${len} steps is not whole bars`);
  return {
    name: song.name,
    bpm: song.bpm,
    stepDur: stepDuration(song.bpm, stepsPerBeat),
    stepsPerBeat,
    stepsPerBar,
    len,
    loop: song.loop !== false,
    loopStart: (song.loopStartBar ?? 0) * stepsPerBar,
    channels,
  };
}
