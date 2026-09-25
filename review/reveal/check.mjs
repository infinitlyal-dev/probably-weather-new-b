// The joke that arrives late (2026-09-25): the behaviour checks behind Al's page, in WebKit at 414x715.
//
//   node review/reveal/check.mjs [--dist dist]      -> review/reveal-for-al/data/checks.json, PASS/FAIL per line
//
// What the brief asks and how each is checked on the built app (the stub API and pinned clock of
// record.mjs, the rain photograph unless named):
//   weather first      the temperature and the credit line are on screen while the joke waits
//   screen readers     during the beat the joke is in the accessibility tree (aria snapshot), only faded
//   nothing moves      the joke's box, the credit line and the title card: same rects waiting and written
//   Share              tapping Share opens the share sheet (stubbed) and leaves the joke as it was
//   the handle         tapping it opens the panel and leaves the joke as it was; so does a swipe up
//   the photo          a tap hides the joke, another shows it; the button's name follows
//   keyboard           Tab reaches the button, it shows itself, Enter flips the joke
//   five languages     the button's name in each language
//   reduced motion     the joke is there with the photograph: no beat, no writing
//   seen before        reopened, the same joke is simply there
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const SLOT = 'rain/week_1/day/3.webp';
const when = (() => {
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== 1) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + 2 * DAY_MS + 12 * 3600e3;
    if (getRotationWeek(t) === 1 && getRotationDay(t) === 3) return t;
  }
  throw new Error('no date');
})();
const payload = (() => {
  const b = structuredClone(LIVE);
  Object.assign(b.now, { tempC: 14, feelsLikeC: 13, humidity: 90, uv: 0, conditionKey: 'rain', conditionLabel: 'Rain', isDay: true, windDir: 200, rainChance: 85, precipMm: 3.2, cloudPct: 100, windKph: 22 });
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: [{ kind: 'rain-now' }], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: 4, precipMm: 3.2 } };
  b.now.conditionReason = 'rain-now';
  b.location = { ...b.location, name: 'Strand' };
  return b;
})();
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

