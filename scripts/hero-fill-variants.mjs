// HERO FILL — mockups for Al's ruling. Nothing ships.
//
// The observation (Al, 2026-08-09): there is a lot of dead space under the
// Hourly button. Measured, he is right — and the cause is not reserved padding,
// it is that the page content simply ENDS while .nav is position:fixed at the
// bottom. Nothing occupies the difference:
//
//     320x488   3px of gap   (nothing to give — this screen is already full)
//     390x844   152px
//     428x926   186px
//     739x850   151px        (Al's own device class)
//
// The proposal: let the column fill the screen and give the surplus to the
// photograph, so the frame grows down to meet the text instead of leaving a
// hole. A taller frame at the same width is a SQUARER window on the source,
// which is the single biggest lever on the M7 crop problem.
//
// Four versions, same photograph, plain-English labels:
//   now          what is on the phone today
//   frame        today's size, wearing the P3 polaroid Al picked
//   fill         the photo takes the whole gap
//   fill-capped  the photo takes the gap but never gets taller than it is wide
//
//   node scripts/hero-fill-variants.mjs          -> shots + contact sheets
//   node scripts/hero-fill-variants.mjs --gate   -> the 64-combo fold matrix each
//
// Output: output/hero-fill/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'hero-fill');
const cssDir = path.join(output, 'css');
const DATE = '2026-08-08';
const GATE = process.argv.includes('--gate');

const PINNED_SLOT = 'clear/week_2/day/1.webp';

// ---- The P3 polaroid, exactly as shot in the previous round -----------------
const POLAROID = `
  :root {
    --print-stock: #f6f2e8;
    --print-ink: #24211d;
    --print-frame: clamp(5px, 1.15vh, 11px);
    --print-foot: clamp(4px, 1.1vh, 14px);
    --hero-tilt: -2.4deg;
    --tilt-pad: 2.1vw;
  }
  .hero-card {
    position: relative;
    background: var(--print-stock);
    border-radius: 0;
    overflow: visible;
    box-shadow: 0 18px 44px rgba(0,0,0,0.55), 0 6px 16px rgba(0,0,0,0.38);
    transform: rotate(var(--hero-tilt));
    transform-origin: 50% 100%;
    margin-top: calc(var(--fold-rhythm) * 0.4 + var(--tilt-pad));
  }
  .hero-card::after {
    content: "";
    position: absolute;
    left: 50%; top: clamp(2px, 0.5vh, 6px);
    transform: translateX(-50%);
    width: clamp(11px, 2.1vh, 18px); aspect-ratio: 1;
    border-radius: 50%;
    background: var(--brand-gold);
    border: 2px solid var(--print-stock);
    box-shadow: 0 4px 9px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.65);
    z-index: 3;
  }
  .hero-photo {
    box-sizing: border-box;
    border: var(--print-frame) solid var(--print-stock);
    border-bottom-width: 0;
    /* Height-neutrality. The deeper foot and the tilt's overhang are bought back
       out of the photo IN THE SAME BLOCK, so the frame costs the column nothing.
       Dropping this line is what put the stats pill 2px under the nav at
       320x488 on the first run of these mockups — that screen has 3px to give.
       (Inert in the fill versions, where FILL later sets height:auto.) */
    height: calc(var(--hero-h) - var(--print-foot) - 2 * var(--tilt-pad));
  }
  main#home-screen.main > .hero-caption {
    background: var(--print-stock);
    color: var(--print-ink);
    border-radius: 0;
    text-align: center;
    padding-left: calc(16px + var(--print-frame));
    padding-right: calc(16px + var(--print-frame));
    padding-bottom: calc(var(--fold-rhythm) * 1.4 + var(--print-foot));
    transform: rotate(var(--hero-tilt));
    transform-origin: 50% 0;
    margin-bottom: calc(var(--fold-rhythm) * 1.5 + var(--tilt-pad));
  }
  /* The caption runs #home-screen .headline's heroFadeIn, and a running
     animation's transform beats a declared one — without this the photo tilts
     and the foot stays flat (app.css:2688 records the same trap on desktop). */
  @keyframes heroFadeInPolaroid {
    from { opacity: 0; transform: translateY(14px) rotate(var(--hero-tilt)); }
    to   { opacity: 1; transform: rotate(var(--hero-tilt)); }
  }
  main#home-screen.main > .hero-caption {
    animation: heroFadeInPolaroid 1s ease-in forwards;
    animation-delay: 0.3s;
  }
`;

