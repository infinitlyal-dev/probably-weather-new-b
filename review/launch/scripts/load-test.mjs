// LAUNCH RUN (2026-09-25) — a campaign crowd against the REAL weather handler, locally.
//
//   node review/launch/scripts/load-test.mjs [--visits 3000] [--seconds 60] [--snap on|off]
//        [--fail tomorrow,pirate,locationiq,weatherapi,all,redis] [--tag name]
//
// Nothing real is called. api/weather.js runs in this process; every provider (Open-Meteo,
// WeatherAPI, Pirate, MET, Tomorrow.io, LocationIQ) is a stub with realistic latency; Upstash is an
// in-memory Redis behind a local REST endpoint that runs the production Lua under fengari and
// counts every command; Vercel's edge cache is emulated (s-maxage per exact URL, like the CDN).
// Visitors arrive over --seconds, spread around six SA metros (σ ≈ 9 km), each a first visit
// (name=My Location, coordinates rounded to 4 decimals the way the app rounds GPS), behind 60
// shared carrier IPs. --snap on sends the coordinates on the server's 0.02° cache grid (the
// launch-run client change); off sends them as the app did before.
// --fail makes a source answer 429 every time (tomorrow/pirate/weatherapi/locationiq), all five
// weather sources fail (all), or Upstash answers "ERR max requests limit exceeded" (redis).
// Writes review/launch/results/load-<tag>.json and prints a summary.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari';

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const VISITS = Number(arg('--visits', 3000));
const SECONDS = Number(arg('--seconds', 60));
const SNAP = arg('--snap', 'on') === 'on';
const FAIL = new Set(String(arg('--fail', '')).split(',').filter(Boolean));
const TAG = arg('--tag', `${SNAP ? 'snap' : 'nosnap'}${FAIL.size ? '-' + [...FAIL].join('+') : ''}`);

