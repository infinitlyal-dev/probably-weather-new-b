// Check each pilot pair on today's Home and on Home D (Al's brief, 2026-09-25): does the joke sit on
// the photo's subject? Shots at Al's size (414x715) and a smaller phone (360x688), EN and AF.
//
// TODAY'S HOME, end to end on a real build of main: the clock is set to the week, weekday and hour of
// the pair's slot and the place to one where its line may show, the API returns a payload of the pair's
// weather, and the app itself picks the photograph and the line. The shot records which photograph the
// app chose (content hash) and which line it wrote, so a wiring fault shows up as a wrong pick.
//
// HOME D lives only on design/home-options, so its build has none of the pairs: the pair's photograph,
// crop anchor and line are set in place, the way review/eval/photo-check/d-cover-measure.mjs measured
// every photograph on 2026-09-24 (D's own fitter and rise rule then run before the joke's box is read).
//
//   node scripts/pairs-home-check.mjs --today dist --d <design-branch dist> --payload <live-strand.json>
//        --pairs <folder with P01.jpg..> --out <folder> [--plan <file in review/>] [--only P01,M02]
// A pair on hold (Al ruled its photo out; review/pilot-pairs.json `hold`, `standIn`) is checked against its
// stand-in: the app must pick the stand-in's photograph and write one of that photograph's own lines.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const TODAY_DIST = path.resolve(root, arg('--today') || 'dist');
const D_DIST = arg('--d');
const OUT = arg('--out');
const PAIRS_DIR = arg('--pairs');
const LIVE = JSON.parse(readFileSync(arg('--payload'), 'utf8'));
mkdirSync(OUT, { recursive: true });
const plan = JSON.parse(readFileSync(path.join(root, 'review', arg('--plan') || 'pilot-pairs.json'), 'utf8'));
if (arg('--only')) plan.pairs = plan.pairs.filter((p) => arg('--only').split(',').includes(p.id));
const finalSet = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-lines-bespoke-final.json'), 'utf8')).set;
const linesOf = (hash) => (finalSet.find((x) => x.hash === hash) || {}).lines || [];
const { heroLineAf } = await import('../assets/hero-lines-af.js');

const WEEK_ANCHOR = Date.UTC(2026, 4, 24, 22, 0);          // Mon 25 May 2026 00:00 SAST (assets/image-picker.js)
const DAY = 86400000;
const HOUR = { dawn: 6, day: 12, dusk: 18.25, night: 22 };   // inside the app's solar windows for sunrise 06:00, sunset 18:30 (getTimeOfDay)
const PLACE = {
  'western-cape': { lat: -34.1163, lon: 18.8362, name: 'Strand' },
  kzn: { lat: -29.6006, lon: 30.3794, name: 'Pietermaritzburg' },
  karoo: { lat: -32.3567, lon: 22.583, name: 'Beaufort West' },
};
const WEATHER = {
  clear: { cond: 'clear', temp: 24, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 10, uv: 7 } },
  heat: { cond: 'heat', temp: 36, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 8, uv: 10 } },
  wind: { cond: 'wind', temp: 18, extra: { rainChance: 5, precipMm: 0, cloudPct: 30, windKph: 42 } },
  rain: { cond: 'rain', temp: 14, extra: { rainChance: 95, precipMm: 4, cloudPct: 100, windKph: 20 } },
  cloudy: { cond: 'rain-possible', temp: 20, extra: { rainChance: 45, precipMm: 0, cloudPct: 90, windKph: 12 } },
  storm: { cond: 'storm', temp: 16, extra: { rainChance: 95, precipMm: 8, cloudPct: 100, windKph: 30 } },
  fog: { cond: 'fog', temp: 11, extra: { rainChance: 10, precipMm: 0, cloudPct: 100, windKph: 4, humidity: 99 } },
  cold: { cond: 'cold', temp: 8, extra: { rainChance: 20, precipMm: 0, cloudPct: 80, windKph: 10 } },
  'cold-clear': { cond: 'cold-clear', temp: 2, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 6 } },
};
const slotOf = (rel) => { const [folder, week, time, file] = rel.split('/'); return { folder, week: Number(week.slice(5)), time, n: Number(file.replace('.webp', '')) }; };

