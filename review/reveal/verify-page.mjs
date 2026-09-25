// Checks review/reveal-for-al.html the way Al will use it (file://, Chromium): every video and picture
// loads, a row plays together, a pick and a note survive a reload, Export downloads reveal-ruled.json,
// and nothing scrolls sideways at a phone's width.
//
//   node review/reveal/verify-page.mjs [--shots <dir>]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('--shots', '');
const url = pathToFileURL(path.resolve('review/reveal-for-al.html')).href;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
// Every video's metadata and every picture.
const media = await page.evaluate(async () => {
  const vids = [...document.querySelectorAll('video')];
  const loaded = await Promise.all(vids.map((v) => new Promise((r) => {
    if (v.readyState >= 1) return r(true);
    v.preload = 'metadata';
    v.addEventListener('loadedmetadata', () => r(true), { once: true });
    v.addEventListener('error', () => r(false), { once: true });
    v.load();
    setTimeout(() => r(v.readyState >= 1), 8000);
  })));
  const imgs = [...document.querySelectorAll('img')];
  imgs.forEach((i) => { i.loading = 'eager'; });
  await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  const posters = [...new Set(vids.map((v) => v.poster))];
  const posterOk = await Promise.all(posters.map((p) => new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = p; })));
  return { videos: vids.length, videosLoaded: loaded.filter(Boolean).length, durations: vids.map((v) => Math.round(v.duration * 10) / 10), images: imgs.length, imagesLoaded: imgs.filter((i) => i.naturalWidth > 0).length, posters: posters.length, postersLoaded: posterOk.filter(Boolean).length };
});
// A row plays together.
await page.click('.group .together');
await page.waitForTimeout(1500);
const playing = await page.evaluate(() => [...document.querySelector('.group').querySelectorAll('video')].map((v) => !v.paused && v.currentTime > 0.5));
// A pick and a note survive a reload.
await page.click('.act button[data-q="style"][data-v="ink"]');
await page.fill('textarea[data-note="beat"]', 'test note');
await page.reload();
const kept = await page.evaluate(() => ({ pick: document.querySelector('.act button[data-q="style"][data-v="ink"]').classList.contains('on'), note: document.querySelector('textarea[data-note="beat"]').value, count: document.getElementById('count').textContent }));
// Export.
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
const saved = await dl.path();
const exported = JSON.parse(readFileSync(saved, 'utf8'));
// Clear the test marks so Al starts clean.
await page.evaluate(() => localStorage.removeItem('pw-reveal-2026-09-25'));
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'page-top.png') });
// Phone width: nothing sideways.
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'page-phone.png') });
await browser.close();
const out = { media, playing, kept, exportName: dl.suggestedFilename(), exported: { style: exported.style, beat: exported.beat, words: exported.words }, sideways, errors };
console.log(JSON.stringify(out, null, 1));
const pass = media.videosLoaded === media.videos && media.imagesLoaded === media.images && media.postersLoaded === media.posters && playing.every(Boolean)
  && kept.pick && kept.note === 'test note' && dl.suggestedFilename() === 'reveal-ruled.json' && exported.style.pick === 'ink' && sideways <= 0 && !errors.length;
console.log(pass ? 'PAGE PASS' : 'PAGE FAIL');
process.exit(pass ? 0 : 1);
