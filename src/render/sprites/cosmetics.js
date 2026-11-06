/**
 * Kosmetyki bohaterów: przebarwienia głównego materiału, skiny klas, czapki i nosy.
 * Czysty moduł (bez DOM). Współrzędne głowy/twarzy są w układzie siatki ciała (12×12).
 */
import { PixelBuffer, OUTLINE, ramp } from './pixels.js';
import { findCosmetic } from '../../sim/cosmetics.js';

/** @typedef {{color: string, hat: string, nose: string}} Look */

const WHITE = '#ffffff';

/** Rampy 5 odcieni (ciemny → jasny) dla kolorów kosmetycznych. */
const MARK = ['#fe00f0', '#fe00f1', '#fe00f2', '#fe00f3', '#fe00f4'];
export const COLOR_RAMPS = {
  crimson: ramp('#c8324a'),
  forest: ramp('#3f8f4a'),
  copper: ramp('#c47a3a'),
  royal: ramp('#7a3fd1'),
  bone: ['#5e5848', '#9a927c', '#cfc6ac', '#ece4cc', '#fffaf0'],
  diamond: ['#1f5a7a', '#3ea4c8', '#8ff0ff', '#c8faff', '#ffffff'],
  rainbow: MARK,
  gold_knight: ['#6e4210', '#b07418', '#e0a92a', '#ffd54a', '#fff6c0'],
  fire_mage: ['#5a1410', '#9a2416', '#d8401e', '#ff7a2e', '#ffc46a'],
  shadow_rogue: ['#08060e', '#100b1a', '#191224', '#241a34', '#33264a'],
  skeleton_archer: ['#1c1a22', '#2c2832', '#3e3a46', '#57525f', '#76707e'],
  dragon_barb: ['#4a0e0c', '#7a1a14', '#c23b22', '#e8603a', '#ff9a6a'],
};
const RAINBOW = ['#ff4d4d', '#ffd23f', '#5ce07a', '#4fc3ff', '#b38cff'].map((c) => ramp(c));

/**
 * Główny materiał każdej klasy: znak palety → indeks w rampie (0..4),
 * nogi i szata (gdy klasa ją ma).
 */
const MATERIAL = {
  rycerz: { chars: { W: 4, S: 3, s: 2, d: 1, D: 0 }, legs: { p: 2, P: 1, boot: 0 } },
  lucznik: { chars: { H: 3, h: 2, j: 1 }, legs: {} },
  lotrzyk: { chars: { D: 2, d: 1, e: 0 }, legs: { p: 1, P: 0 } },
  kaplan: { chars: { W: 4, w: 3, v: 2 }, legs: { p: 3, P: 2 } },
  inzynier: { chars: { O: 3, o: 2 }, legs: { p: 2, P: 1 } },
  mag: { chars: { H: 3, h: 2, j: 1, r: 2, R: 1 }, legs: { p: 2, P: 1 }, robe: { main: 2, dark: 1 } },
  barbarzynca: { chars: { U: 3, u: 1 }, legs: { p: 1, P: 0 } },
  druid: { chars: { T: 3, t: 2, s: 1 }, legs: { p: 2, P: 1 }, robe: { main: 2, dark: 1 } },
};

/**
 * Głowa (do czapek) i twarz (do nosów) w siatce ciała.
 * hat: [środek x, wiersz podstawy czapki]; nose: [pierwsza wolna kolumna przed twarzą, wiersz].
 * hide: wiersze → znaki usuwane, gdy założona czapka (pióropusz, rogi, poroże, spiczasty kapelusz).
 */
export const HEAD = {
  rycerz: { hat: [6, 3], nose: [10, 6], hide: { 0: 'qaA', 1: 'qaA', 2: 'qaA' } },
  lucznik: { hat: [6, 3], nose: [10, 7] },
  lotrzyk: { hat: [5, 3], nose: [11, 7] },
  kaplan: { hat: [5, 3], nose: [10, 6] },
  inzynier: { hat: [5, 2], nose: [10, 7] },
  mag: { hat: [5, 4], nose: [9, 6], hide: { 0: '*', 1: '*', 2: '*', 3: '*' }, replace: { 4: '..jhhhhhhj..' } },
  barbarzynca: { hat: [6, 3], nose: [10, 6], hide: { 0: 'Oo', 1: 'Oo', 2: 'Oo' } },
  druid: { hat: [5, 3], nose: [9, 6], hide: { 0: 'b', 1: 'b', 2: 'b' } },
};

