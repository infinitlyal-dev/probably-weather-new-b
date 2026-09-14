// Prelaunch item 4 (P1-3, 2026-09-14): the server's Tomorrow.io radar override
// (`conditionReason: "tomorrow-io-radar-override"`, now.rainChance >= 70,
// now.conditionKey 'rain') must survive to the HOME condition and probability.
//
// Astra's fixture: server says 70/rain by radar override, four sources vote
// clear and one votes rain, the next four hours' model probability is 10%.
// The old frontend returned { homeRain: 10, homeCondition: 'clear' }.

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
// The production minimum, read from source — never injected (Astra, item 6 minor).
const CLIENT_SCHEMA_MIN = Number(js.match(/const PAYLOAD_SCHEMA_MIN = (\d+);/)[1]);

const normalizePayload = new Function('isNum', 'debugLog', 'PAYLOAD_SCHEMA_MIN', `${sliceFn('normalizePayload')}; return normalizePayload;`)(isNum, noop, CLIENT_SCHEMA_MIN);
// computeSkyCondition is the last rung; stub it as 'clear' so the fixture's
// only path to 'rain' is the override (or the majority vote it lacks).
const computeHomeDisplayCondition = new Function(
  'isNum', 'debugLog', 'computeSkyCondition',
  `${sliceFn('computeHomeDisplayCondition')}; return computeHomeDisplayCondition;`,
)(isNum, noop, () => 'clear');

