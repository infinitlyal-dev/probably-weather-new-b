// This morning, replayed (PLAN.md §7): Strand and Cape Town city, the recorder's 07:10 and 08:10 UTC readings of
// 28 Sept 2026 — what was served, what the shipped rules give from the recorded inputs, and what was there.
//   node review/accuracy/v5/replay-morning.mjs   → results/v5-replay.md
// Re-runs production's own functions (api/_lib/wind.js, deriveCondition, applyVoteConsensus) on the recorded
// selector inputs and each source's recorded wind; only the wind inputs change. The sky is today's (its change failed
// its bar), so the phone's cloud rung is as served.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { shapeWind, windLine } from '../../../api/_lib/wind.js';
import { deriveCondition, applyVoteConsensus } from '../../../api/weather.js';
import { RESULTS } from '../v2/lib.mjs';

const LIVE = process.env.PW_LIVE_DIR || 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const lines = readFileSync(path.join(LIVE, '2026-09-28.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const pick = (spot, hh) => lines.find((x) => (x.spot === spot || x.icao === spot) && x.runAtUtc.startsWith(`2026-09-28T${hh}`));
const out = ['# This morning, replayed on the shipped rules (28 Sept 2026)', '',
  'Recorder readings at 07:10 and 08:10 UTC (09:10 and 10:10 SAST). "Served" is what production said; "now" is the same',
  'recorded inputs through the shipped wind rule (api/_lib/wind.js) and the ladder; the sky is unchanged (its test failed).', '',
  '| place, UTC | sources\' wind (OM · WA · Pirate · MET · TI) | largest gust | served: wind, hero | now: wind (rule), hero | there |', '|---|---|---|---|---|---|'];
const THERE = {
  Strand: 'SAWS Strand 68911, 06 UTC: 28 km/h from 110°, gust 50 · Yr: 10 m/s (36 km/h) from the east · Al: wind pumping, palms bent hard; thin high streaks, some low cloud on the mountains',
  'Cape Town city': 'Cape Town airport (17 km) METAR 07 UTC: 11 km/h, CAVOK; 08 UTC: 9 km/h, CAVOK',
};
const NAMES = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
for (const spot of ['Strand', 'Cape Town city']) for (const hh of ['07', '08']) {
  const r = pick(spot, hh); if (!r?.api?.payload) continue;
  const p = r.api.payload, inputs = p.now.conditionSignals.selector.inputs;
  const src = Object.fromEntries(p.meta.sourceNow.map((s) => [s.name, s]));
  const at = new Date(Date.parse(p.meta.updatedAtLabel) + 2 * 3600e3);
  const shaped = shapeWind({ raw: inputs.windKph, values: NAMES.map((n) => src[n]?.windKph), lat: r.lat, lon: r.lon, month: at.getUTCMonth() + 1, hour: at.getUTCHours() });
  const line = windLine(shaped);
  const base = deriveCondition({ ...inputs, windKph: line.kph, windThresholdKph: line.thresholdKph });
  const norms = p.meta.sourceNow.map((s) => ({ source: s.name, windKph: s.windKph, gustKph: s.gustKph, nowTemp: s.tempC, desc: s.desc }));
  const votes = p.meta.sourceConditions;
  const cons = applyVoteConsensus({ ...base, activeNorms: norms, sourceVotes: votes, windSourceFactor: line.sourceFactor, windThresholdKph: line.thresholdKph });
  const served = `${p.now.windKph} km/h, ${p.now.conditionKey} (${p.now.conditionReason}); cloud ${p.now.cloudPct} % → phone ${p.now.cloudPct >= 60 && p.now.conditionKey === 'clear' ? 'cloudy' : p.now.conditionKey}`;
  const now = `${shaped.kph} km/h (${shaped.rule}${shaped.rule !== 'today' ? ` ×${shaped.ratio}` : ''}), ${cons.key} (${cons.reason})`;
  out.push(`| ${spot}, ${hh}:10 | ${NAMES.map((n) => src[n]?.windKph ?? '—').join(' · ')} | ${inputs.gustKph} | ${served} | ${now} | ${hh === '07' ? THERE[spot] : ''} |`);
}
out.push('', 'The phone shows the server\'s wind key as it is; with a server key it no longer re-derives Windy from the number',
  '(Fable, plan item 7). Its cloud rung (cloud ≥ 60 % over a server "clear" → cloudy) is unchanged: the sky change failed its bar.');
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v5-replay.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
