// The 7 Oct sets as Al's phone shows them (8 Oct 2026): every photograph on the built Home D at 414x715 (iPhone 11 +
// Chrome), with its own line (Maat's, review/new-sets-lines-maat-2026-10-07.json), its set's weather on the title card,
// its time of day, and the face anchor scripts/anchor-faces.mjs chose (review/new-sets-crop-2026-10-08.json).
// One contact sheet per set, for Al to rule keep / cut by filename.
//
//   npm run build && node scripts/new-sets-phone-sheets.mjs
//   node scripts/new-sets-phone-sheets.mjs --reframes   the library reframes of 8 Oct 2026, one sheet, from the built grid
//                                                      (each photograph with its first line, its folder's weather)
//   node scripts/new-sets-phone-sheets.mjs --landmarks  the landmark-creep re-takes (review/landmark-creep-2026-10-08/<hash>.png),
//                                                      one sheet, with the line and anchor the live photograph has
//   node scripts/new-sets-phone-sheets.mjs --takes faceless-2026-10-09   any folder of takes named by the hash they replace
//                                                      (the live one, or the one a reframe replaced): one sheet, phone/<folder>.jpg
// Output: review/new-sets-phone-2026-10-08/{partly-cloudy,breezy,cloudy}.jpg (+ one render per photograph)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, ...p);
const OUT = R('review', 'new-sets-phone-2026-10-08');
const VP = { w: 414, h: 715 };
const maat = JSON.parse(readFileSync(R('review', 'new-sets-lines-maat-2026-10-07.json'), 'utf8')).lines;
const crops = existsSync(R('review', 'new-sets-crop-2026-10-08.json')) ? JSON.parse(readFileSync(R('review', 'new-sets-crop-2026-10-08.json'), 'utf8')).anchors : {};
const qcPath = R('review', 'new-sets-qc-2026-10-08.json');
const qc = existsSync(qcPath) ? JSON.parse(readFileSync(qcPath, 'utf8')).verdicts || {} : {};

// The set's weather on the title card, the time of day from the slot.
const WEATHER = {
  'partly-cloudy': { key: 'clear', label: 'Partly cloudy', tempC: 22, cloudPct: 45, windKph: 12 },
  breezy: { key: 'breezy', label: 'Breezy', tempC: 20, cloudPct: 20, windKph: 22 },
  cloudy: { key: 'cloudy', label: 'Cloudy', tempC: 16, cloudPct: 95, windKph: 8 },
  clear: { key: 'clear', label: 'Clear', tempC: 24, cloudPct: 5, windKph: 10 },
  cold: { key: 'cold', label: 'Cold', tempC: 9, cloudPct: 80, windKph: 12 },
  'cold-clear': { key: 'cold-clear', label: 'Cold and clear', tempC: 7, cloudPct: 5, windKph: 6 },
  fog: { key: 'fog', label: 'Fog', tempC: 13, cloudPct: 100, windKph: 4 },
  heat: { key: 'heat', label: 'Hot', tempC: 33, cloudPct: 5, windKph: 8 },
  rain: { key: 'rain', label: 'Rain', tempC: 14, cloudPct: 100, windKph: 18 },
  storm: { key: 'storm', label: 'Storm', tempC: 16, cloudPct: 100, windKph: 35 },
  wind: { key: 'wind', label: 'Windy', tempC: 18, cloudPct: 30, windKph: 45 },
};
const TAKES = process.argv.includes('--takes') ? process.argv[process.argv.indexOf('--takes') + 1] : null;
const LANDMARKS = process.argv.includes('--landmarks') || !!TAKES;
const REFRAMES = process.argv.includes('--reframes') || LANDMARKS;
const LANDMARK_DIR = TAKES ? `review/${TAKES}` : 'review/landmark-creep-2026-10-08';
const HOUR = { dawn: 7, day: 13, dusk: 18, night: 22 };
let now = { set: 'cloudy', time: 'day' };
function payload() {
  const w = WEATHER[now.set]; const hour = HOUR[now.time]; const night = now.time === 'night';
  const t = w.tempC - (night ? 5 : now.time === 'dawn' ? 4 : 0);
  const DAY = '2026-10-08';
  const hourly = Array.from({ length: 48 }, (_, i) => ({ tempC: t - (i % 5), feelsLikeC: t - 2, rainChance: 10, precipMm: 0, windKph: w.windKph,
    windDir: 205, cloudPct: w.cloudPct, humidity: 60, uv: night ? 0 : 5, condition: w.key }));
  const daily = Array.from({ length: 7 }, () => ({ highC: w.tempC + 3, lowC: w.tempC - 7, rainChance: 10, uv: 6, windKph: w.windKph + 4,
    conditionKey: w.key, conditionLabel: w.label, sunrise: `${DAY}T06:10`, sunset: `${DAY}T19:05` }));
  return { ok: true, location: { name: 'Strand, Western Cape', lat: -34.11, lon: 18.83 },
    now: { tempC: t, feelsLikeC: t - 2, uv: night ? 0 : 5, isDay: !night, windKph: w.windKph, rainChance: 10, cloudPct: w.cloudPct,
      conditionKey: w.key, conditionLabel: w.label, sunrise: `${DAY}T06:10`, sunset: `${DAY}T19:05` },
    hourly, daily, wind_kph: w.windKph, maxWindKph: w.windKph + 8, gustKph: w.windKph + 12, windDir: 205, consensus: { confidenceKey: 'decent' },
    meta: { schema: 5, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [], conditionConfidence: { level: 'high', finalCondition: w.key, sourceAgreement: '4/5' } } };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pathname.startsWith('/api/')) {
    const body = pathname === '/api/weather' ? payload() : pathname === '/api/locate' ? { ok: true, lat: -34.11, lon: 18.83, name: 'Strand, Western Cape' } : {};
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  }
  if (pathname.startsWith('/_vercel/')) return res.writeHead(204).end();
  const base = pathname.startsWith('/review/') || pathname.startsWith('/assets/images/bg/') ? root : R('dist');
  const file = path.resolve(base, pathname === '/' ? 'index.html' : pathname.slice(1));
  let buf; try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

