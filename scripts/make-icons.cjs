// Generuje pikselowe ikony PWA (192/512 + maskable): korona 16×16 powiększona bez wygładzania.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CROWN = [
  '................',
  '................',
  '.......Y........',
  '..Y...YWY...Y...',
  '.YWY...Y...YWY..',
  '..Y...YYY...Y...',
  '..YY.YYYYY.YY...',
  '..YYYYYYYYYYY...',
  '..YYYRYYYBYYY...',
  '..YYYYYYYYYYY...',
  '..ddddddddddd...',
  '..YYYYYYYYYYY...',
  '...ddddddddd....',
  '................',
  '................',
  '................',
].map((r) => r.padEnd(16, '.'));

const draw = (size, pad) => `
  const rows = ${JSON.stringify(CROWN)};
  const pal = { Y: '#ffd23f', W: '#fff6c2', R: '#ff2848', B: '#3bd5ff', d: '#a8781a' };
  const c = document.createElement('canvas'); c.width = c.height = ${size};
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#14122a'; g.fillRect(0, 0, ${size}, ${size});
  const inner = ${size} - 2 * ${size} * ${pad};
  const px = Math.floor(inner / 13);
  const off = Math.floor((${size} - px * 13) / 2);
  // tło: delikatna szachownica
  for (let y = 0; y < ${size}; y += px) for (let x = 0; x < ${size}; x += px) if (((x + y) / px) % 2 === 0) { g.fillStyle = '#18163a'; g.fillRect(x, y, px, px); }
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(off + (x - 1.5) * px, off + (y - 1) * px, px, px); } }));
  c.toDataURL('image/png');`;

(async () => {
  const out = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0.08], ['icon-512.png', 512, 0.08], ['maskable-512.png', 512, 0.2]]) {
    const data = await page.evaluate(draw(size, pad));
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
  console.log('ikony zapisane w public/icons');
})();
