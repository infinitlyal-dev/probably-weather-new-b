// VIBRANCY LOOP — the app is professional and reads too serious.
//
// Al's ruling 2026-08-10: five bounded iterations, one focused change each,
// critiqued against the anchors (desktop postcard at its best, the share card's
// energy, the approved pairs in review/PAIRING-TASTE.md, the old full-bleed
// home's drama without its chaos). Nothing here is written into app.css — each
// iteration is a candidate stylesheet in review/vibrancy/, layered CUMULATIVELY,
// so Al can take an iteration, a prefix of them, or a mix, and the app on disk
// stays exactly what the warmth pass left.
//
//   node scripts/vibrancy-loop.mjs --iter 0        -> baseline shots
//   node scripts/vibrancy-loop.mjs --iter 3        -> iter-1 + iter-2 + iter-3
//   node scripts/vibrancy-loop.mjs --iter 3 --gate -> also run the 72-combo fold
//                                                     matrix on that stack
//   node scripts/vibrancy-loop.mjs --sheet         -> the contact sheet
//
// Output: output/vibrancy/iter-<n>/ and output/vibrancy/index.html
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const cssDir = path.join(root, 'review', 'vibrancy');
const outRoot = path.join(root, 'output', 'vibrancy');
const DATE = '2026-08-08';

const argIdx = process.argv.indexOf('--iter');
const ITER = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 0;
const GATE = process.argv.includes('--gate');
const SHEET_ONLY = process.argv.includes('--sheet');

// ONE viewport, because the loop is about character and not about fit — the fold
// matrix is what asserts fit, on all 18. 390x844 is the brief's frame.
const VP = { w: 390, h: 844 };

// Two photographs, pinned: the app has to be alive in a storm AND on a good day,
// and a treatment that only works on drama is not a treatment.
const SCENES = {
  storm: {
    // People sheltering under a shop canopy with lightning over the parking lot.
    // Chosen by eye over week_1/day/1 (a garden in soft light — filed under storm
    // but not a storm to look at), because a "does it feel alive in a storm"
    // judgement made on a calm photograph is worthless.
    slot: 'storm/week_1/day/3.webp',
    caption: 'Even the bakkies on the N2 pulled over.',
    payload: {
      tempC: 14, low: 11, high: 17, rainChance: 92, cloudPct: 98, uv: 1, wind: 46, gust: 71,
      conditionKey: 'storm', conditionLabel: 'Storm', hour: 15, agreement: '5/5',
    },
  },
  sunny: {
    slot: 'clear/week_1/day/1.webp',
    caption: 'This is why we live in South Africa.',
    payload: {
      tempC: 29, low: 18, high: 31, rainChance: 0, cloudPct: 5, uv: 9, wind: 12, gust: 15,
      conditionKey: 'clear', conditionLabel: 'Clear', hour: 13, agreement: '5/5',
    },
  },
};

