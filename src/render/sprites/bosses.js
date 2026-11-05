/**
 * Bossy — proceduralne (cieniowane elipsy, wielokąty, linie) z obrysem warstw.
 * Kanwa BOSS_W×BOSS_H, kotwica (BOSS_OX, BOSS_OY) = środek podstawy.
 * Bossy NIE mają korony (renderer rysuje ją nad sprite'em).
 */
import { PixelBuffer, OUTLINE, ramp, mix, layer, whiteFlash, mod } from './pixels.js';

export const BOSS_W = 56;
export const BOSS_H = 52;
export const BOSS_OX = 28;
export const BOSS_OY = 48;
export const BOSS_FRAMES = { idle: 4, walk: 4, cast: 2, hurt: 1 };

const WHITE = '#ffffff';
const VOID = '#0b0814';

/** Gruba linia (kwadratowy pędzel). */
function thick(b, x0, y0, x1, y1, c, w = 2) {
  const o = Math.floor((w - 1) / 2);
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) b.line(x0 - o + i, y0 - o + j, x1 - o + i, y1 - o + j, c);
}

/** Pseudolosowość deterministyczna (bez Math.random — sprite'y muszą być stałe). */
function hash(n) {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Zygzak błyskawicy. */
function bolt(b, x0, y0, x1, y1, seed, c1, c2) {
  const n = 4;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const jx = i === n ? 0 : (hash(seed * 7 + i) - 0.5) * 6;
    const jy = i === n ? 0 : (hash(seed * 13 + i) - 0.5) * 6;
    const nx = Math.round(x0 + (x1 - x0) * t + jx);
    const ny = Math.round(y0 + (y1 - y0) * t + jy);
    b.line(px, py, nx, ny, c1);
    if (c2) b.set(nx, ny, c2);
    px = nx;
    py = ny;
  }
}

/** Zakrzywione ostrze od dłoni w kierunku ang. */
function crescent(b, hx, hy, ang, c1, c2) {
  for (let i = 1; i <= 7; i++) {
    const a = ang + (i / 7) * 0.9;
    const x = Math.round(hx + Math.cos(a) * i);
    const y = Math.round(hy + Math.sin(a) * i);
    b.set(x, y, i > 5 ? c2 : c1);
    if (i < 6) b.set(x - Math.round(Math.sin(a)), y + Math.round(Math.cos(a)), c2);
  }
}

/** Cieniowanie wielokąta w poziomie (jasno z lewej). */
function hgrad(rmp, x0, x1) {
  return (x) => {
    const t = (x - x0) / Math.max(1, x1 - x0);
    return rmp[t < 0.07 ? 3 : t < 0.5 ? 2 : t < 0.88 ? 1 : 0];
  };
}

