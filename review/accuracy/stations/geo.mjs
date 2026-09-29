// Geometry for the stations plan (PLAN §2), no weather in it: every station's and town's exposure (coastal = the point
// or any of 24 points at 3, 6, 10 km in 8 directions is sea, ground ≤ 0 m) and the highest ground on the straight line
// between two points (sampled every 500 m). Ground heights: AWS Terrain Tiles (Tilezen "terrarium", zoom 10, ~125 m a
// pixel at SA's latitudes; open data, sea carries bathymetry so it reads below 0 m). Tiles are cached on disk; the
// Open-Meteo elevation API was the plan's first choice but would have needed ~760,000 points, far past its free tier.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DATA as V2DATA } from '../v2/lib.mjs';

export const DATA = path.join(V2DATA, 'stations');
const TILES = path.join(DATA, 'terrarium10');
mkdirSync(TILES, { recursive: true });
const Z = 10, N = 2 ** Z;
const tiles = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const kmBetween = (aLat, aLon, bLat, bLon) => {
  const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLon = (bLon - aLon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const offset = (lat, lon, km, brgDeg) => {
  const b = (brgDeg * Math.PI) / 180;
  return [lat + (km * Math.cos(b)) / 111.2, lon + (km * Math.sin(b)) / (111.2 * Math.cos((lat * Math.PI) / 180))];
};
const pix = (lat, lon) => {
  const x = ((lon + 180) / 360) * N, r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N;
  return { tx: Math.floor(x), ty: Math.floor(y), px: Math.min(255, Math.floor((x % 1) * 256)), py: Math.min(255, Math.floor((y % 1) * 256)) };
};

async function loadTile(tx, ty) {
  const k = `${tx}_${ty}`;
  if (tiles.has(k)) return tiles.get(k);
  const file = path.join(TILES, `${k}.png`);
  if (!existsSync(file)) {
    for (let tr = 1; tr <= 4; tr++) {
      try {
        const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`, { signal: AbortSignal.timeout(60_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        break;
      } catch (e) { console.error(`tile ${k}: ${e.message} (try ${tr})`); await sleep(5_000 * tr); }
    }
  }
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const h = new Float32Array(256 * 256);
  for (let i = 0; i < h.length; i++) { const o = i * info.channels; h[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768; }
  tiles.set(k, h);
  return h;
}
/** Load every tile the given points fall on (call before the synchronous readers below). */
export async function ensure(points) {
  const need = new Set(points.map(([a, b]) => { const p = pix(a, b); return `${p.tx}_${p.ty}`; }));
  for (const k of need) { const [tx, ty] = k.split('_').map(Number); await loadTile(tx, ty); }
}
/** As ensure, `n` downloads at a time (first run). */
export async function ensureParallel(points, n = 6) {
  const need = [...new Set(points.map(([a, b]) => { const p = pix(a, b); return `${p.tx}_${p.ty}`; }))];
  console.log(`tiles needed: ${need.length}`);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < need.length) { const [tx, ty] = need[i++].split('_').map(Number); await loadTile(tx, ty); } }));
}
export const groundAt =(lat, lon) => { const p = pix(lat, lon), h = tiles.get(`${p.tx}_${p.ty}`); return h ? h[p.py * 256 + p.px] : undefined; };

export const coastPoints = (lat, lon) => {
  const pts = [[lat, lon]];
  for (const d of [3, 6, 10]) for (let b = 0; b < 360; b += 45) pts.push(offset(lat, lon, d, b));
  return pts;
};
/** true = coastal (some sample is sea), false = inland, null = a tile is not loaded. */
export function isCoastal(lat, lon) {
  const v = coastPoints(lat, lon).map(([a, b]) => groundAt(a, b));
  return v.some((x) => x === undefined) ? null : v.some((x) => x <= 0);
}
export const linePoints = (aLat, aLon, bLat, bLon) => {
  const n = Math.max(1, Math.ceil(kmBetween(aLat, aLon, bLat, bLon) / 0.5));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([aLat + ((bLat - aLat) * i) / n, aLon + ((bLon - aLon) * i) / n]);
  return pts;
};
/** Highest ground on the line (m), or null if a tile is not loaded. */
export function ridgeOnLine(aLat, aLon, bLat, bLon) {
  const v = linePoints(aLat, aLon, bLat, bLon).map(([a, b]) => groundAt(a, b));
  return v.some((x) => x === undefined) ? null : Math.max(...v);
}
