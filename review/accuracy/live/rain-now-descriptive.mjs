// Candidate "rain-now-descriptive" (12 Oct 2026) on the live recorder — production's REAL source words, which the
// archive replay (v3/rainnow-descriptive.mjs) cannot see. For every airport read: would the candidate have said
// "Rain's here.", and was the airport wet within 75 minutes (radar-second-signal.mjs's test)? Plus every Strand read
// on a chosen evening, with what each rule said.
//
//   node review/accuracy/live/rain-now-descriptive.mjs [--dir <folder of recorder .jsonl>] [--strand 2026-10-12]
//
// Writes review/accuracy/results/rain-now-descriptive-live.json.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { descriptiveRainVotes, RAIN_NOW_DESC_MIN_VOTES, RAIN_NOW_DESC_MIN_FAMILIES, RAIN_NOW_DESC_MIN_MM } from '../../../api/weather.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : here;
const strandDay = args.includes('--strand') ? args[args.indexOf('--strand') + 1] : null;

const recs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { recs.push(JSON.parse(line)); } catch { /* a torn line */ }
  }
}
// radar-second-signal.mjs: precipitation at the station within 75 min (VC.. is not here).
const wetAt = (r) => {
  const t = Date.parse(r.api.atUtc);
  const near = (r.metar?.reports || []).filter((m) => m.icaoId === r.icao && Math.abs(m.obsTime * 1000 - t) <= 75 * 60e3);
  if (!near.length) return null;
  return near.some((m) => String(m.wxString || '').split(/\s+/).some((tok) => !/^[-+]?VC/.test(tok) && /(RA|DZ|SN|GR|GS|PL|UP)/.test(tok)));
};
const read = (r) => {
  const now = r.api?.payload?.now;
  if (!r.api?.payload?.ok || !now?.conditionSignals?.sourceVotes) return null;
  const s = now.conditionSignals, ev = descriptiveRainVotes(s.sourceVotes), mm = s.numeric?.precipMm;
  const desc = (minVotes, minMm) => ev.sources >= minVotes && ev.families >= RAIN_NOW_DESC_MIN_FAMILIES && typeof mm === 'number' && mm >= minMm;
  // today's ladder: a read already served by the candidate (if it ever ships) is not today's rain
  const today = now.conditionKey === 'rain' && now.conditionReason !== 'rain-now-descriptive';
  return { key: now.conditionKey, reason: now.conditionReason, chance: s.numeric?.rainChance, mm, votes: ev.sources, families: ev.families,
    words: s.sourceVotes.map((v) => `${v.source}: ${v.desc}`).join(' · '),
    rules: { today, candidate: today || desc(RAIN_NOW_DESC_MIN_VOTES, RAIN_NOW_DESC_MIN_MM), a: today || desc(RAIN_NOW_DESC_MIN_VOTES, 0.3), b: today || desc(2, RAIN_NOW_DESC_MIN_MM) } };
};

const airport = [];
for (const r of recs) {
  if (!r.icao) continue;
  const x = read(r), wet = x ? wetAt(r) : null;
  if (x && wet !== null) airport.push({ icao: r.icao, at: r.runAtUtc.slice(0, 16), wet, ...x });
}
const score = (rule) => {
  const calls = airport.filter((x) => x.rules[rule]), wet = airport.filter((x) => x.wet);
  return { calls: calls.length, right: calls.filter((x) => x.wet).length, wet: wet.length, caught: wet.filter((x) => x.rules[rule]).length };
};
const out = { from: recs[0]?.runAtUtc, to: recs.at(-1)?.runAtUtc, reads: airport.length,
  rules: Object.fromEntries(['today', 'candidate', 'a', 'b'].map((k) => [k, score(k)])),
  wetShownMightRain: airport.filter((x) => x.wet && x.key === 'rain-possible').length,
  wetByAirport: Object.fromEntries([...new Set(airport.map((x) => x.icao))].map((i) => { const w = airport.filter((x) => x.icao === i && x.wet);
    return [i, { wet: w.length, mightRain: w.filter((x) => x.key === 'rain-possible').length, rainToday: w.filter((x) => x.rules.today).length, rainCandidate: w.filter((x) => x.rules.candidate).length }]; })),
  added: airport.filter((x) => x.rules.candidate && !x.rules.today).map(({ rules, ...x }) => x),
  strand: strandDay ? recs.filter((r) => !r.icao && /strand/i.test(r.city || '') && r.runAtUtc && new Date(Date.parse(r.runAtUtc) + 2 * 3600e3).toISOString().slice(0, 10) === strandDay)
    .map((r) => ({ sast: new Date(Date.parse(r.runAtUtc) + 2 * 3600e3).toISOString().slice(11, 16), ...read(r) })) : [] };
writeFileSync(path.join(here, '..', 'results', 'rain-now-descriptive-live.json'), JSON.stringify(out, null, 1));

const pc = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
console.log(`Live recorder ${out.from?.slice(0, 10)} → ${out.to?.slice(0, 16)}Z: ${out.reads} airport reads with a METAR within 75 min`);
for (const [k, s] of Object.entries(out.rules)) console.log(`  ${k.padEnd(10)} calls ${s.calls}, right ${s.right} (${pc(s.right, s.calls)}), wet reads caught ${s.caught}/${s.wet} (${pc(s.caught, s.wet)})`);
console.log(`  wet reads the app showed as might-rain: ${out.wetShownMightRain} of ${out.rules.today.wet} — ${Object.entries(out.wetByAirport).map(([i, x]) => `${i} ${x.mightRain}/${x.wet}`).join(', ')}`);
console.log('  calls the candidate adds:'); for (const x of out.added) console.log(`    ${x.icao} ${x.at}Z wet=${x.wet} ${x.key}/${x.reason} ${x.chance}% ${x.mm} mm v${x.votes}/f${x.families} | ${x.words}`);
if (strandDay) { console.log(`Strand ${strandDay}:`); for (const x of out.strand) console.log(`  ${x.sast} ${x.key}/${x.reason} ${x.chance}% ${x.mm} mm v${x.votes}/f${x.families} → candidate ${x.rules.candidate ? 'RAIN' : '-'} | ${x.words}`); }
