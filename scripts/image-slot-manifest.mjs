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

/** Scan the fixed 9 × 4 × 4 × 7 rotation and assign equal bytes one ID. */
export function scanBackgroundSlots(imageRoot) {
  const root = filesystemPath(imageRoot);
  const entries = [];
  const hashes = [];
  const slots = [];
  const hashIds = new Map();
  const canonicalSources = [];

  for (const folder of BG_IMAGE_SLOT_FOLDERS) {
    for (let week = 1; week <= 4; week++) {
      for (const time of BG_IMAGE_SLOT_TIMES) {
        for (let index = 1; index <= 7; index++) {
          const relativePath = `${folder}/week_${week}/${time}/${index}.webp`;
          const sourcePath = path.join(root, ...relativePath.split('/'));
          const bytes = readFileSync(sourcePath);
          const hash = createHash('sha256').update(bytes).digest('hex');
          let hashId = hashIds.get(hash);
          if (hashId === undefined) {
            hashId = hashes.length;
            hashIds.set(hash, hashId);
            hashes.push(hash);
            canonicalSources.push(sourcePath);
          }
          slots.push(hashId);
          entries.push({ relativePath, sourcePath, bytes: bytes.length, hash });
        }
      }
    }
  }

  return { entries, hashes, slots, canonicalSources };
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
          const sourcePath = path.join(root, folder, `week_${week}`, time, `${index}.webp`);
          const builtPath = path.join(output, ...canonicalPath.split('/'));
          if (!readFileSync(sourcePath).equals(readFileSync(builtPath))) {
            throw new Error(`P9 byte mismatch for ${folder}/week_${week}/${time}/${index}.webp`);
          }
          resolved.add(canonicalPath);
          checked++;
        }
      }
    }
  }

  if (checked !== 1008 || resolved.size !== 629) {
    throw new Error(`P9 resolution mismatch: ${checked}/1008 slots, ${resolved.size}/629 unique files`);
  }
  return { checked, uniqueFiles: resolved.size };
}
