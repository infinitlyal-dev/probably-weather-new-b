// M8 — Home fits above the fold on the REAL device range.
//
// The 390x844-only guarantee is retired (Al's ruling, after a third recurrence
// on his own phone: stats pill and Hourly CTA clipped under the nav). This gate
// asserts the whole matrix and fails if ANY viewport clips.
//
// What "fits" means here, stated so it cannot drift:
//   1. The page does not scroll.               (scrollHeight <= innerHeight + 1)
//   2. Nothing overlaps the nav.               (every home element's bottom <= nav top)
//   3. Nothing is off the bottom of the screen.(every home element's bottom <= innerHeight)
//   4. Every element that should be visible IS.(non-zero box, and the count is pinned)
//
// Checked at both caption heights (one line and the longest real AF line) in EN
// and AF, because the witty line is the one element whose height is copy-driven
// and the AF pool is the longest of the five.
//
//   node scripts/verify-home-fold.mjs          -> assert the matrix
//   node scripts/verify-home-fold.mjs --shots  -> also write screenshots
//
// Output: output/m8-fold/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-08';
const SHOTS = process.argv.includes('--shots');

// Design-pass hook. Unset in every normal run, so the standing gate is byte-for-
// byte the same matrix it was: with PW_FOLD_CSS pointing at a stylesheet the gate
// asserts the SAME 64 combinations with that stylesheet layered on, which is how
// a candidate hero treatment earns the right to be looked at. PW_FOLD_LABEL keeps
// each candidate's fold.json beside the baseline instead of on top of it.
const EXTRA_CSS = process.env.PW_FOLD_CSS ? readFileSync(process.env.PW_FOLD_CSS, 'utf8') : null;
const LABEL = process.env.PW_FOLD_LABEL || '';
const output = path.join(root, 'output', LABEL ? `m8-fold-${LABEL}` : 'm8-fold');

// The real-device range, not one lucky phone. The last entry is Al's own device
// class, which is what caught this — a viewport nothing in the matrix covered.
// Device heights AND the height a browser actually leaves after its own chrome.
// The URL bar eats ~14% on both Safari and Chrome, so a matrix built only from
// spec sheets is measuring a screen no user has: 390x844 is the device, 390x734
// is what Safari shows. That gap is a large part of why this shipped broken.
const VIEWPORTS = [
  { w: 320, h: 568, name: 'iPhone SE 1st' },
  { w: 320, h: 488, name: 'iPhone SE 1st + chrome' },
  { w: 360, h: 640, name: 'Android small' },
  { w: 360, h: 550, name: 'Android small + chrome' },
  { w: 360, h: 800, name: 'Android common' },
  { w: 360, h: 688, name: 'Android common + chrome' },
  { w: 375, h: 667, name: 'iPhone SE 2/3' },
  { w: 375, h: 574, name: 'iPhone SE 2/3 + chrome' },
  { w: 390, h: 844, name: 'iPhone 14' },
  { w: 390, h: 734, name: 'iPhone 14 + chrome' },
  { w: 412, h: 915, name: 'Pixel 7' },
  { w: 412, h: 780, name: 'Pixel 7 + chrome' },
  { w: 428, h: 926, name: 'iPhone 14 Plus' },
  { w: 428, h: 796, name: 'iPhone 14 Plus + chrome' },
  { w: 739, h: 1600, name: "Al's device class" },
  { w: 739, h: 850, name: "Al's device class + chrome" },
];

// The longest real witty lines, one per language, plus a deliberately short one.
// A layout that only fits the short line is not a layout that fits.
const CAPTIONS = {
  short: { label: 'one line', en: 'Probably fine.', af: 'Waarskynlik reg.' },
  long: { label: 'longest', en: null, af: null }, // filled from the copy bank below
};