// ---------------------------------------------------------------- Kolos
function kolos(b, fx, anim, f, col) {
  const stone = ramp(mix('#6a6070', col, 0.3));
  const glow = col;
  const hot = mix(col, WHITE, 0.55);
  const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? [0, 0, 1, 1][f] : 0;
  const cast = anim === 'cast';
  const swing = anim === 'walk' ? [2, 0, -2, 0][f] : 0;
  const lift = anim === 'walk' ? [[0, 0], [2, 0], [0, 0], [0, 2]][f] : [0, 0];

  const fistB = cast ? [13, 12 + f] : [9, 36 + swing + bob];
  const fistF = cast ? [42, 11 + f] : [47, 37 - swing + bob];
  // tylna ręka
  layer(b, (w) => {
    w.shaded(15, 24 + bob, 6, 5, stone, { max: 3 });
    w.shaded((15 + fistB[0]) / 2, (24 + bob + fistB[1]) / 2, 4, 4, stone, { max: 2 });
    w.shaded(fistB[0], fistB[1], 5, 5, stone, { max: 3 });
  });
  // nogi
  layer(b, (w) => {
    w.shaded(20, 44 - lift[0], 5, 4, stone);
    w.shaded(35, 44 - lift[1], 5, 4, stone);
  });
  // tułów + głowa
  layer(b, (w) => {
    w.shaded(27, 31 + bob, 14, 12, stone);
    w.shaded(35, 16 + bob, 7, 6, stone);
    w.rect(31, 14 + bob, 9, 1, stone[0]);
    // pęknięcia i runa
    const y = bob;
    w.line(19, 26 + y, 22, 30 + y, stone[0]);
    w.line(22, 30 + y, 20, 35 + y, stone[0]);
    w.line(33, 37 + y, 37, 34 + y, stone[0]);
    w.line(23, 39 + y, 26, 41 + y, stone[0]);
    w.rect(28, 28 + y, 4, 4, cast ? hot : glow);
    w.rect(29, 29 + y, 2, 2, hot);
    w.set(29, 27 + y, glow);
    w.set(32, 32 + y, glow);
    // oczy
    w.rect(35, 16 + y, 2, 2, glow);
    w.rect(39, 16 + y, 2, 2, glow);
    w.set(35, 16 + y, cast ? WHITE : hot);
    w.set(39, 16 + y, cast ? WHITE : hot);
    w.line(18, 33 + y, 24, 37 + y, glow);
    w.line(36, 27 + y, 39, 31 + y, glow);
  });
  // przednia ręka
  layer(b, (w) => {
    w.shaded(40, 24 + bob, 6, 5, stone);
    w.shaded((40 + fistF[0]) / 2, (24 + bob + fistF[1]) / 2, 4, 4, stone);
    w.shaded(fistF[0], fistF[1], 6, 6, stone);
    w.line(fistF[0] - 2, fistF[1] - 1, fistF[0] + 2, fistF[1] - 1, stone[1]);
    w.set(fistF[0] + 3, fistF[1] + 1, glow);
  });
  if (cast) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + f * 0.5;
      fx.set(Math.round(28 + Math.cos(a) * 18), Math.round(10 + f + Math.sin(a) * 4), i % 2 ? glow : hot);
    }
  }
}

// ---------------------------------------------------------------- Cień
function cien(b, fx, anim, f, col) {
  const cloak = ramp(mix(col, '#140a24', 0.5));
  const glow = mix(col, WHITE, 0.25);
  const hot = mix(col, WHITE, 0.7);
  const bob = anim === 'cast' ? -2 : [0, -1, -2, -1][f];
  const cast = anim === 'cast';
  const sway = anim === 'walk' ? [1, 0, -1, 0][f] : 0;

  // szal (za plecami)
  layer(b, (w) => {
    for (let i = 0; i < 16; i++) {
      const x = 24 - i;
      const y = Math.round(22 + bob + i * 0.35 + Math.sin(i * 0.6 - f * 1.4) * 1.6);
      w.rect(x, y, 1, 2, i < 4 ? col : cloak[3]);
    }
  });
  // tylne ostrze
  layer(b, (w) => {
    const [hx, hy] = cast ? [14, 18 + bob] : [17, 32 + bob];
    w.shaded(hx, hy, 2, 2, cloak);
    if (cast) crescent(w, hx, hy - 2, -2.0, glow, hot);
    else crescent(w, hx - 1, hy + 1, 2.3, glow, hot);
  });
  // płaszcz
  layer(b, (w) => {
    const top = 19 + bob;
    const bot = 44 + bob;
    const pts = [[22 + sway, top], [35 + sway, top], [41, bot - 6]];
    for (let i = 0; i <= 6; i++) {
      const x = 41 - i * 4;
      const y = bot - 6 + (i % 2 === 0 ? 4 + ((i + f) % 3) : 0);
      pts.push([x, y]);
    }
    pts.push([15, bot - 6]);
    w.poly(pts, hgrad(cloak, 16, 41));
    w.line(29 + sway, top + 3, 30, bot - 4, cloak[0]);
    w.line(24, 30 + bob, 34, 30 + bob, col); // pas
    w.set(29, 30 + bob, hot);
    // kaptur
    w.shaded(29 + sway, 15 + bob, 8, 7, cloak);
    w.set(22 + sway, 9 + bob, cloak[2]);
    w.ellipse(32 + sway, 16 + bob, 4.5, 3.6, VOID);
    w.rect(32 + sway, 16 + bob, 2, 1, hot);
    w.rect(35 + sway, 16 + bob, 1, 1, hot);
  });
  // przednie ostrze
  layer(b, (w) => {
    const [hx, hy] = cast ? [43, 17 + bob] : [40, 32 + bob];
    w.shaded(hx, hy, 2.5, 2.5, cloak);
    crescent(w, hx + 1, hy, cast ? -1.2 : 0.35, glow, hot);
  });
  // smugi cienia
  for (let i = 0; i < (cast ? 10 : 4); i++) {
    const x = Math.round(12 + hash(i * 3 + f * 17) * 32);
    const y = Math.round(8 + hash(i * 5 + f * 11) * 36);
    fx.set(x, y, i % 2 ? col : cloak[3]);
  }
}

