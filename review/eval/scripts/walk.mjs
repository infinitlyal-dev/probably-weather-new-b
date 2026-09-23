// Launch eval, step 2 (2026-09-23): walk every screen and control of the live app, phone and
// desktop, all five languages, and record what is on screen.
//
//   node review/eval/scripts/walk.mjs [--site https://www.probablyweather.co.za/] [--out review/eval/shots/walk]
//                                     [--langs en,af,zu,xh,st] [--devices phone,desktop]
//
// phone   = Al's iPhone 11 in Chrome: WebKit (Chrome on iOS is WebKit), 414 wide, 715 tall (the
//           896-point screen less status bar, Chrome's omnibox and toolbar, home indicator — an
//           estimate, not measured on his phone), Chrome-for-iOS user agent, touch, DPR 2.
// desktop = Chromium 1440x900.
// Geolocated at Strand, SAST clock, a fresh browser profile per run (first visit: the install
// banner is expected on the phone). Every screen is shot at rest and, where it scrolls, at the end.
// Writes <out>/<device>-<lang>-NN-<screen>.png and <out>/walk.json (visible text per screen,
// console errors, failed requests, the share payload, timings).
import { chromium, webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('--site', 'https://www.probablyweather.co.za/');
const OUT = arg('--out', 'review/eval/shots/walk');
const LANGS = arg('--langs', 'en,af,zu,xh,st').split(',');
const DEVICES = arg('--devices', 'phone,desktop').split(',');
mkdirSync(OUT, { recursive: true });

const IOS_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const DEV = {
  phone: { engine: webkit, viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IOS_CHROME_UA },
  desktop: { engine: chromium, viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};
const STRAND = { latitude: -34.1163, longitude: 18.8362 };

// Visible text nodes of a subtree, with their nearest id'd ancestor, plus accessible names of
// controls (aria-label / title / alt) — the strings a screen reader or a hover says aloud.
const TEXT = (sel) => {
  const root = sel ? document.querySelector(sel) : document.body;
  if (!root) return { text: [], names: [] };
  const vis = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || e.hidden) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t || !n.parentElement || !vis(n.parentElement)) continue;
    const owner = n.parentElement.closest('[id]');
    text.push({ t, id: owner?.id || '' });
  }
  const names = [];
  for (const el of root.querySelectorAll('[aria-label],[title],img[alt],input[placeholder]')) {
    if (!vis(el)) continue;
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) names.push({ t: v.trim(), id: el.id || el.closest('[id]')?.id || '', attr: a });
    }
  }
  return { text, names };
};

