// Judge tasks for live lines (Part 2, step 10 — 2026-09-23): each blind back-translation beside the
// English its line is keyed to, judged by the shared rubric (JUDGE.md) — the same judge as the test
// sets, so the calibrated rule applies unchanged.
//
//   node scripts/translation-skills/make-live-judge.mjs --bt claude --label live-1 --backs a.json [b.json …]
//   node scripts/translation-skills/make-live-judge.mjs --bt claude --label live-1 --merge
//   backs: [{ k, back }] (Sol's result file, or the Claude outputs [{ id, back }]); a key is "<scan id>"
//          or "<scan id>-rs" / "-r1" … — the English comes from output/translation-skills/live/scan.json.
//   --merge adds every part's verdicts to output/translation-skills/live/judge-<bt>.json (by key).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const BT = val('--bt', 'claude'); const LABEL = val('--label', 'live');
const live = path.join(root, 'output', 'translation-skills', 'live');
const base = path.join(os.tmpdir(), 'pw-judge', `${LABEL}-${BT}`);
const target = path.join(live, `judge-${BT}.json`);

if (args.includes('--merge')) {
  const have = new Map(existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')).map((j) => [j.k, j]) : []);
  let n = 0;
  for (const p of readdirSync(base).sort()) {
    const f = path.join(base, p, 'output.json');
    if (!existsSync(f)) { console.error(`[live-judge] ${p}: no output.json`); process.exit(1); }
    for (const j of JSON.parse(readFileSync(f, 'utf8'))) { have.set(j.k, j); n += 1; }
  }
  writeFileSync(target, JSON.stringify([...have.values()], null, 1));
  console.log(`[live-judge] merged ${n} verdicts → live/judge-${BT}.json (${have.size} in all)`);
  process.exit(0);
}

const en = new Map(JSON.parse(readFileSync(path.join(live, 'scan.json'), 'utf8')).map((r) => [r.id, r.en]));
const files = [];
for (let i = args.indexOf('--backs') + 1; i > 0 && i < args.length && !args[i].startsWith('--'); i++) files.push(args[i]);
const items = [];
for (const f of files) for (const b of JSON.parse(readFileSync(path.resolve(f), 'utf8'))) {
  const k = b.k || b.id; const id = k.replace(/-(rs|r\d+)$/, '');
  if (!b.back || !en.has(id)) continue;
  items.push({ k, en: en.get(id), back: b.back });
}
let seed = BT === 'sol' ? 11 : 13;
const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
rmSync(base, { recursive: true, force: true });
const PER = Number(val('--per', 180));
for (let i = 0, p = 1; i < items.length; i += PER, p++) {
  const dir = path.join(base, `part-${p}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(items.slice(i, i + PER), null, 1));
  copyFileSync(path.join(root, 'scripts', 'translation-skills', 'JUDGE.md'), path.join(dir, 'JUDGE.md'));
  console.log(`[live-judge] ${LABEL}-${BT}/part-${p}: ${items.slice(i, i + PER).length} items → ${dir}`);
}