// ---------------------------------------------------------------- Nekromanta
function nekromanta(b, fx, anim, f, col) {
  const robe = ramp(mix('#2c2a3e', col, 0.1));
  const bone = ['#6b6352', '#a89f84', '#d9d1b4', '#f6f0da', '#ffffff'];
  const glow = col;
  const hot = mix(col, WHITE, 0.6);
  const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? [0, 0, 1, 1][f] : 0;
  const cast = anim === 'cast';
  const step = anim === 'walk' ? [1, 0, -1, 0][f] : 0;

  // tylna ręka z kulą
  layer(b, (w) => {
    const [hx, hy] = cast ? [14, 16 + bob] : [17, 33 + bob];
    w.line(21, 24 + bob, hx, hy, robe[1]);
    w.line(21, 25 + bob, hx, hy + 1, robe[1]);
    w.shaded(hx, hy, 2, 2, bone);
  });
  // szata
  layer(b, (w) => {
    const top = 20 + bob;
    w.poly([[21, top], [37, top], [42 + step, 47], [14 - step, 47]], hgrad(robe, 14, 42));
    // lamówka
    w.rect(15 - step, 45, 27 + step * 2, 1, glow);
    w.line(30, top + 2, 31, 46, robe[0]);
    w.line(29, top + 2, 29, 44, mix(glow, robe[1], 0.5));
    // kołnierz z kości
    w.rect(22, top + 2, 14, 2, mix(col, robe[1], 0.55));
    w.poly([[20, top + 3], [18, top - 3], [23, top + 1]], bone[2]);
    w.poly([[37, top + 3], [40, top - 3], [35, top + 1]], bone[2]);
    // kaptur + czaszka
    w.shaded(29, 15 + bob, 8, 8, robe);
    w.ellipse(31, 16 + bob, 5, 5, VOID);
    w.shaded(32, 16 + bob, 4, 4, bone, { min: 1 });
    w.rect(31, 15 + bob, 2, 2, VOID);
    w.rect(34, 15 + bob, 2, 2, VOID);
    w.set(31, 15 + bob, glow);
    w.set(34, 15 + bob, glow);
    w.rect(32, 19 + bob, 3, 1, bone[1]);
    w.set(33, 19 + bob, VOID);
  });
  // laska
  layer(b, (w) => {
    const sx = 43;
    const top = cast ? 4 + bob : 9 + bob;
    w.line(sx, 47, sx, top + 4, '#5b3420');
    w.line(sx + 1, 47, sx + 1, top + 4, '#3b2418');
    w.shaded(sx + 1, top + 2, 3, 3, bone);
    w.rect(sx, top + 2, 1, 1, VOID);
    w.rect(sx + 2, top + 2, 1, 1, VOID);
    w.shaded(41, 31 + bob, 2, 2, bone);
  });
  // płomień na lasce
  const top = cast ? 4 + bob : 9 + bob;
  const fl = mod(f, 2);
  fx.rect(42, top - 2, 3, 2, glow);
  fx.rect(43 - fl, top - 4, 2, 2, glow);
  fx.set(43 + fl, top - 6, glow);
  fx.set(43, top - 2, hot);
  if (cast) {
    const [hx, hy] = [14, 16 + bob];
    fx.ellipse(hx, hy - 4, 4, 4, glow);
    fx.ellipse(hx, hy - 4, 2, 2, hot);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f * 0.4;
      fx.set(Math.round(hx + Math.cos(a) * 7), Math.round(hy - 4 + Math.sin(a) * 7), i % 2 ? glow : hot);
    }
  }
}

