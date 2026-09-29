// The towns (PLAN §2): every GeoNames populated place in South Africa (PPL, PPLA–PPLA4, PPLC, PPLX) with ≥ 1,000
// people, plus every populated place of any size within 30 km of a scored station. Ground height is GeoNames' own
// (SRTM, column 17).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA as V7DATA } from '../v7/common.mjs';
import { kmBetween } from './geo.mjs';
import { inSouthAfrica } from '../../../api/_lib/precision.js';

const CODES = new Set(['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLX']);
export function loadTowns(stations) {
  const rows = readFileSync(path.join(V7DATA, 'ZA.txt'), 'utf8').split('\n').map((l) => l.split('\t'))
    .filter((c) => c[6] === 'P' && CODES.has(c[7]))
    .map((c) => ({ gid: c[0], name: c[1], lat: Number(c[4]), lon: Number(c[5]), code: c[7], pop: Number(c[14]) || 0, dem: Number(c[16]) }))
    .filter((t) => inSouthAfrica(t.lat, t.lon));
  return rows.filter((t) => (t.pop >= 1000 && t.code !== 'PPLX') || t.pop >= 1000 || stations.some((s) => kmBetween(t.lat, t.lon, s.lat, s.lon) <= 30));
}
