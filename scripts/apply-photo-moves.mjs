// Move photographs to the bucket Al ruled for them (2026-09-23):
//   review/cold-move-ruled.json    the dog in the grey jumper, cloudy -> cold, slots named
//   review/bucket-check-ruled.json the MOVE rows: #66, #69, #70, #40 -> cold; #90 -> cold-clear;
//                                  #79 -> rain. KEEP rows are not touched.
//
// THE METHOD (Al's brief, in his words): "in the destination folder, take weeks 2 and 4 of a
// slot at the same time of day, keep the existing photo on weeks 1 and 3, and bench the photo
// from its old slots with the week-collapse fallback. Never put two moved photos on the same
// slot. Crop anchors travel with the photo. Its lines travel too — any line that isn't true of
// the new condition is held back (not served) and listed."
//
//   - The slot keeps the photograph's weekday (its index), so a line that names the day stays
//     true. The dog's slots are the ones Al ruled on its page.
//   - A destination whose weeks 2 and 4 hold a photograph found nowhere else is REFUSED, not
//     taken: the method assumes weeks 2 and 4 repeat weeks 1 and 3, and taking them would push
//     a curated photograph out of rotation without a ruling. Every rain-day slot is like that,
//     so #79 is benched from cold and waits for Al to name its rain slot
//     (output/photo-moves/79-rain-slot-choice.png).
//   - Benching is slot-scoped (review/benched-photos.json `slots`): the photograph leaves its
//     old slots and is served in its new ones. Each entry names its `fallback`: the
//     week-collapse slot (week_1 slot 1 of the same folder and time), unless a line on that
//     photograph names a weekday — it would then be served on another day — in which case the
//     next slot in the same order that has none.
//   - Anchors are keyed by photograph (review/set-001-crop-*.json), so they follow the slot map:
//     the crop tables are regenerated from it and checked at the new slots.
//   - Lines are keyed by photograph too. The ones no longer true in the new bucket are listed
//     in HOLD with the reason, taken off the photograph and recorded in final.json `heldBack`.
//
//   node scripts/apply-photo-moves.mjs [--dry]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const BG = (rel) => path.join(root, 'assets', 'images', 'bg', ...rel.split('/'));
const DRY = process.argv.includes('--dry');
const TODAY = new Date().toISOString().slice(0, 10);
let bust = 0;
const fresh = async (rel) => import(`${pathToFileURL(path.join(root, rel)).href}?v=${Date.now()}-${bust++}`);
const node = (...a) => execFileSync(process.execPath, a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sha1Of = (rel) => createHash('sha1').update(readFileSync(BG(rel))).digest('hex').slice(0, 12);
const sha256Of = (rel) => createHash('sha256').update(readFileSync(BG(rel))).digest('hex');
const slotOf = (rel) => { const [folder, week, time, file] = rel.split('/'); return { folder, week: Number(week.slice(5)), time, n: Number(file.replace('.webp', '')) }; };
const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|maandag|dinsdag|woensdag|donderdag|vrydag|saterdag|sondag)\b/i;

// Lines that are not true of the new bucket, judged against the photograph and against what
// the hero serves there (api/weather.js deriveCondition, now ladder): `cold` is a chilly,
// dry hour under some cloud (not overcast, rain chance under 30%), snow/sleet, or frost;
// `cold-clear` is cold under a clear, dry sky; `rain` is rain actually falling, any season.
const HOLD = {
  c6d4061cbef2: {
    'Overcast at night keeps the warmth in, and somebody is out here using it.':
      'cold: the hero says it is cold; the line says the night is warm enough to sit out in',
  },
  d003110fec9f: {
    'The washing is not going to dry. We hang it up for hope.':
      'cold-clear is a dry, clear-sky day (cloud under 30%, rain chance under 20%): the washing dries',
  },
  '77dad643efa6': {
    'Time to dig out that ugly beanie.':
      'rain is not always cold: the rain folder is served on warm summer rain too',
  },
};

