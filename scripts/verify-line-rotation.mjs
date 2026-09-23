// DOES EVERY SLOT THE ROTATION CAN SERVE HAVE ITS OWN LINES?
//
// Al's question, 2026-09-06: every photograph has a line now — does the rotation actually
// serve them? The lines table is authored per PHOTOGRAPH (hash), but the picker serves
// SLOTS: 9 conditions x 4 weeks x 4 time-slots x 7 indices = 1008 slot paths, from 644
// unique files, because one photograph occupies more than one slot.
//
// The gap this closes is the 2026-08-14 landmine restated for lines. set-001-draft.json is
// the hash -> slot-paths map that build-hero-lines expands through, and it is a CURATION
// artefact that has drifted from disk before. If it lists fewer paths than the folders
// actually hold, the missing slots silently fall back to a condition-bank line and nobody
// sees it — the app still renders, just not with the photograph's own joke.
//
// So this walks the FILESYSTEM, not the draft, and checks both key shapes the picker can
// emit for every file it finds:
//   source tree / preview  ->  bg/<condition>/week_N/<time>/<n>.webp
//   production             ->  bg-canonical/<sha256 of the bytes>.webp
//
//   node scripts/verify-line-rotation.mjs
// TWO STATES A RULING CAN PUT A SLOT IN (2026-09-23), checked for what they are:
//   - BENCHED (review/benched-photos.json): production serves the slot's fallback
//     photograph, not the file on disk, so the check is that the SERVED photograph
//     resolves to lines by its canonical name.
//   - BARE BY RULING (final.json `awaitingLines`): every line on the photograph was cut,
//     so it serves a condition-bank line until Al rules new ones. The applier that cut
//     them proved the bank pool non-empty in every context; here it is listed, not failed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HERO_LINES } from '../assets/hero-lines.js';
import { scanBackgroundSlots } from './image-slot-manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BG = path.join(ROOT, 'assets/images/bg');
const CONDITIONS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const WEEKS = [1, 2, 3, 4];
const INDICES = [1, 2, 3, 4, 5, 6, 7];

const fails = [];
const missingSlot = [];
const missingCanonical = [];
const mismatched = [];
let slots = 0;
let onDisk = 0;
const linesPerSlot = [];
const bytesByCanonical = new Map();
const scan = scanBackgroundSlots(BG);
const slotState = new Map(scan.entries.map((e) => [e.relativePath, e]));
const final = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', 'set-001-lines-bespoke-final.json'), 'utf8'));
const bareByRuling = new Set((final.awaitingLines || []).map((a) => a.hash));
const benchedSlots = [];
const bareSlots = [];

for (const condition of CONDITIONS) {
  for (const week of WEEKS) {
    for (const time of TIMES) {
      for (const i of INDICES) {
        const rel = `${condition}/week_${week}/${time}/${i}.webp`;
        slots += 1;
        let bytes;
        try { bytes = fs.readFileSync(path.join(BG, rel)); } catch { continue; }
        onDisk += 1;

        const state = slotState.get(rel);
        if (state?.benched) {
          const served = `bg-canonical/${state.hash}.webp`;
          benchedSlots.push(rel);
          if (!HERO_LINES[served]) missingCanonical.push(`${rel} (benched — serves ${path.relative(BG, state.servedPath).replace(/\\/g, '/')}, which has no lines)`);
          else linesPerSlot.push(HERO_LINES[served].length);
          continue;
        }
        if (bareByRuling.has(createHash('sha1').update(bytes).digest('hex').slice(0, 12))) { bareSlots.push(rel); continue; }

        const slotKey = `bg/${rel}`;
        const canonicalKey = `bg-canonical/${createHash('sha256').update(bytes).digest('hex')}.webp`;
        const viaSlot = HERO_LINES[slotKey];
        const viaCanonical = HERO_LINES[canonicalKey];

        if (!viaSlot) missingSlot.push(rel);
        if (!viaCanonical) missingCanonical.push(rel);
        if (viaSlot && viaCanonical && JSON.stringify(viaSlot) !== JSON.stringify(viaCanonical)) {
          mismatched.push(rel);
        }
        if (viaSlot) linesPerSlot.push(viaSlot.length);

        // Two slots sharing bytes must carry the same lines — the lines belong to the
        // photograph, not to the position in the cycle.
        const prev = bytesByCanonical.get(canonicalKey);
        if (prev && viaSlot && JSON.stringify(prev.lines) !== JSON.stringify(viaSlot)) {
          fails.push(`${rel} and ${prev.rel} are the same photograph but carry different lines`);
        } else if (viaSlot) {
          bytesByCanonical.set(canonicalKey, { rel, lines: viaSlot });
        }
      }
    }
  }
}

const say = (label, list) => {
  if (!list.length) { console.log(`  ✓ ${label}`); return; }
  console.log(`  ✗ ${label} — ${list.length}`);
  for (const r of list.slice(0, 12)) console.log(`      ${r}`);
  if (list.length > 12) console.log(`      … and ${list.length - 12} more`);
};

console.log(`rotation: ${slots} slot positions, ${onDisk} present on disk, ${bytesByCanonical.size} unique photographs`);
console.log(`  · ${benchedSlots.length} benched slot(s) checked through the photograph production serves in their place`);
console.log(`  · ${bareSlots.length} slot(s) hold a photograph left bare by a ruling — condition-bank line${bareSlots.length ? `: ${bareSlots.join(', ')}` : ''}`);
say('every slot on disk resolves to lines by its source-tree path', missingSlot);
say('every slot on disk resolves to lines by its production canonical name', missingCanonical);
say('both key shapes return the same lines for a slot', mismatched);
say('slots sharing bytes carry identical lines', fails);

const min = Math.min(...linesPerSlot);
const dist = {};
for (const n of linesPerSlot) dist[n] = (dist[n] || 0) + 1;
console.log(`  ${min >= 1 ? '✓' : '✗'} no served slot is bare — minimum lines on a slot: ${min}`);
console.log(`     lines per slot: ${JSON.stringify(dist)}`);

const total = missingSlot.length + missingCanonical.length + mismatched.length + fails.length + (min >= 1 ? 0 : 1);
if (onDisk !== 1008) {
  console.log(`  ! ${1008 - onDisk} slot positions have no file — the rotation would fall back on those`);
}
console.log(total ? `\n[line rotation] FAIL — ${total} problem group(s).` : '\n[line rotation] PASS.');
process.exit(total ? 1 : 0);
