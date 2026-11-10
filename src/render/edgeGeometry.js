/**
 * Czysta geometria wskaźników krawędziowych (bez canvasa i DOM — testowana jednostkowo):
 * czy punkt wyszedł poza bezpieczny prostokąt ekranu, gdzie postawić znacznik na jego brzegu
 * tak, by nie leżał na panelach HUD, i w którą z 8 stron ma patrzeć grot.
 */

/** @typedef {{l:number,t:number,r:number,b:number}} Box bezpieczny prostokąt (środek znacznika musi w nim leżeć) */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect prostokąt zajęty przez element HUD */

/**
 * Czy punkt ekranu leży poza prostokątem o więcej niż `slack` (histereza: wskaźnik nie miga,
 * gdy cel stoi dokładnie na granicy).
 * @param {Box} box @param {number} x @param {number} y @param {number} [slack]
 */
export function isOutside(box, x, y, slack = 0) {
  return x < box.l - slack || x > box.r + slack || y < box.t - slack || y > box.b + slack;
}

/** Czy punkt leży w prostokącie powiększonym o `pad`. @param {Rect} e */
const inside = (e, x, y, pad) => x >= e.x - pad && x <= e.x + e.w + pad && y >= e.y - pad && y <= e.y + e.h + pad;

/**
 * Najbliższe miejsce tuż za krawędzią wykluczenia `e`, które zostaje w `box`.
 * Zapisuje je w `out`; gdy żadna strona się nie mieści, zostawia punkt bez zmian.
 * @param {Box} box @param {Rect} e @param {number} pad @param {{x:number,y:number}} out
 */
function pushOut(box, e, pad, out) {
  const up = e.y - pad;
  const down = e.y + e.h + pad;
  const left = e.x - pad;
  const right = e.x + e.w + pad;
  const dUp = up >= box.t ? out.y - up : Infinity;
  const dDown = down <= box.b ? down - out.y : Infinity;
  const dLeft = left >= box.l ? out.x - left : Infinity;
  const dRight = right <= box.r ? right - out.x : Infinity;
  const best = Math.min(dUp, dDown, dLeft, dRight);
  if (best === Infinity) return;
  if (best === dUp) out.y = up;
  else if (best === dDown) out.y = down;
  else if (best === dLeft) out.x = left;
  else out.x = right;
}

/**
 * Położenie znacznika dla celu `(x, y)`: przyciągnięte do `box`, a potem wypchnięte z pierwszych
 * `n` wykluczeń (każde powiększone o `pad`). Wynik w `out` (bez alokacji).
 * @param {Box} box @param {Rect[]} excl @param {number} n @param {number} x @param {number} y
 * @param {number} pad @param {{x:number,y:number}} out @returns {{x:number,y:number}} `out`
 */
export function placeBadge(box, excl, n, x, y, pad, out) {
  out.x = Math.max(box.l, Math.min(box.r, x));
  out.y = Math.max(box.t, Math.min(box.b, y));
  for (let i = 0; i < n; i++) if (inside(excl[i], out.x, out.y, pad)) pushOut(box, excl[i], pad, out);
  return out;
}

/**
 * Kierunek `(dx, dy)` zaokrąglony do jednej z 8 stron; składowe wyniku to −1, 0 albo 1.
 * Wektor zerowy daje `(0, 0)`.
 * @param {number} dx @param {number} dy @param {{x:number,y:number}} out @returns {{x:number,y:number}} `out`
 */
export function dir8(dx, dy, out) {
  if (dx === 0 && dy === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const a = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
  // + 0 zamienia −0 na 0
  out.x = Math.round(Math.cos(a)) + 0;
  out.y = Math.round(Math.sin(a)) + 0;
  return out;
}
