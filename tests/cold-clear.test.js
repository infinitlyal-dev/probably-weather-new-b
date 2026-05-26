// Cold-clear condition — algorithm + emoji + copy + routing integration tests.
//
// Cold-clear is the Highveld dry-cold-with-blue-sky register. It must:
//   1. Be emitted by deriveCondition when (chilly signal) AND clear sky AND no rain.
//   2. NOT be emitted when overcast (that's regular 'cold') or wet (that's 'rain').
//   3. Route to the 'cold' vote bucket so ensemble voting treats it like a cold signal.
//   4. Render an emoji for both day and night.
//   5. Have heroLabels / headlines / witty copy in all 5 languages.
//   6. Pass through middleware's ALLOWLIST so static-OG ?bg=cold-clear works.

import { describe, expect, it } from 'vitest';
import { deriveCondition, conditionKeyToVoteBucket } from '../api/weather.js';
import { pickConditionEmojiForTime, __WEATHER_EMOJI_MAP } from '../assets/weather-emoji.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';

const baseClear = { desc: 'Clear sky', rainChance: 0, windKph: 5, cloudPct: 10, isDay: true };

describe('deriveCondition — cold-clear emission', () => {
  it("emits 'cold-clear' when current temp is chilly + sky is clear + no rain", () => {
    const r = deriveCondition({ ...baseClear, tempC: 8 });
    expect(r.key).toBe('cold-clear');
    expect(r.reason).toBe('dry-cold-clear-sky');
  });

  it("emits 'cold-clear' on a 15°C day with feels-like 8°C (windchill makes it chilly)", () => {
    const r = deriveCondition({ ...baseClear, tempC: 15, feelsLikeC: 8 });
    expect(r.key).toBe('cold-clear');
  });

  it("emits 'cold-clear' on an 18°C day with dailyLow 4°C (cold morning, warm afternoon)", () => {
    const r = deriveCondition({ ...baseClear, tempC: 18, dailyLowC: 4 });
    expect(r.key).toBe('cold-clear');
  });

  it("emits 'cold-clear' on an extreme-cold-but-clear day (steals from regular 'cold')", () => {
    // Per spec: cold-clear rung positioned ABOVE the extreme-cold rung so a -3°C
    // clear morning routes to cold-clear, not the generic 'cold' bucket.
    const r = deriveCondition({ ...baseClear, tempC: -3, feelsLikeC: -6 });
    expect(r.key).toBe('cold-clear');
  });

  it("emits 'cold-clear' at the cloudPct=29 upper edge", () => {
    const r = deriveCondition({ ...baseClear, tempC: 8, cloudPct: 29 });
    expect(r.key).toBe('cold-clear');
  });

  it("emits 'cold-clear' at the rainChance=19 upper edge", () => {
    const r = deriveCondition({ ...baseClear, tempC: 8, rainChance: 19 });
    expect(r.key).toBe('cold-clear');
  });
});

