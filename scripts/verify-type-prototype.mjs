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

function assert(value, message) {
  if (!value) throw new Error(message);
}

function weatherPayload() {
  const hourly = Array.from({ length: 48 }, () => ({ tempC: 27, feelsLikeC: 27, rainChance: 0, precipMm: 0, windKph: 15, cloudPct: 8, humidity: 52, uv: 3, condition: 'clear' }));
  const daily = Array.from({ length: 7 }, (_, day) => ({ highC: 30 + (day % 2), lowC: 23 + (day % 2), rainChance: 0, uv: 3, windKph: 15, conditionKey: 'clear', conditionLabel: 'Clear', sunrise: '2026-07-11T00:00', sunset: '2026-07-11T23:59' }));
  return {
    ok: true,
    location: { name: 'Strand, Western Cape', lat: -34.12, lon: 18.84 },
    now: { tempC: 27, feelsLikeC: 27, rainChance: 0, cloudPct: 8, humidity: 52, uv: 3, conditionKey: 'clear', conditionLabel: 'Clear', isDay: true, windKph: 15 },
    hourly,
    daily,
    wind_kph: 15,
    maxWindKph: 20,
    gustKph: 24,
    consensus: { confidenceKey: 'high' },
    meta: { localHour: 14, utcOffsetSeconds: 7200, confidence: 'high', sources: [{ name: 'Open-Meteo', ok: true }], sourceConditions: [{ source: 'Open-Meteo', vote: 'clear', desc: 'Clear' }], sourceRanges: [] },
  };
}

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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
    try {
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function openApp(browser, origin, viewport, prototype) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const requests = [];
  context.on('request', (request) => requests.push({ type: request.resourceType(), url: request.url() }));
  await context.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = new NativeDate('2026-07-11T12:00:00Z').valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    window.Date = FixedDate;
    Math.random = () => 0.123456;
    localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.12, lon: 18.84, mode: 'gps' }));
    localStorage.setItem('lang', JSON.stringify('en'));
    localStorage.setItem('pw_install_dismissed_at', String(Date.now()));
  });
  const page = await context.newPage();
  await page.goto(`${origin}/${prototype ? '?type=proto' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY === 'clear');
  await page.waitForFunction(() => {
    const image = document.getElementById('bgImg');
    return image?.complete && image.naturalWidth > 0 && getComputedStyle(document.documentElement).getPropertyValue('--hero-url').includes('webp');
  });
  if (prototype) {
    await page.waitForFunction((desktop) => {
      const ui = document.getElementById('pwTypePrototype');
      const caption = document.getElementById('pwTypePrototypeCaption');
      return ui?.sheet && (!desktop || caption?.sheet);
    }, viewport.width >= 1024);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#pwSplash').waitFor({ state: 'hidden' });
  await page.waitForTimeout(250);
  return { context, page, requests };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const range = document.querySelector('.hero-range');
    const headline = document.getElementById('headline');
    return {
      bodyFamily: style('body').fontFamily,
      captionFamily: style('#headline').fontFamily,
      typeSizes: {
        probably: style('.hero-probably').fontSize,
        range: style('.hero-range').fontSize,
        condition: style('#description').fontSize,
        caption: style('#headline').fontSize,
      },
      text: {
        probably: document.querySelector('.hero-probably').textContent,
        range: range.textContent,
        condition: document.getElementById('description').textContent,
        caption: headline.textContent,
      },
      background: new URL(document.getElementById('bgImg').currentSrc || document.getElementById('bgImg').src).pathname,
      rangeNowrap: style('.hero-range').whiteSpace === 'nowrap',
      rangeOverflowPx: Math.max(0, range.scrollWidth - range.clientWidth),
      documentOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      prototype: document.documentElement.dataset.typePrototype === 'true',
    };
  });
}

async function capturePair(browser, origin, viewport) {
  const result = {};
  for (const prototype of [false, true]) {
    const state = prototype ? 'prototype' : 'current';
    const opened = await openApp(browser, origin, viewport, prototype);
    const file = path.join(output, `${state}-${viewport.label}-${viewport.width}x${viewport.height}.png`);
    await opened.page.screenshot({ path: file });
    result[state] = {
      ...(await snapshot(opened.page)),
      screenshot: path.relative(root, file).replaceAll('\\', '/'),
      stylesheets: opened.requests.filter((request) => request.type === 'stylesheet').map((request) => new URL(request.url).pathname),
      fontRequests: opened.requests.filter((request) => request.type === 'font').map((request) => request.url),
    };
    await opened.context.close();
  }

  assert(JSON.stringify(result.current.text) === JSON.stringify(result.prototype.text), `${viewport.width}px current/prototype copy differs`);
  assert(result.current.background === result.prototype.background, `${viewport.width}px current/prototype background differs`);
  assert(!result.current.prototype && !result.current.stylesheets.some((url) => url.includes('type-prototype')), `${viewport.width}px current state loaded prototype CSS`);
  assert(result.prototype.bodyFamily.includes('Onest Prototype'), `${viewport.width}px prototype did not apply Onest`);
  assert(result.prototype.rangeNowrap, `${viewport.width}px prototype temperature range wrapped`);
  if (viewport.width < 1024) {
    assert(result.prototype.fontRequests.length === 0, `Mobile prototype made font resource requests: ${result.prototype.fontRequests.join(', ')}`);
    assert(!result.prototype.stylesheets.some((url) => url.includes('type-prototype-caption')), 'Mobile prototype loaded the Caveat stylesheet');
    assert(!result.prototype.captionFamily.includes('Caveat Prototype'), 'Mobile prototype applied Caveat');
  } else {
    assert(result.prototype.captionFamily.includes('Caveat Prototype'), `${viewport.width}px prototype did not apply Caveat to the caption`);
    assert(result.prototype.stylesheets.some((url) => url.includes('type-prototype-caption')), `${viewport.width}px prototype did not load the desktop caption stylesheet`);
  }
  return result;
}

async function captureTextZoom(browser, origin, viewport) {
  const opened = await openApp(browser, origin, viewport, true);
  const normal = await snapshot(opened.page);
  await opened.page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await opened.page.waitForTimeout(150);
  const zoomed = await snapshot(opened.page);
  const file = path.join(output, `prototype-text-zoom-200-${viewport.label}-${viewport.width}x${viewport.height}.png`);
  await opened.page.screenshot({ path: file });
  assert(Number.parseFloat(zoomed.typeSizes.probably) > Number.parseFloat(normal.typeSizes.probably), `${viewport.width}px prototype display type ignored 200% text zoom`);
  assert(zoomed.rangeNowrap, `${viewport.width}px 200% text zoom broke the temperature nowrap contract`);
  await opened.context.close();
  return { normal: normal.typeSizes, zoomed: zoomed.typeSizes, rangeOverflowPx: zoomed.rangeOverflowPx, documentOverflowPx: zoomed.documentOverflowPx, screenshot: path.relative(root, file).replaceAll('\\', '/') };
}

mkdirSync(output, { recursive: true });
const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const pairs = {};
  for (const viewport of viewports) {
    const key = `${viewport.width}x${viewport.height}`;
    pairs[key] = await capturePair(browser, origin, viewport);
    console.log(`[type gate ${key}] PASS — same clear copy/background; current=${pairs[key].current.bodyFamily}; prototype=${pairs[key].prototype.bodyFamily}; range nowrap`);
  }

  const mobile = pairs['390x844'].prototype;
  assert(manifest.fonts.onest.totalBytes <= manifest.fonts.onest.budgetBytes, 'Onest exceeds its prototype budget');
  assert(manifest.fonts.caveat.totalBytes <= manifest.fonts.caveat.budgetBytes, 'Caveat exceeds its prototype budget');
  console.log(`[font loading mobile] PASS — default prototype assets=0; proto font-resource requests=${mobile.fontRequests.length}; Caveat stylesheet=false; embedded Onest=${manifest.fonts.onest.totalBytes}/${manifest.fonts.onest.budgetBytes} bytes`);
  console.log(`[font loading desktop] PASS — Caveat desktop-only=${manifest.fonts.caveat.totalBytes}/${manifest.fonts.caveat.budgetBytes} bytes; caption family applied at 1440 and 1920`);

  const zoom = {};
  for (const viewport of [viewports[0], viewports[1]]) {
    const key = `${viewport.width}x${viewport.height}`;
    zoom[key] = await captureTextZoom(browser, origin, viewport);
    console.log(`[text zoom ${key}] CAPTURED — 200% root; Probably ${zoom[key].normal.probably}->${zoom[key].zoomed.probably}; range nowrap; range overflow=${zoom[key].rangeOverflowPx}px; document overflow=${zoom[key].documentOverflowPx}px`);
  }

  const evidence = { condition: 'clear day', pairs, zoom, fontManifest: manifest };
  writeFileSync(path.join(output, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`[type screenshots] PASS — six fair-pair gates + two 200% text-zoom captures in ${path.relative(root, output).replaceAll('\\', '/')}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
