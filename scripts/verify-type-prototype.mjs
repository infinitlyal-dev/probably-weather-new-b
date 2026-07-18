// Adopted-typography gate (was a current-vs-?type=proto comparison; the prototype
// is now the default, so this asserts the shipped state directly):
//   - Onest is the default UI family on mobile + desktop, with ZERO font-file
//     requests (woff2 embedded as data: URIs).
//   - Caveat is the desktop postcard caption only; mobile never loads it.
//   - The ruled size/weight ladder holds at mobile + desktop.
//   - 200% text zoom grows the display type but no longer overflows: the mobile
//     hero clip and the 1440 range overflow are both 0.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'design-wave', 'type-gate');
const manifest = JSON.parse(readFileSync(path.join(root, 'assets', 'fonts', 'type-prototype-fonts.json'), 'utf8'));
const viewports = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'postcard', width: 1440, height: 900 },
  { label: 'postcard', width: 1920, height: 1080 },
];

function assert(value, message) { if (!value) throw new Error(message); }

function weatherPayload() {
  const hourly = Array.from({ length: 48 }, () => ({ tempC: 27, feelsLikeC: 27, rainChance: 0, precipMm: 0, windKph: 15, cloudPct: 8, humidity: 52, uv: 3, condition: 'clear' }));
  const daily = Array.from({ length: 7 }, (_, day) => ({ highC: 30 + (day % 2), lowC: 23 + (day % 2), rainChance: 0, uv: 3, windKph: 15, conditionKey: 'clear', conditionLabel: 'Clear', sunrise: '2026-07-11T00:00', sunset: '2026-07-11T23:59' }));
  return {
    ok: true,
    location: { name: 'Strand, Western Cape', lat: -34.12, lon: 18.84 },
    now: { tempC: 27, feelsLikeC: 27, rainChance: 0, cloudPct: 8, humidity: 52, uv: 3, conditionKey: 'clear', conditionLabel: 'Clear', isDay: true, windKph: 15 },
    hourly, daily, wind_kph: 15, maxWindKph: 20, gustKph: 24,
    consensus: { confidenceKey: 'high' },
    meta: { localHour: 14, utcOffsetSeconds: 7200, confidence: 'high', sources: [{ name: 'Open-Meteo', ok: true }], sourceConditions: [{ source: 'Open-Meteo', vote: 'clear', desc: 'Clear' }], sourceRanges: [] },
  };
}

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? weatherPayload()
        : pathname === '/api/locate' ? { ok: true, lat: -34.12, lon: 18.84, name: 'Strand, Western Cape' }
          : pathname === '/api/version' ? { buildId: 'local' } : {};
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(dist, relative);
    if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function openApp(browser, origin, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const requests = [];
  context.on('request', (request) => requests.push({ type: request.resourceType(), url: request.url() }));
  await context.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = new NativeDate('2026-07-11T12:00:00Z').valueOf();
    class FixedDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } }
    window.Date = FixedDate;
    Math.random = () => 0.123456;
    localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.12, lon: 18.84, mode: 'gps' }));
    localStorage.setItem('lang', JSON.stringify('en'));
    localStorage.setItem('pw_install_dismissed_at', String(Date.now()));
  });
  const page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY === 'clear');
  await page.waitForFunction(() => {
    const image = document.getElementById('bgImg');
    return image?.complete && image.naturalWidth > 0 && getComputedStyle(document.documentElement).getPropertyValue('--hero-url').includes('webp');
  });
  if (viewport.width >= 1024) await page.waitForFunction(() => document.getElementById('pwTypeCaption')?.sheet);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#pwSplash').waitFor({ state: 'hidden' });
  await page.waitForTimeout(250);
  return { context, page, requests };
}

