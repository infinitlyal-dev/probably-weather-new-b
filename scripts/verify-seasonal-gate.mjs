// IS ANY LINE ON SCREEN OUT OF SEASON OR OUT OF PLACE?
//
// The bespoke path used to skip the month/region gate the condition bank obeys, so
// "the start of November" captioned a photograph in September
// (review/LINE-AUDIT-2026-09-19.md). This runs the REAL code — app.js from
// `let __pickerToken` to `function createParticles(`, i.e. the picker, setBackgroundFor
// and applyBespokeLine — against the shipped tables, with the clock set to the first
// Saturday of every month from June 2026 to May 2027, in English and Afrikaans, in
// Strand and in Johannesburg. Every line the rotation can draw is enumerated by
// sweeping Math.random with the line memo cleared between draws.
//
// Two passes per month:
//   PICKER  — setBackgroundFor(condition) for all nine photograph folders x four times
//             of day, exactly as the app calls it on that Saturday.
//   EVERY PHOTOGRAPH — applyBespokeLine on all 1,008 slot paths with that month's
//             context, so the proof covers every line, not only Saturday photographs.
//
// FAILS if any line appears in a month its tag excludes or in a place its tag excludes.
// Also reports, as information, how often each line on the season review list
// (review/seasonal-tags-worklist.json) still reaches the screen while Al's ruling is open,
// and how many photographs fell back to the condition line (nothing in season).
//
// --control cuts the gate out of the lifted code (the pre-2026-09-19 behaviour) and
// must FAIL: it proves the check can see an out-of-season line when one is served.
//
//   node scripts/verify-seasonal-gate.mjs [--control] [--json out.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as heroLines from '../assets/hero-lines.js';
import * as heroLinesAf from '../assets/hero-lines-af.js';
import { heroCropKey, heroCropFor } from '../assets/hero-crop.js';
import { getWeatherBackgroundFolder, getWeatherBackgroundFallbackFolder } from '../assets/weather-visuals.js';
import { getRotationDay, getRotationWeek, buildPickerPaths } from '../assets/image-picker.js';
import { contextTagAllows } from '../assets/witty-day-tags.js';
import { isRegionTagAt } from '../assets/geo-regions.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
const a = app.indexOf('  let __pickerToken = 0;');
const b = app.indexOf('  function createParticles(');
if (a < 0 || b < a) throw new Error('picker/bespoke block not found in assets/app.js');
const CONTROL = process.argv.includes('--control');
const GATE = 'written.filter((l) => contextTagAllows(tags[l], context))';
let block = app.slice(a, b)
  .replace("import('./hero-lines.js')", '__importEn()')
  .replace("import('./hero-lines-af.js')", '__importAf()');
if (!block.includes(GATE)) throw new Error('the season/place gate is not in applyBespokeLine');
if (CONTROL) block = block.replace(GATE, 'written');

