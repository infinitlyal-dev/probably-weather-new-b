// Does the branch preview show real weather, and does the reveal run on the deployed build?
//
//   node review/reveal/preview-check.mjs <preview-url> [--out review/reveal-for-al/data]
//
// 1. The preview's /api/weather for Strand beside production's (same place, same minute): which sources
//    answered, the temperature, the condition.
// 2. The preview itself in WebKit at 414x715, a real clock and the real API: the photograph lands, the
//    beat, the joke written — marks from the page, a screenshot before and after.
import { webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PREVIEW = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\//.test(PREVIEW)) { console.error('usage: preview-check.mjs <https://preview-url>'); process.exit(2); }
const i = process.argv.indexOf('--out');
const OUT = i > 0 ? process.argv[i + 1] : 'review/reveal-for-al/data';
mkdirSync(OUT, { recursive: true });
const LAT = -34.1163, LON = 18.8362;
const api = async (base) => {
  const r = await fetch(`${base}/api/weather?lat=${LAT}&lon=${LON}&name=Strand`, { headers: { 'user-agent': 'pw-reveal-preview-check' } });
  const j = await r.json().catch(() => null);
  const sources = (j?.meta?.sources || []).map((s) => `${s.name || s.id || s.source}:${s.ok ? 'ok' : 'off'}`);
  return { status: r.status, tempC: j?.now?.tempC ?? null, condition: j?.now?.conditionKey ?? null, sources, schema: j?.meta?.schema ?? null, cache: r.headers.get('x-vercel-cache') };
};
const out = { checkedAt: new Date().toISOString(), preview: PREVIEW };
out.previewApi = await api(PREVIEW);
out.productionApi = await api('https://www.probablyweather.co.za');
out.version = await fetch(`${PREVIEW}/api/version`).then((r) => r.json()).catch(() => null);
console.log('preview   ', JSON.stringify(out.previewApi));
console.log('production', JSON.stringify(out.productionApi));
console.log('version   ', JSON.stringify(out.version));

const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'Africa/Johannesburg', geolocation: { latitude: LAT, longitude: LON }, permissions: ['geolocation'] });
await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${PREVIEW}/?home=d&reveal=ink&beat=1&replay=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 45000 });
await page.screenshot({ path: path.join(OUT, 'preview-beat.png') });
await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'preview-written.png') });
out.page = await page.evaluate(() => ({
  temp: document.querySelector('#temp .hero-now')?.textContent,
  condition: document.getElementById('description')?.textContent,
  place: document.getElementById('location')?.textContent,
  joke: document.getElementById('headline')?.textContent,
  credit: document.getElementById('dLine')?.textContent,
  marks: window.__PW_D.reveal.marks.map((m) => [m.what, m.at]),
  photo: document.getElementById('bgImg')?.currentSrc?.split('/').slice(-4).join('/'),
}));
out.page.errors = errors;
await browser.close();
console.log('page      ', JSON.stringify(out.page));
writeFileSync(path.join(OUT, 'preview-check.json'), `${JSON.stringify(out, null, 1)}\n`);