const bucket = JSON.parse(readFileSync(R('bucket-check-ruled.json'), 'utf8'));
const dogRuling = JSON.parse(readFileSync(R('cold-move-ruled.json'), 'utf8'));
const draft = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const benchDoc = JSON.parse(readFileSync(R('benched-photos.json'), 'utf8'));
const anchors = JSON.parse(readFileSync(R('set-001-crop-anchors.json'), 'utf8')).anchors;
const AF0 = await fresh('assets/hero-lines-af.js');

// ---- 1. the rulings, checked against the tree -------------------------------------
const problems = [];
if (dogRuling.verdict !== 'YES') problems.push(`cold-move-ruled.json verdict is ${dogRuling.verdict}, not YES`);
const moves = bucket.rows.filter((r) => r.verdict === 'MOVE');
const keeps = bucket.rows.filter((r) => r.verdict === 'KEEP');
if (moves.length !== 7) problems.push(`expected 7 MOVE rows, found ${moves.length}`);
if (!moves.some((r) => r.sha1 === dogRuling.photo.sha1)) problems.push('the dog is not a MOVE row of the bucket check');
for (const r of bucket.rows) if (!['MOVE', 'KEEP'].includes(r.verdict)) problems.push(`#${r.n}: verdict ${r.verdict}`);

// Where every photograph lives now: sha1 -> slots.
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const slotsOfPhoto = new Map();
for (const f of FOLDERS) for (let w = 1; w <= 4; w++) for (const t of TIMES) for (let i = 1; i <= 7; i++) {
  const rel = `${f}/week_${w}/${t}/${i}.webp`;
  const h = sha1Of(rel);
  if (!slotsOfPhoto.has(h)) slotsOfPhoto.set(h, []);
  slotsOfPhoto.get(h).push(rel);
}