const PLACES = { Strand: { lat: -34.1163, lon: 18.8362 }, Johannesburg: { lat: -26.2041, lon: 28.0473 } };
const FOLDERS = ['clear', 'cloudy', 'rain', 'wind', 'storm', 'cold', 'cold-clear', 'fog', 'heat'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const TAGS = heroLines.HERO_LINE_TAGS;
const EN_OF_AF = new Map(Object.entries(heroLinesAf.HERO_LINES_AF).map(([en, af]) => [af, en]));

async function harness(lang, ctx, timeRef) {
  const headlineEl = { textContent: 'CONDITION' };
  const bgImg = { src: '', getAttribute() { return this.src; } };
  const make = new Function('headlineEl', 'settings', 'safeText', 'debugLog', 'heroCropKey', 'heroCropFor', 'applyHeroCrop',
    'bgImg', 'getWeatherBackgroundFolder', 'getWeatherBackgroundFallbackFolder', 'getTimeOfDay', 'getRotationWeek', 'getRotationDay',
    'buildPickerPaths', '__importEn', '__importAf', 'localStorage', 'document', 'contextTagAllows', 'bespokeTagContext',
    `${block}\nreturn { applyBespokeLine, loadBespokeTable, setBackgroundFor, __lineMemo };`);
  const api = make(headlineEl, { lang }, (el, t) => { el.textContent = t; }, () => {}, heroCropKey, heroCropFor, () => {},
    bgImg, getWeatherBackgroundFolder, getWeatherBackgroundFallbackFolder, () => timeRef.time, getRotationWeek, getRotationDay,
    buildPickerPaths, async () => heroLines, async () => heroLinesAf, { setItem() {} },
    { documentElement: { style: { setProperty() {} } } }, contextTagAllows, () => ctx);
  await api.loadBespokeTable('en'); await api.loadBespokeTable(lang);
  return { ...api, headlineEl, bgImg };
}

// Every line one call can put on screen: sweep the draw with the memo cleared.
function drawAll(h, call) {
  const out = new Set(); let fellBack = false;
  const realRandom = Math.random;
  for (let i = 0; i < 16; i++) {
    h.__lineMemo.clear(); h.headlineEl.textContent = 'CONDITION';
    Math.random = () => (i + 0.5) / 16;
    call();
    if (h.headlineEl.textContent === 'CONDITION') fellBack = true; else out.add(h.headlineEl.textContent);
  }
  Math.random = realRandom;
  return { lines: out, fellBack };
}

const firstSaturday = (y, m) => { for (let d = 1; d <= 7; d++) { const t = Date.UTC(y, m, d, 10); if (new Date(t + 2 * 3600e3).getUTCDay() === 6) return t; } return null; };
const MONTHS = []; for (let i = 0; i < 12; i++) { const y = 2026 + Math.floor((5 + i) / 12); const m = (5 + i) % 12; MONTHS.push({ y, m: m + 1, t: firstSaturday(y, m) }); }

const worklistPath = path.join(root, 'review', 'seasonal-tags-worklist.json');
const worklist = existsSync(worklistPath) ? JSON.parse(readFileSync(worklistPath, 'utf8')).rows.filter((r) => r.kind === 'bespoke') : [];
const reviewEn = new Map(worklist.map((r) => [r.en, r]));

const violations = [];
const exposure = new Map(); // review line -> Set of months seen
const perMonth = [];
const slotSrcs = Object.keys(heroLines.HERO_LINES).filter((k) => k.startsWith('bg/')).map((k) => `assets/images/${k}`);
const realNow = Date.now;
const timeRef = { time: 'day' };
for (const { y, m, t } of MONTHS) {
  Date.now = () => t;
  const row = { month: `${y}-${String(m).padStart(2, '0')}`, date: new Date(t).toISOString().slice(0, 10), pickerLines: 0, photoLines: 0, fallbacks: 0, violations: 0 };
  for (const [place, ll] of Object.entries(PLACES)) {
    const ctx = { ...ll, month: m };
    for (const lang of ['en', 'af']) {
      const h = await harness(lang, ctx, timeRef);
      const audit = (line, where) => {
        const en = lang === 'en' ? line : EN_OF_AF.get(line);
        const tag = TAGS[en];
        if (tag?.months && !tag.months.includes(m)) violations.push(`${row.month} ${place} ${lang} ${where}: "${line}" (months ${tag.months})`);
        if (tag?.region) { const regions = Array.isArray(tag.region) ? tag.region : [tag.region]; if (!regions.some((r) => isRegionTagAt(r, ll.lat, ll.lon))) violations.push(`${row.month} ${place} ${lang} ${where}: "${line}" (region ${tag.region})`); }
        if (reviewEn.has(en)) { if (!exposure.has(en)) exposure.set(en, new Set()); exposure.get(en).add(row.month); }
      };
      for (const folder of FOLDERS) for (const time of TIMES) {
        timeRef.time = time;
        const r = drawAll(h, () => h.setBackgroundFor(folder));
        for (const l of r.lines) audit(l, `picker ${h.bgImg.src.replace(/^assets\/images\//, '').replace(/\?.*$/, '')}`);
        row.pickerLines += r.lines.size;
      }
      for (const s of slotSrcs) {
        const r = drawAll(h, () => h.applyBespokeLine(s));
        for (const l of r.lines) audit(l, s.replace(/^assets\/images\//, ''));
        row.photoLines += r.lines.size;
        if (!r.lines.size) row.fallbacks += 1;
      }
    }
  }
  Date.now = realNow;
  row.violations = violations.filter((v) => v.startsWith(row.month)).length;
  perMonth.push(row);
}

console.log('[seasonal-gate] first Saturday of each month, 12:00 SAST; en + af; Strand + Johannesburg; real picker + every photograph');
for (const r of perMonth) console.log(`  ${r.month} (${r.date})  picker lines ${String(r.pickerLines).padStart(4)}  photograph lines ${String(r.photoLines).padStart(6)}  fell back to condition ${String(r.fallbacks).padStart(3)}  out of season/place ${r.violations}`);
console.log(`  tags in force: ${Object.keys(TAGS).length} (months ${Object.values(TAGS).filter((x) => x.months).length}, region ${Object.values(TAGS).filter((x) => x.region).length})`);
if (worklist.length) {
  const open = worklist.filter((r) => !TAGS[r.en]?.months);
  console.log(`  season review list: ${worklist.length} photograph lines, ${worklist.length - open.length} carry a month window; ${open.length} have none yet — seen in ${[...exposure.entries()].filter(([en]) => !TAGS[en]?.months).reduce((n, [, s]) => n + s.size, 0)} line-months (Al's ruling open, or ruled ALWAYS)`);
}
if (process.argv.includes('--json')) {
  const out = process.argv[process.argv.indexOf('--json') + 1];
  writeFileSync(out, JSON.stringify({ perMonth, violations, exposure: Object.fromEntries([...exposure].map(([k, v]) => [k, [...v]])) }, null, 1));
}
if (violations.length) {
  console.error(`[seasonal-gate] FAIL — ${violations.length} out-of-season/out-of-place appearances:`);
  for (const v of violations.slice(0, 40)) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('[seasonal-gate] PASS — no tagged line appeared outside its months or its region.');
