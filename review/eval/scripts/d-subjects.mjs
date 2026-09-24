// Home option D (2026-09-24): the photographs whose subject sits where D sets the joke — shown,
// not hidden (Al's brief). Every served photograph whose crop anchor (the band Al dragged onto
// the subject, assets/hero-crop.js) puts the subject low is rendered in D at Al's phone size
// (414x715, WebKit, Chrome-on-iPhone UA) at one of its own slots, with the line the app itself
// picks for it; the script measures where the joke's text starts and where the anchor puts the
// subject's centre on this screen, and writes both beside the shot.
//
//   node review/eval/scripts/d-subjects.mjs --dist dist [--min 70] [--out review/eval/shots/home/d-subjects]
//
// Needs review/eval/data/d-anchors.json (d-anchors.mjs). The subject's centre is an estimate: the
// anchor is the vertical position of a band half the photograph tall, so the band's centre sits at
// 25% + anchor/2 of the photograph's height.
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/home/d-subjects');
const MIN = Number(arg('--min', '70'));
// --foot-only: D as sketched, the joke always at the foot (the "before" shots).
const FOOT_ONLY = process.argv.includes('--foot-only');
// --only <hash8,...>: just these photographs (the page's before/after pairs).
const ONLY = arg('--only', '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const photos = JSON.parse(readFileSync('review/eval/data/d-anchors.json', 'utf8'))
  .filter((p) => p.anchor != null && p.anchor >= MIN)
  .filter((p) => !ONLY.length || ONLY.includes(p.hash.slice(0, 8)))
  .sort((a, b) => b.anchor - a.anchor);

// What each folder's weather looks like, so the picker serves that folder.
const FOLDER = {
  clear: { cond: 'clear', temp: 24, extra: { rainChance: 2, precipMm: 0, cloudPct: 5, windKph: 10, uv: 7 } },
  cloudy: { cond: 'cloudy', temp: 18, extra: { rainChance: 15, precipMm: 0, cloudPct: 90, windKph: 14 } },
  cold: { cond: 'cold', temp: 8, extra: { rainChance: 5, precipMm: 0, cloudPct: 60, windKph: 10 } },
  'cold-clear': { cond: 'cold-clear', temp: 4, extra: { rainChance: 2, precipMm: 0, cloudPct: 5, windKph: 6 } },
  fog: { cond: 'fog', temp: 11, extra: { rainChance: 10, precipMm: 0, cloudPct: 100, windKph: 4, humidity: 99 } },
  heat: { cond: 'heat', temp: 36, extra: { rainChance: 2, precipMm: 0, cloudPct: 5, windKph: 8, uv: 10 } },
  rain: { cond: 'rain', temp: 14, extra: { rainChance: 85, precipMm: 3.2, cloudPct: 100, windKph: 20 } },
  storm: { cond: 'storm', temp: 16, extra: { rainChance: 90, precipMm: 6, cloudPct: 100, windKph: 30 } },
  wind: { cond: 'wind', temp: 18, extra: { rainChance: 5, precipMm: 0, cloudPct: 30, windKph: 42 } },
};
const SLOT_HOUR = { dawn: 6.5, day: 12, dusk: 18.25, night: 22 };
const whenFor = (slot) => {
  const [, wk, time, file] = slot.split('/');
  const week = Number(wk.replace('week_', '')), weekday = Number(file.replace('.webp', ''));
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== week) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + (weekday - 1) * DAY_MS + SLOT_HOUR[time] * 3600e3;
    if (getRotationWeek(t) === week && getRotationDay(t) === weekday) return t;
  }
  return null;
};
const payloadFor = (f, t) => {
  const b = structuredClone(LIVE);
  const local = new Date(t + 7200e3);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  Object.assign(b.now, { tempC: f.temp, feelsLikeC: f.temp - 1, humidity: 70, uv: 0, conditionKey: f.cond, conditionLabel: f.cond, isDay: hour >= 6 && hour < 18, windDir: 200 }, f.extra);
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: f.cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: f.cond === 'rain' || f.cond === 'storm' ? 4 : 0, precipMm: f.extra.precipMm } };
  b.now.conditionReason = f.cond === 'rain' ? 'rain-now' : b.now.conditionReason;
  b.daily = b.daily.map((d, i) => ({ ...d, highC: f.temp + 3 - (i % 2), lowC: f.temp - 6 + (i % 3), rainChance: f.extra.rainChance, conditionKey: f.cond, conditionLabel: f.cond, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.hourly = b.hourly.map((x) => ({ ...x, tempC: f.temp, rainChance: f.extra.rainChance, precipMm: f.extra.precipMm / 3, windKph: f.extra.windKph, condition: f.cond }));
  b.wind_kph = f.extra.windKph; b.gustKph = Math.round(f.extra.windKph * 1.4); b.maxWindKph = b.gustKph;
  b.location = { ...b.location, name: 'Strand' };
  b.meta = { ...b.meta, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: f.cond, sourceAgreement: '4/5' } };
  return b;
};

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, lat: -34.1163, lon: 18.8362, name: 'Strand, Western Cape', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/?home=d`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await webkit.launch();
const results = [];
for (const p of photos) {
  // A daylight slot when the photograph has one: the one Al sees most.
  const slot = p.slots.find((s) => s.includes('/day/')) || p.slots[0];
  const folder = slot.split('/')[0];
  const t = whenFor(slot);
  if (t == null || !FOLDER[folder]) { results.push({ hash: p.hash, slot, skipped: 'no date' }); continue; }
  current = payloadFor(FOLDER[folder], t);
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript((footOnly) => {
    try { localStorage.setItem('lang', JSON.stringify('en')); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {}
    if (footOnly) window.__PW_D_FOOT_ONLY = true;
    // The same line in both runs of a photograph, so a before/after pair differs only in layout.
    let seed = 7;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }, FOOT_ONLY);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(t));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const cap = document.getElementById('headline');
    const r = cap.getBoundingClientRect();
    const photo = getComputedStyle(document.getElementById('heroPhoto')).backgroundImage;
    const pb = parseFloat(getComputedStyle(cap).paddingBottom);
    return { textTop: Math.round(r.top + parseFloat(getComputedStyle(cap).paddingTop)), capBottom: Math.round(r.bottom - pb), statusBottom: Math.round(document.getElementById('weatherStatus').getBoundingClientRect().bottom), lineTop: Math.round(document.getElementById('dLine').getBoundingClientRect().top), line: cap.textContent.trim(), photo, vw: innerWidth, vh: innerHeight, risen: document.body.classList.contains('d-joke-high'), syncs: window.__PW_D?.syncs?.() ?? null };
  });
  await page.waitForTimeout(1500);
  const syncsLater = await page.evaluate(() => window.__PW_D?.syncs?.() ?? null);
  const served = m.photo.includes(p.hash);
  // The subject's centre on this screen: the photograph is `cover` at background-position-y = anchor.
  const scale = Math.max(m.vw / 1008, m.vh / 1792);
  const dh = 1792 * scale;
  const subjectY = Math.round((0.25 + p.anchor / 200) * dh + (m.vh - dh) * (p.anchor / 100));
  const file = `${folder}-${p.hash.slice(0, 8)}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  // Where the subject's centre lands: under the joke's lines, under the credit line and the foot
  // (the dark band the handle and nav sit on), under the title card, or on open photograph.
  const zone = subjectY >= m.textTop && subjectY <= m.capBottom + 8 ? 'joke'
    : subjectY >= m.lineTop ? 'credit line'
    : subjectY < m.statusBottom ? 'title card' : 'open';
  const under = served && zone === 'joke';
  results.push({ hash: p.hash, anchor: p.anchor, slot, served, subjectY, textTop: m.textTop, capBottom: m.capBottom, lineTop: m.lineTop, risen: m.risen, zone, underJoke: under, idleSyncs: syncsLater != null && m.syncs != null ? syncsLater - m.syncs : null, line: m.line, file });
  process.stderr.write(`${file} anchor ${p.anchor} subject y ${subjectY} joke text ${m.textTop}–${m.capBottom}${m.risen ? ' RISEN' : ''} ${served ? '' : 'NOT SERVED'} -> ${zone} (syncs while idle: ${syncsLater - m.syncs})\n`);
  await ctx.close();
}
await browser.close(); server.close();
writeFileSync(path.join(OUT, ONLY.length ? 'pairs.json' : 'subjects.json'), JSON.stringify({ min: MIN, footOnly: FOOT_ONLY, measuredAt: '414x715', results }, null, 1));
const zones = {};
results.filter((r) => r.served).forEach((r) => { zones[r.zone] = (zones[r.zone] || 0) + 1; });
console.log(`[d-subjects${FOOT_ONLY ? ' foot-only' : ''}] ${results.length} photographs with anchor >= ${MIN}; ${results.filter((r) => r.served).length} served as asked; ${results.filter((r) => r.risen).length} with the joke risen; subject centre lands on: ${JSON.stringify(zones)}; most syncs while idle: ${Math.max(...results.map((r) => r.idleSyncs ?? 0))}`);
