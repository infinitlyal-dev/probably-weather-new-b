// THE INK MAP — one hero per condition, on real set-001 photographs, day and
// night, for Al's ruling.
//
// Renders on the KEPT vibrancy stack (iterations 1-4) plus review/vibrancy/
// ink-map.css, and a second column with review/vibrancy/ink-map-night.css and
// body.tod-night applied. Contrast of every ink on the print stock is measured,
// not asserted, and printed under each frame.
//
// The sheet also carries the outstanding iteration-5 keep/drop comparison, so
// both rulings can be made in one sitting (Al's instruction).
//
//   node scripts/ink-map.mjs
//
// Output: output/ink-map/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'ink-map');
const DATE = '2026-08-08';
const BASE = readFileSync(path.join(root, 'output', 'vibrancy', 'cumulative-4.css'), 'utf8');
const MAP = readFileSync(path.join(root, 'review', 'vibrancy', 'ink-map.css'), 'utf8');
const NIGHT = readFileSync(path.join(root, 'review', 'vibrancy', 'ink-map-night.css'), 'utf8');

const STOCK = '#f6f2e8';
const FAMILIES = {
  wets: { day: '#0b5c68', night: '#0e4349', label: 'petrol' },
  warm: { day: '#a81259', night: '#76123f', label: 'deep pink' },
  mild: { day: '#1c6b3a', night: '#194c2b', label: 'pen green' },
  cold: { day: '#3c2f80', night: '#2e2559', label: 'violet (new)' },
  wind: { day: '#5a3a22', night: '#422c1b', label: 'umber (new)' },
  plain: { day: '#1b1813', night: '#191611', label: 'ink-dark' },
};

// One row per condition. `folder` is the set-001 image folder; `key` is what the
// API returns and what renderHome stamps on the caption. The two alias rows at
// the end have no folder of their own — they borrow the folder their images
// already come from, which is exactly what the app does.
const ROWS = [
  { key: 'clear', folder: 'clear', family: 'mild', temp: 27, hi: 30, lo: 16, rain: 0, cloud: 6, uv: 8, wind: 11 },
  { key: 'cloudy', folder: 'cloudy', family: 'plain', temp: 17, hi: 19, lo: 12, rain: 20, cloud: 85, uv: 3, wind: 18 },
  { key: 'rain', folder: 'rain', family: 'wets', temp: 14, hi: 16, lo: 11, rain: 85, cloud: 95, uv: 1, wind: 24 },
  { key: 'storm', folder: 'storm', family: 'wets', temp: 14, hi: 17, lo: 11, rain: 92, cloud: 98, uv: 1, wind: 46 },
  { key: 'fog', folder: 'fog', family: 'wets', temp: 12, hi: 15, lo: 9, rain: 10, cloud: 92, uv: 1, wind: 6 },
  { key: 'wind', folder: 'wind', family: 'wind', temp: 19, hi: 22, lo: 13, rain: 5, cloud: 35, uv: 5, wind: 52 },
  { key: 'heat', folder: 'heat', family: 'warm', temp: 36, hi: 38, lo: 22, rain: 0, cloud: 3, uv: 11, wind: 9 },
  { key: 'cold', folder: 'cold', family: 'cold', temp: 6, hi: 9, lo: 2, rain: 15, cloud: 70, uv: 1, wind: 14 },
  { key: 'cold-clear', folder: 'cold-clear', family: 'cold', temp: 8, hi: 12, lo: 1, rain: 0, cloud: 8, uv: 3, wind: 10 },
  { key: 'uv', folder: 'clear', family: 'warm', alias: 'no folder — borrows clear', temp: 29, hi: 32, lo: 17, rain: 0, cloud: 4, uv: 11, wind: 8 },
  { key: 'rain-possible', folder: 'cloudy', family: 'wets', alias: 'no folder — borrows cloudy', temp: 16, hi: 18, lo: 11, rain: 45, cloud: 78, uv: 2, wind: 20 },
];

// A real line from the shipped bank per condition, so the sheet is judged on
// copy the app can actually serve.
function bankLine(condition) {
  const src = readFileSync(path.join(root, 'assets', 'copy', 'en.js'), 'utf8');
  const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  const node = bank.witty?.[condition] ?? bank.witty?.clear;
  const lines = [];
  const walk = (n) => {
    if (typeof n === 'string') return lines.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') Object.values(n).forEach(walk);
    return undefined;
  };
  walk(node);
  const mid = lines.filter((l) => l.length > 24 && l.length < 52);
  return (mid.length ? mid : lines)[0] || 'Probably fine.';
}

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

