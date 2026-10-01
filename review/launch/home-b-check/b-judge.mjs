// Home check, B (2026-09-25): my look at B's worst cases, written as I went down the sheets
// (data/b-verdicts.txt: "n|size|verdict|note|band" — band only where B's joke sits on a subject D's
// bands do not mark, as "top-bottom" px on that screen), joined to what was looked at
// (data/b-shots-list.json: the photograph, the line, the language) -> data/b-judged.json.
//
//   node review/launch/home-b-check/b-judge.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'review/launch/home-b-check';
const jobs = JSON.parse(readFileSync(`${OUT}/data/b-shots-list.json`, 'utf8'));
const SIZE = { 414: '414x715', 360: '360x688', 320: '320x488' };
const out = [];
const problems = [];
for (const raw of readFileSync(`${OUT}/data/b-verdicts.txt`, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [n, s, verdict, note, band] = line.split('|').map((x) => x.trim());
  const size = SIZE[s] || s;
  const job = jobs.find((j) => j.n === Number(n) && j.size === size);
  if (!job) { problems.push(`no shot listed for #${n} at ${size}`); continue; }
  if (!['covers', 'partly', 'clear'].includes(verdict)) { problems.push(`#${n}: verdict "${verdict}"`); continue; }
  if (out.some((o) => o.n === job.n && o.size === size)) { problems.push(`#${n} ${size} judged twice`); continue; }
  const e = { n: job.n, hash8: job.hash.slice(0, 8), size, looked: job.why, lang: job.lang, line: job.line, verdict, note };
  if (band) e.band = band.split('-').map(Number);
  out.push(e);
}
const missing = jobs.filter((j) => !out.some((o) => o.n === j.n && o.size === j.size)).map((j) => `#${j.n} ${j.size}`);
out.sort((a, b) => a.n - b.n || a.size.localeCompare(b.size));
writeFileSync(`${OUT}/data/b-judged.json`, JSON.stringify(out, null, 1));
const tally = out.reduce((m, o) => ((m[o.verdict] = (m[o.verdict] || 0) + 1), m), {});
console.log(`[b-judge] ${out.length} judgements ${JSON.stringify(tally)}; bands of mine ${out.filter((o) => o.band).length}; not yet judged ${missing.length}${missing.length ? `: ${missing.slice(0, 20).join(' ')}` : ''}; problems ${problems.length}${problems.length ? `: ${problems.join('; ')}` : ''}`);
