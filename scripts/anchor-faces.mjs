// Crop anchors from the faces in each photograph (Al, 8 Oct 2026): a face is never under the number, the buttons or
// the joke on the phone. The outdoor-gym photograph (clear/week_4/day/1, 7d13aaa156f4) had both faces under the
// temperature on Al's phone on 7 Oct.
//
// THE SAFE BAND (Home D, assets/home-d.css — the phone Home since 28 Sept; app.css's 342x304 band card is the old Home)
// The photograph fills the screen (`background-size: cover`, `background-position: center var(--hero-crop, 78%)`).
// A face must sit BELOW the title card's last box (the number, "Probably …" + the condition, the Share pill, the
// header with the Language button) and ABOVE the joke's box (its dark scrim is laid on that box, home-d.js). When
// home-d.js raises the joke under "Probably …" (.d-joke-high), the band is instead below the joke and above the
// credit line's fade. Measured on the BUILT page (dist/, the fold gate's fixture server and payload), photograph by
// photograph with that photograph's longest English line (Al's phone is in English), at Al's phone:
//   414x715 (iPhone 11 + Chrome, the fold gate's "Al's iPhone 11 + Chrome") — DECIDES
//   414x896 (the same phone, installed)                                      — reported beside it
// With a two-line joke at the foot the band at 414x715 runs from 28.8 % to 54.8 % of the screen's height:
// the title card's last box (the "Probably …" line) ends at 206 px; the joke's box starts at 371 px and its dark, which
// fades in over the box's top padding, is half on at 392 px — a face is under the joke from there
// (`node scripts/anchor-faces.mjs --band`, the gym photograph, a two-line English joke). A longer joke starts higher.
// Each box of the title card is judged on its own: a face beside the number, under nothing, is fine. (Al's head band
// for regenerated photographs, 40–62 % of the frame, overlaps this; its lowest few percent reach the joke on this phone.)
//
// WHAT THE OFFSET CAN DO. At 414x715 a 1008x1792 photograph is scaled to 414x736: the offset can slide it 21 px.
// At 414x896 it is scaled to 504x896 and cannot slide at all. So on Al's phone the anchor barely moves the picture;
// what it does move is the joke: home-d.js reads the anchor as where the subject is and raises the joke to the top
// when the subject would sit under it at the foot. This script models that rule exactly (placeJoke, home-d.js) and
// searches every anchor 0–100 for one where every head clears the title card and the joke, wherever the joke goes.
//
// A HEAD is found by the local detector (tools/face/detect.mjs: Human 3.3, MoveNet MultiPose + CenterNet + BlazeFace on
// the TensorFlow.js WASM backend — tfjs-node would not build). Heads under 2.5 % of the photograph's height (a person
// far off in the background) are listed but not judged.
//
// DECISIONS, per photograph:
//   pass      — every head clears at its current anchor (Al's ruling, or the 78 % default): nothing changes.
//   moved     — a head is hidden at the current anchor and another anchor clears it: the nearest such anchor.
//   cannot be saved — no anchor clears every head at 414x715.
// Al's rulings are replaced only for "moved". The desktop polaroid keeps Al's anchors (build-hero-crop-desktop.mjs
// writes an override wherever the phone table now differs from review/set-001-crop-anchors.json).
//
//   cd tools/face && npm install                      (once)
//   npm run build                                     (the measurement reads dist/)
//   node scripts/anchor-faces.mjs --dry-run           decide and report, write nothing but the audit
//   node scripts/anchor-faces.mjs                     also write review/set-001-crop-offsets.json, rebuild assets/hero-crop.js
//   node scripts/anchor-faces.mjs --band              print the band for a two-line joke and stop
//
// Output: review/crop-audit-2026-10-08.md + .json, review/crop-audit-2026-10-08/*.jpg (the phone renders),
//         review/new-sets-crop-2026-10-08.json (anchors for the 69 new photographs, by filename, for the ingest),
//         review/face-detections-2026-10-08.json (the detector's heads, cached by image hash).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const BAND_ONLY = args.includes('--band');
const NEW_ONLY = args.includes('--new-only'); // the quality loop: judge the new sets only, print, write nothing
// --reframes: the library reframe loop (8 Oct 2026) — judge each take in review/library-reframe-2026-10-08/<hash>.png with
// that photograph's own lines; print, write nothing.
const REFRAMES = args.includes('--reframes');
const R = (...p) => path.join(root, ...p);
const json = (rel) => JSON.parse(readFileSync(R(rel), 'utf8'));
const sha12 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);
const DATE = '2026-10-08';
const OUT_DIR = R('review', `crop-audit-${DATE}`);
const VIEWPORTS = [
  { w: 414, h: 715, name: "Al's iPhone 11 + Chrome", decides: true },
  { w: 414, h: 896, name: "Al's iPhone 11, installed" },
];
const MIN_HEAD = 0.025;   // of the photograph's height
const MARGIN = 4;         // px of clear photograph between a head and the box it must clear
const D_CAP_FOOT = 6;     // home-d.js: the joke's bottom padding at the foot
const CSS_DEFAULT = Number(/var\(--hero-crop,\s*([\d.]+)%\)/.exec(readFileSync(R('assets', 'app.css'), 'utf8'))[1]);
const SAMPLE_LINE = 'Sun, then cloud, then sun. Even the monkeys can\'t plan around that.'; // a two-line joke

