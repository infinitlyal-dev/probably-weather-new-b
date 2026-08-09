// POLAROID HERO — candidate treatments, shot for Al's ruling. Nothing ships.
//
// The brief: bring the desktop postcard grammar to the mobile hero — photo as a
// framed snapshot, the witty line on the frame foot, reading as "someone snapped
// the weather outside".
//
// The constraint that shapes every candidate, measured not assumed:
// `node scripts/verify-home-fold.mjs` reports the tightest combination as
// 320x488 / AF / longest line with **3px** of headroom above the nav. So a frame
// that ADDS height is dead on arrival. Every treatment below is height-NEUTRAL:
// the frame is drawn inside the hero's existing box (border-box), and anything
// that grows the caption foot is paid for out of the photo in the same rule.
//
//   node scripts/hero-polaroid-variants.mjs           -> shots + contact sheets
//   node scripts/hero-polaroid-variants.mjs --gate    -> also run the 64-combo
//                                                        fold matrix per variant
//
// Output: output/hero-polaroid/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'hero-polaroid');
const cssDir = path.join(output, 'css');
const DATE = '2026-08-08';
const GATE = process.argv.includes('--gate');

// ---- The one photograph, identical across every variant --------------------
// A clear-day frame with a human subject: the frame has to be judged against the
// picture it is framing, and a landscape would flatter every treatment equally.
const PINNED_SLOT = 'clear/week_2/day/1.webp';

// ---- Print stock, taken from the desktop postcard, not invented -------------
// #f6f2e8 / #24211d and the square corner are app.css:2627-2634. Reusing the
// exact values is the point: the two frames must be the same stock, or "the
// desktop grammar on mobile" is only a description.
const STOCK = `
  :root {
    --print-stock: #f6f2e8;
    --print-ink: #24211d;
  }
  .hero-card {
    position: relative;
    background: var(--print-stock);
    border-radius: 0;
    overflow: visible;
    box-shadow: 0 18px 44px rgba(0,0,0,0.55), 0 6px 16px rgba(0,0,0,0.38);
  }
  .hero-photo {
    box-sizing: border-box;
    border: var(--print-frame) solid var(--print-stock);
    border-bottom-width: 0;
  }
  main#home-screen.main > .hero-caption {
    background: var(--print-stock);
    color: var(--print-ink);
    border-radius: 0;
    text-align: center;
    padding-left: calc(16px + var(--print-frame));
    padding-right: calc(16px + var(--print-frame));
  }
`;

// The gold pin. Absolutely positioned, so it costs zero layout height, and it
// sits ON the top frame rather than overhanging the card — an overhang would
// collide with the header on the 488px-tall screen, which has 3px to give.
const PIN = `
  .hero-card::after {
    content: "";
    position: absolute;
    left: 50%;
    top: clamp(2px, 0.5vh, 6px);
    transform: translateX(-50%);
    width: clamp(11px, 2.1vh, 18px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--brand-gold);
    border: 2px solid var(--print-stock);
    box-shadow: 0 4px 9px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.65);
    z-index: 3;
  }
`;

// A deeper foot than the side frame is what makes a print read as a Polaroid.
// It is bought back out of the photo in the same block, so the card's total
// height does not move by a pixel.
const DEEP_FOOT = `
  :root { --print-foot: clamp(4px, 1.1vh, 14px); }
  .hero-photo { height: calc(var(--hero-h) - var(--print-foot)); }
  main#home-screen.main > .hero-caption {
    padding-bottom: calc(var(--fold-rhythm) * 1.4 + var(--print-foot));
  }
`;

