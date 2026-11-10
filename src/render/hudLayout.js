/**
 * Wspólna geometria HUD-u (piksele ekranu): skala, wysokość górnego pasa i prostokąty
 * zajęte przez przyciski dotykowe. Używa jej HUD, kamera (żeby arena nie chowała się
 * pod paskami) i wskaźniki krawędziowe. Czyste funkcje — bez DOM, łatwe do testowania.
 */

/** Skala HUD-u: 1 na telefonach i małych oknach, 2 od ~960 px szerokości. @param {number} w @param {number} h */
export const hudScale = (w, h) => Math.max(1, Math.min(2, Math.round(Math.min(w, h * 1.5) / 640)));

/** Wysokość górnego pasa HUD (wyniki + pasek bossa) w jednostkach skali HUD. */
export const HUD_TOP_U = 62;
/** Dolna krawędź chipów obrażeń i podpisu pod paskiem bossa (jednostki HUD) — poniżej nic stałego nie rysujemy. */
export const HUD_CHIPS_U = 98;

/** Ramka trybu (fala / boss X z Y) w lewym górnym rogu: lewa krawędź (px) i szerokość (jednostki HUD). */
export const MODE_PANEL_X = 8;
export const MODE_PANEL_W_U = 120;

/** Ramka „Bitwa bossów” pod paskami bossów (jednostki HUD; lewa krawędź jak MODE_PANEL_X). */
export const TEAMS_PANEL_U = Object.freeze({ y: 102, w: 132, h: 34 });

/** Kill feed pod zegarem: linia bazowa pierwszego wpisu, odstęp wierszy i szerokość kolumny (jednostki HUD). */
export const FEED_TOP_U = 70;
export const FEED_LINE_U = 15;
export const FEED_W_U = 250;

/** Sloty umiejętności jednego gracza (desktop, lewy dolny róg): bok, odstęp i położenie (jednostki HUD). */
export const SLOT_U = 30;
export const SLOT_GAP_U = 6;
export const SLOT_X_U = 12;
export const SLOT_BOTTOM_U = 46;
/** Najwięcej slotów naraz (boss: LPM, Q, E, R). */
const SLOTS_MAX = 4;

/**
 * Prostokąt zajęty przez sloty umiejętności z podpisami (z zapasem na 4 sloty bossa).
 * @param {number} w @param {number} h @returns {{x:number,y:number,w:number,h:number}}
 */
export function skillSlotsRect(w, h) {
  const u = hudScale(w, h);
  const sw = (SLOT_X_U + SLOTS_MAX * SLOT_U + (SLOTS_MAX - 1) * SLOT_GAP_U + 2) * u;
  const sh = (SLOT_BOTTOM_U + 4) * u;
  return { x: 0, y: h - sh, w: sw, h: sh };
}

/** Panel śmierci: szerokość, wysokość bez/z wierszem zabójcy i odstęp od dołu ekranu (jednostki HUD). */
const DEATH_W_U = 236;
const DEATH_H_U = 24;
const DEATH_H_KILLER_U = 38;
const DEATH_BOTTOM_U = 10;

/**
 * Prostokąt panelu śmierci (dół ekranu, środek). Wspólny dla rysowania i wskaźników krawędziowych.
 * @param {number} w @param {number} h @param {boolean} hasKiller czy jest wiersz „Pokonał cię”
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function deathPanelRect(w, h, hasKiller) {
  const u = hudScale(w, h);
  const pw = Math.min(DEATH_W_U * u, w - 24);
  const ph = (hasKiller ? DEATH_H_KILLER_U : DEATH_H_U) * u;
  return { x: Math.round((w - pw) / 2), y: h - ph - DEATH_BOTTOM_U * u, w: pw, h: ph };
}

/** Górny pas HUD w pikselach ekranu. @param {number} w @param {number} h */
export const hudTopPx = (w, h) => HUD_TOP_U * hudScale(w, h);

/** Dolna krawędź stałych paneli u góry (z chipami obrażeń) w pikselach ekranu. @param {number} w @param {number} h */
export const hudChipsPx = (w, h) => HUD_CHIPS_U * hudScale(w, h);

/** Rozmiar przycisku dotykowego — musi odpowiadać `--tb` w style.css (.touch). @param {number} w @param {number} h */
export const touchButtonPx = (w, h) => Math.max(58, Math.min(96, Math.min(w, h) * 0.15));

/** Odstęp klastra przycisków od krawędzi ekranu (px) — jak `.tb-wrap` w style.css. */
const TOUCH_WRAP_INSET = 14;

/**
 * Prostokąt zajęty przez klaster przycisków akcji w prawym dolnym rogu (`.tb-wrap`: 3,4 × 3,2 przycisku).
 * @param {number} w @param {number} h @returns {{x:number,y:number,w:number,h:number}}
 */
export function touchClusterRect(w, h) {
  const tb = touchButtonPx(w, h);
  const cw = tb * 3.4 + TOUCH_WRAP_INSET;
  const ch = tb * 3.2 + TOUCH_WRAP_INSET;
  return { x: w - cw, y: h - ch, w: cw, h: ch };
}

/** Bok przycisku pauzy na dotyku + margines (px) — musi odpowiadać `.tp-pause` w style.css. */
export const TOUCH_PAUSE_PX = 44 + 12;

/** Liczba kart ulepszeń w ofercie (przerwa między falami). */
export const UPGRADE_CARDS = 3;

/**
 * Prostokąt karty ulepszenia `i` w wierszu `row` (jeden wiersz na lokalnego gracza).
 * Wspólne dla rysowania (hudOverlays.js) i trafiania palcem w kartę (input/touch.js).
 * @param {number} w @param {number} h @param {number} i @param {number} [row]
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function upgradeCardRect(w, h, i, row = 0) {
  const u = hudScale(w, h);
  const cw = Math.min(170 * u, (w - 40) / 3.3);
  const ch = 92 * u;
  return { x: w / 2 + (i - UPGRADE_CARDS / 2) * cw + 4, y: 140 * u + row * (ch + 26 * u), w: cw - 8, h: ch };
}
