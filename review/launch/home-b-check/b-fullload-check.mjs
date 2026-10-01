// Home check, B (2026-09-25): do the in-place measurements agree with the app loading the photograph
// itself? D's check (EVAL.md §4c: in-place boxes agree with full page loads 77/77), run on B.
//
//   node review/launch/home-b-check/b-fullload-check.mjs   -> data/b-fullload-check.json
//
// A sample of photographs with a daytime slot in the folder they were measured in, spread over the
// three sizes and the five languages: the app is loaded fresh at that slot's day and week, 12:00
// (the hour the in-place runs used), with that folder's weather dated to the same day, so the picker
// serves the photograph and the app picks the line (seeded). Then the joke box, its size and the card
// are read and set against the in-place row for the same photograph, language, line and size — or,
// when the app picked a general line the in-place runs did not measure (only the three longest are),
// against an in-place measurement of that line made the same way as the runs.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../../assets/image-picker.js';

const OUT = 'review/launch/home-b-check';
const D = 'review/eval/photo-check';
const SIZES = ['414x715', '360x688', '320x488'];
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const PER_SIZE = 26;
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const lines = read(`${OUT}/data/b-lines.json`);
const order = read(`${D}/data/d-order.json`);
const rot = Object.fromEntries(read(`${D}/data/rotation.json`).photos.map((p) => [p.hash, p]));
const M = Object.fromEntries(SIZES.map((s) => [s, read(`${OUT}/data/b-measure-${s}.json`)]));
const LIVE = read('review/eval/data/live-strand.json');
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
// The in-place runs' payload (b-cover-measure.mjs), dated to `day`.
const payloadFor = (f, day) => {
  const b = structuredClone(LIVE);
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
// D's whenFor (review/eval/scripts/d-subjects.mjs): a moment the picker serves this slot, at 12:00.
const whenFor = (slot) => {
  const [, wk, , file] = slot.split('/');
  const week = Number(wk.replace('week_', '')), weekday = Number(file.replace('.webp', ''));
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== week) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + (weekday - 1) * DAY_MS + 12 * 3600e3;
    if (getRotationWeek(t) === week && getRotationDay(t) === weekday) return t;
  }
  return null;
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
const READ = () => {
  const h = document.getElementById('headline'); const cs = getComputedStyle(h); const box = h.getBoundingClientRect();
  const photo = document.getElementById('heroPhoto'); const pb = photo.getBoundingClientRect();
  return {
    url: document.documentElement.style.getPropertyValue('--hero-url'), crop: document.documentElement.style.getPropertyValue('--hero-crop'),
    line: h.textContent.trim(), px: parseFloat(cs.fontSize),
    textTop: Math.round(box.top + parseFloat(cs.paddingTop)), textBottom: Math.round(box.bottom - parseFloat(cs.paddingBottom)),
    heroTop: Math.round(pb.top), heroBottom: Math.round(pb.bottom), bgY: parseFloat(getComputedStyle(photo).backgroundPosition.split(' ')[1]),
    scroll: document.scrollingElement.scrollHeight - innerHeight,
  };
};
const open = async (vw, vh, lang, t, seed) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(({ l, seed }) => {
    try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {}
    if (seed) { let s = seed; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  }, { l: lang, seed });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(t));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.body.classList.contains('home-b'), null, { timeout: 20000 });
  await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page };
};

