// M7 — crop survival for set-001, against the hero geometry that SHIPS TODAY.
//
// The first version of this file pinned one hero box — 342 x 303.83 — measured
// off production before the M8 fold fix. 93c410c made the hero viewport-
// dependent (`--hero-card-h: clamp(104px, 25.5vh, 300px)`), so that constant is
// now a box no device has: at 390x844 the live hero is 342 x 215. Every sheet
// rendered against 303.83 was measuring a phone that no longer exists.
//
// So the geometry is not pinned here at all. It is MEASURED off the built app at
// every viewport in the M8 fold matrix, and the sheets are rendered against two
// of those boxes:
//   REFERENCE — 390x844, the device the arc has always been judged on.
//   WORST     — the box that exposes the LEAST of the source, chosen by measured
//               aspect ratio rather than by assumption. For a portrait source the
//               band always scales to the box WIDTH, so the fraction of the photo
//               you see is (box height / box width) x (source width / source
//               height): the flattest box wins, and the flattest box is not the
//               smallest phone.
//
// Classification is made on the WORST box. An image that survives there survives
// everywhere in the matrix.
//
//   node scripts/verify-crop-survival.mjs           -> geometry + 36 contact sheets
//   node scripts/verify-crop-survival.mjs --ladder  -> offset ladders for the
//                                                      FIXABLE shortlist
//   node scripts/verify-crop-survival.mjs --report  -> the survives/fixable/fails
//                                                      table from the verdicts
//
// Output: output/m7-crop/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'output', 'm7-crop');
const dist = path.join(root, 'dist');
const bgDir = path.join(root, 'assets', 'images', 'bg');
const DATE = '2026-08-08';

const args = new Set(process.argv.slice(2));
const LADDER = args.has('--ladder');
const REPORT = args.has('--report');
// Every FIXABLE rendered at the anchor PROPOSED for it, beside the live 78%, in
// the worst box. A proposed offset nobody has looked at is a guess wearing a
// number; this is what turns it into a ruling Al can make.
const PROPOSED = args.has('--proposed');

// The offsets a rescue is searched over. Deliberately coarse: a crop offset that
// only works within 2% is not a rescue, it is a coincidence.
const LADDER_STOPS = [15, 30, 45, 60, 78, 90];

// The same 16 viewports the fold gate asserts. The hero box is read at each one,
// so "the worst case" is a measurement, not a guess.
const VIEWPORTS = [
  { w: 320, h: 568, name: 'iPhone SE 1st' },
  { w: 320, h: 488, name: 'iPhone SE 1st + chrome' },
  { w: 360, h: 640, name: 'Android small' },
  { w: 360, h: 550, name: 'Android small + chrome' },
  { w: 360, h: 800, name: 'Android common' },
  { w: 360, h: 688, name: 'Android common + chrome' },
  { w: 375, h: 667, name: 'iPhone SE 2/3' },
  { w: 375, h: 574, name: 'iPhone SE 2/3 + chrome' },
  { w: 390, h: 844, name: 'iPhone 14' },
  { w: 390, h: 734, name: 'iPhone 14 + chrome' },
  { w: 412, h: 915, name: 'Pixel 7' },
  { w: 412, h: 780, name: 'Pixel 7 + chrome' },
  { w: 428, h: 926, name: 'iPhone 14 Plus' },
  { w: 428, h: 796, name: 'iPhone 14 Plus + chrome' },
  { w: 739, h: 1600, name: "Al's device class" },
  { w: 739, h: 850, name: "Al's device class + chrome" },
];
const REFERENCE_VIEWPORT = '390x844';

/** Which source rows a crop percentage exposes, for a portrait source in a box. */
export function bandFor(srcW, srcH, positionY, box) {
  const scale = Math.max(box.width / srcW, box.height / srcH);
  const scaledH = srcH * scale;
  const overflow = Math.max(0, scaledH - box.height);
  const topPx = (positionY / 100) * overflow;
  return { scale, topFrac: topPx / scaledH, bottomFrac: (topPx + box.height) / scaledH };
}