// ---- The fill layout --------------------------------------------------------
// .container is display:block today, so the document is simply shorter than the
// viewport and the fixed nav sits below the end of it. Making the column a flex
// box that is at least a screen tall, with the hero card as the ONLY flexible
// child, moves every spare pixel into the photograph and nowhere else.
const FILL = `
  .container {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding-bottom: 0;
  }
  .header { flex: 0 0 auto; }
  .home-layout {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    /* The desktop grid rules leave align-items: start on this element. As a
       flex column that means children shrink to their own content width, and
       the hero card collapsed to 36px instead of filling the screen. */
    align-items: stretch;
    min-height: 0;
  }
  .hero-card {
    flex: 1 1 auto;
    /* No floor. A floor here stops the column shrinking to fit on the smallest
       screen and pushes the stats pill under the nav — the photo must be the
       thing that gives, since it is the thing that takes. */
    min-height: 0;
    display: flex;
  }
  .hero-photo {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
  }
  /* The screen panel carries a min-height (595px at 739 wide) that swallowed the
     surplus before the hero could see it — the photo came out SHORTER than it
     is today on Al's own device class. The text block must size to its content
     and nothing more, or "give the leftover to the photo" is a lie. */
  main#home-screen.main { flex: 0 0 auto; min-height: 0; }
`;

// Never taller than it is wide. A snapshot is landscape-to-square; a photo that
// grows past its own width stops reading as a print stuck on the page and turns
// into a poster. Only bites on very tall screens.
const CAP = `
  .hero-card { max-height: calc(100vw - 48px); }
`;

const VARIANTS = [
  {
    id: 'A-now',
    title: 'A · what you have now',
    note: 'Today\'s build. Photo is capped, so on most phones the page ends early and the space above the nav is empty.',
    css: '',
  },
  {
    id: 'B-frame',
    title: 'B · the polaroid, same size',
    note: 'The skew frame you picked, on today\'s photo size. Shows the frame change on its own — the gap is still there.',
    css: POLAROID,
  },
  {
    id: 'C-fill',
    title: 'C · photo fills the gap',
    note: 'The photo takes every spare pixel, so the frame reaches down to the text. Biggest photo, most of the picture visible.',
    css: `${POLAROID}\n${FILL}`,
  },
  {
    id: 'D-fill-capped',
    title: 'D · fills the gap, up to a limit',
    note: 'Same as C, except the photo never gets taller than it is wide. Protects tall screens from a poster-sized slab.',
    css: `${POLAROID}\n${FILL}\n${CAP}`,
  },
];

const SHOT_VIEWPORTS = [
  { w: 320, h: 488, name: 'small phone — nothing to give here', lang: 'af', caption: 'long' },
  { w: 390, h: 844, name: 'the usual phone', lang: 'en', caption: 'short' },
  { w: 428, h: 926, name: 'big phone', lang: 'en', caption: 'short' },
  { w: 739, h: 850, name: 'your device class', lang: 'en', caption: 'short' },
];

function bankLines(lang) {
  const src = readFileSync(path.join(root, 'assets', 'copy', `${lang}.js`), 'utf8');
  const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  const lines = [];
  const walk = (n) => {
    if (typeof n === 'string') return lines.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') Object.values(n).forEach(walk);
  };
  walk(bank.witty || {});
  return lines.sort((a, b) => b.length - a.length);
}
const CAPTION = {
  long: { af: bankLines('af')[0] },
  short: { en: bankLines('en').filter((l) => l.length > 14 && l.length < 34).slice(-1)[0] || bankLines('en').slice(-1)[0] },
};

