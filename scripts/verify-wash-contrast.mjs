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
//
// ─────────────────────────────────────────────────────────────────────────────
// INK ON THE LIT HOME (--caption)
//
//   node scripts/verify-wash-contrast.mjs --caption
//
// Two of Al's rulings took ink off solid surfaces and put it on photography.
// 2026-08-14, the home meme: the witty line goes ON the picture, in one white
// ink. 2026-08-17, the light: the photograph runs to the top of the screen so
// the brand and the place name float on it too, and the wash's scrim is opened
// so the page under the temperature is the photograph's own colour rather than
// flat --page-bg.
//
// The handover's trap, verbatim, and it now applies to three bands rather than
// one: "White-on-photo is only as good as its worst photograph. The storm and
// beach frames are easy. A bright midday beach, a pale fog frame, a snow scene
// — those are where the scrim has to do real work. Check the direction against
// the ugliest ten in the library before committing to a single ink."
//
// So this is that check, deliberately two-stage, because the stages answer
// different questions:
//
//   1. SELECTION, over all 644 canonical photographs, in sharp. For each one it
//      reproduces the CSS crop exactly — `cover` at the card's measured size,
//      `center var(--hero-crop)` at that image's OWN wired anchor — and scores
//      the 90th-percentile luminance of each band's source region. Downscaled
//      first, so this is an approximate ranking; it only has to find the right
//      photographs to look at, not judge them.
//   2. PROOF, on the union of those, in the real app. Each is rendered at
//      375x812 with the longest real witty line pinned, every measured ink then
//      made transparent so the scrim and the wash stay, and the ACTUAL painted
//      pixels behind each ink sampled. The 95th percentile, not the median: for
//      a light ink the enemy is the brightest thing under it, and a median
//      scores the easy half of the box.
//
// PASS: every ink clears 4.5:1 on every photograph in the union. The frames are
// written out with the text visible as well, because a ratio is not an opinion
// about whether it pops.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { HERO_CROP_OFFSETS } from '../assets/hero-crop.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-08';

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

