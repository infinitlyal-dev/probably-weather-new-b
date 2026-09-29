// Live smoke of https://www.probablyweather.co.za (first written for the 2b0e73e push, 2026-09-23; the phone legs
// rewritten for Home D, 29 Sept 2026 — review/accuracy/v8/PLAN.md §2 and §6 change 9).
//   node scripts/live-smoke.mjs output/live-smoke/<label> [--langs en,af,zu,xh,st] [--local] [--break <a1|a2|b|c|d|e>]
//        [--phone-only | --desktop-only]
// Desktop 1440x900: home, hourly, weekly, search, settings, share (+ landing page and OG card), and the "measured at"
// line at Gqeberha. Phone 414x715 (touch, fresh phone per run), Home D, every language asked for:
//   a  the joke writes itself on — hidden after the page is up, then fully shown (read off #headline's opacity)
//   b  tap the photograph: the joke hides; tap again: it shows
//   c  the pull-up list open on screen, at least 12 hour rows in it (the list scrolls), every row with a visible wind number
//   d  Share hands over exactly one JPEG postcard
//   e  "Measured at …" under the facts exactly when the page's own /api/weather says the airport's report set the wind
//      (Gqeberha: shown iff meta.station.measured; Strand: never)
// --local serves the built app (dist/) with a fixture /api/weather (Gqeberha measured, Strand not) — the positive case
// of (e) is proven there. --break patches the page in the browser so one behaviour is broken; the run must then fail
// on that leg (a2 also leaves b untestable: no joke to hide — reported as blocked, not passed). Exit 1 when any leg
// fails, so a broken app never gets a green smoke.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const LANGS = (arg('--langs') || 'en,af,zu,xh,st').split(',');
const LOCAL = process.argv.includes('--local');
const BREAK = arg('--break');
const PHONE = !process.argv.includes('--desktop-only'), DESKTOP = !process.argv.includes('--phone-only');
mkdirSync(OUT, { recursive: true });
const PLACES = { Strand: { latitude: -34.1163, longitude: 18.8362 }, Gqeberha: { latitude: -33.9611, longitude: 25.6149 } };

// ---------------- the local app (dist + fixture), for --local ----------------
function fixture(lat, lon) {
  const offset = 7200, nowMs = Date.now(), local = new Date(nowMs + offset * 1000);
  const DATE = local.toISOString().slice(0, 10), hour = local.getUTCHours();
  const hourly = Array.from({ length: 48 }, (_, i) => ({ tempC: 17 - (i % 6), feelsLikeC: 15, rainChance: (i % 7) * 5, precipMm: 0, windKph: 24 - (i % 9), windDir: 130, cloudPct: 20, humidity: 70, uv: 3, condition: 'clear' }));
  const daily = Array.from({ length: 7 }, () => ({ highC: 19, lowC: 11, rainChance: 10, uv: 6, windKph: 28, conditionKey: 'wind', conditionLabel: 'Windy', sunrise: `${DATE}T06:10`, sunset: `${DATE}T18:30` }));
  const gq = Math.abs(lon - PLACES.Gqeberha.longitude) < 1;
  return {
    ok: true, location: { name: gq ? 'Gqeberha' : 'Strand', lat, lon: gq ? 25.61 : 18.84 },
    now: { tempC: 17, feelsLikeC: 15, uv: 3, isDay: hour >= 6 && hour < 19, windKph: 37, rainChance: 5, cloudPct: 20, conditionKey: 'wind', conditionLabel: 'Windy', conditionReason: gq ? 'station-wind' : 'sustained-wind', sunrise: `${DATE}T06:10`, sunset: `${DATE}T18:30` },
    hourly, daily, wind_kph: 37, maxWindKph: 63, gustKph: 63, windDir: 130,
    consensus: { confidenceKey: 'decent' },
    meta: { schema: 5, localHour: hour, utcOffsetSeconds: offset, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })), sourceConditions: [], sourceRanges: [],
      station: gq ? { station: 'FAPE', measured: true, windy: true, fired: 'station', obsUtc: new Date(Math.floor(nowMs / 3600e3) * 3600e3).toISOString(), meanKph: 37, gustKph: 63 } : null },
  };
}
let SITE = 'https://www.probablyweather.co.za/', server = null;
if (LOCAL) {
  const dist = path.resolve('dist');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1'), p = decodeURIComponent(u.pathname);
    if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(fixture(Number(u.searchParams.get('lat')), Number(u.searchParams.get('lon')))));
    if (p.startsWith('/api/') || p.startsWith('/_vercel/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    let f, buf; try { f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1)); buf = readFileSync(f); }
    catch { return res.writeHead(404).end(); }
    return res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  SITE = `http://127.0.0.1:${server.address().port}/`;
}
const origin = new URL(SITE).origin;
const report = { site: SITE, break: BREAK, runs: [] };
const browser = await chromium.launch();
let failed = 0;

// ---------------- the breaks (negative controls), all in the browser ----------------
const BREAK_CSS = { a2: '#headline { opacity: 0 !important; }', c: '#dSheet .d-hour-wind { display: none !important; }', e: '#dLine .d-measured, #measuredLine { display: none !important; }' };
async function applyBreak(ctx) {
  if (BREAK_CSS[BREAK]) await ctx.addInitScript((css) => { const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }; document.head ? add() : document.addEventListener('DOMContentLoaded', add); }, BREAK_CSS[BREAK]);
  if (BREAK === 'b') await ctx.addInitScript(() => window.addEventListener('click', (e) => { if (e.target?.closest?.('#heroCard')) e.stopPropagation(); }, true));
  if (BREAK === 'd') await ctx.addInitScript(() => { window.__breakShare = true; });
}

