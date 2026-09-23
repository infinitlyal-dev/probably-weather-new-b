// Launch eval (2026-09-23): does the install banner appear on Al's phone class (Chrome on iPhone =
// WebKit + CriOS UA, 414x715)? Fresh profile per run; polls every 500 ms for 12 s.
//   node review/eval/scripts/banner-probe.mjs [--site URL] [--runs 3] [--engine webkit|chromium]
import { chromium, webkit } from 'playwright';
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('--site', 'https://www.probablyweather.co.za/');
const RUNS = Number(arg('--runs', 3));
const engine = arg('--engine', 'webkit') === 'chromium' ? chromium : webkit;
const UA = arg('--ua', 'ios-chrome') === 'android'
  ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
const browser = await engine.launch();
for (let run = 1; run <= RUNS; run++) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA,
    geolocation: { latitude: -34.1163, longitude: 18.8362 }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg' });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  const seen = [];
  for (let i = 0; i < 24; i++) {
    const s = await page.evaluate(() => {
      const b = document.getElementById('installBanner');
      return {
        weatherAt: window.__PW_WEATHER_AT ? Math.round(window.__PW_WEATHER_AT) : null,
        firstRender: !!window.__PW_FIRST_RENDER,
        firstSeen: (() => { try { return localStorage.getItem('pw_install_first_seen'); } catch { return 'n/a'; } })(),
        installLoaded: !!document.querySelector('script[src*="install"]') || !!window.__PW_INSTALL_READY,
        banner: b ? `${b.classList.contains('hidden') ? 'hidden' : 'shown'}${b.classList.contains('visible') ? '+visible' : ''}` : 'absent',
      };
    });
    seen.push({ ms: Date.now() - t0, ...s });
    await page.waitForTimeout(500);
  }
  const shownAt = seen.find((s) => s.banner.startsWith('shown'));
  const firstWeather = seen.find((s) => s.weatherAt);
  console.log(`run ${run}: weather at ${firstWeather ? firstWeather.ms : '-'} ms, firstSeen stamped ${seen.find((s) => s.firstSeen)?.ms ?? 'never'} ms, banner shown at ${shownAt ? shownAt.ms : 'NEVER'} ms (last state ${seen.at(-1).banner})`);
  await ctx.close();
}
await browser.close();
