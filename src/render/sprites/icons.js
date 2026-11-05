/**
 * Ikony 12×12 (glif 10×10 + obrys 1 px). Glif = siatka ASCII albo funkcja rysująca.
 * Znaki: 1/2/3/4 = rampa koloru ikony (jasny/bazowy/ciemny/najjaśniejszy), w biały, W/g/G szarości,
 * k obrys, y/Y złoto, b brąz, r/R czerwień.
 */
import { PixelBuffer, OUTLINE, ramp } from './pixels.js';

const FIXED = {
  w: '#ffffff',
  W: '#c7d2de',
  g: '#8595ab',
  G: '#4e5870',
  k: OUTLINE,
  y: '#ffd54a',
  Y: '#c98a1b',
  b: '#8a5430',
  r: '#ff3b5c',
  R: '#a8203c',
  p: '#ffd0d8',
};

/** @typedef {string[] | ((b: PixelBuffer, C: Record<string,string>) => void)} Glyph */

/** @type {Record<string, Glyph>} */
const G = {
  sword: ['.........w', '........wW', '.......wW.', '......wW..', '.....wW...', '..y.wW....', '...Y......', '..b.y.....', '.b........', 'y.........'],
  dash: ['..........', '.11..11...', '..11..11..', '...11..11.', '....44..44', '...11..11.', '..11..11..', '.11..11...', '..........', '..........'],
  crown: ['..........', 'w...ww...w', 'y..yyyy..y', 'yy.yyyy.yy', 'yyyyrryyyy', 'yyyyyyyyyy', 'YyY1YYy1yY', 'YYYYYYYYYY', '..........', '..........'],
  skull: ['..wwwwww..', '.wwwwwwwww', 'wwwwwwwwww', 'wwkkwwkkWw', 'ww11ww11Ww', 'Wwwwkkwwww', '.Wwwwwwww.', '..wkwkwkW.', '..wwwwwwW.', '...W.W.W..'],
  heart: ['..........', '.rrr..rrr.', 'rprrrrrrrr', 'rprrrrrrrr', 'rrrrrrrrRr', '.rrrrrrRr.', '..rrrrRr..', '...rrRr...', '....Rr....', '..........'],
  shield: ['.WWWWWWWW.', 'Ww444111gG', 'W14111122G', 'W11112222G', 'W11222223G', '.W1222233G', '.Wg22233G.', '..Wg233G..', '...Wg3G...', '....GG....'],
  pierce: ['..........', '..........', '.......w..', '4.2....ww.', '1122bbbwww', '1122bbbwww', '4.2....ww.', '.......w..', '..........', '..........'],
  hood: ['....222...', '...21122..', '..2112222.', '..21kkkk2.', '4.2kwkkw2.', '..2kkkkk2.', '1.22kkk22.', '..2222222.', '4.3222223.', '..3333333.'],
  aura: ['....11....', '..1....1..', '.1..ww..1.', '....ww....', '1.wwwwww.1', '1.wwwwww.1', '....ww....', '.1..ww..1.', '..1....1..', '....11....'],
  turret: ['..........', '...WWW....', '..WwwwWgg.', '..WwwwWwww', '..gWWWggg.', '...2222...', '...gGGg...', '..gG..Gg..', '.gG....Gg.', '..........'],
  fist: ['..........', '.11.11.11.', '1221221221', '1221221223', '3k33k33k33', '1111111223', '2222222223', '.22222223.', '..33333...', '..........'],
  arrow: ['.....2....', '.....22...', '1....222..', '.11222222.', '1122222222', '.11222222.', '1....222..', '.....22...', '.....2....', '..........'],
  rocks: ['.1....1...', '.1.WWW1...', '..WWwgg...', '.WwWggGG..', '.WggggGG..', '..gggGG...', '...GGG....', '..........', '.2......2.', '..222222..'],
  eyeClosed: ['..........', '..........', '..........', '1........1', '.1......1.', '..111111..', '.3.3..3.3.', '..........', '..........', '..........'],
  drop: ['....2.....', '....2.....', '...212....', '...222....', '..21222...', '..12222...', '.2122222..', '.2222223..', '..22223...', '...333....'],
  bones: ['ww......ww', 'wWw....wWw', '.wWw..wWw.', '..wWwwWw..', '...wWWw...', '...wWWw...', '..wWwwWw..', '.wWw..wWw.', 'wWw....wWw', 'ww......ww'],
  star: ['....1.....', '....1.....', '...141....', '1114w4111.', '...141....', '....1.....', '..1.1.1...', '.1..1..1..', '....1.....', '..........'],
  lightning: ['.....1111.', '....1441..', '...1441...', '..14411...', '.1444441..', '....1441..', '...1441...', '..141.....', '.11.......', '1.........'],
  landing: ['....22....', '....22....', '....22....', '..222222..', '...2222...', '....22....', '..........', '.1......1.', '1.111111.1', '.11....11.'],
  shard: ['....4.....', '...414....', '...4w1....', '..4w112...', '..4w112...', '..41122...', '...1123...', '...1223...', '....23....', '....3.....'],
  wall: ['..........', '.444.444..', '.4w1.4w1..', '.1123112..', '..........', '444.444.44', '4w1.4w1.4w', '112311231.', '2233223322', '..........'],
  blizzard: ['..WWW.....', '.WwwwWW...', 'WwwwwwwW..', 'gWWWWWWWg.', '.gggggggg.', '..........', '.1..1..1..', '...1..1..1', '.1..1..1..', '...1..1...'],
  fangs: ['..........', '.22222222.', '2111111112', '2w1....1w2', '.w2....2w.', '.w......w.', '.w......w.', '..w....w..', '..1....1..', '..........'],
  scythe: ['..wwwww...', '.wWWWWWw..', 'w.....bWw.', '......b.ww', '.....b..W.', '....b.....', '...b......', '..b.......', '.b........', 'b.........'],
  ghost: ['...1111...', '..144441..', '.14444441.', '.14k44k41.', '.14k44k41.', '.14444441.', '.1444kk41.', '.14444441.', '.1414141..', '.1.1.1.1..'],
  summon: ['..wwwwww..', '.wwwwwwwww', 'wwwwwwwwww', 'wwkkwwkkWw', 'ww44ww44Ww', 'Wwwwkkwwww', '.Wwwwwwww.', '..wkwkwkW.', '1.wwwwwwW1', '11.W.W.W11'],

  ring: (b, C) => {
    b.arc(5, 5, 5, C[1]);
    b.arc(5, 5, 3, C[2]);
    b.rect(4, 4, 2, 2, C[4]);
  },
  claws: (b, C) => {
    for (let i = 0; i < 3; i++) {
      b.line(1 + i * 3, 0, 4 + i * 3 - 1, 9, i === 1 ? C[4] : C[1]);
    }
    b.set(1, 0, C.w);
  },
  blink: (b, C) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (i % 2) b.set(Math.round(4.5 + Math.cos(a) * 4.5), Math.round(4.5 + Math.sin(a) * 4.5), C[1]);
    }
    b.ellipse(5, 5, 2.5, 2.5, C[2]);
    b.ellipse(5, 5, 1.2, 1.2, C[4]);
  },
  fan: (b, C) => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.38;
      b.ray(5, 9, a, 9, i === 2 ? C[4] : C[1]);
    }
    b.rect(4, 8, 3, 2, C[3]);
  },
  orb: (b, C) => {
    b.ellipse(5, 5, 4.5, 4.5, C[3]);
    b.ellipse(5, 5, 3.5, 3.5, C[2]);
    b.ellipse(4.5, 4.5, 2, 2, C[4]);
    b.set(3, 3, C.w);
  },
  vortex: (b, C) => {
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const a = t * Math.PI * 4;
      const r = 0.6 + t * 4.4;
      b.set(Math.round(4.5 + Math.cos(a) * r), Math.round(4.5 + Math.sin(a) * r), t < 0.4 ? C[4] : C[1]);
    }
  },
  chain: (b, C) => {
    const pts = [[0, 8], [3, 2], [5, 6], [9, 1]];
    for (let i = 0; i + 1 < pts.length; i++) b.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], C[1]);
    for (const [x, y] of pts) b.rect(x - (x > 8 ? 1 : 0), y - (y > 8 ? 1 : 0), 2, 2, C[4]);
  },
  fireball: (b, C) => {
    b.poly([[0, 0], [6, 2], [2, 6]], C[3]);
    b.line(0, 0, 4, 4, C[2]);
    b.ellipse(6, 6, 3.5, 3.5, C[2]);
    b.ellipse(6, 6, 2.5, 2.5, '#ffb347');
    b.ellipse(5.5, 5.5, 1.3, 1.3, '#fff1a8');
  },
  breath: (b, C) => {
    b.poly([[0, 5], [10, 0], [10, 10]], (x, y) => (x < 3 ? '#fff1a8' : x < 6 ? '#ffb347' : (x + y) % 2 ? C[2] : C[3]));
    b.rect(0, 4, 2, 2, C.w);
  },
  meteors: (b, C) => {
    for (const [x, y] of [[2, 2], [7, 4], [4, 8]]) {
      b.line(x - 2, y - 2, x, y, C[3]);
      b.rect(x, y, 2, 2, C[2]);
      b.set(x, y, '#fff1a8');
    }
  },
  snowflake: (b, C) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      b.line(Math.round(4.5 - Math.cos(a) * 4.5), Math.round(4.5 - Math.sin(a) * 4.5), Math.round(4.5 + Math.cos(a) * 4.5), Math.round(4.5 + Math.sin(a) * 4.5), C[1]);
    }
    b.rect(4, 4, 2, 2, C.w);
    for (const [x, y] of [[2, 1], [7, 1], [2, 8], [7, 8], [0, 3], [9, 6]]) b.set(x, y, C[4]);
  },
  web: (b, C) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      b.line(Math.round(4.5 - Math.cos(a) * 5), Math.round(4.5 - Math.sin(a) * 5), Math.round(4.5 + Math.cos(a) * 5), Math.round(4.5 + Math.sin(a) * 5), C.w);
    }
    b.arc(5, 5, 3, C[1]);
    b.arc(5, 5, 1.6, C[1]);
  },
  pounce: (b, C) => {
    b.arc(5, 9, 5, C[1], Math.PI, Math.PI * 1.85);
    b.poly([[8, 4], [10, 7], [7, 7]], C[4]);
    b.ellipse(2, 8, 2, 1.5, C[3]);
  },
  eggs: (b, C) => {
    for (const [x, y, r] of [[3, 6, 2.6], [7, 6, 2.6], [5, 3, 2.4]]) {
      b.ellipse(x, y, r, r * 1.1, C[2]);
      b.set(Math.floor(x - 1), Math.floor(y - 1), C[4]);
    }
    b.rect(1, 9, 8, 1, C[3]);
  },
  spinScythe: (b, C) => {
    b.arc(5, 5, 4.5, C.w, -Math.PI * 0.2, Math.PI * 0.9);
    b.arc(5, 5, 3.5, C[1], -Math.PI * 0.1, Math.PI * 0.8);
    b.line(5, 5, 1, 8, C.b);
    b.arc(5, 5, 4.5, C[3], Math.PI * 1.1, Math.PI * 1.5);
  },
  harvest: (b, C) => {
    b.arc(5, 5, 5, C[1]);
    for (const [x, y, dx, dy] of [[5, 1, 0, 1], [5, 8, 0, -1], [1, 5, 1, 0], [8, 5, -1, 0]]) {
      b.set(x, y, C[4]);
      b.set(x + dx, y + dy, C.w);
    }
    b.rect(4, 4, 2, 2, C[3]);
  },
};

