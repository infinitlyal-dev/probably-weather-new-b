// Launch eval, step 2 (2026-09-23): share cards, PWA manifest, speed and accessibility on production.
//
//   node review/eval/scripts/checks.mjs [--site https://www.probablyweather.co.za] [--out review/eval/shots/checks] [--only share,pwa,speed,a11y]
//
// share  — the WhatsApp link preview for each language: /s/<lang>/… fetched with WhatsApp's user agent,
//          its og: tags, and the card image itself (saved, so a person can look at it).
// pwa    — manifest fields a phone needs to install and launch the app, and the service worker's build stamp.
// speed  — Chromium, Lighthouse's "slow 4G" numbers (150 ms RTT, 1.6 Mbit/s down, 750 kbit/s up) and a 4x
//          CPU slowdown, fresh profile each run, 3 runs: time to first weather on screen, LCP, CLS, bytes and
//          requests; plus one unthrottled run for scale.
// a11y   — phone 414x715: tap targets under 44x44 and under 24x24, controls with no accessible name,
//          animations still running under prefers-reduced-motion, and Home at 130% text size.
import { chromium, webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('--site', 'https://www.probablyweather.co.za').replace(/\/$/, '');
const OUT = arg('--out', 'review/eval/shots/checks');
const ONLY = arg('--only', 'share,pwa,speed,a11y').split(',');
mkdirSync(OUT, { recursive: true });
const result = { site: SITE, at: new Date().toISOString() };
const STRAND = { latitude: -34.1163, longitude: 18.8362 };
const og = (html, p) => (html.match(new RegExp(`property="og:${p}"\\s+content="([^"]*)"`)) || html.match(new RegExp(`content="([^"]*)"\\s+property="og:${p}"`)) || [])[1]?.replace(/&amp;/g, '&');

if (ONLY.includes('share')) {
  result.share = [];
  for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
    const url = `${SITE}/s/${lang}/-34.12/18.84/rain/Strand`;
    const r = await fetch(url, { headers: { 'user-agent': 'WhatsApp/2.24.20.0 A' }, redirect: 'manual' });
    const html = await r.text();
    const row = { lang, url, status: r.status, title: og(html, 'title'), description: og(html, 'description'), image: og(html, 'image'), imageW: og(html, 'image:width'), imageH: og(html, 'image:height'), htmlLang: (html.match(/<html[^>]*lang="([^"]+)"/) || [])[1] };
    if (row.image) {
      const img = await fetch(row.image.replace('https://probablyweather.co.za', SITE));
      const buf = Buffer.from(await img.arrayBuffer());
      row.imageStatus = img.status; row.imageType = img.headers.get('content-type'); row.imageBytes = buf.length;
      const file = `share-card-${lang}.${/png/.test(row.imageType || '') ? 'png' : 'jpg'}`;
      writeFileSync(path.join(OUT, file), buf);
      row.file = file;
    }
    result.share.push(row);
    process.stderr.write(`share ${lang}: ${row.status} "${row.title}" | ${row.description} | ${row.imageStatus} ${row.imageType} ${row.imageBytes} B\n`);
  }
}

if (ONLY.includes('pwa')) {
  const m = await (await fetch(`${SITE}/manifest.json`)).json();
  const sw = await (await fetch(`${SITE}/sw.js`)).text();
  const icons = (m.icons || []).map((i) => ({ src: i.src, sizes: i.sizes, purpose: i.purpose || 'any', type: i.type }));
  const iconStatus = [];
  for (const i of icons) { const r = await fetch(new URL(i.src, `${SITE}/`)); iconStatus.push({ src: i.src, status: r.status, type: r.headers.get('content-type') }); }
  result.pwa = {
    name: m.name, short_name: m.short_name, id: m.id, start_url: m.start_url, scope: m.scope, display: m.display, orientation: m.orientation,
    theme_color: m.theme_color, background_color: m.background_color, lang: m.lang, icons, iconStatus,
    has512: icons.some((i) => /512/.test(i.sizes)), hasMaskable: icons.some((i) => /maskable/.test(i.purpose)),
    screenshots: (m.screenshots || []).length, shortcuts: (m.shortcuts || []).length,
    swBuildId: (sw.match(/const [_$\w]+\s*=\s*"([^"]+)"/) || sw.match(/BUILD_ID\s*=\s*['"]([^'"]+)/) || [])[1],
  };
  process.stderr.write(`pwa: ${JSON.stringify(result.pwa).slice(0, 400)}\n`);
}

if (ONLY.includes('speed')) {
  result.speed = [];
  const browser = await chromium.launch();
  for (const mode of ['slow4g', 'slow4g', 'slow4g', 'unthrottled']) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
      geolocation: STRAND, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg' });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    if (mode === 'slow4g') {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    let bytes = 0, requests = 0; const byType = {};
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; requests += 1; });
    cdp.on('Network.responseReceived', (e) => { byType[e.type] = (byType[e.type] || 0) + 1; });
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' });
    const dcl = Date.now() - t0;
    await page.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 60000 }).catch(() => {});
    const firstWeather = Date.now() - t0;
    await page.waitForFunction(() => { const i = document.querySelector('#bgImg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 60000 }).catch(() => {});
    const photo = Date.now() - t0;
    await page.waitForTimeout(6000);
    const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: Math.round(window.__cls * 1000) / 1000, lcpEl: (() => { const e = performance.getEntriesByType('largest-contentful-paint').at(-1)?.element; return e ? `${e.tagName}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}` : null; })() }));
    const row = { mode, dclMs: dcl, firstWeatherMs: firstWeather, photoMs: photo, lcpMs: m.lcp, lcpElement: m.lcpEl, cls: m.cls, kb: Math.round(bytes / 1024), requests, byType };
    result.speed.push(row);
    process.stderr.write(`speed ${mode}: ${JSON.stringify(row)}\n`);
    await ctx.close();
  }
  await browser.close();
}

