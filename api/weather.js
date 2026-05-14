// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (ECMWF, no key), WeatherAPI (proprietary, key),
//          Pirate Weather (NOAA GFS/GEFS, key), MET Norway (no key, User-Agent)
// Base weights: 35% OM | 25% WA | 15% PW | 25% MET — dynamically adjusted at runtime
// MET Norway uses high-resolution NWP with good coastal coverage — important for SA wind.
// Pirate Weather (GFS/GEFS) is a genuinely independent model cross-check.
// NOTE: Pirate Weather is excluded from hourly aggregation — its hourly.data starts
// at the current hour (not midnight), making alignment with other sources impossible.

const DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

export default async function handler(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const isPlaceholder =
      !rawName ||
      /^unknown\b/i.test(rawName) ||
      /^unknown location\b/i.test(rawName);
    const name = rawName || null;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: 'Invalid lat/lon' });
    }

    const WEATHERAPI_KEY     = process.env.WEATHERAPI_KEY     || null;
    const PIRATE_WEATHER_KEY = process.env.PIRATE_WEATHER_KEY || null;
    const NOMINATIM_UA       = process.env.MET_USER_AGENT     || 'ProbablyWeather/1.0 (contact: howzit@probablyweather.co.za)';
    // Geocoding moved off public Nominatim → LocationIQ (Nominatim-API-compatible).
    // Token lives server-side only; never exposed to the browser.
    const LOCATIONIQ_TOKEN   = process.env.LOCATIONIQ_TOKEN   || null;

    const timeoutMs = 9000;

    async function fetchJson(url, options = {}) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } finally {
        clearTimeout(t);
      }
    }

    // isBadLabel — reject empty labels, "Ward 4"-style admin labels, and bare numbers.
    // Shared by the ?reverse=1 endpoint and the name-resolution block below.
    const isBadLabel = (s) => {
      const v = String(s || '').trim();
      return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
    };

    // Reverse geocode endpoint — LocationIQ (Nominatim-compatible), zoom=16 for small-town accuracy
    if (req.query.reverse) {
      if (!LOCATIONIQ_TOKEN) {
        return res.status(200).json({ ok: false, city: null, admin1: null, countryCode: null, nearCity: null });
      }
      try {
        // zoom=16 catches hamlets/suburbs
        const rev = await fetchJson(
          `https://us1.locationiq.com/v1/reverse?key=${encodeURIComponent(LOCATIONIQ_TOKEN)}&lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1&normalizecity=1&accept-language=en`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        const pick = (...vals) => vals.find(v => !isBadLabel(v)) || null;
        // Priority: village/town/suburb BEFORE city — so "Wilderness" beats "George".
        // municipality stays LAST so it never wins over a real town name (Malmesbury→Swartland bug).
        const place = pick(addr.village, addr.town, addr.suburb, addr.city, addr.neighbourhood, addr.municipality);
        const city = pick(addr.city, addr.town, addr.municipality);
        const admin1 = pick(addr.state, addr.province, addr.region, addr.county);
        const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : null;
        return res.status(200).json({ ok: true, city: place, admin1, countryCode, nearCity: place !== city ? city : null });
      } catch {
        return res.status(200).json({ ok: false, city: null, admin1: null, countryCode: null, nearCity: null });
      }
    }

    // Resolve location name — cascading strategy for small-town accuracy
    // Priority: village/town/suburb BEFORE city so Wilderness beats George
    let resolvedName = isPlaceholder ? null : name;
    if (!resolvedName && LOCATIONIQ_TOKEN) {
      try {
        const rev = await fetchJson(
          `https://us1.locationiq.com/v1/reverse?key=${encodeURIComponent(LOCATIONIQ_TOKEN)}&lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1&normalizecity=1&accept-language=en`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        const pick = (...vals) => vals.find(v => !isBadLabel(v));
        // Small place first: village/town, then suburb, then city
        const smallPlace = pick(addr.village, addr.town);
        const suburb     = pick(addr.suburb, addr.neighbourhood);
        const city       = pick(addr.city, addr.municipality);
        const province   = pick(addr.state, addr.province, addr.region);
        const country    = addr.country;

        const parts = [];
        if (smallPlace) {
          parts.push(smallPlace);
          // Add province for context: "Wilderness, Western Cape"
          if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (suburb) {
          parts.push(suburb);
          if (city) parts.push(city);
          else if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (city) {
          parts.push(city);
          if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (province) {
          parts.push(province);
          if (country) parts.push(country);
        } else if (country) {
          parts.push(country);
        }
        if (parts.length) resolvedName = parts.join(', ');
      } catch { /* Keep fallback name if reverse geocode fails */ }
    }

    // Source arrays: index 0=Open-Meteo, 1=WeatherAPI, 2=Pirate Weather, 3=MET Norway
    // null in a slot means that source failed or was not configured.
    // NOTE: hourlies has 3 slots (0=Open-Meteo, 1=WeatherAPI, 2=MET Norway).
    //       Pirate Weather excluded from hourly — its data starts at current hour not midnight.
    // V2-2: Base weights — PW raised from 10%→15%, OM reduced from 40%→35%.
    // V2 research found Pirate Weather (GFS/GEFS) has lowest mean absolute error
    // (1.75°C) across 10 SA locations — it deserves more influence.
    // Weights may be dynamically adjusted below based on source agreement.
    let SOURCE_WEIGHTS        = [0.35, 0.25, 0.15, 0.25];
    let HOURLY_SOURCE_WEIGHTS = [0.47, 0.33, 0.20];  // 35/25/25 renormalised without Pirate Weather
    const failures = [];
    const norms    = [null, null, null, null]; // current conditions
    const hourlies = [null, null, null];       // hourly: Open-Meteo, WeatherAPI, MET Norway
    const dailies  = [null, null, null, null]; // 7-day daily arrays

    // UTC offset for the requested location (seconds).
    // Phase B-2 Item 1: fall-through chain instead of OM-only SPOF.
    //   1. Open-Meteo `utc_offset_seconds` (existing primary; timezone=auto)
    //   2. Pirate Weather `offset` (hours → multiply by 3600)
    //   3. WeatherAPI `location.tz_id` → resolve via Intl.DateTimeFormat (DST-aware)
    //   4. Default 0 (UTC) — last resort; logged so it's not silent
    // Without this chain, an Open-Meteo outage broke MET hourly alignment +
    // isDay for non-UTC users (e.g. SA shifted by 2 hours, breaking local-hour
    // mapping). utcOffsetSource is surfaced in response meta for audit.
    let utcOffsetSeconds = 0;
    let utcOffsetSource = 'default-utc';

    // Description maps
    const openMeteoCodeMap = {
      0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Fog', 48:'Depositing rime fog',
      51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
      56:'Light freezing drizzle', 57:'Dense freezing drizzle',
      61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
      66:'Light freezing rain', 67:'Heavy freezing rain',
      71:'Slight snow fall', 73:'Moderate snow fall', 75:'Heavy snow fall',
      77:'Snow grains',
      80:'Slight rain showers', 81:'Moderate rain showers', 82:'Violent rain showers',
      85:'Slight snow showers', 86:'Heavy snow showers',
      95:'Thunderstorm', 96:'Thunderstorm with slight hail', 99:'Thunderstorm with heavy hail',
    };

    const pirateIconMap = {
      'clear-day':'Clear sky', 'clear-night':'Clear sky',
      'rain':'Rain', 'snow':'Snow', 'sleet':'Sleet',
      'wind':'Windy', 'fog':'Fog', 'cloudy':'Cloudy',
      'partly-cloudy-day':'Partly cloudy', 'partly-cloudy-night':'Partly cloudy',
      'hail':'Hail', 'thunderstorm':'Thunderstorm', 'tornado':'Tornado',
      // Phase B-2 Item 3: Pirate Weather expanded icon set (icon=pirate mode).
      // mist/haze map to fog-category strings so categorizeDesc handles them.
      // smoke and mixed map to canonical descriptions that route correctly.
      // 'none' is PW's "no data" marker — null-safe via the ?? fallback.
      'mist': 'Mist',
      'haze': 'Haze',
      'smoke': 'Smoke',
      'mixed': 'Sleet', // PW 'mixed' = rain-snow mix; route to cold category
      'none': null,
      'possible-rain-day': 'Possible rain',
      'possible-rain-night': 'Possible rain',
      'possible-snow-day': 'Possible snow',
      'possible-snow-night': 'Possible snow',
      'possible-sleet-day': 'Possible sleet',
      'possible-sleet-night': 'Possible sleet',
      'possible-thunderstorm-day': 'Possible thunderstorm',
      'possible-thunderstorm-night': 'Possible thunderstorm',
      // Common synonyms PW occasionally returns
      'breezy': 'Windy',
      'drizzle': 'Drizzle',
      'flurries': 'Snow showers',
    };

    const openMeteoRequest = fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,cloud_cover` +
      // Phase B-1 Item 3: hourly weather_code added so per-hour condition can be preserved
      // through aggregation (previously only the daily weather_code was fetched).
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,uv_index,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,sunrise,sunset` +
      `&timezone=auto&forecast_days=7`
    );
    const weatherApiRequest = WEATHERAPI_KEY
      ? fetchJson(
          `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}` +
          `&q=${lat},${lon}&days=7&aqi=no&alerts=no`
        )
      : Promise.resolve(null);
    // Phase B-2 Item 3: enable Pirate Weather expanded icon set via &icon=pirate.
    // Default icon set is small (clear/rain/snow/cloudy/etc.); the expanded set
    // adds mist/haze/smoke/mixed/possible-* variants for better fidelity.
    // The map below handles both the original and expanded names so existing
    // forecasts keep working even if PW changes default behaviour.
    const pirateWeatherRequest = PIRATE_WEATHER_KEY
      ? fetchJson(
          `https://api.pirateweather.net/forecast/${PIRATE_WEATHER_KEY}/${lat},${lon}` +
          `?units=si&icon=pirate`
        )
      : Promise.resolve(null);
    const metNorwayRequest = fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': NOMINATIM_UA }, signal: AbortSignal.timeout(timeoutMs) }
    ).then(async met => {
      if (!met.ok) throw new Error(`HTTP ${met.status}`);
      return await met.json();
    });

    const [
      openMeteoResult,
      weatherApiResult,
      pirateWeatherResult,
      metNorwayResult,
    ] = await Promise.allSettled([
      openMeteoRequest,
      weatherApiRequest,
      pirateWeatherRequest,
      metNorwayRequest,
    ]);

    function getSettledValue(result) {
      if (result.status === 'fulfilled') return result.value;
      throw result.reason ?? new Error('Provider failed');
    }

    // =========================================================================
    // Open-Meteo — ECMWF IFS — weight 50%
    // =========================================================================
    try {
      const om = getSettledValue(openMeteoResult);

      // Capture UTC offset so we can determine the correct local hour later
      if (isNum(om.utc_offset_seconds)) {
        utcOffsetSeconds = om.utc_offset_seconds;
        utcOffsetSource = 'open-meteo';
      }

      norms[0] = {
        source:    'Open-Meteo',
        nowTemp:   om.current?.temperature_2m                    ?? null,
        feelsLike: om.current?.apparent_temperature              ?? null,
        todayHigh: om.daily?.temperature_2m_max?.[0]            ?? null,
        todayLow:  om.daily?.temperature_2m_min?.[0]            ?? null,
        todayRain: om.daily?.precipitation_probability_max?.[0] ?? null,
        todayUv:   om.daily?.uv_index_max?.[0]                  ?? null,
        desc:      openMeteoCodeMap[om.current?.weather_code]   ?? 'Unknown',
        windKph:   om.current?.wind_speed_10m                    ?? null,
        gustKph:   om.current?.wind_gusts_10m                    ?? null,
        humidity:  om.current?.relative_humidity_2m              ?? null,
        sunrise:   om.daily?.sunrise?.[0]                        ?? null,
        sunset:    om.daily?.sunset?.[0]                         ?? null,
      };

      hourlies[0] = {
        source:     'Open-Meteo',
        temps:      om.hourly?.temperature_2m?.slice(0, 48)            ?? [],
        feelsLikes: om.hourly?.apparent_temperature?.slice(0, 48)      ?? [],
        rains:      om.hourly?.precipitation_probability?.slice(0, 48) ?? [],
        winds:      om.hourly?.wind_speed_10m?.slice(0, 48)            ?? [],
        gusts:      om.hourly?.wind_gusts_10m?.slice(0, 48)            ?? [],
        clouds:     om.hourly?.cloud_cover?.slice(0, 48)               ?? [],
        humidity:   om.hourly?.relative_humidity_2m?.slice(0, 48)      ?? [],
        uvs:        om.hourly?.uv_index?.slice(0, 48)                  ?? [],
        // Phase B-1 Item 3: per-hour description so the hourly aggregator can
        // surface storm/rain/cloud per hour, not just temp/precip numbers.
        descs:      om.hourly?.weather_code?.slice(0, 48).map(c => openMeteoCodeMap[c] ?? null) ?? [],
      };

      dailies[0] = {
        source:   'Open-Meteo',
        highs:    om.daily?.temperature_2m_max                          ?? [],
        lows:     om.daily?.temperature_2m_min                          ?? [],
        rains:    om.daily?.precipitation_probability_max               ?? [],
        uvs:      om.daily?.uv_index_max                                ?? [],
        descs:    om.daily?.weather_code?.map(c => openMeteoCodeMap[c] ?? 'Unknown') ?? [],
        sunrises: om.daily?.sunrise                                     ?? [],
        sunsets:  om.daily?.sunset                                      ?? [],
      };
    } catch {
      failures.push('Open-Meteo');
    }

    // =========================================================================
    // WeatherAPI — proprietary/mixed — weight 35%
    // =========================================================================
    if (WEATHERAPI_KEY) {
      try {
        const wa = getSettledValue(weatherApiResult);

        // Phase B-2 Item 1: timezone fallback — if Open-Meteo didn't provide
        // an offset (failed or returned no field), try WeatherAPI's location.tz_id.
        // Intl.DateTimeFormat resolves the IANA name to a DST-aware offset
        // ("Africa/Johannesburg" → "GMT+02:00" → +7200s) at request-handling time.
        if (utcOffsetSource === 'default-utc' && wa.location?.tz_id) {
          const waOffset = computeTimezoneOffsetFromTzId(wa.location.tz_id);
          if (isNum(waOffset)) {
            utcOffsetSeconds = waOffset;
            utcOffsetSource = 'weatherapi';
            debugLog(`[Timezone fallback] WeatherAPI tz_id="${wa.location.tz_id}" → ${waOffset}s`);
          }
        }

        const d0    = wa.forecast?.forecastday?.[0]?.day   || {};
        const astro = wa.forecast?.forecastday?.[0]?.astro || {};

        // FIX-001: WeatherAPI code 1000 (Sunny) with 0mm precip = "Clear sky" — clamps
        // a known WA quirk where it pairs sunny conditions with phantom rain chances.
        // FIX-partly: code 1003 (Partly cloudy) is preserved as "Partly cloudy" regardless
        // of precip — the frontend has a dedicated partly-cloudy state. Same for any
        // textual partly/mostly-sunny variant the API might return.
        const waCondCode = wa.current?.condition?.code;
        const waDayPrecip = d0.totalprecip_mm ?? 0;
        const waCondText = wa.current?.condition?.text ?? 'Unknown';
        let waDesc = waCondText;
        const isPartlyByText = /partly\s*(cloudy|sunny)|mostly\s*sunny/i.test(waCondText);
        if (waCondCode === 1003 || isPartlyByText) {
          debugLog(`[FIX-partly] WeatherAPI code ${waCondCode} ("${waCondText}") preserved as "Partly cloudy"`);
          waDesc = 'Partly cloudy';
        } else if (waCondCode === 1000 && waDayPrecip === 0) {
          debugLog(`[FIX-001] WeatherAPI code ${waCondCode} ("${waCondText}") with 0mm precip → "Clear sky"`);
          waDesc = 'Clear sky';
        }

        norms[1] = {
          source:    'WeatherAPI',
          nowTemp:   wa.current?.temp_c          ?? null,
          feelsLike: wa.current?.feelslike_c     ?? null,
          todayHigh: d0.maxtemp_c                ?? null,
          todayLow:  d0.mintemp_c                ?? null,
          // V2-4: Clamp rain chance when WA condition code says clear/sunny AND no precip
          // Durban showed 84% rain with code 1000 ("Sunny") — clearly contradictory
          // BUG-1 fix: only clamp when daily precip is also 0mm — rain can start later in the day
          todayRain: ((waCondCode === 1000 || waCondCode === 1003) && waDayPrecip === 0) ? 0 : (d0.daily_chance_of_rain ?? null),
          todayUv:   d0.uv                       ?? null,
          desc:      waDesc,
          windKph:   wa.current?.wind_kph        ?? null,
          humidity:  wa.current?.humidity        ?? null,
          sunrise:   astro.sunrise               ?? null,
          sunset:    astro.sunset                ?? null,
        };

        const waHours = [...(wa.forecast.forecastday[0]?.hour || []), ...(wa.forecast.forecastday[1]?.hour || [])].slice(0, 48);
        hourlies[1] = {
          source:     'WeatherAPI',
          temps:      waHours.map(h => h.temp_c),
          feelsLikes: waHours.map(h => h.feelslike_c),
          // FIX-001: Clamp rain chance to 0 for clear condition codes with no precipitation
          rains:      waHours.map(h => {
            const code = h.condition?.code;
            if ((code === 1000 || code === 1003) && (h.precip_mm ?? 0) === 0) return 0;
            return h.chance_of_rain;
          }),
          winds:      waHours.map(h => h.wind_kph),
          clouds:     waHours.map(h => h.cloud),
          humidity:   waHours.map(h => h.humidity),
          // Phase B-1 Item 3: per-hour condition.text, with the same code-1003/1000
          // clamping applied so a "Sunny" code with 0mm precip doesn't propagate
          // a confusing rain-flavoured desc into the hourly chart.
          descs:      waHours.map(h => {
            const code = h.condition?.code;
            const text = h.condition?.text ?? null;
            if (code === 1003) return 'Partly cloudy';
            if (code === 1000 && (h.precip_mm ?? 0) === 0) return 'Clear sky';
            return text;
          }),
        };

        dailies[1] = {
          source:   'WeatherAPI',
          highs:    wa.forecast.forecastday.map(fd => fd.day.maxtemp_c),
          lows:     wa.forecast.forecastday.map(fd => fd.day.mintemp_c),
          // V2-4: Clamp rain chance when condition code says clear/sunny AND no precip
          // BUG-1 fix: only clamp when daily precip is also 0mm — a day can start sunny then rain
          rains:    wa.forecast.forecastday.map(fd => {
            const code = fd.day.condition?.code;
            if ((code === 1000 || code === 1003) && (fd.day.totalprecip_mm ?? 0) === 0) return 0;
            return fd.day.daily_chance_of_rain;
          }),
          uvs:      wa.forecast.forecastday.map(fd => fd.day.uv),
          // FIX-001: code 1000 (Sunny) with 0mm precip → "Clear sky" (clamp WA quirk).
          // FIX-partly: code 1003 (Partly cloudy) and any partly/mostly-sunny text
          // is preserved as "Partly cloudy" — don't collapse to clear regardless of
          // precip. The frontend has a dedicated partly-cloudy display state.
          descs:    wa.forecast.forecastday.map(fd => {
            const code = fd.day.condition?.code;
            const text = fd.day.condition?.text ?? '';
            const isPartlyByText = /partly\s*(cloudy|sunny)|mostly\s*sunny/i.test(text);
            if (code === 1003 || isPartlyByText) return 'Partly cloudy';
            if (code === 1000 && (fd.day.totalprecip_mm ?? 0) === 0) return 'Clear sky';
            return text;
          }),
          sunrises: wa.forecast.forecastday.map(fd => fd.astro?.sunrise ?? null),
          sunsets:  wa.forecast.forecastday.map(fd => fd.astro?.sunset  ?? null),
        };
      } catch {
        failures.push('WeatherAPI');
      }
    } else {
      failures.push('WeatherAPI');
    }

    // =========================================================================
    // Pirate Weather — NOAA GFS/GEFS — weight 15%
    // Used for current conditions and daily only (not hourly — see note above).
    // GEFS 30-member ensemble gives native rain probability (no mm->% hack).
    // Free tier: 20,000 calls/month. Sign up: https://pirateweather.net
    // =========================================================================
    if (PIRATE_WEATHER_KEY) {
      try {
        // units=si: temps in C, wind in m/s, humidity 0-1 fraction, precip mm
        const pw = getSettledValue(pirateWeatherResult);

        // Phase B-2 Item 1: timezone fallback — if neither Open-Meteo nor
        // WeatherAPI supplied an offset, try Pirate Weather's `offset` field
        // (hours, e.g. 2.0 for SA in winter, -7.0 for LA in PDT).
        if (utcOffsetSource === 'default-utc' && isNum(pw.offset)) {
          utcOffsetSeconds = Math.round(pw.offset * 3600);
          utcOffsetSource = 'pirate-weather';
          debugLog(`[Timezone fallback] Pirate Weather offset=${pw.offset}h → ${utcOffsetSeconds}s`);
        }

        const cur = pw.currently || {};
        const dly = pw.daily?.data || [];

        const toKph = v => isNum(v) ? Math.round(v * 3.6 * 10) / 10 : null; // m/s -> km/h
        const toPct = v => isNum(v) ? Math.round(v * 100) : null;            // 0-1 -> %
        const toIso = v => isNum(v) ? new Date(v * 1000).toISOString() : null; // Unix -> ISO

        const pwDesc = icon => pirateIconMap[icon] ?? icon ?? 'Unknown';

        const curTemp    = isNum(cur.temperature) ? cur.temperature : null;
        const curWindKph = toKph(cur.windSpeed);
        const curHumPct  = toPct(cur.humidity);

        norms[2] = {
          source:    'Pirate Weather',
          nowTemp:   curTemp,
          feelsLike: calcFeelsLike(curTemp, curWindKph, curHumPct),
          todayHigh: isNum(dly[0]?.temperatureHigh) ? dly[0].temperatureHigh : null,
          todayLow:  isNum(dly[0]?.temperatureLow)  ? dly[0].temperatureLow  : null,
          todayRain: toPct(dly[0]?.precipProbability), // native GEFS ensemble
          todayUv:   isNum(dly[0]?.uvIndex)          ? dly[0].uvIndex         : null,
          desc:      pwDesc(cur.icon),
          windKph:   curWindKph,
          gustKph:   toKph(cur.windGust),   // PW provides windGust in m/s (si units)
          humidity:  curHumPct,
          sunrise:   toIso(dly[0]?.sunriseTime),
          sunset:    toIso(dly[0]?.sunsetTime),
        };

        dailies[2] = {
          source:   'Pirate Weather',
          highs:    dly.slice(0, 7).map(d => isNum(d.temperatureHigh) ? d.temperatureHigh : null),
          lows:     dly.slice(0, 7).map(d => isNum(d.temperatureLow)  ? d.temperatureLow  : null),
          rains:    dly.slice(0, 7).map(d => toPct(d.precipProbability)),
          uvs:      dly.slice(0, 7).map(d => isNum(d.uvIndex)         ? d.uvIndex          : null),
          descs:    dly.slice(0, 7).map(d => pwDesc(d.icon)),
          sunrises: dly.slice(0, 7).map(d => toIso(d.sunriseTime)),
          sunsets:  dly.slice(0, 7).map(d => toIso(d.sunsetTime)),
        };
      } catch {
        failures.push('Pirate Weather');
      }
    } else {
      failures.push('Pirate Weather');
    }

    // ---------- MET Norway -- high-resolution NWP, weight 25% ---------------
    // No API key needed. Requires a descriptive User-Agent per api.met.no ToS.
    // Provides hourly wind at 10m (m/s) aligned to midnight local — safe for hourly aggregation.
    // Particularly valuable for coastal SA: higher resolution than global models.
    try {
      const metJson = getSettledValue(metNorwayResult);

      // Phase B-2 Item 3: full MET Norway symbol_code set per official spec at
      // api.met.no/weatherapi/weathericon/. Previously ~20 entries covering
      // basic rain/snow/thunder; now adds the missing shower variants and the
      // sleet/snow-with-thunder permutations so an SA winter storm code lands
      // on a real description string rather than the raw symbol_code falling
      // through to categorizeDesc.
      const metSymbolMap = {
        // Clear / cloudy
        'clearsky': 'Clear sky',
        'fair': 'Fair',
        'partlycloudy': 'Partly cloudy',
        'cloudy': 'Cloudy',
        'fog': 'Fog',
        // Rain (steady)
        'lightrain': 'Light rain',
        'rain': 'Rain',
        'heavyrain': 'Heavy rain',
        // Rain showers
        'lightrainshowers': 'Light rain showers',
        'rainshowers': 'Rain showers',
        'heavyrainshowers': 'Heavy rain showers',
        // Rain + thunder (steady)
        'lightrainandthunder': 'Light rain and thunder',
        'rainandthunder': 'Rain and thunder',
        'heavyrainandthunder': 'Heavy rain and thunder',
        // Rain showers + thunder
        'lightrainshowersandthunder': 'Light rain showers and thunder',
        'rainshowersandthunder': 'Rain showers and thunder',
        'heavyrainshowersandthunder': 'Heavy rain showers and thunder',
        // Sleet (steady)
        'lightsleet': 'Light sleet',
        'sleet': 'Sleet',
        'heavysleet': 'Heavy sleet',
        // Sleet showers
        'lightsleetshowers': 'Light sleet showers',
        'sleetshowers': 'Sleet showers',
        'heavysleetshowers': 'Heavy sleet showers',
        // Sleet + thunder (steady)
        'lightsleetandthunder': 'Light sleet and thunder',
        'sleetandthunder': 'Sleet and thunder',
        'heavysleetandthunder': 'Heavy sleet and thunder',
        // Sleet showers + thunder
        'lightsleetshowersandthunder': 'Light sleet showers and thunder',
        // Note: MET Norway's published spec uses the spelling 'lightssleetshowersandthunder'
        // (double-s after 'light') for one variant — both names alias to the same canonical string.
        'lightssleetshowersandthunder': 'Light sleet showers and thunder',
        'sleetshowersandthunder': 'Sleet showers and thunder',
        'heavysleetshowersandthunder': 'Heavy sleet showers and thunder',
        // Snow (steady)
        'lightsnow': 'Light snow',
        'snow': 'Snow',
        'heavysnow': 'Heavy snow',
        // Snow showers
        'lightsnowshowers': 'Light snow showers',
        'snowshowers': 'Snow showers',
        'heavysnowshowers': 'Heavy snow showers',
        // Snow + thunder (steady)
        'lightsnowandthunder': 'Light snow and thunder',
        'snowandthunder': 'Snow and thunder',
        'heavysnowandthunder': 'Heavy snow and thunder',
        // Snow showers + thunder
        'lightsnowshowersandthunder': 'Light snow showers and thunder',
        'snowshowersandthunder': 'Snow showers and thunder',
        'heavysnowshowersandthunder': 'Heavy snow showers and thunder',
      };

      const series   = metJson.properties?.timeseries || [];
      const nowEntry = series[0] || {};
      const details  = nowEntry.data?.instant?.details || {};
      const alignedMetSeries = alignSeriesToLocalMidnight(series, utcOffsetSeconds, Date.now());

      const metWindKph  = isNum(details.wind_speed) ? Math.round(details.wind_speed * 3.6 * 10) / 10 : null;
      const metHumidity = isNum(details.relative_humidity) ? details.relative_humidity : null;
      const metTemp     = isNum(details.air_temperature) ? details.air_temperature : null;

      // Rain proxy: convert max precipitation in next 24h to rough probability
      const precipAmounts = series.slice(0, 48).map(p =>
        p.data?.next_1_hours?.details?.precipitation_amount ??
        p.data?.next_6_hours?.details?.precipitation_amount ?? 0
      );
      const maxPrecip = Math.max(...precipAmounts, 0);
      const rainProxy = maxPrecip === 0 ? 0 :
                        maxPrecip < 0.5 ? 20 :
                        maxPrecip < 1   ? 40 :
                        maxPrecip < 2   ? 60 :
                        maxPrecip < 5   ? 80 : 95;

      const symbolCode = (nowEntry.data?.next_1_hours?.summary?.symbol_code ?? '').replace(/_(day|night|polartwilight)$/, '');
      const metDesc    = metSymbolMap[symbolCode] ?? symbolCode ?? 'Unknown';

      // Rec 3: Filter MET Norway timeseries to today's local date only (midnight to midnight)
      // The old code used series.slice(0, 48) which leaked tomorrow's peak temps into today's high.
      // Use utcOffsetSeconds to compute the correct local date string (YYYY-MM-DD).
      const nowUtcMs = Date.now();
      const localDateStr = new Date(nowUtcMs + utcOffsetSeconds * 1000).toISOString().slice(0, 10);
      const todaySeries = alignedMetSeries.slice(0, 24).filter(Boolean);
      debugLog(`[MET Norway] Filtered ${series.length} entries → ${todaySeries.length} for local date ${localDateStr}`);

      const todayTemps = todaySeries.map(p => p.data?.instant?.details?.air_temperature).filter(isNum);
      const hasEnoughTodayTemps = todayTemps.length >= 12;

      norms[3] = {
        source:    'MET Norway',
        nowTemp:   metTemp,
        feelsLike: calcFeelsLike(metTemp, metWindKph, metHumidity),
        todayHigh: hasEnoughTodayTemps ? todayTemps.reduce((a, b) => Math.max(a, b), -Infinity) : null,
        todayLow:  hasEnoughTodayTemps ? todayTemps.reduce((a, b) => Math.min(a, b), Infinity)  : null,
        todayRain: rainProxy,
        todayUv:   null, // MET Norway compact doesn't provide UV
        desc:      metDesc,
        windKph:   metWindKph,
        gustKph:   null, // compact endpoint doesn't include gusts
        humidity:  metHumidity,
        sunrise:   null,
        sunset:    null,
      };

      hourlies[2] = {
        source:     'MET Norway',
        temps:      alignedMetSeries.map(p => p?.data?.instant?.details?.air_temperature ?? null),
        feelsLikes: alignedMetSeries.map(p => {
          const t = p?.data?.instant?.details?.air_temperature;
          const w = p?.data?.instant?.details?.wind_speed ? p.data.instant.details.wind_speed * 3.6 : null;
          const h = p?.data?.instant?.details?.relative_humidity;
          return calcFeelsLike(t, w, h);
        }),
        rains:  alignedMetSeries.map(p => {
          const mm = p?.data?.next_1_hours?.details?.precipitation_amount ?? null;
          if (!isNum(mm)) return null;
          return mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80;
        }),
        winds:  alignedMetSeries.map(p => {
          const w = p?.data?.instant?.details?.wind_speed;
          return isNum(w) ? Math.round(w * 3.6 * 10) / 10 : null;
        }),
        gusts:  alignedMetSeries.map(() => null), // not in compact
        clouds: alignedMetSeries.map(p => p?.data?.instant?.details?.cloud_area_fraction ?? null),
        // Phase B-1 Item 3: per-hour symbol_code mapped via metSymbolMap. Strip
        // the _day/_night/_polartwilight suffix so the lookup matches the
        // base-symbol keys. Unknown codes fall through as the raw symbol_code,
        // which categorizeDesc still handles via keyword matching.
        descs:  alignedMetSeries.map(p => {
          const raw = p?.data?.next_1_hours?.summary?.symbol_code ?? null;
          if (!raw) return null;
          const stripped = raw.replace(/_(day|night|polartwilight)$/, '');
          return metSymbolMap[stripped] ?? stripped;
        }),
      };

      dailies[3] = {
        source:   'MET Norway',
        highs:    [norms[3].todayHigh],
        lows:     [norms[3].todayLow],
        rains:    [rainProxy],
        uvs:      [],
        descs:    [metDesc],
        sunrises: [],
        sunsets:  [],
      };
    } catch {
      failures.push('MET Norway');
    }

    // =========================================================================
    // DYNAMIC WEIGHT ADJUSTMENT
    // Research shows Open-Meteo (ECMWF) and WeatherAPI often use the same
    // underlying model, doubling the cold bias during SA heat waves.
    // MET Norway's high-res model is more accurate for local extremes.
    // =========================================================================

    // Rec 1: When Open-Meteo and WeatherAPI daily highs are near-identical
    // (within 0.5°C), they're likely the same ECMWF model — halve WA weight
    if (isNum(norms[0]?.todayHigh) && isNum(norms[1]?.todayHigh)) {
      const ecmwfSpread = Math.abs(norms[0].todayHigh - norms[1].todayHigh);
      if (ecmwfSpread <= 0.5) {
        debugLog(`[Weight adjust] OM=${norms[0].todayHigh}°C WA=${norms[1].todayHigh}°C (spread ${ecmwfSpread}°C ≤ 0.5) — halving WA weight (likely same ECMWF model)`);
        SOURCE_WEIGHTS[1] = SOURCE_WEIGHTS[1] / 2; // 0.25 → 0.125
      }
    }

    // Rec 2 + V2-1: When MET Norway diverges >5°C above ECMWF-family average,
    // boost MET Norway weight — but ONLY for coastal/western SA.
    // V2 research shows MET Norway has a -3.2°C cold bias on the highveld/bushveld
    // (Johannesburg, Polokwane), so boosting it there makes things worse.
    // Gate: skip boost for highveld/bushveld (lat north of -28° AND lon east of 25°)
    const isHighveld = lat > -28 && lon > 25;
    if (isNum(norms[3]?.todayHigh) && !isHighveld) {
      const ecmwfFamily = [norms[0]?.todayHigh, norms[1]?.todayHigh].filter(isNum);
      if (ecmwfFamily.length > 0) {
        const ecmwfAvg = ecmwfFamily.reduce((a, b) => a + b, 0) / ecmwfFamily.length;
        const metDivergence = norms[3].todayHigh - ecmwfAvg;
        if (metDivergence > 5) {
          debugLog(`[Weight adjust] MET Norway ${norms[3].todayHigh}°C is ${metDivergence.toFixed(1)}°C above ECMWF avg ${ecmwfAvg.toFixed(1)}°C — boosting MET Norway 25%→40%, reducing OM 40%→25%`);
          SOURCE_WEIGHTS[0] = 0.25; // Open-Meteo: 40% → 25%
          SOURCE_WEIGHTS[3] = 0.40; // MET Norway: 25% → 40%
        }
      }
    } else if (isHighveld && isNum(norms[3]?.todayHigh)) {
      debugLog(`[Weight adjust] Highveld location (lat=${lat}, lon=${lon}) — MET Norway boost disabled`);
    }

    // Recompute hourly weights from adjusted source weights (excl Pirate Weather)
    const hBase = [SOURCE_WEIGHTS[0], SOURCE_WEIGHTS[1], SOURCE_WEIGHTS[3]];
    const hTotal = hBase.reduce((a, b) => a + b, 0);
    HOURLY_SOURCE_WEIGHTS = hBase.map(w => Math.round(w / hTotal * 100) / 100);

    debugLog(`[Weights] OM=${SOURCE_WEIGHTS[0]} WA=${SOURCE_WEIGHTS[1]} PW=${SOURCE_WEIGHTS[2]} MET=${SOURCE_WEIGHTS[3]} | Hourly=[${HOURLY_SOURCE_WEIGHTS.join(',')}]`);

    // =========================================================================
    // AGGREGATION
    // =========================================================================

    // Normalise weights for whichever sources actually returned data.
    function resolveWeights(arr, baseWeights) {
      const active = arr.map((item, i) => item !== null ? (baseWeights[i] ?? 0) : 0);
      const total  = active.reduce((s, v) => s + v, 0);
      if (total === 0) {
        const count = arr.filter(Boolean).length;
        return arr.map(item => item !== null ? 1 / count : 0);
      }
      return active.map(v => v / total);
    }

    const normW   = resolveWeights(norms, SOURCE_WEIGHTS);
    const hourlyW = resolveWeights(hourlies, HOURLY_SOURCE_WEIGHTS);
    const dailyW  = resolveWeights(dailies, SOURCE_WEIGHTS);

    // V2-3: Separate weights for daily LOW temperature — MET Norway reduced to 10%.
    // Research found MET Norway todayLow runs +3.9°C warm on average across all 10 SA locations.
    // The model doesn't capture nighttime radiative cooling well for SA inland conditions.
    // [0]=OM, [1]=WA, [2]=PW, [3]=MET
    const LOW_WEIGHTS = [SOURCE_WEIGHTS[0], SOURCE_WEIGHTS[1], SOURCE_WEIGHTS[2], 0.10];
    const dailyLowW = resolveWeights(dailies, LOW_WEIGHTS);

    // Weighted average across source slots (skips nulls).
    function wAvg(arr, weights, getter) {
      let sum = 0, wSum = 0;
      arr.forEach((item, i) => {
        if (item === null) return;
        const v = getter(item);
        if (isNum(v)) { sum += v * weights[i]; wSum += weights[i]; }
      });
      return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
    }

    // Phase B-1 Item 3: per-hour description voting uses the same shape as
    // daily but with the hourly-source slice [OM, WA, MET]. WA's 0.1 weight
    // is preserved here for the same reason it's preserved in DESC_WEIGHTS:
    // mitigates WA's documented rain-flag unreliability beyond just
    // fragmentation (which Item 2's category-aware vote already solves).
    const HOURLY_DESC_WEIGHTS = [1, 0.1, 1]; // [OM, WA, MET]

    // Hourly aggregation (Open-Meteo + WeatherAPI + MET Norway — aligned on local midnight)
    const aggregatedHourly = Array.from({ length: 48 }, (_, i) => {
      const hourWindVals = hourlies.map(h => h ? h.winds[i] : null).filter(isNum);
      const hourGustVals = hourlies.map(h => h ? (h.gusts?.[i] ?? null) : null).filter(isNum);
      const avgWind = wAvg(hourlies, hourlyW, h => h.winds[i]);
      const maxWind = Math.max(...hourWindVals, ...hourGustVals, 0) || null;

      // Use weighted average of mean wind speeds across sources.
      // Gusts are tracked separately and shown as "(gusts X km/h)" in the UI.
      const effectiveHourlyWind = avgWind;

      // UV: only Open-Meteo provides hourly UV; use directly if available
      const uvVal = hourlies[0]?.uvs?.[i] ?? null;

      // Rec 5: Modal cloud cover — use most frequent cloud category for condition logic.
      // Cloud cover is bimodal (clear or overcast), so averaging 10% and 90% gives 50%
      // which is meaningless. Modal approach picks the category most sources agree on.
      const cloudVals = hourlies.map(h => h ? h.clouds?.[i] : null).filter(isNum);
      const modalCloud = cloudVals.length > 0 ? pickModalCloud(cloudVals) : null;

      // Phase B-1 Item 3: per-hour categorised condition. Closes the
      // investigation finding that aggregatedHourly drops descriptions, so
      // the hourly chart can never surface thunder/hail/storm per hour. Now
      // each source's hourly desc is weighted-voted via the same category-
      // aware path as the daily/now decisions, then categorised so the
      // frontend can decorate hour cells with storm/rain/cloud icons.
      const hourDescEntries = hourlies
        .map((h, si) => h && h.descs?.[i] ? { desc: h.descs[i], weight: HOURLY_DESC_WEIGHTS[si] } : null)
        .filter(Boolean);
      const hourWinningDesc = hourDescEntries.length ? pickWeightedMostCommon(hourDescEntries) : null;
      const hourCondition = hourWinningDesc ? categorizeDesc(hourWinningDesc) : null;

      return {
        tempC:      wAvg(hourlies, hourlyW, h => h.temps[i]),
        feelsLikeC: wAvg(hourlies, hourlyW, h => h.feelsLikes?.[i]),
        rainChance: wAvg(hourlies, hourlyW, h => h.rains[i]),
        windKph:    effectiveHourlyWind,
        cloudPct:   modalCloud,  // Rec 5: use modal instead of averaged cloud cover
        uv:         isNum(uvVal) ? Math.round(uvVal * 10) / 10 : null,
        // Phase B-1 Item 3: categorised hourly condition + winning desc label
        condition:  hourCondition,
        descLabel:  hourWinningDesc,
      };
    });

    // Rec 6: Description voting weights — reduce WeatherAPI influence
    // WeatherAPI descriptions are unreliable (overcooks rain flags) so give it 10% weight.
    // Source order: [0]=Open-Meteo, [1]=WeatherAPI, [2]=Pirate Weather, [3]=MET Norway
    const DESC_WEIGHTS = [1, 0.1, 1, 1]; // WA gets 10% voting weight for descriptions

    // Daily aggregation (all sources)
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const descEntries  = dailies.map((d, si) => d && d.descs[i] ? { desc: d.descs[i], weight: DESC_WEIGHTS[si] } : null).filter(Boolean);
      const conditionLabel = pickWeightedMostCommon(descEntries) || 'Unknown';
      const highC        = wAvg(dailies, dailyW, d => d.highs[i]);
      const lowC         = wAvg(dailies, dailyLowW, d => d.lows[i]);  // V2-3: MET Norway reduced weight for lows
      const rainChance   = wAvg(dailies, dailyW, d => d.rains[i]);
      const uv           = wAvg(dailies, dailyW, d => d.uvs[i]);
      // Use midday wind estimate (index 12 = noon local time, day 1 = index 36)
      const noonIdx      = i * 24 + 12;
      const windKph      = aggregatedHourly[noonIdx]?.windKph ?? null;

      const dailySourceDescs = dailies.map(dd => dd?.descs?.[i]).filter(Boolean);
      let { key: dailyConditionKey, reason: dailyConditionReason } = deriveCondition({
        desc:      conditionLabel,
        rainChance,
        tempC:     highC,
        windKph,
        uvIndex:   uv,
        cloudPct:  aggregatedHourly[noonIdx]?.cloudPct ?? null,
        isDay:     true,
        // Per-source descriptions for this day, used by the hail/thunder
        // consensus rungs at the top of deriveCondition.
        sourceDescs: dailySourceDescs,
      });
      const dailyOverrides = [];

      // Rec 4: Majority voting for daily conditions — same logic as FIX-001
      // Requires ≥2 sources to agree on rain/cloudy before declaring it
      // BUG-1 fix: trust Open-Meteo or MET Norway rain votes even without majority
      if ((dailyConditionKey === 'rain-possible' || dailyConditionKey === 'cloudy') && descEntries.length >= 3) {
        const dailyVotes = descEntries.map(e => categorizeDesc(e.desc));
        const rainOrCloudyCount = dailyVotes.filter(v => v === 'rain' || v === 'cloudy' || v === 'storm').length;
        // Check if Open-Meteo (index 0) or MET Norway (index 3) votes rain for this day
        const omRain = dailies[0]?.descs?.[i] && categorizeDesc(dailies[0].descs[i]) === 'rain';
        const metRain = dailies[3]?.descs?.[i] && categorizeDesc(dailies[3].descs[i]) === 'rain';
        const trustedDailyRain = omRain || metRain;
        if (rainOrCloudyCount < 2 && !trustedDailyRain) {
          debugLog(`[Rec 4] Day ${i}: ${dailyConditionKey} → clear (only ${rainOrCloudyCount}/${descEntries.length} sources vote rain/cloudy, no trusted rain)`);
          dailyOverrides.push({ rule: 'majority-override-clear', from: dailyConditionKey, to: 'clear', reasonDetail: `${rainOrCloudyCount}/${descEntries.length} sources voted rain/cloudy/storm, no trusted-source rain` });
          dailyConditionKey = 'clear';
          dailyConditionReason = 'majority-override-clear';
        } else if (rainOrCloudyCount < 2 && trustedDailyRain) {
          debugLog(`[BUG-1] Day ${i}: Keeping ${dailyConditionKey} — trusted source (OM=${omRain}, MET=${metRain}) votes rain`);
        }
      }

      // FIX-002: Fog majority check for daily forecasts — same consensus rule
      if (dailyConditionKey === 'fog' && descEntries.length >= 3) {
        const sourceNames = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway'];
        const dailyFogSources = dailies.map((d, si) => d && d.descs[i] && categorizeDesc(d.descs[i]) === 'fog' ? sourceNames[si] : null).filter(Boolean);
        if (dailyFogSources.length < 2) {
          debugLog(`[ProbablyWeather] Fog blocked — single source only: ${dailyFogSources.join(', ')} (day ${i})`);
          dailyOverrides.push({ rule: 'fog-blocked-single-source', from: 'fog', to: 'clear', reasonDetail: `only ${dailyFogSources.length} source(s) voted fog` });
          dailyConditionKey = 'clear';
          dailyConditionReason = 'fog-blocked-single-source';
        }
      }

      // Phase B-2 Item 2: same consensus extension for daily storm/heat/cold.
      // Wind is omitted for daily because per-source daily wind isn't directly
      // available (we compute it from the noon hour aggregate). Predicates use
      // each source's own daily high/low/desc.
      const dailyConsensusPredicates = {
        storm: (d) => d && categorizeDesc(d.descs?.[i]) === 'storm',
        heat:  (d) => d && isNum(d.highs?.[i]) && d.highs[i] >= 30,
        cold:  (d) => d && ((isNum(d.highs?.[i]) && d.highs[i] <= 10) || (isNum(d.lows?.[i]) && d.lows[i] <= 0)),
      };
      if (dailyConsensusPredicates[dailyConditionKey] && descEntries.length >= 3) {
        const dailyOriginalKey = dailyConditionKey;
        const supporting = dailies.filter(dailyConsensusPredicates[dailyOriginalKey]).length;
        if (supporting < 2) {
          debugLog(`[B-2 consensus] Day ${i}: ${dailyOriginalKey} → clear (only ${supporting}/${descEntries.length} sources support ${dailyOriginalKey})`);
          dailyOverrides.push({
            rule: `${dailyOriginalKey}-consensus-failed`,
            from: dailyOriginalKey,
            to: 'clear',
            reasonDetail: `only ${supporting}/${descEntries.length} source(s) individually meet the ${dailyOriginalKey} threshold for this day`,
          });
          dailyConditionKey = 'clear';
          dailyConditionReason = `${dailyOriginalKey}-consensus-failed`;
        }
      }

      return {
        highC,
        lowC,
        rainChance,
        uv,
        conditionLabel,
        conditionKey: dailyConditionKey,
        conditionReason: dailyConditionReason,
        conditionSignals: {
          descWinner: conditionLabel,
          numeric: { rainChance, highC, uvIndex: uv, cloudPct: aggregatedHourly[noonIdx]?.cloudPct ?? null, windKph },
          sourceDescs: dailySourceDescs,
          overrides: dailyOverrides,
        },
        sunrise: dailies.filter(Boolean).find(d => d.sunrises?.[i])?.sunrises[i] ?? null,
        sunset:  dailies.filter(Boolean).find(d => d.sunsets?.[i])?.sunsets[i]   ?? null,
      };
    });

    // =========================================================================
    // CONFIDENCE
    // Based on agreement between Open-Meteo and WeatherAPI — genuinely different
    // model families, so their agreement is meaningful.
    // Pirate Weather (GFS) divergence is an additional uncertainty signal.
    // =========================================================================
    const omNorm  = norms[0];
    const waNorm  = norms[1];
    const pwNorm  = norms[2];
    const metNorm = norms[3];

    let confidenceKey = 'mixed';
    if (isNum(omNorm?.nowTemp) && isNum(waNorm?.nowTemp)) {
      const spread = Math.abs(omNorm.nowTemp - waNorm.nowTemp);
      confidenceKey = spread <= 1.5 ? 'strong' : spread <= 3.5 ? 'decent' : 'mixed';
    } else if (norms.filter(Boolean).length === 1) {
      confidenceKey = 'decent';
    }

    // GFS divergence check: when GFS and ECMWF disagree strongly, honest downgrade
    let pirateWeatherAlert = null;
    if (isNum(omNorm?.nowTemp) && isNum(pwNorm?.nowTemp)) {
      if (Math.abs(omNorm.nowTemp - pwNorm.nowTemp) > 3) {
        pirateWeatherAlert = 'gfs_ecmwf_divergence';
        if (confidenceKey === 'strong') confidenceKey = 'decent';
      }
    }

    // =========================================================================
    // "NOW" CALCULATIONS
    // =========================================================================
    const activeNorms = norms.filter(Boolean);

    // Bug 5 guard: if all sources failed, return a clear error
    if (activeNorms.length === 0) {
      return res.status(503).json({
        ok: false,
        error: 'All weather sources failed. Please try again shortly.',
        meta: { sources: failures.map(f => ({ name: f, ok: false })) },
      });
    }

    const medNowTemp   = wAvg(norms, normW, n => n.nowTemp);
    const medFeelsLike = wAvg(norms, normW, n => n.feelsLike);
    const medWindKph   = wAvg(norms, normW, n => n.windKph);

    // Rec 7: Temperature debug logging — shows each source's contribution to the blend
    const tempDebug = norms.map((n, i) => n ? `${n.source}: now=${n.nowTemp}°C high=${n.todayHigh}°C low=${n.todayLow}°C (weight=${Math.round(normW[i]*100)}%)` : null).filter(Boolean);
    debugLog(`[Temp blend] ${tempDebug.join(' | ')} → blended=${medNowTemp}°C`);
    const highDebug = norms.map((n, i) => n ? `${n.source}=${n.todayHigh}°C` : null).filter(Boolean);
    const blendedHigh = wAvg(norms, normW, n => n.todayHigh);
    const normLowW = resolveWeights(norms, LOW_WEIGHTS);  // V2-3: reduced MET weight for lows
    const blendedLow = wAvg(norms, normLowW, n => n.todayLow);
    debugLog(`[Daily high/low] ${highDebug.join(' | ')} → blended high=${blendedHigh}°C low=${blendedLow}°C`);
    // maxWindKph includes gust data from Open-Meteo.
    // In gusty coastal conditions (Cape Town southeaster etc), gusts are the
    // real story — mean wind can be 18 km/h while gusts hit 45 km/h.
    const gustKphArr   = activeNorms.map(n => n.gustKph).filter(isNum);
    const maxGust      = gustKphArr.length > 0 ? Math.max(...gustKphArr) : null;
    const maxWindKph   = Math.max(
      ...activeNorms.map(n => n.windKph).filter(isNum),
      ...gustKphArr,
      0
    );
    const medHumidity  = wAvg(norms, normW, n => n.humidity);
    const medUv        = wAvg(norms, normW, n => n.todayUv);

    // Display the weighted mean wind speed. Gusts (maxWindKph) are passed through
    // separately for UI display as "(gusts X km/h)" — not inflated into the main number.
    const effectiveDisplayWind = medWindKph ?? 0;

    // Correct local hour using UTC offset from Open-Meteo.
    // Vercel runs UTC so new Date().getHours() would be wrong for non-UTC zones.
    // e.g. South Africa (UTC+2): 21:31 SAST = 19:31 UTC. Without this fix,
    // we'd read cloudPct for 19:00 instead of 21:00.
    const localHour = Math.floor(((Date.now() / 1000) + utcOffsetSeconds) / 3600) % 24;

    const currentCloudPct = aggregatedHourly[localHour]?.cloudPct ?? null;

    // Current hour's rain chance (not today's daily max).
    // Using daily max caused the app to show 70% rain at 10pm when it only
    // rained in the morning. Current hour is more truthful for "right now".
    const currentHourRainChance = aggregatedHourly[localHour]?.rainChance ?? null;

    // Rec 6: Weight descriptions — WA gets 10% influence
    const nowDescEntries = norms.map((n, si) => n && n.desc ? { desc: n.desc, weight: DESC_WEIGHTS[si] } : null).filter(Boolean);
    const mostDesc       = pickWeightedMostCommon(nowDescEntries) || 'Weather today';
    const finalFeelsLike = isNum(medFeelsLike) ? medFeelsLike : calcFeelsLike(medNowTemp, medWindKph, medHumidity);

    // Sunrise/sunset for the response — first available source.
    // Declared before isDay so no ReferenceError.
    const sunrise = activeNorms.find(n => n.sunrise)?.sunrise ?? null;
    const sunset  = activeNorms.find(n => n.sunset)?.sunset   ?? null;

    // isDay — use ONLY Open-Meteo's sunrise/sunset which are ISO strings (parseable).
    // WeatherAPI returns "06:45 AM" with no date — new Date() gives Invalid Date.
    // If Open-Meteo failed, fall back to utcOffsetSeconds + a hardcoded 06:00–19:00
    // window, which is wrong but at least won't cause UV to fire all night.
    const nowMs = Date.now();
    let isDay = true;
    const omSunrise = norms[0]?.sunrise ?? null;
    const omSunset  = norms[0]?.sunset  ?? null;
    if (omSunrise && omSunset) {
      // Open-Meteo returns sunrise/sunset as local-time ISO strings WITHOUT a timezone
      // indicator (e.g. "2026-02-22T06:12"). The Vercel server runs UTC, so JS parses
      // these as UTC — creating a 2-hour error for SAST (UTC+2). We correct by
      // subtracting utcOffsetSeconds to convert the local-labelled timestamps to true UTC ms.
      const srMs = new Date(omSunrise).getTime() - (utcOffsetSeconds * 1000);
      const ssMs = new Date(omSunset).getTime()  - (utcOffsetSeconds * 1000);
      if (!isNaN(srMs) && !isNaN(ssMs)) {
        isDay = nowMs >= srMs && nowMs <= ssMs;
      }
    } else {
      // Open-Meteo unavailable — estimate from local hour (UTC offset known from earlier)
      // Assume daylight 06:00–19:00 local. Better than defaulting to true.
      isDay = localHour >= 6 && localHour < 19;
    }

    // medUv is the daily MAXIMUM (recorded at noon). Using it at 18:55 falsely
    // reports "High UV" near sunset. Only use UV to drive condition between 10:00-16:00.
    const uvForCondition = (localHour >= 10 && localHour < 16) ? medUv : null;

    const nowSourceDescs = activeNorms.map(n => n.desc).filter(Boolean);
    let { key: nowConditionKey, reason: nowConditionReason } = deriveCondition({
      desc:       mostDesc,
      rainChance: currentHourRainChance,
      tempC:      medNowTemp,
      feelsLikeC: finalFeelsLike,
      windKph:    medWindKph,
      uvIndex:    uvForCondition,
      cloudPct:   currentCloudPct,
      maxWindKph,
      isDay,
      dailyHighC: aggregatedDaily?.[0]?.highC ?? null,
      // Per-source raw descriptions feed the hail/thunder consensus rungs.
      sourceDescs: nowSourceDescs,
    });
    const nowOverrides = [];

    // FIX-001: Per-source condition votes for debugging and majority check
    const sourceConditionVotes = activeNorms.map(n => ({
      source: n.source,
      desc: n.desc,
      vote: categorizeDesc(n.desc),
    }));
    debugLog('[Condition voting]', JSON.stringify(sourceConditionVotes));
    debugLog(`[Condition derived] ${nowConditionKey} reason=${nowConditionReason} (desc="${mostDesc}", rain=${currentHourRainChance}%, cloud=${currentCloudPct}%)`);

    // FIX-001: Majority check — single source claiming rain/cloudy must not override clear consensus
    // Requires ≥2 sources to agree on rain/cloudy before the app declares it
    // BUG-1 fix: EXCEPTION — if Open-Meteo or MET Norway (most reliable for SA) votes rain, trust it
    if ((nowConditionKey === 'rain-possible' || nowConditionKey === 'cloudy') && activeNorms.length >= 3) {
      const rainOrCloudyVotes = sourceConditionVotes.filter(v =>
        v.vote === 'rain' || v.vote === 'cloudy' || v.vote === 'storm'
      );
      const trustedRainVote = rainOrCloudyVotes.some(v =>
        (v.source === 'Open-Meteo' || v.source === 'MET Norway') && v.vote === 'rain'
      );
      if (rainOrCloudyVotes.length < 2 && !trustedRainVote) {
        debugLog(`[FIX-001 majority override] ${nowConditionKey} → clear (only ${rainOrCloudyVotes.length}/${activeNorms.length} sources vote rain/cloudy, no trusted rain vote)`);
        nowOverrides.push({ rule: 'majority-override-clear', from: nowConditionKey, to: 'clear', reasonDetail: `${rainOrCloudyVotes.length}/${activeNorms.length} sources voted rain/cloudy/storm, no trusted-source rain` });
        nowConditionKey = 'clear';
        nowConditionReason = 'majority-override-clear';
      } else if (rainOrCloudyVotes.length < 2 && trustedRainVote) {
        debugLog(`[BUG-1] Keeping ${nowConditionKey} — trusted source (OM/MET) votes rain despite minority`);
      }
    }

    // FIX-002: Fog majority check — single source claiming fog must not override clear consensus
    // Requires ≥2 sources to agree on fog before declaring it
    if (nowConditionKey === 'fog' && activeNorms.length >= 3) {
      const fogVotes = sourceConditionVotes.filter(v => v.vote === 'fog');
      if (fogVotes.length < 2) {
        debugLog(`[ProbablyWeather] Fog blocked — single source only: ${fogVotes.map(v => v.source).join(', ')}`);
        nowOverrides.push({ rule: 'fog-blocked-single-source', from: 'fog', to: 'clear', reasonDetail: `only ${fogVotes.length} source(s) voted fog` });
        nowConditionKey = 'clear';
        nowConditionReason = 'fog-blocked-single-source';
      }
    }

    // Phase B-2 Item 2: broader multi-source consensus.
    // Extends the fog-style consensus rule uniformly to storm/wind/heat/cold.
    // For each, if ≥3 sources are active but <2 individually support the
    // condition, demote to clear with an audit-trail entry. Predicates use
    // LOWER thresholds than deriveCondition's trigger so sources slightly
    // below the trigger still count as "supporting" the headline — a 24 km/h
    // wind reading supports a 30 km/h trigger.
    const consensusPredicates = {
      storm: (n) => categorizeDesc(n.desc) === 'storm',
      wind:  (n) => isNum(n.windKph) && n.windKph >= 25,
      heat:  (n) => (isNum(n.nowTemp) && n.nowTemp >= 30) || (isNum(n.feelsLike) && n.feelsLike >= 35),
      cold:  (n) => (isNum(n.nowTemp) && n.nowTemp <= 10) || (isNum(n.feelsLike) && n.feelsLike <= -5),
    };
    if (consensusPredicates[nowConditionKey] && activeNorms.length >= 3) {
      const originalKey = nowConditionKey;
      const supporting = activeNorms.filter(consensusPredicates[originalKey]).length;
      if (supporting < 2) {
        debugLog(`[B-2 consensus] ${originalKey} → clear (only ${supporting}/${activeNorms.length} sources individually support ${originalKey})`);
        nowOverrides.push({
          rule: `${originalKey}-consensus-failed`,
          from: originalKey,
          to: 'clear',
          reasonDetail: `only ${supporting}/${activeNorms.length} source(s) individually meet the ${originalKey} threshold`,
        });
        nowConditionKey = 'clear';
        nowConditionReason = `${originalKey}-consensus-failed`;
      }
    }

    // Phase B-1 Item 1: package the audit trail for the now-path decision.
    // conditionReason is the short identifier of the rule that produced the
    // final key (after any overrides). conditionSignals shows the inputs:
    // who voted what, the numeric thresholds in play, the desc that won
    // the weighted vote, and any post-hoc transformations.
    const nowConditionSignals = {
      descWinner: mostDesc,
      numeric: {
        rainChance: currentHourRainChance,
        tempC: medNowTemp,
        feelsLikeC: finalFeelsLike,
        windKph: medWindKph,
        uvIndex: uvForCondition,
        cloudPct: currentCloudPct,
        dailyHighC: aggregatedDaily?.[0]?.highC ?? null,
        isDay,
      },
      sourceVotes: sourceConditionVotes,
      overrides: nowOverrides,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      location: { name: resolvedName || name || 'Unknown', lat, lon },
      wind_kph:   effectiveDisplayWind,
      maxWindKph: maxWindKph > 0 ? maxWindKph : null,
      gustKph:    isNum(maxGust) && maxGust > effectiveDisplayWind * 1.5 ? maxGust : null,
      now: {
        tempC:            medNowTemp,
        feelsLikeC:       finalFeelsLike,
        windKph:          effectiveDisplayWind,
        humidity:         medHumidity,
        rainChance:       currentHourRainChance,  // current hour rain chance
        uv:               isDay ? medUv : null,  // UV is irrelevant after sunset
        cloudPct:         currentCloudPct,
        conditionKey:     nowConditionKey,
        conditionLabel:   mostDesc,
        // Phase B-1 Item 1: rule identifier (short string) and signals object
        // (per-source votes + numeric inputs + override trail). Debug-grade
        // fields — frontend consumes conditionKey/conditionLabel as before;
        // these make the decision auditable from the API response alone.
        conditionReason:  nowConditionReason,
        conditionSignals: nowConditionSignals,
        isDay,            // lets app.js switch night/day copy and suppress UV stat
        sunrise,
        sunset,
      },
      consensus: {
        confidenceKey,
        pirateWeatherAlert, // null | 'gfs_ecmwf_divergence'
      },
      daily:  aggregatedDaily,
      hourly: aggregatedHourly,
      meta: {
        sources: [
          ...activeNorms.map(n => ({ name: n.source, ok: true })),
          ...failures.map(f => ({ name: f, ok: false })),
        ],
        sourceRanges: activeNorms.map(n => ({
          name:    n.source,
          minTemp: n.todayLow,
          maxTemp: n.todayHigh,
        })),
        sourceWeights: {
          'Open-Meteo':     norms[0] ? Math.round(normW[0] * 100) : null,
          'WeatherAPI':     norms[1] ? Math.round(normW[1] * 100) : null,
          'Pirate Weather': norms[2] ? Math.round(normW[2] * 100) : null,
          'MET Norway':     norms[3] ? Math.round(normW[3] * 100) : null,
        },
        sourceConditions: sourceConditionVotes,
        localHour,
        utcOffsetSeconds,
        // Phase B-2 Item 1: audit field — which source supplied the offset.
        // 'open-meteo' (primary), 'pirate-weather' (fall-through), 'weatherapi'
        // (via tz_id Intl resolution), or 'default-utc' (all three failed —
        // localHour/MET-alignment/isDay treat the location as UTC).
        utcOffsetSource,
        updatedAtLabel: new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('Weather API error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Phase B-2 Item 1: Resolve an IANA tz_id (e.g. "Africa/Johannesburg") to a
 * DST-aware UTC offset in seconds. Used as the WeatherAPI step of the
 * timezone fallback chain when Open-Meteo and Pirate Weather both fail.
 *
 * Returns null if the tz_id is not resolvable (unknown name, Intl API error,
 * unparseable offset format). Callers default to 0 (UTC) only as last resort.
 *
 * The offset is computed at request-handling time so DST transitions are
 * reflected. For South African users (no DST) the result is stable +7200s.
 * For DST locations like America/Los_Angeles it shifts between -28800 (PST)
 * and -25200 (PDT) automatically.
 */
function computeTimezoneOffsetFromTzId(tzId) {
  if (!tzId || typeof tzId !== 'string') return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tzId, timeZoneName: 'longOffset' });
    const parts = fmt.formatToParts(new Date());
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (!offsetPart) return null;
    const v = offsetPart.value;
    // "GMT" alone (or "UTC") means zero offset.
    if (v === 'GMT' || v === 'UTC') return 0;
    // Otherwise "GMT+HH:MM" or "GMT-HH:MM" — and a few engines emit "GMT+H".
    const match = v.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return null;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 3600 + minutes * 60);
  } catch (_) {
    return null;
  }
}