describe('deriveCondition — cold-clear NEGATIVE cases (must NOT emit cold-clear)', () => {
  it("does NOT emit 'cold-clear' when overcast — overcast cold belongs to 'cold'", () => {
    const r = deriveCondition({ ...baseClear, tempC: 8, cloudPct: 80 });
    // Storm wins on desc 'Cloudy'-like content? No — desc is 'Clear sky'.
    // Cold-clear gated out by cloudPct >= 30. Falls through past UV (no uvIndex),
    // wind, rain, etc. Hits rung 11 overcast → 'cloudy'. Then rung 14 chilly with
    // daily gate would have fired but cloudy wins first.
    expect(r.key).toBe('cloudy');
  });

  it("does NOT emit 'cold-clear' when rain is likely — rain wins regardless of cold", () => {
    const r = deriveCondition({ ...baseClear, tempC: 8, rainChance: 40 });
    expect(r.key).toBe('rain');
  });

  it("does NOT emit 'cold-clear' when temperature is mild (not chilly)", () => {
    const r = deriveCondition({ ...baseClear, tempC: 15 });
    // No cold signal → falls through to 'clear' fallback.
    expect(r.key).toBe('clear');
  });

  it("does NOT emit 'cold-clear' on a hot day, even with clear sky", () => {
    const r = deriveCondition({ ...baseClear, tempC: 32 });
    expect(r.key).toBe('heat');
  });

  it("WITH desc 'Clear sky' but no cloudPct, cold-clear DOES fire via desc-based clear-sky satisfaction", () => {
    // Codex review finding #21: a MET-Norway-style payload without cloudPct
    // but with a clear desc should still emit cold-clear, not silently fall
    // through to the regular chilly bucket. Desc is the fallback signal.
    const r = deriveCondition({ desc: 'Clear sky', rainChance: 0, windKph: 5, tempC: 8, isDay: true, dailyHighC: 12 });
    expect(r.key).toBe('cold-clear');
  });

  it("does NOT emit 'cold-clear' without cloud data AND without clear-desc signal", () => {
    // Without any clear-sky signal (no cloudPct, no clear/sunny/fair desc),
    // the gate correctly fails open — falls through to chilly-with-daily-gate.
    const r = deriveCondition({ desc: '', rainChance: 0, windKph: 5, tempC: 8, isDay: true, dailyHighC: 12 });
    expect(r.key).toBe('cold');
    expect(r.reason).toBe('chilly-with-daily-gate');
  });

  it("does NOT emit 'cold-clear' when a thunder/storm desc is present", () => {
    // Storm rung is BEFORE cold-clear in the ladder.
    const r = deriveCondition({ ...baseClear, desc: 'Thunderstorm', tempC: 8 });
    expect(r.key).toBe('storm');
  });

  // ─── Codex code-review-driven defensive cases ─────────────────────────────

  it("does NOT emit 'cold-clear' when desc says 'snow' even with clear cloudPct (winter-precip wins)", () => {
    const r = deriveCondition({ ...baseClear, desc: 'Light snow', tempC: 8 });
    expect(r.key).toBe('cold');
    expect(r.reason).toBe('desc-winter-precip');
  });

  it("does NOT emit 'cold-clear' when desc says 'light rain' with cloudPct=5, rainChance=0 (rain-desc wins)", () => {
    const r = deriveCondition({ ...baseClear, desc: 'Light rain', tempC: 10, cloudPct: 5 });
    expect(r.key).toBe('rain');
  });

  it("does NOT emit 'cold-clear' when desc says 'mist' with clear cloudPct (fog-desc wins)", () => {
    const r = deriveCondition({ ...baseClear, desc: 'mist', tempC: 9, cloudPct: 0 });
    expect(r.key).toBe('fog');
  });

  it("does NOT emit 'cold-clear' when desc says 'drizzle' even with no rainChance (be conservative)", () => {
    // rainChance undefined + drizzle desc → isDryDay falls back to desc check → false → cold-clear blocked
    const r = deriveCondition({ desc: 'drizzle', tempC: 10, cloudPct: 5, windKph: 5, isDay: true });
    expect(r.key).toBe('rain');
  });

  it("does NOT emit 'cold-clear' when dailyHighC > 18 (day will warm up — UV takes priority)", () => {
    // Codex finding #4 + #6 unified: a warm sunny day with high UV should NOT
    // collapse to cold-clear even if the current temp is at the cold-clear gate.
    const r = deriveCondition({ ...baseClear, tempC: 12, feelsLikeC: 12, uvIndex: 10, dailyHighC: 22 });
    expect(r.key).toBe('uv');
  });

  it("does NOT emit 'cold-clear' on a daily call where highC=22 + lowC=5 (warm-after-cold-morning)", () => {
    // Daily callsite passes tempC=highC + dailyLowC. cold-clear gate must
    // recognise this as "morning was cold but day is warm" → not cold-clear.
    const r = deriveCondition({ desc: 'Clear sky', tempC: 22, dailyLowC: 5, dailyHighC: 22, cloudPct: 0, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).not.toBe('cold-clear');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// New positive-case coverage prompted by code review
// ──────────────────────────────────────────────────────────────────────────

describe('deriveCondition — cold-clear with desc fallback (Codex finding #21)', () => {
  it("emits 'cold-clear' on missing cloudPct when desc says 'sunny'", () => {
    const r = deriveCondition({ desc: 'sunny', tempC: 8, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).toBe('cold-clear');
  });

  it("emits 'cold-clear' on missing cloudPct when desc says 'fair'", () => {
    const r = deriveCondition({ desc: 'fair', tempC: 8, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).toBe('cold-clear');
  });

  it("does NOT emit 'cold-clear' on missing cloudPct with a vague desc", () => {
    const r = deriveCondition({ desc: 'pleasant', tempC: 8, rainChance: 0, windKph: 5, isDay: true, dailyHighC: 12 });
    expect(r.key).not.toBe('cold-clear');
  });
});

describe('deriveCondition — daily-callsite semantics (Codex finding #20)', () => {
  it("daily call: highC=11, lowC=10, clear → cold-clear (genuinely cold all day)", () => {
    const r = deriveCondition({ desc: 'Clear sky', tempC: 11, dailyLowC: 10, dailyHighC: 11, cloudPct: 0, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).toBe('cold-clear');
  });

  it("daily call: highC=18, lowC=4, clear → cold-clear (cold morning, mild afternoon)", () => {
    const r = deriveCondition({ desc: 'Clear sky', tempC: 18, dailyLowC: 4, dailyHighC: 18, cloudPct: 5, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).toBe('cold-clear');
  });

  it("daily call: highC=22, lowC=5, clear → NOT cold-clear (day warms above 18°C threshold)", () => {
    const r = deriveCondition({ desc: 'Clear sky', tempC: 22, dailyLowC: 5, dailyHighC: 22, cloudPct: 0, rainChance: 0, windKph: 5, isDay: true });
    expect(r.key).not.toBe('cold-clear');
  });
});

describe('conditionKeyToVoteBucket', () => {
  it("routes 'cold-clear' to the 'cold' vote bucket", () => {
    expect(conditionKeyToVoteBucket('cold-clear')).toBe('cold');
  });

  it("still routes 'cold' to the 'cold' vote bucket (unchanged)", () => {
    expect(conditionKeyToVoteBucket('cold')).toBe('cold');
  });

  it("unaffected keys still route correctly", () => {
    expect(conditionKeyToVoteBucket('storm')).toBe('storm');
    expect(conditionKeyToVoteBucket('rain')).toBe('rain');
    expect(conditionKeyToVoteBucket('cloudy')).toBe('cloudy');
    expect(conditionKeyToVoteBucket('fog')).toBe('fog');
    expect(conditionKeyToVoteBucket('clear')).toBe('clear');
    expect(conditionKeyToVoteBucket('partly-cloudy')).toBe('clear');
  });
});

describe('weather-emoji — cold-clear', () => {
  it('has a CONDITION_EMOJI_MAP entry for cold-clear', () => {
    expect(__WEATHER_EMOJI_MAP['cold-clear']).toBeDefined();
    expect(__WEATHER_EMOJI_MAP['cold-clear']).toHaveProperty('day');
    expect(__WEATHER_EMOJI_MAP['cold-clear']).toHaveProperty('night');
  });

  it('returns the cold-clear day emoji', () => {
    expect(pickConditionEmojiForTime('cold-clear', true)).toBe('🥶');
  });

  it('returns the cold-clear night emoji', () => {
    expect(pickConditionEmojiForTime('cold-clear', false)).toBe('🥶');
  });

  it('does not fall back to the default emoji', () => {
    // Default pair is { day: '⛅', night: '☁️' } — if cold-clear ever falls
    // through to that, the visual signal is wrong.
    expect(pickConditionEmojiForTime('cold-clear', true)).not.toBe('⛅');
    expect(pickConditionEmojiForTime('cold-clear', false)).not.toBe('☁️');
  });
});

describe('weather-copy — cold-clear has entries in all 5 languages', () => {
  const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

  it.each(LANGS)('heroLabels has cold-clear[%s]', (lang) => {
    const entry = WEATHER_COPY.heroLabels['cold-clear'];
    expect(entry).toBeDefined();
    expect(typeof entry[lang]).toBe('string');
    expect(entry[lang].length).toBeGreaterThan(0);
  });

  it.each(LANGS)('headlines has cold-clear[%s]', (lang) => {
    const entry = WEATHER_COPY.headlines['cold-clear'];
    expect(entry).toBeDefined();
    expect(typeof entry[lang]).toBe('string');
    expect(entry[lang].length).toBeGreaterThan(0);
  });

  it.each(LANGS)('witty has cold-clear[%s] as a non-empty array', (lang) => {
    const entry = WEATHER_COPY.witty['cold-clear'];
    expect(entry).toBeDefined();
    expect(Array.isArray(entry[lang])).toBe(true);
    expect(entry[lang].length).toBeGreaterThanOrEqual(15);
  });

  it('witty entries are unique per language (no duplicates within a bin)', () => {
    for (const lang of LANGS) {
      const lines = WEATHER_COPY.witty['cold-clear'][lang];
      expect(new Set(lines).size).toBe(lines.length);
    }
  });
});

describe('middleware — cold-clear in CONDITION_ALLOWLIST', () => {
  it('includes cold-clear in the ?bg= allowlist', async () => {
    const src = (await import('node:fs')).readFileSync(
      new URL('../middleware.js', import.meta.url),
      'utf8'
    );
    expect(src).toMatch(/'cold-clear'/);
  });
});
