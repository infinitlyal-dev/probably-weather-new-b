// MOCKUPS ONLY — Hourly / Weekly / Plekke / Instellings on the new design
// language, for Al's ruling before M2 and M3 build (his ruling 2026-08-07).
//
// These are HARNESS RENDERS, NOT CODE COMMITMENTS. Nothing here is written into
// the app: the script loads the real app with a real-shaped payload, then swaps
// each secondary screen's markup for a mockup built from that same live data and
// screenshots it. Layout base is the GPT reference set in `gpt images/`.
//
//   node scripts/mockup-secondary-screens.mjs  ->  output/mockups/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'mockups');
const DATE = '2026-08-07';

function payload() {
  const base = { tempC: 17, low: 11, high: 17, rain: 0, cloud: 88, uv: 4, wind: 33, gust: 58, dir: 205 };
  const hourly = Array.from({ length: 48 }, (_, i) => {
    const t = [17, 16, 16, 15, 14, 14, 13, 13, 12, 12, 12, 12][i % 12];
    const r = [0, 0, 0, 0, 0, 5, 10, 15, 15, 10, 10, 10][i % 12];
    return {
      tempC: t, feelsLikeC: t - 3, rainChance: r, precipMm: r > 10 ? 0.4 : 0,
      windKph: 33 - (i % 12), windDir: base.dir + (i % 30), cloudPct: base.cloud,
      humidity: 74, uv: i % 12 < 5 ? 4 : 0, condition: r > 5 ? 'rain' : 'cloudy',
    };
  });
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: [17, 19, 21, 18, 16, 20, 22][d], lowC: [11, 12, 13, 11, 10, 12, 14][d],
    rainChance: [0, 10, 5, 45, 70, 15, 0][d], uv: [4, 5, 6, 3, 2, 5, 7][d],
    windKph: [33, 28, 22, 30, 41, 25, 18][d],
    conditionKey: ['cloudy', 'partly-cloudy', 'clear', 'rain-possible', 'rain', 'partly-cloudy', 'clear'][d],
    conditionLabel: 'Mock', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: base.tempC, feelsLikeC: 14, uv: base.uv, isDay: true, windKph: base.wind,
      rainChance: base.rain, cloudPct: base.cloud, conditionKey: 'cloudy',
      conditionLabel: 'Cloudy', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: base.wind, maxWindKph: base.gust, gustKph: base.gust, windDir: base.dir,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [], sourceRanges: [],
      conditionConfidence: { level: 'high', finalCondition: 'cloudy', sourceAgreement: '4/5' },
    },
  };
}

function startServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) {
      const body = pathname === '/api/weather' ? payload()
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' }
        : {};
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    if (pathname.startsWith('/_vercel/')) { res.writeHead(204).end(); return; }
    let file = null; let buf = null;
    try { file = path.resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1)); buf = readFileSync(file); }
    catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Design language shared by all four mockups — the same tokens the shipped home
