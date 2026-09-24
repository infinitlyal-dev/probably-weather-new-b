// Launch eval: measure Home geometry on the built app (dist) with a real captured payload.
//   node review/eval/scripts/geometry.mjs <out.json> [width height]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [out, w = '414', h = '715'] = process.argv.slice(2);
const dist = path.resolve('dist');
const LIVE = readFileSync('review/eval/data/live-strand.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(LIVE);
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1));
  let b; try { b = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(b);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, isMobile: true, hasTouch: true, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg', serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', '{}'); } catch {} });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-09-23T10:00:00Z'));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 20000 });
await page.waitForTimeout(1500);
const g = await page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), height: +b.height.toFixed(2), left: +b.left.toFixed(2), width: +b.width.toFixed(2) }; };
  const agree = document.querySelector('#agreeLine');
  const range = document.createRange(); range.selectNodeContents(agree); const t = range.getBoundingClientRect();
  return { agreeBox: r('#agreeLine'), agreeText: { top: +t.top.toFixed(2), bottom: +t.bottom.toFixed(2) }, stats: r('#statsRow'), band: r('.stats-band'), hourly: r('#homeHourly'), temp: r('#temp'), desc: r('#description'), range: r('#rangeLine'), nav: r('.nav') };
});
writeFileSync(out, JSON.stringify(g, null, 1));
console.log(JSON.stringify(g));
await browser.close(); server.close();
