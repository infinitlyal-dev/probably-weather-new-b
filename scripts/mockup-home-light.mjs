// HOME MOCKUPS — PUTTING THE LIGHT BACK.
//
// Al, 2026-08-17, on the shipped meme hero: "It does feel better. Only worry is
// the homesreen still feels a bit dark. To moody almost. Its the overall black
// design, not sure how to make it feel more SA viby like it used to feel."
//
// Diagnosis these mock up: it is not WHICH black — the warmth pass already took
// that from blue-grey to espresso. It is HOW MUCH of the screen is black. At
// 375x812 the photograph is ~54% of the screen and the other ~46% (header band,
// temperature block, stats pill, nav) is flat page colour with nothing in it.
// Before the facelift the photograph WAS the page: 100% of the screen carried
// daylight. We bought readability with light and only paid back hue.
//
// Two levers, both already built, neither touching the data-on-solid rule:
//
//   1. ITER 1's wash (app.css: "THE ROOM TAKES THE PHOTOGRAPH'S LIGHT") already
//      paints a blurred, saturated copy of the hero behind the page. Its scrim
//      then reaches rgba(...,0.92) at 62% and lands on flat --page-bg at 78% —
//      so the bottom ~40% of the screen is the filing cabinet again. Lever one
//      is that scrim, not the wash.
//   2. The photograph stops at a dark header band. Letting it run to the top of
//      the screen reclaims that strip as light, and the data still sits on solid
//      below it.
//
// MOCKUPS, NOT CODE. Each variant is a stylesheet applied to the real running
// app with real data, then screenshotted. Nothing here is written into the app.
//
//   node scripts/mockup-home-light.mjs
// Output: output/mockup-light/index.html
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HERO_CROP_OFFSETS } from '../assets/hero-crop.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const out = path.join(root, 'output', 'mockup-light');
const DATE = '2026-08-17';
mkdirSync(out, { recursive: true });

// Three scenes, chosen for where the complaint lives: a bright day (the most
// light available to spill), a dark day (the least), and night (where the page
// is darkest and the wash has the least to give).
const SCENES = {
  sunny: {
    slot: 'clear/week_1/day/1.webp', hour: 13, isDay: true,
    caption: 'This is why we live in South Africa.',
    p: { temp: 29, hi: 31, lo: 18, rain: 0, cloud: 5, uv: 9, wind: 12, key: 'clear', label: 'Clear skies.' },
  },
  storm: {
    slot: 'storm/week_1/day/3.webp', hour: 15, isDay: true,
    caption: 'Even the bakkies on the N2 pulled over.',
    p: { temp: 14, hi: 17, lo: 11, rain: 92, cloud: 98, uv: 1, wind: 46, key: 'storm', label: 'Storms rolling in.' },
  },
  night: {
    slot: 'clear/week_1/night/7.webp', hour: 21, isDay: false,
    caption: 'Cool enough to sleep with the window open.',
    p: { temp: 16, hi: 26, lo: 14, rain: 0, cloud: 10, uv: 0, wind: 8, key: 'clear', label: 'Clear night.' },
  },
};

// ---- the levers ------------------------------------------------------------
// LEVER 1. The wash survives all the way down instead of being extinguished.
// It never reaches full opacity, so the photograph's own colour is still in the
// page behind the temperature, the stats pill and the nav. The wash itself is
// also brought up half a stop — it was tuned to be barely perceptible under a
// scrim that then hid it anyway.
const GLOW = `
  #bg::after {
    filter: blur(38px) saturate(1.5) brightness(0.55) !important;
  }
  #bg::before {
    background: linear-gradient(
      to bottom,
      rgba(20, 17, 13, 0.30) 0%,
      rgba(20, 17, 13, 0.46) 40%,
      rgba(20, 17, 13, 0.66) 66%,
      rgba(20, 17, 13, 0.78) 100%
    ) !important;
  }
  /* The nav is the last opaque slab on the screen. On the lit page a flat
     rectangle of --page-bg at the bottom reads as a hole; this lets the room
     through it while keeping the labels on something. */
  .nav {
    background: rgba(20, 17, 13, 0.82) !important;
    backdrop-filter: blur(18px) !important;
  }
`;
// LEVER 2. The photograph reaches the top of the screen. The header stops being
// a dark band and becomes furniture floating on the picture, with its own small
// gradient so the brand and the place name stay legible.
const TALL = `
  .container { padding-top: 0 !important; }
  .header {
    position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important;
    z-index: 20 !important;
    padding: max(0.5rem, env(safe-area-inset-top)) 12px 18px !important;
    background: linear-gradient(to bottom, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%) !important;
  }
  .hero-card {
    margin-top: 0 !important;
    border-radius: 0 0 var(--r-lg) var(--r-lg) !important;
  }
`;
// The same idea with the brakes off: edge to edge on all three sides, the way
// the pre-facelift home ran. The data still sits on solid below the picture —
// this is how far toward "the photo IS the page" we can go without breaking the
// rule that made the facelift work.
const FAR = `
  .container { padding-top: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }
  .header {
    position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important;
    z-index: 20 !important;
    padding: max(0.5rem, env(safe-area-inset-top)) 16px 18px !important;
    background: linear-gradient(to bottom, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%) !important;
  }
  .hero-card {
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  main#home-screen.main > .hero-caption {
    left: 0 !important; right: 0 !important;
    padding-left: 18px !important; padding-right: 18px !important;
    border-radius: 0 !important;
  }
  main#home-screen.main { padding-left: 18px !important; padding-right: 18px !important; }
`;

