// The 7 Oct sets as Al's phone shows them (8 Oct 2026): every photograph on the built Home D at 414x715 (iPhone 11 +
// Chrome), with its own line (Maat's, review/new-sets-lines-maat-2026-10-07.json), its set's weather on the title card,
// its time of day, and the face anchor scripts/anchor-faces.mjs chose (review/new-sets-crop-2026-10-08.json).
// One contact sheet per set, for Al to rule keep / cut by filename.
//
//   npm run build && node scripts/new-sets-phone-sheets.mjs
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
};
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
  const base = pathname.startsWith('/review/') ? root : R('dist');
  const file = path.resolve(base, pathname === '/' ? 'index.html' : pathname.slice(1));
  let buf; try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

const ORDER = ['dawn', 'day', 'dusk', 'night'];
for (const set of ['partly-cloudy', 'breezy', 'cloudy']) {
  const files = readdirSync(R('review', 'new-sets-2026-10-07', set)).filter((f) => /^(dawn|day|dusk|night)-[1-7](-weekB)?\.png$/.test(f))
    .sort((a, b) => ORDER.indexOf(a.split('-')[0]) - ORDER.indexOf(b.split('-')[0]) || a.localeCompare(b, undefined, { numeric: true }));
  const shots = [];
  for (const f of files) {
    const rel = `${set}/${f}`;
    now = { set, time: f.split('-')[0] };
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
    const crop = crops[rel]?.anchorY ?? null;
    await page.evaluate(async ({ url, line, crop }) => {
      const root = document.documentElement; const img = document.getElementById('bgImg');
      img.onload = null; img.onerror = null;
      await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url; });
      root.style.setProperty('--hero-url', `url("${url}")`);
      if (crop == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${crop}%`);
      document.getElementById('headline').textContent = line;
    }, { url: `/review/new-sets-2026-10-07/${rel}`, line: maat[rel].en, crop });
    await page.waitForFunction(() => {
      const h = document.getElementById('headline');
      return h.style.opacity === '1' && !h.style.getPropertyValue('mask-image') && !h.style.getPropertyValue('-webkit-mask-image')
        && document.getElementById('dScrim')?.classList.contains('is-on');
    }, null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${set}-${f.replace('.png', '.jpg')}`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
    await ctx.close();
    shots.push({ file, label: rel, verdict: qc[rel] || '' });
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
  await sharp({ create: { width: W, height: H, channels: 3, background: '#14110d' } }).composite(comps).jpeg({ quality: 86 }).toFile(path.join(OUT, `${set}.jpg`));
  console.log(`${set}: ${shots.length} -> review/new-sets-phone-2026-10-08/${set}.jpg`);
}
await browser.close();
server.close();
