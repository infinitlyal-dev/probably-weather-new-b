// HOME MOCKUPS — the picture gets big, the joke gets on it, the number steps back.
//
// Al, 2026-08-14: "it doesnt feel like it still has a sense of humour... the
// images dont pop and the humour feels like a weird byline."
//
// Diagnosis these mock up: the joke sits UNDER the photograph in its own cream
// strip, which is a caption, and a caption is a servant of the picture. The
// share card already solves it — type ON the photograph, photograph filling the
// frame — and the app copied its wordmark but not its composition.
//
// MOCKUPS, NOT CODE. Nothing here is written into the app: each variant is a
// stylesheet plus a small DOM move, applied to the real running app with real
// data, then screenshotted. The polaroid stays live until Al picks.
//
//   node scripts/mockup-home-meme.mjs
// Output: output/mockup-meme/index.html
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const out = path.join(root, 'output', 'mockup-meme');
const DATE = '2026-08-14';
mkdirSync(out, { recursive: true });

const SCENES = {
  storm: {
    slot: 'storm/week_1/day/3.webp',
    caption: 'Even the bakkies on the N2 pulled over.',
    p: { temp: 14, hi: 17, lo: 11, rain: 92, cloud: 98, uv: 1, wind: 46, key: 'storm', label: 'Storms rolling in.' },
  },
  sunny: {
    slot: 'clear/week_1/day/1.webp',
    caption: 'This is why we live in South Africa.',
    p: { temp: 29, hi: 31, lo: 18, rain: 0, cloud: 5, uv: 9, wind: 12, key: 'clear', label: 'Clear skies.' },
  },
};

// ---- the three directions -------------------------------------------------
// Shared: the cream frame, the tape, the pin and the tilt all go. They are what
// make the photograph a small safe object on a page.
const UNFRAME = `
  .hero-card {
    background: none !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    transform: none !important;
    margin: 6px 12px 0 !important;
    box-shadow: 0 22px 54px rgba(0,0,0,.55) !important;
  }
  .hero-card::before, .hero-card::after { display: none !important; }
  /* Border off only. NOT height:100% — the photo is a flex child that already
     fills the card, and forcing a percentage height collapsed it to nothing:
     the first render showed the wash straight through an empty card. */
  .hero-photo { border: 0 !important; }
`;
// Moving the caption out of main#home-screen drops every rule that styles it —
// including the handwriting, which is scoped to its old parent. Restated here
// or the joke renders in the system sans, which is the opposite of the point.
const HAND = `
  #headline {
    font-family: 'Caveat Prototype', 'Segoe Print', 'Bradley Hand', cursive !important;
    font-weight: 700 !important;
  }
`;
// The number stops shouting. It is still the biggest DATA on the screen, it is
// just no longer the biggest THING.
const QUIET_NUMBER = `
  .temp { font-size: 1.95rem !important; letter-spacing: -0.02em !important; }
  .temp .hero-probably { font-size: 0.62em !important; margin-bottom: -0.02em !important; }
  #home-screen #description { font-size: 1.02rem !important; margin-top: 4px !important; }
`;

const VARIANTS = [
  {
    id: '0-live',
    title: 'Live today — polaroid, joke on the cream foot',
    note: 'The control. The joke is a caption under the picture.',
    css: '', move: 'none',
  },
  {
    id: '1-meme',
    title: 'A — joke ON the photograph',
    note: 'Frame off, picture takes the room the cream strip was using, line sits in the bottom of the photo over a soft darkening. One object, one glance — a meme.',
    move: 'into-card',
    css: `${UNFRAME}${QUIET_NUMBER}${HAND}
      main#home-screen.main > .hero-caption, #headline {
        position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
        margin: 0 !important; padding: 72px 18px 20px !important;
        background: linear-gradient(to top, rgba(0,0,0,.80) 0%, rgba(0,0,0,.58) 42%, rgba(0,0,0,0) 100%) !important;
        color: #ffffff !important; text-align: left !important;
        font-size: 2.1rem !important; line-height: 1.06 !important;
        text-shadow: 0 2px 16px rgba(0,0,0,.65) !important;
        transform: none !important; animation: none !important; box-shadow: none !important;
        border-radius: 0 !important;
      }`,
  },
  {
    id: '2-setup',
    title: 'B — joke first, photograph as the punchline',
    note: 'Line big at the top on the dark page, picture underneath. You read the setup, then see the payoff — the way the best pairs in PAIRING-TASTE already work.',
    move: 'none',
    css: `${UNFRAME}${QUIET_NUMBER}${HAND}
      main#home-screen.main > .hero-caption {
        order: -1 !important;
        background: none !important; box-shadow: none !important;
        color: #fffaf3 !important; text-align: left !important;
        font-size: 2.05rem !important; line-height: 1.08 !important;
        padding: 2px 4px 10px !important; margin: 0 0 2px !important;
        transform: none !important; animation: none !important;
        text-shadow: 0 2px 12px rgba(0,0,0,.35) !important;
      }`,
  },
  {
    id: '3-poster',
    title: 'C — full bleed, the photograph IS the room',
    note: 'The old drama without the old chaos: picture edge to edge, joke over it, every number in one dark cluster at the bottom instead of scattered across the picture.',
    move: 'into-body',
    css: `${QUIET_NUMBER}${HAND}
      #bgImg { opacity: 1 !important; object-fit: cover !important; }
      #bg::after, #bg::before { display: none !important; }
      #bg { background: none !important; }
      .hero-card { display: none !important; }
      body { background: none !important; }
      main#home-screen.main {
        padding-top: 46vh !important;
        background: linear-gradient(to bottom, rgba(20,17,13,0) 0%, rgba(20,17,13,.74) 16%, rgba(20,17,13,.93) 34%, rgba(20,17,13,.97) 100%) !important;
      }
      #headline {
        position: fixed !important; left: 16px !important; right: 16px !important; top: 30vh !important;
        margin: 0 !important; padding: 0 !important; background: none !important; box-shadow: none !important;
        color: #ffffff !important; text-align: left !important;
        font-size: 2.15rem !important; line-height: 1.06 !important;
        text-shadow: 0 3px 18px rgba(0,0,0,.85), 0 1px 3px rgba(0,0,0,.9) !important;
        /* opacity and z-index stated: killing the entrance animation left the
           line at the animation's starting opacity, and main's gradient was
           painting over it. The first render of this variant was unreadable. */
        opacity: 1 !important; z-index: 50 !important;
        transform: none !important; animation: none !important;
      }`,
  },
];