// ---------------------------------------------------------------- fake Upstash (REST + Lua)
const store = new Map();      // key -> { v: string, exp: ms|null }
const cmdCount = {}; const topCount = {}; let redisCalls = 0;
const top = (cmd) => { const c = String(cmd).toLowerCase(); topCount[c] = (topCount[c] || 0) + 1; };
const live = (k) => { const e = store.get(k); if (!e) return null; if (e.exp && e.exp <= Date.now()) { store.delete(k); return null; } return e; };
function exec(cmd, args) {
  const c = String(cmd).toLowerCase();
  cmdCount[c] = (cmdCount[c] || 0) + 1;
  switch (c) {
    case 'get': return live(args[0])?.v ?? null;
    case 'mget': return args.map((k) => live(k)?.v ?? null);
    case 'set': {
      const [k, v, ...opt] = args; let exp = null, nx = false, xx = false;
      for (let i = 0; i < opt.length; i++) {
        const o = String(opt[i]).toLowerCase();
        if (o === 'ex') exp = Date.now() + Number(opt[++i]) * 1000;
        else if (o === 'px') exp = Date.now() + Number(opt[++i]);
        else if (o === 'nx') nx = true; else if (o === 'xx') xx = true;
      }
      if (nx && live(k)) return null; if (xx && !live(k)) return null;
      store.set(k, { v: String(v), exp }); return 'OK';
    }
    case 'incr': case 'incrby': case 'decr': case 'decrby': {
      const e = live(args[0]); const by = c.endsWith('by') ? Number(args[1]) : 1;
      const n = Number(e?.v ?? 0) + (c.startsWith('incr') ? by : -by);
      store.set(args[0], { v: String(n), exp: e?.exp ?? null }); return n;
    }
    case 'expire': case 'pexpire': { const e = live(args[0]); if (!e) return 0; e.exp = Date.now() + Number(args[1]) * (c === 'expire' ? 1000 : 1); return 1; }
    case 'ttl': case 'pttl': { const e = live(args[0]); if (!e) return -2; if (!e.exp) return -1; const ms = e.exp - Date.now(); return c === 'ttl' ? Math.ceil(ms / 1000) : ms; }
    case 'del': return args.reduce((n, k) => n + (store.delete(k) ? 1 : 0), 0);
    case 'exists': return args.filter((k) => live(k)).length;
    case 'eval': return runLua(args[0], args.slice(2, 2 + Number(args[1])), args.slice(2 + Number(args[1])));
    case 'evalsha': throw new Error('NOSCRIPT No matching script. Please use EVAL.');
    default: throw new Error(`fake upstash: unsupported command ${c}`);
  }
}
function runLua(source, keys, argv) {
  const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
  const push = (state, v) => {
    if (v === null || v === undefined) lua.lua_pushboolean(state, false);
    else if (typeof v === 'number') lua.lua_pushinteger(state, v);
    else lua.lua_pushstring(state, to_luastring(String(v)));
  };
  lua.lua_newtable(L);
  lua.lua_pushjsfunction(L, (state) => {
    const n = lua.lua_gettop(state); const a = [];
    for (let i = 1; i <= n; i++) a.push(to_jsstring(lua.lua_tolstring(state, i)));
    push(state, exec(a[0], a.slice(1))); return 1;
  });
  lua.lua_setfield(L, -2, to_luastring('call'));
  lua.lua_setglobal(L, to_luastring('redis'));
  for (const [name, vals] of [['KEYS', keys], ['ARGV', argv]]) {
    lua.lua_createtable(L, vals.length, 0);
    vals.forEach((v, i) => { lua.lua_pushstring(L, to_luastring(String(v))); lua.lua_rawseti(L, -2, i + 1); });
    lua.lua_setglobal(L, to_luastring(name));
  }
  if (lauxlib.luaL_dostring(L, to_luastring(source)) !== lua.LUA_OK) throw new Error(`lua: ${to_jsstring(lua.lua_tolstring(L, -1))}`);
  const t = lua.lua_type(L, -1);
  if (t === lua.LUA_TNUMBER) return lua.lua_tointeger(L, -1);
  if (t === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, -1) ? 1 : null; // Redis: Lua true → 1, false → nil
  if (t === lua.LUA_TSTRING) return to_jsstring(lua.lua_tolstring(L, -1));
  if (t === lua.LUA_TTABLE) { const out = []; for (let i = 1; ; i++) { lua.lua_rawgeti(L, -1, i); if (lua.lua_isnil(L, -1)) break; out.push(lua.lua_isnumber(L, -1) ? lua.lua_tointeger(L, -1) : to_jsstring(lua.lua_tolstring(L, -1))); lua.lua_pop(L, 1); } return out; }
  return null;
}
const b64 = (v) => (typeof v === 'string' ? Buffer.from(v).toString('base64') : Array.isArray(v) ? v.map(b64) : v);
const upstash = createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    redisCalls++;
    const enc = req.headers['upstash-encoding'] === 'base64';
    const send = (code, obj) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj));
    if (FAIL.has('redis')) return send(400, { error: 'ERR max requests limit exceeded. Limit: 500000, Usage: 500000' });
    try {
      const parsed = JSON.parse(body || '[]');
      if (req.url.startsWith('/pipeline') || req.url.startsWith('/multi-exec')) {
        return send(200, parsed.map((cmd) => { top(cmd[0]); try { const r = exec(cmd[0], cmd.slice(1)); return { result: enc ? b64(r) : r }; } catch (e) { return { error: e.message }; } }));
      }
      top(parsed[0]); const r = exec(parsed[0], parsed.slice(1));
      return send(200, { result: enc ? b64(r) : r });
    } catch (e) { return send(400, { error: e.message }); }
  });
});
await new Promise((r) => upstash.listen(0, '127.0.0.1', r));