// ---------------------------------------------------------------- the photographs and their lines
const draft = json('review/set-001-draft.json');
const offsetsDoc = json('review/set-001-crop-offsets.json');
const finalLines = json('review/set-001-lines-bespoke-final.json');
const { HERO_LINES_AF } = await import(pathToFileURL(R('assets', 'hero-lines-af.js')).href);
const linesByHash = new Map(finalLines.set.map((e) => [e.hash, e.lines]));
const benched = new Set((json('review/benched-photos.json').benched || []).filter((b) => !b.movedTo?.length).map((b) => b.sha1));
const photos = [];
for (const a of draft.assignments) {
  if (photos.some((p) => p.hash === a.hash)) continue;
  const rel = [a.image, ...(a.paths || [])].find((p) => existsSync(R('assets', 'images', 'bg', ...p.split('/'))) && sha12(readFileSync(R('assets', 'images', 'bg', ...p.split('/')))) === a.hash);
  if (!rel) throw new Error(`${a.hash}: no slot on disk holds these bytes`);
  const slots = draft.assignments.filter((x) => x.hash === a.hash).flatMap((x) => x.paths || [x.image]);
  const en = linesByHash.get(a.hash) || [];
  photos.push({ kind: 'grid', hash: a.hash, label: rel, file: R('assets', 'images', 'bg', ...rel.split('/')), url: `/assets/images/bg/${rel}`,
    slots: [...new Set(slots)], benched: benched.has(a.hash), en, af: en.map((l) => HERO_LINES_AF[l]).filter(Boolean),
    entry: offsetsDoc.offsets[a.hash] || null });
}
// The cloudy photographs the new set replaces (scripts/ingest-new-sets.mjs: the slot each new cloudy file names) leave
// the grid at ingest: they are reported as retiring, never anchored.
const retiring = new Set();
for (const f of readdirSync(R('review', 'new-sets-2026-10-07', 'cloudy'))) {
  const m = /^(dawn|day|dusk|night)-([1-7])(-weekB)?\.png$/.exec(f);
  if (!m) continue;
  const slot = `cloudy/week_${m[3] ? 2 : 1}/${m[1]}/${m[2]}.webp`;
  const a = draft.assignments.find((x) => x.condition === 'cloudy' && (x.paths || []).includes(slot));
  if (a) retiring.add(a.hash);
}
for (const p of photos) if (retiring.has(p.hash)) p.retiring = true;
const maat = json('review/new-sets-lines-maat-2026-10-07.json').lines;
for (const set of ['partly-cloudy', 'breezy', 'cloudy']) {
  for (const f of readdirSync(R('review', 'new-sets-2026-10-07', set)).sort()) {
    if (!/^(dawn|day|dusk|night)-[1-7](-weekB)?\.png$/.test(f)) continue;
    const file = `${set}/${f}`;
    photos.push({ kind: 'new', hash: sha12(readFileSync(R('review', 'new-sets-2026-10-07', set, f))), label: `new ${file}`, newFile: file,
      file: R('review', 'new-sets-2026-10-07', set, f), url: `/review/new-sets-2026-10-07/${file}`, slots: [],
      en: maat[file] ? [maat[file].en] : [], af: maat[file] ? [maat[file].af] : [], entry: null });
  }
}
if (NEW_ONLY) photos.splice(0, photos.length, ...photos.filter((p) => p.kind === 'new'));
if (REFRAMES) {
  // --dir <folder under review/>: a later pass whose takes are named by the hash the reframe replaced
  // (review/landmark-creep-2026-10-08); each is judged with its photograph's lines and its current anchor.
  const sub = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'library-reframe-2026-10-08';
  const dir = R('review', sub);
  const takes = readdirSync(dir).filter((f) => /^[0-9a-f]{12}\.png$/.test(f)).map((f) => f.slice(0, 12));
  const keep = [];
  for (const h of takes) {
    const nowHash = draft.assignments.find((x) => x.hash === h) ? h : draft.assignments.find((x) => x.replacedHash === h)?.hash;
    const p = photos.find((x) => x.hash === nowHash);
    if (!p) continue;
    const file = path.join(dir, `${h}.png`);
    keep.push({ ...p, kind: 'new', newFile: `reframe ${h} ${p.label}`, file, url: `/review/${sub}/${h}.png`,
      hash: sha12(readFileSync(file)), current: null });
  }
  photos.splice(0, photos.length, ...keep);
}
for (const p of photos) {
  // Al's phone is in English: the photograph's longest English line decides (an Afrikaans joke is often a line taller).
  p.line = p.en.length ? p.en.reduce((a, b) => (b.length > a.length ? b : a)) : SAMPLE_LINE;
  p.lineIsSample = !p.en.length;
  p.current = typeof p.entry?.anchorY === 'number' ? p.entry.anchorY : null; // null = no entry: the CSS default, joke at the foot
}

