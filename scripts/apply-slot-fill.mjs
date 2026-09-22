// Put Al's chosen lines on a photograph the provenance cull left bare.
//
// Reads a slot-fill ruling (review/slot-fill-<slot>-ruled.json, exported from the
// page scripts/build-slot-fill-page.mjs builds): the photograph's hash and the
// lines he ticked for it. Writes:
//
//   review/set-001-lines-bespoke-final.json — the photograph moves from
//     `awaitingLines` back into `set` carrying exactly the chosen lines. The lines
//     the cull removed stay removed; they are kept on the entry as `culledLines`
//     so the record of what used to be there survives.
//   review/af-bespoke-decisions.json — a canon row for each chosen line that has
//     none, carrying the Afrikaans the condition bank already has, so
//     lang-check/apply-af-accepted.mjs can wire it through the language gate like
//     every other bank line on a photograph. Nothing new is translated.
//
// Refuses if a chosen line is not in the condition bank word for word, or if the
// Afrikaans on the ruling is not the bank's, or if the photograph is not waiting.
//
//   node scripts/apply-slot-fill.mjs --ruling review/slot-fill-rain-w2-d3-ruled.json [--dry]
//   then: node scripts/build-hero-lines.mjs
//         node scripts/lang-check/apply-af-accepted.mjs --decisions review/af-al-decisions.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');
if (!val('--ruling')) { console.error('usage: --ruling review/slot-fill-<slot>-ruled.json'); process.exit(2); }

const rulingFile = val('--ruling');
const ruling = JSON.parse(readFileSync(path.resolve(root, rulingFile), 'utf8'));
const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const decisions = JSON.parse(readFileSync(R('af-bespoke-decisions.json'), 'utf8'));

const { hash } = ruling.slot;
const chosen = (ruling.chosen || []).map((c) => c.text);
const problems = [];

if (!chosen.length) { console.log('[slot fill] nothing chosen — the photograph stays on the condition bank'); process.exit(0); }
const waiting = (authoring.awaitingLines || []).find((a) => a.hash === hash);
if (!waiting) problems.push(`${hash} is not in awaitingLines — nothing to fill, or it was filled already`);

// Each chosen line must be a condition-bank line, and its Afrikaans the bank's.
const bankAf = new Map();
for (const ns of ['witty', 'witty_low_confidence']) for (const v of Object.values(WEATHER_COPY[ns] || {})) {
  if (!Array.isArray(v?.en)) continue;
  v.en.forEach((en, i) => { if (!bankAf.has(en)) bankAf.set(en, v.af?.[i] || ''); });
}
for (const c of ruling.chosen) {
  if (!bankAf.has(c.text)) { problems.push(`"${c.text}" is not a condition-bank line`); continue; }
  if (c.af && c.af !== bankAf.get(c.text)) problems.push(`"${c.text}": the ruling's Afrikaans "${c.af}" is not the bank's "${bankAf.get(c.text)}"`);
  if (!bankAf.get(c.text)) problems.push(`"${c.text}": the bank has no Afrikaans for it`);
}
if (problems.length) {
  console.error('[slot fill] refusing:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// ---- authoring: back into the set -------------------------------------------
const { cutLines, reason, ...entry } = waiting;
const filled = {
  ...entry,
  lines: chosen,
  culledLines: cutLines || [],
  refilled: `${ruling.generated}: ${chosen.length} line(s) chosen by Al on ${rulingFile.replace(/\\/g, '/')} after the provenance cull emptied this photograph`,
};
const out = {
  ...authoring,
  set: [...authoring.set, filled],
  awaitingLines: authoring.awaitingLines.filter((a) => a.hash !== hash),
  lineCount: authoring.set.reduce((n, e) => n + e.lines.length, 0) + chosen.length,
  images: authoring.set.length + 1,
};
if (!out.awaitingLines.length) delete out.awaitingLines;

// ---- Afrikaans: a canon row per chosen line that has none ------------------
const have = new Set(decisions.rows.map((r) => r.english));
let next = Math.max(...decisions.rows.filter((r) => /^C\d+$/.test(r.id)).map((r) => Number(r.id.slice(1)))) + 1;
const added = [];
for (const en of chosen) {
  if (have.has(en)) continue;
  added.push({
    id: `C${String(next++).padStart(3, '0')}`,
    group: 'canon',
    verdict: 'CANON',
    slot: `${entry.condition}/${entry.time}`,
    english: en,
    afrikaans: bankAf.get(en),
    score: null,
    reason: `Al's native condition-bank line, placed on this photograph by Al (${rulingFile.replace(/\\/g, '/')}, ${ruling.generated})`,
  });
}
const outDecisions = { ...decisions, rows: [...decisions.rows, ...added] };
if (decisions.counts && typeof decisions.counts === 'object' && typeof decisions.counts.canon === 'number') {
  outDecisions.counts = { ...decisions.counts, canon: decisions.counts.canon + added.length };
}

console.log(`[slot fill] ${hash} (${entry.image}): ${chosen.length} line(s) back on the photograph`);
for (const t of chosen) console.log(`    + "${t}"  |  AF "${bankAf.get(t)}"`);
console.log(`[slot fill] still cut, as ruled: ${(cutLines || []).length} line(s)`);
console.log(`[slot fill] canon rows added to af-bespoke-decisions.json: ${added.map((a) => a.id).join(', ') || 'none'}`);
if (DRY) { console.log('[slot fill] --dry: nothing written'); process.exit(0); }
writeFileSync(R('set-001-lines-bespoke-final.json'), JSON.stringify(out, null, 1));
writeFileSync(R('af-bespoke-decisions.json'), JSON.stringify(outDecisions, null, 1));
console.log('[slot fill] wrote both files');
