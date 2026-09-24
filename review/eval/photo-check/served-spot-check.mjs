// Photo check, part 1 proof (2026-09-24): the running app loads the photograph the rotation table
// (data/rotation.json, from the app's picker + the build's manifest) says it will, and puts one of
// that photograph's own lines on it. Real build, WebKit, Al's phone size, clock pinned per case.
//
//   node review/eval/photo-check/served-spot-check.mjs
import { webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'review/eval/photo-check';
const P = await import(pathToFileURL(path.resolve('assets/image-picker.js')).href);
const HL = (await import(pathToFileURL(path.resolve('assets/hero-lines.js')).href)).HERO_LINES;
const rot = JSON.parse(readFileSync(`${OUT}/data/rotation.json`, 'utf8'));
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
// Times inside each solar window for sunrise 06:00, sunset 18:30 (the payload below).
const HOUR = { dawn: 5.75, day: 12, dusk: 18.25, night: 22 };
const CASES = [
  ['clear', 1, 'day', 4], ['clear', 2, 'night', 5], ['uv', 3, 'day', 6], ['cloudy', 1, 'dusk', 2],
  ['cloudy', 3, 'dawn', 5], ['partly-cloudy', 2, 'night', 3], ['rain', 2, 'day', 3], ['storm', 4, 'dusk', 7],
  ['cold', 1, 'day', 2], ['cold', 2, 'dusk', 2], ['cold-clear', 4, 'day', 6], ['fog', 3, 'dawn', 1],
  ['heat', 2, 'day', 5], ['wind', 1, 'night', 7], ['thunder', 3, 'day', 1], ['rain-possible', 4, 'day', 3],
];
const whenFor = (week, weekday, hour) => {
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== week) continue;
    const t = P.WEEK_ANCHOR_MS + k * P.WEEK_MS + (weekday - 1) * P.DAY_MS + hour * 3600e3;
    if (P.getRotationWeek(t) === week && P.getRotationDay(t) === weekday) return t;
  }
  throw new Error('no date');
};
let current = null;
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true,"lat":-34.1163,"lon":18.8362,"name":"Strand, Western Cape","results":[]}');
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve('dist', p === '/' ? 'index.html' : p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await webkit.launch();
const rows = [];
for (const [cond, week, time, r] of CASES) {
  const t = whenFor(week, r, HOUR[time]);
  const local = new Date(t + 7200e3);
  const day = local.toISOString().slice(0, 10);
  const b = structuredClone(LIVE);
  const temp = { heat: 36, cold: 8, 'cold-clear': 4, fog: 11 }[cond] ?? 18;
  const wet = /^(rain|storm|thunder)$/.test(cond);
  const grey = /cloudy|rain|storm|thunder|fog|cold$/.test(cond);
  Object.assign(b.now, { tempC: temp, conditionKey: cond, conditionLabel: cond, isDay: time === 'day', windKph: cond === 'wind' ? 42 : 8, rainChance: wet ? 90 : cond === 'rain-possible' ? 40 : 2, precipMm: wet ? 3 : 0, cloudPct: grey ? 95 : cond === 'partly-cloudy' ? 50 : 3, uv: cond === 'uv' ? 10 : 2, sunrise: `${day}T06:00`, sunset: `${day}T18:30` });
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: /rain|storm|thunder/.test(cond) ? 4 : 0, precipMm: 3 } };
  b.daily = b.daily.map((d) => ({ ...d, conditionKey: cond, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.sunrise = `${day}T06:00`; b.sunset = `${day}T18:30`;
  b.meta = { ...b.meta, localHour: local.getUTCHours(), utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), finalCondition: cond } };
  current = b;
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('lang', JSON.stringify('en')); localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(t));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const got = await page.evaluate(() => ({ src: document.getElementById('bgImg').currentSrc, loaded: document.getElementById('bgImg').naturalWidth > 0, caption: document.getElementById('headline').textContent.trim(), display: window.__PW_LAST_DISPLAY }));
  const hash = (got.src.match(/bg-canonical\/([0-9a-f]{64})/) || [])[1] || null;
  // Compared with the table row for the condition the app actually displayed (its own weather
  // resolution may differ from the stub's key; the picker follows the display).
  const shown = got.display || cond;
  const want = rot.servedTable.find((x) => x.cond === shown && x.week === week && x.time === time && x.r === r);
  const own = HL[`bg-canonical/${hash}.webp`] || [];
  rows.push({ asked: cond, display: shown, week, time, r, slot: want?.slot, predicted: want?.hash?.slice(0, 12), served: hash?.slice(0, 12), match: !!want && want.hash === hash, loaded: got.loaded, caption: got.caption, captionIsOwnLine: own.includes(got.caption), ownLines: own.length });
  process.stderr.write(`${cond}→${shown} w${week} ${time} ${r}: ${want?.hash === hash ? 'MATCH' : 'MISMATCH'} ${got.loaded ? 'loaded' : 'NOT LOADED'} "${got.caption.slice(0, 50)}" ${own.includes(got.caption) ? '(own line)' : own.length ? '(NOT one of its lines)' : '(bank: no own lines)'}\n`);
  await ctx.close();
}
await browser.close(); server.close();
writeFileSync(`${OUT}/data/served-spot-check.json`, JSON.stringify(rows, null, 1));
console.log(`[spot] ${rows.filter((x) => x.match).length}/${rows.length} served as the table says; ${rows.filter((x) => x.loaded).length} loaded; ${rows.filter((x) => x.captionIsOwnLine).length} captions are the photo's own line`);
