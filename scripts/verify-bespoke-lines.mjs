// DO THE BESPOKE LINES ACTUALLY REACH THE SCREEN?
//
// Al's lines are written for one photograph each and must only ever appear on
// it. That is a claim about the running app, not about a lookup table, so this
// drives the built app and reads the caption the browser painted.
//
// Four things, and the last two are the ones that would fail silently:
//   1. INVARIANT on a natural load — whatever the picker lands on, if that
//      photograph has bespoke lines the caption is one of them, and if it does
//      not the caption is a condition-bank line. Never a line from another
//      picture.
//   2. The same invariant across ALL SEVEN slots of a folder, by pinning
//      Math.random so pickRandomIndex returns each index in turn. At least one
//      of the seven must land on a photograph that has lines, or the test has
//      proved nothing about the branch that matters.
//   3. A photograph with NO bespoke lines keeps a condition-bank line. A bug
//      here would leave another picture's joke on screen.
//   4. Afrikaans keeps the condition bank. Al writes the AF himself; an English
//      line leaking into an AF session is the worst failure available here,
//      because it looks deliberate.
//
// NOT DONE BY POINTING #bgImg AT AN IMAGE, which was the obvious first attempt:
// the picker's onload handler nulls itself on success ("detach so a later cache
// eviction can't replay the chain"), so a later src assignment fires nothing and
// the caption never updates. The real corrective path still works because in a
// genuine fallback the load has not succeeded yet. Pinning the pick exercises
// the synchronous chain[0] path the app actually takes.
//
//   node scripts/verify-bespoke-lines.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HERO_LINES } from '../assets/hero-lines.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const DATE = '2026-08-19';
const fails = [];
const ok = [];
const check = (name, cond, detail) => (cond ? ok : fails).push(`${name}${detail ? ' — ' + detail : ''}`);

// The leak test below asks: did a line belonging to ANOTHER photograph land here? That
// question is only answerable for lines that exist ONLY in the bespoke table.
//
// Al's round-1 matching (2026-08-27) hand-placed 349 CONDITION-BANK lines onto photographs,
// so 350 of the 834 bespoke lines are also live bank lines. A bank line appearing on a
// photograph with no bespoke set is the bank doing its job, not a leak — the bespoke table
// pins a line TO a photograph, it does not remove it FROM the bank. Counting those as leaks
// failed three of seven slots on lines the app was serving correctly.
//
// NOTE FOR AL, not for this gate: pinning a bank line is therefore not exclusive. "The sky's
// having a full-on tantrum." is pinned to one storm photograph and can still appear on any
// other storm photograph that has no bespoke set. Making it exclusive means removing the
// line from the bank, which changes all five languages and the share card — his call.
const BANK_LINES = new Set();
for (const bin of Object.values(WEATHER_COPY.witty || {})) {
  for (const arr of Object.values(bin || {})) {
    if (Array.isArray(arr)) for (const s of arr) if (typeof s === 'string' && s.trim()) BANK_LINES.add(s.trim());
  }
}
const ALL_BESPOKE = new Set(Object.values(HERO_LINES).flat().filter((s) => !BANK_LINES.has(s)));
if (!Object.keys(HERO_LINES).length) throw new Error('HERO_LINES is empty — run node scripts/build-hero-lines.mjs');
if (!ALL_BESPOKE.size) throw new Error('every bespoke line is also a bank line — the leak probe would be vacuous');