// ---------------------------------------------------------------- env, then the real handler
process.env.UPSTASH_KV_REST_API_URL = `http://127.0.0.1:${upstash.address().port}`;
process.env.UPSTASH_KV_REST_API_TOKEN = 'local-load-test';
process.env.OPEN_METEO_API_KEY = 'local-load-test';
process.env.WEATHERAPI_KEY = 'local-load-test';
process.env.PIRATE_WEATHER_KEY = 'local-load-test';
process.env.TOMORROWIO_API_KEY = 'local-load-test';
process.env.LOCATIONIQ_TOKEN = 'local-load-test';
process.env.MET_USER_AGENT = 'ProbablyWeather load test';

// ---------------------------------------------------------------- stub providers
const realFetch = globalThis.fetch;
const upstream = {}; const LAT = { 'open-meteo': 250, weatherapi: 300, pirate: 420, met: 350, tomorrow: 320, locationiq: 220 };
const hourIso = (h) => new Date(Math.floor(Date.now() / 3600e3) * 3600e3 + h * 3600e3).toISOString();
const localDay = (d) => new Date(Date.now() + 2 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);
const PAY = {
  'open-meteo': () => ({
    utc_offset_seconds: 7200,
    current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 1, wind_speed_10m: 12, wind_gusts_10m: 20, wind_direction_10m: 150, relative_humidity_2m: 60, cloud_cover: 30 },
    hourly: Object.fromEntries(['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'cloud_cover', 'relative_humidity_2m', 'uv_index', 'weather_code', 'visibility', 'dew_point_2m']
      .map((k) => [k, Array(168).fill({ temperature_2m: 18, apparent_temperature: 18, precipitation_probability: 5, precipitation: 0, wind_speed_10m: 12, wind_gusts_10m: 20, wind_direction_10m: 150, cloud_cover: 30, relative_humidity_2m: 60, uv_index: 3, weather_code: 1, visibility: 24000, dew_point_2m: 9 }[k])])),
    daily: { temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(10), uv_index_max: Array(7).fill(6), weather_code: Array(7).fill(1), wind_speed_10m_max: Array(7).fill(20),
      sunrise: [0, 1, 2, 3, 4, 5, 6].map((d) => `${localDay(d)}T06:15`), sunset: [0, 1, 2, 3, 4, 5, 6].map((d) => `${localDay(d)}T18:40`) },
  }),
  weatherapi: () => ({
    location: { tz_id: 'Africa/Johannesburg' },
    current: { temp_c: 18, feelslike_c: 18, condition: { code: 1003, text: 'Partly cloudy' }, wind_kph: 13, gust_kph: 22, humidity: 58, precip_mm: 0 },
    forecast: { forecastday: Array.from({ length: 3 }, () => ({ day: { maxtemp_c: 24, mintemp_c: 12, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 6, condition: { code: 1003, text: 'Partly cloudy' } }, astro: { sunrise: '06:15 AM', sunset: '06:40 PM' },
      hour: Array.from({ length: 24 }, () => ({ temp_c: 18, feelslike_c: 18, chance_of_rain: 0, precip_mm: 0, wind_kph: 13, gust_kph: 22, cloud: 30, humidity: 58, condition: { code: 1003, text: 'Partly cloudy' } })) })) },
  }),
  pirate: () => ({ offset: 2, currently: { temperature: 18, windSpeed: 3.5, windGust: 6, humidity: 0.6, icon: 'partly-cloudy-day' },
    daily: { data: Array.from({ length: 7 }, (_, d) => ({ temperatureHigh: 24, temperatureLow: 12, temperatureMin: 12, precipProbability: 0.1, uvIndex: 6, icon: 'partly-cloudy-day', windSpeed: 4, cloudCover: 0.3,
      sunriseTime: Math.floor(Date.parse(`${localDay(d)}T04:15:00Z`) / 1000), sunsetTime: Math.floor(Date.parse(`${localDay(d)}T16:40:00Z`) / 1000) })) } }),
  met: () => ({ properties: { timeseries: Array.from({ length: 60 }, (_, i) => ({ time: hourIso(i),
    data: { instant: { details: { air_temperature: 18, wind_speed: 3.4, relative_humidity: 60, cloud_area_fraction: 30 } }, next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0 } } } })) } }),
  tomorrow: () => ({ data: { timelines: [{ timestep: '1h', intervals: Array.from({ length: 60 }, (_, i) => ({ startTime: hourIso(i),
    values: { temperature: 18, precipitationIntensity: 0, precipitationProbability: 5, weatherCode: 1100, windSpeed: 3.3, humidity: 60, cloudCover: 30, visibility: 16 } })) }] } }),
  locationiq: () => ({ address: { suburb: 'Loadtest Suburb', city: 'Loadtest City', state: 'Gauteng', country_code: 'za' } }),
};
const providerOf = (href) => (/open-meteo\.com/.test(href) ? 'open-meteo' : /weatherapi\.com/.test(href) ? 'weatherapi' : /pirateweather/.test(href) ? 'pirate'
  : /api\.met\.no/.test(href) ? 'met' : /tomorrow\.io/.test(href) ? 'tomorrow' : /locationiq\.com/.test(href) ? 'locationiq' : null);
