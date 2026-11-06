/** Rekordy trybów z botami (localStorage). */
const KEY = 'korona.records';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/** Zapisuje wynik trybu, zwraca true, jeśli to nowy rekord. @param {any} state */
export function saveRecord(state) {
  const md = state.modeData;
  if (!md || !state.mode || state.mode === 'crown') return false;
  const r = load();
  const value = state.mode === 'survival' ? md.wave : md.defeated;
  const prev = r[state.mode]?.value ?? -1;
  if (value <= prev) return false;
  r[state.mode] = { value, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* brak storage */
  }
  return true;
}

/** Tekst rekordu dla karty trybu. @param {string} mode */
export function getBest(mode) {
  const v = load()[mode]?.value;
  if (v === undefined) return '';
  return mode === 'survival' ? `fala ${v}` : mode === 'bossrush' ? `${v}/8 bossów` : '';
}
