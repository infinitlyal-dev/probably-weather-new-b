// M7 — do the ruled anchors actually reach the pixel?
//
// The offsets are authored by hash, expanded to two key shapes, read by
// hero-crop.js and applied as a custom property that CSS consumes. Four links,
// and a break in any one ships a mechanism that does nothing.
//
// THE INVARIANT, and why it is stated this way: the first version of this script
// seeded pw_last_bg and asserted the crop for THAT image. Wrong test. Seeding
// only drives the cold-open paint — the picker then chooses its own photograph
// for the condition/time/week and anchors the one it chose, so the script
// reported three "failures" that were really the app correctly anchoring a
// different image. What must hold is:
//
//   for whatever image the app lands on, the painted crop == the table's value
//   for that image, or 78% when the table has no entry for it.
//
// That is checked across a spread of conditions and times, so the run covers
// both anchored and un-anchored photographs without pinning either.
//
//   node scripts/verify-crop-anchors-live.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-13';

// The generated runtime table is the source of truth for "what should this
// image paint" — the same module the app imports, not a re-derivation.
const { HERO_CROP_OFFSETS } = await import(pathToFileURL(path.join(root, 'assets', 'hero-crop.js')).href);
const CSS_DEFAULT = 78;

// A spread of conditions and times, so the run naturally covers both anchored
// and un-anchored photographs. Nothing is pinned: the picker chooses, and the
// assertion follows whatever it chose.
const RUNS = [
  { condition: 'clear', hour: 13 },
  { condition: 'rain', hour: 13 },
  { condition: 'storm', hour: 22 },
  { condition: 'cold', hour: 6 },
  { condition: 'heat', hour: 13 },
  { condition: 'fog', hour: 18 },
  { condition: 'wind', hour: 13 },
  { condition: 'cloudy', hour: 22 },
];

const expectedFor = (src) => {
  // hero-crop.js keys on everything after assets/images/ — mirror that here.
  const m = /assets\/images\/(.+?)(?:\?|$)/.exec(src || '');
  if (!m) return { key: null, expect: CSS_DEFAULT };
  const key = m[1];
  const y = HERO_CROP_OFFSETS[key];
  return { key, expect: typeof y === 'number' ? y : CSS_DEFAULT };
};

function payload(conditionKey) {
  const hourly = Array.from({ length: 48 }, () => ({
    tempC: 18, feelsLikeC: 16, rainChance: 10, precipMm: 0, windKph: 12, windDir: 205,
    cloudPct: 40, humidity: 60, uv: 4, condition: conditionKey,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 21, lowC: 13, rainChance: 10, uv: 4, windKph: 12, conditionKey, conditionLabel: conditionKey,
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: 18, feelsLikeC: 16, uv: 4, isDay: true, windKph: 12, rainChance: 10, cloudPct: 40,
      conditionKey, conditionLabel: conditionKey, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: 12, maxWindKph: 20, gustKph: 20, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: 13, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: conditionKey, sourceAgreement: '5/5' } },
  };
}

let condition = 'clear';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname.startsWith('/api/')) {
    const body = pathname === '/api/weather' ? payload(condition)
      : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    return;
  }
  if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
  let file = null; let buf = null;
  try { file = path.resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1)); buf = readFileSync(file); }
  catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const failures = [];
let anchored = 0; let defaulted = 0;
console.log('condition  hr  image the app landed on                       table  painted');
for (const run of RUNS) {
  condition = run.condition;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${DATE}T${String(run.hour).padStart(2, '0')}:12:00+02:00`) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
    } catch (_) {}
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const s = document.getElementById('pwSplash');
    return !s || s.classList.contains('splash-done');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(1800);
  const seen = await page.evaluate(() => ({
    src: document.getElementById('bgImg')?.getAttribute('src') || '',
    prop: document.documentElement.style.getPropertyValue('--hero-crop').trim(),
    pos: getComputedStyle(document.getElementById('heroPhoto')).backgroundPosition,
  }));
  await ctx.close();

  const { key, expect } = expectedFor(seen.src);
  const posY = seen.pos.split(' ')[1] || '';
  const ok = posY === `${expect}%`;
  if (!ok) failures.push(`${run.condition}: landed on ${key}, table says ${expect}%, painted ${posY || '(none)'}`);
  if (expect === CSS_DEFAULT) defaulted += 1; else anchored += 1;
  const shortKey = (key || '(none)').replace('bg-canonical/', 'canonical:').slice(0, 44);
  console.log(`${run.condition.padEnd(10)} ${String(run.hour).padStart(2)}  ${shortKey.padEnd(46)} ${String(expect).padStart(3)}%  ${posY || '—'}${ok ? '' : '   <-- MISMATCH'}`);
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n[crop-live] ${failures.length} FAILURES:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
if (!anchored || !defaulted) {
  console.error(`\n[crop-live] INCONCLUSIVE — ${anchored} anchored and ${defaulted} un-anchored images seen; the run needs at least one of each to prove the table is consulted rather than a constant applied.`);
  process.exit(1);
}
console.log(`\n[crop-live] PASS — ${RUNS.length} loads: ${anchored} landed on a ruled image and painted its anchor, ${defaulted} landed on an un-ruled one and painted the ${CSS_DEFAULT}% default.`);