function pickMostCommon(arr) {
  if (arr.length === 0) return null;
  const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
}

/**
 * Phase B-1 Item 2: Category-aware weighted description voting.
 *
 * Each entry is { desc, weight }. The original implementation accumulated
 * weight per EXACT description string, which meant near-synonyms split the
 * vote: "Light rain" / "Moderate rain" / "Rain showers" / "Patchy rain
 * possible" all voted separately, so a single "Clear sky" vote could win
 * against four rain-ish descriptions. Codex called this out as the central
 * voting bug in the Phase A review.
 *
 * Now: bucket by categorizeDesc() (rain/storm/cold/cloudy/fog/clear), pick
 * the highest-scoring CATEGORY, then return the highest-weighted exact desc
 * within that category as the representative label. This preserves the
 * provider's wording while making the consensus decision correctly.
 *
 * DESC_WEIGHTS = [1, 0.1, 1, 1] is INTENTIONALLY UNCHANGED. WeatherAPI's
 * 0.1 weight was originally a partial workaround for both fragmentation
 * (now solved here) AND for WA's documented unreliability (e.g. flagging
 * rain on clear days via chance_of_rain > 0 with code 1003 + 0mm precip).
 * Only the fragmentation aspect is solved by this change. WA's rain-flag
 * unreliability is a separate calibration and wants real data, not a
 * refactor side-effect — surfaced in PHASE_B1_OPEN_QUESTIONS.md (if any).
 */