// ---------------- phone: Home D ----------------
async function phoneRun(lang, place) {
  const row = { tag: `phone-${lang}-${place}`, legs: {}, errors: [] };
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    geolocation: PLACES[place], permissions: ['geolocation'], locale: `${lang}-ZA`, timezoneId: 'Africa/Johannesburg',
    reducedMotion: BREAK === 'a1' ? 'reduce' : 'no-preference',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 pw-smoke' });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_completed', '1'); } catch {}
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared.push({ files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })), url: d.url }); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !(window.__breakShare && d?.files?.length) });
    // the joke's opacity on the real clock from the first paint (DOM read, no app flags)
    window.__op = []; const t0 = performance.now();
    const tick = () => { const e = document.querySelector('#headline'); if (e && e.textContent.trim() && e.dataset.line === 'joke') window.__op.push([Math.round(performance.now() - t0), Number(getComputedStyle(e).opacity)]); if (performance.now() - t0 < 30000) setTimeout(tick, 80); };
    tick();
  }, lang);
  await applyBreak(ctx);
  const page = await ctx.newPage();
  let api = null;
  page.on('response', async (r) => { if (new URL(r.url()).pathname === '/api/weather' && r.status() === 200) { try { api = await r.json(); } catch {} } });
  page.on('pageerror', (e) => row.errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const o = window.__op; return o.length && o.at(-1)[1] > 0.95; }, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${row.tag}-${n}.png`) });
  await shot('1-home');

  // (a) hidden, then written on
  const op = await page.evaluate(() => window.__op);
  const firstHidden = op.find((o) => o[1] < 0.05), shownAfter = firstHidden && op.find((o) => o[0] > firstHidden[0] && o[1] > 0.95);
  row.legs.a = { pass: Boolean(firstHidden && shownAfter), hiddenAtMs: firstHidden?.[0] ?? null, shownAtMs: shownAfter?.[0] ?? null, samples: op.length };

  if (place === 'Strand') {
    // (b) tap the photograph where nothing else is: hide, then show
    const jokeOpacity = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('#headline')).opacity));
    if (!row.legs.a.pass && (await jokeOpacity()) < 0.95) row.legs.b = { pass: null, blocked: 'no joke on screen to hide (leg a)' };
    else {
      const pt = await page.evaluate(() => {
        const hc = document.querySelector('#heroCard').getBoundingClientRect();
        for (const fy of [0.45, 0.35, 0.55, 0.3]) for (const fx of [0.5, 0.3, 0.7]) {
          const x = hc.left + hc.width * fx, y = hc.top + hc.height * fy, el = document.elementFromPoint(x, y);
          if (el && el.closest('#heroCard') && !el.closest('button, a, #headline')) return { x, y };
        }
        return null;
      });
      if (!pt) row.legs.b = { pass: false, why: 'no free point on the photograph' };
      else {
        await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(900);
        const t1 = await jokeOpacity();
        await shot('2-hidden');
        await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(1200);
        const t2 = await jokeOpacity();
        row.legs.b = { pass: t1 < 0.05 && t2 > 0.95, afterTap1: t1, afterTap2: t2 };
      }
    }
    // (c) the pull-up list open on screen; its rows (the list scrolls), each with a visible wind number
    await page.tap('#dHandle').catch((e) => row.errors.push(`handle: ${e.message.slice(0, 60)}`));
    await page.waitForTimeout(1000);
    row.legs.c = await page.evaluate(() => {
      const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; };
      const sheet = document.querySelector('#dSheet'), sr = sheet?.getBoundingClientRect();
      const rows = [...document.querySelectorAll('#dSheet .d-hours > li.d-hour')];
      const withWind = rows.filter((r) => { const w = r.querySelector('.d-hour-wind'); return vis(w) && /\d/.test(w.textContent); }).length;
      const open = !!sr && sr.top < innerHeight * 0.6 && vis(sheet);
      return { pass: open && rows.length >= 12 && withWind === rows.length, open, rows: rows.length, withWind };
    });
    await shot('3-sheet');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    if (await page.evaluate(() => document.body.classList.contains('d-sheet-open'))) { await page.tap('#dHandle').catch(() => {}); await page.waitForTimeout(700); }
    // (d) Share: one JPEG postcard
    await page.tap('#dShare').catch((e) => row.errors.push(`share: ${e.message.slice(0, 60)}`));
    await page.waitForFunction(() => window.__shared.length > 0, null, { timeout: 12000 }).catch(() => {});
    const shared = await page.evaluate(() => window.__shared);
    const f = shared[0]?.files || [];
    row.legs.d = { pass: shared.length === 1 && f.length === 1 && f[0].type === 'image/jpeg' && f[0].size > 50000, shares: shared.length, files: f };
  }
  // (e) the measured line, against the page's own /api/weather
  const measuredApi = api?.meta?.station?.measured === true;
  const seen = await page.evaluate(() => {
    const m = document.querySelector('#dLine .d-measured');
    if (!m) return { visible: false, text: null };
    const r = m.getBoundingClientRect(), cs = getComputedStyle(m);
    return { visible: r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden', text: m.textContent.trim() };
  });
  // Fable (diff review): the payload must be the place asked for — Gqeberha's carries its airport's word, Strand's none —
  // so a late or failed location can never pass (e) on the wrong place.
  const rightPlace = place === 'Gqeberha' ? api?.meta?.station?.station === 'FAPE' : api?.meta?.station == null;
  row.legs.e = { pass: api !== null && rightPlace && (measuredApi ? seen.visible && /\b\d\d:\d\d\b/.test(seen.text || '') : !seen.visible),
    apiMeasured: measuredApi, apiStation: api?.meta?.station?.station ?? null, ...seen };
  for (const v of Object.values(row.legs)) if (v.pass === false) failed++;
  report.runs.push(row);
  process.stderr.write(`${row.tag}: ${Object.entries(row.legs).map(([k, v]) => `${k}=${v.pass === null ? 'blocked' : v.pass}`).join(' ')}\n`);
  await ctx.close();
}

// ---------------- desktop (unchanged legs, plus the measured line at Gqeberha) ----------------
async function desktopRun(lang) {
  const row = { tag: `desktop-${lang}`, checks: {}, errors: [], badResponses: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, geolocation: PLACES.Strand, permissions: ['geolocation'], locale: `${lang}-ZA`, timezoneId: 'Africa/Johannesburg' });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('lang', JSON.stringify(l)); } catch {}
    window.__shared = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared = d; } });
  }, lang);
  await applyBreak(ctx);
  const page = await ctx.newPage();
  let api = null;
  page.on('pageerror', (e) => row.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') row.errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', async (r) => {
    const s = r.status(), u = r.url();
    if (s >= 400 && u.startsWith(origin)) row.badResponses.push(`${s} ${u.slice(0, 120)}`);
    if (new URL(u).pathname === '/api/weather' && s === 200) { try { api = await r.json(); } catch {} }
  });
  const shot = async (n) => page.screenshot({ path: path.join(OUT, `${row.tag}-${n}.png`) });
  const visible = async (sel) => page.locator(sel).first().isVisible().catch(() => false);
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  row.checks.firstRenderMs = Date.now() - t0;
  row.home = await page.evaluate(() => ({ witty: document.querySelector('#headline')?.textContent?.trim(), conditionLine: document.querySelector('#description')?.textContent?.trim(), byline: document.querySelector('#weatherByline')?.textContent?.replace(/\s+/g, ' ').trim() }));
  row.checks.home = !!(row.home.conditionLine && row.home.witty && row.home.witty !== 'Loading…');
  await shot('1-home');
  await page.locator('#navHourlyHome').first().click().catch((e) => row.errors.push(`hourly click: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(1200);
  row.checks.hourly = await visible('#hourly-screen:not(.hidden)') && (await page.locator('#hourly-timeline *').count()) > 5;
  await shot('2-hourly');
  await page.locator('#hourlyBack').first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('#navWeek').click();
  await page.waitForTimeout(1200);
  row.checks.weekly = await visible('#week-screen:not(.hidden)');
  await shot('3-weekly');
  await page.locator('#navSearch').click();
  await page.waitForTimeout(800);
  await page.locator('#searchInput').fill('Durban');
  await page.waitForTimeout(3500);
  if (!LOCAL) row.checks.search = (await page.locator('#searchResults li').count().catch(() => 0)) > 0;   // the fixture has no search
  await shot('4-search');
  await page.locator('#searchInput').fill('');
  await page.locator('#navSettings').click();
  await page.waitForTimeout(1000);
  row.checks.settings = await visible('#settings-screen:not(.hidden)');
  await shot('5-settings');
  await page.locator('#navHome').click();
  await page.waitForTimeout(1000);
  await page.locator('#shareBtn').first().click().catch((e) => row.errors.push(`share click: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(800);
  row.shared = await page.evaluate(() => window.__shared);
  row.checks.share = !!row.shared?.url;
  if (row.shared?.url && !LOCAL) {
    const land = await ctx.request.get(row.shared.url.replace('https://probablyweather.co.za', 'https://www.probablyweather.co.za'), { headers: { 'user-agent': 'WhatsApp/2.23.20.0' } });
    const html = await land.text();
    const og = (html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+property="og:image"/) || [])[1]?.replace(/&amp;/g, '&');
    if (og) {
      const img = await ctx.request.get(og.replace('https://probablyweather.co.za', 'https://www.probablyweather.co.za'));
      const buf = await img.body();
      writeFileSync(path.join(OUT, `${row.tag}-6-sharecard.png`), buf);
      row.checks.shareCard = img.status() === 200 && /image/.test(img.headers()['content-type'] || '') && buf.length > 20000;
    }
  }
  // the measured line at Gqeberha, against the page's own /api/weather
  api = null;
  await ctx.setGeolocation(PLACES.Gqeberha);
  await page.goto(`${SITE}?lat=${PLACES.Gqeberha.latitude}&lon=${PLACES.Gqeberha.longitude}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => { const e = document.querySelector('#measuredLine'); const r = e?.getBoundingClientRect(); return { visible: !!e && !e.hidden && r.width > 1 && getComputedStyle(e).display !== 'none', text: e?.textContent.trim() || null }; });
  const measuredApi = api?.meta?.station?.measured === true;
  row.checks.measured = api !== null && (measuredApi ? m.visible && /\b\d\d:\d\d\b/.test(m.text || '') : !m.visible);
  row.measured = { apiMeasured: measuredApi, ...m };
  await shot('7-gqeberha');
  for (const v of Object.values(row.checks)) if (v === false) failed++;
  if (row.errors.length || row.badResponses.length) failed++;
  report.runs.push(row);
  process.stderr.write(`${row.tag}: ${JSON.stringify(row.checks)}${row.errors.length ? ` errors ${row.errors.length}` : ''}\n`);
  await ctx.close();
}

for (const lang of LANGS) {
  if (PHONE) for (const place of ['Strand', 'Gqeberha']) await phoneRun(lang, place);
  if (DESKTOP) await desktopRun(lang);
}
await browser.close();
server?.close();
report.failed = failed;
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
process.stderr.write(`${failed ? `FAILED: ${failed}` : 'PASS'} (${SITE}${BREAK ? `, break ${BREAK}` : ''})\n`);
process.exit(failed ? 1 : 0);
