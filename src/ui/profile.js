import { sanitizeLook } from '../sim/cosmetics.js';

/** Profil lokalny gracza (localStorage): nick i wybrana klasa. Lekki — używany na ekranie startowym. */
const KEY = 'korona.profile';
const CLASSES = ['rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid'];

/** @returns {{nick:string, skin:string, look:{color:string,hat:string,nose:string}}} */
export function getProfile() {
  let p;
  try {
    p = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    p = {};
  }
  let nick = typeof p.nick === 'string' ? p.nick.slice(0, 16) : '';
  if (!nick) {
    try {
      nick = (localStorage.getItem('korona.nick') || '').slice(0, 16);
    } catch {
      nick = '';
    }
  }
  const skin = CLASSES.includes(p.skin) ? p.skin : 'rycerz';
  return { nick, skin, look: sanitizeLook(p.look, skin) };
}

/** @param {Partial<{nick:string, skin:string, look:{color:string,hat:string,nose:string}}>} patch */
export function setProfile(patch) {
  const merged = { ...getProfile(), ...patch };
  const next = { ...merged, look: sanitizeLook(merged.look, merged.skin) };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* brak storage */
  }
  for (const cb of listeners) cb(next);
  return next;
}

const listeners = new Set();
/** @param {(p:{nick:string,skin:string})=>void} cb */
export function onProfileChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Wygląd do użycia w meczu: tylko odblokowane i pasujące do klasy kosmetyki (reszta → domyślne).
 * @param {string} [skin] @returns {Promise<{color:string,hat:string,nose:string}>}
 */
export async function getActiveLook(skin) {
  const p = getProfile();
  const cls = skin || p.skin;
  const [{ unlockedIds }, { findCosmetic, isAvailable, DEFAULT_LOOK }] = await Promise.all([import('./achievements.js'), import('../sim/cosmetics.js')]);
  const un = unlockedIds();
  const look = { ...DEFAULT_LOOK };
  for (const kind of /** @type {const} */ (['color', 'hat', 'nose'])) {
    const c = findCosmetic(kind, p.look[kind]);
    if (c && isAvailable(c, un, cls)) look[kind] = c.id;
  }
  return look;
}
