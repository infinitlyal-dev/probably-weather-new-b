// THE WASH'S ADVERSARIAL GATE — does the lit room hurt the data?
//
// Al's condition for keeping vibrancy iterations 1-4: "the wash layers behind
// data screens — contrast on Hourly rows must stay measured and passing."
//
// So this measures it, on the rendered pixels, rather than reasoning about
// alpha values: for each Hourly row it samples the ACTUAL painted background
// inside the row (median of a text-free patch) and computes the contrast ratio
// against the two inks that sit on it — --ink #fffaf3 (values) and --ink-2
// #b5ab9d (secondary). Run with and without the wash, on the brightest scene
// (sunny, whose wash is the palest) and the storm one.
//
// PASS: every row clears 4.5:1 for the primary ink and 4.5:1 for the secondary
// ink, and no row loses more than 0.5:1 against the same row without the wash.
//
//   node scripts/verify-wash-contrast.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-08';
const WASH = readFileSync(path.join(root, 'output', 'vibrancy', 'cumulative-4.css'), 'utf8');

const INK = '#fffaf3';
const INK_2 = '#b5ab9d';
const MIN_RATIO = 4.5;
const MAX_LOSS = 0.5;

const SCENES = {
  sunny: { slot: 'clear/week_1/day/1.webp', p: { tempC: 29, low: 18, high: 31, rain: 0, cloud: 5, uv: 9, wind: 12, key: 'clear', label: 'Clear', hour: 13 } },
  storm: { slot: 'storm/week_1/day/3.webp', p: { tempC: 14, low: 11, high: 17, rain: 92, cloud: 98, uv: 1, wind: 46, key: 'storm', label: 'Storm', hour: 15 } },
};

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lumRgb = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const lumHex = (hex) => { const n = parseInt(hex.slice(1), 16); return lumRgb((n >> 16) & 255, (n >> 8) & 255, n & 255); };
const ratio = (l1, l2) => { const [a, b] = [l1, l2].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };

