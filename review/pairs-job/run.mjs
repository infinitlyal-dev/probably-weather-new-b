// THE PAIRS JOB — makes a small batch of line + photo pairs to the recipe, for Al to tick.
// Al's brief, 25 Sept 2026. Nothing it makes reaches the app: it writes pairs, checks them and builds
// a short pre-marked page; only Al's ticks ship, wired by a later session.
//
// Each run, in order:
//   1. stops if <data>/PAUSE exists (Al's pause switch)
//   2. waits while an earlier batch is unruled: runs only once Downloads\pairs-batch-<n>-ruled.json exists
//   3. skips if Codex's weekly usage is over 85 % (Sol's code reviews share that allowance)
//   4. takes the next targets from <data>/targets.json (MEH-line spots, then weak clear photos, then thin spots)
//   5. Sol writes each target's line (+ Afrikaans) and then its photo brief, joke first, to RECIPE.md
//      — while the writer is not Opus, batch 1 puts Opus-written lines (opus-lines.json) on alternate
//        pairs, unlabelled, so Al's LOVE/MEH shows whether the writer matters
//   6. the recipe filter drops any line that breaks the hard rules
//   7. Sol makes two takes per pair (built-in image tool, ChatGPT plan), each made for its slot: its weather
//      at the folder's strength, its weekday and time of day, an aspirational setting (Al, 26 Sept 2026)
//   8. Sol judges the takes blind to the line but told the slot (realism, waxy look, grit, aspirational
//      setting, day fit, weather-strength fit, where the subject sits); the job picks one and flags any
//      whose subject sits where Home D's joke goes (below ~55 % of the frame)
//   9. writes review\pairs-batch-<n>.html (every item pre-marked with the job's pick) and records the batch
//
//   node run.mjs --data <folder> [--repo <OneDrive working copy>] [--dry]
//   node run.mjs --data <folder> --remake <plan.json> [--ceiling <percent>]   remake photos for ruled lines
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPage } from './page.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('--data');
const REPO = arg('--repo', 'C:\\Users\\27741\\OneDrive\\Desktop\\Probably weather new\\probably-weather-new-c');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const DRY = process.argv.includes('--dry');
const PAIRS_PER_RUN = 4;
const MAX_IMAGES = 8;                 // two takes each
const USAGE_CEILING = 85;
const CODEX_JS = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const WRITER = 'gpt-5.6-sol';         // the unattended writer (the Claude CLI's login had expired on 25 Sept)
if (!DATA) throw new Error('usage: node run.mjs --data <folder>');
mkdirSync(DATA, { recursive: true });
const sharp = createRequire(path.join(REPO, 'package.json'))('sharp');
const log = (m) => { const line = `${new Date().toISOString()} ${m}`; console.log(line); appendFileSync(path.join(DATA, 'log.txt'), `${line}\n`); };
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));

function firstJson(s) { const a = s.indexOf('['), o = s.indexOf('{'); const i = a >= 0 && (o < 0 || a < o) ? a : o; return JSON.parse(s.slice(i, (i === a ? s.lastIndexOf(']') : s.lastIndexOf('}')) + 1)); }

