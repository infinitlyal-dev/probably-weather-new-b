// Reframe one library photograph whose faces no anchor can save (Al's ruling, 8 Oct 2026; review/crop-audit-2026-10-08.md).
// The same loop as the new sets: one generation per photograph per round, up to three rounds, judged against the same
// list (review/new-sets-qc-2026-10-08.md). Codex's image tool driven by gpt-5.6-sol — Al asked for GPT 6.1 Sol, which
// the ChatGPT login refuses.
//
//   node scripts/regen-library-photo.mjs <sha1-12> --round N [--note …] [--scene …] [--model gpt-5.6-sol] [--print]
//
// The scene comes from review/library-reframe-2026-10-08/scenes.json (the "seen" description the line writers made from
// the photograph, or one written from it on 8 Oct); --scene overrides it. Prompt: weekday and time slot, the scene, the
// folder's weather, the house tail, then Al's two sentences — the dry-ground sentence is left out for rain and storm,
// whose scene is wet by nature (the pass/fail list's "unless the scene says otherwise").
// Output: review/library-reframe-2026-10-08/<hash>.png (the current take, 1008x1792) and <hash>.r<N>-original.png (each
// raw take), one line per take in that folder's log.md. Nothing in assets/ changes here: scripts/ingest-library-reframes.mjs
// does that, by hash.
// --dir <folder under review/> writes the takes and the log line there instead (a later pass that must not touch the live takes,
// e.g. review/landmark-creep-2026-10-08). Each log line ends with Codex's own token count for the run.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexImage, finishTake, lastUsage, TAIL, DRY, HEAD, TIME } from './lib/codex-image.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const hash = args[0];
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const round = Number(arg('--round', '1'));
const model = arg('--model', 'gpt-5.6-sol');
const SCENES_DIR = path.join(root, 'review', 'library-reframe-2026-10-08');
const DIR = arg('--dir', null) ? path.join(root, 'review', arg('--dir', null)) : SCENES_DIR;
if (!/^[0-9a-f]{12}$/.test(hash || '')) throw new Error('usage: <sha1-12> --round N');

const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));
// after the reframes went in, a photograph is found by the hash it replaced (the scenes are keyed by that one)
const a = draft.assignments.find((x) => x.hash === hash) ?? draft.assignments.find((x) => x.replacedHash === hash);
if (!a) throw new Error(`${hash}: not in review/set-001-draft.json`);
const scenes = JSON.parse(readFileSync(path.join(SCENES_DIR, 'scenes.json'), 'utf8'));
const scene = arg('--scene', null) || scenes[hash]?.scene;
if (!scene) throw new Error(`${hash}: no scene in scenes.json`);

const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const WEATHER = {
  clear: 'Clear weather: a blue sky with no cloud or only a wisp; pleasant sun and real shadows.',
  cloudy: 'Overcast: a flat, even grey sky, soft shadowless light; no storm, no sunset colour, no rain.',
  cold: 'A cold day: a grey or pale sky, people in jerseys, jackets and beanies, hands in pockets.',
  'cold-clear': 'A cold, clear day: a crisp blue sky and low sun, people bundled up in jackets and beanies, breath visible early and late.',
  fog: 'Thick fog: everything past a short distance fades into soft grey.',
  heat: 'A hot day: hard bright sun, heat haze, people looking for shade, water and cold drinks.',
  rain: 'Steady rain is falling: wet streets and surfaces, umbrellas and raincoats.',
  storm: 'A thunderstorm: dark storm cloud, heavy rain or lightning, people sheltering; nothing broken.',
  wind: 'A strong, gusty wind: hair and clothes whipped sideways, trees bending, leaves or dust flying; people braced but fine; nothing broken or blown over.',
};
const wet = a.condition === 'rain' || a.condition === 'storm';
const note = arg('--note', "Every person's face sits between 40% and 55% of the frame height: none higher, none lower; the sky and the setting fill the top of the frame.");
const prompt = `${DAY[a.day]}, South Africa. ${TIME[a.time]} ${scene} The weather: ${WEATHER[a.condition]} ${note} ${TAIL} ${wet ? '' : DRY} ${HEAD}`.replace(/\s+/g, ' ').trim();
if (args.includes('--print')) { console.log(prompt); process.exit(0); }

mkdirSync(DIR, { recursive: true });
const raw = path.join(DIR, `${hash}.r${round}-original.png`);
if (existsSync(raw)) throw new Error(`${raw} exists already — that round was run`);
const t0 = Date.now();
const take = codexImage(prompt, { model, take: arg('--take', null) });
copyFileSync(take, raw);
const meta = await finishTake(take, path.join(DIR, `${hash}.png`));
const line = `- round ${round} | ${hash} | ${a.image} (${a.condition} ${a.time} ${a.day}) | Codex ${model} image tool | ${meta.width}x${meta.height} -> 1008x1792 | ${Math.round((Date.now() - t0) / 1000)} s | scene: ${scenes[hash]?.src || 'override'}${arg('--scene', null) ? ' (overridden)' : ''} | dry sentence: ${wet ? 'left out (rain/storm)' : 'yes'} | tokens: ${lastUsage.value ? `${lastUsage.value.input_tokens} in (${lastUsage.value.cached_input_tokens ?? 0} cached), ${lastUsage.value.output_tokens} out` : 'not reported'}\n`;
appendFileSync(path.join(DIR, 'log.md'), line);
console.log(line.trim());
