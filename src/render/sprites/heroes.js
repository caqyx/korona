/**
 * Bohaterowie — siatki ASCII głowy/tułowia + proceduralne nogi, broń i efekty.
 * Kanwa HERO_W×HERO_H, punkt zaczepienia (HERO_OX, HERO_OY) = środek stóp.
 */
import { PixelBuffer, OUTLINE, ramp, layer, whiteFlash, redTint, mod, mix } from './pixels.js';

export const HERO_W = 24;
export const HERO_H = 20;
export const HERO_OX = 10;
export const HERO_OY = 17;
/** Lewy-górny róg siatki ciała na kanwie. */
const BX = 4;
const BY = 3;

export const HERO_FRAMES = { idle: 4, walk: 4, attack: 3, dash: 2, hurt: 2 };

const K = OUTLINE;
const SKIN = { f: '#f5c9a0', F: '#c98a6b' };
const STEEL = { W: '#f4f8ff', S: '#c3cfdc', s: '#8595ab', d: '#56627a', D: '#363e55' };
const GOLD = { G: '#ffd54a', g: '#d1902b', Y: '#fff1a8' };
const LEATHER = { L: '#c0814a', l: '#8a5430', b: '#5b3420' };

/**
 * Definicje bohaterów. Znaki wspólne: k obrys, A/a/q akcent (jasny/bazowy/ciemny), f/F skóra.
 * @type {Record<string, {body: string[], pal: Record<string,string>, legs: {p: string, P: string, boot: string}, robe?: {main: string, dark: string, stripe: string}, hand: [number, number], back: [number, number]}>}
 */
