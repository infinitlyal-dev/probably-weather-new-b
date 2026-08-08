// M2 visual gate — nav + page chrome.
//
// Shoots every secondary screen as a real full-screen page, plus the 200%-zoom
// header case that was ruled in from the someday list. Also PROBES the things a
// screenshot cannot prove: that no app header survives above a page, that the
// panel is opaque (not a translucent sheet over Home), that the page body's
// scroll clears the nav, and that Share never takes the active state.
//
//   node scripts/verify-m2-chrome.mjs  ->  output/m2-chrome/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'm2-chrome');
const DATE = '2026-08-08';

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 14, rainChance: (i % 7) * 8, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 88, humidity: 74,
    uv: i % 12 < 5 ? 4 : 0, condition: (i % 7) > 4 ? 'rain' : 'cloudy',
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
      sourceConditions: [], sourceRanges: [
        { name: 'Open-Meteo', minTemp: 11, maxTemp: 17 },
        { name: 'WeatherAPI', minTemp: 9, maxTemp: 18 },
        { name: 'MET Norway', minTemp: 13, maxTemp: 17 },
        { name: 'Pirate Weather', minTemp: 13, maxTemp: 16 },
        { name: 'Tomorrow.io', minTemp: 14, maxTemp: 16 },
      ],
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

async function open(zoom = 1) {
  const ctx = await browser.newContext({
    viewport: { width: Math.round(390 / zoom), height: Math.round(844 / zoom) },
    deviceScaleFactor: 2 * zoom, isMobile: true, hasTouch: true,
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

// The probe: what a screenshot cannot show.
const PROBE = () => {
  const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const panel = [...document.querySelectorAll('.screenPanel')].find((p) => vis(p));
  const cs = panel ? getComputedStyle(panel) : null;
  const body = panel?.querySelector('.screen-panel-body');
  const navEl = document.querySelector('.nav');
  const navRect = navEl ? navEl.getBoundingClientRect() : { top: NaN };
  return {
    panel: panel?.id ?? null,
    // A real page: opaque surface, no blur, covering to the nav.
    opaque: cs ? !/rgba\(.*0(\.\d+)?\)$/.test(cs.backgroundColor) : null,
    blurred: cs ? cs.backdropFilter !== 'none' && cs.backdropFilter !== '' : null,
    panelTop: panel ? Math.round(panel.getBoundingClientRect().top) : null,
    panelBottom: panel ? Math.round(panel.getBoundingClientRect().bottom) : null,
    navTop: Number.isFinite(navRect.top) ? Math.round(navRect.top) : null,
    // No app header above the page. This has to be a PAINT-ORDER test, not a
    // geometric one: the panel now covers the whole viewport, so an intersection
    // check returns OVERLAPS for any in-DOM header regardless of what is on top
    // — a probe whose failure signal fires unconditionally proves nothing.
    // What matters is who owns the pixel where the header sits.
    appHeaderVisible: (() => {
      const h = document.querySelector('.header');
      if (!h || !panel) return null;
      const r = h.getBoundingClientRect();
      if (!vis(h) || r.height === 0) return 'covered';
      const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      if (!top) return 'covered';
      return panel.contains(top) || top === panel ? 'covered' : `SHOWS:${top.id || top.className || top.tagName}`;
    })(),
    hasBack: !!panel?.querySelector('.page-back'),
    bodyPadBottom: body ? getComputedStyle(body).paddingBottom : null,
    bodyScrollClears: body ? (body.scrollHeight <= body.clientHeight + 1 ? 'fits' : 'scrolls') : null,
    activeNav: [...document.querySelectorAll('.nav button')]
      .filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.id),
    shareActive: document.querySelector('#navShare')?.getAttribute('aria-current') ?? 'none',
  };
};

const results = [];
const SCREENS = [
  ['home', null],
  ['weekly', '#navWeek'],
  ['search', '#navSearch'],
  ['settings', '#navSettings'],
  ['sources', '#settingsSourcesRow'],
  ['hourly', '#homeHourly'],
];

for (const [name, sel] of SCREENS) {
  const { ctx, page } = await open(1);
  if (sel === '#settingsSourcesRow') { await page.click('#navSettings'); await page.waitForTimeout(300); }
  if (sel) { await page.click(sel); await page.waitForTimeout(500); }
  const probe = await page.evaluate(PROBE);
  const file = path.join(output, `m2-${name}-390x844.png`);
  await page.screenshot({ path: file });
  results.push({ name, ...probe });
  await ctx.close();
}

// The language menu must paint ABOVE the hero card. position:static silently
// discarded the picker z-index and the dropdown rendered behind it.
{
  const { ctx, page } = await open(1);
  await page.click('#languageBtn');
  await page.waitForTimeout(400);
  const menu = await page.evaluate(() => {
    const m = document.getElementById('languageMenu');
    const r = m.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + 12);
    const top = document.elementFromPoint(cx, cy);
    return {
      visible: getComputedStyle(m).display !== 'none' && r.height > 0,
      pickerPosition: getComputedStyle(document.querySelector('.language-picker')).position,
      onTopAtMenu: top ? (top.id || top.className || top.tagName) : null,
      menuOwnsPoint: !!(top && (top.id === 'languageMenu' || m.contains(top))),
    };
  });
  await page.screenshot({ path: path.join(output, 'm2-language-menu.png') });
  results.push({ name: 'languageMenu', ...menu });
  await ctx.close();
}

// Search must be full-bleed at 501-768px, where its own max-width used to win.
{
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West', lat: -34.08, lon: 18.85, mode: 'gps' })); localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5)); } catch (_) {} });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('#navSearch');
  await page.waitForTimeout(400);
  // The footer is display:none unless the list is in EDIT mode, so that is the
  // only state where the adversary's clip mechanism can actually fire.
  await page.evaluate(() => document.querySelector('#search-screen').classList.add('is-editing'));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const p = document.querySelector('#search-screen').getBoundingClientRect();
    const f = document.querySelector('#search-screen .screen-panel-footer');
    const fr = f.getBoundingClientRect();
    return { panelLeft: Math.round(p.left), panelWidth: Math.round(p.width), viewport: window.innerWidth,
      fullBleed: p.left <= 0.5 && p.width >= window.innerWidth - 0.5,
      // The adversary's concern was a CLIP with no scroll container, not
      // being below the fold. Reachability is the test.
      footerH: Math.round(fr.height),
      panelScrollable: (() => { const el = document.querySelector('#search-screen'); return el.scrollHeight > el.clientHeight; })(),
      footerReachable: (() => {
        const el = document.querySelector('#search-screen');
        el.scrollTop = el.scrollHeight;
        const b = f.getBoundingClientRect();
        const navTop = document.querySelector('.nav').getBoundingClientRect().top;
        return b.height > 0 && b.bottom <= navTop + 1;
      })() };
  });
  await page.screenshot({ path: path.join(output, 'm2-search-700w.png') });
  results.push({ name: 'search700', ...r });
  await ctx.close();
}

