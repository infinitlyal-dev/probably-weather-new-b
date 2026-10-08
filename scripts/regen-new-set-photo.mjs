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
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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
const DRY = 'The ground is completely dry: dull matte tarmac and paving, no puddles, no wet reflections; it has not rained.';
const HEAD = "The main subject's head sits between 40% and 62% of the frame height.";
const extra = arg('--note', '');
// The brief's time slots, said outright (the heading names only the weekday).
const TIME = { dawn: 'Dawn: the first 75 minutes after sunrise.', day: 'Daytime.', dusk: 'Dusk: the hour around sunset.', night: 'Night: full dark, with its own light source in frame.' };
const time = file.split('/')[1].split('-')[0];
// The two sentences Al added go LAST, after the tail: the tail asks for "damp patches" on surfaces, and the dry ground
// has to be the final word.
// Breezy's set rule is a catalogue of cues (flags, kites, washing, wind-pumps…); handed over whole, the model put all of
// them in every frame. The scene already names its own light things, so breezy gets the rule's limits only.
if (rules.breezy) rules.breezy = 'A steady, pleasant breeze, visible only in the light things this scene names; people relaxed, not braced; nothing torn, lost or inverted; clear or partly cloudy sky. Not a gale: no hats flying, no umbrellas inside out, no leaning into it. Add no flags, kites or wind-pumps the scene does not name.';
const prompt = `${heading}. ${TIME[time]} ${scene} ${rules[set] ? `The sky and weather: ${rules[set]}` : ''} ${extra} ${tail} ${DRY} ${HEAD}`.replace(/\s+/g, ' ').trim();

if (args.includes('--print')) { console.log(prompt); process.exit(0); }

const work = path.join(os.tmpdir(), `pw-regen-${Date.now()}`);
mkdirSync(work, { recursive: true });
const instruction = `Make exactly ONE image with your image generation tool, vertical 9:16 portrait (the tallest 9:16 size available). Call the tool with only the prompt argument; if it returns a validation error, retry with only the prompt. Do not make a second image, do not edit files, do not run commands. Use this prompt verbatim:\n\n${prompt}\n`;
writeFileSync(path.join(work, 'brief.txt'), instruction);
const genRoot = path.join(os.homedir(), '.codex', 'generated_images');
// --take <png>: finish a take Codex already made (a run that stopped after the image), without generating again.
const given = arg('--take', null);
const codexJs = path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const t0 = Date.now();
const res = given ? { status: 0, stdout: '', stderr: '' } : spawnSync(process.execPath, [codexJs, 'exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', model, '-c', 'model_reasoning_effort="low"', '-'],
  { cwd: work, input: instruction, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
// The images land in ~/.codex/generated_images/<thread id>; the id comes from this run's own event stream, so runs side by
// side never pick up each other's image.
const thread = /"thread_id":"([^"]+)"/.exec(res.stdout || '')?.[1];
const fresh = thread && existsSync(path.join(genRoot, thread)) ? [thread] : [];
const pngs = fresh.flatMap((d) => readdirSync(path.join(genRoot, d)).filter((f) => f.endsWith('.png')).map((f) => path.join(genRoot, d, f)))
  .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
if (given) pngs.unshift(given);
if (!pngs.length) {
  const errs = (res.stdout || '').split('\n').filter((l) => /error|refus|not supported/i.test(l)).slice(-3).join('\n');
  throw new Error(`${file}: Codex (${model}) made no image (exit ${res.status}). ${errs || (res.stderr || '').slice(-400)}`);
}
const take = pngs[0];
const dest = path.join(SRC, file);
const stem = dest.replace(/\.png$/, '');
const backup = `${stem}.before-qc-r${round}.png`;
if (existsSync(backup)) throw new Error(`${backup} exists already — that round was run`);
copyFileSync(dest, backup);
copyFileSync(take, `${stem}.qc-r${round}-original.png`);
const meta = await sharp(take).metadata();
const ch = Math.min(meta.height, Math.floor(meta.width * 16 / 9)), cw = Math.min(meta.width, Math.floor(ch * 9 / 16));
await sharp(take).extract({ left: Math.round((meta.width - cw) / 2), top: Math.round((meta.height - ch) / 2), width: cw, height: ch })
  .resize(1008, 1792, { kernel: 'lanczos3' }).png().toFile(dest + '.tmp');
copyFileSync(dest + '.tmp', dest);
spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', dest + '.tmp'] : [dest + '.tmp']);
const line = `- QC round ${round} (Vonk, 8 Oct 2026) | ${file} | Codex ${model} image tool (GPT Image; version not exposed) | ${meta.width}x${meta.height} -> 1008x1792 centre crop, Lanczos | replaced photo kept as ${path.basename(backup)}, raw take ${path.basename(stem)}.qc-r${round}-original.png | ${Math.round((Date.now() - t0) / 1000)} s | prompt: brief scene + set rule + "${DRY}" + "${HEAD}"${extra ? ` + "${extra}"` : ''} + verbatim tail\n`;
appendFileSync(path.join(SRC, 'log.md'), line);
console.log(line.trim());
