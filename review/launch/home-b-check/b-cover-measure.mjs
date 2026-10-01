// Home check, B (2026-09-25): where B's joke lands, for every photograph × every line that can show
// on it × five languages × three phone sizes — D's photo check (review/eval/photo-check/, EVAL.md
// §4c part 2) run again on design B, same method. Run on design/home-options (de09a2b) after a build,
// from the repo root.
//
//   node review/launch/home-b-check/b-cover-measure.mjs --lines          (data/b-lines.json; must equal D's d-lines.json)
//   node review/launch/home-b-check/b-cover-measure.mjs --size 414x715   (data/b-measure-414x715.json)
//   node review/launch/home-b-check/b-cover-measure.mjs --shots          (shots for data/b-shots-list.json, from b-worst.mjs)
//
// The lines are D's: every photograph's own lines and, wherever it falls back to the general lines,
// the three longest that can reach it there (the --lines code is D's, unchanged; the file it writes
// is checked equal to D's). The photographs, lines, payloads, contexts and timing are D's.
//
// What changes for B: the page is ?home=b, and B places the joke its own way — on the photograph
// card (#heroPhoto), at the card's foot, stepped down by B's own fitter (home-options.js: the text
// may take at most 46% of the card, never under 19 px). B's card is not the whole screen: it runs
// from the top of the screen to the data rows, and the data rows' height (language, weather) sets its
// height. So every row also records the card's box and its background-position, which is how the
// photograph sits on this screen (cover, centre, the crop anchor or the 78% default).
//
// Measured IN PLACE, no screenshots: B is loaded once per size × language × folder (a payload of that
// folder's weather), then for each photograph the hero URL and Al's crop anchor are set, each line
// goes into #headline, and B's own fitter runs before the joke's box is read.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'review/launch/home-b-check';
const D = 'review/eval/photo-check';
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const fresh = (p) => import(`${pathToFileURL(path.resolve(p)).href}?t=${Date.now()}`);
const rot = JSON.parse(readFileSync(`${D}/data/rotation.json`, 'utf8'));
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
mkdirSync(`${OUT}/data`, { recursive: true });