// Storm at NIGHT: that is the bucket Al's replacements landed in, so it is the
// only one with bespoke lines to find. The flag is read by the server on each
// request, so a context opened as night gets a night payload.
let nightMode = true;
const payload = () => ({
  ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
  now: { tempC: 14, feelsLikeC: 11, uv: 1, isDay: !nightMode, windKph: 46, rainChance: 92, cloudPct: 98,
    conditionKey: 'storm', conditionLabel: 'Storms rolling in.', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
  hourly: Array.from({ length: 48 }, () => ({ tempC: 14, feelsLikeC: 11, rainChance: 92, precipMm: 1.2,
    windKph: 46, windDir: 205, cloudPct: 98, humidity: 70, uv: 1, condition: 'storm' })),
  daily: Array.from({ length: 7 }, () => ({ highC: 17, lowC: 11, rainChance: 92, uv: 1, windKph: 46,
    conditionKey: 'storm', conditionLabel: 'Storms rolling in.', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` })),
  wind_kph: 46, maxWindKph: 64, gustKph: 64, windDir: 205, consensus: { confidenceKey: 'decent' },
  meta: { localHour: nightMode ? 22 : 13, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
    conditionConfidence: { level: 'high', finalCondition: 'storm', sourceAgreement: '5/5' } },
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pn.startsWith('/api/')) {
    return res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(pn === '/api/weather' ? payload() : { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West' }));
  }
  if (pn.startsWith('/_vercel/')) return res.writeHead(204).end();
  let f = null; let buf = null;
  try { f = path.resolve(dist, pn === '/' ? 'index.html' : pn.slice(1)); buf = readFileSync(f); }
  catch { return res.writeHead(404).end(); }
  return res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const open = async (lang, pinnedRandom, night) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  nightMode = !!night;
  await page.clock.install({ time: new Date(`${DATE}T${night ? '22' : '13'}:12:00+02:00`) });
  await page.addInitScript(({ l, rnd }) => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      // 'lang', NOT 'pw_lang'. SETTINGS_KEYS.lang is the bare string 'lang'
      // (app.js:594) and loadJSON reads localStorage by that key directly. Every
      // harness in this repo writes 'pw_lang', which the app never reads — it is
      // harmless where the value is 'en' (the resolved default anyway) and it is
      // exactly why this check first reported an English line reaching an
      // Afrikaans session: the session was never Afrikaans.
      localStorage.setItem('lang', JSON.stringify(l));
    } catch (_) {}
    // Pin the picker's slot choice. pickRandomIndex() is the only consumer that
    // matters here and it is 1 + floor(random * 7).
    if (typeof rnd === 'number') Math.random = () => rnd;
  }, { l: lang, rnd: pinnedRandom });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const s = document.getElementById('pwSplash');
    return !s || s.classList.contains('splash-done');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  return { ctx, page };
};

// ---- the invariant, across all seven slots of one folder --------------------
// Storm at night: the bucket Al's replacements went into, so it is the one with
// bespoke lines to find.
let hits = 0;
let bespokeSlot = 0;
for (let slot = 1; slot <= 7; slot += 1) {
  // pickRandomIndex() is 1 + floor(random * 7), so this pins it to `slot`.
  const rnd = (slot - 1) / 7 + 0.01;
  const { ctx, page } = await open('en', rnd, true);
  const seen = await page.evaluate(() => ({
    src: document.getElementById('bgImg').getAttribute('src') || '',
    line: (document.getElementById('headline').textContent || '').trim(),
  }));
  const key = seen.src.replace(/^.*assets\/images\//, '').split('?')[0];
  const own = HERO_LINES[key];
  if (own) {
    hits += 1;
    bespokeSlot = bespokeSlot || slot;
    check(`slot ${slot}: caption is one of THIS photograph's own five`, own.includes(seen.line),
      `${key.slice(0, 26)}… → "${seen.line}"`);
  } else {
    check(`slot ${slot}: no bespoke set, so no other picture's line leaks in`,
      !ALL_BESPOKE.has(seen.line) && seen.line.length > 0, `"${seen.line}"`);
  }
  await ctx.close();
}
check('at least one slot exercised the bespoke branch', hits > 0, `${hits} of 7 landed on a photograph with lines`);

// ---- Afrikaans keeps the condition bank -------------------------------------
if (bespokeSlot) {
  // The same pinned pick that landed on a bespoke photograph above, so this is
  // a session that WOULD have received an English line but must not.
  const rnd = (bespokeSlot - 1) / 7 + 0.01;
  const { ctx, page } = await open('af', rnd, true);
  const line = await page.evaluate(() => (document.getElementById('headline').textContent || '').trim());
  check('Afrikaans never receives an English bespoke line', !ALL_BESPOKE.has(line), `"${line}"`);
  await ctx.close();
}

await browser.close();
server.close();

console.log(`table: ${Object.keys(HERO_LINES).length} keys, ${ALL_BESPOKE.size} distinct lines\n`);
for (const o of ok) console.log('  ✓ ' + o);
if (fails.length) {
  console.log('');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log(`\n[bespoke lines] PASS — ${ok.length} checks.`);
