// M3 visual + behaviour gate — content inside the M2 chrome.
//
// Shoots the three Hourly metrics, Places and Settings, and PROBES what a
// screenshot cannot: that the metric toggle actually swaps the chart (and only
// ever shows one metric), that the chart columns agree with the table below
// them, that the Settings pills really drive the native <select> that owns the
// setting, and that none of this reaches the >=769px frame.
//
//   node scripts/verify-m3-content.mjs  ->  output/m3-content/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'm3-content');
const DATE = '2026-08-08';

function payload() {
  // Deliberately varied: rain climbs then falls, wind decays, temp has a kink,
  // and hour 19 carries a NULL windDir so the absent-never-wrong path is shot.
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 14, rainChance: [0, 0, 5, 10, 15, 15, 10, 10][i % 8],
    precipMm: 0.2, windKph: 33 - (i % 9), windDir: i === 19 ? null : 205,
    cloudPct: 88, humidity: 74, uv: i % 12 < 5 ? 4 : 0,
    condition: (i % 7) > 4 ? 'rain' : 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: [17, 19, 21, 18, 16, 20, 22][d], lowC: [11, 12, 13, 11, 10, 12, 14][d],
    rainChance: [0, 10, 5, 45, 70, 15, 0][d], uv: 4, windKph: 30,
    conditionKey: 'cloudy', conditionLabel: 'Cloudy',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 17, feelsLikeC: 14, uv: 4, isDay: true, windKph: 33, rainChance: 0,
      cloudPct: 88, conditionKey: 'cloudy', conditionLabel: 'Cloudy',
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

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

async function open(width = 390, height = 844) {
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
  return { ctx, page };
}

const results = [];

// ---- Hourly: one chart per metric, and it must actually change -------------
{
  const { ctx, page } = await open();
  await page.click('#homeHourly');
  await page.waitForTimeout(600);
  for (const metric of ['temp', 'rain', 'wind']) {
    await page.click(`#hourlyMetricToggle .seg-option[data-metric="${metric}"]`);
    await page.waitForTimeout(350);
    const probe = await page.evaluate(() => {
      const host = document.getElementById('hourlyChart');
      const on = [...document.querySelectorAll('#hourlyMetricToggle .seg-option')]
        .filter((b) => b.classList.contains('is-on'));
      const pressed = [...document.querySelectorAll('#hourlyMetricToggle .seg-option')]
        .filter((b) => b.getAttribute('aria-pressed') === 'true');
      const times = [...host.querySelectorAll('.chart-time')].map((e) => e.textContent);
      // The first table row must describe the same hour as the first column.
      const firstRowTime = document.querySelector('.hourly-row:not(.hourly-header) .h-time')?.textContent;
      return {
        caption: host.querySelector('.chart-caption')?.textContent,
        ariaLabel: host.getAttribute('aria-label'),
        cols: times.length,
        times,
        firstColMatchesTable: times[0] === firstRowTime,
        // Exactly ONE metric is drawn: a line XOR bars, never both.
        hasLine: !!host.querySelector('.chart-line'),
        hasBars: !!host.querySelector('.chart-bar'),
        values: [...host.querySelectorAll('.chart-val, .chart-bar-val')].map((e) => e.textContent),
        dirs: [...host.querySelectorAll('.chart-dir')].map((e) => e.textContent),
        icons: [...host.querySelectorAll('.chart-icon')].length,
        activeCount: on.length,
        pressedCount: pressed.length,
        activeMetric: on[0]?.dataset.metric ?? null,
      };
    });
    await page.screenshot({ path: path.join(output, `m3-hourly-${metric}-390x844.png`) });
    results.push({ name: `hourly-${metric}`, ...probe });
  }
  await ctx.close();
}

// ---- Settings: the pills must drive the select that owns the setting -------
{
  const { ctx, page } = await open();
  await page.click('#navSettings');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, 'm3-settings-390x844.png') });
  const before = await page.evaluate(() => ({
    temp: document.getElementById('unitsTemp').value,
    wind: document.getElementById('unitsWind').value,
    selectsHidden: ['unitsTemp', 'unitsWind', 'unitsPrecip', 'timeFormat']
      .map((id) => getComputedStyle(document.getElementById(id)).display),
    // Language keeps its native select — five options is a picker, not a toggle.
    langVisible: getComputedStyle(document.getElementById('languageSelect')).display !== 'none',
    segCount: document.querySelectorAll('.settings-seg').length,
  }));
  // Flip temperature to °F via the PILL, then read the select and the app.
  await page.click('.settings-seg[data-for="unitsTemp"] .seg-option[data-value="F"]');
  await page.waitForTimeout(500);
  const afterF = await page.evaluate(() => ({
    selectValue: document.getElementById('unitsTemp').value,
    pillOn: document.querySelector('.settings-seg[data-for="unitsTemp"] .seg-option.is-on')?.dataset.value,
    stored: localStorage.getItem('units.temp'),
  }));
  // And the change must reach the rendered app, not just the control.
  await page.click('#navHome');
  await page.waitForTimeout(700);
  const homeTemp = await page.evaluate(() => document.querySelector('.hero-now')?.textContent?.trim());
  // Wind to mph. m/s was retired as a unit (Al, 2026-08-08), so the control is
  // two-up — and the chart caption and the table column must move together.
  await page.click('#navSettings');
  await page.waitForTimeout(400);
  const windOptions = await page.evaluate(() =>
    [...document.querySelectorAll('.settings-seg[data-for="unitsWind"] .seg-option')].map((b) => b.dataset.value));
  await page.click('.settings-seg[data-for="unitsWind"] .seg-option[data-value="mph"]');
  await page.waitForTimeout(400);
  await page.click('#navHome');
  await page.waitForTimeout(400);
  await page.click('#homeHourly');
  await page.waitForTimeout(600);
  await page.click('#hourlyMetricToggle .seg-option[data-metric="wind"]');
  await page.waitForTimeout(350);
  const mphWind = await page.evaluate(() => ({
    chartCaption: document.querySelector('#hourlyChart .chart-caption')?.textContent,
    chartFirst: document.querySelector('#hourlyChart .chart-val')?.textContent,
    tableWind: document.querySelector('.hourly-row:not(.hourly-header) .h-wind')?.textContent,
  }));
  mphWind.chartAgreesWithTable = mphWind.chartFirst === mphWind.tableWind;
  results.push({ name: 'settings', before, afterF, homeTemp, windOptions, mphWind });
  await ctx.close();
}