function canonicalUrl(slot) {
  const file = path.join(root, 'assets', 'images', 'bg', slot);
  if (!existsSync(file)) throw new Error(`pinned slot missing: ${slot}`);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(file)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${url} — run npm run build`);
  return url;
}

// The iteration stack: 1..n, concatenated in order. A missing file is a hard
// error rather than a silent skip — a "cumulative" sheet with a hole in it would
// make every later shot a lie about what it is showing.
function stack(n) {
  const parts = [];
  for (let i = 1; i <= n; i += 1) {
    const file = path.join(cssDir, `iter-${i}.css`);
    if (!existsSync(file)) throw new Error(`missing iteration stylesheet: review/vibrancy/iter-${i}.css`);
    parts.push(`/* ---- iter-${i} ---- */\n${readFileSync(file, 'utf8')}`);
  }
  return parts.join('\n');
}

function payloadFor(scene) {
  const s = scene.payload;
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: s.tempC - (i % 5), feelsLikeC: s.tempC - 3, rainChance: Math.max(0, s.rainChance - (i % 6) * 9),
    precipMm: s.rainChance > 50 ? 1.4 : 0, windKph: s.wind - (i % 7), windDir: 205,
    cloudPct: s.cloudPct, humidity: 70, uv: s.uv, condition: s.conditionKey,
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: s.high - (d % 3), lowC: s.low + (d % 2), rainChance: Math.max(0, s.rainChance - d * 11),
    uv: s.uv, windKph: s.wind - d, conditionKey: s.conditionKey, conditionLabel: s.conditionLabel,
    sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  const names = ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'];
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: s.tempC, feelsLikeC: s.tempC - 3, uv: s.uv, isDay: true, windKph: s.wind,
      rainChance: s.rainChance, cloudPct: s.cloudPct, conditionKey: s.conditionKey,
      conditionLabel: s.conditionLabel, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: s.wind, maxWindKph: s.gust, gustKph: s.gust, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: s.hour, utcOffsetSeconds: 7200, confidence: 'high',
      sources: names.map((name) => ({ name, ok: true })),
      sourceConditions: names.map((name) => ({ name, condition: s.conditionKey })),
      sourceRanges: names.map((name, i) => ({ name, minTemp: s.low - (i % 3), maxTemp: s.high + (i % 4) })),
      conditionConfidence: { level: 'high', finalCondition: s.conditionKey, sourceAgreement: s.agreement },
    },
  };
}

function startServer(getPayload) {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? getPayload()
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

async function shoot() {
  const candidate = ITER > 0 ? stack(ITER) : '';
  const output = path.join(outRoot, `iter-${ITER}`);
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(outRoot, `cumulative-${ITER}.css`), `${candidate}\n`);

  let current = SCENES.storm;
  const server = await startServer(() => payloadFor(current));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  for (const [name, scene] of Object.entries(SCENES)) {
    current = scene;
    const heroUrl = canonicalUrl(scene.slot);
    for (const screen of ['home', 'hourly']) {
      const ctx = await browser.newContext({
        viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date(`${DATE}T${String(scene.payload.hour).padStart(2, '0')}:12:00+02:00`) });
      await page.addInitScript((pinned) => {
        try {
          localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
          localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
          localStorage.setItem('pw_lang', JSON.stringify('en'));
          localStorage.setItem('pw_last_bg', pinned);
        } catch (_) {}
      }, heroUrl);
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => {
        const s = document.getElementById('pwSplash');
        return !s || s.classList.contains('splash-done');
      }, null, { timeout: 20000 });
      // END of <body>: index.html links app.css from the body, so a head-injected
      // sheet loses every equal-specificity contest.
      await page.evaluate(({ css, url }) => {
        const s = document.createElement('style');
        s.textContent = `html { --hero-url: url("${url}") !important; }\n${css}`;
        document.body.appendChild(s);
      }, { css: candidate, url: heroUrl });
      await page.evaluate((txt) => {
        const h = document.getElementById('headline');
        if (h) h.textContent = txt;
      }, scene.caption);
      // 1400ms, not 400: the caption runs heroFadeInPolaroid (1s, 0.3s delay) and
      // renderHome restarts it when the payload lands. A shot taken mid-fade
      // catches the cream foot at partial opacity and reads GREY — the first run
      // of this loop produced exactly that and it looked like an app bug.
      await page.waitForTimeout(1400);
      if (screen === 'hourly') {
        await page.click('#homeHourly');
        await page.waitForTimeout(500);
      } else {
        // Proof, per shot, that the print is fully painted when the shutter goes.
        const settled = await page.evaluate(() => {
          const h = document.getElementById('headline');
          const cs = getComputedStyle(h);
          return { opacity: cs.opacity, bg: cs.backgroundColor };
        });
        if (settled.opacity !== '1') {
          console.log(`  [warn] caption not settled on ${name}: opacity ${settled.opacity}, bg ${settled.bg}`);
        }
      }
      await page.screenshot({ path: path.join(output, `${screen}-${name}.png`) });
      await ctx.close();
    }
  }

  await browser.close();
  server.close();
  console.log(`[vibrancy] iter-${ITER}: 4 shots → output/vibrancy/iter-${ITER}/`);

  if (GATE) {
    const sheetFile = path.join(outRoot, `cumulative-${ITER}.css`);
    try {
      const out = execFileSync(process.execPath, ['scripts/verify-home-fold.mjs'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, PW_FOLD_CSS: sheetFile, PW_FOLD_LABEL: `vibrancy-${ITER}` },
      });
      console.log(out.trim().split('\n').slice(-1)[0]);
    } catch (err) {
      console.log('[vibrancy] FOLD FAIL:');
      console.log(String(err.stdout || '').trim().split('\n').slice(-6).join('\n'));
      process.exitCode = 1;
    }
  }
}

function sheet() {
  const notes = JSON.parse(readFileSync(path.join(cssDir, 'rationales.json'), 'utf8'));
  const iters = readdirSync(outRoot)
    .filter((d) => /^iter-\d+$/.test(d))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  const html = `<!doctype html><meta charset="utf-8"><title>PW — vibrancy loop</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:26px;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:21px; margin:0 0 6px; }
  .lead { color:#b5ab9d; max-width:70ch; margin:0 0 22px; }
  section { border-top:1px solid rgba(246,242,232,0.14); padding:18px 0 6px; }
  h2 { font-size:15px; margin:0 0 2px; }
  .crit { color:#b5ab9d; max-width:78ch; margin:0 0 4px; }
  .move { color:#ffd700; font-weight:700; margin:0 0 12px; }
  .row { display:flex; gap:14px; flex-wrap:wrap; }
  figure { margin:0; width:200px; }
  img { width:100%; border-radius:7px; display:block; box-shadow:0 8px 20px rgba(0,0,0,.5); }
  figcaption { margin-top:7px; font-size:11px; color:#b5ab9d; }
</style>
<h1>Vibrancy loop — five iterations, one change each</h1>
<p class="lead">Cumulative: each strip includes every change above it. Nothing is in app.css — the candidates live in
<code>review/vibrancy/iter-N.css</code>, so you can take one iteration, a prefix, or a mix. Fold matrix result is printed per strip.</p>
${iters.map((dir) => {
    const n = Number(dir.split('-')[1]);
    const note = notes[String(n)] || {};
    return `<section>
  <h2>${n === 0 ? 'Iteration 0 — baseline (warmth pass as it stands)' : `Iteration ${n} — ${note.title || ''}`}</h2>
  ${note.critique ? `<p class="crit"><b>Critique it answers:</b> ${note.critique}</p>` : ''}
  ${note.move ? `<p class="move">${note.move}</p>` : ''}
  ${note.fold ? `<p class="crit">Fold matrix: ${note.fold}</p>` : ''}
  <div class="row">
    ${['home-storm', 'home-sunny', 'hourly-storm', 'hourly-sunny'].map((f) => `<figure>
      <img src="${dir}/${f}.png" alt="${f}">
      <figcaption>${f.replace('-', ' · ')}</figcaption>
    </figure>`).join('')}
  </div>
</section>`;
  }).join('')}
`;
  writeFileSync(path.join(outRoot, 'index.html'), html);
  console.log(`[vibrancy] contact sheet → output/vibrancy/index.html (${iters.length} strips)`);
}

mkdirSync(outRoot, { recursive: true });
mkdirSync(cssDir, { recursive: true });
if (SHEET_ONLY) sheet();
else await shoot();
