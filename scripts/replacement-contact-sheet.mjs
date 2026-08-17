// BEFORE / AFTER for the 2026-08-14 replacement ingest.
//
// One row per replaced photograph: the rejected image and its replacement, each
// shown whole AND through the two hero bands that matter — the reference phone
// (390x844) and the worst case in the fold matrix (320x488). The rejected bytes
// come out of git, so the "before" is what actually shipped, not a memory of it.
//
// The band is drawn with the SAME CSS the app uses (background-size: cover,
// background-position: center <anchor>%), at the anchor each image is wired to:
// the old one at its old anchor, the new one at the 55% the replacements were
// composed for.
//
//   node scripts/replacement-contact-sheet.mjs
//
// Output: output/replacements/index.html (+ before/*.webp extracted from git)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'output', 'replacements');
const beforeDir = path.join(out, 'before');
mkdirSync(beforeDir, { recursive: true });

const report = JSON.parse(readFileSync(path.join(root, 'review', 'ingest-2026-08-14-report.json'), 'utf8'));
const prevAnchors = JSON.parse(execFileSync('git', ['show', 'HEAD:review/set-001-crop-offsets.json'], { cwd: root, maxBuffer: 32e6 }).toString()).offsets;
const geo = JSON.parse(readFileSync(path.join(root, 'output', 'm7-crop', 'sheet-index.json'), 'utf8'));

const ref = geo.reference;
const worst = geo.worst;
const SCALE = 0.72;

const rows = [];
for (const r of report) {
  const slot = r.slots[0];
  const beforeName = `${slot.replace(/[/]/g, '_')}`;
  const beforePath = path.join(beforeDir, beforeName);
  if (!existsSync(beforePath)) {
    const bytes = execFileSync('git', ['show', `HEAD:assets/images/bg/${slot}`], { cwd: root, maxBuffer: 64e6, encoding: 'buffer' });
    writeFileSync(beforePath, bytes);
  }
  const oldAnchor = prevAnchors[r.oldHash]?.anchorY ?? 78;
  rows.push({
    ...r, slot, beforeRel: `before/${beforeName}`,
    afterRel: path.relative(out, path.join(root, 'assets/images/bg', slot)).replaceAll('\\', '/'),
    oldAnchor,
  });
}

const band = (src, anchor, box, label) => `
  <figure class="band">
    <div class="crop" style="width:${Math.round(box.width * SCALE)}px;height:${Math.round(box.height * SCALE)}px;
      background-image:url('${src}');background-position:center ${anchor}%"></div>
    <figcaption>${label} · ${anchor}%</figcaption>
  </figure>`;

const html = `<!doctype html><meta charset="utf-8"><title>PW — replacement ingest, before/after</title>
<style>
  body { margin:0; background:#14110d; color:#fffaf3; padding:24px;
         font:13.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .lead { color:#b5ab9d; max-width:80ch; margin:0 0 20px; }
  section { border-top:1px solid rgba(246,242,232,.14); padding:16px 0; }
  h2 { font-size:14px; margin:0 0 2px; }
  .meta { color:#b5ab9d; font-size:11.5px; margin:0 0 10px; font-variant-numeric:tabular-nums; }
  .pair { display:flex; gap:26px; flex-wrap:wrap; align-items:flex-start; }
  .side { display:flex; gap:12px; align-items:flex-start; }
  .whole img { width:104px; border-radius:6px; display:block; }
  .whole figcaption, figcaption { font-size:10.5px; color:#b5ab9d; margin-top:5px; text-align:center; }
  .crop { background-size:cover; background-repeat:no-repeat; border-radius:5px; border:1px solid rgba(246,242,232,.18); }
  figure { margin:0; }
  .tag { font-size:10px; padding:2px 7px; border-radius:999px; border:1px solid rgba(246,242,232,.3); color:#b5ab9d; margin-left:6px; }
  .out { border-color:#ff6b6b; color:#ff6b6b; }
  .in { border-color:#63c98a; color:#63c98a; }
</style>
<h1>Replacement ingest — 29 photographs, before and after</h1>
<p class="lead">Left of each pair is the rejected image at the anchor it shipped with; right is Al's replacement at 55%,
the centre the replacements were composed for. Each is shown whole, then through the reference phone band
(${Math.round(ref.width)}×${Math.round(ref.height)}) and the worst case in the fold matrix
(${Math.round(worst.width)}×${Math.round(worst.height)}, ${worst.device}). Bands are drawn with the app's own CSS.
The "before" bytes are pulled out of git, so this is what actually shipped.</p>

${rows.map((r) => `<section>
  <h2>${r.bucket} <span class="tag out">out ${r.oldHash}</span> <span class="tag in">in ${r.newHash}</span></h2>
  <p class="meta">${r.slots.join(' · ')} — ${r.slots.length > 1 ? 'shared twin, both paths rewritten' : 'single slot'} · ${r.winner} · q${r.quality} · ${(r.bytes / 1024).toFixed(0)}KB · ${r.dims}</p>
  <div class="pair">
    <div class="side">
      <figure class="whole"><img src="${r.beforeRel}" alt="before"><figcaption>rejected</figcaption></figure>
      ${band(r.beforeRel, r.oldAnchor, ref, 'ref')}
      ${band(r.beforeRel, r.oldAnchor, worst, 'worst')}
    </div>
    <div class="side">
      <figure class="whole"><img src="${r.afterRel}" alt="after"><figcaption>replacement</figcaption></figure>
      ${band(r.afterRel, 55, ref, 'ref')}
      ${band(r.afterRel, 55, worst, 'worst')}
    </div>
  </div>
</section>`).join('')}
`;
writeFileSync(path.join(out, 'index.html'), html);
console.log(`[sheet] ${rows.length} pairs → output/replacements/index.html`);
