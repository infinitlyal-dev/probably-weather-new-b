// M4 gate — the Bronne range chart.
//
// Shoots the Sources screen and PROBES the things a screenshot cannot: that the
// bars are positioned on ONE shared scale (a source's pixel span must be
// proportional to its degree span), that the consensus band actually brackets
// Probably's own low/high, and — the M3 lesson — that the >=769px Sources screen
// still renders the list it always had, not merely that the new chart is hidden.
//
//   node scripts/verify-m4-sources.mjs  ->  output/m4-sources/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'm4-sources');
const DATE = '2026-08-08';

// Deliberately uneven ranges: a wide outlier (WeatherAPI), a narrow one
// (Tomorrow.io), and a consensus that does NOT sit at the centre of the spread.
const RANGES = [
  { name: 'Open-Meteo', minTemp: 11, maxTemp: 17 },
  { name: 'WeatherAPI', minTemp: 9, maxTemp: 18 },
  { name: 'MET Norway', minTemp: 13, maxTemp: 17 },
  { name: 'Pirate Weather', minTemp: 13, maxTemp: 16 },
  { name: 'Tomorrow.io', minTemp: 14, maxTemp: 16 },
];
const LOW = 11, HIGH = 17;

function payload(ranges = RANGES) {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 14, rainChance: (i % 7) * 8, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 88, humidity: 74,
    uv: i % 12 < 5 ? 4 : 0, condition: 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: d === 0 ? HIGH : 19, lowC: d === 0 ? LOW : 12,
    rainChance: 10, uv: 4, windKph: 30,
    conditionKey: 'cloudy', conditionLabel: 'Cloudy',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 15, feelsLikeC: 14, uv: 4, isDay: true, windKph: 33, rainChance: 0,
      cloudPct: 88, conditionKey: 'cloudy', conditionLabel: 'Cloudy',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: 33, maxWindKph: 58, gustKph: 58, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: ranges,
      conditionConfidence: { level: 'high', finalCondition: 'cloudy', sourceAgreement: '4/5' },
    },
  };
}

let activeRanges = RANGES;

function startServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payload(activeRanges)
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

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

async function openSources(width = 390, height = 844) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2,
    isMobile: width < 769, hasTouch: width < 769,
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
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
  }, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.click('#navSettings');
  await page.waitForTimeout(350);
  await page.click('#settingsSourcesRow');
  await page.waitForTimeout(600);
  return { ctx, page };
}

const results = [];

// ---- Mobile: the chart, and whether it is honestly to scale ---------------
{
  const { ctx, page } = await openSources();
  await page.screenshot({ path: path.join(output, 'm4-sources-390x844.png') });
  const probe = await page.evaluate(({ ranges, low, high }) => {
    const host = document.getElementById('sourcesRangeChart');
    const rows = [...host.querySelectorAll('.range-name')].map((n) => n.textContent);
    const tracks = [...host.querySelectorAll('.range-track')];
    const bars = tracks.map((t) => {
      const tr = t.getBoundingClientRect();
      const b = t.querySelector('.range-bar').getBoundingClientRect();
      return { left: b.left - tr.left, width: b.width, trackW: tr.width };
    });
    const bandEl = host.querySelector('.range-band');
    const bandCell = host.querySelector('.range-band-cell');
    const band = bandEl ? bandEl.getBoundingClientRect() : null;
    const firstTrack = tracks[0].getBoundingClientRect();
    const lastTrack = tracks[tracks.length - 1].getBoundingClientRect();
    return {
      rows,
      listHidden: getComputedStyle(document.getElementById('sourcesList')).display === 'none',
      barCount: bars.length,
      bars,
      // ONE shared scale: px-per-degree must be the same for every source.
      pxPerDegree: bars.map((b, i) => b.width / (ranges[i].maxTemp - ranges[i].minTemp)),
      // The band must bracket Probably's own low/high on that same scale.
      bandPresent: !!bandEl,
      bandSpansAllRows: band && bandCell
        ? Math.round(bandCell.getBoundingClientRect().top) <= Math.round(firstTrack.top)
          && Math.round(bandCell.getBoundingClientRect().bottom) >= Math.round(lastTrack.bottom)
        : null,
      bandLeftPx: band ? band.left - firstTrack.left : null,
      bandWidthPx: band ? band.width : null,
      legend: host.querySelector('.range-legend')?.textContent,
      expected: { low, high },
      caption: host.querySelector('.chart-caption')?.textContent,
    };
  }, { ranges: RANGES, low: LOW, high: HIGH });
  // Every source must share one px-per-degree (within a rounding pixel).
  const scales = probe.pxPerDegree;
  probe.oneSharedScale = Math.max(...scales) - Math.min(...scales) < 0.5;
  // The band's own px-per-degree must match the bars'.
  probe.bandOnSameScale = Math.abs((probe.bandWidthPx / (HIGH - LOW)) - scales[0]) < 1.5;
  results.push({ name: 'mobile', ...probe });
  await ctx.close();
}

