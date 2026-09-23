// Judge tasks for a translation run (2026-09-23): each blind back-translation beside its English.
//
//   node scripts/translation-skills/make-judge-task.mjs --label baseline --bt claude   (from %TEMP%/pw-bt/<label>/<lang>/output.json)
//   node scripts/translation-skills/make-judge-task.mjs --label baseline --bt sol      (from output/translation-skills/<label>/sol-bt.json)
//   node scripts/translation-skills/make-judge-task.mjs --label baseline --bt claude --merge
//
// Writes %TEMP%/pw-judge/<label>-<bt>/<part>/{input.json,TASK.md} with JUDGE.md copied in; the judge
// sees English + back-translation only. --merge gathers every part's output.json into
// output/translation-skills/<label>/judge-<bt>.json. Prints counts only.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LABEL = val('--label', 'baseline'); const BT = val('--bt', 'claude'); const SPLIT = val('--split', 'test');
const PER = Number(val('--per', 160));
const here = path.join(root, 'scripts', 'translation-skills');
const out = path.join(root, 'output', 'translation-skills', LABEL);
const base = path.join(os.tmpdir(), 'pw-judge', `${LABEL}-${BT}`);

if (args.includes('--merge')) {
  const all = [];
  for (const p of readdirSync(base).sort()) {
    const f = path.join(base, p, 'output.json');
    if (!existsSync(f)) { console.error(`[judge] ${p}: no output.json`); process.exit(1); }
    all.push(...JSON.parse(readFileSync(f, 'utf8')));
  }
  writeFileSync(path.join(out, `judge-${BT}.json`), JSON.stringify(all, null, 1));
  const v = all.reduce((m, j) => (m[j.verdict] = (m[j.verdict] || 0) + 1, m), {});
  console.log(`[judge] merged ${all.length} verdicts → output/translation-skills/${LABEL}/judge-${BT}.json ${JSON.stringify(v)}`);
  process.exit(0);
}

const lock = JSON.parse(readFileSync(path.join(here, 'gold', 'LOCK.json'), 'utf8'));
const en = new Map();
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const body = readFileSync(path.join(here, 'gold', `${lang}-${SPLIT}.json`), 'utf8');
  if (SPLIT === 'test' && createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) { console.error(`[judge] ${lang}-test.json breaks its seal`); process.exit(1); }
  for (const g of JSON.parse(body).items) en.set(g.id, g.en);
}
let backs = [];
if (BT === 'sol') backs = JSON.parse(readFileSync(path.join(out, 'sol-bt.json'), 'utf8')).map((s) => ({ k: s.k, back: s.back }));
else for (const lang of ['af', 'zu', 'xh', 'st']) {
  const f = path.join(os.tmpdir(), 'pw-bt', LABEL, lang, 'output.json');
  if (!existsSync(f)) { console.error(`[judge] no Claude back-translation for ${lang} yet`); process.exit(1); }
  backs.push(...JSON.parse(readFileSync(f, 'utf8')).map((b) => ({ k: b.id, back: b.back })));
}
const items = backs.filter((b) => b.back && en.has(b.k)).map((b) => ({ k: b.k, en: en.get(b.k), back: b.back }));
// shuffle so a judge cannot read language or order into a verdict
let seed = BT === 'sol' ? 7 : 5;
const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
rmSync(base, { recursive: true, force: true });
for (let i = 0, p = 1; i < items.length; i += PER, p++) {
  const dir = path.join(base, `part-${p}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(items.slice(i, i + PER), null, 1));
  copyFileSync(path.join(here, 'JUDGE.md'), path.join(dir, 'JUDGE.md'));
  console.log(`[judge] ${LABEL}-${BT}/part-${p}: ${items.slice(i, i + PER).length} items → ${dir}`);
}
