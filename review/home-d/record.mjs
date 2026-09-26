// A short screen recording of Home D for Al, on a live URL (the branch preview), at his iPhone 11 in Chrome
// (414x715). A fresh visit, so the joke is unseen: the photo and the forecast, the 2 s beat, the ink; a tap
// hides and shows the joke; the Hourly pull-up; then the postcard Share would send.
//
//   node review/home-d/record.mjs <url> [--out output/home-d/recording] [--engine webkit|chromium]
import { chromium, webkit } from 'playwright';
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
if (!url) throw new Error('usage: node review/home-d/record.mjs <url>');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'output/home-d/recording'));
const engine = arg('--engine', 'webkit') === 'chromium' ? chromium : webkit;
mkdirSync(out, { recursive: true });
const browser = await engine.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 715 }, deviceScaleFactor: 2, isMobile: engine === chromium ? true : undefined, hasTouch: true,
  timezoneId: 'Africa/Johannesburg', geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'],
  recordVideo: { dir: out, size: { width: 414, height: 715 } },
});
await ctx.addInitScript(() => {
  try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', JSON.stringify({ lat: -34.1163, lon: 18.8362, name: 'Strand' })); } catch {}
});
const page = await ctx.newPage();
const t0 = Date.now();
const log = [];
const note = (what) => { log.push({ at: ((Date.now() - t0) / 1000).toFixed(1), what }); console.log(log[log.length - 1].at, what); };
await page.goto(url, { waitUntil: 'domcontentloaded' });
note('open');
await page.waitForFunction(() => window.__PW_D?.reveal?.marks?.some((m) => m.what === 'photo'), null, { timeout: 45000 });
note('photo on screen');
await page.waitForFunction(() => window.__PW_D?.reveal?.state?.() === 'shown', null, { timeout: 20000 });
const marks = await page.evaluate(() => window.__PW_D.reveal.marks.map((m) => ({ what: m.what, at: m.at })));
note(`joke written (marks ${JSON.stringify(marks)})`);
await page.waitForTimeout(2500);
const spot = await page.evaluate(() => { for (let y = 300; y < 600; y += 10) { const el = document.elementFromPoint(207, y); if (el && el.closest('#heroCard')) return y; } return 400; });
await page.touchscreen.tap(207, spot); note('tap: hide');
await page.waitForTimeout(1600);
await page.touchscreen.tap(207, spot); note('tap: show');
await page.waitForTimeout(1800);
await page.tap('#dHandle'); note('Hourly pull-up');
await page.waitForTimeout(2200);
await page.evaluate(() => { const h = document.querySelector('#dSheet .d-hours'); h?.scrollBy({ left: 300, behavior: 'smooth' }); });
await page.waitForTimeout(1600);
await page.evaluate(() => window.__PW_D.close()); note('close');
await page.waitForTimeout(1200);
// The postcard, shown full screen for a moment (the share sheet itself cannot open in a test browser).
const card = await page.evaluate(() => window.__PW_D.shareImage());
if (card) {
  writeFileSync(path.join(out, 'postcard.jpg'), Buffer.from(card.split(',')[1], 'base64'));
  await page.evaluate((src) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#222;display:flex;align-items:center;justify-content:center';
    d.innerHTML = `<img src="${src}" style="max-width:92%;max-height:92%;box-shadow:0 10px 40px rgba(0,0,0,.6)">`;
    document.body.appendChild(d);
  }, card);
  note('postcard (what Share sends)');
  await page.waitForTimeout(3000);
}
await ctx.close();
await browser.close();
const vid = readdirSync(out).find((f) => f.endsWith('.webm') && !f.startsWith('home-d'));
if (vid) renameSync(path.join(out, vid), path.join(out, 'home-d.webm'));
writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ url, engine: engine === chromium ? 'chromium' : 'webkit', log }, null, 1));
console.log(`video: ${path.join(out, 'home-d.webm')}`);
