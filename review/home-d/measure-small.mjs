// Measures Home D's pieces at one size and language with the longest joke pinned (the fold gate's setup).
//   node review/home-d/measure-small.mjs [w] [h] [lang]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [w = 320, h = 488, lang = 'zu'] = process.argv.slice(2).map((v, i) => (i < 2 ? Number(v) : v));
const dist = path.resolve('dist');
const src = readFileSync(`assets/copy/${lang}.js`, 'utf8');
const bank = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const lines = []; const walk = (n) => { if (typeof n === 'string') lines.push(n); else if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') Object.values(n).forEach(walk); };
walk(bank.witty || {});
const longest = lines.sort((a, b) => b.length - a.length)[0];
const fold = readFileSync('scripts/verify-home-fold.mjs', 'utf8');
const payload = new Function(`${fold.slice(fold.indexOf('const DATE'), fold.indexOf('\n', fold.indexOf('const DATE')))}\n${fold.slice(fold.indexOf('function payload()'), fold.indexOf('function startServer()'))}\nreturn payload();`)();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(p === '/api/weather' ? payload : p === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' } : {}));
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  const f = path.resolve(dist, p === '/' ? 'index.html' : p.slice(1)); let buf; try { buf = readFileSync(f); } catch { return res.writeHead(404).end(); } res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-08-08T15:12:00+02:00') });
await page.addInitScript((l) => { localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' })); localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5)); localStorage.setItem('lang', JSON.stringify(l)); }, lang);
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => { const s = document.getElementById('pwSplash'); return !s || s.classList.contains('splash-done'); }, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate((t) => { document.getElementById('headline').textContent = t; }, longest);
await page.waitForTimeout(400);
const m = await page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const hl = document.getElementById('headline'); const cs = getComputedStyle(hl);
  return { header: r('.header'), status: r('#weatherStatus'), now: r('#temp .hero-now'), headline: { ...r('#headline'), fs: cs.fontSize, pad: `${cs.paddingTop}/${cs.paddingBottom}` }, dLine: { ...r('#dLine'), text: document.getElementById('dLine').textContent }, handle: r('#dHandle'), nav: r('.nav'), vh: innerHeight };
});
console.log(JSON.stringify({ w, h, lang, longest: longest.length, ...m }, null, 1));
await page.screenshot({ path: `output/home-d/measure-${w}x${h}-${lang}.png` });
await browser.close(); server.close();