const ORDER = ['dawn', 'day', 'dusk', 'night'];
// --reframes: one "set" of the reframed library photographs, read from the grid (their first line, their own anchor).
let reframeItems = null;
if (REFRAMES) {
  const { HERO_LINES } = await import(new URL('../assets/hero-lines.js', import.meta.url).href);
  const { heroCropFor } = await import(new URL('../assets/hero-crop.js', import.meta.url).href);
  const fin = JSON.parse(readFileSync(R('review', 'set-001-lines-bespoke-final.json'), 'utf8'));
  // From the grid record (review/set-001-draft.json), so a photograph with no bespoke line (it serves the condition bank)
  // is on the sheet too, with a bank line of its condition.
  const { WEATHER_COPY } = await import(new URL('../assets/weather-copy.js', import.meta.url).href);
  const draft = JSON.parse(readFileSync(R('review', 'set-001-draft.json'), 'utf8'));
  const seen = new Set();
  const retaken = LANDMARKS ? new Set(readdirSync(R(LANDMARK_DIR)).filter((f) => /^[0-9a-f]{12}\.png$/.test(f)).map((f) => f.slice(0, 12))) : null;
  const takeOf = (a) => (TAKES && retaken.has(a.hash) ? a.hash : a.replacedHash);
  reframeItems = draft.assignments.filter((a) => (TAKES || /library-reframe-2026-10-08/.test(a.source || '')) && !seen.has(a.hash) && seen.add(a.hash))
    .filter((a) => !retaken || retaken.has(takeOf(a))).map((a) => {
    const [cond, , time] = a.image.split('/');
    const bank = WEATHER_COPY.witty?.[cond]?.en || [];
    const line = (HERO_LINES[`bg/${a.image}`] || [])[0] || bank[0] || fin.set.find((e) => e.hash === a.hash)?.lines?.[0] || '';
    const url = retaken ? `/${LANDMARK_DIR}/${takeOf(a)}.png` : `/assets/images/bg/${a.image}`;
    return { rel: `${a.image} · ${takeOf(a)}`, url, set: cond, time, line, crop: heroCropFor(`assets/images/bg/${a.image}`) };
  }).sort((a, b) => a.set.localeCompare(b.set) || ORDER.indexOf(a.time) - ORDER.indexOf(b.time));
}
const SHEET_DIR = LANDMARKS ? R(LANDMARK_DIR, 'phone') : OUT;
mkdirSync(SHEET_DIR, { recursive: true });
for (const set of TAKES ? [TAKES] : LANDMARKS ? ['landmark-replacements'] : REFRAMES ? ['library-reframes'] : ['partly-cloudy', 'breezy', 'cloudy']) {
  const files = REFRAMES ? reframeItems.map((x) => x.rel) : readdirSync(R('review', 'new-sets-2026-10-07', set)).filter((f) => /^(dawn|day|dusk|night)-[1-7](-weekB)?\.png$/.test(f))
    .sort((a, b) => ORDER.indexOf(a.split('-')[0]) - ORDER.indexOf(b.split('-')[0]) || a.localeCompare(b, undefined, { numeric: true }));
  const shots = [];
  for (const f of files) {
    const item = REFRAMES ? reframeItems.find((x) => x.rel === f) : null;
    const rel = item ? item.rel : `${set}/${f}`;
    now = item ? { set: item.set, time: item.time } : { set, time: f.split('-')[0] };
    // A fresh page per photograph: the payload (weather, hour) is read at load, and the joke is written once.
    const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pw_home', JSON.stringify({ name: 'Strand, Western Cape', lat: -34.11, lon: 18.83, mode: 'gps' }));
        localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
        localStorage.setItem('lang', JSON.stringify('en')); localStorage.setItem('pw_lang', JSON.stringify('en'));
      } catch (_) {}
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
    const crop = item ? item.crop : crops[rel]?.anchorY ?? null;
    await page.evaluate(async ({ url, line, crop }) => {
      const root = document.documentElement; const img = document.getElementById('bgImg');
      img.onload = null; img.onerror = null;
      await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url; });
      root.style.setProperty('--hero-url', `url("${url}")`);
      if (crop == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${crop}%`);
      document.getElementById('headline').textContent = line;
    }, item ? { url: item.url, line: item.line, crop } : { url: `/review/new-sets-2026-10-07/${rel}`, line: maat[rel].en, crop });
    await page.waitForFunction(() => {
      const h = document.getElementById('headline');
      return h.style.opacity === '1' && !h.style.getPropertyValue('mask-image') && !h.style.getPropertyValue('-webkit-mask-image')
        && document.getElementById('dScrim')?.classList.contains('is-on');
    }, null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(300);
    const file = path.join(SHEET_DIR, item ? `reframe-${f.split(' · ')[1]}.jpg` : `${set}-${f.replace('.png', '.jpg')}`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
    await ctx.close();
    shots.push({ file, label: item ? f.split(' · ')[0].replace('/week_', ' w').replace('.webp', '') : rel, verdict: item ? f.split(' · ')[1] : qc[rel] || '' });
  }
  const TW = 276, TH = 477, PAD = 12, LAB = 22, cols = 7;
  const rows = Math.ceil(shots.length / cols);
  const W = cols * (TW + PAD) + PAD, H = rows * (TH + LAB + PAD) + PAD + 44;
  const comps = [{ input: Buffer.from(`<svg width="${W}" height="44"><text x="${PAD}" y="30" font-family="Segoe UI, Arial" font-size="20" font-weight="700" fill="#fffaf3">${set} — ${shots.length} photographs as the phone shows them (414x715, English), each with its own line. Rule by filename.</text></svg>`), left: 0, top: 0 }];
  for (let i = 0; i < shots.length; i++) {
    const x = PAD + (i % cols) * (TW + PAD), y = 44 + Math.floor(i / cols) * (TH + LAB + PAD);
    comps.push({ input: await sharp(shots[i].file).resize(TW, TH).toBuffer(), left: x, top: y });
    comps.push({ input: Buffer.from(`<svg width="${TW}" height="${LAB}"><text x="0" y="16" font-family="Segoe UI, Arial" font-size="14" fill="#ffd700">${shots[i].label}</text><text x="${TW}" y="16" text-anchor="end" font-family="Segoe UI, Arial" font-size="13" fill="#b5ab9d">${shots[i].verdict}</text></svg>`), left: x, top: y + TH + 2 });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#14110d' } }).composite(comps).jpeg({ quality: 86 }).toFile(path.join(SHEET_DIR, `${set}.jpg`));
  console.log(`${set}: ${shots.length} -> ${path.relative(root, path.join(SHEET_DIR, `${set}.jpg`))}`);
}
await browser.close();
server.close();