// The tilt. Card and caption are separate DOM nodes (the caption cannot move
// into the card — that blanked the desktop postcard caption, Sol 2026-08-06), so
// they are kept rigid by rotating BOTH about the same physical point: the centre
// of the seam between them. Card origin 50% 100%, caption origin 50% 0.
// The rotation's vertical overhang is (cardWidth / 2) * sin(2.4deg) ~= 2.1vw at
// each end, and it is paid for exactly: +1 pad above, +1 pad below, -2 pads of
// photo. Net height change: zero.
const TILT = `
  :root { --hero-tilt: -2.4deg; --tilt-pad: 2.1vw; }
  .hero-card {
    transform: rotate(var(--hero-tilt));
    transform-origin: 50% 100%;
    margin-top: calc(var(--fold-rhythm) * 0.4 + var(--tilt-pad));
  }
  .hero-photo { height: calc(var(--hero-h) - var(--print-foot) - 2 * var(--tilt-pad)); }
  main#home-screen.main > .hero-caption {
    transform: rotate(var(--hero-tilt));
    transform-origin: 50% 0;
    margin-bottom: calc(var(--fold-rhythm) * 1.5 + var(--tilt-pad));
  }
  /* The caption runs #home-screen .headline's heroFadeIn, and a running
     animation's transform beats a declared one — so the first render of this
     variant tilted the photo and left the foot flat, hanging off the print at
     one corner. This is the identical trap app.css:2688 documents for the
     desktop postcard caption; the fix is the same, a rotate-preserving
     keyframe at higher specificity (0,1,2,0 beats 0,1,1,0). */
  @keyframes heroFadeInPolaroid {
    from { opacity: 0; transform: translateY(14px) rotate(var(--hero-tilt)); }
    to   { opacity: 1; transform: rotate(var(--hero-tilt)); }
  }
  main#home-screen.main > .hero-caption {
    animation: heroFadeInPolaroid 1s ease-in forwards;
    animation-delay: 0.3s;
  }
`;

const VARIANTS = [
  {
    id: 'P0-current',
    title: 'P0 — current (control)',
    note: 'Shipping today: dark card, 20px top radius, gold Caveat on #16171d.',
    css: '',
  },
  {
    id: 'P1-hairline',
    title: 'P1 — hairline print',
    note: 'Thin cream surround (3–7px), square corners, ink caption on the stock. Lightest touch; keeps the most picture on a small phone.',
    css: `:root { --print-frame: clamp(3px, 0.72vh, 7px); }\n${STOCK}`,
  },
  {
    id: 'P2-polaroid',
    title: 'P2 — full polaroid',
    note: 'Heavier surround (5–11px), deeper foot than the sides, gold pin on the top frame. Reads as a print, not a card.',
    css: `:root { --print-frame: clamp(5px, 1.15vh, 11px); }\n${STOCK}\n${DEEP_FOOT}\n${PIN}`,
  },
  {
    id: 'P3-polaroid-tilt',
    title: 'P3 — full polaroid, tilted −2.4°',
    note: 'P2 plus the desktop postcard\'s exact −2.4° tilt. The overhang is paid out of the photo, so the fold budget is unchanged.',
    css: `:root { --print-frame: clamp(5px, 1.15vh, 11px); }\n${STOCK}\n${DEEP_FOOT}\n${PIN}\n${TILT}`,
  },
];

const SHOT_VIEWPORTS = [
  { w: 320, h: 488, name: 'short — iPhone SE + browser chrome', lang: 'af', caption: 'long' },
  { w: 320, h: 488, name: 'short — iPhone SE + browser chrome', lang: 'en', caption: 'short' },
  { w: 390, h: 734, name: 'mid — iPhone 14 + browser chrome', lang: 'en', caption: 'short' },
  { w: 428, h: 926, name: 'tall — iPhone 14 Plus', lang: 'en', caption: 'short' },
];

// ---- Captions, real lines out of the shipped copy bank ---------------------
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
const AF_LONGEST = bankLines('af')[0];
const EN_SHORT = bankLines('en').filter((l) => l.length > 14 && l.length < 34).slice(-1)[0]
  || bankLines('en').slice(-1)[0];
const CAPTION = { long: { af: AF_LONGEST }, short: { en: EN_SHORT } };

// ---- The pinned photograph, resolved to what production actually serves ----
const slotFile = path.join(root, 'assets', 'images', 'bg', PINNED_SLOT);
if (!existsSync(slotFile)) throw new Error(`pinned slot missing: ${PINNED_SLOT}`);
const sha = createHash('sha256').update(readFileSync(slotFile)).digest('hex');
const heroUrl = `/assets/images/bg-canonical/${sha}.webp`;
if (!existsSync(path.join(dist, heroUrl.slice(1)))) {
  throw new Error(`pinned image is not in the build: ${heroUrl} — run npm run build`);
}
// The app sets --hero-url as an INLINE style on <html>; an author rule only wins
// with !important. Without this the picker would hand each variant a different
// photograph and the comparison would be worthless.
const PIN_IMAGE = `html { --hero-url: url("${heroUrl}") !important; }`;