function pickWeightedMostCommon(entries) {
  if (entries.length === 0) return null;
  const categoryScores = {};
  const bestPerCategory = {}; // { category: { desc, weight } } — highest-weighted exact desc wins
  for (const { desc, weight } of entries) {
    const category = categorizeDesc(desc);
    categoryScores[category] = (categoryScores[category] || 0) + weight;
    if (!bestPerCategory[category] || bestPerCategory[category].weight < weight) {
      bestPerCategory[category] = { desc, weight };
    }
  }
  const winningCategory = Object.keys(categoryScores).reduce((a, b) =>
    categoryScores[a] > categoryScores[b] ? a : b
  );
  return bestPerCategory[winningCategory].desc;
}

/**
 * Rec 5: Pick modal cloud cover from multiple source values.
 * Categorises each source's cloud % into buckets (clear/partly/mostly/overcast),
 * finds the most common bucket, then returns the median value within that bucket.
 * This avoids averaging bimodal data (e.g. 10% and 90% → meaningless 50%).
 */
function pickModalCloud(values) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  // Bucket cloud values: clear (0-25), partly (25-55), mostly (55-80), overcast (80-100)
  const buckets = { clear: [], partly: [], mostly: [], overcast: [] };
  for (const v of values) {
    if (v < 25)      buckets.clear.push(v);
    else if (v < 55) buckets.partly.push(v);
    else if (v < 80) buckets.mostly.push(v);
    else             buckets.overcast.push(v);
  }

  // Find bucket with most votes
  let winner = 'clear';
  let maxCount = 0;
  for (const [name, vals] of Object.entries(buckets)) {
    if (vals.length > maxCount) {
      maxCount = vals.length;
      winner = name;
    }
  }

  // Return median of the winning bucket
  const winnerVals = buckets[winner].sort((a, b) => a - b);
  return winnerVals[Math.floor(winnerVals.length / 2)];
}