if (ONLY.includes('a11y')) {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
    geolocation: STRAND, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5)); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PW_FIRST_RENDER === true, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const AUDIT = () => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],.hidden'); };
    const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('alt') || (el.labels && el.labels[0]?.textContent) || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    const ctl = [...document.querySelectorAll('a[href], button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(vis);
    const small44 = [], small24 = [], noName = [];
    for (const el of ctl) {
      const r = el.getBoundingClientRect();
      const id = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${!el.id && el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;
      if (r.width < 44 || r.height < 44) small44.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)} "${name(el).slice(0, 30)}"`);
      if (r.width < 24 || r.height < 24) small24.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!name(el)) noName.push(id);
    }
    const running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => `${a.animationName || a.constructor.name} on ${a.effect?.target?.id || a.effect?.target?.className || a.effect?.target?.tagName}`);
    const canvasParticles = !!document.querySelector('#particles canvas, #particles > *');
    return { controls: ctl.length, small44, small24, noName, running, canvasParticles, htmlLang: document.documentElement.lang };
  };
  result.a11y = { home: await page.evaluate(AUDIT) };
  await page.screenshot({ path: path.join(OUT, 'a11y-home-reduced-motion.png') });
  for (const [screen, sel] of [['hourly', '#homeHourly'], ['week', '#navWeek'], ['places', '#navSearch'], ['settings', '#navSettings']]) {
    await page.locator('#navHome').click().catch(() => {}); await page.waitForTimeout(500);
    await page.locator(sel).first().click().catch(() => {}); await page.waitForTimeout(900);
    result.a11y[screen] = await page.evaluate(AUDIT);
  }
  // 130% text: Chrome on iOS applies its Text Size setting like text-size-adjust; emulate with root zoom
  // on text only, via the same property WebKit honours.
  await page.locator('#navHome').click().catch(() => {}); await page.waitForTimeout(600);
  await page.addStyleTag({ content: 'html{ -webkit-text-size-adjust:130% !important; text-size-adjust:130% !important; } body{ zoom:1.3; }' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'a11y-home-text-130.png') });
  result.a11y.text130 = await page.evaluate(() => {
    const clipped = [];
    for (const sel of ['#headline', '#description', '#statsRow', '#homeHourly', '.nav', '#location', '#temp']) {
      const el = document.querySelector(sel); if (!el) continue;
      const over = [...el.querySelectorAll('*'), el].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible');
      if (over.length) clipped.push(`${sel}: ${over.length} element(s) cut off (e.g. ${over[0].className || over[0].tagName})`);
    }
    const nav = document.querySelector('.nav')?.getBoundingClientRect();
    return { clipped, pageScrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, navBottom: nav && Math.round(nav.bottom) };
  });
  process.stderr.write(`a11y: ${JSON.stringify(result.a11y).slice(0, 600)}\n`);
  await browser.close();
}

writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(result, null, 1));
console.log(`[checks] → ${OUT}/checks.json`);
