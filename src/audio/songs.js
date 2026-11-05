/**
 * Utwory chiptune (dane dla mini-trackera z pattern.js). Krok = 1/16, takt = 16 kroków.
 * Kanały: lead (puls 25/12.5%), arp/harmonia (puls), bass (trójkąt), kick (trójkąt z opadającą
 * wysokością), snare/hat (szum filtrowany). Jeden głos na kanał, jak w prawdziwym chipie.
 *
 * Tonacje: menu C-dur/a-moll, hero a-moll, boss a-moll frygijski/harmoniczny (ta sama rodzina),
 * case: pedał na dominancie E z chromatycznym riserem, victory: C-dur (paralela a-moll).
 */

const rep = (s, n) => Array(n).fill(s).join(' | ');
const join = (...bars) => bars.join(' | ');

// ---------------------------------------------------------------- MENU (96 BPM, 16 taktów)
// Fmaj7 | G | Em7 | Am | Dm7 | G7 | C | E7  (×2, druga połowa: wariant melodii)
const MENU_BASS = join(
  'F2 - - - - - C3 - F3 - - - C3 - - -',
  'G2 - - - - - D3 - G3 - - - D3 - - -',
  'E2 - - - - - B2 - E3 - - - B2 - - -',
  'A2 - - - - - E3 - A3 - - - E3 - - -',
  'D2 - - - - - A2 - D3 - - - A2 - - -',
  'G2 - - - - - D3 - G3 - - - D3 - - -',
  'C2 - - - - - G2 - C3 - - - G2 - - -',
  'E2 - - - - - B2 - E3 - - - G#2 - - -',
);
const MENU_ARP = join(
  'A3 . C4 . E4 . C4 . A3 . C4 . E4 . C4 .',
  'B3 . D4 . G4 . D4 . B3 . D4 . G4 . D4 .',
  'G3 . B3 . D4 . B3 . G3 . B3 . E4 . B3 .',
  'C4 . E4 . A4 . E4 . C4 . E4 . A4 . E4 .',
  'A3 . D4 . F4 . D4 . A3 . D4 . F4 . C4 .',
  'B3 . D4 . G4 . D4 . B3 . D4 . F4 . D4 .',
  'C4 . E4 . G4 . E4 . C4 . E4 . G4 . E4 .',
  'B3 . E4 . G#4 . E4 . B3 . E4 . G#4 . D4 .',
);
const MENU_LEAD = join(
  // A: spokojny motyw „ćwierćnuta z kropką, ósemka, ćwierć, ćwierć”
  'E5 - - - - - D5 - C5 - - - A4 - - -',
  'B4 - - - - - C5 - D5 - - - G4 - - -',
  'G4 - - - - - A4 - B4 - - - D5 - - -',
  'C5 - - - - - B4 - A4 - - - - - - .',
  'F5 - - - - - E5 - D5 - - - A4 - - -',
  'B4 - - - - - C5 - D5 - - - F5 - - -',
  'E5 - - - - - D5 - C5 - - - G4 - - -',
  'B4 - - - - - G#4 - E4 - - - G#4 - B4 -',
  // B: wyżej, więcej ruchu
  'A5 - - - G5 - E5 - F5 - E5 - C5 - - -',
  'D5 - - - B4 - D5 - G5 - - - F5 - D5 -',
  'E5 - - - D5 - B4 - G4 - - - B4 - D5 -',
  'C5 - - - - - - - E5 - - - A5 - - -',
  'A5 - - - G5 - F5 - E5 - - - D5 - - -',
  'D5 - - - B4 - G4 - B4 - - - D5 - F5 -',
  'E5 - - - - - G5 - C6 - - - - - - .',
  'B5 - - - G#5 - E5 - D5 - - - B4 - - -',
);

