// Part B item 2 (Al, 7 Oct 2026): the phone's "rain later" reads the next 8 hours, not the whole day,
// and the server's fog stands over it.
//
// Replay case — Cape Town airport, 16 Sept 2026, 08:00 (review/accuracy harness): the day's blended
// chance was 69.5 % (its rain was over), every hour from 08:00 to 19:00 was 20 % or less, and the
// airport reported SCT030, no rain. The old rule (day ≥ 50 %, next 4 hours < 30 %) put "Might rain."
// and a cloudy photograph on the hero all morning.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing from app.js`).toBeGreaterThan(-1);
  return js.slice(start, js.indexOf('\n  }', start) + 4);
};
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const noop = () => {};
const CLIENT_SCHEMA_MIN = Number(js.match(/const PAYLOAD_SCHEMA_MIN = (\d+);/)[1]);
const normalizePayload = new Function('isNum', 'debugLog', 'PAYLOAD_SCHEMA_MIN', `${sliceFn('normalizePayload')}; return normalizePayload;`)(isNum, noop, CLIENT_SCHEMA_MIN);
const computeSkyCondition = new Function('isNum', 'debugLog', `${sliceFn('computeSkyCondition')}; return computeSkyCondition;`)(isNum, noop);
const computeHomeDisplayCondition = new Function('isNum', 'debugLog', 'computeSkyCondition', 'THRESH',
  `${sliceFn('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`)(isNum, noop, computeSkyCondition, { HOT_C: 35 });

// Hours 08:00–19:00 as the harness replayed them; the rest of the 48 dry.
const CAPE_TOWN_0916 = [20.2, 10.8, 4.2, 0, 0, 0, 0, 0, 0, 0, 0, 4.6];
const payload = ({ conditionKey = 'clear', laterHours = null } = {}) => {
  const hourly = Array.from({ length: 48 }, (_, i) => ({ rainChance: i >= 8 && i < 20 ? CAPE_TOWN_0916[i - 8] : 0, cloudPct: 40 }));
  if (laterHours) for (const i of [12, 13, 14, 15]) hourly[i].rainChance = laterHours;
  return {
    ok: true,
    now: { tempC: 12, windKph: 13, cloudPct: 40, isDay: true, rainChance: 20.2, conditionKey, conditionReason: 'x' },
    daily: [{ highC: 17, lowC: 9, rainChance: 69.5, conditionKey: 'rain' }],
    hourly,
    meta: { localHour: 8, sources: [], sourceConditions: [], schema: 5 },
  };
};

describe('rain later = the next 8 hours, not the day', () => {
  it('Cape Town 16 Sept 08:00: a 69.5 % day whose rain is over is no longer "Might rain."', () => {
    const norm = normalizePayload(payload());
    expect(norm.rainLater).toBe(false);
    expect(computeHomeDisplayCondition(norm)).not.toBe('rain-possible');
  });

  it('an hour of 50 %+ in hours 5–8 ahead is still "rain later"', () => {
    const norm = normalizePayload(payload({ laterHours: 60 }));
    expect(norm.rainLater).toBe(true);
    expect(computeHomeDisplayCondition(norm)).toBe('rain-possible');
  });

  it('rain 9 or more hours away is not "later" yet', () => {
    const p = payload();
    p.hourly[16].rainChance = 80; // 08:00 + 8 h
    expect(normalizePayload(p).rainLater).toBe(false);
  });

  it('the server\'s fog stands over a might-rain that is hours away', () => {
    const norm = normalizePayload(payload({ conditionKey: 'fog', laterHours: 60 }));
    expect(norm.rainLater).toBe(true);
    expect(computeHomeDisplayCondition(norm)).toBe('fog');
  });
});
