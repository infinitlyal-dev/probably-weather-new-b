// The copy-bank drift gate, and the line-ending-tolerant comparison under it.
//
// assets/copy/<lang>.js is GENERATED with LF (generate-copy-splits.mjs joins
// on '\n') and STORED in the index with LF. But .gitattributes marks the tree
// `* text=auto`, so a Windows checkout with core.autocrlf=true writes those
// files into the WORKING TREE with CRLF — `git ls-files --eol assets/copy/en.js`
// reports `i/lf w/crlf`. A byte-exact comparison of the generated text against
// the working-tree text therefore reported all five banks stale on a clean
// Windows clone, while the same commit passed on Linux.
//
// That is a false failure, and a loud one: it fires on every Windows build and
// every Windows test run, which trains people to ignore the gate whose entire
// job is catching a real copy edit that skipped the generator. Normalise line
// endings on both sides: CRLF/LF differences are not drift, everything else
// still is.
//
// findStaleCopyBanks() is the gate scripts/build.mjs runs. It lives here, not
// inline in the build, so the real gate path is testable without executing the
// dist clean/copy — an inline compare in build.mjs could be restored without
// any test noticing.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LANGS, buildModuleSource } from './generate-copy-splits.mjs';

/** Collapse CRLF to LF so text can be compared independently of checkout style. */
export const normalizeEol = (text) => String(text).replace(/\r\n/g, '\n');

/**
 * Is the on-disk copy bank still what the generator would produce?
 *
 * @param {string|null|undefined} onDisk  working-tree contents, or null/undefined if the file is missing
 * @param {string} generated              buildModuleSource(lang) output
 * @returns {boolean} false when the bank is missing or genuinely drifted
 */
export function isCopyBankInSync(onDisk, generated) {
  if (typeof onDisk !== 'string') return false; // missing / unreadable → stale
  return normalizeEol(onDisk) === normalizeEol(generated);
}

/**
 * The build's copy-drift gate: which checked-in banks no longer match a fresh
 * regeneration? A missing bank counts as stale; a CRLF-vs-LF difference does not.
 *
 * @param {string} rootDir  repo root (banks are read from <rootDir>/assets/copy/)
 * @param {{langs?: string[], generate?: (lang: string) => string}} [options]
 * @returns {string[]} stale bank filenames, e.g. ['en.js'] — empty when in sync
 */
export function findStaleCopyBanks(rootDir, { langs = LANGS, generate = buildModuleSource } = {}) {
  const stale = [];
  for (const lang of langs) {
    const file = path.join(rootDir, 'assets', 'copy', `${lang}.js`);
    let onDisk = null;
    try { onDisk = readFileSync(file, 'utf8'); } catch { /* missing → stale */ }
    if (!isCopyBankInSync(onDisk, generate(lang))) stale.push(`${lang}.js`);
  }
  return stale;
}
