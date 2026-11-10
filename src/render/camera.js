import { getMap, mapExtent } from '../sim/maps.js';
import { PPM } from './sprites.js';
import { hudTopPx, hudChipsPx, touchClusterRect } from './hudLayout.js';

/**
 * Kamera pixel art. Świat rysowany jest w buforze o niskiej rozdzielczości (PPM pikseli sztuki
 * na metr), a bufor powiększany na ekran współczynnikiem S bez wygładzania.
 *  - mode 'fit': cała arena pod górnym pasem HUD (wspólny ekran, mecz samych botów),
 *  - mode 'follow': kamera za graczem; `viewM` to docelowa szerokość widoku w metrach
 *    (online ciaśniej, solo z botami szerzej). Widok nie wyjeżdża poza mapę dalej niż EDGE_MARGIN_M.
 * Skala od 2× w górę jest zawsze całkowita (dithering telegrafów nie daje mory).
 */

/** Docelowa szerokość widoku kamery „follow” (metry). */
export const VIEW_M = Object.freeze({ online: 22, solo: 30 });
/** Wyprzedzenie kamery w stronę celowania (metry): mysz mało (widok nie „pływa”), reszta więcej. */
export const LOOK_AHEAD_M = Object.freeze({ mouse: 0.5, other: 1.6 });
/** Kamera „follow” nigdy nie oddala się poniżej tej skali (postać ≥ 32 px). */
const MIN_FOLLOW_S = 2;
/** Ile metrów pustki za krawędzią mapy może pokazać kamera „follow”. */
const EDGE_MARGIN_M = 1.5;
/** Zapas wokół areny w trybie 'fit' (metry łącznie): w poziomie i w pionie pod pasem HUD. */
const FIT_PAD_X_M = 3;
const FIT_PAD_Y_M = 1;
/** Szybkość doganiania celu (1/s): żywy gracz / martwy (spokojny najazd zamiast cięcia). */
const FOLLOW_RATE = 6;
const DEAD_RATE = 2.5;
/** Dotyk: bohater przesunięty w lewo od środka o ten ułamek szerokości (nie pod przyciskami). */
const TOUCH_SHIFT_FRAC = 0.07;
/** Zmiana skali: tyle jednostek S na sekundę, krokami co ćwierć. */
const ZOOM_RATE = 5;

export function createCamera() {
  return {
    x: 0,
    y: 0,
    /** piksele ekranu na piksel sztuki */
    S: 2,
    /** piksele ekranu na metr (S * PPM) — dla HUD i myszy */
    scale: 2 * PPM,
    w: 1,
    h: 1,
    aw: 1,
    ah: 1,
    mode: /** @type {'fit'|'follow'} */ ('fit'),
    /** szerokość widoku 'follow' w metrach */
    viewM: VIEW_M.online,
    /** wyprzedzenie w stronę celowania (m) */
    lookAhead: LOOK_AHEAD_M.other,
    /** układ dotykowy: bohater lekko w lewo, margines na klaster przycisków */
    touch: false,
    /** następna aktualizacja skacze do celu zamiast go doganiać (start meczu) */
    snap: true,
    /** wewnętrzny, nieprzyciągnięty postęp zmiany skali */
    zoom: 2,
    shakeX: 0,
    shakeY: 0,
  };
}

/**
 * Zaokrągla skalę: od 2× do całkowitych (równe piksele, brak mory), niżej do ćwiartek.
 * @param {number} s
 */
export function snapScale(s) {
  if (s >= 2) return Math.floor(s);
  return Math.max(1, Math.floor(s * 4) / 4);
}

/** Skala, przy której cała arena mieści się pod pasem HUD. @param {{hw:number,hh:number}} ext @param {number} band px */
export function fitScale(w, h, ext, band) {
  return snapScale(Math.min(w / ((ext.hw * 2 + FIT_PAD_X_M) * PPM), (h - band) / ((ext.hh * 2 + FIT_PAD_Y_M) * PPM)));
}

/** Skala kamery za graczem dla widoku o szerokości `viewM` metrów. @param {{hw:number,hh:number}} ext */
export function followScale(w, h, ext, viewM) {
  const whole = Math.min(w / ((ext.hw * 2 + FIT_PAD_X_M) * PPM), h / ((ext.hh * 2 + FIT_PAD_X_M) * PPM));
  return Math.max(MIN_FOLLOW_S, snapScale(Math.max(whole, Math.min(w, h * 1.6) / (viewM * PPM))));
}

/**
 * Środek widoku na jednej osi: za celem, ale tak, by widok nie wyszedł poza mapę dalej niż margines.
 * Gdy cała mapa (z marginesami) mieści się w widoku, oś jest wyśrodkowana na stałe.
 * @param {number} want pożądany środek (m) @param {number} half połowa widoku (m)
 * @param {number} lo lewa/górna granica świata z marginesem (m) @param {number} hi prawa/dolna granica (m)
 */
export function clampAxis(want, half, lo, hi) {
  const min = lo + half;
  const max = hi - half;
  if (min >= max) return (lo + hi) / 2;
  return Math.max(min, Math.min(max, want));
}

