// M5 gate — one icon family, one colour system, two corner radii.
//
// The three things this milestone claims, each asserted where it can actually
// fail rather than where it is easy to check:
//
//   1. ZERO emoji-presentation glyphs render in the app — probed in the LIVE
//      DOM on every screen at both widths, not only grepped in the source, so
//      a glyph reintroduced through a translated string or a template still
//      trips it. The typographic characters Al ruled OUT of scope (the Share
//      arrow, the chevrons, ×, ©) are allow-listed by name, so the rule stays
//      a hard zero instead of a soft one.
//   2. Every icon that renders belongs to ONE family: 24-unit box, currentColor
//      stroke, weight 2, round caps. Measured from the rendered SVG.
//   3. Two corner radii, and a colour system where yellow is brand, orange/red
//      are warnings, blue is rain and white is primary information.
//
// And the M3 lesson, which cost this arc twice: every leg asserts what SURVIVES
// on desktop, never only that the new thing is hidden. A gate that can only see
// the mobile side cannot see a desktop regression.
//
//   node scripts/verify-m5-icons.mjs  ->  output/m5-icons/*.png
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const output = path.join(root, 'output', 'm5-icons');
const DATE = '2026-08-08';

// Typographic characters, NOT emoji — Al's ruling. They match
// \p{Extended_Pictographic} but are text glyphs in a text font, and they stay.
const ALLOWED_TYPOGRAPHIC = new Set(['↗', '↔', '©', '✕', '×', '↻', '›', '‹', '→', '←', '…', '—', '·']);

const failures = [];
const notes = [];
function check(ok, message) {
  if (ok) notes.push(`PASS  ${message}`);
  else failures.push(message);
}

// ---------------------------------------------------------------------------
// Leg 1 — source scan. api/og.js is OUT of scope by Al's standing ruling: the
// share card is styled for feeds and keeps its glyphs and its amber.
// ---------------------------------------------------------------------------
const SOURCE_FILES = [
  'assets/app.js', 'assets/app.css', 'assets/weather-emoji.js',
  'assets/weather-icons.js', 'assets/weather-visuals.js', 'index.html',
  'assets/install.js',
  // weather-copy.js is the SOURCE OF TRUTH the per-language splits are
  // generated from. Scanning only the generated splits would mean an emoji
  // reintroduced in the bank is invisible until someone regenerates them.
  'assets/weather-copy.js', 'assets/witty-day-tags.js',
  'assets/copy/en.js', 'assets/copy/af.js',
  'assets/copy/zu.js', 'assets/copy/xh.js', 'assets/copy/st.js',
];
const PICTOGRAPHIC = /\p{Extended_Pictographic}/gu;
const scanForEmoji = (text) => {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const glyph of line.match(PICTOGRAPHIC) || []) {
      if (!ALLOWED_TYPOGRAPHIC.has(glyph)) hits.push({ line: i + 1, glyph });
    }
  });
  return hits;
};
const sourceHits = [];
for (const rel of SOURCE_FILES) {
  let text = null;
  try { text = readFileSync(path.join(root, rel), 'utf8'); } catch { text = null; }
  // A file that cannot be read is a FAILURE, not a skip. Swallowing it lets the
  // scan pass by not looking — rename or move a file and the guard evaporates.
  check(text !== null, `scan target ${rel} could not be read — the emoji scan cannot cover a file it never opened`);
  if (text === null) continue;
  for (const hit of scanForEmoji(text)) sourceHits.push(`${rel}:${hit.line} ${hit.glyph}`);
}
check(sourceHits.length === 0, `app source still carries emoji: ${sourceHits.slice(0, 12).join(' | ')}`);

// The allow-list must not become a way to smuggle everything through. This runs
// the REAL scan function over a synthetic file rather than comparing two
// literals declared a few lines apart, so it exercises the thing that could
// actually rot.
const selfTest = scanForEmoji('const share = "↗ Share";\nconst bad = "📍 pin";\n// © 2026');
check(selfTest.length === 1 && selfTest[0].line === 2 && selfTest[0].glyph === '📍',
  `the emoji scanner itself is broken — on a fixture with one pin and two allow-listed glyphs it returned ${JSON.stringify(selfTest)}`);

// ---------------------------------------------------------------------------
// Leg 2 — two corner radii, in the stylesheet.
// ---------------------------------------------------------------------------
const css = readFileSync(path.join(root, 'assets/app.css'), 'utf8');
// LONGHAND TOO. The first version of this leg matched `border-radius:` only and
// passed while three longhand corner declarations carried 18px and 12px. And the
// value is terminated by `;` OR `}`, so a last-declaration-in-block with no
// trailing semicolon is caught as well.
const radii = [...css.matchAll(/border-(?:(?:top|bottom)-(?:left|right)-)?radius:\s*([^;}]+)[;}]/g)]
  .map((m) => m[1].trim());