function canonicalUrl(slot) {
  const file = path.join(root, 'assets', 'images', 'bg', slot);
  if (!existsSync(file)) throw new Error(`pinned slot missing: ${slot}`);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(file)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${url} — run npm run build`);
  return url;
}

let current = null;
function payload() {
  const r = current.row; const night = current.night;
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: r.temp - (i % 5), feelsLikeC: r.temp - 3, rainChance: Math.max(0, r.rain - (i % 6) * 9),
    precipMm: r.rain > 50 ? 1.2 : 0, windKph: r.wind - (i % 7), windDir: 205, cloudPct: r.cloud,
    humidity: 70, uv: r.uv, condition: r.key,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: r.hi, lowC: r.lo, rainChance: r.rain, uv: r.uv, windKph: r.wind,
    conditionKey: r.key, conditionLabel: r.key, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: r.temp, feelsLikeC: r.temp - 3, uv: r.uv, isDay: !night, windKph: r.wind, rainChance: r.rain,
      cloudPct: r.cloud, conditionKey: r.key, conditionLabel: r.key,
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily, wind_kph: r.wind, maxWindKph: r.wind + 18, gustKph: r.wind + 18, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: night ? 22 : 13, utcOffsetSeconds: 7200, confidence: 'high',
      sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: r.key, sourceAgreement: '5/5' },
    },
  };
}

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payload()
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
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

mkdirSync(output, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const shots = [];

for (const row of ROWS) {
  const caption = bankLine(row.key === 'rain-possible' ? 'rain' : row.key === 'uv' ? 'clear' : row.key);
  for (const night of [false, true]) {
    current = { row, night };
    const slot = `${row.folder}/week_1/${night ? 'night' : 'day'}/1.webp`;
    const heroUrl = canonicalUrl(slot);
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${DATE}T${night ? '22' : '13'}:12:00+02:00`) });
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
    await page.evaluate(({ css, url, isNight }) => {
      const s = document.createElement('style');
      s.textContent = `html { --hero-url: url("${url}") !important; }\n${css}`;
      document.body.appendChild(s);
      // The night hook the app does not set yet — one line in renderHome, see
      // the review note. Applied here so the option can be judged.
      if (isNight) document.body.classList.add('tod-night');
    }, { css: `${BASE}\n${MAP}\n${night ? NIGHT : ''}`, url: heroUrl, isNight: night });
    await page.evaluate((txt) => { document.getElementById('headline').textContent = txt; }, caption);
    await page.waitForTimeout(1400);
    // Proof the right ink landed on the right condition: read the computed
    // colour back rather than trusting the selector.
    const painted = await page.evaluate(() => {
      const h = document.getElementById('headline');
      return { color: getComputedStyle(h).color, classes: h.className };
    });
    const file = `${row.key}-${night ? 'night' : 'day'}.png`;
    await page.screenshot({ path: path.join(output, file) });
    await ctx.close();
    shots.push({ row, night, file, painted, caption });
    console.log(`[ink-map] ${row.key.padEnd(14)} ${night ? 'night' : 'day  '} → ${painted.color}  (${painted.classes.split(' ').filter((c) => c.startsWith('hero-')).join(',') || 'no hero class'})`);
  }
}

await browser.close();
server.close();

// The iteration-5 keep/drop frames ride along in the same review.
for (const f of ['home-storm.png', 'home-sunny.png']) {
  try { copyFileSync(path.join(root, 'output', 'vibrancy', 'iter-5', f), path.join(output, `iter5-${f}`)); } catch (_) {}
  try { copyFileSync(path.join(root, 'output', 'vibrancy', 'iter-4', f), path.join(output, `iter4-${f}`)); } catch (_) {}
}

const rowHtml = (row) => {
  const fam = FAMILIES[row.family];
  const day = shots.find((s) => s.row.key === row.key && !s.night);
  const night = shots.find((s) => s.row.key === row.key && s.night);
  // The night frame is whatever the APP emits at 22:00, not what this script
  // asked for. Where those differ, say so — for uv they differ because the UV
  // branch requires isDay, so the app cannot emit uv after dark at all. That is
  // the map working, not slipping, and the sheet has to make the difference
  // legible or it reads as a bug.
  const heroOf = (s) => (s.painted.classes.split(' ').find((c) => c.startsWith('hero-') && c !== 'hero-caption') || '—');
  const drift = heroOf(day) !== heroOf(night)
    ? `<p class="fam">Night frame renders <b>${heroOf(night)}</b>, not ${heroOf(day)}: the app cannot emit <b>${row.key}</b> after dark, so this is the ink you would really see at 22:00.</p>`
    : '';
  return `<section>
  <h2>${row.key}${row.alias ? ` <span class="alias">(${row.alias})</span>` : ''}</h2>
  <p class="fam"><span class="sw" style="background:${fam.day}"></span><b>${fam.label}</b>
     ${fam.day} · ${ratio(fam.day, STOCK).toFixed(1)}:1 on the stock
     &nbsp;→ night <span class="sw" style="background:${fam.night}"></span>${fam.night} · ${ratio(fam.night, STOCK).toFixed(1)}:1</p>
  ${drift}
  <div class="row">
    <figure><img src="${day.file}" alt="${row.key} day"><figcaption>day · flat map<br><span class="m">${day.painted.color}</span></figcaption></figure>
    <figure><img src="${night.file}" alt="${row.key} night"><figcaption>night · deepened one step<br><span class="m">${night.painted.color}</span></figcaption></figure>
  </div>
  <p class="cap">“${day.caption}”</p>
</section>`;
};

