// Shared by v7's fetch, SYNOP reader and scorer (split out so the fetch can read the SYNOPs it just saved without a
// circular import).
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DATA as V2DATA } from '../v2/lib.mjs';

export const DATA = path.join(V2DATA, 'v7');
mkdirSync(DATA, { recursive: true });

/** Block-68 stations from the ISD list: id → {id, name, lat, lon, elev}. */
export function loadIsd() {
  const out = new Map();
  const file = path.join(DATA, 'isd-history.csv');
  if (!existsSync(file)) return out;
  for (const l of readFileSync(file, 'utf8').split('\n').slice(1)) {
    const c = l.split('","').map((x) => x.replace(/"/g, ''));
    if (c.length < 11) continue;
    const id = c[0].slice(0, 5), lat = Number(c[6]), lon = Number(c[7]), end = c[10];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
    const prev = out.get(id);
    if (!prev || end > prev.end) out.set(id, { id, name: c[2], ctry: c[3], lat, lon, elev: Number(c[8]), end });
  }
  return out;
}