// ---------------------------------------------------------------- Burza
function burza(b, fx, anim, f, col) {
  const cloud = ramp(mix('#40507a', col, 0.3));
  const glow = col;
  const hot = mix(col, WHITE, 0.7);
  const bob = anim === 'cast' ? -2 : [0, -1, -2, -1][f];
  const cast = anim === 'cast';

  // lej wiru
  layer(b, (w) => {
    const sw = [1, 0, -1, 0][f];
    w.shaded(28 + sw, 35 + bob, 9, 4, cloud);
    w.shaded(27 - sw, 40 + bob, 6, 3, cloud);
    w.shaded(28 + sw, 44 + bob, 3.5, 2, cloud);
    w.line(22 + sw, 35 + bob, 32 + sw, 36 + bob, cloud[4]);
    w.line(24 - sw, 40 + bob, 30 - sw, 41 + bob, cloud[3]);
  });
  // chmura
  layer(b, (w) => {
    const y = bob;
    w.shaded(17, 23 + y, 8, 7, cloud);
    w.shaded(39, 22 + y, 8, 7, cloud);
    w.shaded(28, 27 + y, 12, 7, cloud);
    w.shaded(27, 17 + y, 10, 8, cloud);
    w.shaded(21, 13 + y, 6, 5, cloud);
    w.shaded(35, 14 + y, 5, 4, cloud);
    // jądro i oczy
    w.ellipse(31, 22 + y, 7, 4, cloud[0]);
    w.rect(28, 21 + y, 3, 2, cast ? WHITE : hot);
    w.rect(33, 21 + y, 3, 2, cast ? WHITE : hot);
    w.set(28, 21 + y, glow);
    w.set(33, 21 + y, glow);
    w.rect(30, 25 + y, 3, 1, glow);
  });
  // błyskawice
  const n = cast ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const s = f * 31 + i * 7 + (cast ? 100 : 0);
    const side = i % 2 ? 1 : -1;
    const x0 = 28 + side * 10;
    const y0 = 26 + bob;
    const x1 = Math.round(28 + side * (14 + hash(s) * 10));
    const y1 = Math.round(cast ? 4 + hash(s + 1) * 10 : 30 + hash(s + 1) * 14);
    bolt(fx, x0, y0, x1, y1, s, i === 0 ? hot : glow, WHITE);
  }
  for (let i = 0; i < 5; i++) fx.set(Math.round(10 + hash(i + f * 9) * 36), Math.round(6 + hash(i * 3 + f * 5) * 40), hot);
}

