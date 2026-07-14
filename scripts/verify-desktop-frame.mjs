import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { chromium } from 'playwright';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'desktop-postcard');
const glassBaselineCss = transformSync(
  execFileSync('git', ['show', '9424808:assets/app.css'], { cwd: root }).toString(),
  { loader: 'css', minify: true },
).code;
const releaseBaselineCss = transformSync(
  execFileSync('git', ['show', '53f918f:assets/app.css'], { cwd: root }).toString(),
  { loader: 'css', minify: true },
).code;
const conditions = {
  clear: { tempC: 27, rainChance: 0, cloudPct: 8, conditionKey: 'clear', conditionLabel: 'Clear', sunrise: '2026-07-11T00:00', sunset: '2026-07-11T23:59' },
  rain: { tempC: 17, rainChance: 88, cloudPct: 96, conditionKey: 'rain', conditionLabel: 'Rain', sunrise: '2026-07-11T00:00', sunset: '2026-07-11T23:59' },
  fog: { tempC: 10, rainChance: 8, cloudPct: 100, conditionKey: 'fog', conditionLabel: 'Fog', sunrise: '2026-07-11T08:00', sunset: '2026-07-11T17:00' },
};
const desktopViewports = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const screenshotViewports = [...desktopViewports, { width: 2560, height: 1440 }];
const mobileViewports = [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 320, height: 700 }];

function weatherPayload(kind) {
  const c = conditions[kind];
  const hourly = Array.from({ length: 48 }, () => ({ tempC: c.tempC, feelsLikeC: c.tempC, rainChance: c.rainChance, precipMm: c.rainChance ? 2 : 0, windKph: 15, cloudPct: c.cloudPct, humidity: 75, uv: 3, condition: c.conditionKey }));
  const daily = Array.from({ length: 7 }, (_, day) => ({ highC: c.tempC + 3 + (day % 2), lowC: c.tempC - 4 + (day % 2), rainChance: c.rainChance, uv: 3, windKph: 15, conditionKey: c.conditionKey, conditionLabel: c.conditionLabel, sunrise: c.sunrise, sunset: c.sunset }));
  return {
    ok: true,
    location: { name: 'Strand, Western Cape', lat: -34.12, lon: 18.84 },
    now: { ...c, feelsLikeC: c.tempC, uv: 3, isDay: kind !== 'fog', windKph: 15 },
    hourly, daily, wind_kph: 15, maxWindKph: 20, gustKph: 24,
    consensus: { confidenceKey: 'high' },
    meta: { localHour: kind === 'fog' ? 2 : 14, utcOffsetSeconds: 7200, confidence: 'high', sources: [{ name: 'Open-Meteo', ok: true }], sourceConditions: [{ source: 'Open-Meteo', vote: c.conditionKey, desc: c.conditionLabel }], sourceRanges: [] },
  };
}

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const kind = conditions[req.headers['x-pw-test-condition']] ? req.headers['x-pw-test-condition'] : 'clear';
      const body = pathname === '/api/weather' ? weatherPayload(kind)
        : pathname === '/api/locate' ? { ok: true, lat: -34.12, lon: 18.84, name: 'Strand, Western Cape' }
          : pathname === '/api/version' ? { buildId: 'local' } : {};
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname === '/install' ? 'install.html' : pathname.slice(1);
    const file = path.resolve(dist, relative);
    if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) return res.writeHead(403).end();
    try {
      const styleBaseline = req.headers['x-pw-style-baseline'];
      const body = relative === 'assets/app.css' && styleBaseline === 'pre-glass' ? glassBaselineCss
        : relative === 'assets/app.css' && styleBaseline === 'release' ? releaseBaselineCss
          : readFileSync(file);
      const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' };
      if (['.webp', '.jpg'].includes(path.extname(file))) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      res.writeHead(200, headers).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function openApp(browser, origin, viewport, { condition = 'clear', lang = 'en', styleBaseline = '', measure = false } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'no-preference', extraHTTPHeaders: { 'x-pw-test-condition': condition, 'x-pw-style-baseline': styleBaseline } });
  const imageRequests = [];
  context.on('request', (request) => { if (request.resourceType() === 'image') imageRequests.push(new URL(request.url()).pathname); });
  await context.addInitScript(({ selectedLang }) => {
    const NativeDate = Date;
    const fixedNow = new NativeDate('2026-07-11T00:30:00Z').valueOf();
    class FixedDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } }
    window.Date = FixedDate;
    Math.random = () => 0.123456;
    localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.12, lon: 18.84, mode: 'gps' }));
    localStorage.setItem('lang', JSON.stringify(selectedLang));
    localStorage.setItem('pw_install_dismissed_at', String(Date.now()));
    window.__PW_SHARE_CALLS = [];
    window.__PW_GEO_CALLS = 0;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.__PW_SHARE_CALLS.push(data); } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(ok) { window.__PW_GEO_CALLS += 1; ok({ coords: { latitude: -34.12, longitude: 18.84, accuracy: 10 } }); } } });
  }, { selectedLang: lang });
  const page = await context.newPage();
  const performanceClient = measure ? await context.newCDPSession(page) : null;
  if (performanceClient) await performanceClient.send('Performance.enable');
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((expected) => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY === expected, conditions[condition].conditionKey);
  await page.waitForFunction(() => { const image = document.getElementById('bgImg'); return image?.complete && image.naturalWidth > 0 && getComputedStyle(document.documentElement).getPropertyValue('--hero-url').includes('webp'); });
  await page.locator('#pwSplash').waitFor({ state: 'hidden' });
  await page.waitForTimeout(500);
  return { page, context, imageRequests, performanceClient };
}

