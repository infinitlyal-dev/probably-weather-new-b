// GATE SHOTS — four conditions, day and night, on the ingested library.
//
// Wherever the condition/time has a photograph Al replaced on 2026-08-14, the
// hero is pinned to it, so the gate is judging the NEW pictures rather than
// whatever the picker happened to choose. Frames are labelled accordingly.
//
//   node scripts/gate-shots.mjs
// Output: output/gate-2026-08-14/
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HERO_CROP_OFFSETS } from '../assets/hero-crop.js';
import { HERO_LINES } from '../assets/hero-lines.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const out = path.join(root, 'output', 'gate-2026-08-14');
const DATE = '2026-08-14';
mkdirSync(out, { recursive: true });

const report = JSON.parse(readFileSync(path.join(root, 'review', 'ingest-2026-08-14-report.json'), 'utf8'));
const replacedSlots = new Set(report.flatMap((r) => r.slots));
const pickSlot = (condition, time) => {
  const replaced = [...replacedSlots].find((s) => s.startsWith(`${condition}/`) && s.includes(`/${time}/`));
  if (replaced) return { slot: replaced, isNew: true };
  return { slot: `${condition}/week_1/${time}/1.webp`, isNew: false };
};

const CONDITIONS = [
  { key: 'storm', label: 'Storm', temp: 14, hi: 17, lo: 11, rain: 92, cloud: 98, uv: 1, wind: 46 },
  { key: 'rain', label: 'Rain', temp: 15, hi: 17, lo: 12, rain: 85, cloud: 95, uv: 1, wind: 24 },
  { key: 'wind', label: 'Wind', temp: 19, hi: 22, lo: 13, rain: 5, cloud: 35, uv: 5, wind: 52 },
  { key: 'heat', label: 'Heat', temp: 36, hi: 38, lo: 22, rain: 0, cloud: 3, uv: 11, wind: 9 },
];
const VIEWPORTS = [{ w: 320, h: 488, n: 'smallest' }, { w: 375, h: 812, n: 'alphone' }, { w: 390, h: 844, n: 'iphone14' }];

const canonical = (slot) => {
  const f = path.join(root, 'assets', 'images', 'bg', slot);
  if (!existsSync(f)) throw new Error(`missing slot ${slot}`);
  const url = `/assets/images/bg-canonical/${createHash('sha256').update(readFileSync(f)).digest('hex')}.webp`;
  if (!existsSync(path.join(dist, url.slice(1)))) throw new Error(`not in build: ${slot}`);
  return url;
};

let cur = null;
function payload() {
  const c = cur.c; const night = cur.night;
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: c.temp - (i % 4), feelsLikeC: c.temp - 3, rainChance: c.rain, precipMm: c.rain > 50 ? 1.2 : 0,
    windKph: c.wind - (i % 6), windDir: 205, cloudPct: c.cloud, humidity: 70, uv: c.uv, condition: c.key,
  }));
  const daily = Array.from({ length: 7 }, () => ({
    highC: c.hi, lowC: c.lo, rainChance: c.rain, uv: c.uv, windKph: c.wind, conditionKey: c.key,
    conditionLabel: c.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true, location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: { tempC: c.temp, feelsLikeC: c.temp - 3, uv: c.uv, isDay: !night, windKph: c.wind, rainChance: c.rain,
      cloudPct: c.cloud, conditionKey: c.key, conditionLabel: c.label, sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40` },
    hourly, daily, wind_kph: c.wind, maxWindKph: c.wind + 18, gustKph: c.wind + 18, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: { localHour: night ? 22 : 13, utcOffsetSeconds: 7200, confidence: 'high', sources: [], sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: c.key, sourceAgreement: '5/5' } },
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (pn.startsWith('/api/')) {
    const body = pn === '/api/weather' ? payload() : pn === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {};
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
const index = [];

for (const c of CONDITIONS) {
  for (const night of [false, true]) {
    const { slot, isNew } = pickSlot(c.key, night ? 'night' : 'day');
    const heroUrl = canonical(slot);
    cur = { c, night };
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
      await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
      // Pin the hero to the chosen photograph: the card paints from --hero-url.
      // The ANCHOR must be this slot's real wired value, not a constant. The
      // first version forced 55% on every frame, which is right for the
      // replacements but wrong for everything else — rain/week_1/day/1 is wired
      // at 26% and heat/week_1/day/1 has no entry at all (78% default), so six
      // of the twenty-four shots showed a crop the app would never produce.
      // A gate frame that misrepresents the app is worse than no gate frame.
      const anchor = HERO_CROP_OFFSETS[`bg/${slot}`];
      await page.evaluate(({ u, a }) => {
        const s = document.createElement('style');
        s.textContent = a == null
          ? `html { --hero-url: url("${u}") !important; }`
          : `html { --hero-url: url("${u}") !important; --hero-crop: ${a}% !important; }`;
        document.body.appendChild(s);
      }, { u: heroUrl, a: anchor ?? null });
      // THE CAPTION HAS TO FOLLOW THE PINNED PHOTOGRAPH. This harness fakes the
      // hero by overriding --hero-url, which decouples what is SHOWN from what
      // #bgImg actually landed on — and since 2026-08-19 the witty line is
      // resolved from #bgImg. Left alone, a frame shows one photograph wearing
      // another photograph's joke, which is precisely the defect the bespoke
      // lines exist to remove and precisely the sort of lie a gate frame must
      // not tell. Same rule as the anchor above: the frame shows what the app
      // would show for THIS picture.
      const own = HERO_LINES[`bg/${slot}`];
      if (own) {
        await page.evaluate((lines) => {
          const h = document.getElementById('headline');
          if (h) h.textContent = lines[Math.floor(Math.random() * lines.length)];
        }, own);
      }
      await page.waitForTimeout(1500);
      const file = `${c.key}-${night ? 'night' : 'day'}-${vp.n}.png`;
      await page.screenshot({ path: path.join(out, file) });
      await ctx.close();
      index.push({ condition: c.key, time: night ? 'night' : 'day', viewport: `${vp.w}x${vp.h}`, slot, replaced: isNew, anchor: anchor ?? 78, file });
    }
  }
}
await browser.close();
server.close();
writeFileSync(path.join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
const news = index.filter((i) => i.replaced).length;
console.log(`[gate] ${index.length} shots → output/gate-2026-08-14/ (${news} on photographs replaced today)`);
for (const c of CONDITIONS) for (const t of ['day', 'night']) {
  const row = index.find((i) => i.condition === c.key && i.time === t);
  console.log(`  ${c.key.padEnd(6)} ${t.padEnd(5)} ${row.replaced ? 'NEW  ' : 'as-is'} ${row.slot}`);
}
