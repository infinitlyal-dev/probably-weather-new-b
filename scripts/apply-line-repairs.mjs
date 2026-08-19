// Apply the swap-test repairs to a bucket and emit a v2 review source.
//
// WHY V2 RATHER THAN IN PLACE. The review tool keys Al's saved ticks by source
// filename. Rewriting a bucket under its own name would restore his ticks
// against different lines — which is exactly the defect that made him open the
// round-2 page and see round 1's text on 2026-08-19. New lines get a new file
// and therefore a new storage key.
//
// The audit says which line indices failed the swap test; the fix file says
// what replaces them. Both are keyed by image + 1-based line number, and this
// refuses to run if they disagree — a repair applied to the wrong slot is a
// joke moved onto a line Al already approved.
//
//   node scripts/apply-line-repairs.mjs <bucket> <audit.json> <fix.json...>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const [bucket, auditPath, ...fixPaths] = process.argv.slice(2);
if (!bucket || !auditPath || !fixPaths.length) {
  console.error('usage: node scripts/apply-line-repairs.mjs <bucket> <audit.json> <fix.json...>');
  process.exit(2);
}

const src = JSON.parse(readFileSync(p(`review/set-001-lines-bespoke-${bucket}.json`), 'utf8'));
const audit = JSON.parse(readFileSync(auditPath, 'utf8')).v;
const fixes = {};
for (const f of fixPaths) {
  for (const [img, byIdx] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) {
    fixes[img] = Object.assign(fixes[img] || {}, byIdx);
  }
}

const problems = [];
let replaced = 0, rescuesDropped = 0;
for (const img of src.images) {
  const verdicts = audit[img.image];
  if (!verdicts) { problems.push(`${img.image}: no audit verdicts`); continue; }
  const needs = verdicts.map((v, i) => (v.startsWith('PASS') ? -1 : i)).filter((i) => i >= 0);
  const given = Object.keys(fixes[img.image] || {}).map((n) => Number(n) - 1).sort((a, b) => a - b);

  if (needs.join(',') !== given.join(',')) {
    problems.push(`${img.image}: audit needs [${needs.map((i) => i + 1)}] but fix supplies [${given.map((i) => i + 1)}]`);
    continue;
  }
  for (const i of needs) {
    const text = fixes[img.image][String(i + 1)];
    if (!text || !text.trim()) { problems.push(`${img.image} line ${i + 1}: empty replacement`); continue; }
    if (text.trim() === img.lines[i]) { problems.push(`${img.image} line ${i + 1}: replacement is identical`); continue; }
    img.lines[i] = text.trim();
    // A replaced line is newly written, so any bank attribution on that slot is
    // now wrong. Leaving it would badge an original as BANK on the review page.
    if (img.rescue[i]) { img.rescue[i] = null; rescuesDropped += 1; }
    replaced += 1;
  }
}
// One fix file can cover several buckets (the sweep does), so entries for other
// conditions are ignored. An entry addressed to THIS condition that is not in
// the source is still an error — that is a typo'd path, not a shared file.
for (const img of Object.keys(fixes)) {
  if (!img.startsWith(`${bucket}/`)) continue;
  if (!src.images.some((i) => i.image === img)) problems.push(`${img}: fix targets ${bucket} but no such image in the source`);
}

if (problems.length) {
  console.error(`[repair ${bucket}] refusing to write:`);
  for (const x of problems) console.error(`  - ${x}`);
  process.exit(1);
}

src.generated = '2026-08-19';
src.revision = 'v2 — swap-test repair';
src.brief = src.brief + ' v2: every line re-tested against PAIRING-TASTE rule 1a — move it to a calm, mild day and if it still works it is out.';
const out = `review/set-001-lines-bespoke-${bucket}-v2.json`;
writeFileSync(p(out), JSON.stringify(src, null, 1));
console.log(`[repair ${bucket}] ${out} — ${replaced} lines replaced${rescuesDropped ? `, ${rescuesDropped} bank badges cleared` : ''}`);
