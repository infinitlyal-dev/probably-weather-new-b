// Desktop polaroid crops (2026-09-23): write assets/hero-crop.js's
// HERO_CROP_DESKTOP_OVERRIDES so that every photograph in the tree resolves, on the
// desktop, to exactly the anchor Al ruled in review/set-001-crop-anchors.json — or to
// the desktop CSS default (null) where he ruled none.
//
// The phone table (HERO_CROP_OFFSETS, scripts/build-hero-crop-offsets.mjs) already
// carries most of those anchors under both key shapes. Only the photographs whose
// desktop answer differs from the phone table are written here, under both key shapes
// the picker can emit: bg/<slot path> (source tree) and bg-canonical/<sha256>.webp
// (production).
//
//   node scripts/build-hero-crop-desktop.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];

const anchors = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-crop-anchors.json'), 'utf8')).anchors;
const modulePath = path.join(root, 'assets', 'hero-crop.js');
const { HERO_CROP_OFFSETS } = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);

const photos = new Map(); // sha1-12 -> { sha256, paths }
for (const f of FOLDERS) for (let w = 1; w <= 4; w++) for (const t of TIMES) for (let i = 1; i <= 7; i++) {
  const rel = `${f}/week_${w}/${t}/${i}.webp`;
  const bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', rel));
  const sha1 = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
  if (!photos.has(sha1)) photos.set(sha1, { sha256: createHash('sha256').update(bytes).digest('hex'), paths: [] });
  photos.get(sha1).paths.push(rel);
}

const problems = [];
for (const [sha1, a] of Object.entries(anchors)) {
  if (!photos.has(sha1)) continue; // a ruling about a photograph no longer in the tree
  if (typeof a.anchorY !== 'number' || !Number.isFinite(a.anchorY) || a.anchorY < 0 || a.anchorY > 100) problems.push(`${sha1}: anchorY ${JSON.stringify(a.anchorY)} is not a percentage`);
}
if (problems.length) { console.error('[hero-crop-desktop] refusing to generate:'); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }

const rows = [];
let ruled = 0, unruled = 0, fromPhone = 0;
for (const [sha1, p] of photos) {
  const want = anchors[sha1] ? anchors[sha1].anchorY : null;
  if (want === null) unruled++; else ruled++;
  const keys = [`bg-canonical/${p.sha256}.webp`, ...p.paths.map((rel) => `bg/${rel}`)];
  const differs = keys.some((k) => (HERO_CROP_OFFSETS[k] ?? null) !== want);
  if (!differs) { fromPhone++; continue; }
  for (const k of keys) rows.push([k, want]);
}
rows.sort((x, y) => x[0].localeCompare(y[0]));
const body = rows.map(([k, v]) => `  ${JSON.stringify(k)}: ${v === null ? 'null' : v},`).join('\n');
const generated = `  // __HERO_CROP_DESKTOP__  (generated — do not hand-edit)\n${body}${body ? '\n' : ''}`;

const src = readFileSync(modulePath, 'utf8');
const BLOCK = /( *\/\/ __HERO_CROP_DESKTOP__[^\n]*\n)(?:[^}]*)/;
if (!BLOCK.test(src)) { console.error('[hero-crop-desktop] generated block marker missing from assets/hero-crop.js'); process.exit(1); }
const next = src.replace(BLOCK, generated);
const summary = `${photos.size} photographs: ${ruled} with a ruled anchor, ${unruled} without (desktop default); ${fromPhone} read the phone table as-is, ${photos.size - fromPhone} overridden (${rows.length} keys).`;
if (CHECK) {
  if (next !== src) { console.error('[hero-crop-desktop] assets/hero-crop.js is out of sync with review/set-001-crop-anchors.json — run node scripts/build-hero-crop-desktop.mjs'); process.exit(1); }
  console.log(`[hero-crop-desktop] in sync — ${summary}`);
} else {
  writeFileSync(modulePath, next, 'utf8');
  console.log(`[hero-crop-desktop] wrote — ${summary}`);
}
