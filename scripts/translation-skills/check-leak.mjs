// Leak check: no sealed test item may appear in a skill (Part 2, step 8 — 2026-09-23).
//
// Fails when any skill file (.claude/skills/{af,zu,xh,st}-qc/SKILL.md, pw-ui-copy/SKILL.md, and any
// file those folders hold) contains a test set's English line or its human reference — including
// a stretch of eight or more consecutive words from one. Reports the skill file and line number
// only, never the test text, so running it does not leak the test set into whoever reads the output.
//
//   node scripts/translation-skills/check-leak.mjs [--skills .claude/skills]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const SKILLS = path.resolve(root, val('--skills', '.claude/skills'));
const gold = path.join(root, 'scripts', 'translation-skills', 'gold');
const lock = JSON.parse(readFileSync(path.join(gold, 'LOCK.json'), 'utf8'));
const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const shingles = new Set();
const K = 8;
for (const f of Object.keys(lock.files)) {
  const body = readFileSync(path.join(gold, f), 'utf8');
  if (createHash('sha256').update(body).digest('hex') !== lock.files[f]) { console.error(`[leak] ${f} does not match its seal`); process.exit(1); }
  for (const it of JSON.parse(body).items) {
    for (const s of [it.en, it.reference]) {
      const w = norm(s).split(' ').filter(Boolean);
      if (w.length < K) { if (w.length >= 4) shingles.add(w.join(' ')); continue; }   // short lines: the whole line
      for (let i = 0; i + K <= w.length; i++) shingles.add(w.slice(i, i + K).join(' '));
    }
  }
}
const files = [];
const walk = (d) => { for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(md|json|txt)$/i.test(e)) files.push(p); } };
for (const s of ['af-qc', 'zu-qc', 'xh-qc', 'st-qc', 'pw-ui-copy']) walk(path.join(SKILLS, s));
const hits = [];
for (const f of files) {
  readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const w = norm(line).split(' ').filter(Boolean);
    const joined = w.join(' ');
    for (let n = 0; n + K <= w.length; n++) if (shingles.has(w.slice(n, n + K).join(' '))) { hits.push(`${path.relative(root, f)}:${i + 1}`); return; }
    for (const s of shingles) if (s.split(' ').length < K && (` ${joined} `).includes(` ${s} `)) { hits.push(`${path.relative(root, f)}:${i + 1}`); return; }
  });
}
if (hits.length) {
  console.error(`[leak] ${hits.length} skill line(s) carry text from a sealed test set — remove them:`);
  for (const h of hits) console.error(`  - ${h}`);
  process.exit(1);
}
console.log(`[leak] clean — ${files.length} skill files, no test English or reference (${shingles.size} test shingles checked)`);
