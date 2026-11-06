/**
 * Dodatkowe utwory chiptune, składane z progresji akordów (bas/arpeggio/perkusja generowane
 * stylami) + ręcznie pisanej melodii. Czyste dane — testowane w tests/unit/audio-*.test.js.
 */
import { parseNote, midiToName } from './theory.js';

const rep = (s, n) => Array(n).fill(s).join(' | ');
const join = (...bars) => bars.join(' | ');
const REST = rep('.', 16).replace(/ \| /g, ' ');

const QUALITY = { '': 'M', m: 'm', 7: '7', m7: 'm7', maj7: 'M7', dim: 'dim', 5: 'pw', sus4: 'sus4' };

/** 'Am' → { root: 'A', q: 'm' }, 'Bb' → { root: 'Bb', q: 'M' }, 'F#' → … */
function chord(sym) {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m || !(m[2] in QUALITY)) throw new Error(`Bad chord ${sym}`);
  return { root: m[1], q: QUALITY[m[2]] };
}

/** MIDI prymy akordu w danej oktawie. */
const rootMidi = (sym, oct) => /** @type {any} */ (parseNote(`${chord(sym).root}${oct}`)).midi;
const nm = (midi) => midiToName(midi);

/** Wzorce basu (1 takt) dla akordu. */
const BASS = {
  octave8: (c) => { const r = rootMidi(c, 2); return rep(`${nm(r)} . ${nm(r + 12)} .`, 4).replace(/ \| /g, ' '); },
  pulse8: (c) => rep(`${nm(rootMidi(c, 2))} .`, 8).replace(/ \| /g, ' '),
  pulse16: (c) => { const r = nm(rootMidi(c, 2)); return `${r} ${r} ${r} ${r} `.repeat(4).trim(); },
  gallop: (c) => { const r = rootMidi(c, 2); return rep(`${nm(r)} . ${nm(r + 12)} ${nm(r + 12)}`, 4).replace(/ \| /g, ' '); },
  rootfifth8: (c) => { const r = rootMidi(c, 2); return rep(`${nm(r)} . ${nm(r + 7)} .`, 4).replace(/ \| /g, ' '); },
  half: (c) => { const r = rootMidi(c, 2); return `${nm(r)} - - - - - - - ${nm(r + 7)} - - - - - - -`; },
  walk: (c) => { const r = rootMidi(c, 2); return `${nm(r)} - - - - - ${nm(r + 7)} - ${nm(r + 12)} - - - ${nm(r + 7)} - - -`; },
};

/** Arpeggio: w rytmie 'X' zastąpione tokenem akordu (np. 'A3m'). */
const arpBar = (c, rhythm, oct = 3) => {
  const { root, q } = chord(c);
  return rhythm.replace(/X/g, `${root}${oct}${q}`);
};

/** Zestawy perkusyjne: [kick, snare, hat] + przejście co 8 taktów. */
const KITS = {
  march: ['X . . . . . . . x . . . . . x .', '. . . . x . . . . . . . x . . .', 'x . x . x . x . x . x . x . x .', '. . . . x . . . x . x . x x x x'],
  sparse: ['x . . . . . . . . . . . . . . .', '. . . . . . . . . . . . g . . .', 'g . . g . . g . . g . . g . g .', null],
  skank: ['X . . . . . x . X . . . . . . .', '. . . . X . . . . . . . X . . .', 'x g x g x g x g x g x g x g x g', '. . . . X . . . X X . X X X r r'],
  shuffle: ['X . . x . . x . X . . . . . x .', '. . . . X . . . . . . . X . . g', 'x . . x . . x . x . . x . . x .', '. . . . X . . . X . . X . . X X'],
  doom: ['X . . . X . . . X . X . X . . .', '. . . . X . . . . . . . X . . .', 'x . x . x . o . x . x . x . o .', '. . . . X . . . X . X . X X r r'],
  frantic: ['X . x . X . x . X . x . X . x .', '. . X . . . X . . . X . . . X .', 'x g x g x g x g x g x g x g x g', 'X . X . X . X . X X X X r r r r'],
  four: ['X . . . X . . . X . . . X . . .', '. . . . X . . . . . . . X . . .', 'x g x g x g x g x g x g x g x g', '. . . . X . . . X . x x X x X X'],
  urgent: ['X . . x X . . . X . . x X . . .', '. . . . X . . g . . . . X . g .', 'x . x x x . x x x . x x x . x x', '. . . . X . . g X . X . X X r r'],
  epic: ['X . . . . . . . X . X . . . . .', '. . . . X . . . . . . . X . . .', 'x . x . x . x . x . x . x . x .', '. . . . X . . . X . x x X x X X'],
};