const ALLOWED_RADII = new Set(['var(--r-sm)', 'var(--r-lg)', '999px', '50%', '0', '0 0 var(--r-sm) 0',
  'var(--r-lg) var(--r-lg) 0 0', '0 0 var(--r-lg) var(--r-lg)']);
const strayRadii = [...new Set(radii.filter((r) => !ALLOWED_RADII.has(r)))];
check(strayRadii.length === 0, `a third corner radius is back in app.css: ${strayRadii.join(' | ')}`);
check(/--r-sm:\s*\d+px/.test(css) && /--r-lg:\s*\d+px/.test(css), 'the two radius tokens are not both defined at :root');
// The radius scan must be able to see a longhand violation, or it is the same
// probe that already shipped blind once.
check(/border-top-left-radius:/.test(css) ? radii.length > [...css.matchAll(/border-radius:/g)].length : true,
  'the radius scan is not picking up the longhand corner properties present in this sheet');

// ---------------------------------------------------------------------------
// Leg 3 — the colour system, in the stylesheet.
// ---------------------------------------------------------------------------
for (const token of ['--brand-gold', '--brand-gold-1', '--brand-gold-2', '--on-gold', '--warn-high', '--warn-max', '--rain-blue', '--cold-blue']) {
  check(new RegExp(`${token}:\\s*#[0-9a-f]{3,8}`, 'i').test(css), `colour token ${token} is missing from :root`);
}
// The literals M5 retired must not come back.
for (const dead of ['#9932cc', '#4682b4', '#a9a9a9', '#c0c0c0', '#a0a0a0', '#ff6600', '#00bfff', '#87ceeb', '#fdd835', '#f5c542', '#3b82f6', '#ffd466', '#ffe08a', '#15100a']) {
  check(!css.toLowerCase().includes(dead), `retired colour literal ${dead} is back in app.css`);
}

// ---------------------------------------------------------------------------
// The live app.
// ---------------------------------------------------------------------------
// The Cape Doctor banner needs >= 50 km/h in the Western Cape to appear, and it
// is the ONE surface M5 sanctions orange on — so the warning icon was never
// drawn under the first version of this gate. A screen can ask for the windy
// payload instead of the calm one.
let activeWindKph = 33;