export const MENU = {
  name: 'menu',
  bpm: 96,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.15, gate: 0.92, adsr: { a: 0.01, d: 0.12, s: 0.65, r: 0.06 }, echo: 0.3, vib: 9, track: MENU_LEAD },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.06, gate: 0.6, adsr: { a: 0.004, d: 0.08, s: 0.4, r: 0.03 }, track: rep(MENU_ARP, 2) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.3, gate: 0.9, adsr: { a: 0.006, d: 0.2, s: 0.75, r: 0.05 }, track: rep(MENU_BASS, 2) },
    { id: 'kick', type: 'kick', vol: 0.32, track: rep('x . . . . . . . x . . . . . . .', 16) },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 2200, q: 0.8, vol: 0.12, decay: 0.09, track: rep('. . . . g . . . . . . . g . . .', 16) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 7500, q: 0.7, vol: 0.05, decay: 0.03, track: rep('. . x . . . x . . . x . . . x .', 16) },
  ],
};

// ---------------------------------------------------------------- HERO (140 BPM, 16 taktów)
// A: Am | F | G | Am | Am | F | G | E    B: F | G | Am | Am | F | G | E | E
const HERO_PROG = ['A', 'F', 'G', 'A', 'A', 'F', 'G', 'E', 'F', 'G', 'A', 'A', 'F', 'G', 'E', 'E'];
const HERO_BASS_BAR = {
  A: 'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .',
  F: 'F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .',
  G: 'G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .',
  E: 'E2 . E3 . E2 . E3 . E2 . E3 . G#2 . B2 .',
};
const syncop = (c) => `${c} - - ${c} - - ${c} - ${c} - - ${c} - - ${c} -`; // 3-3-2 | 3-3-2
const HERO_ARP_BAR = { A: syncop('A3m'), F: syncop('F3M'), G: syncop('G3M'), E: syncop('E3M') };
const HERO_LEAD = join(
  'A4 - - E5 - - A5 - G5 - E5 - D5 - E5 -',
  'F5 - - - - - E5 - C5 - - - A4 - C5 -',
  'D5 - - G5 - - D5 - B4 - - - G4 - B4 -',
  'C5 - - - B4 - - - A4 - - - - - - .',
  'A4 - - E5 - - A5 - B5 - C6 - B5 - A5 -',
  'C6 - - - - - A5 - F5 - - - A5 - C6 -',
  'B5 - - - G5 - - - D5 - - - G5 - B5 -',
  'B5 - - - - - G#5 - E5 - - - - - - .',
  'A5 - - - - - G5 - F5 - - - E5 - - -',
  'D5 - - - - - E5 - F5 - - - G5 - - -',
  'E5 - - - - - - - C5 - - - E5 - - -',
  'A5 - - - - - - - - - - - G5 - E5 -',
  'F5 - - - - - E5 - F5 - - - A5 - - -',
  'G5 - - - - - F5 - G5 - - - B5 - - -',
  'G#5 - - - - - - - B5 - - - - - - .',
  'E6 - - - B5 - - - G#5 - - - E5 - - -',
);
const HERO_KICK = 'X . . . . . . . x . x . . . . .';
const HERO_SNARE = '. . . . X . . . . . . . X . . .';
const HERO_FILL = '. . . . X . . . X . x x X x X X';
const HERO_HAT = 'x . x . x . o . x . x . x . o .';

export const HERO = {
  name: 'hero',
  bpm: 140,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.14, gate: 0.9, adsr: { a: 0.004, d: 0.1, s: 0.6, r: 0.04 }, echo: 0.22, vib: 8, track: HERO_LEAD },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.055, gate: 0.85, arpRate: 0.036, adsr: { a: 0.002, d: 0.12, s: 0.5, r: 0.03 }, track: join(...HERO_PROG.map((c) => HERO_ARP_BAR[c])) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.32, gate: 0.8, adsr: { a: 0.003, d: 0.06, s: 0.8, r: 0.02 }, track: join(...HERO_PROG.map((c) => HERO_BASS_BAR[c])) },
    { id: 'kick', type: 'kick', vol: 0.4, track: rep(HERO_KICK, 16) },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 1900, q: 0.9, vol: 0.15, decay: 0.1, track: join(rep(HERO_SNARE, 7), HERO_FILL, rep(HERO_SNARE, 7), HERO_FILL) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 7000, q: 0.7, vol: 0.05, decay: 0.03, openDecay: 0.12, track: rep(HERO_HAT, 16) },
  ],
};

