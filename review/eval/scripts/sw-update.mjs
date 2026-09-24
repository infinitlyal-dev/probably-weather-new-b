// Launch eval (2026-09-23): does an open (or installed) app pick up a new deploy?
//
//   node review/eval/scripts/sw-update.mjs [--dist dist] [--out review/eval/shots/sw-update]
//
// Serves the built app with sw.js stamped "build-A" (the build stamps the commit SHA there on Vercel, so
// every deploy changes the worker's bytes). Opens it, reloads once so the worker controls the page, then
// "deploys" build-B (same files, new stamp), makes the tab hidden and visible again the way a phone does
// when the app is reopened, and records what the page does: a new worker installing, taking control, the
// page reloading itself, the "Updated" toast, and which build ends up in control.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/sw-update');
mkdirSync(OUT, { recursive: true });
const LIVE = readFileSync('review/eval/data/live-strand.json');
let BUILD = 'build-A';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(LIVE);
  if (p === '/api/version') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ version: BUILD }));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const file = path.resolve(dist, REWRITE[p] || p.slice(1));
  let buf; try { buf = readFileSync(file); } catch { return res.writeHead(404).end(); }
  if (p === '/sw.js') buf = Buffer.from(buf.toString('utf8').replace(/const _="local"/, `const _="${BUILD}"`));
  return res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...(p === '/sw.js' ? { 'Cache-Control': 'no-cache' } : {}) }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg' });
await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); } catch {} });
const page = await ctx.newPage();
const log = [];
const t0 = Date.now();
const note = (s) => { log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`); };
page.on('load', () => note('page load'));
page.on('console', (m) => { if (/\[SW\]|Updated|update/i.test(m.text())) note(`console: ${m.text().slice(0, 140)}`); });
const toastWatch = () => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.classList.contains('show') ? t.textContent.trim() : null; }).catch(() => null);
const swBuild = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const c = navigator.serviceWorker.controller; return { controller: !!c, active: r?.active?.state, waiting: !!r?.waiting, installing: !!r?.installing }; }).catch((e) => ({ error: String(e).slice(0, 80) }));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => navigator.serviceWorker.controller || false, null, { timeout: 20000 }).catch(() => note('no controller after first load (expected: a first install does not claim until activate)'));
await page.waitForTimeout(6000);
note(`after first visit: ${JSON.stringify(await swBuild())}`);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
note(`after reload: ${JSON.stringify(await swBuild())}`);

BUILD = 'build-B';
note('--- deploy build-B ---');
// the phone puts the app away and brings it back
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(500);
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
let toast = null;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500);
  const t = await toastWatch(); if (t && t !== toast) { toast = t; note(`toast: ${t}`); }
}
note(`end: ${JSON.stringify(await swBuild())}`);
const activeScript = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const url = r?.active?.scriptURL; if (!url) return null; const txt = await (await fetch(url, { cache: 'no-store' })).text(); return (txt.match(/const _="([^"]+)"/) || [])[1]; }).catch(() => null);
note(`server now stamps sw.js with ${activeScript}`);
await page.screenshot({ path: path.join(OUT, 'after-update.png') });
writeFileSync(path.join(OUT, 'sw-update.log'), log.join('\n'));
console.log(log.join('\n'));
await browser.close();
server.close();