// ---------------------------------------------------------------------------
// Geometry: measured off the built app, never derived from the stylesheet.
// ---------------------------------------------------------------------------
function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 22 - (i % 6), feelsLikeC: 20, rainChance: (i % 7) * 8, precipMm: 0,
    windKph: 20 - (i % 9), windDir: 205, cloudPct: 30, humidity: 50, uv: 6, condition: 'clear',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 25, lowC: 14, rainChance: 15, uv: 6, windKph: 20,
    conditionKey: 'clear', conditionLabel: 'Clear',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 24, feelsLikeC: 22, uv: 6, isDay: true, windKph: 20, rainChance: 15,
      cloudPct: 30, conditionKey: 'clear', conditionLabel: 'Clear',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: 20, maxWindKph: 28, gustKph: 28, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'clear', sourceAgreement: '4/5' },
    },
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

/** One server for both jobs: the built app (for measuring) and the image tree
 *  (for the sheets). Sheets are HTTP, never file:// — a setContent page has an
 *  about:blank origin and Chromium refuses file:// subresources from it, which
 *  is how this script first produced 36 sheets of broken-image icons. */
function startServer() {
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
    const isImg = pathname.startsWith('/bg/');
    const base = isImg ? bgDir : dist;
    const rel = isImg ? pathname.slice('/bg/'.length) : pathname.slice(1);
    let file = null; let buf = null;
    try {
      file = path.resolve(base, rel === '' ? 'index.html' : rel);
      if (!file.startsWith(path.resolve(base))) return res.writeHead(403).end();
      buf = readFileSync(file);
    } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function measureHeroBoxes(browser, base) {
  const boxes = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
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
    }, null, { timeout: 20000 });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const el = document.getElementById('heroPhoto');
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        width: +r.width.toFixed(2), height: +r.height.toFixed(2),
        position: cs.backgroundPosition, size: cs.backgroundSize, radius: cs.borderRadius,
      };
    });
    if (!m.width || !m.height) throw new Error(`#heroPhoto has no box at ${vp.w}x${vp.h} — the measurement is worthless`);
    boxes.push({ viewport: `${vp.w}x${vp.h}`, device: vp.name, ...m, aspect: +(m.width / m.height).toFixed(3) });
    await ctx.close();
  }
  return boxes;
}

