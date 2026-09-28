// SYNOP reading for v7: every block-68 report on disk → per station, per UTC hour: 10-minute mean wind (km/h),
// direction (degrees, 0 = calm/variable), and the 910ff gust (km/h; the highest gust in the 10 minutes before the
// report — the same quantity as a METAR gust). 911ff (the period's highest) is a different quantity and is never used.
// Units from iw (YYGGiw): 3/4 knots, 0/1 m/s, anything else skipped (as live/score.mjs).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DATA, loadIsd } from './fetch7.mjs';
import { inSouthAfrica } from '../../../api/_lib/precision.js';

export function parseSynopLine(line) {
  const c = line.split(',');
  if (c.length < 7 || !/^68\d{3}$/.test(c[0])) return null;
  const msg = c.slice(6).join(',').replace(/=+\s*$/, '').trim();
  if (/NIL/.test(msg)) return null;
  const g = msg.split(/\s+/);
  if (g[0] !== 'AAXX') return null;
  const iw = Number(g[1]?.slice(4, 5));
  const unit = iw === 3 || iw === 4 ? 1.852 : iw === 0 || iw === 1 ? 3.6 : null;
  const w = g[4];
  if (!unit || !/^[\d/]\d{4}$/.test(w ?? '')) return null;
  const dd = Number(w.slice(1, 3)), ff = Number(w.slice(3, 5));
  if (!Number.isFinite(ff) || ff === 99 || !Number.isFinite(dd) || dd > 36 && dd !== 99) return null;
  const s3 = g.indexOf('333'), s5 = g.indexOf('555');
  const sec3 = s3 >= 0 ? g.slice(s3 + 1, s5 > s3 ? s5 : undefined) : [];
  const gg = sec3.find((x) => /^910\d\d$/.test(x));
  const utc = Date.UTC(+c[1], +c[2] - 1, +c[3], +c[4], +c[5]);
  return { id: c[0], utc, kph: ff * unit, dir: dd === 99 ? null : dd * 10, gustKph: gg ? Number(gg.slice(3)) * unit : null };
}

/** id → Map<utcHourMs, report> (on-the-hour reports only). */
export function loadSynop() {
  const out = new Map();
  if (!existsSync(DATA)) return out;
  for (const f of readdirSync(DATA).filter((x) => /^synop68-\d{8}\.txt$/.test(x)).sort()) {
    for (const line of readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      const r = parseSynopLine(line.trim());
      if (!r || r.utc % 3600e3 !== 0) continue;
      if (!out.has(r.id)) out.set(r.id, new Map());
      out.get(r.id).set(r.utc, r);
    }
  }
  return out;
}

/** Gust-reporting South African stations (≥ minGusts 910ff groups since March), with coordinates. */
export function gustStationsFromDisk(minGusts = 100) {
  const isd = loadIsd(), syn = loadSynop(), out = [];
  for (const [id, m] of syn) {
    const meta = isd.get(id);
    if (!meta || meta.ctry !== 'SF' || !inSouthAfrica(meta.lat, meta.lon)) continue;
    const gusts = [...m.values()].filter((r) => r.gustKph !== null).length;
    if (gusts >= minGusts) out.push({ ...meta, reports: m.size, gusts });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