const html = `<!doctype html><meta charset="utf-8"><title>PW — the ink map</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:26px;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:22px; margin:0 0 6px; }
  .lead { color:#b5ab9d; max-width:78ch; }
  table { border-collapse:collapse; margin:14px 0 26px; font-size:13px; }
  th, td { text-align:left; padding:5px 14px 5px 0; border-bottom:1px solid rgba(246,242,232,0.12); }
  th { color:#b5ab9d; font-weight:600; }
  section { border-top:1px solid rgba(246,242,232,0.14); padding:16px 0 4px; }
  h2 { font-size:16px; margin:0 0 4px; }
  .alias { color:#b5ab9d; font-size:12px; font-weight:400; }
  .fam { color:#b5ab9d; margin:0 0 10px; font-size:12.5px; }
  .cap { color:#b5ab9d; font-size:12.5px; margin:8px 0 0; }
  .row { display:flex; gap:14px; flex-wrap:wrap; }
  figure { margin:0; width:210px; }
  img { width:100%; border-radius:7px; display:block; box-shadow:0 8px 20px rgba(0,0,0,.5); }
  figcaption { margin-top:7px; font-size:11px; color:#b5ab9d; }
  .m { color:#fffaf3; font-variant-numeric:tabular-nums; }
  .sw { display:inline-block; width:11px; height:11px; border-radius:2px; vertical-align:-1px; margin-right:5px; }
  b { color:#fffaf3; }
</style>
<h1>The ink map — one marker per condition</h1>
<p class="lead">Six inks over thirteen condition keys, on real set-001 photographs, day and night, rendered on the kept vibrancy stack (iterations 1–4).
Every ratio below is measured against the print stock #f6f2e8. Nothing is in app.css.</p>

<table>
  <tr><th>Family</th><th>Ink</th><th>Day</th><th>On stock</th><th>Night step</th><th>On stock</th><th>Conditions</th></tr>
  <tr><td>wets</td><td>petrol</td><td>${FAMILIES.wets.day}</td><td>${ratio(FAMILIES.wets.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.wets.night}</td><td>${ratio(FAMILIES.wets.night, STOCK).toFixed(1)}:1</td><td>rain · rain-possible · storm · thunder · hail · fog</td></tr>
  <tr><td>warm</td><td>deep pink</td><td>${FAMILIES.warm.day}</td><td>${ratio(FAMILIES.warm.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.warm.night}</td><td>${ratio(FAMILIES.warm.night, STOCK).toFixed(1)}:1</td><td>heat · uv</td></tr>
  <tr><td>mild</td><td>pen green</td><td>${FAMILIES.mild.day}</td><td>${ratio(FAMILIES.mild.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.mild.night}</td><td>${ratio(FAMILIES.mild.night, STOCK).toFixed(1)}:1</td><td>clear</td></tr>
  <tr><td>cold</td><td>violet <i>(new)</i></td><td>${FAMILIES.cold.day}</td><td>${ratio(FAMILIES.cold.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.cold.night}</td><td>${ratio(FAMILIES.cold.night, STOCK).toFixed(1)}:1</td><td>cold · cold-clear</td></tr>
  <tr><td>wind</td><td>umber <i>(new)</i></td><td>${FAMILIES.wind.day}</td><td>${ratio(FAMILIES.wind.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.wind.night}</td><td>${ratio(FAMILIES.wind.night, STOCK).toFixed(1)}:1</td><td>wind</td></tr>
  <tr><td>default</td><td>ink-dark</td><td>${FAMILIES.plain.day}</td><td>${ratio(FAMILIES.plain.day, STOCK).toFixed(1)}:1</td><td>${FAMILIES.plain.night}</td><td>${ratio(FAMILIES.plain.night, STOCK).toFixed(1)}:1</td><td>cloudy</td></tr>
</table>

<section>
  <h2>Still open — iteration 5, keep or drop</h2>
  <p class="fam">Left: the kept stack (1–4) with M9's gold pin. Right: iteration 5, re-shot clean — tape off the header, warm, rain quietened. Dropping 5 restores the pin on its own.</p>
  <div class="row">
    <figure><img src="iter4-home-storm.png" alt="1-4 storm"><figcaption>1–4 · pin</figcaption></figure>
    <figure><img src="iter5-home-storm.png" alt="1-5 storm"><figcaption>1–5 · tape</figcaption></figure>
    <figure><img src="iter4-home-sunny.png" alt="1-4 sunny"><figcaption>1–4 · pin</figcaption></figure>
    <figure><img src="iter5-home-sunny.png" alt="1-5 sunny"><figcaption>1–5 · tape</figcaption></figure>
  </div>
</section>

${ROWS.map(rowHtml).join('')}
`;
writeFileSync(path.join(output, 'index.html'), html);
console.log(`\n[ink-map] ${shots.length} shots + sheet → output/ink-map/index.html`);
for (const [name, f] of Object.entries(FAMILIES)) {
  console.log(`  ${name.padEnd(8)} ${f.day} ${ratio(f.day, STOCK).toFixed(2)}:1   night ${f.night} ${ratio(f.night, STOCK).toFixed(2)}:1`);
}
