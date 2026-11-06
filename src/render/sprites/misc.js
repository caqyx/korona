/**
 * Miniony, wieżyczka, korona, filar i pociski.
 * Każda funkcja zwraca {buf, ox, oy} (kotwica = środek podstawy).
 */
import { PixelBuffer, OUTLINE, ramp, layer, mod } from './pixels.js';

const WHITE = '#ffffff';
const RED = '#ff2848';

// ---------------------------------------------------------------- miniony
const BONE = { B: '#f2ecd6', b: '#b8ae8e', d: '#6b6352', e: '#39ff9f', k: OUTLINE };
const SKELETON = [
  [
    '...bbbb...',
    '..bBBBBb..',
    '..BBBekBe.',
    '..bBBBBBb.',
    '...bkbkb..',
    '....bd....',
    '.b.bBBBb..',
    '..bdbdbdb.',
    '...bBBb..b',
    '....dbd...',
    '...b...b..',
    '..bb...bb.',
  ],
  [
    '..........',
    '...bbbb...',
    '..bBBBBb..',
    '..BBBekBe.',
    '..bBBBBBb.',
    '...bkbkb..',
    '..b.bd..b.',
    '...bBBBbb.',
    '..bdbdbd..',
    '....bBb...',
    '....bdb...',
    '...bb.bb..',
  ],
];

/** Liczba klatek chodu minionów. */
export const MINION_FRAMES = { skeleton: 2, spiderling: 2, archer: 2, brute: 4 };

const HOOD = ['#241e38', '#3b3158', '#54487a'];
const WOOD = ['#5a3420', '#8a5430', '#c08a4a'];

/** Szkielet-łucznik w kapturze z łukiem: 15×14, kotwica (6,12). @param {number} f */
function buildArcher(f) {
  const b = new PixelBuffer(15, 14);
  b.stamp(SKELETON[f], BONE, 2, 1);
  const dy = f;
  // kaptur i peleryna (z tyłu = po lewej)
  for (let x = 5; x <= 8; x++) b.set(x, dy, HOOD[1]);
  for (let x = 4; x <= 9; x++) b.set(x, 1 + dy, x < 6 ? HOOD[0] : HOOD[x === 6 ? 2 : 1]);
  b.set(4, 2 + dy, HOOD[1]);
  b.set(5, 2 + dy, HOOD[1]);
  b.set(4, 3 + dy, HOOD[0]);
  b.set(9, 2 + dy, HOOD[0]);
  for (let y = 4; y <= 8; y++) b.set(3, y + dy, HOOD[y < 7 ? 1 : 0]);
  b.set(2, 8 + dy, HOOD[0]);
  // kołczan na plecach
  b.rect(2, 5 + dy, 1, 3, WOOD[1]);
  b.set(2, 4 + dy, RED);
  b.set(1, 4 + dy, '#ffd0d8');
  b.outline(OUTLINE);
  // łuk + nałożona strzała (osobna warstwa z obrysem)
  layer(b, (w) => {
    const my = 7 + dy;
    for (let i = 0; i <= 10; i++) {
      const t = i / 5 - 1;
      const x = Math.round(11 + 1.7 * (1 - t * t));
      w.set(x, Math.round(my + t * 5), Math.abs(t) > 0.7 ? WOOD[0] : t < 0 ? WOOD[2] : WOOD[1]);
    }
    for (let y = my - 4; y <= my + 4; y++) w.set(11, y, '#e8e4d0');
    for (let x = 7; x <= 12; x++) w.set(x, my, '#b8ae8e');
    w.set(13, my, '#e8eef8');
  });
  return { buf: b, ox: 6, oy: 12 };
}