if (process.argv.includes('--lines')) {
  // D's code, verbatim (d-cover-measure.mjs --lines), writing b-lines.json.
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
    const bank = Object.fromEntries(LANGS.map((l) => [l, new Map()]));
    for (const slot of p.slots) {
      const [folder, , time, file] = slot.split('/');
      const jsDay = Number(file.replace('.webp', '')) % 7;
      const conds = CONDITIONS.filter((c) => V.getWeatherBackgroundFolder(c) === folder);
      for (const [lat, lon] of PLACES) for (let month = 1; month <= 12; month++) {
        const inSeason = own.filter((l) => T.contextTagAllows(TAGS[l], { lat, lon, month }));
        const ownHere = { en: inSeason, af: inSeason.map((l) => AF.heroLineAf(l)).filter(Boolean) };
        for (const lang of LANGS) {
          if (ownHere[lang]?.length) continue;
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
  writeFileSync(`${OUT}/data/b-lines.json`, JSON.stringify(out, null, 1));
  const n = Object.values(out).reduce((a, p) => a + LANGS.reduce((b, l) => b + p.lines[l].length, 0), 0);
  const same = JSON.stringify(out) === JSON.stringify(JSON.parse(readFileSync(`${D}/data/d-lines.json`, 'utf8')));
  console.log(`[b-lines] ${Object.keys(out).length} photographs, ${n} photograph × line × language pairs; identical to D's d-lines.json: ${same}`);
  process.exit(same ? 0 : 1);
}

// ---------- the page, as D set it up ----------
const lines = JSON.parse(readFileSync(`${OUT}/data/b-lines.json`, 'utf8'));
const dims = Object.fromEntries(rot.photos.map((p) => [p.hash, null]));
for (const f of Object.keys(dims)) {
  const buf = readFileSync(`dist/assets/images/bg-canonical/${f}.webp`);
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
const t0 = Date.UTC(2026, 9, 7, 10, 0);     // Wed 7 Oct 2026, 12:00 SAST (D's moment)
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
const BASE = `http://127.0.0.1:${server.address().port}/?home=b`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await webkit.launch();
const openB = async (vw, vh, lang, folder, scale = 1) => {
  current = payloadFor(FOLDER[folder]);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: scale, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} }, lang);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(t0));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.body.classList.contains('home-b'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
};
// In the page: set a photograph and a line, let B's fitter run, read the joke and the card.
const PLACE = async ({ hash, anchor, line, frames }) => {
  const root = document.documentElement;
  root.style.setProperty('--hero-url', `url("/assets/images/bg-canonical/${hash}.webp")`);
  if (anchor == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${anchor}%`);
  const h = document.getElementById('headline');
  h.textContent = line;
  await new Promise((r) => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : r()); step(frames); });
  const cs = getComputedStyle(h);
  const box = h.getBoundingClientRect();
  const photo = document.getElementById('heroPhoto');
  const pb = photo.getBoundingClientRect();
  const pcs = getComputedStyle(photo);
  const header = document.querySelector('.header').getBoundingClientRect();
  const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
  return {
    px: parseFloat(cs.fontSize), lineH: parseFloat(cs.lineHeight),
    textTop: Math.round(box.top + padT), textBottom: Math.round(box.bottom - padB), boxTop: Math.round(box.top), boxBottom: Math.round(box.bottom),
    heroTop: Math.round(pb.top), heroBottom: Math.round(pb.bottom), heroW: Math.round(pb.width), heroX: Math.round(pb.left),
    bgY: parseFloat(pcs.backgroundPosition.split(' ')[1]), bgSize: pcs.backgroundSize,
    headerBottom: Math.round(header.bottom), transform: cs.transform,
    scroll: document.scrollingElement.scrollHeight - innerHeight,
  };
};

// --shots: the photographs b-worst.mjs lists (data/b-shots-list.json) at the size and line given —
// the same in-place setup at 2x, the photograph decoded before the shot, the joke's box in the shot
// checked against the measured one. Writes shots/worst/<hash8>-<size>.jpg (the screen) and
// shots/card/<hash8>-<size>.jpg (the bare photograph exactly as B crops it on that screen, the joke's
// text box outlined in green, D's judged subject band bracketed in orange on the right).
if (process.argv.includes('--shots')) {
  const sharp = (await import('sharp')).default;
  mkdirSync(`${OUT}/shots/worst`, { recursive: true }); mkdirSync(`${OUT}/shots/card`, { recursive: true });
  // --missing: only the listed shots not on disk yet (the log keeps the earlier ones).
  const { existsSync } = await import('node:fs');
  const missing = process.argv.includes('--missing');
  const have = (j) => existsSync(`${OUT}/shots/worst/${j.hash.slice(0, 8)}-${j.size}.jpg`) && existsSync(`${OUT}/shots/card/${j.hash.slice(0, 8)}-${j.size}.jpg`);
  const jobs = JSON.parse(readFileSync(`${OUT}/data/b-shots-list.json`, 'utf8')).filter((j) => !missing || !have(j));
  const earlier = missing && existsSync(`${OUT}/data/b-shots.json`) ? JSON.parse(readFileSync(`${OUT}/data/b-shots.json`, 'utf8')) : [];
  const groups = {};
  for (const j of jobs) (groups[`${j.size}|${j.lang}|${j.folder}`] ||= []).push(j);
  const log = [];
  for (const [key, list] of Object.entries(groups)) {
    const [size, lang, folder] = key.split('|');
    const [vw, vh] = size.split('x').map(Number);
    const { ctx, page } = await openB(vw, vh, lang, folder, 2);
    for (const j of list) {
      await page.evaluate(async (hash) => { const i = new Image(); i.src = `/assets/images/bg-canonical/${hash}.webp`; await i.decode(); }, j.hash);
      const got = await page.evaluate(PLACE, { hash: j.hash, anchor: j.anchor, line: j.line, frames: 8 });
      await page.waitForTimeout(250);
      const png = await page.screenshot();
      const name = `${j.hash.slice(0, 8)}-${size}`;
      await sharp(png).jpeg({ quality: 74, mozjpeg: true }).toFile(`${OUT}/shots/worst/${name}.jpg`);
      // The card: the bare photograph as B crops it on this screen (cover in the card box, centred,
      // background-position-y = the anchor), 2x, the rest of the screen dark.
      const S = 2, [iw, ih] = dims[j.hash];
      const cw = got.heroW, ch = got.heroBottom - got.heroTop;
      const k = Math.max(cw / iw, ch / ih), dw = Math.round(iw * k * S), dh = Math.round(ih * k * S);
      const offX = Math.round((dw - cw * S) / 2), offY = Math.round((dh - ch * S) * (got.bgY / 100));
      const crop = await sharp(`dist/assets/images/bg-canonical/${j.hash}.webp`).resize(dw, dh).extract({ left: offX, top: offY, width: cw * S, height: ch * S }).toBuffer();
      const bandSvg = j.band ? (() => {
        const [t, b] = j.bandY.map((y) => y * S);
        return `<path d="M ${vw * S - 8} ${t} h -26 M ${vw * S - 8} ${t} V ${b} M ${vw * S - 8} ${b} h -26" stroke="#ff8a00" stroke-width="10" fill="none"/>`;
      })() : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw * S}" height="${vh * S}">
        <rect x="6" y="${got.textTop * S}" width="${vw * S - 12}" height="${(got.textBottom - got.textTop) * S}" fill="rgba(0,255,136,0.10)" stroke="#00ff88" stroke-width="6"/>
        <line x1="0" x2="${vw * S}" y1="${got.heroBottom * S}" y2="${got.heroBottom * S}" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 8"/>
        ${bandSvg}
      </svg>`;
      await sharp({ create: { width: vw * S, height: vh * S, channels: 3, background: '#14110d' } })
        .composite([{ input: crop, left: got.heroX * S, top: got.heroTop * S }, { input: Buffer.from(svg), left: 0, top: 0 }])
        .jpeg({ quality: 74, mozjpeg: true }).toFile(`${OUT}/shots/card/${name}.jpg`);
      const same = Math.abs(got.textTop - j.textTop) <= 1 && Math.abs(got.textBottom - j.textBottom) <= 1 && Math.abs(got.px - j.px) < 0.01;
      log.push({ n: j.n, hash8: j.hash.slice(0, 8), size, lang, why: j.why, measured: [j.textTop, j.textBottom, j.px], shot: [got.textTop, got.textBottom, got.px], same });
    }
    process.stderr.write(`${key}: ${list.length}\n`);
    await ctx.close();
  }
  await browser.close(); server.close();
  const all = [...earlier.filter((e) => !log.some((x) => x.hash8 === e.hash8 && x.size === e.size)), ...log];
  writeFileSync(`${OUT}/data/b-shots.json`, JSON.stringify(all, null, 1));
  console.log(`[b-shots] ${log.length} shots this run, ${all.length} in all; joke box as measured in ${all.filter((x) => x.same).length}`);
  process.exit(0);
}