// screen uses, so these read as the same product.
const MOCK_CSS = `
  body { background: #0d0d12; }
  #bgImg, #scrim, .hero-card { display: none !important; }
  .screenPanel { position: fixed !important; inset: 0 !important; left: 0 !important; right: 0 !important;
    background: #0d0d12 !important; border-radius: 0 !important; border: 0 !important;
    padding: 0 !important; overflow: hidden !important; z-index: 60; }
  .mk { position: absolute; inset: 0; display: flex; flex-direction: column;
    padding: max(0.5rem, env(safe-area-inset-top)) 16px calc(var(--nav-h,72px) + 12px);
    font-family: 'Onest Prototype', -apple-system, sans-serif; color: #fff; overflow: hidden; }
  .mk-head { display: flex; align-items: center; gap: 10px; padding: 6px 0 10px; }
  .mk-back { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px;
    background: #16171d; color: #fff; font-size: 1.05rem; flex: none; }
  .mk-h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; margin: 2px 0 2px; }
  .mk-sub { font-size: 0.84rem; color: #aab0bd; margin-bottom: 12px; }
  .mk-card { background: #16171d; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  /* One segmented-control grammar, shared by the Hourly metric toggle and the
     Settings unit toggles (Al's ruling 2026-08-08): same shape, active is
     yellow-FILLED with dark text, inactive is white on the dark track. */
  .mk-seg { display: inline-grid; grid-auto-flow: column; background: #0d0d12;
    border-radius: 8px; padding: 3px; }
  .mk-seg span { color: #fff; font-weight: 700; font-size: 0.8rem;
    padding: 6px 14px; border-radius: 6px; text-align: center; }
  .mk-seg span.on { background: #ffd700; color: #1a1a2e; font-weight: 800; }
  .mk-seg-wide { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; width: 100%; margin: 0; }
  .mk-row { display: grid; align-items: center; padding: 11px 12px; background: #16171d;
    border-radius: 10px; margin-bottom: 6px; font-size: 0.94rem; }
  .mk-lbl { font-size: 0.63rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    color: #aab0bd; margin: 12px 0 6px; }
  .mk-val { color: #aab0bd; font-weight: 500; }
  .mk-gold { color: #ffd700; }
  .mk-num { font-variant-numeric: tabular-nums; }
  .mk-pill { display: inline-block; padding: 7px 12px; border-radius: 10px; background: #16171d;
    color: #fff; font-size: 0.84rem; font-weight: 600; margin-bottom: 12px; }
  .mk-input { display: flex; align-items: center; gap: 9px; background: #16171d; border-radius: 10px;
    padding: 13px 14px; margin-bottom: 10px; color: #aab0bd; font-size: 0.98rem; }
  .mk-cta { display: flex; align-items: center; justify-content: center; gap: 8px;
    background: #ffd700; color: #1a1a2e; font-weight: 800; border-radius: 10px;
    padding: 13px; margin-bottom: 16px; font-size: 0.95rem; }
  .mk-note { position: absolute; left: 0; right: 0; bottom: calc(var(--nav-h,72px) + 6px);
    text-align: center; font-size: 0.62rem; color: #5a616e; letter-spacing: 0.04em; }
`;

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

const SCREENS = [
  ['hourly-temp', '#hourly-screen'],
  ['hourly-rain', '#hourly-screen'],
  ['hourly-wind', '#hourly-screen'],
  ['weekly', '#week-screen'],
  ['plekke', '#search-screen'],
  ['instellings', '#settings-screen'],
];