/** Osiłek z kości i mięsa (r≈0,7 m): 20×20, kotwica (10,18), 4 klatki chodu. @param {number} f */
function buildBrute(f) {
  const b = new PixelBuffer(20, 20);
  const fl = ramp('#a35d6b');
  const bn = ['#6b6352', '#b8ae8e', '#f2ecd6'];
  const lf = [0, 1, 0, -1][f];
  const bob = f % 2;
  const swing = [0, 1, 0, -1][f];
  // tylne ramię
  layer(b, (t) => t.shaded(5, 11 + bob, 2.2, 3, fl, { max: 2 }));
  // nogi
  layer(b, (t) => {
    t.rect(6 - lf, 14, 3, 4, fl[1]);
    t.rect(5 - lf, 17, 4, 1, bn[1]);
    t.rect(11 + lf, 14, 3, 4, fl[2]);
    t.rect(11 + lf, 17, 4, 1, bn[2]);
    t.set(12 + lf, 15, bn[2]);
    t.set(7 - lf, 15, bn[1]);
  });
  // tułów
  layer(b, (t) => {
    t.shaded(10, 10 + bob, 6.5, 5.2, fl);
    // szwy na brzuchu
    for (let x = 6; x <= 12; x++) t.set(x, 12 + bob, x % 2 ? fl[0] : fl[1]);
    t.set(7, 11 + bob, fl[0]);
    t.set(11, 13 + bob, fl[0]);
    // odsłonięte żebra
    for (let k = 0; k < 3; k++) {
      t.set(12, 7 + k * 2 + bob, bn[2]);
      t.set(13, 7 + k * 2 + bob, bn[2]);
      t.set(14, 8 + k * 2 + bob, bn[1]);
      t.set(12, 8 + k * 2 + bob, fl[0]);
    }
  });
  // kościane kolce na grzbiecie
  layer(b, (t) => {
    t.poly([[4, 8 + bob], [2, 2 + bob], [7, 6 + bob]], bn[2]);
    t.poly([[7, 6 + bob], [7, 1 + bob], [10, 5 + bob]], bn[1]);
    t.set(3, 4 + bob, bn[1]);
  });
  // czaszka
  layer(b, (t) => {
    t.shaded(14.5, 5 + bob, 2.8, 2.6, ['#6b6352', '#b8ae8e', '#d8d0b4', '#f2ecd6', '#ffffff']);
    t.set(15, 5 + bob, '#39ff9f');
    t.set(16, 5 + bob, OUTLINE);
    t.rect(13, 7 + bob, 4, 1, bn[1]);
    t.set(14, 7 + bob, OUTLINE);
    t.set(16, 7 + bob, OUTLINE);
  });
  // przednie ramię z kościaną maczugą
  layer(b, (t) => {
    t.shaded(15, 11 + bob, 2.3, 3, fl);
    const ex = 17 + swing;
    const ey = 17 + bob - Math.abs(swing);
    t.line(16, 12 + bob, ex, ey, bn[1]);
    t.line(17, 12 + bob, ex + 1, ey, bn[2]);
    t.ellipse(ex + 0.5, ey, 1.6, 1.6, bn[2]);
    t.set(ex, ey - 1, '#ffffff');
  });
  return { buf: b, ox: 10, oy: 18 };
}

/** @param {string} kind @param {number} frame */
export function buildMinion(kind, frame) {
  const f = mod(frame, MINION_FRAMES[kind] ?? 2);
  if (kind === 'archer') return buildArcher(f);
  if (kind === 'brute') return buildBrute(f);
  if (kind === 'spiderling') {
    const b = new PixelBuffer(12, 9);
    const acid = ramp('#d4ff3b');
    const shell = ramp('#3a3a2c');
    layer(b, (w) => {
      const legC = shell[3];
      const o = f ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const hx = 4 + i * 2;
        w.line(hx, 4, hx - 2 + o * (i % 2 ? -1 : 1), 2, legC);
        w.line(hx, 5, hx - 2 - o * (i % 2 ? -1 : 1), 7, legC);
      }
      w.shaded(4, 4.5, 3, 2.5, acid);
      w.set(3, 4, shell[0]);
      w.shaded(8, 4.5, 2, 2, shell);
      w.set(9, 4, RED);
    });
    return { buf: b, ox: 6, oy: 7 };
  }
  const b = new PixelBuffer(12, 14);
  b.stamp(SKELETON[f], BONE, 1, 1);
  b.outline(OUTLINE);
  return { buf: b, ox: 5, oy: 12 };
}