function alignSeriesToLocalMidnight(series, utcOffsetSeconds, nowUtcMs) {
  const aligned = Array(48).fill(null);
  const nowLocalMs = nowUtcMs + utcOffsetSeconds * 1000;
  const localDateStr = new Date(nowLocalMs).toISOString().slice(0, 10);
  const localMidnightMs = Date.parse(`${localDateStr}T00:00:00.000Z`);

  for (const entry of series) {
    if (!entry?.time) continue;
    const entryUtcMs = Date.parse(entry.time);
    if (!Number.isFinite(entryUtcMs)) continue;
    const entryLocalMs = entryUtcMs + utcOffsetSeconds * 1000;
    const index = Math.round((entryLocalMs - localMidnightMs) / (60 * 60 * 1000));
    if (index >= 0 && index < aligned.length) {
      aligned[index] = entry;
    }
  }

  return aligned;
}

/**
 * Calculate "feels like" temperature using wind chill or heat index formulas.
 * Wind chill: valid for temps <= 10C with wind > 4.8 km/h
 * Heat index: valid for temps >= 27C with humidity data
 */
function calcFeelsLike(tempC, windKph, humidity) {
  if (!isNum(tempC)) return null;

  if (tempC <= 10 && isNum(windKph) && windKph > 4.8) {
    const wc = 13.12 + 0.6215 * tempC
      - 11.37 * Math.pow(windKph, 0.16)
      + 0.3965 * tempC * Math.pow(windKph, 0.16);
    return Math.round(wc * 10) / 10;
  }

  if (tempC >= 27 && isNum(humidity)) {
    const hi = tempC + 0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC))) - 4;
    return Math.round(hi * 10) / 10;
  }

  return tempC;
}

