// apply-provisional-drafts.mjs — fold checker-PASSED drafts into the copy banks as PROVISIONAL.
//
// Runs ONLY after the cross-family checker has written lang-packs/<lang>/checker-verdicts.jsonl
// (Al pastes CHECKER_PROMPT.md into Codex; that produces the verdicts). This run's job:
//   - PASS drafts  -> fill the matching "" slot in assets/weather-copy.js (row-alignment intact)
//   - FLAG drafts  -> leave "" ; keep in the debt ledger for priority native review
//   - record every applied string in lang-packs/<lang>/provisional-manifest.jsonl (the data-layer
//     marker: which live strings are provisional pending native confirm — sidecar, consistent
//     with how xh future_review rows are tracked today)
//
// Provisional-ness is a SIDECAR fact (the string ships plain + row-aligned; the manifest + debt
// ledger record its status), exactly as future_review rows were handled. No inline wrapper.
//
// Usage: node scripts/apply-provisional-drafts.mjs            (dry run — reports, writes nothing)
//        node scripts/apply-provisional-drafts.mjs --apply    (mutate weather-copy.js + manifests)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const APPLY = process.argv.includes('--apply');
const SKIP_LANG_CHECK = process.argv.includes('--skip-lang-check');
const LANGS = ['zu', 'xh', 'st'];

// lang-check gate (Al's ruling 2026-09-06): every zu/xh/st line runs through the corpus-backed
// checker before it is wired. A draft the checker rates triage-high is HELD for a native, not
// applied; lower doubts are applied but listed. Refuses to run without the corpus cache unless
// --skip-lang-check is passed explicitly (and says so).
async function langCheckGate(lang, pending, draftByKey) {
  if (SKIP_LANG_CHECK) { console.warn(`${lang}: lang-check gate SKIPPED by flag — every applied line is unchecked`); return { held: [], notes: [] }; }
  if (!pending.length) return { held: [], notes: [] };
  let gateLines, writeGateReport;
  try { ({ gateLines, writeGateReport } = await import('./lang-check/lib/gate.mjs')); }
  catch (e) { console.error(`${lang}: lang-check unavailable (${e.message}). Build the cache (node scripts/lang-check/fetch-corpora.mjs && node scripts/lang-check.mjs --build-index) or pass --skip-lang-check to apply unchecked.`); process.exit(1); }
  let result;
  try { result = gateLines(lang, pending.map((p) => ({ ...p, en: draftByKey.get(p.key)?.en || '', text: p.value }))); }
  catch (e) { console.error(`${lang}: lang-check failed (${e.message}). Build the cache or pass --skip-lang-check.`); process.exit(1); }
  writeGateReport(lang, result, `review/lang-check-gate-${lang}.md`);
  return { held: result.held, notes: result.noted };
}
const readJsonl = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : null);

// key "witty.<bin>[<idx>]" -> { group, bin, idx }
function parseKey(key) {
  const m = /^([a-z_]+)\.([a-z-]+)\[(\d+)\]$/.exec(key);
  return m ? { group: m[1], bin: m[2], idx: Number(m[3]) } : null;
}

let copySrc = APPLY ? readFileSync('assets/weather-copy.js', 'utf8') : null;
const EOL = copySrc && copySrc.includes('\r\n') ? '\r\n' : '\n';
let copyLines = copySrc ? copySrc.split(EOL) : null;
const jstr = (s) => JSON.stringify(s);

