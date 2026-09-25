// LAUNCH RUN (2026-09-25) — first weather on a cold visit over slow 4G, phone profiles.
//
//   node review/launch/scripts/speed.mjs [--dist dist] [--tag before] [--runs 3]
//
// The local build is served through a slow-4G link the SERVER imposes (so it works for WebKit as
// well as Chromium): 150 ms before each response's first byte, then every response shares one
// 1.6 Mbit/s pipe (the Lighthouse "slow 4G" numbers the launch eval used). Text is brotli'd like
// Vercel. /api/weather is stubbed with a real production payload after a delay: "cold cell" 1,600 ms
// (what the recorder measured for a production miss from SA) or "edge hit" 80 ms.
// Profiles: Android mid-range (Chromium, 412×915, CPU 4× slower), Al's iPhone 11 in Chrome
// (WebKit, 414×715, no CPU slowdown — the A13 is quicker than a mid-range Android).
// Measures, per run: first weather painted (hero temperature shown and splash gone), when the
// real photo is on screen, LCP (Chromium), bytes, and the request timeline.
// Writes review/launch/results/speed-<tag>.json and .md.
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const TAG = arg('--tag', 'run');
const RUNS = Number(arg('--runs', 3));
// --tls <dir with key.pem + cert.pem>: serve over HTTP/2 like Vercel's edge (one connection, no
// six-connection queue). Without it, HTTP/1.1.
const TLS = arg('--tls', null);
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
const RTT_MS = 150, BYTES_PER_MS = 1.6e6 / 8 / 1000; // 200 bytes per ms

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);
const brCache = new Map();
let API_DELAY = 1600;
let log = [];
let t0 = 0;
// One shared pipe: each chunk waits for its share of the 1.6 Mbit/s.
let pipeFreeAt = 0;
async function sendThrottled(res, code, headers, buf) {
  await new Promise((r) => setTimeout(r, RTT_MS));
  res.writeHead(code, { ...headers, 'Content-Length': buf.length });
  const CH = 8192;
  for (let off = 0; off < buf.length; off += CH) {
    const part = buf.subarray(off, off + CH);
    const now = Date.now();
    const start = Math.max(now, pipeFreeAt);
    pipeFreeAt = start + part.length / BYTES_PER_MS;
    const wait = pipeFreeAt - now;
    if (wait > 1) await new Promise((r) => setTimeout(r, wait));
    res.write(part);
  }
  res.end();
}
const handler = async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);
  const wantsBr = /\bbr\b/.test(req.headers['accept-encoding'] || '');
  const started = Date.now() - t0;
  const done = (bytes) => log.push({ path: p, start: started, end: Date.now() - t0, bytes });
  if (p.startsWith('/api/')) {
    let body = { ok: true };
    if (p === '/api/weather') { await new Promise((r) => setTimeout(r, u.searchParams.get('reverse') ? 60 : API_DELAY)); body = u.searchParams.get('reverse') ? { ok: true, city: 'Strand', admin1: 'Western Cape', countryCode: 'za' } : LIVE; }
    else if (p === '/api/version') body = { version: 'local' };
    else if (p === '/api/locate') body = { ok: true, lat: -34.1, lon: 18.8, name: 'Strand, ZA' };
    const raw = Buffer.from(JSON.stringify(body));
    const buf = wantsBr ? brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } }) : raw;
    await sendThrottled(res, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(wantsBr ? { 'Content-Encoding': 'br' } : {}) }, buf);
    return done(buf.length);
  }
  if (p.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
  const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html', '/favicon.ico': 'assets/favicon-32.png' };
  const file = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf;
  try { buf = readFileSync(file); } catch { res.writeHead(404).end(); return; }
  const ext = path.extname(file);
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (COMPRESSIBLE.has(ext) && wantsBr) {
    if (!brCache.has(file)) brCache.set(file, brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }));
    buf = brCache.get(file); headers['Content-Encoding'] = 'br';
  }
  await sendThrottled(res, 200, headers, buf);
  done(buf.length);
};
const server = TLS ? createSecureServer({ key: readFileSync(path.join(TLS, 'key.pem')), cert: readFileSync(path.join(TLS, 'cert.pem')) }, handler) : createServer(handler);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `${TLS ? 'https' : 'http'}://127.0.0.1:${server.address().port}/`;

