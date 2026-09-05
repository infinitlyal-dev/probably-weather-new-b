// Ingest Astra's six bucket reviews as Al's ruled exports (his instruction, 2026-09-05).
//
// Al's terms, in effect:
//   - KEEP and FIX enter the pool as kept; FIX uses the fixed wording.
//   - The 444 KILLs are NOT recorded as rejected. They are held as `unruled` so nothing
//     downstream treats them as struck, and Al can still rule them from the gallery page.
//   - The new-lines CSVs enter as bespoke lines tagged with photo id and time slot.
//
// photo_id is the review page's 1-based index for that bucket; the join is verified here
// and the script throws rather than guessing. Astra's time_of_day is its own visual reading
// (it uses "evening"/"midday"), so it is carried as astraTime and never overwrites the
// photograph's real rotation slot.
//
//   node scripts/ingest-astra-rulings.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DL = 'C:/Users/27741/Downloads';
const BUCKETS = ['cold', 'cold-clear', 'fog', 'rain', 'storm', 'heat'];
const NEWLINES_FILE = (b) => `astra-${b}-newlines${b === 'cold' ? '-v2' : ''}.csv`;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function parseCSV(text) {
  const t = text.replace(/^\uFEFF/, '');
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const totals = { kept: 0, unruled: 0, newLines: 0 };

for (const bucket of BUCKETS) {
  const srcPath = `review/set-001-lines-bespoke-${bucket}-v3.json`;
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, srcPath), 'utf8'));
  const byId = new Map(src.images.map((i) => [String(i.index).padStart(2, '0'), i]));

  const review = parseCSV(fs.readFileSync(path.join(DL, `astra-${bucket}-review.csv`), 'utf8'));
  const fresh = parseCSV(fs.readFileSync(path.join(DL, NEWLINES_FILE(bucket)), 'utf8'));

  const unknown = [...review, ...fresh].map((r) => r.photo_id).filter((id) => !byId.has(id));
  if (unknown.length) throw new Error(`${bucket}: photo_id not on the review page: ${[...new Set(unknown)].join(', ')}`);

  const kept = new Map();
  const unruled = new Map();
  const push = (map, id, entry) => { if (!map.has(id)) map.set(id, []); map.get(id).push(entry); };

  for (const r of review) {
    const verdict = norm(r.verdict).toUpperCase();
    const candidate = norm(r.candidate_line);
    const image = byId.get(r.photo_id);
    const known = [...(image.lines || []), ...(image.alreadyKept || [])].map(norm);
    if (!known.includes(candidate)) throw new Error(`${bucket}/${r.photo_id}: candidate not in the v3 source: ${candidate}`);

    if (verdict === 'KEEP') {
      push(kept, r.photo_id, {
        text: candidate, source: 'astra-keep', astraTime: norm(r.time_of_day), score: Number(r.score) || null,
      });
    } else if (verdict === 'FIX') {
      const fixed = norm(r.fixed_line);
      if (!fixed || fixed === '\u2014') throw new Error(`${bucket}/${r.photo_id}: FIX with no fixed_line: ${candidate}`);
      push(kept, r.photo_id, {
        text: fixed, source: 'astra-fix', astraTime: norm(r.time_of_day), score: Number(r.score) || null, fixedFrom: candidate,
      });
    } else if (verdict === 'KILL') {
      // Held, not struck. Al's instruction: do not record these as rejected.
      push(unruled, r.photo_id, {
        text: candidate, astraVerdict: 'KILL', score: Number(r.score) || null,
        reason: norm(r.reason), astraTime: norm(r.time_of_day),
      });
    } else {
      throw new Error(`${bucket}/${r.photo_id}: unknown verdict ${JSON.stringify(r.verdict)}`);
    }
  }

  for (const r of fresh) {
    const text = norm(r.line);
    if (!text) continue;
    push(kept, r.photo_id, { text, source: 'astra-new', astraTime: norm(r.time_slot) });
    totals.newLines += 1;
  }

  const images = src.images.map((image) => {
    const id = String(image.index).padStart(2, '0');
    return {
      image: image.image,
      hash: image.hash,
      condition: image.condition,
      time: image.time,
      week: image.week,
      day: image.day,
      paths: image.paths,
      photoId: id,
      kept: kept.get(id) || [],
      rejected: [],
      unruled: unruled.get(id) || [],
    };
  });

  const out = {
    generated: '2026-09-05',
    ruledBy: "Astra editorial review, adopted as Al's ruling (his instruction, 2026-09-05; veto list: none)",
    bucket,
    note: 'KEEP and FIX (fixed wording) are kept. KILL is held as `unruled`, NOT rejected — Al ruled that '
      + 'explicitly, so no downstream step may treat a KILL as struck. New-lines CSV rows are kept with '
      + "source astra-new. astraTime is Astra's own visual reading of the hour and does not override the "
      + "photograph's rotation slot.",
    supersedes: srcPath,
    images,
    keptCount: images.reduce((n, i) => n + i.kept.length, 0),
    unruledCount: images.reduce((n, i) => n + i.unruled.length, 0),
    imagesWithNone: images.filter((i) => !i.kept.length).map((i) => i.image),
  };
  const outPath = `review/set-001-lines-bespoke-${bucket}-v3-astra-ruled.json`;
  fs.writeFileSync(path.join(ROOT, outPath), JSON.stringify(out, null, 1));
  totals.kept += out.keptCount;
  totals.unruled += out.unruledCount;
  console.log(`${bucket.padEnd(11)} kept ${String(out.keptCount).padStart(3)}  held-unruled ${String(out.unruledCount).padStart(3)}  bare images ${out.imagesWithNone.length}  -> ${outPath}`);
}

console.log(`TOTAL       kept ${totals.kept} (of which ${totals.newLines} new)  held-unruled ${totals.unruled}  rejected 0`);