// ---------------------------------------------------------------- the server (the fold gate's: dist/ + a fixture payload)
let payloadNow = { key: 'clear', label: 'Clear', tempC: 21 };
function payload() {
  const DAY = '2026-10-08';
  const hourly = Array.from({ length: 48 }, (_, i) => ({ tempC: payloadNow.tempC - (i % 6), feelsLikeC: payloadNow.tempC - 2, rainChance: 10, precipMm: 0,
    windKph: 14, windDir: 205, cloudPct: 30, humidity: 60, uv: 5, condition: payloadNow.key }));
  const daily = Array.from({ length: 7 }, () => ({ highC: payloadNow.tempC + 3, lowC: payloadNow.tempC - 7, rainChance: 10, uv: 6, windKph: 18,
    conditionKey: payloadNow.key, conditionLabel: payloadNow.label, sunrise: `${DAY}T06:10`, sunset: `${DAY}T19:05` }));
  return { ok: true, location: { name: 'Strand, Western Cape', lat: -34.11, lon: 18.83 },
    now: { tempC: payloadNow.tempC, feelsLikeC: payloadNow.tempC - 2, uv: 5, isDay: true, windKph: 14, rainChance: 10, cloudPct: 30,
      conditionKey: payloadNow.key, conditionLabel: payloadNow.label, sunrise: `${DAY}T06:10`, sunset: `${DAY}T19:05` },
    hourly, daily, wind_kph: 14, maxWindKph: 22, gustKph: 26, windDir: 205, consensus: { confidenceKey: 'decent' },
    meta: { schema: 5, localHour: 13, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [], conditionConfidence: { level: 'high', finalCondition: payloadNow.key, sourceAgreement: '4/5' } } };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function startServer() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payload() : pathname === '/api/locate' ? { ok: true, lat: -34.11, lon: 18.83, name: 'Strand, Western Cape' } : {};
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    }
    if (pathname.startsWith('/_vercel/')) return res.writeHead(204).end();
    // The photographs come from the source tree (the new sets are not in dist/).
    const base = pathname.startsWith('/review/') || pathname.startsWith('/assets/images/') ? root : R('dist');
    const file = path.resolve(base, pathname === '/' ? 'index.html' : pathname.slice(1));
    let buf;
    try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPhone(browser, base, vp, lang = 'en') {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.11, lon: 18.83, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
      localStorage.setItem('lang', JSON.stringify(l));
      localStorage.setItem('pw_lang', JSON.stringify(l));
    } catch (_) {}
  }, lang);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