globalThis.fetch = async (url, opts = {}) => {
  const href = String(url?.url ?? url);
  const p = providerOf(href);
  if (!p) return realFetch(url, opts);
  upstream[p] = (upstream[p] || 0) + 1;
  await new Promise((r) => setTimeout(r, LAT[p] * (0.7 + Math.random() * 0.6)));
  const down = FAIL.has(p) || (FAIL.has('all') && p !== 'locationiq');
  const body = down ? { error: 'quota exceeded' } : PAY[p]();
  return new Response(JSON.stringify(body), { status: down ? 429 : 200, headers: { 'Content-Type': 'application/json' } });
};

const { default: handler } = await import('../../../api/weather.js');
// Silence the handler's per-request logging; keep counts of the budget and failure lines.
const logCounts = {};
for (const k of ['log', 'warn', 'error', 'info', 'debug']) {
  console[k] = (...a) => { const s = String(a[0] ?? ''); const m = s.match(/^\[[a-z0-9-]+\][^—:]*/i); const key = m ? m[0].slice(0, 70) : s.slice(0, 40); logCounts[key] = (logCounts[key] || 0) + 1; };
}

// ---------------------------------------------------------------- edge cache + one request
const edge = new Map(); let edgeHits = 0, invocations = 0;
async function request(urlPath, ip, installId) {
  const now = Date.now();
  const cached = edge.get(urlPath);
  if (cached && cached.exp > now) { edgeHits++; return { status: cached.status, body: cached.body, edge: true, ms: 1 }; }
  invocations++;
  const u = new URL(urlPath, 'http://x');
  const headers = {}; let status = 200; let body;
  const req = { method: 'GET', url: urlPath, query: Object.fromEntries(u.searchParams), headers: { 'x-real-ip': ip, 'x-pw-install': installId } };
  const res = {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, getHeader: (k) => headers[k.toLowerCase()],
    status(c) { status = c; return this; }, json(b) { body = b; return this; }, send(b) { body = b; return this; }, end() { return this; },
  };
  const t0 = Date.now();
  await handler(req, res);
  const sm = /s-maxage=(\d+)/.exec(headers['cache-control'] || '');
  if (sm && status === 200) edge.set(urlPath, { status, body, exp: Date.now() + Number(sm[1]) * 1000 });
  return { status, body, edge: false, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- the crowd
const METROS = [
  { name: 'Johannesburg', lat: -26.20, lon: 28.05, w: 0.30 }, { name: 'Cape Town', lat: -33.95, lon: 18.55, w: 0.22 },
  { name: 'Durban', lat: -29.85, lon: 31.00, w: 0.16 }, { name: 'Pretoria', lat: -25.75, lon: 28.20, w: 0.16 },
  { name: 'Gqeberha', lat: -33.96, lon: 25.60, w: 0.08 }, { name: 'Bloemfontein', lat: -29.10, lon: 26.21, w: 0.08 },
];
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const pickMetro = () => { let r = Math.random(); for (const m of METROS) { if ((r -= m.w) <= 0) return m; } return METROS[0]; };
const snap = (v) => (Math.round(v / 0.02) * 0.02 + 0).toFixed(2);
const r4 = (v) => Math.round(v * 10000) / 10000;

const results = []; const t0 = Date.now();
const jobs = [];
for (let i = 0; i < VISITS; i++) {
  const at = Math.random() * SECONDS * 1000;
  jobs.push(new Promise((resolve) => setTimeout(async () => {
    const m = pickMetro();
    const lat = r4(m.lat + gauss() * 0.08), lon = r4(m.lon + gauss() * 0.09);
    const q = SNAP ? `lat=${snap(lat)}&lon=${snap(lon)}` : `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const r = await request(`/api/weather?${q}&name=${encodeURIComponent('My Location')}`, `41.13.0.${i % 60}`, `install-${i}`);
    const okSources = Array.isArray(r.body?.meta?.sources) ? r.body.meta.sources.filter((s) => s.ok).map((s) => s.name) : [];
    results.push({ status: r.status, edge: r.edge, ms: r.ms, okSources, name: r.body?.location?.name ?? null, cache: r.body?.meta?.serverCache ?? null, temp: r.body?.now?.tempC ?? null });
    resolve();
  }, at)));
}
await Promise.all(jobs);
const wall = (Date.now() - t0) / 1000;

// ---------------------------------------------------------------- report
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const fnMs = results.filter((r) => !r.edge).map((r) => r.ms);
const by = (f) => results.reduce((o, r) => { const k = f(r); o[k] = (o[k] || 0) + 1; return o; }, {});
const sourceShare = {};
for (const s of ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io']) sourceShare[s] = results.filter((r) => r.okSources.includes(s)).length;
const cells = new Set(results.map((_, i) => i)).size;
const summary = {
  tag: TAG, visits: VISITS, seconds: SECONDS, wallSeconds: Math.round(wall), snap: SNAP, fail: [...FAIL],
  statuses: by((r) => r.status), edgeHits, functionInvocations: invocations,
  serverCache: by((r) => r.cache ?? 'none'),
  upstreamCalls: upstream, upstreamPerVisit: Object.fromEntries(Object.entries(upstream).map(([k, v]) => [k, Math.round((v / VISITS) * 1000) / 1000])),
  redisHttpCalls: redisCalls, redisTopLevelCommands: topCount, redisTopLevelPerVisit: Math.round((Object.values(topCount).reduce((a, b) => a + b, 0) / VISITS) * 100) / 100, redisCommands: cmdCount, redisCommandsTotal: Object.values(cmdCount).reduce((a, b) => a + b, 0),
  redisCommandsPerVisit: Math.round((Object.values(cmdCount).reduce((a, b) => a + b, 0) / VISITS) * 100) / 100,
  functionMs: { p50: q(fnMs, 0.5), p95: q(fnMs, 0.95), max: q(fnMs, 1) },
  visitsServedBySource: sourceShare, namesShown: by((r) => (r.name ? (/unknown/i.test(r.name) ? 'Unknown' : r.name.startsWith('Loadtest') ? 'resolved' : r.name) : 'none')),
  tempShown: results.filter((r) => typeof r.temp === 'number').length,
  logLines: Object.fromEntries(Object.entries(logCounts).sort((a, b) => b[1] - a[1]).slice(0, 14)),
};
mkdirSync('review/launch/results', { recursive: true });
writeFileSync(`review/launch/results/load-${TAG}.json`, JSON.stringify(summary, null, 1));
process.stdout.write(JSON.stringify(summary, null, 1) + '\n');
upstash.close();
process.exit(0);
