// Computed styles of Home's data column on the built app (dist), phone 414x715.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const dist = path.resolve(process.argv[2] || 'dist');
const q = process.argv[3] || '';
const LIVE = readFileSync('review/eval/data/live-strand.json');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(LIVE);
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
  let b; try { b = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(b);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', '{}'); } catch {} });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${server.address().port}/${q}`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const pick = ['display', 'flexDirection', 'fontSize', 'fontWeight', 'lineHeight', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'paddingLeft', 'color', 'background', 'position', 'whiteSpace', 'overflow', 'textOverflow', 'gap'];
  const o = {};
  for (const s of ['main#home-screen', '#weatherStatus', '#temp', '#temp .hero-probably', '#temp .hero-now', '#description', '#rangeLine', '#agreeLine', '.stats-band', '#statsRow', '#statsRow .stat', '#statsRow .stat-k', '#statsRow .stat-v', '#statsRow .stat-sub', '#homeHourly', '.hero-card', '#headline', '.nav', '.header']) {
    const e = document.querySelector(s); if (!e) { o[s] = null; continue; }
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    o[s] = Object.fromEntries([...pick.map((k) => [k, cs[k]]), ['box', `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`]].filter(([k, v]) => v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'visible' && v !== 'static'));
  }
  return o;
});
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(22), JSON.stringify(v).slice(0, 330));
await b.close(); server.close();