// ---- Server (dist + the shot output tree, for the contact sheets) ----------
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
    const base = pathname.startsWith('/shots/') ? output : dist;
    const rel = pathname.startsWith('/shots/') ? pathname.slice('/shots/'.length) : pathname.slice(1);
    let file = null; let buf = null;
    try { file = path.resolve(base, rel === '' ? 'index.html' : rel); buf = readFileSync(file); }
    catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

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

mkdirSync(cssDir, { recursive: true });
for (const v of VARIANTS) writeFileSync(path.join(cssDir, `${v.id}.css`), `${v.css}\n`);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

// ---- Shots -----------------------------------------------------------------
const shots = [];
const geometry = [];
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
    // END of <body>, not the head: index.html links app.css from the body, so a
    // head-injected sheet loses every equal-specificity contest — the first run
    // of this script produced four "variants" that were all the control.
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, `${PIN_IMAGE}\n${v.css}`);
    await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, CAPTION[vp.caption][vp.lang]);
    // The photograph must actually be on screen — a variant judged against an
    // empty cream box is the M7 broken-image sheet all over again.
    await page.waitForFunction(() => {
      const el = document.getElementById('heroPhoto');
      const url = getComputedStyle(el).backgroundImage;
      return url && url !== 'none';
    }, null, { timeout: 10000 });
    // Long enough for the caption's entrance to finish. Injecting a stylesheet
    // that names a new @keyframes RESTARTS that animation, so a 900ms wait shot
    // the tilted foot mid-fade and it came out grey instead of cream.
    await page.waitForTimeout(2200);

    const m = await page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
      };
      const nav = document.querySelector('.nav').getBoundingClientRect();
      const stats = document.getElementById('statsRow').getBoundingClientRect();
      const cta = document.getElementById('homeHourly').getBoundingClientRect();
      const cap = getComputedStyle(document.getElementById('headline'));
      return {
        captionBg: cap.backgroundColor, captionInk: cap.color,
        captionTransform: cap.transform, cardTransform: getComputedStyle(document.getElementById('heroCard')).transform,
        frame: getComputedStyle(document.getElementById('heroPhoto')).borderTopWidth,
        card: r('#heroCard'), photo: r('#heroPhoto'), captionRect: r('#headline'),
        headroom: +(nav.top - Math.max(stats.bottom, cta.bottom)).toFixed(1),
        scroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      };
    });
    // A shot that quietly rendered the control is worse than no shot: it reads
    // as "the treatment changes nothing" when the truth is the sheet never
    // landed. Assert the treatment is actually on the screen before shooting.
    if (v.css && (m.captionBg !== 'rgb(246, 242, 232)' || parseFloat(m.frame) < 1)) {
      throw new Error(`${v.id} did not take effect at ${vp.w}x${vp.h}: caption bg ${m.captionBg}, frame ${m.frame}`);
    }
    // The print must be ONE object: photo and foot tilted by the same matrix, or
    // the foot hangs off the corner. Compare the rotation terms, not the whole
    // matrix — the translate columns legitimately differ.
    if (v.id.includes('tilt')) {
      const rot = (t) => (t.startsWith('matrix') ? t.slice(t.indexOf('(') + 1).split(',').slice(0, 4).map((n) => +(+n).toFixed(4)).join(',') : t);
      if (rot(m.cardTransform) !== rot(m.captionTransform) || m.captionTransform === 'none') {
        throw new Error(`${v.id} tilt is not rigid at ${vp.w}x${vp.h}: card ${m.cardTransform} vs caption ${m.captionTransform}`);
      }
    }
    geometry.push({ variant: v.id, viewport: `${vp.w}x${vp.h}`, lang: vp.lang, caption: vp.caption, ...m });

    const name = `${vp.w}x${vp.h}-${vp.lang}-${vp.caption}--${v.id}.png`;
    await page.screenshot({ path: path.join(output, name) });
    shots.push({ file: name, variant: v.id, vp });
    await ctx.close();
  }
}