// Put one photograph, one line and one anchor on the page the way setBackgroundFor does, and read the boxes.
async function show(page, { url, line, crop }) {
  return page.evaluate(async ({ url, line, crop }) => {
    const root = document.documentElement;
    const img = document.getElementById('bgImg');
    if (img && img.getAttribute('src') !== url) {
      img.onload = null; img.onerror = null;
      await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url; });
    }
    root.style.setProperty('--hero-url', `url("${url}")`);
    if (crop == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${crop}%`);
    document.getElementById('headline').textContent = line;
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    // The boxes a face must not sit under: the header's own text (mark, name, place), the Language and Share buttons,
    // the number, "Probably" and the condition — each its own box, so a face beside the number is not counted as under it.
    const title = ['#logoCircle', '.brand-text', '#languageBtn', '#temp .hero-now', '#temp .hero-probably', '#description', '#dShare']
      .map(r).filter((b) => b && b.height).map((b) => ({ x0: b.left, x1: b.right, y0: b.top, y1: b.bottom }));
    const cap = r('#headline'); const lineBox = r('#dLine'); const status = r('#weatherStatus');
    const cs = getComputedStyle(document.getElementById('headline'));
    const fade = parseFloat(getComputedStyle(document.getElementById('dLine'), '::before').height) || 0;
    // The joke's dark fades in over the caption's top padding (the runway, home-d.css): a face is under the joke from
    // where that fade is half on, so capTop is the middle of the runway, not the box's transparent top edge.
    return { W: innerWidth, H: innerHeight, title, topBottom: Math.max(...title.map((b) => b.y1)), capTop: cap.top + parseFloat(cs.paddingTop) / 2, capBox: cap.top, capBottom: cap.bottom,
      textH: cap.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), lineTop: lineBox.top, statusBottom: status.bottom, fade,
      high: document.body.classList.contains('d-joke-high'), iw: img.naturalWidth, ih: img.naturalHeight };
  }, { url, line, crop });
}

// ---------------------------------------------------------------- the geometry (home-d.js placeJoke, exactly)
function judge(heads, L, a) {
  const { W, H, iw, ih } = L.foot;
  const k = Math.max(W / iw, H / ih);
  const dw = iw * k, dh = ih * k, offX = (W - dw) / 2;
  const p = a == null ? CSS_DEFAULT : a;
  const offY = (H - dh) * (p / 100);
  let high = false;
  if (a != null) {
    const subjectY = (0.25 + a / 200) * dh + (H - dh) * (a / 100);
    const subjectTop = subjectY - 0.125 * dh;
    const footTextTop = L.foot.lineTop - D_CAP_FOOT - L.foot.textH;
    const risenTextBottom = L.foot.statusBottom + L.foot.textH;
    high = subjectY >= footTextTop - 8 && subjectTop >= risenTextBottom + 8;
  }
  const S = high ? L.high : L.foot;
  const band = high ? [S.capBottom, S.lineTop - S.fade] : [S.topBottom, S.capTop]; // the clear band, for the report
  const out = { a, high, band: band.map((v) => +(v.toFixed(1))), hidden: [], edge: [] };
  for (const hd of heads) {
    const [x, y, w, h] = hd.box;
    const y0 = offY + y * k, y1 = offY + (y + h) * k, x0 = offX + x * k, x1 = offX + (x + w) * k;
    if (x1 < 0 || x0 > W) { out.edge.push(hd); continue; }
    const underTitle = S.title.some((b) => x1 > b.x0 - MARGIN && x0 < b.x1 + MARGIN && y1 > b.y0 - MARGIN && y0 < b.y1 + MARGIN);
    const under = y0 < MARGIN ? 'off the top of the screen'
      : underTitle ? 'the number / Probably / buttons'
      : high ? (y0 < S.capBottom + MARGIN ? 'the joke (raised)' : y1 > S.lineTop - S.fade - MARGIN ? 'the credit line' : null)
      : (y1 > S.capTop - MARGIN ? 'the joke' : null);
    if (under) out.hidden.push({ ...hd, under, screen: [Math.round(y0), Math.round(y1)] });
    if (x0 < 0 || x1 > W) out.edge.push(hd);
  }
  out.pass = out.hidden.length === 0;
  return out;
}

// ---------------------------------------------------------------- run
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

if (BAND_ONLY) {
  const { page, ctx } = await openPhone(browser, base, VIEWPORTS[0]);
  const L = await show(page, { url: '/assets/images/bg/clear/week_4/day/1.webp', line: SAMPLE_LINE, crop: 0 });
  if (process.env.BAND_SHOT) { await page.waitForTimeout(4000); await page.screenshot({ path: process.env.BAND_SHOT }); }
  console.log(`414x715, two-line joke at the foot: title card ends ${L.topBottom.toFixed(0)} px (${(100 * L.topBottom / L.H).toFixed(1)} %), joke box starts ${L.capBox.toFixed(0)} px, its dark is half on at ${L.capTop.toFixed(0)} px (${(100 * L.capTop / L.H).toFixed(1)} %)`);
  await ctx.close(); await browser.close(); server.close(); process.exit(0);
}

// 1. heads (cached by image hash)
const DET_FILE = R('review', `face-detections-${DATE}.json`);
const det = existsSync(DET_FILE) ? json(`review/face-detections-${DATE}.json`) : { detector: null, heads: {} };
const { detectHeads, DETECTOR } = await import(pathToFileURL(R('tools', 'face', 'detect.mjs')).href);
if (det.detector !== DETECTOR.name) { det.detector = DETECTOR.name; det.heads = {}; }
let n = 0;
for (const p of photos) {
  if (!det.heads[p.hash]) {
    const { data, info } = await sharp(p.file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    det.heads[p.hash] = { size: [info.width, info.height], heads: await detectHeads({ data, width: info.width, height: info.height }) };
    if (++n % 25 === 0) { writeFileSync(DET_FILE, JSON.stringify(det)); console.log(`detected ${n}`); }
  }
  const d = det.heads[p.hash];
  p.allHeads = d.heads;
  p.heads = d.heads.filter((h) => h.box[3] >= MIN_HEAD * d.size[1]);
  p.small = d.heads.length - p.heads.length;
}
writeFileSync(DET_FILE, JSON.stringify(det));

// 2. the layout, per photograph and viewport (foot and raised), then 3. the decision
for (const vp of VIEWPORTS) {
  const { page, ctx } = await openPhone(browser, base, vp);
  for (const p of photos) {
    const foot = await show(page, { url: p.url, line: p.line, crop: null });
    const high = await show(page, { url: p.url, line: p.line, crop: 100 });
    const L = { foot, high };
    const v = (p.vp ||= {})[`${vp.w}x${vp.h}`] = { L };
    v.current = judge(p.heads, L, p.current);
    // The model must agree with the page: the anchor 100 render says whether home-d.js raised the joke.
    const predicted = judge(p.heads, L, 100).high;
    if (predicted !== high.high) throw new Error(`${p.label} at ${vp.w}x${vp.h}: placeJoke model says ${predicted ? 'raised' : 'foot'} at 100, the page says ${high.high ? 'raised' : 'foot'}`);
    v.passing = [];
    for (let a = 0; a <= 100; a++) if (a !== CSS_DEFAULT && judge(p.heads, L, a).pass) v.passing.push(a);
  }
  await ctx.close();
}
const KEY = `${VIEWPORTS[0].w}x${VIEWPORTS[0].h}`, KEY2 = `${VIEWPORTS[1].w}x${VIEWPORTS[1].h}`;
for (const p of photos) {
  const v = p.vp[KEY], v2 = p.vp[KEY2];
  if (p.retiring) { p.verdict = 'retires'; p.next = p.current; continue; }
  if (v.current.pass) { p.verdict = 'pass'; p.next = p.current; continue; }
  if (!v.passing.length) { p.verdict = 'cannot be saved'; p.next = p.current; continue; }
  const from = p.current == null ? CSS_DEFAULT : p.current;
  const both = v.passing.filter((a) => v2.passing.includes(a));
  const pool = both.length ? both : v.passing;
  p.next = pool.reduce((b, a) => (Math.abs(a - from) < Math.abs(b - from) ? a : b));
  p.verdict = 'moved';
}
for (const p of photos) {
  p.after = { [KEY]: judge(p.heads, p.vp[KEY].L, p.next), [KEY2]: judge(p.heads, p.vp[KEY2].L, p.next) };
}

if (NEW_ONLY || REFRAMES) {
  for (const p of photos) console.log(`${p.verdict.padEnd(16)} ${p.newFile}${p.verdict === 'moved' ? ` -> ${p.next}` : ''} ${p.vp[KEY].current.hidden.map((h) => `${h.under} ${h.screen.join('-')}`).join('; ')}`);
  await browser.close(); server.close(); process.exit(0);
}
// 4. the phone renders: the test case, every moved photograph (before | after) and every one that cannot be saved
mkdirSync(OUT_DIR, { recursive: true });
const shots = new Map();
{
  const { page, ctx } = await openPhone(browser, base, VIEWPORTS[0]);
  // the joke is written a 2 s beat after the photograph lands; wait for it once, then swaps keep it on
  await page.waitForFunction(() => document.getElementById('dScrim')?.classList.contains('is-on'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const shoot = async (p, crop, tag) => {
    await show(page, { url: p.url, line: p.line, crop });
    // A new line is written again (home-d.js: pending, then the ink): wait until it stands on its dark.
    await page.waitForFunction(() => {
      const h = document.getElementById('headline');
      return h.style.opacity === '1' && !h.style.getPropertyValue('mask-image') && !h.style.getPropertyValue('-webkit-mask-image')
        && document.getElementById('dScrim')?.classList.contains('is-on');
    }, null, { timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(250);
    const f = path.join(OUT_DIR, `${p.hash}-${tag}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 82 });
    shots.set(`${p.hash}-${tag}`, f);
  };
  for (const p of photos) {
    if (p.verdict === 'moved' || p.hash === '7d13aaa156f4') { await shoot(p, p.current, 'before'); await shoot(p, p.next, 'after'); }
    else if (p.verdict === 'cannot be saved') await shoot(p, p.current, 'now');
  }
  await ctx.close();
}
await browser.close();
server.close();

