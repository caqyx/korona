import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/sim');

function listJs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listJs(p));
    else if (/\.(m?js|ts)$/.test(name)) out.push(p);
  }
  return out;
}

/** Usuwa komentarze, zachowując literały napisów (komentarze mogą wspominać np. Math.random). */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') {
          out += src[i++];
        }
        out += src[i++];
      }
      out += src[i++] ?? '';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function importSpecifiers(code) {
  const specs = [];
  const patterns = [/\bimport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, /\bexport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g];
  for (const re of patterns) for (const m of code.matchAll(re)) specs.push(m[1]);
  // dynamic import with a non-literal argument cannot be verified
  if (/\bimport\s*\(\s*[^'"`\s)]/.test(code)) specs.push('<dynamic import>');
  return specs;
}

const FORBIDDEN = [
  { re: /\bMath\s*\.\s*random\b/, name: 'Math.random' },
  { re: /\bDate\s*\.\s*now\b/, name: 'Date.now' },
  { re: /\bnew\s+Date\b/, name: 'new Date' },
  { re: /\bperformance\s*\./, name: 'performance.' },
  { re: /\bwindow\s*\./, name: 'window.' },
  { re: /\bdocument\s*\./, name: 'document.' },
  { re: /\bglobalThis\s*\./, name: 'globalThis.' },
  { re: /\b(setTimeout|setInterval|requestAnimationFrame|fetch)\s*\(/, name: 'timers/network' },
];

const files = listJs(SIM_DIR);

describe('architecture guard: src/sim is pure', () => {
  it('finds the simulation files', () => {
    const rel = files.map((f) => relative(SIM_DIR, f).split(sep).join('/'));
    for (const must of ['step.js', 'rules.js', 'combat.js', 'zones.js', 'heroes/index.js', 'bosses/index.js']) expect(rel).toContain(must);
  });

  it('stripComments removes comments but keeps strings', () => {
    expect(stripComments("a // Math.random\nb /* Date.now */ c '//x'")).toBe("a \nb  c '//x'");
  });

  it('detectors catch violations in sample code', () => {
    const sample = stripComments("import { x } from '../net/peer.js';\nexport * from 'three';\nconst r = Math.random(); const t = Date.now(); window.foo; document.body; performance.now();");
    expect(importSpecifiers(sample)).toEqual(['../net/peer.js', 'three']);
    const found = FORBIDDEN.filter((f) => f.re.test(sample)).map((f) => f.name);
    for (const n of ['Math.random', 'Date.now', 'window.', 'document.', 'performance.']) expect(found).toContain(n);
  });

  for (const file of files) {
    const rel = relative(SIM_DIR, file).split(sep).join('/');
    it(`${rel}: imports stay inside src/sim`, () => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const bad = [];
      for (const spec of importSpecifiers(code)) {
        if (!spec.startsWith('./') && !spec.startsWith('../')) {
          bad.push(spec + ' (bare/absolute specifier)');
          continue;
        }
        const target = resolve(dirname(file), spec);
        const r = relative(SIM_DIR, target);
        if (r.startsWith('..') || resolve(SIM_DIR, r) !== target) bad.push(spec + ' -> ' + target);
        else if (!existsSync(target)) bad.push(spec + ' (missing file)');
      }
      expect(bad).toEqual([]);
    });

    it(`${rel}: no nondeterministic / browser globals`, () => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const found = FORBIDDEN.filter((f) => f.re.test(code)).map((f) => f.name);
      expect(found).toEqual([]);
    });
  }
});
