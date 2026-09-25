// The real sources, live: each source's condition vote for the hour (production's meta.sourceConditions,
// saved hourly by the recorder) against the airport's report nearest the reading. Rain votes vs rain
// reported (RA/DZ/SH/TS…), fog votes vs FG. Small until the recorder has run a while — the sample size is
// printed with every number.
//   node review/accuracy/v2/live-votes.mjs [--dir <recorder data folder>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS } from './lib.mjs';

const args = process.argv.slice(2);
const DIR = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) : [];
const recs = files.flatMap((f) => readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter(Boolean);
const wxOf = (raw) => { const m = String(raw || '').replace(/^(METAR|SPECI)\s+/, ''); const toks = m.split(/\s+/); return toks.filter((t) => /^[+-]?(VC)?(RE)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP|BR|FG|HZ|FU|DU|SA)+$/.test(t)); };
const tally = {};
let readings = 0;
for (const r of recs) {
  const conds = r.api?.payload?.meta?.sourceConditions; const reps = r.metar?.reports;
  if (!Array.isArray(conds) || !Array.isArray(reps) || !reps.length) continue;
  const at = Date.parse(r.api.atUtc || r.runAtUtc);
  const rep = reps.slice().sort((a, b) => Math.abs(Date.parse(a.reportTime) - at) - Math.abs(Date.parse(b.reportTime) - at))[0];
  if (Math.abs(Date.parse(rep.reportTime) - at) > 45 * 60e3) continue;
  readings++;
  const wx = wxOf(rep.rawOb).filter((t) => !/^(VC|RE)/.test(t.replace(/^[+-]/, '')));
  const wet = wx.some((t) => /(DZ|RA|SN|SG|PL|GR|GS|UP)/.test(t));
  const fog = wx.some((t) => /FG/.test(t));
  for (const c of [...conds, { source: 'the app (served)', vote: r.api.payload.now?.conditionKey }]) {
    const t = (tally[c.source] ||= { hours: 0, rainVotes: 0, rainVotesDry: 0, fogVotes: 0, fogVotesNoFog: 0, wetHours: 0, wetHoursVotedRain: 0 });
    t.hours++;
    const v = String(c.vote || '');
    const saysRain = /rain|storm|thunder|drizzle|shower/.test(v) && !/possible/.test(v);
    if (saysRain) { t.rainVotes++; if (!wet) t.rainVotesDry++; }
    if (/fog/.test(v)) { t.fogVotes++; if (!fog) t.fogVotesNoFog++; }
    if (wet) { t.wetHours++; if (saysRain) t.wetHoursVotedRain++; }
  }
}
const out = { readings, from: recs[0]?.runAtUtc, to: recs[recs.length - 1]?.runAtUtc, sources: tally };
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'live-votes.json'), JSON.stringify(out, null, 1));
console.log(`live readings with an airport report within 45 min: ${readings} (${out.from} → ${out.to})`);
for (const [s, t] of Object.entries(tally)) console.log(`${s.padEnd(18)} rain votes ${t.rainVotes} (dry ${t.rainVotesDry}) · fog votes ${t.fogVotes} (no fog ${t.fogVotesNoFog}) · wet hours ${t.wetHours}, voted rain in ${t.wetHoursVotedRain}`);
