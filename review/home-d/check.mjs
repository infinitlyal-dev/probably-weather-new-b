// Home D, the phone Home (26 Sept 2026): the behaviour checks on the built app, in WebKit at Al's 414x715.
//
//   node review/home-d/check.mjs [--dist dist] [--out output/home-d]   -> checks.json, PASS/FAIL per line
//
// Al's brief and reveal-ruled.json, each checked on the built app (a stub API, a pinned clock, the rain
// photograph for Strand):
//   weather first      the temperature and the credit line are on screen while the joke waits
//   the beat           2 s from the photograph landing to the first ink; the writing done in 1.6 s at most
//   screen readers     during the beat the joke is in the accessibility tree (only faded)
//   nothing moves      the joke's box, the credit line, the title card, the handle, Share: same rects
//   Share              a postcard: the photograph clean, the joke under it; Share leaves the joke alone
//   the handle         says "Hourly" only; opens a panel of the next hours — a list you scroll down, one
//                      row an hour (time, icon, temperature, rain %, wind with its unit; Al, 27 Sept: losing
//                      Rain and Wind was not on purpose), real list semantics — with one quiet link to the
//                      full Hourly page and no week (Weekly stays in the nav); a swipe up opens it too
//   no side-scroll     nothing on Home scrolls sideways, panel up, at 414x715 and at 320 wide (Al, 27 Sept)
//   the photo          a tap hides the joke, another shows it; the button's name follows
//   keyboard           Tab reaches the button, it shows itself, Enter flips the joke
//   five languages     the button's name in each (Afrikaans: "Wys die grap" / "Geen grap", Al's words)
//   reduced motion     the joke is there with the photograph: no beat, no writing
//   seen before        reopened, the same joke is simply there
//   never held back    the panel up during the beat, a trip to Weekly and back, the panel left up: the joke
//                      is written without a second beat when the photograph shows again, and no later than
//                      its ceiling whatever covers it (Al, 27 Sept: "didnt have the humour line")
//   warnings           a Cape wind warning is on top, orange and whole, in five languages, never held back
//   ad-free            no ad slot on Home or in its panel
//   desktop            wider than a phone, the polaroid: none of D's pieces show, the caption is there
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const out = path.resolve(arg('--out', 'output/home-d'));
const listOut = path.resolve(arg('--list-out', 'output/home-d-list'));   // the pulled-up list, for Al's eyes
mkdirSync(out, { recursive: true });
mkdirSync(listOut, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const when = (() => {
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== 1) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + 2 * DAY_MS + 12 * 3600e3;
    if (getRotationWeek(t) === 1 && getRotationDay(t) === 3) return t;
  }
  throw new Error('no date');
})();
const makePayload = (windKph = 22) => {
  const b = structuredClone(LIVE);
  Object.assign(b.now, { tempC: 14, feelsLikeC: 13, humidity: 90, uv: 0, conditionKey: 'rain', conditionLabel: 'Rain', isDay: true, windDir: 200, rainChance: 85, precipMm: 3.2, cloudPct: 100, windKph });
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: [{ kind: 'rain-now' }], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: 4, precipMm: 3.2 } };
  b.now.conditionReason = 'rain-now';
  b.location = { ...b.location, name: 'Strand' };
  if (windKph >= 50) { b.wind_kph = windKph; b.windKph = windKph; }
  return b;
};
let payload = makePayload();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, name: 'Strand', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await webkit.launch();
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); };

