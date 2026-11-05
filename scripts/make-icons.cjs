// Generuje ikony PWA (192/512 + maskable) rysując je w Chromium (Playwright).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const draw = (size, pad) => `
  const c = document.createElement('canvas'); c.width = c.height = ${size};
  const x = c.getContext('2d'); const s = ${size}; const p = s * ${pad};
  x.fillStyle = '#07070d'; x.fillRect(0, 0, s, s);
  const g = x.createRadialGradient(s/2, s/2, s*0.05, s/2, s/2, s*0.55); g.addColorStop(0, '#20235a'); g.addColorStop(1, '#07070d');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const w = s - 2*p, cx = s/2, cy = s/2 + w*0.05, k = w*0.36;
  x.shadowColor = '#ffd23f'; x.shadowBlur = s*0.06; x.fillStyle = '#ffd23f';
  x.beginPath(); x.moveTo(cx-k, cy+k*0.55); x.lineTo(cx-k, cy-k*0.45); x.lineTo(cx-k*0.5, cy); x.lineTo(cx, cy-k*0.8);
  x.lineTo(cx+k*0.5, cy); x.lineTo(cx+k, cy-k*0.45); x.lineTo(cx+k, cy+k*0.55); x.closePath(); x.fill();
  x.shadowBlur = 0; x.fillStyle = '#ff2848'; x.beginPath(); x.arc(cx, cy+k*0.2, k*0.13, 0, Math.PI*2); x.fill();
  c.toDataURL('image/png');`;

(async () => {
  const out = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0.12], ['icon-512.png', 512, 0.12], ['maskable-512.png', 512, 0.22]]) {
    const data = await page.evaluate(draw(size, pad));
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
  console.log('ikony zapisane w public/icons');
})();