/**
 * Składa utwór z progresji (1 akord/takt) i melodii (pełne takty).
 * @param {any} o
 */
function makeSong(o) {
  const leadBars = o.lead.length;
  const prog = Array.from({ length: leadBars }, (_, i) => o.prog[i % o.prog.length]);
  const [kick, snare, hat, fill] = KITS[o.kit];
  const drum = (pat, withFill, crash) =>
    join(...prog.map((_, i) => {
      if (withFill && fill && i % 8 === 7) return fill;
      if (crash && i % 8 === 0) return 'o' + pat.slice(1);
      return pat;
    }));
  const lead = { id: 'lead', type: 'tone', wave: 'p25', vol: 0.14, gate: 0.9, adsr: { a: 0.004, d: 0.1, s: 0.6, r: 0.04 }, echo: 0.2, vib: 8, ...o.leadDef, track: join(...o.lead) };
  const arp = { id: 'arp', type: 'tone', wave: 'p12', vol: 0.055, gate: 0.85, arpRate: 0.036, adsr: { a: 0.002, d: 0.12, s: 0.5, r: 0.03 }, ...o.arpDef, track: join(...prog.map((c) => arpBar(c, o.arp, o.arpOct))) };
  const bass = { id: 'bass', type: 'tone', wave: 'tri', vol: 0.32, gate: 0.8, adsr: { a: 0.003, d: 0.06, s: 0.8, r: 0.02 }, ...o.bassDef, track: join(...prog.map((c) => BASS[o.bass](c))) };
  const channels = [lead, arp, bass];
  if (o.grit) channels.push({ id: 'grit', type: 'tone', wave: 'p50', vol: 0.045, gate: 0.6, arpRate: 0.028, adsr: { a: 0.002, d: 0.05, s: 0.5, r: 0.02 }, track: join(...prog.map((c) => arpBar(chord(c).root + '5', o.grit, 2))) });
  channels.push(
    { id: 'kick', type: 'kick', vol: 0.4, ...o.kickDef, track: drum(kick, o.kickFill, false) },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 1900, q: 0.9, vol: 0.15, decay: 0.1, ...o.snareDef, track: drum(snare, true, false) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 7000, q: 0.7, vol: 0.05, decay: 0.03, openDecay: 0.14, ...o.hatDef, track: drum(hat, false, o.crash) },
  );
  return { name: o.name, title: o.title, mood: o.mood, bpm: o.bpm, loopStartBar: o.loopStartBar, loop: o.loop, channels };
}

// ================================================================= MENU
export const MENU_QUEST = makeSong({
  name: 'menu-quest', title: 'Road to Adventure', mood: 'adventurous, D mixolydian', bpm: 120,
  prog: ['D', 'C', 'G', 'D', 'Bm', 'G', 'A', 'A'],
  lead: [
    'D5 - - A4 - - D5 - F#5 - - - E5 - D5 -',
    'E5 - - - - - C5 - G4 - - - C5 - E5 -',
    'D5 - - B4 - - G4 - B4 - - - D5 - G5 -',
    'F#5 - - - - - - - A5 - - - F#5 - - -',
    'F#5 - - D5 - - B4 - D5 - - - F#5 - B5 -',
    'B5 - - - A5 - G5 - D5 - - - G5 - - -',
    'A5 - - - - - G5 - F#5 - - - E5 - - -',
    'C#5 - - - E5 - - - A5 - - - G5 - E5 -',
  ],
  leadDef: { vol: 0.14, echo: 0.25, vib: 9 },
  arp: 'X . X . X . X . X . X . X . X .', arpDef: { gate: 0.55, vol: 0.05 },
  bass: 'rootfifth8', bassDef: { vol: 0.3 },
  kit: 'march', kickDef: { vol: 0.34 }, snareDef: { vol: 0.12 }, hatDef: { vol: 0.04 },
});

