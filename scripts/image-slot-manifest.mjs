import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { BG_IMAGE_SLOT_FOLDERS, BG_IMAGE_SLOT_TIMES } from '../assets/image-picker.js';

const MANIFEST_MARKER = '/* __BG_IMAGE_SLOT_MANIFEST__ */ null';

function filesystemPath(value) {
  return value instanceof URL ? fileURLToPath(value) : path.resolve(value);
}

/** 294 curated photographs since 2026-09-06 (see verifyBackgroundImageArtifact). */
export const CURATED_BODIES = 294;

/**
 * Photographs benched by ruling (review/benched-photos.json): out of rotation
 * without moving a file. Returns a Set of sha256 hashes.
 */
export function loadBenchedHashes(file = new URL('../review/benched-photos.json', import.meta.url)) {
  const doc = JSON.parse(readFileSync(filesystemPath(file), 'utf8'));
  return new Set((doc.benched || []).map((b) => b.sha256));
}

/**
 * Scan the fixed 9 × 4 × 4 × 7 rotation and assign equal bytes one ID.
 *
 * A slot holding a benched photograph is served the picker's own week-collapse
 * fallback instead (same folder and time of day, week_1 slot 1 — step 2 of
 * buildPickerPaths), or the first unbenched slot of that folder and time after
 * it. `entry.servedPath` is the file the slot resolves to; it equals
 * `entry.sourcePath` everywhere except a benched slot.
 */
export function scanBackgroundSlots(imageRoot, { benched = loadBenchedHashes() } = {}) {
  const root = filesystemPath(imageRoot);
  const entries = [];
  const hashes = [];
  const slots = [];
  const hashIds = new Map();
  const canonicalSources = [];
  const hashOfFile = new Map();
  const fileHash = (p) => {
    if (!hashOfFile.has(p)) hashOfFile.set(p, createHash('sha256').update(readFileSync(p)).digest('hex'));
    return hashOfFile.get(p);
  };
  const slotFile = (folder, week, time, index) => path.join(root, folder, `week_${week}`, time, `${index}.webp`);

  for (const folder of BG_IMAGE_SLOT_FOLDERS) {
    for (let week = 1; week <= 4; week++) {
      for (const time of BG_IMAGE_SLOT_TIMES) {
        for (let index = 1; index <= 7; index++) {
          const relativePath = `${folder}/week_${week}/${time}/${index}.webp`;
          const sourcePath = path.join(root, ...relativePath.split('/'));
          const bytes = readFileSync(sourcePath);
          const sourceHash = fileHash(sourcePath);
          let servedPath = sourcePath;
          if (benched.has(sourceHash)) {
            servedPath = null;
            for (let w = 1; w <= 4 && !servedPath; w++) {
              for (let i = 1; i <= 7 && !servedPath; i++) {
                const candidate = slotFile(folder, w, time, i);
                if (!benched.has(fileHash(candidate))) servedPath = candidate;
              }
            }
            if (!servedPath) throw new Error(`P9 every ${folder}/${time} photograph is benched — nothing left to serve ${relativePath}`);
          }
          const hash = fileHash(servedPath);
          let hashId = hashIds.get(hash);
          if (hashId === undefined) {
            hashId = hashes.length;
            hashIds.set(hash, hashId);
            hashes.push(hash);
            canonicalSources.push(servedPath);
          }
          slots.push(hashId);
          entries.push({ relativePath, sourcePath, servedPath, benched: servedPath !== sourcePath, bytes: bytes.length, hash });
        }
      }
    }
  }

  return { entries, hashes, slots, canonicalSources, benched };
}

