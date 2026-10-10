// What an exam result was earned on (10 Oct 2026, Sol's review): the gold set and the checker code. The October exam
// records a hash of each; scripts/lang-check/apply-hero-lines-provisional.mjs refuses to write a language's table when
// any of them has changed since, so a pass cannot outlive the set or checker that produced it. The back-translation
// cache is left out on purpose: drafting adds records to it after the exam, by design.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
export const EXAM_INPUTS = [
  'scripts/lang-check/gold-set.json',
  'scripts/lang-check/exam-2026-10.mjs',
  'scripts/lang-check/lib/checker.mjs',
  'scripts/lang-check/lib/checker-v2.mjs',
  'scripts/lang-check/lib/concord.mjs',
  'scripts/lang-check/lib/ngram-attest.mjs',
  'scripts/lang-check/lib/text.mjs',
  'scripts/lang-check/lib/exam-inputs.mjs', // this list itself: dropping a file from it also voids the pass
];

// The pass bar was set at this confidence threshold (the exam's default); a pass earned at another one does not count.
export const EXAM_THRESHOLD = 0.25;

// Line endings are normalised, so a Windows checkout and Linux hash the same file alike.
export function examInputHash(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
}

export const examInputs = () => Object.fromEntries(EXAM_INPUTS.map((f) => [f, examInputHash(f)]));
