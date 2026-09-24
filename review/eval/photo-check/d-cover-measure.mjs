// Photo check, part 2 (2026-09-24): where D's joke lands, for every photograph × every line that can
// show on it × five languages × three phone sizes. Run on design/home-options after a build.
//
//   node review/eval/photo-check/d-cover-measure.mjs --lines          (writes data/d-lines.json)
//   node review/eval/photo-check/d-cover-measure.mjs --size 414x715   (writes data/d-measure-414x715.json)
//
// Lines that can show on a photograph: its own lines (English; Afrikaans where it has them) and,
// wherever it falls back to the general condition lines (every context in isiZulu, isiXhosa and
// Sesotho; the months and places its own lines are gated out of in English and Afrikaans; always,
// for the 7 photographs with none), the three longest general lines that can reach it there — found
// with the app's own gate (eligibleWittyPool) over its slots' weekdays and hours, every month,
// a place in every region box and one in none, low confidence on and off.
//
// Measured IN PLACE, no screenshots: D is loaded once per size × language × folder (a payload of
// that folder's weather), then for each photograph the hero URL, Al's crop anchor and the image's
// size are set, each line goes into #headline, and D's own fitter and rise rule run before the
// joke's box is read.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'review/eval/photo-check';
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const fresh = (p) => import(`${pathToFileURL(path.resolve(p)).href}?t=${Date.now()}`);
const rot = JSON.parse(readFileSync(`${OUT}/data/rotation.json`, 'utf8'));
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

if (process.argv.includes('--lines')) {
  const V = await fresh('assets/weather-visuals.js');
  const T = await fresh('assets/witty-day-tags.js');
  const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
  const HL = await fresh('assets/hero-lines.js');
  const AF = await fresh('assets/hero-lines-af.js');
  const { REGION_BOXES } = await fresh('assets/geo-regions.js');
  const CONDITIONS = [...Object.keys(W.witty ? {} : {}), 'clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind', ...Object.keys(V.WEATHER_BACKGROUND_ALIASES)];
  const PLACES = Object.values(REGION_BOXES).map((b) => [(b.minLat + b.maxLat) / 2, (b.minLon + b.maxLon) / 2]);
  PLACES.push([-28.7282, 24.7499]);
  const HOURS = { dawn: [5, 6, 7], day: [8, 11, 12, 16], dusk: [17, 19], night: [20, 21, 23, 2, 4] };
  const TAGS = HL.HERO_LINE_TAGS || {};
  const out = {};
  for (const p of rot.photos) {
    const own = HL.heroLinesForKey(`bg-canonical/${p.hash}.webp`) || [];
    const lines = {};
    const bank = Object.fromEntries(LANGS.map((l) => [l, new Map()]));   // line -> bin
    for (const slot of p.slots) {
      const [folder, , time, file] = slot.split('/');
      const jsDay = Number(file.replace('.webp', '')) % 7;
      const conds = CONDITIONS.filter((c) => V.getWeatherBackgroundFolder(c) === folder);
      for (const [lat, lon] of PLACES) for (let month = 1; month <= 12; month++) {
        const inSeason = own.filter((l) => T.contextTagAllows(TAGS[l], { lat, lon, month }));
        const ownHere = { en: inSeason, af: inSeason.map((l) => AF.heroLineAf(l)).filter(Boolean) };
        for (const lang of LANGS) {
          if (ownHere[lang]?.length) continue;                 // its own line shows; the bank does not
          for (const cond of conds) for (const hour of HOURS[time]) for (const lowConfidence of [false, true]) {
            const copyCondition = T.resolveNightAwareCopyCondition({ displayCondition: cond, timeOfDay: time, hour });
            const res = T.eligibleWittyPool({ copy: W, tags: T.WITTY_DAY_TAGS, condition: copyCondition, lang, context: { day: jsDay, hour, lat, lon, month }, lowConfidence });
            for (const l of res.pool) if (!bank[lang].has(l)) bank[lang].set(l, `${res.namespace}.${res.bin}`);
          }
        }
      }
    }
    for (const lang of LANGS) {
      const mine = lang === 'en' ? own.map((l) => ({ line: l, source: 'own' }))
        : lang === 'af' ? own.map((l) => AF.heroLineAf(l)).filter(Boolean).map((l) => ({ line: l, source: 'own' })) : [];
      const longest = [...bank[lang].entries()].sort((a, b) => b[0].length - a[0].length).slice(0, 3).map(([line, bin]) => ({ line, source: `general (${bin})` }));
      lines[lang] = [...mine, ...longest];
    }
    out[p.hash] = { folder: p.folders[0], anchor: p.anchor, hoursPerWeek: p.hoursPerWeek, ownEn: own.length, lines };
  }
  writeFileSync(`${OUT}/data/d-lines.json`, JSON.stringify(out, null, 1));
  const n = Object.values(out).reduce((a, p) => a + LANGS.reduce((b, l) => b + p.lines[l].length, 0), 0);
  console.log(`[d-lines] ${Object.keys(out).length} photographs, ${n} photograph × line × language pairs`);
  process.exit(0);
}

