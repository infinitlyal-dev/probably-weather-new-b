// Regenerate one photograph of the 7 Oct sets through Codex (Al, 8 Oct 2026: the quality loop is Claude's; one generation
// per fail per round, up to three rounds). The prompt is the brief's own scene for that filename
// (review/image-brief-2026-10-07.md), the two sentences Al added, and the brief's verbatim tail.
//
//   node scripts/regen-new-set-photo.mjs breezy/day-2.png --round 1 [--model gpt-6-astra]
//
// Codex (logged in with ChatGPT) makes the image with its built-in image tool; the PNG lands in
// ~/.codex/generated_images/<thread>/. The take is centre-cropped to 9:16 and resized to 1008x1792 (Lanczos, as
// finish_image.py does), the photograph it replaces is kept beside it as <name>.before-qc-r<round>.png, the raw take as
// <name>.qc-r<round>-original.png, and log.md gets one line. The filename keeps its line (Maat's file is keyed by it).
import { copyFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexImage, finishTake, DRY, HEAD, TIME } from './lib/codex-image.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const file = args[0];
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const round = Number(arg('--round', '1'));
const model = arg('--model', 'gpt-6-astra');
const SRC = path.join(root, 'review', 'new-sets-2026-10-07');
if (!/^(partly-cloudy|breezy|cloudy)\/(dawn|day|dusk|night)-[1-7](-weekB)?\.png$/.test(file || '')) throw new Error('usage: <set>/<time>-<n>.png --round N');

const brief = readFileSync(path.join(root, 'review', 'image-brief-2026-10-07.md'), 'utf8');
const esc = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const m = new RegExp(`\\*\\*${esc} · ([^*]+)\\*\\*\\n([\\s\\S]*?)(?:\\n\\n|\\n###|$)`).exec(brief);
if (!m) throw new Error(`${file}: not found in the brief`);
const heading = m[1].trim();
// --scene replaces the brief's scene (Al's ruling for breezy/dusk-5, 8 Oct 2026); the heading stays.
const scene = arg('--scene', null) || m[2].replace(/\s*\n\s*/g, ' ').trim();
const set = file.split('/')[0];
const setRule = /\*\*(PARTLY CLOUDY|BREEZY|CLOUDY \(replacements\))\*\* — ([\s\S]*?)\n\n/g;
const rules = {};
for (const r of brief.matchAll(setRule)) rules[r[1].startsWith('PARTLY') ? 'partly-cloudy' : r[1].startsWith('BREEZY') ? 'breezy' : 'cloudy'] = r[2].replace(/\s*\n\s*/g, ' ').trim();
const tail = /> Documentary photograph[\s\S]*?uncluttered\./.exec(brief)[0].replace(/\n> /g, ' ').replace(/^> /, '');
const extra = arg('--note', '');
// The brief's time slots are said outright (TIME): the heading names only the weekday.
const time = file.split('/')[1].split('-')[0];
// The two sentences Al added go LAST, after the tail: the tail asks for "damp patches" on surfaces, and the dry ground
// has to be the final word.
// Breezy's set rule is a catalogue of cues (flags, kites, washing, wind-pumps…); handed over whole, the model put all of
// them in every frame. The scene already names its own light things, so breezy gets the rule's limits only.
if (rules.breezy) rules.breezy = 'A steady, pleasant breeze, visible only in the light things this scene names; people relaxed, not braced; nothing torn, lost or inverted; clear or partly cloudy sky. Not a gale: no hats flying, no umbrellas inside out, no leaning into it. Add no flags, kites or wind-pumps the scene does not name.';
const prompt = `${heading}. ${TIME[time]} ${scene} ${rules[set] ? `The sky and weather: ${rules[set]}` : ''} ${extra} ${tail} ${DRY} ${HEAD}`.replace(/\s+/g, ' ').trim();

if (args.includes('--print')) { console.log(prompt); process.exit(0); }

const t0 = Date.now();
// --take <png>: finish a take Codex already made (a run that stopped after the image), without generating again.
const take = codexImage(prompt, { model, take: arg('--take', null) });
const dest = path.join(SRC, file);
const stem = dest.replace(/\.png$/, '');
const backup = `${stem}.before-qc-r${round}.png`;
if (existsSync(backup)) throw new Error(`${backup} exists already — that round was run`);
copyFileSync(dest, backup);
copyFileSync(take, `${stem}.qc-r${round}-original.png`);
const meta = await finishTake(take, dest);
const line = `- QC round ${round} (Vonk, 8 Oct 2026) | ${file} | Codex ${model} image tool (GPT Image; version not exposed) | ${meta.width}x${meta.height} -> 1008x1792 centre crop, Lanczos | replaced photo kept as ${path.basename(backup)}, raw take ${path.basename(stem)}.qc-r${round}-original.png | ${Math.round((Date.now() - t0) / 1000)} s | prompt: brief scene + set rule + "${DRY}" + "${HEAD}"${extra ? ` + "${extra}"` : ''} + verbatim tail\n`;
appendFileSync(path.join(SRC, 'log.md'), line);
console.log(line.trim());
