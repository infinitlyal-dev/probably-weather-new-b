// Wire Al's season ruling: review/seasonal-ruled.json, exported from
// review/seasonal-tags.html (KEEP / CUT, 2026-09-22).
//
//   CUT, photograph row — the line comes off every photograph it is on. English
//     leaves the authoring file; its Afrikaans leaves hero-lines-af.js because
//     lang-check/apply-af-accepted.mjs writes only rows whose English is wired.
//     A sentence that is also a condition-bank line stays in the bank.
//   CUT, bank row — the line leaves the condition bank in all five languages,
//     through scripts/cut-bank-lines.mjs (which re-keys the index-aligned tags).
//   KEEP — the chosen window becomes the line's tag, so the month gate governs it:
//     photograph lines through review/seasonal-tags-ruled.json (build-hero-lines
//     reads it into HERO_LINE_TAGS), bank lines into witty-day-tags.js, keeping any
//     region/time/day the tag already has. ALWAYS clears the months.
//
// A photograph left with no lines moves to `awaitingLines` (an empty line list is
// refused by build-hero-lines) and serves a condition-bank line. That fallback is
// checked here for every such photograph, in every context it can be shown in —
// each slot's weekday and time of day, all twelve months, Strand and Johannesburg,
// English and Afrikaans — because app.js's pickRandom returns '' for an empty
// pool: a blank caption is possible, and this makes it a refusal instead.
//
// Refuses a ruling that does not match the page it came from (the worklist): a
// stale export applied to a moved list cuts the wrong lines.
//
//   node scripts/apply-seasonal-ruling.mjs --ruling review/seasonal-ruled.json [--dry]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');
if (!val('--ruling')) { console.error('usage: --ruling review/seasonal-ruled.json [--dry]'); process.exit(2); }
const RULING_FILE = val('--ruling');
const TODAY = new Date().toISOString().slice(0, 10);
let bust = 0;
const fresh = async (rel) => import(`${pathToFileURL(path.join(root, rel)).href}?v=${Date.now()}-${bust++}`);
const node = (...a) => execFileSync(process.execPath, a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const ruling = JSON.parse(readFileSync(path.resolve(root, RULING_FILE), 'utf8'));
const worklist = JSON.parse(readFileSync(R('seasonal-tags-worklist.json'), 'utf8'));

// ---- 1. the ruling must be the page's ---------------------------------------
const problems = [];
const byKey = new Map(worklist.rows.map((r) => [r.key, r]));
const seen = new Set();
for (const r of ruling.rulings || []) {
  const w = byKey.get(r.key);
  if (!w) { problems.push(`${r.key}: not on the page this ruling should come from`); continue; }
  if (w.en !== r.en) problems.push(`${r.key}: ruled "${r.en}" but the page has "${w.en}"`);
  if (w.kind !== r.kind) problems.push(`${r.key}: ruled as ${r.kind}, the page has ${w.kind}`);
  if (!['KEEP', 'CUT'].includes(r.verdict)) problems.push(`${r.key}: verdict ${r.verdict}`);
  if (r.verdict === 'KEEP') {
    if (!['ALWAYS', 'MONTHS', 'SEASON'].includes(r.ruling)) problems.push(`${r.key}: KEEP with ruling ${r.ruling}`);
    if (r.ruling !== 'ALWAYS' && (!Array.isArray(r.months) || !r.months.length || r.months.length >= 12)) problems.push(`${r.key}: KEEP ${r.ruling} with no usable months`);
  }
  seen.add(r.key);
}
for (const k of byKey.keys()) if (!seen.has(k)) problems.push(`${k}: on the page but not in the ruling`);
if (problems.length) {
  console.error('[season] refusing to apply:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const rows = ruling.rulings;
const bespokeCut = new Set(rows.filter((r) => r.kind === 'bespoke' && r.verdict === 'CUT').map((r) => r.en));
const bankCut = rows.filter((r) => r.kind === 'bank' && r.verdict === 'CUT');
const bespokeKeep = rows.filter((r) => r.kind === 'bespoke' && r.verdict === 'KEEP');
const bankKeep = rows.filter((r) => r.kind === 'bank' && r.verdict === 'KEEP');
console.log(`[season] ${RULING_FILE}: ${rows.length} rows — KEEP ${bespokeKeep.length + bankKeep.length} (${bespokeKeep.length} photograph, ${bankKeep.length} bank), CUT ${bespokeCut.size + bankCut.length} (${bespokeCut.size} photograph, ${bankCut.length} bank)`);

// ---- 2. photograph cuts ------------------------------------------------------
const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const set = [];
const newlyBare = [];
let pairsRemoved = 0;
for (const e of authoring.set) {
  const lines = e.lines.filter((t) => !bespokeCut.has(t));
  pairsRemoved += e.lines.length - lines.length;
  if (lines.length) { set.push(lines.length === e.lines.length ? e : { ...e, lines }); continue; }
  newlyBare.push({ ...e, lines: undefined, cutLines: e.lines, reason: `every line on this photograph was cut by the season ruling (${RULING_FILE.replace(/\\/g, '/')}, ${TODAY}) — it serves a condition-bank line until Al rules new ones` });
}
for (const b of newlyBare) delete b.lines;
const outAuthoring = {
  ...authoring,
  set,
  images: set.length,
  lineCount: set.reduce((n, e) => n + e.lines.length, 0),
  awaitingLines: [...(authoring.awaitingLines || []), ...newlyBare],
  seasonRuling: { on: RULING_FILE.replace(/\\/g, '/'), date: TODAY, pairsRemoved, photographsLeftWithNoLines: newlyBare.length },
};
if (!outAuthoring.awaitingLines.length) delete outAuthoring.awaitingLines;
console.log(`[season] photographs: ${pairsRemoved} (photograph, line) pairs removed; ${newlyBare.length} photograph(s) left with no line`);

// ---- 3. the tag file for photograph KEEPs -----------------------------------
const seasonalTagsRuled = {
  generated: TODAY,
  ruledBy: ruling.ruledBy || 'Al, season lines keep/cut page',
  source: RULING_FILE.replace(/\\/g, '/'),
  rulings: bespokeKeep.map((r) => ({ kind: 'bespoke', key: r.key, en: r.en, ruling: r.ruling, ...(r.months ? { months: r.months } : {}), ...(r.season ? { season: r.season } : {}) })),
};

if (DRY) {
  console.log('[season] --dry: nothing written');
  for (const r of bespokeKeep) console.log(`    KEEP photo  ${r.key.padEnd(18)} ${r.ruling}${r.months ? ' ' + r.months.join(',') : ''}  ${r.en}`);
  for (const r of bankKeep) console.log(`    KEEP bank   ${r.key.padEnd(18)} ${r.ruling}${r.months ? ' ' + r.months.join(',') : ''}  ${r.en}`);
  for (const r of bankCut) console.log(`    CUT  bank   ${r.key.padEnd(18)} ${r.en}`);
  for (const b of newlyBare) console.log(`    bare        ${b.image}  (${b.cutLines.length} line(s) cut)`);
  process.exit(0);
}

writeFileSync(R('set-001-lines-bespoke-final.json'), JSON.stringify(outAuthoring, null, 1));
writeFileSync(R('seasonal-tags-ruled.json'), JSON.stringify(seasonalTagsRuled, null, 1));
console.log('[season] wrote set-001-lines-bespoke-final.json and seasonal-tags-ruled.json');

// ---- 4. bank cuts: five languages, through the index-safe cutter ------------
if (bankCut.length) {
  const cuts = bankCut.map((r) => { const [ns, rest] = r.key.split(':'); return { ns, bin: rest.split('#')[0], en: r.en }; });
  process.stdout.write(node('scripts/cut-bank-lines.mjs', '--cuts', JSON.stringify(cuts)));
}

// ---- 5. bank KEEPs: the window into witty-day-tags.js, by text --------------
if (bankKeep.length) {
  const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
  const T0 = (await fresh('assets/witty-day-tags.js')).WITTY_DAY_TAGS;
  const TAGS = path.join(root, 'assets', 'witty-day-tags.js');
  const src = readFileSync(TAGS, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const litOf = (v) => (Array.isArray(v) ? `[${v.map(litOf).join(', ')}]` : typeof v === 'string' ? `'${v}'` : String(v));
  const tagLit = (t) => `{ ${Object.entries(t).map(([k, v]) => `${k}: ${litOf(v)}`).join(', ')} }`;
  const expected = new Map();
  for (const r of bankKeep) {
    const [ns, rest] = r.key.split(':');
    const bin = rest.split('#')[0];
    const i = W[ns][bin].en.indexOf(r.en);
    if (i < 0) { console.error(`[season] bank KEEP "${r.en}" is not in ${ns}.${bin}`); process.exit(1); }
    const old = T0[ns]?.[bin]?.[i] || {};
    const next = { ...old };
    delete next.months;
    if (r.ruling !== 'ALWAYS') next.months = [...r.months].sort((a, b) => a - b);
    expected.set(`${ns}|${bin}|${i}`, Object.keys(next).length ? next : undefined);
    // find the ns -> bin block, then the line for index i (or where to add it)
    let inNs = false, start = -1;
    for (let li = 0; li < lines.length; li++) {
      if (lines[li] === `  ${ns}: {`) { inNs = true; continue; }
      if (inNs && /^  [A-Za-z_]+: \{/.test(lines[li])) inNs = false;
      if (inNs && lines[li] === `    ${/^[a-z_]+$/i.test(bin) ? bin : `'${bin}'`}: {`) { start = li; break; }
    }
    if (start < 0) { console.error(`[season] no tag block for ${ns}.${bin} — refusing to invent one`); process.exit(1); }
    let end = start + 1;
    while (!/^    \},?\s*$/.test(lines[end])) end++;
    const at = lines.slice(start + 1, end).findIndex((l) => new RegExp(`^\\s+${i}: `).test(l));
    const entry = Object.keys(next).length ? `      ${i}: ${tagLit(next)},` : null;
    if (at >= 0) { if (entry) lines[start + 1 + at] = entry; else lines.splice(start + 1 + at, 1); }
    else if (entry) lines.splice(end, 0, entry);
  }
  writeFileSync(TAGS, lines.join(eol));
  const T1 = (await fresh('assets/witty-day-tags.js')).WITTY_DAY_TAGS;
  for (const [k, want] of expected) {
    const [ns, bin, i] = k.split('|');
    if (!isDeepStrictEqual(T1[ns]?.[bin]?.[Number(i)], want)) { console.error(`[season] tag write did not land for ${k}: ${JSON.stringify(T1[ns]?.[bin]?.[Number(i)])}`); process.exit(1); }
  }
  console.log(`[season] ${bankKeep.length} bank tag(s) written and read back`);
}

// ---- 6. regenerate what derives from the sources ------------------------------
process.stdout.write(node('scripts/generate-copy-splits.mjs').split('\n').filter((l) => /wrote|error/i.test(l)).map((l) => `  ${l}`).join('\n') + '\n');
process.stdout.write(node('scripts/build-hero-lines.mjs'));
process.stdout.write(node('scripts/lang-check/apply-af-accepted.mjs', '--decisions', 'review/af-al-decisions.json'));

// ---- 7. never a blank caption --------------------------------------------------
const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
const Tm = await fresh('assets/witty-day-tags.js');
const HL = (await fresh('assets/hero-lines.js')).HERO_LINES;
const ALIASES = (await fresh('assets/weather-visuals.js')).WEATHER_BACKGROUND_ALIASES;
const draft = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const slotsByHash = new Map(draft.assignments.map((a) => [a.hash, [...new Set([a.image, ...(a.paths || [])])]]));
const PLACES = { Strand: [-34.1163, 18.8362], Johannesburg: [-26.2041, 28.0473] };
const HOURS = { dawn: [5, 7], day: [9, 13, 16], dusk: [17, 19], night: [21, 23, 2] };
const bare = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8')).awaitingLines || [];
const blanks = [];
for (const b of bare) {
  const slots = slotsByHash.get(b.hash) || [b.image];
  for (const slot of slots) {
    if (HL[`bg/${slot}`]) blanks.push(`${slot}: still has bespoke lines in the table`);
    const [folder, , time, file] = slot.split('/');
    const weekday = Number(file.replace('.webp', ''));        // slot index = SAST weekday, Mon=1..Sun=7
    const jsDay = weekday % 7;                                  // Sun=0 as getLocationDayOfWeek
    const conditions = [folder, ...Object.entries(ALIASES).filter(([, f]) => f === folder).map(([c]) => c)];
    for (const cond of conditions) for (const hour of HOURS[time]) for (let month = 1; month <= 12; month++) {
      for (const [place, [lat, lon]] of Object.entries(PLACES)) for (const lang of ['en', 'af']) {
        const copyCondition = Tm.resolveNightAwareCopyCondition({ displayCondition: cond, timeOfDay: time, hour });
        const res = Tm.eligibleWittyPool({ copy: W, tags: Tm.WITTY_DAY_TAGS, condition: copyCondition, lang, context: { day: jsDay, hour, lat, lon, month } });
        if (!res.pool.length) blanks.push(`${slot} ${cond}→${copyCondition} ${lang} ${place} month ${month} hour ${hour}: EMPTY condition pool`);
      }
    }
  }
}
if (blanks.length) {
  console.error(`[season] ${blanks.length} context(s) would show a BLANK caption:`);
  for (const x of blanks.slice(0, 20)) console.error(`  - ${x}`);
  process.exit(1);
}
console.log(`[season] fallback checked: ${bare.length} photograph(s) with no line — every context they can show in has a condition-bank line (12 months × Strand/Johannesburg × EN/AF × each slot's weekday and time)`);

// ---- 8. what is left, per condition -------------------------------------------
const final = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const table = {};
const band = (n) => (n >= 3 ? '3+' : String(n));
for (const e of final.set) { const c = (table[e.condition] ||= { 0: 0, 1: 0, 2: 0, '3+': 0 }); c[band(e.lines.length)] += 1; }
for (const e of final.awaitingLines || []) { const c = (table[e.condition] ||= { 0: 0, 1: 0, 2: 0, '3+': 0 }); c['0'] += 1; }
console.log('\n[season] photographs by line count after the ruling');
console.log('condition      0    1    2   3+');
const tot = { 0: 0, 1: 0, 2: 0, '3+': 0 };
for (const [c, v] of Object.entries(table).sort()) {
  console.log(`${c.padEnd(12)} ${String(v[0]).padStart(3)}  ${String(v[1]).padStart(3)}  ${String(v[2]).padStart(3)}  ${String(v['3+']).padStart(3)}`);
  for (const k of Object.keys(tot)) tot[k] += v[k];
}
console.log(`${'TOTAL'.padEnd(12)} ${String(tot[0]).padStart(3)}  ${String(tot[1]).padStart(3)}  ${String(tot[2]).padStart(3)}  ${String(tot['3+']).padStart(3)}   (${final.lineCount} lines on ${final.set.length} photographs)`);