function canonicalUrl(slot) {
  const file = path.join(root, 'assets', 'images', 'bg', slot);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(file)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${url} — run npm run build`);
  return url;
}

function payloadFor(s) {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: s.tempC - (i % 5), feelsLikeC: s.tempC - 3, rainChance: Math.max(0, s.rain - (i % 6) * 9),
    precipMm: s.rain > 50 ? 1.4 : 0, windKph: s.wind - (i % 7), windDir: 205, cloudPct: s.cloud,
    humidity: 70, uv: s.uv, condition: s.key,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: s.high, lowC: s.low, rainChance: s.rain, uv: s.uv, windKph: s.wind,
    conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: s.tempC, feelsLikeC: s.tempC - 3, uv: s.uv, isDay: true, windKph: s.wind, rainChance: s.rain,
      cloudPct: s.cloud, conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: s.wind, maxWindKph: s.wind + 20, gustKph: s.wind + 20, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: s.hour, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: s.key, sourceAgreement: '5/5' } },
  };
}

let current = SCENES.sunny;
function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payloadFor(current.p)
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
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

// The median of a patch, so one antialiased glyph edge inside the sample cannot
// move the answer — the background is by definition the most common colour in a
// mostly-empty patch.
function medianPatch(data, info, x, y, w, h) {
  const px = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const i = ((y + dy) * info.width + (x + dx)) * info.channels;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  px.sort((a, b) => lumRgb(...a) - lumRgb(...b));
  return px[Math.floor(px.length / 2)];
}

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const table = [];

for (const [name, scene] of Object.entries(SCENES)) {
  current = scene;
  const heroUrl = canonicalUrl(scene.slot);
  const measured = {};
  for (const withWash of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T${String(scene.p.hour).padStart(2, '0')}:12:00+02:00`) });
    await page.addInitScript((u) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
        localStorage.setItem('pw_last_bg', u);
      } catch (_) {}
    }, heroUrl);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    if (withWash) {
      await page.evaluate(({ css, url }) => {
        const s = document.createElement('style');
        s.textContent = `html { --hero-url: url("${url}") !important; }\n${css}`;
        document.body.appendChild(s);
      }, { css: WASH, url: heroUrl });
    } else {
      await page.evaluate((url) => {
        const s = document.createElement('style');
        s.textContent = `html { --hero-url: url("${url}") !important; }`;
        document.body.appendChild(s);
      }, heroUrl);
    }
    await page.click('#homeHourly');
    await page.waitForTimeout(900);
    // Freeze the rain so a particle cannot drift into a sample patch.
    await page.evaluate(() => { document.getAnimations?.().forEach((a) => { try { a.pause(); } catch (_) {} }); });
    // The rows AND the two things that actually sit on the lit part of the
    // panel: the voice line under the title, and the chart card's caption. If
    // the wash costs contrast anywhere, it is up there, not down in the table —
    // measuring only the rows would be measuring the safe half.
    const boxes = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#hourly-timeline .hourly-row:not(.hourly-header)')]
        .slice(0, 6)
        .map((el) => { const r = el.getBoundingClientRect(); return { label: 'row', top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
      const extra = [];
      const sub = document.getElementById('hourlySubtitle');
      if (sub) { const r = sub.getBoundingClientRect(); extra.push({ label: 'voice-line', top: r.top, bottom: r.bottom, left: r.left, right: r.right }); }
      const chart = document.getElementById('hourlyChart');
      if (chart) { const r = chart.getBoundingClientRect(); extra.push({ label: 'chart-card', top: r.top, bottom: r.top + 26, left: r.left, right: r.right }); }
      return [...extra, ...rows].filter((r) => r.top > 0 && r.bottom < 844);
    });
    const buf = await page.screenshot();
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    measured[withWash ? 'wash' : 'plain'] = boxes.map((b, i) => {
      // A text-free strip: inside the box, just left of its right padding.
      const x = Math.round(b.right - 14);
      const y = Math.round(b.top + (b.bottom - b.top) / 2 - 3);
      const [r, g, bl] = medianPatch(data, info, x, y, 8, 6);
      return { row: i, label: b.label, rgb: [r, g, bl], lum: lumRgb(r, g, bl) };
    });
    await ctx.close();
  }

  measured.wash.forEach((w, i) => {
    const p = measured.plain[i];
    if (!p) return;
    // The voice line and the section labels are painted in --paper-ink, cream at
    // 74% — an ALPHA ink, so its effective colour depends on what is behind it.
    // Composite it over the measured background rather than scoring the cream.
    const overBg = (bg) => {
      const cream = [246, 242, 232];
      return lumRgb(...cream.map((c, k) => 0.74 * c + 0.26 * bg[k]));
    };
    const isPaperInk = w.label !== 'row';
    const inkLum = isPaperInk ? overBg(w.rgb) : lumHex(INK);
    const inkLumPlain = isPaperInk ? overBg(p.rgb) : lumHex(INK);
    const rWash = ratio(inkLum, w.lum);
    const rPlain = ratio(inkLumPlain, p.lum);
    const r2Wash = ratio(lumHex(INK_2), w.lum);
    const r2Plain = ratio(lumHex(INK_2), p.lum);
    table.push({ scene: name, label: w.label === 'row' ? `row ${i}` : w.label, rWash, rPlain, r2Wash, r2Plain, rgb: w.rgb });
    if (rWash < MIN_RATIO) failures.push(`[${name} ${w.label}] primary ink ${rWash.toFixed(2)}:1 < ${MIN_RATIO}`);
    if (r2Wash < MIN_RATIO) failures.push(`[${name} ${w.label}] secondary ink ${r2Wash.toFixed(2)}:1 < ${MIN_RATIO}`);
    if (rPlain - rWash > MAX_LOSS) failures.push(`[${name} ${w.label}] the wash costs ${(rPlain - rWash).toFixed(2)}:1 of contrast`);
  });
}

await browser.close();
server.close();

console.log('scene  surface      measured bg        its own ink        --ink-2 on it');
for (const t of table) {
  console.log(
    `${t.scene.padEnd(6)} ${t.label.padEnd(12)} rgb(${t.rgb.join(',').padEnd(11)})  `
    + `${t.rWash.toFixed(2)}:1 (was ${t.rPlain.toFixed(2)})  ${t.r2Wash.toFixed(2)}:1 (was ${t.r2Plain.toFixed(2)})`,
  );
}

if (failures.length) {
  console.error(`\n[wash contrast] ${failures.length} FAILURES:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n[wash contrast] PASS — ${table.length} rows across 2 scenes: every row clears ${MIN_RATIO}:1 on both inks, and none loses more than ${MAX_LOSS}:1 to the wash.`);