const slotFile = path.join(root, 'assets', 'images', 'bg', PINNED_SLOT);
if (!existsSync(slotFile)) throw new Error(`pinned slot missing: ${PINNED_SLOT}`);
const sha = createHash('sha256').update(readFileSync(slotFile)).digest('hex');
const heroUrl = `/assets/images/bg-canonical/${sha}.webp`;
if (!existsSync(path.join(dist, heroUrl.slice(1)))) throw new Error(`pinned image not in build: ${heroUrl}`);
const PIN_IMAGE = `html { --hero-url: url("${heroUrl}") !important; }`;

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 24 - (i % 6), feelsLikeC: 22, rainChance: (i % 7) * 6, precipMm: 0,
    windKph: 18 - (i % 9), windDir: 205, cloudPct: 12, humidity: 44, uv: 8, condition: 'clear',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 27, lowC: 15, rainChance: 10, uv: 8, windKph: 18,
    conditionKey: 'clear', conditionLabel: 'Clear',
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 26, feelsLikeC: 24, uv: 8, isDay: true, windKph: 18, rainChance: 10,
      cloudPct: 12, conditionKey: 'clear', conditionLabel: 'Clear',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: 18, maxWindKph: 26, gustKph: 26, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'clear', sourceAgreement: '4/5' },
    },
  };
}

function startServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
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
    const isShot = pathname.startsWith('/shots/');
    const base = isShot ? output : dist;
    const rel = isShot ? pathname.slice('/shots/'.length) : pathname.slice(1);
    let file = null; let buf = null;
    try { file = path.resolve(base, rel === '' ? 'index.html' : rel); buf = readFileSync(file); }
    catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

mkdirSync(cssDir, { recursive: true });
for (const v of VARIANTS) writeFileSync(path.join(cssDir, `${v.id}.css`), `${v.css}\n`);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

// How much of the photograph the frame actually shows. This is the number the
// whole idea is for, so it is measured off the rendered page, not argued.
const COVERAGE = () => {
  const el = document.getElementById('heroPhoto');
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const url = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const box = { w: r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
        h: r.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth) };
      const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
      resolve({
        cardW: +r.width.toFixed(1), cardH: +r.height.toFixed(1),
        photoW: +box.w.toFixed(1), photoH: +box.h.toFixed(1),
        coverage: +((box.h / (img.naturalHeight * scale)) * 100).toFixed(1),
      });
    };
    img.onerror = () => resolve(null);
    img.src = url ? url[1] : '';
  });
};

const shots = [];
const rows = [];
for (const vp of SHOT_VIEWPORTS) {
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify(l));
      } catch (_) {}
    }, vp.lang);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    // END of <body>: index.html links app.css from the body, so a head-injected
    // sheet loses every equal-specificity contest and renders the control.
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, `${PIN_IMAGE}\n${v.css}`);
    await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, CAPTION[vp.caption][vp.lang]);
    await page.waitForFunction(() => {
      const u = getComputedStyle(document.getElementById('heroPhoto')).backgroundImage;
      return u && u !== 'none';
    }, null, { timeout: 10000 });
    await page.waitForTimeout(2200);

    const cov = await page.evaluate(COVERAGE);
    const gap = await page.evaluate(() => {
      const nav = document.querySelector('.nav').getBoundingClientRect();
      const stats = document.getElementById('statsRow').getBoundingClientRect();
      const cta = document.getElementById('homeHourly').getBoundingClientRect();
      return {
        gap: +(nav.top - Math.max(stats.bottom, cta.bottom)).toFixed(1),
        scroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      };
    });
    if (v.css.includes('--print-stock') && cov.photoW >= cov.cardW) {
      throw new Error(`${v.id} at ${vp.w}x${vp.h}: the polaroid frame did not land`);
    }
    rows.push({ variant: v.id, viewport: `${vp.w}x${vp.h}`, ...cov, ...gap });

    const name = `${vp.w}x${vp.h}--${v.id}.png`;
    await page.screenshot({ path: path.join(output, name) });
    shots.push(name);
    await ctx.close();
  }
}

const sheetPage = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
const failures = [];
sheetPage.on('requestfailed', (r) => failures.push(r.url()));
sheetPage.on('response', (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });

