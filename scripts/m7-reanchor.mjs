// M7 — carry the 2026-08-09 verdicts onto the geometry that ships TODAY.
//
// The 294 verdicts in review/m7-verdicts.json were ruled against a worst-case
// hero band of 643 x 216.75 (aspect 2.97). That box no longer exists: M9's flex
// hero and the current fold matrix put the worst case at 276.79 x 131.47
// (aspect 2.105), measured live off dist by verify-crop-survival.mjs and written
// to output/m7-crop/sheet-index.json. Every cell now shows MORE of its source
// than it was judged against, so the old ruling cannot simply be adopted.
//
// This is not a re-guess. For a portrait source under `background-size: cover`
// in a landscape band, the visible slice is deterministic:
//
//   f  = (band height / band width) x (source width / source height)
//   top(p)    = p x (1 - f)          bottom(p) = top(p) + f
//
// With sources at 9:16 (0.5625):
//   f_old = (216.75 / 643)    x 0.5625 = 0.1896   -> 19.0% of the source
//   f_new = (131.47 / 276.79) x 0.5625 = 0.2672   -> 26.7% of the source
//
// Two consequences, both provable rather than eyeballed:
//
//   SURVIVES stays SURVIVES. The new default band (57.2%-83.9%) strictly
//   CONTAINS the old one (63.2%-82.2%), so nothing that was fully inside the old
//   band can have left the new one.
//
//   FIXABLE keeps its framing at a new anchor. The old anchor A framed a subject
//   window starting at A x (1 - f_old); the anchor that puts the new band's top
//   edge on the same line is A x (1 - f_old) / (1 - f_new) = A x 1.1059. The band
//   is taller, so that window is still covered, with the extra height falling
//   BELOW it — which is the safe direction for a cut-off head.
//
// The mapping is deliberately CONSERVATIVE: it preserves the exact framing Al
// ruled good. Eyeballing the re-rendered sheets shows some of these cells no
// longer need any anchor at all (the taller band already contains the subject) —
// that sample is reported in review/M7-CLOSE-2026-08-10.md and is Al's to accept
// or ignore. Accepting the anchors as computed is always safe.
//
//   node scripts/m7-reanchor.mjs          -> the table + the anchor file
//   node scripts/m7-reanchor.mjs --write  -> also write review/set-001-crop-offsets.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const WRITE = process.argv.includes('--write');
const p = (f) => path.join(root, f);

const geo = JSON.parse(readFileSync(p('output/m7-crop/sheet-index.json'), 'utf8'));
const old = JSON.parse(readFileSync(p('review/m7-verdicts.json'), 'utf8'));
const draft = JSON.parse(readFileSync(p('review/set-001-draft.json'), 'utf8'));
const assignments = Array.isArray(draft) ? draft : (draft.assignments || draft.images);

// The band the OLD ruling was made against, quoted from that file's own header.
const OLD_BAND = { w: 643, h: 216.75 };
const NEW_BAND = { w: geo.worst.width, h: geo.worst.height };
const SRC_ASPECT = 1080 / 1920; // every set-001 source is 9:16

const fOld = (OLD_BAND.h / OLD_BAND.w) * SRC_ASPECT;
const fNew = (NEW_BAND.h / NEW_BAND.w) * SRC_ASPECT;
const carry = (a) => Math.round((a * (1 - fOld)) / (1 - fNew));
const bandAt = (anchor, f) => [anchor / 100 * (1 - f), anchor / 100 * (1 - f) + f];

