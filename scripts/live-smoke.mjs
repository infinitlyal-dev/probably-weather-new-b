// Live smoke of https://www.probablyweather.co.za (first written for the 2b0e73e push, 2026-09-23).
//   node scripts/live-smoke.mjs output/live-smoke/<label> [--langs en,af,zu,xh,st]
// Phone 375x812 (mobile UA, touch) and desktop 1440x900, every language asked for (default all five;
// the zu/xh/st legs added 2026-09-23 for the translation-skills push),
// geolocated at Strand. Screens: home, hourly, weekly, search, settings, share
// (navigator.share intercepted), share landing page + OG card.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const li = process.argv.indexOf('--langs');
const LANGS = li > 0 ? process.argv[li + 1].split(',') : ['en', 'af', 'zu', 'xh', 'st'];
mkdirSync(OUT, { recursive: true });
const SITE = 'https://www.probablyweather.co.za/';
const STRAND = { latitude: -34.1163, longitude: 18.8362 };
const report = [];
const browser = await chromium.launch();

const cases = [
  { name: 'phone', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

for (const c of cases) for (const lang of LANGS) {
  const tag = `${c.name}-${lang}`;
  const row = { tag, checks: {}, errors: [], badResponses: [] };
  const ctx = await browser.newContext({
    viewport: c.viewport, isMobile: c.isMobile, hasTouch: c.hasTouch, deviceScaleFactor: c.deviceScaleFactor,
    geolocation: STRAND, permissions: ['geolocation'], locale: `${lang}-ZA`, timezoneId: 'Africa/Johannesburg',
    userAgent: c.isMobile ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 pw-smoke' : undefined,
  });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem('lang', JSON.stringify(l)); } catch {}
    window.__shared = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared = d; } });
  }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => row.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') row.errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', (r) => { const s = r.status(); const u = r.url(); if (s >= 400 && u.includes('probablyweather')) row.badResponses.push(`${s} ${u.slice(0, 120)}`); });

  const shot = async (n) => page.screenshot({ path: path.join(OUT, `${tag}-${n}.png`) });
  const visible = async (sel) => page.locator(sel).first().isVisible().catch(() => false);
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  row.checks.firstRenderMs = Date.now() - t0;
  row.home = await page.evaluate(() => ({
    place: document.querySelector('#location, .location, #locationName')?.textContent?.trim() || document.title,
    witty: document.querySelector('#headline')?.textContent?.trim(),
    conditionLine: document.querySelector('#description')?.textContent?.trim(),
    temp: document.querySelector('.temp')?.textContent?.replace(/\s+/g, ' ').trim(),
    range: document.querySelector('#rangeLine')?.textContent?.trim(),
    stats: document.querySelector('#statsRow')?.textContent?.replace(/\s+/g, ' ').trim(),
    byline: document.querySelector('#weatherByline')?.textContent?.replace(/\s+/g, ' ').trim(),
    display: window.__PW_LAST_DISPLAY, hero: window.__PW_LAST_HERO,
    bg: document.querySelector('#bgImg')?.getAttribute('src'),
    htmlLang: document.documentElement.lang,
  }));
  row.checks.home = !!(row.home.conditionLine && row.home.witty && row.home.witty !== 'Loading…');
  await shot('1-home');

  // Hourly
  const hourlyBtn = c.isMobile ? '#homeHourly' : '#navHourlyHome';
  await page.locator(hourlyBtn).first().click().catch((e) => row.errors.push(`hourly click: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(1200);
  row.checks.hourly = await visible('#hourly-screen:not(.hidden)') && (await page.locator('#hourly-timeline *').count()) > 5;
  await shot('2-hourly');
  await page.locator('#hourlyBack').first().click().catch(() => {});
  await page.waitForTimeout(600);

  // Weekly
  await page.locator('#navWeek').click();
  await page.waitForTimeout(1200);
  row.checks.weekly = await visible('#week-screen:not(.hidden)');
  row.weekText = (await page.locator('#week-screen').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220);
  await shot('3-weekly');

  // Search
  await page.locator('#navSearch').click();
  await page.waitForTimeout(800);
  await page.locator('#searchInput').fill('Durban');
  await page.waitForTimeout(3500);
  const results = await page.locator('#searchResults li').count().catch(() => 0);
  row.checks.search = results > 0;
  row.searchFirst = (await page.locator('#searchResults li').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80);
  await shot('4-search');
  await page.locator('#searchInput').fill('');

  // Settings
  await page.locator('#navSettings').click();
  await page.waitForTimeout(1000);
  row.checks.settings = await visible('#settings-screen:not(.hidden)');
  row.settingsLangValue = await page.locator('#languageSelect').inputValue().catch(() => null);
  await shot('5-settings');

  // Share (from home)
  await page.locator('#navHome').click();
  await page.waitForTimeout(1000);
  await page.locator(c.isMobile ? '#navShare' : '#shareBtn').first().click().catch((e) => row.errors.push(`share click: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(800);
  row.shared = await page.evaluate(() => window.__shared);
  row.checks.share = !!row.shared?.url;
  if (row.shared?.url) {
    const land = await ctx.request.get(row.shared.url.replace('https://probablyweather.co.za', 'https://www.probablyweather.co.za'), { headers: { 'user-agent': 'WhatsApp/2.23.20.0' } });
    const html = await land.text();
    const og = (html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/content="([^"]+)"\s+property="og:image"/) || [])[1]?.replace(/&amp;/g, '&');
    const ogTitle = (html.match(/property="og:title"\s+content="([^"]+)"/) || [])[1];
    const ogDesc = (html.match(/property="og:description"\s+content="([^"]+)"/) || [])[1];
    row.shareLanding = { status: land.status(), ogImage: og, ogTitle, ogDesc };
    if (og) {
      const img = await ctx.request.get(og.replace('https://probablyweather.co.za', 'https://www.probablyweather.co.za'));
      const buf = await img.body();
      writeFileSync(path.join(OUT, `${tag}-6-sharecard.png`), buf);
      row.shareCard = { status: img.status(), type: img.headers()['content-type'], bytes: buf.length };
      row.checks.shareCard = img.status() === 200 && /image/.test(img.headers()['content-type'] || '') && buf.length > 20000;
    }
  }
  report.push(row);
  await ctx.close();
  process.stderr.write(`${tag}: ${JSON.stringify(row.checks)}\n`);
}
await browser.close();
writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
