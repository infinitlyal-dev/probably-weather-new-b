// Option shots for Al's two open picks (M1 revision, 2026-08-06):
//   A. hero crop      — where the 40%-height window sits on a 9:16 source
//   B. witty-line look — the personality layer currently reads as body text
//
// Every variant is shot on the SAME pinned storm image, otherwise the picker
// rolls a different photo per run and the comparison is worthless.
//   node scripts/verify-facelift-options.mjs  ->  output/facelift-options/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'facelift-options');
// Resolved at runtime from a probe load: the build rewrites every condition
// image to assets/images/bg-canonical/<sha>.webp via an in-bundle manifest, so
// a hand-written source path does not exist in dist. The picker also rolls at
// random, so the URL is captured ONCE and pinned across every variant.
let PINNED = '';
const DATE = '2026-08-06';

const CROPS = [
  { id: 'crop-a-high',   label: 'A — high band (18%)',  css: ':root{--hero-crop:18%!important}' },
  { id: 'crop-b-centre', label: 'B — centre (50%)',     css: ':root{--hero-crop:50%!important}' },
  { id: 'crop-c-low',    label: 'C — low band (78%)',   css: ':root{--hero-crop:78%!important}' },
  { id: 'crop-d-tall',   label: 'D — taller card, 32%', css: ':root{--hero-crop:32%!important;--hero-card-h:clamp(300px,52vh,470px)!important}' },
];

// Caveat already ships as a data: URI stylesheet, but it is JS-gated to >=1024px
// so mobile never downloads its ~104KB. Option 1 forces it on to show what it
// looks like; adopting it means paying those bytes on mobile.
const CAPTIONS = [
  {
    id: 'cap-1-caveat', label: '1 — Caveat, gold', caveat: true,
    css: `main#home-screen.main > .hero-caption{font-family:'Caveat Prototype','Segoe Print',cursive!important;font-size:1.6rem!important;line-height:1.15!important;font-weight:700!important;color:#ffd700!important;padding:15px 16px 17px!important}`,
  },
  {
    id: 'cap-2-italic', label: '2 — italic, gold, larger',
    css: `main#home-screen.main > .hero-caption{font-style:italic!important;font-size:1.16rem!important;font-weight:600!important;color:#ffd700!important}`,
  },
  {
    id: 'cap-3-rule', label: '3 — heavy white, gold rule',
    css: `main#home-screen.main > .hero-caption{font-size:1.1rem!important;font-weight:800!important;color:#fff!important;border-left:3px solid #ffd700!important;padding-left:13px!important;margin-left:0!important}`,
  },
];

function payload() {
  const c = { tempC: 14, low: 11, high: 17, rainChance: 92, cloudPct: 98, uv: 1, wind: 46, gust: 71 };
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: c.tempC + ((i % 5) - 2), feelsLikeC: c.tempC - 3, rainChance: c.rainChance,
    precipMm: 3.2, windKph: c.wind, windDir: 205 + (i % 40), cloudPct: c.cloudPct,
    humidity: 88, uv: c.uv, condition: 'storm',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: c.high, lowC: c.low, rainChance: c.rainChance, uv: c.uv, windKph: c.wind,
    conditionKey: 'storm', conditionLabel: 'Storm',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: c.tempC, feelsLikeC: c.tempC - 4, uv: c.uv, isDay: true, windKph: c.wind,
      rainChance: c.rainChance, cloudPct: c.cloudPct, conditionKey: 'storm',
      conditionLabel: 'Storm', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: c.wind, maxWindKph: c.gust, gustKph: c.gust, windDir: 205,
    consensus: { confidenceKey: 'strong' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'storm', sourceAgreement: '5/5' },
    },
  };
}

function startServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payload()
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' }
        : {};
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

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

async function shoot({ id, css, caveat }, extraCss = '') {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
  await page.addInitScript(() => {
    try {
      // Without a saved home the app asks for geolocation and a permission
      // toast covers the header; the first-visit tagline also shows.
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      localStorage.setItem('pw_seen_home', '1');
    } catch (_) {}
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const s = document.getElementById('pwSplash');
    return !s || s.classList.contains('splash-done');
  }, null, { timeout: 15000 });
  if (caveat) {
    await page.addStyleTag({ url: '/assets/type-prototype-caption.css' });
    await page.waitForTimeout(500);
  }
  // Pin the photo AFTER render so the picker's roll cannot vary the comparison.
  if (!PINNED) {
    PINNED = await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--hero-url').trim();
      const m = v.match(/url\(["']?([^"')]+)["']?\)/);
      return m ? m[1] : '';
    });
  }
  await page.addStyleTag({ content: `:root{--hero-url:url("${PINNED}")!important}${css}${extraCss}` });
  await page.waitForTimeout(900);
  const file = path.join(output, `${id}.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  return path.relative(root, file);
}

// Probe load purely to resolve and pin one storm photo.
await shoot({ id: '_probe', css: '' });
console.error('pinned photo:', PINNED);

const shots = [];
for (const c of CROPS) shots.push({ set: 'crop', ...c, file: await shoot(c) });
// Caption options are shot on the agreed-good crop so only the type varies.
for (const c of CAPTIONS) shots.push({ set: 'caption', ...c, file: await shoot(c, ':root{--hero-crop:32%!important}') });

await browser.close();
server.close();
console.log(JSON.stringify(shots.map(({ set, id, label, file }) => ({ set, id, label, file })), null, 2));
