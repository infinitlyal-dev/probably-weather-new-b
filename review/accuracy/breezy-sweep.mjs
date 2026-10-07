import path from 'node:path';
// Part B / sets (7 Oct 2026): the breezy line, swept on the harness against the airports' own wind.
//   node review/accuracy/breezy-sweep.mjs
const R = new URL('../../', import.meta.url).href;
const { loadStationHourly } = await import(R + 'review/accuracy/lib/obs.mjs');
const { CITIES, RANGE, ACCURACY_ROOT, loadCity, ensembleAt } = await import(R + 'review/accuracy/lib/sources.mjs');
const { decideAt } = await import(R + 'review/accuracy/lib/replay.mjs');
const { shapeWind, windLine } = await import(R + 'api/_lib/wind.js');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const tag = `${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}`;
const rows = [];
for (const icao of Object.keys(CITIES)) {
  const city = loadCity(icao); const obs = loadStationHourly(path.join(ACCURACY_ROOT, 'obs', `metar-${icao}-${tag}.csv`));
  for (let i = 0; i < city.nHours; i++) {
    const key = city.times[i].slice(0, 13); const o = obs.get(key); if (!o || !isNum(o.windKph)) continue;
    const r = decideAt(city, i); const E = ensembleAt(city, i);
    const act = E.norms.filter(Boolean);
    const month = Number(key.slice(5, 7));
    const shaped = shapeWind({ raw: r.blends.windKph, values: act.map((n) => n.windKph), slots: E.norms.map((n) => (n && isNum(n.windKph) ? n.windKph : null)), kind: 'now', lat: city.lat, lon: city.lon, month, hour: r.localHour });
    const wl = windLine(shaped);
    rows.push({ icao, key: r.server.key, reason: r.server.reason, kph: wl.kph, line: wl.thresholdKph, f: wl.sourceFactor,
      src: act.map((n) => ({ w: n.windKph, g: n.gustKph })), obsW: o.windKph, obsG: o.gustKph });
  }
}
const sky = (r) => r.key === 'clear' || r.key === 'partly-cloudy' || (r.key === 'uv' && r.reason === 'moderate-uv-with-temp-gate');
const cls = (r) => { const g = isNum(r.obsG) ? r.obsG : 0; if (r.obsW >= 30 || g >= 45) return 'windy'; if (r.obsW >= 12 || g >= 30) return 'breezy'; return r.obsW < 8 ? 'still' : 'light'; };
const cand = rows.filter(sky);
const base = { n: cand.length }; for (const c of ['still', 'light', 'breezy', 'windy']) base[c] = cand.filter((r) => cls(r) === c).length;
console.log('clear/partly hours', JSON.stringify(base));
const out = [];
for (const T of [10, 12, 14, 15, 16, 18, 20]) for (const G of [25, 30, 35, 40, Infinity]) {
  const pred = cand.filter((r) => isNum(r.kph) && r.kph < r.line && (r.kph >= T || r.src.some((s) => isNum(s.g) && s.g >= G))
    && r.src.filter((s) => (isNum(s.w) && s.w * r.f >= T) || (isNum(s.g) && s.g >= G)).length >= 2);
  const c = { still: 0, light: 0, breezy: 0, windy: 0 }; for (const r of pred) c[cls(r)]++;
  const hit = c.breezy + c.windy, n = pred.length;
  const recall = hit / (base.breezy + base.windy);
  const prec = n ? hit / n : 0; const f1 = prec + recall ? 2 * prec * recall / (prec + recall) : 0;
  out.push({ T, G: G === Infinity ? '—' : G, n, prec: Math.round(prec * 100), still: n ? Math.round(c.still / n * 100) : 0, recall: Math.round(recall * 100), f1: Math.round(f1 * 100) });
}
out.sort((a, b) => b.f1 - a.f1);
console.log('mean≥ gust≥ | breezy calls | station ≥12 km/h (or gust ≥30) | station <8 km/h | recall of breezy+windy hours on a clear/partly hero | F1');
for (const o of out.slice(0, 14)) console.log(o.T, o.G, '|', o.n, '|', o.prec + '%', '|', o.still + '%', '|', o.recall + '%', '|', o.f1);
for (const o of out.filter((o) => o.T === 15)) console.log('T15', o.G, o.n, o.prec, o.still, o.recall, o.f1);
for (const [T, G] of [[15, 30], [12, Infinity], [16, 25]]) {
  console.log(`== mean ≥ ${T}${G === Infinity ? '' : `, gust ≥ ${G}`}`);
  for (const icao of Object.keys(CITIES)) {
    const cc = cand.filter((r) => r.icao === icao);
    const pred = cc.filter((r) => isNum(r.kph) && r.kph < r.line && (r.kph >= T || r.src.some((s) => isNum(s.g) && s.g >= G)) && r.src.filter((s) => (isNum(s.w) && s.w * r.f >= T) || (isNum(s.g) && s.g >= G)).length >= 2);
    const ok = pred.filter((r) => ['breezy', 'windy'].includes(cls(r))).length, still = pred.filter((r) => cls(r) === 'still').length;
    console.log(`  ${icao} clear/partly ${cc.length}, breezy ${pred.length} (${Math.round(pred.length / cc.length * 100)}%), right ${Math.round(ok / pred.length * 100)}%, still ${Math.round(still / pred.length * 100)}%, factor ${cc[0]?.f}`);
  }
}