/** Ikony umiejętności bossów: [glif atk, q, e, r]. */
export const BOSS_ICONS = {
  kolos: ['fist', 'ring', 'arrow', 'rocks'],
  cien: ['claws', 'blink', 'eyeClosed', 'fan'],
  nekromanta: ['orb', 'summon', 'drop', 'bones'],
  burza: ['star', 'lightning', 'vortex', 'chain'],
  smok: ['fireball', 'breath', 'landing', 'meteors'],
  szron: ['shard', 'snowflake', 'wall', 'blizzard'],
  pajeczyca: ['fangs', 'web', 'pounce', 'eggs'],
  widmo: ['scythe', 'spinScythe', 'ghost', 'harvest'],
};
const BOSS_COLORS = {
  kolos: '#ff3b5c',
  cien: '#b14dff',
  nekromanta: '#39ff9f',
  burza: '#3bd5ff',
  smok: '#ff6a2b',
  szron: '#9fe8ff',
  pajeczyca: '#d4ff3b',
  widmo: '#c9c9ff',
};
const SKIN_ICONS = {
  rycerz: ['shield', '#4fc3ff'],
  lucznik: ['pierce', '#7dff6a'],
  lotrzyk: ['hood', '#c77dff'],
  kaplan: ['aura', '#ffe066'],
  inzynier: ['turret', '#ff9f43'],
};
const BASIC = {
  atk: ['sword', '#ffffff'],
  dash: ['dash', '#7fe7ff'],
  crown: ['crown', '#ffd23f'],
  skull: ['skull', '#ff3b5c'],
  heart: ['heart', '#ff3b5c'],
};

