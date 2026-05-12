#!/usr/bin/env node
// Build static per-condition OG share images (1200x630 JPEG, <300KB).
// Source: assets/images/bg/<condition>/day_1.jpg → og/<condition>.jpg
// Run with: node tools/build-og-images.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 9-condition allowlist mapped to source folder for OG generation.
// Aliases: uv → clear, rain-possible → cloudy (copied after primaries are built).
const CONDITIONS = [
  { name: 'clear',          source: 'assets/images/bg/clear/day_1.jpg' },
  { name: 'cloudy',         source: 'assets/images/bg/cloudy/day_1.jpg' },
  { name: 'cold',           source: 'assets/images/bg/cold/day_1.jpg' },
  { name: 'fog',            source: 'assets/images/bg/fog/day_1.jpg' },
  { name: 'heat',           source: 'assets/images/bg/heat/day_1.jpg' },
  { name: 'rain',           source: 'assets/images/bg/rain/day_1.jpg' },
  { name: 'storm',          source: 'assets/images/bg/storm/day_1.jpg' },
  { name: 'wind',           source: 'assets/images/bg/wind/day_1.jpg' },
  { name: 'default',        source: 'assets/images/bg/clear/day_1.jpg' },
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

(async () => {
  const built = [];
  for (const c of CONDITIONS) {
    try {
      built.push(await buildOne(c));
    } catch (err) {
      console.error(`FAILED ${c.name}:`, err.message);
      process.exitCode = 1;
    }
  }
  for (const a of ALIASES) {
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