const plan = [];
for (const r of moves) {
  for (const s of r.slots) if (sha1Of(s) !== r.sha1) problems.push(`#${r.n}: ${s} no longer holds ${r.sha1}`);
  const olds = r.slots.map(slotOf);
  const n = olds[0].n;
  if (olds.some((o) => o.n !== n || o.time !== r.time || o.folder !== r.bucket)) { problems.push(`#${r.n}: its slots do not share one folder, time and weekday`); continue; }
  const dest = r.sha1 === dogRuling.photo.sha1
    ? dogRuling.proposedTo
    : [2, 4].map((w) => `${r.moveTo}/week_${w}/${r.time}/${n}.webp`);
  const d = slotOf(dest[0]);
  if (d.folder !== r.moveTo || d.time !== r.time || dest.length !== 2) problems.push(`#${r.n}: destination ${dest.join(' + ')} is not weeks 2 and 4 of one ${r.moveTo} ${r.time} slot`);
  const wk = (w) => `${d.folder}/week_${w}/${d.time}/${d.n}.webp`;
  const displaced = sha1Of(wk(2));
  if (sha1Of(wk(4)) !== displaced) problems.push(`#${r.n}: weeks 2 and 4 of ${wk(2)} hold different photographs`);
  // Weeks 2 and 4 may only be taken if the photograph there lives on somewhere else.
  const elsewhere = (slotsOfPhoto.get(displaced) || []).filter((s) => s !== wk(2) && s !== wk(4));
  const lostWeekdays = [1, 2, 3, 4, 5, 6, 7].filter((i) => {
    const h = sha1Of(`${d.folder}/week_2/${d.time}/${i}.webp`);
    return !(slotsOfPhoto.get(h) || []).some((s) => !s.startsWith(`${d.folder}/week_2/${d.time}/${i}.`) && !s.startsWith(`${d.folder}/week_4/${d.time}/${i}.`));
  });
  plan.push({
    row: r, n, dest, keepsSlots: [wk(1), wk(3)], stayingPhoto: sha1Of(wk(1)), displaced,
    refused: elsewhere.length ? null
      : lostWeekdays.length === 7
        ? `weeks 2 and 4 of every ${d.folder} ${d.time} slot hold a photograph found nowhere else, so any slot would push one out of rotation — Al names the slot (output/photo-moves/79-rain-slot-choice.png)`
        : `weeks 2 and 4 of ${d.folder} ${d.time} weekday ${d.n} hold ${displaced}, found nowhere else — Al rules`,
  });
}
const placed = plan.filter((p) => !p.refused);
const allOld = new Set(plan.flatMap((p) => p.row.slots));
const destSeen = new Map();
for (const p of placed) for (const s of p.dest) {
  if (destSeen.has(s)) problems.push(`two moved photographs on ${s}: ${destSeen.get(s)} and ${p.row.sha1}`);
  destSeen.set(s, p.row.sha1);
  if (allOld.has(s)) problems.push(`${s} is both a destination and a slot a photograph is leaving`);
}
for (const [hash, lines] of Object.entries(HOLD)) {
  const e = authoring.set.find((x) => x.hash === hash);
  for (const l of Object.keys(lines)) if (!e?.lines.includes(l)) problems.push(`HOLD names "${l}", which is not on ${hash}`);
}
if (problems.length) {
  console.error('[moves] refusing:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// ---- 2. what each photograph keeps and holds back ----------------------------------
const byHash = new Map(authoring.set.map((e) => [e.hash, e]));
const heldBack = [];
const nextLines = new Map();
for (const p of placed) {
  const e = byHash.get(p.row.sha1);
  const hold = HOLD[p.row.sha1] || {};
  nextLines.set(p.row.sha1, e.lines.filter((l) => !hold[l]));
  for (const l of e.lines) if (hold[l]) heldBack.push({ hash: p.row.sha1, line: l, af: AF0.heroLineAf(l) || null, from: p.row.bucket, to: p.row.moveTo, reason: hold[l], on: TODAY });
  if (!nextLines.get(p.row.sha1).length) problems.push(`${p.row.sha1}: every line held back — refusing to leave it bare silently`);
}

// ---- 3. the fallback each old slot serves ------------------------------------------
const liveLinesOf = (hash) => nextLines.get(hash) || byHash.get(hash)?.lines || [];
const namesWeekday = (hash) => liveLinesOf(hash).find((l) => WEEKDAY.test(l) || WEEKDAY.test(AF0.heroLineAf(l) || ''));
const existingEverywhere = new Set((benchDoc.benched || []).filter((b) => !(Array.isArray(b.slots) && b.slots.length)).map((b) => b.sha256));
function fallbackFor(folder, time) {
  const skipped = [];
  for (let w = 1; w <= 4; w++) for (let i = 1; i <= 7; i++) {
    const rel = `${folder}/week_${w}/${time}/${i}.webp`;
    if (allOld.has(rel) || existingEverywhere.has(sha256Of(rel))) continue;
    const h = sha1Of(rel);
    const said = namesWeekday(h);
    if (said) { skipped.push({ slot: rel, hash: h, line: said }); continue; }
    return { fallback: rel, hash: h, skipped };
  }
  return { fallback: null, skipped };
}
for (const p of plan) {
  const { folder, time } = slotOf(p.row.slots[0]);
  Object.assign(p, fallbackFor(folder, time));
  if (!p.fallback) problems.push(`#${p.row.n}: no slot in ${folder} ${time} can stand in for it`);
}
if (problems.length) {
  console.error('[moves] refusing:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

for (const p of plan) {
  const r = p.row;
  console.log(`[moves] #${r.n} ${r.sha1} ${r.bucket} ${r.time} (${r.slots.length} slots, weekday ${p.n}) -> ${p.refused ? `NOT PLACED: ${p.refused}` : `${p.dest.join(' + ')}  (${p.stayingPhoto} keeps ${p.keepsSlots.join(' + ')})`}`);
  console.log(`         old slots serve ${p.fallback} (${p.hash})${p.skipped.length ? ` — skipped ${p.skipped.map((s) => `${s.slot} ("${s.line}")`).join(', ')}` : ''}`);
  for (const h of heldBack.filter((x) => x.hash === r.sha1)) console.log(`         HOLD "${h.line}" — ${h.reason}`);
}
for (const k of keeps) console.log(`[moves] #${k.n} ${k.sha1} KEEP — not touched`);
if (DRY) { console.log('[moves] --dry: nothing written'); process.exit(0); }

// ---- 4. the photographs into their new slots ---------------------------------------
for (const p of placed) {
  for (const s of p.dest) {
    copyFileSync(BG(p.row.slots[0]), BG(s));
    if (sha1Of(s) !== p.row.sha1) { console.error(`[moves] ${s} did not take ${p.row.sha1}`); process.exit(1); }
  }
}

// ---- 5. the slot map (set-001-draft.json) ------------------------------------------
for (const p of placed) {
  const moved = draft.assignments.find((a) => a.hash === p.row.sha1);
  const staying = draft.assignments.find((a) => a.hash === p.stayingPhoto);
  if (!moved || !staying) { console.error(`[moves] ${p.row.sha1} or ${p.stayingPhoto} is missing from the draft`); process.exit(1); }
  Object.assign(moved, {
    condition: p.row.moveTo, week: 'B', image: p.dest[0], paths: [...p.dest],
    previousImage: p.row.slots[0], movedFrom: [...p.row.slots], movedOn: TODAY,
    movedBy: p.row.sha1 === dogRuling.photo.sha1 ? 'review/cold-move-ruled.json' : 'review/bucket-check-ruled.json',
  });
  staying.paths = (staying.paths || []).filter((s) => !p.dest.includes(s));
  if (p.dest.includes(staying.image)) staying.image = staying.paths[0];
}
draft.note += ` | ${TODAY}: ${placed.length} photographs moved by Al's rulings (review/cold-move-ruled.json, review/bucket-check-ruled.json) — each takes weeks 2+4 of its own weekday in the new bucket, the photograph there keeps weeks 1+3; \`movedFrom\` names the slots it left, which are benched (review/benched-photos.json) and still hold its bytes on disk.`;
writeFileSync(R('set-001-draft.json'), JSON.stringify(draft, null, 1));

// ---- 6. the lines (set-001-lines-bespoke-final.json) -------------------------------
for (const p of placed) {
  const e = byHash.get(p.row.sha1);
  e.condition = p.row.moveTo;
  e.lines = nextLines.get(p.row.sha1);
}
authoring.heldBack = [...(authoring.heldBack || []), ...heldBack];
authoring.lineCount = authoring.set.reduce((n, e) => n + e.lines.length, 0);
authoring.photoMoves = { on: TODAY, rulings: ['review/cold-move-ruled.json', 'review/bucket-check-ruled.json'], moved: placed.map((p) => p.row.sha1), notPlaced: plan.filter((p) => p.refused).map((p) => p.row.sha1), heldBack: heldBack.length };
writeFileSync(R('set-001-lines-bespoke-final.json'), JSON.stringify(authoring, null, 1));

// ---- 7. the bench (review/benched-photos.json) -------------------------------------
const mine = new Set(plan.map((p) => p.row.sha1));
const others = (benchDoc.benched || []).filter((b) => !mine.has(b.sha1));
const previous = new Map((benchDoc.benched || []).map((b) => [b.sha1, b]));
benchDoc.note = 'Photographs taken out of slots without deleting a file. An entry with `slots` is benched from those slots only — a moved photograph is benched from its old bucket and served in its new one (`movedTo`). scripts/image-slot-manifest.mjs serves each benched slot its `fallback`: the week-collapse slot (week_1 slot 1 of the same folder and time) unless a line on that photograph names a weekday, then the next slot in the same order with none (`fallbackSkipped`). An entry without `slots` is benched everywhere its bytes are. Only the built site is affected; an unbuilt local preview still reads the files. To un-bench, delete the entry.';
benchDoc.benched = [...others, ...plan.map((p) => ({
  sha1: p.row.sha1,
  sha256: sha256Of(p.row.slots[0]),
  slots: [...p.row.slots],
  fallback: p.fallback,
  ...(p.skipped.length ? { fallbackSkipped: p.skipped.map((s) => `${s.slot}: "${s.line}" names a weekday`) } : {}),
  movedTo: p.refused ? null : [...p.dest],
  ...(p.refused ? { pending: p.refused } : {}),
  reason: p.row.wrong,
  benchedOn: previous.get(p.row.sha1)?.benchedOn || TODAY,
  ruling: p.row.sha1 === dogRuling.photo.sha1 ? 'review/cold-move-ruled.json' : 'review/bucket-check-ruled.json',
}))];
writeFileSync(R('benched-photos.json'), JSON.stringify(benchDoc, null, 1));
console.log(`[moves] wrote the photographs, set-001-draft.json, set-001-lines-bespoke-final.json and benched-photos.json`);

// ---- 8. regenerate what derives from the slot map ----------------------------------
process.stdout.write(node('scripts/sync-authoring-slots.mjs'));
process.stdout.write(node('scripts/build-hero-lines.mjs'));
process.stdout.write(node('scripts/build-hero-crop-offsets.mjs'));
process.stdout.write(node('scripts/build-hero-crop-desktop.mjs'));
process.stdout.write(node('scripts/lang-check/apply-af-accepted.mjs', '--decisions', 'review/af-al-decisions.json'));

// ---- 9. verify ---------------------------------------------------------------------
const HL = await fresh('assets/hero-lines.js');
const CROP = await fresh('assets/hero-crop.js');
const { scanBackgroundSlots } = await fresh('scripts/image-slot-manifest.mjs');
const scan = scanBackgroundSlots(path.join(root, 'assets', 'images', 'bg'));
const servedAt = new Map(scan.entries.map((e) => [e.relativePath, e.servedPath.replace(/\\/g, '/').split('/assets/images/bg/')[1]]));
const fails = [];
const same = (a, b, what) => { if (!isDeepStrictEqual(a, b)) fails.push(`${what}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };
for (const p of plan) {
  const canon = `bg-canonical/${sha256Of(p.row.slots[0])}.webp`;
  for (const s of p.row.slots) {
    if (servedAt.get(s) !== p.fallback) fails.push(`${s} serves ${servedAt.get(s)}, not its fallback ${p.fallback}`);
  }
  if (p.refused) continue;
  const lines = nextLines.get(p.row.sha1);
  const src = (key) => `assets/images/${key}`;
  const anchor = anchors[p.row.sha1]?.anchorY ?? null;
  for (const s of p.dest) {
    if (servedAt.get(s) !== s) fails.push(`${s} is not served as itself`);
    same(HL.HERO_LINES[`bg/${s}`], lines, `lines at ${s}`);
    same(CROP.heroCropFor(src(`bg/${s}`)), CROP.heroCropFor(src(canon)), `phone crop at ${s}`);
    same(CROP.heroCropDesktopFor(src(`bg/${s}`)), anchor, `desktop crop at ${s} (Al's anchor)`);
  }
  same(CROP.heroCropDesktopFor(src(canon)), anchor, `desktop crop on ${p.row.sha1} (Al's anchor)`);
  same(HL.HERO_LINES[canon], lines, `lines on ${p.row.sha1} (production key)`);
  for (const s of p.keepsSlots) if (servedAt.get(s) !== s || sha1Of(s) !== p.stayingPhoto) fails.push(`${s} lost ${p.stayingPhoto}`);
  for (const h of heldBack.filter((x) => x.hash === p.row.sha1)) if (HL.HERO_LINES[canon].includes(h.line)) fails.push(`held line still served: ${h.line}`);
}
if (fails.length) {
  console.error('[moves] VERIFY FAILED — restore with git before anything else:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`[moves] verified: ${placed.length} photographs served in their new slots with their lines and crops, ${plan.length} benched from their old slots onto their fallbacks, ${heldBack.length} line(s) held back, ${plan.length - placed.length} waiting for Al`);