export const MENU_MIST = makeSong({
  name: 'menu-mist', title: 'Misty Ruins', mood: 'mysterious, E minor', bpm: 84,
  prog: ['Em', 'C', 'Em', 'D', 'Em', 'C', 'Am', 'B7'],
  lead: [
    'B4 - - - - - - - E5 - - - D5 - B4 -',
    'G4 - - - - - - - - - - - . . . .',
    'B4 - - - - - - - G5 - - - F#5 - E5 -',
    'F#5 - - - - - - - D5 - - - - - . .',
    'E5 - - - - - G5 - B5 - - - A5 - G5 -',
    'E5 - - - - - - - - - - - G5 - - -',
    'A5 - - - - - G5 - E5 - - - C5 - - -',
    'D#5 - - - - - - - F#5 - - - B4 - - -',
  ],
  leadDef: { wave: 'tri', vol: 0.2, gate: 0.95, adsr: { a: 0.03, d: 0.2, s: 0.7, r: 0.12 }, echo: 0.35, vib: 14 },
  arp: 'X - - - - - - - - - - - - - - -', arpOct: 4, arpDef: { arpRate: 0.07, gate: 0.97, vol: 0.04, adsr: { a: 0.08, d: 0.4, s: 0.6, r: 0.2 } },
  bass: 'half', bassDef: { vol: 0.28, gate: 0.95, adsr: { a: 0.02, d: 0.3, s: 0.7, r: 0.1 } },
  kit: 'sparse', kickDef: { vol: 0.28 }, snareDef: { vol: 0.08, freq: 2600 }, hatDef: { vol: 0.035 },
});

// ================================================================= HERO
export const HERO_RUN = makeSong({
  name: 'hero-run', title: 'Running Blade', mood: 'fast, E minor', bpm: 152,
  prog: ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'],
  lead: [
    'E5 - G5 - B5 - - - A5 - G5 - F#5 - G5 -',
    'E5 - - - - - - - C5 - D5 - E5 - G5 -',
    'F#5 - - - A5 - - - D5 - - - F#5 - A5 -',
    'D#5 - - - - - - - B4 - - - D#5 - F#5 -',
    'B5 - - - G5 - E5 - G5 - B5 - E6 - - -',
    'D6 - - - C6 - - - G5 - - - E5 - - -',
    'C6 - - - B5 - A5 - E5 - - - C5 - E5 -',
    'D#5 - - - F#5 - - - B5 - - - A5 - F#5 -',
  ],
  arp: 'X . X . X . X . X . X . X . X .', arpDef: { gate: 0.6 },
  bass: 'pulse16', bassDef: { gate: 0.55, vol: 0.3 },
  kit: 'skank', crash: true,
});

export const HERO_SWAGGER = makeSong({
  name: 'hero-swagger', title: 'Iron Swagger', mood: 'bold, G minor', bpm: 134,
  prog: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Cm', 'D'],
  lead: [
    'G4 - - - D5 - - - G5 - - - F5 - D5 -',
    'D#5 - - - - - D5 - A#4 - - - G4 - A#4 -',
    'D5 - - - F5 - - - A#5 - - - A5 - F5 -',
    'A5 - - - - - - - F5 - - - C5 - - -',
    'D5 - A#4 - G4 - A#4 - D5 - G5 - A#5 - - -',
    'G5 - - - - - F5 - D#5 - - - A#4 - - -',
    'C5 - - - D#5 - - - G5 - - - D#5 - C5 -',
    'D5 - - - F#5 - - - A5 - - - - - - .',
  ],
  leadDef: { wave: 'p25', echo: 0.18 },
  arp: 'X - - X - - X - - X - - X - X -',
  bass: 'rootfifth8',
  kit: 'shuffle',
});

// ================================================================= BOSS
export const BOSS_DOOM = makeSong({
  name: 'boss-doom', title: 'Doom March', mood: 'heavy march, D minor', bpm: 128,
  prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A'],
  lead: [
    'D5 - - - - - - - A4 - - - - - - -',
    'F5 - - - E5 - - - D5 - - - C#5 - - -',
    'D5 - - - - - - - F5 - - - A#5 - - -',
    'A5 - - - - - - - - - - - G5 - E5 -',
    'F5 - - - - - E5 - D5 - - - A4 - - -',
    'A#4 - - - - - A4 - G4 - - - D5 - - -',
    'C#5 - - - - - - - E5 - - - G5 - - -',
    'A5 - G5 - F5 - E5 - D5 - C#5 - A#4 - A4 -',
  ],
  leadDef: { wave: 'p12', vol: 0.15, gate: 0.92, echo: 0.12, vib: 16, adsr: { a: 0.01, d: 0.15, s: 0.7, r: 0.05 } },
  arp: 'X - - - X - - - X - X - X - - -', arpDef: { wave: 'p50', vol: 0.045, gate: 0.7 },
  grit: 'X . . . X . . . X . X . X . . .',
  bass: 'octave8', bassDef: { vol: 0.36, gate: 0.7 },
  kit: 'doom', crash: true, kickDef: { vol: 0.42, f0: 130, f1: 38 }, snareDef: { vol: 0.17, freq: 1400 },
});