function payload() {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    tempC: 17 - (i % 6), feelsLikeC: 14, rainChance: (i % 7) * 12, precipMm: 0.2,
    windKph: 33 - (i % 9), windDir: 205, cloudPct: 40 + (i % 5) * 12, humidity: 74,
    uv: i % 12 < 5 ? 7 : 0, condition: 'cloudy',
  }));
  const daily = Array.from({ length: 7 }, (_, d) => ({
    highC: [17, 19, 36, 8, 22, 25, 14][d], lowC: [11, 12, 24, -1, 13, 15, 9][d],
    rainChance: [10, 60, 0, 5, 35, 0, 80][d], uv: [4, 2, 9, 1, 6, 8, 3][d], windKph: 30,
    conditionKey: ['cloudy', 'rain', 'heat', 'cold', 'partly-cloudy', 'clear', 'storm'][d],
    conditionLabel: 'Cloudy', sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
  }));
  return {
    ok: true,
    location: { name: 'Somerset West, Western Cape', lat: -34.08, lon: 18.85 },
    now: {
      tempC: 15, feelsLikeC: 14, uv: 7, isDay: true, windKph: activeWindKph, rainChance: 20,
      cloudPct: 60, conditionKey: 'cloudy', conditionLabel: 'Cloudy',
      sunrise: `${DATE}T06:20`, sunset: `${DATE}T19:40`,
    },
    hourly, daily,
    wind_kph: activeWindKph, maxWindKph: 78, gustKph: 78, windDir: 205,
    consensus: { confidenceKey: 'decent' },
    meta: {
      localHour: 15, utcOffsetSeconds: 7200, confidence: 'high',
      sources: ['Open-Meteo', 'WeatherAPI', 'MET Norway', 'Pirate Weather', 'Tomorrow.io'].map((name) => ({ name, ok: true })),
      sourceConditions: [],
      sourceRanges: [
        { name: 'Open-Meteo', minTemp: 11, maxTemp: 17 }, { name: 'WeatherAPI', minTemp: 9, maxTemp: 18 },
        { name: 'MET Norway', minTemp: 13, maxTemp: 17 }, { name: 'Pirate Weather', minTemp: 13, maxTemp: 16 },
        { name: 'Tomorrow.io', minTemp: 14, maxTemp: 16 },
      ],
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
      // The geocode proxy is served so the search RESULTS list can be probed.
      // Without it the Search screen only ever shows its empty state, and the
      // two icon slots that live in a result row — the favourite star and the
      // mini condition icon — would never be seen by this gate at all.
      const body = pathname === '/api/weather' ? payload()
        : pathname === '/api/locate' ? { ok: true, lat: -34.08, lon: 18.85, name: 'Somerset West, Western Cape' }
        : pathname === '/api/geocode' ? {
          ok: true,
          results: [
            { name: 'Stellenbosch', display_name: 'Stellenbosch, Western Cape', lat: '-33.93', lon: '18.86' },
            { name: 'Strand', display_name: 'Strand, Western Cape', lat: '-34.12', lon: '18.83' },
            { name: 'Gordons Bay', display_name: "Gordon's Bay, Western Cape", lat: '-34.16', lon: '18.87' },
          ],
        }
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

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();

async function openApp(width, height, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 2,
    isMobile: width < 769, hasTouch: width < 769,
    ...(opts.geolocation
      ? { permissions: ['geolocation'], geolocation: { latitude: -34.08, longitude: 18.85 } }
      : {}),
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
  await page.waitForTimeout(700);
  return { ctx, page };
}

// One probe, run identically on both widths. Everything it returns is a fact
// about what the browser actually painted.
const PROBE = (allowed) => {
  const re = /\p{Extended_Pictographic}/gu;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const emoji = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style')) continue;
    // Only what is actually VISIBLE — a glyph inside a hidden panel on the
    // other breakpoint is not something a user can see.
    if (!parent.getClientRects().length) continue;
    for (const g of node.textContent.match(re) || []) {
      if (!allowed.includes(g)) emoji.push(`${parent.tagName}#${parent.id || parent.className}: ${g}`);
    }
  }
  const icons = [...document.querySelectorAll('svg.pw-icon')]
    .filter((svg) => svg.getClientRects().length)
    .map((svg) => ({
      // Identity + fill state, so the run can prove WHICH icons were drawn.
      d: svg.dataset.icon === 'star'
        ? (svg.getAttribute('fill') === 'currentColor' ? 'star-filled' : 'star-outline')
        : svg.dataset.icon,
      fill: svg.getAttribute('fill'),
      label: svg.getAttribute('aria-label'),
      viewBox: svg.getAttribute('viewBox'),
      stroke: svg.getAttribute('stroke'),
      width: svg.getAttribute('stroke-width'),
      cap: svg.getAttribute('stroke-linecap'),
      // The rendered colour, so "currentColor drives it" is measured, not assumed.
      colour: getComputedStyle(svg).color,
      box: svg.getBoundingClientRect().width,
      host: svg.parentElement?.className || svg.parentElement?.id || '',
    }));
  // EVERY visible element's computed radius, not three named selectors. The
  // first version of this gate collected three and asserted none of them, which
  // is how a longhand 18px lived through a "two radii" PASS.
  const radiusValues = [...new Set([...document.querySelectorAll('*')]
    .filter((el) => el.getClientRects().length)
    .map((el) => getComputedStyle(el).borderRadius)
    .filter(Boolean))];
  return {
    emoji,
    icons,
    iconCount: icons.length,
    radiusValues,
    // Desktop-survival probes: these must return a real value on >=769px, so a
    // regression that deletes the control shows up as null rather than as a
    // cheerful "hidden as expected".
    survives: {
      navButtons: [...document.querySelectorAll('.nav button')].filter((b) => b.getClientRects().length).map((b) => b.id),
      shareBtnText: document.getElementById('shareBtn')?.textContent?.trim() || null,
      shareBtnShown: !!document.getElementById('shareBtn')?.getClientRects().length,
      myLocationShown: !!document.getElementById('myLocationHome')?.getClientRects().length,
      heroCardShown: !!document.getElementById('heroCard')?.getClientRects().length,
      statsRowShown: !!document.getElementById('statsRow')?.getClientRects().length,
    },
    tokens: {
      gold: getComputedStyle(document.documentElement).getPropertyValue('--brand-gold').trim(),
      rSm: getComputedStyle(document.documentElement).getPropertyValue('--r-sm').trim(),
      rLg: getComputedStyle(document.documentElement).getPropertyValue('--r-lg').trim(),
    },
  };
};

// minIcons: the per-screen coverage floor, taken from a MEASURED run, not
// guessed. Settings and Sources genuinely draw none — stating that as an
// explicit 0 is the difference between "no expectation" and "expected none".
const SCREENS = [
  { key: 'home', minIcons: { mobile: 1, desktop: 8 }, open: async () => {} },

  // The two widths reach Hourly through DIFFERENT controls — the mobile CTA in
  // the stats band, the desktop floating pill — so the opener has to know which
  // frame it is on rather than taking whichever selector matches first.
  { key: 'hourly', minIcons: { mobile: 16, desktop: 16 }, open: async (p, width) => { await p.click(width < 769 ? '#homeHourly' : '#navHourlyHome'); } },
  { key: 'weekly', minIcons: { mobile: 7, desktop: 7 }, open: async (p) => { await p.click('#navWeek'); } },
  { key: 'day-detail', minIcons: { mobile: 8, desktop: 8 }, open: async (p) => { await p.click('#navWeek'); await p.waitForTimeout(300); await p.click('.daily-row-tappable'); } },
  { key: 'search', minIcons: { mobile: 2, desktop: 2 }, open: async (p) => { await p.click('#navSearch'); } },
  // Search RESULTS, not the empty state: the favourite star and the per-result
  // condition icon only exist once a query has returned rows, so a gate that
  // stops at the empty screen never sees two of the icon slots this milestone
  // replaced.
  {
    key: 'search-results',
    minIcons: { mobile: 6, desktop: 6 },
    open: async (p) => {
      await p.click('#navSearch');
      await p.waitForTimeout(250);
      await p.fill('#searchInput', 'stellen');
      await p.waitForSelector('.search-result-item', { timeout: 8000 });
      // Tap the first star so BOTH star states are on screen at once — the
      // filled state is what the duplicate-fill-attribute bug made invisible,
      // and no earlier version of this gate ever rendered it.
      await p.click('.search-result-item .fav-star');
      await p.waitForTimeout(400);
    },
  },
  // The warning icon: the only orange M5 sanctions, and it needs >=50km/h in the
  // Western Cape to exist at all.
  { key: 'wind-warning', wind: 62, minIcons: { mobile: 2, desktop: 8 }, open: async () => {} },
  // The pin toast: a real geolocation grant, so the toast's icon is drawn by the
  // same path a user's tap takes.
  {
    key: 'location-toast',
    minIcons: { mobile: 2, desktop: 8 },
    geolocation: true,
    open: async (p) => {
      await p.click('#navSearch');
      await p.waitForTimeout(250);
      await p.click('#useMyLocationBtn');
      await p.waitForSelector('.toast.show', { timeout: 8000 });
    },
  },
  { key: 'settings', minIcons: { mobile: 0, desktop: 0 }, open: async (p) => { await p.click('#navSettings'); } },
  { key: 'sources', minIcons: { mobile: 0, desktop: 0 }, open: async (p) => { await p.click('#navSettings'); await p.waitForTimeout(300); await p.click('#settingsSourcesRow'); } },
];

const report = { widths: {}, screenshots: [] };
for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 900]]) {
  const perScreen = [];
  for (const screen of SCREENS) {
    activeWindKph = screen.wind ?? 33;
    const { ctx, page } = await openApp(width, height, { geolocation: screen.geolocation });
    try {
      await screen.open(page, width);
      await page.waitForTimeout(600);
      const probe = await page.evaluate(PROBE, [...ALLOWED_TYPOGRAPHIC]);
      const file = path.join(output, `m5-${screen.key}-${width}x${height}.png`);
      await page.screenshot({ path: file, fullPage: false });
      report.screenshots.push(path.relative(root, file).replaceAll('\\', '/'));
      perScreen.push({ screen: screen.key, ...probe });

      check(probe.emoji.length === 0, `[${label}/${screen.key}] emoji still rendering: ${probe.emoji.slice(0, 6).join(' | ')}`);
      for (const icon of probe.icons) {
        check(icon.viewBox === '0 0 24 24', `[${label}/${screen.key}] icon on ${icon.host} has viewBox ${icon.viewBox}, not the family's 0 0 24 24`);
        check(icon.stroke === 'currentColor', `[${label}/${screen.key}] icon on ${icon.host} strokes ${icon.stroke}, not currentColor — the colour system cannot drive it`);
        check(icon.width === '2', `[${label}/${screen.key}] icon on ${icon.host} has stroke-width ${icon.width}, not the family's 2`);
        check(icon.cap === 'round', `[${label}/${screen.key}] icon on ${icon.host} has stroke-linecap ${icon.cap}, not round`);
        check(icon.box >= 14 && icon.box <= 40, `[${label}/${screen.key}] icon on ${icon.host} renders at ${icon.box.toFixed(1)}px, outside the 14-40px band the family is drawn for`);
      }
      // THE radius assertion — on what the browser actually painted, on every
      // visible element. `0px` / `50%` / `999px` are the exempt shapes; anything
      // else must be one of the two tokens' resolved values.
      const allowedPx = new Set(['0px', '50%', '999px', probe.tokens.rSm, probe.tokens.rLg]);
      const strays = probe.radiusValues
        .flatMap((v) => v.split('/').join(' ').split(/\s+/).filter(Boolean))
        .filter((part) => !allowedPx.has(part));
      check(strays.length === 0,
        `[${label}/${screen.key}] radii outside the two tokens are painting: ${[...new Set(strays)].join(', ')} (tokens ${probe.tokens.rSm}/${probe.tokens.rLg})`);
      check(probe.tokens.rSm && probe.tokens.rLg && probe.tokens.rSm !== probe.tokens.rLg,
        `[${label}/${screen.key}] the two radius tokens did not resolve distinctly (${probe.tokens.rSm} / ${probe.tokens.rLg})`);
      // Coverage floor per screen. Without it the icon-contract loop above is
      // vacuously true anywhere the screen happens to draw nothing.
      const expected = screen.minIcons?.[label] ?? 0;
      check(probe.iconCount >= expected,
        `[${label}/${screen.key}] drew ${probe.iconCount} icons, expected at least ${expected} — either the icons stopped rendering or this gate stopped covering them`);
    } finally {
      await ctx.close();
    }
  }
  report.widths[label] = perScreen;
}

