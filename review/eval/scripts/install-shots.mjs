// Launch eval (2026-09-24): the install banner and modal as a phone shows them, on the built app.
//   node review/eval/scripts/install-shots.mjs [--dist dist] [--out review/eval/shots/install]
// Android Chrome with no one-tap prompt (the menu steps), and Chrome on iPhone (Install → steps),
// in English and isiZulu.
import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const dist = path.resolve(arg('--dist', 'dist'));
const OUT = arg('--out', 'review/eval/shots/install');
mkdirSync(OUT, { recursive: true });
const LIVE = readFileSync('review/eval/data/live-strand.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const REWRITE = { '/': 'index.html', '/install': 'install.html', '/privacy': 'privacy.html' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(LIVE);
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  const f = path.resolve(dist, REWRITE[p] || p.slice(1));
  let b; try { b = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(b);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const CASES = [
  { name: 'android', engine: chromium, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' },
  { name: 'iphone-chrome', engine: webkit, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1', tap: true },
];
const rows = [];
for (const c of CASES) {
  const browser = await c.engine.launch();
  for (const lang of ['en', 'zu']) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: c.ua,
      geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg', serviceWorkers: 'block' });
    await ctx.addInitScript((l) => { try { localStorage.setItem('lang', JSON.stringify(l)); } catch {} }, lang);
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const b = document.getElementById('installBanner'); return b && !b.classList.contains('hidden'); }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    const banner = await page.evaluate(() => document.getElementById('installBanner')?.innerText.replace(/\s+/g, ' ').trim());
    await page.screenshot({ path: path.join(OUT, `${c.name}-${lang}-banner.png`) });
    let modal = null;
    if (c.tap) {
      await page.locator('#installBannerInstall').click();
      await page.waitForTimeout(700);
      modal = await page.evaluate(() => { const m = [...document.querySelectorAll('.install-modal')].find((e) => !e.classList.contains('hidden')); return m ? { id: m.id, text: m.innerText.replace(/\s+/g, ' ').trim() } : null; });
      await page.screenshot({ path: path.join(OUT, `${c.name}-${lang}-after-install-tap.png`) });
    }
    rows.push({ case: c.name, lang, banner, modal });
    console.log(`${c.name} ${lang}: banner "${banner}"${modal ? ` | modal ${modal.id}: ${modal.text.slice(0, 160)}` : ''}`);
    await ctx.close();
  }
  await browser.close();
}
writeFileSync(path.join(OUT, 'install-shots.json'), JSON.stringify(rows, null, 1));
server.close();
