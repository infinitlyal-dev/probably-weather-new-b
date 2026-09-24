// Photo check (2026-09-24): Al's page works from disk — every image loads, marks and notes survive a
// reload, Export downloads photo-check-ruled.json with them, the filters filter, no sideways scroll
// on a phone. Clears its test marks afterwards.
//
//   node review/eval/photo-check/verify-page.mjs [shot-dir]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const shots = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.resolve('review/photo-check-for-al.html')).href);
if (shots) await page.screenshot({ path: `${shots}/page-head.png` });
const photos = await page.locator('.photo').count();
const images = await page.evaluate(async () => {
  const all = [...document.querySelectorAll('img')].filter((i) => i.getAttribute('src'));
  all.forEach((i) => { i.loading = 'eager'; });
  await Promise.all(all.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  return { total: all.length, broken: all.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')) };
});
await page.locator('.photo').first().locator('button.FIX').click();
await page.locator('.photo').first().locator('textarea').fill('test note');
await page.locator('.q').first().locator('button.OK').click();
await page.reload();
const kept = await page.evaluate(() => ({
  fix: document.querySelector('.photo .act button.FIX').classList.contains('on'),
  note: document.querySelector('.photo textarea').value,
  repeat: document.querySelector('.q .act button.OK').classList.contains('on'),
  count: document.getElementById('count').textContent,
}));
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
const j = JSON.parse(readFileSync(await dl.path(), 'utf8'));
const filters = {};
for (const f of ['covers', 'partly', 'small', 'nolang', 'open', 'all']) { await page.click(`.filters button[data-f="${f}"]`); filters[f] = await page.locator('.photo').count(); }
if (shots) await page.screenshot({ path: `${shots}/page-top.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.locator('#photos').scrollIntoViewIfNeeded();
if (shots) await page.screenshot({ path: `${shots}/page-phone.png` });
const phoneScrollsSideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await page.evaluate(() => localStorage.clear());
await b.close();
console.log(JSON.stringify({
  photos, images: images.total, broken: images.broken, kept, download: dl.suggestedFilename(),
  exported: { photos: j.photos.length, repeats: j.repeats.length, marked: j.photos.filter((p) => p.verdict).map((p) => [p.n, p.verdict, p.note]), repeatMarked: j.repeats.filter((r) => r.verdict).map((r) => [r.key, r.verdict]) },
  filters, phoneScrollsSideways, errors,
}, null, 1));
