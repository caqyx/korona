/** Profil lokalny gracza (localStorage): nick i wybrana klasa. Lekki — używany na ekranie startowym. */
const KEY = 'korona.profile';
const CLASSES = ['rycerz', 'lucznik', 'lotrzyk', 'kaplan', 'inzynier', 'mag', 'barbarzynca', 'druid'];

/** @returns {{nick:string, skin:string}} */
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
  return { nick, skin: CLASSES.includes(p.skin) ? p.skin : 'rycerz' };
}

/** @param {Partial<{nick:string, skin:string}>} patch */
export function setProfile(patch) {
  const next = { ...getProfile(), ...patch };
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