// ═══════════════════════════════════════════════════════════════════════════
// INK ON THE LIT HOME — every ink that no longer sits on a solid surface.
// Runs instead of the wash gate, not alongside it: the standing gate stays the
// fast two-scene check it has always been, and this one reads 644 photographs.
//
// Three bands, because Al's home has three places where ink meets a picture:
//   header   the brand and the place name, now floating on the photograph
//   caption  the witty line, on the photograph, in white
//   data     the temperature, condition, feels/range and agreement lines, on a
//            page that is no longer flat --page-bg but the photograph's own
//            colour coming through an opened scrim
//
// Selection is per band and then unioned, because the worst photograph for one
// band is not the worst for another: a bright sky ruins the header and leaves
// the caption alone, a pale foreground does the reverse, and the data band is
// ruined by an image that is bright OVERALL, since that is what the blurred
// wash is made of.
// ═══════════════════════════════════════════════════════════════════════════
if (process.argv.includes('--caption')) {
  const outDir = path.join(root, 'output', 'caption-contrast');
  mkdirSync(outDir, { recursive: true });
  const canonDir = path.join(dist, 'assets', 'images', 'bg-canonical');
  const VIEWPORT = { width: 375, height: 812 }; // Al's phone
  const WORST = 8; // per band, before the union
  const GOLD = '#ffd700';

  // Every ink that is no longer on a solid surface, with the colour it is
  // actually painted in. Anything on an opaque panel (the stats pill, the
  // Hourly CTA, the language chip) is deliberately absent — those did not
  // change and the standing gate already owns that argument.
  const INKS = [
    { sel: '.brand-title', band: 'header', ink: INK, label: 'brand' },
    { sel: '.brand-location', band: 'header', ink: INK, label: 'place name' },
    { sel: '#headline', band: 'caption', ink: '#ffffff', label: 'witty line' },
    { sel: '.temp .hero-probably', band: 'data', ink: GOLD, label: '"Probably"' },
    { sel: '.temp .hero-now', band: 'data', ink: INK, label: 'temperature' },
    { sel: '#description', band: 'data', ink: INK, label: 'condition' },
    { sel: '.feels-line', band: 'data', ink: INK, label: 'feels like' },
    { sel: '.range-line', band: 'data', ink: INK, label: 'low/high' },
    { sel: '#agreeLine', band: 'data', ink: INK, label: 'agreement' },
  ];

  // The ink goes transparent and everything painted BEHIND it stays. The two
  // gold marks inside these boxes (the agreement dot, the location chevron)
  // are pseudo-elements, and a 95th percentile would read them as a blindingly
  // bright background and fail the row for no reason.
  const STRIP = `
    ${INKS.map((i) => i.sel).join(', ')} { color: transparent !important; text-shadow: none !important; }
    .range-line .range-v, .range-line .range-sep { color: transparent !important; }
    #agreeLine::before, #agreeLine::after, .brand-location::after { display: none !important; }
  `;

  // The longest real line in the bank. A caption that reaches highest into the
  // gradient is the one that has to be proven — a one-liner sits in the dark
  // bottom of the scrim where nothing is at risk.
  const longestLine = (lang) => {
    const src = readFileSync(path.join(root, 'assets', 'copy', `${lang}.js`), 'utf8');
    const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
    const lines = [];
    const walk = (n) => {
      if (typeof n === 'string') { lines.push(n); return; }
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n && typeof n === 'object') Object.values(n).forEach(walk);
    };
    walk(bank.witty || {});
    return lines.sort((a, b) => b.length - a.length)[0];
  };
  const LINE = longestLine('af');

  current = SCENES.sunny;
  const srv = await startServer();
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const br = await chromium.launch();

  const open = async (heroUrl, anchor) => {
    const ctx = await br.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T13:12:00+02:00`) });
    await page.addInitScript((u) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
        localStorage.setItem('pw_last_bg', u);
      } catch (_) {}
    }, heroUrl);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    // BOTH pinned, for the reason gate-shots.mjs pins both: the picker keeps
    // running and writes --hero-crop for whatever IT landed on, so pinning only
    // the URL scores this photograph through another one's anchor.
    await page.evaluate(({ u, a }) => {
      const s = document.createElement('style');
      s.textContent = `html { --hero-url: url("${u}") !important;${a == null ? '' : ` --hero-crop: ${a}% !important;`} }`;
      document.body.appendChild(s);
    }, { u: heroUrl, a: anchor });
    await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, LINE);
    await page.waitForTimeout(900);
    // Settle the entrance fade, or the sample is taken through a partly
    // transparent scrim and scores better than the app ever will.
    await page.evaluate(() => { document.getAnimations?.().forEach((a) => { try { a.finish(); } catch (_) {} }); });
    return { ctx, page };
  };

  // Measured off the running app rather than read off the stylesheet: the
  // paddings are clamps and the line count is the browser's.
  const boxes = (page, inks) => page.evaluate((sels) => {
    const pad = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight),
        top: r.top + parseFloat(cs.paddingTop), bottom: r.bottom - parseFloat(cs.paddingBottom),
      };
    };
    const card = document.getElementById('heroPhoto').getBoundingClientRect();
    const out = { cardTop: card.top, cardW: card.width, cardH: card.height, els: {} };
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) out.els[s] = pad(el);
    }
    const header = document.querySelector('.header');
    if (header) out.headerBottom = header.getBoundingClientRect().bottom;
    return out;
  }, inks.map((i) => i.sel));

  // The 644-image scan is the slow half and depends only on the LIBRARY and the
  // card geometry, not on the inks or the scrim. `--reuse` keeps the selection
  // from the last full run so a scrim/ink adjustment can be re-proven in one
  // minute instead of ten. Any change to the crop, the card size or the library
  // needs a full run — hence the geometry stamped alongside it.
  const selFile = path.join(outDir, 'selection.json');
  const REUSE = process.argv.includes('--reuse') && existsSync(selFile);

  const files = readdirSync(canonDir).filter((f) => f.endsWith('.webp'));
  const probe = await open(`/assets/images/bg-canonical/${files[0]}`, null);
  const GEO = await boxes(probe.page, INKS);
  await probe.ctx.close();
  // The two regions of the PHOTOGRAPH that carry ink, in card coordinates.
  const BANDS = {
    header: { top: 0, height: Math.max(1, GEO.headerBottom - GEO.cardTop) },
    caption: { top: GEO.els['#headline'].top - GEO.cardTop, height: GEO.els['#headline'].bottom - GEO.els['#headline'].top },
  };

  // ---- 1. Selection: reproduce the CSS crop in sharp, score each band -------
  const scored = [];
  for (const f of REUSE ? [] : files) {
    const file = path.join(canonDir, f);
    const { width: sw, height: sh } = await sharp(file).metadata();
    const anchor = HERO_CROP_OFFSETS[`bg-canonical/${f}`] ?? 78;
    // `background-size: cover` = scale until BOTH axes are covered.
    const scale = Math.max(GEO.cardW / sw, GEO.cardH / sh);
    const offY = (sh * scale - GEO.cardH) * (anchor / 100);
    const offX = (sw * scale - GEO.cardW) / 2;
    const row = { file: f, anchor };
    for (const [key, band] of Object.entries(BANDS)) {
      const left = Math.max(0, Math.round(offX / scale));
      const top = Math.max(0, Math.round((offY + band.top) / scale));
      const rect = {
        left, top,
        width: Math.max(1, Math.min(Math.round(GEO.cardW / scale), sw - left)),
        height: Math.max(1, Math.min(Math.round(band.height / scale), sh - top)),
      };
      const { data, info } = await sharp(file).extract(rect)
        .resize(96, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
      const lums = [];
      for (let i = 0; i < data.length; i += info.channels) lums.push(lumRgb(data[i], data[i + 1], data[i + 2]));
      lums.sort((a, b) => a - b);
      row[key] = lums[Math.floor(lums.length * 0.9)];
    }
    // The wash is made from the WHOLE photograph, so the data band's enemy is
    // overall brightness, not any one region of the crop.
    const { data: dd, info: di } = await sharp(file).resize(32, 32, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    let sum = 0; let n = 0;
    for (let i = 0; i < dd.length; i += di.channels) { sum += lumRgb(dd[i], dd[i + 1], dd[i + 2]); n += 1; }
    row.data = sum / n;
    scored.push(row);
  }
  // Worst WORST per band, then the union: ~20 photographs, each proven on all
  // three bands rather than only on the one that selected it.
  let worst;
  if (REUSE) {
    worst = JSON.parse(readFileSync(selFile, 'utf8')).worst;
    console.log(`[reuse] ${worst.length} photographs from the last full scan (selection.json)`);
  } else {
    const picked = new Map();
    for (const band of ['header', 'caption', 'data']) {
      [...scored].sort((a, b) => b[band] - a[band]).slice(0, WORST)
        .forEach((r) => { if (!picked.has(r.file)) picked.set(r.file, { ...r, why: band }); });
    }
    worst = [...picked.values()];
    writeFileSync(selFile, `${JSON.stringify({ geometry: GEO, scanned: files.length, worst }, null, 2)}\n`);
  }

  // ---- 2. Proof: the real app, the real pixels ------------------------------
  const capRows = [];
  const capFailures = [];
  for (const w of worst) {
    const url = `/assets/images/bg-canonical/${w.file}`;
    const { ctx, page } = await open(url, w.anchor);
    const short = w.file.slice(0, 12);
    await page.screenshot({ path: path.join(outDir, `${short}-line.png`) });
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, STRIP);
    const b = await boxes(page, INKS);
    const buf = await page.screenshot();
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    for (const ink of INKS) {
      const box = b.els[ink.sel];
      if (!box) continue;
      const lums = [];
      const y0 = Math.max(0, Math.round(box.top));
      const y1 = Math.min(info.height, Math.round(box.bottom));
      const x0 = Math.max(0, Math.round(box.left));
      const x1 = Math.min(info.width, Math.round(box.right));
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * info.width + x) * info.channels;
          lums.push(lumRgb(data[i], data[i + 1], data[i + 2]));
        }
      }
      if (!lums.length) continue;
      lums.sort((a, c) => a - c);
      // The 95th percentile, not the median: for a light ink the enemy is the
      // brightest thing under it, and a median scores the easy half of the box.
      const r95 = ratio(lumHex(ink.ink), lums[Math.floor(lums.length * 0.95)]);
      capRows.push({ file: w.file, why: w.why, band: ink.band, label: ink.label, ratio: r95 });
      if (r95 < MIN_RATIO) capFailures.push(`[${short}] ${ink.band}/${ink.label} ${r95.toFixed(2)}:1 < ${MIN_RATIO}`);
    }
    await ctx.close();
  }

  await br.close();
  srv.close();
  writeFileSync(path.join(outDir, 'caption-contrast.json'),
    `${JSON.stringify({ viewport: VIEWPORT, line: LINE, scanned: files.length, photographs: worst.length, rows: capRows, failures: capFailures }, null, 2)}\n`);

  console.log(`scanned ${files.length} photographs; proving the worst ${WORST} per band (${worst.length} after the union), at 375x812.\n`);
  console.log('band     ink              worst photograph        best      worst');
  for (const band of ['header', 'caption', 'data']) {
    for (const ink of INKS.filter((i) => i.band === band)) {
      const rs = capRows.filter((r) => r.band === band && r.label === ink.label);
      if (!rs.length) continue;
      const lo = rs.reduce((a, b2) => (b2.ratio < a.ratio ? b2 : a));
      const hi = rs.reduce((a, b2) => (b2.ratio > a.ratio ? b2 : a));
      console.log(
        `${band.padEnd(8)} ${ink.label.padEnd(16)} ${lo.file.slice(0, 12)}  ${hi.ratio.toFixed(2).padStart(7)}:1  ${lo.ratio.toFixed(2).padStart(6)}:1${lo.ratio < MIN_RATIO ? '  FAIL' : ''}`,
      );
    }
  }
  if (capFailures.length) {
    console.error(`\n[ink on the lit home] ${capFailures.length} FAILURES:`);
    for (const f of capFailures.slice(0, 20)) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n[ink on the lit home] PASS — ${capRows.length} measurements across ${worst.length} of the library's worst photographs; every ink clears ${MIN_RATIO}:1. Frames: output/caption-contrast/`);
  process.exit(0);
}

const WASH = readFileSync(path.join(root, 'output', 'vibrancy', 'cumulative-4.css'), 'utf8');

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
