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

/** 300 curated photographs since 2026-09-25 (the pilot pairs; see verifyBackgroundImageArtifact). */
export const CURATED_BODIES = 300;

/**
 * Photographs benched by ruling (review/benched-photos.json): out of rotation
 * without moving a file.
 *
 * An entry with `slots` is benched from THOSE slots only (2026-09-23). That is what
 * a move needs: the photograph leaves its old bucket and is served in its new one,
 * so benching it by hash everywhere would bench it in its new home too. An entry
 * with no `slots` is benched wherever its bytes are. `fallback` names the slot served
 * instead; without one it is the picker's week-collapse fallback (below).
 */
export function loadBench(file = new URL('../review/benched-photos.json', import.meta.url)) {
  const doc = JSON.parse(readFileSync(filesystemPath(file), 'utf8'));
  const entries = doc.benched || [];
  const bySlot = new Map();       // relativePath -> { sha256, fallback }
  const everywhere = new Set();   // sha256
  for (const b of entries) {
    if (Array.isArray(b.slots) && b.slots.length) {
      for (const s of b.slots) bySlot.set(s, { sha256: b.sha256, fallback: b.fallback || null });
    } else everywhere.add(b.sha256);
  }
  return { entries, bySlot, everywhere };
}

/** The sha256 of every photograph with a bench entry (benched somewhere, maybe not everywhere). */
export function loadBenchedHashes(file) {
  return new Set(loadBench(file).entries.map((b) => b.sha256));
}

/**
 * Scan the fixed 9 × 4 × 4 × 7 rotation and assign equal bytes one ID.
 *
 * A benched slot is served its entry's `fallback` slot, or else the picker's own
 * week-collapse fallback (same folder and time of day, week_1 slot 1 — step 2 of
 * buildPickerPaths), or the first unbenched slot of that folder and time after it.
 * `entry.servedPath` is the file the slot resolves to; it equals `entry.sourcePath`
 * everywhere except a benched slot. `servedNowhere` holds the photographs in the
 * tree that no slot serves.
 */
export function scanBackgroundSlots(imageRoot, { bench = loadBench() } = {}) {
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
  const relOf = (folder, week, time, index) => `${folder}/week_${week}/${time}/${index}.webp`;
  // A slot is benched when its bytes are benched everywhere, or when a slot-scoped
  // entry names it. An entry naming a slot that now holds OTHER bytes is refused:
  // the ruling was about a photograph that is no longer there.
  const isBenched = (rel, sha256) => {
    if (bench.everywhere.has(sha256)) return true;
    const rule = bench.bySlot.get(rel);
    if (!rule) return false;
    if (rule.sha256 !== sha256) throw new Error(`P9 bench entry for ${rel} names ${rule.sha256.slice(0, 12)} but the slot holds ${sha256.slice(0, 12)} — re-rule it`);
    return true;
  };

  for (const folder of BG_IMAGE_SLOT_FOLDERS) {
    for (let week = 1; week <= 4; week++) {
      for (const time of BG_IMAGE_SLOT_TIMES) {
        for (let index = 1; index <= 7; index++) {
          const relativePath = relOf(folder, week, time, index);
          const sourcePath = path.join(root, ...relativePath.split('/'));
          const bytes = readFileSync(sourcePath);
          const sourceHash = fileHash(sourcePath);
          let servedPath = sourcePath;
          if (isBenched(relativePath, sourceHash)) {
            servedPath = null;
            const named = bench.bySlot.get(relativePath)?.fallback;
            if (named) {
              const m = /^([a-z-]+)\/week_[1-4]\/([a-z]+)\/[1-7]\.webp$/.exec(named);
              if (!m) throw new Error(`P9 fallback ${named} for ${relativePath} is not a slot path`);
              if (m[1] !== folder || m[2] !== time) throw new Error(`P9 fallback ${named} for ${relativePath} is not the same folder and time of day`);
              const candidate = path.join(root, ...named.split('/'));
              if (isBenched(named, fileHash(candidate))) throw new Error(`P9 fallback ${named} for ${relativePath} is itself benched`);
              servedPath = candidate;
            }
            for (let w = 1; w <= 4 && !servedPath; w++) {
              for (let i = 1; i <= 7 && !servedPath; i++) {
                const candidate = slotFile(folder, w, time, i);
                if (!isBenched(relOf(folder, w, time, i), fileHash(candidate))) servedPath = candidate;
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
          entries.push({ relativePath, sourcePath, servedPath, benched: servedPath !== sourcePath, bytes: bytes.length, hash, sourceHash });
        }
      }
    }
  }

  const served = new Set(hashes);
  const servedNowhere = new Set(entries.map((e) => e.sourceHash).filter((h) => !served.has(h)));
  return { entries, hashes, slots, canonicalSources, servedNowhere, benched: new Set(bench.entries.map((b) => b.sha256)) };
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
  // What each slot SHOULD serve: its own file, or — for a benched slot — the
  // fallback scanBackgroundSlots chose. A benched slot must never resolve to the
  // photograph it was benched from (that photograph may still be served in the
  // slots it moved to).
  const scan = scanBackgroundSlots(sourceImageRoot);
  const servedByRelative = new Map(scan.entries.map((e) => [e.relativePath, e.servedPath]));
  const benchedFrom = new Map(scan.entries.filter((e) => e.benched).map((e) => [e.relativePath, e.sourceHash]));

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
          if (benchedFrom.get(relativePath) === builtHash) throw new Error(`P9 benched photograph still served at ${relativePath}`);
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
  // Minus one for each photograph the bench leaves served nowhere
  // (review/benched-photos.json). A moved photograph is benched from its old slots
  // and still served in its new ones, so it is not subtracted.
  const expectedUnique = CURATED_BODIES - scan.servedNowhere.size;
  if (checked !== 1008 || resolved.size !== expectedUnique) {
    throw new Error(`P9 resolution mismatch: ${checked}/1008 slots, ${resolved.size}/${expectedUnique} unique files (${CURATED_BODIES} curated − ${scan.servedNowhere.size} served nowhere)`);
  }
  return { checked, uniqueFiles: resolved.size };
}
