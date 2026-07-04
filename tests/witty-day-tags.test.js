import { describe, expect, it } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import {
  WITTY_DAY_TAGS,
  dayTagAllows,
  dayAwarePool,
  eligibleWittyPool,
  resolveNightAwareCopyCondition,
  timeSlotForHour,
} from '../assets/witty-day-tags.js';

// ---------------------------------------------------------------------------
// Structural day-tagging (2026-07-02, H-1 + M-1). Replaces the old
// WEEKDAY_ONLY_FRAGMENTS substring blocklist. dayAwarePool() is the single
// enforcement point; these tests probe it across all 7 days × 5 languages.
// ---------------------------------------------------------------------------

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SEASONS = [{ name: 'summer', month: 1 }, { name: 'winter', month: 7 }];
const PRE_SUNRISE_HOURS = [5, 6, 7];
const PROBE_LOCATIONS = [
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Joburg', lat: -26.2041, lon: 28.0473 },
  { name: 'Bloemfontein', lat: -29.0852, lon: 26.1596 },
  { name: 'Beaufort West', lat: -32.3567, lon: 22.5820 },
  { name: 'Durban', lat: -29.8587, lon: 31.0218 },
];
const groups = { witty: WEATHER_COPY.witty, witty_low_confidence: WEATHER_COPY.witty_low_confidence };
const tagDay = (tag) => (typeof tag === 'string' ? tag : tag?.day);
const tagObj = (tag) => (typeof tag === 'string' ? { day: tag } : (tag || {}));
const sampleHour = { morning: 6, day: 13, evening: 18, night: 22 };
const sampleRegion = {
  'western-cape': PROBE_LOCATIONS[0],
  gauteng: PROBE_LOCATIONS[1],
  highveld: PROBE_LOCATIONS[1],
  'free-state': PROBE_LOCATIONS[2],
  karoo: PROBE_LOCATIONS[3],
};

describe('dayTagAllows — semantics', () => {
  it('weekday = Mon–Fri only', () => {
    expect(DAYS.map((d) => dayTagAllows('weekday', d, 12))).toEqual([false, true, true, true, true, true, false]);
  });
  it('weekend = Sat/Sun + Fri-evening', () => {
    expect(DAYS.map((d) => dayTagAllows('weekend', d, 12))).toEqual([true, false, false, false, false, false, true]);
    expect(dayTagAllows('weekend', 5, 17)).toBe(true); // Fri 17:00
    expect(dayTagAllows('weekend', 5, 10)).toBe(false); // Fri morning
  });
  it('day-named = that day only', () => {
    expect(DAYS.map((d) => dayTagAllows('tue', d, 12))).toEqual([false, false, true, false, false, false, false]);
    expect(DAYS.map((d) => dayTagAllows('sat', d, 12))).toEqual([false, false, false, false, false, false, true]);
    expect(DAYS.map((d) => dayTagAllows('mon', d, 12))).toEqual([false, true, false, false, false, false, false]);
  });
  it('absent tag = any day', () => {
    expect(DAYS.every((d) => dayTagAllows(undefined, d, 12))).toBe(true);
  });
});

describe('timeSlotForHour — owner slot law', () => {
  it('maps morning/day/evening/night on the ruled boundaries', () => {
    expect(timeSlotForHour(4)).toBe('night');
    expect(timeSlotForHour(5)).toBe('morning');
    expect(timeSlotForHour(11)).toBe('morning');
    expect(timeSlotForHour(12)).toBe('day');
    expect(timeSlotForHour(16)).toBe('day');
    expect(timeSlotForHour(17)).toBe('evening');
    expect(timeSlotForHour(20)).toBe('evening');
    expect(timeSlotForHour(21)).toBe('night');
  });
});

