// Launch eval, step 2 (2026-09-23): what the app does when things go wrong.
//
//   node review/eval/scripts/failure-paths.mjs [--dist dist] [--out review/eval/shots/failure] [--payload <live api json>]
//
// Serves the local build (npm run build → dist/) with a stubbed /api so every failure can be forced:
// location denied (and the IP fallback failing too), a nonsense place search, the geocoder rate-limited,
// every provider down (the API's own 503 body), the API rate limit (its own 429 body), a provider so slow
// the client's 10 s budget runs out, one provider down, and offline after a first visit. Phone 414x715,
// Chromium (service workers and request stubbing are reliable there), English. The forecast body is a
// real production payload captured today, so everything that renders is real data.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/failure');
const LIVE = JSON.parse(readFileSync(arg('--payload', 'review/eval/data/live-strand.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

// Behaviour of the stub for the current scenario, switched between runs.
let S = {};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const json = (res, code, body, headers = {}) => res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
const server = createServer(async (req, res) => {
  // Real offline: every connection dropped, for the page AND the service worker (Playwright's
  // setOffline does not reach the worker's own fetches, so it let the worker fetch fresh data).
  if (S.down) { req.socket.destroy(); return; }
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  if (p === '/api/weather') {
    if (u.searchParams.get('reverse')) return json(res, 200, { ok: true, city: 'Strand', admin1: 'Western Cape', countryCode: 'za' });
    if (S.weatherDelayMs) await new Promise((r) => setTimeout(r, S.weatherDelayMs));
    if (S.weather === 'all-down') return json(res, 503, { ok: false, degraded: true, error: 'All weather sources failed. Please try again shortly.', meta: { sources: ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'].map((name) => ({ name, ok: false })), invalidSources: [] } });
    if (S.weather === 'rate-limited') return json(res, 429, { ok: false, error: 'Too many requests' }, { 'Retry-After': '60' });
    if (S.weather === 'one-down') {
      const body = structuredClone(LIVE);
      body.meta.sources = body.meta.sources.map((s) => (s.name === 'WeatherAPI' ? { ...s, ok: false } : s));
      body.meta.sourceRanges = (body.meta.sourceRanges || []).filter((s) => s.name !== 'WeatherAPI');
      body.meta.sourceConditions = (body.meta.sourceConditions || []).filter((s) => s.source !== 'WeatherAPI');
      if (body.meta.sourceWeights) delete body.meta.sourceWeights.WeatherAPI;
      return json(res, 200, body);
    }
    return json(res, 200, LIVE);
  }
  if (p === '/api/locate') return S.locate === 'fail' ? json(res, 500, { ok: false }) : json(res, 200, { ok: true, lat: -26.2041, lon: 28.0473, name: 'Johannesburg, Gauteng' });
  if (p === '/api/geocode') {
    if (u.searchParams.get('type') === 'reverse') return json(res, 200, { ok: true, city: 'Strand', admin1: 'Western Cape', countryCode: 'za' });
    if (S.geocode === 'rate-limited') return json(res, 429, { ok: false, error: 'Too many requests' });
    if (S.geocode === 'empty') return json(res, 200, { ok: true, results: [] });
    return json(res, 200, { ok: true, results: [{ name: 'Durban', display_name: 'Durban, eThekwini, KwaZulu-Natal, South Africa', lat: '-29.8587', lon: '31.0218', address: { city: 'Durban', country: 'South Africa' } }] });
  }
  if (p.startsWith('/api/')) return json(res, 200, { ok: true });
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  // vercel.json rewrites the service worker precaches (/install) or links to (/privacy).
  const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html', '/favicon.ico': 'assets/favicon-32.png' };
  const file = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf;
  try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  return res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const rows = [];
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;

async function scenario(name, stub, { permissions = ['geolocation'], steps } = {}) {
  if (ONLY && !ONLY.includes(name)) return;
  S = stub;
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
    geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions, locale: 'en-ZA', timezoneId: 'Africa/Johannesburg',
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('en')); } catch {} });
  const page = await ctx.newPage();
  const row = { name, stub, errors: [], toasts: [], shots: [] };
  page.on('pageerror', (e) => row.errors.push(e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') row.errors.push(`console: ${m.text().slice(0, 160)}`); });
  await page.exposeFunction('__pwToast', (t) => row.toasts.push(t));
  await page.addInitScript(() => {
    new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent.trim() && t.dataset.seen !== t.textContent) { t.dataset.seen = t.textContent; window.__pwToast?.(t.textContent.trim()); } })
      .observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const shot = async (label) => { const f = `${name}-${label}.png`; await page.screenshot({ path: path.join(OUT, f) }); row.shots.push(f); };
  const state = async () => page.evaluate(() => ({
    place: document.querySelector('#location')?.textContent?.trim(),
    headline: document.querySelector('#headline')?.textContent?.trim(),
    description: document.querySelector('#description')?.textContent?.trim(),
    temp: document.querySelector('#temp')?.textContent?.replace(/\s+/g, ' ').trim(),
    agree: document.querySelector('#agreeLine')?.textContent?.replace(/\s+/g, ' ').trim(),
    offline: (() => { const o = document.getElementById('offlineIndicator'); return o && o.classList.contains('visible') ? o.textContent.trim() || 'visible' : null; })(),
    retry: [...document.querySelectorAll('button')].filter((b) => b.offsetParent && /retry|try again|probeer/i.test(b.textContent + (b.getAttribute('aria-label') || ''))).map((b) => b.textContent.trim()),
  }));
  row.result = await steps({ page, ctx, shot, state, row });
  rows.push(row);
  await ctx.close();
  process.stderr.write(`${name}: ${JSON.stringify(row.result).slice(0, 220)}\n`);
}

const open = async (page) => { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4500); };

await scenario('baseline', {}, { steps: async ({ page, shot, state }) => { await open(page); await shot('home'); return state(); } });

await scenario('location-denied', {}, { permissions: [], steps: async ({ page, shot, state }) => { await open(page); await shot('home'); return state(); } });

await scenario('location-denied-ip-fails', { locate: 'fail' }, { permissions: [], steps: async ({ page, shot, state }) => { await open(page); await page.waitForTimeout(3000); await shot('home'); return state(); } });

for (const [name, geocode] of [['search-nonsense', 'empty'], ['search-rate-limited', 'rate-limited']]) {
  await scenario(name, { geocode }, {
    steps: async ({ page, shot, state }) => {
      await open(page);
      await page.locator('#navSearch').click();
      await page.waitForTimeout(600);
      await page.locator('#searchInput').fill('Qwxzvbnmk');
      await page.waitForTimeout(2500);
      await shot('search');
      return { ...(await state()), results: await page.locator('#searchResults li').count(), searchScreenText: (await page.locator('#search-screen').innerText()).replace(/\s+/g, ' ').slice(0, 300) };
    },
  });
}

await scenario('all-providers-down', { weather: 'all-down' }, { steps: async ({ page, shot, state }) => { await open(page); await shot('home'); return state(); } });

await scenario('api-rate-limited', { weather: 'rate-limited' }, { steps: async ({ page, shot, state }) => { await open(page); await shot('home'); return state(); } });

await scenario('slow-provider-12s', { weatherDelayMs: 12000 }, {
  steps: async ({ page, shot, state }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); await shot('at-3s'); const at3 = await state();
    await page.waitForTimeout(8500); await shot('at-11s'); const at11 = await state();
    await page.waitForTimeout(3500); await shot('at-14s');
    return { at3, at11, at14: await state() };
  },
});

await scenario('one-provider-down', { weather: 'one-down' }, {
  steps: async ({ page, shot, state }) => {
    await open(page); await shot('home'); const home = await state();
    await page.locator('#navSettings').click(); await page.waitForTimeout(600);
    await page.locator('#settingsSourcesRow').click(); await page.waitForTimeout(900);
    await shot('sources');
    return { home, sources: (await page.locator('#sources-screen').innerText()).replace(/\s+/g, ' ').slice(0, 600) };
  },
});

await scenario('offline-after-first-visit', {}, {
  steps: async ({ page, ctx, shot, state }) => {
    await open(page);
    const sw = await page.evaluate(async () => { try { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 15000))]); return r ? { active: !!r.active, scope: r.scope } : 'no service worker became ready within 15 s'; } catch (e) { return String(e); } });
    // a second load while online, so the now-controlling worker holds the forecast in its own cache
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    S.down = true;
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4500);
    await shot('home');
    const home = await state();
    await page.locator('#navWeek').click().catch(() => {}); await page.waitForTimeout(800);
    await shot('week');
    return { swActive: sw, home };
  },
});

await scenario('offline-first-ever-visit', {}, {
  steps: async ({ page, ctx, shot, state }) => {
    S.down = true;
    const ok = await page.goto(BASE, { waitUntil: 'domcontentloaded' }).then(() => true).catch((e) => e.message.split('\n')[0]);
    await page.waitForTimeout(1500);
    await shot('home').catch(() => {});
    return { navigated: ok };
  },
});

await browser.close();
server.close();
writeFileSync(path.join(OUT, 'failure-paths.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log(`[failure] ${rows.length} scenarios → ${OUT}/failure-paths.json`);
