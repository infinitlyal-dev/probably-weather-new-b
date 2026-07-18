// Phase 4 — wire the 19 approved reroll-wave-1 candidates into the source library.
// Approach (Al's ruling): lossless off-peak week-demote + day slot-swap.
//   - off-peak (dawn/dusk/night): each bin's 28 slots are week-paired bodies (pairs 1-3 & 2-4).
//     Overwrite the HIGHER-week copy of a paired body -> the body survives at its pair partner
//     (lossless), and the reroll gains a serving week. Never touches week_1/<t>/1 (fallback).
//   - day: slots are unique-per-body. Overwrite a slot (prefer an existing duplicate if any),
//     which REMOVES that body -> a reported swap.
// Encodes to webp <=290KiB (300 hard cap) via the wire-picks quality/width ladder.
// Flip-check: QA passes 1+2 confirmed all 36 rerolls subject-right -> 0 flips.
// Usage: node review/tools/wire-reroll.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const APPLY = process.argv.includes('--apply');
const REPO = path.resolve('.');
const BG = path.join(REPO, 'assets/images/bg');
const CAND = path.join(REPO, 'review/reroll-candidates');
const TARGET_BYTES = 290 * 1024;
const MAX_BYTES = 300 * 1024;
const QUALITY = [82, 78, 74, 70, 66, 62, 60];
const WIDTHS = [1008, 960, 900];
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const slotPath = (f, w, t, i) => path.join(BG, f, `week_${w}`, t, `${i}.webp`);
const slotKey = (f, w, t, i) => `${f}/week_${w}/${t}/${i}`;

// current library map
const bodyOf = new Map();          // slotKey -> hash
const bodyCount = new Map();        // hash -> occurrences
for (const f of FOLDERS) for (let w = 1; w <= 4; w++) for (const t of TIMES) for (let i = 1; i <= 7; i++) {
  const h = sha(fs.readFileSync(slotPath(f, w, t, i)));
  bodyOf.set(slotKey(f, w, t, i), h);
  bodyCount.set(h, (bodyCount.get(h) || 0) + 1);
}

async function encode(srcJpg) {
  for (const width of WIDTHS) for (const q of QUALITY) {
    const buf = await sharp(srcJpg).resize({ width, height: Math.round(width * 16 / 9), fit: 'cover' }).webp({ quality: q }).toBuffer();
    if (buf.length <= TARGET_BYTES) return { buf, width, q };
  }
  throw new Error(`cannot fit ${srcJpg} under ${TARGET_BYTES}`);
}

const rulings = JSON.parse(fs.readFileSync(path.join(REPO, 'review/reroll-wave-1-rulings.json'), 'utf8')).rulings;
const approved = rulings.filter((r) => r.verdict === 'A' || r.verdict === 'B');

// deterministic target picking, tracking slots already claimed this run
const claimed = new Set();
function pickTarget(folder, time) {
  const isDay = time === 'day';
  if (!isDay) {
    // off-peak: overwrite higher-week copy of a paired body. Prefer week 4 then 3; indices 1..7.
    for (const w of [4, 3]) for (let i = 1; i <= 7; i++) {
      const key = slotKey(folder, w, time, i);
      if (claimed.has(key)) continue;
      if (w === 1 && i === 1) continue; // never (defensive; w is 4/3 here anyway)
      const h = bodyOf.get(key);
      if ((bodyCount.get(h) || 0) >= 2) { claimed.add(key); return { key, folder, w, time, i, mode: 'off-peak week-demote', lossless: true, displaced: h }; }
    }
  } else {
    // day: prefer an existing duplicate slot (lossless); else replace week_4 top indices (reported swap).
    for (let i = 7; i >= 1; i--) for (const w of [4, 3, 2, 1]) {
      const key = slotKey(folder, w, time, i);
      if (claimed.has(key)) continue;
      if (w === 1 && i === 1) continue;
      const h = bodyOf.get(key);
      if ((bodyCount.get(h) || 0) >= 2) { claimed.add(key); return { key, folder, w, time, i, mode: 'day swap (into duplicate)', lossless: true, displaced: h }; }
    }
    for (let i = 7; i >= 1; i--) for (const w of [4, 3, 2, 1]) {
      const key = slotKey(folder, w, time, i);
      if (claimed.has(key)) continue;
      if (w === 1 && i === 1) continue;
      claimed.add(key); return { key, folder, w, time, i, mode: 'day swap (removes a unique image)', lossless: false, displaced: bodyOf.get(key) };
    }
  }
  throw new Error(`no target for ${folder}/${time}`);
}

const plan = [];
for (const r of approved) {
  const src = path.join(CAND, `${r.id}_${r.verdict}.jpg`);
  if (!fs.existsSync(src)) throw new Error(`missing candidate ${src}`);
  const { buf, width, q } = await encode(src);
  const t = pickTarget(r.condition, r.bin);
  plan.push({ id: r.id, verdict: r.verdict, condition: r.condition, bin: r.bin, target: t.key, mode: t.mode, lossless: t.lossless, bytes: buf.length, width, quality: q, newHash: sha(buf), _buf: buf, _displacedHash: t.displaced });
}

// simulate resulting unique-body count
const simCount = new Map(bodyCount);
for (const p of plan) {
  simCount.set(p._displacedHash, (simCount.get(p._displacedHash) || 0) - 1);
  simCount.set(p.newHash, (simCount.get(p.newHash) || 0) + 1);
}
const newUnique = [...simCount.entries()].filter(([, c]) => c > 0).length;

console.log(`\n=== wire-reroll plan (${plan.length} approved) ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
let over = 0, lossy = 0;
for (const p of plan) {
  if (p.bytes > MAX_BYTES) over++;
  if (!p.lossless) lossy++;
  console.log(`${p.id}(${p.verdict}) -> ${p.target}  [${p.mode}] ${p.bytes}b w${p.width}q${p.quality}${p.lossless ? '' : '  << REMOVES existing image'}`);
}
console.log(`\nbudget: ${over} over 300KiB (max ${Math.max(...plan.map((p) => p.bytes))}b) | lossy day-swaps: ${lossy}`);
console.log(`manifest unique bodies: 629 -> ${newUnique} (${newUnique - 629 >= 0 ? '+' : ''}${newUnique - 629})`);
if (over) { console.error('ABORT: candidate over 300KiB budget'); process.exit(1); }

fs.writeFileSync(path.join(REPO, 'review/reroll-wiring-plan.json'), JSON.stringify({ approved: plan.length, newUnique, plan: plan.map(({ _buf, _displacedHash, ...p }) => ({ ...p, displacedBody: _displacedHash.slice(0, 12) })) }, null, 2));
console.log('wrote review/reroll-wiring-plan.json');

if (!APPLY) { console.log('\nDRY-RUN — no files written. Re-run with --apply.'); process.exit(0); }
for (const p of plan) {
  const fp = path.join(BG, ...p.target.split('/')) + '.webp';
  fs.writeFileSync(fp, p._buf);
}
console.log(`\nAPPLIED: wrote ${plan.length} reroll webps into source slots.`);
