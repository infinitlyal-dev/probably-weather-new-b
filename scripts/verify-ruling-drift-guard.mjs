// PROVE THE RULING-DRIFT GUARD FIRES, against the case that actually happened.
//
// build-hero-lines.mjs refuses to generate when a ruled export's photograph hash
// is no longer in the set while lines from that ruling are still live. A guard
// nobody has seen fail is a guard nobody knows works, so this rebuilds the real
// 2026-09-16 case and asserts the refusal:
//
//   review/set-001-line-matches-ruled.json places "Joburg rain keeps a diary…"
//   on photograph 3bd49d0acf2b at rain/week_2/day/5.webp. The 2026-09-16 reroll
//   replaced that photograph with fec85aba3f48 and carried the three lines over.
//   Until 2026-09-20 nothing said so, and the provenance split read the stale
//   pairing as "no record" — three of Al's own lines went onto a cull page
//   labelled unruled.
//
// The authoring file is copied aside, the pre-cull entry is put back, the build
// is run, and the file is restored in a finally block whatever happens. Asserts
// three things: it refuses, it names the vanished photograph, and it names the
// live lines resting on it. Then asserts the real tree still passes.
//
//   node scripts/verify-ruling-drift-guard.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const FINAL = path.join(root, 'review', 'set-001-lines-bespoke-final.json');
const BACKUP = `${FINAL}.guard-proof-backup`;
const BUILD = path.join(root, 'scripts', 'build-hero-lines.mjs');

const VANISHED = '3bd49d0acf2b';           // the photograph the reroll replaced
const REPLACEMENT = 'fec85aba3f48';        // the one Al chose in its place
const LINES = [
  'Joburg rain keeps a diary: 2pm sharp, maximum drama, no apologies.',
  'You might be working from home by popular demand.',
  'Shop later. The last biscuit will have to stretch.',
];

const run = () => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [BUILD, '--check'], { encoding: 'utf8', stderr: 'pipe' }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

const fail = (why) => { console.error(`[guard proof] FAILED — ${why}`); process.exitCode = 1; };

copyFileSync(FINAL, BACKUP);
let fired;
try {
  // Put the three lines back on the replacement photograph, exactly as they sat
  // before the cull. The ruling in review/ still points at the vanished one.
  const doc = JSON.parse(readFileSync(FINAL, 'utf8'));
  const awaiting = (doc.awaitingLines || []).find((a) => a.hash === REPLACEMENT);
  if (!awaiting) { fail(`${REPLACEMENT} is not in awaitingLines — the tree is not in the post-cull state this proof reconstructs from`); process.exit(); }
  const { cutLines, reason, ...rest } = awaiting;
  writeFileSync(FINAL, JSON.stringify({
    ...doc,
    set: [...doc.set, { ...rest, lines: LINES }],
    awaitingLines: (doc.awaitingLines || []).filter((a) => a.hash !== REPLACEMENT),
  }, null, 1));
  fired = run();
} finally {
  copyFileSync(BACKUP, FINAL);
  unlinkSync(BACKUP);
}

if (fired.code === 0) fail('the build generated happily with a live ruling on a photograph that no longer exists');
else console.log('[guard proof] the build refused, as it must');

for (const [what, needle] of [
  ['the vanished photograph', VANISHED],
  ['the slot it was ruled at', 'rain/week_2/day/5.webp'],
  ['the photograph in that slot now', 'a0ef2720c507'],
  ['the export the ruling came from', 'set-001-line-matches-ruled.json'],
  ['the live line resting on it', 'Joburg rain keeps a diary'],
]) {
  if (fired.out.includes(needle)) console.log(`[guard proof] names ${what}: ${needle}`);
  else fail(`the refusal does not name ${what} (${needle})`);
}

const clean = run();
if (clean.code === 0) console.log('[guard proof] the real tree still passes --check');
else { fail('the restored tree does not pass --check'); console.error(clean.out); }

if (!process.exitCode) console.log('[guard proof] OK');