export const HEROES = {
  rycerz: {
    body: [
      '...qaA......',
      '..q.aAa.....',
      '..q.sSSs....',
      '...sSWWSSs..',
      '..sSWSSSSsd.',
      '..sSSSkkkkd.',
      '..dsssssssd.',
      '...ddsssdd..',
      '.SSqaAAAasd.',
      '.sdqaAAAaqd.',
      '..llGllllld.',
      '...qaAAaaq..',
    ],
    pal: { ...STEEL, ...GOLD, ...LEATHER },
    legs: { p: STEEL.s, P: STEEL.d, boot: STEEL.D },
    hand: [15, 12],
    back: [5, 12],
  },
  lucznik: {
    body: [
      '............',
      '....hhh.....',
      '...hHHhhh...',
      '..jhHHHhhh..',
      '.jjhHhhhhhh.',
      '.jjhhhfffff.',
      '.jjhffkffkf.',
      '..jjhffffF..',
      '..qaAAAAAa..',
      '.jqaHhhhha..',
      '..jbbGbbbj..',
      '...hHhhhj...',
    ],
    pal: { H: '#8fd45e', h: '#4f9a3e', j: '#2d5f35', ...GOLD, ...LEATHER },
    legs: { p: LEATHER.l, P: LEATHER.b, boot: '#3b2418' },
    hand: [15, 12],
    back: [5, 12],
  },
  lotrzyk: {
    body: [
      '............',
      '...ddd......',
      '..dDDDdd....',
      '.edDDDDDdd..',
      '.edDdddddde.',
      '.eddkkkkkke.',
      '.edkkykkyke.',
      '.eeqaAAAAAa.',
      '..eqaaAAaa..',
      '.ededDDdde..',
      '..eqaGqaqe..',
      '...dDddde...',
    ],
    pal: { D: '#5a5578', d: '#3b3854', e: '#26243a', y: '#f2fbff', ...GOLD },
    legs: { p: '#3b3854', P: '#26243a', boot: '#1f1d2e' },
    hand: [15, 12],
    back: [5, 12],
  },
  kaplan: {
    body: [
      '............',
      '............',
      '...nnnnn....',
      '..nnNNNnn...',
      '..nNnfffff..',
      '..nnfkffkf..',
      '..nnfffffF..',
      '...FffffF...',
      '..vwqAqWww..',
      '.vwWqAqWWwv.',
      '.vwGGgGGGgv.',
      '.vwWqAqWwvv.',
    ],
    pal: { W: '#ffffff', w: '#dfe3ef', v: '#a3aac6', n: '#a8663a', N: '#d39461', ...GOLD },
    legs: { p: '#dfe3ef', P: '#a3aac6', boot: '#8a5430' },
    hand: [15, 12],
    back: [4, 12],
  },
  inzynier: {
    body: [
      '............',
      '....nnnn....',
      '..nnNNNnn...',
      '..ngcggcgg..',
      '..nGcCgcCg..',
      '..nnfffff...',
      '..nnfkffk...',
      '...FfffffF..',
      '..qaAAAAAa..',
      '.ffqoOOOoaf.',
      '..bLGLbLLb..',
      '...oOooOo...',
    ],
    pal: { n: '#5b3420', N: '#8a5430', g: '#b06d22', G: '#ffd54a', c: '#7fe7ff', C: '#e6fdff', o: '#4b6a8f', O: '#6d8fb5', ...LEATHER },
    legs: { p: '#4b6a8f', P: '#344a66', boot: '#3b2418' },
    hand: [15, 12],
    back: [5, 12],
  },
  mag: {
    body: [
      '...HH.......',
      '...hHH......',
      '..hhHyh.....',
      '..hyhHhh....',
      '.jhhhhhhhhj.',
      '..jfffffF...',
      '..jfkffkf...',
      '...WWWWWW...',
      '..rqaWWaqr..',
      '.rRrWWWWrRr.',
      '.rRyAAAAyRr.',
      '.rRrryrrrRr.',
    ],
    pal: { H: '#6b74e8', h: '#3d43a8', j: '#252a70', r: '#3d43a8', R: '#252a70', W: '#eef0fa', y: '#ffd54a', ...GOLD },
    legs: { p: '#3d43a8', P: '#252a70', boot: '#2a1d3a' },
    robe: { main: '#3d43a8', dark: '#252a70', stripe: 'y' },
    hand: [15, 12],
    back: [4, 12],
  },
  barbarzynca: {
    body: [
      '.O........O.',
      '.oO......Oo.',
      '..oOsSSsOo..',
      '...sSWSSsd..',
      '...sSSSSsd..',
      '...ffkffkf..',
      '...nfffffn..',
      '.UUunnnnuUU.',
      'fFUufFFfuUFf',
      'aF.fffFFf.Fa',
      'fF.qaAAaq.Ff',
      '...uqaAqu...',
    ],
    pal: { O: '#f2ead0', o: '#b8a882', n: '#c0502a', U: '#a88a6a', u: '#6e5640', ...STEEL, ...GOLD },
    legs: { p: '#6e5640', P: '#4a3a2a', boot: '#3b2418' },
    hand: [15, 12],
    back: [4, 12],
  },
  druid: {
    body: [
      '.b.b...b.b..',
      '..bb...bb...',
      '...bgGgb....',
      '..ggGGGgg...',
      '.dgGgGgggg..',
      '.dggfffff...',
      '.dgfkffkf...',
      '..dgffffF...',
      '..tTqaaqtt..',
      '.gtTqAAqtTg.',
      '.gtaAAAAatg.',
      '..tTtgTtts..',
    ],
    pal: { b: '#e0cfa4', g: '#4a9a3e', G: '#8fd45e', d: '#285a2e', t: '#7a4e2c', T: '#a8703e', s: '#4e3020' },
    legs: { p: '#7a4e2c', P: '#4e3020', boot: '#3b2418' },
    robe: { main: '#7a4e2c', dark: '#4e3020', stripe: 'g' },
    hand: [15, 12],
    back: [4, 12],
  },
};

export const HERO_IDS = Object.keys(HEROES);

/** Paleta postaci z akcentem gracza. */
function heroPalette(def, accent) {
  const r = ramp(accent);
  return { k: K, ...SKIN, ...def.pal, A: r[3], a: r[2], q: r[1] };
}

// ---------- części ----------

/** Rysuje nogi. lift: o ile podniesiona stopa. */
function legs(b, def, xs, lifts, bob) {
  const { p, P, boot } = def.legs;
  xs.forEach((x, i) => {
    const hip = 15 + bob;
    const foot = 17 - lifts[i];
    for (let y = hip; y < foot; y++) {
      b.set(x, y, i === 0 ? P : p);
      b.set(x + 1, y, i === 0 ? P : P);
    }
    b.rect(x, foot, 2, 1, boot);
    b.set(x + 2, foot, boot); // czubek buta do przodu
  });
}

/** Ciało z opcjonalnym pochyleniem (shear) w prawo. */
function body(b, def, pal, dx, dy, lean = 0) {
  if (!lean) return b.stamp(def.body, pal, BX + dx, BY + dy);
  def.body.forEach((row, y) => {
    const sh = Math.round(((11 - y) / 11) * lean);
    b.stamp([row], pal, BX + dx + sh, BY + dy + y);
  });
  return b;
}

