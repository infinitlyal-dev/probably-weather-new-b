// LAUNCH RUN (2026-09-25) — what one visit costs: API calls by route, and bytes by type.
//
//   node review/launch/scripts/visit-cost.mjs [--dist dist] [--tag before] [--payload review/eval/data/live-strand.json]
//
// Serves the local build with a stub /api that logs every call (so no provider is touched), and
// compresses text the way Vercel does (brotli when the browser asks), so the byte counts are the
// bytes a phone would download. Chromium, phone 414x715. Scenarios:
//   first-gps      first ever visit, location allowed (Strand)
//   return         the same phone opening the app again (service worker and caches warm)
//   first-denied   first ever visit, location refused (IP fallback)
//   search         open, search "Durban" letter by letter, pick it
//   browse         open, then Hourly, Week, a day, back Home
// Writes review/launch/results/visit-cost-<tag>.json and .md.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const TAG = arg('--tag', 'run');
const OUT = 'review/launch/results';
const LIVE = JSON.parse(readFileSync(arg('--payload', 'review/eval/data/live-strand.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt', '.xml']);
const brCache = new Map();
let apiLog = [];
const json = (req, res, code, body) => {
  const buf = Buffer.from(JSON.stringify(body));
  const br = /\bbr\b/.test(req.headers['accept-encoding'] || '');
  const out = br ? brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } }) : buf;
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(br ? { 'Content-Encoding': 'br' } : {}) }).end(out);
};
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  if (p.startsWith('/api/')) {
    const q = Object.fromEntries(u.searchParams);
    apiLog.push({ route: p, q, at: Date.now() });
    if (p === '/api/weather') {
      if (q.reverse) return json(req, res, 200, { ok: true, city: 'Strand', admin1: 'Western Cape', countryCode: 'za' });
      return json(req, res, 200, LIVE);
    }
    if (p === '/api/locate') return json(req, res, 200, { ok: true, lat: -34.1, lon: 18.8, name: 'Strand, ZA' });
    if (p === '/api/geocode') {
      if (q.type === 'reverse') return json(req, res, 200, { ok: true, name: 'Strand, Western Cape' });
      return json(req, res, 200, { ok: true, results: /^d/i.test(q.q || '') ? [{ name: 'Durban', display_name: 'Durban, eThekwini, KwaZulu-Natal, South Africa', lat: '-29.8587', lon: '31.0218', address: { city: 'Durban', country: 'South Africa' } }] : [] });
    }
    if (p === '/api/version') return json(req, res, 200, { version: 'local' });
    return json(req, res, 200, { ok: true });
  }
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html', '/favicon.ico': 'assets/favicon-32.png' };
  const file = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf;
  try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  const ext = path.extname(file);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (COMPRESSIBLE.has(ext) && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
    if (!brCache.has(file)) brCache.set(file, brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }));
    buf = brCache.get(file); headers['Content-Encoding'] = 'br';
  }
  return res.writeHead(200, headers).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

const typeOf = (url, mime) => {
  const u = new URL(url); const p = u.pathname;
  if (p.startsWith('/api/')) return 'api';
  if (/\.(webp|jpg|jpeg|png|gif|svg|avif)$/i.test(p) || /^image\//.test(mime || '')) return 'image';
  if (/\.woff2?$/i.test(p) || /font/.test(mime || '')) return 'font';
  if (/\.js$/i.test(p)) return 'script';
  if (/\.css$/i.test(p)) return 'style';
  if (p === '/' || /\.html$/i.test(p)) return 'html';
  return 'other';
};

async function withPage(ctx, fn) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const reqs = new Map(); const done = [];
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url }));
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.mime = e.response.mimeType; r.fromSW = e.response.fromServiceWorker; r.fromCache = e.response.fromDiskCache; r.status = e.response.status; } });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; done.push(r); } });
  await fn(page);
  await page.waitForTimeout(500);
  await page.close();
  // Bytes that crossed the network: service-worker and memory/disk cache answers cost ~0.
  const byType = {}; let total = 0; let requests = 0;
  for (const r of done) {
    if (!r.url.startsWith(BASE)) continue;
    const t = typeOf(r.url, r.mime);
    const b = (r.fromSW || r.fromCache) ? 0 : (r.bytes || 0);
    byType[t] = (byType[t] || 0) + b; total += b; if (b > 0) requests++;
  }
  return { byType, total, requests, urls: done.filter((r) => r.url.startsWith(BASE) && !(r.fromSW || r.fromCache) && (r.bytes || 0) > 0).map((r) => `${new URL(r.url).pathname} ${r.bytes}`) };
}

