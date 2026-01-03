// /api/weather.js — Vercel Serverless Function
// Env vars needed on Vercel:
// - WEATHERAPI_KEY
// - OPENWEATHER_KEY
//
// Client calls:
// /api/weather?lat=-26.2041&lon=28.0473&name=Johannesburg

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const memCache = new Map(); // key -> { ts, data }

function cacheKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

function toCelsiusFromKelvin(k) {
  if (!isNum(k)) return null;
  return k - 273.15;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function isoLocalFromUnix(dtSec, tzOffsetSec) {
  // Create a "local" ISO string without timezone suffix
  // dtSec is UTC unix time, tzOffsetSec is seconds offset from UTC
  const ms = (dtSec + tzOffsetSec) * 1000;
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function datePart(iso) {
  return (iso || '').slice(0, 10);
}

function safeFetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, {
    signal: ctrl.signal,
    headers: {
      'accept': 'application/json',
      // Some providers like a UA; harmless to include:
      'user-agent': 'ProbablyWeather/1.0',
    }
  }).then(async (r) => {
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function normalizeOpenMeteo(raw) {
  // Hourly arrays (already hourly, timezone=auto)
  const h = raw?.hourly || {};
  const d = raw?.daily || {};
  const current = raw?.current_weather || null;

  const hourly = {
    times: Array.isArray(h.time) ? h.time : [],
    tempC: Array.isArray(h.temperature_2m) ? h.temperature_2m : [],
    rainPct: Array.isArray(h.precipitation_probability) ? h.precipitation_probability : [],
    windKph: Array.isArray(h.windspeed_10m) ? h.windspeed_10m : [],
  };

  const daily = {
    times: Array.isArray(d.time) ? d.time : [],
    maxC: Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : [],
    minC: Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : [],
    rainPct: Array.isArray(d.precipitation_probability_max) ? d.precipitation_probability_max : [],
    uv: Array.isArray(d.uv_index_max) ? d.uv_index_max : [],
  };

  const nowTime = current?.time || (hourly.times[0] ? hourly.times[0] : null);
  const nowTempC = isNum(current?.temperature) ? current.temperature : (isNum(hourly.tempC[0]) ? hourly.tempC[0] : null);

  return {
    provider: 'Open-Meteo',
    ok: true,
    nowTime,
    nowTempC,
    hourly,
    daily,
    tz: raw?.timezone || null,
    utcOffsetSec: raw?.utc_offset_seconds ?? null,
  };
}

function normalizeWeatherApi(raw) {
  const loc = raw?.location || {};
  const fd = raw?.forecast?.forecastday || [];

  const hourlyTimes = [];
  const hourlyTempC = [];
  const hourlyRain = [];

  // Flatten first 2 days of hours (48 hours)
  for (let di = 0; di < Math.min(fd.length, 2); di++) {
    const hours = fd[di]?.hour || [];
    for (const hr of hours) {
      const t = (hr?.time || '').replace(' ', 'T').slice(0, 16);
      hourlyTimes.push(t);
      hourlyTempC.push(isNum(hr?.temp_c) ? hr.temp_c : null);
      hourlyRain.push(isNum(hr?.chance_of_rain) ? hr.chance_of_rain : null);
    }
  }

  const dailyTimes = [];
  const dailyMax = [];
  const dailyMin = [];
  const dailyRain = [];
  const dailyUv = [];

  for (let di = 0; di < Math.min(fd.length, 7); di++) {
    const day = fd[di]?.day || {};
    dailyTimes.push(fd[di]?.date || null);
    dailyMax.push(isNum(day?.maxtemp_c) ? day.maxtemp_c : null);
    dailyMin.push(isNum(day?.mintemp_c) ? day.mintemp_c : null);
    dailyRain.push(isNum(day?.daily_chance_of_rain) ? day.daily_chance_of_rain : null);
    dailyUv.push(isNum(day?.uv) ? day.uv : null);
  }

  const nowTime = (loc?.localtime || '').replace(' ', 'T').slice(0, 16) || null;
  const nowTempC = isNum(raw?.current?.temp_c) ? raw.current.temp_c : null;

  return {
    provider: 'WeatherAPI',
    ok: true,
    nowTime,
    nowTempC,
    hourly: { times: hourlyTimes, tempC: hourlyTempC, rainPct: hourlyRain, windKph: [] },
    daily: { times: dailyTimes, maxC: dailyMax, minC: dailyMin, rainPct: dailyRain, uv: dailyUv },
    tz: loc?.tz_id || null,
    utcOffsetSec: null,
  };
}

function normalizeOpenWeather(raw) {
  const city = raw?.city || {};
  const tzOffset = isNum(city?.timezone) ? city.timezone : 0;
  const list = Array.isArray(raw?.list) ? raw.list : [];

  // Convert list to local ISO, tempC, pop%
  const items = list.map((it) => {
    const iso = isoLocalFromUnix(it?.dt, tzOffset);
    const tempC = toCelsiusFromKelvin(it?.main?.temp);
    const pop = isNum(it?.pop) ? clamp(Math.round(it.pop * 100), 0, 100) : null;
    return { iso, tempC, pop };
  });

  // Daily: group by datePart
  const byDay = new Map();
  for (const it of items) {
    const dp = datePart(it.iso);
    if (!byDay.has(dp)) byDay.set(dp, []);
    byDay.get(dp).push(it);
  }

  const dailyTimes = [];
  const dailyMax = [];
  const dailyMin = [];
  const dailyRain = [];

  for (const [dp, arr] of Array.from(byDay.entries()).slice(0, 7)) {
    const temps = arr.map(x => x.tempC).filter(isNum);
    const pops = arr.map(x => x.pop).filter(isNum);
    dailyTimes.push(dp);
    dailyMax.push(temps.length ? Math.max(...temps) : null);
    dailyMin.push(temps.length ? Math.min(...temps) : null);
    dailyRain.push(pops.length ? Math.max(...pops) : null);
  }

  // "Now" is first item
  const nowTime = items[0]?.iso || null;
  const nowTempC = isNum(items[0]?.tempC) ? items[0].tempC : null;

  return {
    provider: 'OpenWeatherMap',
    ok: true,
    nowTime,
    nowTempC,
    hourly: { times: items.map(x => x.iso), tempC: items.map(x => x.tempC), rainPct: items.map(x => x.pop), windKph: [] },
    daily: { times: dailyTimes, maxC: dailyMax, minC: dailyMin, rainPct: dailyRain, uv: [] },
    tz: city?.name ? city.name : null,
    utcOffsetSec: tzOffset,
  };
}

function median(nums) {
  const a = nums.filter(isNum).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function spread(nums) {
  const a = nums.filter(isNum);
  if (a.length < 2) return null;
  return Math.max(...a) - Math.min(...a);
}

function computeAgreement(tempSpreadC, rainSpreadPct) {
  // tuned to make Mixed rarer
  const t = isNum(tempSpreadC) ? tempSpreadC : 0;
  const r = isNum(rainSpreadPct) ? rainSpreadPct : 0;

  if (t <= 1.5 && r <= 12) return { label: 'Strong', score: 0.9 };
  if (t <= 3.0 && r <= 25) return { label: 'Decent', score: 0.65 };
  return { label: 'Mixed', score: 0.35 };
}

function pickHourlyAligned(baseTimes, sourcesHourly) {
  // baseTimes: the canonical hourly times (use Open-Meteo hourly times if possible)
  // sourcesHourly: array of { provider, times[], tempC[], rainPct[] }
  // Returns: aligned arrays per provider for those baseTimes using nearest-match.
  const out = {};
  for (const s of sourcesHourly) {
    const map = new Map();
    for (let i = 0; i < s.times.length; i++) {
      const t = s.times[i];
      if (!t) continue;
      map.set(t.slice(0, 13), i); // key by hour prefix YYYY-MM-DDTHH
    }

    const alignedTemp = [];
    const alignedRain = [];
    for (const bt of baseTimes) {
      const key = (bt || '').slice(0, 13);
      const idx = map.has(key) ? map.get(key) : -1;
      alignedTemp.push(idx >= 0 ? s.tempC[idx] : null);
      alignedRain.push(idx >= 0 ? s.rainPct[idx] : null);
    }
    out[s.provider] = { tempC: alignedTemp, rainPct: alignedRain };
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const { lat, lon, name } = req.query || {};
    if (!lat || !lon) {
      res.status(400).json({ error: 'Missing lat/lon' });
      return;
    }

    const key = cacheKey(lat, lon);
    const cached = memCache.get(key);
    if (cached && (Date.now() - cached.ts) < TTL_MS) {
      res.setHeader('cache-control', 'public, max-age=60');
      res.status(200).json(cached.data);
      return;
    }

    const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;
    const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;

    const tasks = [];

    // Open-Meteo (no key)
    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,precipitation_probability,windspeed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max` +
      `&timezone=auto&forecast_days=7`;
    tasks.push(
      safeFetchJson(omUrl, 8500)
        .then((j) => normalizeOpenMeteo(j))
        .catch((e) => ({ provider: 'Open-Meteo', ok: false, error: String(e?.message || e) }))
    );

    // OpenWeatherMap (key)
    if (OPENWEATHER_KEY) {
      const owUrl =
        `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
        `&appid=${encodeURIComponent(OPENWEATHER_KEY)}`;
      tasks.push(
        safeFetchJson(owUrl, 8500)
          .then((j) => normalizeOpenWeather(j))
          .catch((e) => ({ provider: 'OpenWeatherMap', ok: false, error: String(e?.message || e) }))
      );
    } else {
      tasks.push(Promise.resolve({ provider: 'OpenWeatherMap', ok: false, error: 'Missing OPENWEATHER_KEY' }));
    }

    // WeatherAPI (key)
    if (WEATHERAPI_KEY) {
      const waUrl =
        `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(WEATHERAPI_KEY)}` +
        `&q=${encodeURIComponent(`${lat},${lon}`)}` +
        `&days=7&aqi=no&alerts=no`;
      tasks.push(
        safeFetchJson(waUrl, 8500)
          .then((j) => normalizeWeatherApi(j))
          .catch((e) => ({ provider: 'WeatherAPI', ok: false, error: String(e?.message || e) }))
      );
    } else {
      tasks.push(Promise.resolve({ provider: 'WeatherAPI', ok: false, error: 'Missing WEATHERAPI_KEY' }));
    }

    const results = await Promise.all(tasks);

    const ok = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);

    // Canonical hourly times: prefer Open-Meteo's hourly times
    const om = ok.find(r => r.provider === 'Open-Meteo') || null;
    const baseTimes = (om?.hourly?.times || []).slice(0, 48); // 48 hours

    const aligned = pickHourlyAligned(
      baseTimes,
      ok.map(r => ({
        provider: r.provider,
        times: r.hourly?.times || [],
        tempC: r.hourly?.tempC || [],
        rainPct: r.hourly?.rainPct || []
      }))
    );

    // Aggregate current temp + today rain + agreement based on spreads
    const nowTemps = ok.map(r => r.nowTempC).filter(isNum);
    const nowTempMedian = median(nowTemps);

    // Today: use daily[0]
    const todayMax = median(ok.map(r => r.daily?.maxC?.[0]).filter(isNum));
    const todayMin = median(ok.map(r => r.daily?.minC?.[0]).filter(isNum));
    const todayRain = median(ok.map(r => r.daily?.rainPct?.[0]).filter(isNum));
    const todayUv = median(ok.map(r => r.daily?.uv?.[0]).filter(isNum));

    const tempSp = spread(ok.map(r => r.nowTempC).filter(isNum));
    const rainSp = spread(ok.map(r => r.daily?.rainPct?.[0]).filter(isNum));
    const agreement = computeAgreement(tempSp, rainSp);

    const payload = {
      place: {
        name: name || null,
        lat: Number(lat),
        lon: Number(lon),
      },
      sources: {
        used: ok.map(r => r.provider),
        failed: failed.map(r => ({ provider: r.provider, error: r.error || 'Failed' })),
        countUsed: ok.length,
      },
      now: {
        time: om?.nowTime || ok[0]?.nowTime || null,
        tempC: nowTempMedian,
      },
      today: {
        maxC: todayMax,
        minC: todayMin,
        rainPct: todayRain,
        uv: todayUv,
      },
      agreement: {
        label: agreement.label,
        score: agreement.score,
        tempSpreadC: tempSp ?? null,
        rainSpreadPct: rainSp ?? null,
      },
      hourly: {
        times: baseTimes,
        perSource: aligned,
        medianTempC: baseTimes.map((_, i) => median(ok.map(r => aligned[r.provider]?.tempC?.[i]).filter(isNum))),
        medianRainPct: baseTimes.map((_, i) => median(ok.map(r => aligned[r.provider]?.rainPct?.[i]).filter(isNum))),
      },
      daily: {
        times: (om?.daily?.times || ok[0]?.daily?.times || []).slice(0, 7),
        medianMaxC: Array.from({ length: 7 }).map((_, i) => median(ok.map(r => r.daily?.maxC?.[i]).filter(isNum))),
        medianMinC: Array.from({ length: 7 }).map((_, i) => median(ok.map(r => r.daily?.minC?.[i]).filter(isNum))),
        medianRainPct: Array.from({ length: 7 }).map((_, i) => median(ok.map(r => r.daily?.rainPct?.[i]).filter(isNum))),
        medianUv: Array.from({ length: 7 }).map((_, i) => median(ok.map(r => r.daily?.uv?.[i]).filter(isNum))),
      }
    };

    memCache.set(key, { ts: Date.now(), data: payload });

    res.setHeader('cache-control', 'public, max-age=60');
    res.status(200).json(payload);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
