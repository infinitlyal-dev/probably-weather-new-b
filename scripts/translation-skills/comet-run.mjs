// Checker (c): the automatic scorers over a translation run (Part 2 — 2026-09-23).
//
// Al's ruling: SSA-COMET for isiZulu only, AfriCOMET for isiXhosa only; neither for Sesotho or
// Afrikaans. Both run on CPU from an isolated venv outside the repo (PW_COMET_HOME, default
// C:\Users\27741\pw-comet — see comet/fetch_verify.py and comet/score.py; every load re-checks the
// checkpoint against the SHA-256 Hugging Face publishes).
//
//   run mode (gold sets):  node scripts/translation-skills/comet-run.mjs --label baseline [--split test]
//     isiZulu:  SSA-COMET with the human reference (zu-ref) and without it (zu-qe)
//     isiXhosa: AfriCOMET with the human reference (xh-ref) — it is reference-based only
//     -> output/translation-skills/<label>/comet.json [{ id, lang, mode, score }]; prints aggregates only
//        (the test sets are sealed: nothing but ids and numbers is written)
//   live mode:             node scripts/translation-skills/comet-run.mjs --live items.json --out scores.json
//     items.json: [{ id, lang: "zu", en, text }] — SSA-COMET without a reference (live lines have none)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = path.join(root, 'scripts', 'translation-skills');
const HOME = process.env.PW_COMET_HOME || 'C:\\Users\\27741\\pw-comet';
const PY = path.join(HOME, '.venv', 'Scripts', 'python.exe');
const SCORE = path.join(here, 'comet', 'score.py');
if (!existsSync(PY)) { console.error(`[comet] no venv at ${PY}`); process.exit(1); }
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const tmp = path.join(os.tmpdir(), 'pw-comet-run', String(Date.now()));
mkdirSync(tmp, { recursive: true });

function score(model, items) {
  if (!items.length) return [];
  const inp = path.join(tmp, `${model}-${items.length}.jsonl`), out = inp.replace(/\.jsonl$/, '.out.json');
  writeFileSync(inp, items.map((x) => JSON.stringify(x)).join('\n'));
  const r = spawnSync(PY, [SCORE, '--model', model, '--in', inp, '--out', out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3600000, maxBuffer: 64 * 1024 * 1024 });
  const log = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0 || !existsSync(out)) { console.error(`[comet] ${model} failed:\n${log.split('\n').filter((l) => !/Warning|warn/i.test(l)).slice(-12).join('\n')}`); process.exit(1); }
  for (const l of log.split('\n')) if (l.startsWith('[comet]')) console.log(`  ${l}`);
  return JSON.parse(readFileSync(out, 'utf8'));
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

if (val('--live')) {
  const items = JSON.parse(readFileSync(path.resolve(val('--live')), 'utf8'));
  if (items.some((x) => x.lang !== 'zu')) { console.error('[comet] live mode scores isiZulu only (AfriCOMET needs a human reference; neither model is ruled for st or af)'); process.exit(1); }
  const s = score('ssa', items.map((x) => ({ id: x.id, lang: 'zu', src: x.en, mt: x.text })));
  writeFileSync(path.resolve(val('--out')), JSON.stringify(s, null, 1));
  console.log(`[comet] live: ${s.length} isiZulu lines, mean ${mean(s.map((x) => x.score)).toFixed(4)}`);
  process.exit(0);
}

const LABEL = val('--label', 'baseline'); const SPLIT = val('--split', 'test');
const gold = path.join(here, 'gold');
const lock = JSON.parse(readFileSync(path.join(gold, 'LOCK.json'), 'utf8'));
const ref = new Map();
for (const lang of ['zu', 'xh']) {
  const body = readFileSync(path.join(gold, `${lang}-${SPLIT}.json`), 'utf8');
  if (SPLIT === 'test' && createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) { console.error(`[comet] ${lang}-test.json breaks its seal`); process.exit(1); }
  for (const g of JSON.parse(body).items) ref.set(g.id, g);
}
const dir = path.join(root, 'output', 'translation-skills', LABEL);
const cands = JSON.parse(readFileSync(path.join(dir, 'candidates.json'), 'utf8')).filter((c) => ref.has(c.id) && (c.lang === 'zu' || c.lang === 'xh'));
const zu = cands.filter((c) => c.lang === 'zu'), xh = cands.filter((c) => c.lang === 'xh');
const rows = [];
for (const s of score('ssa', zu.map((c) => ({ id: c.id, lang: 'zu', src: ref.get(c.id).en, mt: c.text, ref: ref.get(c.id).reference })))) rows.push({ ...s, lang: 'zu', mode: 'zu-ref' });
for (const s of score('ssa', zu.map((c) => ({ id: c.id, lang: 'zu', src: ref.get(c.id).en, mt: c.text })))) rows.push({ ...s, lang: 'zu', mode: 'zu-qe' });
for (const s of score('afri', xh.map((c) => ({ id: c.id, lang: 'xh', src: ref.get(c.id).en, mt: c.text, ref: ref.get(c.id).reference })))) rows.push({ ...s, lang: 'xh', mode: 'xh-ref' });
writeFileSync(path.join(dir, 'comet.json'), JSON.stringify(rows, null, 1));
for (const mode of ['zu-ref', 'zu-qe', 'xh-ref']) {
  const v = rows.filter((r) => r.mode === mode).map((r) => r.score);
  console.log(`[comet] ${LABEL}/${SPLIT} ${mode}: n=${v.length} mean ${mean(v)?.toFixed(4)}`);
}