// ---------- measuring, one size per run ----------
const [VW, VH] = arg('--size', '414x715').split('x').map(Number);
const lines = JSON.parse(readFileSync(`${OUT}/data/d-lines.json`, 'utf8'));
const dims = Object.fromEntries(rot.photos.map((p) => [p.hash, null]));
for (const f of Object.keys(dims)) {
  const file = `dist/assets/images/bg-canonical/${f}.webp`;
  const buf = readFileSync(file);
  // WebP VP8/VP8L/VP8X header: width/height without decoding.
  const riff = buf.toString('ascii', 12, 16);
  let w = 0; let h = 0;
  if (riff === 'VP8X') { w = 1 + buf.readUIntLE(24, 3); h = 1 + buf.readUIntLE(27, 3); }
  else if (riff === 'VP8 ') { w = buf.readUInt16LE(26) & 0x3fff; h = buf.readUInt16LE(28) & 0x3fff; }
  else if (riff === 'VP8L') { const b = buf.readUInt32LE(21); w = (b & 0x3fff) + 1; h = ((b >> 14) & 0x3fff) + 1; }
  dims[f] = [w, h];
}
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const FOLDER = {
  clear: { cond: 'clear', temp: 24, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 10, uv: 7 } },
  cloudy: { cond: 'cloudy', temp: 18, extra: { rainChance: 15, precipMm: 0, cloudPct: 95, windKph: 12 } },
  cold: { cond: 'cold', temp: 8, extra: { rainChance: 5, precipMm: 0, cloudPct: 90, windKph: 10 } },
  'cold-clear': { cond: 'cold-clear', temp: 4, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 6 } },
  fog: { cond: 'fog', temp: 11, extra: { rainChance: 10, precipMm: 0, cloudPct: 100, windKph: 4, humidity: 99 } },
  heat: { cond: 'heat', temp: 36, extra: { rainChance: 2, precipMm: 0, cloudPct: 3, windKph: 8, uv: 10 } },
  rain: { cond: 'rain', temp: 14, extra: { rainChance: 90, precipMm: 3.2, cloudPct: 100, windKph: 20 } },
  storm: { cond: 'storm', temp: 16, extra: { rainChance: 90, precipMm: 6, cloudPct: 100, windKph: 30 } },
  wind: { cond: 'wind', temp: 18, extra: { rainChance: 5, precipMm: 0, cloudPct: 30, windKph: 42 } },
};
const t0 = Date.UTC(2026, 9, 7, 10, 0);     // Wed 7 Oct 2026, 12:00 SAST
const payloadFor = (f) => {
  const b = structuredClone(LIVE);
  const day = '2026-10-07';
  Object.assign(b.now, { tempC: f.temp, feelsLikeC: f.temp - 1, humidity: 70, conditionKey: f.cond, conditionLabel: f.cond, isDay: true, windDir: 200, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }, f.extra);
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: f.cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: f.cond === 'rain' || f.cond === 'storm' ? 4 : 0, precipMm: f.extra.precipMm } };
  b.now.conditionReason = f.cond === 'rain' ? 'rain-now' : b.now.conditionReason;
  b.daily = b.daily.map((d, i) => ({ ...d, highC: f.temp + 3 - (i % 2), lowC: f.temp - 6 + (i % 3), rainChance: f.extra.rainChance, conditionKey: f.cond, conditionLabel: f.cond, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.hourly = b.hourly.map((x) => ({ ...x, tempC: f.temp, rainChance: f.extra.rainChance, precipMm: f.extra.precipMm / 3, windKph: f.extra.windKph, condition: f.cond }));
  b.wind_kph = f.extra.windKph; b.gustKph = Math.round(f.extra.windKph * 1.4); b.maxWindKph = b.gustKph;
  b.location = { ...b.location, name: 'Strand' };
  b.meta = { ...b.meta, localHour: 12, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: f.cond, sourceAgreement: '4/5' } };
  return b;
};
let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true,"lat":-34.1163,"lon":18.8362,"name":"Strand, Western Cape","results":[]}');
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve('dist', p === '/' ? 'index.html' : p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/?home=d`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await webkit.launch();

// --shots: each flagged photograph (data/d-count.json) at its worst — the line that covers most of
// the subject, at Al's size, or at the smaller phone where it fails when 414x715 is clear. Same
// in-place setup as the measuring below, at 2x, the photograph decoded before the shot; the joke's
// box in the shot is checked against the measured one. Writes shots/worst/<hash8>.jpg and
// shots/card/<hash8>.jpg (the bare photograph at the same crop: the joke's text box outlined, the
// judged subject bracketed in orange on the right).
if (process.argv.includes('--shots')) {
  const sharp = (await import('sharp')).default;
  const { mkdirSync } = await import('node:fs');
  mkdirSync(`${OUT}/shots/worst`, { recursive: true }); mkdirSync(`${OUT}/shots/card`, { recursive: true });
  const C = JSON.parse(readFileSync(`${OUT}/data/d-count.json`, 'utf8'));
  const jobs = C.photos.filter((p) => p.flagged).map((p) => {
    const size = p.sizes['414x715'].covered ? '414x715' : ['320x488', '360x688'].filter((s) => p.sizes[s].covered).sort((a, b) => p.sizes[b].worst.overlapPx - p.sizes[a].worst.overlapPx)[0];
    return { p, size, w: p.sizes[size].worst };
  });
  const groups = {};
  for (const j of jobs) (groups[`${j.size}|${j.w.lang}|${j.p.folder}`] ||= []).push(j);
  const log = [];
  for (const [key, list] of Object.entries(groups)) {
    const [size, lang, folder] = key.split('|');
    const [vw, vh] = size.split('x').map(Number);
    current = payloadFor(FOLDER[folder]);
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
    await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} }, lang);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(t0));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.body.classList.contains('home-d'), null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    for (const { p, w } of list) {
      const [iw, ih] = dims[p.hash];
      const got = await page.evaluate(async ({ hash, anchor, iw, ih, line }) => {
        const src = `/assets/images/bg-canonical/${hash}.webp`;
        const pre = new Image(); pre.src = src; await pre.decode();
        const root = document.documentElement;
        root.style.setProperty('--hero-url', `url("${src}")`);
        if (anchor == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${anchor}%`);
        const img = document.getElementById('bgImg');
        Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => iw });
        Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => ih });
        const h = document.getElementById('headline');
        h.textContent = line;
        await new Promise((r) => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : r()); step(8); });
        const cs = getComputedStyle(h), box = h.getBoundingClientRect();
        return { textTop: Math.round(box.top + parseFloat(cs.paddingTop)), textBottom: Math.round(box.bottom - parseFloat(cs.paddingBottom)), risen: document.body.classList.contains('d-joke-high') };
      }, { hash: p.hash, anchor: p.anchor, iw, ih, line: w.line });
      await page.waitForTimeout(250);
      const png = await page.screenshot();
      await sharp(png).jpeg({ quality: 74, mozjpeg: true }).toFile(`${OUT}/shots/worst/${p.hash8}.jpg`);
      // The card: the bare photograph as D crops it at this size, 2x.
      const S = 2, k = Math.max(vw / iw, vh / ih), dw = Math.round(iw * k * S), dh = Math.round(ih * k * S);
      const offX = Math.round((dw - vw * S) / 2), offY = Math.round((dh - vh * S) * ((p.anchor ?? 78) / 100));
      const base = await sharp(`dist/assets/images/bg-canonical/${p.hash}.webp`).resize(dw, dh).extract({ left: offX, top: offY, width: vw * S, height: vh * S }).toBuffer();
      // The judged band is in % of the 414x715 frame; carried through the photograph to this crop.
      const k414 = Math.max(414 / iw, 715 / ih), dh414 = ih * k414, off414 = (715 - dh414) * ((p.anchor ?? 78) / 100);
      const bandY = p.judged.band.map((pct) => ((((pct / 100) * 715 - off414) / dh414) * dh - offY));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw * S}" height="${vh * S}">
        <rect x="6" y="${got.textTop * S}" width="${vw * S - 12}" height="${(got.textBottom - got.textTop) * S}" fill="rgba(0,255,136,0.10)" stroke="#00ff88" stroke-width="6"/>
        <path d="M ${vw * S - 8} ${bandY[0]} h -26 M ${vw * S - 8} ${bandY[0]} V ${bandY[1]} M ${vw * S - 8} ${bandY[1]} h -26" stroke="#ff8a00" stroke-width="10" fill="none"/>
      </svg>`;
      await sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 74, mozjpeg: true }).toFile(`${OUT}/shots/card/${p.hash8}.jpg`);
      const ok = Math.abs(got.textTop - w.textTop) <= 1 && Math.abs(got.textBottom - w.textBottom) <= 1 && got.risen === w.risen;
      log.push({ n: p.n, hash8: p.hash8, size, lang, measured: [w.textTop, w.textBottom, w.risen], shot: [got.textTop, got.textBottom, got.risen], same: ok });
    }
    process.stderr.write(`${key}: ${list.length}\n`);
    await ctx.close();
  }
  await browser.close(); server.close();
  writeFileSync(`${OUT}/data/d-shots.json`, JSON.stringify(log, null, 1));
  console.log(`[d-shots] ${log.length} worst-case shots; joke box as measured in ${log.filter((x) => x.same).length}`);
  process.exit(0);
}
const byFolder = {};
for (const [hash, p] of Object.entries(lines)) (byFolder[p.folder] ||= []).push(hash);
const rows = [];
const started = Date.now();
for (const lang of LANGS) for (const [folder, hashes] of Object.entries(byFolder)) {
  current = payloadFor(FOLDER[folder]);
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} }, lang);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(t0));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.body.classList.contains('home-d'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const shown = await page.evaluate(() => window.__PW_LAST_DISPLAY);
  for (const hash of hashes) {
    const [iw, ih] = dims[hash];
    const res = await page.evaluate(async ({ hash, anchor, iw, ih, list }) => {
      const root = document.documentElement;
      root.style.setProperty('--hero-url', `url("/assets/images/bg-canonical/${hash}.webp")`);
      if (anchor == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${anchor}%`);
      const img = document.getElementById('bgImg');
      Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => iw });
      Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => ih });
      const frames = (n) => new Promise((r) => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : r()); step(n); });
      const h = document.getElementById('headline');
      const out = [];
      for (const { line, source } of list) {
        h.textContent = line;
        await frames(5);
        const cs = getComputedStyle(h);
        const box = h.getBoundingClientRect();
        const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
        out.push({
          line, source, px: parseFloat(cs.fontSize), risen: document.body.classList.contains('d-joke-high'),
          textTop: Math.round(box.top + padT), textBottom: Math.round(box.bottom - padB), boxTop: Math.round(box.top), boxBottom: Math.round(box.bottom),
          statusBottom: Math.round(document.getElementById('weatherStatus').getBoundingClientRect().bottom),
          lineTop: Math.round(document.getElementById('dLine').getBoundingClientRect().top),
          scroll: document.scrollingElement.scrollHeight - innerHeight,
        });
      }
      return out;
    }, { hash, anchor: lines[hash].anchor, iw, ih, list: lines[hash].lines[lang] });
    for (const r of res) rows.push({ hash, folder, lang, size: `${VW}x${VH}`, shown, iw, ih, anchor: lines[hash].anchor, ...r });
  }
  process.stderr.write(`${VW}x${VH} ${lang} ${folder}: ${hashes.length} photographs (${Math.round((Date.now() - started) / 1000)} s)\n`);
  await ctx.close();
}
await browser.close(); server.close();
writeFileSync(`${OUT}/data/d-measure-${VW}x${VH}.json`, JSON.stringify(rows));
console.log(`[d-measure ${VW}x${VH}] ${rows.length} measurements; risen ${rows.filter((r) => r.risen).length}; joke under 19 px ${rows.filter((r) => r.px < 19).length}; page scrolls ${rows.filter((r) => r.scroll > 1).length}`);
