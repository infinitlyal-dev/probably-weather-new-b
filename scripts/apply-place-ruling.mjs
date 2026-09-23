// Wire Al's place ruling: review/place-lines-ruled.json, exported from
// review/place-lines.html (KEEP / TAG / CUT, 2026-09-23).
//
//   TAG — the region becomes the line's tag, so the place gate governs it. A region
//     is one box from assets/geo-regions.js or a list of boxes (P46/P47: the N1 runs
//     through four), and the line shows to anyone inside any of them. Photograph
//     lines take it through build-hero-lines.mjs, which reads the TAG rows of the
//     ruling into HERO_LINE_TAGS; when the line is also a condition-bank line the
//     bank row gets the same region in witty-day-tags.js (keeping its time/day/
//     months), because the bank is what isiZulu, isiXhosa, Sesotho and every share
//     card serve.
//   CUT — the line comes off every photograph it is on. English leaves the
//     authoring file; its Afrikaans leaves hero-lines-af.js because
//     lang-check/apply-af-accepted.mjs writes only rows whose English is wired. A
//     bank copy leaves the bank in all five languages through cut-bank-lines.mjs.
//   KEEP — nothing changes. Al's brief of 2026-09-23: "leave P15, P25, P55 exactly
//     as they are" — so P55's karoo tag stays, where the page's legend would have
//     lifted it. The brief is the later word.
//
// A photograph left with no lines moves to `awaitingLines` and serves a
// condition-bank line; that fallback is checked in every context the photograph
// can be shown in, as apply-seasonal-ruling.mjs does, because a blank caption is
// possible otherwise.
//
// Refuses a ruling that does not match the page it came from (the worklist), a TAG
// whose region is not the one the page proposed, and any region that is not a box.
//
//   node scripts/apply-place-ruling.mjs --ruling review/place-lines-ruled.json [--dry]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { REGION_BOXES } from '../assets/geo-regions.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');
if (!val('--ruling')) { console.error('usage: --ruling review/place-lines-ruled.json [--dry]'); process.exit(2); }
const RULING_FILE = val('--ruling');
const TODAY = new Date().toISOString().slice(0, 10);
let bust = 0;
const fresh = async (rel) => import(`${pathToFileURL(path.join(root, rel)).href}?v=${Date.now()}-${bust++}`);
const node = (...a) => execFileSync(process.execPath, a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const ruling = JSON.parse(readFileSync(path.resolve(root, RULING_FILE), 'utf8'));
const worklist = JSON.parse(readFileSync(R('place-lines-worklist.json'), 'utf8'));

// ---- 1. the ruling must be the page's ---------------------------------------
const problems = [];
const byKey = new Map(worklist.rows.map((r) => [r.key, r]));
const seen = new Set();
const regionsOf = (region) => (Array.isArray(region) ? region : [region]);
for (const r of ruling.rulings || []) {
  const w = byKey.get(r.key);
  if (!w) { problems.push(`${r.key}: not on the page this ruling should come from`); continue; }
  if (w.en !== r.en) problems.push(`${r.key}: ruled "${r.en}" but the page has "${w.en}"`);
  if (!['KEEP', 'TAG', 'CUT'].includes(r.verdict)) problems.push(`${r.key}: verdict ${r.verdict}`);
  if (r.verdict === 'TAG') {
    if (!isDeepStrictEqual(r.region, w.proposed)) problems.push(`${r.key}: TAG ${JSON.stringify(r.region)} but the page proposed ${JSON.stringify(w.proposed)}`);
    const regions = regionsOf(r.region);
    if (!regions.length || regions.some((x) => typeof x !== 'string' || !REGION_BOXES[x])) problems.push(`${r.key}: ${JSON.stringify(r.region)} is not a region box`);
  }
  seen.add(r.key);
}
for (const k of byKey.keys()) if (!seen.has(k)) problems.push(`${k}: on the page but not in the ruling`);
if (problems.length) {
  console.error('[place] refusing to apply:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const rows = ruling.rulings;
const tagRows = rows.filter((r) => r.verdict === 'TAG');
const cutRows = rows.filter((r) => r.verdict === 'CUT');
const keepRows = rows.filter((r) => r.verdict === 'KEEP');
const bankKeys = (r) => (byKey.get(r.key).alsoBank || []).map((b) => b.key);
const bankTags = tagRows.flatMap((r) => bankKeys(r).map((key) => ({ key, en: r.en, region: r.region, row: r.key })));
const bankCuts = cutRows.flatMap((r) => bankKeys(r).map((key) => ({ key, en: r.en, row: r.key })));
console.log(`[place] ${RULING_FILE}: ${rows.length} rows — TAG ${tagRows.length} (${bankTags.length} bank rows), CUT ${cutRows.length} (${bankCuts.length} bank rows), KEEP ${keepRows.length}`);

// What KEEP rows and every tag look like now, to prove afterwards that KEEP moved nothing.
const HL0 = await fresh('assets/hero-lines.js');
const T0 = (await fresh('assets/witty-day-tags.js')).WITTY_DAY_TAGS;
const W0 = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
const bankIndex = (W, key, en) => {
  const [ns, rest] = key.split(':');
  const bin = rest.split('#')[0];
  const hint = Number(rest.split('#')[1]);
  const i = W[ns]?.[bin]?.en?.indexOf(en) ?? -1;
  return { ns, bin, i, hint };
};
const keepBefore = new Map(keepRows.map((r) => [r.key, {
  hero: HL0.HERO_LINE_TAGS[r.en] ?? null,
  bank: bankKeys(r).map((key) => { const { ns, bin, i } = bankIndex(W0, key, r.en); return T0[ns]?.[bin]?.[i] ?? null; }),
}]));
for (const b of [...bankTags, ...bankCuts]) {
  const { ns, bin, i, hint } = bankIndex(W0, b.key, b.en);
  if (i < 0) problems.push(`${b.row}: "${b.en}" is not in ${ns}.${bin}`);
  else if (i !== hint) problems.push(`${b.row}: ${b.key} — the text is at #${i} now; the bank moved since the page was built`);
}
if (problems.length) {
  console.error('[place] refusing to apply:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// ---- 2. photograph cuts ------------------------------------------------------
const cutLines = new Set(cutRows.map((r) => r.en));
const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const set = [];
const newlyBare = [];
let pairsRemoved = 0;
for (const e of authoring.set) {
  const lines = e.lines.filter((t) => !cutLines.has(t));
  pairsRemoved += e.lines.length - lines.length;
  if (lines.length) { set.push(lines.length === e.lines.length ? e : { ...e, lines }); continue; }
  newlyBare.push({ ...e, lines: undefined, cutLines: e.lines, reason: `every line on this photograph was cut by the place ruling (${RULING_FILE.replace(/\\/g, '/')}, ${TODAY}) — it serves a condition-bank line until Al rules new ones` });
}
for (const b of newlyBare) delete b.lines;
const missing = [...cutLines].filter((t) => !authoring.set.some((e) => e.lines.includes(t)));
if (missing.length) { console.error(`[place] CUT lines not on any photograph: ${missing.join(' | ')}`); process.exit(1); }
const outAuthoring = {
  ...authoring,
  set,
  images: set.length,
  lineCount: set.reduce((n, e) => n + e.lines.length, 0),
  awaitingLines: [...(authoring.awaitingLines || []), ...newlyBare],
  placeRuling: { on: RULING_FILE.replace(/\\/g, '/'), date: TODAY, tagged: tagRows.length, cut: cutRows.map((r) => r.key), kept: keepRows.map((r) => r.key), pairsRemoved, photographsLeftWithNoLines: newlyBare.length },
};
if (!outAuthoring.awaitingLines.length) delete outAuthoring.awaitingLines;
console.log(`[place] photographs: ${pairsRemoved} (photograph, line) pairs removed; ${newlyBare.length} photograph(s) left with no line`);

if (DRY) {
  console.log('[place] --dry: nothing written');
  for (const r of tagRows) console.log(`    TAG  ${r.key}  ${JSON.stringify(r.region)}  ${r.en}${bankKeys(r).length ? `  (+ bank ${bankKeys(r).join(', ')})` : ''}`);
  for (const r of cutRows) console.log(`    CUT  ${r.key}  ${r.en}`);
  for (const r of keepRows) console.log(`    KEEP ${r.key}  ${r.en}`);
  for (const b of newlyBare) console.log(`    bare ${b.image}  (${b.cutLines.length} line(s) cut)`);
  process.exit(0);
}
writeFileSync(R('set-001-lines-bespoke-final.json'), JSON.stringify(outAuthoring, null, 1));
console.log('[place] wrote set-001-lines-bespoke-final.json');

// ---- 3. bank cuts: five languages, through the index-safe cutter ------------
if (bankCuts.length) {
  const cuts = bankCuts.map((b) => { const { ns, bin } = bankIndex(W0, b.key, b.en); return { ns, bin, en: b.en }; });
  process.stdout.write(node('scripts/cut-bank-lines.mjs', '--cuts', JSON.stringify(cuts)));
}

// ---- 4. bank TAGs: the region into witty-day-tags.js, by text ---------------
if (bankTags.length) {
  const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
  const T = (await fresh('assets/witty-day-tags.js')).WITTY_DAY_TAGS;
  const TAGS = path.join(root, 'assets', 'witty-day-tags.js');
  const src = readFileSync(TAGS, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const litOf = (v) => (Array.isArray(v) ? `[${v.map(litOf).join(', ')}]` : typeof v === 'string' ? `'${v}'` : String(v));
  const tagLit = (t) => `{ ${Object.entries(t).map(([k, v]) => `${k}: ${litOf(v)}`).join(', ')} }`;
  const expected = new Map();
  for (const b of bankTags) {
    const { ns, bin, i } = bankIndex(W, b.key, b.en);
    const old = T[ns]?.[bin]?.[i] || {};
    if (isDeepStrictEqual(old.region, b.region)) { expected.set(`${ns}|${bin}|${i}`, old); continue; }
    const next = { ...old, region: b.region };
    expected.set(`${ns}|${bin}|${i}`, next);
    let inNs = false, start = -1;
    for (let li = 0; li < lines.length; li++) {
      if (lines[li] === `  ${ns}: {`) { inNs = true; continue; }
      if (inNs && /^  [A-Za-z_]+: \{/.test(lines[li])) inNs = false;
      if (inNs && lines[li] === `    ${/^[a-z_]+$/i.test(bin) ? bin : `'${bin}'`}: {`) { start = li; break; }
    }
    if (start < 0) { console.error(`[place] no tag block for ${ns}.${bin} — refusing to invent one`); process.exit(1); }
    let end = start + 1;
    while (!/^    \},?\s*$/.test(lines[end])) end++;
    const at = lines.slice(start + 1, end).findIndex((l) => new RegExp(`^\\s+${i}: `).test(l));
    const entry = `      ${i}: ${tagLit(next)},`;
    if (at >= 0) lines[start + 1 + at] = entry;
    else {
      // keep the block in index order: insert before the first entry with a larger index
      const after = lines.slice(start + 1, end).findIndex((l) => { const m = l.match(/^\s+(\d+): /); return m && Number(m[1]) > i; });
      lines.splice(after >= 0 ? start + 1 + after : end, 0, entry);
    }
  }
  writeFileSync(TAGS, lines.join(eol));
  const T1 = (await fresh('assets/witty-day-tags.js')).WITTY_DAY_TAGS;
  for (const [k, want] of expected) {
    const [ns, bin, i] = k.split('|');
    if (!isDeepStrictEqual(T1[ns]?.[bin]?.[Number(i)], want)) { console.error(`[place] tag write did not land for ${k}: ${JSON.stringify(T1[ns]?.[bin]?.[Number(i)])}`); process.exit(1); }
  }
  // every other tag in the file is untouched
  for (const ns of Object.keys(T)) for (const bin of Object.keys(T[ns] || {})) for (const [i, t] of Object.entries(T[ns][bin] || {})) {
    if (expected.has(`${ns}|${bin}|${i}`)) continue;
    if (!isDeepStrictEqual(T1[ns]?.[bin]?.[i], t)) { console.error(`[place] tag ${ns}.${bin}#${i} changed and should not have`); process.exit(1); }
  }
  console.log(`[place] ${bankTags.length} bank tag(s) written and read back; no other tag moved`);
}

// ---- 5. regenerate what derives from the sources ------------------------------
process.stdout.write(node('scripts/generate-copy-splits.mjs').split('\n').filter((l) => /wrote|error/i.test(l)).map((l) => `  ${l}`).join('\n') + '\n');
process.stdout.write(node('scripts/build-hero-lines.mjs'));
process.stdout.write(node('scripts/lang-check/apply-af-accepted.mjs', '--decisions', 'review/af-al-decisions.json'));

// ---- 6. never a blank caption --------------------------------------------------
const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
const Tm = await fresh('assets/witty-day-tags.js');
const HL = await fresh('assets/hero-lines.js');
const AF = await fresh('assets/hero-lines-af.js');
const ALIASES = (await fresh('assets/weather-visuals.js')).WEATHER_BACKGROUND_ALIASES;
const draft = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const slotsByHash = new Map(draft.assignments.map((a) => [a.hash, [...new Set([a.image, ...(a.paths || [])])]]));
const PLACES = { Strand: [-34.1163, 18.8362], Johannesburg: [-26.2041, 28.0473] };
const HOURS = { dawn: [5, 7], day: [9, 13, 16], dusk: [17, 19], night: [21, 23, 2] };
const bare = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8')).awaitingLines || [];
const blanks = [];
for (const b of bare) {
  for (const slot of slotsByHash.get(b.hash) || [b.image]) {
    if (HL.HERO_LINES[`bg/${slot}`]) blanks.push(`${slot}: still has bespoke lines in the table`);
    const [folder, , time, file] = slot.split('/');
    const jsDay = Number(file.replace('.webp', '')) % 7;       // slot index = SAST weekday, Mon=1..Sun=7
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
  console.error(`[place] ${blanks.length} context(s) would show a BLANK caption:`);
  for (const x of blanks.slice(0, 20)) console.error(`  - ${x}`);
  process.exit(1);
}
console.log(`[place] fallback checked: ${bare.length} photograph(s) with no line — every context they can show in has a condition-bank line`);

// ---- 7. every ruling landed where it should -------------------------------------
const fails = [];
const live = new Set(Object.values(HL.HERO_LINES).flat());
const T2 = Tm.WITTY_DAY_TAGS;
for (const r of tagRows) {
  if (!live.has(r.en)) { fails.push(`${r.key}: TAG line is not on any photograph`); continue; }
  if (!isDeepStrictEqual(HL.HERO_LINE_TAGS[r.en]?.region, r.region)) fails.push(`${r.key}: HERO_LINE_TAGS region ${JSON.stringify(HL.HERO_LINE_TAGS[r.en]?.region)}, ruled ${JSON.stringify(r.region)}`);
  for (const key of bankKeys(r)) {
    const { ns, bin, i } = bankIndex(W, key, r.en);
    if (!isDeepStrictEqual(T2[ns]?.[bin]?.[i]?.region, r.region)) fails.push(`${r.key}: bank ${key} region ${JSON.stringify(T2[ns]?.[bin]?.[i]?.region)}`);
  }
}
for (const r of cutRows) {
  if (live.has(r.en)) fails.push(`${r.key}: CUT line is still on a photograph`);
  if (AF.heroLineAf(r.en)) fails.push(`${r.key}: CUT line still has an Afrikaans row`);
}
for (const r of keepRows) {
  const was = keepBefore.get(r.key);
  if (!isDeepStrictEqual(HL.HERO_LINE_TAGS[r.en] ?? null, was.hero)) fails.push(`${r.key}: KEEP tag moved ${JSON.stringify(was.hero)} -> ${JSON.stringify(HL.HERO_LINE_TAGS[r.en])}`);
  bankKeys(r).forEach((key, j) => {
    const { ns, bin, i } = bankIndex(W, key, r.en);
    if (!isDeepStrictEqual(T2[ns]?.[bin]?.[i] ?? null, was.bank[j])) fails.push(`${r.key}: KEEP bank tag ${key} moved`);
  });
}
if (fails.length) {
  console.error('[place] VERIFY FAILED — restore the files with git before anything else:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`[place] verified: ${tagRows.length} TAG rows carry their region on the photograph and on ${bankTags.length} bank row(s); ${cutRows.length} CUT lines are off every photograph with their Afrikaans; ${keepRows.length} KEEP rows unchanged`);
