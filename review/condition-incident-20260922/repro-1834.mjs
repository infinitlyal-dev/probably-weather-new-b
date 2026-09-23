// Reproduce the desktop screen Al saw at Strand, Tuesday 22 Sept 2026, 18:34 SAST:
// "Probably 23° → 17°", "Partly cloudy.", "Wind 5 km/h (gusts 10 km/h) • Rain Possible later",
// 7-day today 30° / 19°. The browser clock is pinned to that minute and /api/weather is
// answered with a partly-cloudy Strand payload shaped like the real one (deployed-api.json,
// captured 16:35 the same day, moved to 18:00 local and to partly-cloudy).
//
//   node review/condition-incident-20260922/repro-1834.mjs <site-url|dist> <out.png> [width]
// "dist" serves ./dist on a local port (the build under test); a URL drives that site.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const [target = 'dist', out = path.join(root, 'output', 'repro-1834.png'), width = '1440'] = process.argv.slice(2);

const base = JSON.parse(readFileSync(path.join(here, 'deployed-api.json'), 'utf8'));
const payload = structuredClone(base);
payload.meta.localHour = 18;
payload.meta.confidence = 'high';
payload.meta.conditionConfidence = { ...payload.meta.conditionConfidence, level: 'high', sourceAgreement: '5/5', finalCondition: 'partly-cloudy' };
payload.meta.sourceConditions = payload.meta.sourceConditions.map((v) => ({ ...v, desc: 'Partly cloudy', vote: 'clear' }));
payload.wind_kph = 5; payload.gustKph = 10; payload.maxWindKph = 10;
Object.assign(payload.now, {
  tempC: 23, feelsLikeC: 23, windKph: 5, rainChance: 12, uv: 1, cloudPct: 45, isDay: true,
  conditionKey: 'partly-cloudy', conditionReason: 'partly-cloudy', conditionLabel: 'Partly cloudy',
  sunrise: '2026-09-22T06:34', sunset: '2026-09-22T18:41',
});
payload.now.conditionSignals = { ...payload.now.conditionSignals, overrides: [], sourceVotes: payload.meta.sourceConditions };
payload.daily[0] = { ...payload.daily[0], highC: 30, lowC: 19, rainChance: 25, conditionKey: 'rain-possible', uvMax: 7 };
payload.daily[1] = { ...payload.daily[1], lowC: 17 };
for (let i = 0; i < 48; i++) payload.hourly[i] = { ...payload.hourly[i], rainChance: 10, precipMm: 0, cloudPct: 45, windKph: 5 };
payload.hourly[18].tempC = 23; payload.hourly[21].tempC = 19;

let server = null;
let site = target;
if (target === 'dist') {
  const dist = path.join(root, 'dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = path.join(dist, p);
    if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  site = `http://127.0.0.1:${server.address().port}/`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(width), height: Math.round(Number(width) * 0.5625) },
  geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'],
  timezoneId: 'Africa/Johannesburg', locale: 'en-ZA', serviceWorkers: 'block',
});
await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('en')); } catch {} });
await ctx.route('**/api/weather**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
await ctx.route('**/api/version**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":"repro"}' }));
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-09-22T16:34:00Z'));
await page.goto(site, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 30000 });
await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0 && !/default\.jpg/.test(i.src); }, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
const seen = await page.evaluate(() => ({
  display: window.__PW_LAST_DISPLAY,
  conditionLine: document.querySelector('#description')?.textContent?.trim(),
  temp: document.querySelector('.temp')?.textContent?.replace(/\s+/g, ' ').trim(),
  byline: document.querySelector('#weatherByline')?.textContent?.replace(/\s+/g, ' ').trim(),
  caption: document.querySelector('#headline')?.textContent?.trim(),
  bg: document.querySelector('#bgImg')?.getAttribute('src'),
  objectPosition: getComputedStyle(document.querySelector('#bgImg')).objectPosition,
}));
await page.screenshot({ path: out });
console.log(JSON.stringify(seen, null, 1));
await browser.close();
server?.close();