function payloadFor(p, nowMs, place) {
  const f = WEATHER[p.condition];
  const b = structuredClone(LIVE);
  const day = new Date(nowMs + 2 * 3600000).toISOString().slice(0, 10);
  const isDay = p.time === 'day' || p.time === 'dawn';
  Object.assign(b.now, { tempC: f.temp, feelsLikeC: f.temp - 1, humidity: f.extra.humidity || 70, conditionKey: f.cond, conditionLabel: f.cond, isDay, windDir: 200, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }, f.extra);
  const rainy = f.cond === 'rain' || f.cond === 'storm';
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: f.cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: rainy ? 4 : 0, precipMm: f.extra.precipMm } };
  if (f.cond === 'rain') b.now.conditionReason = 'rain-now';
  b.daily = b.daily.map((d, i) => ({ ...d, date: i === 0 ? day : d.date, highC: f.temp + 3 - (i % 2), lowC: f.temp - 6 + (i % 3), rainChance: f.extra.rainChance, conditionKey: f.cond, conditionLabel: f.cond, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.hourly = b.hourly.map((x) => ({ ...x, tempC: f.temp, rainChance: f.extra.rainChance, precipMm: f.extra.precipMm / 3, windKph: f.extra.windKph, condition: f.cond }));
  b.wind_kph = f.extra.windKph; b.gustKph = Math.round(f.extra.windKph * 1.4); b.maxWindKph = b.gustKph;
  b.location = { ...b.location, name: place.name, lat: place.lat, lon: place.lon };
  const hour = Math.floor(HOUR[p.time]);
  b.meta = { ...b.meta, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: f.cond, sourceAgreement: '4/5' } };
  return b;
}

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function serve(dist) {
  const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
    if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true,"results":[]}');
    if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
    if (p.startsWith('/pairs/')) { try { return res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(readFileSync(path.join(PAIRS_DIR, path.basename(p)))); } catch { return res.writeHead(404).end(); } }
    const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
    let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await webkit.launch();
const SIZES = [[414, 715], [360, 688]];
const results = [];

async function shoot(page, file, box) {
  const png = await page.screenshot();
  const meta = await sharp(png).metadata();
  const k = meta.width / page.viewportSize().width;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><rect x="4" y="${Math.round(box.textTop * k)}" width="${meta.width - 8}" height="${Math.round((box.textBottom - box.textTop) * k)}" fill="none" stroke="#00ff88" stroke-width="4"/></svg>`;
  await sharp(png).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 78 }).toFile(file);
}

// ---- today's Home, end to end
{
  const server = await serve(TODAY_DIST);
  const base = `http://127.0.0.1:${server.address().port}/`;
  for (const p of plan.pairs) {
    const s = slotOf(p.slots[0]);
    const nowMs = WEEK_ANCHOR + ((s.week - 1) + 20) * 7 * DAY + (s.n - 1) * DAY + HOUR[p.time] * 3600000;
    const place = PLACE[p.region || 'western-cape'];
    const sha256 = createHash('sha256').update(readFileSync(path.join(root, 'assets', 'images', 'bg', ...p.slots[0].split('/')))).digest('hex');
    current = payloadFor(p, nowMs, place);
    for (const lang of ['en', 'af']) for (const [vw, vh] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: place.lat, longitude: place.lon }, permissions: ['geolocation'], serviceWorkers: 'block' });
      await ctx.addInitScript(({ l, pl }) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: pl.lat, lon: pl.lon, name: pl.name })); } catch {} }, { l: lang, pl: place });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(nowMs));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
      await page.waitForTimeout(2500);
      const got = await page.evaluate(() => {
        const h = document.getElementById('headline');
        const cs = getComputedStyle(h), box = h.getBoundingClientRect();
        const img = document.getElementById('bgImg');
        const photo = document.getElementById('heroPhoto')?.getBoundingClientRect();
        return { line: h.textContent.trim(), src: img?.currentSrc || img?.src || '', textTop: Math.round(box.top + parseFloat(cs.paddingTop)), textBottom: Math.round(box.bottom - parseFloat(cs.paddingBottom)), photoTop: photo ? Math.round(photo.top) : null, photoBottom: photo ? Math.round(photo.bottom) : null };
      });
      const tr = (l) => (lang === 'en' ? l : heroLineAf(l));
      const wants = p.hold ? linesOf(p.standIn.hash).map(tr) : [tr(p.line)];
      const file = path.join(OUT, `today-${p.id}-${lang}-${vw}x${vh}.jpg`);
      await shoot(page, file, got);
      results.push({ home: 'today', id: p.id, lang, size: `${vw}x${vh}`, pickedPairPhoto: got.src.includes(sha256.slice(0, 16)) || got.src.includes(p.slots[0]), wroteItsLine: wants.includes(got.line), standIn: p.hold ? p.standIn.hash : undefined, line: got.line, box: [got.textTop, got.textBottom], photo: [got.photoTop, got.photoBottom], shot: path.basename(file) });
      await ctx.close();
    }
  }
  server.close();
}