// ---------- measuring, one size per run ----------
const [VW, VH] = arg('--size', '414x715').split('x').map(Number);
const ONLY = Number(arg('--limit', '0'));        // testing: the first N photographs of each folder
const byFolder = {};
for (const [hash, p] of Object.entries(lines)) (byFolder[p.folder] ||= []).push(hash);
if (ONLY) for (const f of Object.keys(byFolder)) byFolder[f] = byFolder[f].slice(0, ONLY);
const rows = [];
const started = Date.now();
for (const lang of LANGS) for (const [folder, hashes] of Object.entries(byFolder)) {
  const { ctx, page } = await openB(VW, VH, lang, folder);
  const shown = await page.evaluate(() => window.__PW_LAST_DISPLAY);
  for (const hash of hashes) {
    const [iw, ih] = dims[hash];
    for (const { line, source } of lines[hash].lines[lang]) {
      const r = await page.evaluate(PLACE, { hash, anchor: lines[hash].anchor, line, frames: 5 });
      rows.push({ hash, folder, lang, size: `${VW}x${VH}`, shown, iw, ih, anchor: lines[hash].anchor, line, source, ...r });
    }
  }
  process.stderr.write(`${VW}x${VH} ${lang} ${folder}: ${hashes.length} photographs (${Math.round((Date.now() - started) / 1000)} s)\n`);
  await ctx.close();
}
await browser.close(); server.close();
writeFileSync(`${OUT}/data/b-measure-${VW}x${VH}${ONLY ? '-test' : ''}.json`, JSON.stringify(rows));
const minPx = Math.min(...rows.map((r) => r.px));
console.log(`[b-measure ${VW}x${VH}] ${rows.length} measurements; smallest joke ${minPx.toFixed(2)} px; joke under 19 px ${rows.filter((r) => r.px < 19).length}; page scrolls ${rows.filter((r) => r.scroll > 1).length}; text above the card's top ${rows.filter((r) => r.textTop < r.heroTop).length}; text under the header ${rows.filter((r) => r.textTop < r.headerBottom).length}; transformed ${rows.filter((r) => r.transform !== 'none' && r.transform !== 'matrix(1, 0, 0, 1, 0, 0)').length}`);