/** The live vertical anchor, read off the app rather than assumed to be 78. */
function positionYOf(box) {
  const y = String(box.position).trim().split(/\s+/).pop();
  const n = parseFloat(y);
  if (!Number.isFinite(n) || !y.endsWith('%')) {
    throw new Error(`hero background-position is "${box.position}" — not a percentage, the band cannot be computed`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------
// Both crops are drawn at the SAME rendered width so the two bands can be
// compared directly; the reference is true size, the worst box is scaled to
// match and labelled with its real dimensions.
const CROP_W = 342;

function cellCss(ref, worst, refScale, worstScale) {
  return `
  body { margin:0; background:#0d0d12; color:#fff;
         font:12px/1.35 -apple-system,Segoe UI,Roboto,sans-serif; padding:18px; }
  h1 { font-size:15px; letter-spacing:.1em; text-transform:uppercase; color:#ffd700; margin:0 0 4px; }
  h2 { font-size:11px; font-weight:400; color:#8b919d; margin:0 0 16px; }
  .grid { display:grid; grid-template-columns:repeat(4, max-content); gap:18px; }
  .cell { background:#16171d; border-radius:10px; padding:11px; position:relative; }
  .idx { position:absolute; top:7px; left:9px; z-index:2;
         background:#ffd700; color:#111; font-weight:800; font-size:11px;
         border-radius:4px; padding:1px 6px; }
  .row { display:flex; gap:11px; align-items:flex-start; }
  .full { position:relative; width:92px; flex:none; }
  .full img { width:92px; display:block; border-radius:3px; opacity:.5; }
  .full .band { position:absolute; left:0; right:0; box-sizing:border-box; }
  .full .band-ref   { border:1.5px solid #ffd700; background:rgba(255,215,0,.10); }
  .full .band-worst { border:1.5px dashed #59d0ff; background:rgba(89,208,255,.10); }
  .full .lab { margin-top:4px; font-size:9px; color:#8b919d; text-align:center; }
  .crop { width:${CROP_W}px; background-size:cover; background-repeat:no-repeat; }
  .crop-ref   { height:${(ref.height * refScale).toFixed(1)}px; border-radius:8px 8px 0 0; }
  .crop-worst { height:${(worst.height * worstScale).toFixed(1)}px; border-radius:8px 8px 0 0;
                outline:1.5px dashed #59d0ff; outline-offset:1px; }
  .stack { display:flex; flex-direction:column; gap:13px; }
  .tag { font-size:9.5px; color:#8b919d; margin-top:3px; }
  .tag b { color:#fff; }
  .tag.worst b { color:#59d0ff; }
  .meta { margin-top:9px; display:flex; justify-content:space-between; gap:10px;
          font-size:10px; color:#aab0bd; }
  .meta b { color:#fff; font-weight:600; }
  .hash { font-family:ui-monospace,Menlo,monospace; color:#6f7581; }
  .ladder { display:flex; gap:8px; }
  .ladder .crop { width:${Math.round(CROP_W / 2)}px; height:${((worst.height * worstScale) / 2).toFixed(1)}px; border-radius:5px; }
  .ladder figcaption { font-size:10px; color:#aab0bd; text-align:center; margin-top:4px; }
  .ladder figure { margin:0; }
  .is-current figcaption { color:#ffd700; font-weight:700; }
`;
}

function webpDims(file) {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------
if (REPORT) {
  const vPath = path.join(root, 'review', 'm7-verdicts.json');
  if (!existsSync(vPath)) {
    console.error('[m7] review/m7-verdicts.json does not exist yet — nothing to report.');
    process.exit(1);
  }
  const { verdicts } = JSON.parse(readFileSync(vPath, 'utf8'));
  const draftAll = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));
  const counts = new Map();
  for (const a of draftAll.assignments) {
    const k = `${a.condition}-${a.time}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const rows = [];
  const totals = { n: 0, survives: 0, fixable: 0, fails: 0, ruled: 0 };
  for (const [bucket, n] of [...counts.entries()].sort()) {
    const r = { bucket, n, survives: 0, fixable: 0, fails: 0, ruled: 0 };
    for (let i = 1; i <= n; i += 1) {
      const v = verdicts[`${bucket}#${i}`];
      if (!v) continue;
      r.ruled += 1;
      if (v.verdict === 'SURVIVES') r.survives += 1;
      else if (v.verdict === 'FIXABLE') r.fixable += 1;
      else r.fails += 1;
    }
    rows.push(r);
    for (const k of ['n', 'survives', 'fixable', 'fails', 'ruled']) totals[k] += r[k];
  }
  console.log('| bucket | n | survives | fixable | fails |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.bucket} | ${r.n} | ${r.survives} | ${r.fixable} | ${r.fails} |`);
  console.log(`| **total** | **${totals.n}** | **${totals.survives}** | **${totals.fixable}** | **${totals.fails}** |`);
  console.log(`\nruled ${totals.ruled}/${totals.n}`);
  const anchors = {};
  for (const [k, v] of Object.entries(verdicts)) {
    if (v.verdict === 'FIXABLE') anchors[v.anchorY] = (anchors[v.anchorY] || 0) + 1;
  }
  console.log('proposed anchors:', JSON.stringify(anchors));
  const causes = {};
  for (const v of Object.values(verdicts)) {
    if (v.verdict === 'FAILS') causes[v.cause || 'unstated'] = (causes[v.cause || 'unstated'] || 0) + 1;
  }
  if (Object.keys(causes).length) console.log('fail causes:', JSON.stringify(causes, null, 1));
  process.exit(0);
}

const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));
const assignments = draft.assignments;