/** Lista wszystkich nazw ikon (do testów i podglądu). */
export function iconNames() {
  const out = Object.keys(BASIC);
  for (const s of Object.keys(SKIN_ICONS)) out.push(`skin:${s}`);
  for (const t of Object.keys(BOSS_ICONS)) for (const a of ['atk', 'q', 'e', 'r']) out.push(`boss:${t}:${a}`);
  return out;
}

/** @param {string} name @returns {[string, string]} [glif, kolor] */
export function resolveIcon(name) {
  if (BASIC[name]) return BASIC[name];
  const parts = name.split(':');
  if (parts[0] === 'skin' && SKIN_ICONS[parts[1]]) return SKIN_ICONS[parts[1]];
  if (parts[0] === 'boss' && BOSS_ICONS[parts[1]]) {
    const i = ['atk', 'q', 'e', 'r'].indexOf(parts[2]);
    return [BOSS_ICONS[parts[1]][Math.max(0, i)], BOSS_COLORS[parts[1]]];
  }
  return ['skull', '#8595ab'];
}

export const GLYPHS = G;

/** @param {string} name @returns {PixelBuffer} */
export function buildIcon(name) {
  const [glyph, color] = resolveIcon(name);
  const r = ramp(color);
  const C = { ...FIXED, 1: r[3], 2: r[2], 3: r[1], 4: r[4] };
  const inner = new PixelBuffer(10, 10);
  const gl = G[glyph] || G.skull;
  if (typeof gl === 'function') gl(inner, C);
  else inner.stamp(gl, C);
  const b = new PixelBuffer(12, 12);
  b.draw(inner, 1, 1);
  b.outline(OUTLINE);
  return b;
}