async function sheet(items, file, title) {
  if (!items.length) return null;
  const TW = 207, TH = 358, PAD = 10, LAB = 34, cols = Math.min(6, items.length);
  const rows = Math.ceil(items.length / cols);
  const W = cols * (TW + PAD) + PAD, H = rows * (TH + LAB + PAD) + PAD + 40;
  const comps = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const x = PAD + (i % cols) * (TW + PAD), y = 40 + PAD + Math.floor(i / cols) * (TH + LAB + PAD);
    comps.push({ input: await sharp(it.file).resize(TW, TH).toBuffer(), left: x, top: y });
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    comps.push({ input: Buffer.from(`<svg width="${TW}" height="${LAB}"><text x="0" y="13" font-family="Segoe UI, Arial" font-size="11" fill="#fffaf3">${esc(it.l1)}</text><text x="0" y="28" font-family="Segoe UI, Arial" font-size="11" fill="#ffd700">${esc(it.l2)}</text></svg>`), left: x, top: y + TH + 2 });
  }
  comps.push({ input: Buffer.from(`<svg width="${W}" height="40"><text x="${PAD}" y="26" font-family="Segoe UI, Arial" font-size="17" font-weight="700" fill="#fffaf3">${title}</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#14110d' } }).composite(comps).jpeg({ quality: 84 }).toFile(file);
  return file;
}
const pct = (a) => (a == null ? `default ${CSS_DEFAULT}` : `${a}`);
const moved = photos.filter((p) => p.verdict === 'moved');
const lost = photos.filter((p) => p.verdict === 'cannot be saved');
const movedItems = moved.flatMap((p) => [
  { file: shots.get(`${p.hash}-before`), l1: `${p.label.replace(/^new /, '')}`, l2: `before: anchor ${pct(p.current)}` },
  { file: shots.get(`${p.hash}-after`), l1: `${p.hash}`, l2: `after: anchor ${p.next}${p.after[KEY].high ? ' (joke raised)' : ''}` },
]);
const gym = photos.find((p) => p.hash === '7d13aaa156f4');
const sheets = {
  moved: await sheet(movedItems, path.join(OUT_DIR, 'moved.jpg'), `Moved: ${moved.length} photographs, before | after, at 414x715 (Al's iPhone 11 + Chrome)`),
  lost: await sheet(lost.map((p) => ({ file: shots.get(`${p.hash}-now`) || shots.get(`${p.hash}-before`), l1: p.label.replace(/^new /, ''), l2: `${p.hash} · ${p.vp[KEY].current.hidden.map((h) => h.under).filter((v, i, a) => a.indexOf(v) === i).join(' + ')}` })),
    path.join(OUT_DIR, 'cannot-be-saved.jpg'), `Cannot be saved by the anchor: ${lost.length} photographs, as Al's phone shows them now (414x715)`),
  gym: gym ? await sheet([{ file: shots.get(`${gym.hash}-before`), l1: 'outdoor gym · before', l2: `anchor ${pct(gym.current)}` }, { file: shots.get(`${gym.hash}-after`), l1: 'outdoor gym · after', l2: `anchor ${gym.next} · ${gym.verdict}` }],
    path.join(OUT_DIR, 'outdoor-gym.jpg'), 'Test case: the outdoor gym (7d13aaa156f4), 414x715') : null,
};

// 5. write
const audit = photos.map((p) => ({ kind: p.kind, label: p.label, hash: p.hash, slots: p.slots, benched: p.benched || undefined, verdict: p.verdict,
  current: p.current, next: p.next, heads: p.heads, smallHeads: p.small, line: p.line, lineIsSample: p.lineIsSample || undefined,
  at: Object.fromEntries(Object.entries(p.vp).map(([k, v]) => [k, { current: { pass: v.current.pass, high: v.current.high, band: v.current.band, hidden: v.current.hidden.map((h) => ({ under: h.under, screen: h.screen, from: h.from })) }, passing: v.passing.length ? `${v.passing[0]}–${v.passing[v.passing.length - 1]} (${v.passing.length})` : 'none', after: { pass: p.after[k].pass, high: p.after[k].high } }])) }));
writeFileSync(R('review', `crop-audit-${DATE}.json`), JSON.stringify({ generated: DATE, detector: DETECTOR.name, viewports: VIEWPORTS, minHead: MIN_HEAD, margin: MARGIN, photos: audit }, null, 1));

const grid = photos.filter((p) => p.kind === 'grid'), fresh = photos.filter((p) => p.kind === 'new');
const count = (list, v) => list.filter((p) => p.verdict === v).length;
const L = [];
L.push(`# Crop audit — faces against Home D, ${DATE}`, '');
L.push(`\`node scripts/anchor-faces.mjs\`. Detector: ${DETECTOR.name}. Decided at **414x715** (Al's iPhone 11 + Chrome); 414x896 (installed) beside it. A head under ${MIN_HEAD * 100} % of the photograph's height is not judged.`, '');
L.push('| | photographs | pass | moved | cannot be saved | retire with the new cloudy set | no head found |', '|---|---:|---:|---:|---:|---:|---:|');
for (const [name, list] of [['library (1,008 slots)', grid], ['new sets', fresh]]) {
  L.push(`| ${name} | ${list.length} | ${count(list, 'pass')} | ${count(list, 'moved')} | ${count(list, 'cannot be saved')} | ${count(list, 'retires')} | ${list.filter((p) => !p.heads.length).length} |`);
}
L.push('', '**What the anchor can do on Al\'s phone:** at 414x715 the photograph can slide 21 px; at 414x896 not at all. The anchor\'s real effect is where the joke goes (home-d.js raises it when the anchored subject would sit under it). "Cannot be saved" therefore means: the faces sit under the number or the buttons, or under the joke wherever it goes — only a re-framed photograph fixes it.', '');
if (gym) {
  L.push('## Test case: the outdoor gym', '', `\`7d13aaa156f4\` ${gym.label}, line "${gym.en[0]}". Heads (photograph px): ${gym.heads.map((h) => `[${h.box.join(', ')}] ${h.from}`).join('; ')}.`);
  L.push(`Before (anchor ${pct(gym.current)}): ${gym.vp[KEY].current.hidden.map((h) => `head at screen ${h.screen[0]}–${h.screen[1]} px under ${h.under}`).join('; ') || 'clear'}. Verdict: **${gym.verdict}**${gym.verdict === 'moved' ? `, anchor ${gym.next}` : ''}. Sheet: \`review/crop-audit-${DATE}/outdoor-gym.jpg\`.`, '');
}
const row = (p) => `| ${p.label} | \`${p.hash}\` | ${pct(p.current)} | ${p.verdict === 'moved' ? `**${p.next}**${p.after[KEY].high ? ' (joke raised)' : ''}` : '—'} | ${p.vp[KEY].current.hidden.map((h) => `${h.from} ${h.screen[0]}–${h.screen[1]} px under ${h.under}`).join('; ') || '—'} | ${p.vp[KEY2].current.pass ? 'pass' : 'hidden'} → ${p.after[KEY2].pass ? 'pass' : 'hidden'} |`;
for (const [title, v] of [['Moved', 'moved'], ['Cannot be saved', 'cannot be saved']]) {
  const list = photos.filter((p) => p.verdict === v);
  L.push(`## ${title} — ${list.length}`, '');
  if (v === 'moved') L.push(`Sheet: \`review/crop-audit-${DATE}/moved.jpg\` (before | after, as the phone shows them).`, '');
  if (v === 'cannot be saved') L.push(`Sheet: \`review/crop-audit-${DATE}/cannot-be-saved.jpg\` (as the phone shows them now).`, '');
  if (list.length) L.push('| photograph | hash | anchor now | anchor after | hidden at 414x715 now | 414x896 now → after |', '|---|---|---|---|---|---|', ...list.map(row), '');
}
L.push(`## Pass — ${photos.filter((p) => p.verdict === 'pass').length}`, '', 'Every head clears at the current anchor; nothing changed. Full per-photograph detail (heads, bands, the anchors that pass) in `review/crop-audit-2026-10-08.json`.', '');
writeFileSync(R('review', `crop-audit-${DATE}.md`), L.join('\n') + '\n');
writeFileSync(R('review', `new-sets-crop-${DATE}.json`), JSON.stringify({ generated: DATE, note: 'Face anchors for the new sets by filename (scripts/anchor-faces.mjs). The ingest keys them by the WebP hash; null = no entry (CSS default).',
  anchors: Object.fromEntries(fresh.map((p) => [p.newFile, { anchorY: p.next, verdict: p.verdict }])) }, null, 1));

if (!DRY) {
  for (const p of moved.filter((x) => x.kind === 'grid')) {
    const prev = offsetsDoc.offsets[p.hash];
    offsetsDoc.offsets[p.hash] = { ...(prev || { verdict: 'FACE', image: p.label }), anchorY: p.next,
      faceAnchor: { on: DATE, previous: p.current, by: 'scripts/anchor-faces.mjs', reason: 'a face hidden at the previous anchor on 414x715' } };
  }
  offsetsDoc.counts.wired = Object.values(offsetsDoc.offsets).filter((o) => typeof o.anchorY === 'number').length;
  offsetsDoc.counts.offsets = Object.keys(offsetsDoc.offsets).length;
  offsetsDoc.faceAnchors = { on: DATE, moved: moved.filter((x) => x.kind === 'grid').length, audit: `review/crop-audit-${DATE}.md` };
  writeFileSync(R('review', 'set-001-crop-offsets.json'), JSON.stringify(offsetsDoc, null, 1) + '\n');
  execFileSync(process.execPath, [R('scripts', 'build-hero-crop-offsets.mjs')], { stdio: 'inherit' });
  execFileSync(process.execPath, [R('scripts', 'build-hero-crop-desktop.mjs')], { stdio: 'inherit' });
}
console.log(`photos ${photos.length}: pass ${count(photos, 'pass')}, moved ${moved.length}, cannot be saved ${lost.length}${DRY ? ' (dry run: offsets untouched)' : ''}`);
