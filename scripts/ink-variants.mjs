// THE WITTY LINE'S INK — four colours on two photographs, for Al's pick.
//
// Al's ruling 2026-08-10: the line stays Caveat on the cream foot but leaves
// black ink. Marker on paper, saturated, no neon, no gradients. One colour
// app-wide once chosen. Orange and red are excluded by the warnings-only rule.
//
// Rendered on the KEPT vibrancy stack (iterations 1-4), because that is the
// direction the ink has to live in — judging ink against the old flat-charcoal
// home would be judging it against a screen that is being replaced.
//
//   node scripts/ink-variants.mjs
//
// Output: output/ink/  (index.html + 8 shots)
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'ink');
const DATE = '2026-08-08';
const BASE = readFileSync(path.join(root, 'output', 'vibrancy', 'cumulative-4.css'), 'utf8');

const INKS = [
  { id: 'a-petrol', name: 'A — marker petrol', hex: '#0b5c68',
    note: 'A teal/petrol marker. Cool against the warm stock, which is what makes it read as ink rather than as a tint of the paper.' },
  { id: 'b-magenta', name: 'B — deep pink', hex: '#a81259',
    note: 'A magenta marker. The most "someone wrote this" of the four; also the furthest from anything else in the app.' },
  { id: 'c-green', name: 'C — pen green', hex: '#1c6b3a',
    note: 'A green biro. Quietest of the three colours; closest to the black control in weight.' },
  { id: 'd-control', name: 'D — ink-dark (control)', hex: '#1b1813',
    note: 'What is in the code today.' },
];

const SCENES = {
  storm: { slot: 'storm/week_1/day/3.webp', caption: 'Even the bakkies on the N2 pulled over.',
    p: { tempC: 14, low: 11, high: 17, rain: 92, cloud: 98, uv: 1, wind: 46, key: 'storm', label: 'Storm', hour: 15 } },
  sunny: { slot: 'clear/week_1/day/1.webp', caption: 'This is why we live in South Africa.',
    p: { tempC: 29, low: 18, high: 31, rain: 0, cloud: 5, uv: 9, wind: 12, key: 'clear', label: 'Clear', hour: 13 } },
};

// Contrast on the print's stock, computed rather than asserted — the ink has to
// be a colour AND readable at caption size on #f6f2e8.
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

function canonicalUrl(slot) {
  const file = path.join(root, 'assets', 'images', 'bg', slot);
  if (!existsSync(file)) throw new Error(`pinned slot missing: ${slot}`);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(file)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${url}`);
  return url;
}

function payloadFor(s) {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: s.tempC - (i % 5), feelsLikeC: s.tempC - 3, rainChance: Math.max(0, s.rain - (i % 6) * 9),
    precipMm: s.rain > 50 ? 1.4 : 0, windKph: s.wind - (i % 7), windDir: 205, cloudPct: s.cloud,
    humidity: 70, uv: s.uv, condition: s.key,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: s.high, lowC: s.low, rainChance: s.rain, uv: s.uv, windKph: s.wind,
    conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: s.tempC, feelsLikeC: s.tempC - 3, uv: s.uv, isDay: true, windKph: s.wind, rainChance: s.rain,
      cloudPct: s.cloud, conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: s.wind, maxWindKph: s.wind + 20, gustKph: s.wind + 20, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: s.hour, utcOffsetSeconds: 7200, confidence: 'high',
      sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: s.key, sourceAgreement: '5/5' } },
  };
}

let current = SCENES.storm;
function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payloadFor(current.p)
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
    let file = null; let buf = null;
    try { file = path.resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1)); buf = readFileSync(file); }
    catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

mkdirSync(output, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

for (const [sceneName, scene] of Object.entries(SCENES)) {
  current = scene;
  const heroUrl = canonicalUrl(scene.slot);
  for (const ink of INKS) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T${String(scene.p.hour).padStart(2, '0')}:12:00+02:00`) });
    await page.addInitScript((u) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
        localStorage.setItem('pw_last_bg', u);
      } catch (_) {}
    }, heroUrl);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    // The ink override carries the per-condition classes too: renderHome stamps
    // .hero-storm etc. on the caption, and M9 repaints those to --print-ink.
    const inkCss = `
      @media (max-width: 768px) {
        main#home-screen.main > .hero-caption,
        main#home-screen.main > .hero-caption.hero-storm,
        main#home-screen.main > .hero-caption.hero-rain,
        main#home-screen.main > .hero-caption.hero-heat,
        main#home-screen.main > .hero-caption.hero-cold,
        main#home-screen.main > .hero-caption.hero-wind,
        main#home-screen.main > .hero-caption.hero-uv,
        main#home-screen.main > .hero-caption.hero-clear,
        main#home-screen.main > .hero-caption.hero-cloudy,
        main#home-screen.main > .hero-caption.hero-fog { color: ${ink.hex}; }
      }`;
    await page.evaluate(({ css, url }) => {
      const s = document.createElement('style');
      s.textContent = `html { --hero-url: url("${url}") !important; }\n${css}`;
      document.body.appendChild(s);
    }, { css: `${BASE}\n${inkCss}`, url: heroUrl });
    await page.evaluate((txt) => { document.getElementById('headline').textContent = txt; }, scene.caption);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(output, `${ink.id}-${sceneName}.png`) });
    await ctx.close();
  }
}
await browser.close();
server.close();

const sheet = `<!doctype html><meta charset="utf-8"><title>PW — the witty line's ink</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:26px;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:21px; margin:0 0 6px; }
  .lead { color:#b5ab9d; max-width:74ch; margin:0 0 20px; }
  .row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
  figure { margin:0 0 22px; width:236px; }
  img { width:100%; border-radius:7px; display:block; box-shadow:0 8px 22px rgba(0,0,0,.5); }
  figcaption { margin-top:8px; font-size:11.5px; color:#b5ab9d; }
  b { display:block; font-size:12.5px; margin-bottom:3px; color:#fffaf3; }
  .sw { display:inline-block; width:11px; height:11px; border-radius:2px; vertical-align:-1px; margin-right:5px; }
  .m { color:#fffaf3; font-variant-numeric:tabular-nums; }
  h2 { font-size:14px; color:#b5ab9d; font-weight:600; margin:18px 0 10px; }
</style>
<h1>The witty line's ink — four markers on the cream foot</h1>
<p class="lead">Rendered on the kept vibrancy stack (iterations 1–4), both pinned photographs, 390×844.
Ratios are measured against the print stock #f6f2e8. One colour app-wide once chosen; orange and red are excluded by the warnings-only ruling.</p>
${Object.keys(SCENES).map((s) => `<h2>${s === 'storm' ? 'Storm — shop canopy, lightning' : 'Sunny — beach, umbrellas'}</h2>
<div class="row">${INKS.map((ink) => `<figure>
  <img src="${ink.id}-${s}.png" alt="${ink.name}">
  <figcaption><b><span class="sw" style="background:${ink.hex}"></span>${ink.name}</b>${ink.note}<br>
  <span class="m">${ink.hex} · ${ratio(ink.hex, '#f6f2e8').toFixed(1)}:1 on the stock</span></figcaption>
</figure>`).join('')}</div>`).join('')}
`;
writeFileSync(path.join(output, 'index.html'), sheet);
console.log(`[ink] ${INKS.length * Object.keys(SCENES).length} shots + sheet → output/ink/index.html`);
for (const ink of INKS) console.log(`  ${ink.id.padEnd(11)} ${ink.hex}  ${ratio(ink.hex, '#f6f2e8').toFixed(2)}:1 on #f6f2e8`);
