import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function loadGetDayBadge(currentHour) {
  const source = appSource.match(/function getDayBadge\(d, dayIndex, hourlyData\) \{[\s\S]*?\n  \}/)?.[0];
  if (!source) throw new Error('getDayBadge source not found');
  return new Function(
    't',
    'isNum',
    'getLocationHour',
    'activePlace',
    'THRESH',
    `${source}; return getDayBadge;`,
  )(
    (_namespace, key) => key,
    (value) => typeof value === 'number' && Number.isFinite(value),
    () => currentHour,
    { lon: 18.8 },
    { HOT_C: 35 },
  );
}

describe('getDayBadge rain timing', () => {
  it("B4 ignores past rain slots and uses today's future slot as the clock hour", () => {
    const getDayBadge = loadGetDayBadge(15);
    const hourly = Array.from({ length: 24 }, () => ({ rainChance: 0 }));
    hourly[2].rainChance = 90;  // 02:00 — already passed
    hourly[19].rainChance = 90; // 19:00 — next rain

    const badge = getDayBadge({ conditionKey: 'rain-possible', rainChance: 30 }, 0, hourly);

    expect(badge).toBe('rainTonight');
  });

  it('B4 uses a non-timing badge when every qualifying rain slot is already past', () => {
    const getDayBadge = loadGetDayBadge(15);
    const hourly = Array.from({ length: 24 }, () => ({ rainChance: 0 }));
    hourly[2].rainChance = 90;

    const badge = getDayBadge({ conditionKey: 'rain-possible', rainChance: 50 }, 0, hourly);

    expect(badge).toBe('showers');
  });
});
