// Checker (b): an independent BLIND back-translation by Sol (GPT-5.6-Sol, through the Codex
// CLI) — Part 2, step 5 (2026-09-23).
//
// Sol gets its own short brief (SOL_BRIEF below): translate these lines into English. It is
// never shown the English source, and it is under no Claude contract. It reads one input.json
// in a clean folder (no AGENTS.md, no repo) and writes output.json there.
//
// HARD USAGE CAP (Al's brief: "hard usage cap"): at most --per-call lines per call (default 50),
// --max-calls calls per run (default 12), low reasoning effort, a 9-minute timeout per call, and
// stdin closed (codex exec otherwise waits for EOF forever). Every call's token count goes to
// output/translation-skills/sol/usage.jsonl so the spend is on record.
//
//   node scripts/translation-skills/sol-backtranslate.mjs --in lines.json --out result.json [--per-call 50] [--max-calls 12]
//   lines.json: [{ "k", "lang", "text" }]  — NO English field: the runner refuses one that has it.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Codex CLI is a Node script behind an npm .cmd shim. Running the script with this Node,
// no shell, keeps the brief and the folder path (the repo path has spaces) as single arguments.
const CODEX_JS = process.env.CODEX_JS || path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
if (!existsSync(CODEX_JS)) { console.error(`[sol] Codex CLI not found at ${CODEX_JS} (set CODEX_JS)`); process.exit(1); }

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const IN = val('--in'); const OUT = val('--out');
const PER_CALL = Number(val('--per-call', 50));
const MAX_CALLS = Number(val('--max-calls', 12));
if (!IN || !OUT) { console.error('usage: --in lines.json --out result.json'); process.exit(2); }
const LANG = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho (South African spelling)' };

const lines = JSON.parse(readFileSync(path.resolve(IN), 'utf8'));
if (lines.some((l) => 'en' in l || 'english' in l)) { console.error('[sol] the input carries an English field — Sol must never see the English. Refusing.'); process.exit(1); }
const chunks = [];
for (const lang of Object.keys(LANG)) {
  const mine = lines.filter((l) => l.lang === lang);
  for (let i = 0; i < mine.length; i += PER_CALL) chunks.push({ lang, items: mine.slice(i, i + PER_CALL) });
}
if (chunks.length > MAX_CALLS) { console.error(`[sol] ${lines.length} lines need ${chunks.length} calls; the cap is ${MAX_CALLS}. Raise --max-calls deliberately or send fewer lines.`); process.exit(1); }

const SOL_BRIEF = (lang) => [
  `You are an independent translator. input.json in this folder holds short lines from a South African weather app, all in ${lang}.`,
  'Translate each one into plain English, as literally as a careful translator would, keeping every detail: who and what, time, place, numbers, and whether something is or is not happening.',
  'You are deliberately not shown the original English. Do not guess what an app would say; translate what is written.',
  'If a word is misspelt, unclear, not in the language, or could mean two things, give your best reading and say so in "note".',
  'Use only input.json. Do not open other files and do not use the internet.',
  'Write output.json in this folder: a JSON array with one object per input line, same order: {"k": the same k, "back": your English, "note": "" or your note}.',
  'Then print DONE.',
].join(' ');

const base = path.join(root, 'output', 'translation-skills', 'sol');
mkdirSync(base, { recursive: true });
const results = [];
let call = 0;
for (const c of chunks) {
  call += 1;
  // A clean folder outside the repo: no AGENTS.md, no project files for Sol to wander into.
  const dir = path.join(os.tmpdir(), 'pw-sol-bt', `${Date.now()}-${call}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(c.items.map(({ k, text }) => ({ k, text })), null, 1));
  const started = Date.now();
  const run = spawnSync(process.execPath, [CODEX_JS, 'exec', '--skip-git-repo-check', '-C', dir, '-m', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="low"', SOL_BRIEF(LANG[c.lang])],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 540000, maxBuffer: 32 * 1024 * 1024 });
  const log = `${run.stdout || ''}\n${run.stderr || ''}${run.error ? `\nFAILED: ${run.error.message}` : ''}`;
  const tokens = Number((log.match(/tokens used\s*\n?\s*([\d,]+)/i) || [])[1]?.replace(/,/g, '')) || null;
  appendFileSync(path.join(base, 'usage.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), lang: c.lang, lines: c.items.length, seconds: Math.round((Date.now() - started) / 1000), tokens })}\n`);
  const outFile = path.join(dir, 'output.json');
  let got = [];
  if (existsSync(outFile)) { try { got = JSON.parse(readFileSync(outFile, 'utf8')); } catch { got = []; } }
  const byK = new Map(got.map((g) => [g.k, g]));
  const missing = c.items.filter((it) => !byK.get(it.k)?.back);
  console.log(`[sol] call ${call}/${chunks.length} ${c.lang}: ${c.items.length - missing.length}/${c.items.length} back-translated in ${Math.round((Date.now() - started) / 1000)} s${tokens ? `, ${tokens} tokens` : ''}`);
  for (const it of c.items) {
    const g = byK.get(it.k);
    results.push({ k: it.k, lang: it.lang, text: it.text, back: g?.back || null, note: g?.note || '', by: 'gpt-5.6-sol (Codex, low effort, blind)' });
  }
  rmSync(dir, { recursive: true, force: true });
}
writeFileSync(path.resolve(OUT), JSON.stringify(results, null, 1));
const done = results.filter((r) => r.back).length;
console.log(`[sol] ${done}/${results.length} lines back-translated → ${OUT}`);
process.exit(done === results.length ? 0 : 1);
