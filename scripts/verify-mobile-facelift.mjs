// Mobile facelift visual gate (M1 — contained hero home).
//
// Serves dist/ with a mocked /api/weather and shoots the home screen at
// 390x844 across the four conditions the facelift brief names as the owner's
// visual gate: one dramatic storm, one bright clear day, one night, one dawn.
// The screenshots are the gate — not the suite, not this script's exit code.
//
// Modelled on scripts/verify-desktop-frame.mjs (same static server + mock).
//   node scripts/verify-mobile-facelift.mjs   ->  output/mobile-facelift/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'mobile-facelift');

// localHour + sunrise/sunset are set consistently so getTimeOfDay() (solar-aware)
// lands in the intended bucket, and the clock is pinned to the same hour.
const SCENES = {
  storm: { tempC: 14, low: 11, high: 17, rainChance: 92, cloudPct: 98, uv: 1, wind: 46, gust: 71,
           conditionKey: 'storm', conditionLabel: 'Storm', hour: 15, sunrise: '06:20', sunset: '19:40',
           agreement: '5/5', confidence: 'high', windDir: 205 },
  clear: { tempC: 29, low: 18, high: 31, rainChance: 0, cloudPct: 5, uv: 9, wind: 12, gust: 15,
           conditionKey: 'clear', conditionLabel: 'Clear', hour: 13, sunrise: '05:40', sunset: '19:55',
           agreement: '5/5', confidence: 'high', windDir: 135 },
  night: { tempC: 12, low: 10, high: 21, rainChance: 15, cloudPct: 40, uv: 0, wind: 9, gust: 14,
           conditionKey: 'clear', conditionLabel: 'Clear', hour: 22, sunrise: '06:10', sunset: '18:05',
           agreement: '4/5', confidence: 'low', windDir: 20 },
  // Fit cases (Al 2026-08-08). Same payload as storm; only the caption length
  // differs, because that is what decides whether Home fits above the fold.
  'fit-1line': { tempC: 14, low: 11, high: 17, rainChance: 92, cloudPct: 98, uv: 1, wind: 46, gust: 71,
           conditionKey: 'storm', conditionLabel: 'Storm', hour: 15, sunrise: '06:20', sunset: '19:40',
           agreement: '5/5', confidence: 'high', windDir: 205, caption: 'Respect the thunder.' },
  'fit-2line': { tempC: 14, low: 11, high: 17, rainChance: 92, cloudPct: 98, uv: 1, wind: 46, gust: 71,
           conditionKey: 'storm', conditionLabel: 'Storm', hour: 15, sunrise: '06:20', sunset: '19:40',
           agreement: '5/5', confidence: 'high', windDir: 205,
           caption: 'Even the bakkies on the N2 have pulled over to wait it out.' },
  dawn:  { tempC: 9, low: 8, high: 24, rainChance: 5, cloudPct: 25, uv: 0, wind: 7, gust: 11,
           conditionKey: 'clear', conditionLabel: 'Clear', hour: 6, sunrise: '05:55', sunset: '18:30',
           agreement: '4/5', confidence: 'high', windDir: 310 },
};

const DATE = '2026-08-06';

function payload(name) {
  const c = SCENES[name];
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: c.tempC + ((i % 5) - 2), feelsLikeC: c.tempC + ((i % 5) - 2),
    rainChance: c.rainChance, precipMm: c.rainChance > 50 ? 3.2 : 0,
    windKph: c.wind, windDir: c.windDir, cloudPct: c.cloudPct, humidity: 70, uv: c.uv,
    condition: c.conditionKey,
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: c.high + (d % 3), lowC: c.low - (d % 2), rainChance: c.rainChance,
    uv: c.uv, windKph: c.wind, conditionKey: c.conditionKey, conditionLabel: c.conditionLabel,
    sunrise: `${DATE}T${c.sunrise}`, sunset: `${DATE}T${c.sunset}`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: c.tempC, feelsLikeC: c.tempC - 4, uv: c.uv, isDay: c.hour > 7 && c.hour < 19,
      windKph: c.wind, rainChance: c.rainChance, cloudPct: c.cloudPct,
      conditionKey: c.conditionKey, conditionLabel: c.conditionLabel,
      sunrise: `${DATE}T${c.sunrise}`, sunset: `${DATE}T${c.sunset}`,
    },
    hourly, daily,
    wind_kph: c.wind, maxWindKph: c.gust, gustKph: c.gust, windDir: c.windDir,
    consensus: { confidenceKey: c.confidence === 'low' ? 'mixed' : 'strong' },
    meta: {
      localHour: c.hour, utcOffsetSeconds: 7200, confidence: c.confidence,
      sources: [
        { name: 'Open-Meteo', ok: true }, { name: 'WeatherAPI', ok: true },
        { name: 'MET Norway', ok: true }, { name: 'Pirate Weather', ok: true },
        { name: 'Tomorrow.io', ok: true },
      ],
      sourceConditions: [
        { source: 'Open-Meteo', vote: c.conditionKey, desc: c.conditionLabel },
        { source: 'MET Norway', vote: c.conditionKey, desc: c.conditionLabel },
      ],
      sourceRanges: [
        { name: 'Open-Meteo', minTemp: c.low, maxTemp: c.high },
        { name: 'WeatherAPI', minTemp: c.low - 2, maxTemp: c.high + 1 },
        { name: 'MET Norway', minTemp: c.low + 1, maxTemp: c.high },
        { name: 'Pirate Weather', minTemp: c.low + 2, maxTemp: c.high - 1 },
        { name: 'Tomorrow.io', minTemp: c.low, maxTemp: c.high - 2 },
      ],
      conditionConfidence: {
        level: c.confidence, finalCondition: c.conditionKey,
        sourceAgreement: c.agreement,
      },
    },
  };
}

function startServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) {
      const scene = SCENES[req.headers['x-pw-scene']] ? req.headers['x-pw-scene'] : 'clear';
      const body = pathname === '/api/weather' ? payload(scene)
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' }
        : pathname === '/api/version' ? { buildId: 'local' } : {};
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(dist, relative);
    if (!file.startsWith(`${dist}${path.sep}`)) return res.writeHead(403).end();
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
mkdirSync(output, { recursive: true });

const browser = await chromium.launch();
const results = [];
for (const [name, scene] of Object.entries(SCENES)) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { 'x-pw-scene': name },
  });
  const page = await ctx.newPage();
  // Pin the clock to the scene's hour so getTimeOfDay() and the hours strip
  // agree with the payload instead of drifting with the machine clock.
  await page.clock.install({ time: new Date(`${DATE}T${String(scene.hour).padStart(2, '0')}:12:00+02:00`) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      // The install banner is a fixed overlay on an engagement gate. It is not
      // part of the home screen being judged here, and left on it covers the
      // condition line. Marked dismissed so the gate shows the actual layout.
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
    } catch (_) {}
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  // The splash fades over 0.4s once the first render lands. Screenshotting on a
  // fixed timeout caught it mid-fade and dimmed the whole card, so wait for it
  // to actually be gone, then let the hero image decode.
  await page.waitForFunction(() => {
    const s = document.getElementById('pwSplash');
    return !s || s.classList.contains('splash-done');
  }, null, { timeout: 15000 });
  // Caption length drives the whole stack height, and the witty pool is random.
  // Force a deterministic ONE-line and TWO-line case so the no-scroll claim is
  // tested against the worst realistic caption, not whichever line rolled.
  if (scene.caption) {
    await page.evaluate((txt) => { document.getElementById('headline').textContent = txt; }, scene.caption);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1200);
  const file = path.join(output, `m1-${name}-390x844.png`);
  await page.screenshot({ path: file });
  // Al ruling 2026-08-08: prove the fold. Playwright fullPage captures the
  // DOCUMENT scroller, and here html cannot scroll (the legacy <=480px block
  // sets html,body{height:100%;overflow-y:auto}), so BODY is the scroll
  // container and fullPage would silently return the same 844px viewport.
  // The honest proof is the user action: scroll body to the end and shoot again.
  await page.evaluate(() => { document.body.scrollTop = document.body.scrollHeight; });
  await page.waitForTimeout(400);
  const bottomFile = path.join(output, `m1-${name}-390x844-SCROLLED.png`);
  await page.screenshot({ path: bottomFile });
  await page.evaluate(() => { document.body.scrollTop = 0; });
  await page.waitForTimeout(300);
  const probe = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const vis = (s) => { const e = q(s); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; };
    return {
      heroPhoto: box('#heroPhoto'),
      heroUrl: (getComputedStyle(document.documentElement).getPropertyValue('--hero-url') || '').trim().slice(0, 70),
      caption: (q('#headline')?.textContent || '').slice(0, 60),
      captionBg: q('#headline') ? getComputedStyle(q('#headline')).backgroundColor : null,
      temp: (q('#temp')?.textContent || '').replace(/\s+/g, ' ').trim(),
      tempColor: q('#temp') ? getComputedStyle(q('#temp')).color : null,
      badge: (q('#confidenceBadge')?.textContent || ''),
      stats: Array.from(document.querySelectorAll('#statsRow .stat-k')).map((e) => e.textContent),
      // The rotation itself, so the gate proves the bearing is applied and not
      // just that an arrow exists.
      windArrowRotate: q('#statsRow .wind-arrow g')?.getAttribute('transform') || null,
      windGustSub: (q('#statsRow .stat-sub')?.textContent || '').trim(),
      heroNow: q('.hero-now')?.textContent || null,
      rangeLine: (q('#rangeLine')?.textContent || '').replace(/\s+/g, ' ').trim(),
      actions: Array.from(document.querySelectorAll('#homeActions button')).map((b) => b.textContent.trim()),
      floatingGone: !vis('.share-btn') && !vis('.nav-hourly-pill') && !vis('.my-location-btn'),
      bgImgOpacity: q('#bgImg') ? getComputedStyle(q('#bgImg')).opacity : null,
      docScrollW: document.documentElement.scrollWidth,
      // Fold proof. rect.bottom is viewport-relative, so add scrollY for the
      // document coordinate; compare against the scrollable height and against
      // the top of the fixed nav to prove nothing is unreachable or buried.
      fold: (() => {
        const de = document.documentElement;
        const sc = document.body; // the real scroller — see the note above
        const navTop = document.querySelector('.nav')?.getBoundingClientRect().top ?? 0;
        const measure = (sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return {
            top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
            fullyAboveNav: r.bottom <= navTop + 0.5,
            clipped: cs.overflow === 'hidden' && e.scrollHeight > Math.ceil(r.height) + 1,
          };
        };
        return {
          scrollHeight: sc.scrollHeight,
          viewport: window.innerHeight,
          maxScroll: Math.max(0, sc.scrollHeight - sc.clientHeight),
          navTopViewport: Math.round(navTop),
          statsRow: measure('#statsRow'),
          hourlyCta: measure('#homeHourly'),
        };
      })(),
    };
  });
  results.push({ name, file: path.relative(root, file), ...probe });
  await ctx.close();
}
await browser.close();
server.close();
console.log(JSON.stringify(results, null, 2));