const newCtx = (permissions) => browser.newContext({
  viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions, locale: 'en-ZA', timezoneId: 'Africa/Johannesburg',
});
const settle = (page, ms = 6000) => page.waitForTimeout(ms);
const results = [];
async function scenario(name, permissions, run) {
  const ctx = await newCtx(permissions);
  await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('en')); } catch {} });
  apiLog = [];
  const out = await run(ctx);
  const api = apiLog.map((c) => ({ route: c.route, q: c.q }));
  results.push({ name, api, ...out });
  await ctx.close();
  process.stderr.write(`${name}: ${api.length} API calls, ${Math.round((out.bytes?.total ?? 0) / 1024)} KB\n`);
}

await scenario('first-gps', ['geolocation'], async (ctx) => ({ bytes: await withPage(ctx, async (page) => { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 8000); }) }));

await scenario('return', ['geolocation'], async (ctx) => {
  await withPage(ctx, async (page) => { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 8000); });
  apiLog = [];
  return { bytes: await withPage(ctx, async (page) => { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 6000); }) };
});

await scenario('first-denied', [], async (ctx) => ({ bytes: await withPage(ctx, async (page) => { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 8000); }) }));

await scenario('search', ['geolocation'], async (ctx) => ({ bytes: await withPage(ctx, async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 6000);
  await page.locator('#navSearch').click(); await page.waitForTimeout(600);
  await page.locator('#searchInput').pressSequentially('Durban', { delay: 180 });
  await page.waitForTimeout(2500);
  const first = page.locator('#searchResults li').first();
  if (await first.count()) { await first.click(); await settle(page, 5000); }
}) }));

await scenario('browse', ['geolocation'], async (ctx) => ({ bytes: await withPage(ctx, async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 6000);
  for (const sel of ['#homeHourly', '#navWeek']) { await page.locator(sel).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); }
  const day = page.locator('#weekList li, .week-card, [data-day-index]').first();
  if (await day.count()) { await day.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); }
  await page.locator('#navHome').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500);
}) }));

await browser.close(); server.close();

const md = [`# Visit cost — ${TAG} (${new Date().toISOString()})`, '', 'Local build, stub API (no provider touched), brotli like Vercel, Chromium phone 414x715.', '',
  '| scenario | API calls | calls by route | bytes over the network | requests |', '|---|---:|---|---:|---:|'];
for (const r of results) {
  const by = {}; for (const c of r.api) { const k = c.route + (c.q.reverse ? '?reverse' : c.q.type ? `?${c.q.type}` : ''); by[k] = (by[k] || 0) + 1; }
  md.push(`| ${r.name} | ${r.api.length} | ${Object.entries(by).map(([k, v]) => `${k} ×${v}`).join(', ')} | ${Math.round(r.bytes.total / 1024)} KB (${Object.entries(r.bytes.byType).map(([k, v]) => `${k} ${Math.round(v / 1024)}`).join(', ')}) | ${r.bytes.requests} |`);
}
md.push('', 'Every API call, in order:', '');
for (const r of results) md.push(`- **${r.name}**: ${r.api.map((c) => `${c.route}?${new URLSearchParams(c.q)}`).join(' → ') || '(none)'}`);
writeFileSync(path.join(OUT, `visit-cost-${TAG}.json`), JSON.stringify(results, null, 1));
writeFileSync(path.join(OUT, `visit-cost-${TAG}.md`), md.join('\n') + '\n');
console.log(md.join('\n'));
