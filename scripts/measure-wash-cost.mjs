// What the vibrancy wash costs — the measurement the review said was missing.
//
// The wash is a viewport-sized pseudo-element carrying
// `filter: blur(38px) saturate(1.35) brightness(0.42)`, and on a storm it sits
// under 28 animated rain particles in the same stacking context. The grain tile
// was A/B measured because the brief said "no runtime-cost textures"; this is
// the heavier effect and had no equivalent number.
//
// Same build, same pinned photograph, 4x CPU throttle. Arms:
//   with    — as shipped
//   without — `#bg::after { display: none }` injected before first paint
// Reported: LCP, and the frame statistics Chromium itself collects while the
// rain animates, which is where a blur actually hurts.
//
//   node scripts/measure-wash-cost.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-13';
const RUNS = 5;
// A storm, because that is the case with particles animating over the wash.
const SLOT = 'storm/week_1/day/3.webp';

const file = path.join(root, 'assets', 'images', 'bg', SLOT);
const PINNED = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(file)).digest('hex')}.webp`;
if (!existsSync(path.join(dist, PINNED.slice(1)))) throw new Error(`not in build: ${SLOT} — run npm run build`);

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 14 - (i % 4), feelsLikeC: 11, rainChance: 92, precipMm: 1.4, windKph: 46,
    windDir: 205, cloudPct: 98, humidity: 80, uv: 1, condition: 'storm',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 17, lowC: 11, rainChance: 92, uv: 1, windKph: 46, conditionKey: 'storm',
    conditionLabel: 'Storm', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: 14, feelsLikeC: 11, uv: 1, isDay: true, windKph: 46, rainChance: 92, cloudPct: 98,
      conditionKey: 'storm', conditionLabel: 'Storm', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: 46, maxWindKph: 71, gustKph: 71, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: 15, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'storm', sourceAgreement: '5/5' } },
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname.startsWith('/api/')) {
    const body = pathname === '/api/weather' ? payload()
      : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    return;
  }
  if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
  let f = null; let buf = null;
  try { f = path.resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1)); buf = readFileSync(f); }
  catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function run(withWash) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((pinned) => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      localStorage.setItem('pw_last_bg', pinned);
    } catch (_) {}
    try {
      window.__lcp = null;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
  }, PINNED);
  if (!withWash) {
    await page.addStyleTag({ content: '#bg::after { display: none !important; }' }).catch(() => {});
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(base, { waitUntil: 'load' });
  if (!withWash) {
    // addStyleTag before navigation does not survive it; re-apply immediately.
    await page.addStyleTag({ content: '#bg::after { display: none !important; }' });
  }
  await page.waitForTimeout(3000);
  // Let the rain animate, then read what the compositor actually did.
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    let count = 0; let worst = 0; let prev = t0;
    const tick = (now) => {
      const dt = now - prev; prev = now; count += 1;
      if (dt > worst) worst = dt;
      if (now - t0 < 2000) requestAnimationFrame(tick);
      else resolve({ frames: count, seconds: (now - t0) / 1000, worstFrameMs: Math.round(worst) });
    };
    requestAnimationFrame(tick);
  }));
  const lcp = await page.evaluate(() => window.__lcp);
  await ctx.close();
  return { lcp, fps: frames.frames / frames.seconds, worst: frames.worstFrameMs };
}

const arms = { with: [], without: [] };
for (let i = 0; i < RUNS; i += 1) {
  arms.with.push(await run(true));
  arms.without.push(await run(false));
}
await browser.close();
server.close();

const stat = (a, k) => median(a.map((x) => x[k]).filter((v) => v != null));
console.log(`[wash cost] storm home, 390x844, 4x CPU throttle, ${RUNS} runs each, medians:`);
console.log(`  LCP          with wash: ${Math.round(stat(arms.with, 'lcp'))} ms      without: ${Math.round(stat(arms.without, 'lcp'))} ms`);
console.log(`  FPS (rain)   with wash: ${stat(arms.with, 'fps').toFixed(1)}          without: ${stat(arms.without, 'fps').toFixed(1)}`);
console.log(`  worst frame  with wash: ${Math.round(stat(arms.with, 'worst'))} ms       without: ${Math.round(stat(arms.without, 'worst'))} ms`);