// ---------------------------------------------------------------- wieżyczka
const TURRET = [
  '.....aA.....',
  '....sSSs....',
  '...sSWSSsddd',
  '...sSSSSsSSW',
  '...dssssdddd',
  '....qaaq....',
  '....dDDd....',
  '...dD..Dd...',
  '..dD....Dd..',
];

/** @param {string} accent @param {number} frame */
export function buildTurret(accent, frame) {
  const f = mod(frame, 2);
  const r = ramp(accent);
  const pal = { W: '#f4f8ff', S: '#c3cfdc', s: '#8595ab', d: '#56627a', D: '#363e55', A: f ? WHITE : r[3], a: r[2], q: r[1] };
  const b = new PixelBuffer(15, 11);
  const rows = f ? TURRET.map((row, y) => (y === 2 || y === 3 ? row.slice(0, 9) + row.slice(10) : row)) : TURRET;
  b.stamp(rows, pal, 1, 1);
  b.outline(OUTLINE);
  if (f) {
    b.rect(12, 3, 2, 2, '#fff1a8');
    b.set(14, 3, r[3]);
    b.set(14, 4, WHITE);
    b.set(13, 2, r[3]);
    b.set(13, 5, r[3]);
  }
  return { buf: b, ox: 6, oy: 10 };
}

// ---------------------------------------------------------------- korona
const CROWN = [
  'w...ww...w',
  'Y..YyyY..Y',
  'YY.YyyY.YY',
  'YyYyrryYyY',
  'yyyyyyyyyy',
  'gGbGGGGbGg',
  'gggggggggg',
];
const CROWN_PAL = { w: '#ffffff', Y: '#fff1a8', y: '#ffd23f', g: '#c98a1b', G: '#e0a92a', r: '#ff3b5c', b: '#4fc3ff' };

/** @param {number} frame */
export function buildCrown(frame) {
  const f = mod(frame, 4);
  const b = new PixelBuffer(12, 9);
  b.stamp(CROWN, CROWN_PAL, 1, 1);
  // przesuwający się połysk (ukośny pas)
  const band = 1 + f * 3;
  b.map((c, x, y) => {
    const d = x + (y - 1) * 0.5 - band;
    if (c === CROWN_PAL.r || c === CROWN_PAL.b) return f === 2 && d > -1 && d < 2 ? WHITE : c;
    if (d >= 0 && d < 1.5) return c === CROWN_PAL.g ? CROWN_PAL.y : c === CROWN_PAL.w ? c : CROWN_PAL.Y;
    return c;
  });
  b.outline(OUTLINE);
  return { buf: b, ox: 6, oy: 8 };
}