async function phone({ lang = 'en', reducedMotion = 'no-preference', pinClock = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block', reducedMotion });
  await ctx.addInitScript((l) => {
    try { if (!localStorage.getItem('lang')) localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {}
    window.__shared = [];
    navigator.share = (d) => { window.__shared.push({ files: (d.files || []).length, url: d.url }); return Promise.resolve(); };
    navigator.canShare = () => true;
  }, lang);
  const page = await ctx.newPage();
  // The pinned clock picks the same photograph every run; the timing leg runs unpinned, because Playwright's
  // fake clock also drives the page's timers and stretched the measured beat.
  if (pinClock) await page.clock.setFixedTime(new Date(when));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}
const state = (page) => page.evaluate(() => window.__PW_D?.reveal?.state?.());
const marks = (page) => page.evaluate(() => (window.__PW_D?.reveal?.marks || []).map((m) => ({ what: m.what, at: m.at })));
const label = (page) => page.evaluate(() => document.getElementById('dJokeToggle')?.textContent);
const rects = (page) => page.evaluate(() => Object.fromEntries(['#headline', '#dLine', '#weatherStatus', '#dHandle', '#dShare'].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return [s, r ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',') : null]; })));
// Every element on screen that CAN scroll sideways: content wider than its box and an overflow-x that
// scrolls (auto / scroll), plus the page itself if it is wider than the viewport. Clipping (overflow
// hidden: the photograph's layer, the visually hidden toggle and rain words) is not a scroll. Empty means
// nothing on Home scrolls sideways.
const sideways = (page) => page.evaluate(() => [document.documentElement, ...document.querySelectorAll('body *')]
  .filter((e) => {
    if (e === document.documentElement) return e.scrollWidth > e.clientWidth + 1;
    if (!e.getClientRects().length || e.scrollWidth <= e.clientWidth + 1) return false;
    const ox = getComputedStyle(e).overflowX;
    return ox === 'auto' || ox === 'scroll';
  })
  .map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className ? `.${e.className.split(' ')[0]}` : ''} ${e.scrollWidth}>${e.clientWidth}`));
// The sheet fully up (its rise is a 0.38 s transform; a pinned clock can hold WebKit mid-rise for a shot).
const sheetUp = (page) => page.waitForFunction(() => { const t = getComputedStyle(document.getElementById('dSheet')).transform; return document.body.classList.contains('d-sheet-open') && (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'); }, null, { timeout: 5000 });
// The panel as a list: a UL of LI rows stacked top to bottom, scrolling inside the sheet, each row an
// hour with the icon named for a screen reader and the rain word before the percentage.
const panelList = (page) => page.evaluate(() => {
  const ul = document.querySelector('#dSheet .d-hours');
  const rows = [...document.querySelectorAll('#dSheet .d-hours > li.d-hour')];
  const body = document.querySelector('#dSheet .d-sheet-body');
  const rainWord = document.querySelector('#hourly-timeline .hourly-header .h-rain')?.textContent.trim();
  const windWord = document.querySelector('#hourly-timeline .hourly-header .h-wind')?.textContent.trim();
  const windUnit = document.querySelector('#statsRow .stat-unit')?.textContent.trim();
  return {
    tag: ul?.tagName, rows: rows.length,
    stacked: rows.length > 1 && rows.every((r, i) => !i || r.getBoundingClientRect().top >= rows[i - 1].getBoundingClientRect().bottom - 1),
    scrolls: !!body && body.scrollHeight > body.clientHeight + 1 && getComputedStyle(body).overflowY === 'auto',
    firstRow: rows[0] ? { time: rows[0].querySelector('.d-hour-time')?.textContent, icon: rows[0].querySelector('.d-hour-icon [role="img"]')?.getAttribute('aria-label') || null, temp: rows[0].querySelector('.d-hour-temp')?.textContent, rain: rows[0].querySelector('.d-hour-rain')?.textContent, wind: rows[0].querySelector('.d-hour-wind')?.textContent } : null,
    // Every row's wind reads "<word> <number> <unit>" (the word out of sight) or "--"; the unit is the app's own.
    windRows: rows.filter((r) => { const w = r.querySelector('.d-hour-wind')?.textContent || ''; return w === `${windWord} --` || new RegExp(`^${windWord} \\d+ ${windUnit}$`).test(w); }).length,
    rainWord, windWord, windUnit,
  };
});

// 1-4: weather first, screen readers, the beat, nothing moves.
{
  const { ctx, page } = await phone();
  await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 20000 });
  const waiting = await page.evaluate(() => ({
    state: window.__PW_D.reveal.state(),
    temp: document.querySelector('#temp .hero-now')?.textContent,
    line: document.getElementById('dLine')?.textContent,
    opacity: getComputedStyle(document.getElementById('headline')).opacity,
    joke: document.getElementById('headline').textContent,
  }));
  const tree = await page.locator('#home-screen').ariaSnapshot();
  const before = await rects(page);
  await page.screenshot({ path: path.join(out, 'waiting.png') });
  ok('weather first: temperature and credit line on screen while the joke waits', waiting.state === 'pending' && /\d/.test(waiting.temp || '') && (waiting.line || '').length > 10, { temp: waiting.temp, state: waiting.state });
  ok('screen readers: the waiting joke is in the accessibility tree (only faded)', waiting.opacity === '0' && tree.includes(waiting.joke.slice(0, 30)), { opacity: waiting.opacity });
  await page.waitForFunction(() => window.__PW_D.reveal.state() === 'shown', null, { timeout: 20000 });
  await page.screenshot({ path: path.join(out, 'written.png') });
  const after = await rects(page);
  const moved = Object.keys(before).filter((k) => before[k] !== after[k]);
  ok('nothing moves: joke box, credit line, title card, handle, Share — same rects waiting and written', moved.length === 0, moved.length ? { before, after } : 'identical');

  // 5: Share sends a postcard and leaves the joke alone.
  await page.waitForTimeout(900);
  const card = await page.evaluate(async () => {
    const url = await window.__PW_D.shareImage();
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = url; });
    return { url, w: img.naturalWidth, h: img.naturalHeight };
  });
  writeFileSync(path.join(out, 'postcard.jpg'), Buffer.from(card.url.split(',')[1], 'base64'));
  await page.tap('#dShare');
  await page.waitForTimeout(300);
  const shared = await page.evaluate(() => window.__shared);
  ok('Share: a postcard (photo on top, the joke under it) goes with the link, and the joke is left alone', shared.length === 1 && shared[0].files === 1 && card.w === 1080 && card.h > card.w * 1.9 && (await state(page)) === 'shown', { shared, postcard: `${card.w}x${card.h}` });

  // 6: the handle says "Hourly" only; the panel: the next hours, a link to the full Hourly page, no week.
  const handleText = await page.evaluate(() => document.getElementById('dHandle').textContent.trim());
  const hourlyWord = await page.evaluate(() => document.getElementById('homeHourlyLabel').textContent.trim());
  await page.tap('#dHandle');
  await page.waitForTimeout(600);
  const panel = await page.evaluate(() => ({
    open: document.body.classList.contains('d-sheet-open'),
    hours: document.querySelectorAll('#dSheet .d-hour').length,
    days: document.querySelectorAll('#dSheet .daily-row, #dSheet .d-day-row').length,
    buttons: [...document.querySelectorAll('#dSheet .d-more')].map((b) => b.textContent.trim()),
    ads: document.querySelectorAll('#dSheet [class*="ad-"], #dSheet [data-ad-slot]').length,
  }));
  await page.screenshot({ path: path.join(out, 'panel.png') });
  ok('the handle says "Hourly" only; the panel has the next hours and a link to the full Hourly page, no week', handleText === hourlyWord && !/·/.test(handleText) && panel.open && panel.hours >= 12 && panel.days === 0 && panel.buttons.length === 1 && panel.buttons[0].startsWith(hourlyWord) && (await state(page)) === 'shown', { handleText, panel });
  // 6b: the hours are a list you scroll down (Al, 27 Sept: "it is a side scroll on hourly and nobody likes
  // that"): a UL of LI rows, stacked, scrolling inside the panel; a screen reader gets each hour as one item
  // (the accessibility tree holds a list of listitems, the icon named); nothing on Home scrolls sideways.
  const list = await panelList(page);
  const listTree = await page.locator('#dSheet .d-hours').ariaSnapshot();
  const listItems = (listTree.match(/- listitem/g) || []).length;
  const wide = await sideways(page);
  ok('the panel is a vertical list — one row an hour: time, icon, temperature, rain, wind with its unit; real list semantics, scrolling inside the panel — and nothing on Home scrolls sideways at 414x715',
    list.tag === 'UL' && list.rows === panel.hours && list.stacked && list.scrolls && /^- list/m.test(listTree) && listItems === list.rows && !!list.firstRow?.icon && list.firstRow.rain.startsWith(`${list.rainWord} `) && !!list.windWord && /^(km\/h|mph)$/.test(list.windUnit || '') && list.windRows === list.rows && /\d+ (km\/h|mph)$/.test(list.firstRow.wind) && wide.length === 0,
    { ...list, listItems, sideways: wide });
  await page.tap('#dSheet .d-more');
  await page.waitForTimeout(700);
  const onHourly = await page.evaluate(() => ({ home: document.body.classList.contains('home-active'), open: document.body.classList.contains('d-sheet-open'), hourlyVisible: !!document.querySelector('#hourly-screen:not(.hidden), #hourly-screen.active') }));
  ok('the panel\'s link opens the full Hourly page', !onHourly.home && !onHourly.open, onHourly);
  await page.evaluate(() => document.getElementById('navHome')?.click());
  await page.waitForTimeout(700);
  const weekly = await page.evaluate(() => ({ inNav: !!document.getElementById('navWeek') && getComputedStyle(document.getElementById('navWeek')).display !== 'none', onHome: [...document.querySelectorAll('#home-screen *, #dSheet *, #dHandle *')].filter((e) => e.children.length === 0 && e.getClientRects().length && e.textContent.trim() === document.getElementById('navWeek').textContent.trim()).length }));
  ok('Weekly is in the nav bar only, not on Home or in its panel', weekly.inNav && weekly.onHome === 0, weekly);
  // A swipe up on the photograph (WebKit will not build Touch objects: synthetic events with the fields D reads).
  const swiped = await page.evaluate(async () => {
    const photo = document.getElementById('heroPhoto');
    const ev = (type, y, down) => {
      const e = new Event(type, { bubbles: true });
      const t = { identifier: 1, target: photo, clientX: 207, clientY: y };
      Object.defineProperty(e, 'touches', { value: down ? [t] : [] });
      Object.defineProperty(e, 'changedTouches', { value: [t] });
      return e;
    };
    photo.dispatchEvent(ev('touchstart', 520, true));
    await new Promise((r) => setTimeout(r, 120));
    photo.dispatchEvent(ev('touchend', 380, false));
    await new Promise((r) => setTimeout(r, 600));
    return document.body.classList.contains('d-sheet-open');
  });
  ok('a swipe up on the photo (synthetic touch events): opens the panel and leaves the joke alone', swiped && (await state(page)) === 'shown');
  await page.evaluate(() => window.__PW_D.close());
  await page.waitForTimeout(500);

  // 7: the photograph: a tap hides the joke, another shows it.
  const spot = await page.evaluate(() => { for (let y = 300; y < 600; y += 10) { const el = document.elementFromPoint(207, y); if (el && el.closest('#heroCard')) return y; } return null; });
  const l0 = await label(page);
  await page.touchscreen.tap(207, spot);
  // The fade is 220 ms; allow a busy machine up to 2 s to finish it.
  await page.waitForFunction(() => getComputedStyle(document.getElementById('headline')).opacity === '0', null, { timeout: 2000 }).catch(() => {});
  const hidden = { state: await state(page), label: await label(page), opacity: await page.evaluate(() => getComputedStyle(document.getElementById('headline')).opacity) };
  await page.screenshot({ path: path.join(out, 'hidden.png') });
  await page.touchscreen.tap(207, spot);
  await page.waitForTimeout(400);
  const back = { state: await state(page), label: await label(page) };
  ok('the photo: a tap hides the joke, another shows it; the name follows', hidden.state === 'hidden' && hidden.opacity === '0' && back.state === 'shown' && l0 === 'Hide the joke' && hidden.label === 'Show the joke' && back.label === 'Hide the joke', { l0, hidden, back });
  // 8: keyboard.
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.id === 'dJokeToggle'); }
  const box = await page.evaluate(() => { const r = document.getElementById('dJokeToggle').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ok('keyboard: Tab reaches the button, it shows itself, Enter flips the joke', reached && box.w > 40 && box.h >= 44 && (await state(page)) === 'hidden', { reached, box });
  // 9: ad-free.
  const ads = await page.evaluate(() => [...document.querySelectorAll('.ad-slot, [data-ad-slot], [id^="ad-"], [class*="ad-slot"]')].filter((e) => e.getClientRects().length && (e.closest('#home-screen') || e.closest('#dSheet'))).length);
  ok('ad-free: no ad slot on Home or in its panel', ads === 0, { ads });
  await ctx.close();
}
// The beat and the pen, timed in an unpinned page (the real clock).
{
  const { ctx, page } = await phone({ pinClock: false });
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 30000 });
  const m = await marks(page);
  const at = (w) => m.find((x) => x.what === w)?.at;
  const beat = at('beat') - at('photo');
  const fontWait = at('write') - at('beat');
  const writing = at('shown') - at('write');
  ok('the beat: 2 s from the photograph landing, the writing done in 1.6 s at most (real clock)', beat >= 1950 && beat <= 2250 && fontWait <= 700 && writing <= 1850, { beatMs: beat, fontWaitMs: fontWait, writingMs: writing });
  await ctx.close();
}
// 9b: never held back (real clock). (a) The panel goes up during the beat and stays up past it: when it comes
// down the joke is written at once — one landing, no second beat. (b) Weekly and back during the beat: the
// same. (c) The panel left up: the joke is written where it stands by its ceiling, so it is there when the
// panel comes down.
{
  const { ctx, page } = await phone({ pinClock: false });
  await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 20000 });
  await page.evaluate(() => window.__PW_D.open());
  await page.waitForTimeout(3500);
  const upStill = await state(page);
  const closedAt = await page.evaluate(() => { window.__PW_D.close(); return performance.now(); });
  await page.waitForFunction(() => ['writing', 'shown'].includes(window.__PW_D.reveal.state()), null, { timeout: 5000 }).catch(() => {});
  const m = await marks(page);
  const writeAt = m.find((x) => x.what === 'write')?.at;
  ok('never held back (a): the panel up through the beat — one landing, and the joke is written within a second of the panel coming down', upStill === 'pending' && m.filter((x) => x.what === 'photo').length === 1 && writeAt != null && writeAt - closedAt >= 0 && writeAt - closedAt <= 1000, { upStill, marks: m.map((x) => x.what), afterCloseMs: writeAt != null ? Math.round(writeAt - closedAt) : null });
  await ctx.close();
}
{
  const { ctx, page } = await phone({ pinClock: false });
  await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 20000 });
  await page.evaluate(() => document.getElementById('navWeek').click());
  await page.waitForTimeout(3500);
  const away = await page.evaluate(() => ({ home: document.body.classList.contains('home-active'), state: window.__PW_D.reveal.state() }));
  const backAt = await page.evaluate(() => { document.getElementById('navHome').click(); return performance.now(); });
  await page.waitForFunction(() => ['writing', 'shown'].includes(window.__PW_D.reveal.state()), null, { timeout: 5000 }).catch(() => {});
  const m = await marks(page);
  const writeAt = m.find((x) => x.what === 'write')?.at;
  ok('never held back (b): Weekly and back during the beat — the joke is written within a second of Home returning, no second beat', !away.home && away.state === 'pending' && m.filter((x) => x.what === 'photo').length === 1 && writeAt != null && writeAt - backAt >= 0 && writeAt - backAt <= 1000, { away, marks: m.map((x) => x.what), afterBackMs: writeAt != null ? Math.round(writeAt - backAt) : null });
  await ctx.close();
}
{
  const { ctx, page } = await phone({ pinClock: false });
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'pending', null, { timeout: 20000 });
  await page.evaluate(() => window.__PW_D.open());
  const ceiling = await page.evaluate(() => window.__PW_D.reveal.pendingMaxMs);
  await page.waitForFunction(() => window.__PW_D.reveal.state() === 'shown', null, { timeout: ceiling + 4000 }).catch(() => {});
  const held = await page.evaluate(() => ({ open: document.body.classList.contains('d-sheet-open'), state: window.__PW_D.reveal.state(), marks: window.__PW_D.reveal.marks.map((m) => m.what) }));
  await page.evaluate(() => window.__PW_D.close());
  await page.waitForTimeout(500);
  const shownOpacity = await page.evaluate(() => getComputedStyle(document.getElementById('headline')).opacity);
  ok('never held back (c): the panel left up past the ceiling — the joke is written where it stands, and is there when the panel comes down', held.open && held.state === 'shown' && held.marks.some((w) => w === 'overdue' || w === 'photo-late') && shownOpacity === '1', { ...held, shownOpacity });
  await ctx.close();
}
// 9c: hidden ends with its photograph. Tapped away on one photograph, the joke comes back on the next one, even
// when the caption's words are the same (Sol's review, 27 Sept) — at once here, because this phone has shown it.
{
  const { ctx, page } = await phone({ pinClock: false });
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 30000 });
  await page.evaluate(() => window.__PW_D.reveal.flip());
  await page.waitForTimeout(400);
  const hidden = await state(page);
  // Another photograph lands (what app.js does when the picker moves on: a new src, then --hero-url on load).
  const other = readdirSync(path.join(dist, 'assets', 'images', 'bg-canonical')).filter((f) => f.endsWith('.webp'))[3];
  const swapped = await page.evaluate(async (f) => {
    const img = document.getElementById('bgImg');
    const before = img.currentSrc;
    await new Promise((r) => { img.onload = r; img.onerror = r; img.src = `/assets/images/bg-canonical/${f}`; });
    document.documentElement.style.setProperty('--hero-url', `url("${img.currentSrc || img.src}")`);
    return before !== img.currentSrc;
  }, other);
  await page.waitForFunction(() => window.__PW_D.reveal.state() === 'shown', null, { timeout: 8000 }).catch(() => {});
  const m = await marks(page);
  const after = { state: await state(page), opacity: await page.evaluate(() => getComputedStyle(document.getElementById('headline')).opacity) };
  // The joke was written on the first photograph, so this phone has shown it: on the next photograph it is simply
  // there (the seen-before rule); a joke never shown would get its beat.
  ok('hidden ends with its photograph: tapped away, then a new photograph — the joke comes back (there at once, seen before)', hidden === 'hidden' && swapped && m.some((x) => x.what === 'photo-changed') && m[m.length - 1].what === 'there' && after.state === 'shown' && after.opacity === '1', { hidden, swapped, marks: m.map((x) => x.what), after });
  await ctx.close();
}
// 10: the name in five languages — while the joke waits ("show") and once written ("hide").
{
  const want = { en: ['Show the joke', 'Hide the joke'], af: ['Wys die grap', 'Geen grap'], zu: ['Bonisa ihlaya', 'Fihla ihlaya'], xh: ['Bonisa isiqhulo', 'Fihla isiqhulo'], st: ['Bontsha motlae', 'Pata motlae'] };
  const got = {};
  for (const lang of Object.keys(want)) {
    const { ctx, page } = await phone({ lang });
    await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'pending', null, { timeout: 20000 });
    const show = await label(page);
    await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
    got[lang] = [show, await label(page)];
    await ctx.close();
  }
  ok('five languages: the button is named in each (Afrikaans in Al\'s words)', Object.keys(want).every((l) => got[l][0] === want[l][0] && got[l][1] === want[l][1]), got);
}
// 11: reduced motion.
{
  const { ctx, page } = await phone({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => (window.__PW_D?.reveal?.marks || []).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const m = (await marks(page)).map((x) => x.what);
  ok('reduced motion: the joke is simply there (no beat, no writing)', m[0] === 'there' && !m.includes('write'), m);
  await ctx.close();
}
// 12: seen before.
{
  const { ctx, page } = await phone();
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
  const first = (await marks(page)).map((x) => x.what);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__PW_D?.reveal?.marks || []).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const second = (await marks(page)).map((x) => x.what);
  ok('seen before: reopened, the same joke is simply there', first.includes('write') && second[0] === 'there' && !second.includes('write'), { first, second });
  await ctx.close();
}
// 13: a Cape wind warning still reads as a warning, in five languages.
{
  payload = makePayload(62);
  const got = {};
  for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
    const { ctx, page } = await phone({ lang });
    await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 20000 });
    got[lang] = await page.evaluate(() => {
      const b = document.getElementById('capeWindBanner');
      if (!b || b.classList.contains('hidden')) return { shown: false };
      const r = b.getBoundingClientRect();
      const header = document.querySelector('.header').getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const cs = getComputedStyle(b);
      let alpha = 1;
      for (let e = document.getElementById('capeWindText'); e && e !== document.body; e = e.parentElement) alpha *= parseFloat(getComputedStyle(e).opacity) || 1;
      return { shown: true, onTop: !!top?.closest('#capeWindBanner'), orange: /255,\s*111,\s*0/.test(cs.backgroundImage + cs.backgroundColor), headerBelow: header.top >= r.bottom - 1, opaque: alpha === 1, text: document.getElementById('capeWindText').textContent.trim().slice(0, 40) };
    });
    if (lang === 'en') await page.screenshot({ path: path.join(out, 'wind-warning.png') });
    await ctx.close();
  }
  payload = makePayload();
  ok('warnings: a Cape wind warning is on top, orange, whole and not faded, the header below it — five languages', Object.values(got).every((g) => g.shown && g.onTop && g.orange && g.headerBelow && g.opaque), got);
}
// 14: the weather fails: Try again shows on the photograph and a tap on it reaches it (Fable, 26 Sept: the
// frame's pointer-events:none made it dead) and asks for the weather again; the caption holds no joke.
{
  let calls = 0;
  const failing = { ...payload };
  payload = null;
  const { ctx, page } = await phone();
  await page.route('**/api/weather**', (route) => { calls += 1; route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const b = document.getElementById('retryWeather'); return b && !b.hidden && b.getClientRects().length; }, null, { timeout: 30000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const b = document.getElementById('retryWeather');
    if (!b || b.hidden || !b.getClientRects().length) return { shown: false };
    const box = b.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { shown: true, reaches: !!hit?.closest('#retryWeather'), inView: box.bottom <= innerHeight && box.top >= 0, text: b.textContent.trim(), caption: document.getElementById('headline').dataset.line, scrim: document.getElementById('dScrim')?.classList.contains('is-on') };
  });
  const before = calls;
  if (r.shown) { await page.tap('#retryWeather'); await page.waitForTimeout(1500); }
  await page.screenshot({ path: path.join(out, 'error-retry.png') });
  ok('the weather fails: Try again shows, a tap reaches it and asks again; no joke, no empty dark band', r.shown && r.reaches && r.inView && calls > before && r.caption === 'status' && !r.scrim, { ...r, callsBefore: before, callsAfter: calls });
  payload = failing;
  await ctx.close();
}
// 15: wider than a phone: the polaroid, none of D's pieces, the caption simply there.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(when));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const d = await page.evaluate(() => ({
    state: window.__PW_D?.reveal?.state?.(),
    opacity: getComputedStyle(document.getElementById('headline')).opacity,
    text: document.getElementById('headline').textContent.trim().slice(0, 40),
    dPieces: ['#dLine', '#dShare', '#dHandle', '#dSheet', '#dScrim', '#dJokeToggle'].filter((s) => { const e = document.querySelector(s); return e && e.getClientRects().length; }),
    heroFixed: getComputedStyle(document.getElementById('heroCard')).position,
  }));
  await page.screenshot({ path: path.join(out, 'desktop.png') });
  ok('desktop width: the polaroid — no D pieces, the caption simply there', d.state === 'shown' && d.opacity === '1' && d.text.length > 5 && d.dPieces.length === 0 && d.heroFixed !== 'fixed', d);
  await ctx.close();
}
// 16: the narrowest phone, in isiZulu (the longest words): the list stands, nothing scrolls sideways, panel
// down and up.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('zu')); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(when));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 20000 });
  const down = await sideways(page);
  await page.tap('#dHandle');
  await page.waitForTimeout(600);
  const up = await sideways(page);
  const list = await panelList(page);
  await sheetUp(page).catch(() => {});
  await page.screenshot({ path: path.join(out, 'panel-320-zu.png') });
  ok('320 wide, isiZulu: nothing on Home scrolls sideways, panel down or up; the list stands and scrolls inside the panel, wind in every row', down.length === 0 && up.length === 0 && list.tag === 'UL' && list.rows >= 12 && list.stacked && list.scrolls && list.windRows === list.rows, { down, up, rows: list.rows, windRows: list.windRows, wind: list.firstRow?.wind });
  await ctx.close();
}
// 17: for Al's eyes — the pulled-up list at 414x715 in English and isiZulu, its top and, scrolled to the
// bottom, the quiet Hourly link (output/home-d-list/).
for (const lang of ['en', 'zu']) {
  const { ctx, page } = await phone({ lang, pinClock: false });   // the real clock: the rise must finish for the shot
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
  await page.tap('#dHandle');
  await sheetUp(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(listOut, `list-top-${lang}.png`) });
  const atBottom = await page.evaluate(() => { const b = document.querySelector('#dSheet .d-sheet-body'); b.scrollTop = b.scrollHeight; return new Promise((r) => requestAnimationFrame(() => { const link = document.querySelector('#dSheet .d-more').getBoundingClientRect(); r(link.bottom <= innerHeight && link.top >= 0 && Math.abs(b.scrollTop + b.clientHeight - b.scrollHeight) < 2); })); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(listOut, `list-bottom-${lang}.png`) });
  ok(`${lang}: scrolled to the bottom of the list, the Hourly link is in view (screenshots in ${path.relative(process.cwd(), listOut)})`, atBottom);
  await ctx.close();
}
await browser.close();
server.close();
writeFileSync(path.join(out, 'checks.json'), `${JSON.stringify({ ranOn: new Date().toISOString(), engine: 'WebKit (Playwright) 414x715 @2x', results }, null, 1)}\n`);
const failed = results.filter((r) => !r.pass).length;
console.log(`${results.length - failed}/${results.length} pass`);
process.exit(failed ? 1 : 0);
