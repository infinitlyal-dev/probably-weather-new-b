// Launch eval (2026-09-23): the 7 photographs Al's season ruling left with no line of their own
// must still carry a caption — a condition-bank line — in the real app, never a blank.
//
//   node review/eval/scripts/bare-photos.mjs [--dist dist] [--out review/eval/shots/bare]
//
// For every bare photograph, every slot it occupies: the clock is pinned to a moment in that slot's
// rotation week, SAST weekday and time of day, the API is stubbed with the slot's condition (cold or
// cold-clear), and the built app is opened at 414x715 in English, Afrikaans and isiZulu. PASS for a
// run = the photograph on screen is this one (sha256 of the slot file in the served URL) and the
// caption is non-empty and is not one of the photograph's former lines.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/bare');
mkdirSync(OUT, { recursive: true });
const final = JSON.parse(readFileSync('review/set-001-lines-bespoke-final.json', 'utf8'));
const draft = JSON.parse(readFileSync('review/set-001-draft.json', 'utf8'));
const slotsByHash = new Map(draft.assignments.map((a) => [a.hash, [...new Set([a.image, ...(a.paths || [])])]]));
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));

// Local SAST clock time for each photograph time slot, with sunrise 06:00 and sunset 18:30.
const HOUR = { dawn: 6, day: 12, dusk: 18.25, night: 22 };
const whenFor = (week, weekday, time) => {
  for (let k = 20; k < 60; k++) {           // a week from October 2026 on with the right rotation week
    if ((k % 4) + 1 !== week) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + (weekday - 1) * DAY_MS + HOUR[time] * 3600e3;
    if (getRotationWeek(t) === week && getRotationDay(t) === weekday) return t;
  }
  throw new Error('no date');
};
const payloadFor = (cond, t) => {
  const b = structuredClone(LIVE);
  const local = new Date(t + 7200e3);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  const clear = cond === 'cold-clear';
  Object.assign(b.now, { tempC: 5, feelsLikeC: 2, rainChance: 3, precipMm: 0, windKph: 8, cloudPct: clear ? 5 : 92, uv: HOUR.day === hour ? 3 : 0,
    conditionKey: cond, conditionLabel: clear ? 'Clear' : 'Overcast', isDay: hour >= 6 && hour < 18 });
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: [] };
  b.daily = b.daily.map((d, i) => ({ ...d, highC: 11, lowC: 1, rainChance: 3, conditionKey: cond, conditionLabel: clear ? 'Clear' : 'Overcast',
    sunrise: `${i ? day : day}T06:00`, sunset: `${day}T18:30` }));
  b.meta = { ...b.meta, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: cond } };
  return b;
};

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, city: 'Strand', admin1: 'Western Cape', lat: -34.1163, lon: 18.8362, name: 'Strand, Western Cape', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const file = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf; try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  return res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const rows = [];
for (const b of final.awaitingLines || []) {
  const former = new Set(b.cutLines || b.lines || []);
  for (const slot of slotsByHash.get(b.hash) || [b.image]) {
    const [cond, wk, time, file] = slot.split('/');
    const week = Number(wk.replace('week_', '')), weekday = Number(file.replace('.webp', ''));
    const t = whenFor(week, weekday, time);
    current = payloadFor(cond, t);
    const sha = createHash('sha256').update(readFileSync(path.join('assets/images/bg', slot))).digest('hex');
    for (const lang of ['en', 'af', 'zu']) {
      const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
        geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg', serviceWorkers: 'block' });
      await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); localStorage.setItem('pw_install_dismissed_until', String(9e15)); } catch {} }, lang);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(new Date(t));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const s = await page.evaluate(() => ({ caption: document.querySelector('#headline')?.textContent?.trim() || '', bg: document.querySelector('#bgImg')?.currentSrc || document.querySelector('#bgImg')?.getAttribute('src') || '', display: window.__PW_LAST_DISPLAY }));
      const onPhoto = s.bg.includes(sha) || s.bg.includes(slot);
      const ok = onPhoto && s.caption.length > 0 && !former.has(s.caption);
      const f = `${b.hash}-${slot.replace(/\//g, '_').replace('.webp', '')}-${lang}.png`;
      await page.screenshot({ path: path.join(OUT, f) });
      rows.push({ photo: b.image, hash: b.hash, slot, lang, at: new Date(t).toISOString(), display: s.display, onPhoto, caption: s.caption, ok, shot: f });
      process.stderr.write(`${ok ? 'PASS' : 'FAIL'} ${slot} ${lang} ${onPhoto ? 'photo✓' : 'photo✗ ' + s.bg.slice(-80)} "${s.caption.slice(0, 70)}"\n`);
      await ctx.close();
    }
  }
}
await browser.close();
server.close();
writeFileSync(path.join(OUT, 'bare-photos.json'), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
const fails = rows.filter((r) => !r.ok);
console.log(`[bare] ${rows.length - fails.length}/${rows.length} runs PASS (7 photographs × every slot × en/af/zu) → ${OUT}/bare-photos.json`);
process.exit(fails.length ? 1 : 0);
