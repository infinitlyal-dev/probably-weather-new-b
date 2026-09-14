import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { COPY_BANK, loadCopyBank } from '../assets/copy-loader.js';
import { INSTALL_T } from '../assets/install.js';

// Prelaunch P1-6 "Language leaks": with a non-English language selected the app
// still showed the provider's English condition label on the day-detail screen,
// English "Use my location" / "Search location" in the search panel, English
// settings prose (time-format options, feedback sentence, Privacy Policy), an
// English geolocation fallback toast, and English accessible names on the nav,
// share, hourly, my-location, back, language-picker, remove and dismiss
// controls.
//
// Two layers of assertion here. The BEHAVIOURAL blocks below extract the real
// functions out of assets/app.js and run them against the real catalogue in
// each language — a source-pattern test alone passes even when the catalogue
// hands back English, which is exactly the bug. The structural blocks then pin
// the wiring that behaviour cannot reach (markup ids, the elements
// updateUILanguage addresses).

const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const NON_EN = ['af', 'zu', 'xh', 'st'];

// ---------------------------------------------------------------------------
// Harness — the real T catalogue and the real functions that read it
// ---------------------------------------------------------------------------

function sliceObject(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced object literal at ${start}`);
}

function findEntry(src, name) {
  const re = new RegExp(`(^|[\\s{,])${name}\\s*:\\s*\\{`, 'g');
  let depth = 0;
  const memberStarts = new Set();
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') { if (depth === 1) memberStarts.add(i); depth++; }
    else if (src[i] === '}') depth--;
  }
  let m;
  while ((m = re.exec(src))) {
    const brace = m.index + m[0].length - 1;
    if (memberStarts.has(brace)) return sliceObject(src, brace);
  }
  return null;
}

const catalogueSrc = () => {
  const src = app();
  const i = src.indexOf('const T = {');
  if (i < 0) throw new Error('T catalogue not found in assets/app.js');
  return sliceObject(src, src.indexOf('{', i));
};

const updateUILanguageSrc = () => {
  const src = app();
  const i = src.indexOf('function updateUILanguage()');
  if (i < 0) throw new Error('updateUILanguage not found in assets/app.js');
  return sliceObject(src, src.indexOf('{', i));
};

// The real T object, built from app.js's own literal over the real COPY_BANK.
function buildCatalogue() {
  return new Function('COPY_BANK', `return ${catalogueSrc()};`)(COPY_BANK);
}

// The real condition-label chain: COPY_FALLBACK → getHeroLabel → WINTER_PRECIP
// → dayConditionLabel, lifted verbatim and closed over a T and a settings we
// control. If any of it starts returning English, these tests go red.
function loadConditionLabels(lang, T) {
  const src = app();
  const start = src.indexOf('const COPY_FALLBACK');
  const marker = 'function dayConditionLabel(day) {';
  const end = src.indexOf('\n  }', src.indexOf(marker)) + '\n  }'.length;
  if (start < 0 || end < start) throw new Error('condition-label block not found');
  const block = src.slice(start, end);
  const settings = { lang };
  const t = (category, key) => T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  return new Function('T', 't', 'settings', `${block}; return { dayConditionLabel, getHeroLabel, winterPrecipKey };`)(T, t, settings);
}

function loadGeolocationMessage(lang, T) {
  const src = app();
  const fn = src.match(/function getGeolocationErrorMessage\(err\) \{[\s\S]*?\n  \}/)?.[0];
  if (!fn) throw new Error('getGeolocationErrorMessage source not found');
  const t = (category, key) => T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  return new Function('t', 'isStandaloneMode', `${fn}; return getGeolocationErrorMessage;`)(t, () => false);
}

let T;
beforeAll(async () => {
  // Load every language bank so heroLabels carry all five, as they do at runtime.
  for (const lang of LANGS) await loadCopyBank(lang);
  T = buildCatalogue();
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — day-detail condition labels
// ---------------------------------------------------------------------------

describe('language leaks — day-detail condition label (behavioural)', () => {
  it('names an ordinary condition in the selected language, never the provider English', () => {
    // conditionLabel is what the provider sent: English, always.
    const cases = [
      { conditionKey: 'rain', conditionLabel: 'Slight rain showers' },
      { conditionKey: 'clear', conditionLabel: 'Sunny' },
      { conditionKey: 'cloudy', conditionLabel: 'Overcast' },
    ];
    for (const lang of NON_EN) {
      const { dayConditionLabel } = loadConditionLabels(lang, T);
      for (const day of cases) {
        const out = dayConditionLabel(day);
        expect(out, `${lang}/${day.conditionKey}`).toBe(T.heroLabels[day.conditionKey][lang]);
        expect(out, `${lang}/${day.conditionKey} leaked provider English`).not.toBe(day.conditionLabel);
        expect(out, `${lang}/${day.conditionKey} fell back to en`).not.toBe(T.heroLabels[day.conditionKey].en);
      }
    }
  });

  it('English still reads as English', () => {
    const { dayConditionLabel } = loadConditionLabels('en', T);
    expect(dayConditionLabel({ conditionKey: 'rain', conditionLabel: 'Slight rain showers' })).toBe('Wet conditions');
  });

  // Astra's major: api/weather.js routes every snow/sleet/freezing description
  // to conditionKey 'cold', so a heroLabel lookup alone said "Chilly" for a
  // blizzard — losing the snow in English as much as in Sesotho.
  it('keeps the snow when the server has collapsed it into the cold key', () => {
    for (const lang of LANGS) {
      const { dayConditionLabel } = loadConditionLabels(lang, T);
      const out = dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Heavy snow fall' });
      expect(out, `${lang} snow`).toBe(T.conditions.snow[lang]);
      expect(out, `${lang} snow became Chilly`).not.toBe(T.heroLabels.cold[lang]);
    }
    expect(loadConditionLabels('en', T).dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Heavy snow fall' })).toBe('Snow');
    expect(loadConditionLabels('af', T).dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Heavy snow fall' })).toBe('Sneeu');
  });

  it('distinguishes sleet and freezing rain from snow, in every language', () => {
    for (const lang of LANGS) {
      const { dayConditionLabel } = loadConditionLabels(lang, T);
      expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Sleet' }), `${lang} sleet`)
        .toBe(T.conditions.sleet[lang]);
      expect(dayConditionLabel({ conditionKey: 'cold-clear', conditionLabel: 'Light freezing rain' }), `${lang} freezing`)
        .toBe(T.conditions.freezingRain[lang]);
      // "Snow and sleet" is sleet, not snow — sleet is tested first.
      expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Snow and sleet showers' }), `${lang} mixed`)
        .toBe(T.conditions.sleet[lang]);
    }
  });

  it('leaves a genuinely cold day as the cold label, not snow', () => {
    for (const lang of LANGS) {
      const { dayConditionLabel } = loadConditionLabels(lang, T);
      expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Partly cloudy' })).toBe(T.heroLabels.cold[lang]);
    }
  });

  // Reversed from the previous round, which REQUIRED the leak it was meant to
  // catch: with no usable key the label must be a localized generic noun, never
  // the provider's English sentence.
  it('never exposes the provider English when there is no usable condition key', () => {
    for (const lang of LANGS) {
      const { dayConditionLabel } = loadConditionLabels(lang, T);
      expect(dayConditionLabel({ conditionKey: null, conditionLabel: 'Slight rain showers' }))
        .toBe(T.conditions.unknown[lang]);
      expect(dayConditionLabel({ conditionKey: 'no-such-key', conditionLabel: 'Slight rain showers' }))
        .toBe(T.conditions.unknown[lang]);
      expect(dayConditionLabel({})).toBe(T.conditions.unknown[lang]);
    }
    expect(loadConditionLabels('af', T).dayConditionLabel({})).toBe('Weer');
  });

  // Astra round 2: the winter regex only knew "snow"/"sleet"/"blizzard" and only
  // fired under the cold keys, so Tomorrow.io's "Heavy ice pellets" rendered
  // "Chilly" and its "Flurries" rendered "Wet conditions".
  describe('every winter description the five providers can emit', () => {
    // Verbatim from api/weather.js: openMeteoCodeMap, pirateIconMap,
    // tomorrowIoCodeMap and metSymbolMap.
    const SNOW = ['Slight snow fall', 'Moderate snow fall', 'Heavy snow fall', 'Snow grains',
      'Slight snow showers', 'Heavy snow showers', 'Snow', 'Possible snow', 'Snow showers',
      'Flurries', 'Light snow', 'Heavy snow', 'Light snow showers and thunder'];
    const SLEET = ['Sleet', 'Possible sleet', 'Light sleet', 'Heavy sleet', 'Sleet showers',
      'Heavy sleet showers and thunder', 'Ice pellets', 'Heavy ice pellets', 'Light ice pellets'];
    const FREEZING = ['Light freezing drizzle', 'Dense freezing drizzle', 'Light freezing rain',
      'Heavy freezing rain', 'Freezing drizzle', 'Freezing rain'];

    it.each(SNOW)('"%s" is snow in all five languages', (label) => {
      for (const lang of LANGS) {
        const { dayConditionLabel } = loadConditionLabels(lang, T);
        expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: label })).toBe(T.conditions.snow[lang]);
      }
    });

    it.each(SLEET)('"%s" is sleet in all five languages', (label) => {
      for (const lang of LANGS) {
        const { dayConditionLabel } = loadConditionLabels(lang, T);
        expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: label })).toBe(T.conditions.sleet[lang]);
      }
    });

    it.each(FREEZING)('"%s" is freezing rain in all five languages', (label) => {
      for (const lang of LANGS) {
        const { dayConditionLabel } = loadConditionLabels(lang, T);
        expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: label })).toBe(T.conditions.freezingRain[lang]);
      }
    });

    // The ensemble key is coarse: with Tomorrow.io as the only answering
    // provider a "Flurries" label arrives under 'rain' or 'cloudy'.
    // Non-severe keys only — storm/thunder/hail have their own rule below.
    it.each(['rain', 'cloudy', 'clear', 'wind', null])('recognises winter precipitation under conditionKey %s', (ck) => {
      for (const lang of LANGS) {
        const { dayConditionLabel } = loadConditionLabels(lang, T);
        expect(dayConditionLabel({ conditionKey: ck, conditionLabel: 'Flurries' })).toBe(T.conditions.snow[lang]);
        expect(dayConditionLabel({ conditionKey: ck, conditionLabel: 'Heavy ice pellets' })).toBe(T.conditions.sleet[lang]);
      }
    });

    // Astra round 3: the unconditional winter override threw the severity away.
    // MET's "Heavy sleet showers and thunder" under conditionKey 'storm' is a
    // thunderstorm that happens to be throwing sleet — it may not render as a
    // bare "Sleet"/"Natsneeu".
    describe('severe weather outranks the precipitation word', () => {
      const SEVERE = ['storm', 'thunder', 'hail'];

      it.each(SEVERE)('keeps the severe label under conditionKey %s', (ck) => {
        for (const lang of LANGS) {
          const { dayConditionLabel } = loadConditionLabels(lang, T);
          const out = dayConditionLabel({ conditionKey: ck, conditionLabel: 'Heavy sleet showers and thunder' });
          expect(out, `${lang}/${ck} lost the severity`).toContain(T.heroLabels[ck][lang]);
          expect(out, `${lang}/${ck} is a bare precipitation word`).not.toBe(T.conditions.sleet[lang]);
          // Both facts survive: severity first, precipitation after.
          expect(out).toContain(T.conditions.sleet[lang]);
        }
      });

      it('a hail thunderstorm keeps BOTH the severity and the hail', () => {
        for (const lang of LANGS) {
          const { dayConditionLabel } = loadConditionLabels(lang, T);
          for (const ck of ['storm', 'thunder']) {
            const out = dayConditionLabel({ conditionKey: ck, conditionLabel: 'Thunderstorm with heavy hail' });
            expect(out, `${lang}/${ck}`).toContain(T.heroLabels[ck][lang]);
            expect(out, `${lang}/${ck} lost the hail`).toContain(T.heroLabels.hail[lang]);
          }
          // conditionKey 'hail' + a hail description would say the same word
          // twice, so it says it once.
          expect(dayConditionLabel({ conditionKey: 'hail', conditionLabel: 'Thunderstorm with heavy hail' }))
            .toBe(T.heroLabels.hail[lang]);
        }
      });

      // Astra round 4: api/weather.js maps Pirate's 'hail' icon to the
      // description "Hail", and deriveCondition's winter step routes it to
      // 'cold' — so a Pirate-only forecast rendered a hailstorm as "Chilly".
      it('hail survives the cold key on a Pirate-only forecast', () => {
        for (const lang of LANGS) {
          const { dayConditionLabel } = loadConditionLabels(lang, T);
          for (const ck of ['cold', 'cold-clear', 'rain', 'cloudy', null]) {
            const out = dayConditionLabel({ conditionKey: ck, conditionLabel: 'Hail' });
            expect(out, `${lang}/${ck}`).toBe(T.heroLabels.hail[lang]);
            expect(out, `${lang}/${ck} rendered as Chilly`).not.toBe(T.heroLabels.cold[lang]);
          }
        }
        expect(loadConditionLabels('af', T).dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Hail' })).toBe('Hael');
      });

      it('renders the Pirate hail day through both render sites, fresh and cached shapes', () => {
        // Fresh and cache-hit days normalize to the same shape; both reach this
        // code path, so both are driven here.
        const shapes = [
          { conditionKey: 'cold', conditionLabel: 'Hail', highC: 6, lowC: 2, rainChance: 80, uv: 1 },
          { conditionKey: 'cold', conditionLabel: 'Hail', highC: 6, lowC: 2, rainChance: 80, uv: 1, sunrise: '2026-09-14T06:30', sunset: '2026-09-14T18:10' },
        ];
        for (const lang of LANGS) {
          for (const day of shapes) {
            const headerMeta = fakeEl();
            const $ = (sel) => ({ '#dayDetailMeta': headerMeta, '#dayDetailDayName': fakeEl(), '#day-detail-content': fakeEl() }[sel] || null);
            const render = loadFn('renderDayDetail', 'norm, dayIndex',
              renderDeps(lang, { $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {} }));
            render({ utcOffsetSeconds: 7200, daily: [day], hourly: [] }, 0);
            expect(headerMeta.textContent, `${lang} detail header`).toContain(T.heroLabels.hail[lang]);
            expect(headerMeta.textContent).not.toContain(T.heroLabels.cold[lang]);

            const appended = [];
            const container = { ...fakeEl(), appendChild: (c) => appended.push(c) };
            const summary = loadFn('renderDayDetailSummary', 'container, day',
              renderDeps(lang, { document: { createElement: () => fakeEl() } }));
            summary(container, day);
            expect(appended[0].innerHTML, `${lang} summary card`).toContain(T.heroLabels.hail[lang]);
            expect(appended[0].innerHTML).not.toContain(T.heroLabels.cold[lang]);
          }
        }
      });

      it('a NON-severe key still leads with the precipitation', () => {
        for (const lang of LANGS) {
          const { dayConditionLabel } = loadConditionLabels(lang, T);
          expect(dayConditionLabel({ conditionKey: 'cold', conditionLabel: 'Heavy sleet showers' }))
            .toBe(T.conditions.sleet[lang]);
        }
      });

      it('renders through the real day-detail function, and through a cache-hit shaped day', () => {
        // A cached payload normalizes to the same day shape, so the branch that
        // serves it hits exactly this code path.
        const cacheHitDay = { conditionKey: 'storm', conditionLabel: 'Heavy sleet showers and thunder', highC: 4, lowC: 1, rainChance: 90, uv: 1 };
        for (const lang of LANGS) {
          const headerMeta = fakeEl();
          const $ = (sel) => ({ '#dayDetailMeta': headerMeta, '#dayDetailDayName': fakeEl(), '#day-detail-content': fakeEl() }[sel] || null);
          const render = loadFn('renderDayDetail', 'norm, dayIndex',
            renderDeps(lang, { $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {} }));
          render({ utcOffsetSeconds: 7200, daily: [cacheHitDay], hourly: [] }, 0);
          expect(headerMeta.textContent, `${lang} detail header`).toContain(T.heroLabels.storm[lang]);
          expect(headerMeta.textContent).toContain(T.conditions.sleet[lang]);
          expect(headerMeta.textContent).not.toContain('Heavy sleet showers and thunder');

          // …and the summary card, the other render site.
          const appended = [];
          const container = { ...fakeEl(), appendChild: (c) => appended.push(c) };
          const summary = loadFn('renderDayDetailSummary', 'container, day',
            renderDeps(lang, { document: { createElement: () => fakeEl() } }));
          summary(container, cacheHitDay);
          expect(appended[0].innerHTML, `${lang} summary card`).toContain(T.heroLabels.storm[lang]);
          expect(appended[0].innerHTML).not.toContain('Heavy sleet showers and thunder');
        }
      });
    });

    it('does not mistake ordinary rain, hail or drizzle for winter precipitation', () => {
      const { dayConditionLabel } = loadConditionLabels('af', T);
      expect(dayConditionLabel({ conditionKey: 'rain', conditionLabel: 'Heavy rain' })).toBe(T.heroLabels.rain.af);
      expect(dayConditionLabel({ conditionKey: 'rain', conditionLabel: 'Dense drizzle' })).toBe(T.heroLabels.rain.af);
      expect(dayConditionLabel({ conditionKey: 'hail', conditionLabel: 'Thunderstorm with slight hail' })).toBe(T.heroLabels.hail.af);
    });
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — the actual render sites
//
// Astra round 2 reverted both render calls to the raw provider label and all 46
// tests still passed, because they only exercised the helper. These drive the
// REAL renderDayDetail and renderDayDetailSummary, so a render site that stops
// calling dayConditionLabel fails here.
// ---------------------------------------------------------------------------

function renderDeps(lang, extra = {}) {
  const t = (category, key) => T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  const { dayConditionLabel } = loadConditionLabels(lang, T);
  return {
    T, t, settings: { lang, temp: 'C', time: '24' }, dayConditionLabel,
    isNum: (v) => typeof v === 'number' && Number.isFinite(v),
    formatTemp: (c) => `${Math.round(c)}°`,
    getTempColorClass: () => '', round0: Math.round, escapeHtml: (s) => String(s),
    conditionIcon: () => '<svg/>', buildAdSlot: () => fakeEl(),
    debugLog: () => {}, getTranslatedDayName: () => t('days', 'mon'),
    precipUnitLabel: () => 'mm', formatPrecipAmount: () => '0',
    windValue: () => 0, windUnitLabel: () => 'km/h',
    getWeatherIcon: () => '<svg/>', isHourDaylight: () => true,
    parseLocalIsoMinutes: () => null,
    ...extra,
  };
}

// Drives a LARGE real function without naming forty stubs: the source runs
// inside `with(env)`, and env is a Proxy that answers every lookup — the names
// the test supplies come back verbatim, anything else is an inert stub. This is
// how the real renderHome gets exercised rather than a hand-copied excerpt.
// As loadWithEnv, but returns an arbitrary expression (an object of several
// functions) and lets the source ASSIGN module-level names — writes land on
// env, so activePlace and activeLocationSeq behave like the real bindings.
function loadModuleWithEnv(src, returnExpr, env) {
  const stub = Object.assign(function stubFn() { return stub; }, fakeEl());
  const proxy = new Proxy(env, {
    has: (t, key) => typeof key !== 'symbol' && (key in t || !(key in globalThis)),
    get: (t, key) => (key in t ? t[key] : stub),
  });
  return new Function('__env', `with (__env) { ${src}\n return ${returnExpr}; }`)(proxy);
}

function loadWithEnv(name, src, env) {
  // The default stub is BOTH callable and element-shaped: an unnamed identifier
  // may be used as a function, as a DOM node, or as the result of calling one,
  // and none of those may throw. Only the names the test supplies are real.
  const stub = Object.assign(function stubFn() { return stub; }, fakeEl());
  const proxy = new Proxy(env, {
    // Real globals (String, Object, Math, RegExp…) must NOT be shadowed by the
    // stub — `with` would otherwise capture them and String(x).trim() breaks.
    has: (t, key) => typeof key !== 'symbol' && (key in t || !(key in globalThis)),
    get: (t, key) => (key in t ? t[key] : stub),
  });
  return new Function('__env', `with (__env) { ${src}\n return ${name}; }`)(proxy);
}

// Read a numeric constant out of assets/app.js rather than hard-coding it, so
// the harness cannot drift from the real chart geometry.
function chartConst(name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(app());
  if (!m) throw new Error(`${name} not found in assets/app.js`);
  return Number(m[1]);
}

function sliceFunction(name) {
  const src = app();
  const start = src.indexOf(`  function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const end = src.indexOf('\n  }', start) + '\n  }'.length;
  return src.slice(start, end);
}

function loadFn(name, signature, deps) {
  const src = app();
  const re = new RegExp(`function ${name}\\(${signature}\\) \\{[\\s\\S]*?\\n  \\}`);
  const fn = src.match(re)?.[0];
  if (!fn) throw new Error(`${name} source not found`);
  const names = { ...deps };
  return new Function(...Object.keys(names), `${fn}; return ${name};`)(...Object.values(names));
}

describe('language leaks — the render sites themselves (behavioural)', () => {
  it('renderDayDetail writes the catalogue condition into the header meta', () => {
    for (const lang of NON_EN) {
      const headerName = fakeEl();
      const headerMeta = fakeEl();
      const content = fakeEl();
      const $ = (sel) => ({
        '#dayDetailDayName': headerName, '#dayDetailMeta': headerMeta,
        '#day-detail-content': content,
      }[sel] || null);
      const deps = renderDeps(lang, {
        $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {},
      });
      const render = loadFn('renderDayDetail', 'norm, dayIndex', deps);
      render({ utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] }, 0);

      expect(headerMeta.textContent, `${lang} header`).toContain(T.heroLabels.rain[lang]);
      expect(headerMeta.textContent, `${lang} leaked provider English`).not.toContain('Slight rain showers');
      expect(headerMeta.textContent).not.toContain('Wet conditions');
    }
  });

  it('renderDayDetail keeps the snow in the header, in every language', () => {
    for (const lang of LANGS) {
      const headerMeta = fakeEl();
      const $ = (sel) => ({ '#dayDetailMeta': headerMeta, '#dayDetailDayName': fakeEl(), '#day-detail-content': fakeEl() }[sel] || null);
      const deps = renderDeps(lang, { $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {} });
      const render = loadFn('renderDayDetail', 'norm, dayIndex', deps);
      render({ utcOffsetSeconds: 7200, daily: [{ conditionKey: 'cold', conditionLabel: 'Heavy ice pellets', highC: 3, lowC: -1 }], hourly: [] }, 0);
      expect(headerMeta.textContent).toContain(T.conditions.sleet[lang]);
      expect(headerMeta.textContent).not.toContain('Heavy ice pellets');
    }
  });

  it('renderDayDetailSummary writes the catalogue condition into the summary card', () => {
    for (const lang of NON_EN) {
      const appended = [];
      const container = { ...fakeEl(), appendChild: (c) => appended.push(c) };
      const created = [];
      const document_ = { createElement: () => { const e = fakeEl(); created.push(e); return e; } };
      const deps = renderDeps(lang, { document: document_ });
      const render = loadFn('renderDayDetailSummary', 'container, day', deps);
      render(container, { conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60, uv: 3 });

      const card = appended[0];
      expect(card.innerHTML, `${lang} summary card`).toContain(T.heroLabels.rain[lang]);
      expect(card.innerHTML, `${lang} leaked provider English`).not.toContain('Slight rain showers');
    }
  });

  it('renders through the real function even when the language chunk never loaded', async () => {
    // Rebuild a catalogue over the raw SEED — the state after a failed chunk —
    // and render a Sotho day through it. Before the seed carried five
    // languages this produced English, and this is the moment (offline, first
    // visit) when it mattered most.
    const seedSrc = readFileSync(new URL('../assets/copy-loader.js', import.meta.url), 'utf8');
    const seed = new Function(`${seedSrc.replace(/export /g, '')}; return COPY_BANK;`)();
    const seedT = new Function('COPY_BANK', `return ${catalogueSrc()};`)(seed);

    const headerMeta = fakeEl();
    const $ = (sel) => ({ '#dayDetailMeta': headerMeta, '#dayDetailDayName': fakeEl(), '#day-detail-content': fakeEl() }[sel] || null);
    const lang = 'st';
    const t = (c, k) => seedT[c]?.[k]?.[lang] || seedT[c]?.[k]?.en || k;
    const { dayConditionLabel } = loadConditionLabels(lang, seedT);
    const deps = { ...renderDeps(lang), T: seedT, t, dayConditionLabel, $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {} };
    const render = loadFn('renderDayDetail', 'norm, dayIndex', deps);
    render({ utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] }, 0);

    expect(headerMeta.textContent).toContain('Maemo a mongobo');
    expect(headerMeta.textContent).not.toContain('Slight rain showers');
    expect(headerMeta.textContent).not.toContain('Wet conditions');
  });

  it('the weekly row names its condition from the catalogue, never the provider', () => {
    for (const lang of NON_EN) {
      const rows = [];
      const dailyCards = { ...fakeEl(), appendChild: (c) => rows.push(c), innerHTML: '' };
      const document_ = { createElement: () => fakeEl() };
      const iconLabels = [];
      const deps = renderDeps(lang, {
        document: document_, dailyCards,
        // conditionIcon is the weekly row's ONLY condition carrier (labelled).
        conditionIcon: (ck) => { const l = T.heroLabels[ck]?.[lang] || ''; iconLabels.push(l); return `<svg aria-label="${l}"/>`; },
        getDayBadge: () => '', buildAdSlot: () => fakeEl(),
        window: { __PW_LAST_NORM: { utcOffsetSeconds: 7200 } },
      });
      const render = loadFn('renderWeek', 'daily, hourlyData', deps);
      render([{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }], []);

      expect(iconLabels[0], `${lang} weekly icon label`).toBe(T.heroLabels.rain[lang]);
      for (const row of rows) {
        expect(row.innerHTML || '', `${lang} weekly row`).not.toContain('Slight rain showers');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — geolocation fallback
// ---------------------------------------------------------------------------

describe('language leaks — geolocation fallback (behavioural)', () => {
  it('returns the catalogue string for the selected language, not English', () => {
    for (const lang of NON_EN) {
      const msg = loadGeolocationMessage(lang, T);
      expect(msg({ code: 3 }), `${lang} timeout`).toBe(T.toasts.locationTimeoutApprox[lang]);
      expect(msg({ code: 2 }), `${lang} unavailable`).toBe(T.toasts.locationApprox[lang]);
      expect(msg({ code: 3 })).not.toBe(T.toasts.locationTimeoutApprox.en);
    }
  });

  it('the Sotho timeout message is the Sotho string', () => {
    // The exact sentence Astra's snapshot caught in English under Sotho.
    const msg = loadGeolocationMessage('st', T);
    expect(msg({ code: 3 })).toBe('Ho batla sebaka ho nkile nako e telele. E sebedisa sebaka se ka bang sona.');
    expect(msg({ code: 3 })).not.toMatch(/Location lookup took too long/);
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — updateUILanguage against fake elements
// ---------------------------------------------------------------------------

function fakeEl(tag = 'div') {
  const el = {
    tag,
    attrs: {},
    textContent: '',
    innerHTML: '',
    placeholder: '',
    hidden: false,
    options: [],
    children: [],
    value: '',
    title: '',
    dataset: {},
    style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    addEventListener() {},
    // Record the tree: renderers build a DocumentFragment and hand it to
    // replaceChildren, so a fake that swallowed children made a populated chart
    // look identical to an empty one.
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...nodes) { this.children = []; this.innerHTML = ''; for (const n of nodes) this.appendChild(n); },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return el;
}

// Drives the REAL updateUILanguage over a registry of fake elements and returns
// the registry, so each assertion reads what the function actually wrote.
function runUpdateUILanguage(lang) {
  const reg = new Map();
  const el = (sel) => {
    if (!reg.has(sel)) reg.set(sel, fakeEl());
    return reg.get(sel);
  };
  // A settings row: label element the function reads/writes through closest().
  const withLabel = (sel) => {
    const e = el(sel);
    const label = fakeEl('label');
    e.closest = () => ({ querySelector: () => label, appendChild() {} });
    reg.set(`${sel} label`, label);
    return e;
  };
  const timeFormatSelect = el('#timeFormat');
  const opt24 = fakeEl('option');
  const opt12 = fakeEl('option');
  timeFormatSelect.querySelector = (s) => (s.includes('"24"') ? opt24 : s.includes('"12"') ? opt12 : null);
  reg.set('option24', opt24);
  reg.set('option12', opt12);
  withLabel('#timeFormat');
  withLabel('#unitsTemp'); withLabel('#unitsWind'); withLabel('#unitsPrecip'); withLabel('#languageSelect');

  const searchInputLabel = fakeEl('label');
  reg.set('label[for="searchInput"]', searchInputLabel);
  const navLandmark = el('nav.nav');

  // Content that OUTLIVES a language switch: search-result stars built by an
  // earlier render, and an update banner already on screen.
  const savedStar = fakeEl('button');
  savedStar.setAttribute('aria-pressed', 'true');
  const unsavedStar = fakeEl('button');
  unsavedStar.setAttribute('aria-pressed', 'false');
  reg.set('savedStar', savedStar);
  reg.set('unsavedStar', unsavedStar);

  const bannerText = fakeEl('span');
  const bannerAction = fakeEl('button');
  const bannerDismiss = fakeEl('button');
  reg.set('bannerText', bannerText);
  reg.set('bannerAction', bannerAction);
  reg.set('bannerDismiss', bannerDismiss);
  const versionBanner = fakeEl();
  versionBanner.querySelector = (s) => ({
    '.version-update-text': bannerText,
    '.version-update-action': bannerAction,
    '.version-update-dismiss': bannerDismiss,
  }[s] || null);

  const document_ = {
    querySelector: (sel) => {
      if (sel === 'label[for="searchInput"]') return searchInputLabel;
      if (sel === 'nav.nav') return navLandmark;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.fav-star' ? [savedStar, unsavedStar] : []),
    getElementById: (id) => (id === 'versionUpdateBanner' ? versionBanner : el(`#${id}`)),
    documentElement: {},
  };

  const T_ = T;
  const settings = { lang, temp: 'C', wind: 'kmh', precip: 'mm', time: '24' };
  const t = (category, key) => T_[category]?.[key]?.[lang] || T_[category]?.[key]?.en || key;
  const noop = () => {};

  const names = {
    navHome: el('#navHome'), navWeek: el('#navWeek'), navSearch: el('#navSearch'),
    navSettings: el('#navSettings'), navShare: el('#navShare'), navHourlyHome: el('#navHourlyHome'),
    shareBtn: el('#shareBtn'), myLocationHome: el('#myLocationHome'),
    useMyLocationBtn: el('#useMyLocationBtn'), searchInput: el('#searchInput'),
    searchCancel: el('#searchCancel'), searchEditToggle: el('#searchEditToggle'),
    clearRecentsBtn: el('#clearRecents'), homeHourlyLabel: el('#homeHourlyLabel'),
    languageBtn: el('#languageBtn'), languageMenu: el('#languageMenu'),
    unitsTempSelect: el('#unitsTemp'), unitsWindSelect: el('#unitsWind'),
    unitsPrecipSelect: el('#unitsPrecip'), timeFormatSelect, languageSelect: el('#languageSelect'),
    screenSearch: { querySelector: () => null, querySelectorAll: () => [] },
    screenWeek: { querySelector: () => null }, screenSettings: { querySelector: () => null },
    screenHourly: { querySelector: () => null }, screenSources: { querySelector: () => null },
    T: T_, t, settings, document: document_, $: el,
    searchEditMode: false, escapeHtml: (s) => s,
    weatherIconSvg: () => '<svg/>', voiceLine: () => '', VOICE: { week: {} },
    updateHourlySubtitle: noop, renderHourlyChart: noop, syncSettingsSegs: noop,
    renderAgreeLine: noop, refreshSaveButtonState: noop,
    APP_VERSION: '1.5', BUILD_SHORT: 'abc1234', window: { __PW_LAST_NORM: null },
    // Cache-age line: not visible in this harness, so the re-render branch is
    // skipped. Its own behaviour is covered against the real showCacheAge.
    offlineEl: el('#offlineIndicator'), lastCacheTimestamp: null, showCacheAge: noop,
    searchResults: [], renderSearchResults: noop,
  };

  const fn = new Function(...Object.keys(names), `return function updateUILanguage() ${updateUILanguageSrc()};`)(...Object.values(names));
  fn();
  return { reg, t };
}

describe('language leaks — updateUILanguage writes the selected language (behavioural)', () => {
  it('sets every accessible name to the Afrikaans string, not the English one', () => {
    const { reg } = runUpdateUILanguage('af');
    const aria = (sel) => reg.get(sel).getAttribute('aria-label');

    expect(aria('#navHome')).toBe('Tuis');
    expect(aria('#navWeek')).toBe('Weekliks');
    expect(aria('#navSearch')).toBe('Soek');
    expect(aria('#navSettings')).toBe('Instellings');
    expect(aria('#shareBtn')).toBe('Deel');
    expect(aria('#navShare')).toBe('Deel');
    expect(aria('#navHourlyHome')).toBe('Uurliks');
    expect(aria('#myLocationHome')).toBe('My Ligging');
    expect(aria('#useMyLocationBtn')).toBe('Gebruik my ligging');
    expect(aria('#searchInput')).toBe("Soek 'n plek");
    expect(aria('#dayDetailBack')).toBe('Weekliks');
    expect(aria('nav.nav')).toBe('Primêr');
    expect(aria('#languageBtn')).toBe('Taal');
    expect(aria('#languageMenu')).toBe('Taal');
    expect(aria('#capeWindDismiss')).toBe('Maak toe');

    // None of them may still be the English wording that was in the markup.
    const english = ['Home', 'Weekly forecast', 'Search and favourites', 'Settings', 'Share',
      'Hourly forecast', 'My location', 'Use my location', 'Search location', 'Back to week',
      'Primary', 'Change language', 'Choose language', 'Dismiss'];
    for (const [sel, e] of reg) {
      const a = e.getAttribute?.('aria-label');
      if (a) expect(english, `${sel} still English: ${a}`).not.toContain(a);
    }
  });

  it('sets the search input sr-only label and the settings prose in Afrikaans', () => {
    const { reg } = runUpdateUILanguage('af');
    expect(reg.get('label[for="searchInput"]').textContent).toBe("Soek 'n plek");
    expect(reg.get('#searchInput').placeholder).toBe("Soek 'n plek");
    expect(reg.get('option24').textContent).toBe('24-uur');
    expect(reg.get('option12').textContent).toBe('12-uur');
    expect(reg.get('#feedbackPrompt').textContent).toBe("Het jy terugvoer of 'n probleem? Stuur vir ons 'n e-pos:");
    expect(reg.get('#privacyLink').textContent).toBe('Privaatheidsbeleid');
    expect(reg.get('#settingsSubtitle').textContent).toBe('Eenhede, vertoning en taal');
  });

  it('sets the settings subtitle in zu/xh/st too — it used to be English there', () => {
    for (const lang of ['zu', 'xh', 'st']) {
      const { reg } = runUpdateUILanguage(lang);
      const sub = reg.get('#settingsSubtitle').textContent;
      expect(sub, `${lang} subtitle`).toBe(T.misc.settingsSubtitle[lang]);
      expect(sub, `${lang} subtitle still English`).not.toBe('Units, display and language');
    }
  });

  it('keeps the version stamp language-neutral', () => {
    for (const lang of NON_EN) {
      const { reg } = runUpdateUILanguage(lang);
      const v = reg.get('#appVersion').textContent;
      expect(v).toBe('v1.5 · abc1234');
      expect(v).not.toMatch(/Version|Build/);
    }
  });

  // Astra round 2: after EN→AF the search-result stars kept "Save this place"
  // and an open update banner kept "Dismiss"/"Tap to refresh", because both are
  // built once and then just sit there.
  it('relabels search-result stars that an earlier render already built', () => {
    const { reg } = runUpdateUILanguage('af');
    expect(reg.get('savedStar').getAttribute('aria-label')).toBe('Gestoor');
    expect(reg.get('unsavedStar').getAttribute('aria-label')).toBe('Stoor hierdie plek');
    expect(reg.get('unsavedStar').getAttribute('aria-label')).not.toBe('Save this place');
    expect(reg.get('unsavedStar').title).toBe('Stoor hierdie plek');
  });

  it('relabels an update banner that is already on screen', () => {
    const { reg } = runUpdateUILanguage('af');
    expect(reg.get('bannerText').textContent).toBe('Nuwe weergawe');
    expect(reg.get('bannerAction').textContent).toBe('Tik om te verfris');
    expect(reg.get('bannerDismiss').getAttribute('aria-label')).toBe('Maak toe');
    for (const key of ['bannerText', 'bannerAction']) {
      expect(reg.get(key).textContent).not.toMatch(/New version|Tap to refresh/);
    }
  });

  it('writes Zulu, Xhosa and Sotho accessible names as well', () => {
    for (const lang of ['zu', 'xh', 'st']) {
      const { reg } = runUpdateUILanguage(lang);
      expect(reg.get('#useMyLocationBtn').getAttribute('aria-label')).toBe(T.misc.useMyLocation[lang]);
      expect(reg.get('#navHome').getAttribute('aria-label')).toBe(T.nav.home[lang]);
      expect(reg.get('nav.nav').getAttribute('aria-label')).toBe(T.nav.primary[lang]);
      expect(reg.get('#capeWindDismiss').getAttribute('aria-label')).toBe(T.misc.dismiss[lang]);
    }
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — the last English surfaces (Astra round 4)
// ---------------------------------------------------------------------------

describe('language leaks — remaining English surfaces', () => {
  it('the cache-age line renders in the selected language, both branches', () => {
    for (const lang of LANGS) {
      const offlineEl = fakeEl();
      const t = (c, k) => T[c]?.[k]?.[lang] || T[c]?.[k]?.en || k;
      const show = loadFn('showCacheAge', 'timestamp', { offlineEl, t, lastCacheTimestamp: null });

      show(Date.now());                       // < 1 min → the "just now" branch
      expect(offlineEl.textContent, `${lang} just-now`).toBe(T.misc.cachedJustNow[lang]);

      show(Date.now() - 5 * 60000);           // 5 min → the substituted branch
      expect(offlineEl.textContent, `${lang} 5 min`).toBe(T.misc.lastUpdated[lang].replace('{mins}', '5'));
      expect(offlineEl.textContent).toContain('5');

      if (lang !== 'en') {
        // The English wording may not survive into a non-English render.
        expect(offlineEl.textContent).not.toMatch(/Last updated \d+ min ago/);
        show(Date.now());
        expect(offlineEl.textContent).not.toMatch(/Using cached data/);
      }
    }
  });

  it('every lastUpdated translation keeps its {mins} token', () => {
    for (const lang of LANGS) expect(T.misc.lastUpdated[lang], `${lang}`).toContain('{mins}');
  });

  it('updateUILanguage writes the loader and the five-favourites sentence', () => {
    for (const lang of NON_EN) {
      const { reg } = runUpdateUILanguage(lang);
      expect(reg.get('#loader').textContent, `${lang} loader`).toBe(T.misc.fetching[lang]);
      expect(reg.get('#loader').textContent).not.toMatch(/Fetching probable weather/);
      expect(reg.get('#favLimit').textContent, `${lang} fav limit`).toBe(T.search.favLimit[lang]);
      expect(reg.get('#favLimit').textContent).not.toMatch(/You've saved 5 places/);
      expect(reg.get('#searchSubtitle').textContent, `${lang} search subtitle`).toBe(T.misc.placesSubtitle[lang]);
      expect(reg.get('#searchSubtitle').textContent).not.toBe('Search, save, switch');
    }
  });

  it('the share fallbacks speak the selected language', () => {
    const src = app();
    expect(src).toMatch(/showToast\(t\('misc',\s*'shareLinkCopied'\)\)/);
    expect(src).toMatch(/window\.prompt\(t\('misc',\s*'copyShareLink'\)/);
    expect(src).not.toMatch(/showToast\('Share link copied'\)/);
    expect(src).not.toMatch(/window\.prompt\('Copy this share link'/);
    for (const lang of NON_EN) {
      expect(T.misc.shareLinkCopied[lang]).not.toBe(T.misc.shareLinkCopied.en);
      expect(T.misc.copyShareLink[lang]).not.toBe(T.misc.copyShareLink.en);
    }
  });

  it('"Today" and the search subtitle are no longer English placeholders', () => {
    for (const lang of NON_EN) {
      expect(T.misc.todayLabel[lang], `${lang} today`).not.toBe('Today');
      expect(T.misc.placesSubtitle[lang], `${lang} subtitle`).not.toBe('Search, save, switch');
    }
    expect(T.misc.todayLabel.zu).toBe('Namuhla');
    expect(T.misc.todayLabel.st).toBe('Kajeno');
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — the EN → AF transition on content already on screen
// ---------------------------------------------------------------------------

describe('language leaks — switching language updates content already rendered', () => {
  // Render the SAME open day in en, then re-render it in af exactly as
  // applySettings now does, and prove the words actually change.
  function renderHeaderIn(lang) {
    const headerMeta = fakeEl();
    const $ = (sel) => ({ '#dayDetailMeta': headerMeta, '#dayDetailDayName': fakeEl(), '#day-detail-content': fakeEl() }[sel] || null);
    const deps = renderDeps(lang, { $, renderDayDetailHourly: () => {}, renderDayDetailSummary: () => {} });
    const render = loadFn('renderDayDetail', 'norm, dayIndex', deps);
    render({ utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] }, 0);
    return headerMeta.textContent;
  }

  it('an open day-detail panel changes language with the app', () => {
    const before = renderHeaderIn('en');
    expect(before).toContain('Wet conditions');
    for (const lang of NON_EN) {
      const after = renderHeaderIn(lang);
      expect(after, `${lang} after switch`).toContain(T.heroLabels.rain[lang]);
      expect(after, `${lang} kept the English`).not.toContain('Wet conditions');
    }
  });

  it('applySettings re-renders the open day detail with the same day', () => {
    const src = app();
    // The index has to be remembered for the re-render to be possible at all.
    expect(src).toMatch(/let openDayDetailIndex = null/);
    expect(src).toMatch(/function renderDayDetail\(norm, dayIndex\)[\s\S]{0,300}openDayDetailIndex = dayIndex/);
    const applySettingsSrc = sliceObject(src, src.indexOf('{', src.indexOf('function applySettings()')));
    expect(applySettingsSrc).toMatch(/openDayDetailIndex !== null[\s\S]{0,80}renderDayDetail\(norm, openDayDetailIndex\)/);
  });

  // Astra round 3: the per-language render above builds FRESH elements each
  // time, so disabling the switch path entirely still passed. This is one
  // persistent set of elements, rendered in en, put through the app's real
  // language-switch path, and then re-read. renderDayDetail and applySettings
  // are lifted into ONE function body so they share the real
  // openDayDetailIndex binding, exactly as they do in the module.
  // withPayload:false is the error/loading case — on those screens the app has
  // no lastPayload, which is exactly why applySettings used to re-render
  // nothing and leave the English error text on screen.
  function buildLiveApp({ withPayload = true } = {}) {
    const src = app();
    const startMarker = '  // Which day the detail panel is currently showing';
    const start = src.indexOf(startMarker);
    const detailEnd = src.indexOf('\n  }', src.indexOf('function renderDayDetail(norm, dayIndex) {')) + '\n  }'.length;
    const applyStart = src.indexOf('  function applySettings()');
    const applyEnd = src.indexOf('\n  }', applyStart) + '\n  }'.length;
    if (start < 0 || applyStart < 0) throw new Error('live-app source not found');
    // lastHeroState + renderLoading + renderError ride along in the SAME body,
    // so applySettings sees the real binding rather than a copy.
    const heroStart = src.indexOf('  // THE record of what the hero is currently showing');
    const heroEnd = src.indexOf('\n  }', src.indexOf('  function renderError(msg, msgKey) {')) + '\n  }'.length;
    if (heroStart < 0 || heroEnd < heroStart) throw new Error('hero-state source not found');
    const body = `${src.slice(heroStart, heroEnd)}\n${src.slice(start, detailEnd)}\n${src.slice(applyStart, applyEnd)}`;

    const reg = new Map();
    const $ = (sel) => { if (!reg.has(sel)) reg.set(sel, fakeEl()); return reg.get(sel); };
    // A forecast panel that actually RECORDS what is rendered into it, so a
    // stale week left sitting there is visible to an assertion. Setting
    // innerHTML = '' clears the record, exactly as it clears the real node.
    // Flatten a recorded node tree into one searchable string: own markup, own
    // text, its accessible name, and everything appended beneath it.
    const collect = (n) => {
      if (!n || typeof n !== 'object') return '';
      const own = [n.html ?? (typeof n.innerHTML === 'string' ? n.innerHTML : ''), n.textContent, n.attrs?.['aria-label']];
      return [...own, ...(n.children || []).map(collect)].filter(Boolean).join(' ');
    };
    const panel = (sel) => {
      const el = fakeEl();
      el.html = '';
      Object.defineProperty(el, 'innerHTML', {
        get() { return [el.html, ...el.children.map(collect)].filter(Boolean).join(' '); },
        // Assigning innerHTML replaces everything, exactly as the real node does.
        set(v) { el.html = v || ''; el.children = []; },
      });
      reg.set(sel, el);
      return el;
    };

    const settings = { lang: 'en', temp: 'C', wind: 'kmh', precip: 'mm', time: '24' };
    const t = (category, key) => T[category]?.[key]?.[settings.lang] || T[category]?.[key]?.en || key;

    // Content that must SURVIVE the switch and be relabelled in place.
    const star = fakeEl('button');
    star.setAttribute('aria-pressed', 'false');
    const bannerText = fakeEl('span');
    const bannerAction = fakeEl('button');
    const versionBanner = fakeEl();
    versionBanner.querySelector = (s) => ({
      '.version-update-text': bannerText, '.version-update-action': bannerAction,
      '.version-update-dismiss': fakeEl(),
    }[s] || null);
    reg.set('star', star); reg.set('bannerText', bannerText); reg.set('bannerAction', bannerAction);

    const document_ = {
      querySelector: (sel) => (sel === 'nav.nav' ? $(sel) : sel === 'label[for="searchInput"]' ? $(sel) : null),
      querySelectorAll: (sel) => (sel === '.fav-star' ? [star] : []),
      getElementById: (id) => (id === 'versionUpdateBanner' ? versionBanner : $(`#${id}`)),
      createElement: () => fakeEl(),
      createDocumentFragment: () => fakeEl(),
      createElementNS: () => fakeEl(),
      documentElement: fakeEl(),
      body: fakeEl(),
    };

    // The real condition-label chain, closed over the LIVE settings object.
    const labelBlock = (() => {
      const s = src.indexOf('const COPY_FALLBACK');
      const e = src.indexOf('\n  }', src.indexOf('function dayConditionLabel(day) {')) + '\n  }'.length;
      return src.slice(s, e);
    })();
    const { dayConditionLabel } = new Function('T', 't', 'settings',
      `${labelBlock}; return { dayConditionLabel };`)(T, t, settings);

    const noop = () => {};
    const uiDeps = {
      ...renderDeps('en', {}), T, t, settings, document: document_, $,
      dayConditionLabel, window: { __PW_LAST_NORM: null },
      renderDayDetailHourly: noop, renderDayDetailSummary: noop,
      updateUILanguage: null, updateLanguageOptions: noop,
      normalizePayload: (p) => p,
      activePlace: { name: 'Cape Town', lat: -33.9, lon: 18.4 },
      renderHome: noop, renderHourly: noop, renderWeek: noop,
      renderFavorites: noop, renderRecents: noop,
      unitsTempSelect: $('#unitsTemp'), unitsWindSelect: $('#unitsWind'),
      unitsPrecipSelect: $('#unitsPrecip'), timeFormatSelect: $('#timeFormat'),
      languageSelect: $('#languageSelect'),
    };
    // updateUILanguage must be the REAL one, sharing this registry.
    const realUpdateUILanguage = (() => {
      const names = { ...uiDeps };
      delete names.updateUILanguage;
      const extra = {
        navHome: $('#navHome'), navWeek: $('#navWeek'), navSearch: $('#navSearch'),
        navSettings: $('#navSettings'), navShare: $('#navShare'), navHourlyHome: $('#navHourlyHome'),
        shareBtn: $('#shareBtn'), myLocationHome: $('#myLocationHome'),
        useMyLocationBtn: $('#useMyLocationBtn'), searchInput: $('#searchInput'),
        searchCancel: $('#searchCancel'), searchEditToggle: $('#searchEditToggle'),
        clearRecentsBtn: $('#clearRecents'), homeHourlyLabel: $('#homeHourlyLabel'),
        languageBtn: $('#languageBtn'), languageMenu: $('#languageMenu'),
        screenSearch: { querySelector: () => null, querySelectorAll: () => [] },
        screenWeek: { querySelector: () => null }, screenSettings: { querySelector: () => null },
        screenHourly: { querySelector: () => null }, screenSources: { querySelector: () => null },
        searchEditMode: false, escapeHtml: (s) => s, weatherIconSvg: () => '<svg/>',
        voiceLine: () => '', VOICE: { week: {} }, updateHourlySubtitle: noop,
        renderHourlyChart: noop, syncSettingsSegs: noop, renderAgreeLine: noop,
        refreshSaveButtonState: noop, APP_VERSION: '1.5', BUILD_SHORT: 'abc1234',
        offlineEl: $('#offlineIndicator'), lastCacheTimestamp: null, showCacheAge: noop,
        searchResults: [], renderSearchResults: noop,
      };
      const all = { ...names, ...extra };
      return new Function(...Object.keys(all), `return function updateUILanguage() ${updateUILanguageSrc()};`)(...Object.values(all));
    })();

    // applyLanguageSelection is the REAL entry point the language picker calls:
    // it validates, sets settings.lang, persists, awaits the language chunk and
    // only then runs applySettings + the install banner's refreshLanguage. It is
    // lifted into the SAME body so it shares openDayDetailIndex and settings.
    const selectionSrc = (() => {
      const s = src.indexOf('  function applyLanguageSelection(lang)');
      const e = src.indexOf('\n  }', s) + '\n  }'.length;
      return src.slice(s, e);
    })();
    // The REAL fetch/render entry, in the same body so it writes the same
    // displayState and activePlace the replay reads.
    const loadAndRenderSrc = (() => {
      const s = src.indexOf('  async function loadAndRender(place)');
      const e = src.indexOf('\n  }', src.indexOf('      if (activeWeatherController === requestController)', s)) + '\n  }'.length;
      if (s < 0) throw new Error('loadAndRender not found');
      return src.slice(s, e);
    })();

    const installBanner = fakeEl();
    const installClose = fakeEl();
    reg.set('installBanner', installBanner);
    reg.set('installClose', installClose);
    const copyLoads = [];

    // install.js's own applyTranslations, run against these nodes.
    const fetchOutcomes = new Map();
    const cacheEntries = new Map();
    const cacheGates = new Map();
    const bankGates = [];
    const fetchSettlers = new Map();
    const loadErrors = [];
    const installSource = readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');
    const applyStartIdx = installSource.indexOf('  function applyTranslations()');
    const applyEndIdx = installSource.indexOf('\n  }', applyStartIdx) + '\n  }'.length;
    const realApplyTranslations = (lang) => loadWithEnv(
      'applyTranslations',
      installSource.slice(applyStartIdx, applyEndIdx),
      {
        getLanguage: () => lang,
        tInstall: (key, l) => INSTALL_T[key]?.[l] ?? INSTALL_T[key]?.en,
        setI18nText: (el, text) => { if (el) el.textContent = text; },
        banner: installBanner,
        iosModalClose: installClose,
        titleEl: fakeEl(), installBtn: fakeEl(), dismissBtn: fakeEl(),
        stepsEl: fakeEl(), stepsKey: null, footerLink: fakeEl(),
        document: { querySelectorAll: () => [] },
      },
    )();

    const liveNames = {
      ...uiDeps, updateUILanguage: realUpdateUILanguage,
      SUPPORTED_LANGS: ['en', 'af', 'zu', 'xh', 'st'],
      saveSettings: noop, closeLanguageMenu: noop,
      languageBtn: { focus: noop },
      // The REAL install translator, lifted out of assets/install.js — not a
      // stand-in. Astra disabled a hand-written substitute and every test still
      // passed; this runs install.js's own applyTranslations over the same
      // banner nodes, so removing its aria-label writes fails here.
      installExperience: { refreshLanguage: () => realApplyTranslations(settings.lang) },
      // Chunk loading, recorded so a test can also drive the FAILED case.
      loadCopyBank: (lang) => {
        copyLoads.push(lang);
        const p = copyLoadImpl(lang);
        // A DEFERRED bank: the request parks on `await bankReady` until the
        // test releases it — exactly where the stale-render bug lived.
        const gate = bankGates.shift();
        return gate ? gate.then(() => p, () => p) : p;
      },
      console: { error: (...a) => { loadErrors.push(a); } },
      // Hero surfaces for the loading / error states.
      showLoader: noop, hideSplash: noop,
      // The real placeholder translator, over the live settings.
      displayPlaceName: loadWithEnv('displayPlaceName', sliceFunction('displayPlaceName'), { t }),
      safeText: (el, txt) => { if (el) el.textContent = txt ?? '--'; },
      locationEl: $('#location'), headlineEl: $('#headline'),
      tempEl: $('#temp'), descriptionEl: $('#description'),
      // Stubbed network + cache so the REAL loadAndRender can be driven: the
      // fetch outcome registered per place name decides success or failure.
      activePlace: null, activeLocationSeq: 0, activeWeatherController: null,
      lastFetchTime: null, AbortController,
      fetchProbable: (place) => {
        const outcome = fetchOutcomes.get(place?.name);
        // `deferred` parks the fetch until the test settles it — so a stale
        // request can complete SUCCESSFULLY (or fail) after a newer one has
        // already rendered, which is the only way to exercise the guard that
        // sits after `await fetchPromise`.
        if (outcome?.deferred) {
          return new Promise((resolve, reject) => {
            fetchSettlers.set(place.name, {
              resolve: (payload) => resolve(payload ?? outcome.payload),
              reject: (err) => reject(err || new Error(`fetch failed for ${place.name}`)),
            });
          });
        }
        if (outcome?.pending) return new Promise(() => {});
        return outcome?.ok
          ? Promise.resolve(outcome.payload)
          : Promise.reject(new Error(`fetch failed for ${place?.name}`));
      },
      // A cache that can HIT: the journey must be able to exercise
      // cached-success → network-failure, not only the uncached path.
      // Cache reads and copy-bank loads can be DEFERRED, so a test can hold a
      // request mid-await, start a second one, and land the first afterwards.
      getCachedWeather: (place) => {
        const gate = cacheGates.get(place?.name);
        const value = cacheEntries.get(place?.name) || null;
        return gate ? gate.then(() => value) : Promise.resolve(value);
      },
      setCachedWeather: noop, showCacheAge: noop,
      refreshSaveButtonState: noop,
    };
    // The REAL Weekly and Hourly renderers plus clearForecastPanels, sharing
    // this registry — a no-op stub let a stale forecast sit there unnoticed.
    const forecastEnv = {
      t, settings, T,
      hourlyTimeline: panel('#hourly-timeline'), dailyCards: panel('#daily-cards'),
      document: liveNames.document,
      isNum: (v) => typeof v === 'number' && Number.isFinite(v),
      formatTemp: (c) => `${Math.round(c)}°`,
      getTempColorClass: () => '', round0: Math.round,
      getTranslatedDayName: () => t('days', 'mon'),
      getDayBadge: () => '', buildAdSlot: () => fakeEl(),
      // The weekly row's ONLY condition carrier is the labelled icon.
      conditionIcon: (ck) => `<svg aria-label="${T.heroLabels[ck]?.[settings.lang] || ''}"></svg>`,
      window: { __PW_LAST_NORM: { utcOffsetSeconds: 7200 } },
      getLocationHour: () => 10, parseLocalIsoMinutes: () => null,
      precipUnitLabel: () => 'mm', formatPrecipAmount: () => '0',
      windValue: () => 0, getWeatherIcon: () => '<svg/>', isHourDaylight: () => true,
      hourLabel: (h) => `${String(h).padStart(2, '0')}:00`,
      updateHourlySubtitle: noop, renderHourlyChart: noop, debugLog: noop,
    };
    // The REAL forecast renderers live in the SAME body as
    // clearForecastSurfaces (below), or the clear would be reaching into a
    // different scope's hourlyChartHours and the chart would never actually be
    // cleared. Their dependencies are merged into the one env.
    Object.assign(liveNames, forecastEnv, {
      hourlyMetric: 'temp', HOURLY_CHART_COLS: chartConst('HOURLY_CHART_COLS'),
      convertTemp: (c) => c, windUnitLabel: () => 'km/h', hourlyVoice: () => '',
      hourlyChartHours: null, hourlyChartStart: 0, hourlyChartPlace: '', hourlyChartLon: null,
      // renderHome's own surfaces, so the real one can run here too.
      statsRowEl: panel('#statsRow'), rangeLineEl: panel('#rangeLine'),
      feelsLineEl: $('#feelsLine'),
      // A recording host, so the chart's RENDERED content and visibility can be
      // asserted — not just its stored data.
      hourlyChartHost: panel('#hourlyChart'),
      agreeLineEl: $('#agreeLine'), capeWindBanner: $('#capeWindBanner'),
      syncCapeWindOffset: noop, hideCacheAge: noop,
      setHeroTemp: (el, _label, _range, temp) => { if (el) el.textContent = temp ?? '--°'; },
      getHeroLabel: loadConditionLabels('en', T).getHeroLabel,
      // renderHome's condition pipeline — pinned so the hero describes a known
      // condition instead of an inert stub.
      computeHomeDisplayCondition: () => 'rain',
      computeTodaysHero: () => ({}),
      resolveNightAwareCopyCondition: ({ displayCondition }) => displayCondition,
      isCopyBankLoaded: () => true,
      getWittyLine: () => 'WITTY-LINE',
      getHeadline: () => 'HEADLINE-LINE',
      renderSidebar: noop, setBackgroundFor: noop, createParticles: noop,
      reverseGeocode: () => Promise.resolve(null),
      shouldPersistHomeName: () => false, saveJSON: noop,
      // The REAL place comparison: renderLoading uses it to decide whether a
      // pending request is a refresh (keep the forecast) or a move (clear it).
      samePlace: (a, b) => a && b && Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) && Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4),
      // The REAL chart geometry constants, read from app.js — without them the
      // chart rendered an invalid viewBox and NaN coordinates while passing.
      CHART_W: chartConst('CHART_W'), CHART_H: chartConst('CHART_H'),
      renderCapeWind: noop, hideSplash: noop, showLoader: noop,
      formatWind: (w) => `${Math.round(w)} km/h`,
      capeWindText: fakeEl(), isWesternCape: () => false,
      escapeHtml: (s) => String(s),
    });
    // t/settings/document/$ must stay the LIVE ones, not forecastEnv's copies.
    liveNames.t = t; liveNames.settings = settings;
    liveNames.document = document_; liveNames.$ = $;
    // clearForecastPanels is lifted into the main body below (so renderError
    // calls the REAL one in the same scope); it needs these two hosts.
    liveNames.hourlyTimeline = forecastEnv.hourlyTimeline;
    liveNames.dailyCards = forecastEnv.dailyCards;
    let copyLoadImpl = (lang) => loadCopyBank(lang);
    // The proxy env (rather than a named parameter list) so loadAndRender's
    // long tail of helpers does not each need naming, and so its assignments to
    // activePlace / activeLocationSeq land somewhere the replay can see.
    const live = loadModuleWithEnv(
      [
        sliceFunction('clearForecastSurfaces'),
        sliceFunction('renderWeek'),
        sliceFunction('renderHourly'),
        sliceFunction('renderHourlyChart'),
        sliceFunction('updateHourlySubtitle'),
        // The Home surfaces the clear is responsible for.
        sliceFunction('renderStatsRow'),
        sliceFunction('renderFeelsLine'),
        sliceFunction('renderRangeLine'),
        sliceFunction('renderAgreeLine'),
        sliceFunction('renderHome'),
        body, selectionSrc, loadAndRenderSrc,
      ].join('\n'),
      `{ renderDayDetail, applySettings, applyLanguageSelection, renderLoading, renderError, loadAndRender,
         renderWeek, renderHourly,
         readChart: () => ({ hours: hourlyChartHours, place: hourlyChartPlace, host: $('#hourlyChart') }),
         setDisplayState: (s) => { displayState = s; },
         getDisplayState: () => displayState }`,
      liveNames,
    );
    if (withPayload) {
      live.setDisplayState({
        kind: 'payload', place: { name: 'Cape Town' },
        payload: { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] },
      });
    }
    return {
      ...live, reg, settings, $, star, bannerText, bannerAction,
      installBanner, installClose, copyLoads, env: liveNames, loadErrors,
      setFetchOutcome: (name, outcome) => fetchOutcomes.set(name, outcome),
      deferCache: (name) => { let r; cacheGates.set(name, new Promise((res) => { r = res; })); return r; },
      deferNextBank: () => { let r; bankGates.push(new Promise((res) => { r = res; })); return r; },
      settleFetch: (name, payload) => fetchSettlers.get(name)?.resolve(payload),
      failFetch: (name, err) => fetchSettlers.get(name)?.reject(err),
      setCacheEntry: (name, payload) => cacheEntries.set(name, { payload, timestamp: Date.now() }),
      weeklyText: () => reg.get('#daily-cards')?.innerHTML ?? '',
      hourlyText: () => reg.get('#hourly-timeline')?.innerHTML ?? '',
      failNextCopyLoad: () => { copyLoadImpl = () => Promise.reject(new Error('chunk 404')); },
    };
  }

  // applyLanguageSelection resolves after loadCopyBank settles, so the test has
  // to wait for the same tick the app does.
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('the SAME elements change language when the app switches (en → af)', () => {
    const appUnderTest = buildLiveApp();
    const norm = { utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] };

    // 1. Render in English — an OPEN day-detail panel plus a star and a banner.
    appUnderTest.renderDayDetail(norm, 0);
    const headerMeta = appUnderTest.reg.get('#dayDetailMeta');
    expect(headerMeta.textContent).toContain('Wet conditions');
    appUnderTest.star.setAttribute('aria-label', 'Save this place');
    appUnderTest.bannerText.textContent = 'New version';
    appUnderTest.bannerAction.textContent = 'Tap to refresh';

    // 2. The app's real language-switch path.
    appUnderTest.settings.lang = 'af';
    appUnderTest.applySettings();

    // 3. Those SAME element objects now carry Afrikaans.
    expect(headerMeta.textContent, 'open day detail did not follow the switch').toContain('Nat toestande');
    expect(headerMeta.textContent).not.toContain('Wet conditions');
    expect(appUnderTest.star.getAttribute('aria-label')).toBe('Stoor hierdie plek');
    expect(appUnderTest.bannerText.textContent).toBe('Nuwe weergawe');
    expect(appUnderTest.bannerAction.textContent).toBe('Tik om te verfris');
    expect(appUnderTest.reg.get('#navHome').getAttribute('aria-label')).toBe('Tuis');
    expect(appUnderTest.reg.get('#useMyLocationBtn').getAttribute('aria-label')).toBe('Gebruik my ligging');
  });

  it('switches on to Zulu without rebuilding anything', () => {
    const appUnderTest = buildLiveApp();
    const norm = { utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] };
    appUnderTest.renderDayDetail(norm, 0);
    const headerMeta = appUnderTest.reg.get('#dayDetailMeta');

    for (const lang of ['af', 'zu', 'xh', 'st', 'en']) {
      appUnderTest.settings.lang = lang;
      appUnderTest.applySettings();
      expect(headerMeta.textContent, `${lang} after switch`).toContain(T.heroLabels.rain[lang]);
    }
  });

  it('applyLanguageSelection is the path that calls it', () => {
    // The UI entry point: it sets settings.lang and then runs applySettings.
    const src = app();
    const fn = src.match(/function applyLanguageSelection\(lang\)[\s\S]*?\n  \}/)[0];
    expect(fn).toMatch(/settings\.lang\s*=\s*lang/);
    expect(fn).toMatch(/applySettings\(\)/);
  });

  // Astra round 4: the test above drives applySettings directly, so stubbing
  // the picker's own handler still passed. These drive the REAL async
  // applyLanguageSelection — the function the language menu calls.
  it('the real applyLanguageSelection switches the SAME elements to Afrikaans', async () => {
    const a = buildLiveApp();
    const norm = { utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] };
    a.renderDayDetail(norm, 0);
    const headerMeta = a.reg.get('#dayDetailMeta');
    expect(headerMeta.textContent).toContain('Wet conditions');
    a.star.setAttribute('aria-label', 'Save this place');
    a.installBanner.setAttribute('aria-label', 'Add Probably Weather to your home screen');

    a.applyLanguageSelection('af');
    await settle();

    expect(a.settings.lang).toBe('af');
    expect(a.copyLoads).toContain('af');
    expect(headerMeta.textContent, 'open day detail did not follow the real switch').toContain('Nat toestande');
    expect(headerMeta.textContent).not.toContain('Wet conditions');
    expect(a.star.getAttribute('aria-label')).toBe('Stoor hierdie plek');
    expect(a.reg.get('#navHome').getAttribute('aria-label')).toBe('Tuis');
    // The install banner's controls follow too.
    expect(a.installBanner.getAttribute('aria-label')).toBe('Voeg Probably Weather by jou tuisskerm');
    expect(a.installClose.getAttribute('aria-label')).toBe('Maak toe');
  });

  it('the real applyLanguageSelection still switches when the language chunk FAILS', async () => {
    // applySettings runs in .finally(), so the UI chrome must switch even
    // though the copy bank never arrived — and the seed keeps the condition
    // labels non-English.
    const a = buildLiveApp();
    const norm = { utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] };
    a.renderDayDetail(norm, 0);
    a.failNextCopyLoad();

    a.applyLanguageSelection('st');
    await settle();

    expect(a.settings.lang).toBe('st');
    expect(a.reg.get('#navHome').getAttribute('aria-label')).toBe(T.nav.home.st);
    expect(a.reg.get('#useMyLocationBtn').getAttribute('aria-label')).toBe(T.misc.useMyLocation.st);
    expect(a.reg.get('#dayDetailMeta').textContent).not.toContain('Wet conditions');
    expect(a.installClose.getAttribute('aria-label')).toBe('Koala');
  });

  // Astra round 5: on an ERROR screen there is no lastPayload, so applySettings
  // re-rendered nothing and "Error" / "Couldn't fetch weather right now." stayed
  // English after the switch.
  it('switches an ERROR state to Afrikaans through the real entry point', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.renderError(null, 'couldntFetch');
    const headline = a.reg.get('#headline');
    const description = a.reg.get('#description');
    expect(headline.textContent).toBe('Error');
    expect(description.textContent).toBe("Couldn't fetch weather right now.");

    a.applyLanguageSelection('af');
    await settle();

    expect(headline.textContent, 'error headline stayed English').toBe('Fout');
    expect(description.textContent, 'error body stayed English').toBe('Kon nie weer kry nie.');
  });

  it('switches an error state into every language', async () => {
    for (const lang of ['zu', 'xh', 'st']) {
      const a = buildLiveApp({ withPayload: false });
      a.renderError(null, 'couldntFetch');
      a.applyLanguageSelection(lang);
      await settle();
      expect(a.reg.get('#headline').textContent, `${lang} error headline`).toBe(T.misc.error[lang]);
      expect(a.reg.get('#description').textContent, `${lang} error body`).toBe(T.misc.couldntFetch[lang]);
    }
  });

  it('switches a LOADING state, including the two hardcoded location headings', async () => {
    for (const [key, lang] of [['gettingLocation', 'af'], ['locating', 'zu'], ['gettingLocation', 'st'], ['locating', 'xh']]) {
      const a = buildLiveApp({ withPayload: false });
      a.renderLoading(null, key);
      expect(a.reg.get('#location').textContent).toBe(T.misc[key].en);
      a.applyLanguageSelection(lang);
      await settle();
      expect(a.reg.get('#location').textContent, `${lang}/${key}`).toBe(T.misc[key][lang]);
      expect(a.reg.get('#location').textContent).not.toMatch(/Getting location|Locating/);
    }
  });

  it('a real place name is NOT translated, only the status headings are', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.renderLoading('Strand, Western Cape', null);
    a.applyLanguageSelection('af');
    await settle();
    expect(a.reg.get('#location').textContent).toBe('Strand, Western Cape');
  });

  // Astra round 6: during GPS loading the heading showed the literal
  // placeholder "My Location" under every language — first-open passes that
  // literal, and a favourite stored before its reverse-geocode landed carries
  // it too. A placeholder is app copy, not a gazetteer result.
  describe('placeholder place names are translated, real ones are not', () => {
    it('first-open GPS shows the localized My Location', async () => {
      for (const lang of NON_EN) {
        const a = buildLiveApp({ withPayload: false });
        a.renderLoading(null, 'myLocation');
        a.applyLanguageSelection(lang);
        await settle();
        expect(a.reg.get('#location').textContent, `${lang} first-open`).toBe(T.misc.myLocation[lang]);
        expect(a.reg.get('#location').textContent).not.toBe('My Location');
      }
    });

    it('a STORED placeholder favourite is translated on display', async () => {
      for (const lang of NON_EN) {
        const a = buildLiveApp({ withPayload: false });
        // The literal a stored place carries when its reverse-geocode never landed.
        a.renderLoading('My Location', null);
        expect(a.reg.get('#location').textContent).toBe('My Location');
        a.applyLanguageSelection(lang);
        await settle();
        expect(a.reg.get('#location').textContent, `${lang} stored placeholder`).toBe(T.misc.myLocation[lang]);
      }
    });

    it('"Unknown" is translated too', async () => {
      for (const lang of NON_EN) {
        const a = buildLiveApp({ withPayload: false });
        a.renderLoading('Unknown', null);
        a.applyLanguageSelection(lang);
        await settle();
        expect(a.reg.get('#location').textContent, `${lang} unknown`).toBe(T.misc.unknownPlace[lang]);
      }
    });

    it('a REAL place name is never translated, in any language', async () => {
      for (const lang of NON_EN) {
        const a = buildLiveApp({ withPayload: false });
        a.renderLoading('Strand, Western Cape', null);
        a.applyLanguageSelection(lang);
        await settle();
        expect(a.reg.get('#location').textContent, `${lang} real name`).toBe('Strand, Western Cape');
      }
    });

    // Astra round 7 major 2: the sweep. Every site where a place name reaches
    // the DOM goes through displayPlaceName; the stored DATA is untouched, so
    // data-name still re-loads the right place.
    it('favourites and recents translate the DISPLAYED name but keep the stored one', () => {
      const src = app();
      expect(src).toMatch(/<span class="recent-name">\$\{escapeHtml\(displayPlaceName\(p\.name\)\)\}<\/span>/);
      expect(src).toMatch(/<span class="fav-name" role="button" tabindex="0">\$\{escapeHtml\(displayPlaceName\(p\.name\)\)\}<\/span>/);
      // data-name stays raw — it is the key the click handler reloads from.
      expect(src).toMatch(/data-name="\$\{escapeHtml\(p\.name\)\}"[^>]*>\$\{logoMini\}/);
      expect(src).toMatch(/class="favorite-item"[^`]*data-name="\$\{escapeHtml\(p\.name\)\}"/);
    });

    it('the hourly subtitle translates a placeholder and keeps an empty one empty', () => {
      for (const lang of NON_EN) {
        const t = (c, k) => T[c]?.[k]?.[lang] || T[c]?.[k]?.en || k;
        const displayPlaceName = loadWithEnv('displayPlaceName', sliceFunction('displayPlaceName'), { t });
        const el = fakeEl();
        const run = (captured) => {
          const fn = loadWithEnv('updateHourlySubtitle', sliceFunction('updateHourlySubtitle'), {
            $: () => el, t, displayPlaceName,
            hourlyChartPlace: captured, hourlyChartLon: 18.4,
            hourlyVoice: () => '', getLocationHour: () => 10,
          });
          fn();
          return el.textContent;
        };
        expect(run('My Location'), `${lang} placeholder`).toContain(T.misc.myLocation[lang]);
        expect(run('My Location')).not.toContain('My Location');
        expect(run('Strand'), `${lang} real name`).toContain('Strand');
        // Empty means "no place captured yet" — the bare tail, not "Unknown".
        expect(run(''), `${lang} empty`).not.toContain(T.misc.unknownPlace[lang]);
      }
    });

    // The upstream name itself can BE the placeholder — api/_lib/weather-cache.js's
    // cacheableLocationName emits the literal 'Unknown' — so translating only
    // the missing-name fallback was not enough.
    it('a search result named "Unknown" upstream is localized, and keeps its country', () => {
      for (const lang of LANGS) {
        const t = (c, k) => T[c]?.[k]?.[lang] || T[c]?.[k]?.en || k;
        const displayPlaceName = loadWithEnv('displayPlaceName', sliceFunction('displayPlaceName'), { t });
        const format = loadWithEnv('formatSearchResult', sliceFunction('formatSearchResult'), { t, displayPlaceName });
        const raw = loadWithEnv('searchResultName', sliceFunction('searchResultName'), { t });

        // The server's placeholder, with and without a country.
        expect(format({ name: 'Unknown', address: { country: 'South Africa' } }))
          .toBe(`${T.misc.unknownPlace[lang]}, South Africa`);
        expect(format({ name: 'Unknown', address: {} })).toBe(T.misc.unknownPlace[lang]);
        // A nameless feature with no fields at all.
        expect(format({ address: {} })).toBe(T.misc.unknownPlace[lang]);
        // A real name is never touched.
        expect(format({ name: 'Strand', address: { country: 'South Africa' } })).toBe('Strand, South Africa');
        if (lang !== 'en') {
          expect(format({ name: 'Unknown', address: { country: 'South Africa' } })).not.toContain('Unknown');
        }
        // What gets STORED stays language-neutral.
        expect(raw({ name: 'Unknown', address: { country: 'South Africa' } })).toBe('Unknown, South Africa');
      }
    });

    it('stored search-result data and dedupe use the raw name, not the translated one', () => {
      const src = app();
      expect(src).toMatch(/data-name="\$\{escapeHtml\(searchResultName\(r\)\)\}"/);
      expect(src).toMatch(/searchResultName\(prev\) === searchResultName\(r\)/);
      // And results already on screen follow a language switch.
      expect(updateUILanguageSrc()).toMatch(/if \(searchResults\.length\) renderSearchResults\(searchResults\)/);
    });

    it('the helper itself only touches recognised placeholders', () => {
      for (const lang of LANGS) {
        const t = (c, k) => T[c]?.[k]?.[lang] || T[c]?.[k]?.en || k;
        const displayPlaceName = loadWithEnv('displayPlaceName', sliceFunction('displayPlaceName'), { t });
        expect(displayPlaceName('My Location')).toBe(T.misc.myLocation[lang]);
        expect(displayPlaceName('my location')).toBe(T.misc.myLocation[lang]);
        expect(displayPlaceName('Unknown')).toBe(T.misc.unknownPlace[lang]);
        expect(displayPlaceName('')).toBe(T.misc.unknownPlace[lang]);
        // Real names, including ones that merely CONTAIN a placeholder word.
        expect(displayPlaceName('Strand')).toBe('Strand');
        expect(displayPlaceName('Johannesburg')).toBe('Johannesburg');
        expect(displayPlaceName('Unknown Bay')).toBe(T.misc.unknownPlace[lang]); // ^unknown\b — same rule as isPlaceholderName
        expect(displayPlaceName('Port Unknown')).toBe('Port Unknown');
      }
    });
  });

  // Astra round 6: lastPayload survived a failed location change and outranked
  // the error state, so a language switch restored the PREVIOUS place's
  // forecast over the current place's error.
  it('Cape Town success → Johannesburg failure → EN→AF shows the Johannesburg error', async () => {
    const a = buildLiveApp();                       // starts with a Cape Town payload
    expect(a.getDisplayState().kind).toBe('payload');

    // The failed switch to Johannesburg.
    a.settings && (a.reg.get('#location').textContent = 'Johannesburg');
    a.renderError(null, 'couldntFetch');
    expect(a.getDisplayState().kind).toBe('error');

    a.applyLanguageSelection('af');
    await settle();

    // The translated error, NOT Cape Town's forecast.
    expect(a.reg.get('#headline').textContent).toBe('Fout');
    expect(a.reg.get('#description').textContent).toBe('Kon nie weer kry nie.');
    expect(a.reg.get('#description').textContent).not.toContain('Nat toestande');
    expect(a.getDisplayState().kind).toBe('error');
  });

  // Astra round 7: the journey assigned state by hand. This drives the REAL
  // loadAndRender with a stubbed fetch, so removing the payload-state
  // assignments inside it breaks the test.
  it('REAL loadAndRender: Cape Town success → Johannesburg failure → EN→AF shows the error', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { ok: true, payload: { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] } });
    a.setFetchOutcome('Johannesburg', { ok: false });

    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    expect(a.getDisplayState().kind, 'success must record a payload state').toBe('payload');
    expect(a.reg.get('#location').textContent).toBe('Cape Town');

    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.getDisplayState().kind, 'failure must supersede the payload').toBe('error');
    expect(a.reg.get('#location').textContent).toBe('Johannesburg');

    a.applyLanguageSelection('af');
    await settle();

    expect(a.reg.get('#headline').textContent).toBe('Fout');
    expect(a.reg.get('#description').textContent).toBe('Kon nie weer kry nie.');
    // Cape Town's forecast must NOT come back, and the heading stays Johannesburg.
    expect(a.reg.get('#description').textContent).not.toContain('Nat toestande');
    expect(a.reg.get('#location').textContent).toBe('Johannesburg');
  });

  it('REAL loadAndRender: a success after a failure records a payload state again', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Johannesburg', { ok: false });
    a.setFetchOutcome('Durban', { ok: true, payload: { daily: [{ conditionKey: 'clear', conditionLabel: 'Sunny', highC: 28, lowC: 18 }], hourly: [] } });
    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.getDisplayState().kind).toBe('error');
    await a.loadAndRender({ name: 'Durban', lat: -29.8, lon: 31.0 });
    expect(a.getDisplayState().kind).toBe('payload');
  });

  // Astra round 7 major 1: renderError discarded the loading name, so a GPS
  // fetch failure left the untranslated literal "My Location" above a
  // translated error.
  it('REAL loadAndRender: GPS placeholder → fetch failure → EN→AF translates the heading', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('My Location', { ok: false });
      await a.loadAndRender({ name: 'My Location', lat: -33.9, lon: 18.4 });

      expect(a.getDisplayState().kind).toBe('error');
      expect(a.reg.get('#location').textContent, 'English before the switch').toBe('My Location');

      a.applyLanguageSelection(lang);
      await settle();

      expect(a.reg.get('#location').textContent, `${lang} heading after GPS failure`).toBe(T.misc.myLocation[lang]);
      expect(a.reg.get('#location').textContent).not.toBe('My Location');
      expect(a.reg.get('#headline').textContent).toBe(T.misc.error[lang]);
    }
  });

  it('REAL loadAndRender: a real place name survives the same failure untranslated', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Strand, Western Cape', { ok: false });
    await a.loadAndRender({ name: 'Strand, Western Cape', lat: -34.1, lon: 18.8 });
    a.applyLanguageSelection('af');
    await settle();
    expect(a.reg.get('#location').textContent).toBe('Strand, Western Cape');
    expect(a.reg.get('#headline').textContent).toBe('Fout');
  });

  // Astra round 8: Home showed the translated error while Weekly and Hourly
  // still listed the PREVIOUS place's forecast, rendered in the old language —
  // English headings and weekly icons still named "Wet conditions".
  it('REAL renderers: a failed location change clears Weekly/Hourly, in every language', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('Cape Town', { ok: true, payload: { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }], hourly: [] } });
      a.setFetchOutcome('Johannesburg', { ok: false });

      await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
      // The real weekly render put Cape Town's week up, icon label included.
      expect(a.weeklyText()).toContain('Wet conditions');

      await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
      expect(a.getDisplayState().kind).toBe('error');
      // Cape Town's week is GONE, replaced by the localized unavailable note.
      expect(a.weeklyText(), 'stale weekly forecast survived the failure').not.toContain('Wet conditions');
      expect(a.weeklyText()).toContain(T.misc.couldntFetch.en);
      expect(a.hourlyText()).toContain(T.misc.couldntFetch.en);

      a.applyLanguageSelection(lang);
      await settle();

      // …and after the switch all three surfaces speak the new language.
      expect(a.reg.get('#headline').textContent, `${lang} home`).toBe(T.misc.error[lang]);
      expect(a.weeklyText(), `${lang} weekly`).toContain(T.misc.couldntFetch[lang]);
      expect(a.hourlyText(), `${lang} hourly`).toContain(T.misc.couldntFetch[lang]);
      expect(a.weeklyText()).not.toContain(T.misc.couldntFetch.en);
      expect(a.weeklyText()).not.toContain('Wet conditions');
    }
  });

  it('REAL renderers: a payload switch re-renders the week, icons named in the new language', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('Cape Town', { ok: true, payload: { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }], hourly: [] } });
      await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
      if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1] || e[0])).join(' | '));
      expect(a.weeklyText()).toContain('Wet conditions');

      a.applyLanguageSelection(lang);
      await settle();

      // The weekly icon's accessible name is the row's only condition carrier.
      expect(a.weeklyText(), `${lang} weekly icon label`).toContain(T.heroLabels.rain[lang]);
      expect(a.weeklyText(), `${lang} weekly kept English`).not.toContain('Wet conditions');
      expect(a.getDisplayState().kind).toBe('payload');
    }
  });

  // Astra round 8 minor: the harness always missed the cache, so removing the
  // CACHED payload-state assignment changed nothing — although that mutation
  // makes a language switch replace a cached forecast with "Loading".
  // Astra round 9: Home's stats row, byline, range line, agree line, hero
  // temperature and hourly chart all survived the error in the previous
  // language. Every forecast-derived surface must go.
  it('REAL renderHome/renderHourly/renderWeek: a failure clears EVERY forecast surface', async () => {
    const a = buildLiveApp({ withPayload: false });
    const hourly = Array.from({ length: 48 }, (_, i) => ({ tempC: 14 + (i % 6), rainChance: 40, cloudPct: 60, uv: 2, windKmh: 12, precipMm: 0.2 }));
    a.setFetchOutcome('Cape Town', {
      ok: true,
      payload: {
        daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }],
        hourly, nowTemp: 15, rainPct: 60, windKph: 20, uv: 2,
        todayLow: 9, todayHigh: 18, conditionConfidence: { sourceAgreement: '4/5' },
      },
    });
    a.setFetchOutcome('Johannesburg', { ok: false });

    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));

    // Everything is populated from Cape Town's payload.
    expect(a.weeklyText()).toContain('Wet conditions');
    expect(a.hourlyText()).not.toBe('');
    expect(a.reg.get('#statsRow').innerHTML).not.toBe('');
    expect(a.reg.get('#rangeLine').innerHTML).not.toBe('');
    expect(a.reg.get('#agreeLine').textContent).toContain('4');
    expect(a.reg.get('#temp').textContent).not.toBe('--°');
    expect(a.readChart().hours, 'chart data captured').toBeTruthy();
    expect(a.readChart().place).toBe('Cape Town');

    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.getDisplayState().kind).toBe('error');

    // …and every one of them is gone.
    expect(a.weeklyText(), 'weekly').not.toContain('Wet conditions');
    expect(a.hourlyText(), 'hourly').toContain(T.misc.couldntFetch.en);
    expect(a.reg.get('#statsRow').innerHTML, 'stats row').toBe('');
    expect(a.reg.get('#statsRow').hidden).toBe(true);
    expect(a.reg.get('#weatherByline').innerHTML, 'byline').toBe('');
    expect(a.reg.get('#rangeLine').innerHTML, 'range line').toBe('');
    expect(a.reg.get('#agreeLine').textContent, 'agree line').toBe('');
    expect(a.reg.get('#temp').textContent, 'hero temperature').toBe('--°');
    expect(a.reg.get('#hourlySubtitle').textContent, 'hourly subtitle').toBe('');
    expect(a.reg.get('#day-detail-content').innerHTML, 'day detail').toBe('');
    // The chart's STORED data, not just its pixels.
    expect(a.readChart().hours, 'chart data').toBeFalsy();
    expect(a.readChart().place, 'chart place').toBe('');
  });

  // A payload that makes every optional surface appear: feels-like differs from
  // the current temp by >= 3°, there is a low/high range, and an agreement figure.
  const fullPayload = () => ({
    daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }],
    hourly: Array.from({ length: 48 }, (_, i) => ({ tempC: 14 + (i % 6), rainChance: 40, cloudPct: 60, uv: 2, windKmh: 12, precipMm: 0.2 })),
    nowTemp: 15, feelsLike: 10, rainPct: 60, windKph: 20, uv: 2,
    todayLow: 9, todayHigh: 18, conditionConfidence: { sourceAgreement: '4/5' },
  });

  // Astra round 10 major 1: the feels-like line was missing from the clear.
  it('REAL renderFeelsLine: "Feels like" does not survive a failed location change', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { ok: true, payload: fullPayload() });
    a.setFetchOutcome('Johannesburg', { ok: false });

    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));
    expect(a.reg.get('#feelsLine').textContent, 'feels line should be populated').toContain('10');
    expect(a.reg.get('#feelsLine').hidden).toBe(false);

    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.reg.get('#feelsLine').textContent, 'feels line survived the failure').toBe('');
    expect(a.reg.get('#feelsLine').hidden).toBe(true);

    a.applyLanguageSelection('af');
    await settle();
    expect(a.reg.get('#feelsLine').textContent, 'feels line came back on the switch').toBe('');
  });

  // Astra round 10 major 2: a regression the clear introduced. Hiding a surface
  // on error is only half a pair — the next success has to show it again.
  it('REAL renderers: success → error → success restores EVERY surface', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { ok: true, payload: fullPayload() });
    a.setFetchOutcome('Johannesburg', { ok: false });
    a.setFetchOutcome('Durban', { ok: true, payload: fullPayload() });

    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));
    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    // Everything hidden by the error…
    for (const sel of ['#statsRow', '#rangeLine', '#feelsLine', '#weatherByline']) {
      expect(a.reg.get(sel).hidden, `${sel} should be hidden after the error`).toBe(true);
    }
    expect(a.readChart().host.hidden, 'chart hidden after error').toBe(true);
    expect(a.readChart().host.innerHTML, 'chart emptied after error').toBe('');

    // …and every one of them back after the next successful forecast. The
    // Johannesburg failure is already in loadErrors, so only NEW entries count.
    const errsBefore = a.loadErrors.length;
    await a.loadAndRender({ name: 'Durban', lat: -29.8, lon: 31.0 });
    const newErrs = a.loadErrors.slice(errsBefore);
    if (newErrs.length) throw new Error('recovery failed: ' + newErrs.map((e) => String(e[1]?.stack || e[1])).join(' | '));

    for (const sel of ['#statsRow', '#rangeLine', '#feelsLine', '#weatherByline']) {
      expect(a.reg.get(sel).hidden, `${sel} stayed hidden after recovery`).toBe(false);
      expect(a.reg.get(sel).innerHTML || a.reg.get(sel).textContent, `${sel} empty after recovery`).not.toBe('');
    }
    expect(a.reg.get('#agreeLine').hidden, 'agree line stayed hidden').toBe(false);
    expect(a.reg.get('#temp').textContent).not.toBe('--°');
    expect(a.weeklyText()).toContain('Wet conditions');
    // The chart is re-rendered WITH content, not merely un-hidden.
    expect(a.readChart().hours, 'chart data restored').toBeTruthy();
    expect(a.readChart().place).toBe('Durban');
    expect(a.readChart().host.hidden, 'chart still hidden after recovery').toBe(false);
    expect(a.readChart().host.innerHTML, 'chart rendered no content').not.toBe('');
  });

  // Astra round 11 minor: the harness had no CHART_W/CHART_H, so the chart drew
  // an invalid viewBox and NaN coordinates while the test still passed.
  it('REAL renderHourlyChart: the plotted geometry is valid', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { ok: true, payload: fullPayload() });
    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));

    const W = chartConst('CHART_W');
    const H = chartConst('CHART_H');
    expect(Number.isFinite(W) && W > 0).toBe(true);
    expect(Number.isFinite(H) && H > 0).toBe(true);

    // Walk the recorded tree for the SVG the line metric draws.
    const svgs = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (n.attrs?.viewBox) svgs.push(n);
      (n.children || []).forEach(walk);
    };
    walk(a.readChart().host);
    expect(svgs.length, 'no plotted SVG found in the chart').toBeGreaterThan(0);

    for (const svg of svgs) {
      // A well-formed viewBox: four finite numbers, matching the constants.
      const parts = String(svg.attrs.viewBox).trim().split(/\s+/).map(Number);
      expect(parts, 'viewBox must have four parts').toHaveLength(4);
      for (const p of parts) expect(Number.isFinite(p), `viewBox part ${p} is not finite`).toBe(true);
      expect(parts[2]).toBe(W);
      expect(parts[3]).toBe(H);
      expect(String(svg.attrs.viewBox)).not.toMatch(/NaN|undefined/);
    }

    // Every plotted coordinate must be a finite number inside the viewBox —
    // and there must BE coordinates. Astra removed the polyline's `points`
    // assignment entirely and the old assertions, which only rejected bad
    // values, passed on an empty chart.
    const coords = [];
    const pointLists = [];
    const walkCoords = (n) => {
      if (!n || typeof n !== 'object') return;
      for (const key of ['x', 'y', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']) {
        if (n.attrs?.[key] !== undefined) coords.push([key, Number(n.attrs[key])]);
      }
      for (const key of ['points', 'd']) {
        if (n.attrs?.[key] !== undefined) {
          expect(String(n.attrs[key]), `${key} contains NaN`).not.toMatch(/NaN|undefined|Infinity/);
          pointLists.push([key, String(n.attrs[key])]);
        }
      }
      (n.children || []).forEach(walkCoords);
    };
    walkCoords(a.readChart().host);

    // The line metric plots a polyline: it must exist and carry one point per
    // fixture hour, not an empty string.
    expect(pointLists.length, 'no plotted point list (points/d) rendered at all').toBeGreaterThan(0);
    const expectedPoints = Math.min(chartConst('HOURLY_CHART_COLS'), fullPayload().hourly.length);
    let matched = 0;
    for (const [key, raw] of pointLists) {
      expect(raw.trim(), `${key} is empty`).not.toBe('');
      const nums = (raw.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      expect(nums.length, `${key} has no plotted numbers`).toBeGreaterThan(0);
      for (const v of nums) expect(Number.isFinite(v), `${key} has a non-finite value`).toBe(true);
      if (key === 'points') {
        // "x,y x,y …" — one pair per plotted hour, each inside the viewBox.
        const pairs = raw.trim().split(/\s+/).filter(Boolean).map((p) => p.split(',').map(Number));
        expect(pairs.length, 'polyline point count does not match the fixture').toBe(expectedPoints);
        for (const [x, y] of pairs) {
          expect(Number.isFinite(x) && Number.isFinite(y), `pair ${x},${y} not finite`).toBe(true);
          expect(x, `x=${x} outside 0..${W}`).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(W);
          expect(y, `y=${y} outside 0..${H}`).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(H);
        }
        matched++;
      }
    }
    expect(matched, 'no polyline `points` attribute found').toBeGreaterThan(0);

    for (const [key, v] of coords) {
      expect(Number.isFinite(v), `${key}=${v} is not finite`).toBe(true);
      const bound = /x/.test(key) ? W : H;
      expect(v, `${key}=${v} outside 0..${bound}`).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(bound + 1);
    }
  });

  // Astra round 11: the loading branch only redrew the heading, so a switch
  // while a request was PENDING left the previous place's forecast — feels-like
  // line, stats, weekly icons — sitting there in the previous language.
  // Astra round 12 major: the staleness guard ran BEFORE `await bankReady`, so
  // a slow copy bank for Cape Town resolved after the user had moved on and the
  // stale continuation re-assigned displayState and re-rendered Cape Town's
  // forecast over Johannesburg's error. Driven through the REAL loadAndRender
  // with deferred cache, bank and fetch promises — no hand-assigned state.
  it.each(NON_EN)('REAL loadAndRender: a stale request that lands after a switch does NOTHING (%s)', async (lang) => {
    const a = buildLiveApp({ withPayload: false });
    const capeTown = { name: 'Cape Town', lat: -33.9, lon: 18.4 };
    const joburg = { name: 'Johannesburg', lat: -26.2, lon: 28.0 };
    a.setCacheEntry('Cape Town', fullPayload());
    a.setFetchOutcome('Cape Town', { pending: true });   // never settles
    a.setFetchOutcome('Johannesburg', { ok: false });

    // Cape Town parks on `await bankReady` — the exact await Astra named.
    const releaseBank = a.deferNextBank();
    const capeTownRun = a.loadAndRender(capeTown);
    await settle();
    expect(a.getDisplayState().kind, 'Cape Town should still be loading').toBe('loading');

    // The user switches language and then moves to Johannesburg, which fails.
    a.applyLanguageSelection(lang);
    await settle();
    await a.loadAndRender(joburg);
    expect(a.getDisplayState().kind).toBe('error');
    expect(a.getDisplayState().place.name).toBe('Johannesburg');
    const errorHeadline = a.reg.get('#headline').textContent;
    const errorWeekly = a.weeklyText();

    // NOW Cape Town's copy bank finally resolves.
    releaseBank();
    await capeTownRun;
    await settle();

    // The stale continuation must not render, and must not touch the record.
    expect(a.getDisplayState().kind, 'stale request overwrote the display state').toBe('error');
    expect(a.getDisplayState().place.name).toBe('Johannesburg');
    expect(a.reg.get('#headline').textContent, 'stale request re-rendered Home').toBe(errorHeadline);
    expect(a.weeklyText(), 'stale request restored the old forecast').toBe(errorWeekly);
    expect(a.weeklyText()).not.toContain('Wet conditions');
    expect(a.weeklyText()).not.toContain(T.heroLabels.rain[lang]);
    expect(a.reg.get('#location').textContent).toBe('Johannesburg');
  });

  it('REAL loadAndRender: a stale request parked on the CACHE read also does nothing', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setCacheEntry('Cape Town', fullPayload());
    a.setFetchOutcome('Cape Town', { pending: true });
    a.setFetchOutcome('Johannesburg', { ok: false });

    const releaseCache = a.deferCache('Cape Town');
    const capeTownRun = a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    await settle();
    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.getDisplayState().kind).toBe('error');
    const before = a.weeklyText();

    releaseCache();
    await capeTownRun;
    await settle();

    expect(a.getDisplayState().kind).toBe('error');
    expect(a.getDisplayState().place.name).toBe('Johannesburg');
    expect(a.weeklyText()).toBe(before);
    expect(a.weeklyText()).not.toContain('Wet conditions');
  });

  // Astra round 13 minor 2: every deferred fetch in the previous round never
  // settled, so the guard after `await fetchPromise` was never exercised —
  // removing it changed nothing. These land a stale fetch AFTER a newer request
  // has already rendered, both successfully and by failing.
  it.each(NON_EN)('REAL loadAndRender: a stale fetch that SUCCEEDS late changes nothing (%s)', async (lang) => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { deferred: true, payload: fullPayload() });
    a.setFetchOutcome('Johannesburg', { ok: false });

    const capeTownRun = a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    await settle();
    a.applyLanguageSelection(lang);
    await settle();
    await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    expect(a.getDisplayState().kind).toBe('error');
    const headlineAfter = a.reg.get('#headline').textContent;
    const weeklyAfter = a.weeklyText();
    const locationAfter = a.reg.get('#location').textContent;

    // Cape Town's fetch now RESOLVES, well after Johannesburg failed.
    a.settleFetch('Cape Town');
    await capeTownRun;
    await settle();

    expect(a.getDisplayState().kind, 'stale success overwrote the state').toBe('error');
    expect(a.getDisplayState().place.name).toBe('Johannesburg');
    expect(a.reg.get('#headline').textContent, 'stale success re-rendered Home').toBe(headlineAfter);
    expect(a.weeklyText(), 'stale success rendered the old forecast').toBe(weeklyAfter);
    expect(a.reg.get('#location').textContent).toBe(locationAfter);
    expect(a.weeklyText()).not.toContain('Wet conditions');
    expect(a.weeklyText()).not.toContain(T.heroLabels.rain[lang]);
  });

  it('REAL loadAndRender: a stale fetch that FAILS late does not overwrite a newer forecast', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setFetchOutcome('Cape Town', { deferred: true });
    a.setFetchOutcome('Durban', { ok: true, payload: fullPayload() });

    const capeTownRun = a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    await settle();
    await a.loadAndRender({ name: 'Durban', lat: -29.8, lon: 31.0 });
    expect(a.getDisplayState().kind).toBe('payload');
    const weeklyAfter = a.weeklyText();

    // Cape Town's fetch now REJECTS — it must not turn Durban into an error.
    a.failFetch('Cape Town');
    await capeTownRun;
    await settle();

    expect(a.getDisplayState().kind, 'stale failure overwrote a good forecast').toBe('payload');
    expect(a.getDisplayState().place.name).toBe('Durban');
    expect(a.weeklyText()).toBe(weeklyAfter);
    expect(a.weeklyText()).toContain('Wet conditions');
    expect(a.reg.get('#headline').textContent).not.toBe(T.misc.error.en);
    expect(a.reg.get('#location').textContent).toBe('Durban');
  });

  it('REAL loadAndRender: the LATEST request still renders normally after an overlap', async () => {
    // The guard must reject only the stale one — the winner still works.
    const a = buildLiveApp({ withPayload: false });
    a.setCacheEntry('Cape Town', fullPayload());
    a.setFetchOutcome('Cape Town', { pending: true });
    a.setFetchOutcome('Durban', { ok: true, payload: fullPayload() });

    const releaseBank = a.deferNextBank();
    const capeTownRun = a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    await settle();
    await a.loadAndRender({ name: 'Durban', lat: -29.8, lon: 31.0 });

    releaseBank();
    await capeTownRun;
    await settle();

    expect(a.getDisplayState().kind).toBe('payload');
    expect(a.getDisplayState().place.name).toBe('Durban');
    expect(a.weeklyText()).toContain('Wet conditions');
    expect(a.reg.get('#location').textContent).toBe('Durban');
  });

  it('REAL renderers: switching during a PENDING request for a NEW place clears and localizes', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('Cape Town', { ok: true, payload: fullPayload() });
      await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
      if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));
      expect(a.weeklyText()).toContain('Wet conditions');
      expect(a.reg.get('#feelsLine').textContent).toContain('10');

      // A REAL request for Johannesburg that never resolves. Driven through
      // loadAndRender, not by hand: the order in which it assigns activePlace
      // before renderLoading is part of what is under test.
      a.setFetchOutcome('Johannesburg', { pending: true });
      a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
      await settle();
      expect(a.getDisplayState().kind).toBe('loading');
      expect(a.getDisplayState().place.name, 'loading state must name the NEW place').toBe('Johannesburg');
      // The move must already have cleared the old place's forecast.
      expect(a.weeklyText(), 'old forecast survived the move').not.toContain('Wet conditions');

      a.applyLanguageSelection(lang);
      await settle();

      // Cape Town's forecast is gone, and what replaced it is localized.
      expect(a.weeklyText(), `${lang} weekly`).not.toContain('Wet conditions');
      expect(a.weeklyText(), `${lang} weekly note`).toContain(T.misc.couldntFetch[lang]);
      expect(a.reg.get('#feelsLine').textContent, `${lang} feels line`).toBe('');
      expect(a.reg.get('#statsRow').innerHTML, `${lang} stats`).toBe('');
      expect(a.reg.get('#temp').textContent).toBe('--°');
      expect(a.reg.get('#location').textContent).toBe('Johannesburg');
      expect(a.reg.get('#headline').textContent, `${lang} loading copy`).toBe(T.misc.loading[lang]);
    }
  });

  it('REAL renderers: switching during a REFRESH of the SAME place keeps the forecast, in the new language', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('Cape Town', { ok: true, payload: fullPayload() });
      const capeTown = { name: 'Cape Town', lat: -33.9, lon: 18.4 };
      await a.loadAndRender(capeTown);
      if (a.loadErrors.length) throw new Error('load failed: ' + a.loadErrors.map((e) => String(e[1]?.stack || e[1])).join(' | '));

      // A refresh of the SAME place, still pending.
      a.renderLoading('Cape Town', null);
      expect(a.getDisplayState().kind).toBe('loading');
      expect(a.getDisplayState().payload, 'the refresh must retain the payload').toBeTruthy();
      // The forecast is still true, so it is still on screen.
      expect(a.weeklyText()).toContain('Wet conditions');

      a.applyLanguageSelection(lang);
      await settle();

      // Retained — and re-rendered in the new language.
      expect(a.weeklyText(), `${lang} weekly kept`).toContain(T.heroLabels.rain[lang]);
      expect(a.weeklyText(), `${lang} weekly still English`).not.toContain('Wet conditions');
      expect(a.weeklyText()).not.toContain(T.misc.couldntFetch[lang]);
      expect(a.reg.get('#feelsLine').textContent, `${lang} feels line kept`).toContain(T.weather.feelsLike[lang]);
      expect(a.reg.get('#statsRow').innerHTML, `${lang} stats kept`).not.toBe('');
      expect(a.reg.get('#headline').textContent, `${lang} still loading`).toBe(T.misc.loading[lang]);
    }
  });

  it('REAL renderers: the same holds after a CACHED forecast', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setCacheEntry('Cape Town', fullPayload());
    a.setFetchOutcome('Cape Town', { ok: false });
    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    expect(a.weeklyText()).toContain('Wet conditions');

    // Refresh of the same place, pending.
    a.renderLoading('Cape Town', null);
    a.applyLanguageSelection('af');
    await settle();
    expect(a.weeklyText(), 'cached forecast kept and translated').toContain(T.heroLabels.rain.af);

    // Now a REAL move to a different place while pending.
    a.setFetchOutcome('Johannesburg', { pending: true });
    a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });
    await settle();
    expect(a.getDisplayState().place.name).toBe('Johannesburg');
    expect(a.weeklyText(), 'cached forecast must not follow the move').not.toContain(T.heroLabels.rain.af);
    expect(a.weeklyText()).toContain(T.misc.couldntFetch.af);
  });

  it('REAL renderers: the cleared surfaces follow the language on a switch', async () => {
    for (const lang of NON_EN) {
      const a = buildLiveApp({ withPayload: false });
      a.setFetchOutcome('Cape Town', { ok: true, payload: { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }], hourly: [], nowTemp: 15 } });
      a.setFetchOutcome('Johannesburg', { ok: false });
      await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
      await a.loadAndRender({ name: 'Johannesburg', lat: -26.2, lon: 28.0 });

      a.applyLanguageSelection(lang);
      await settle();

      expect(a.weeklyText(), `${lang} weekly`).toContain(T.misc.couldntFetch[lang]);
      expect(a.hourlyText(), `${lang} hourly`).toContain(T.misc.couldntFetch[lang]);
      expect(a.reg.get('#statsRow').innerHTML, `${lang} stats stayed`).toBe('');
      expect(a.reg.get('#temp').textContent).toBe('--°');
      // No English survives on any of them.
      expect(a.weeklyText()).not.toContain('Wet conditions');
      expect(a.weeklyText()).not.toContain(T.misc.couldntFetch.en);
    }
  });

  it('REAL renderers: cached success → network failure → switch', async () => {
    const a = buildLiveApp({ withPayload: false });
    a.setCacheEntry('Cape Town', { daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9, rainChance: 60 }], hourly: [] });
    a.setFetchOutcome('Cape Town', { ok: false });   // cache hits, network fails

    await a.loadAndRender({ name: 'Cape Town', lat: -33.9, lon: 18.4 });
    // Cached data was shown, so the app deliberately KEEPS it rather than
    // erroring — and the state must say payload, not loading.
    expect(a.getDisplayState().kind, 'a cached render must record a payload state').toBe('payload');
    expect(a.weeklyText()).toContain('Wet conditions');

    a.applyLanguageSelection('af');
    await settle();

    expect(a.getDisplayState().kind).toBe('payload');
    expect(a.weeklyText(), 'the cached week must re-render in Afrikaans').toContain(T.heroLabels.rain.af);
    expect(a.weeklyText()).not.toContain('Wet conditions');
    // NOT the loading state — that is what the missing assignment produced.
    expect(a.reg.get('#headline').textContent).not.toBe(T.misc.loading.af);
  });

  it('a successful load after a failure goes back to showing the payload', async () => {
    const a = buildLiveApp();
    a.renderError(null, 'couldntFetch');
    expect(a.getDisplayState().kind).toBe('error');
    a.setDisplayState({ kind: 'payload', place: { name: 'Johannesburg' }, payload: { daily: [{ conditionKey: 'clear', conditionLabel: 'Sunny', highC: 28, lowC: 14 }], hourly: [] } });
    a.applyLanguageSelection('af');
    await settle();
    expect(a.getDisplayState().kind).toBe('payload');
  });

  it('there is exactly ONE display-state record — no rival payload variable', () => {
    const src = app();
    expect(src).toMatch(/let displayState = null/);
    // lastPayload was the rival that outranked the error state; it is gone.
    expect(src).not.toMatch(/\blastPayload\s*=/);
    expect(src).not.toMatch(/let .*\blastPayload\b.*=/);
  });

  it('rejects an unsupported language instead of half-switching', async () => {
    const a = buildLiveApp();
    a.applyLanguageSelection('fr');
    await settle();
    expect(a.settings.lang).toBe('en');
    expect(a.copyLoads).not.toContain('fr');
  });

  it('walks every language through the real entry point', async () => {
    const a = buildLiveApp();
    const norm = { utcOffsetSeconds: 7200, daily: [{ conditionKey: 'rain', conditionLabel: 'Slight rain showers', highC: 18, lowC: 9 }], hourly: [] };
    a.renderDayDetail(norm, 0);
    const headerMeta = a.reg.get('#dayDetailMeta');
    for (const lang of ['af', 'zu', 'xh', 'st', 'en']) {
      a.applyLanguageSelection(lang);
      await settle();
      expect(headerMeta.textContent, `${lang} via applyLanguageSelection`).toContain(T.heroLabels.rain[lang]);
      expect(a.installBanner.getAttribute('aria-label'), `${lang} install region`).toBe(INSTALL_T.bannerTitle[lang]);
    }
  });
});

// ---------------------------------------------------------------------------
// The install banner (assets/install.js owns its own INSTALL_T catalogue)
// ---------------------------------------------------------------------------

describe('language leaks — install banner accessible names', () => {
  const installSrc = () => readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');

  it('applyTranslations names the region with the banner heading and the modal close button', () => {
    const src = installSrc();
    // The region's accessible name IS the visible heading — already translated
    // and already reviewed in all five, so no second sentence to write.
    expect(src).toMatch(/banner\.setAttribute\('aria-label',\s*tInstall\('bannerTitle',\s*lang\)\)/);
    expect(src).toMatch(/iosModalClose\.setAttribute\('aria-label',\s*tInstall\('close',\s*lang\)\)/);
    // applyTranslations IS the language-switch hook (refreshLanguage), so both
    // are re-applied when the user changes language.
    expect(src).toMatch(/refreshLanguage:\s*applyTranslations/);
  });

  it('no English residue in the install banner region name, in any language', async () => {
    const { INSTALL_T } = await import('../assets/install.js');
    // bannerRegion is GONE — the previous round left st announcing
    // "Install Probably Weather" and a test that pinned the residue.
    expect(INSTALL_T.bannerRegion).toBeUndefined();
    for (const lang of LANGS) {
      const name = INSTALL_T.bannerTitle[lang];
      expect(name, `bannerTitle.${lang}`).toBeTruthy();
      if (lang !== 'en') {
        expect(name, `${lang} region name is the English one`).not.toBe(INSTALL_T.bannerTitle.en);
      }
    }
    expect(INSTALL_T.bannerTitle.st).toBe('Eketsa Probably Weather skrineng sa hao sa lehae');
    expect(installSrc()).not.toMatch(/st: 'Install Probably Weather'/);
  });

  it('the close button carries all five languages', async () => {
    const { INSTALL_T } = await import('../assets/install.js');
    for (const lang of LANGS) expect(INSTALL_T.close?.[lang], `close.${lang}`).toBeTruthy();
    expect(INSTALL_T.close.af).toBe('Maak toe');
    expect(INSTALL_T.close.st).toBe('Koala');
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — the source-agreement line under the hero
// ---------------------------------------------------------------------------

describe('language leaks — source agreement line (behavioural)', () => {
  function runAgreeLine(lang, norm) {
    const agreeLineEl = fakeEl();
    const t = (category, key) => T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
    const render = loadFn('renderAgreeLine', 'norm', { agreeLineEl, t });
    render(norm);
    return agreeLineEl;
  }

  it('renders the agreement count in the selected language, not English', () => {
    const norm = { conditionConfidence: { sourceAgreement: '4/5' }, confidence: 'high' };
    for (const lang of NON_EN) {
      const el = runAgreeLine(lang, norm);
      expect(el.textContent, `${lang} agree line`).toBe(
        T.misc.sourcesAgree[lang].replace('{n}', '4').replace('{total}', '5'),
      );
      expect(el.textContent, `${lang} leaked English`).not.toMatch(/sources agree/);
      expect(el.textContent).toContain('4');
      expect(el.textContent).toContain('5');
      expect(el.hidden).toBe(false);
    }
  });

  it('English still reads as English and the counts still substitute', () => {
    const el = runAgreeLine('en', { conditionConfidence: { sourceAgreement: '3/5' } });
    expect(el.textContent).toBe('3/5 sources agree');
  });

  it('every language keeps the {n}/{total} template tokens', () => {
    for (const lang of LANGS) {
      const tpl = T.misc.sourcesAgree[lang];
      expect(tpl, `${lang} lost {n}`).toContain('{n}');
      expect(tpl, `${lang} lost {total}`).toContain('{total}');
    }
  });
});

// ---------------------------------------------------------------------------
// STRUCTURAL — catalogue coverage and the wiring behaviour cannot reach
// ---------------------------------------------------------------------------

function entry(section, key) {
  const sec = findEntry(catalogueSrc(), section);
  expect(sec, `T.${section} missing`).toBeTruthy();
  const e = findEntry(sec, key);
  expect(e, `T.${section}.${key} missing`).toBeTruthy();
  return e;
}

function value(entrySrc, lang) {
  const m = new RegExp(`\\b${lang}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(entrySrc);
  return m ? m[1] : null;
}

const REQUIRED_KEYS = [
  ['settings', 'time24'], ['settings', 'time12'], ['settings', 'feedbackPrompt'],
  ['settings', 'privacyPolicy'], ['settings', 'timeFormat'], ['settings', 'language'],
  ['misc', 'useMyLocation'], ['misc', 'myLocation'], ['misc', 'share'], ['misc', 'dismiss'],
  ['misc', 'settingsSubtitle'],
  ['toasts', 'locationApprox'], ['toasts', 'locationTimeoutApprox'],
  ['nav', 'home'], ['nav', 'week'], ['nav', 'search'], ['nav', 'settings'],
  ['nav', 'hourly'], ['nav', 'primary'],
  ['search', 'placeholder'], ['search', 'removeRecent'], ['search', 'removeFavourite'],
  ['conditions', 'snow'], ['conditions', 'sleet'], ['conditions', 'freezingRain'],
  ['conditions', 'unknown'],
];

describe('language leaks — catalogue coverage', () => {
  it.each(REQUIRED_KEYS)('T.%s.%s has all five languages, non-empty', (section, key) => {
    const e = entry(section, key);
    for (const lang of LANGS) {
      const v = value(e, lang);
      expect(v, `T.${section}.${key}.${lang} missing`).toBeTruthy();
      expect(v.trim(), `T.${section}.${key}.${lang} empty`).not.toBe('');
    }
  });

  it('no key this fix touches is left as an English placeholder', () => {
    const fresh = [
      ['settings', 'time24'], ['settings', 'time12'],
      ['settings', 'feedbackPrompt'], ['settings', 'privacyPolicy'],
      ['misc', 'useMyLocation'], ['misc', 'dismiss'], ['misc', 'settingsSubtitle'],
      ['toasts', 'locationApprox'], ['toasts', 'locationTimeoutApprox'],
      ['nav', 'primary'], ['search', 'removeRecent'], ['search', 'removeFavourite'],
      ['conditions', 'snow'], ['conditions', 'sleet'], ['conditions', 'freezingRain'],
      ['conditions', 'unknown'],
    ];
    for (const [section, key] of fresh) {
      const e = entry(section, key);
      const en = value(e, 'en');
      for (const lang of NON_EN) {
        expect(value(e, lang), `T.${section}.${key}.${lang} is an English copy`).not.toBe(en);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// BEHAVIOURAL — Home's hero copy when the language chunk never arrived
// ---------------------------------------------------------------------------

describe('language leaks — Home hero with an UNTOUCHED seed (behavioural)', () => {
  // A fresh seed catalogue: exactly what a failed chunk leaves behind — all
  // fifteen condition labels in five languages, but a single English
  // headline/witty pair for clear skies.
  function seedCatalogue() {
    const seedSrc = readFileSync(new URL('../assets/copy-loader.js', import.meta.url), 'utf8');
    const seed = new Function(`${seedSrc.replace(/export /g, '')}; return COPY_BANK;`)();
    return { seed, seedT: new Function('COPY_BANK', `return ${catalogueSrc()};`)(seed) };
  }

  function runHome(lang, condition, bankLoaded) {
    const { seedT } = seedCatalogue();
    const settings = { lang, temp: 'C', wind: 'kmh', precip: 'mm', time: '24' };
    const t = (c, k) => seedT[c]?.[k]?.[lang] || seedT[c]?.[k]?.en || k;
    // The real getHeroLabel, over the SEED catalogue — the same chain
    // loadConditionLabels lifts (COPY_FALLBACK → getHeadline → getHeroLabel).
    const { getHeroLabel } = loadConditionLabels(lang, seedT);

    const headlineEl = fakeEl();
    const descriptionEl = fakeEl();
    const env = {
      T: seedT, t, settings, getHeroLabel,
      // What the seed WOULD have produced — the English clear-sky pair.
      getWittyLine: () => 'Absolutely beautiful out there.',
      getHeadline: () => 'Clear skies.',
      isCopyBankLoaded: () => bankLoaded,
      safeText: (el, txt) => { if (el) el.textContent = txt ?? '--'; },
      headlineEl, descriptionEl,
      computeHomeDisplayCondition: () => condition,
      resolveNightAwareCopyCondition: ({ displayCondition }) => displayCondition,
      computeTodaysHero: () => ({}),
      // Shaped stubs — the generic proxy stub returns undefined, which a
      // destructuring call site cannot take.
      getHeroRange: () => ({ low: 9, high: 18 }),
      getTempColorClass: () => '',
      conditionIcon: () => '<svg/>',
      weatherIconSvg: () => '<svg/>',
      isNum: (v) => typeof v === 'number' && Number.isFinite(v),
      formatTemp: (c) => `${Math.round(c)}°`,
      round0: Math.round,
      debugLog: () => {},
      document: {
        querySelector: () => fakeEl(), querySelectorAll: () => [],
        getElementById: () => fakeEl(), createElement: () => fakeEl(),
        body: fakeEl(), documentElement: fakeEl(),
      },
      window: { __PW_LAST_NORM: null, matchMedia: () => ({ matches: false }) },
      $: () => fakeEl(),
    };
    const renderHome = loadWithEnv('renderHome', sliceFunction('renderHome'), env);
    renderHome({ nowTemp: 12, rainPct: 90, windKph: 40, uv: 1 });
    return { headlineEl, descriptionEl };
  }

  it('says the localized condition and NO witty line when the bank is missing', () => {
    for (const lang of NON_EN) {
      const { headlineEl, descriptionEl } = runHome(lang, 'storm', false);
      // The condition, in the user's language — from the seed's heroLabels.
      expect(descriptionEl.textContent, `${lang} hero description`).toBe(T.heroLabels.storm[lang]);
      // No English humour, and nothing about a beautiful clear day over a storm.
      expect(headlineEl.textContent, `${lang} witty line not suppressed`).toBe('');
      expect(descriptionEl.textContent).not.toBe('Clear skies.');
      expect(descriptionEl.textContent).not.toMatch(/Absolutely beautiful/);
    }
  });

  it.each(['storm', 'rain', 'fog', 'heat', 'clear'])('degrades correctly for %s in every language', (condition) => {
    for (const lang of LANGS) {
      const { headlineEl, descriptionEl } = runHome(lang, condition, false);
      expect(descriptionEl.textContent, `${lang}/${condition}`).toBe(T.heroLabels[condition][lang]);
      expect(headlineEl.textContent).toBe('');
    }
  });

  it('keeps the witty line when the bank IS loaded', () => {
    const { headlineEl, descriptionEl } = runHome('af', 'storm', true);
    expect(headlineEl.textContent).toBe('Absolutely beautiful out there.');
    expect(descriptionEl.textContent).toBe('Clear skies.');
  });

  // Astra round 6: the test above supplies its own isCopyBankLoaded, so forcing
  // the REAL loader to report every bank loaded changed nothing. This builds a
  // FRESH copy-loader module instance whose af chunk import rejects, and uses
  // that module's own isCopyBankLoaded — no substitute anywhere in the path.
  async function freshLoaderWithFailingAf() {
    const loaderSrc = readFileSync(new URL('../assets/copy-loader.js', import.meta.url), 'utf8');
    // Same module source, with the dynamic imports replaced by injected
    // loaders: en resolves with the real bank, af rejects like a 404 would.
    const { WEATHER_COPY: enBank } = await import('../assets/copy/en.js');
    const body = loaderSrc
      .replace(/export /g, '')
      .replace(/const COPY_LOADERS = \{[\s\S]*?\n\};/, 'const COPY_LOADERS = __loaders;');
    return new Function('__loaders', `${body}; return { COPY_BANK, loadCopyBank, isCopyBankLoaded };`)({
      en: () => Promise.resolve({ WEATHER_COPY: enBank }),
      af: () => Promise.reject(new Error('chunk 404')),
      zu: () => Promise.reject(new Error('chunk 404')),
      xh: () => Promise.reject(new Error('chunk 404')),
      st: () => Promise.reject(new Error('chunk 404')),
    });
  }

  it('the REAL loader reports a failed af chunk as not loaded, and Home degrades', async () => {
    const loader = await freshLoaderWithFailingAf();
    await loader.loadCopyBank('en');
    await loader.loadCopyBank('af').catch(() => {});

    // The real isCopyBankLoaded — not a stub.
    expect(loader.isCopyBankLoaded('en')).toBe(true);
    expect(loader.isCopyBankLoaded('af'), 'a failed chunk must not count as loaded').toBe(false);

    // Render Home in af through the REAL render function, with the REAL
    // isCopyBankLoaded and the catalogue built over that module's COPY_BANK.
    const liveT = new Function('COPY_BANK', `return ${catalogueSrc()};`)(loader.COPY_BANK);
    const settings = { lang: 'af', temp: 'C', wind: 'kmh', precip: 'mm', time: '24' };
    const t = (c, k) => liveT[c]?.[k]?.[settings.lang] || liveT[c]?.[k]?.en || k;
    const { getHeroLabel } = loadConditionLabels('af', liveT);
    const headlineEl = fakeEl();
    const descriptionEl = fakeEl();
    const renderHome = loadWithEnv('renderHome', sliceFunction('renderHome'), {
      T: liveT, t, settings, getHeroLabel,
      isCopyBankLoaded: loader.isCopyBankLoaded,
      getWittyLine: () => 'Absolutely beautiful out there.',
      getHeadline: () => 'Clear skies.',
      safeText: (el, txt) => { if (el) el.textContent = txt ?? '--'; },
      headlineEl, descriptionEl,
      computeHomeDisplayCondition: () => 'storm',
      resolveNightAwareCopyCondition: ({ displayCondition }) => displayCondition,
      computeTodaysHero: () => ({}), getHeroRange: () => ({ low: 9, high: 18 }),
      getTempColorClass: () => '', conditionIcon: () => '<svg/>', weatherIconSvg: () => '<svg/>',
      isNum: (v) => typeof v === 'number' && Number.isFinite(v),
      formatTemp: (c) => `${Math.round(c)}°`, round0: Math.round,
      displayPlaceName: (n) => n, debugLog: () => {},
      document: {
        querySelector: () => fakeEl(), querySelectorAll: () => [],
        getElementById: () => fakeEl(), createElement: () => fakeEl(),
        body: fakeEl(), documentElement: fakeEl(),
      },
      window: { __PW_LAST_NORM: null, matchMedia: () => ({ matches: false }) },
      $: () => fakeEl(),
    });
    renderHome({ nowTemp: 12, rainPct: 90, windKph: 40, uv: 1 });

    // Afrikaans condition from the seed, and no English humour.
    expect(descriptionEl.textContent).toBe('Erge weer');
    expect(headlineEl.textContent).toBe('');
    expect(descriptionEl.textContent).not.toBe('Clear skies.');
  });

  it('the REAL loader reports a SUCCESSFUL chunk as loaded', async () => {
    const loader = await freshLoaderWithFailingAf();
    await loader.loadCopyBank('en');
    expect(loader.isCopyBankLoaded('en')).toBe(true);
    // An unknown language falls back to en, which IS loaded.
    expect(loader.isCopyBankLoaded('fr')).toBe(true);
  });
});

describe('language leaks — chunk-failure fallback', () => {
  // The lazy per-language copy chunk can fail (offline first visit). Before the
  // fix the seed carried heroLabels.clear.en ONLY, so a failed chunk meant
  // "Pleasant" for a clear day in Sesotho and the provider's raw English for
  // every other condition — the leak at its worst moment.
  it('the always-loaded seed names every condition in all five languages', () => {
    const seedSrc = readFileSync(new URL('../assets/copy-loader.js', import.meta.url), 'utf8');
    const seed = new Function(`${seedSrc.replace(/export /g, '')}; return COPY_BANK;`)();
    const keys = Object.keys(seed.heroLabels);
    expect(keys.length).toBeGreaterThanOrEqual(15);
    for (const key of keys) {
      for (const lang of LANGS) {
        expect(seed.heroLabels[key]?.[lang], `seed heroLabels.${key}.${lang}`).toBeTruthy();
      }
    }
  });

  it('the seed matches weather-copy.js exactly, so the two cannot drift', async () => {
    const seedSrc = readFileSync(new URL('../assets/copy-loader.js', import.meta.url), 'utf8');
    const seed = new Function(`${seedSrc.replace(/export /g, '')}; return COPY_BANK;`)();
    const { WEATHER_COPY } = await import('../assets/weather-copy.js');
    expect(seed.heroLabels).toEqual(WEATHER_COPY.heroLabels);
  });
});

describe('language leaks — settings prose and markup wiring', () => {
  it('the native time-format options are translated', () => {
    const src = updateUILanguageSrc();
    expect(src).toMatch(/option\[value="24"\]/);
    expect(src).toMatch(/option\[value="12"\]/);
    expect(src).toMatch(/t\('settings',\s*'time24'\)/);
    expect(src).toMatch(/t\('settings',\s*'time12'\)/);
  });

  it('index.html gives the settings nodes addressable ids', () => {
    expect(html()).toMatch(/<p id="feedbackPrompt"/);
    expect(html()).toMatch(/<a id="privacyLink"/);
  });

  it('the dynamically built remove buttons take their name from the catalogue', () => {
    const src = app();
    expect(src).toMatch(/class="remove-recent" aria-label="\$\{escapeHtml\(t\('search',\s*'removeRecent'\)\)\}"/);
    expect(src).toMatch(/class="remove-fav" aria-label="\$\{escapeHtml\(t\('search',\s*'removeFavourite'\)\)\}"/);
    // They are rebuilt on a language change, so they never keep a stale name.
    expect(src).toMatch(/renderFavorites\(\);\s*renderRecents\(\);/);
  });

  it('the version-banner dismiss button takes its name from the catalogue', () => {
    expect(app()).toMatch(/dismiss\.setAttribute\('aria-label',\s*t\('misc',\s*'dismiss'\)\)/);
  });

  it('no English aria-label literal is left in assets/app.js', () => {
    const src = app();
    // Every remaining aria-label write must read the catalogue or compose from
    // it — a bare quoted English string is the bug this item exists to remove.
    const bad = [...src.matchAll(/setAttribute\('aria-label',\s*'([^']+)'\)/g)].map((m) => m[1]);
    expect(bad).toEqual([]);
  });
});