function assert(value, message) { if (!value) throw new Error(message); }

async function snapshotGeometry(page) {
  return page.evaluate(() => {
    const box = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const backdrop = getComputedStyle(document.getElementById('bg'), '::before');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      image: box('#bgImg'), caption: box('#headline'), voice: box('#home-screen'), nav: box('.nav'), strip: box('#week-screen'), particles: box('#particles'),
      actions: [box('#shareBtn'), box('#navHourlyHome'), box('#myLocationHome')],
      hero: { probably: box('.hero-probably'), range: box('.hero-range'), nowrap: document.querySelector('.hero-range').scrollWidth <= document.querySelector('.hero-range').clientWidth },
      z: { bg: style('#bg').zIndex, container: style('.container').zIndex, home: style('#home-screen').zIndex, caption: style('#headline').zIndex },
      colors: { temp: style('#temp').color, condition: style('#description').color, caption: style('#headline').color },
      backdrop: { backgroundImage: backdrop.backgroundImage, filter: backdrop.filter },
      captionText: document.getElementById('headline').textContent,
      stripDays: document.querySelectorAll('#week-screen .daily-row-tappable').length,
      particlesDisplay: style('#particles').display,
    };
  });
}

async function homeScrimGeometry(page) {
  return page.evaluate(() => {
    const home = document.querySelector('main#home-screen.main');
    const image = document.getElementById('bgImg');
    const homeBox = home.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const style = getComputedStyle(home, '::before');
    const px = (value) => Number.parseFloat(value) || 0;
    const active = style.content !== 'none';
    const box = active ? {
      left: homeBox.left + px(style.left),
      top: homeBox.top + px(style.top),
      right: homeBox.right - px(style.right),
      bottom: homeBox.bottom - px(style.bottom),
    } : null;
    const overlapWidth = box ? Math.max(0, Math.min(box.right, imageBox.right) - Math.max(box.left, imageBox.left)) : 0;
    const overlapHeight = box ? Math.max(0, Math.min(box.bottom, imageBox.bottom) - Math.max(box.top, imageBox.top)) : 0;
    return {
      active,
      content: style.content,
      backgroundImage: style.backgroundImage,
      homeZ: getComputedStyle(home).zIndex,
      isolation: getComputedStyle(home).isolation,
      box,
      image: { left: imageBox.left, top: imageBox.top, right: imageBox.right, bottom: imageBox.bottom },
      overlapWidth,
      overlapHeight,
    };
  });
}

