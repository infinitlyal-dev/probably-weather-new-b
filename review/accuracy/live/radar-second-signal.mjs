// Part B item 3 (Al, 7 Oct 2026): does the Tomorrow.io radar's "Rain's here." get better with one more signal?
// Scores every radar override the live recorder caught at an airport against the airport's reports within
// 75 minutes, for today's rule and the three seconds Al named, plus "a rain word from another source".
//
//   node review/accuracy/live/radar-second-signal.mjs [--dir <folder of recorder .jsonl>]
//
// The recorder's .jsonl files are git-ignored and live where the recorder runs (review/accuracy/live/README.md).
// Writes review/accuracy/results/radar-second-signal.md.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : here;

const recs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { recs.push(JSON.parse(line)); } catch { /* a torn line */ }
  }
}
const overridesOf = (r) => r.api?.payload?.now?.conditionSignals?.overrides || [];
const isRadar = (r) => overridesOf(r).some((o) => o.rule === 'tomorrow-io-radar-override');
const radarHour = new Map();
for (const r of recs) if (r.icao && r.api?.payload?.ok) radarHour.set(`${r.icao}|${r.runAtUtc.slice(0, 13)}`, isRadar(r));

// Precipitation at the station (RA / DZ / SN / GR / GS / PL / UP, showers and thunder included; VC.. is not here).
const wetAt = (r) => {
  const t = Date.parse(r.api.atUtc);
  const near = (r.metar?.reports || []).filter((m) => m.icaoId === r.icao && Math.abs(m.obsTime * 1000 - t) <= 75 * 60e3);
  if (!near.length) return null;
  return near.some((m) => String(m.wxString || '').split(/\s+/).some((tok) => !/^[-+]?VC/.test(tok) && /(RA|DZ|SN|GR|GS|PL|UP)/.test(tok)));
};

const calls = [];
for (const r of recs) {
  if (!r.icao || !isRadar(r)) continue;
  const s = r.api.payload.now.conditionSignals;
  const o = overridesOf(r).find((x) => x.rule === 'tomorrow-io-radar-override');
  const votes = s.sourceVotes || [];
  calls.push({
    icao: r.icao, at: r.runAtUtc.slice(0, 16), wet: wetAt(r), ladder: o.from,
    rainVotes: s.numeric?.rainVotes ?? 0,
    otherSourceRain: votes.filter((v) => v.source !== 'Tomorrow.io' && v.vote === 'rain' && !/possible/i.test(v.desc || '')).length,
    precipMm: s.numeric?.precipMm ?? 0,
    radarHourBefore: radarHour.get(`${r.icao}|${new Date(Date.parse(r.runAtUtc) - 3600e3).toISOString().slice(0, 13)}`) === true,
  });
}
const judged = calls.filter((c) => c.wet !== null);
const WET = new Set(['rain-possible', 'storm', 'thunder', 'hail']);
const rules = [
  ['Today: radar alone', () => true],
  ['A source describes rain (any, "possible" excluded)', (c) => c.rainVotes >= 1],
  ['Blended rain this hour > 0 mm', (c) => c.precipMm > 0],
  ['Radar the hour before as well', (c) => c.radarHourBefore],
  ['**Shipped:** a source other than Tomorrow.io describes rain', (c) => c.otherSourceRain >= 1],
];
const md = ['# Radar "Rain\'s here." — one more signal (Part B item 3, 7 Oct 2026)', '',
  `Live recorder, ${recs[0]?.runAtUtc?.slice(0, 10)} → ${recs.at(-1)?.runAtUtc?.slice(0, 10)}: ${calls.length} radar overrides at the six airports, ${judged.length} with an airport report within 75 min, ${judged.filter((c) => c.wet).length} of them wet.`, '',
  '| rule | "Rain\'s here." calls | right | wet calls dropped (still might-rain / shown dry) | dry calls dropped |', '|---|---|---|---|---|'];
for (const [name, keep] of rules) {
  const kept = judged.filter(keep), dropped = judged.filter((c) => !keep(c));
  const wetDropped = dropped.filter((c) => c.wet);
  md.push(`| ${name} | ${kept.length} | ${kept.filter((c) => c.wet).length} (${kept.length ? Math.round((kept.filter((c) => c.wet).length / kept.length) * 100) : '–'}%) | ${wetDropped.length} (${wetDropped.filter((c) => WET.has(c.ladder)).length} / ${wetDropped.filter((c) => !WET.has(c.ladder)).length}) | ${dropped.filter((c) => !c.wet).length} |`);
}
md.push('', `Every radar call at an airport in this window already had a source describing rain and blended rain above 0 mm, so those two seconds change nothing here. In ${judged.filter((c) => c.otherSourceRain < 1).length} of them the only rain word was Tomorrow.io's own, which is why the shipped rule asks for a source other than Tomorrow.io (Johannesburg, 23 Sept: four sources clear, Tomorrow.io "Light rain", a dry night).`, '',
  'Calls the shipped rule holds back:', '', '| airport | UTC | wet at the airport | the ladder\'s own answer |', '|---|---|---|---|');
for (const c of judged.filter((c) => c.otherSourceRain < 1)) md.push(`| ${c.icao} | ${c.at} | ${c.wet ? 'yes' : 'no'} | ${c.ladder} |`);
writeFileSync(path.join(here, '..', 'results', 'radar-second-signal.md'), md.join('\n') + '\n');
process.stdout.write(md.join('\n') + '\n');
