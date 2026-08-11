// THE WITTY LINE ON THE PRINT — candidate treatments, shot for Al's ruling.
//
// Al's warmth-pass ruling 2026-08-10: the caption stays on the polaroid foot and
// gets BOLDER. This shoots the treatments on ONE photograph and ONE line so the
// only difference between the frames is the treatment.
//
// C1 is what is currently in app.css; C0 shows where it came from. Nothing here
// is a commitment — the CSS lives in this file, not in the app, except C1.
//
//   node scripts/caption-variants.mjs          -> shots + contact sheet
//   node scripts/caption-variants.mjs --gate   -> also run the full fold matrix
//                                                 per variant (PW_FOLD_CSS)
//
// Output: output/caption-variants/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'caption-variants');
const cssDir = path.join(output, 'css');
const DATE = '2026-08-08';
const GATE = process.argv.includes('--gate');

// The same photograph the polaroid treatments were judged on, so this sheet and
// output/hero-polaroid/ can be laid side by side.
const PINNED_SLOT = 'clear/week_2/day/1.webp';

// The pre-warmth caption, restated so the control is a real before and not a
// memory of one: the old size curve and the postcard's softer ink.
const C0 = `
  :root { --cap-fs: clamp(0.78rem, min(2.35vh, 5.2vw), 1.6rem); --print-ink: #24211d; }
`;
// Slant: font-style, NOT a transform. A transform on this element would tilt the
// cream foot itself and part it from the photo at the corner — the foot and the
// card are held rigid by rotating both about the seam. Oblique leans the GLYPHS
// only, which is what a faster hand actually looks like.
const SLANT = `
  main#home-screen.main > .hero-caption { font-style: oblique 4deg; }
`;
// A real polaroid's writing sits high in the foot with cream under it. The extra
// depth is bought back out of the photograph by the flex column, so the fold
// budget is unchanged — which --gate is there to prove, not assume.
const DEEP_FOOT = `
  main#home-screen.main > .hero-caption {
    padding-bottom: calc(var(--fold-rhythm) * 2.6 + var(--print-foot));
  }
`;

const VARIANTS = [
  { id: 'C0-before', title: 'C0 — before the warmth pass (control)',
    note: 'The caption as it shipped: smaller curve, #24211d ink.', css: C0 },
  { id: 'C1-ink', title: 'C1 — bigger + true ink  [IN THE CODE NOW]',
    note: 'Size curve up ~25% across all three terms, ink darkened to #1b1813.', css: '' },
  { id: 'C2-slant', title: 'C2 — C1 + handwriting slant',
    note: 'C1 plus font-style: oblique 4deg. Leans the letters, not the foot.', css: SLANT },
  { id: 'C3-deepfoot', title: 'C3 — C2 + deeper foot',
    note: 'C2 plus cream under the line, so the writing sits high in the foot.', css: `${SLANT}\n${DEEP_FOOT}` },
];

// Al's own phone first. The 320x488 row is the worst case in the fold matrix —
// a treatment that only reads on a big screen is not a treatment.
const SHOT_VIEWPORTS = [
  { w: 375, h: 812, name: "Al's iPhone X", lang: 'en', caption: 'short' },
  { w: 375, h: 812, name: "Al's iPhone X", lang: 'af', caption: 'long' },
  { w: 320, h: 488, name: 'iPhone SE + chrome', lang: 'af', caption: 'long' },
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
if (!existsSync(path.join(dist, heroUrl.slice(1)))) {
  throw new Error(`pinned image is not in the build: ${heroUrl} — run npm run build`);
}
// The app sets --hero-url as an inline style on <html>; only !important beats it.
const PIN_IMAGE = `html { --hero-url: url("${heroUrl}") !important; }`;

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 24 - (i % 6), feelsLikeC: 22, rainChance: (i % 7) * 6, precipMm: 0,
    windKph: 18 - (i % 9), windDir: 205, cloudPct: 12, humidity: 44, uv: 8, condition: 'clear',
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: 27, lowC: 15, rainChance: 10, uv: 8, windKph: 18,
    conditionKey: 'clear', conditionLabel: 'Clear', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
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
    let file = null; let buf = null;
    try { file = path.resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1)); buf = readFileSync(file); }
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
const rows = [];