// ---- Contact sheets: one per viewport, four variants side by side ----------
const sheetPage = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
// A setContent page has an about:blank origin, so every shot is addressed by its
// ABSOLUTE http URL. Relative ones resolve to nothing and the sheet renders as a
// row of broken-image icons — the exact failure the M7 sheets started life with.
const sheetFailures = [];
sheetPage.on('requestfailed', (r) => sheetFailures.push(r.url()));
sheetPage.on('response', (r) => { if (r.status() >= 400) sheetFailures.push(`${r.status()} ${r.url()}`); });
const sheets = [];
for (const vp of SHOT_VIEWPORTS) {
  const row = VARIANTS.map((v) => {
    const file = `${vp.w}x${vp.h}-${vp.lang}-${vp.caption}--${v.id}.png`;
    return `<figure>
      <img src="${base}/shots/${file}" width="${vp.w}" alt="">
      <figcaption><b>${v.title}</b><span>${v.note}</span></figcaption>
    </figure>`;
  }).join('');
  await sheetPage.setContent(`<meta charset="utf-8"><style>
    body { margin:0; background:#0d0d12; color:#fff; padding:22px;
           font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif; }
    h1 { font-size:15px; letter-spacing:.09em; text-transform:uppercase; color:#ffd700; margin:0 0 3px; }
    h2 { font-size:11px; font-weight:400; color:#6f7581; margin:0 0 18px; }
    .row { display:flex; gap:18px; align-items:flex-start; }
    figure { margin:0; width:${vp.w}px; }
    img { width:${vp.w}px; display:block; border-radius:2px; }
    figcaption { margin-top:9px; font-size:11px; color:#aab0bd; }
    figcaption b { display:block; color:#fff; font-size:12px; margin-bottom:3px; }
    figcaption span { display:block; }
  </style>
  <h1>${vp.w}x${vp.h} — ${vp.name}</h1>
  <h2>${vp.lang.toUpperCase()} · ${vp.caption === 'long' ? 'longest witty line in the bank' : 'one-line witty'} · same photograph in every frame (${PINNED_SLOT})</h2>
  <div class="row">${row}</div>`);
  await sheetPage.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  const file = path.join(output, `sheet-${vp.w}x${vp.h}-${vp.lang}-${vp.caption}.png`);
  await sheetPage.screenshot({ path: file, fullPage: true });
  sheets.push(path.relative(root, file).replaceAll('\\', '/'));
}
if (sheetFailures.length) {
  throw new Error(`contact sheet images failed to load — the sheets are untrustworthy: ${sheetFailures.slice(0, 4).join(', ')}`);
}

await browser.close();
server.close();

writeFileSync(path.join(output, 'geometry.json'), `${JSON.stringify({
  pinnedSlot: PINNED_SLOT, canonical: heroUrl, captions: CAPTION, geometry,
}, null, 2)}\n`);

console.log(`[polaroid] ${shots.length} shots, ${sheets.length} contact sheets -> output/hero-polaroid/`);
for (const s of sheets) console.log(`  ${s}`);
console.log('\nvariant             viewport   lang cap    card h  photo h  caption h  headroom  scroll');
for (const g of geometry) {
  console.log(`${g.variant.padEnd(19)} ${g.viewport.padEnd(10)} ${g.lang}   ${g.caption.padEnd(6)} `
    + `${String(g.card.h).padStart(6)} ${String(g.photo.h).padStart(8)} ${String(g.captionRect.h).padStart(10)} `
    + `${String(g.headroom).padStart(9)} ${String(g.scroll).padStart(7)}`);
}

// ---- The gate, per variant -------------------------------------------------
if (GATE) {
  console.log('\n[polaroid] running the 64-combination fold matrix per variant…');
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
      tail = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n').filter((l) => l.includes('-') || l.includes('FAIL')).slice(0, 6).join(' | ');
    }
    results.push({ variant: v.id, pass, tail });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${v.id.padEnd(19)} ${tail}`);
  }
  writeFileSync(path.join(output, 'fold-per-variant.json'), `${JSON.stringify(results, null, 2)}\n`);
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}