const votes = (rain) => [
  { source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' },
  { source: 'WeatherAPI', desc: 'Sunny', vote: 'clear' },
  { source: 'Pirate Weather', desc: 'Clear', vote: 'clear' },
  { source: 'MET Norway', desc: 'Clear sky', vote: 'clear' },
  { source: 'Tomorrow.io', desc: 'Rain', vote: rain ? 'rain' : 'clear' },
];

const hourly = Array.from({ length: 48 }, () => ({ rainChance: 10, uv: 1 }));

const serverOverridePayload = (extraNow = {}) => ({
  ok: true,
  now: {
    tempC: 15.5, windKph: 12, cloudPct: 20, isDay: true,
    rainChance: 70,
    conditionKey: 'rain',
    conditionReason: 'tomorrow-io-radar-override',
    conditionSignals: { overrides: [{ rule: 'tomorrow-io-radar-override', from: 'clear', to: 'rain' }] },
    ...extraNow,
  },
  daily: [{ highC: 18, lowC: 12, rainChance: 20, conditionKey: 'clear' }],
  hourly,
  meta: { localHour: 8, sources: [], sourceConditions: votes(true) },
});

describe('item 4 — the server rain-now override survives to the home screen', () => {
  it("Astra's fixture: 70/rain by radar override → home shows rain at 70%, not clear at 10%", () => {
    const norm = normalizePayload(serverOverridePayload());
    expect(norm.rainNowOverride).toBe(true);
    expect(norm.rainPct).toBe(70);
    expect(computeHomeDisplayCondition(norm)).toBe('rain');
  });

  it('control: the same votes WITHOUT the override keep the old behaviour (10%, clear)', () => {
    const norm = normalizePayload(serverOverridePayload({
      rainChance: 25, conditionReason: 'heavy-rain-prob', conditionSignals: { overrides: [] },
    }));
    expect(norm.rainNowOverride).toBe(false);
    expect(norm.rainPct).toBe(10);
    expect(computeHomeDisplayCondition(norm)).toBe('clear');
  });

  it('the 4-hour slice still wins when it is higher than the override floor', () => {
    const wet = hourly.map((h, i) => (i >= 8 && i < 12 ? { ...h, rainChance: 85 } : h));
    const norm = normalizePayload({ ...serverOverridePayload(), hourly: wet });
    expect(norm.rainPct).toBe(85);
    expect(computeHomeDisplayCondition(norm)).toBe('rain');
  });

  it('thunder overriding the radar override keeps the rain probability and shows storm', () => {
    const norm = normalizePayload(serverOverridePayload({
      conditionKey: 'storm',
      conditionReason: 'tomorrow-io-thunder',
      conditionSignals: { overrides: [
        { rule: 'tomorrow-io-radar-override', from: 'clear', to: 'rain' },
        { rule: 'tomorrow-io-thunder', from: 'rain', to: 'storm' },
      ] },
    }));
    expect(norm.rainNowOverride).toBe(true);
    expect(norm.rainPct).toBe(70);
    expect(computeHomeDisplayCondition(norm)).toBe('storm');
  });

  it('a payload with no conditionSignals at all (older cache entry) never throws and never fakes an override', () => {
    const norm = normalizePayload(serverOverridePayload({ conditionReason: 'clear-default', conditionSignals: undefined }));
    expect(norm.rainNowOverride).toBe(false);
    expect(norm.rainPct).toBe(10);
  });
});

// Astra's review of the first cut: with daily >= 50% and the 4h slice < 30%,
// rainLater still fired and the stats row read "Rain 70% — Later" while radar
// said it was raining now. Rendered through the real stats row.
const T_EN = {
  weather: { wind: 'Wind', rain: 'Rain', uv: 'UV', uvMax: 'Max', gusts: 'gusts', none: 'None', unlikely: 'Unlikely', possible: 'Possible', likely: 'Likely', possibleLater: 'Possible later', later: 'Later', low: 'Low', moderate: 'Moderate', high: 'High', veryHigh: 'Very High' },
};
const makeStatsRow = () => {
  const el = { innerHTML: '' };
  const round0 = (n) => (isNum(n) ? Math.round(n) : null);
  const render = new Function(
    'statsRowEl', 'isNum', 't', 'round0', 'formatWind', 'windCompass', 'settings', 'debugLog',
    `${sliceFn('renderStatsRow')}; return renderStatsRow;`,
  )(el, isNum, (c, k) => T_EN[c]?.[k], round0, (kph) => `${round0(kph)} km/h`, () => '', { wind: 'kph' }, noop);
  return { el, render };
};

describe('item 4 — an active radar override never reads "Later"', () => {
  it('daily 66%, 4h slice 10%, radar 70% now → stats row says "Rain 70% Likely", not "Later"', () => {
    const payload = serverOverridePayload();
    payload.daily[0].rainChance = 66.2;
    const norm = normalizePayload(payload);
    expect(norm.rainLater).toBe(false);
    expect(norm.rainPct).toBe(70);
    const { el, render } = makeStatsRow();
    render(norm);
    expect(el.innerHTML).toContain('<div class="stat-k">Rain</div><div class="stat-v">70%</div><div class="stat-sub">Likely</div>');
    expect(el.innerHTML).not.toContain('Later');
  });

  it('control: without the override the same day still reads "Later" (dry now, wet later)', () => {
    const payload = serverOverridePayload({ rainChance: 25, conditionReason: 'heavy-rain-prob', conditionSignals: { overrides: [] } });
    payload.daily[0].rainChance = 66.2;
    const norm = normalizePayload(payload);
    expect(norm.rainLater).toBe(true);
    const { el, render } = makeStatsRow();
    render(norm);
    expect(el.innerHTML).toContain('<div class="stat-sub">Later</div>');
  });
});

// Astra round 2 (SHIP, minor): the byline is a second consumer of rainLater —
// assert it as rendered, with the same 70% now / 10% hourly / 66.2% daily fixture.
const makeByline = () => {
  const el = { innerHTML: '' };
  const start = js.indexOf("const bylineEl = $('#weatherByline')");
  const endMarker = "bylineEl.innerHTML = rows.join('');";
  const end = js.indexOf(endMarker, start) + endMarker.length;
  expect(start, 'byline block missing').toBeGreaterThan(-1);
  const src = js.slice(start, end) + ' }'; // close the enclosing if (bylineEl) { … }
  const round0 = (n) => (isNum(n) ? Math.round(n) : null);
  const render = new Function('$', 'norm', 'wind', 'rain', 'uv', 'currentTemp', 't', 'isNum', 'formatWind', 'formatTemp', 'round0', src);
  return {
    el,
    render: (norm) => render(() => el, norm, norm.windKph, norm.rainPct, norm.uv, norm.nowTemp, (c, k) => T_EN[c]?.[k], isNum, (kph) => `${round0(kph)} km/h`, (c) => `${round0(c)}°`, round0),
  };
};

describe('item 4 — the byline agrees with the stats row', () => {
  it('radar override + daily 66% → "Rain Likely", never "Rain Later"', () => {
    const payload = serverOverridePayload();
    payload.daily[0].rainChance = 66.2;
    const { el, render } = makeByline();
    render(normalizePayload(payload));
    expect(el.innerHTML).toContain('Rain Likely');
    expect(el.innerHTML).not.toContain('Later');
  });

  it('control: no override, same day → "Rain Later"', () => {
    const payload = serverOverridePayload({ rainChance: 25, conditionReason: 'heavy-rain-prob', conditionSignals: { overrides: [] } });
    payload.daily[0].rainChance = 66.2;
    const { el, render } = makeByline();
    render(normalizePayload(payload));
    expect(el.innerHTML).toContain('Rain Later');
  });
});
