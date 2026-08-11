// What the grain actually costs. Measured, not asserted.
//
// Same build, same payload, same viewport, 4x CPU throttle — the only
// difference is that one arm ABORTS the request for the grain tile, so the
// texture never paints. Five runs each, medians reported: LCP, first paint, and
// when the tile lands relative to LCP.
//
//   node scripts/measure-grain-cost.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-08';
const RUNS = 7;

// THE CONTROL. Without pinning the photograph, the picker hands each run a
// different image and LCP swings by seconds — the first version of this script
// measured a 916-4324ms spread and could not have detected a 3.5KB tile inside
// it. Seeding pw_last_bg makes the shell paint the SAME picture every run.
const PINNED_SLOT = 'clear/week_2/day/1.webp';
const slotFile = path.join(root, 'assets', 'images', 'bg', PINNED_SLOT);
if (!existsSync(slotFile)) throw new Error(`pinned slot missing: ${PINNED_SLOT}`);
const PINNED_URL = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(slotFile)).digest('hex')}.webp`;
if (!existsSync(path.join(dist, PINNED_URL.slice(1)))) {
  throw new Error(`pinned image is not in the build: ${PINNED_URL} — run npm run build`);
}

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 11, rainChance: (i % 7) * 12, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 60, humidity: 74, uv: 7, condition: 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 17, lowC: 11, rainChance: 40, uv: 7, windKph: 30,
    conditionKey: 'cloudy', conditionLabel: 'Cloudy', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
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
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
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

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function run(withGrain) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  if (!withGrain) await page.route('**/grain.png', (r) => r.abort());
  await page.addInitScript((pinned) => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      localStorage.setItem('pw_last_bg', pinned);
    } catch (_) {}
    // LCP is NOT in the default performance buffer — getEntriesByType returned
    // nothing and the first run of this script reported NaN. A buffered observer
    // registered before first paint is the only way to catch every candidate.
    try {
      window.__lcp = null;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
  }, PINNED_URL);
  const cdp = await ctx.newCDPSession(page);
  // A mid-range Android, not this laptop.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const m = await page.evaluate(() => {
    const lcp = window.__lcp ?? null;
    const fp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const grain = performance.getEntriesByType('resource').find((r) => r.name.endsWith('grain.png'));
    return {
      lcp, fp,
      grainStart: grain ? grain.startTime : null,
      grainEnd: grain ? grain.responseEnd : null,
      grainBytes: grain ? grain.transferSize : null,
    };
  });
  await ctx.close();
  return m;
}

const arms = { with: [], without: [] };
for (let i = 0; i < RUNS; i += 1) {
  arms.with.push(await run(true));
  arms.without.push(await run(false));
}
await browser.close();
server.close();

const vals = (xs, key) => xs.map((m) => m[key]).filter((v) => v != null);
const fmt = (xs, key) => Math.round(median(vals(xs, key)));
// Spread as well as median: a 30ms difference between arms means nothing if each
// arm's own runs are 60ms apart, and reporting the median alone would hide that.
const spread = (xs, key) => {
  const v = vals(xs, key);
  return v.length ? `${Math.round(Math.min(...v))}-${Math.round(Math.max(...v))}` : 'n/a';
};
console.log(`[grain cost] ${RUNS} runs each, 375x812, 4x CPU throttle, median (min-max):`);
console.log(`  LCP  with grain: ${fmt(arms.with, 'lcp')} ms (${spread(arms.with, 'lcp')})   without: ${fmt(arms.without, 'lcp')} ms (${spread(arms.without, 'lcp')})`);
console.log(`  FCP  with grain: ${fmt(arms.with, 'fp')} ms (${spread(arms.with, 'fp')})   without: ${fmt(arms.without, 'fp')} ms (${spread(arms.without, 'fp')})`);
console.log(`  tile: ${fmt(arms.with, 'grainBytes')} bytes on the wire, request starts at ${fmt(arms.with, 'grainStart')} ms, done at ${fmt(arms.with, 'grainEnd')} ms`);
