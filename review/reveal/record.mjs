// The joke that arrives late (Al, 25 Sept 2026): real-speed videos of Home D with the reveal, recorded in
// WebKit (Chrome on an iPhone is WebKit) at Al's 414x715, for review/reveal-for-al.html.
//
//   node review/reveal/record.mjs [--dist dist] [--out review/reveal-for-al] [--only rain,night] [--no-video]
//
// Per photograph: D as it is today (no reveal), then ink, word by word and fade at the 1 s beat, then ink
// at 2 s and 3.5 s — each on a fresh phone (nothing seen yet), cut to start just before the photograph
// lands and to end two seconds after the joke is whole, encoded H.264 so any browser plays it. Then the
// extras: a repeat visit (open, then open again: the joke already seen is simply there), a tap on the
// photograph to hide and show, reduced motion, and the postcard Share sends, per photograph. The timing
// marks (photograph landed, first ink, joke whole) come from the page itself (window.__PW_D.reveal.marks)
// and are written to data/timing.json beside the videos.
//
// The API is stubbed from a real production payload re-dressed per state (as review/eval/scripts/
// home-states.mjs does) and the clock pinned to a moment whose rotation week, SAST weekday and time slot
// pick the named photograph; Math.random is seeded, so every clip of a photograph carries the same joke.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = path.resolve(arg('--out', 'review/reveal-for-al'));
const ONLY = arg('--only', '');
const NO_VIDEO = process.argv.includes('--no-video');
const ONLY_CLIPS = arg('--clips', '');
for (const d of ['videos', 'postcards', 'data']) mkdirSync(path.join(OUT, d), { recursive: true });
const TMP = path.join(os.tmpdir(), `pw-reveal-${process.pid}`);
mkdirSync(TMP, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));