async function phone({ lang = 'en', reducedMotion = 'no-preference', query = 'home=d&reveal=ink&beat=2' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block', reducedMotion });
  await ctx.addInitScript((l) => {
    try { if (!localStorage.getItem('lang')) localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {}
    window.__shared = 0;
    navigator.share = () => { window.__shared += 1; return Promise.resolve(); };
    navigator.canShare = () => true;
  }, lang);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(when));
  await page.goto(`${BASE}?${query}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}
const state = (page) => page.evaluate(() => window.__PW_D?.reveal?.state?.());
const marks = (page) => page.evaluate(() => (window.__PW_D?.reveal?.marks || []).map((m) => m.what));
const label = (page) => page.evaluate(() => document.getElementById('dJokeToggle')?.textContent);
const rects = (page) => page.evaluate(() => Object.fromEntries(['#headline', '#dLine', '#weatherStatus', '#dHandle', '#dShare'].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return [s, r ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(',') : null]; })));

// 1–3: weather first, screen readers, nothing moves (a 2 s beat leaves time to look during the wait).
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
  ok('weather first: temperature and credit line on screen while the joke waits', waiting.state === 'pending' && /\d/.test(waiting.temp || '') && (waiting.line || '').length > 10, { temp: waiting.temp, state: waiting.state });
  ok('screen readers: the waiting joke is in the accessibility tree (only faded)', waiting.opacity === '0' && tree.includes(waiting.joke.slice(0, 30)), { opacity: waiting.opacity });
  await page.waitForFunction(() => window.__PW_D.reveal.state() === 'shown', null, { timeout: 20000 });
  const after = await rects(page);
  const moved = Object.keys(before).filter((k) => before[k] !== after[k]);
  ok('nothing moves: joke box, credit line, title card, handle, Share — same rects waiting and written', moved.length === 0, moved.length ? { before, after } : 'identical');
  // 4: Share
  await page.tap('#dShare');
  await page.waitForTimeout(300);
  ok('Share: opens the share sheet and leaves the joke alone', (await page.evaluate(() => window.__shared)) === 1 && (await state(page)) === 'shown');
  // 5: the handle, then a swipe up on the photograph
  await page.tap('#dHandle');
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => document.body.classList.contains('d-sheet-open'));
  ok('the handle: opens the panel and leaves the joke alone', opened && (await state(page)) === 'shown');
  await page.evaluate(() => window.__PW_D.close());
  await page.waitForTimeout(500);
  // WebKit here will not construct Touch objects, so the swipe is two plain events carrying the touch
  // fields D's swipe handler reads (touches / changedTouches with clientX, clientY) — synthetic.
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
  // 6: the photograph
  const spot = await page.evaluate(() => { for (let y = 300; y < 600; y += 10) { const el = document.elementFromPoint(207, y); if (el && el.closest('#heroCard')) return y; } return null; });
  const l0 = await label(page);
  await page.touchscreen.tap(207, spot);
  await page.waitForTimeout(400);
  const hidden = { state: await state(page), label: await label(page), opacity: await page.evaluate(() => getComputedStyle(document.getElementById('headline')).opacity) };
  await page.touchscreen.tap(207, spot);
  await page.waitForTimeout(400);
  const back = { state: await state(page), label: await label(page) };
  ok('the photo: a tap hides the joke, another shows it; the name follows', hidden.state === 'hidden' && hidden.opacity === '0' && back.state === 'shown' && l0 === 'Hide the joke' && hidden.label === 'Show the joke' && back.label === 'Hide the joke', { l0, hidden, back });
  // 7: keyboard
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.id === 'dJokeToggle'); }
  const box = await page.evaluate(() => { const r = document.getElementById('dJokeToggle').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ok('keyboard: Tab reaches the button, it shows itself, Enter flips the joke', reached && box.w > 40 && box.h >= 44 && (await state(page)) === 'hidden', { reached, box });
  await page.screenshot({ path: 'review/reveal-for-al/data/keyboard-focus.png' });
  await ctx.close();
}
// 8: the name in five languages (after the joke is written)
{
  const want = { en: 'Hide the joke', af: 'Versteek die grap', zu: 'Fihla ihlaya', xh: 'Fihla isiqhulo', st: 'Pata motlae' };
  const got = {};
  for (const lang of Object.keys(want)) {
    const { ctx, page } = await phone({ lang, query: 'home=d&reveal=fade&beat=0' });
    await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
    got[lang] = await label(page);
    await ctx.close();
  }
  ok('five languages: the button is named in each', Object.keys(want).every((l) => got[l] === want[l]), got);
}
// 9: reduced motion
{
  const { ctx, page } = await phone({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => (window.__PW_D?.reveal?.marks || []).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const m = await marks(page);
  ok('reduced motion: the joke is simply there (no beat, no writing)', m[0] === 'there' && !m.includes('write'), m);
  await ctx.close();
}
// 10: seen before
{
  const { ctx, page } = await phone({ query: 'home=d&reveal=ink&beat=1' });
  await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
  const first = await marks(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__PW_D?.reveal?.marks || []).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const second = await marks(page);
  ok('seen before: reopened, the same joke is simply there', first.includes('write') && second[0] === 'there' && !second.includes('write'), { first, second });
  await ctx.close();
}
// 11: D without the switch is D as it was — no reveal pieces, the joke's own dark still on the caption
{
  const { ctx, page } = await phone({ query: 'home=d' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => ({ reveal: !!window.__PW_D?.reveal, scrim: !!document.getElementById('dScrim'), toggle: !!document.getElementById('dJokeToggle'), bg: getComputedStyle(document.getElementById('headline')).backgroundImage.slice(0, 15), opacity: getComputedStyle(document.getElementById('headline')).opacity }));
  ok('D without the switch: none of the reveal, the caption keeps its own dark', !d.reveal && !d.scrim && !d.toggle && d.bg.startsWith('linear-gradient') && d.opacity === '1', d);
  await ctx.close();
}
// 12: wider than a phone, D keeps today's polaroid — the caption is simply there, never held back
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(when));
  await page.goto(`${BASE}?home=d&reveal=ink&beat=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const d = await page.evaluate(() => ({ state: window.__PW_D?.reveal?.state?.(), opacity: getComputedStyle(document.getElementById('headline')).opacity, text: document.getElementById('headline').textContent.trim().slice(0, 40) }));
  ok('desktop width: the polaroid caption is simply there', d.state === 'shown' && d.opacity === '1' && d.text.length > 5, d);
  await ctx.close();
}
await browser.close();
server.close();
mkdirSync('review/reveal-for-al/data', { recursive: true });
writeFileSync('review/reveal-for-al/data/checks.json', `${JSON.stringify({ ranOn: new Date().toISOString(), engine: 'WebKit (Playwright) 414x715 @2x', results }, null, 1)}\n`);
const failed = results.filter((r) => !r.pass).length;
console.log(`${results.length - failed}/${results.length} pass`);
process.exit(failed ? 1 : 0);