// Replace the whole "<lang>: [...]" array line for a given bin under `witty`/`witty_low_confidence`.
// We rebuild the array from the in-memory (mutated) WEATHER_COPY so every element stays row-aligned.
function rewriteArrayLine(group, bin, lang, newArray) {
  if (!copyLines) return;
  const condRe = /^    '?([a-z][a-z-]*)'?: \{$/;
  const groupHeader = `  ${group}: {`;
  let inGroup = false, curBin = null;
  for (let i = 0; i < copyLines.length; i++) {
    const line = copyLines[i];
    if (line === groupHeader) { inGroup = true; continue; }
    if (inGroup && line === '  },') { inGroup = false; curBin = null; continue; }
    if (!inGroup) continue;
    const ch = condRe.exec(line);
    if (ch) { curBin = ch[1]; continue; }
    if (curBin !== bin) continue;
    const m = new RegExp(`^(      ${lang}: )\\[.*\\](,?)$`).exec(line);
    if (m) { copyLines[i] = `${m[1]}[${newArray.map(jstr).join(', ')}]${m[2]}`; return true; }
  }
  return false;
}

let missingChecker = [];
const summary = {};
for (const lang of LANGS) {
  const drafts = readJsonl(`lang-packs/${lang}/drafts-batch-1.jsonl`);
  const verdicts = readJsonl(`lang-packs/${lang}/checker-verdicts.jsonl`);
  if (!drafts) { console.error(`${lang}: no drafts-batch-1.jsonl — run the drafters first`); continue; }
  if (!verdicts) { missingChecker.push(lang); continue; }

  const draftByKey = new Map(drafts.map((d) => [d.key, d]));
  const vByKey = new Map(verdicts.map((v) => [v.key, v]));
  // integrity: every verdict must map to a real draft (don't trust fabricated PASS rows)
  const orphanV = verdicts.filter((v) => !draftByKey.has(v.key));
  if (orphanV.length) { console.error(`${lang}: ${orphanV.length} verdict rows have no matching draft — checker file suspect, skipping`); continue; }

  // Phase 1: validate + mutate in memory. A PASS draft only qualifies if its d[lang] is a
  // NON-EMPTY STRING (guards against holes / wrong types corrupting the bank), and the target
  // slot is currently "". Collect qualified fills; do not record success yet.
  const touchedBins = new Set();
  const pending = []; // { key, group, bin, idx, value, confidence }
  let pass = 0, flag = 0, rejected = 0;
  for (const v of verdicts) {
    const d = draftByKey.get(v.key);
    const pk = parseKey(v.key);
    if (!pk) continue;
    if (v.verdict !== 'PASS') { flag++; continue; }
    pass++;
    const val = d?.[lang];
    if (typeof val !== 'string' || val.trim() === '') { rejected++; continue; } // #3 guard
    const arr = WEATHER_COPY?.[pk.group]?.[pk.bin]?.[lang];
    if (!Array.isArray(arr) || arr[pk.idx] !== '') { rejected++; continue; }
    arr[pk.idx] = val;                                    // mutate in memory (row-aligned)
    touchedBins.add(`${pk.group}|${pk.bin}`);
    pending.push({ key: v.key, group: pk.group, bin: pk.bin, idx: pk.idx, value: val, confidence: d.confidence ?? null });
  }

  // lang-check gate: hold triage-high drafts (revert their in-memory fill), keep the rest.
  const gate = await langCheckGate(lang, pending, draftByKey);
  const heldKeys = new Map(gate.held.map((hld) => [hld.key, hld]));
  for (const hld of gate.held) { WEATHER_COPY[hld.group][hld.bin][lang][hld.idx] = ''; }
  const pendingAfterGate = pending.filter((p) => !heldKeys.has(p.key));
  pending.length = 0; pending.push(...pendingAfterGate);
  if (gate.held.length) console.log(`${lang}: lang-check HELD ${gate.held.length} draft(s) for a native — see review/lang-check-gate-${lang}.md`);

  let appliedKeys = new Set();
  if (APPLY) {
    // Phase 2: rewrite each touched bin line; only bins whose rewrite SUCCEEDS count (#4).
    const okBins = new Set();
    for (const b of touchedBins) {
      const [g, bin] = b.split('|');
      if (rewriteArrayLine(g, bin, lang, WEATHER_COPY[g][bin][lang]) === true) okBins.add(b);
      else console.error(`${lang}: rewrite FAILED for ${g}.${bin} — its fills are NOT recorded as applied`);
    }
    appliedKeys = new Set(pending.filter((p) => okBins.has(`${p.group}|${p.bin}`)).map((p) => p.key));

    // Phase 3: APPEND to the provisional manifest (never overwrite the cumulative record) (#2).
    const manifestPath = `lang-packs/${lang}/provisional-manifest.jsonl`;
    const priorManifest = readJsonl(manifestPath) || [];
    const priorKeys = new Set(priorManifest.map((m) => m.key));
    const newManifest = pending.filter((p) => appliedKeys.has(p.key) && !priorKeys.has(p.key))
      .map((p) => ({ key: p.key, [lang]: p.value, status: 'provisional-pending-native-confirm', confidence: p.confidence }));
    writeFileSync(manifestPath, [...priorManifest, ...newManifest].map((r) => JSON.stringify(r)).join('\n') + '\n');

    // Rebuild debt from the FULL existing ledger minus successfully-applied keys — never
    // truncate the master queue to just this batch's drafts (#1). Un-drafted debt is preserved.
    const fullLedger = readJsonl(`lang-packs/${lang}/debt-ledger.jsonl`) || [];
    const stillDebt = fullLedger.filter((e) => !appliedKeys.has(e.key)).map((e) => {
      const v = vByKey.get(e.key);
      const hld = heldKeys.get(e.key);
      if (hld) return { ...e, status: 'held-lang-check', flag_reason: `lang-check ${hld.confidence.toFixed(2)}: ${hld.doubts.join(' | ')}` };
      return { ...e, status: v && v.verdict === 'FLAG' ? 'debt-flagged' : e.status, ...(v && v.verdict === 'FLAG' ? { flag_reason: v.reason ?? '' } : {}) };
    });
    writeFileSync(`lang-packs/${lang}/debt-ledger.jsonl`, stillDebt.map((r) => JSON.stringify(r)).join('\n') + (stillDebt.length ? '\n' : ''));
  } else {
    appliedKeys = new Set(pending.map((p) => p.key)); // dry-run: report what WOULD apply
  }
  summary[lang] = { drafts: drafts.length, pass, flag, rejected_malformed_or_filled: rejected, held_by_lang_check: gate.held.length, applied_with_doubt: gate.notes.length, would_apply: pending.length, applied: APPLY ? appliedKeys.size : 0 };
}

if (missingChecker.length) {
  console.error(`\nMissing checker-verdicts.jsonl for: ${missingChecker.join(', ')}`);
  console.error('This run cannot apply until Al pastes CHECKER_PROMPT.md into Codex and the verdicts land.');
}
console.log('\nsummary:', JSON.stringify(summary, null, 2));
if (APPLY && copyLines) { writeFileSync('assets/weather-copy.js', copyLines.join(EOL)); console.log('mutated assets/weather-copy.js — now run: npm run copy:generate && npx vitest run && npm run build && node review/tools/verify-lines.mjs'); }
else console.log('\nDRY RUN — nothing written. Re-run with --apply once checker verdicts exist.');