const report = [];
for (const d of DEVICES) {
  const dev = DEV[d];
  const browser = await dev.engine.launch();
  for (const lang of LANGS) {
    const tag = `${d}-${lang}`;
    const row = { tag, device: d, lang, screens: {}, errors: [], bad: [], notes: [] };
    const ctx = await browser.newContext({
      viewport: dev.viewport, isMobile: dev.isMobile, hasTouch: dev.hasTouch, deviceScaleFactor: dev.deviceScaleFactor,
      userAgent: dev.userAgent, geolocation: STRAND, permissions: ['geolocation'], locale: 'en-ZA', timezoneId: 'Africa/Johannesburg',
    });
    await ctx.addInitScript((l) => {
      try { localStorage.setItem('lang', JSON.stringify(l)); } catch {}
      window.__shared = null;
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (x) => { window.__shared = x; } });
    }, lang);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => row.errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('console', (m) => { if (m.type() === 'error') row.errors.push(`console: ${m.text().slice(0, 200)}`); });
    page.on('response', (r) => { if (r.status() >= 400) row.bad.push(`${r.status()} ${r.url().slice(0, 140)}`); });
    page.on('requestfailed', (r) => row.bad.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 140)}`));
    let n = 0;
    const shot = async (name, opts = {}) => { n += 1; const f = `${tag}-${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: path.join(OUT, f), ...opts }); return f; };
    const grab = async (key, sel) => { row.screens[key] = { ...(await page.evaluate(TEXT, sel)), shots: row.screens[key]?.shots || [] }; };
    const addShot = (key, f) => { (row.screens[key] ||= { text: [], names: [], shots: [] }).shots.push(f); };
    const click = async (sel, label) => { try { await page.locator(sel).first().click({ timeout: 5000 }); return true; } catch (e) { row.notes.push(`could not click ${label || sel}: ${e.message.split('\n')[0].slice(0, 120)}`); return false; } };
    const scrollEnd = async () => page.evaluate(() => {
      const els = [document.scrollingElement, document.body, ...document.querySelectorAll('main, .screen, [id$="-screen"]')];
      for (const e of els) if (e && e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    const scrollTop = async () => page.evaluate(() => {
      const els = [document.scrollingElement, document.body, ...document.querySelectorAll('main, .screen, [id$="-screen"]')];
      for (const e of els) if (e) e.scrollTop = 0;
      window.scrollTo(0, 0);
    });

    // ---- Home, first visit --------------------------------------------------
    const t0 = Date.now();
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 30000 }).catch(() => row.notes.push('first render flag never set'));
    row.firstWeatherMs = Date.now() - t0;
    await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => row.notes.push('hero image never loaded'));
    await page.waitForTimeout(3600); // the install banner is due 2.5 s after the first forecast
    row.home = await page.evaluate(() => ({
      place: document.querySelector('#location')?.textContent?.trim(),
      caption: document.querySelector('#headline')?.textContent?.trim(),
      condition: document.querySelector('#description')?.textContent?.trim(),
      temp: document.querySelector('#temp')?.textContent?.replace(/\s+/g, ' ').trim(),
      stats: document.querySelector('#statsRow')?.textContent?.replace(/\s+/g, ' ').trim(),
      display: window.__PW_LAST_DISPLAY, hero: window.__PW_LAST_HERO,
      bg: document.querySelector('#bgImg')?.currentSrc || document.querySelector('#bgImg')?.getAttribute('src'),
      htmlLang: document.documentElement.lang,
      banner: (() => { const b = document.querySelector('#installBanner'); return b && !b.classList.contains('hidden') && getComputedStyle(b).display !== 'none' ? b.innerText.replace(/\s+/g, ' ').trim() : null; })(),
    }));
    await grab('home');
    addShot('home', await shot('home'));
    // Install banner: what it says, and what Install does on this platform.
    if (row.home.banner) {
      addShot('install', await shot('install-banner', { clip: await page.locator('#installBanner').boundingBox().catch(() => undefined) || undefined }));
      await grab('install-banner', '#installBanner');
      if (await click('#installBannerInstall', 'banner Install')) {
        await page.waitForTimeout(900);
        const modal = await page.evaluate(() => {
          const m = [...document.querySelectorAll('.install-modal, [role="dialog"]')].find((e) => !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none');
          return m ? { id: m.id, text: m.innerText.replace(/\s+/g, ' ').trim() } : null;
        });
        row.installModal = modal;
        if (modal) { addShot('install', await shot('install-modal')); await grab('install-modal', `#${modal.id}`); await page.keyboard.press('Escape'); await click(`#${modal.id} .install-modal-x, #${modal.id} button[aria-label]`, 'modal close'); }
        await page.waitForTimeout(500);
      }
      await click('#installBannerDismiss', 'banner Not now');
      await page.waitForTimeout(400);
    } else if (d === 'phone') row.notes.push('no install banner on first visit');
    // Language menu
    if (await click('#languageBtn', 'language chip')) {
      await page.waitForTimeout(500);
      addShot('language-menu', await shot('language-menu'));
      await grab('language-menu', '#languageMenu');
      await page.keyboard.press('Escape');
      await click('#languageBtn', 'language chip (close)');
      await page.waitForTimeout(300);
    }

    // ---- Hourly, three metrics ---------------------------------------------
    await click(d === 'phone' ? '#homeHourly' : '#navHourlyHome', 'Hourly');
    await page.waitForTimeout(1200);
    await grab('hourly', '#hourly-screen');
    addShot('hourly', await shot('hourly'));
    const metrics = await page.locator('#hourlyMetricToggle button').count().catch(() => 0);
    for (let i = 1; i < metrics; i++) {
      await page.locator('#hourlyMetricToggle button').nth(i).click().catch(() => {});
      await page.waitForTimeout(600);
      addShot('hourly', await shot(`hourly-metric${i}`));
    }
    await scrollEnd(); await page.waitForTimeout(300);
    addShot('hourly', await shot('hourly-end'));
    const hourlyText2 = await page.evaluate(TEXT, '#hourly-screen');
    row.screens.hourly.text.push(...hourlyText2.text); row.screens.hourly.names.push(...hourlyText2.names);
    await scrollTop();
    await click('#hourlyBack', 'Hourly back');
    await page.waitForTimeout(500);

    // ---- Week and a day ----------------------------------------------------
    await click('#navWeek', 'Week');
    await page.waitForTimeout(1200);
    await grab('week', '#week-screen');
    addShot('week', await shot('week'));
    await scrollEnd(); await page.waitForTimeout(300);
    addShot('week', await shot('week-end'));
    await scrollTop();
    const cards = await page.locator('#daily-cards > *').count().catch(() => 0);
    row.weekCards = cards;
    if (cards > 1) {
      await page.locator('#daily-cards > *').nth(1).click().catch((e) => row.notes.push(`day card click: ${e.message.slice(0, 80)}`));
      await page.waitForTimeout(1000);
      await grab('day-detail', '#day-detail-screen');
      addShot('day-detail', await shot('day-detail'));
      await scrollEnd(); await page.waitForTimeout(300);
      addShot('day-detail', await shot('day-detail-end'));
      await scrollTop();
      await click('#dayDetailBack', 'Day back');
      await page.waitForTimeout(500);
    }

    // ---- Places: empty, a real place, a nonsense place ---------------------
    await click('#navSearch', 'Places');
    await page.waitForTimeout(900);
    await grab('places', '#search-screen');
    addShot('places', await shot('places'));
    await page.locator('#searchInput').fill('Durban').catch(() => {});
    await page.waitForTimeout(3500);
    row.searchDurban = await page.locator('#searchResults li, #searchResults [role="option"], .search-result').count().catch(() => 0);
    const placesDurban = await page.evaluate(TEXT, '#search-screen');
    row.screens.places.text.push(...placesDurban.text); row.screens.places.names.push(...placesDurban.names);
    addShot('places', await shot('places-durban'));
    await page.locator('#searchInput').fill('Qwxzvbnmk').catch(() => {});
    await page.waitForTimeout(3500);
    const placesBad = await page.evaluate(TEXT, '#search-screen');
    row.screens.places.text.push(...placesBad.text); row.screens.places.names.push(...placesBad.names);
    row.searchBad = placesBad.text.map((x) => x.t).join(' | ').slice(0, 400);
    addShot('places', await shot('places-nonsense'));
    await page.locator('#searchInput').fill('').catch(() => {});
    await click('#searchCancel', 'search cancel');
    await page.waitForTimeout(300);

    // ---- Settings and Sources ----------------------------------------------
    await click('#navSettings', 'Settings');
    await page.waitForTimeout(900);
    await grab('settings', '#settings-screen');
    addShot('settings', await shot('settings'));
    await scrollEnd(); await page.waitForTimeout(300);
    addShot('settings', await shot('settings-end'));
    const settings2 = await page.evaluate(TEXT, '#settings-screen');
    row.screens.settings.text.push(...settings2.text); row.screens.settings.names.push(...settings2.names);
    await scrollTop();
    if (await click('#settingsSourcesRow', 'Sources row')) {
      await page.waitForTimeout(1000);
      await grab('sources', '#sources-screen');
      addShot('sources', await shot('sources'));
      await scrollEnd(); await page.waitForTimeout(300);
      addShot('sources', await shot('sources-end'));
      const s2 = await page.evaluate(TEXT, '#sources-screen');
      row.screens.sources.text.push(...s2.text); row.screens.sources.names.push(...s2.names);
      await scrollTop();
      await click('#sourcesBack', 'Sources back');
      await page.waitForTimeout(500);
    }

    // ---- Share from Home ---------------------------------------------------
    await click('#navHome', 'Home');
    await page.waitForTimeout(900);
    await grab('chrome', 'nav, .nav, footer');
    await click(d === 'phone' ? '#navShare' : '#shareBtn', 'Share');
    await page.waitForTimeout(1200);
    row.shared = await page.evaluate(() => window.__shared);
    addShot('share', await shot('after-share'));
    report.push(row);
    await ctx.close();
    process.stderr.write(`${tag}: first weather ${row.firstWeatherMs} ms, banner=${!!row.home.banner}, modal=${row.installModal?.id || '-'}, errors ${row.errors.length}, bad ${row.bad.length}, notes ${row.notes.length}\n`);
  }
  await browser.close();
}