function sword(b, hx, hy, ang, len = 7) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // rękojeść za dłonią
  b.set(Math.round(hx - ca * 1.5), Math.round(hy - sa * 1.5), LEATHER.l);
  // jelec prostopadle
  const px = -sa;
  const py = ca;
  for (let t = -1; t <= 1; t++) b.set(Math.round(hx + ca + px * t), Math.round(hy + sa + py * t), t === 0 ? GOLD.g : GOLD.G);
  // ostrze
  for (let i = 2; i <= len; i++) b.set(Math.round(hx + ca * i), Math.round(hy + sa * i), i === len ? STEEL.S : STEEL.W);
}

function wrench(b, hx, hy, ang) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  b.set(Math.round(hx - ca), Math.round(hy - sa), '#8a2b2b');
  for (let i = 0; i <= 4; i++) b.set(Math.round(hx + ca * i), Math.round(hy + sa * i), i < 1 ? '#c0392b' : STEEL.s);
  // głowica z otwartą szczęką
  const ex = hx + ca * 5;
  const ey = hy + sa * 5;
  const px = -sa;
  const py = ca;
  for (let t = -2; t <= 1; t++) b.set(Math.round(ex + px * t), Math.round(ey + py * t), STEEL.S);
  b.set(Math.round(ex + ca + px), Math.round(ey + sa + py), STEEL.W);
  b.set(Math.round(ex + ca - px * 2), Math.round(ey + sa - py * 2), STEEL.W);
}

function dagger(b, hx, hy, ang, len = 3) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  b.set(hx, hy, '#26243a');
  b.set(Math.round(hx + ca), Math.round(hy + sa), GOLD.g);
  for (let i = 2; i <= len + 1; i++) b.set(Math.round(hx + ca * i), Math.round(hy + sa * i), i === len + 1 ? STEEL.S : STEEL.W);
}

const SHIELD = ['sSSSSd', 'SAaaqd', 'SaAaqd', 'saaqqd', '.saqd.', '..sd..'];
function shield(b, x, y, pal) {
  b.stamp(SHIELD, { ...pal, s: STEEL.s, S: STEEL.S, d: STEEL.d }, x, y);
}

/** Łuk: pionowy, wybrzuszony do przodu; pull = jak mocno naciągnięta cięciwa. */
function bow(b, hx, hy, pull, arrow) {
  const wood = ['#8a5430', '#c0814a', '#e0a96b'];
  const pts = [];
  for (let i = -5; i <= 5; i++) {
    const bulge = Math.round(2.6 * (1 - (i * i) / 30)); // 0..2
    const x = hx + bulge;
    const y = hy + i;
    pts.push([x, y]);
    b.set(x, y, Math.abs(i) > 3 ? wood[0] : wood[1]);
  }
  b.set(hx + 2, hy, wood[2]);
  // cięciwa
  const sx = hx - pull;
  b.line(hx, hy - 5, sx, hy, '#e8e8f0');
  b.line(sx, hy, hx, hy + 5, '#e8e8f0');
  if (arrow) {
    b.line(sx, hy, hx + 4, hy, '#c0814a');
    b.set(hx + 5, hy, STEEL.W);
    b.set(sx - 1, hy - 1, '#ffffff');
    b.set(sx - 1, hy + 1, '#ffffff');
  }
}

function quiver(b, x, y) {
  b.rect(x, y, 2, 5, LEATHER.l);
  b.set(x, y, LEATHER.L);
  b.set(x, y - 1, '#ffffff');
  b.set(x + 1, y - 2, '#e8e8f0');
  b.set(x - 1, y - 1, '#e8e8f0');
}

function staff(b, hx, hy, tilt, glow) {
  // drzewce
  const topX = hx + tilt;
  b.line(hx - (tilt ? 1 : 0), hy + 4, topX, hy - 7, LEATHER.L);
  // słoneczna głowica
  b.rect(topX - 1, hy - 10, 3, 3, GOLD.G);
  b.set(topX, hy - 9, glow ? '#ffffff' : GOLD.Y);
  b.set(topX, hy - 11, GOLD.g);
  b.set(topX - 2, hy - 9, GOLD.g);
  b.set(topX + 2, hy - 9, GOLD.g);
}