const files = [];
for (const [name, sel] of SCREENS) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${DATE}T15:12:00+02:00`) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pw_home', JSON.stringify({ name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85, mode: 'gps' }));
      localStorage.setItem('pw_install_dismissed_until', String(Date.now() + 864e5));
    } catch (_) {}
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const s = document.getElementById('pwSplash');
    return !s || s.classList.contains('splash-done');
  }, null, { timeout: 15000 });
  await page.addStyleTag({ content: MOCK_CSS });

  await page.evaluate(([screenSel, which]) => {
    const norm = window.__PW_LAST_NORM;
    const panel = document.querySelector(screenSel);
    document.querySelectorAll('.screenPanel').forEach((p) => { p.classList.add('hidden'); p.hidden = true; });
    panel.classList.remove('hidden'); panel.hidden = false;
    document.body.classList.remove('home-active');

    const hours = norm.hourly.slice(15, 23); // 8 columns: 12 crowded the time row at 390px
    const esc = (v) => String(v);
    const head = (title, sub) => `<div class="mk-head"><div class="mk-back">←</div>
      <div><div class="mk-h1">${title}</div></div></div><div class="mk-sub">${sub}</div>`;

    let body = '';
    if (which.startsWith('hourly')) {
      const metric = which.split('-')[1] || 'temp';
      const W = 330, H = 58;
      const series = { temp: hours.map((h) => h.tempC), wind: hours.map((h) => Math.round(h.windKph)) }[metric];
      const seg = `<div class="mk-seg mk-seg-wide">
          <span class="${metric === 'temp' ? 'on' : ''}">Temp</span>
          <span class="${metric === 'rain' ? 'on' : ''}">Rain</span>
          <span class="${metric === 'wind' ? 'on' : ''}">Wind</span></div>`;
      const times = hours.map((h, i) => `<span class="mk-num" style="flex:1;text-align:center;font-size:0.62rem;color:#aab0bd">${String((15 + i) % 24).padStart(2, '0')}:00</span>`).join('');
      let chart = '';
      if (metric === 'rain') {
        // Rain: bars only. No temperature line anywhere near it.
        const bars = hours.map((h) => `<span style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:${H}px">
            <span class="mk-num" style="font-size:0.62rem;color:#aab0bd;margin-bottom:3px">${h.rainChance}%</span>
            <span style="width:14px;border-radius:3px 3px 0 0;background:#4a9eff;height:${Math.max(3, h.rainChance * 1.6)}px"></span></span>`).join('');
        chart = `<div style="display:flex;align-items:flex-end">${bars}</div>`;
      } else {
        // Temp or wind: a single line, its own scale, its own value labels.
        const lo = Math.min(...series), hi = Math.max(...series), span = Math.max(1, hi - lo);
        const pts = series.map((v, i) => `${(i * W) / (series.length - 1)},${H - ((v - lo) / span) * H}`).join(' ');
        const labels = series.map((v) => `<span class="mk-num" style="flex:1;text-align:center;font-size:0.68rem;font-weight:700">${v}${metric === 'temp' ? '°' : ''}</span>`).join('');
        const dirs = metric === 'wind'
          ? `<div style="display:flex;margin-top:5px">${hours.map(() => `<span style="flex:1;text-align:center;font-size:0.62rem;font-weight:700;color:#aab0bd">SW</span>`).join('')}</div>`
          : `<div style="display:flex;margin-top:4px">${hours.map((h) => `<span style="flex:1;text-align:center;font-size:0.9rem">${h.rainChance > 5 ? '\u{1F327}\uFE0F' : '\u2601\uFE0F'}</span>`).join('')}</div>`;
        chart = `<div style="display:flex">${labels}</div>
          <svg viewBox="0 0 ${W} ${H}" width="100%" height="46" preserveAspectRatio="none" style="display:block;margin:2px 0 4px">
            <polyline points="${pts}" fill="none" stroke="#ffd700" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>${dirs}`;
      }
      const unit = { temp: '\u00b0C', rain: '% chance', wind: 'km/h' }[metric];
      body = head('Hourly forecast', 'Somerset West \u00b7 Today')
        + seg
        + `<div class="mk-card"><div style="font-size:0.66rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#aab0bd;margin-bottom:8px">${metric} \u00b7 ${unit}</div>
             ${chart}
             <div style="display:flex;border-top:1px solid rgba(255,255,255,.08);margin-top:8px;padding-top:6px">${times}</div>
           </div>`
        + hours.slice(0, 4).map((h, i) => `<div class="mk-row" style="grid-template-columns:52px 30px 1fr 58px 74px">
             <span class="mk-num mk-val">${String((15 + i) % 24).padStart(2, '0')}:00</span>
             <span>${h.rainChance > 5 ? '\u{1F327}\uFE0F' : '\u2601\uFE0F'}</span>
             <span class="mk-num" style="font-weight:800">${h.tempC}\u00b0</span>
             <span class="mk-num mk-val">${h.rainChance}%</span>
             <span class="mk-num mk-val" style="text-align:right">${Math.round(h.windKph)} <b style="color:#fff">SW</b></span>
           </div>`).join('');
    } else if (which === 'weekly') {
      const names = ['Today', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
      // Column headers restored (Al's ruling 2026-08-08) — parity with the live
      // desktop 7-Day, which has always labelled these columns.
      const HEAD = `<div style="display:grid;grid-template-columns:1fr 30px 54px 46px 46px;
          padding:0 12px 6px;font-size:0.6rem;font-weight:700;letter-spacing:0.07em;
          text-transform:uppercase;color:#aab0bd">
          <span>Day</span><span></span><span style="text-align:right">High</span>
          <span style="text-align:right">Low</span><span style="text-align:right">Rain</span></div>`;
      body = head('7-day forecast', 'Somerset West \u00b7 Western Cape') + HEAD
        + norm.daily.slice(0, 7).map((d, i) => `<div class="mk-row" style="grid-template-columns:1fr 30px 54px 46px 46px">
             <span style="font-weight:${i === 0 ? 800 : 600}">${names[i]}${d.rainChance >= 60 ? ' <span style="font-size:0.55rem;font-weight:800;letter-spacing:0.05em;background:#4a9eff;color:#04121f;padding:2px 5px;border-radius:4px;vertical-align:2px">RAIN</span>' : ''}</span>
             <span>${d.rainChance > 40 ? '\u{1F327}\uFE0F' : d.rainChance > 5 ? '\u26C5' : '\u2600\uFE0F'}</span>
             <span class="mk-num mk-val" style="text-align:right">${d.rainChance}%</span>
             <span class="mk-num" style="text-align:right;font-weight:800">${Math.round(d.highC)}\u00b0</span>
             <span class="mk-num mk-val" style="text-align:right">${Math.round(d.lowC)}\u00b0</span>
           </div>`).join('');
    } else if (which === 'plekke') {
      body = head('Places', 'Search, save, switch')
        + `<div class="mk-input"><span>\u{1F50D}</span><span>Search for a place</span></div>`
        + `<div class="mk-cta"><span>\u{1F4CD}</span><span>Use my current location</span></div>`
        + `<div class="mk-lbl">Favourites</div>`
        + ['Somerset West', 'Cape Town', 'Stellenbosch'].map((n, i) => `<div class="mk-row" style="grid-template-columns:22px 1fr 54px">
             <span class="mk-gold">★</span><span>${n}</span>
             <span class="mk-num mk-val" style="text-align:right">${[17, 19, 21][i]}°</span></div>`).join('')
        + `<div class="mk-lbl">Recent</div>`
        + ['Hermanus', 'Paarl'].map((n, i) => `<div class="mk-row" style="grid-template-columns:22px 1fr 54px">
             <span class="mk-val">↻</span><span>${n}</span>
             <span class="mk-num mk-val" style="text-align:right">${[16, 22][i]}°</span></div>`).join('');
    } else {
      const row = (k, v) => `<div class="mk-row" style="grid-template-columns:1fr auto"><span>${k}</span><span class="mk-val">${v} ›</span></div>`;
      const seg = (k, a, b) => `<div class="mk-row" style="grid-template-columns:1fr auto"><span>${k}</span>
        <span class="mk-seg" style="margin:0"><span class="on">${a}</span><span>${b}</span></span></div>`;
      body = head('Settings', 'Units, display and language')
        + `<div class="mk-lbl">Units</div>` + seg('Temperature', '°C', '°F') + seg('Wind speed', 'km/h', 'mph') + seg('Rainfall', 'mm', 'in')
        + `<div class="mk-lbl">Display</div>` + seg('Time format', '24h', '12h') + row('Language', 'English')
        + `<div class="mk-lbl">About</div>` + row('Weather sources', '5') + row('Privacy policy', '');
    }

    panel.innerHTML = `<div class="mk">${body}<div class="mk-note">MOCKUP — not shipped code</div></div>`;
  }, [sel, name]);

  await page.waitForTimeout(500);
  const file = path.join(output, `mockup-${name}-390x844.png`);
  await page.screenshot({ path: file });
  files.push(path.relative(root, file));
  await ctx.close();
}

await browser.close();
server.close();
console.log(files.join('\n'));