// Rebuild bucket#position -> image, exactly the way the sheets number the cells.
const buckets = new Map();
for (const a of assignments) {
  const key = `${a.condition}-${a.time}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(a);
}

const rows = [];
const offsets = {};
let survives = 0; let fixable = 0; let fails = 0; let nowFree = 0;
for (const [bucket, list] of [...buckets.entries()].sort()) {
  list.forEach((a, i) => {
    const key = `${bucket}#${i + 1}`;
    const v = old.verdicts[key];
    if (!v) throw new Error(`no verdict for ${key} — the old ruling is not complete`);
    if (v.verdict === 'SURVIVES') { survives += 1; return; }
    if (v.verdict === 'FAILS') {
      fails += 1;
      rows.push({ key, image: a.image, verdict: 'FAILS', cause: v.reason || 'no band carries a subject at any offset' });
      return;
    }
    fixable += 1;
    const anchorNew = carry(v.anchorY);
    // Does the NEW DEFAULT band already contain the window the old anchor framed?
    const [oldTop, oldBot] = bandAt(v.anchorY, fOld);
    const [defTop, defBot] = bandAt(78, fNew);
    const free = oldTop >= defTop && oldBot <= defBot;
    if (free) nowFree += 1;
    offsets[a.hash] = {
      verdict: 'FIXABLE',
      bucket,
      slot: `${a.week}/${a.day}`,
      image: a.image,
      anchorY: anchorNew,
      carriedFrom: v.anchorY,
      defaultAlreadyCovers: free,
    };
    rows.push({ key, image: a.image, verdict: 'FIXABLE', from: v.anchorY, to: anchorNew, free });
  });
}

console.log(`[m7] band geometry: OLD ${OLD_BAND.w}x${OLD_BAND.h} shows ${(fOld * 100).toFixed(1)}% of the source`);
console.log(`[m7]                NEW ${NEW_BAND.w}x${NEW_BAND.h} shows ${(fNew * 100).toFixed(1)}% — ${((fNew / fOld - 1) * 100).toFixed(0)}% more`);
console.log(`[m7] default 78% band: OLD ${(bandAt(78, fOld).map((x) => (x * 100).toFixed(1)).join('%-'))}%  NEW ${(bandAt(78, fNew).map((x) => (x * 100).toFixed(1)).join('%-'))}%`);
console.log(`[m7] anchor carry factor: x${((1 - fOld) / (1 - fNew)).toFixed(4)}`);
console.log(`\n[m7] ${survives} SURVIVES (provably unchanged) · ${fixable} FIXABLE (anchors carried) · ${fails} FAILS`);
console.log(`[m7] of the FIXABLE, ${nowFree} are already covered by the new default band — an anchor for them is belt and braces.`);

const byAnchor = {};
for (const r of rows.filter((x) => x.verdict === 'FIXABLE')) byAnchor[r.to] = (byAnchor[r.to] || 0) + 1;
console.log(`[m7] carried anchors: ${Object.entries(byAnchor).sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}%×${n}`).join('  ')}`);
for (const r of rows.filter((x) => x.verdict === 'FAILS')) console.log(`[m7] FAILS — ${r.key}: ${r.image}\n              cause: ${r.cause}`);

if (WRITE) {
  const doc = {
    note: 'M7 anchors, carried onto the geometry that ships today by scripts/m7-reanchor.mjs. PROPOSED — Al rules at Gate 1. Percentages, honoured at every hero height; an image with no entry renders at the CSS default.',
    generated: '2026-08-10',
    band: {
      ruledAgainst: `${OLD_BAND.w}x${OLD_BAND.h} (shows ${(fOld * 100).toFixed(1)}% of a 9:16 source)`,
      shipsToday: `${NEW_BAND.w}x${NEW_BAND.h} (shows ${(fNew * 100).toFixed(1)}%)`,
      measuredAt: `${geo.worst.viewport} — ${geo.worst.device}, live off dist`,
      carryFactor: Number(((1 - fOld) / (1 - fNew)).toFixed(4)),
    },
    counts: { survives, fixable, fails, fixableAlreadyCoveredByDefault: nowFree },
    offsets,
  };
  writeFileSync(p('review/set-001-crop-offsets.json'), `${JSON.stringify(doc, null, 1)}\n`);
  console.log(`\n[m7] wrote review/set-001-crop-offsets.json — ${Object.keys(offsets).length} anchors`);
}