// ---------------------------------------------------------------- Smok
function smok(b, fx, anim, f, col) {
  const scale = ramp(col);
  const dark = ramp(mix(col, '#5a1020', 0.45));
  const belly = ramp('#ffc35a');
  const horn = ['#6b6352', '#a89f84', '#e6dcbc', '#fff6dc', '#ffffff'];
  const bob = anim === 'walk' ? [0, -1, 0, -1][f] : 0;
  const cast = anim === 'cast';
  const flap = cast ? -4 : anim === 'walk' ? [0, 3, 5, 3][f] : [0, 1, 2, 1][f];
  const step = anim === 'walk' ? [[0, 0], [2, 0], [0, 0], [0, 2]][f] : [0, 0];

  // ogon
  layer(b, (w) => {
    const pts = [[16, 37], [11, 39], [7, 37], [4, 33], [3, 29]];
    pts.forEach(([x, y], i) => w.shaded(x, y + bob, 4 - i * 0.6, 3.6 - i * 0.55, dark));
    w.poly([[1, 27 + bob], [5, 26 + bob], [3, 22 + bob]], dark[2]);
  });
  // tylne skrzydło
  layer(b, (w) => {
    const y = bob;
    w.poly([[25, 27 + y], [19, 6 + flap + y], [9, 12 + flap + y], [6, 21 + flap / 2 + y], [17, 24 + y]], dark[1]);
    w.line(25, 27 + y, 19, 6 + flap + y, dark[0]);
  });
  // tylne nogi
  layer(b, (w) => {
    w.shaded(18, 43 - step[0], 4, 4, dark);
    w.shaded(35, 44 - step[1], 3, 3, dark);
  });
  // tułów, szyja, głowa
  layer(b, (w) => {
    const y = bob;
    w.shaded(25, 34 + y, 13, 9, scale);
    w.ellipse(26, 38 + y, 10, 4.5, (x) => (x % 4 === 0 ? belly[1] : belly[2]));
    for (let i = 0; i < 5; i++) w.shaded(35 + i * 2, 29 - i * 2.4 + y, 4, 4, scale);
    // kolce na grzbiecie
    for (let i = 0; i < 5; i++) w.poly([[14 + i * 4, 27 + y], [16 + i * 4, 22 + y], [18 + i * 4, 26 + y]], dark[2]);
    // głowa
    const hy = 16 + y;
    w.shaded(44, hy, 6, 5, scale);
    w.shaded(50, hy + 2 - (cast ? 1 : 0), 4.5, 3, scale);
    if (cast) w.shaded(49, hy + 6, 4.5, 2, dark);
    else w.rect(46, hy + 4, 8, 1, dark[1]);
    w.set(53, hy + 1, dark[0]);
    // oko
    w.rect(45, hy - 2, 2, 2, '#fff6a0');
    w.set(46, hy - 2, OUTLINE);
    // rogi
    w.line(41, hy - 3, 36, hy - 8, horn[2]);
    w.line(42, hy - 4, 38, hy - 9, horn[3]);
    w.line(44, hy - 4, 42, hy - 9, horn[2]);
  });
  // przednia noga
  layer(b, (w) => {
    w.shaded(31, 43 - step[1], 3.5, 4, scale);
    w.rect(31, 47 - step[1], 4, 1, horn[3]);
    w.shaded(15, 44 - step[0], 4, 3.5, scale);
    w.rect(15, 47 - step[0], 4, 1, horn[3]);
  });
  // przednie skrzydło
  layer(b, (w) => {
    const y = bob;
    const tip = [36, 3 + flap + y];
    w.poly([[28, 28 + y], tip, [30, 10 + flap + y], [24, 12 + flap + y], [20, 18 + flap / 2 + y], [22, 26 + y]], hgrad(scale, 20, 36));
    w.line(28, 28 + y, tip[0], tip[1], dark[0]);
    w.line(28, 28 + y, 30, 10 + flap + y, dark[1]);
    w.line(28, 28 + y, 24, 12 + flap + y, dark[1]);
  });
  if (cast) {
    const hy = 16 + bob;
    fx.rect(48, hy + 3, 5, 2, '#ffd23f');
    fx.rect(49, hy + 3, 3, 1, WHITE);
    fx.set(54, hy + 2 + f, '#ffd23f');
    fx.set(55, hy + 4 - f, '#ff8a3d');
  }
}