// ---- English left on a non-English screen --------------------------------------
// A string shown in a non-English run that is IDENTICAL to one shown on the same screen in the
// English run, and reads as English (letters, not a place, a number, a brand or a unit).
const KEEP = /^(Probably Weather|Probably|Open-Meteo|WeatherAPI(\.com)?|MET Norway|Pirate Weather|Tomorrow\.io|WhatsApp|UV|PWA|SA|°C|°F|km\/h|mm|%|N|S|E|W|NE|NW|SE|SW|Strand|Durban|Safari|Chrome|iPhone|Android|Share|Add to Home Screen|Edit Actions|Install app|Add to Home screen|Home screen|Add page to|OK)$/i;
const english = new Map();
for (const r of report.filter((x) => x.lang === 'en')) {
  for (const [scr, v] of Object.entries(r.screens)) {
    const set = english.get(`${r.device}|${scr}`) || new Set();
    for (const x of [...v.text, ...v.names]) set.add(x.t);
    english.set(`${r.device}|${scr}`, set);
  }
}
const leaks = [];
for (const r of report.filter((x) => x.lang !== 'en')) {
  for (const [scr, v] of Object.entries(r.screens)) {
    const en = english.get(`${r.device}|${scr}`);
    if (!en) continue;
    for (const x of [...v.text, ...v.names]) {
      const t = x.t;
      if (!en.has(t) || KEEP.test(t) || !/[A-Za-z]{3,}/.test(t) || /^[\d\s.,:%°\-–·/()+]+[A-Za-z]{0,4}$/.test(t)) continue;
      if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(t) && r.lang === 'en') continue;
      leaks.push({ device: r.device, lang: r.lang, screen: scr, id: x.id, attr: x.attr || 'text', text: t });
    }
  }
}
const uniq = [...new Map(leaks.map((l) => [`${l.lang}|${l.screen}|${l.attr}|${l.text}`, l])).values()];
writeFileSync(path.join(OUT, 'walk.json'), JSON.stringify({ site: SITE, at: new Date().toISOString(), report, leaks: uniq }, null, 1));
console.log(`[walk] ${report.length} runs → ${OUT}/walk.json; ${uniq.length} English strings shown on a non-English screen`);
for (const l of uniq.slice(0, 80)) console.log(`  ${l.lang} ${l.device.padEnd(7)} ${l.screen.padEnd(14)} ${l.attr.padEnd(11)} #${l.id.padEnd(18)} ${l.text.slice(0, 90)}`);