// ---- Places: search first, gold CTA under it, Cancel retired ---------------
{
  const { ctx, page } = await open();
  await page.click('#navSearch');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, 'm3-places-390x844.png') });
  const probe = await page.evaluate(() => {
    const r = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), h: Math.round(b.height), display: getComputedStyle(el).display };
    };
    const input = r('searchInput'), cta = r('useMyLocationBtn');
    return {
      searchAboveCta: input && cta ? input.top < cta.top : null,
      input, cta,
      cancelDisplay: r('searchCancel')?.display,
      saveVisible: r('saveCurrent')?.display !== 'none',
      editVisible: r('searchEditToggle')?.display !== 'none',
      subtitle: document.getElementById('searchSubtitle')?.textContent,
      // The three maintenance pills must be one even row, not three sizes.
      actionWidths: [...document.querySelectorAll('.search-panel-actions button')]
        .filter((b) => getComputedStyle(b).display !== 'none')
        .map((b) => Math.round(b.getBoundingClientRect().width)),
    };
  });
  // The back arrow must now do what Cancel did: clear the query and go home.
  await page.fill('#searchInput', 'Hermanus');
  await page.click('#search-screen .page-back');
  await page.waitForTimeout(400);
  probe.backClearsQuery = await page.evaluate(() => ({
    query: document.getElementById('searchInput').value,
    home: document.body.classList.contains('home-active'),
  }));
  results.push({ name: 'places', ...probe });
  await ctx.close();
}

// ---- The >=769px frame must see none of it --------------------------------
{
  const { ctx, page } = await open(1440, 900);
  await page.waitForTimeout(800);
  const desktop = await page.evaluate(() => {
    // NOT computed display: an element inside a display:none parent still
    // reports its own display, so #hourlyMetricToggle reads "block" while the
    // .m-only surface above it is hidden. getClientRects() is empty for
    // anything in a non-rendered subtree, which is the question actually asked.
    const d = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'missing';
      return el.getClientRects().length === 0 ? 'none' : getComputedStyle(el).display;
    };
    return {
      hourlySubtitle: d('#hourlySubtitle'),
      metricToggle: d('#hourlyMetricToggle'),
      segSurface: d('.seg-surface'),
      chart: d('#hourlyChart'),
    };
  });
  // A CLOSED panel has no client rects either, so the "desktop keeps what it
  // had" half has to be read with each screen actually open — otherwise it
  // passes for the wrong reason.
  await page.click('#navSettings');
  await page.waitForTimeout(400);
  const settingsOpen = await page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      return el && el.getClientRects().length > 0;
    };
    return { unitsTempSelect: vis('#unitsTemp'), settingsSubtitle: vis('#settingsSubtitle'), seg: vis('.settings-seg') };
  });
  await page.click('#navSearch');
  await page.waitForTimeout(400);
  const searchOpen = await page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      return el && el.getClientRects().length > 0;
    };
    // "The new stuff is hidden" is only half the guard — the half that misses a
    // DOM reorder. .screen-panel-header is flex-direction:column UNSCOPED, so
    // markup order IS desktop order, and moving a node rearranges this screen
    // at 1440 without touching a single new element. Assert the ORDER too.
    const top = (id) => {
      const el = document.getElementById(id);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    };
    const save = document.getElementById('saveCurrent')?.getBoundingClientRect();
    return {
      cancelBtn: vis('#searchCancel'), searchSubtitle: vis('#searchSubtitle'),
      ctaTop: top('useMyLocationBtn'), saveTop: top('saveCurrent'), inputTop: top('searchInput'),
      // Pre-M3 desktop order: CTA, then Save, then the search input.
      desktopOrderKept: top('useMyLocationBtn') < top('saveCurrent')
        && top('saveCurrent') < top('searchInput'),
      // And Save keeps its wide pill rather than being squeezed into a row.
      saveWidth: save ? Math.round(save.width) : null,
      saveIsWidePill: save ? save.width > 240 : null,
    };
  });
  desktop.settingsOpen = settingsOpen;
  desktop.searchOpen = searchOpen;
  desktop.allHidden = ['hourlySubtitle', 'metricToggle', 'segSurface', 'chart']
    .every((k) => desktop[k] === 'none')
    && !settingsOpen.settingsSubtitle && !settingsOpen.seg && !searchOpen.searchSubtitle;
  // Desktop keeps the native select and the Cancel button it always had.
  desktop.selectsStillNative = settingsOpen.unitsTempSelect;
  desktop.cancelKept = searchOpen.cancelBtn;
  results.push({ name: 'desktop1440', ...desktop });
  await ctx.close();
}

await browser.close();
server.close();
console.log(JSON.stringify(results, null, 2));
