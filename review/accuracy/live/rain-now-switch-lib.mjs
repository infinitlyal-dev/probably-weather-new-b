// Live scoring of the coast-only "Rain's here" by description (rain-now-descriptive, Maat's ruling 12 Oct 2026),
// per region, from the hourly recorder's own reads. The recorder already keeps everything the rule reads (the
// selector's exact inputs, each source's word) next to the airport's METAR, so it needs no change: score.mjs and
// rain-now-descriptive.mjs call this on every run.
//   today   — what production's ladder served as rain, minus anything the new rule itself decided
//   switch  — the read's recorded selector inputs re-run through api/weather.js deriveCondition with the candidate's
//             inputs added (rainDescRegion from the read's own coordinates); rain if the ladder lands on the new rung
//             and no later override (Tomorrow.io thunder → storm, hail/thunder) took the hour, or if today was rain
//   everywhere — the same with the region switch forced on (the rule in every region)
//   served  — what production actually served as rain (equals `switch` once the rule is live; a check that it does)
// Truth: precipitation at the airport within 75 minutes of the read (radar-second-signal.mjs's test).
import { regionOf } from '../../../api/_lib/regions.js';
import { deriveCondition, descriptiveRainVotes, RAIN_NOW_DESC_REGIONS } from '../../../api/weather.js';

const TAKES_THE_HOUR = new Set(['storm', 'thunder', 'hail']);   // overrides that outrank rain after the selector

export const wetAt = (r) => {
  const t = Date.parse(r.api?.atUtc);
  if (!Number.isFinite(t)) return null;
  const near = (r.metar?.reports || []).filter((m) => m.icaoId === r.icao && Math.abs(m.obsTime * 1000 - t) <= 75 * 60e3);
  if (!near.length) return null;
  return near.some((m) => String(m.wxString || '').split(/\s+/).some((tok) => !/^[-+]?VC/.test(tok) && /(RA|DZ|SN|GR|GS|PL|UP)/.test(tok)));
};

/** One read through today's ladder and the switch; null when the payload has no selector inputs or source words. */
export function rainNowRead(r) {
  const now = r.api?.payload?.now;
  const s = now?.conditionSignals, inputs = s?.selector?.inputs;
  if (!r.api?.payload?.ok || !s?.sourceVotes || !inputs) return null;
  const lat = Number(r.lat), lon = Number(r.lon);
  const region = Number.isFinite(lat) && Number.isFinite(lon) ? regionOf(lat, lon) : null;
  const coast = RAIN_NOW_DESC_REGIONS.includes(region);
  const ev = descriptiveRainVotes(s.sourceVotes);
  const today = now.conditionKey === 'rain' && now.conditionReason !== 'rain-now-descriptive';
  const taken = TAKES_THE_HOUR.has(now.conditionKey);
  const lands = (on) => deriveCondition({ ...inputs, now: true, rainSources: ev.sources, rainFamilies: ev.families, rainDescRegion: on }).reason === 'rain-now-descriptive';
  return { region, coast, key: now.conditionKey, reason: now.conditionReason, chance: s.numeric?.rainChance, mm: inputs.precipMm, sources: ev.sources, families: ev.families,
    words: s.sourceVotes.map((v) => `${v.source}: ${v.desc}`).join(' · '),
    rules: { today, switch: today || (!taken && lands(coast)), everywhere: today || (!taken && lands(true)), served: now.conditionKey === 'rain' } };
}

/** Per-region and coast/inland tallies of the airport reads (optionally only reads at or after `sinceUtc`). */
export function rainNowSwitchScore(recs, { sinceUtc = null } = {}) {
  const since = sinceUtc == null ? null : Date.parse(sinceUtc);   // only null/undefined mean "no filter"
  if (sinceUtc != null && !Number.isFinite(since)) throw new Error(`rainNowSwitchScore: bad sinceUtc "${sinceUtc}"`);
  const reads = [];
  for (const r of recs) {
    if (!r.icao) continue;
    const at = Date.parse(r.runAtUtc);
    if (!Number.isFinite(at) || (since !== null && at < since)) continue;
    const x = rainNowRead(r), wet = x ? wetAt(r) : null;
    if (x && wet !== null) reads.push({ icao: r.icao, at: r.runAtUtc.slice(0, 16), wet, ...x });
  }
  const tally = (list, rule) => { const calls = list.filter((x) => x.rules[rule]), wet = list.filter((x) => x.wet);
    return { calls: calls.length, right: calls.filter((x) => x.wet).length, wet: wet.length, caught: wet.filter((x) => x.rules[rule]).length }; };
  const groups = { coast: reads.filter((x) => x.coast), inland: reads.filter((x) => !x.coast) };
  for (const g of [...new Set(reads.map((x) => x.region))].sort()) groups[g] = reads.filter((x) => x.region === g);
  return { sinceUtc, reads: reads.length,
    groups: Object.fromEntries(Object.entries(groups).map(([g, l]) => [g, { reads: l.length, today: tally(l, 'today'), switch: tally(l, 'switch'), everywhere: tally(l, 'everywhere'), served: tally(l, 'served'),
      servedMatchesSwitch: l.filter((x) => x.rules.served === x.rules.switch).length }])),
    reads_: reads };
}

/** Markdown lines for live-score.md. */
export function rainNowSwitchMd(score) {
  const pc = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
  const cell = (t) => `${t.calls} · ${pc(t.right, t.calls)} · ${t.caught}/${t.wet} = ${pc(t.caught, t.wet)}`;
  const md = [`## "Rain's here" by description, coast only (rain-now-descriptive)${score.sinceUtc ? ` — since ${score.sinceUtc}` : ''}`, '',
    `${score.reads} airport reads with a METAR within 75 min. Each cell: calls · right when it said rain · wet reads caught. "Switch" re-runs each read's recorded selector inputs through the app's ladder with the coast rule; "served" is what production showed (the same as switch once the rule is live).`, '',
    '| where | reads | today | switch | served | served = switch |', '|---|---|---|---|---|---|'];
  for (const [g, x] of Object.entries(score.groups)) md.push(`| ${g} | ${x.reads} | ${cell(x.today)} | ${cell(x.switch)} | ${cell(x.served)} | ${x.servedMatchesSwitch}/${x.reads} |`);
  return md;
}