const buckets = new Map();
const missing = [];
const dims = new Map();
for (const a of assignments) {
  const file = path.join(bgDir, a.image);
  if (!existsSync(file)) { missing.push(a.image); continue; }
  const d = webpDims(file);
  if (!d) { missing.push(`${a.image} (unreadable header)`); continue; }
  dims.set(a.hash, d);
  const key = `${a.condition}-${a.time}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(a);
}
if (missing.length) {
  console.error(`[m7] ${missing.length} assignment images could not be read:`);
  for (const m of missing.slice(0, 20)) console.error(`  - ${m}`);
  process.exit(1);
}

mkdirSync(output, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const boxes = await measureHeroBoxes(browser, base);
const ref = boxes.find((b) => b.viewport === REFERENCE_VIEWPORT);
if (!ref) throw new Error(`reference viewport ${REFERENCE_VIEWPORT} not in the matrix`);
// Flattest box = least of the source shown. This is the honest worst case and it
// is NOT the smallest phone.
const worst = boxes.reduce((a, b) => (b.aspect > a.aspect ? b : a));
const REF_Y = positionYOf(ref);
const WORST_Y = positionYOf(worst);
const refScale = CROP_W / ref.width;
const worstScale = CROP_W / worst.width;

console.log('[m7] measured hero boxes (live, from dist):');
console.log('viewport     device                     hero box       aspect  position');
for (const b of boxes) {
  const flag = b.viewport === ref.viewport ? '  <- reference' : b.viewport === worst.viewport ? '  <- WORST (least source shown)' : '';
  console.log(`${b.viewport.padEnd(12)} ${b.device.padEnd(26)} ${`${b.width}x${b.height}`.padEnd(14)} ${String(b.aspect).padStart(6)}  ${b.position}${flag}`);
}

const imgUrl = (rel) => `${base}/bg/${rel.split(path.sep).join('/')}`;

function bandDivs(d, thumbH) {
  const a = bandFor(d.w, d.h, REF_Y, { width: ref.width, height: ref.height });
  const b = bandFor(d.w, d.h, WORST_Y, { width: worst.width, height: worst.height });
  return {
    html: `<div class="band band-ref" style="top:${(a.topFrac * thumbH).toFixed(1)}px;height:${((a.bottomFrac - a.topFrac) * thumbH).toFixed(1)}px"></div>
           <div class="band band-worst" style="top:${(b.topFrac * thumbH).toFixed(1)}px;height:${((b.bottomFrac - b.topFrac) * thumbH).toFixed(1)}px"></div>`,
    a, b,
  };
}

function cell(a, d, i) {
  const thumbH = 92 * (d.h / d.w);
  const bands = bandDivs(d, thumbH);
  return `
    <div class="cell">
      <div class="idx">#${i}</div>
      <div class="row">
        <div class="full">
          <img src="${imgUrl(a.image)}" alt="">
          ${bands.html}
          <div class="lab">${(bands.a.topFrac * 100).toFixed(0)}–${(bands.a.bottomFrac * 100).toFixed(0)}%<br>${(bands.b.topFrac * 100).toFixed(0)}–${(bands.b.bottomFrac * 100).toFixed(0)}%</div>
        </div>
        <div class="stack">
          <div>
            <div class="crop crop-ref" style="background-image:url('${imgUrl(a.image)}');background-position:50% ${REF_Y}%"></div>
            <div class="tag"><b>${ref.viewport}</b> · ${ref.width}x${ref.height} · true size</div>
          </div>
          <div>
            <div class="crop crop-worst" style="background-image:url('${imgUrl(a.image)}');background-position:50% ${WORST_Y}%"></div>
            <div class="tag worst"><b>${worst.viewport}</b> · ${worst.width}x${worst.height} · shown at ${(worstScale * 100).toFixed(0)}% — WORST CASE</div>
          </div>
        </div>
      </div>
      <div class="meta">
        <span><b>${a.condition}</b> · ${a.time} · wk ${a.week} · ${a.day}</span>
        <span class="hash">${a.hash}</span>
      </div>
    </div>`;
}

function ladderCell(a, d, label) {
  const thumbH = 92 * (d.h / d.w);
  const bands = bandDivs(d, thumbH);
  const stops = LADDER_STOPS.map((y) => `
    <figure class="${y === WORST_Y ? 'is-current' : ''}">
      <div class="crop crop-worst" style="background-image:url('${imgUrl(a.image)}');background-position:50% ${y}%"></div>
      <figcaption>${y}%${y === WORST_Y ? ' (live)' : ''}</figcaption>
    </figure>`).join('');
  return `
    <div class="cell" style="grid-column:1 / -1">
      <div class="idx">${label}</div>
      <div class="row">
        <div class="full"><img src="${imgUrl(a.image)}" alt="">${bands.html}</div>
        <div class="ladder">${stops}</div>
      </div>
      <div class="meta">
        <span><b>${a.condition}</b> · ${a.time} · wk ${a.week} · ${a.day}</span>
        <span class="hash">${a.hash}</span>
      </div>
    </div>`;
}

const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 1 });
const failedRequests = [];
page.on('requestfailed', (r) => failedRequests.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

const CSS = cellCss(ref, worst, refScale, worstScale);
const header = (title, sub) => `<meta charset="utf-8"><style>${CSS}</style><h1>${title}</h1><h2>${sub}</h2>`;

async function shoot(file) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 40000 });
  await page.waitForTimeout(150);
  if (failedRequests.length) {
    throw new Error(`image requests failed — the sheets would be untrustworthy: ${failedRequests.slice(0, 5).join(', ')}`);
  }
  await page.screenshot({ path: file, fullPage: true });
}

const index = [];
if (PROPOSED) {
  const { verdicts } = JSON.parse(readFileSync(path.join(root, 'review', 'm7-verdicts.json'), 'utf8'));
  for (const [key, list] of [...buckets.entries()].sort()) {
    const picks = list
      .map((a, i) => ({ a, i: i + 1, v: verdicts[`${key}#${i + 1}`] }))
      .filter((x) => x.v && x.v.verdict !== 'SURVIVES');
    if (!picks.length) continue;
    const cells = picks.map(({ a, i, v }) => {
      const d = dims.get(a.hash);
      const thumbH = 92 * (d.h / d.w);
      const live = bandFor(d.w, d.h, WORST_Y, { width: worst.width, height: worst.height });
      const prop = bandFor(d.w, d.h, v.anchorY ?? WORST_Y, { width: worst.width, height: worst.height });
      return `
      <div class="cell">
        <div class="idx">#${i}</div>
        <div class="row">
          <div class="full">
            <img src="${imgUrl(a.image)}" alt="">
            <div class="band band-ref" style="top:${(live.topFrac * thumbH).toFixed(1)}px;height:${((live.bottomFrac - live.topFrac) * thumbH).toFixed(1)}px"></div>
            <div class="band band-worst" style="top:${(prop.topFrac * thumbH).toFixed(1)}px;height:${((prop.bottomFrac - prop.topFrac) * thumbH).toFixed(1)}px"></div>
          </div>
          <div class="stack">
            <div>
              <div class="crop crop-ref" style="height:${(worst.height * worstScale).toFixed(1)}px;background-image:url('${imgUrl(a.image)}');background-position:50% ${WORST_Y}%"></div>
              <div class="tag">live <b>${WORST_Y}%</b></div>
            </div>
            <div>
              <div class="crop crop-worst" style="background-image:url('${imgUrl(a.image)}');background-position:50% ${v.anchorY ?? WORST_Y}%"></div>
              <div class="tag worst">proposed <b>${v.anchorY ?? '—'}%</b>${v.verdict === 'FAILS' ? ` · FAILS: ${v.cause}` : ''}</div>
            </div>
          </div>
        </div>
        <div class="meta"><span><b>${a.condition}</b> · ${a.time} · wk ${a.week} · ${a.day}</span><span class="hash">${a.hash}</span></div>
      </div>`;
    }).join('');
    await page.setContent(`${header(`${key} — ${picks.length} proposed rescue${picks.length === 1 ? '' : 's'}`,
      `Worst box only (${worst.viewport}, ${worst.width}x${worst.height}, shown at ${(worstScale * 100).toFixed(0)}%). Top crop = what ships today at ${WORST_Y}%. Bottom crop = the proposed anchor.
       On the source: gold solid = live band, blue dashed = proposed band.`)}
      <div class="grid">${cells}</div>`);
    const file = path.join(output, `proposed-${key}.png`);
    await shoot(file);
    index.push({ bucket: key, count: picks.length, sheet: path.relative(root, file).replaceAll('\\', '/'), keys: picks.map((p) => `${key}#${p.i}`) });
  }
} else if (LADDER) {
  // Addressed by bucket + position, never by a hash transcribed off a render:
  // reading hashes by eye off 9px monospace produced 76 wrong out of 112.
  const shortlist = JSON.parse(readFileSync(path.join(root, 'review', 'm7-shortlist.json'), 'utf8'));
  const byBucket = new Map([...buckets.entries()].map(([k, v]) => [k, v]));
  const items = shortlist.map((key) => {
    const [bucket, idx] = key.split('#');
    const list = byBucket.get(bucket);
    if (!list) throw new Error(`shortlist names an unknown bucket: ${bucket}`);
    const a = list[Number(idx) - 1];
    if (!a) throw new Error(`shortlist names ${key}, but ${bucket} has ${list.length} images`);
    return { key, a };
  });
  const chunks = [];
  for (let i = 0; i < items.length; i += 4) chunks.push(items.slice(i, i + 4));
  for (const [i, chunk] of chunks.entries()) {
    const cells = chunk.map(({ key, a }) => ladderCell(a, dims.get(a.hash), key)).join('');
    await page.setContent(`${header(`Offset ladder ${i + 1}/${chunks.length}`,
      `Each row: the whole source with both bands, then the WORST box (${worst.viewport}, ${worst.width}x${worst.height}) at ${LADDER_STOPS.join('% / ')}% — live is ${WORST_Y}%`)}
      <div class="grid">${cells}</div>`);
    const file = path.join(output, `ladder-${String(i + 1).padStart(2, '0')}.png`);
    await shoot(file);
    index.push({ sheet: path.relative(root, file).replaceAll('\\', '/'), keys: chunk.map((c) => c.key) });
  }
} else {
  for (const [key, list] of [...buckets.entries()].sort()) {
    const cells = list.map((a, i) => cell(a, dims.get(a.hash), i + 1)).join('');
    await page.setContent(`${header(`${key} — ${list.length} image${list.length === 1 ? '' : 's'}`,
      `Left: whole source. Gold solid = the ${ref.viewport} band, blue dashed = the ${worst.viewport} band (${WORST_Y}% of the overflow in each).
       Right: the reference crop at true size, then the WORST-case crop. Rule on the worst one. Cells are numbered — verdicts are keyed <b>${key}#N</b>, never by hash.`)}
      <div class="grid">${cells}</div>`);
    const file = path.join(output, `sheet-${key}.png`);
    await shoot(file);
    index.push({ bucket: key, count: list.length, sheet: path.relative(root, file).replaceAll('\\', '/'), hashes: list.map((a) => a.hash) });
  }
}

await browser.close();
server.close();

writeFileSync(path.join(output, PROPOSED ? 'proposed-index.json' : LADDER ? 'ladder-index.json' : 'sheet-index.json'), `${JSON.stringify({
  measuredAt: 'dist', reference: ref, worst, referenceAnchorY: REF_Y, worstAnchorY: WORST_Y,
  boxes, total: assignments.length,
  buckets: [...buckets.entries()].map(([k, v]) => ({ bucket: k, count: v.length })).sort((a, b) => a.bucket.localeCompare(b.bucket)),
  sheets: index,
}, null, 2)}\n`);

console.log(`\n[m7] ${assignments.length} images, ${buckets.size} buckets, ${index.length} sheets -> output/m7-crop/`);
console.log(`[m7] reference ${ref.viewport} ${ref.width}x${ref.height} (aspect ${ref.aspect}) · worst ${worst.viewport} ${worst.width}x${worst.height} (aspect ${worst.aspect})`);