describe('night witty bin — 05:00 cap', () => {
  it('maps clear solar-night copy to night only from 21:00 through 04:59', () => {
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'night', hour: 4 })).toBe('night');
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'night', hour: 21 })).toBe('night');
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'night', hour: 5 })).toBe('clear');
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'night', hour: 6 })).toBe('clear');
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'night', hour: 7 })).toBe('clear');
    expect(resolveNightAwareCopyCondition({ displayCondition: 'clear', timeOfDay: 'dawn', hour: 4 })).toBe('clear');
  });

  it('direct night-bin requests fall back to the underlying pool outside 21:00-04:59', () => {
    const nightLine = WEATHER_COPY.witty.night.en[0];
    const allowed = eligibleWittyPool({
      copy: WEATHER_COPY,
      tags: WITTY_DAY_TAGS,
      condition: 'night',
      lang: 'en',
      context: { day: 1, hour: 4, month: 7, fallbackCondition: 'clear' },
    }).pool;
    const capped = eligibleWittyPool({
      copy: WEATHER_COPY,
      tags: WITTY_DAY_TAGS,
      condition: 'night',
      lang: 'en',
      context: { day: 1, hour: 5, month: 7, fallbackCondition: 'clear' },
    }).pool;
    expect(allowed).toContain(nightLine);
    expect(capped).not.toContain(nightLine);
    expect(capped).toEqual(dayAwarePool(WITTY_DAY_TAGS.witty.clear, WEATHER_COPY.witty.clear.en, { day: 1, hour: 5, month: 7 }));
  });
});

describe('no day-named line can render on the wrong day (7 days × 5 langs)', () => {
  // For every day-specific tag, the tagged line at that index must be absent from
  // the pool on disallowed days and present on allowed days, in EVERY language.
  const dayTags = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (const [ns, binMap] of Object.entries(WITTY_DAY_TAGS)) {
    for (const [bin, tags] of Object.entries(binMap)) {
      for (const [idxStr, tag] of Object.entries(tags)) {
        const dayTag = tagDay(tag);
        if (!dayTags.includes(dayTag)) continue;
        const idx = Number(idxStr);
        for (const lang of LANGS) {
          const arr = groups[ns][bin][lang];
          const line = arr[idx];
          it(`${ns}.${bin}[${idx}] (${dayTag}) "${String(line).slice(0, 24)}" — ${lang}: only on its day`, () => {
            for (const day of DAYS) {
              const pool = dayAwarePool(tags, arr, { day, hour: 12, month: 7 });
              const present = pool.includes(line);
              // present iff the tag allows this day (fallback can't resurrect it
              // because other lines in the bin are always available)
              expect(present).toBe(dayTagAllows(dayTag, day, 12));
            }
          });
        }
      }
    }
  }
});

describe('braai plan is weekend-gated, imagery is any-day', () => {
  const pc = WEATHER_COPY.witty['partly-cloudy'];
  it('"Almost a braai day." (plan) absent on weekdays, present on weekend', () => {
    const line = pc.en[12];
    expect(dayAwarePool(WITTY_DAY_TAGS.witty['partly-cloudy'], pc.en, { day: 2, hour: 12, month: 7 }).includes(line)).toBe(false); // Tue
    expect(dayAwarePool(WITTY_DAY_TAGS.witty['partly-cloudy'], pc.en, { day: 6, hour: 12, month: 7 }).includes(line)).toBe(true);  // Sat
  });
  it('braai imagery ("The braai is cancelled.") shows any day', () => {
    const line = WEATHER_COPY.witty.storm.en[9];
    for (const day of DAYS) {
      expect(dayAwarePool(WITTY_DAY_TAGS.witty.storm, WEATHER_COPY.witty.storm.en, { day, hour: 12, month: 7 }).includes(line)).toBe(true);
    }
  });
});

describe('every bin/lang/day yields a non-empty pool', () => {
  for (const [ns, obj] of Object.entries(groups)) {
    for (const bin of Object.keys(obj)) {
      if (bin === '_meta') continue;
      const entry = obj[bin];
      if (!entry || !Array.isArray(entry.en)) continue;
      const tags = (WITTY_DAY_TAGS[ns] || {})[bin];
      for (const lang of LANGS) {
        for (const day of DAYS) {
          it(`${ns}.${bin}.${lang} day ${day} non-empty`, () => {
            const pool = dayAwarePool(tags, entry[lang], { day, hour: 12, month: 7 });
            expect(pool.length).toBeGreaterThanOrEqual(1);
            expect(pool.every((s) => typeof s === 'string' && s.trim() !== '')).toBe(true);
          });
        }
      }
    }
  }
});

