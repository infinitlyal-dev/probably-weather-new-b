// Side-by-side of two eval runs: node review/accuracy/compare.mjs before after
// Writes review/accuracy/results/compare-<a>-vs-<b>.md and prints it.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [a = 'before', b = 'after'] = process.argv.slice(2);
const A = JSON.parse(readFileSync(path.join(here, 'results', `${a}.json`), 'utf8'));
const B = JSON.parse(readFileSync(path.join(here, 'results', `${b}.json`), 'utf8'));

const cell = (x, y, unit = '') => `${x}${unit} → **${y}${unit}**`;
const md = [];
md.push(`# ${a} vs ${b}`, '', `${A.range.from} → ${A.range.to}, ${A.all.display.hours} station-hours, METAR ground truth. Observed windy = sustained ≥ ${A.obsWindy.sustainedKph} km/h or gust ≥ ${A.obsWindy.gustKph} km/h. Each cell: ${a} → **${b}**.`, '');
for (const layer of ['display', 'server']) {
  md.push(`## ${layer === 'display' ? 'What the phone shows' : 'Server now.conditionKey'}`, '');
  md.push('| city | said rain | false rain, same hour | false rain, ±1 h | rain missed (nothing wet) | rain not called rain | windy hours served sky-only | said wind | false wind (calm station) |');
  md.push('|---|---|---|---|---|---|---|---|---|');
  const row = (name, x, y) => `| ${name} | ${cell(x.saidRain, y.saidRain)} | ${cell(x.falseRainStrictPct, y.falseRainStrictPct, '%')} | ${cell(x.falseRainTolPct, y.falseRainTolPct, '%')} | ${cell(x.missedWetPct, y.missedWetPct, '%')} | ${cell(x.missedRainStrictPct, y.missedRainStrictPct, '%')} | ${cell(x.windyServedSkyPct, y.windyServedSkyPct, '%')} | ${cell(x.saidWind, y.saidWind)} | ${cell(x.falseWindPct ?? 0, y.falseWindPct ?? 0, '%')} |`;
  for (const icao of Object.keys(A.cities)) md.push(row(A.cities[icao].name, A.cities[icao][layer], B.cities[icao][layer]));
  md.push(row('**All six**', A.all[layer], B.all[layer]));
  md.push('', `Hours: ${A.all[layer].hours}. Hours with rain reported: ${A.all[layer].obsPrecipHours}. Observed windy hours: ${A.all[layer].obsWindyHours}.`, '');
  const ka = A.all[layer].keys, kb = B.all[layer].keys;
  const keys = [...new Set([...Object.keys(ka), ...Object.keys(kb)])].sort((x, y) => (kb[y] || 0) - (kb[x] || 0));
  md.push('| key served | ' + keys.join(' | ') + ' |', '|---|' + keys.map(() => '---').join('|') + '|');
  md.push(`| ${a} | ` + keys.map((k) => ka[k] || 0).join(' | ') + ' |');
  md.push(`| ${b} | ` + keys.map((k) => kb[k] || 0).join(' | ') + ' |', '');
}
// Cloud call (7 Oct 2026) — present only when both runs scored it.
if (A.all.display.saidCloudy != null && B.all.display.saidCloudy != null) {
  md.push('## Cloud call', '', '"No grey" = no broken/overcast layer below 20,000 ft reported (SA airports do not report high cloud).', '');
  for (const layer of ['display', 'server']) {
    md.push(`### ${layer === 'display' ? 'Phone' : 'Server'}`, '', '| city | said cloudy | cloudy over no grey | grey served light-sky |', '|---|---|---|---|');
    const r = (name, x, y) => `| ${name} | ${cell(x.saidCloudy, y.saidCloudy)} | ${cell(x.cloudyNoGrey, y.cloudyNoGrey)} (${x.cloudyNoGreyPct}% → ${y.cloudyNoGreyPct}%) | ${cell(x.greyMissed, y.greyMissed)} of ${x.obsGreyHours} (${x.greyMissedPct}% → ${y.greyMissedPct}%) |`;
    for (const icao of Object.keys(A.cities)) md.push(r(A.cities[icao].name, A.cities[icao][layer], B.cities[icao][layer]));
    md.push(r('**All six**', A.all[layer], B.all[layer]), '');
  }
}
if (A.all.dayCard && B.all.dayCard) {
  md.push('### Day card at noon (day 0)', '', '| city | day card Cloudy | Cloudy over no grey | grey served light-sky |', '|---|---|---|---|');
  const r = (name, x, y) => `| ${name} | ${cell(x.saidCloudy, y.saidCloudy)} | ${cell(x.cloudyNoGrey, y.cloudyNoGrey)} (${x.cloudyNoGreyPct}% → ${y.cloudyNoGreyPct}%) | ${cell(x.greyMissed, y.greyMissed)} of ${x.obsGreyDays} (${x.greyMissedPct}% → ${y.greyMissedPct}%) |`;
  for (const icao of Object.keys(A.cities)) md.push(r(A.cities[icao].name, A.cities[icao].dayCard, B.cities[icao].dayCard));
  md.push(r('**All six**', A.all.dayCard, B.all.dayCard), '');
}
const out = md.join('\n') + '\n';
writeFileSync(path.join(here, 'results', `compare-${a}-vs-${b}.md`), out);
process.stdout.write(out);