// ---------------------------------------------------------------- filar
/** @param {number} radius metry @param {number} ppm */
export function buildPillar(radius, ppm) {
  const W = Math.max(8, Math.round(radius * 2 * ppm));
  const capH = Math.max(4, Math.round(W * 0.4));
  const shaftH = Math.max(6, Math.round(W * 0.55));
  const w = W + 4;
  const h = capH + shaftH + 5;
  const b = new PixelBuffer(w, h);
  const stone = ['#23263a', '#373c56', '#545b7c', '#7a83a6', '#a9b1d0'];
  const cx = w / 2;
  const rx = W / 2;
  const ry = capH / 2;
  const top = 1 + ry;
  const bot = top + shaftH;
  const srx = rx - 2; // trzon węższy od kapitelu
  // podstawa (plinta)
  b.ellipse(cx, bot + 1, rx + 1, ry * 0.75, (x, y, nx, ny) => (ny < -0.2 ? stone[2] : nx < -0.4 ? stone[1] : stone[0]));
  // trzon z żłobieniami
  for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / srx;
      if (Math.abs(nx) > 1) continue;
      let i = nx < -0.55 ? 3 : nx < 0 ? 2 : nx < 0.6 ? 1 : 0;
      if (Math.round(nx * srx) % 3 === 0 && Math.abs(nx) < 0.9) i = Math.max(0, i - 1);
      if (Math.abs(nx + 0.4) < 0.08) i = 4;
      b.set(x, y, stone[i]);
    }
  }
  // dolny łuk trzonu
  b.ellipse(cx, bot, srx, ry * 0.6, (x, y, nx, ny) => (ny > 0 ? (nx < -0.4 ? stone[2] : stone[1]) : null));
  // pierścień pod kapitelem
  b.ellipse(cx, top + 1.5, rx - 1, ry, (x, y, nx, ny) => (ny > 0.3 ? stone[nx < -0.3 ? 3 : 1] : null));
  // kapitel: krawędź + płaska góra
  b.ellipse(cx, top, rx, ry, (x, y, nx, ny) => {
    const v = -nx * 0.6 - ny * 0.8;
    return v > 0.5 ? stone[4] : v > -0.3 ? stone[3] : stone[2];
  });
  b.ellipse(cx, top, rx - 2, ry - 1.2, (x, y, nx, ny) => (nx + ny > 0.9 ? stone[3] : stone[2]));
  b.line(Math.round(cx - 1), Math.round(top - 1), Math.round(cx + 2), Math.round(top), stone[1]);
  b.set(Math.round(cx + 2), Math.round(top + 1), stone[1]);
  b.outline(OUTLINE);
  return { buf: b, ox: Math.floor(w / 2), oy: h - 1 };
}

// ---------------------------------------------------------------- pociski
/**
 * @param {string} kind @param {string} accent @param {number} frame
 * @returns {{buf: PixelBuffer, ox: number, oy: number}|null}
 */