async function glassBandRegression(browser, origin) {
  const screenshotDir = path.join(output, 'glass-band');
  mkdirSync(screenshotDir, { recursive: true });
  const evidence = [];
  for (const viewport of desktopViewports) {
    for (const condition of ['clear', 'rain']) {
      for (const [label, styleBaseline] of [['before', 'pre-glass'], ['after', '']]) {
        const { page, context } = await openApp(browser, origin, viewport, { condition, styleBaseline });
        const scrim = await homeScrimGeometry(page);
        if (styleBaseline) {
          assert(scrim.active && scrim.overlapWidth > 100 && scrim.overlapHeight > 100, `Baseline glass band was not reproduced at ${viewport.width}x${viewport.height}: ${JSON.stringify(scrim)}`);
        } else {
          assert(!scrim.active && scrim.overlapWidth === 0, `Home scrim still crosses the polaroid at ${viewport.width}x${viewport.height}`);
        }
        const file = path.join(screenshotDir, `${label}-${condition}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: file });
        evidence.push({ label, condition, viewport: `${viewport.width}x${viewport.height}`, scrim, screenshot: path.relative(root, file).replaceAll('\\', '/') });
        await context.close();
      }
    }
  }
  return evidence;
}

async function mobileComparison(browser, origin) {
  const before = {}, after = {};
  for (const viewport of mobileViewports) {
    for (const [label, styleBaseline] of [['before', 'release'], ['after', '']]) {
      const { page, context } = await openApp(browser, origin, viewport, { styleBaseline });
      const geometry = await page.evaluate(() => {
        const box = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
        return { container: box('.container'), nav: box('.nav'), image: box('#bgImg'), particles: box('#particles'), actions: ['#shareBtn', '#navHourlyHome', '#myLocationHome'].map(box), hero: ['.hero-probably', '.hero-range'].map(box), postcardVar: getComputedStyle(document.documentElement).getPropertyValue('--postcard-unit').trim() };
      });
      (label === 'before' ? before : after)[`${viewport.width}x${viewport.height}`] = geometry;
      await context.close();
    }
  }
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'mobile-comparison.json'), `${JSON.stringify({ before, after }, null, 2)}\n`);
  const stableGeometry = ({ actions, ...stable }) => stable;
  for (const viewport of mobileViewports) {
    const key = `${viewport.width}x${viewport.height}`;
    assert(JSON.stringify(stableGeometry(before[key])) === JSON.stringify(stableGeometry(after[key])), `Non-action mobile geometry differs from 53f918f at ${key}`);
  }
  const expectedActions = {
    '390x844': [[12, 714, 116.65625, 46], [136.671875, 714, 116.65625, 46], [261.34375, 714, 116.65625, 46]],
    '360x800': [[12, 670, 106.65625, 46], [126.671875, 670, 106.65625, 46], [241.34375, 670, 106.65625, 46]],
    '320x700': [[12, 570, 93.328125, 46], [113.3359375, 570, 93.328125, 46], [214.671875, 570, 93.328125, 46]],
  };
  for (const [key, expected] of Object.entries(expectedActions)) assert(JSON.stringify(after[key].actions) === JSON.stringify(expected), `Ruled Share / Hourly / My Location geometry drifted at ${key}: ${JSON.stringify(after[key].actions)}`);
  assert(Object.values(after).every((value) => value.postcardVar === ''), 'Postcard variables leaked below 1024px');
  return { result: 'PASS — non-action geometry matches 53f918f; Share / Hourly / My Location slots re-pinned', viewports: Object.keys(after), before, after };
}

async function actionRowEvidence(browser, origin) {
  const screenshotDir = path.join(root, 'output', 'design-wave', 'action-row');
  mkdirSync(screenshotDir, { recursive: true });
  const evidence = [];
  for (const item of [{ name: 'mobile', width: 390, height: 844 }, { name: 'postcard', width: 1440, height: 900 }]) {
    for (const [label, styleBaseline] of [['before', 'release'], ['after', '']]) {
      const { page, context } = await openApp(browser, origin, item, { styleBaseline });
      const boxes = await page.evaluate(() => Object.fromEntries(['shareBtn', 'navHourlyHome', 'myLocationHome'].map((id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return [id, { x: rect.x, width: rect.width }];
      })));
      if (label === 'before') assert(boxes.navHourlyHome.x < boxes.shareBtn.x && boxes.shareBtn.x < boxes.myLocationHome.x, `53f918f action baseline was not reproduced at ${item.name}`);
      else assert(boxes.shareBtn.x < boxes.navHourlyHome.x && boxes.navHourlyHome.x < boxes.myLocationHome.x, `Ruled action order failed at ${item.name}`);
      const file = path.join(screenshotDir, `${label}-${item.name}-${item.width}x${item.height}.png`);
      await page.screenshot({ path: file });
      evidence.push({ label, surface: item.name, viewport: `${item.width}x${item.height}`, boxes, screenshot: path.relative(root, file).replaceAll('\\', '/') });
      await context.close();
    }
  }
  return evidence;
}

async function typeAndColourContract(browser, origin) {
  const results = [];
  for (const viewport of [mobileViewports[0], desktopViewports[0]]) {
    const { page, context } = await openApp(browser, origin, viewport);
    const result = await page.evaluate(() => {
      const bodyFamily = getComputedStyle(document.body).fontFamily;
      const controls = [...document.querySelectorAll('button, input, select, textarea')];
      const mismatches = controls.filter((element) => getComputedStyle(element).fontFamily !== bodyFamily).map((element) => element.id || element.tagName);
      const amber = 'rgb(245, 166, 35)';
      const amberElements = [...document.querySelectorAll('body *')].filter((element) => {
        const style = getComputedStyle(element);
        return style.color === amber || style.backgroundColor === amber;
      }).map((element) => element.id || element.className || element.tagName);
      return { bodyFamily, controls: controls.length, mismatches, conditionColour: getComputedStyle(document.getElementById('description')).color, amberElements };
    });
    assert(result.mismatches.length === 0, `Controls escaped the app font cascade at ${viewport.width}: ${result.mismatches.join(', ')}`);
    assert(result.conditionColour === 'rgb(245, 166, 35)', `Condition amber drifted at ${viewport.width}: ${result.conditionColour}`);
    assert(JSON.stringify(result.amberElements) === JSON.stringify(['description']), `Amber escaped the condition at ${viewport.width}: ${result.amberElements.join(', ')}`);
    results.push({ viewport: `${viewport.width}x${viewport.height}`, ...result });
    await context.close();
  }
  return results;
}

async function calmScreenEvidence(browser, origin) {
  const viewport = { width: 1440, height: 900 };
  const screenshotDir = path.join(root, 'output', 'design-wave', 'calm-screens');
  mkdirSync(screenshotDir, { recursive: true });
  const { page, context } = await openApp(browser, origin, viewport);
  await page.waitForTimeout(900);
  const homeSignature = async () => page.evaluate(() => {
    const box = (selector) => { const rect = document.querySelector(selector).getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; };
    return { image: box('#bgImg'), home: box('#home-screen'), headline: box('#headline'), imageDisplay: getComputedStyle(document.getElementById('bgImg')).display, bodyHome: document.body.classList.contains('home-active') };
  });
  const beforeHome = await homeSignature();
  const screenshots = [];
  const destinations = [
    ['hourly', '#navHourlyHome', '#hourly-screen'],
    ['weekly', '#navWeek', '#week-screen'],
    ['search', '#navSearch', '#search-screen'],
    ['settings', '#navSettings', '#settings-screen'],
    ['sources', '#navSources', '#sources-screen'],
  ];
  for (const [name, nav, screen] of destinations) {
    await page.click(nav);
    await page.locator(screen).waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    const state = await page.evaluate((selector) => {
      const visiblePanels = [...document.querySelectorAll('.screenPanel')].filter((panel) => getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().width > 0);
      const panel = document.querySelector(selector).getBoundingClientRect();
      const backdrop = getComputedStyle(document.getElementById('bg'), '::before');
      return {
        homeActive: document.body.classList.contains('home-active'),
        sharpImage: getComputedStyle(document.getElementById('bgImg')).display,
        pin: getComputedStyle(document.getElementById('scrim')).display,
        location: getComputedStyle(document.getElementById('location')).display,
        headline: getComputedStyle(document.getElementById('headline')).display,
        visiblePanels: visiblePanels.map((element) => element.id),
        panel: { x: panel.x, width: panel.width },
        backdrop: { image: backdrop.backgroundImage, filter: backdrop.filter },
      };
    }, screen);
    assert(!state.homeActive && state.sharpImage === 'none' && state.pin === 'none' && state.location === 'none' && state.headline === 'none', `Sharp Postcard artifacts remain on ${name}: ${JSON.stringify(state)}`);
    assert(JSON.stringify(state.visiblePanels) === JSON.stringify([screen.slice(1)]), `Expected one visible panel on ${name}: ${state.visiblePanels.join(', ')}`);
    assert(Math.round(state.panel.width) === 520 && Math.abs((state.panel.x + state.panel.width / 2) - viewport.width / 2) < 1, `${name} panel is not centred: ${JSON.stringify(state.panel)}`);
    assert(state.backdrop.image.includes('webp') && state.backdrop.filter.includes('blur(28px)'), `${name} lost the current-weather backdrop`);
    const file = path.join(screenshotDir, `${name}-1440x900.png`);
    await page.screenshot({ path: file });
    screenshots.push(path.relative(root, file).replaceAll('\\', '/'));
    await page.click('#navHome');
    await page.locator('#home-screen').waitFor({ state: 'visible' });
    await page.waitForTimeout(1400);
    const afterHome = await homeSignature();
    assert(JSON.stringify(afterHome) === JSON.stringify(beforeHome), `Home Postcard changed after visiting ${name}: before=${JSON.stringify(beforeHome)} after=${JSON.stringify(afterHome)}`);
  }
  const homeFile = path.join(screenshotDir, 'home-unchanged-1440x900.png');
  await page.screenshot({ path: homeFile });
  await context.close();
  return { result: 'PASS — five calm destinations; Home geometry unchanged', screenshots, homeScreenshot: path.relative(root, homeFile).replaceAll('\\', '/') };
}

async function clickThrough(browser, origin, viewport) {
  const { page, context } = await openApp(browser, origin, viewport);
  const visible = async (selector) => assert(await page.locator(selector).isVisible(), `${selector} not visible at ${viewport.width}x${viewport.height}`);
  for (const selector of ['#navHourlyHome', '#shareBtn', '#myLocationHome', '#navHome', '#navWeek', '#navSearch', '#navSettings', '#navSources', '#languageBtn']) await visible(selector);
  const actionOrder = await page.evaluate(() => ['#shareBtn', '#navHourlyHome', '#myLocationHome'].map((selector) => document.querySelector(selector).getBoundingClientRect().x));
  assert(actionOrder[0] < actionOrder[1] && actionOrder[1] < actionOrder[2], `Action order is not Share / Hourly / My Location at ${viewport.width}`);
  await page.click('#languageBtn'); await visible('#languageMenu'); await page.keyboard.press('Escape');
  await page.click('#shareBtn'); assert(await page.evaluate(() => window.__PW_SHARE_CALLS.length) === 1, 'Share did not fire');
  await page.click('#navHourlyHome'); await visible('#hourly-screen');
  await page.click('#navHome'); await visible('#home-screen');
  const beforeGeo = await page.evaluate(() => window.__PW_GEO_CALLS); await page.click('#myLocationHome'); await page.waitForFunction((before) => window.__PW_GEO_CALLS > before, beforeGeo);
  for (const [nav, screen] of [['#navHome', '#home-screen'], ['#navWeek', '#week-screen'], ['#navSearch', '#search-screen'], ['#navSettings', '#settings-screen'], ['#navSources', '#sources-screen']]) {
    await page.click(nav); await visible(screen);
    if (screen !== '#home-screen') {
      const panel = await page.locator(screen).boundingBox();
      assert(panel.width <= 521 && Math.abs((panel.x + panel.width / 2) - viewport.width / 2) < 2, `${screen} is not centred at ${viewport.width}`);
    }
  }
  await context.close();
  return { viewport: `${viewport.width}x${viewport.height}`, actions: 'Share, Hourly, My Location PASS (left→right)', nav: 'Home, Weekly, Search, Settings, Sources PASS', language: 'PASS' };
}

async function responsiveGeometry(browser, origin) {
  const { page: tablet, context: tabletContext } = await openApp(browser, origin, { width: 1023, height: 900 });
  const tabletResult = await tablet.evaluate(() => ({ container: document.querySelector('.container').getBoundingClientRect().width, nav: document.querySelector('.nav').getBoundingClientRect().width, image: document.getElementById('bgImg').getBoundingClientRect().width, postcardVar: getComputedStyle(document.documentElement).getPropertyValue('--postcard-unit').trim() }));
  assert(Math.round(tabletResult.container) === 520 && Math.round(tabletResult.nav) === 520 && Math.round(tabletResult.image) === 520 && tabletResult.postcardVar === '', '1023px tablet frame changed');
  await tabletContext.close();
  const centres = [];
  for (const width of [1280, 1440, 1920, 2560]) {
    const { page, context } = await openApp(browser, origin, { width, height: width === 1280 ? 900 : width === 1440 ? 900 : width === 1920 ? 1080 : 1440 });
    const geometry = await snapshotGeometry(page);
    const unionLeft = Math.min(geometry.image.x, geometry.voice.x); const unionRight = Math.max(geometry.image.right, geometry.voice.right);
    const offsetPx = ((unionLeft + unionRight) / 2) - (width / 2);
    assert(Math.abs(offsetPx) < 80, `Composition is not centred at ${width}`);
    centres.push({ width, centreOffsetPx: offsetPx });
    await context.close();
  }
  const shortHeights = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 700 }]) {
    const { page, context } = await openApp(browser, origin, viewport);
    const geometry = await snapshotGeometry(page);
    const actionsBottom = Math.max(...geometry.actions.map((action) => action.bottom));
    assert(actionsBottom + 8 <= geometry.strip.y && geometry.image.bottom + 8 <= geometry.strip.y, `Postcard overlaps forecast strip at ${viewport.width}x${viewport.height}`);
    shortHeights.push({ viewport: `${viewport.width}x${viewport.height}`, imageBottom: geometry.image.bottom, actionsBottom, stripTop: geometry.strip.y });
    await context.close();
  }
  return { tablet: tabletResult, postcardCentres: centres, shortHeights };
}

async function captionEvidence(browser, origin) {
  const evidence = [];
  for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
    const lines = Object.values(WEATHER_COPY.witty).flatMap((bank) => bank?.[lang] || []);
    const { page, context } = await openApp(browser, origin, { width: 1024, height: 900 }, { lang });
    const measurement = await page.locator('#headline').evaluate((element, candidates) => {
      const clone = element.cloneNode(false);
      const availableWidth = element.clientWidth;
      const availableHeight = element.clientHeight;
      Object.assign(clone.style, { position: 'fixed', left: '-10000px', top: '0', width: `${availableWidth}px`, minHeight: '0', maxHeight: 'none', height: 'auto', overflow: 'visible', display: 'block', transform: 'none', webkitLineClamp: 'unset' });
      document.body.appendChild(clone);
      let worst = { text: '', naturalHeight: 0, naturalWidth: 0 };
      for (const line of candidates) {
        clone.textContent = line;
        const candidate = { text: line, naturalHeight: clone.scrollHeight, naturalWidth: clone.scrollWidth };
        if (candidate.naturalHeight > worst.naturalHeight || (candidate.naturalHeight === worst.naturalHeight && candidate.naturalWidth > worst.naturalWidth)) worst = candidate;
      }
      const computed = getComputedStyle(element);
      clone.remove();
      return { ...worst, availableWidth, availableHeight, fontSize: computed.fontSize, lineHeight: computed.lineHeight };
    }, lines);
    measurement.fits = measurement.naturalWidth <= measurement.availableWidth + 1 && measurement.naturalHeight <= measurement.availableHeight + 1;
    assert(measurement.fits, `${lang} witty line clips naturally: ${measurement.text}`);
    evidence.push({ lang, characters: measurement.text.length, testedLines: lines.length, ...measurement });
    await context.close();
  }
  return evidence;
}

async function performancePass(browser, origin, baseline) {
  const trials = [];
  for (let trial = 0; trial < 5; trial += 1) {
    const { page, context, performanceClient } = await openApp(browser, origin, { width: 2560, height: 1440 }, { styleBaseline: baseline ? 'release' : '', measure: true });
    await page.waitForTimeout(500);
    const metrics = Object.fromEntries((await performanceClient.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
    const paints = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime])));
    const lcpMs = await page.evaluate(() => new Promise((resolve) => { let value = null; const observer = new PerformanceObserver((list) => { value = list.getEntries().at(-1)?.startTime ?? value; }); observer.observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => { observer.disconnect(); resolve(value); }, 100); }));
    trials.push({ fcpMs: paints['first-contentful-paint'], lcpMs, taskDurationMs: metrics.TaskDuration * 1000, layoutDurationMs: metrics.LayoutDuration * 1000 });
    await context.close();
  }
  const median = (key) => trials.map(key).filter(Number.isFinite).sort((a, b) => a - b)[2] ?? null;
  return { trials: 5, median: { fcpMs: median((x) => x.fcpMs), lcpMs: median((x) => x.lcpMs), taskDurationMs: median((x) => x.taskDurationMs), layoutDurationMs: median((x) => x.layoutDurationMs) } };
}

async function verify(browser, origin) {
  const glassBand = await glassBandRegression(browser, origin);
  for (const viewport of desktopViewports) {
    const before = glassBand.find((item) => item.label === 'before' && item.condition === 'clear' && item.viewport === `${viewport.width}x${viewport.height}`);
    const after = glassBand.find((item) => item.label === 'after' && item.condition === 'clear' && item.viewport === `${viewport.width}x${viewport.height}`);
    console.log(`[postcard glass-band ${before.viewport}] PASS: before scrim overlap ${before.scrim.overlapWidth.toFixed(1)}x${before.scrim.overlapHeight.toFixed(1)}px; after content ${after.scrim.content}, overlap ${after.scrim.overlapWidth}px`);
  }
  const mobile = await mobileComparison(browser, origin);
  console.log(`[mobile geometry] ${mobile.result}: ${mobile.viewports.join(', ')}`);
  const actionRows = await actionRowEvidence(browser, origin);
  console.log(`[action screenshots] PASS: ${actionRows.map((item) => `${item.label}-${item.surface}`).join(', ')}`);
  const typeAndColour = await typeAndColourContract(browser, origin);
  console.log(`[type + colour] PASS: ${typeAndColour.map((item) => `${item.viewport} ${item.controls} controls inherit; amber=${item.amberElements.join(',')}`).join('; ')}`);
  const calmScreens = await calmScreenEvidence(browser, origin);
  console.log(`[calm desktop screens] ${calmScreens.result}: Hourly, Weekly, Search, Settings, Sources`);
  const responsive = await responsiveGeometry(browser, origin);
  console.log(`[tablet 1023px] PASS: container/nav/image ${responsive.tablet.container}/${responsive.tablet.nav}/${responsive.tablet.image}px; Postcard inactive`);
  console.log(`[postcard centring] PASS: ${responsive.postcardCentres.map((item) => `${item.width}px=${item.centreOffsetPx.toFixed(1)}px`).join(', ')}`);
  console.log(`[short desktop] PASS: ${responsive.shortHeights.map((item) => `${item.viewport} image/actions ${item.imageBottom.toFixed(1)}/${item.actionsBottom.toFixed(1)} < strip ${item.stripTop.toFixed(1)}`).join('; ')}`);
  const clicks = [];
  for (const viewport of [mobileViewports[0], ...desktopViewports]) { const result = await clickThrough(browser, origin, viewport); clicks.push(result); console.log(`[click-through ${result.viewport}] PASS: ${result.actions}; ${result.nav}; Language ${result.language}`); }
  const captions = await captionEvidence(browser, origin);
  for (const item of captions.filter((item) => ['af', 'xh'].includes(item.lang))) console.log(`[caption ${item.lang}] PASS: ${item.testedLines} lines tested; worst ${item.characters} chars, natural ${item.naturalWidth}x${item.naturalHeight} within ${item.availableWidth}x${item.availableHeight}`);

  const screenshotDir = path.join(output, 'screenshots'); mkdirSync(screenshotDir, { recursive: true });
  const screenshots = [];
  for (const condition of Object.keys(conditions)) for (const viewport of screenshotViewports) {
    const { page, context, imageRequests } = await openApp(browser, origin, viewport, { condition });
    const geometry = await snapshotGeometry(page);
    assert(geometry.z.bg === '-1' && Number(geometry.z.home) >= 30 && Number(geometry.z.caption) >= 31, `Z-order failed at ${viewport.width}`);
    assert(geometry.colors.temp === 'rgb(255, 255, 255)' && geometry.colors.caption === 'rgb(36, 33, 29)', `Solid text colors failed at ${viewport.width}`);
    assert(geometry.hero.nowrap && geometry.stripDays === 7 && geometry.particlesDisplay === 'none', `Postcard content contract failed at ${viewport.width}`);
    assert(geometry.caption.x >= geometry.image.x - 4 && geometry.caption.right <= geometry.image.right + 4 && geometry.caption.y > geometry.image.y + (geometry.image.height * 0.7) && geometry.caption.bottom <= geometry.image.bottom + 4, `Caption escaped the polaroid at ${viewport.width}`);
    assert((await page.locator('#shareBtn').textContent())?.trim().endsWith('Share'), `Share label did not paint at ${condition} ${viewport.width}`);
    const unionLeft = Math.min(geometry.image.x, geometry.voice.x); const unionRight = Math.max(geometry.image.right, geometry.voice.right);
    assert(Math.abs(((unionLeft + unionRight) / 2) - (viewport.width / 2)) < 80, `Composition is not centred at ${viewport.width}`);
    const heroPath = await page.locator('#bgImg').evaluate((image) => new URL(image.currentSrc).pathname);
    assert(imageRequests.filter((requestPath) => requestPath === heroPath).length >= 1, 'Hero was not requested');
    const transfers = await page.locator('#bgImg').evaluate((image) => performance.getEntriesByName(image.currentSrc).map((entry) => entry.transferSize));
    assert(transfers.filter((bytes) => bytes > 0).length <= 1, `Hero transferred more than once: ${transfers.join(',')}`);
    const file = path.join(screenshotDir, `${condition}-${viewport.width}x${viewport.height}.png`); await page.screenshot({ path: file }); screenshots.push(path.relative(root, file).replaceAll('\\', '/'));
    await context.close();
  }
  const performance = { before: await performancePass(browser, origin, true), after: await performancePass(browser, origin, false) };
  assert(performance.after.median.fcpMs < 500 && performance.after.median.lcpMs < 500, 'Postcard desktop paint exceeded 500ms locally');
  console.log(`[perf median 2560x1440] before FCP ${performance.before.median.fcpMs}ms / LCP ${performance.before.median.lcpMs}ms / task ${performance.before.median.taskDurationMs.toFixed(2)}ms; after FCP ${performance.after.median.fcpMs}ms / LCP ${performance.after.median.lcpMs}ms / task ${performance.after.median.taskDurationMs.toFixed(2)}ms`);
  const report = { glassBand, actionRows, typeAndColour, calmScreens, clicks, mobile, responsive, captions, particles: 'off at >=1024px; unchanged below', screenshots, performance };
  mkdirSync(output, { recursive: true }); writeFileSync(path.join(output, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try { console.log(JSON.stringify(await verify(browser, origin), null, 2)); }
finally { await browser.close(); server.close(); }