/** Dwuręczny topór: drzewce + szerokie ostrze rozszerzające się ku krawędzi. */
function axe(b, hx, hy, ang) {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  for (let i = -2; i <= 6; i++) b.set(Math.round(hx + ca * i), Math.round(hy + sa * i), i < 0 ? LEATHER.b : LEATHER.L);
  const px = -sa;
  const py = ca;
  const ex = hx + ca * 5;
  const ey = hy + sa * 5;
  // ostrze po jednej stronie drzewca (w stronę ruchu = +p)
  for (let k = 0; k <= 3; k++) {
    for (let t = -1 - (k > 1 ? 1 : 0); t <= 1 + (k > 1 ? 1 : 0); t++) {
      const x = Math.round(ex + px * (k + 1) + ca * t);
      const y = Math.round(ey + py * (k + 1) + sa * t);
      b.set(x, y, k === 3 ? STEEL.W : k === 2 ? STEEL.S : STEEL.s);
    }
  }
  b.set(Math.round(hx + ca * 7), Math.round(hy + sa * 7), STEEL.d);
}

/** Drewniana laska z liśćmi i świecącym nasionkiem (akcent). */
function leafStaff(b, hx, hy, tilt, acc, glow) {
  const topX = hx + tilt;
  b.line(hx - (tilt ? 1 : 0), hy + 4, topX, hy - 7, '#8a5430');
  b.set(topX - 1, hy - 8, '#8a5430');
  b.set(topX - 1, hy - 9, '#8a5430');
  b.set(topX, hy - 10, '#8a5430');
  b.set(topX + 1, hy - 9, '#8a5430');
  b.set(topX, hy - 9, glow ? '#ffffff' : acc[3]);
  for (const [dx, dy, c] of [[-2, -8, '#4a9a3e'], [-2, -7, '#8fd45e'], [2, -8, '#4a9a3e'], [2, -10, '#8fd45e'], [1, -6, '#4a9a3e']]) b.set(topX + dx, hy + dy, c);
}

/** Kula ognia zabarwiona akcentem. */
function fireOrb(b, cx, cy, r, acc, frame) {
  const outer = mix(acc[2], '#ff8a3d', 0.35);
  b.ellipse(cx + 0.5, cy + 0.5, r + 0.5, r + 0.5, outer);
  b.ellipse(cx + 0.5, cy + 0.5, Math.max(0.8, r - 0.4), Math.max(0.8, r - 0.4), acc[4]);
  b.set(cx, cy, '#ffffff');
  b.set(cx + (mod(frame, 2) ? 1 : 0), Math.round(cy - r - 1), mix(acc[3], '#ffd23f', 0.5));
}

/** Smuga ciosu — łuk jasnych pikseli bez obrysu. */
function smear(b, cx, cy, r, a0, a1, c1, c2) {
  b.arc(cx, cy, r, c1, a0, a1);
  b.arc(cx, cy, r - 1, c2, a0 + (a1 - a0) * 0.35, a1);
}

function speedLines(b, f, col) {
  const ys = f ? [8, 11, 14] : [7, 10, 13];
  ys.forEach((y, i) => {
    const len = 3 + ((i + f) % 2) * 2;
    b.rect(1 + i, y, len, 1, i === 1 ? col : mix(col, '#ffffff', 0.35));
  });
}

// ---------- kompozycja ----------

/**
 * @param {string} skin @param {string} accent @param {string} anim @param {number} frame
 * @returns {PixelBuffer}
 */
