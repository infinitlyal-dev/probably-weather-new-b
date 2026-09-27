// THE LIVE-PHOTO CATALOGUE — one line describing every photograph in the app, written once and kept
// (Al, 27 Sept 2026: "Compare each idea with every photo already in the app"). The pairs job's variety check
// reads it so a new idea never repeats a setup the app already shows.
//
// Keyed by the photograph's hash (sha1 of the bytes, 12 hex, as review/set-001-draft.json). A photo already
// described keeps its line; only new photos are described (Sol, 25 per call, the photos downscaled), and photos
// no longer in the app leave. Run it after a wiring session changes the photographs, then reinstall the job.
//
//   node review/pairs-job/catalogue.mjs --repo <working tree> [--dry]
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const REPO = arg('--repo', path.resolve(HERE, '..', '..'));
const DRY = process.argv.includes('--dry');
const OUT = path.join(HERE, 'live-photos.json');
const CODEX_JS = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const sharp = createRequire(path.join(REPO, 'package.json'))('sharp');
const PER_CALL = 25;

const draft = JSON.parse(readFileSync(path.join(REPO, 'review', 'set-001-draft.json'), 'utf8'));
const cat = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { photos: {} };
const live = new Map();
for (const a of draft.assignments) {
  const file = path.join(REPO, 'assets', 'images', 'bg', ...a.image.split('/'));
  const hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12);
  if (hash !== a.hash) throw new Error(`${a.image} holds ${hash}, the slot map says ${a.hash}`);
  live.set(hash, { folder: a.condition, time: a.time, slots: [...new Set([a.image, ...(a.paths || [])])], file, pair: a.pair || null });
}
const gone = Object.keys(cat.photos).filter((h) => !live.has(h));
for (const h of gone) delete cat.photos[h];
for (const [h, v] of live) if (cat.photos[h]) Object.assign(cat.photos[h], { folder: v.folder, time: v.time, slots: v.slots, pair: v.pair });
const todo = [...live].filter(([h]) => !cat.photos[h]?.line);
console.log(`[catalogue] ${live.size} live photos; ${todo.length} to describe; ${gone.length} gone`);

const prompt = (n) => `You are cataloguing the ${n} photographs attached (numbered 1 to ${n} in order) from a South African weather app, so that new photos never repeat a setup the app already has. For each photo reply with JSON only, an array of {"n", "line": one plain line of at most 18 words saying who or what is in it, what they are doing, where, and how close the camera is (e.g. "Woman shields her eyes from low sun on a suburban lawn; medium shot"), "subject": one of "one person" | "two or three people" | "group" | "animal" | "object" | "vehicle" | "place" (no subject: a landscape, sky or street), "setting": one of "garden or lawn" | "gate, door or driveway" | "stoep or patio" | "indoors" | "kitchen" | "street or town" | "road or car" | "farm or veld" | "beach or coast" | "mountain or view" | "park or field" | "other", "shot": "close-up" | "medium" | "wide", "banned": a list of any of these that the photo shows, else []: "squinting into the sun" (a person outside squinting or shielding their eyes from the sun), "blown in front of a house" (hair or clothes blown about in front of a house), "lawn in heat" (a person standing on a lawn in heat), "at a gate or front door" (a person at their gate or front door)}. Judge only what you can see. Do not run commands or read files.`;

function codex(text, images, out, cwd) {
  const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="low"'];
  for (const i of images) args.push('-i', i);
  args.push('-o', out, '-');
  const r = spawnSync(process.execPath, [CODEX_JS, ...args], { input: text, cwd, encoding: 'utf8', timeout: 15 * 60000, maxBuffer: 64 * 1024 * 1024 });
  return existsSync(out) ? readFileSync(out, 'utf8') : `${r.stderr || ''}`;
}
const firstJson = (s) => JSON.parse(s.slice(s.indexOf('['), s.lastIndexOf(']') + 1));

const tmp = path.join(os.tmpdir(), 'pw-catalogue');
mkdirSync(tmp, { recursive: true });
for (let i = 0; i < todo.length && !DRY; i += PER_CALL) {
  const chunk = todo.slice(i, i + PER_CALL);
  const imgs = [];
  for (const [h, v] of chunk) { const f = path.join(tmp, `${h}.jpg`); await sharp(v.file).resize(384, 683, { fit: 'cover' }).jpeg({ quality: 72 }).toFile(f); imgs.push(f); }
  let marks = [];
  for (let attempt = 1; attempt <= 2 && !marks.length; attempt++) {
    try { marks = firstJson(codex(prompt(chunk.length), imgs, path.join(tmp, `reply-${i}.txt`), tmp)); } catch (e) { console.log(`[catalogue] reply did not parse (try ${attempt}): ${e.message}`); }
  }
  chunk.forEach(([h, v], k) => {
    const m = marks.find((x) => Number(x.n) === k + 1);
    if (m?.line) cat.photos[h] = { folder: v.folder, time: v.time, slots: v.slots, pair: v.pair, line: m.line, subject: m.subject, setting: m.setting, shot: m.shot, banned: m.banned || [] };
  });
  writeFileSync(OUT, `${JSON.stringify({ ...cat, generated: new Date().toISOString(), repo: REPO }, null, 1)}\n`);
  console.log(`[catalogue] ${Math.min(i + PER_CALL, todo.length)} of ${todo.length} described`);
}
cat.generated = new Date().toISOString();
cat.note = 'One line per live photograph (keyed by the hash in review/set-001-draft.json), written once and kept; the pairs job compares every new idea with these. Rebuild after wiring: node review/pairs-job/catalogue.mjs --repo <tree>.';
if (!DRY) writeFileSync(OUT, `${JSON.stringify({ note: cat.note, generated: cat.generated, photos: cat.photos }, null, 1)}\n`);
const missing = [...live.keys()].filter((h) => !cat.photos[h]?.line);
console.log(`[catalogue] ${Object.keys(cat.photos).length} described${missing.length ? `; ${missing.length} still without a line: ${missing.join(', ')}` : ''}`);
