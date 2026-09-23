// Every English line that has ever sat at each condition-bank index (2026-09-23).
//
// A zu/xh/st line in the bank is keyed to its English by INDEX. When the English list of a
// bin was rewritten or re-ordered and the translations were not redone, a translation can
// be faithful to an English line that is no longer there: "translated from an out-of-date
// English list". This walks every commit that touched assets/weather-copy.js and records,
// per namespace/bin/index, each English line it held and the commits it held it in, so a
// back-translation can be compared with the current English AND the old ones.
//
//   node scripts/translation-skills/en-history.mjs   -> output/translation-skills/en-history.json
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const outDir = path.join(root, 'output', 'translation-skills');
const tmp = path.join(outDir, 'tmp-history');
mkdirSync(tmp, { recursive: true });

const commits = git('log', '--format=%h %ad', '--date=short', '--', 'assets/weather-copy.js').trim().split('\n').map((l) => { const [h, d] = l.split(' '); return { h, d }; }).reverse();
const history = {};   // "ns:bin#i" -> [{ en, from, to, commits }]
for (const { h, d } of commits) {
  let src;
  try { src = git('show', `${h}:assets/weather-copy.js`); } catch { continue; }
  // The module re-exports from a sibling file; only WEATHER_COPY is wanted here.
  src = src.replace(/^export \{[^}]*\} from '[^']*';\s*$/gm, '');
  const f = path.join(tmp, `${h}.mjs`);
  writeFileSync(f, src);
  let W;
  try { W = (await import(pathToFileURL(f).href)).WEATHER_COPY; } catch (e) { console.error(`${h}: ${e.message.slice(0, 80)}`); continue; }
  for (const ns of Object.keys(W || {})) {
    if (!/^witty/.test(ns)) continue;
    for (const [bin, langs] of Object.entries(W[ns] || {})) {
      (Array.isArray(langs?.en) ? langs.en : []).forEach((en, i) => {
        const key = `${ns}:${bin}#${i}`;
        const list = (history[key] ||= []);
        const last = list[list.length - 1];
        if (last && last.en === en) { last.to = d; last.commits.push(h); }
        else list.push({ en, from: d, to: d, commits: [h] });
      });
    }
  }
}
rmSync(tmp, { recursive: true, force: true });
const changed = Object.entries(history).filter(([, v]) => v.length > 1).length;
writeFileSync(path.join(outDir, 'en-history.json'), JSON.stringify({ commits: commits.length, generated: new Date().toISOString().slice(0, 10), history }, null, 1));
console.log(`[en-history] ${commits.length} commits, ${Object.keys(history).length} bank indices, ${changed} of them held more than one English line over time`);