export function buildHero(skin, accent, anim, frame) {
  const def = HEROES[skin] || HEROES.rycerz;
  const id = HEROES[skin] ? skin : 'rycerz';
  const pal = heroPalette(def, accent);
  const acc = ramp(accent);
  const b = new PixelBuffer(HERO_W, HERO_H);
  const fx = new PixelBuffer(HERO_W, HERO_H); // efekty bez obrysu

  let a = anim;
  if (!(a in HERO_FRAMES)) a = 'idle';
  const f = mod(frame, HERO_FRAMES[a]);

  // pozy
  let bodyDx = 0;
  let bodyDy = 0;
  let bob = 0;
  let legX = [7, 10];
  let lifts = [0, 0];
  let lean = 0;
  /** @type {'idle'|'wind'|'strike'|'follow'} */
  let wpn = 'idle';

  if (a === 'idle') {
    bodyDy = f >= 2 ? 1 : 0;
  } else if (a === 'walk') {
    const W = [
      [-1, 1, 0, 0, 0],
      [0, 0, 0, 1, -1],
      [1, -1, 0, 0, 0],
      [0, 0, 1, 0, -1],
    ][f];
    legX = [7 + W[0], 10 + W[1]];
    lifts = [W[2], W[3]];
    bob = W[4];
    bodyDy = bob;
  } else if (a === 'attack') {
    wpn = /** @type {const} */ (['wind', 'strike', 'follow'])[f];
    bodyDx = f === 0 ? -1 : f === 1 ? 1 : 0;
    legX = f === 1 ? [6, 11] : [7, 10];
  } else if (a === 'dash') {
    lean = 2;
    bodyDx = 1;
    bodyDy = 0;
    legX = [5, 9];
    lifts = [1, 0];
    speedLines(fx, f, acc[3]);
  } else if (a === 'hurt') {
    bodyDx = -1;
    legX = [6, 9];
  }

  const [hx0, hy0] = def.hand;
  const hx = hx0 + bodyDx;
  const hy = hy0 + bodyDy;
  const [bx0, by0] = def.back;
  const bkx = bx0 + bodyDx;
  const bky = by0 + bodyDy;

  // --- tylne elementy ---
  if (id === 'lucznik') quiver(b, BX + 1 + bodyDx, BY + 7 + bodyDy);
  if (id === 'lotrzyk') {
    // powiewający szal
    const wave = a === 'walk' || a === 'dash' ? f % 2 : mod(Math.floor(frame / 2), 2);
    const tx = BX + bodyDx;
    const ty = BY + 8 + bodyDy;
    b.rect(tx - 1, ty, 2, 1, pal.a);
    b.rect(tx - 3, ty + wave, 2, 1, pal.q);
    b.set(tx - 4, ty + 1 - wave, pal.q);
  }

  // --- nogi + ciało ---
  legs(b, def, legX, lifts, bob);
  if (id === 'kaplan' || def.robe) {
    // szata do ziemi; nogi wystają tylko butami
    const main = def.robe ? def.robe.main : pal.w;
    const dark = def.robe ? def.robe.dark : pal.v;
    const stripe = def.robe ? pal[def.robe.stripe] : pal.a;
    const y0 = BY + 12 + bodyDy;
    for (let y = y0; y <= 16; y++) b.rect(BX + 1 + bodyDx + (y > 15 ? 1 : 0), y, 9 - (y > 15 ? 1 : 0), 1, y === 16 ? dark : main);
    b.rect(BX + 4 + bodyDx, y0, 2, 17 - y0, stripe);
    b.set(BX + 2 + bodyDx, 15, dark);
    if (def.robe) b.rect(BX + 8 + bodyDx, y0, 1, 16 - y0, dark);
  }
  body(b, def, pal, bodyDx, bodyDy, lean);
  if (id === 'kaplan' && a !== 'dash') {
    // aureola
    const glow = mod(frame, 4) === 1 ? GOLD.Y : GOLD.G;
    const y = BY + bodyDy;
    fx.rect(BX + 3 + bodyDx, y, 4, 1, glow);
    fx.set(BX + 2 + bodyDx, y + 1, GOLD.g);
    fx.set(BX + 7 + bodyDx, y + 1, GOLD.g);
  }
  b.outline(K);

  // --- broń (osobna warstwa z obrysem) ---
  const sh = lean ? 1 : 0;
  const weapon = (w) => {
    if (id === 'rycerz') {
      if (wpn === 'wind') sword(w, hx, hy - 4, -1.62, 7);
      else sword(w, hx + sh, hy, { idle: -1.4, strike: -0.15, follow: 0.75 }[wpn], wpn === 'strike' ? 8 : 7);
    } else if (id === 'lucznik') {
      const pull = { idle: 0, wind: 2, strike: 3, follow: 0 }[wpn];
      bow(w, hx + sh, hy - 1, pull, wpn === 'wind' || wpn === 'strike');
    } else if (id === 'lotrzyk') {
      if (wpn === 'idle') {
        dagger(w, hx, hy, 0.35);
      } else if (wpn === 'wind') {
        dagger(w, hx - 1, hy - 2, -1.9);
        dagger(w, bkx + 1, bky + 1, 1.9);
      } else if (wpn === 'strike') {
        dagger(w, hx + 1, hy - 1, -0.1, 4);
        dagger(w, bkx + 2, bky + 1, 1.7);
      } else {
        dagger(w, hx, hy + 1, 0.9);
        dagger(w, hx - 1, hy - 2, -0.2, 4);
      }
    } else if (id === 'kaplan') {
      const tilt = wpn === 'wind' || wpn === 'strike' ? 2 : 0;
      staff(w, hx + sh, hy + (wpn === 'wind' ? -1 : 0), tilt, wpn === 'strike');
    } else if (id === 'inzynier') {
      if (wpn === 'wind') wrench(w, hx, hy - 4, -1.62);
      else wrench(w, hx + sh, hy, { idle: -1.3, strike: -0.15, follow: 0.75 }[wpn]);
    } else if (id === 'barbarzynca') {
      if (wpn !== 'wind') axe(w, hx + sh, hy, { idle: -1.25, strike: -0.2, follow: 0.9 }[wpn]);
    } else if (id === 'druid') {
      const tilt = wpn === 'wind' || wpn === 'strike' ? 2 : 0;
      leafStaff(w, hx + sh, hy + (wpn === 'wind' ? -1 : 0), tilt, acc, wpn === 'strike');
    } else if (id === 'mag') {
      const [ox, oy, r] = { idle: [hx + 1, hy - 1, 1.6], wind: [hx - 1, hy - 6, 2.2], strike: [hx + 4, hy - 2, 2.6], follow: [hx + 2, hy, 1.2] }[wpn];
      w.rect(hx, hy, 1, 1, SKIN.f);
      fireOrb(w, ox + sh, oy, r, acc, frame);
    }
  };
  // ciężki zamach topora: nad głową, za ciałem
  if (id === 'barbarzynca' && wpn === 'wind') {
    const back = new PixelBuffer(HERO_W, HERO_H);
    layer(back, (w) => axe(w, hx - 4, hy - 6, -1.95));
    back.draw(b);
    b.px = back.px;
  }
  layer(b, weapon);
  if (id === 'rycerz' && a !== 'dash') layer(b, (w) => shield(w, bkx - 3, bky - 2, pal));

  // --- smugi i efekty ataku ---
  if (a === 'attack') {
    const light = '#ffffff';
    if (id === 'rycerz' || id === 'inzynier') {
      if (wpn === 'strike') smear(fx, hx - 2, hy + 1, 7, -1.9, -0.45, acc[4], acc[3]);
      if (wpn === 'follow') smear(fx, hx - 2, hy + 1, 7, -0.3, 0.35, acc[3], acc[2]);
    } else if (id === 'lotrzyk' && wpn !== 'wind') {
      fx.rect(hx + 3, hy - 1 + (wpn === 'follow' ? 2 : 0), 4, 1, wpn === 'strike' ? light : acc[3]);
      fx.rect(hx + 4, hy - 3 + (wpn === 'follow' ? 2 : 0), 2, 1, acc[3]);
    } else if (id === 'lucznik' && wpn === 'follow') {
      fx.rect(hx + 4, hy - 1, 5, 1, acc[3]);
      fx.set(hx + 9, hy - 1, light);
    } else if (id === 'barbarzynca') {
      if (wpn === 'strike') {
        smear(fx, hx - 3, hy + 1, 9, -2.6, -0.3, light, acc[3]);
        smear(fx, hx - 3, hy + 1, 7, -2.2, -0.5, acc[3], acc[2]);
      }
      if (wpn === 'follow') {
        smear(fx, hx - 3, hy + 1, 8, -0.4, 0.9, acc[3], acc[2]);
        for (const [dx, dy] of [[5, 5], [7, 4], [8, 5], [3, 5]]) fx.set(hx + dx, hy + dy, '#c9b48a');
      }
    } else if (id === 'druid' && wpn === 'strike') {
      const cx = hx + 2;
      const cy = hy - 9;
      for (const [dx, dy] of [[3, -2], [4, 1], [-2, -3], [2, 3]]) fx.set(cx + dx, cy + dy, dx > 2 ? '#8fd45e' : acc[3]);
    } else if (id === 'mag' && wpn === 'strike') {
      for (const [dx, dy] of [[-3, 0], [-5, 1], [-4, -2], [0, -4], [0, 3]]) fx.set(hx + 4 + dx, hy - 2 + dy, dx < -3 ? acc[2] : '#ffd23f');
    } else if (id === 'kaplan' && wpn === 'strike') {
      const cx = hx + 2;
      const cy = hy - 9;
      for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [2, 2], [-2, -2], [2, -2], [-2, 2]]) fx.set(cx + dx, cy + dy, dx && dy ? acc[3] : GOLD.Y);
    }
  }

  b.draw(fx);

  if (a === 'hurt') {
    if (f === 0) whiteFlash(b);
    else redTint(b);
  }
  return b;
}
