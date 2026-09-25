// GET /api/health — launch run (2026-09-25). What the launch alert
// (.github/workflows/health.yml, every 30 minutes) reads. Counters only: it
// calls no weather provider and spends no quota. One Redis MGET; the edge keeps
// the answer for a minute, so hammering it costs nothing.
//
// {
//   ok, version, checkedAt,
//   redis: 'ok' | 'not configured' | 'error: …'   (Upstash out of commands shows here)
//   sourcesOff: [...]                               (PW_SOURCES_OFF, as ids)
//   today: { weatherapi: { used, cap }, pirate: …, tomorrow: …, locationiq: … }   (UTC day)
//   openMeteoMonth: { units, plan }                 (commercial key only)
//   failuresLastHour: { open-meteo: n, … }          (this hour + the one before)
//   serverErrorsLastHour: n
// }
import { getRedis } from './_lib/limiters.js';
import { PROVIDER_BUDGETS } from './_lib/provider-budget.js';
import { failKey, serverErrorKey } from './_lib/health-counters.js';
import { parseSourcesOff } from './_lib/sources-off.js';

const DAY_CAPPED = ['weatherapi', 'pirate', 'tomorrow', 'locationiq'];
const PROVIDERS = ['open-meteo', 'weatherapi', 'pirate', 'met', 'tomorrow'];
const OPEN_METEO_MONTHLY_PLAN = 1_000_000;

const toNum = (v) => (v == null ? 0 : Number(v) || 0);

export default async function handler(req, res, { redis = getRedis(), nowMs = Date.now() } = {}) {
  res.setHeader('Cache-Control', 's-maxage=60');
  const day = Math.floor(nowMs / 86400000);
  const d = new Date(nowMs);
  const monthKey = `pw-budget:open-meteo:month:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const sourcesOff = [...parseSourcesOff(process.env.PW_SOURCES_OFF).off];
  const out = {
    ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA || 'local', checkedAt: d.toISOString(),
    redis: 'ok', sourcesOff, today: {}, openMeteoMonth: null, failuresLastHour: {}, serverErrorsLastHour: 0,
  };
  if (!redis) {
    out.redis = 'not configured';
    return res.status(200).json(out);
  }
  const dayKeys = DAY_CAPPED.map((p) => `pw-budget:${p}:d:${day}`);
  const failKeys = PROVIDERS.flatMap((p) => [failKey(p, nowMs), failKey(p, nowMs - 3600000)]);
  const errKeys = [serverErrorKey(nowMs), serverErrorKey(nowMs - 3600000)];
  try {
    const vals = await redis.mget(...dayKeys, monthKey, ...failKeys, ...errKeys);
    let i = 0;
    for (const p of DAY_CAPPED) out.today[p] = { used: toNum(vals[i++]), cap: PROVIDER_BUDGETS[p]?.perDay ?? null };
    if (process.env.OPEN_METEO_API_KEY) out.openMeteoMonth = { units: toNum(vals[i]), plan: OPEN_METEO_MONTHLY_PLAN };
    i++;
    for (const p of PROVIDERS) { out.failuresLastHour[p] = toNum(vals[i]) + toNum(vals[i + 1]); i += 2; }
    out.serverErrorsLastHour = toNum(vals[i]) + toNum(vals[i + 1]);
  } catch (err) {
    out.ok = false;
    out.redis = `error: ${String(err?.message || err).slice(0, 160)}`;
  }
  return res.status(200).json(out);
}