// ---------------------------------------------------------------- Szron
function szron(b, fx, anim, f, col) {
  const ice = ramp(col);
  const deep = ramp(mix(col, '#2a4a8a', 0.45));
  const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? [0, 0, 1, 1][f] : 0;
  const cast = anim === 'cast';
  const swing = anim === 'walk' ? [2, 0, -2, 0][f] : 0;
  const lift = anim === 'walk' ? [[0, 0], [2, 0], [0, 0], [0, 2]][f] : [0, 0];

  /** Kryształ: romb z fasetami jasną i ciemną. */
  const crystal = (w, cx, cy, rw, rh, rmp) => {
    w.poly([[cx, cy - rh], [cx + rw, cy], [cx, cy + rh], [cx - rw, cy]], rmp[2]);
    w.poly([[cx, cy - rh], [cx, cy + rh], [cx - rw, cy]], rmp[3]);
    w.poly([[cx, cy - rh], [cx - rw * 0.5, cy - rh * 0.5], [cx, cy]], rmp[4]);
    w.poly([[cx, cy], [cx + rw, cy], [cx, cy + rh]], rmp[1]);
  };
  const hB = cast ? [14, 12 + f] : [10, 35 + swing + bob];
  const hF = cast ? [43, 11 + f] : [46, 36 - swing + bob];

  layer(b, (w) => {
    w.line(17, 25 + bob, hB[0], hB[1], deep[2]);
    thick(w, 17, 25 + bob, hB[0], hB[1], deep[2], 3);
    crystal(w, hB[0], hB[1], 5, 6, deep);
  });
  layer(b, (w) => {
    crystal(w, 21, 43 - lift[0], 4, 5, deep);
    crystal(w, 35, 43 - lift[1], 4, 5, ice);
  });
  layer(b, (w) => {
    const y = bob;
    // tułów: duży kryształ + odłamki
    w.poly([[16, 26 + y], [26, 18 + y], [38, 20 + y], [42, 32 + y], [34, 41 + y], [20, 40 + y]], ice[2]);
    w.poly([[16, 26 + y], [26, 18 + y], [28, 30 + y], [20, 40 + y]], ice[3]);
    w.poly([[26, 18 + y], [32, 19 + y], [28, 30 + y]], ice[4]);
    w.poly([[28, 30 + y], [42, 32 + y], [34, 41 + y]], ice[1]);
    w.poly([[20, 40 + y], [28, 30 + y], [34, 41 + y]], ice[0]);
    // kolce na barkach
    w.poly([[14, 25 + y], [16, 10 + y], [21, 22 + y]], ice[3]);
    w.poly([[16, 10 + y], [18, 16 + y], [21, 22 + y]], ice[1]);
    w.poly([[37, 21 + y], [42, 8 + y], [44, 23 + y]], ice[3]);
    w.poly([[42, 8 + y], [44, 23 + y], [41, 21 + y]], ice[1]);
    // głowa
    crystal(w, 32, 14 + y, 5, 6, ice);
    w.rect(33, 14 + y, 3, 1, cast ? WHITE : deep[0]);
    w.set(34, 14 + y, WHITE);
    // jądro
    w.rect(27, 30 + y, 3, 3, cast ? WHITE : ice[4]);
    w.set(28, 31 + y, WHITE);
  });
  layer(b, (w) => {
    thick(w, 39, 25 + bob, hF[0], hF[1], ice[2], 3);
    crystal(w, hF[0], hF[1], 6, 7, ice);
  });
  for (let i = 0; i < (cast ? 12 : 5); i++) {
    const x = Math.round(8 + hash(i * 3 + f * 7) * 40);
    const y = Math.round(4 + hash(i * 5 + f * 3) * 42);
    fx.set(x, y, i % 3 ? ice[4] : WHITE);
  }
}

