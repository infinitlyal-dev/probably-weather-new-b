// Launch eval: what the live app shows right now for a city (phone, WebKit, Chrome-on-iPhone UA).
//   node review/eval/scripts/city-now.mjs <name> <lat> <lon> [out.png]
import { webkit } from 'playwright';
const [name, lat, lon, out = `review/eval/shots/city-${name}.png`] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 414, height: 715 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
  geolocation: { latitude: Number(lat), longitude: Number(lon) }, permissions: ['geolocation'], timezoneId: 'Africa/Johannesburg' });
await ctx.addInitScript(() => { try { localStorage.setItem('pw_install_dismissed_until', String(9e15)); localStorage.setItem('pw_home', '{"lat":0,"lon":0}'); } catch {} });
const p = await ctx.newPage();
await p.goto('https://www.probablyweather.co.za/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__PW_FIRST_RENDER === true && window.__PW_LAST_DISPLAY, null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3500);
const s = await p.evaluate(() => ({ at: new Date().toISOString(), place: document.querySelector('#location')?.textContent?.trim(), condition: document.querySelector('#description')?.textContent?.trim(), caption: document.querySelector('#headline')?.textContent?.trim(), stats: document.querySelector('#statsRow')?.innerText?.replace(/\s+/g, ' ').trim(), display: window.__PW_LAST_DISPLAY }));
await p.screenshot({ path: out });
console.log(JSON.stringify(s));
await b.close();