// ---------------------------------------------------------------- BOSS (140 BPM, 8 taktów)
// Am | Bb | Am | E | F | Bb | E | E — frygijskie bII (Bb) i dominanta E z F (b9): ciemniej, ta sama tonika
const BOSS_PROG = ['A', 'Bb', 'A', 'E', 'F', 'Bb', 'E', 'E'];
const gallop = (lo, hi) => rep(`${lo} . ${hi} ${hi}`, 4);
const BOSS_BASS = { A: gallop('A1', 'A2'), Bb: gallop('A#1', 'A#2'), E: gallop('E2', 'E2'), F: gallop('F1', 'F2') };
const powr = (n) => `${n} . ${n} ${n} ${n} . ${n} ${n} ${n} . ${n} ${n} ${n} . ${n} -`;
const BOSS_GRIT = { A: powr('A2pw'), Bb: powr('A#2pw'), E: powr('E2pw'), F: powr('F2pw') };
const BOSS_LEAD = join(
  'A4 - - - A#4 - A4 - E5 - - - D#5 - D5 -',
  'D5 - - - C5 - A#4 - F4 - - - A#4 - D5 -',
  'A4 - - - A#4 - A4 - E5 - - - F5 - G#5 -',
  'B5 - - - - - - - G#5 - - - F5 - E5 -',
  'A5 - - - G#5 - A5 - C6 - - - A5 - F5 -',
  'A#5 - - - A5 - F5 - D5 - - - F5 - A#5 -',
  'G#5 - - - - - - - E5 - - - D5 - B4 -',
  'G#5 - F5 - E5 - D5 - C5 - B4 - A4 - G#4 -',
);
const BOSS_KICK = 'X . x x X . x x X . x x X . x x';
const BOSS_KICK_FILL = 'X . x x X . x x X x X x X x X x';
const BOSS_SNARE = '. . g . X . . g . . g . X . . g';
const BOSS_FILL = '. . g . X . . g X . X X r r r r';
const BOSS_HAT = 'x g x g x g x g x g x g x g x g';

export const BOSS = {
  name: 'boss',
  bpm: 140,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p12', vol: 0.15, gate: 0.88, adsr: { a: 0.003, d: 0.08, s: 0.7, r: 0.03 }, echo: 0.14, vib: 14, track: BOSS_LEAD },
    { id: 'grit', type: 'tone', wave: 'p50', vol: 0.05, gate: 0.6, arpRate: 0.028, adsr: { a: 0.002, d: 0.05, s: 0.5, r: 0.02 }, track: join(...BOSS_PROG.map((c) => BOSS_GRIT[c])) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.36, gate: 0.75, adsr: { a: 0.002, d: 0.05, s: 0.8, r: 0.02 }, track: join(...BOSS_PROG.map((c) => BOSS_BASS[c])) },
    { id: 'kick', type: 'kick', vol: 0.42, f0: 140, f1: 40, track: join(rep(BOSS_KICK, 7), BOSS_KICK_FILL) },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 1500, q: 0.8, vol: 0.17, decay: 0.11, track: join(rep(BOSS_SNARE, 3), BOSS_FILL, rep(BOSS_SNARE, 3), BOSS_FILL) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 6500, q: 0.7, vol: 0.045, decay: 0.025, track: join('o g x g x g x g x g x g x g x g', rep(BOSS_HAT, 3), 'o g x g x g x g x g x g x g x g', rep(BOSS_HAT, 3)) },
  ],
};