/**
 * Derive the weather condition key for UI display.
 *
 * Priority order (highest wins):
 *  1. Storm / thunder / tornado
 *  2. Extreme cold (feels like <= -5C, or temp <= 0C)
 *  3. Snow / sleet / ice / hail / freezing
 *  4. Extreme heat (temp >= 35C or feels like >= 38C)
 *  5. Heavy rain (>= 60% chance)
 *  6. High UV (>= 8, daytime only, not overcast)
 *  7. Strong wind (>= 30 km/h effective)
 *  8. Moderate rain (>= 30% chance)
 *  9. Rain by description
 * 10. Moderate wind (>= 25 km/h)
 * 11. Overcast (>= 80% cloud or description)
 * 12. Rain possible (>= 20% chance)
 * 13. Fog / mist / haze
 * 14. Cold (temp <= 10C)
 * 15. Hot (temp >= 30C)
 * 16. Moderate UV (>= 6, daytime only, not mostly cloudy)
 * 17. Mostly cloudy (>= 55% cloud)
 * 18. Partly cloudy / mainly clear / fair -> 'partly-cloudy' (distinct from clear)
 * 19. Clear by description
 * 20. Fallback: clear
 *
 * @param {object} params
 * @param {string}  params.desc         - Weather description text
 * @param {number}  params.rainChance   - Rain probability % (current hour)
 * @param {number}  params.tempC        - Current temperature C
 * @param {number}  params.feelsLikeC   - Feels like temperature C
 * @param {number}  params.windKph      - Wind speed km/h (weighted average)
 * @param {number}  params.maxWindKph   - Max wind from any source (for gust bias)
 * @param {number}  params.uvIndex      - UV index
 * @param {number}  params.cloudPct     - Cloud cover %
 * @param {boolean} params.isDay        - Whether the sun is currently up
 * @param {number}  [params.dailyHighC] - Today's forecast high (optional). If
 *   provided, gates the chilly rung so a cool morning on a warm day is not
 *   labelled cold for the whole day.
 * @returns {string} condition key
 */
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex, cloudPct, maxWindKph, isDay = true, dailyHighC, sourceDescs }) {
  const d = String(desc || '').toLowerCase();

  // Use mean wind speed for condition thresholds. Gusts are displayed separately in the UI.
  const effectiveWind = windKph;

  // Cloud cover classification
  const isTrulyOvercast    = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy     = isNum(cloudPct) && cloudPct >= 55;
  const isSignificantCloud = isNum(cloudPct) && cloudPct >= 40; // blocks UV
  const isPartlyCloudy     = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;

  // UV temp gate: cold days never warrant a UV headline even if the index is
  // high. South African winter mornings on the highveld can read UV 6+ at
  // 5°C — burn risk is still real, but "High UV" as the day's HEADLINE
  // misrepresents what the user needs to plan for. Only fires when we have
  // a confident dailyHighC < 15. Missing → preserve current behaviour.
  const uvBlockedByCold = isNum(dailyHighC) && dailyHighC < 15;

  // Description-based cloud fallbacks (used when cloudPct is unavailable)
  const descSaysOvercast = d.includes('overcast');
  const descSaysPartly   = d.includes('partly') || d.includes('mainly clear') || d.includes('fair');
  const descSaysCloudy   = d.includes('cloud') && !descSaysPartly;
  const cloudyByDesc     = !isNum(cloudPct) && (descSaysOvercast || descSaysCloudy);
  const overcastByDesc   = !isNum(cloudPct) && descSaysOvercast;
  const partlyByDesc     = !isNum(cloudPct) && descSaysPartly;

  // 0a. Hail (consensus): one source flags hail/hagel AND another source
  //     flags storm/rain/showers — confirms it's a precipitation event,
  //     not a stale icon. Mirrors the fog-majority guard pattern.
  // 0b. Thunder (consensus): same shape, different keywords. Catches
  //     "Rain and thunder" / "Patchy light rain with thunder" etc. that
  //     weighted-string voting splits across near-synonyms.
  if (Array.isArray(sourceDescs) && sourceDescs.length >= 2) {
    const lowered = sourceDescs.map(s => String(s || '').toLowerCase());
    const hailRe = /hail|hagel/;
    const thunderRe = /thunder|lightning|donder|weerlig/;
    const corroborateRe = /storm|rain|shower|drizzle|precip|thunder/;

    const hailIdx = lowered.findIndex(s => hailRe.test(s));
    if (hailIdx !== -1) {
      const hasOtherCorroborator = lowered.some((s, i) => i !== hailIdx && corroborateRe.test(s));
      if (hasOtherCorroborator) {
        debugLog(`[Hail consensus] one source flags hail, another corroborates → hail`);
        return { key: 'hail', reason: 'two-source-consensus-hail' };
      }
    }

    const thunderIdx = lowered.findIndex(s => thunderRe.test(s));
    if (thunderIdx !== -1) {
      const hasOtherCorroborator = lowered.some((s, i) => i !== thunderIdx && corroborateRe.test(s));
      if (hasOtherCorroborator) {
        debugLog(`[Thunder consensus] one source flags thunder, another corroborates → thunder`);
        return { key: 'thunder', reason: 'two-source-consensus-thunder' };
      }
    }
  }

  // 1. Storm (single-source thunder/storm/tornado wins via the description vote)
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return { key: 'storm', reason: 'desc-storm-keyword' };

  // 2. Extreme cold
  if (isNum(feelsLikeC) && feelsLikeC <= -5) return { key: 'cold', reason: 'extreme-cold-feels-like' };
  if (isNum(tempC) && tempC <= 0)             return { key: 'cold', reason: 'extreme-cold-temp' };

  // 3. Winter precipitation
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') ||
      d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) return { key: 'cold', reason: 'desc-winter-precip' };

  // 4. Extreme heat
  if (isNum(tempC) && tempC >= 35)            return { key: 'heat', reason: 'extreme-heat-temp' };
  if (isNum(feelsLikeC) && feelsLikeC >= 38) return { key: 'heat', reason: 'extreme-heat-feels-like' };

  // 5. Heavy rain
  if (isNum(rainChance) && rainChance >= 60)  return { key: 'rain', reason: 'heavy-rain-prob' };

  // 6. High UV — daytime only, not overcast, not significantly cloudy, not a cold day
  if (isDay && isNum(uvIndex) && uvIndex >= 8 && !(isTrulyOvercast || isMostlyCloudy || overcastByDesc) && !uvBlockedByCold) return { key: 'uv', reason: 'high-uv-with-temp-gate' };

  // 7. Strong wind
  if (isNum(effectiveWind) && effectiveWind >= 30) return { key: 'wind', reason: 'strong-wind' };

  // 8. Moderate rain
  if (isNum(rainChance) && rainChance >= 30)  return { key: 'rain', reason: 'moderate-rain-prob' };

  // 9. Rain by description
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return { key: 'rain', reason: 'desc-rain-keyword' };

  // 10. Moderate wind
  if (isNum(effectiveWind) && effectiveWind >= 25) return { key: 'wind', reason: 'moderate-wind' };

  // 11. Overcast
  if (isTrulyOvercast || overcastByDesc)      return { key: 'cloudy', reason: 'overcast' };

  // 12. Possible rain (20%+ but not yet "rain")
  if (isNum(rainChance) && rainChance >= 20)  return { key: 'rain-possible', reason: 'rain-possible-prob' };

  // 13. Fog / mist / haze
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return { key: 'fog', reason: 'desc-fog-keyword' };

  // 14. Cold (not freezing, but chilly)
  //   - Now-path: only declare cold if BOTH the current temp is ≤ 10 AND the
  //     day's high stays ≤ 14. A 9°C dawn warming to 21°C is not a cold day.
  //   - Daily-path: dailyHighC is undefined (caller passes tempC=highC), so the
  //     existing tempC ≤ 10 check still works for daily decisions.
  if (isNum(tempC) && tempC <= 10) {
    if (!isNum(dailyHighC) || dailyHighC <= 14) return { key: 'cold', reason: 'chilly-with-daily-gate' };
    debugLog(`[Cold gate] tempC=${tempC} but dailyHighC=${dailyHighC} > 14 → not cold`);
  }

  // 15. Hot (not extreme, but warm)
  if (isNum(tempC) && tempC >= 30)            return { key: 'heat', reason: 'warm-temp' };

  // 16. Moderate UV — daytime only, not significantly cloudy (40%+ blocks UV), not a cold day
  if (isDay && isNum(uvIndex) && uvIndex >= 6 && !(isSignificantCloud || isMostlyCloudy || cloudyByDesc) && !uvBlockedByCold) return { key: 'uv', reason: 'moderate-uv-with-temp-gate' };

  // 17. Mostly cloudy
  if (isMostlyCloudy || cloudyByDesc)         return { key: 'cloudy', reason: 'mostly-cloudy' };

  // 18. Partly cloudy / mainly clear / fair — distinct from clear so the
  // home headline can match the ⛅ hourly icon. Frontend handles the new key.
  if (isPartlyCloudy || partlyByDesc)         return { key: 'partly-cloudy', reason: 'partly-cloudy' };

  // 19. Clear by description (includes 'wind' to avoid 'Windy' desc falling to bottom)
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair') || d.includes('wind')) return { key: 'clear', reason: 'desc-clear-keyword' };

  // 20. Fallback
  return { key: 'clear', reason: 'fallback-clear' };
}