// The sample: photographs with a daytime slot in their measured folder, in D's numbering, spread.
const cands = order.map((o) => ({ ...o, slot: rot[o.hash].slots.find((s) => s.split('/')[2] === 'day' && s.split('/')[0] === lines[o.hash].folder) })).filter((c) => c.slot);
const out = [];
let k = 0;
for (const [si, size] of SIZES.entries()) {
  const [vw, vh] = size.split('x').map(Number);
  const step = cands.length / PER_SIZE;
  for (let i = 0; i < PER_SIZE; i++) {
    const c = cands[Math.floor(i * step + si * step / 3) % cands.length];
    const lang = LANGS[(i + si * 2) % 5];
    const folder = lines[c.hash].folder;
    const t = whenFor(c.slot);
    const day = new Date(t + 7200e3).toISOString().slice(0, 10);
    current = payloadFor(FOLDER[folder], day);
    const full = await open(vw, vh, lang, t, 1000 + (k++) * 7919);
    const f = await full.page.evaluate(READ);
    await full.ctx.close();
    const served = f.url.includes(c.hash);
    const anchorOk = (lines[c.hash].anchor == null ? f.crop === '' : f.crop === `${lines[c.hash].anchor}%`);
    // The in-place row for the same photograph, language, line and size…
    let inPlace = M[size].find((r) => r.hash === c.hash && r.lang === lang && r.line === f.line);
    let how = 'in-place run';
    if (!inPlace && served) {
      // …or the line measured in place now, exactly as the runs did (D's moment, the folder's weather).
      current = payloadFor(FOLDER[folder], '2026-10-07');
      const ip = await open(vw, vh, lang, Date.UTC(2026, 9, 7, 10, 0), 0);
      inPlace = await ip.page.evaluate(async ({ hash, anchor, line }) => {
        const root = document.documentElement;
        root.style.setProperty('--hero-url', `url("/assets/images/bg-canonical/${hash}.webp")`);
        if (anchor == null) root.style.removeProperty('--hero-crop'); else root.style.setProperty('--hero-crop', `${anchor}%`);
        const h = document.getElementById('headline');
        h.textContent = line;
        await new Promise((r) => { const step = (n) => (n ? requestAnimationFrame(() => step(n - 1)) : r()); step(5); });
        const cs = getComputedStyle(h); const box = h.getBoundingClientRect(); const pb = document.getElementById('heroPhoto').getBoundingClientRect();
        return { px: parseFloat(cs.fontSize), textTop: Math.round(box.top + parseFloat(cs.paddingTop)), textBottom: Math.round(box.bottom - parseFloat(cs.paddingBottom)), heroTop: Math.round(pb.top), heroBottom: Math.round(pb.bottom), bgY: parseFloat(getComputedStyle(document.getElementById('heroPhoto')).backgroundPosition.split(' ')[1]) };
      }, { hash: c.hash, anchor: lines[c.hash].anchor, line: f.line });
      await ip.ctx.close();
      how = 'measured in place now';
    }
    const same = served && anchorOk && inPlace && Math.abs(inPlace.textTop - f.textTop) <= 1 && Math.abs(inPlace.textBottom - f.textBottom) <= 1 && Math.abs(inPlace.px - f.px) < 0.01 && inPlace.heroBottom === f.heroBottom && inPlace.bgY === f.bgY;
    out.push({ n: c.n, hash8: c.hash8, size, lang, folder, slot: c.slot, served, anchorOk, line: f.line, full: [f.textTop, f.textBottom, +f.px.toFixed(2), f.heroBottom, f.bgY, f.scroll], inPlace: inPlace && [inPlace.textTop, inPlace.textBottom, +inPlace.px.toFixed(2), inPlace.heroBottom, inPlace.bgY], how, same });
    process.stderr.write(`#${c.n} ${size} ${lang} ${served ? '' : 'NOT SERVED '}${same ? 'same' : 'DIFFERENT'} (${how})\n`);
  }
}
await browser.close(); server.close();
writeFileSync(`${OUT}/data/b-fullload-check.json`, JSON.stringify(out, null, 1));
console.log(`[b-fullload] ${out.length} full page loads; served as asked ${out.filter((x) => x.served).length}; joke box, size and card as measured in place ${out.filter((x) => x.same).length}/${out.filter((x) => x.served).length} (${out.filter((x) => x.how === 'in-place run').length} against the runs' rows, ${out.filter((x) => x.how !== 'in-place run').length} measured in place now); page scroll on full loads ${out.filter((x) => x.full[5] > 1).length}`);
