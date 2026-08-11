// WARMTH PASS — the five screens, three viewports, before and after.
//
// The warmth pass is a colour/texture change with no layout in it, so the only
// honest gate is a pair of images of the SAME screen at the SAME viewport with
// the SAME payload. This script shoots that pair; `--label before` is run on the
// pre-change build and `--label after` on the changed one, and the two folders
// are compared by eye.
//
//   node scripts/shoot-warmth.mjs --label after
//   node scripts/shoot-warmth.mjs --label before --revert
//   node scripts/shoot-warmth.mjs --label after --desktop   (parity frame too)
//
// --revert layers the EXACT inverse of the pass over the built app, so the
// "before" frame comes out of the same build as the "after" one. The pass is
// pure colour/texture, so an inverse sheet is a complete before — it is listed
// property by property below and any future addition to the pass has to be
// added to it or the pair stops being honest.
//
// Output: output/warmth/<label>/<screen>-<w>x<h>.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-08';
const label = (() => {
  const i = process.argv.indexOf('--label');
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : 'shot';
})();
const WITH_DESKTOP = process.argv.includes('--desktop');
const REVERT_ON = process.argv.includes('--revert');
// A deeper espresso, for Al to rule against the shipped strength. Not in the
// app: this layers over the same build the way --revert does.
const STRONG_ON = process.argv.includes('--strong');
const STRONGER = `
  :root { --ink-2: #bfb2a0; }
  @media (max-width: 768px) {
    :root { --page-bg: #17120b; --surface: #261e14; }
    .hero-photo { background-color: #100b05; }
  }
`;
// The ruled icon gold at full strength competes with the gold temperature line
// and the gold active toggle on the same screen. This is the same warmth one
// step down, for Al to rule against the full gold. Not in the app.
const MUTED_ICONS = process.argv.includes('--mutedicons');
const MUTED = `
  @media (max-width: 768px) {
    #hourly-screen .hourly-row .h-icon,
    #week-screen .daily-row .d-icon,
    .hourly-chart .chart-icon { color: #d9bc5c; }
  }
`;
const output = path.join(root, 'output', 'warmth', label);

// The inverse of the warmth pass, property for property.
const REVERT = `
  :root { --ink-2: #aab0bd; }
  @media (max-width: 768px) {
    :root {
      --page-bg: #0d0d12;
      --surface: #16171d;
      --ink: #ffffff;
      --cap-fs: clamp(0.78rem, min(2.35vh, 5.2vw), 1.6rem);
      --print-ink: #24211d;
    }
    #bg, .screenPanel, .nav { background-image: none; }
    .hero-photo { background-color: #0a0a0e; }
    .page-sub,
    .hourly-chart .chart-caption,
    .range-chart .chart-caption,
    .settings-screen .settings-section h3,
    .search-screen .search-lists .section h3 { color: var(--ink-2); }
    .range-legend {
      margin-top: 12px; padding: 10px 0 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: none; border-radius: 0;
    }
    .sources-list-empty, .list-empty {
      background: none; border-radius: 0; padding: 10px 14px;
      color: rgba(255,255,255,0.6);
    }
    #hourly-screen .hourly-row .h-icon,
    #week-screen .daily-row .d-icon,
    .hourly-chart .chart-icon { color: inherit; }
    .hourly-chart .chart-icon { color: var(--ink-2); }
  }
`;

