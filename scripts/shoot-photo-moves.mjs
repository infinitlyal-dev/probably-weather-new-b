// BEFORE / AFTER SHOTS OF THE MOVED PHOTOGRAPHS (2026-09-23), through the REAL picker.
//
// No CSS override: the clock is pinned to the weekday, rotation week and time of day of
// the slot, the weather payload says the bucket's condition, and the app picks the
// photograph, its crop and its line itself. Each frame records the photograph the page
// landed on (the sha256 in the canonical URL) and the caption, so the shots are also a
// check: after a move, the new slot must land on the moved photograph and one of its
// lines; the old slot must land on its fallback.
//
// Weeks are counted from Monday 25 May 2026 (image-picker.js getRotationWeek), so the
// week of Monday 21 September 2026 is week 2 and the next one week 3.
//
//   node scripts/shoot-photo-moves.mjs --base https://www.probablyweather.co.za --label before
//   node scripts/shoot-photo-moves.mjs --label after            (serves dist/ locally)
// Output: output/photo-moves/<label>/ + <label>.json
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const LABEL = val('--label') || 'after';
const out = path.join(root, 'output', 'photo-moves', LABEL);
mkdirSync(out, { recursive: true });
const bucket = JSON.parse(readFileSync(path.join(root, 'review', 'bucket-check-ruled.json'), 'utf8'));
const bench = JSON.parse(readFileSync(path.join(root, 'review', 'benched-photos.json'), 'utf8')).benched;
const sha256Of = (rel) => createHash('sha256').update(readFileSync(path.join(root, 'assets', 'images', 'bg', ...rel.split('/')))).digest('hex');

const WEEK2_MONDAY = { y: 2026, m: 9, d: 21 };   // rotation week 2
const dateFor = (week, weekday) => {             // weeks 2 and 4 -> 21 Sep; weeks 1 and 3 -> 28 Sep (week 3)
  const offset = (week === 1 || week === 3 ? 7 : 0) + (weekday - 1);
  const dt = new Date(Date.UTC(WEEK2_MONDAY.y, WEEK2_MONDAY.m - 1, WEEK2_MONDAY.d + offset));
  return dt.toISOString().slice(0, 10);
};
const CLOCK = { dawn: '06:05', day: '12:30', dusk: '18:05', night: '22:10' };   // sunrise 06:20, sunset 18:20
const WEATHER = {
  cold: { temp: 8, hi: 12, lo: 5, rain: 10, cloud: 60, uv: 1, wind: 12 },
  'cold-clear': { temp: 6, hi: 14, lo: 1, rain: 0, cloud: 5, uv: 4, wind: 8 },
  rain: { temp: 13, hi: 15, lo: 10, rain: 88, cloud: 96, uv: 1, wind: 18, mm: 2.4 },
  cloudy: { temp: 17, hi: 20, lo: 13, rain: 10, cloud: 90, uv: 2, wind: 12 },
};
const LABELS = { cold: 'Cold.', 'cold-clear': 'Cold and clear.', rain: "Rain's here.", cloudy: 'Cloudy.' };

// The frames: every moved photograph's new slot (week 2) and old slot.
const frames = [];
for (const r of bucket.rows.filter((x) => x.verdict === 'MOVE')) {
  const b = bench.find((x) => x.sha1 === r.sha1);
  const [, , time, file] = r.slots[0].split('/');
  const weekday = Number(file.replace('.webp', ''));
  const oldWeek = Number(r.slots[0].split('/')[1].slice(5));
  // Before the push nothing is asserted (the dog was already benched on production); after
  // it, the old slot must land on its fallback and the new slot on the moved photograph.
  frames.push({ n: r.n, sha1: r.sha1, role: 'old', condition: r.bucket, slot: r.slots[0], time, weekday, week: oldWeek, expect: LABEL === 'after' ? { photo: sha256Of(b.fallback), fallback: b.fallback } : { photo: null } });
  if (b.movedTo) frames.push({ n: r.n, sha1: r.sha1, role: 'new', condition: r.moveTo, slot: b.movedTo[0], time, weekday, week: 2, expect: LABEL === 'after' ? { photo: sha256Of(r.slots[0]) } : { photo: null } });
}