const longest = (lang) => {
  const src = readFileSync(path.join('assets', 'copy', `${lang}.js`), 'utf8');
  const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  const lines = [];
  const walk = (n) => { if (typeof n === 'string') lines.push(n); else if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') Object.values(n).forEach(walk); };
  walk(bank.witty || {});
  return lines.sort((a, b) => b.length - a.length)[0];
};

// The photographs Al named: rain, a clear day, night, the pale photograph with the dog, the longest
// isiZulu line, and the two most-shown photographs where D's joke sits on the subject (photo check,
// review/eval/photo-check/data/d-count.json: n 3 and 4, the first two judged "covers" in most-shown
// order). The parrot's joke sits on it only in isiZulu, isiXhosa and Sesotho (the English lines are
// shorter), so its clip is in isiXhosa, with the tallest isiXhosa line measured on it (107 px on the bird).
const STATES = [
  { id: 'rain', title: 'Rain', cond: 'rain', slot: 'rain/week_1/day/3.webp', hour: 12, temp: 14, label: 'Rain', extra: { rainChance: 85, precipMm: 3.2, cloudPct: 100, windKph: 22 } },
  { id: 'clear-day', title: 'Clear day', cond: 'clear', slot: 'clear/week_1/day/4.webp', hour: 12, temp: 24, label: 'Clear', extra: { rainChance: 2, precipMm: 0, cloudPct: 4, windKph: 12, uv: 8 } },
  { id: 'night', title: 'Night', cond: 'clear', slot: 'clear/week_2/night/5.webp', hour: 22, temp: 12, label: 'Clear', extra: { rainChance: 1, precipMm: 0, cloudPct: 5, windKph: 6, uv: 0 } },
  { id: 'pale-dog', title: 'The pale photograph with the dog', cond: 'cold', slot: 'cold/week_1/day/7.webp', hour: 12, temp: 9, label: 'Cold', extra: { rainChance: 5, precipMm: 0, cloudPct: 60, windKph: 10 } },
  { id: 'zu-longest', title: 'The longest isiZulu line', cond: 'cloudy', slot: 'cloudy/week_1/day/1.webp', hour: 12, temp: 17, lang: 'zu', caption: longest('zu'), label: 'Cloudy', extra: { rainChance: 20, precipMm: 0, cloudPct: 90, windKph: 18 } },
  { id: 'sprinkler', title: 'Most shown, joke on the subject: the sprinkler', cond: 'heat', slot: 'heat/week_1/day/7.webp', hour: 12, temp: 35, label: 'Heat', extra: { rainChance: 0, precipMm: 0, cloudPct: 3, windKph: 9, uv: 10 } },
  { id: 'parrot', title: 'Most shown, joke on the subject: the parrot', cond: 'heat', slot: 'heat/week_1/day/5.webp', hour: 12, temp: 35, lang: 'xh', caption: 'Isidlo sasemini sifudukele ngaphandle kuba ngaphakathi kushushu ngaphezu kwangaphandle. Akukho mntu unokuyicacisa.', label: 'Heat', extra: { rainChance: 0, precipMm: 0, cloudPct: 3, windKph: 9, uv: 10 } },
].filter((s) => !ONLY || ONLY.split(',').includes(s.id));

// The clips per photograph: D as it is (the baseline), the three styles at 1 s, ink at 2 s and 3.5 s.
const CLIPS = [
  { id: 'd-today', query: '', title: 'D today — no reveal' },
  { id: 'ink-1', query: 'reveal=ink&beat=1', title: 'Ink · 1 s' },
  { id: 'word-1', query: 'reveal=word&beat=1', title: 'Word by word · 1 s' },
  { id: 'fade-1', query: 'reveal=fade&beat=1', title: 'Fade · 1 s' },
  { id: 'ink-2', query: 'reveal=ink&beat=2', title: 'Ink · 2 s' },
  { id: 'ink-3.5', query: 'reveal=ink&beat=3.5', title: 'Ink · 3.5 s' },
].filter((c) => !ONLY_CLIPS || ONLY_CLIPS.split(',').includes(c.id));

const SLOT_HOUR = { dawn: 6, day: 12, dusk: 18.25, night: 22 };
const whenFor = (slot, hour) => {
  const [, wk, time, file] = slot.split('/');
  const week = Number(wk.replace('week_', '')), weekday = Number(file.replace('.webp', ''));
  const h = hour ?? SLOT_HOUR[time];
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== week) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + (weekday - 1) * DAY_MS + h * 3600e3;
    if (getRotationWeek(t) === week && getRotationDay(t) === weekday) return t;
  }
  throw new Error(`no date for ${slot}`);
};
const payloadFor = (s, t) => {
  const b = structuredClone(LIVE);
  const local = new Date(t + 7200e3);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  Object.assign(b.now, { tempC: s.temp, feelsLikeC: s.temp - 1, humidity: 70, uv: 0, conditionKey: s.cond, conditionLabel: s.label, isDay: hour >= 6 && hour < 18, windDir: 200 }, s.extra);
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: s.cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: s.cond === 'rain' ? 4 : 0, precipMm: s.extra.precipMm } };
  b.now.conditionReason = s.cond === 'rain' ? 'rain-now' : b.now.conditionReason;
  b.daily = b.daily.map((d, i) => ({ ...d, highC: s.temp + 3 - (i % 2), lowC: s.temp - 6 + (i % 3), rainChance: s.extra.rainChance, conditionKey: s.cond, conditionLabel: s.label, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.hourly = b.hourly.map((x, i) => ({ ...x, tempC: s.temp - 3 + Math.round(4 * Math.sin((i - 6) / 24 * 2 * Math.PI)), rainChance: s.extra.rainChance, precipMm: s.extra.precipMm / 3, windKph: s.extra.windKph, condition: s.cond }));
  b.wind_kph = s.extra.windKph; b.gustKph = Math.round(s.extra.windKph * 1.6); b.maxWindKph = b.gustKph;
  b.location = { ...b.location, name: 'Strand' };
  b.meta = { ...b.meta, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: s.cond, sourceAgreement: '4/5' } };
  return b;
};

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const REWRITE = { '/': 'index.html' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, city: 'Strand', admin1: 'Western Cape', lat: -34.1163, lon: 18.8362, name: 'Strand, Western Cape', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const IOS_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await webkit.launch();

async function openPhone(s, { video = true, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IOS_CHROME_UA,
    timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'],
    serviceWorkers: 'block', reducedMotion,
    ...(video && !NO_VIDEO ? { recordVideo: { dir: TMP, size: { width: 828, height: 1430 } } } : {}),
  });
  await ctx.addInitScript(({ lang, caption }) => {
    try {
      if (!localStorage.getItem('lang')) localStorage.setItem('lang', JSON.stringify(lang));
      localStorage.setItem('pw_install_dismissed_until', String(9e15));
      localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' }));
    } catch {}
    let seed = 7;   // the same joke in every clip of a photograph
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    // A named line (the longest isiZulu, the parrot's isiXhosa) goes on the caption the moment the app
    // writes a joke there — before D's own watcher sees it, so the reveal treats it as the joke.
    if (caption) {
      document.addEventListener('DOMContentLoaded', () => {
        const h = document.getElementById('headline');
        if (!h) return;
        const force = () => { if (h.dataset.line === 'joke' && h.textContent !== caption) h.textContent = caption; };
        new MutationObserver(force).observe(h, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-line'] });
      });
    }
  }, { lang: s.lang || 'en', caption: s.caption || '' });
  const page = await ctx.newPage();
  const born = Date.now();          // the video's first frame, near enough
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.setFixedTime(new Date(whenFor(s.slot, s.hour)));
  return { ctx, page, born, errors };
}
// performance.now() in the page -> milliseconds into the video.
async function clockOffset(page, born) {
  const t0 = Date.now();
  const pn = await page.evaluate(() => performance.now());
  const t1 = Date.now();
  return (t0 + t1) / 2 - pn - born;
}
const waitMark = (page, what, timeout = 25000) => page.waitForFunction((w) => window.__PW_D?.reveal?.marks?.some((m) => w.includes(m.what)), what, { timeout });
const marksOf = (page) => page.evaluate(() => window.__PW_D?.reveal?.marks || []);
const landed = async (page) => {
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
  await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); const s = document.getElementById('pwSplash'); return i && i.complete && i.naturalWidth > 0 && (!s || getComputedStyle(s).opacity < 0.05); }, null, { timeout: 20000 });
};
function encode(raw, out, fromMs, toMs) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-ss', (Math.max(0, fromMs) / 1000).toFixed(3), '-to', (toMs / 1000).toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-an', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${out}: ${r.stderr}`);
}
async function finish(ph, name, fromMs, toMs) {
  const video = ph.page.video();
  await ph.page.close();
  await ph.ctx.close();
  if (!video || NO_VIDEO) return null;
  const raw = await video.path();
  const out = path.join(OUT, 'videos', `${name}.mp4`);
  encode(raw, out, fromMs, toMs);
  rmSync(raw, { force: true });
  return path.relative(OUT, out).replaceAll('\\', '/');
}
const at = (marks, what) => marks.find((m) => what.includes(m.what))?.at;

const timing = { recordedOn: new Date().toISOString(), viewport: '414x715 @2x, WebKit (Chrome on iPhone)', states: {} };
for (const s of STATES) {
  current = payloadFor(s, whenFor(s.slot, s.hour));
  const rec = timing.states[s.id] = { title: s.title, slot: s.slot, lang: s.lang || 'en', clips: {} };
  for (const c of CLIPS) {
    const ph = await openPhone(s);
    const q = ['home=d', c.query, c.query ? 'replay=1' : ''].filter(Boolean).join('&');
    await ph.page.goto(`${BASE}?${q}`, { waitUntil: 'domcontentloaded' });
    let from; let to; let marks = [];
    if (c.query) {
      await waitMark(ph.page, ['shown', 'there']);
      marks = await marksOf(ph.page);
      const off = await clockOffset(ph.page, ph.born);
      const photo = at(marks, ['photo']);
      const shown = at(marks, ['shown', 'there']);
      from = off + photo - 900;
      to = off + shown + 2000;
      await ph.page.waitForTimeout(2300);
    } else {
      // D as it is: the same window — from just before the photograph lands to three seconds after.
      await landed(ph.page);
      const off = await clockOffset(ph.page, ph.born);
      const now = await ph.page.evaluate(() => performance.now());
      from = off + now - 900;
      to = off + now + 3000;
      await ph.page.waitForTimeout(3300);
    }
    const joke = await ph.page.evaluate(() => document.getElementById('headline')?.textContent?.trim() || '');
    const high = await ph.page.evaluate(() => document.body.classList.contains('d-joke-high'));
    const file = await finish(ph, `${s.id}--${c.id}`, from, to);
    const gap = (a, b) => (at(marks, a) != null && at(marks, b) != null ? at(marks, b) - at(marks, a) : null);
    rec.clips[c.id] = { title: c.title, file, joke, risen: high, beatMs: gap(['photo'], ['write']), writeMs: gap(['write'], ['shown']), marks, errors: ph.errors };
    rec.joke = rec.joke || joke;
    console.log(`${s.id} ${c.id}: ${file || '(no video)'}  beat ${rec.clips[c.id].beatMs ?? '-'} ms, write ${rec.clips[c.id].writeMs ?? '-'} ms${ph.errors.length ? `  ERRORS ${ph.errors.join(' | ')}` : ''}`);
  }

  // The postcard Share sends (the reveal's Share), and D's own screen picture beside it for comparison.
  {
    const ph = await openPhone(s, { video: false });
    await ph.page.goto(`${BASE}?home=d&reveal=ink&beat=1`, { waitUntil: 'domcontentloaded' });
    await waitMark(ph.page, ['shown', 'there']);
    await ph.page.waitForTimeout(400);
    const card = await ph.page.evaluate(() => window.__PW_D?.shareImage?.());
    if (card) writeFileSync(path.join(OUT, 'postcards', `${s.id}.jpg`), Buffer.from(card.split(',')[1], 'base64'));
    await ph.page.screenshot({ path: path.join(OUT, 'postcards', `${s.id}-screen.png`) });
    await ph.ctx.close();
    rec.postcard = card ? `postcards/${s.id}.jpg` : null;
  }
}

// The extras, on the rain photograph and the pale one.
const extras = {};
const EXTRA_STATE = (id) => STATES.find((x) => x.id === id) || STATES[0];
if (!ONLY_CLIPS || ONLY_CLIPS.includes('extras')) {
  // A repeat visit: first open writes the joke on; the app opened again shows the same joke, already
  // seen, simply there (no replay=1: this is the product's own memory).
  {
    const s = EXTRA_STATE('rain');
    current = payloadFor(s, whenFor(s.slot, s.hour));
    const ph = await openPhone(s);
    await ph.page.goto(`${BASE}?home=d&reveal=ink&beat=1`, { waitUntil: 'domcontentloaded' });
    await waitMark(ph.page, ['shown']);
    const first = await marksOf(ph.page);
    const off1 = await clockOffset(ph.page, ph.born);
    await ph.page.waitForTimeout(1500);
    const reloadAt = Date.now() - ph.born;
    await ph.page.reload({ waitUntil: 'domcontentloaded' });
    await waitMark(ph.page, ['there', 'shown']);
    const second = await marksOf(ph.page);
    await landed(ph.page);
    await ph.page.waitForTimeout(3000);
    const seen = await ph.page.evaluate(() => JSON.parse(localStorage.getItem('pw_d_jokes_seen') || '[]').length);
    const file = await finish(ph, 'extra--repeat-visit', off1 + at(first, ['photo']) - 900, Date.now() - ph.born);
    extras.repeat = { file, state: s.id, first, second, reloadAtMs: reloadAt, seenStored: seen, secondVisit: second.map((m) => m.what) };
    console.log(`repeat visit: ${file}  second open marks: ${second.map((m) => m.what).join(',')}`);
  }
  // The tap: the joke writes on, a tap on the photograph hides it, another brings it back.
  {
    const s = EXTRA_STATE('pale-dog');
    current = payloadFor(s, whenFor(s.slot, s.hour));
    const ph = await openPhone(s);
    await ph.page.goto(`${BASE}?home=d&reveal=ink&beat=1`, { waitUntil: 'domcontentloaded' });
    await waitMark(ph.page, ['shown']);
    const off = await clockOffset(ph.page, ph.born);
    const m0 = await marksOf(ph.page);
    // A spot on the photograph with no control on it (the open picture between the title and the joke).
    const spot = await ph.page.evaluate(() => {
      for (let y = 300; y < 600; y += 10) { const el = document.elementFromPoint(207, y); if (el && el.closest('#heroCard')) return { x: 207, y }; }
      return null;
    });
    const labels = [await ph.page.evaluate(() => document.getElementById('dJokeToggle')?.textContent)];
    await ph.page.waitForTimeout(1200);
    await ph.page.touchscreen.tap(spot.x, spot.y);
    await ph.page.waitForTimeout(1500);
    labels.push(await ph.page.evaluate(() => document.getElementById('dJokeToggle')?.textContent));
    const hiddenOpacity = await ph.page.evaluate(() => getComputedStyle(document.getElementById('headline')).opacity);
    const inTree = await ph.page.evaluate(() => { const h = document.getElementById('headline'); return !!h.textContent.trim() && getComputedStyle(h).visibility !== 'hidden' && getComputedStyle(h).display !== 'none'; });
    await ph.page.touchscreen.tap(spot.x, spot.y);
    await ph.page.waitForTimeout(1500);
    labels.push(await ph.page.evaluate(() => document.getElementById('dJokeToggle')?.textContent));
    const marks = await marksOf(ph.page);
    const file = await finish(ph, 'extra--tap-hide-show', off + at(m0, ['photo']) - 900, Date.now() - ph.born);
    extras.tap = { file, state: s.id, spot, labels, hiddenOpacity, textStaysForScreenReaders: inTree, marks: marks.map((m) => m.what) };
    console.log(`tap: ${file}  labels ${labels.join(' -> ')}  hidden opacity ${hiddenOpacity}`);
  }
  // Reduced motion: the joke arrives with the photograph, no beat, no writing.
  {
    const s = EXTRA_STATE('clear-day');
    current = payloadFor(s, whenFor(s.slot, s.hour));
    const ph = await openPhone(s, { reducedMotion: 'reduce' });
    await ph.page.goto(`${BASE}?home=d&reveal=ink&beat=1`, { waitUntil: 'domcontentloaded' });
    await waitMark(ph.page, ['there', 'shown']);
    await landed(ph.page);
    const off = await clockOffset(ph.page, ph.born);
    const now = await ph.page.evaluate(() => performance.now());
    await ph.page.waitForTimeout(2500);
    const marks = await marksOf(ph.page);
    const file = await finish(ph, 'extra--reduced-motion', off + now - 900, off + now + 2400);
    extras.reducedMotion = { file, state: s.id, marks: marks.map((m) => m.what) };
    console.log(`reduced motion: ${file}  marks ${marks.map((m) => m.what).join(',')}`);
  }
}
timing.extras = extras;
const prev = existsSync(path.join(OUT, 'data', 'timing.json')) ? JSON.parse(readFileSync(path.join(OUT, 'data', 'timing.json'), 'utf8')) : null;
if (prev && ONLY) timing.states = { ...prev.states, ...timing.states };
if (prev && !Object.keys(extras).length) timing.extras = prev.extras;
writeFileSync(path.join(OUT, 'data', 'timing.json'), `${JSON.stringify(timing, null, 1)}\n`);
await browser.close();
server.close();
rmSync(TMP, { recursive: true, force: true });