// The slot a photo is made for (Al, 26 Sept 2026): clothes and activity fit the slot's day and time; the
// weather's strength matches the folder; the setting is aspirational. Slot file n: 1 = Monday ... 7 = Sunday.
const DAY_NAMES = [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function dayOf(t) {
  const ns = [...new Set((t?.slots || []).map((s) => Number(s.split('/').pop().replace('.webp', ''))))].filter((d) => d >= 1 && d <= 7);
  if (!ns.length) return 'any day of the week, weekends included (so leisure: no work clothes or work scene unless the joke needs them)';
  const kind = ns.every((d) => d >= 6) ? 'the weekend: leisure, no work clothes or work scene unless the joke needs them'
    : ns.some((d) => d >= 6) ? 'weekday and weekend both: leisure clothes, no work scene unless the joke needs it' : 'a weekday';
  return `${ns.map((d) => DAY_NAMES[d]).join(' and ')} (${kind})`;
}
const STRENGTH = {
  clear: 'pleasant sun: bright and comfortably warm, a green garden, nobody suffering (not a heat wave: that is the heat folder)',
  heat: 'real heat, 33 °C and up, visibly too hot (not just a nice sunny day)',
  cold: 'cold, wet and grey (Cape winter), not frost',
  'cold-clear': 'cold, dry and bright: frost, breath fogging, a clear sky (not rain)',
  rain: 'steady rain, not a thunderstorm',
  storm: 'a thunderstorm: lightning, a downpour',
  wind: 'strong wind, visibly pushing things and people',
  fog: 'thick fog',
  cloudy: 'overcast, a grey sky, no rain falling',
};
const SETTING = "Aspirational setting (the owner's ruling): a cared-for home, garden, suburb, town or farm in real South Africa. No shack, no informal settlement, no poverty, decay, litter or graffiti, nothing run-down. The stock look is fixed by a candid reaction to the weather, never by a grittier place.";
const slotWords = (t) => (t ? `${t.folder} weather at its strength: ${STRENGTH[t.folder] || t.folder}; time of day ${t.time}; day ${dayOf(t)}` : 'slot unknown');

function judgePrompt(all) {
  return `You are judging ${all.length} photographs for realism and fit. They are attached in order, numbered 1 to ${all.length}. Each was made for one slot of a South African weather app:
${all.map((a, k) => `- ${k + 1}: ${slotWords(a.target)}`).join('\n')}

For each, reply with JSON only: an array of {"n", "realism": 1-5 (5 = indistinguishable from a real camera photo), "waxy": true if any skin looks smoothed, plastic or waxy, "aiTells": short list of visible AI artefacts or [], "gritty": true if it reads as poverty, decay, litter, graffiti or squalor, "aspirational": true only if the setting is a cared-for home, garden, suburb, town or farm (false for a shack, an informal or run-down place), "dayFit": true only if the clothes and activity suit its slot's day and time (false for work clothes or a work scene on a weekend slot), "weatherFit": true only if the weather's strength matches its slot (false when a clear slot reads as a heat wave, a heat slot reads as a nice day, or cold and frost are swapped), "fitNote": one short phrase on what is off, or "", "subjectTop": % of the image height where the main subject starts, "subjectBottom": % where it ends, "calmBottom": true if the bottom third is calm and empty}. Judge only what you can see. Do not run commands or read files.`;
}
// Blind judge of every take (told its slot, never its line), then the pick: realism first (no waxy skin),
// then Al's setting rules (no grit, aspirational, fits its day, weather at the folder's strength), then the
// composition. A pair is pre-marked USE only when its pick is realistic (4+) and passes every one of those.
// Home D is not live: its joke band (about 55-75 % down the screen) is reported, not a reason to say NO.
const fitFails = (m) => [m.gritty && 'gritty', m.aspirational === false && 'not aspirational', m.dayFit === false && 'wrong for its day', m.weatherFit === false && 'wrong weather strength'].filter(Boolean);
function judgeAndChoose(pairs, cwd, outName, targetOf) {
  const all = pairs.flatMap((l) => (l.takes || []).map((t, i) => ({ l, t, i, target: targetOf(l.id) })));
  if (all.length) {
    const jr = codex(judgePrompt(all), { images: all.map((a) => a.t), out: path.join(cwd, outName), cwd });
    let marks = [];
    try { marks = firstJson(jr.text); } catch (e) { log(`judge reply did not parse: ${e.message}`); }
    all.forEach((a, k) => { a.m = marks.find((m) => Number(m.n) === k + 1) || null; });
  }
  for (const l of pairs) {
    const mine = all.filter((a) => a.l === l);
    const score = (a) => (a.m ? a.m.realism * 10 - (a.m.waxy ? 20 : 0) - fitFails(a.m).length * 20 - (a.m.aiTells?.length || 0) * 3 + (a.m.calmBottom ? 2 : 0) - (a.m.subjectBottom > 55 ? 5 : 0) : 0);
    const best = [...mine].sort((a, b) => score(b) - score(a))[0];
    l.pick = best ? best.i : null;
    l.judge = mine.map((a) => ({ take: a.i + 1, ...a.m }));
    l.coversFlag = best?.m && best.m.subjectBottom > 55 ? `On Home D (not live) the joke would sit on the subject: it reaches ${best.m.subjectBottom} % down the frame.` : null;
    l.gritFlag = best?.m?.gritty ? 'The judge reads grit or poverty in it (house rule: positive, no decay or litter).' : null;
    const off = best?.m ? fitFails(best.m).filter((x) => x !== 'gritty') : [];
    l.fitFlag = off.length ? `The judge says: ${off.join(', ')}${best.m.fitNote ? ` (${best.m.fitNote})` : ''}. Al's rules: aspirational settings, clothes that fit the day, weather at the folder's strength.` : null;
    l.realOk = !!(best?.m && !best.m.waxy && best.m.realism >= 4 && !fitFails(best.m).length);
    l.anchorY = best?.m ? Math.max(15, Math.min(60, Math.round((best.m.subjectTop + best.m.subjectBottom) / 2) - 10)) : 40;
  }
}
// The photo brief for one pair (RECIPE.md section 4), made for its slot.
const REALISM = 'Realism: natural skin with visible pores, fine lines and small flaws; a candid, unposed moment caught mid-action; available light only; slight film grain; true, unsaturated colour. No retouched or smoothed skin, no glossy sheen, no plastic or waxy faces, no stock-photo lighting, nobody posing or smiling at the camera.';
function photoPrompt(l, t) {
  return `Make TWO separate images with your image generation tool: two takes of the same brief, one tool call each. Call the tool with only the prompt argument. If a call fails validation, fix the arguments and call again. Do not run any commands and do not read or write files. Reply with one line when both are made.

BRIEF:
A real camera photograph, not an illustration and not a render. Vertical portrait, 9:16.

It sets up this joke, which is written onto the photo later (do not illustrate its words, and put no words in the picture): "${l.line}"

The slot it is made for: ${slotWords(t)}.

The scene: ${l.scene}

Composition: ${l.composition}

${SETTING} Clothes and activity fit the slot's day and time. The weather shows at exactly the slot's strength, no stronger and no weaker.

${REALISM}

Nothing written anywhere: no text, letters, signs, logos, labels or number plates.`;
}
// Two takes of one pair (capped at two); returns the PNG paths.
function makeTakes(l, t, cwd) {
  const r = codex(photoPrompt(l, t), { cwd });
  const g = r.thread ? path.join(os.homedir(), '.codex', 'generated_images', r.thread) : null;
  let takes = g && existsSync(g) ? readdirSync(g).filter((f) => f.endsWith('.png')).map((f) => path.join(g, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs) : [];
  if (takes.length > 2) { log(`${l.id}: Sol made ${takes.length} takes; keeping the first 2 (cap)`); takes = takes.slice(0, 2); }
  return takes;
}
async function rebuildPage(pn) {
  const b = J(path.join(DATA, `batch-${pn}`, 'batch.json'));
  const allTargets = J(path.join(DATA, 'targets.json')).targets;
  const kept = b.pairs.map((p) => {
    const best = (p.judge || []).find((j) => j.take === (p.pick ?? -1) + 1);
    return { ...p, realOk: p.realOk ?? !!(best && !best.waxy && best.realism >= 4 && !fitFails(best).length) };
  });
  const page = await buildPage({ n: pn, targets: allTargets.filter((t) => kept.some((k) => k.id === t.id)), kept, sharp });
  writeFileSync(path.join(REPO, 'review', `pairs-batch-${pn}.html`), page);
  log(`batch ${pn}: page rebuilt from batch.json (${kept.length} pairs)`);
}

// --page-only <n>: rebuild a batch's page from its saved batch.json (no Codex, no gates).
if (process.argv.includes('--page-only')) { await rebuildPage(Number(arg('--page-only'))); process.exit(0); }
// --rejudge <n>: judge a batch's takes again (two per pair) and rebuild its page; makes no new images.
if (process.argv.includes('--rejudge')) {
  const rn = Number(arg('--rejudge'));
  const bdir = path.join(DATA, `batch-${rn}`);
  const b = J(path.join(bdir, 'batch.json'));
  for (const p of b.pairs) p.takes = (p.takes || []).slice(0, 2);
  const tAll = J(path.join(DATA, 'targets.json')).targets;
  judgeAndChoose(b.pairs, bdir, 'judge-again.txt', (id) => tAll.find((t) => t.id === id));
  writeFileSync(path.join(bdir, 'batch.json'), JSON.stringify(b, null, 1));
  log(`batch ${rn}: judged again (${b.pairs.map((p) => `${p.id} take ${p.pick + 1}${p.realOk ? '' : ' NO'}`).join(', ')})`);
  await rebuildPage(rn);
  process.exit(0);
}

// --remake <plan.json>: remake the photos of pairs whose lines Al has already ruled (their photos were out).
// The plan: { name, pairs: [{ id, line, af, scene, composition, target: { folder, time, slots } }] }. Two takes
// each with this job's photo brief, judged the same way; writes <data>/remakes/<name>/batch.json (resumable)
// and stops before a pair once Codex's weekly usage passes --ceiling (default the job's ceiling). No page.
if (process.argv.includes('--remake')) {
  const plan = J(arg('--remake'));
  const rdir = path.join(DATA, 'remakes', plan.name);
  mkdirSync(rdir, { recursive: true });
  const saved = path.join(rdir, 'batch.json');
  const work = existsSync(saved) ? J(saved) : { ...plan, made: new Date().toISOString(), writer: WRITER };
  const ceiling = Number(arg('--ceiling', USAGE_CEILING));
  for (const p of work.pairs) {
    if (p.takes?.length) continue;
    const u = codexUsage();
    if (u != null && u > ceiling) { log(`remake ${plan.name}: stopped before ${p.id}: Codex weekly usage ${u} % is over ${ceiling} %`); break; }
    p.takes = makeTakes(p, p.target, rdir);
    log(`remake ${plan.name} ${p.id}: ${p.takes.length} takes (Codex usage ${codexUsage() ?? '?'} %)`);
    writeFileSync(saved, JSON.stringify(work, null, 1));
  }
  const made = work.pairs.filter((p) => p.takes?.length);
  judgeAndChoose(made, rdir, 'judge.txt', (id) => work.pairs.find((p) => p.id === id).target);
  writeFileSync(saved, JSON.stringify(work, null, 1));
  log(`remake ${plan.name}: judged (${made.map((p) => `${p.id} take ${p.pick + 1}${p.realOk ? '' : ' NO'}`).join(', ')})`);
  process.exit(0);
}

// ---- 1-3: the gates -----------------------------------------------------------------------------
if (existsSync(path.join(DATA, 'PAUSE'))) { log('paused by Al (PAUSE file) — nothing made'); process.exit(0); }
const statePath = path.join(DATA, 'state.json');
const state = existsSync(statePath) ? J(statePath) : { batches: [], done: [] };
const last = state.batches[state.batches.length - 1];
if (last && !last.ruled) {
  const ruled = path.join(DOWNLOADS, `pairs-batch-${last.n}-ruled.json`);
  if (!existsSync(ruled)) { log(`waiting: batch ${last.n} is not ruled yet (${ruled}) — nothing made`); process.exit(0); }
  copyFileSync(ruled, path.join(DATA, `batch-${last.n}`, 'ruled.json'));
  last.ruled = new Date().toISOString();
  writeFileSync(statePath, JSON.stringify(state, null, 1));
  log(`batch ${last.n} ruled by Al; its export is in batch-${last.n}/ruled.json for the wiring session`);
}
function codexUsage() {
  const root = path.join(os.homedir(), '.codex', 'sessions');
  let newest = null;
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.jsonl')) { const t = statSync(f).mtimeMs; if (!newest || t > newest.t) newest = { f, t }; } } };
  if (existsSync(root)) walk(root);
  if (!newest) return null;
  const m = [...readFileSync(newest.f, 'utf8').matchAll(/"used_percent":([0-9.]+)/g)].pop();
  return m ? Number(m[1]) : null;
}
const usageBefore = codexUsage();
if (usageBefore != null && usageBefore > USAGE_CEILING) { log(`skipped: Codex weekly usage ${usageBefore} % is over ${USAGE_CEILING} %`); process.exit(0); }

// ---- 4: targets -------------------------------------------------------------------------------
const queue = J(path.join(DATA, 'targets.json')).targets.filter((t) => !state.done.includes(t.id));
const targets = queue.slice(0, Math.min(PAIRS_PER_RUN, Math.floor(MAX_IMAGES / 2)));
if (!targets.length) { log('queue empty — add targets to targets.json'); process.exit(0); }
const n = state.batches.length + 1;
const dir = path.join(DATA, `batch-${n}`);
mkdirSync(dir, { recursive: true });
log(`batch ${n}: ${targets.map((t) => t.id).join(', ')}; Codex usage ${usageBefore ?? '?'} %`);

function codex(prompt, { images = [], out, cwd } = {}) {
  const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', WRITER, '-c', 'model_reasoning_effort="low"'];
  for (const i of images) args.push('-i', i);
  if (out) args.push('-o', out);
  args.push('-');
  // Codex's own script through node, no shell: the data folder's path has spaces.
  const r = spawnSync(process.execPath, [CODEX_JS, ...args], { input: prompt, cwd: cwd || dir, encoding: 'utf8', timeout: 15 * 60000, maxBuffer: 64 * 1024 * 1024 });
  const thread = (/"thread_id":"([^"]+)"/.exec(r.stdout || '') || [])[1] || null;
  return { status: r.status, thread, text: out && existsSync(out) ? readFileSync(out, 'utf8') : '' };
}

// ---- 5: lines (joke first) ----------------------------------------------------------------------
const recipe = readFileSync(path.join(HERE, 'RECIPE.md'), 'utf8');
const WEATHER_WORDS = { 'rain-possible': 'might rain', 'partly-cloudy': 'partly cloudy', 'cold-clear': 'cold and clear (dry, frosty, bright)', cold: 'cold and wet (Cape winter)', weekend: 'a clear weekend day', night: 'a clear night', uv: 'strong sun' };
const brief = `You write for Probably Weather, a South African weather app. Its home screen shows one photo and one short joke about the weather now. Below is the owner's recipe, from his own grades. Follow it exactly.

${recipe}

For each target below, first write ONE line to the recipe (about the weather now, one twist, spoken straight to the reader, short), then its Afrikaans (natural, conceived in Afrikaans, not word for word), then a photo brief that SETS UP the joke — a real South African scene where the weather is visibly doing something to one subject — without illustrating the line's words. The photo brief keeps the owner's photo rules (section 3): an aspirational setting (a cared-for home, garden, suburb, town or farm; never a shack, poverty, decay or grit — the stock look is fixed by a candid reaction to the weather, not by a grittier place), clothes and activity that fit the target's day and time, and the weather at the target's strength. No weekday, month or season words; no Eskom or load shedding; never describe a photo in the line.

Targets:
${targets.map((t) => `- ${t.id}: weather ${WEATHER_WORDS[t.bin || t.folder] || t.bin || t.folder}, time of day ${t.time}; day ${dayOf(t)}; the photo's weather at its strength: ${STRENGTH[t.folder] || t.folder}${t.meh ? `; it replaces this line the owner found flat: "${t.meh}"` : ''}${t.note ? `; ${t.note}` : ''}`).join('\n')}

Reply with ONLY a JSON array, one object per target: {"id","line","af","twist":"character|exaggeration|confession|SA truth","scene":"place, time, day, weather at its strength, the one subject cast specifically (age, who, clothes for that day), what the weather is doing to them, the cared-for home, garden, suburb, town or farm named","composition":"where the subject sits (upper half) and what fills the calm bottom third"}`;
let lines = [];
if (DRY) lines = targets.map((t) => ({ id: t.id, line: '(dry run)', af: '', scene: '', composition: '' }));
else {
  const r = codex(brief, { out: path.join(dir, 'writer.txt') });
  try { lines = firstJson(r.text); } catch (e) { log(`writer reply did not parse: ${e.message}`); process.exit(1); }
}
const opus = existsSync(path.join(HERE, 'opus-lines.json')) ? J(path.join(HERE, 'opus-lines.json')).lines : {};
const key = {};
const mixing = n === 1 && !WRITER.startsWith('claude-opus');
lines = lines.map((l, i) => {
  const o = opus[l.id];
  if (mixing && o && i % 2 === 1) { key[l.id] = 'opus-5.5'; return { id: l.id, ...o }; }
  key[l.id] = WRITER; return l;
});

// ---- 6: the recipe filter ---------------------------------------------------------------------
const HARD = [
  [/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|summer|winter|spring|autumn|christmas|easter|holiday)\b/i, 'names the calendar'],
  [/eskom|load.?shed/i, 'Eskom / load shedding'],
  [/^(he|she|they|his|her|their)\b|\b(he|she)\b/i, 'describes a person in a photo'],
  [/\bvibes?\b/i, '"vibes"'],
];
const bank = new Set();
try { const W = readFileSync(path.join(REPO, 'assets', 'weather-copy.js'), 'utf8'); for (const m of W.matchAll(/"([^"]{8,})"/g)) bank.add(m[1].toLowerCase()); } catch {}
const kept = [];
for (const l of lines) {
  const words = String(l.line).split(/\s+/).filter(Boolean).length;
  const why = HARD.filter(([re]) => re.test(l.line)).map(([, w]) => w);
  if (words > 16) why.push(`${words} words`);
  if (bank.has(String(l.line).toLowerCase())) why.push('already in the bank');
  if (why.length && !DRY) { log(`${l.id}: dropped by the recipe filter (${why.join(', ')}): ${l.line}`); continue; }
  kept.push(l);
}

// ---- 7: photos, two takes each ------------------------------------------------------------------
let images = 0;
for (const l of kept) {
  if (DRY || images + 2 > MAX_IMAGES) { l.takes = []; continue; }
  l.takes = makeTakes(l, targets.find((t) => t.id === l.id), dir);
  images += l.takes.length;
  log(`${l.id}: ${l.takes.length} takes`);
}

// ---- 8: blind judge + the covers-the-subject check ------------------------------------------------
judgeAndChoose(kept, dir, 'judge.txt', (id) => targets.find((t) => t.id === id));

// ---- 9: the page ---------------------------------------------------------------------------------
const page = await buildPage({ n, targets, kept, sharp });
const pagePath = path.join(REPO, 'review', `pairs-batch-${n}.html`);
if (!DRY) writeFileSync(pagePath, page);
writeFileSync(path.join(dir, 'batch.json'), JSON.stringify({ n, made: new Date().toISOString(), writer: WRITER, mixedWithOpus: mixing, pairs: kept.map((l) => ({ id: l.id, line: l.line, af: l.af, scene: l.scene, composition: l.composition, takes: l.takes, pick: l.pick, judge: l.judge, coversFlag: l.coversFlag, gritFlag: l.gritFlag, fitFlag: l.fitFlag, realOk: l.realOk, anchorY: l.anchorY })) }, null, 1));
writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ note: 'Who wrote each line. Not on the page.', key }, null, 1));
const usageAfter = codexUsage();
if (!DRY) {
  state.batches.push({ n, made: new Date().toISOString(), page: pagePath, ruled: null, targets: kept.map((l) => l.id), images, usageBefore, usageAfter });
  state.done.push(...targets.map((t) => t.id));
  writeFileSync(statePath, JSON.stringify(state, null, 1));
}
log(`batch ${n} ${DRY ? '(dry) ' : ''}done: ${kept.length} pairs, ${images} images, page ${pagePath}; Codex usage ${usageBefore ?? '?'} -> ${usageAfter ?? '?'} %`);