export function buildProjectile(kind, accent, frame) {
  const f = mod(frame, 4);
  const acc = ramp(accent || '#ffffff');
  let b;
  /** Pocisk bossa: biały rdzeń + czerwona obwódka. */
  const bossOrb = (size, core = WHITE, ring = RED) => {
    b = new PixelBuffer(size + 2, size + 2);
    const c = (size + 2) / 2;
    b.ellipse(c, c, size / 2, size / 2, ring);
    b.ellipse(c, c, size / 2 - 1, size / 2 - 1, core);
    b.outline(OUTLINE);
  };
  switch (kind) {
    case 'bolt':
    case 'turret':
    case 'reflected': {
      // kula energii w kolorze gracza (reflected = odbity od tarczy — z białym jądrem i iskrami)
      const s = kind === 'turret' ? 3 : 5;
      b = new PixelBuffer(s + 4, s + 4);
      const c = (s + 4) / 2;
      b.ellipse(c, c, s / 2, s / 2, acc[2]);
      b.ellipse(c - 0.5, c - 0.5, s / 2 - 1, s / 2 - 1, acc[4]);
      b.set(Math.floor(c - 1), Math.floor(c - 1), WHITE);
      b.outline(OUTLINE);
      if (kind === 'reflected') {
        const sp = [[0, 0], [s + 3, 0], [s + 3, s + 3], [0, s + 3]][f];
        b.set(sp[0], sp[1], WHITE);
      }
      break;
    }
    case 'pierce': {
      b = new PixelBuffer(11, 5);
      b.rect(1, 2, 6, 1, acc[3]);
      b.rect(3, 1, 4, 3, acc[2]);
      b.rect(7, 1, 2, 3, acc[4]);
      b.set(9, 2, WHITE);
      b.outline(OUTLINE);
      b.set(0, 2, f % 2 ? acc[3] : null);
      break;
    }
    case 'fireball': {
      b = new PixelBuffer(9, 9);
      b.ellipse(4.5, 4.5, 3.5, 3.5, RED);
      b.ellipse(4.5, 4.5, 2.5, 2.5, '#ff8a3d');
      b.ellipse(4.2, 4.2, 1.5, 1.5, f % 2 ? '#fff1a8' : WHITE);
      b.outline(OUTLINE);
      b.set([1, 7, 7, 1][f], [1, 1, 7, 7][f], '#ffd23f');
      break;
    }
    case 'iceShard': {
      b = new PixelBuffer(9, 9);
      b.poly([[4.5, 0.5], [7.5, 4.5], [4.5, 8.5], [1.5, 4.5]], RED);
      b.poly([[4.5, 1.8], [6.3, 4.5], [4.5, 7.2], [2.7, 4.5]], WHITE);
      b.set(4, 3, '#bff4ff');
      b.set(4, 5, '#9fe8ff');
      b.outline(OUTLINE);
      break;
    }
    case 'web': {
      b = new PixelBuffer(11, 11);
      const c = 5;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + (f % 2) * 0.5;
        b.line(c - Math.cos(a) * 4, c - Math.sin(a) * 4, c + Math.cos(a) * 4, c + Math.sin(a) * 4, WHITE);
      }
      b.arc(c + 0.5, c + 0.5, 2.5, '#e8e8f0');
      b.set(c, c, '#d4ff3b');
      b.outline(RED);
      b.outline(OUTLINE);
      break;
    }
    case 'scythe': {
      // obracająca się kosa (4 klatki)
      b = new PixelBuffer(13, 13);
      const a0 = (f * Math.PI) / 2;
      b.arc(6.5, 6.5, 5, RED, a0, a0 + Math.PI * 1.1);
      b.arc(6.5, 6.5, 4, WHITE, a0, a0 + Math.PI * 1.1);
      b.arc(6.5, 6.5, 3, '#c9c9ff', a0 + 0.3, a0 + Math.PI * 0.9);
      b.line(6, 6, Math.round(6 + Math.cos(a0 + Math.PI * 1.5) * 4), Math.round(6 + Math.sin(a0 + Math.PI * 1.5) * 4), '#5a4a6a');
      b.outline(OUTLINE);
      break;
    }
    case 'blade': {
      // wirujące ostrze cienia (biały rdzeń, czerwona obwódka)
      b = new PixelBuffer(9, 9);
      const rot = f % 2;
      if (rot) {
        b.line(1, 4, 7, 4, RED);
        b.line(4, 1, 4, 7, RED);
        b.line(2, 4, 6, 4, WHITE);
        b.line(4, 2, 4, 6, WHITE);
      } else {
        b.line(2, 2, 6, 6, RED);
        b.line(2, 6, 6, 2, RED);
        b.line(3, 3, 5, 5, WHITE);
        b.line(3, 5, 5, 3, WHITE);
      }
      b.set(4, 4, '#b14dff');
      b.outline(OUTLINE);
      break;
    }
    case 'necroBolt':
      bossOrb(6, WHITE, RED);
      b.set(3, 3, '#39ff9f');
      b.set(4, 4, '#39ff9f');
      b.set(f % 2 ? 1 : 6, 0, '#39ff9f');
      break;
    case 'spark':
      bossOrb(4, WHITE, RED);
      b.set([0, 5, 5, 0][f], [0, 0, 5, 5][f], '#3bd5ff');
      break;
    default:
      return null;
  }
  return { buf: b, ox: Math.floor(b.w / 2), oy: b.h - 1 };
}

export const PROJECTILE_KINDS = ['bolt', 'pierce', 'turret', 'reflected', 'fireball', 'iceShard', 'web', 'scythe', 'blade', 'necroBolt', 'spark'];
