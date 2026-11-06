/**
 * Biblioteka utworów i playlisty trybów (czyste): wybór losowy bez natychmiastowego powtórzenia,
 * moment rotacji (po ~2 pętlach). Używane przez music.js, testowane w Node.
 */
import { BASE_SONGS } from './songs.js';
import { EXTRA_SONGS } from './songs-extra.js';

/** Wszystkie utwory po id. */
export const SONGS = Object.fromEntries([...BASE_SONGS, ...EXTRA_SONGS].map((s) => [s.name, s]));

/** Tryb → lista utworów (kolejność bez znaczenia; wybór losowy). */
export const PLAYLISTS = {
  menu: ['menu-dawn', 'menu-quest', 'menu-mist'],
  hero: ['hero-crown', 'hero-run', 'hero-swagger'],
  boss: ['boss-tyrant', 'boss-doom', 'boss-frenzy'],
  survival: ['survival-tide', 'survival-siege'],
  bossrush: ['bossrush-legend', 'bossrush-gauntlet'],
  case: ['case-roll'],
  victory: ['victory-fanfare'],
  defeat: ['defeat-lament'],
};

/** Tryby, które rotują utwory (pozostałe: pojedynczy utwór / bez pętli). */
export const ROTATING = new Set(['menu', 'hero', 'boss', 'survival', 'bossrush']);

/**
 * Losuje utwór z listy, nigdy ten sam co `last` (jeśli jest wybór).
 * @param {string[]} list @param {string|null|undefined} last @param {() => number} [rng]
 */
export function pickSong(list, last, rng = Math.random) {
  if (!list || !list.length) return null;
  const pool = list.length > 1 ? list.filter((s) => s !== last) : list;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/**
 * Ile pętli zagrać przed rotacją: 2, a dla krótkich pętli więcej — tak, by utwór grał ≥ minSec.
 * @param {number} loopSec długość części zapętlanej
 */
export const loopsBeforeRotate = (loopSec, minSec = 36, minLoops = 2) => Math.max(minLoops, Math.ceil(minSec / loopSec - 1e-9));

/**
 * Globalny krok, na którym utwór ma ustąpić następnemu (zawsze granica pętli = granica taktu).
 * @param {{len: number, loopStart: number, stepDur: number}} song
 */
export function rotationStep(song) {
  const body = song.len - song.loopStart;
  const loops = loopsBeforeRotate(body * song.stepDur);
  // pierwsze przejście = intro + ciało, każde kolejne = ciało
  return song.len + (loops - 1) * body;
}
