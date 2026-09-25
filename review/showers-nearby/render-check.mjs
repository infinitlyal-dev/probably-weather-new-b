// "Showers nearby." on a real build, in all five languages (Al's ruling, 25 Sept 2026).
//   node review/showers-nearby/render-check.mjs [--dist dist] [--out output/showers-nearby]
// Serves the build, stubs /api/weather with the Strand production payload re-dressed as a showers-nearby hour
// (and, as a control, the same hour as plain might-rain and as strict rain), loads Home at 390x844 in each
// language and reads the hero's description line. Exit 1 if any language shows the wrong words.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'output/showers-nearby');
mkdirSync(OUT, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const app = readFileSync('assets/app.js', 'utf8');
const leaf = (key) => new Function(`return ${app.match(new RegExp(`${key}: (\\{ en: "[^"]*", af: "[^"]*", zu: "[^"]*", xh: "[^"]*", st: "[^"]*" \\})`))[1]};`)();
const { WEATHER_COPY } = await import('../../assets/weather-copy.js');
const WANT = { nearby: leaf('showersNearby'), maybe: WEATHER_COPY.headlines['rain-possible'], rain: WEATHER_COPY.headlines.rain };

const T = Date.parse('2026-09-25T08:00:00Z');   // 10:00 SAST
const payloadFor = (state) => {
  const b = structuredClone(LIVE);
  const rain = state === 'rain', pct = rain ? 95 : state === 'nearby' ? 75 : 45;
  Object.assign(b.now, { tempC: 16, feelsLikeC: 15, uv: 1, isDay: true, cloudPct: 90, windKph: 12, rainChance: pct,
    conditionKey: rain ? 'rain' : 'rain-possible', conditionReason: rain ? 'rain-now' : state === 'nearby' ? 'showers-nearby' : 'rain-possible-prob' });
  b.hourly = b.hourly.map((x) => ({ ...x, rainChance: pct, precipMm: rain ? 3 : 1, windKph: 12 }));
  b.daily = b.daily.map((d) => ({ ...d, rainChance: pct, conditionKey: 'rain' }));
  b.wind_kph = 12; b.gustKph = 20; b.maxWindKph = 20;
  b.location = { ...b.location, name: 'Strand' };
  b.meta = { ...b.meta, localHour: 10, utcOffsetSeconds: 7200, sourceConditions: [
    { source: 'Open-Meteo', desc: 'Moderate rain', vote: 'rain' }, { source: 'MET Norway', desc: 'Rain', vote: 'rain' }, { source: 'WeatherAPI', desc: 'Overcast', vote: 'cloudy' }] };
  return b;
};

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, name: 'Strand, Western Cape', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let bad = 0;
for (const state of ['nearby', 'maybe', 'rain']) for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
  current = payloadFor(state);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Africa/Johannesburg',
    geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} }, lang);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(T));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  const got = await page.evaluate(() => document.getElementById('description')?.textContent?.trim() || '');
  const ok = got === WANT[state][lang];
  if (!ok) bad++;
  if (state === 'nearby') await page.screenshot({ path: path.join(OUT, `nearby-${lang}.png`) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${state.padEnd(6)} ${lang}: "${got}"${ok ? '' : ` (want "${WANT[state][lang]}")`}`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? `[showers nearby] FAIL — ${bad} wrong` : '[showers nearby] PASS — 15/15');
process.exit(bad ? 1 : 0);