describe('every bin/lang/day/hour/month/probe location yields a non-empty pool', () => {
  it('covers full Layer-1 context grid, including thin pools', () => {
    let checked = 0;
    for (const [ns, obj] of Object.entries(groups)) {
      for (const bin of Object.keys(obj)) {
        if (bin === '_meta') continue;
        const entry = obj[bin];
        if (!entry || !Array.isArray(entry.en)) continue;
        const tags = (WITTY_DAY_TAGS[ns] || {})[bin];
        for (const lang of LANGS) {
          for (const day of DAYS) {
            for (const hour of HOURS) {
              for (const month of MONTHS) {
                for (const place of PROBE_LOCATIONS) {
                  const pool = dayAwarePool(tags, entry[lang], { day, hour, month, lat: place.lat, lon: place.lon });
                  checked += 1;
                  if (pool.length < 1) {
                    throw new Error(`${ns}.${bin}.${lang} empty at day=${day} hour=${hour} month=${month} place=${place.name}`);
                  }
                  if (!pool.every((s) => typeof s === 'string' && s.trim() !== '')) {
                    throw new Error(`${ns}.${bin}.${lang} blank line at day=${day} hour=${hour} month=${month} place=${place.name}`);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(1360800);
  }, 15000);
});

describe('05:00-sunrise dark fallback grid', () => {
  it('falls back to the underlying normal pool across bin/lang/hour/season/proof-city', () => {
    const displayBins = Object.keys(WEATHER_COPY.witty).filter((bin) => bin !== 'weekend');
    let checked = 0;
    for (const bin of displayBins) {
      for (const lang of LANGS) {
        for (const hour of PRE_SUNRISE_HOURS) {
          for (const season of SEASONS) {
            for (const place of PROBE_LOCATIONS) {
              const fallbackCondition = bin === 'night' ? 'clear' : bin;
              const resolved = resolveNightAwareCopyCondition({
                displayCondition: bin,
                timeOfDay: 'night',
                hour,
                fallbackCondition,
              });
              const result = eligibleWittyPool({
                copy: WEATHER_COPY,
                tags: WITTY_DAY_TAGS,
                condition: resolved,
                lang,
                context: {
                  day: 1,
                  hour,
                  month: season.month,
                  lat: place.lat,
                  lon: place.lon,
                  fallbackCondition,
                },
              });
              checked += 1;
              if (result.pool.length < 1) {
                throw new Error(`${bin}.${lang} empty at ${hour}:00 ${season.name} ${place.name}`);
              }
              expect(result.bin, `${bin}.${lang} ${hour}:00 ${season.name} ${place.name}`).not.toBe('night');
            }
          }
        }
      }
    }
    expect(checked).toBe(displayBins.length * LANGS.length * PRE_SUNRISE_HOURS.length * SEASONS.length * PROBE_LOCATIONS.length);
  });
});

describe('context tags exclude their ruled lines outside their context', () => {
  const baseContextFor = (tag) => {
    const t = tagObj(tag);
    const day = t.day === 'sun' ? 0
      : t.day === 'sat' || t.day === 'weekend' ? 6
        : t.day && t.day !== 'weekday' ? DAYS.find((d) => dayTagAllows(t.day, d, 12))
          : 1;
    const hour = t.time ? sampleHour[(Array.isArray(t.time) ? t.time[0] : t.time)] : 12;
    const month = t.months ? (Array.isArray(t.months) ? t.months[0] : t.months) : 7;
    const region = Array.isArray(t.region) ? t.region[0] : t.region;
    const place = region ? sampleRegion[region] : PROBE_LOCATIONS[4];
    return { day, hour, month, lat: place.lat, lon: place.lon };
  };

  for (const [ns, binMap] of Object.entries(WITTY_DAY_TAGS)) {
    for (const [bin, tags] of Object.entries(binMap)) {
      for (const [idxStr, tag] of Object.entries(tags)) {
        const idx = Number(idxStr);
        const t = tagObj(tag);
        for (const lang of LANGS) {
          const arr = groups[ns][bin][lang];
          const line = arr[idx];

          if (t.time) {
            const slots = Array.isArray(t.time) ? t.time : [t.time];
            for (const [slot, hour] of Object.entries(sampleHour)) {
              if (slots.includes(slot)) continue;
              it(`${ns}.${bin}[${idx}] ${lang} excluded outside time slot ${slot}`, () => {
                const pool = dayAwarePool(tags, arr, { ...baseContextFor(t), hour });
                expect(pool).not.toContain(line);
              });
            }
          }

          if (t.region) {
            const regions = Array.isArray(t.region) ? t.region : [t.region];
            for (const place of PROBE_LOCATIONS) {
              if (regions.some((region) => sampleRegion[region]?.name === place.name)) continue;
              it(`${ns}.${bin}[${idx}] ${lang} excluded outside region at ${place.name}`, () => {
                const pool = dayAwarePool(tags, arr, { ...baseContextFor(t), lat: place.lat, lon: place.lon });
                expect(pool).not.toContain(line);
              });
            }
          }

          if (t.months) {
            const months = Array.isArray(t.months) ? t.months : [t.months];
            for (const month of MONTHS) {
              if (months.includes(month)) continue;
              it(`${ns}.${bin}[${idx}] ${lang} excluded outside month ${month}`, () => {
                const pool = dayAwarePool(tags, arr, { ...baseContextFor(t), month });
                expect(pool).not.toContain(line);
              });
            }
          }
        }
      }
    }
  }

  it('Karoo-morning cold-clear[16] never fires in Joburg nor at 19:23 anywhere', () => {
    const tags = WITTY_DAY_TAGS.witty['cold-clear'];
    const line = WEATHER_COPY.witty['cold-clear'].en[16];
    expect(dayAwarePool(tags, WEATHER_COPY.witty['cold-clear'].en, {
      day: 1,
      hour: 6,
      month: 7,
      lat: PROBE_LOCATIONS[1].lat,
      lon: PROBE_LOCATIONS[1].lon,
    })).not.toContain(line);
    for (const place of PROBE_LOCATIONS) {
      expect(dayAwarePool(tags, WEATHER_COPY.witty['cold-clear'].en, {
        day: 1,
        hour: 19 + (23 / 60),
        month: 7,
        lat: place.lat,
        lon: place.lon,
      }), place.name).not.toContain(line);
    }
  });

  it('Boland low-confidence fog line never fires outside the Western Cape box', () => {
    const tags = WITTY_DAY_TAGS.witty_low_confidence.fog;
    const line = WEATHER_COPY.witty_low_confidence.fog.en[1];
    for (const place of PROBE_LOCATIONS.slice(1)) {
      expect(dayAwarePool(tags, WEATHER_COPY.witty_low_confidence.fog.en, {
        day: 1,
        hour: 9,
        month: 7,
        lat: place.lat,
        lon: place.lon,
      }), place.name).not.toContain(line);
    }
  });

  it('summer-admin partly-cloudy[16] never fires in July', () => {
    const tags = WITTY_DAY_TAGS.witty['partly-cloudy'];
    const line = WEATHER_COPY.witty['partly-cloudy'].en[16];
    for (const place of PROBE_LOCATIONS) {
      for (const day of DAYS) {
        for (const hour of HOURS) {
          expect(dayAwarePool(tags, WEATHER_COPY.witty['partly-cloudy'].en, {
            day,
            hour,
            month: 7,
            lat: place.lat,
            lon: place.lon,
          }), `${place.name} day=${day} hour=${hour}`).not.toContain(line);
        }
      }
    }
  });
});