// ---- Every icon in the family must have been seen SOMEWHERE ---------------
// The per-screen floors above stop the contract loop being vacuous. This stops
// the whole run being vacuous for an individual icon: the warning, the pin and
// the filled star are exactly the three that no earlier version of this gate
// ever rendered, and finding them missing is the point.
const drawn = new Set(Object.values(report.widths).flat().flatMap((s) => s.icons.map((i) => i.d)));
for (const required of ['warning', 'pin', 'star-filled', 'star-outline']) {
  check(drawn.has(required), `the ${required} icon was never rendered in this run — a contract asserted over an icon that never draws proves nothing about it`);
}

// ---- Desktop survival (the M3 lesson) -------------------------------------
const desktopHome = report.widths.desktop.find((s) => s.screen === 'home');
const mobileHome = report.widths.mobile.find((s) => s.screen === 'home');
check(desktopHome.survives.shareBtnShown, 'the >=769px home lost its Share button — M5 was not allowed to touch desktop layout');
check(desktopHome.survives.shareBtnText?.startsWith('↗'), `the desktop Share button no longer carries its ↗ (got "${desktopHome.survives.shareBtnText}") — that arrow is typographic and was ruled OUT of the icon sweep`);
check(desktopHome.survives.myLocationShown, 'the >=769px home lost its My Location button');
check(!desktopHome.survives.heroCardShown, 'the mobile hero card leaked onto the >=769px frame');
check(!desktopHome.survives.statsRowShown, 'the mobile stats row leaked onto the >=769px frame');
check(mobileHome.survives.heroCardShown, 'the mobile hero card stopped rendering at 390px');
// The positive counterpart the desktop stats-row check needs: without it, a
// stats row that stopped rendering ANYWHERE still reads green above.
check(mobileHome.survives.statsRowShown, 'the mobile stats row stopped rendering at 390px');
check(!mobileHome.survives.shareBtnShown, 'the floating Share pill came back on mobile home (M1 replaced it with the nav item)');
check(mobileHome.survives.navButtons.includes('navShare'), 'the mobile nav lost its Share item');
check(!desktopHome.survives.navButtons.includes('navShare'), 'nav Share (.m-only) leaked onto the >=769px frame');

// ---------------------------------------------------------------------------
await browser.close();
server.close();

const totalIcons = Object.values(report.widths).flat().reduce((n, s) => n + s.iconCount, 0);
report.summary = { checks: notes.length + failures.length, passed: notes.length, failed: failures.length, iconsProbed: totalIcons };
writeFileSync(path.join(output, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`[m5 icons] ${notes.length}/${notes.length + failures.length} checks PASS across mobile+desktop x ${SCREENS.length} screens; ${totalIcons} rendered icons probed.`);
console.log(`[m5 icons] screenshots: ${report.screenshots.length} -> output/m5-icons/`);
if (failures.length) {
  console.error(`\n[m5 icons] ${failures.length} FAILURES:`);
  for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
  process.exit(1);
}