// ---------------------------------------------------------------- CASE (150 BPM: 2 takty = 3.2 s)
// Werbel narasta (ćwierćnuty → ósemki → szesnastki → tremolo), chromatyczny riser A3→E4 nad pedałem E.
// Drugi takt się zapętla (gdyby animacja trwała dłużej) — napięcie bez rozwiązania.
export const CASE = {
  name: 'case',
  bpm: 150,
  loopStartBar: 1,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.11, gate: 0.7, adsr: { a: 0.002, d: 0.04, s: 0.6, r: 0.02 }, track: join(
      'A3 A3 A3 A3 A#3 A#3 A#3 A#3 B3 B3 B3 B3 C4 C4 C4 C4',
      'C#4 C#4 C#4 C#4 D4 D4 D4 D4 D#4 D#4 D#4 D#4 E4 E4 E4 E4',
    ) },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.04, gate: 0.8, adsr: { a: 0.002, d: 0.03, s: 0.7, r: 0.01 }, track: rep('E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5 E5 F5', 2) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.3, gate: 0.7, adsr: { a: 0.002, d: 0.04, s: 0.8, r: 0.02 }, track: join(
      'E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 .',
      'E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2 E2',
    ) },
    { id: 'kick', type: 'kick', vol: 0.38, track: join('X . . . . . . . X . . . . . . .', 'X . . . X . . . X . . . X . X .') },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 2000, q: 0.9, vol: 0.15, decay: 0.07, track: join(
      'g . . . g . . . x . x . x . x .',
      'x x x x x x x x X X X X r r r r',
    ) },
  ],
};

// ---------------------------------------------------------------- VICTORY (150 BPM, bez pętli, ~4.5 s)
// C | F G | C (wybrzmienie) → cisza
export const VICTORY = {
  name: 'victory',
  bpm: 150,
  loop: false,
  channels: [
    { id: 'lead', type: 'tone', wave: 'p25', vol: 0.15, gate: 0.94, adsr: { a: 0.004, d: 0.1, s: 0.7, r: 0.15 }, echo: 0.25, vib: 12, track: join(
      'G4 - C5 - E5 - G5 - - - E5 - G5 - - -',
      'A5 - - - F5 - A5 - B5 - - - G5 - B5 -',
      'C6 - - - - - - - - - - - . . . .',
    ) },
    { id: 'arp', type: 'tone', wave: 'p12', vol: 0.06, gate: 0.95, arpRate: 0.034, adsr: { a: 0.003, d: 0.2, s: 0.6, r: 0.12 }, track: join(
      'C4M - - - - - - - - - - - - - - -',
      'F4M - - - - - - - G4M - - - - - - -',
      'C4M - - - - - - - - - - - . . . .',
    ) },
    { id: 'bass', type: 'tone', wave: 'tri', vol: 0.3, gate: 0.85, adsr: { a: 0.004, d: 0.1, s: 0.8, r: 0.12 }, track: join(
      'C3 . . . C3 . . . G2 . . . C3 . . .',
      'F2 . . . F2 . . . G2 . . . G2 . . .',
      'C2 - - - - - - - - - - - . . . .',
    ) },
    { id: 'kick', type: 'kick', vol: 0.36, track: join('X . . . X . . . X . . . X . . .', 'X . . . X . . . X . . . X . . .', 'X . . . . . . . . . . . . . . .') },
    { id: 'snare', type: 'noise', filter: 'bandpass', freq: 2000, q: 0.9, vol: 0.14, decay: 0.09, track: join(
      'x . x . x . x . X . . . X . . .',
      'X . . . X . . . X . x x X x X X',
      'X . . . . . . . . . . . . . . .',
    ) },
    { id: 'hat', type: 'noise', filter: 'highpass', freq: 5000, q: 0.6, vol: 0.06, decay: 0.03, openDecay: 1.2, track: join(
      'x . x . x . x . x . x . x . x .',
      'x . x . x . x . x . x . x . x .',
      'o . . . . . . . . . . . . . . .',
    ) },
  ],
};

export const SONGS = { menu: MENU, hero: HERO, boss: BOSS, case: CASE, victory: VICTORY };