// The >=769px frame must not see any of this. M2 put five back buttons into the
// markup but styled .page-back only inside the mobile block, so above the
// breakpoint they fell back to UA buttons stretched full-width by the column-flex
// header — and the two that PREVIOUSLY had a styled back control lost it. The
// desktop gate has no assertion that reaches these, so the check lives here.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West', lat: -34.08, lon: 18.85, mode: 'gps' })); localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5)); } catch (_) {} });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // display:none is computed on the element itself, so the three new buttons can
  // be read without opening their screens.
  const newButtons = await page.evaluate(() => ['weekBack', 'searchBack', 'settingsBack'].map((id) => {
    const el = document.getElementById(id);
    return el ? { id, display: getComputedStyle(el).display } : { id, missing: true };
  }));
  // The two kept buttons need real layout, so open each screen the way a user
  // would rather than force-showing a hidden panel (which measures 0 wide).
  const keptButtons = [];
  for (const [id, open] of [['hourlyBack', ['.nav-hourly-pill']], ['sourcesBack', ['#navSettings', '#settingsSourcesRow']]]) {
    for (const sel of open) { await page.click(sel); await page.waitForTimeout(350); }
    keptButtons.push(await page.evaluate((btnId) => {
      const el = document.getElementById(btnId);
      if (!el) return { id: btnId, missing: true };
      const r = el.getBoundingClientRect();
      const panel = el.closest('.screenPanel').getBoundingClientRect();
      return {
        id: btnId, display: getComputedStyle(el).display,
        width: Math.round(r.width), panelWidth: Math.round(panel.width),
        text: el.textContent.trim(),
        // The regression signature: a UA button stretched by the column-flex header.
        fullWidthSlab: r.width >= panel.width - 1,
      };
    }, id));
    await page.click('#navHome');
    await page.waitForTimeout(300);
  }
  const desktop = { newButtons, keptButtons };
  desktop.newHidden = newButtons.every((b) => b.display === 'none');
  desktop.keptLabelled = keptButtons.every((b) => !b.missing && b.display !== 'none' && b.width > 0 && !b.fullWidthSlab && /\S\s+\S/.test(b.text));
  results.push({ name: 'desktop1440', ...desktop });
  await ctx.close();
}

// 200% zoom — the someday-list header overlap, ruled into M2.
{
  const { ctx, page } = await open(2);
  const overlap = await page.evaluate(() => {
    const b = document.querySelector('.brand-text');
    const l = document.querySelector('.language-btn');
    if (!b || !l) return { missing: [!b && '.brand-text', !l && '.language-btn'].filter(Boolean) };
    const brand = b.getBoundingClientRect();
    const lang = l.getBoundingClientRect();
    if (!brand.width || !lang.width) return { hidden: { brandW: brand.width, langW: lang.width } };
    return {
      brandRight: Math.round(brand.right), langLeft: Math.round(lang.left),
      overlapPx: Math.round(brand.right - lang.left),
      overlaps: brand.right > lang.left + 0.5,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  await page.screenshot({ path: path.join(output, 'm2-zoom200-header.png') });
  results.push({ name: 'zoom200', ...overlap });
  await ctx.close();
}

await browser.close();
server.close();
console.log(JSON.stringify(results, null, 2));
