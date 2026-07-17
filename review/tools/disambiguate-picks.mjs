// STEP 1 — candidate disambiguation for meme batch 2.
//
// Side mapping is VERIFIED, not assumed: build-full-contact-sheet.mjs renders
// `.imgs{display:grid;grid-template-columns:1fr 1fr}` and appends candidates via
// ['a','b'].forEach(...) in document order. LTR grid => a = LEFT, b = RIGHT.
//
// Outputs:
//   review/image-picks.json      chosen/spare per YES concept
//   review/spares-manifest.json  banked spares (kept for future week-depth)
//   review/reroll-bench.json     NO concepts with verbatim reasons + original prompt

import fs from 'node:fs';

const RULINGS = 'review/meme-batch-2-image-rulings.json';
const PROMPTS = 'review/tools/meme-batch-2-prompts.json';

const rulings = JSON.parse(fs.readFileSync(RULINGS, 'utf8')).rulings;
const prompts = JSON.parse(fs.readFileSync(PROMPTS, 'utf8'));
const promptById = new Map(prompts.map((p) => [p.id, p]));

// Al's direct rulings on the two items the contact sheet could not resolve
// (2026-07-17, verbatim). These override the exported file. Al's word is final.
//
// NOTE on cold-clear-night-2: the exported comment reads "Yes to image on the left",
// but Al ruled "i meant yes and use image on the right". The spoken ruling wins and the
// divergence is recorded here rather than silently applied.
const AL_OVERRIDES = {
  'cold-clear-night-2': {
    verdict: 'YES', chosen: 'b',
    basis: 'al-ruling-2026-07-17',
    al_said: 'i meant yes and use image on the right.',
    diverges_from_comment: 'exported comment said "Yes to image on the left" — Al ruled RIGHT',
  },
  'rain-dawn-4': {
    verdict: 'NO',
    basis: 'al-ruling-2026-07-17',
    al_said: 'its a no on both, sorry my mistake.',
  },
};

// Side-naming vocabulary. Al writes English with typos ("teh", "imnage", "left ahnd").
// We only ever read the side attached to the AFFIRMATIVE clause.
const LEFT = /\b(left|links|linker|eerste)\b/i;
const RIGHT = /\b(right|regs|regter|tweede)\b/i;

// Given a comment, find which side the YES attaches to.
// Strategy: split on the first "no"/"nee" boundary; the affirmative clause is the head.
function sideOfYes(comment) {
  const c = comment.replace(/\bteh\b/gi, 'the').replace(/\bahnd\b/gi, 'hand');
  // Affirmative head = text before the first negative marker.
  const negIdx = c.search(/\b(no|nee|not)\b/i);
  const head = negIdx === -1 ? c : c.slice(0, negIdx);
  const headLeft = LEFT.test(head);
  const headRight = RIGHT.test(head);
  if (headLeft && !headRight) return 'a';
  if (headRight && !headLeft) return 'b';
  return null; // unclear -> ambiguous, Al decides
}

const picks = [];
const spares = [];
const ambiguous = [];
const conflicts = [];
const bench = [];

for (const r of rulings) {
  const comment = (r.comment || '').trim();
  const meta = promptById.get(r.id);
  const dir = r.dir;

  // Al's direct rulings take precedence over the exported verdict/comment.
  const ov = AL_OVERRIDES[r.id];
  if (ov) {
    if (ov.verdict === 'YES') {
      const spare = ov.chosen === 'a' ? 'b' : 'a';
      picks.push({ id: r.id, condition: r.condition, bin: r.bin, dir, chosen: ov.chosen, spare: null,
        basis: ov.basis, al_said: ov.al_said, diverges_from_comment: ov.diverges_from_comment || null });
    } else {
      bench.push({ id: r.id, condition: r.condition, bin: r.bin,
        reason: ov.al_said, prompt: meta ? meta.prompt : null,
        flagged_casting_drift: r.flagged_casting_drift === true, basis: ov.basis });
    }
    continue;
  }

  if (r.verdict === 'YES') {
    if (!comment) {
      // No comment => default chosen = a, spare = b. Spare is banked, not discarded.
      picks.push({ id: r.id, condition: r.condition, bin: r.bin, dir, chosen: 'a', spare: 'b', basis: 'no-comment-default' });
      spares.push({ id: r.id, condition: r.condition, bin: r.bin, dir, candidate: 'b', reason: 'unchosen half of no-comment default' });
      continue;
    }
    const side = sideOfYes(comment);
    if (side === null) {
      ambiguous.push({ id: r.id, condition: r.condition, bin: r.bin, dir, comment });
      continue;
    }
    const spare = side === 'a' ? 'b' : 'a';
    // If the comment explicitly rejects the other side, it is NOT a bankable spare.
    const rejectsOther = /\bno\b|\bnee\b/i.test(comment);
    picks.push({ id: r.id, condition: r.condition, bin: r.bin, dir, chosen: side, spare: rejectsOther ? null : spare, basis: 'comment-named-side' });
    if (!rejectsOther) {
      spares.push({ id: r.id, condition: r.condition, bin: r.bin, dir, candidate: spare, reason: 'unchosen half, not explicitly rejected' });
    }
    continue;
  }

  // verdict === 'NO'
  // Guard: a NO whose comment reads as an affirmative pick is a contradiction.
  // Never silently reroll something Al may have meant to keep.
  if (comment && /\byes\b/i.test(comment) && sideOfYes(comment) !== null) {
    conflicts.push({ id: r.id, condition: r.condition, bin: r.bin, dir, verdict: r.verdict, comment,
      note: 'verdict=NO but comment names an affirmative pick — Al must resolve' });
    continue;
  }

  bench.push({
    id: r.id,
    condition: r.condition,
    bin: r.bin,
    reason: comment || '(no reason given)',
    prompt: meta ? meta.prompt : null,
    flagged_casting_drift: r.flagged_casting_drift === true,
  });
}

const chosenA = picks.filter((p) => p.chosen === 'a');
const chosenB = picks.filter((p) => p.chosen === 'b');
const both = picks.filter((p) => p.basis === 'no-comment-default');

fs.writeFileSync('review/image-picks.json', JSON.stringify({
  generated_from: RULINGS,
  side_mapping: 'a=LEFT, b=RIGHT (verified against review/tools/build-full-contact-sheet.mjs)',
  totals: { picks: picks.length, chosen_a: chosenA.length, chosen_b: chosenB.length, ambiguous: ambiguous.length, conflicts: conflicts.length },
  picks, ambiguous, conflicts,
}, null, 2));

fs.writeFileSync('review/spares-manifest.json', JSON.stringify({
  note: 'Banked unchosen candidates for future week-depth. Not wired, not deleted.',
  count: spares.length, spares,
}, null, 2));

fs.writeFileSync('review/reroll-bench.json', JSON.stringify({
  note: 'NO verdicts with verbatim reasons. DO NOT regenerate in this session.',
  count: bench.length, bench,
}, null, 2));

console.log('picks:', picks.length, '| chosen a:', chosenA.length, '| chosen b:', chosenB.length);
console.log('  of which no-comment default (a, both work):', both.length);
console.log('  comment-named-side:', picks.length - both.length);
console.log('ambiguous (Al decides):', ambiguous.length, ambiguous.map((x) => x.id).join(', '));
console.log('conflicts (Al resolves):', conflicts.length, conflicts.map((x) => x.id).join(', '));
console.log('spares banked:', spares.length);
console.log('reroll bench:', bench.length, '| casting-drift flagged among them:', bench.filter((b) => b.flagged_casting_drift).length);