// ---------------------------------------------------------------- czapki
const HATS = {
  beanie: {
    rows: ['...P...', '.bBBBb.', 'bBBbBBb', 'CcCcCcC'],
    pal: { P: '#ffffff', B: '#e0505a', b: '#a8303a', C: '#f0f0f4', c: '#c0c4d0' },
  },
  party: {
    rows: ['..W..', '..P..', '.YYY.', '.PPP.', 'BBBBB'],
    pal: { W: '#ffffff', P: '#ff5ec4', Y: '#ffd23f', B: '#4fc3ff' },
  },
  paper_crown: {
    rows: ['Y..Y..Y', 'YyYrYyY', 'yyyyyyy'],
    pal: { Y: '#ffe88a', y: '#e0b040', r: '#ff3b5c' },
  },
  diadem: {
    rows: ['...R...', 'gGGrGGg'],
    pal: { R: '#ffb0c0', r: '#ff3b5c', G: '#ffd54a', g: '#c98a1b' },
  },
  traveler: {
    rows: ['F...TTT..', '.F.TTTTT.', '..FrrrrT.', 'BBBBBBBBB'],
    pal: { F: '#f0f0f8', T: '#9a6a3e', r: '#c0392b', B: '#5b3a22' },
  },
  skull_helm: {
    rows: ['.wwwww.', 'wWwwwwG', 'wwwkGkG', '.GwGwG.'],
    pal: { w: '#f2ecd6', W: '#ffffff', G: '#b8ae8e', k: OUTLINE },
  },
};
export const HAT_IDS = Object.keys(HATS);
/** Rozmiar czapki (szer., wys.). @param {string} id */
export const hatSize = (id) => (HATS[id] ? { w: HATS[id].rows[0].length, h: HATS[id].rows.length } : { w: 0, h: 0 });

/** Rysuje czapkę: (cx, baseY) = środek i dolny wiersz czapki. */
export function drawHat(b, id, cx, baseY) {
  const h = HATS[id];
  if (!h) return;
  const w = h.rows[0].length;
  b.stamp(h.rows, h.pal, cx - Math.floor(w / 2), baseY - h.rows.length + 1);
}

// ---------------------------------------------------------------- nosy
export const NOSE_IDS = ['round', 'mustache', 'horned', 'clown'];

/** (nx, ny) = pierwsza wolna kolumna przed twarzą i wiersz nosa. */
export function drawNose(b, id, nx, ny) {
  if (id === 'round') {
    b.rect(nx - 1, ny, 2, 2, '#ff8a9a');
    b.set(nx - 1, ny, '#ffc8d0');
    b.set(nx, ny + 1, '#d05a70');
  } else if (id === 'clown') {
    b.rect(nx, ny - 1, 2, 1, '#ff2a3a');
    b.rect(nx - 1, ny, 3, 2, '#ff2a3a');
    b.set(nx, ny - 1, '#ffd0d8');
    b.set(nx + 1, ny + 1, '#b01828');
    b.set(nx, ny + 1, '#d01e30');
  } else if (id === 'mustache') {
    b.set(nx, ny, '#e0a07a');
    const c = '#3a2418';
    for (let x = nx - 3; x <= nx; x++) b.set(x, ny + 1, c);
    b.set(nx - 2, ny + 1, '#6b4428');
    b.set(nx - 4, ny, c);
    b.set(nx + 1, ny, c);
  } else if (id === 'horned') {
    b.set(nx, ny, '#c8b890');
    b.set(nx, ny - 1, '#e6dcbc');
    b.set(nx + 1, ny - 2, '#fff6dc');
  }
}

// ---------------------------------------------------------------- zastosowanie wyglądu

/** Rozwiązuje wygląd dla klasy (skin innej klasy → klasyczny). @returns {Look} */
export function resolveLook(look, skin) {
  const out = { color: 'default', hat: 'none', nose: 'none' };
  if (!look || typeof look !== 'object') return out;
  const c = findCosmetic('color', look.color);
  if (c && !(c.cls && c.cls !== skin)) out.color = c.id;
  if (HATS[look.hat]) out.hat = look.hat;
  if (NOSE_IDS.includes(look.nose)) out.nose = look.nose;
  return out;
}

export const lookKey = (l) => `${l.color}|${l.hat}|${l.nose}`;

/**
 * Modyfikuje definicję bohatera (paleta, siatka, nogi, szata) wg wyglądu.
 * @param {any} def @param {string} id @param {Look} look
 */
