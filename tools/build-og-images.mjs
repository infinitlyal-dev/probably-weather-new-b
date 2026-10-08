#!/usr/bin/env node
// Build static per-condition OG share images (1200x630 JPEG, <300KB).
// Source: assets/images/bg/<condition>/week_1/day/1.webp → og/<condition>.jpg
// Run with: node tools/build-og-images.mjs
//           node tools/build-og-images.mjs --only partly-cloudy,breezy   (only those cards; the others keep their bytes)
//
// Why week_1/day/1.webp: matches the canonical OG source convention used by
// the /api/og dynamic renderer (see assets/weather-visuals.js getOgBackgroundPath).
// Sharp reads WebP natively; output remains JPEG because some share platforms
// still prefer it and the existing /og/<condition>.jpg URLs are referenced from
// middleware.js (Vercel Edge) without an extension switch.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 9-condition allowlist mapped to source folder for OG generation.
// Aliases: uv → clear, rain-possible → cloudy (copied after primaries are built).
const CONDITIONS = [
  { name: 'clear',          source: 'assets/images/bg/clear/week_1/day/1.webp' },
  { name: 'cloudy',         source: 'assets/images/bg/cloudy/week_1/day/1.webp' },
  { name: 'cold',           source: 'assets/images/bg/cold/week_1/day/1.webp' },
  { name: 'cold-clear',     source: 'assets/images/bg/cold-clear/week_1/day/1.webp' },
  { name: 'fog',            source: 'assets/images/bg/fog/week_1/day/1.webp' },
  { name: 'heat',           source: 'assets/images/bg/heat/week_1/day/1.webp' },
  { name: 'rain',           source: 'assets/images/bg/rain/week_1/day/1.webp' },
  { name: 'storm',          source: 'assets/images/bg/storm/week_1/day/1.webp' },
  { name: 'wind',           source: 'assets/images/bg/wind/week_1/day/1.webp' },
  // Al, 8 Oct 2026: their own cards since the 7 Oct sets gave them their own folders.
  // week_1/day/1 is Table Mountain (Al: no landmark on a countrywide picture); day/2 has the partly-cloudy sky and suits any day.
  { name: 'partly-cloudy',  source: 'assets/images/bg/partly-cloudy/week_1/day/2.webp' },
  { name: 'breezy',         source: 'assets/images/bg/breezy/week_1/day/1.webp' },
  { name: 'default',        source: 'assets/images/bg/clear/week_1/day/1.webp' },
];

const ALIASES = [
  { from: 'clear',  to: 'uv' },
  { from: 'cloudy', to: 'rain-possible' },
];

const TARGET_W = 1200;
const TARGET_H = 630;
const MAX_BYTES = 300 * 1024;

async function buildOne({ name, source }) {
  const inputPath = path.join(ROOT, source);
  const outPath = path.join(ROOT, 'og', `${name}.jpg`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  // Try descending quality until file is < MAX_BYTES.
  let quality = 82;
  let lastBuf = null;
  for (; quality >= 50; quality -= 6) {
    const buf = await sharp(inputPath)
      .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'attention' })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();
    lastBuf = buf;
    if (buf.length <= MAX_BYTES) break;
  }

  await fs.writeFile(outPath, lastBuf);
  return { name, bytes: lastBuf.length, quality };
}

async function copyAlias({ from, to }) {
  const src = path.join(ROOT, 'og', `${from}.jpg`);
  const dst = path.join(ROOT, 'og', `${to}.jpg`);
  await fs.copyFile(src, dst);
  const stat = await fs.stat(dst);
  return { name: to, bytes: stat.size, alias: from };
}

const onlyArg = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const ONLY = onlyArg ? new Set(onlyArg.split(',')) : null;

(async () => {
  const built = [];
  for (const c of CONDITIONS.filter((x) => !ONLY || ONLY.has(x.name))) {
    try {
      built.push(await buildOne(c));
    } catch (err) {
      console.error(`FAILED ${c.name}:`, err.message);
      process.exitCode = 1;
    }
  }
  for (const a of ALIASES.filter((x) => !ONLY || ONLY.has(x.to))) {
    try {
      built.push(await copyAlias(a));
    } catch (err) {
      console.error(`FAILED alias ${a.to}:`, err.message);
      process.exitCode = 1;
    }
  }
  for (const b of built) {
    const kb = (b.bytes / 1024).toFixed(1);
    const tag = b.alias ? `(alias of ${b.alias})` : `q=${b.quality}`;
    console.log(`${b.name.padEnd(16)} ${kb.padStart(7)} KB  ${tag}`);
  }
})();