let current = null;
function payload() {
  const { condition, time, date } = current;
  const w = WEATHER[condition];
  const night = time === 'night';
  const hourly = Array.from({ length: 48 }, (_, i) => ({ tempC: w.temp - (i % 3), feelsLikeC: w.temp - 3, rainChance: w.rain, precipMm: w.mm || 0,
    windKph: w.wind, windDir: 150, cloudPct: w.cloud, humidity: 75, uv: w.uv, condition }));
  const daily = Array.from({ length: 7 }, () => ({ highC: w.hi, lowC: w.lo, rainChance: w.rain, uv: w.uv, windKph: w.wind, conditionKey: condition,
    conditionLabel: LABELS[condition], sunrise: `${date}T06:20`, sunset: `${date}T18:20` }));
  return {
    ok: true, location: { name: 'Strand, Western Cape', lat: -34.1163, lon: 18.8362 },
    now: { tempC: w.temp, feelsLikeC: w.temp - 3, uv: w.uv, isDay: !night, windKph: w.wind, rainChance: w.rain, precipMm: w.mm || 0,
      cloudPct: w.cloud, conditionKey: condition, conditionLabel: LABELS[condition], conditionReason: condition === 'rain' ? 'rain-now' : undefined,
      sunrise: `${date}T06:20`, sunset: `${date}T18:20` },
    hourly, daily, wind_kph: w.wind, maxWindKph: w.wind + 8, gustKph: w.wind + 8, windDir: 150, consensus: { confidenceKey: 'decent' },
    meta: { schema: 5, localHour: Number(CLOCK[time].slice(0, 2)), utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: condition, sourceAgreement: '5/5' }, conditionReason: condition === 'rain' ? 'rain-now' : undefined },
  };
}

// Local: serve dist/ with the fake API. Live: the real site, API intercepted.
let base = val('--base');
let server = null;
if (!base) {
  const dist = path.join(root, 'dist');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pn.startsWith('/_vercel/')) return res.writeHead(204).end();
    const f = path.resolve(dist, pn === '/' ? 'index.html' : pn.slice(1));
    let buf;
    try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
    return res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}
const browser = await chromium.launch();
const results = [];
for (const f of frames) {
  const date = dateFor(f.week, f.weekday);
  current = { condition: f.condition, time: f.time, date };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route('**/api/weather**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload()) }));
  await page.route('**/api/locate**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lat: -34.1163, lon: 18.8362, name: 'Strand, Western Cape' }) }));
  await page.clock.install({ time: new Date(`${date}T${CLOCK[f.time]}:00+02:00`) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.1163, lon: 18.8362, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      localStorage.setItem('lang', JSON.stringify('en'));
    } catch (_) {}
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 25000 });
  await page.waitForTimeout(1800);
  const seen = await page.evaluate(() => ({
    src: document.getElementById('bgImg')?.getAttribute('src') || '',
    line: (document.getElementById('headline')?.textContent || '').trim(),
    condition: (document.querySelector('.hero-condition, #conditionLine, .condition-line')?.textContent || '').trim(),
  }));
  const hash = (seen.src.match(/bg-canonical\/([0-9a-f]{64})\.webp/) || [])[1] || null;
  const file = `${String(f.n).padStart(3, '0')}-${f.role}-${f.condition}-${f.time}-w${f.week}-d${f.weekday}.png`;
  await page.screenshot({ path: path.join(out, file) });
  await ctx.close();
  const ok = f.expect.photo == null ? true : hash === f.expect.photo;
  results.push({ ...f, date, clock: CLOCK[f.time], landed: hash, src: seen.src, line: seen.line, ok, file });
  console.log(`${ok ? 'OK ' : 'BAD'} #${f.n} ${f.role.padEnd(3)} ${f.condition.padEnd(10)} ${f.time.padEnd(5)} w${f.week} d${f.weekday} ${date} ${CLOCK[f.time]} → ${hash ? hash.slice(0, 12) : seen.src} "${seen.line}"`);
}
await browser.close();
if (server) server.close();
writeFileSync(path.join(root, 'output', 'photo-moves', `${LABEL}.json`), JSON.stringify({ base, label: LABEL, results }, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`[photo-moves] ${results.length} frames → output/photo-moves/${LABEL}/ (${bad.length} not on the expected photograph)`);
process.exit(bad.length ? 1 : 0);