export function applyLook(def, id, look) {
  const mat = MATERIAL[id];
  const head = HEAD[id];
  let body = def.body.slice();
  const pal = { ...def.pal };
  let legs = { ...def.legs };
  let robe = def.robe ? { ...def.robe } : undefined;
  const r = COLOR_RAMPS[look.color];
  if (r && mat) {
    for (const [ch, i] of Object.entries(mat.chars)) pal[ch] = r[i];
    for (const [k, i] of Object.entries(mat.legs)) legs[k] = r[i];
    if (robe && mat.robe) robe = { ...robe, main: r[mat.robe.main], dark: r[mat.robe.dark] };
  }
  // skiny klas — drobne detale
  if (look.color === 'gold_knight') {
    body = body.map((row, y) => (y < 3 ? row.replace(/[qa]/g, 'p').replace(/A/g, 'P') : row));
    pal.P = WHITE;
    pal.p = '#c8ccdc';
  } else if (look.color === 'fire_mage') {
    body = body.map((row, y) => (y === 0 ? row.replace(/[Hh]/g, 'Z') : y === 1 ? row.replace(/[Hh]/g, 'z') : row));
    pal.Z = '#ffd23f';
    pal.z = '#ff8a3d';
    pal.W = '#3a2a2a'; // przypalona broda
  } else if (look.color === 'shadow_rogue') {
    pal.y = '#e6b0ff';
  } else if (look.color === 'skeleton_archer') {
    pal.f = '#e6dcc4';
    pal.F = '#a89f84';
    pal.r = '#e6dcc4';
    pal.R = '#2a2630';
    body[4] = '.j.hHhhhhhh.';
    body[6] = '.jjhfkyfkyf.';
    body[7] = '..j.hfkfkF..';
    pal.y = '#ff5a4a';
    body[9] = '.jqarRrRra..';
    body[11] = '...h.h.hj...';
  } else if (look.color === 'dragon_barb') {
    const helm = ramp('#6a2a24');
    pal.S = helm[3];
    pal.s = helm[2];
    pal.d = helm[1];
    pal.W = helm[4];
    pal.O = '#ffcf8a';
    pal.o = '#c87a3a';
    pal.B = '#ffa040';
    pal.b = '#d06a20';
    body[0] = 'O..........O';
    body[8] = 'fFUuBBbbuUFf';
    body[9] = 'aF.BBBbbb.Fa';
  }
  // czapka: chowa pióropusz/rogi/spiczasty kapelusz
  if (look.hat !== 'none' && head) {
    if (head.hide) {
      for (const [row, chars] of Object.entries(head.hide)) {
        const y = +row;
        body[y] = chars === '*' ? '.'.repeat(body[y].length) : [...body[y]].map((c) => (chars.includes(c) ? '.' : c)).join('');
      }
    }
    if (head.replace) for (const [row, s] of Object.entries(head.replace)) body[+row] = s;
  }
  return { ...def, body, pal, legs, robe };
}

function hash(n) {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Efekty po złożeniu klatki (przed błyskiem obrażeń): tęcza, iskry, poświata, żar.
 * @param {PixelBuffer} b @param {Look} look @param {number} f klatka animacji @param {{x:number,y:number}} headPos lewy-górny róg siatki ciała
 */
export function postLook(b, look, f, headPos) {
  const r = COLOR_RAMPS[look.color];
  if (!r) return;
  const set = new Set(r);
  if (look.color === 'rainbow') {
    b.map((c, x, y) => {
      const i = MARK.indexOf(c);
      if (i < 0) return c;
      return RAINBOW[(((Math.floor(y / 2) + f) % 5) + 5) % 5][i];
    });
    return;
  }
  /** @type {[number, number][]} */
  const cells = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (set.has(b.get(x, y))) cells.push([x, y]);
  if (!cells.length) return;
  if (look.color === 'diamond' || look.color === 'gold_knight') {
    for (let k = 0; k < 3; k++) {
      const [x, y] = cells[Math.floor(hash(f * 31 + k * 7 + 3) * cells.length)];
      b.set(x, y, WHITE);
      if (k === 0) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (set.has(b.get(x + dx, y + dy))) b.set(x + dx, y + dy, r[4]);
      }
    }
  } else if (look.color === 'shadow_rogue') {
    // poświata tylko na górnej/tylnej krawędzi kaptura, migocząca
    const edge = cells.filter(([x, y]) => b.get(x, y - 1) === OUTLINE || b.get(x - 1, y) === OUTLINE);
    for (const [x, y] of edge) {
      const k = (x + y + f) % 4;
      if (k === 0) b.set(x, y, '#b07aff');
      else if (k === 2) b.set(x, y, '#5a2fa0');
    }
  } else if (look.color === 'dragon_barb') {
    for (const [x, y] of cells) if (b.get(x, y) === r[3] && (x + 2 * y) % 4 === 0) b.set(x, y, r[2]);
  } else if (look.color === 'fire_mage') {
    // żar wokół postaci + migoczący płomień czubka kapelusza
    for (let k = 0; k < 2; k++) {
      const x = Math.round(headPos.x + 1 + hash(f * 13 + k * 5) * 10);
      const y = Math.round(headPos.y + 2 + hash(f * 17 + k * 3) * 8);
      if (!b.get(x, y)) b.set(x, y, k ? '#ffd23f' : '#ff8a3d');
    }
    if (look.hat === 'none') b.set(headPos.x + 3 + (f % 2), headPos.y - 1, f % 2 ? '#ffd23f' : '#ff8a3d');
  }
}