/** Emit one content-addressed WebP per unique body and embed the slot manifest. */
export function emitBackgroundImageArtifact({ sourceImageRoot, distRoot, pickerFile }) {
  const manifest = scanBackgroundSlots(sourceImageRoot);
  const canonicalDir = path.join(filesystemPath(distRoot), 'assets', 'images', 'bg-canonical');
  mkdirSync(canonicalDir, { recursive: true });

  for (let i = 0; i < manifest.hashes.length; i++) {
    copyFileSync(manifest.canonicalSources[i], path.join(canonicalDir, `${manifest.hashes[i]}.webp`));
  }

  const distBgRoot = path.join(filesystemPath(distRoot), 'assets', 'images', 'bg');
  for (const folder of BG_IMAGE_SLOT_FOLDERS) {
    rmSync(path.join(distBgRoot, folder), { recursive: true, force: true });
  }

  const runtimeManifest = JSON.stringify({ hashes: manifest.hashes, slots: manifest.slots });
  const pickerPath = filesystemPath(pickerFile);
  const pickerSource = readFileSync(pickerPath, 'utf8');
  if (!pickerSource.includes(MANIFEST_MARKER)) {
    throw new Error(`P9 manifest marker missing from ${pickerPath}`);
  }
  writeFileSync(pickerPath, pickerSource.replace(MANIFEST_MARKER, runtimeManifest), 'utf8');

  const originalBytes = manifest.entries.reduce((total, entry) => total + entry.bytes, 0);
  const uniqueBytes = manifest.canonicalSources.reduce((total, source) => total + statSync(source).size, 0);
  return {
    slots: manifest.entries.length,
    uniqueFiles: manifest.hashes.length,
    originalBytes,
    uniqueBytes,
    manifestBytes: Buffer.byteLength(runtimeManifest),
    manifestGzipBytes: gzipSync(runtimeManifest).length,
  };
}

/** Verify the built picker resolves every logical slot to identical bytes. */
export function verifyBackgroundImageArtifact({ sourceImageRoot, distRoot, picker }) {
  const root = filesystemPath(sourceImageRoot);
  const output = filesystemPath(distRoot);
  const resolved = new Set();
  let checked = 0;
  // What each slot SHOULD serve: its own file, or — for a benched photograph —
  // the fallback scanBackgroundSlots chose. Benched bytes must not resolve anywhere.
  const scan = scanBackgroundSlots(sourceImageRoot);
  const servedByRelative = new Map(scan.entries.map((e) => [e.relativePath, e.servedPath]));
  const benchedInTree = new Set(scan.entries.filter((e) => e.benched).map((e) => createHash('sha256').update(readFileSync(e.sourcePath)).digest('hex')));

  for (const folder of BG_IMAGE_SLOT_FOLDERS) {
    for (let week = 1; week <= 4; week++) {
      for (const time of BG_IMAGE_SLOT_TIMES) {
        for (let index = 1; index <= 7; index++) {
          const url = picker.buildPickerPaths(folder, 'clear', time, week, index)[0];
          if (!url.endsWith(`?v=${picker.BG_IMAGE_URL_VERSION}`)) {
            throw new Error(`P9 picker lost P1 URL versioning: ${url}`);
          }
          const canonicalPath = url.slice(0, url.indexOf('?'));
          if (!canonicalPath.startsWith('assets/images/bg-canonical/')) {
            throw new Error(`P9 slot did not resolve canonically: ${canonicalPath}`);
          }
          const relativePath = `${folder}/week_${week}/${time}/${index}.webp`;
          const sourcePath = servedByRelative.get(relativePath) ?? path.join(root, folder, `week_${week}`, time, `${index}.webp`);
          const builtPath = path.join(output, ...canonicalPath.split('/'));
          if (!readFileSync(sourcePath).equals(readFileSync(builtPath))) {
            throw new Error(`P9 byte mismatch for ${relativePath}`);
          }
          const builtHash = path.basename(canonicalPath, '.webp');
          if (benchedInTree.has(builtHash)) throw new Error(`P9 benched photograph still served at ${relativePath}`);
          resolved.add(canonicalPath);
          checked++;
        }
      }
    }
  }

  // 294, not the 644 this asserted until 2026-09-06. Al ruled that the app serves set-001
  // ONLY: the 350 uncurated photographs had no bespoke line written about them, so every slot
  // they held fell back to a condition-bank joke. Those slots now hold copies of curated
  // photographs from the same condition and time-of-day, which is why 1008 slots dedupe to
  // the 294 curated bodies. set-002 raises this number again as new curated photographs
  // replace the repeats — update it deliberately, and never to whatever the tree happens to
  // hold, or this stops being a check.
  // Minus one for each photograph benched by ruling (review/benched-photos.json).
  const expectedUnique = CURATED_BODIES - benchedInTree.size;
  if (checked !== 1008 || resolved.size !== expectedUnique) {
    throw new Error(`P9 resolution mismatch: ${checked}/1008 slots, ${resolved.size}/${expectedUnique} unique files (${CURATED_BODIES} curated − ${benchedInTree.size} benched)`);
  }
  return { checked, uniqueFiles: resolved.size };
}
