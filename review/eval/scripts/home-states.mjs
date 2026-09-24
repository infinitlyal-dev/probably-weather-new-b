// Launch eval, step 4 (2026-09-24): Home in the states the brief names, at Al's phone size, rendered
// from a real build — for "current" and for each proposed direction, the same photograph and the same
// caption, so the only difference in a pair is the layout.
//
//   node review/eval/scripts/home-states.mjs --dist <dist> --out <dir> [--home a|b|c] [--captions <json>]
//
// Phone = WebKit (Chrome on iPhone is WebKit), 414x715 at DPR 2 (Al's iPhone 11 with Chrome's bars —
// an estimate), plus desktop 1440x900 in Chromium. The API is stubbed from a real production payload
// re-dressed for each state; the clock is pinned to a moment whose rotation week, SAST weekday and time
// slot pick the named photograph. --captions: the file written by the "current" run; a variant run
// puts exactly those caption texts on screen so a pair differs only in layout.
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WEEK_ANCHOR_MS, WEEK_MS, DAY_MS, getRotationDay, getRotationWeek } from '../../../assets/image-picker.js';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/home/current');
const HOME = arg('--home', '');
const CAPTIONS_IN = arg('--captions', '');
const ONLY = arg('--only', '');
mkdirSync(OUT, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));