function snapshot(page) {
  return page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const range = document.querySelector('.hero-range');
    const probably = document.querySelector('.hero-probably');
    const ov = (el) => Math.max(0, el.scrollWidth - el.clientWidth);
    const rightPastViewport = (el) => Math.max(0, Math.round(el.getBoundingClientRect().right) - window.innerWidth);
    return {
      bodyFamily: style('body').fontFamily,
      captionFamily: style('#headline').fontFamily,
      typeSizes: {
        probably: style('.hero-probably').fontSize, range: style('.hero-range').fontSize,
        condition: style('#description').fontSize, caption: style('#headline').fontSize,
        stats: style('.sidebar .weather-byline').fontSize, location: style('#location').fontSize,
        share: style('#shareBtn').fontSize, hourly: style('#navHourlyHome').fontSize,
        myLocation: style('#myLocationHome').fontSize, nav: style('#navHome').fontSize, language: style('.language-btn').fontSize,
      },
      typeWeights: {
        probably: style('.hero-probably').fontWeight, range: style('.hero-range').fontWeight,
        condition: style('#description').fontWeight, stats: style('.sidebar .weather-byline').fontWeight,
        location: style('#location').fontWeight, share: style('#shareBtn').fontWeight,
        hourly: style('#navHourlyHome').fontWeight, myLocation: style('#myLocationHome').fontWeight,
        nav: style('#navHome').fontWeight, language: style('.language-btn').fontWeight,
      },
      rangeNowrap: style('.hero-range').whiteSpace === 'nowrap',
      rangeOverflowPx: ov(range),
      probablyOverflowPx: ov(probably),
      rangePastViewportPx: rightPastViewport(range),
      probablyPastViewportPx: rightPastViewport(probably),
      documentOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
}

async function captureViewport(browser, origin, viewport) {
  const opened = await openApp(browser, origin, viewport);
  const normal = await snapshot(opened.page);
  const fontRequests = opened.requests.filter((r) => r.type === 'font').map((r) => r.url);
  const stylesheets = opened.requests.filter((r) => r.type === 'stylesheet').map((r) => new URL(r.url).pathname);
  const file = path.join(output, `default-${viewport.label}-${viewport.width}x${viewport.height}.png`);
  await opened.page.screenshot({ path: file });

  assert(normal.bodyFamily.includes('Onest Prototype'), `${viewport.width}px default did not apply Onest`);
  assert(normal.rangeNowrap, `${viewport.width}px temperature range wrapped`);
  assert(fontRequests.length === 0, `${viewport.width}px made font-file requests (should be 0, embedded): ${fontRequests.join(', ')}`);
  assert(normal.rangeOverflowPx === 0 && normal.rangePastViewportPx === 0, `${viewport.width}px range overflows at 100%`);

  if (viewport.width < 1024) {
    assert(!stylesheets.some((url) => url.includes('type-prototype-caption')), 'Mobile loaded the Caveat stylesheet');
    assert(!normal.captionFamily.includes('Caveat Prototype'), 'Mobile applied Caveat');
    assert(normal.typeSizes.stats === '12px' && normal.typeWeights.stats === '500', `Mobile stats token missed the live byline: ${JSON.stringify(normal.typeSizes)}`);
  } else {
    assert(normal.captionFamily.includes('Caveat Prototype'), `${viewport.width}px did not apply Caveat to the caption`);
    assert(stylesheets.some((url) => url.includes('type-prototype-caption')), `${viewport.width}px did not load the desktop caption stylesheet`);
    const expectedSizes = { probably: '68px', range: '98px', condition: '34px', stats: '15px', location: '13px', share: '16px', hourly: '15px', myLocation: '15px', nav: '14px', language: '14px' };
    const expectedWeights = { probably: '300', range: '800', condition: '700', stats: '450', location: '700', share: '650', hourly: '650', myLocation: '650', nav: '600', language: '600' };
    for (const [token, expected] of Object.entries(expectedSizes)) assert(normal.typeSizes[token] === expected, `${viewport.width}px ${token} size ${normal.typeSizes[token]} != ${expected}`);
    for (const [token, expected] of Object.entries(expectedWeights)) assert(normal.typeWeights[token] === expected, `${viewport.width}px ${token} weight ${normal.typeWeights[token]} != ${expected}`);
  }

  // 200% text-zoom: display type grows, but the mobile hero clip and the 1440
  // range overflow are gone (both 0).
  await opened.page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await opened.page.waitForTimeout(150);
  const zoomed = await snapshot(opened.page);
  await opened.page.screenshot({ path: path.join(output, `default-text-zoom-200-${viewport.label}-${viewport.width}x${viewport.height}.png`) });
  assert(Number.parseFloat(zoomed.typeSizes.probably) > Number.parseFloat(normal.typeSizes.probably), `${viewport.width}px display type ignored 200% zoom`);
  assert(zoomed.rangeNowrap, `${viewport.width}px 200% zoom broke the temperature nowrap contract`);
  assert(zoomed.rangeOverflowPx === 0, `${viewport.width}px 200% range overflows its column by ${zoomed.rangeOverflowPx}px`);
  assert(zoomed.probablyOverflowPx === 0, `${viewport.width}px 200% "Probably" overflows by ${zoomed.probablyOverflowPx}px`);
  assert(zoomed.rangePastViewportPx === 0 && zoomed.probablyPastViewportPx === 0 && zoomed.documentOverflowPx === 0, `${viewport.width}px 200% hero clips past the viewport`);

  await opened.context.close();
  return { normal, zoomed, fontRequests: fontRequests.length, stylesheets };
}

mkdirSync(output, { recursive: true });
const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  assert(manifest.fonts.onest.totalBytes <= manifest.fonts.onest.budgetBytes, 'Onest exceeds its budget');
  assert(manifest.fonts.caveat.totalBytes <= manifest.fonts.caveat.budgetBytes, 'Caveat exceeds its budget');
  const results = {};
  for (const viewport of viewports) {
    const key = `${viewport.width}x${viewport.height}`;
    results[key] = await captureViewport(browser, origin, viewport);
    console.log(`[type gate ${key}] PASS — Onest default (font reqs ${results[key].fontRequests}); ruled ladder; 200% zoom range overflow ${results[key].zoomed.rangeOverflowPx}px, hero past-viewport ${results[key].zoomed.rangePastViewportPx}px`);
  }
  writeFileSync(path.join(output, 'evidence.json'), `${JSON.stringify({ condition: 'clear day', results, fontManifest: manifest }, null, 2)}\n`);
  console.log(`[type screenshots] PASS — three default gates + three 200% text-zoom captures in ${path.relative(root, output).replaceAll('\\', '/')}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