// ---------------------------------------------------------------- Pajęczyca
function pajeczyca(b, fx, anim, f, col) {
  const acid = ramp(col);
  const shell = ramp('#3a3a2c');
  const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? [0, 0, 1, 1][f] : 0;
  const cast = anim === 'cast';
  const g = anim === 'walk' ? [2, 0, -2, 0][f] : anim === 'idle' ? [0, 0, 1, 1][f] : 0;

  /** Noga: biodro → kolano (w górę) → stopa. */
  const leg = (w, hx, hy, kx, ky, fx_, fy, c, tip) => {
    thick(w, hx, hy, kx, ky, c, 2);
    w.line(kx, ky, fx_, fy, c);
    w.line(kx + 1, ky, fx_ + 1, fy - 1, c);
    w.set(fx_, fy, tip);
  };
  const y = bob;
  // tylne nogi (dalsza strona) — kolana wysoko nad ciałem
  layer(b, (w) => {
    const c = shell[2];
    leg(w, 33, 28 + y, 25 - g, 15 + y, 21 - g, 41, c, acid[2]);
    leg(w, 35, 28 + y, 33 + g, 13 + y, 30 + g, 40, c, acid[2]);
    leg(w, 38, 28 + y, 43 - g, 14 + y, 46 - g, 40, c, acid[2]);
    leg(w, 40, 29 + y, 49 + g, 18 + y, 52 + g, 41, c, acid[2]);
  });
  // odwłok
  layer(b, (w) => {
    w.shaded(17, 29 + y, 13, 11, acid);
    // ciemne wzory (szewrony)
    for (let i = 0; i < 3; i++) {
      const cx = 13 + i * 5;
      w.line(cx - 2, 23 + y + i, cx, 26 + y + i, shell[0]);
      w.line(cx, 26 + y + i, cx - 2, 29 + y + i, shell[0]);
    }
    w.rect(8, 31 + y, 3, 2, shell[0]);
    w.rect(15, 35 + y, 3, 2, shell[0]);
    w.rect(22, 34 + y, 2, 2, shell[0]);
  });
  layer(b, (w) => {
    // głowotułów + głowa
    w.shaded(35, 33 + y, 7, 5.5, shell);
    w.line(31, 31 + y, 38, 31 + y, acid[1]);
  });
  layer(b, (w) => {
    w.shaded(44, 33 + y, 4.5, 4, shell);
    const eye = cast ? WHITE : '#ff3048';
    w.rect(44, 30 + y, 2, 1, eye);
    w.rect(47, 31 + y, 1, 1, eye);
    w.set(45, 32 + y, eye);
    w.set(43, 31 + y, '#ff8a9a');
    // kły
    w.line(47, 35 + y, 49, 38 + y, acid[3]);
    w.line(45, 36 + y, 46, 39 + y, acid[3]);
  });
  // przednie nogi — od spodu ciała na zewnątrz i w dół
  layer(b, (w) => {
    const c = shell[3];
    leg(w, 32, 37 + y, 24 + g, 36 + y, 19 + g, 47, c, acid[3]);
    leg(w, 35, 38 + y, 31 - g, 38 + y, 28 - g, 47, c, acid[3]);
    leg(w, 38, 38 + y, 42 + g, 38 + y, 41 + g, 47, c, acid[3]);
    if (cast) leg(w, 41, 36 + y, 48, 22 + y, 53, 14 + y, c, acid[4]);
    else leg(w, 41, 37 + y, 49 - g, 35 + y, 51 - g, 47, c, acid[3]);
  });
  if (cast) {
    for (let i = 0; i < 6; i++) fx.set(Math.round(8 + hash(i + f * 13) * 22), Math.round(16 + hash(i * 7 + f) * 24), acid[4]);
    fx.rect(48, 39 + y + f, 1, 2, acid[3]);
  }
}