// ---------------------------------------------------------------- ikony edytora

/**
 * Ikona 12×12 kosmetyku (próbka koloru / czapka / nos).
 * @param {'color'|'hat'|'nose'} kind @param {string} id
 */
export function buildCosmeticIcon(kind, id) {
  const b = new PixelBuffer(12, 12);
  if (kind === 'color') {
    const r = id === 'rainbow' ? null : COLOR_RAMPS[id] || ['#363e55', '#56627a', '#8595ab', '#c3cfdc', '#f4f8ff'];
    for (let y = 1; y <= 10; y++) {
      for (let x = 1; x <= 10; x++) {
        if ((x === 1 || x === 10) && (y === 1 || y === 10)) continue;
        const v = (x + y) / 22;
        const i = v < 0.3 ? 3 : v < 0.6 ? 2 : v < 0.85 ? 1 : 0;
        b.set(x, y, r ? r[i] : RAINBOW[Math.floor((y - 1) / 2) % 5][2]);
      }
    }
    if (r) b.set(3, 3, r[4]);
    if (id === 'diamond' || id === 'gold_knight') {
      b.set(7, 4, WHITE);
      b.set(6, 4, r[4]);
      b.set(8, 4, r[4]);
      b.set(7, 3, r[4]);
      b.set(7, 5, r[4]);
    } else if (id === 'fire_mage') {
      b.rect(5, 4, 2, 4, '#ffd23f');
      b.set(5, 3, '#ff8a3d');
      b.rect(4, 6, 4, 2, '#ff8a3d');
    } else if (id === 'shadow_rogue') {
      for (let i = 2; i <= 9; i++) {
        b.set(i, 1, '#7a3fd1');
        b.set(1, i, '#7a3fd1');
      }
      b.rect(4, 5, 1, 1, '#e6b0ff');
      b.rect(7, 5, 1, 1, '#e6b0ff');
    } else if (id === 'skeleton_archer') {
      b.rect(3, 3, 6, 5, '#e6dcc4');
      b.rect(4, 5, 1, 1, OUTLINE);
      b.rect(7, 5, 1, 1, OUTLINE);
      b.rect(4, 8, 4, 1, '#a89f84');
    } else if (id === 'dragon_barb') {
      for (let y = 2; y <= 9; y++) for (let x = 2; x <= 9; x++) if ((x + 2 * y) % 4 === 0) b.set(x, y, r[1]);
      b.rect(4, 7, 4, 2, '#ffa040');
    }
  } else if (kind === 'hat') {
    const h = HATS[id];
    if (h) {
      const n = h.rows.length;
      drawHat(b, id, 6, Math.floor((12 - n) / 2) + n - 1);
    } else {
      b.line(3, 3, 8, 8, '#ff3b5c');
      b.line(8, 3, 3, 8, '#ff3b5c');
    }
  } else {
    // twarz z nosem
    b.ellipse(5, 6, 4, 4, '#f5c9a0');
    b.set(5, 5, OUTLINE);
    b.set(7, 5, OUTLINE);
    b.set(3, 4, '#ffe0c0');
    if (NOSE_IDS.includes(id)) drawNose(b, id, 9, 6);
  }
  b.outline(OUTLINE);
  return b;
}
