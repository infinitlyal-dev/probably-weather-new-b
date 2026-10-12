// Candidate "rain-now-descriptive" (12 Oct 2026) on the live recorder — production's REAL source words, which the
// archive replay (v3/rainnow-descriptive.mjs) cannot see. For every airport read: what today's ladder served, what
// the coast switch would serve (Maat's ruling: Western Cape, Garden Route, KZN coast) and the rule everywhere — the
// app's own ladder re-run on each read's recorded inputs (rain-now-switch-lib.mjs); and was the airport wet within
// 75 minutes. Per region, plus every Strand read on a chosen evening.
//
//   node review/accuracy/live/rain-now-descriptive.mjs [--dir <folder of recorder .jsonl>] [--strand 2026-10-12] [--since 2026-10-12T21:00:00Z]
//
// Writes review/accuracy/results/rain-now-descriptive-live.json. score.mjs carries the per-region table on every run.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rainNowRead, rainNowSwitchScore } from './rain-now-switch-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const dir = arg('--dir') ?? here;
const strandDay = arg('--strand');
const sinceUtc = args.includes('--since') ? (arg('--since') ?? '') : null;   // a bare --since is refused by the lib

const recs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { recs.push(JSON.parse(line)); } catch { /* a torn line */ }
  }
}
const sc = rainNowSwitchScore(recs, { sinceUtc });
const reads = sc.reads_;
const score = (rule) => { const calls = reads.filter((x) => x.rules[rule]), wet = reads.filter((x) => x.wet);
  return { calls: calls.length, right: calls.filter((x) => x.wet).length, wet: wet.length, caught: wet.filter((x) => x.rules[rule]).length }; };
const sast = (utc) => new Date(Date.parse(utc) + 2 * 3600e3).toISOString();
const out = { from: recs[0]?.runAtUtc, to: recs.at(-1)?.runAtUtc, sinceUtc, reads: reads.length,
  rules: Object.fromEntries(['today', 'switch', 'everywhere'].map((k) => [k, score(k)])),
  byRegion: Object.fromEntries(Object.entries(sc.groups).map(([g, x]) => [g, { reads: x.reads, today: x.today, switch: x.switch }])),
  wetShownMightRain: reads.filter((x) => x.wet && x.key === 'rain-possible').length,
  added: reads.filter((x) => x.rules.switch && !x.rules.today).map(({ rules, ...x }) => x),
  strand: strandDay ? recs.filter((r) => !r.icao && /strand/i.test(r.city || r.spot || '') && r.runAtUtc && sast(r.runAtUtc).slice(0, 10) === strandDay)
    .map((r) => ({ sast: sast(r.runAtUtc).slice(11, 16), ...rainNowRead(r) })) : [] };
writeFileSync(path.join(here, '..', 'results', 'rain-now-descriptive-live.json'), JSON.stringify(out, null, 1));

const pc = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const line = (t) => `calls ${t.calls}, right ${t.right} (${pc(t.right, t.calls)}), wet reads caught ${t.caught}/${t.wet} (${pc(t.caught, t.wet)})`;
console.log(`Live recorder ${out.from?.slice(0, 10)} → ${out.to?.slice(0, 16)}Z${sinceUtc ? ` (since ${sinceUtc})` : ''}: ${out.reads} airport reads with a METAR within 75 min`);
for (const [k, s] of Object.entries(out.rules)) console.log(`  ${k.padEnd(10)} ${line(s)}`);
console.log('  by region (today → switch):');
for (const [g, x] of Object.entries(out.byRegion)) console.log(`    ${g.padEnd(13)} ${x.reads} reads · today ${line(x.today)} → switch ${line(x.switch)}`);
console.log(`  wet reads the app showed as might-rain: ${out.wetShownMightRain}`);
console.log('  calls the switch adds:'); for (const x of out.added) console.log(`    ${x.icao} ${x.at}Z wet=${x.wet} ${x.key}/${x.reason} ${x.chance}% ${x.mm} mm s${x.sources}/f${x.families} | ${x.words}`);
if (strandDay) { console.log(`Strand ${strandDay} (${out.strand[0]?.region ?? '?'}):`); for (const x of out.strand) if (x.key) console.log(`  ${x.sast} ${x.key}/${x.reason} ${x.chance}% ${x.mm} mm s${x.sources}/f${x.families} → switch ${x.rules.switch ? 'RAIN' : '-'} | ${x.words}`); }