// ---------------------------------------------------------------- Widmo
function widmo(b, fx, anim, f, col) {
  const robe = ramp(col);
  const glow = '#bff7ff';
  const bob = anim === 'cast' ? -2 : [0, -1, -2, -1][f];
  const cast = anim === 'cast';
  const sway = anim === 'walk' ? [1, 0, -1, 0][f] : 0;

  const scythe = (w, px, py, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    // drzewce
    const x0 = px - ca * 18;
    const y0 = py - sa * 18;
    const x1 = px + ca * 18;
    const y1 = py + sa * 18;
    w.line(x0, y0, x1, y1, '#5a4a6a');
    w.line(x0 + 1, y0, x1 + 1, y1, '#3a2f48');
    // ostrze: półksiężyc od czubka w przód i w dół
    const cx = x1 + 6;
    const cy = y1 + 5;
    w.arc(cx, cy, 7.5, '#ffffff', -Math.PI * 0.92, -Math.PI * 0.12);
    w.arc(cx, cy, 6.5, '#d6dcf0', -Math.PI * 0.9, -Math.PI * 0.2);
    w.arc(cx, cy, 5.5, '#8d96b8', -Math.PI * 0.85, -Math.PI * 0.4);
    w.set(Math.round(x1), Math.round(y1), '#3a2f48');
  };
  // kosa (za postacią)
  layer(b, (w) => {
    if (cast) scythe(w, 28, 26 + bob, -1.35 - f * 0.15);
    else scythe(w, 34, 28 + bob, -1.25);
  });
  // szata
  layer(b, (w) => {
    const top = 19 + bob;
    const bot = 45 + bob;
    const pts = [[22 + sway, top], [35 + sway, top], [41, bot - 8]];
    for (let i = 0; i <= 6; i++) pts.push([41 - i * 4.3, bot - 8 + (i % 2 === 0 ? 6 + ((i + f) % 2) * 2 : 1)]);
    pts.push([15, bot - 8]);
    w.poly(pts, hgrad(robe, 15, 41));
    w.line(29 + sway, top + 3, 28, bot - 6, robe[1]);
    // kaptur
    w.shaded(29 + sway, 15 + bob, 8, 8, robe);
    w.set(21 + sway, 11 + bob, robe[3]);
    w.ellipse(32 + sway, 16 + bob, 4.5, 4.2, VOID);
    w.rect(31 + sway, 16 + bob, 2, 1, glow);
    w.rect(34 + sway, 16 + bob, 2, 1, glow);
    // kościste dłonie
    const hx = cast ? 31 : 36;
    const hy = cast ? 21 + bob : 29 + bob;
    w.rect(hx, hy, 3, 2, '#e6dcbc');
    w.set(hx + 1, hy, '#ffffff');
  });
  // zanikanie dołu (dither)
  b.map((c, x, y) => (y > 40 + bob && (x + y) % 2 === 0 && y > 42 + bob ? null : c));
  for (let i = 0; i < (cast ? 8 : 3); i++) {
    const x = Math.round(14 + hash(i * 3 + f * 19) * 28);
    const y = Math.round(36 + bob + hash(i + f * 5) * 10);
    fx.set(x, y, robe[3]);
  }
  if (cast) for (let i = 0; i < 6; i++) fx.set(Math.round(26 + Math.cos(i + f) * 14), Math.round(6 + Math.sin(i * 2 + f) * 4), glow);
}

const BOSS_DRAW = { kolos, cien, nekromanta, burza, smok, szron, pajeczyca, widmo };
export const BOSS_COLORS = {
  kolos: '#ff3b5c',
  cien: '#b14dff',
  nekromanta: '#39ff9f',
  burza: '#3bd5ff',
  smok: '#ff6a2b',
  szron: '#9fe8ff',
  pajeczyca: '#d4ff3b',
  widmo: '#c9c9ff',
};
export const BOSS_TYPES = Object.keys(BOSS_DRAW);

/**
 * @param {string} type @param {string} anim @param {number} frame @param {string} [color]
 * @returns {PixelBuffer}
 */
export function buildBoss(type, anim, frame, color) {
  const t = type in BOSS_DRAW ? type : 'kolos';
  const a = anim in BOSS_FRAMES ? anim : 'idle';
  const f = mod(frame, BOSS_FRAMES[a]);
  const col = color || BOSS_COLORS[t];
  const b = new PixelBuffer(BOSS_W, BOSS_H);
  const fx = new PixelBuffer(BOSS_W, BOSS_H);
  BOSS_DRAW[t](b, fx, a === 'hurt' ? 'idle' : a, a === 'hurt' ? 0 : f, col);
  b.draw(fx);
  if (a === 'hurt') whiteFlash(b);
  return b;
}
