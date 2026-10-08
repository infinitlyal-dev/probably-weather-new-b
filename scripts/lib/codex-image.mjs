// One image from Codex's built-in image tool, finished to the library's 1008x1792 (8 Oct 2026).
//
// Codex is logged in with Al's ChatGPT account. The driving model only calls the tool: gpt-6-astra and gpt-5.6-sol both
// work on that login; gpt-6.1-sol is refused ("not supported when using Codex with a ChatGPT account"). The tool does
// not report which GPT Image version ran.
//
// The image lands in ~/.codex/generated_images/<thread id>/; the thread id is read from this run's own event stream, so
// two runs never take each other's image. Runs are still made one at a time: three side by side once handed one image
// to three files before the thread-id rule existed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const CODEX_JS = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const GEN_ROOT = path.join(os.homedir(), '.codex', 'generated_images');

/** The token usage of the last codexImage run, as Codex's own `turn.completed` event reports it (null when it reported none). */
export const lastUsage = { value: null };

/** Make one image from `prompt`; returns the path of Codex's own PNG. `take` skips generation (finish an existing take). */
export function codexImage(prompt, { model = 'gpt-6-astra', take = null } = {}) {
  lastUsage.value = null;
  if (take) return take;
  const work = path.join(os.tmpdir(), `pw-regen-${Date.now()}-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const instruction = `Make exactly ONE image with your image generation tool, vertical 9:16 portrait (the tallest 9:16 size available). Call the tool with only the prompt argument; if it returns a validation error, retry with only the prompt. Do not make a second image, do not edit files, do not run commands. Use this prompt verbatim:\n\n${prompt}\n`;
  writeFileSync(path.join(work, 'brief.txt'), instruction);
  const res = spawnSync(process.execPath, [CODEX_JS, 'exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', model, '-c', 'model_reasoning_effort="low"', '-'],
    { cwd: work, input: instruction, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  lastUsage.value = (res.stdout || '').split('\n')
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e?.type === 'turn.completed' && e.usage).map((e) => e.usage).pop() ?? null;
  const thread = /"thread_id":"([^"]+)"/.exec(res.stdout || '')?.[1];
  const dir = thread ? path.join(GEN_ROOT, thread) : null;
  const pngs = dir && existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => path.join(dir, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
    : [];
  if (!pngs.length) {
    const errs = (res.stdout || '').split('\n').filter((l) => /error|refus|not supported/i.test(l)).slice(-3).join('\n');
    throw new Error(`Codex (${model}) made no image (exit ${res.status}). ${errs || (res.stderr || '').slice(-400)}`);
  }
  return pngs[0];
}

/** Centre-crop a take to 9:16 and resize it to 1008x1792 (Lanczos), as review/new-sets-2026-10-07/finish_image.py does. */
export async function finishTake(take, dest) {
  const meta = await sharp(take).metadata();
  const ch = Math.min(meta.height, Math.floor(meta.width * 16 / 9)), cw = Math.min(meta.width, Math.floor(ch * 9 / 16));
  const buf = await sharp(take).extract({ left: Math.round((meta.width - cw) / 2), top: Math.round((meta.height - ch) / 2), width: cw, height: ch })
    .resize(1008, 1792, { kernel: 'lanczos3' }).png().toBuffer();
  writeFileSync(dest, buf);
  return { width: meta.width, height: meta.height };
}

/** The house tail (review/image-brief-2026-10-07.md, verbatim) and Al's two sentences (8 Oct 2026). */
export const TAIL = 'Documentary photograph, vertical 9:16, 35mm lens, available light only. Real weathered surfaces — damp patches, rust, hairline cracks, sun-faded paint, marks where things have been leaned. No CGI or 3D-render look, no plastic sheen on skin or surfaces, no green colour cast on cream or white walls. No readable text, logos or signs. Nothing blown over or lying broken. Keep the lower third of the frame visually quiet and uncluttered.';
export const DRY = 'The ground is completely dry: dull matte tarmac and paving, no puddles, no wet reflections; it has not rained.';
export const HEAD = "The main subject's head sits between 40% and 62% of the frame height.";
export const TIME = { dawn: 'Dawn: the first 75 minutes after sunrise.', day: 'Daytime.', dusk: 'Dusk: the hour around sunset.', night: 'Night: full dark, with its own light source in frame.' };
