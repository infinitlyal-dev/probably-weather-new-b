// Part B item 4 (Al, 7 Oct 2026): a description with "possible" in it is not a thunder vote.
// Scores every live "Thunder" hero the two-word rule made at an airport against the airport's reports within
// 75 minutes, split by whether its thunder word was a "possible".
//
//   node review/accuracy/live/thunder-possible.mjs [--dir <folder of recorder .jsonl>]
// Writes review/accuracy/results/thunder-possible.md.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : here;
const recs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) { if (line.trim()) try { recs.push(JSON.parse(line)); } catch { /* torn */ } }
}
const THUNDER = /thunder|lightning|donder|weerlig/i;
const near = (r) => (r.metar?.reports || []).filter((m) => m.icaoId === r.icao && Math.abs(m.obsTime * 1000 - Date.parse(r.api.atUtc)) <= 75 * 60e3);
const rows = [];
for (const r of recs) {
  const n = r.api?.payload?.now;
  if (!r.icao || n?.conditionReason !== 'two-source-consensus-thunder') continue;
  const votes = n.conditionSignals?.sourceVotes || [];
  const words = votes.filter((v) => THUNDER.test(v.desc || ''));
  const reps = near(r);
  const toks = reps.flatMap((m) => String(m.wxString || '').split(/\s+/)).filter((t) => t && !/^[-+]?VC/.test(t));
  rows.push({ icao: r.icao, at: r.runAtUtc.slice(0, 16), words: words.map((v) => `${v.source}: ${v.desc}`).join('; '),
    onlyPossible: words.every((v) => /possible/i.test(v.desc)), judged: reps.length > 0,
    ts: toks.some((t) => /TS/.test(t)) || reps.some((m) => /\bVCTS\b/.test(m.rawOb || '')), wet: toks.some((t) => /(RA|DZ|SN|GR|GS|PL|UP)/.test(t)) });
}
const judged = rows.filter((r) => r.judged);
const line = (name, list) => `| ${name} | ${list.length} | ${list.filter((r) => r.ts).length} | ${list.filter((r) => r.wet).length} | ${list.filter((r) => !r.ts && !r.wet).length} |`;
const md = ['# "Thunder" from two words — the "possible" ones (Part B item 4, 7 Oct 2026)', '',
  `Live recorder, ${recs[0]?.runAtUtc?.slice(0, 10)} → ${recs.at(-1)?.runAtUtc?.slice(0, 10)}: ${rows.length} Thunder heroes from the two-word rule at the six airports, ${judged.length} with an airport report within 75 min.`, '',
  '| thunder words | hours | thunder at or near the airport (TS / VCTS) | rain at the airport | neither |', '|---|---|---|---|---|',
  line('only "possible" ones (no longer Thunder)', judged.filter((r) => r.onlyPossible)), line('at least one without "possible" (unchanged)', judged.filter((r) => !r.onlyPossible)), '',
  '| airport | UTC | thunder words | TS | rain |', '|---|---|---|---|---|',
  ...judged.map((r) => `| ${r.icao} | ${r.at} | ${r.words} | ${r.ts ? 'yes' : 'no'} | ${r.wet ? 'yes' : 'no'} |`)];
writeFileSync(path.join(here, '..', 'results', 'thunder-possible.md'), md.join('\n') + '\n');
process.stdout.write(md.join('\n') + '\n');