function longestFromBank(lang) {
  const file = path.join(root, 'assets', 'copy', `${lang}.js`);
  const src = readFileSync(file, 'utf8');
  const json = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  let bank;
  try { bank = JSON.parse(json); } catch { return null; }
  const lines = [];
  const walk = (node) => {
    if (typeof node === 'string') { lines.push(node); return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(bank.witty || {});
  return lines.sort((a, b) => b.length - a.length)[0] || null;
}
CAPTIONS.long.en = longestFromBank('en');
CAPTIONS.long.af = longestFromBank('af');

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 11, rainChance: (i % 7) * 12, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 60, humidity: 74, uv: 7, condition: 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 17, lowC: 11, rainChance: 40, uv: 7, windKph: 30,
    conditionKey: 'cloudy', conditionLabel: 'Cloudy',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    // A long place name: the header is part of the budget too.
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: -1, feelsLikeC: -4, uv: 7, isDay: true, windKph: 46, rainChance: 48,
      cloudPct: 60, conditionKey: 'cloudy', conditionLabel: 'Cloudy',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: 46, maxWindKph: 62, gustKph: 62, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'cloudy', sourceAgreement: '3/5' },
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

// Everything Home must show. Named, so "it fits" can never be achieved by an
// element quietly not rendering — the count is asserted alongside the geometry.
const REQUIRED = [
  ['#logoCircle', 'brand mark'],
  ['.brand-title', 'brand title'],
  ['#location', 'place name'],
  ['#languageBtn', 'language chip'],
  ['#heroCard', 'hero card'],
  ['#headline', 'witty caption'],
  ['#temp', 'temperature block'],
  ['#description', 'condition line'],
  ['#agreeLine', 'source agreement'],
  ['#statsRow', 'stats pill'],
  ['#homeHourly', 'Hourly CTA'],
  ['.nav', 'bottom nav'],
];

const MEASURE = (required) => {
  const navEl = document.querySelector('.nav');
  const nav = navEl.getBoundingClientRect();
  const vh = window.innerHeight;
  const out = { vh, navTop: nav.top, elements: [], missing: [] };
  for (const [sel, label] of required) {
    const el = document.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    if (!el || !r || r.width === 0 || r.height === 0) { out.missing.push(`${label} (${sel})`); continue; }
    out.elements.push({ sel, label, top: r.top, bottom: r.bottom, height: r.height });
  }
  out.scrollHeight = document.documentElement.scrollHeight;
  out.maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
  out.captionLines = (() => {
    const h = document.getElementById('headline');
    if (!h) return 0;
    const lh = parseFloat(getComputedStyle(h).lineHeight);
    return Number.isFinite(lh) && lh > 0 ? Math.round(h.getBoundingClientRect().height / lh) : 0;
  })();
  out.heroHeight = document.getElementById('heroPhoto')?.getBoundingClientRect().height ?? 0;
  out.tempFontPx = parseFloat(getComputedStyle(document.getElementById('temp')).fontSize);
  return out;
};

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

const failures = [];
const rows = [];

for (const vp of VIEWPORTS) {
  for (const lang of ['en', 'af']) {
    for (const [key, caption] of Object.entries(CAPTIONS)) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2,
        isMobile: true, hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
      await page.addInitScript((l) => {
        try {
          localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
          localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
          localStorage.setItem('pw_lang', JSON.stringify(l));
        } catch (_) {}
      }, lang);
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const s = document.getElementById('pwSplash');
        return !s || s.classList.contains('splash-done');
      }, null, { timeout: 20000 });
      // Appended to the END of <body>, not the head: index.html links app.css
      // from the body, so a head-injected sheet loses every equal-specificity
      // contest and the candidate silently does nothing.
      if (EXTRA_CSS) {
        await page.evaluate((css) => {
          const s = document.createElement('style');
          s.textContent = css;
          document.body.appendChild(s);
        }, EXTRA_CSS);
      }
      await page.waitForTimeout(700);

      // Pin the caption so the two heights are deterministic rather than
      // whatever the random witty pick happened to be.
      const text = caption[lang];
      if (text) {
        await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, text);
        await page.waitForTimeout(250);
      }

      const m = await page.evaluate(MEASURE, REQUIRED);
      const label = `${vp.w}x${vp.h} ${lang} ${caption.label}`;

      if (m.missing.length) failures.push(`[${label}] MISSING: ${m.missing.join(', ')}`);
      if (m.maxScroll > 1) failures.push(`[${label}] page scrolls ${m.maxScroll.toFixed(0)}px — Home must fit`);
      for (const el of m.elements) {
        if (el.sel === '.nav') continue;
        if (el.bottom > m.navTop + 0.5) {
          failures.push(`[${label}] ${el.label} runs ${(el.bottom - m.navTop).toFixed(0)}px UNDER THE NAV`);
        } else if (el.bottom > m.vh + 0.5) {
          failures.push(`[${label}] ${el.label} is ${(el.bottom - m.vh).toFixed(0)}px off the bottom`);
        }
      }

      const worst = m.elements.filter((e) => e.sel !== '.nav')
        .reduce((a, b) => (b.bottom > a.bottom ? b : a), { bottom: -Infinity, label: '-' });
      rows.push({
        viewport: `${vp.w}x${vp.h}`, device: vp.name, lang, caption: caption.label,
        captionLines: m.captionLines, heroPx: Math.round(m.heroHeight), tempPx: Math.round(m.tempFontPx),
        headroomPx: Math.round(m.navTop - worst.bottom), lowest: worst.label, maxScroll: Math.round(m.maxScroll),
      });

      if (SHOTS && key === 'long') {
        await page.screenshot({ path: path.join(output, `fold-${vp.w}x${vp.h}-${lang}.png`) });
      }
      await ctx.close();
    }
  }
}

await browser.close();
server.close();

console.log('viewport    device               lang cap      lines hero temp headroom  lowest element');
for (const r of rows) {
  const flag = r.headroomPx < 0 || r.maxScroll > 1 ? ' <-- CLIPS' : '';
  console.log(
    `${r.viewport.padEnd(11)} ${r.device.padEnd(20)} ${r.lang}   ${r.caption.padEnd(8)} ${String(r.captionLines).padStart(5)} `
    + `${String(r.heroPx).padStart(4)} ${String(r.tempPx).padStart(4)} ${String(r.headroomPx).padStart(8)}  ${r.lowest}${flag}`,
  );
}
writeFileSync(path.join(output, 'fold.json'), `${JSON.stringify({ viewports: VIEWPORTS, captions: CAPTIONS, rows, failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`\n[m8 fold] ${failures.length} FAILURES across ${rows.length} combinations:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n[m8 fold${LABEL ? ` ${LABEL}` : ''}] PASS — Home fits on all ${rows.length} combinations (${VIEWPORTS.length} viewports x EN/AF x one-line/longest).`);