const VARIANTS = [
  { id: '0-now', title: 'Live now — the meme hero as built', note: 'The control. Photograph ~54% of the screen; everything else flat espresso.', css: '' },
  { id: '1-glow', title: 'A — the room keeps the photograph\'s light', note: 'The wash already exists (ITER 1). Its scrim went fully opaque 62% down the screen, which is why the bottom half is a filing cabinet. Here it never closes: the picture\'s colour is still in the page behind the numbers, and the nav goes glass.', css: GLOW },
  { id: '2-tall', title: 'B — the photograph reaches the top', note: 'The dark header band is reclaimed as picture. Brand and place name float on the photo with a small gradient behind them. Side margins kept.', css: TALL },
  { id: '3-both', title: 'C — A + B', note: 'Light in the page AND the header band reclaimed. Nothing else changes.', css: GLOW + TALL },
  { id: '4-far', title: 'D — as close to the old full-bleed as the data rule allows', note: 'Edge to edge on three sides, the way home used to run, with the lit page underneath. Data still on solid below the picture. This is the far end of the bracket, not a recommendation.', css: GLOW + FAR },
];

let cur = SCENES.sunny;
function payload() {
  const s = cur.p;
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: s.temp - (i % 4), feelsLikeC: s.temp - 3, rainChance: s.rain, precipMm: s.rain > 50 ? 1.2 : 0,
    windKph: s.wind - (i % 5), windDir: 205, cloudPct: s.cloud, humidity: 70, uv: s.uv, condition: s.key,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: s.hi, lowC: s.lo, rainChance: s.rain, uv: s.uv, windKph: s.wind,
    conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: s.temp, feelsLikeC: s.temp - 3, uv: s.uv, isDay: cur.isDay, windKph: s.wind, rainChance: s.rain,
      cloudPct: s.cloud, conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: s.wind, maxWindKph: s.wind + 18, gustKph: s.wind + 18, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: cur.hour, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: s.key, sourceAgreement: '5/5' } },
  };
}

const canonical = (slot) => {
  const f = path.join(root, 'assets', 'images', 'bg', slot);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(f)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${slot}`);
  return url;
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pn.startsWith('/api/')) {
    const body = pn === '/api/weather' ? payload()
      : pn === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  }
  if (pn.startsWith('/_vercel/')) return res.writeHead(204).end();
  try {
    const f = path.resolve(dist, pn === '/' ? 'index.html' : pn.slice(1));
    return res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(readFileSync(f));
  } catch { return res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

for (const [name, scene] of Object.entries(SCENES)) {
  cur = scene;
  const heroUrl = canonical(scene.slot);
  // The slot's OWN wired anchor, not a constant: a frame that misrepresents the
  // crop the app would produce is worse than no frame (gate-shots.mjs, M7).
  const anchor = HERO_CROP_OFFSETS[`bg/${scene.slot}`] ?? null;
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T${String(scene.hour).padStart(2, '0')}:12:00+02:00`) });
    await page.addInitScript((u) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
        localStorage.setItem('pw_last_bg', u);
      } catch (_) {}
    }, heroUrl);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const s = document.getElementById('pwSplash');
      return !s || s.classList.contains('splash-done');
    }, null, { timeout: 20000 });
    await page.evaluate(({ u, a }) => {
      const s = document.createElement('style');
      s.textContent = `html { --hero-url: url("${u}") !important;${a == null ? '' : ` --hero-crop: ${a}% !important;`} }`;
      document.body.appendChild(s);
    }, { u: heroUrl, a: anchor });
    if (v.css) {
      // Appended to the END of body: index.html links app.css from the body, so
      // a head-injected sheet loses every equal-specificity contest.
      await page.evaluate((css) => {
        const s = document.createElement('style');
        s.textContent = css;
        document.body.appendChild(s);
      }, v.css);
    }
    await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, scene.caption);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${v.id}-${name}.png`) });
    await ctx.close();
  }
}
await browser.close();
server.close();

const html = `<!doctype html><meta charset="utf-8"><title>PW — home: putting the light back</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:26px; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:21px; margin:0 0 6px; }
  .lead { color:#b5ab9d; max-width:78ch; margin:0 0 22px; }
  .row { display:flex; gap:22px; flex-wrap:wrap; align-items:flex-start; }
  figure { margin:0 0 8px; width:250px; }
  img { width:100%; border-radius:8px; display:block; box-shadow:0 10px 26px rgba(0,0,0,.5); }
  h2 { font-size:15px; margin:22px 0 2px; }
  .note { color:#b5ab9d; max-width:74ch; margin:0 0 12px; font-size:12.5px; }
  figcaption { font-size:11px; color:#b5ab9d; margin-top:6px; text-align:center; }
</style>
<h1>Home — putting the light back</h1>
<p class="lead">Mockups, not code: each is the real app with a stylesheet over it. What ships today is the control.
Al, 2026-08-17: <em>"the homesreen still feels a bit dark. To moody almost."</em> The cause is not which black — it is
that the photograph is ~54% of the screen and the rest carries no light at all. Same three scenes throughout, 375&times;812.</p>
${VARIANTS.map((v) => `<h2>${v.title}</h2><p class="note">${v.note}</p><div class="row">
  ${Object.keys(SCENES).map((s) => `<figure><img src="${v.id}-${s}.png" alt="${v.id} ${s}"><figcaption>${s}</figcaption></figure>`).join('')}
</div>`).join('')}
`;
writeFileSync(path.join(out, 'index.html'), html);
console.log(`[mockup] ${VARIANTS.length * Object.keys(SCENES).length} shots → output/mockup-light/index.html`);