// ---- Home D, in place
if (D_DIST) {
  const server = await serve(D_DIST);
  const base = `http://127.0.0.1:${server.address().port}/?home=d`;
  const t0 = Date.UTC(2026, 9, 7, 10, 0);
  for (const p of plan.pairs) {
    current = payloadFor(p, t0, PLACE['western-cape']);
    for (const lang of ['en', 'af']) for (const [vw, vh] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
      await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} }, lang);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(t0));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.body.classList.contains('home-d'), null, { timeout: 20000 });
      await page.waitForTimeout(1500);
      const line = lang === 'en' ? p.line : heroLineAf(p.line);
      const got = await page.evaluate(async ({ id, anchor, line }) => {
        const src = `/pairs/${id}.jpg`;
        const pre = new Image(); pre.src = src; await pre.decode();
        const r = document.documentElement;
        r.style.setProperty('--hero-url', `url("${src}")`);
        r.style.setProperty('--hero-crop', `${anchor}%`);
        const img = document.getElementById('bgImg');
        img.src = src;
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => 1008 });
        Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => 1792 });
        const h = document.getElementById('headline');
        h.textContent = line;
        await new Promise((res) => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : res()); step(8); });
        const cs = getComputedStyle(h), box = h.getBoundingClientRect();
        return { textTop: Math.round(box.top + parseFloat(cs.paddingTop)), textBottom: Math.round(box.bottom - parseFloat(cs.paddingBottom)), risen: document.body.classList.contains('d-joke-high') };
      }, { id: p.id, anchor: p.anchorY, line });
      await page.waitForTimeout(300);
      const file = path.join(OUT, `d-${p.id}-${lang}-${vw}x${vh}.jpg`);
      await shoot(page, file, got);
      results.push({ home: 'D', id: p.id, lang, size: `${vw}x${vh}`, line, box: [got.textTop, got.textBottom], risen: got.risen, shot: path.basename(file) });
      await ctx.close();
    }
  }
  server.close();
}
await browser.close();
writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
const today = results.filter((r) => r.home === 'today');
console.log(`[pairs-home] today's Home: ${today.filter((r) => r.pickedPairPhoto).length}/${today.length} picked the pair's photo, ${today.filter((r) => r.wroteItsLine).length}/${today.length} wrote its line; D: ${results.filter((r) => r.home === 'D').length} shots. ${OUT}`);
for (const r of today.filter((x) => !x.pickedPairPhoto || !x.wroteItsLine)) console.log(`  ${r.id} ${r.lang} ${r.size}: photo ${r.pickedPairPhoto ? 'ok' : 'NOT the pair'}; line "${r.line}"`);
