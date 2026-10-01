// The Weekly day card (days 2+) fits its six stats (1 Oct 2026): Rain, UV, Sunrise, Sunset, and since
// today Wind ("up to …") and Gusts. Opens Weekly → day 2 in all five languages at Al's phone with
// Chrome showing (414x715) and the smallest phone the fold gate knows (320x488), and fails if any
// stat's text overflows its cell or the card is wider than the screen.
//
// What "fits" means here:
//   1. Six .ds-stat cells render (the wind and gust numbers reached the card).
//   2. No cell, label or value overflows: scrollWidth <= clientWidth, and no label/value box ends
//      past its cell's right edge.
//   3. The card is no wider than the viewport, and the page does not scroll sideways.
//
//   npm run build && node scripts/verify-day-detail-wind.mjs
//
// Serves dist/ with a fixture payload, the way scripts/verify-home-fold.mjs does. The fixture's wind
// is three-digit on purpose (105 km/h, gusts 128) so the widest value is the one measured.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-10-01';
const VIEWPORTS = [
  { w: 414, h: 715, name: "Al's iPhone 11 + Chrome" },
  { w: 320, h: 488, name: 'iPhone SE 1st + chrome' },
];
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const DAY = 2;

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 15, rainChance: 20, precipMm: 0, windKph: 30, windDir: 160,
    cloudPct: 30, humidity: 60, uv: 6, condition: 'wind',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 21, lowC: 12, rainChance: 10, uv: 9, conditionKey: 'wind', conditionLabel: 'Windy',
    windMaxKph: 105, gustMaxKph: 128,
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:10`,
  }));
  return {
    ok: true,
    location: { name: 'Cape Town, Western Cape', lat: -33.92, lon: 18.42 },
    now: {
      tempC: 18, feelsLikeC: 16, uv: 6, isDay: true, windKph: 30, rainChance: 10,
      cloudPct: 30, conditionKey: 'wind', conditionLabel: 'Windy',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:10`,
    },
    hourly, daily,
    wind_kph: 30, maxWindKph: 45, gustKph: 45, windDir: 160,
    consensus: { confidenceKey: 'decent' },
    meta: {
      schema: 5, localHour: 11, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'wind', sourceAgreement: '4/5' },
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
        : pathname === '/api/locate' ? { ok: true, lat: -33.92, lon: 18.42, name: 'Cape Town, Western Cape' }
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

const MEASURE = () => {
  const card = document.querySelector('.day-detail-summary-card');
  if (!card) return null;
  const cr = card.getBoundingClientRect();
  const stats = [...card.querySelectorAll('.ds-stat')].map((cell) => {
    const r = cell.getBoundingClientRect();
    const parts = [...cell.children].map((el) => {
      const b = el.getBoundingClientRect();
      return { text: el.textContent, scrollW: el.scrollWidth, clientW: el.clientWidth, pastCellPx: b.right - r.right };
    });
    return { scrollW: cell.scrollWidth, clientW: cell.clientWidth, parts };
  });
  return {
    vw: window.innerWidth, cardW: cr.width, cardRight: cr.right,
    pageScrollW: document.documentElement.scrollWidth, stats,
  };
};

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const rows = [];

for (const vp of VIEWPORTS) {
  for (const lang of LANGS) {
    const label = `${vp.w}x${vp.h} ${lang}`;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T11:12:00+02:00`) });
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Cape Town, Western Cape', lat: -33.92, lon: 18.42, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('lang', JSON.stringify(l));
        localStorage.setItem('pw_lang', JSON.stringify(l));
      } catch (_) {}
    }, lang);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
    await page.click('#navWeek');
    await page.click(`.daily-row-tappable[data-day-index="${DAY}"]`);
    await page.waitForSelector('.day-detail-summary-card', { timeout: 10000 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(MEASURE);
    await ctx.close();
    if (!m) { failures.push(`[${label}] no day card`); continue; }

    if (m.stats.length !== 6) failures.push(`[${label}] ${m.stats.length} stats, expected 6`);
    let worst = -Infinity;
    m.stats.forEach((s, i) => {
      if (s.scrollW > s.clientW) failures.push(`[${label}] stat ${i} overflows its cell (${s.scrollW} > ${s.clientW})`);
      for (const p of s.parts) {
        worst = Math.max(worst, p.pastCellPx);
        if (p.scrollW > p.clientW) failures.push(`[${label}] "${p.text}" overflows (${p.scrollW} > ${p.clientW})`);
        if (p.pastCellPx > 0.5) failures.push(`[${label}] "${p.text}" ends ${p.pastCellPx.toFixed(1)}px past its cell`);
      }
    });
    if (m.cardW > m.vw + 0.5 || m.cardRight > m.vw + 0.5) failures.push(`[${label}] card ${m.cardW.toFixed(0)}px wide, right edge ${m.cardRight.toFixed(0)} > viewport ${m.vw}`);
    if (m.pageScrollW > m.vw) failures.push(`[${label}] page scrolls sideways (${m.pageScrollW} > ${m.vw})`);
    const wind = m.stats[4]?.parts.map((p) => p.text).join(': ') ?? '-';
    const gust = m.stats[5]?.parts.map((p) => p.text).join(': ') ?? '-';
    rows.push({ label, stats: m.stats.length, card: Math.round(m.cardW), vw: m.vw, slackPx: Math.round(-worst), wind, gust });
  }
}

await browser.close();
server.close();

console.log('viewport lang  stats card  vw  min-slack  wind | gusts');
for (const r of rows) console.log(`${r.label.padEnd(12)} ${String(r.stats).padStart(5)} ${String(r.card).padStart(4)} ${String(r.vw).padStart(4)} ${String(r.slackPx).padStart(9)}  ${r.wind} | ${r.gust}`);
const checks = VIEWPORTS.length * LANGS.length;
if (failures.length) {
  console.error(`\nFAIL ${checks - new Set(failures.map((f) => f.slice(1, f.indexOf(']')))).size}/${checks} combinations fit`);
  failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(`\nPASS ${checks}/${checks}: every stat fits its cell and the card fits the screen`);