const longest = (lang) => {
  const src = readFileSync(path.join('assets', 'copy', `${lang}.js`), 'utf8');
  const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  const lines = [];
  const walk = (n) => { if (typeof n === 'string') lines.push(n); else if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') Object.values(n).forEach(walk); };
  walk(bank.witty || {});
  return lines.sort((a, b) => b.length - a.length)[0];
};

// state: condition key for the payload, the slot whose photograph it must show, the clock hour, language, extras
const STATES = [
  { id: 'rain-day', cond: 'rain', slot: 'rain/week_1/day/3.webp', hour: 12, temp: 14, extra: { rainChance: 85, precipMm: 3.2, cloudPct: 100, windKph: 22 }, label: 'Rain' },
  { id: 'clear-day', cond: 'clear', slot: 'clear/week_1/day/4.webp', hour: 12, temp: 24, extra: { rainChance: 2, precipMm: 0, cloudPct: 4, windKph: 12, uv: 8 }, label: 'Clear' },
  { id: 'night', cond: 'clear', slot: 'clear/week_2/night/5.webp', hour: 22, temp: 12, extra: { rainChance: 1, precipMm: 0, cloudPct: 5, windKph: 6, uv: 0 }, label: 'Clear' },
  { id: 'fog', cond: 'fog', slot: 'fog/week_2/day/2.webp', hour: 9, temp: 11, extra: { rainChance: 10, precipMm: 0, cloudPct: 100, windKph: 4, humidity: 99 }, label: 'Fog' },
  { id: 'pale-photo', cond: 'cold', slot: 'cold/week_1/day/7.webp', hour: 12, temp: 9, extra: { rainChance: 5, precipMm: 0, cloudPct: 60, windKph: 10 }, label: 'Cold' },
  { id: 'zu-longest', cond: 'cloudy', slot: 'cloudy/week_1/day/1.webp', hour: 12, temp: 17, lang: 'zu', caption: longest('zu'), extra: { rainChance: 20, precipMm: 0, cloudPct: 90, windKph: 18 }, label: 'Cloudy' },
  { id: 'first-visit', cond: 'clear', slot: 'clear/week_1/day/4.webp', hour: 12, temp: 24, firstVisit: true, extra: { rainChance: 2, precipMm: 0, cloudPct: 4, windKph: 12, uv: 8 }, label: 'Clear' },
  { id: 'desktop', cond: 'clear', slot: 'clear/week_1/day/4.webp', hour: 12, temp: 24, desktop: true, extra: { rainChance: 2, precipMm: 0, cloudPct: 4, windKph: 12, uv: 8 }, label: 'Clear' },
  // Opt-in (named in --only): a Cape Doctor day in Strand — the safety banner must still read as one.
  { id: 'wind-warning', optIn: true, cond: 'wind', slot: 'wind/week_1/day/2.webp', hour: 12, temp: 18, extra: { rainChance: 5, precipMm: 0, cloudPct: 20, windKph: 56 }, label: 'Windy' },
].filter((s) => (ONLY ? ONLY.split(',').includes(s.id) : !s.optIn));

const SLOT_HOUR = { dawn: 6, day: 12, dusk: 18.25, night: 22 };
const whenFor = (slot, hour) => {
  const [, wk, time, file] = slot.split('/');
  const week = Number(wk.replace('week_', '')), weekday = Number(file.replace('.webp', ''));
  const h = hour ?? SLOT_HOUR[time];
  for (let k = 20; k < 60; k++) {
    if ((k % 4) + 1 !== week) continue;
    const t = WEEK_ANCHOR_MS + k * WEEK_MS + (weekday - 1) * DAY_MS + h * 3600e3;
    if (getRotationWeek(t) === week && getRotationDay(t) === weekday) return t;
  }
  throw new Error(`no date for ${slot}`);
};
const payloadFor = (s, t) => {
  const b = structuredClone(LIVE);
  const local = new Date(t + 7200e3);
  const day = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  Object.assign(b.now, { tempC: s.temp, feelsLikeC: s.temp - 1, humidity: 70, uv: 0, conditionKey: s.cond, conditionLabel: s.label, isDay: hour >= 6 && hour < 18, windDir: 200 }, s.extra);
  b.now.conditionSignals = { ...(b.now.conditionSignals || {}), overrides: s.cond === 'rain' ? [{ kind: 'rain-now' }] : [], numeric: { ...(b.now.conditionSignals?.numeric || {}), rainVotes: s.cond === 'rain' ? 4 : 0, precipMm: s.extra.precipMm } };
  b.now.conditionReason = s.cond === 'rain' ? 'rain-now' : b.now.conditionReason;
  b.daily = b.daily.map((d, i) => ({ ...d, highC: s.temp + 3 - (i % 2), lowC: s.temp - 6 + (i % 3), rainChance: s.extra.rainChance, conditionKey: s.cond, conditionLabel: s.label, sunrise: `${day}T06:00`, sunset: `${day}T18:30` }));
  b.hourly = b.hourly.map((x, i) => ({ ...x, tempC: s.temp - 3 + Math.round(4 * Math.sin((i - 6) / 24 * 2 * Math.PI)), rainChance: s.extra.rainChance, precipMm: s.extra.precipMm / 3, windKph: s.extra.windKph, condition: s.cond }));
  b.wind_kph = s.extra.windKph; b.gustKph = Math.round(s.extra.windKph * 1.6); b.maxWindKph = b.gustKph;
  b.location = { ...b.location, name: 'Strand' };
  b.meta = { ...b.meta, localHour: hour, utcOffsetSeconds: 7200, confidence: 'high', conditionConfidence: { ...(b.meta.conditionConfidence || {}), level: 'high', finalCondition: s.cond, sourceAgreement: '4/5' } };
  return b;
};

let current = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(current));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, city: 'Strand', admin1: 'Western Cape', lat: -34.1163, lon: 18.8362, name: 'Strand, Western Cape', results: [] }));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/${HOME ? `?home=${HOME}` : ''}`;
const capsIn = CAPTIONS_IN && existsSync(CAPTIONS_IN) ? JSON.parse(readFileSync(CAPTIONS_IN, 'utf8')) : null;
const caps = {};
const metrics = {};
const IOS_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const phone = await webkit.launch();
const desk = await chromium.launch();
for (const s of STATES) {
  const t = whenFor(s.slot, s.hour);
  current = payloadFor(s, t);
  const browser = s.desktop ? desk : phone;
  const ctx = await browser.newContext(s.desktop
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' }
    : { viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IOS_CHROME_UA, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
  await ctx.addInitScript(({ lang, firstVisit }) => {
    try {
      localStorage.setItem('lang', JSON.stringify(lang));
      if (!firstVisit) { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); }
    } catch {}
    let seed = 7;   // the same caption draw in every run of a state
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }, { lang: s.lang || 'en', firstVisit: !!s.firstVisit });
  const page = await ctx.newPage();
  // A frozen clock never lets the install banner's engagement timer elapse, so the first-visit
  // state gets a clock that is installed at the slot's moment and then run forward.
  if (s.firstVisit) await page.clock.install({ time: new Date(t) });
  else await page.clock.setFixedTime(new Date(t));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  if (s.firstVisit) { await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {}); await page.clock.runFor(9000); }
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
  if (s.firstVisit) await page.waitForFunction(() => { const b = document.getElementById('installBanner'); return b && !b.classList.contains('hidden'); }, null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(900);
  const want = s.caption || capsIn?.[s.id];
  if (want) await page.evaluate((c) => { const h = document.getElementById('headline'); if (h) h.textContent = c; window.dispatchEvent(new Event('resize')); }, want);
  await page.waitForTimeout(400);
  caps[s.id] = await page.evaluate(() => document.getElementById('headline')?.textContent?.trim() || '');
  metrics[s.id] = await page.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) } : null; };
    const img = document.querySelector('#bgImg');
    return { vh: innerHeight, photo: r('#heroPhoto') || r('#bgImg'), caption: r('#headline'), temp: r('#temp'), tempPx: parseFloat(getComputedStyle(document.getElementById('temp') || document.body).fontSize), stats: r('#statsRow'), nav: r('.nav'), src: img?.currentSrc?.split('/').pop()?.slice(0, 16), display: window.__PW_LAST_DISPLAY, scrollH: document.scrollingElement.scrollHeight };
  });
  await page.screenshot({ path: path.join(OUT, `${s.id}.png`) });
  // D (2026-09-24): the picture its Share sends, drawn by the page, and — on the rain state — the
  // panel pulled up by a real tap on the handle.
  if (HOME === 'd' && !s.desktop) {
    await page.waitForTimeout(900);
    const shot = await page.evaluate(() => window.__PW_D?.shareImage?.()).catch(() => null);
    if (shot) writeFileSync(path.join(OUT, `${s.id}-share.jpg`), Buffer.from(shot.split(',')[1], 'base64'));
    if (s.id === 'rain-day') {
      await page.tap('#dHandle');
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `${s.id}-panel.png`) });
      metrics[`${s.id}-panel`] = await page.evaluate(() => ({ open: document.body.classList.contains('d-sheet-open'), expanded: document.getElementById('dHandle')?.getAttribute('aria-expanded'), hours: document.querySelectorAll('#dSheet .d-hour').length, days: document.querySelectorAll('#dSheet .daily-row').length, ads: document.querySelectorAll('#dSheet .pw-ad-slot, #dSheet .ad-slot').length }));
    }
  }
  if (!s.desktop) {  // and the rest of Home, if the layout scrolls
    const scrolled = await page.evaluate(() => { const els = [document.scrollingElement, document.body, document.querySelector('main')]; let moved = false; for (const e of els) if (e && e.scrollHeight > e.clientHeight + 4) { e.scrollTop = e.scrollHeight; moved = true; } return moved; });
    if (scrolled) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${s.id}-scrolled.png`) }); }
  }
  process.stderr.write(`${HOME || 'current'} ${s.id}: ${metrics[s.id].display} ${metrics[s.id].src} caption "${caps[s.id].slice(0, 60)}"\n`);
  await ctx.close();
}
await phone.close(); await desk.close(); server.close();
// merged, so a run of one state does not erase the others
const merge = (file, add) => { const p = path.join(OUT, file); const old = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}; writeFileSync(p, JSON.stringify({ ...old, ...add }, null, 1)); };
merge('captions.json', caps);
merge('metrics.json', metrics);
console.log(`[home-states] ${STATES.length} states → ${OUT}`);