/** Krok skali w stronę celu (ćwiartkami), żeby zmiana trybu kamery nie była cięciem. */
function easeZoom(cam, goal, dt) {
  const d = goal - cam.zoom;
  const stepMax = ZOOM_RATE * dt;
  cam.zoom = Math.abs(d) <= stepMax ? goal : cam.zoom + Math.sign(d) * stepMax;
  return cam.zoom === goal ? goal : Math.max(1, Math.round(cam.zoom * 4) / 4);
}

/** Środek widoku dla 'fit': arena pod pasem HUD, ale dolna krawędź mapy zostaje na ekranie. */
function fitCentreY(cam, ext, band) {
  const wanted = band + (cam.h - band) / 2;
  const lowest = cam.h - ext.hh * cam.scale - cam.scale * 0.25;
  const screenY = Math.max(cam.h / 2, Math.min(wanted, lowest));
  return -(screenY - cam.h / 2) / cam.scale;
}

/**
 * Pożądany i ograniczony środek widoku kamery 'follow'. `hud` = wysokość stałych paneli u góry (px):
 * cel stoi w połowie wolnej części ekranu pod nimi (widać tyle samo nad nim, co pod nim), a górna
 * krawędź mapy może zjechać pod panele, zamiast się pod nimi chować.
 * @returns {[number, number]}
 */
function followCentre(cam, target, ext, hud) {
  const halfW = cam.w / cam.scale / 2;
  const halfH = cam.h / cam.scale / 2;
  const ahead = target.dead ? 0 : cam.lookAhead;
  const shift = cam.touch ? (cam.w * TOUCH_SHIFT_FRAC) / cam.scale : 0;
  const right = cam.touch ? touchClusterRect(cam.w, cam.h).w / cam.scale : 0;
  const top = hud / cam.scale;
  const x = clampAxis(target.x + (target.fx || 0) * ahead + shift, halfW, -ext.hw - EDGE_MARGIN_M, ext.hw + EDGE_MARGIN_M + right);
  const y = clampAxis(target.y + (target.fy || 0) * ahead - top / 2, halfH, -ext.hh - EDGE_MARGIN_M - top, ext.hh + EDGE_MARGIN_M);
  return [x, y];
}

/**
 * @param {ReturnType<typeof createCamera>} cam @param {number} w @param {number} h
 * @param {{x:number,y:number,fx?:number,fy?:number,dead?:boolean}|null} target punkt, za którym idzie kamera
 * @param {number} dt @param {string} [mapId]
 */
export function updateCamera(cam, w, h, target, dt, mapId) {
  const jump = cam.snap || w !== cam.w || h !== cam.h;
  cam.w = w;
  cam.h = h;
  const ext = mapExtent(getMap(mapId));
  const band = hudTopPx(w, h);
  const follow = cam.mode === 'follow' && !!target;
  const goal = follow ? followScale(w, h, ext, cam.viewM) : fitScale(w, h, ext, band);
  if (jump) cam.zoom = goal;
  cam.S = jump ? goal : easeZoom(cam, goal, dt);
  cam.scale = cam.S * PPM;
  cam.aw = Math.ceil(w / cam.S);
  cam.ah = Math.ceil(h / cam.S);
  const [tx, ty] = follow ? followCentre(cam, /** @type {any} */ (target), ext, hudChipsPx(w, h)) : [0, fitCentreY(cam, ext, band)];
  const k = jump ? 1 : 1 - Math.exp(-(target?.dead ? DEAD_RATE : FOLLOW_RATE) * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.snap = false;
}

/** Czy martwy gracz czeka bez odliczania („wraca po fali” — flaga `benched` z symulacji). @param {any} p */
export const isBenched = (p) => !!p && !p.alive && !!p.benched;

/**
 * Punkt, za którym idzie kamera gracza `me`: żywy — on sam; martwy — miejsce śmierci (bez cięcia);
 * czekający do końca fali — najbliższy żywy sojusznik (podgląd walki).
 * @param {any} view @param {any} me @returns {{x:number,y:number,fx?:number,fy?:number,dead?:boolean}|null}
 */
export function cameraTarget(view, me) {
  if (!me) return null;
  if (me.alive) return me;
  if (isBenched(me)) {
    let best = null;
    let bestD = Infinity;
    for (const p of view.players) {
      if (!p.alive || !p.connected || p.ai || p.id === me.id) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (best) return { x: best.x, y: best.y, dead: true };
  }
  return { x: me.x, y: me.y, dead: true };
}

/** Świat -> piksele sztuki (całkowite, przyciągnięte do siatki). @param {ReturnType<typeof createCamera>} cam */
export function worldToArt(cam, x, y) {
  return [Math.round((x - cam.x) * PPM + cam.aw / 2 + cam.shakeX), Math.round((y - cam.y) * PPM + cam.ah / 2 + cam.shakeY)];
}

/** Świat -> piksele ekranu (dla napisów HUD). @param {ReturnType<typeof createCamera>} cam */
export function worldToScreen(cam, x, y) {
  const [ax, ay] = worldToArt(cam, x, y);
  return [ax * cam.S, ay * cam.S];
}

/** Ekran -> świat (celowanie myszą). @param {ReturnType<typeof createCamera>} cam */
export function screenToWorld(cam, sx, sy) {
  return [(sx / cam.S - cam.aw / 2 - cam.shakeX) / PPM + cam.x, (sy / cam.S - cam.ah / 2 - cam.shakeY) / PPM + cam.y];
}
