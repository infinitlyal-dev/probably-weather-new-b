// Append re-ruled M7 verdicts to review/m7-verdicts-2026-08-10.json.
//   node scripts/m7-record.mjs "clear-dawn 1:S 2:S 3:S 4:S 5:S 6:F55 7:S"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const file = 'review/m7-verdicts-2026-08-10.json';
const doc = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {
  ruledBy: 'Baken/Opus 5, 2026-08-10, by eye off output/m7-crop sheets',
  ruledAgainst: 'CURRENT geometry — worst box 320x488 -> 276.79x131.47 (aspect 2.105), reference 390x844 -> 356.44x366.09, background-position 50% 78%',
  supersedes: 'review/m7-verdicts.json, ruled 2026-08-09 against 739x850 -> 643x216.75 (aspect 2.97) — a box no device in the matrix shows any more',
  note: 'Keys are bucket#position, matching the numbered cells on the sheets. Never joined by hash. S=SURVIVES, F=FIXABLE with anchorY, X=FAILS with a cause.',
  verdicts: {},
};
for (const arg of process.argv.slice(2)) {
  const [bucket, ...cells] = arg.trim().split(/\s+/);
  for (const c of cells) {
    const [pos, code] = c.split(':');
    const key = `${bucket}#${pos}`;
    if (code === 'S') doc.verdicts[key] = { verdict: 'SURVIVES' };
    else if (code.startsWith('F')) doc.verdicts[key] = { verdict: 'FIXABLE', anchorY: Number(code.slice(1)) };
    else if (code.startsWith('X')) doc.verdicts[key] = { verdict: 'FAILS', cause: code.slice(1).replace(/_/g, ' ') };
    else throw new Error(`bad code ${c}`);
  }
}
writeFileSync(file, `${JSON.stringify(doc, null, 1)}\n`);
const v = Object.values(doc.verdicts);
console.log(`${Object.keys(doc.verdicts).length} cells recorded — S:${v.filter((x) => x.verdict === 'SURVIVES').length} F:${v.filter((x) => x.verdict === 'FIXABLE').length} X:${v.filter((x) => x.verdict === 'FAILS').length}`);