function payload(s) {
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
    now: { tempC: s.temp, feelsLikeC: s.temp - 3, uv: s.uv, isDay: true, windKph: s.wind, rainChance: s.rain,
      cloudPct: s.cloud, conditionKey: s.key, conditionLabel: s.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: s.wind, maxWindKph: s.wind + 18, gustKph: s.wind + 18, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: 13, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: s.key, sourceAgreement: '5/5' } },
  };
}

const canonical = (slot) => {
  const f = path.join(root, 'assets', 'images', 'bg', slot);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(f)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${slot}`);
  return url;
};

let cur = SCENES.storm;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pn.startsWith('/api/')) {
    const body = pn === '/api/weather' ? payload(cur.p) : pn === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
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
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T13:12:00+02:00`) });
    await page.addInitScript((u) => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('pw_lang', JSON.stringify('en'));
        localStorage.setItem('pw_last_bg', u);
      } catch (_) {}
    }, heroUrl);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
    await page.evaluate(({ u }) => {
      const s = document.createElement('style');
      s.textContent = `html { --hero-url: url("${u}") !important; }`;
      document.body.appendChild(s);
    }, { u: heroUrl });
    // The DOM move: the caption can only sit ON the photograph if it lives
    // inside the card. Done here rather than in the app because it would blank
    // the desktop postcard, which shares that node.
    await page.evaluate(({ move, u }) => {
      const h = document.getElementById('headline');
      if (move === 'into-card') document.getElementById('heroCard').appendChild(h);
      if (move === 'into-body') {
        document.body.appendChild(h);
        // Full bleed paints from #bgImg, NOT from --hero-url. Pinning only the
        // custom property left this variant showing whatever the picker chose,
        // so the three mockups were being judged on two different photographs.
        const img = document.getElementById('bgImg');
        if (img) { img.onerror = null; img.src = u; }
      }
    }, { move: v.move, u: heroUrl });
    await page.evaluate((css) => {
      const s = document.createElement('style');
      s.textContent = css;
      document.body.appendChild(s);
    }, v.css);
    await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, scene.caption);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${v.id}-${name}.png`) });
    await ctx.close();
  }
}
await browser.close();
server.close();

const html = `<!doctype html><meta charset="utf-8"><title>PW — home mockups: make the joke the point</title>
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
<h1>Home — making the joke the point</h1>
<p class="lead">Mockups, not code: each is the real app with a stylesheet over it. The polaroid is still what ships.
The diagnosis they answer — the line sits <em>under</em> the picture in its own strip, which makes it a caption, and a
caption is a servant of the photo. Same two photographs, same two lines, 375×812.</p>
${VARIANTS.map((v) => `<h2>${v.title}</h2><p class="note">${v.note}</p><div class="row">
  ${Object.keys(SCENES).map((s) => `<figure><img src="${v.id}-${s}.png" alt="${v.id} ${s}"><figcaption>${s}</figcaption></figure>`).join('')}
</div>`).join('')}
`;
writeFileSync(path.join(out, 'index.html'), html);
console.log(`[mockup] ${VARIANTS.length * Object.keys(SCENES).length} shots → output/mockup-meme/index.html`);