const PROFILES = [
  { name: 'Android mid-range', engine: chromium, viewport: { width: 412, height: 915 }, cpu: 4, ua: 'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' },
  { name: "Al's iPhone 11 (Chrome)", engine: webkit, viewport: { width: 414, height: 715 }, cpu: 1, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1' },
];
const browsers = {};
const results = [];
for (const prof of PROFILES) {
  for (const mode of [{ name: 'cold cell', delay: 1600 }, { name: 'edge hit', delay: 80 }]) {
    for (let run = 0; run < RUNS; run++) {
      API_DELAY = mode.delay;
      browsers[prof.name] ??= await prof.engine.launch();
      const ctx = await browsers[prof.name].newContext({ ignoreHTTPSErrors: true, viewport: prof.viewport, isMobile: prof.engine === chromium, hasTouch: true, deviceScaleFactor: 2, userAgent: prof.ua, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], locale: 'en-ZA', timezoneId: 'Africa/Johannesburg' });
      await ctx.addInitScript(() => {
        try { localStorage.setItem('lang', JSON.stringify('en')); } catch {}
        window.__lcp = null;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      });
      const page = await ctx.newPage();
      if (prof.cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu }); }
      log = []; pipeFreeAt = 0; t0 = Date.now();
      await page.goto(BASE, { waitUntil: 'commit' });
      // First weather: the hero shows a temperature and the splash is gone.
      const firstWeather = await page.waitForFunction(() => {
        const s = document.getElementById('pwSplash');
        const gone = !s || s.classList.contains('splash-done') || getComputedStyle(s).opacity === '0' || getComputedStyle(s).display === 'none';
        const temp = document.querySelector('#temp')?.textContent || '';
        return gone && /\d/.test(temp) ? performance.now() : false;
      }, null, { timeout: 30000, polling: 50 }).then((h) => h.jsonValue()).catch(() => null);
      const photo = await page.waitForFunction(() => {
        const img = document.getElementById('bgImg');
        return img && img.complete && img.naturalWidth > 0 && /bg-canonical|\/bg\/(?!default)/.test(img.currentSrc || img.src) ? performance.now() : false;
      }, null, { timeout: 30000, polling: 50 }).then((h) => h.jsonValue()).catch(() => null);
      await page.waitForTimeout(1500);
      const lcp = await page.evaluate(() => window.__lcp);
      const bytes = log.reduce((s, x) => s + x.bytes, 0);
      results.push({ profile: prof.name, mode: mode.name, run, firstWeatherMs: firstWeather && Math.round(firstWeather), photoMs: photo && Math.round(photo), lcpMs: lcp && Math.round(lcp), kb: Math.round(bytes / 1024), requests: log.map((x) => `${x.start}-${x.end} ${x.path} ${Math.round(x.bytes / 1024)}KB`) });
      process.stderr.write(`${prof.name} · ${mode.name} · run ${run + 1}: first weather ${firstWeather && Math.round(firstWeather)} ms, photo ${photo && Math.round(photo)} ms, LCP ${lcp && Math.round(lcp)}, ${Math.round(bytes / 1024)} KB\n`);
      await ctx.close();
    }
  }
}
for (const b of Object.values(browsers)) await b.close();
server.close();

const med = (a) => { const v = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
const md = [`# First weather on slow 4G — ${TAG} (${new Date().toISOString()})`, '', `Local build over ${TLS ? "HTTP/2 (like Vercel's edge)" : 'HTTP/1.1'} through a server-imposed slow-4G link (150 ms per response + one shared 1.6 Mbit/s pipe), brotli like Vercel; /api/weather stubbed with a real payload after 1,600 ms (cold cell) or 80 ms (edge hit). Median of ${RUNS} cold visits (fresh browser profile each).`, '',
  '| phone | forecast | first weather | real photo on screen | LCP | downloaded |', '|---|---|---:|---:|---:|---:|'];
for (const prof of PROFILES) for (const mode of ['cold cell', 'edge hit']) {
  const rs = results.filter((r) => r.profile === prof.name && r.mode === mode);
  md.push(`| ${prof.name} | ${mode} | ${(med(rs.map((r) => r.firstWeatherMs)) / 1000).toFixed(1)} s | ${(med(rs.map((r) => r.photoMs)) / 1000).toFixed(1)} s | ${med(rs.map((r) => r.lcpMs)) != null ? (med(rs.map((r) => r.lcpMs)) / 1000).toFixed(1) + ' s' : '— (WebKit)'} | ${med(rs.map((r) => r.kb))} KB |`);
}
md.push('', 'Request timeline of the first Android cold-cell run (ms from navigation):', '', ...results[0].requests.map((l) => `- ${l}`));
mkdirSync('review/launch/results', { recursive: true });
writeFileSync(`review/launch/results/speed-${TAG}.json`, JSON.stringify(results, null, 1));
writeFileSync(`review/launch/results/speed-${TAG}.md`, md.join('\n') + '\n');
console.log(md.join('\n'));