const sheets = [];
for (const vp of SHOT_VIEWPORTS) {
  const row = VARIANTS.map((v) => {
    const m = rows.find((r) => r.variant === v.id && r.viewport === `${vp.w}x${vp.h}`);
    return `<figure>
      <img src="${base}/shots/${vp.w}x${vp.h}--${v.id}.png" width="${vp.w}" alt="">
      <figcaption>
        <b>${v.title}</b>
        <span>${v.note}</span>
        <em>photo ${Math.round(m.photoW)}x${Math.round(m.photoH)} · shows <u>${m.coverage}%</u> of the picture · ${m.gap < 12 ? 'no gap left' : `${Math.round(m.gap)}px gap under the text`}</em>
      </figcaption>
    </figure>`;
  }).join('');
  await sheetPage.setContent(`<meta charset="utf-8"><style>
    body { margin:0; background:#0d0d12; color:#fff; padding:24px;
           font:13px/1.45 -apple-system,Segoe UI,Roboto,sans-serif; }
    h1 { font-size:16px; letter-spacing:.09em; text-transform:uppercase; color:#ffd700; margin:0 0 4px; }
    h2 { font-size:11.5px; font-weight:400; color:#7c8290; margin:0 0 20px; }
    .row { display:flex; gap:20px; align-items:flex-start; }
    figure { margin:0; width:${vp.w}px; }
    img { width:${vp.w}px; display:block; border-radius:3px; }
    figcaption { margin-top:10px; font-size:11.5px; color:#aab0bd; }
    figcaption b { display:block; color:#fff; font-size:12.5px; margin-bottom:4px; }
    figcaption span { display:block; margin-bottom:6px; }
    figcaption em { display:block; font-style:normal; color:#59d0ff; font-size:11px; }
    figcaption u { color:#ffd700; text-decoration:none; font-weight:700; }
  </style>
  <h1>${vp.w} x ${vp.h} — ${vp.name}</h1>
  <h2>Same photograph in all four. ${vp.caption === 'long' ? 'Longest Afrikaans witty line' : 'One-line witty'}. "Shows X% of the picture" = how much of the photograph the frame is actually letting you see.</h2>
  <div class="row">${row}</div>`);
  await sheetPage.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
  const file = path.join(output, `sheet-${vp.w}x${vp.h}.png`);
  await sheetPage.screenshot({ path: file, fullPage: true });
  sheets.push(path.relative(root, file).replaceAll('\\', '/'));
}
if (failures.length) throw new Error(`sheet images failed: ${failures.slice(0, 4).join(', ')}`);

await browser.close();
server.close();

writeFileSync(path.join(output, 'geometry.json'), `${JSON.stringify({ pinnedSlot: PINNED_SLOT, rows }, null, 2)}\n`);

console.log(`[fill] ${shots.length} shots, ${sheets.length} sheets -> output/hero-fill/`);
for (const s of sheets) console.log(`  ${s}`);
console.log('\nvariant          viewport    photo box     shows   gap under text');
for (const r of rows) {
  console.log(`${r.variant.padEnd(16)} ${r.viewport.padEnd(11)} ${`${Math.round(r.photoW)}x${Math.round(r.photoH)}`.padEnd(13)} ${`${r.coverage}%`.padStart(6)}   ${String(Math.round(r.gap)).padStart(4)}px${r.scroll > 1 ? `  SCROLLS ${r.scroll}px` : ''}`);
}

if (GATE) {
  console.log('\n[fill] 64-combination fold matrix per version…');
  const results = [];
  for (const v of VARIANTS) {
    let pass = true; let tail = '';
    try {
      const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'verify-home-fold.mjs')], {
        cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PW_FOLD_CSS: path.join(cssDir, `${v.id}.css`), PW_FOLD_LABEL: v.id },
      });
      tail = out.trim().split('\n').slice(-1)[0];
    } catch (e) {
      pass = false;
      const all = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n');
      tail = all.filter((l) => l.includes('FAILURES') || l.trimStart().startsWith('- ')).slice(0, 5).join(' | ');
    }
    results.push({ variant: v.id, pass, tail });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${v.id.padEnd(16)} ${tail}`);
  }
  writeFileSync(path.join(output, 'fold-per-variant.json'), `${JSON.stringify(results, null, 2)}\n`);
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}