// ONE photograph across before and after, or the pair is comparing pictures
// instead of treatments. Resolved to what the build actually serves.
const PINNED_SLOT = 'clear/week_2/day/1.webp';
const slotFile = path.join(root, 'assets', 'images', 'bg', PINNED_SLOT);
if (!existsSync(slotFile)) throw new Error(`pinned slot missing: ${PINNED_SLOT}`);
const heroUrl = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(slotFile)).digest('hex')}.webp`;
if (!existsSync(path.join(dist, heroUrl.slice(1)))) {
  throw new Error(`pinned image is not in the build: ${heroUrl} — run npm run build`);
}
// The app sets --hero-url as an inline style on <html>; only !important beats it.
const PIN_IMAGE = `html { --hero-url: url("${heroUrl}") !important; }`;

// The three phones the pass is judged on: the smallest screen in the fold
// matrix, Al's own iPhone X, and a large phone. Same devices the fold gate
// asserts, so a screenshot here and a fold row there describe one layout.
const VIEWPORTS = [
  { w: 320, h: 568, name: 'small' },
  { w: 375, h: 812, name: 'alphone' },
  { w: 428, h: 926, name: 'large' },
];

// One payload for every shot: a cloudy Somerset West afternoon with all five
// sources reporting, so Bronne draws a real five-row range chart.
function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 11, rainChance: (i % 7) * 12, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 60, humidity: 74, uv: 7,
    condition: i % 7 > 4 ? 'rain' : 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: [17, 19, 21, 18, 16, 20, 22][d], lowC: [11, 12, 13, 11, 10, 12, 14][d],
    rainChance: [0, 10, 5, 45, 70, 15, 0][d], uv: [4, 5, 6, 3, 2, 5, 7][d],
    windKph: [33, 28, 22, 30, 41, 25, 18][d],
    conditionKey: ['cloudy', 'partly-cloudy', 'clear', 'rain-possible', 'rain', 'partly-cloudy', 'clear'][d],
    conditionLabel: 'Cloudy', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  const names = ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'];
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 17, feelsLikeC: 14, uv: 7, isDay: true, windKph: 33, rainChance: 20,
      cloudPct: 60, conditionKey: 'cloudy', conditionLabel: 'Cloudy',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: 33, maxWindKph: 58, gustKph: 58, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: names.map((name) => ({ name, ok: true })),
      sourceConditions: names.map((name) => ({ name, condition: 'cloudy' })),
      // minTemp/maxTemp — the shape renderSourcesRangeChart actually reads. With
      // lowC/highC the chart tears itself down and Bronne shows the plain list,
      // which is how the first run of this script produced a sheet with the M4
      // range chart missing from every frame.
      sourceRanges: names.map((name, i) => ({
        name, minTemp: 9 + (i % 3), maxTemp: 16 + (i % 4),
      })),
      conditionConfidence: { level: 'high', finalCondition: 'cloudy', sourceAgreement: '4/5' },
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

// Each screen is reached the way a user reaches it — Hourly through the CTA,
// Bronne through the Settings row — so the shot proves the route works too.
const SCREENS = [
  { name: 'home', open: async () => {} },
  { name: 'hourly', open: async (page) => { await page.click('#homeHourly'); } },
  { name: 'weekly', open: async (page) => { await page.click('#navWeek'); } },
  { name: 'search', open: async (page) => { await page.click('#navSearch'); } },
  { name: 'settings', open: async (page) => { await page.click('#navSettings'); } },
  { name: 'sources', open: async (page) => { await page.click('#navSettings'); await page.click('#settingsSourcesRow'); } },
];

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

const frames = VIEWPORTS.map((vp) => ({ ...vp, mobile: true }));
if (WITH_DESKTOP) frames.push({ w: 1280, h: 900, name: 'desktop', mobile: false });

for (const vp of frames) {
  for (const screen of SCREENS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2,
      isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
      } catch (_) {}
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    await page.waitForTimeout(700);
    // END of <body>, not the head: index.html links app.css from the body, so a
    // head-injected sheet loses every equal-specificity contest.
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, `${PIN_IMAGE}\n${REVERT_ON ? REVERT : ''}\n${STRONG_ON ? STRONGER : ''}\n${MUTED_ICONS ? MUTED : ''}`);
    // Pin the caption too: the witty pick is random, and a before/after pair
    // showing two different jokes is not a pair.
    await page.evaluate(() => {
      const h = document.getElementById('headline');
      if (h) h.textContent = 'Kite surfers are having the time of their lives.';
    });
    await page.waitForTimeout(250);
    // The desktop frame has no #homeHourly / nav buttons of this shape; skip a
    // screen there rather than fail the run.
    try { await screen.open(page); } catch { await ctx.close(); continue; }
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(output, `${screen.name}-${vp.name}-${vp.w}x${vp.h}.png`) });
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(`[warmth] ${label}: ${frames.length * SCREENS.length} shots → output/warmth/${label}/`);
