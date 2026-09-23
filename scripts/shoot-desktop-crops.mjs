// Before/after shots of the desktop polaroid crop (2026-09-23, Job 4).
//
// Ranks every photograph in the tree by how far its desktop crop (Al's ruled anchor,
// review/set-001-crop-anchors.json, via heroCropDesktopFor) sits from the desktop default
// (25%), takes the top N, and shoots the REAL built polaroid (#bgImg in dist, rotated print,
// frame and all) at 1440x900 and 1920x1080:
//   before = no --hero-crop-desktop → the CSS default 25%, i.e. production before this change
//   after  = --hero-crop-desktop set to the photograph's anchor, as setBackgroundFor sets it
// The caption is hidden in the shots (it belongs to whatever photograph the picker landed on).
//
//   npm run build && node scripts/shoot-desktop-crops.mjs [--top 20]
// Writes output/desktop-crop-shots/<n>-<width>-{before,after}.png, index.html and sheet-*.png.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { heroCropDesktopFor } from '../assets/hero-crop.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const out = path.join(root, 'output', 'desktop-crop-shots');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const TOP = Number(args[args.indexOf('--top') + 1]) || 20;
const DEFAULT = 25;
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];

const { photos: numbered } = JSON.parse(readFileSync(path.join(root, 'review', 'bucket-check-photos.json'), 'utf8'));
const numberOf = new Map(numbered.map((p) => [p.sha1, p.n]));
const benched = new Set(JSON.parse(readFileSync(path.join(root, 'review', 'benched-photos.json'), 'utf8')).benched.map((b) => b.sha256));
const photos = new Map();
for (const f of FOLDERS) for (let w = 1; w <= 4; w++) for (const t of TIMES) for (let i = 1; i <= 7; i++) {
  const rel = `${f}/week_${w}/${t}/${i}.webp`;
  const bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', rel));
  const sha1 = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
  if (!photos.has(sha1)) photos.set(sha1, { sha1, sha256: createHash('sha256').update(bytes).digest('hex'), image: rel, n: numberOf.get(sha1) });
}
const ranked = [...photos.values()]
  .map((p) => ({ ...p, crop: heroCropDesktopFor(`assets/images/bg-canonical/${p.sha256}.webp`) }))
  .map((p) => ({ ...p, diff: p.crop == null ? 0 : Math.abs(p.crop - DEFAULT) }))
  .sort((a, b) => b.diff - a.diff || a.n - b.n)
  .slice(0, TOP);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const payload = JSON.parse(readFileSync(path.join(root, 'review', 'condition-incident-20260922', 'deployed-api.json'), 'utf8'));
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/weather')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); return; }
  if (p.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
  // A benched photograph is not in dist; shoot it from the source tree.
  if (p.startsWith('/__src/')) { const f = path.join(root, 'assets', 'images', 'bg', p.slice(7)); if (existsSync(f)) { res.writeHead(200, { 'content-type': 'image/webp' }); res.end(readFileSync(f)); return; } }
  if (p === '/') p = '/index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const site = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const shots = [];
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], serviceWorkers: 'block', timezoneId: 'Africa/Johannesburg' });
  await ctx.addInitScript(() => { try { localStorage.setItem('lang', JSON.stringify('en')); localStorage.setItem('pw_install_dismissed_at', String(Date.now())); } catch {} });
  const page = await ctx.newPage();
  await page.goto(site, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && document.getElementById('bgImg')?.complete, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '#headline, .hero-caption { visibility: hidden !important; } #installBanner { display: none !important; } * { animation: none !important; transition: none !important; }' });
  for (const p of ranked) {
    for (const state of ['before', 'after']) {
      await page.evaluate(({ url, crop }) => new Promise((resolve) => {
        const root = document.documentElement;
        if (crop == null) root.style.removeProperty('--hero-crop-desktop'); else root.style.setProperty('--hero-crop-desktop', `${crop}%`);
        const img = document.getElementById('bgImg');
        const done = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (img.getAttribute('src') === url && img.complete) { done(); return; }
        img.onload = done; img.onerror = () => resolve();
        img.src = url;
      }), { url: benched.has(p.sha256) ? `__src/${p.image}` : `assets/images/bg-canonical/${p.sha256}.webp?v=20260906-grid`, crop: state === 'after' ? p.crop : null });
      await page.waitForTimeout(150);
      const pos = await page.evaluate(() => getComputedStyle(document.getElementById('bgImg')).objectPosition);
      const file = `${String(p.n).padStart(3, '0')}-${w}-${state}.png`;
      await page.locator('#bgImg').screenshot({ path: path.join(out, file) });
      shots.push({ n: p.n, w, state, file, pos });
    }
  }
  await ctx.close();
}
await browser.close();
server.close();

const row = (p) => {
  const cell = (w, state) => { const s = shots.find((x) => x.n === p.n && x.w === w && x.state === state); return `<figure><img src="${s.file}"><figcaption>${w} ${state} · ${s.pos}</figcaption></figure>`; };
  return `<section><h2>#${p.n} · ${p.image.split('/')[0]} · ${p.image.split('/')[2]} · anchor ${p.crop}% (default 25%)${benched.has(p.sha256) ? ' · benched' : ''}</h2><div class="r">${cell(1440, 'before')}${cell(1440, 'after')}${cell(1920, 'before')}${cell(1920, 'after')}</div></section>`;
};
const css = 'body{margin:0;padding:16px;background:#141412;color:#eee;font:14px system-ui}h1{font-size:19px;margin:0 0 4px}p{color:#aaa;margin:0 0 14px}h2{font-size:15px;margin:18px 0 6px}.r{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}figure{margin:0;background:#000;padding:6px;border-radius:6px}img{width:100%;display:block}figcaption{color:#aaa;font-size:12px;margin-top:4px}';
writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Desktop crop shots</title><style>${css}</style><h1>Desktop polaroid: ${TOP} photographs where Al's anchor is furthest from the 25% default</h1><p>Before = production today (25% for every photograph). After = the anchor Al ruled for the phone. Shot from the real build at 1440 and 1920 wide. Approve, and Job 4 is pushed.</p>${ranked.map(row).join('')}`);

// Contact sheets for a phone: five photographs a sheet.
const b2 = await chromium.launch();
const pg = await b2.newPage({ viewport: { width: 1600, height: 1000 } });
for (let s = 0; s * 5 < ranked.length; s++) {
  const chunk = ranked.slice(s * 5, s * 5 + 5);
  const f = path.join(out, `sheet-${s + 1}.html`);
  writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>${css} .r{grid-template-columns:repeat(4,1fr)} section{margin:0} h2{margin:10px 0 4px}</style>${chunk.map(row).join('')}`);
  await pg.goto(pathToFileURL(f).href);
  await pg.waitForFunction(() => [...document.images].every((i) => i.complete));
  await pg.screenshot({ path: path.join(out, `sheet-${s + 1}.png`), fullPage: true });
}
await b2.close();
console.log(`${ranked.length} photographs × 2 widths × before/after → ${out}`);
console.log(ranked.map((p) => `#${p.n}(${p.image.split('/')[0]} ${p.crop}%)`).join(' '));
const bad = shots.filter((s) => (s.state === 'before' && !/ 25%$/.test(s.pos)) || (s.state === 'after' && s.pos !== `50% ${ranked.find((p) => p.n === s.n).crop}%`));
if (bad.length) { console.error('object-position did not follow the variable:', JSON.stringify(bad.slice(0, 3))); process.exit(1); }