for (const vp of SHOT_VIEWPORTS) {
  const cells = [];
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
    // sheet loses every equal-specificity contest and every "variant" would be
    // the control.
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, `${PIN_IMAGE}\n${v.css}`);
    await page.evaluate((txt) => { document.getElementById('headline').textContent = txt; }, CAPTION[vp.caption][vp.lang]);
    await page.waitForTimeout(500);
    const measured = await page.evaluate(() => {
      const h = document.getElementById('headline');
      const cs = getComputedStyle(h);
      const nav = document.querySelector('.nav').getBoundingClientRect();
      const lowest = Math.max(...[...document.querySelectorAll('#statsRow, #homeHourly, #agreeLine')]
        .map((el) => el.getBoundingClientRect().bottom));
      return {
        px: Math.round(parseFloat(cs.fontSize) * 10) / 10,
        lines: Math.round(h.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
        headroom: Math.round(nav.top - lowest),
        scroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      };
    });
    const file = `${v.id}-${vp.w}x${vp.h}-${vp.lang}.png`;
    await page.screenshot({ path: path.join(output, file) });
    await ctx.close();
    cells.push({ v, file, measured });
    console.log(`[caption] ${v.id} @ ${vp.w}x${vp.h} ${vp.lang}: ${measured.px}px, ${measured.lines} line(s), headroom ${measured.headroom}px, scroll ${measured.scroll}px`);
  }
  rows.push({ vp, cells });
}

await browser.close();
server.close();

const sheet = `<!doctype html><meta charset="utf-8"><title>Witty line on the print — warmth pass</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:24px;
         font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:19px; margin:0 0 4px; } h2 { font-size:14px; margin:26px 0 10px; color:#b5ab9d; font-weight:600; }
  .row { display:flex; gap:16px; flex-wrap:wrap; }
  figure { margin:0; width:250px; }
  img { width:100%; border-radius:8px; display:block; box-shadow:0 8px 22px rgba(0,0,0,.5); }
  figcaption { margin-top:9px; font-size:11.5px; color:#b5ab9d; }
  b { color:#ffd700; display:block; font-size:12px; margin-bottom:3px; }
  .m { color:#fffaf3; font-variant-numeric:tabular-nums; }
</style>
<h1>The witty line on the print — warmth pass, 2026-08-10</h1>
<p style="color:#b5ab9d;margin:0">One photograph, one line per column. C1 is what is in app.css right now; C0 is the treatment it replaced. Nothing else ships until you rule.</p>
${rows.map(({ vp, cells }) => `<h2>${vp.w}×${vp.h} — ${vp.name} · ${vp.lang.toUpperCase()} ${vp.caption === 'long' ? 'longest line' : 'short line'}</h2>
<div class="row">${cells.map(({ v, file, measured }) => `<figure>
  <img src="${file}" alt="${v.title}">
  <figcaption><b>${v.title}</b>${v.note}<br><span class="m">${measured.px}px · ${measured.lines} line(s) · headroom ${measured.headroom}px · scroll ${measured.scroll}px</span></figcaption>
</figure>`).join('')}</div>`).join('')}
`;
writeFileSync(path.join(output, 'index.html'), sheet);
console.log(`[caption] contact sheet → output/caption-variants/index.html`);

if (GATE) {
  for (const v of VARIANTS) {
    console.log(`\n[caption] fold matrix for ${v.id}…`);
    try {
      const out = execFileSync(process.execPath, ['scripts/verify-home-fold.mjs'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, PW_FOLD_CSS: path.join(cssDir, `${v.id}.css`), PW_FOLD_LABEL: v.id },
      });
      console.log(out.trim().split('\n').slice(-1)[0]);
    } catch (err) {
      console.log(`  FAIL — ${String(err.stdout || '').trim().split('\n').slice(-3).join('\n')}`);
    }
  }
}
