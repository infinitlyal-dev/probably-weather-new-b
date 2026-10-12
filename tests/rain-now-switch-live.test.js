// The live scorer for the coast-only "Rain's here" by description (review/accuracy/live/rain-now-switch-lib.mjs),
// on reads shaped exactly like the hourly recorder's lines (record.mjs): an airport read with its METAR, a spot read
// (Strand: icao null, spot + lat/lon, no METAR). It must re-run the app's own ladder on the recorded inputs, gate by
// the read's own coordinates, leave inland reads exactly as served, and never count an hour a storm took.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rainNowRead, rainNowSwitchScore } from '../review/accuracy/live/rain-now-switch-lib.mjs';

const incident = JSON.parse(readFileSync(new URL('../review/accuracy/incidents/strand-2026-10-12-2055.json', import.meta.url), 'utf8'));
const VOTES = [
  { source: 'Open-Meteo', desc: 'Slight rain', vote: 'rain' }, { source: 'WeatherAPI', desc: 'Light drizzle', vote: 'rain' },
  { source: 'Pirate Weather', desc: 'Cloudy', vote: 'cloudy' }, { source: 'MET Norway', desc: 'Heavy rain', vote: 'rain' },
  { source: 'Tomorrow.io', desc: 'Light fog', vote: 'fog' },
];
// the 20:55 hour as production recorded it, before the rule existed (no rainSources / rainFamilies / rainDescRegion)
const { rainSources, rainFamilies, rainDescRegion, ...recordedInputs } = { ...incident.payload.now.conditionSignals.selector.inputs, precipMm: 1, rainChance: 46.5, rainVotes: 3 };
const T = '2026-10-12T18:55:00.000Z';
const read = ({ icao = 'FACT', lat = -33.9648, lon = 18.6017, spot, key = 'rain-possible', reason = 'desc-rain-unconfirmed', wx = '-RA', inputs = recordedInputs, runAtUtc = T } = {}) => ({
  v: 1, runAtUtc, icao: spot ? null : icao, ...(spot ? { spot, city: spot } : { city: icao }), lat, lon, servedVersion: '765f955',
  api: { atUtc: runAtUtc, payload: { ok: true, now: { conditionKey: key, conditionReason: reason,
    conditionSignals: { sourceVotes: VOTES, numeric: { rainChance: inputs.rainChance, precipMm: inputs.precipMm }, selector: { inputs, base: { key, reason } } } } } },
  metar: spot ? undefined : { reports: [{ icaoId: icao, obsTime: Date.parse(runAtUtc) / 1000, wxString: wx }] },
});

describe('live scorer — the coast switch on recorder reads', () => {
  it('Cape Town airport (Western Cape): today might-rain, switch rain, wet', () => {
    const x = rainNowRead(read());
    expect(x.region).toBe('Western Cape');
    expect(x.rules).toMatchObject({ today: false, switch: true, everywhere: true, served: false });
  });
  it('Johannesburg (Highveld), the same words: switch stays today', () => {
    const x = rainNowRead(read({ icao: 'FAOR', lat: -26.1392, lon: 28.246 }));
    expect(x.region).toBe('Highveld');
    expect(x.rules).toMatchObject({ today: false, switch: false, everywhere: true });
  });
  it('a Strand spot read (icao null, spot + lat/lon) is gated by its own coordinates', () => {
    const x = rainNowRead(read({ spot: 'Strand', lat: -34.1163, lon: 18.8362 }));
    expect(x.region).toBe('Western Cape');
    expect(x.rules.switch).toBe(true);
  });
  it('an hour a storm took after the selector is not counted as rain', () => {
    expect(rainNowRead(read({ key: 'storm', reason: 'tomorrow-io-thunder' })).rules.switch).toBe(false);
  });
  it('the ladder is really re-run: a higher rung on the same inputs (extreme heat) keeps the switch off', () => {
    expect(rainNowRead(read({ inputs: { ...recordedInputs, tempC: 38 } })).rules.switch).toBe(false);
  });
  it('a read already served by the rule is not "today", and served matches switch', () => {
    const x = rainNowRead(read({ key: 'rain', reason: 'rain-now-descriptive' }));
    expect(x.rules).toMatchObject({ today: false, switch: true, served: true });
  });
  it('scores per region and coast/inland, airports only, and filters by real time', () => {
    const recs = [read(), read({ icao: 'FAOR', lat: -26.1392, lon: 28.246, wx: '' }), read({ spot: 'Strand', lat: -34.1163, lon: 18.8362 }),
      read({ runAtUtc: '2026-10-12T22:10:00.5+00:00' })];
    const all = rainNowSwitchScore(recs);
    expect(all.reads).toBe(3);   // the spot read has no METAR
    expect(all.groups.coast.switch).toEqual({ calls: 2, right: 2, wet: 2, caught: 2 });
    expect(all.groups.inland.switch).toEqual(all.groups.inland.today);
    expect(rainNowSwitchScore(recs, { sinceUtc: '2026-10-12T21:00:00Z' }).reads).toBe(1);
    expect(() => rainNowSwitchScore(recs, { sinceUtc: 'not a time' })).toThrow();
    expect(() => rainNowSwitchScore(recs, { sinceUtc: '' })).toThrow();
  });
});
