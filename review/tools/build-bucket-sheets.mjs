// Contact sheets of every unique photograph in the rotation, in bucket order, for
// the 2026-09-23 bucket check (Job 3). Ten photographs a sheet, each labelled with
// its number, bucket, time of day and sha1-12, so a sheet can be judged at a glance
// and any number zoomed on later.
//
//   node review/tools/build-bucket-sheets.mjs
// Writes output/bucket-sheets/sheet-NN.png and review/bucket-check-photos.json
// (one row per photograph: n, sha1, sha256, bucket, time, every slot it fills).
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const bySha1 = new Map();
for (const f of FOLDERS) for (const t of TIMES) for (let w = 1; w <= 4; w++) for (let i = 1; i <= 7; i++) {
  const rel = `${f}/week_${w}/${t}/${i}.webp`;
  const bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', rel));
  const sha1 = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
  if (!bySha1.has(sha1)) bySha1.set(sha1, { sha1, sha256: createHash('sha256').update(bytes).digest('hex'), bucket: f, time: t, image: rel, slots: [] });
  bySha1.get(sha1).slots.push(rel);
}
const photos = [...bySha1.values()].map((p, k) => ({ n: k + 1, ...p }));
writeFileSync(path.join(root, 'review', 'bucket-check-photos.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: photos.length, photos }, null, 1));

const out = path.join(root, 'output', 'bucket-sheets');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1120 } });
const PER = 10;
for (let s = 0; s * PER < photos.length; s++) {
  const chunk = photos.slice(s * PER, s * PER + PER);
  const cells = chunk.map((p) => `<figure><img src="${pathToFileURL(path.join(root, 'assets', 'images', 'bg', p.image)).href}"><figcaption>#${p.n} ${p.bucket} · ${p.time} · ${p.sha1.slice(0, 6)}</figcaption></figure>`).join('');
  const htmlFile = path.join(out, `sheet-${String(s + 1).padStart(2, '0')}.html`);
  writeFileSync(htmlFile, `<!doctype html><style>body{margin:0;background:#111;color:#fff;font:bold 20px system-ui}main{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:6px}figure{margin:0}img{width:100%;aspect-ratio:9/16;object-fit:cover;display:block}figcaption{padding:3px 2px 6px;background:#000}</style><main>${cells}</main>`);
  await page.goto(pathToFileURL(htmlFile).href);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: path.join(out, `sheet-${String(s + 1).padStart(2, '0')}.png`), fullPage: true });
}
await browser.close();
console.log(`${photos.length} photographs, ${Math.ceil(photos.length / PER)} sheets → ${out}`);