/**
 * Categorize a weather description into a broad condition bucket.
 * Used by FIX-001 majority voting to count how many sources agree on rain/cloudy.
 */
function categorizeDesc(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';
  // Phase B-2 Item 3: cold check moved ABOVE the rain check so that
  // "Snow showers", "Sleet showers", "Ice pellets" don't get caught by the
  // 'shower' keyword first and routed to 'rain'. The 'snow' / 'sleet' / 'hail'
  // / 'freezing' keywords win. "Rain showers" still routes correctly because
  // the cold check doesn't match it; it falls through to the rain check below.
  if (d.includes('snow') || d.includes('sleet') || d.includes('hail') || d.includes('freezing') || d.includes('ice')) return 'cold';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';
  if (d.includes('overcast')) return 'cloudy';
  if (d.includes('cloud') && !d.includes('partly') && !d.includes('mainly')) return 'cloudy';
  // haze and smoke join fog as visibility-reducing conditions. Default 'clear'
  // was the worst fallback for low-visibility-but-still-light weather; routing
  // to fog category keeps them off the "Pleasant" headline.
  if (d.includes('fog') || d.includes('mist') || d.includes('haze') || d.includes('smoke')) return 'fog';
  return 'clear';
}

// Named exports for focused unit tests. The Vercel API runtime uses the default
// export (the handler); these are test-only surface area.
export { deriveCondition, categorizeDesc, pickWeightedMostCommon };
