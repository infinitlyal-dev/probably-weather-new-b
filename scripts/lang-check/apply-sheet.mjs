// Applies decisions from a lang-check correction sheet to the copy banks, through the lang-check
// gate: every accepted line is re-checked; a line that the change makes WORSE (its confidence
// rises and the proposed line is triage-high) is held, everything else is written.
//
//   node scripts/lang-check/apply-sheet.mjs --lang st --decisions review/lang-check-decisions-st.json
//   node scripts/lang-check/apply-sheet.mjs --lang st --accept-all        # Al's ruling 2026-09-08
//   add --dry to report without writing
//
// Writes: assets/weather-copy.js (witty arrays, heroLabels / headlines), assets/app.js (T strings),
//         lang-packs/<lang>/provisional-manifest.jsonl and corpus-confirmed.jsonl (mirrors),
//         review/lang-check-apply-<lang>.md (what was written, what was held and why).
// Then run: npm run copy:generate && npx vitest run

import fs from 'node:fs';
import path from 'node:path';
import { check } from './lib/checker.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const lang = val('--lang');
const DRY = args.includes('--dry');
if (!/^(zu|xh|st|af)$/.test(lang || '')) { console.error('usage: --lang zu|xh|st|af (--decisions file.json | --accept-all) [--dry]'); process.exit(2); }

const proposals = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', `lang-check-proposals-${lang}.json`), 'utf8'));
let decisions;
if (args.includes('--accept-all')) decisions = proposals.items.map((p) => ({ id: p.id, key: p.key, current: p.current, proposed: p.proposed, decision: 'accept' }));
else if (val('--decisions')) decisions = JSON.parse(fs.readFileSync(val('--decisions'), 'utf8')).decisions;
else { console.error('need --decisions <file> or --accept-all'); process.exit(2); }
const byId = new Map(proposals.items.map((p) => [p.id, p]));
const accepted = decisions.filter((d) => d.decision === 'accept').map((d) => ({ ...byId.get(d.id), ...d, proposed: d.proposed || byId.get(d.id)?.proposed }));

// ---------- gate ----------
const written = [], held = [], noChange = [];
for (const a of accepted) {
  const before = check({ lang, en: a.en || '', text: a.current, key: a.key });
  const after = check({ lang, en: a.en || '', text: a.proposed, key: a.key });
  const worse = after.action === 'triage-high' && after.confidence > before.confidence;
  const row = { ...a, before: before.confidence, after: after.confidence, doubts: after.findings.filter((f) => f.severity !== 'low').map((f) => `${f.severity} ${f.check}: ${f.message}`) };
  // --force-held: apply even what the gate would hold (Al's "accept all" ruling); the row is still listed
  if (worse && !args.includes('--force-held')) held.push(row); else { if (worse) row.forced = true; written.push(row); }
}

// ---------- write ----------
let copy = fs.readFileSync(path.join(ROOT, 'assets', 'weather-copy.js'), 'utf8');
let app = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
const jstr = (s) => JSON.stringify(s);
const applied = [];
for (const w of written) {
  const cur = jstr(w.current), next = jstr(w.proposed);
  if (w.key.startsWith('app.js:')) {
    if (app.includes(cur)) { app = app.split(cur).join(next); applied.push(w); } // every occurrence: duplicate keys share strings
    else noChange.push({ ...w, why: 'string not found in app.js' });
  } else if (w.key.startsWith('T.')) {
    // the T object: one leaf per line, replace the st/zu/… value on the line whose key matches
    const name = w.key.slice(2);
    const re = new RegExp(`^(\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*\\{[^\\n]*?\\b${lang}:\\s*)${cur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (re.test(app)) { app = app.replace(re, `$1${next}`); applied.push(w); }
    else if (app.includes(cur)) { app = app.replace(cur, next); applied.push(w); }
    else noChange.push({ ...w, why: 'T string not found in app.js' });
  } else {
    if (copy.includes(cur)) { copy = copy.split(cur).join(next); applied.push(w); }
    else noChange.push({ ...w, why: 'string not found in weather-copy.js' });
  }
}
// mirrors: provisional manifest and corpus-confirmed carry the same strings
const mirror = (file, field) => {
  const p = path.join(ROOT, 'lang-packs', lang, file);
  if (!fs.existsSync(p)) return 0;
  let s = fs.readFileSync(p, 'utf8'); let n = 0;
  for (const w of applied) { const cur = jstr(w.current), next = jstr(w.proposed); if (s.includes(cur)) { s = s.split(cur).join(next); n++; } }
  if (!DRY) fs.writeFileSync(p, s);
  return n;
};
let mirrored = {};
if (!DRY) {
  fs.writeFileSync(path.join(ROOT, 'assets', 'weather-copy.js'), copy);
  fs.writeFileSync(path.join(ROOT, 'assets', 'app.js'), app);
}
mirrored.manifest = mirror('provisional-manifest.jsonl');
mirrored.corpus = mirror('corpus-confirmed.jsonl');
mirrored.drafts = mirror('drafts-batch-1.jsonl'); // verify-lines reconciles bank ↔ manifest ↔ source draft
for (const l of ['zu', 'xh', 'st', 'af']) if (l !== lang) { const p = path.join(ROOT, 'lang-packs', l, 'corpus-confirmed.jsonl'); if (fs.existsSync(p)) { let s = fs.readFileSync(p, 'utf8'); let n = 0; for (const w of applied) { const cur = jstr(w.current), next = jstr(w.proposed); if (s.includes(cur)) { s = s.split(cur).join(next); n++; } } if (n && !DRY) fs.writeFileSync(p, s); mirrored[`corpus-${l}`] = n; } }

const md = [`# lang-check apply — ${lang} — ${new Date().toISOString().slice(0, 10)}${DRY ? ' (DRY RUN)' : ''}`, '', `${accepted.length} accepted; ${applied.length} written, ${held.length} held by the gate (the change raised the line to triage-high), ${noChange.length} not found.`, `Mirrors updated: ${JSON.stringify(mirrored)}.`, ''];
md.push('## Held', '');
for (const h of held) md.push(`- \`${h.key}\` ${h.before.toFixed(2)} → ${h.after.toFixed(2)}`, `  - now: ${h.current}`, `  - proposed: ${h.proposed}`, ...h.doubts.map((d) => `  - ${d}`));
md.push('', '## Not found', '');
for (const n of noChange) md.push(`- \`${n.key}\` ${n.why}: ${n.current}`);
md.push('', '## Written', '');
for (const w of applied) md.push(`- \`${w.key}\`${w.forced ? ' (forced past the gate: ' + w.before.toFixed(2) + ' → ' + w.after.toFixed(2) + ')' : ''}: ${w.current} → **${w.proposed}**`);
fs.writeFileSync(path.join(ROOT, 'review', `lang-check-apply-${lang}.md`), md.join('\n'));
console.log(`${lang}: ${accepted.length} accepted → ${applied.length} written, ${held.length} held, ${noChange.length} not found${DRY ? ' (dry run, nothing written)' : ''}; mirrors ${JSON.stringify(mirrored)} → review/lang-check-apply-${lang}.md`);
if (!DRY && applied.length) console.log('now run: npm run copy:generate && npx vitest run');
