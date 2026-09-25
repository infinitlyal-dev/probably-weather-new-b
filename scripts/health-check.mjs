// LAUNCH ALERT (2026-09-25) — run by .github/workflows/health.yml every 30 minutes.
//
//   node scripts/health-check.mjs            # needs GITHUB_TOKEN + GITHUB_REPOSITORY (the workflow sets both)
//   node scripts/health-check.mjs --dry-run  # print what it would open or close; touches no issue
//
// Reads the live site (/ and /api/health — counters only, no weather provider is called) and opens
// one GitHub issue per problem, @-mentioning Al so GitHub emails him. When the problem is gone it
// comments and closes the issue. Nothing else: no new account, no secret beyond the workflow's own
// token. What each alert means and what to do: review/launch/RUNBOOK.md.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = process.env.PW_SITE || 'https://www.probablyweather.co.za';
const MENTION = '@infinitlyal-dev';
const PREFIX = '[PW alert] ';
export const LIMITS = { serverErrorsPerHour: 20, sourceFailuresPerHour: 10, allowanceShare: 0.9, openMeteoMonthShare: 0.8 };
const NAMES = { 'open-meteo': 'Open-Meteo', weatherapi: 'WeatherAPI', pirate: 'Pirate Weather', met: 'MET Norway', tomorrow: 'Tomorrow.io', locationiq: 'LocationIQ (place names)' };

/** The problems in one reading of the site. Pure: tested in tests/health-check.test.js. */
export function evaluate({ homeStatus, healthStatus, health }) {
  const out = [];
  const add = (key, title, body) => out.push({ key, title, body });
  if (homeStatus !== 200) add('home-down', `The site is down (home page answered ${homeStatus ?? 'nothing'})`, 'People opening probablyweather.co.za get an error. If a release just went out, roll it back (RUNBOOK: "Roll back a bad release").');
  if (healthStatus !== 200 || !health) {
    add('health-down', `The health check is not answering (${healthStatus ?? 'no answer'})`, 'The API may be down. Open the site on your phone; if the forecast does not load, roll back (RUNBOOK).');
    return out;
  }
  if (health.redis && health.redis !== 'ok' && health.redis !== 'not configured') {
    add('redis', 'The shared cache (Upstash) is failing', `Upstash says: ${health.redis}\n\nThe app keeps working, but without the cache every visit asks the weather providers, so their allowances run out fast. If it says "max requests limit exceeded", the free Upstash plan is used up — switch it to pay-as-you-go (RUNBOOK).`);
  }
  if ((health.serverErrorsLastHour ?? 0) >= LIMITS.serverErrorsPerHour) {
    add('server-errors', `${health.serverErrorsLastHour} forecasts failed in the last hour`, 'Many people are seeing "Couldn\'t fetch weather". Check the Vercel logs; if a release just went out, roll it back (RUNBOOK).');
  }
  const off = new Set(health.sourcesOff || []);
  for (const [p, n] of Object.entries(health.failuresLastHour || {})) {
    if (off.has(p) || n < LIMITS.sourceFailuresPerHour) continue;
    add(`source-${p}`, `${NAMES[p] || p} is failing (${n} errors in the last hour)`, `The app carries on with the other sources. If it keeps failing, switch it off: PW_SOURCES_OFF=${p} (RUNBOOK: "Switch a source off").`);
  }
  for (const [p, v] of Object.entries(health.today || {})) {
    if (!v?.cap || off.has(p) || v.used < LIMITS.allowanceShare * v.cap) continue;
    add(`allowance-${p}`, `${NAMES[p] || p} has used ${Math.round((v.used / v.cap) * 100)}% of today's allowance (${v.used} of ${v.cap})`, 'The app keeps working without it for the rest of the day (UTC). If this happens every day, it is time for its paid plan (see the money page).');
  }
  const om = health.openMeteoMonth;
  if (om?.plan && om.units >= LIMITS.openMeteoMonthShare * om.plan) {
    add('open-meteo-month', `Open-Meteo has used ${Math.round((om.units / om.plan) * 100)}% of this month's plan`, 'Open-Meteo is the main source. Above 100% the next plan (Professional) is needed.');
  }
  return out;
}

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'probably-weather launch alert (GitHub Actions)' }, signal: AbortSignal.timeout(20000) });
    let body = null; try { body = await r.json(); } catch { body = null; }
    return { status: r.status, body };
  } catch { return { status: null, body: null }; }
}

async function gh(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...init, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`GitHub ${init.method || 'GET'} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  const [home, health] = await Promise.all([get(`${SITE}/`), get(`${SITE}/api/health`)]);
  const problems = evaluate({ homeStatus: home.status, healthStatus: health.status, health: health.body });
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  if (dry || !process.env.GITHUB_TOKEN) {
    console.log(JSON.stringify({ home: home.status, health: health.body, problems }, null, 1));
    return;
  }
  const open = (await gh('/issues?state=open&per_page=100')).filter((i) => !i.pull_request && i.title.startsWith(PREFIX));
  const keyOf = (issue) => /<!-- pw-alert: ([\w-]+) -->/.exec(issue.body || '')?.[1];
  const openKeys = new Map(open.map((i) => [keyOf(i), i]));
  for (const p of problems) {
    if (openKeys.has(p.key)) continue;   // already open: GitHub already told Al
    await gh('/issues', { method: 'POST', body: JSON.stringify({ title: PREFIX + p.title, body: `${MENTION} ${p.body}\n\nSeen ${stamp}. This issue closes itself when the problem is gone.\n\n<!-- pw-alert: ${p.key} -->` }) });
    console.log(`opened: ${p.title}`);
  }
  const now = new Set(problems.map((p) => p.key));
  for (const [key, issue] of openKeys) {
    if (!key || now.has(key)) continue;
    await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `Gone at ${stamp}.` }) });
    await gh(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
    console.log(`closed: ${issue.title}`);
  }
  if (!problems.length) console.log(`healthy at ${stamp}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
