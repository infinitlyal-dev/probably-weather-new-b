// Rebuilds the pairs job's queue in Al's order of 26 Sept 2026: his three named photos first, then the photos
// on the meh page marked REPLACE (most-shown first; before his export only the clearest cases — the rest are
// queued by the job itself when meh-photos-ruled.json lands), then extra photos for the thinnest weathers
// (fog, heat, cold-clear). Keeps every target already made; parks the older targets that order leaves out.
//
//   node review/pairs-job/queue-meh.mjs --data <the job's data folder>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanBackgroundSlots } from '../../scripts/image-slot-manifest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('--data');
if (!DATA) throw new Error('usage: node queue-meh.mjs --data <folder>');
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const livePath = path.join(DATA, 'targets.json');
const old = existsSync(livePath) ? J(livePath) : J(path.join(HERE, 'targets.json'));
const state = existsSync(path.join(DATA, 'state.json')) ? J(path.join(DATA, 'state.json')) : { done: [] };
const flags = J(path.join(ROOT, 'review', 'meh-photos', 'flags.json')).flags;

const targets = [];
// 1. Everything already made stays on record as it was.
for (const t of old.targets) if (state.done.includes(t.id)) targets.push({ ...t, tier: t.tier ?? 0 });
// 2. Older targets this order leaves out: parked (tier 9 — the job never takes them), not deleted.
for (const t of old.targets) {
  if (state.done.includes(t.id) || /^(R|X)\d+$/.test(t.id)) continue;
  const why = t.kind === 'weak-clear' ? 'superseded: the same photo is queued (or flagged) from the meh page'
    : t.kind === 'thin' ? "superseded: Al's thin weathers are fog, heat and cold-clear (X targets)"
      : "parked: Al's queue of 26 Sept is his named photos, then REPLACE photos, then thin weathers";
  targets.push({ ...t, tier: 9, parked: why });
}
// 3. Replacements: the three named photos, then the clearest cases, most-shown first. One target per
//    weather and time of day the photo serves (the blankets serve cold nights and, benched, cloudy nights).
let seq = 0;
const rid = () => `R${String(++seq).padStart(2, '0')}`;
const order = [...flags.filter((f) => f.reasons.includes('bane')), ...flags.filter((f) => f.clear && !f.reasons.includes('bane'))];
for (const f of order) {
  const groups = {};
  for (const s of [...f.slots, ...(f.benchedSlots || [])]) { const [folder, , time] = s.split('/'); (groups[`${folder}/${time}`] ||= { folder, time, slots: [] }).slots.push(s); }
  for (const g of Object.values(groups)) {
    const benched = (f.benchedSlots || []).includes(g.slots[0]);
    targets.push({ id: rid(), tier: f.reasons.includes('bane') ? 1 : 2, kind: 'replace', bin: g.folder, folder: g.folder, time: g.time, slots: g.slots,
      why: `replaces: ${f.note}`, note: `it replaces a photo being retired from these spots (${f.note}${benched ? '; these spots are benched and show a stand-in until the new photo is wired' : ''}) — do not repeat its problem`,
      replaces: { sha256: f.sha256, note: f.note, slot: f.slots[0] }, queued: 'before Al\'s export (clearest case)' });
  }
}
// 4. Extra photos for the thinnest weathers: weeks 2 and 4 of a spot one photo holds all four weeks, for each
//    time of day in fog, heat and cold-clear (never a flagged photo's spot: those are replaced whole).
const scan = scanBackgroundSlots(path.join(ROOT, 'assets', 'images', 'bg'));
const flagged = new Set(flags.map((f) => f.sha256));
const bySlot = new Map(scan.entries.map((e) => [e.relativePath, e.hash]));
let xs = 0;
for (const folder of ['fog', 'heat', 'cold-clear']) {
  for (const time of ['dawn', 'day', 'dusk', 'night']) {
    for (let i = 1; i <= 7; i++) {
      const hs = [1, 2, 3, 4].map((w) => bySlot.get(`${folder}/week_${w}/${time}/${i}.webp`));
      if (!hs[0] || hs.some((h) => h !== hs[0])) continue;
      if (flagged.has(hs[0])) continue;
      xs++;
      targets.push({ id: `X${String(xs).padStart(2, '0')}`, tier: 3, kind: 'thin', bin: folder, folder, time, slots: [`${folder}/week_2/${time}/${i}.webp`, `${folder}/week_4/${time}/${i}.webp`],
        why: `a second photo for ${folder} ${time}, slot ${i} (one photo holds all four weeks)`, note: 'an extra photo for one of the thinnest weathers; it shares its spot with another photo on alternate weeks' });
      break;
    }
  }
}
writeFileSync(livePath, JSON.stringify({ note: "The pairs job's queue, in Al's order (26 Sept 2026): tier 1 his three named photos, tier 2 photos marked REPLACE on the meh page (most-shown first; the clearest now, the rest when his export lands — the job adds them), tier 3 extra photos for the thinnest weathers (fog, heat, cold-clear). Tier 9 is parked (never made). A target with `kept` was dropped by his KEEP. Nothing here changes the app.", targets }, null, 1));
const c = (k) => targets.filter((t) => t.tier === k && !state.done.includes(t.id)).length;
console.log(`queue: tier1 ${c(1)}, tier2 ${c(2)}, tier3 ${c(3)}, parked ${c(9)}, made ${targets.filter((t) => state.done.includes(t.id)).length}`);
console.log(targets.filter((t) => t.tier === 1).map((t) => `${t.id} ${t.folder}/${t.time} ${t.slots.length} spots: ${t.replaces.note}`).join('\n'));
