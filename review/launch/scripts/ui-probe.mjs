// LAUNCH RUN (2026-09-25) — Al's ticked list, measured before and after, on the local build.
//
//   node review/launch/scripts/ui-probe.mjs [--dist dist] [--tag before] [--langs en,af]
//
// Stub API with a real production payload (Strand, 23:00 local) and the clock pinned to 23:30 SAST,
// Al's phone (414×715) and desktop 1440×900. Per language: Hourly (top + end), Week (top + end),
// today's Day detail late at night, the error screen (API 503), the desktop night hero, and the
// place line. Measures what each item is about and writes review/launch/results/ui-<tag>.json plus
// screenshots in review/launch/shots/ui-<tag>/.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const TAG = arg('--tag', 'run');
const LANGS = arg('--langs', 'en,af').split(',');
const OUT = `review/launch/shots/ui-${TAG}`;
mkdirSync(OUT, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
LIVE.location = { ...(LIVE.location || {}), name: 'Strand, Western Cape, South Africa' };
let MODE = 'ok';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const json = (res, code, body) => res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  if (p === '/api/weather') {
    if (u.searchParams.get('reverse')) return json(res, 200, { ok: true, city: 'Strand', admin1: 'Western Cape', countryCode: 'za' });
    if (MODE === 'down') return json(res, 503, { ok: false, degraded: true, error: 'All weather sources failed. Please try again shortly.' });
    return json(res, 200, LIVE);
  }
  if (p === '/api/geocode') return json(res, 200, { ok: true, name: 'Strand, Western Cape', results: [] });
  if (p.startsWith('/api/')) return json(res, 200, { ok: true });
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html' };
  let buf; try { buf = readFileSync(path.resolve(dist, REWRITE[p] || p.slice(1))); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p || '/index.html')] || 'text/html; charset=utf-8' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const results = {};

async function openPage(lang, viewport, { at = '2026-09-24T21:30:00Z' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 800, hasTouch: viewport.width < 800, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], locale: 'en-ZA', timezoneId: 'Africa/Johannesburg' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_home', '1'); } catch {} }, lang);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(at) });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.clock.runFor(9000);
  await page.waitForTimeout(800);
  return { ctx, page };
}
// Stored as WebP (quality 80): the evidence shots were 15 MB as PNG.
const shot = async (page, name) => sharp(await page.screenshot()).webp({ quality: 80 }).toFile(path.join(OUT, `${name}.webp`));
const endOfPage = async (page) => { await page.evaluate(() => { for (const el of [document.scrollingElement, document.body, ...document.querySelectorAll('.screenPanel:not(.hidden), .screen-panel-body, .hourly-timeline, .daily-cards')]) if (el) el.scrollTop = el.scrollHeight; }); await page.waitForTimeout(400); };

for (const lang of LANGS) {
  const R = (results[lang] = {});
  // Hourly
  { const { ctx, page } = await openPage(lang, { width: 414, height: 715 });
    await page.locator('#homeHourly').click(); await page.waitForTimeout(900);
    await shot(page, `${lang}-hourly`);
    R.hourly = await page.evaluate(() => {
      const scrollers = [...document.querySelectorAll('#hourly-screen, #hourly-screen *')].filter((el) => { const cs = getComputedStyle(el); return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2; }).map((el) => ({ el: el.id || el.className, clientH: el.clientHeight, scrollH: el.scrollHeight }));
      const header = document.querySelector('.hourly-row.hourly-header');
      const first = header?.nextElementSibling;
      const cells = (row) => [...(row?.children || [])].map((c) => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { cls: c.className, text: c.textContent.trim().slice(0, 8), left: Math.round(r.left), right: Math.round(r.right), size: parseFloat(cs.fontSize), align: cs.textAlign }; });
      return { scrollers, header: cells(header), firstRow: cells(first), rows: document.querySelectorAll('.hourly-row:not(.hourly-header)').length };
    });
    await endOfPage(page); await shot(page, `${lang}-hourly-end`);
    await ctx.close(); }
  // Week
  { const { ctx, page } = await openPage(lang, { width: 414, height: 715 });
    await page.locator('#navWeek').click(); await page.waitForTimeout(900);
    await shot(page, `${lang}-week`);
    R.week = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#weekly-screen .daily-row:not(.daily-header), #week-screen .daily-row:not(.daily-header), .daily-cards > *:not(.daily-header)')].filter((r) => r.getBoundingClientRect().height > 0);
      const nav = document.querySelector('nav, .bottom-nav, #bottomNav');
      const navTop = nav ? nav.getBoundingClientRect().top : innerHeight;
      return { rows: rows.length, rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)), fullyVisible: rows.filter((r) => r.getBoundingClientRect().bottom <= navTop).length };
    });
    await endOfPage(page); await shot(page, `${lang}-week-end`);
    // Today's detail, late at night
    const today = page.locator('.daily-cards > *:not(.daily-header)').first();
    if (await today.count()) { await today.click().catch(() => {}); await page.waitForTimeout(900); await shot(page, `${lang}-day-today-2330`);
      R.dayLate = await page.evaluate(() => { const scr = document.querySelector('.screenPanel:not(.hidden)'); const rows = [...(scr?.querySelectorAll('.hourly-row:not(.hourly-header), .day-hour-row, [data-hour]') || [])].filter((r) => r.getBoundingClientRect().height > 0); const h = scr?.querySelector('h1, h2, .page-title'); const hr = h?.getBoundingClientRect(); return { screen: scr?.id, rows: rows.length, title: h?.textContent.trim(), titleCentreOffset: hr ? Math.round(hr.left + hr.width / 2 - innerWidth / 2) : null, text: (scr?.innerText || '').replace(/\s+/g, ' ').slice(0, 300) }; }); }
    await ctx.close(); }
  // Error screen
  { MODE = 'down'; const { ctx, page } = await openPage(lang, { width: 414, height: 715 });
    await shot(page, `${lang}-error`);
    R.error = await page.evaluate(() => ({ condition: document.querySelector('#description, #headline')?.textContent.trim(), buttons: [...document.querySelectorAll('button')].filter((b) => b.offsetParent && b.getBoundingClientRect().top < innerHeight).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 12), homeText: (document.querySelector('#home-screen')?.innerText || '').replace(/\s+/g, ' ').slice(0, 240) }));
    MODE = 'ok'; await ctx.close(); }
  // Desktop at night
  { const { ctx, page } = await openPage(lang, { width: 1440, height: 900 });
    await shot(page, `${lang}-desktop-night`);
    R.desktopNight = await page.evaluate(() => ({ hero: (document.querySelector('#temp')?.innerText || '').replace(/\s+/g, ' '), heroBlock: (document.querySelector('#temp')?.parentElement?.innerText || '').replace(/\s+/g, ' ').slice(0, 200), place: document.querySelector('#location')?.textContent.trim() }));
    await ctx.close(); }
}
await browser.close(); server.close();
writeFileSync(`review/launch/results/ui-${TAG}.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1).slice(0, 6000));
