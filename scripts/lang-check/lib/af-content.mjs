// Content an Afrikaans transcreation adds that its English line does not have: a day the English
// does not name, a braai the English does not have (review/af-voice.md anti-pattern 4 — braai
// plans are weekend-only, so a transcreation must never introduce one), and the brand hedge left
// in English. Shared by the gate (scripts/lang-check/apply-af-accepted.mjs) and the tests that
// check the wired table (tests/bespoke-line-af.test.js).

const DAYS = [
  ['Monday', /^mondays?$/, /^maanda[ge]/], ['Tuesday', /^tuesdays?$/, /^dinsda[ge]/],
  ['Wednesday', /^wednesdays?$/, /^woensda[ge]/], ['Thursday', /^thursdays?$/, /^donderda[ge]/],
  ['Friday', /^fridays?$/, /^vryda[ge]/], ['Saturday', /^saturdays?$/, /^saterda[ge]/],
  ['Sunday', /^sundays?$/, /^sonda[ge]/], ['the weekend', /^weekends?$/, /^nawe(ek|ke)/],
];
const words = (s) => (s.toLowerCase().match(/\p{L}+/gu) || []);

/**
 * @param {string} english
 * @param {string} afrikaans
 * @returns {string[]} one message per problem; empty when the Afrikaans adds nothing
 */
export function contentProblems(english, afrikaans) {
  const en = words(english);
  const af = words(afrikaans);
  const problems = [];
  for (const [name, enRe, afRe] of DAYS) {
    if (af.some((w) => afRe.test(w)) && !en.some((w) => enRe.test(w))) problems.push(`names ${name}, which the English does not`);
  }
  if (/braai/i.test(afrikaans) && !/braai/i.test(english)) problems.push('adds a braai the English does not have');
  if (/\bprobably\b/i.test(afrikaans)) problems.push('leaves "Probably" in English (the brand hedge is Waarskynlik)');
  return problems;
}
