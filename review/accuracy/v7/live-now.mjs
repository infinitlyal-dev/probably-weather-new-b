// What the live app says right now at four places against the nearest gust-reporting SA Weather Service station's
// latest report (v7 PLAN §7). Reads the live API once per place and Ogimet once per station (25 s apart).
//   node review/accuracy/v7/live-now.mjs [--base https://www.probablyweather.co.za]
import { parseSynopLine } from './synop7.mjs';
import { gustStationsFromDisk } from './synop7.mjs';

const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'https://www.probablyweather.co.za';
const PLACES = [
  { name: 'Strand', lat: -34.1163, lon: 18.8362 },
  { name: "Gordon's Bay", lat: -34.1575, lon: 18.8660 },
  { name: 'Cape Town city', lat: -33.9249, lon: 18.4241 },
  { name: 'Gqeberha', lat: -33.9608, lon: 25.6022 },
];
const km = (a, b) => 111 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stations = gustStationsFromDisk(100);
const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace(/[-T:]/g, '');
const seen = new Map();
for (const p of PLACES) {
  const st = stations.map((s) => ({ s, d: km(p, s) })).sort((a, b) => a.d - b.d)[0];
  const r = await fetch(`${BASE}/api/weather?lat=${p.lat}&lon=${p.lon}`, { headers: { 'User-Agent': 'probably-weather v7 live check' } });
  const j = await r.json();
  const g = j.meta?.wind?.gust ?? {};
  let rep = seen.get(st.s.id);
  if (!rep) {
    if (seen.size) await sleep(25_000);
    const t = await (await fetch(`https://www.ogimet.com/cgi-bin/getsynop?block=${st.s.id}&begin=${stamp(Date.now() - 4 * 3600e3)}&end=${stamp(Date.now())}`, { headers: { 'User-Agent': 'probably-weather accuracy check (research, low volume)' } })).text();
    rep = t.trim().split('\n').map((l) => parseSynopLine(l.trim())).filter(Boolean).sort((a, b) => b.utc - a.utc)[0] ?? null;
    seen.set(st.s.id, rep);
  }
  const at = rep ? new Date(rep.utc).toISOString().slice(11, 16) + ' UTC' : 'no report in the last 4 h';
  console.log(`${p.name}: app ${j.now?.windKph} km/h, gust ${g.heroKph ?? j.now?.conditionSignals?.numeric?.gustKph ?? '—'} (raw ${g.rawKph ?? '—'}, ×${g.factor ?? 1}${g.station ? ` by ${g.station}` : ''}), shown gust ${j.gustKph ?? '—'}, hero "${j.now?.conditionKey}" (${j.now?.conditionReason ?? j.meta?.conditionConfidence ?? ''}) gust line ${g.lineKph ?? 55} · station ${st.s.id} ${st.s.name} (${st.d.toFixed(0)} km) at ${at}: ${rep ? `${Math.round(rep.kph)} km/h from ${rep.dir ?? '—'}°, gust ${rep.gustKph != null ? Math.round(rep.gustKph) : '—'}` : ''} · version ${j.meta?.version ?? r.headers.get('x-pw-version') ?? '?'}`);
}