export const BOSS_FRENZY = makeSong({
  name: 'boss-frenzy', title: 'Frenzy', mood: 'frantic, C phrygian', bpm: 156,
  prog: ['Cm', 'Db', 'Cm', 'Bb', 'Ab', 'Db', 'G', 'G'],
  lead: [
    'C5 . C5 . D#5 . C5 . G5 - - - F5 - D#5 -',
    'C#5 - - - F5 - - - G#5 - - - F5 - C#5 -',
    'C5 . C5 . D#5 . C5 . G5 - - - G#5 - G5 -',
    'F5 - - - - - - - D5 - - - A#4 - - -',
    'C6 - - - G#5 - - - D#5 - - - C5 - D#5 -',
    'F5 - - - G#5 - - - C#6 - - - C6 - G#5 -',
    'B5 - - - - - - - G5 - - - D5 - - -',
    'G5 - F5 - D#5 - D5 - C5 - B4 - D5 - G4 -',
  ],
  leadDef: { wave: 'p25', vol: 0.13, echo: 0.1, vib: 10 },
  arp: 'X . X X . X X . X . X X . X X .', arpDef: { wave: 'p12', vol: 0.045, gate: 0.6 },
  bass: 'pulse16', bassDef: { vol: 0.34, gate: 0.6 },
  kit: 'frantic', kickFill: true, kickDef: { vol: 0.4, f0: 140, f1: 40 }, snareDef: { vol: 0.15, freq: 1600 }, hatDef: { vol: 0.04 },
});

// ================================================================= SURVIVAL
// Narastanie warstwami: 4 takty bas+hi-hat (intro, raz), potem stopa i arp, potem melodia i werbel.
const SURV_PROG = ['Am', 'Am', 'F', 'E'];
const survBars = (fn) => join(...Array.from({ length: 16 }, (_, i) => fn(SURV_PROG[i % 4], i)));
export const SURVIVAL_TIDE = {
  name: 'survival-tide', title: 'Rising Tide', mood: 'tense build, A minor', bpm: 128, loopStartBar: 4,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.14, gate: 0.92, adsr: { a: 0.006, d: 0.12, s: 0.65, r: 0.05 }, echo: 0.25, vib: 10, track: join(
      REST, REST, REST, REST, REST, REST, REST, REST,
      'E5 - - - - - - - - - - - D5 - C5 -',
      'B4 - - - - - - - C5 - - - D5 - - -',
      'C5 - - - - - - - A4 - - - C5 - - -',
      'B4 - - - - - - - G#4 - - - - - - -',
      'A5 - - - - - - - - - - - G5 - E5 -',
      'F5 - - - - - - - E5 - - - D5 - - -',
      'C6 - - - - - - - A5 - - - F5 - - -',
      'G#5 - - - - - - - B5 - - - E6 - - -',
    ) },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.05, gate: 0.85, arpRate: 0.036, adsr: { a: 0.002, d: 0.12, s: 0.5, r: 0.03 },
      track: survBars((c, i) => (i < 4 ? REST : arpBar(c, 'X - - X - - X - X - - X - - X -'))) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.32, gate: 0.6, adsr: { a: 0.003, d: 0.05, s: 0.8, r: 0.02 }, track: survBars((c) => BASS.pulse8(c)) },
    { id: 'kick', type: 'kick', vol: 0.4, track: survBars((_, i) => (i < 4 ? REST : i < 8 ? 'X . . . . . . . X . . . . . . .' : 'X . . . X . . . X . . . X . . .')) },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 1900, q: 0.9, vol: 0.15, decay: 0.1,
      track: survBars((_, i) => (i < 7 ? REST : i === 7 ? '. . . . . . . . g . g . x . x x' : i === 15 ? '. . . . X . . . X . x x X x r r' : '. . . . X . . . . . . . X . . .')) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 7000, q: 0.7, vol: 0.05, decay: 0.03, openDecay: 0.14,
      track: survBars((_, i) => (i < 8 ? 'x . x . x . x . x . x . x . x .' : i === 8 ? 'o g x g x g x g x g x g x g x g' : 'x g x g x g x g x g x g x g x g')) },
  ],
};

