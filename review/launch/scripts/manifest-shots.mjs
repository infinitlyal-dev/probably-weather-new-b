// LAUNCH RUN (2026-09-25) — the screenshots Android's bigger install sheet shows (manifest.json
// "screenshots"), rendered from the built app with a real production payload at 10:00 SAST.
//
//   npm run build && node review/launch/scripts/manifest-shots.mjs
//
// Writes assets/screenshots/{home,hourly,week}.webp (1080×1920, narrow) and desktop.webp
// (1920×1080, wide). Re-run after Al picks a Home design so the sheet shows the Home that ships.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dist = path.resolve('dist');
const OUT = 'assets/screenshots';
mkdirSync(OUT, { recursive: true });
const LIVE = JSON.parse(readFileSync('review/eval/data/live-strand.json', 'utf8'));
// A daytime read of the same forecast: the clock below is 10:00 SAST.
LIVE.meta = { ...LIVE.meta, localHour: 10 };
LIVE.now = { ...LIVE.now, isDay: true };
LIVE.location = { ...(LIVE.location || {}), name: 'Strand, Western Cape' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/weather') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(LIVE));
  if (p.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  if (p.startsWith('/_vercel/')) return res.writeHead(204).end();
  let b; try { b = readFileSync(path.join(dist, p === '/' ? 'index.html' : p.slice(1))); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/html; charset=utf-8' }).end(b);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
async function shoot(viewport, scale, steps, file, size) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: viewport.width < 800, hasTouch: viewport.width < 800, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], locale: 'en-ZA', timezoneId: 'Africa/Johannesburg' });
  // A returning visitor: no install banner, no first-visit tagline over the screenshot.
  await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('en')); localStorage.setItem('pw_home', '1'); localStorage.setItem('pw_install_completed', '1'); } catch {} });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-09-25T08:00:00Z') });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.clock.runFor(9000);
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelectorAll('#installBanner, .install-banner, [data-install-banner]').forEach((el) => el.remove()));
  await steps(page);
  const png = await page.screenshot();
  await sharp(png).resize(size[0], size[1]).webp({ quality: 80 }).toFile(path.join(OUT, file));
  await ctx.close();
  console.log(`${file} ${size.join('x')}`);
}
await shoot({ width: 360, height: 640 }, 3, async () => {}, 'home.webp', [1080, 1920]);
await shoot({ width: 360, height: 640 }, 3, async (p) => { await p.locator('#homeHourly').click(); await p.waitForTimeout(900); }, 'hourly.webp', [1080, 1920]);
await shoot({ width: 360, height: 640 }, 3, async (p) => { await p.locator('#navWeek').click(); await p.waitForTimeout(900); }, 'week.webp', [1080, 1920]);
await shoot({ width: 1280, height: 720 }, 1.5, async () => {}, 'desktop.webp', [1920, 1080]);
await browser.close();
server.close();