// ---- °F: the scale must still be honest after conversion ------------------
// This is the leg whose ABSENCE let a 12.5% scale distortion pass: rounding the
// converted endpoints before positioning only shows up outside °C. px-per-degree
// is measured against the ORIGINAL °C spans, which is unit-independent.
{
  const { ctx, page } = await openSources();
  await page.click('#navSettings');
  await page.waitForTimeout(300);
  await page.click('.settings-seg[data-for="unitsTemp"] .seg-option[data-value="F"]');
  await page.waitForTimeout(500);
  await page.click('#settingsSourcesRow');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(output, 'm4-sources-fahrenheit.png') });
  const f = await page.evaluate(({ ranges, low, high }) => {
    const host = document.getElementById('sourcesRangeChart');
    const tracks = [...host.querySelectorAll('.range-track')];
    const bars = tracks.map((t) => {
      const tr = t.getBoundingClientRect();
      const b = t.querySelector('.range-bar').getBoundingClientRect();
      return { left: b.left - tr.left, width: b.width, trackW: tr.width };
    });
    const band = host.querySelector('.range-band')?.getBoundingClientRect();
    const tr0 = tracks[0].getBoundingClientRect();
    return {
      caption: host.querySelector('.chart-caption')?.textContent,
      legend: host.querySelector('.range-legend')?.textContent,
      vals: [...host.querySelectorAll('.range-val')].map((e) => e.textContent),
      pxPerCelsiusDegree: bars.map((b, i) => b.width / (ranges[i].maxTemp - ranges[i].minTemp)),
      bandLeftPx: band ? band.left - tr0.left : null,
      bandWidthPx: band ? band.width : null,
      bandPxPerCelsiusDegree: band ? band.width / (high - low) : null,
      scaleLabels: [...host.querySelectorAll('.range-scale span')].map((e) => e.textContent),
    };
  }, { ranges: RANGES, low: LOW, high: HIGH });
  const sc = f.pxPerCelsiusDegree;
  f.oneSharedScale = Math.max(...sc) - Math.min(...sc) < 0.5;
  f.bandOnSameScale = Math.abs(f.bandPxPerCelsiusDegree - sc[0]) < 1.0;
  results.push({ name: 'fahrenheit', ...f });
  await ctx.close();
}

// ---- Partial data: the list must NOT be buried ----------------------------
{
  activeRanges = [
    { name: 'Open-Meteo', minTemp: 11, maxTemp: 17 },
    { name: 'WeatherAPI', minTemp: 9, maxTemp: 18 },
    { name: 'MET Norway', minTemp: null, maxTemp: null },
    { name: 'Pirate Weather', minTemp: 13, maxTemp: null },
    // Reversed: upstream nonsense, must be dropped rather than drawn backwards.
    { name: 'Tomorrow.io', minTemp: 20, maxTemp: 12 },
  ];
  const { ctx, page } = await openSources();
  results.push({
    name: 'partial-ranges',
    ...(await page.evaluate(() => {
      const list = document.getElementById('sourcesList');
      const cs = getComputedStyle(list);
      return {
        chartRows: document.querySelectorAll('#sourcesRangeChart .range-name').length,
        listItems: list.querySelectorAll('.sources-list-item').length,
        // Two good rows out of five must not hide the three the chart can't draw.
        listVisuallyHidden: document.querySelector('.sources-page').classList.contains('has-range-chart'),
        listDisplay: cs.display,
        noBarWiderThanTrack: [...document.querySelectorAll('#sourcesRangeChart .range-track')].every((t) => {
          const b = t.querySelector('.range-bar').getBoundingClientRect();
          const tr = t.getBoundingClientRect();
          return b.left >= tr.left - 0.5 && b.right <= tr.right + 0.5;
        }),
      };
    })),
  });
  await ctx.close();
  activeRanges = RANGES;
}

// ---- Accessibility: the data must survive the chart -----------------------
{
  const { ctx, page } = await openSources();
  results.push({
    name: 'a11y',
    ...(await page.evaluate(() => {
      const list = document.getElementById('sourcesList');
      return {
        chartAriaHidden: document.getElementById('sourcesRangeChart').getAttribute('aria-hidden'),
        // display:none would strip every source name and value from AT.
        listDisplay: getComputedStyle(list).display,
        listInA11yTree: getComputedStyle(list).display !== 'none',
        listText: [...list.querySelectorAll('.sources-list-item')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      };
    })),
  });
  await ctx.close();
}

// ---- Degenerate: one source only -> no chart, list still shown ------------
{
  activeRanges = [{ name: 'Open-Meteo', minTemp: 11, maxTemp: 17 }];
  const { ctx, page } = await openSources();
  results.push({
    name: 'single-source',
    ...(await page.evaluate(() => ({
      chartHidden: document.getElementById('sourcesRangeChart').hidden,
      listShown: getComputedStyle(document.getElementById('sourcesList')).display !== 'none',
      listItems: document.querySelectorAll('#sourcesList .sources-list-item').length,
    }))),
  });
  await ctx.close();
  activeRanges = RANGES;
}

// ---- The >=769px screen must be UNCHANGED, not merely chart-free ----------
{
  const { ctx, page } = await openSources(1440, 900);
  await page.screenshot({ path: path.join(output, 'm4-sources-1440x900.png') });
  const desktop = await page.evaluate(() => {
    const rendered = (sel) => {
      const el = document.querySelector(sel);
      return !!el && el.getClientRects().length > 0;
    };
    const items = [...document.querySelectorAll('#sourcesList .sources-list-item')];
    return {
      chartRendered: rendered('#sourcesRangeChart'),
      // The M3 lesson: assert what SURVIVES, not only what hides.
      listRendered: rendered('#sourcesList'),
      listItems: items.length,
      listText: items.map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      explainerRendered: rendered('#sourcesExplainer'),
      attributionRendered: rendered('#sourcesAttribution'),
      backButtonLabelled: document.getElementById('sourcesBack')?.textContent.trim(),
    };
  });
  desktop.desktopIntact = !desktop.chartRendered && desktop.listRendered
    && desktop.listItems === RANGES.length && desktop.explainerRendered && desktop.attributionRendered;
  results.push({ name: 'desktop1440', ...desktop });
  await ctx.close();
}

await browser.close();
server.close();
console.log(JSON.stringify(results, null, 2));
