// generate-review-batch.mjs — emit a native-speaker review batch, sized to budget.
//
// Reads a language's debt ledger (lang-packs/<lang>/debt-ledger.jsonl), prioritises by how
// often each line SERVES (so the most-seen strings get confirmed first), optionally merges the
// PROVISIONAL draft (drafts-batch-1.jsonl) for confirm-or-correct, and writes the established
// reviewer-doc format. When the native returns it, apply-phase tooling folds the answers in.
//
// This is the "never again translate everything" tool: one command, --limit to Al's budget.
//
// Usage:
//   node scripts/generate-review-batch.mjs --lang zu --limit 50
//   node scripts/generate-review-batch.mjs --lang st --limit 30 --out review/st-batch-1.md

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { WITTY_DAY_TAGS } from '../assets/witty-day-tags.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const lang = args.lang;
const limit = args.limit && args.limit !== true && Number.isFinite(Number(args.limit)) && Number(args.limit) > 0 ? Number(args.limit) : 50;
if (!['zu', 'xh', 'st'].includes(lang)) { console.error('--lang must be zu|xh|st'); process.exit(1); }
if (args.out === true) { console.error('--out needs a file path'); process.exit(1); } // #5 guard

const ledgerPath = `lang-packs/${lang}/debt-ledger.jsonl`;
const draftsPath = `lang-packs/${lang}/drafts-batch-1.jsonl`;
const debt = readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const drafts = existsSync(draftsPath)
  ? Object.fromEntries(readFileSync(draftsPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const d = JSON.parse(l); return [d.key, d]; }))
  : {};

// --- serve-frequency priority (no telemetry, so a defensible proxy) ---
// base weight by how common the condition is in SA weather; a narrow context tag (region/day/
// month gate) means the line shows rarely, so it drops down the queue.
const CONDITION_BASE = { clear: 10, cloudy: 9, wind: 8, heat: 8, 'partly-cloudy': 7, rain: 6, cold: 6, 'cold-clear': 5, storm: 4, fog: 3, uv: 5, thunder: 2, hail: 2, 'rain-possible': 6, night: 7, weekend: 6 };
function priority(entry) {
  const m = /^(witty|witty_low_confidence)\.([a-z-]+)\[(\d+)\]/.exec(entry.key);
  if (!m) return 1; // non-witty (heroLabels/headlines) — rare debt, low priority
  const [, group, bin, idxStr] = m;
  let p = CONDITION_BASE[bin] ?? 4;
  if (group === 'witty_low_confidence') p *= 0.4; // only shows in low-confidence forecasts
  const tag = WITTY_DAY_TAGS?.[group]?.[bin]?.[Number(idxStr)];
  if (tag) {
    if (tag.region) p *= 0.3;              // region-gated → serves in one box only
    if (tag.day) p *= 0.4;                 // day-named/weekday → serves some days
    if (tag.months) p *= 0.6;              // seasonal
    if (tag.time && !tag.region && !tag.day) p *= 0.7; // time-slot only
  }
  return p;
}

const ranked = debt.map((e) => ({ ...e, _p: priority(e) })).sort((a, b) => b._p - a._p);
const batch = ranked.slice(0, limit);

// --- emit reviewer doc (established format: EN + AF reference + draft + confirm/correct) ---
const langName = { zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' }[lang];
const hasDrafts = Object.keys(drafts).length > 0;
const lines = [];
lines.push(`# Probably Weather — ${langName} review batch (${batch.length} of ${debt.length} outstanding)`);
lines.push('');
lines.push(`Probably Weather is a South African weather app with personality — witty, warm, colloquial,`);
lines.push(`code-switched (NOT textbook). Below are ${langName} weather one-liners. The **English** is the`);
lines.push(`meaning; the **Afrikaans** is a native SA speaker's take on the same joke (for tone).`);
lines.push(hasDrafts
  ? `Each row has a **PROVISIONAL ${langName} draft** — please **confirm (Y)** or **correct** it. A draft is a starting point, not a claim; your wording is final.`
  : `Please supply a natural ${langName} line for each (your wording is final).`);
lines.push('');
lines.push(`Register: how a friend would say it looking out the window. Keep naturally code-switched`);
lines.push(`loans (braai, brand/place names). Prioritised by how often each line shows in the app.`);
lines.push('');
lines.push('---');
lines.push('');
batch.forEach((e, i) => {
  const d = drafts[e.key];
  lines.push(`### ${i + 1}. \`${e.key}\``);
  lines.push(`- **EN:** ${e.en}`);
  if (e.af) lines.push(`- **AF (tone reference):** ${e.af}`);
  if (d) {
    lines.push(`- **PROVISIONAL ${lang}:** ${d[lang] ?? d.draft ?? ''}  ${d.confidence ? `_(model confidence: ${d.confidence})_` : ''}`);
    lines.push(`- **Confirm (Y) or correct:** ____________________`);
  } else {
    lines.push(`- **Your ${lang}:** ____________________`);
  }
  lines.push('');
});
lines.push('---');
lines.push(`Thank you. Return to Al. (${batch.length} rows · ${debt.length - batch.length} still queued for a later batch.)`);

const out = args.out || `review/${lang}-review-batch.md`;
const doc = lines.join('\n') + '\n';
if (args.out === undefined && args.print) { process.stdout.write(doc); }
else { writeFileSync(out, doc); console.log(`wrote ${out} — ${batch.length} rows (of ${debt.length} outstanding), drafts merged: ${hasDrafts}`); }