export const SURVIVAL_SIEGE = makeSong({
  name: 'survival-siege', title: 'Under Siege', mood: 'urgent, D minor', bpm: 146,
  prog: ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'C', 'A'],
  lead: [
    'D5 . F5 . A5 . F5 . D5 . F5 . A5 . D6 .',
    'C6 - - - A5 - - - F5 - - - E5 - - -',
    'D#5 . G5 . A#5 . G5 . D#5 . G5 . A#5 . D#6 .',
    'D6 - - - A#5 - - - G5 - - - F5 - - -',
    'D5 . F5 . A5 . F5 . D5 . F5 . A5 . D6 .',
    'E6 - - - D6 - - - C6 - - - A5 - - -',
    'G5 - - - E5 - - - C5 - - - E5 - G5 -',
    'A5 - - - - - - - C#6 - - - E6 - - -',
  ],
  leadDef: { wave: 'p12', vol: 0.14, gate: 0.85, echo: 0.15 },
  arp: 'X - X - X - X - X - X - X - X -', arpDef: { wave: 'p25', vol: 0.045, gate: 0.5 },
  bass: 'octave8', bassDef: { gate: 0.65 },
  kit: 'urgent', crash: true,
});

// ================================================================= BOSSRUSH
export const BOSSRUSH_LEGEND = makeSong({
  name: 'bossrush-legend', title: 'Legend', mood: 'epic, B minor', bpm: 148,
  prog: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'],
  lead: [
    'B4 - - - F#5 - - - B5 - - - A5 - F#5 -',
    'G5 - - - - - F#5 - D5 - - - B4 - D5 -',
    'F#5 - - - A5 - - - D6 - - - C#6 - A5 -',
    'C#6 - - - - - - - A5 - - - E5 - - -',
    'D6 - - - C#6 - B5 - F#5 - - - B5 - D6 -',
    'E6 - - - D6 - - - B5 - - - G5 - - -',
    'G5 - - - F#5 - E5 - B5 - - - G5 - E5 -',
    'F#5 - - - A#5 - - - C#6 - - - - - - .',
  ],
  leadDef: { vol: 0.14, echo: 0.25, vib: 10 },
  arp: 'X - - X - - X - X - - X - - X -',
  bass: 'octave8',
  kit: 'epic', crash: true,
});

export const BOSSRUSH_GAUNTLET = makeSong({
  name: 'bossrush-gauntlet', title: 'Gauntlet', mood: 'relentless, A minor (andalusian)', bpm: 160,
  prog: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
  lead: [
    'A5 - - - E5 - - - A5 - B5 - C6 - B5 -',
    'B5 - - - - - - - G5 - - - D5 - - -',
    'A5 - - - F5 - - - C6 - - - A5 - F5 -',
    'G#5 - - - - - - - E5 - - - B4 - - -',
    'C6 - - - B5 - A5 - E5 - - - A5 - C6 -',
    'D6 - - - C6 - B5 - G5 - - - B5 - D6 -',
    'C6 - - - A5 - - - F5 - - - A5 - C6 -',
    'B5 - - - G#5 - - - E5 - - - D5 - B4 -',
  ],
  leadDef: { wave: 'p25', vol: 0.13, echo: 0.2 },
  arp: 'X . X . X . X . X . X . X . X .', arpDef: { gate: 0.6 },
  grit: 'X . X X X . X X X . X X X . X -',
  bass: 'gallop', bassDef: { gate: 0.7, vol: 0.34 },
  kit: 'four', crash: true, snareDef: { vol: 0.16 },
});

// ================================================================= DEFEAT (krótki smutny dżingiel, bez pętli)
export const DEFEAT = {
  name: 'defeat-lament', title: 'Lament', mood: 'sad, A minor', bpm: 100, loop: false,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.14, gate: 0.95, adsr: { a: 0.01, d: 0.15, s: 0.65, r: 0.15 }, echo: 0.3, vib: 14, track: join(
      'E5 - - - D5 - - - C5 - - - B4 - - -',
      'A4 - - - - - - - - - - - . . . .',
    ) },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.045, gate: 0.95, arpRate: 0.05, adsr: { a: 0.01, d: 0.2, s: 0.6, r: 0.15 }, track: join(
      'A3m - - - - - - - E3M - - - - - - -',
      'F3M - - - E3M - - - A3m - - - . . . .',
    ) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.28, gate: 0.95, adsr: { a: 0.01, d: 0.2, s: 0.7, r: 0.15 }, track: join(
      'A2 - - - - - - - G#2 - - - - - - -',
      'F2 - - - E2 - - - A2 - - - . . . .',
    ) },
    { id: 'kick', type: 'kick', vol: 0.3, track: join('X . . . . . . . . . . . . . . .', 'x . . . . . . . . . . . . . . .') },
  ],
};

export const EXTRA_SONGS = [MENU_QUEST, MENU_MIST, HERO_RUN, HERO_SWAGGER, BOSS_DOOM, BOSS_FRENZY, SURVIVAL_TIDE, SURVIVAL_SIEGE, BOSSRUSH_LEGEND, BOSSRUSH_GAUNTLET, DEFEAT];
