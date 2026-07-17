// STEP 2 — wire the 184 chosen meme-batch-2 images into condition/week/bin slots.
//
// Placement model (derived from review/tools/inventory.json, joined to al-rulings.json
// on idx<->index, 0 mismatches, 1008 slots reconciled):
//   - day slots:     1 distinct image per slot.        Target 28/bin (4 weeks x 7).
//   - off-peak:      1 distinct image per WEEK PAIR.   Target 14/bin (pairs (1,3) and (2,4)).
//
// Two sources of capacity, neither of which displaces a surviving ruled-KEEP image:
//   1. KILL slots  — Al ruled the occupant out; its bytes are free to overwrite.
//   2. fog demotion — fog off-peak has 21 KEEP images each duplicated across ALL FOUR
//      weeks (84 slots, 0 kills). Parity is reached by demoting each to one week pair
//      and giving the new image the other pair. The KEEP image stays in the library at
//      half its duplication depth. That is the point of the parity target, not a displacement.
//
// Usage: node review/tools/wire-picks.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APPLY = process.argv.includes('--apply');
const TARGET_BYTES = 290 * 1024;  // recompress-bg-images.mjs budget; hard gate is 300 KiB
const MAX_BYTES = 300 * 1024;
const QUALITY_LADDER = [82, 78, 74, 70, 66, 62, 60];
const WIDTH_LADDER = [1008, 960, 900];  // library standard is 1008x1792

const picks = JSON.parse(fs.readFileSync('review/image-picks.json', 'utf8')).picks;
const inv = JSON.parse(fs.readFileSync('review/tools/inventory.json', 'utf8'));
const rul = JSON.parse(fs.readFileSync('review/al-rulings.json', 'utf8')).rulings;
const verdict = new Map(rul.map((r) => [r.index, r.al_verdict]));

const isKill = (i) => verdict.get(i.idx) === 'KILL';
const binOf = (i) => `${i.cond}/${i.slot}`;
const weekOf = (p) => Number(/week_(\d)/.exec(p)[1]);

// Survivors per (bin, week) — drives "emptier weeks first".
const survPerBinWeek = new Map();
for (const i of inv) {
  if (isKill(i)) continue;
  for (const s of i.slots) {
    const k = `${binOf(i)}|${weekOf(s)}`;
    survPerBinWeek.set(k, (survPerBinWeek.get(k) || 0) + 1);
  }
}
const emptiness = (bin, weeks) => weeks.reduce((t, w) => t + (survPerBinWeek.get(`${bin}|${w}`) || 0), 0);

// Build capacity slots per bin.
const capacity = new Map();  // bin -> [{ targets:[paths], weeks:[n], source }]
const push = (bin, entry) => {
  if (!capacity.has(bin)) capacity.set(bin, []);
  capacity.get(bin).push(entry);
};

for (const i of inv) {
  const bin = binOf(i);
  if (isKill(i)) {
    if (i.slot === 'day') {
      for (const s of i.slots) push(bin, { targets: [s], weeks: [weekOf(s)], source: 'kill-slot' });
    } else {
      // All KILL off-peak images serve exactly one week pair (verified: no x3/x4 among kills).
      push(bin, { targets: [...i.slots], weeks: i.slots.map(weekOf), source: 'kill-pair' });
    }
  } else if (i.slotCount === 4 && i.slot !== 'day') {
    // fog demotion: KEEP image keeps weeks (1,3); weeks (2,4) become capacity at the same index.
    const freed = i.slots.filter((s) => [2, 4].includes(weekOf(s)));
    push(bin, { targets: freed, weeks: freed.map(weekOf), source: 'fog-demotion', demotes: i.rep });
  }
}

// Assign: emptier weeks first, deterministic pick order.
const byBin = new Map();
for (const p of picks) {
  const b = `${p.condition}/${p.bin}`;
  if (!byBin.has(b)) byBin.set(b, []);
  byBin.get(b).push(p);
}

const plan = [];
const shortfalls = [];
for (const [bin, list] of [...byBin.entries()].sort()) {
  const slots = (capacity.get(bin) || []).sort((a, b) => emptiness(bin, a.weeks) - emptiness(bin, b.weeks));
  const ordered = [...list].sort((a, b) => a.id.localeCompare(b.id));
  if (ordered.length > slots.length) shortfalls.push(`${bin}: ${ordered.length} picks > ${slots.length} slots`);
  ordered.forEach((p, n) => {
    const slot = slots[n];
    if (!slot) return;
    plan.push({
      id: p.id, bin, chosen: p.chosen,
      src: `output/meme-gen/${p.dir}/${p.id}-${p.chosen}.jpg`,
      targets: slot.targets, weeks: slot.weeks, source: slot.source, demotes: slot.demotes || null,
    });
  });
}

// Report
const bySource = {};
plan.forEach((x) => { bySource[x.source] = (bySource[x.source] || 0) + 1; });
console.log(`plan: ${plan.length} images -> ${plan.reduce((t, x) => t + x.targets.length, 0)} slots`);
console.log('by capacity source:', bySource);
if (shortfalls.length) { console.error('SHORTFALLS:', shortfalls); process.exit(1); }

const missing = plan.filter((x) => !fs.existsSync(x.src));
if (missing.length) { console.error('MISSING SOURCES:', missing.map((m) => m.src)); process.exit(1); }

// Guard: never write over a surviving KEEP slot.
const keepSlots = new Set(inv.filter((i) => !isKill(i) && i.slotCount !== 4).flatMap((i) => i.slots));
const violations = plan.flatMap((x) => x.targets.filter((t) => keepSlots.has(t)));
if (violations.length) { console.error('KEEP-DISPLACEMENT VIOLATIONS:', violations); process.exit(1); }
console.log('guard: 0 KEEP slots displaced');

fs.writeFileSync('review/wiring-plan.json', JSON.stringify({ count: plan.length, plan }, null, 2));
console.log('wrote review/wiring-plan.json');

if (!APPLY) { console.log('\nDRY RUN — no files written. Re-run with --apply.'); process.exit(0); }

async function encode(src) {
  for (const width of WIDTH_LADDER) {
    for (const q of QUALITY_LADDER) {
      const buf = await sharp(src).resize({ width, height: Math.round(width * 16 / 9), fit: 'cover' })
        .webp({ quality: q }).toBuffer();
      if (buf.length <= TARGET_BYTES) return { buf, width, q };
    }
  }
  throw new Error(`cannot fit ${src} under ${TARGET_BYTES}`);
}

let written = 0, maxBytes = 0;
for (const item of plan) {
  const { buf, width, q } = await encode(item.src);
  maxBytes = Math.max(maxBytes, buf.length);
  for (const t of item.targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, buf);
    written++;
  }
  item.bytes = buf.length; item.width = width; item.quality = q;
}
console.log(`applied: ${plan.length} images -> ${written} slot files | largest ${maxBytes} bytes (budget ${MAX_BYTES})`);
fs.writeFileSync('review/wiring-plan.json', JSON.stringify({ count: plan.length, plan }, null, 2));
