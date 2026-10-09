// The breezy glyph as the phone shows it (Al, 9 Oct 2026): the built page at 414x715 on a fixture forecast — the Home
// panel's hourly list (breezy hours first, then windy ones) and the Weekly day cards (breezy days beside windy ones) —
// plus the two glyphs side by side, large and at the strip's size. One image for Al.
//
//   node scripts/build.mjs && node scripts/breezy-glyph-sheet.mjs   -> review/breezy-glyph-2026-10-09.jpg
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { weatherIconSvg } from '../assets/weather-icons.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, ...p);
const DAY = '2026-10-09';
// the list starts at the local hour (13:00 here): six breezy hours (the server's mark), six windy ones (its hourly key
// 'wind'), the rest clear
const H0 = 13;
const hourly = Array.from({ length: 48 }, (_, n) => n - H0).map((i) => ({ tempC: 21 - (i % 6), feelsLikeC: 19, rainChance: 5, precipMm: 0,
  windKph: i < 6 ? 19 : i < 12 ? 38 : 9, windDir: 135, cloudPct: 20, humidity: 55, uv: 4,
  condition: i >= 0 && i < 6 ? 'breezy' : i >= 6 && i < 12 ? 'wind' : 'clear' }));
const KEYS = ['breezy', 'wind', 'clear', 'breezy', 'wind', 'partly-cloudy', 'clear'];
const LABEL = { breezy: 'Breezy', wind: 'Windy', clear: 'Clear', 'partly-cloudy': 'Partly cloudy' };
const daily = KEYS.map((k, i) => ({ highC: 23 - (i % 3), lowC: 12, rainChance: 5, uv: 6, windKph: k === 'wind' ? 40 : k === 'breezy' ? 20 : 10,
  conditionKey: k, conditionLabel: LABEL[k], sunrise: `${DAY}T06:05`, sunset: `${DAY}T19:08` }));
const payload = { ok: true, location: { name: 'Strand, Western Cape', lat: -34.11, lon: 18.83 },
  now: { tempC: 21, feelsLikeC: 19, uv: 4, isDay: true, windKph: 19, rainChance: 5, cloudPct: 20, conditionKey: 'breezy', conditionLabel: 'Breezy',
    sunrise: `${DAY}T06:05`, sunset: `${DAY}T19:08` },
  hourly, daily, wind_kph: 19, maxWindKph: 27, gustKph: 31, windDir: 135, consensus: { confidenceKey: 'decent' },
  meta: { schema: 5, localHour: H0, utcOffsetSeconds: 7200, confidence: 'high',
    sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
    sourceConditions: [], sourceRanges: [], conditionConfidence: { level: 'high', finalCondition: 'breezy', sourceAgreement: '4/5' } } };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname.startsWith('/api/')) {
    const body = pathname === '/api/weather' ? payload : pathname === '/api/locate' ? { ok: true, lat: -34.11, lon: 18.83, name: 'Strand, Western Cape' } : {};
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  }
  if (pathname.startsWith('/_vercel/')) return res.writeHead(204).end();
  const base = pathname.startsWith('/assets/images/bg/') ? root : R('dist');
  const file = path.resolve(base, pathname === '/' ? 'index.html' : pathname.slice(1));
  let buf; try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  geolocation: { latitude: -34.11, longitude: 18.83 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('pw_lang', 'en'); } catch {} });
await page.goto(`${base}/?lat=-34.11&lon=18.83`, { waitUntil: 'networkidle' });
await page.waitForSelector('#hourly-timeline .hourly-row:not(.hourly-header)', { state: 'attached', timeout: 20000 });
await page.waitForTimeout(3000);
await page.getByText('Not now').first().click({ timeout: 3000 }).catch(() => {}); // the install banner, off the list
await page.locator('.d-handle').first().click().catch(() => {});
await page.waitForTimeout(1500);
const shots = [await page.screenshot()];
const drawn = await page.$$eval('#hourly-timeline .hourly-row:not(.hourly-header) [data-icon]', (els) => els.slice(0, 14).map((e) => e.dataset.icon));
await page.goto(`${base}/?lat=-34.11&lon=18.83`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#navWeek');
await page.waitForTimeout(1500);
shots.push(await page.screenshot());
const days = await page.$$eval('#daily-cards [data-icon]', (els) => els.map((e) => e.dataset.icon));
await browser.close(); server.close();

const inner = (name) => /<svg[^>]*>(.*)<\/svg>/.exec(weatherIconSvg(name))[1];
const svgPanel = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="828" height="1430"><rect width="828" height="1430" fill="#14110d"/>
<g fill="none" stroke="#f3efe6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<g transform="translate(150 380) scale(10)">${inner('wind')}</g><g transform="translate(450 380) scale(10)">${inner('breezy')}</g>
<g transform="translate(318 880) scale(2)">${inner('wind')}</g><g transform="translate(462 880) scale(2)">${inner('breezy')}</g></g>
<g font-family="sans-serif" fill="#f3efe6" text-anchor="middle"><text x="270" y="680" font-size="34">Windy</text><text x="570" y="680" font-size="34">Breezy</text>
<text x="414" y="990" font-size="26">at the strip's size</text></g></svg>`);
const panel = await sharp(svgPanel).png().toBuffer();
const W = 828, H = 1430, gap = 24;
await sharp({ create: { width: W * 3 + gap * 4, height: H + gap * 2, channels: 3, background: '#2a241c' } })
  .composite([shots[0], shots[1], panel].map((b, i) => ({ input: b, left: gap + i * (W + gap), top: gap })))
  .jpeg({ quality: 86 }).toFile(R('review', 'breezy-glyph-2026-10-09.jpg'));
console.log('hourly icons:', drawn.join(' '), '\nweekly screen icons:', days.join(' '));
