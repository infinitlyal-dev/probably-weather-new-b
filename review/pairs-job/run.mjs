// THE PAIRS JOB — makes line + photo pairs to the recipe, for Al to tick. Hourly (Al, 26 Sept 2026).
// Nothing it makes reaches the app: it writes pairs, checks them and adds them to ONE rolling page, every pair
// pre-marked with the judge's pick; only Al's ticks ship, wired by a later session.
//
// Each run, in order:
//   1. stops if <data>/PAUSE exists (Al's pause switch)
//   2. stops while backing off after a rate limit, or for the week once Codex's weekly usage passed 90 %
//   3. reads Al's exports from Downloads: pairs-rolling-ruled*.json (those pairs leave the page) and
//      meh-photos-ruled.json (every photo he left on REPLACE is queued; a queued photo he kept is dropped)
//   4. makes nothing while 40 pairs wait on the page; otherwise takes the next targets from <data>/targets.json
//      in queue order: Al's three named photos, then the photos marked REPLACE (most-shown first), then extra
//      photos for the thinnest weathers (fog, heat, cold-clear)
//   5. Sol writes each target's line (+ Afrikaans), joke first, then its photo brief, to RECIPE.md
//   6. the recipe filter drops any line that breaks the hard rules
//   7. Sol makes two takes per pair (built-in image tool, ChatGPT plan), each made for its slot: its weather at
//      the folder's strength, its weekday and time of day, an aspirational setting, the subject in the top half
//   8. Sol judges the takes blind to the line but told the slot; the job picks one
//   9. adds the pairs to review\pairs-rolling.html (at most 40 waiting) and records the batch
//
//   node run.mjs --data <folder> [--repo <OneDrive working copy>] [--dry]
//   node run.mjs --data <folder> --page-only          rebuild the rolling page (no Codex)
//   node run.mjs --data <folder> --remake <plan.json> [--ceiling <percent>]   remake photos for ruled lines
import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPage } from './page.mjs';

const T0 = Date.now();                // the 21:00 run of 26 Sept spent 15 min before its first line: timed now
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('--data');
const REPO = arg('--repo', 'C:\\Users\\27741\\OneDrive\\Desktop\\Probably weather new\\probably-weather-new-c');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const DRY = process.argv.includes('--dry');
const PAIRS_PER_RUN = 5;              // about 10 images an hour (Al, 26 Sept 2026)
const MAX_IMAGES = 10;                // two takes each
const MAX_WAITING = 40;               // the job makes no more while 40 pairs wait for Al
const USAGE_CEILING = 90;             // stop for the week once Codex's weekly usage passes this
const BACKOFF_HOURS = [1, 2, 4, 8, 24];
const PHOTO_BUDGET_MS = 40 * 60e3;    // no new pair's photos after 40 min, so the judge and the save always
                                      // land inside the task's time limit (the 21:00 run of 26 Sept was slow)
const PAGE_NAME = 'pairs-rolling.html';
const CODEX_JS = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
const WRITER = 'gpt-5.6-sol';         // the unattended writer (the Claude CLI's login had expired on 25 Sept)
if (!DATA) throw new Error('usage: node run.mjs --data <folder>');
mkdirSync(DATA, { recursive: true });
const sharp = createRequire(path.join(REPO, 'package.json'))('sharp');
const log = (m) => { const line = `${new Date().toISOString()} ${m}`; console.log(line); appendFileSync(path.join(DATA, 'log.txt'), `${line}\n`); };
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const statePath = path.join(DATA, 'state.json');
const state = existsSync(statePath) ? J(statePath) : { batches: [], done: [] };
state.pairs ||= {};                   // id -> { batch, made, ruled }
state.ingested ||= [];                // `generated` stamps of Al's exports already read
const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 1));
const targetsPath = path.join(DATA, 'targets.json');

function firstJson(s) { const a = s.indexOf('['), o = s.indexOf('{'); const i = a >= 0 && (o < 0 || a < o) ? a : o; return JSON.parse(s.slice(i, (i === a ? s.lastIndexOf(']') : s.lastIndexOf('}')) + 1)); }

// Codex's own usage record: the newest "rate_limits" block for the main `codex` limit (not a per-model limit
// such as Spark's), read from the tails of the most recently written session files. Returns the weekly
// window's used % and reset time, or null. (The first version read the last "used_percent" of the newest file,
// which could be another model's limit — 0 % while the real one stood at 83 %.)
function codexLimits() {
  const root = path.join(os.homedir(), '.codex', 'sessions');
  if (!existsSync(root)) return null;
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.jsonl')) files.push({ f, t: statSync(f).mtimeMs }); } };
  walk(root);
  files.sort((a, b) => b.t - a.t);
  let best = null;
  for (const { f } of files.slice(0, 12)) {
    const fd = openSync(f, 'r');
    const size = fstatSync(fd).size, len = Math.min(size, 4 * 1024 * 1024);
    const buf = Buffer.alloc(len); readSync(fd, buf, 0, len, size - len); closeSync(fd);
    const text = buf.toString('utf8');
    for (const line of text.split('\n')) {
      if (!line.includes('"limit_id":"codex"')) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      const rl = ev?.payload?.rate_limits || ev?.rate_limits || ev?.payload?.info?.rate_limits;
      if (!rl || rl.limit_id !== 'codex') continue;
      const weekly = [rl.primary, rl.secondary].find((w) => w && w.window_minutes >= 7 * 24 * 60);
      if (!weekly) continue;
      const ts = Date.parse(ev.timestamp || '') || 0;
      if (!best || ts >= best.ts) best = { ts, used: Number(weekly.used_percent), resetsAt: weekly.resets_at ? weekly.resets_at * 1000 : null, reached: rl.rate_limit_reached_type || null };
    }
  }
  return best;
}
const codexUsage = () => codexLimits()?.used ?? null;

// A rate limit, however Codex words it: stop the run and back off (1 h, 2 h, 4 h, 8 h, then a day).
const RATE_LIMIT = /(usage limit|too many requests|\b429\b|rate limit (?:reached|exceeded|hit)|"rate_limit_reached_type":"[a-z_]+")/i;
class RateLimited extends Error {}
function backOff(why) {
  const step = Math.min((state.backoff?.step ?? -1) + 1, BACKOFF_HOURS.length - 1);
  state.backoff = { step, until: Date.now() + BACKOFF_HOURS[step] * 3600e3, why };
  saveState();
  log(`rate limited (${why}) — backing off ${BACKOFF_HOURS[step]} h, until ${new Date(state.backoff.until).toISOString()}`);
}

// ---- helpers shared by every mode ----------------------------------------------------------------------
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
  rain: 'steady rain falling now, not a thunderstorm and not after the rain',
  storm: 'a thunderstorm: lightning, a downpour',
  wind: 'strong wind, visibly pushing things and people',
  fog: 'thick fog',
  cloudy: 'overcast, a grey sky, no rain falling',
};
const SETTING = "Aspirational setting (the owner's ruling): a cared-for home, garden, suburb, town or farm in real South Africa. No shack, no informal settlement, no poverty, decay, litter or graffiti, nothing run-down. The stock look is fixed by a candid reaction to the weather, never by a grittier place.";
const slotWords = (t) => (t ? `${t.folder} weather at its strength: ${STRENGTH[t.folder] || t.folder}; time of day ${t.time}; day ${dayOf(t)}` : 'slot unknown');

function codex(prompt, { images = [], out, cwd } = {}) {
  const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', WRITER, '-c', 'model_reasoning_effort="low"'];
  for (const i of images) args.push('-i', i);
  if (out) args.push('-o', out);
  args.push('-');
  // Codex's own script through node, no shell: the data folder's path has spaces.
  const r = spawnSync(process.execPath, [CODEX_JS, ...args], { input: prompt, cwd, encoding: 'utf8', timeout: 15 * 60000, maxBuffer: 64 * 1024 * 1024 });
  const errs = `${(r.stdout || '').split('\n').filter((l) => /"type":"(error|turn\.failed)"/.test(l)).join('\n')}\n${r.stderr || ''}`;
  if (RATE_LIMIT.test(errs)) throw new RateLimited(errs.match(RATE_LIMIT)[0]);
  const thread = (/"thread_id":"([^"]+)"/.exec(r.stdout || '') || [])[1] || null;
  return { status: r.status, thread, text: out && existsSync(out) ? readFileSync(out, 'utf8') : '' };
}

function judgePrompt(all) {
  return `You are judging ${all.length} photographs for realism and fit. They are attached in order, numbered 1 to ${all.length}. Each was made for one slot of a South African weather app:
${all.map((a, k) => `- ${k + 1}: ${slotWords(a.target)}`).join('\n')}

For each, reply with JSON only: an array of {"n", "realism": 1-5 (5 = indistinguishable from a real camera photo), "waxy": true if any skin looks smoothed, plastic or waxy, "aiTells": short list of visible AI artefacts or [], "gritty": true if it reads as poverty, decay, litter, graffiti or squalor, "aspirational": true only if the setting is a cared-for home, garden, suburb, town or farm (false for a shack, an informal or run-down place), "dayFit": true only if the clothes and activity suit its slot's day and time (false for work clothes or a work scene on a weekend slot), "weatherFit": true only if the weather's strength matches its slot (false when a clear slot reads as a heat wave, a heat slot reads as a nice day, or cold and frost are swapped), "posed": true if anyone is posing or smiling at the camera, "text": true if any words, letters, signs or logos are visible, "fitNote": one short phrase on what is off, or "", "subjectTop": % of the image height where the main subject starts, "subjectBottom": % where it ends, "calmBottom": true if the bottom third is calm and empty}. Judge only what you can see. Do not run commands or read files.`;
}
// Blind judge of every take (told its slot, never its line), then the pick: realism first (no waxy skin),
// then Al's rules (no grit, aspirational, fits its day, weather at the folder's strength, a candid moment, no
// words in the picture), then the composition. Home D is Home now (26 Sept 2026): its joke sits 55-75 % down
// the screen, so a subject that reaches past 60 % of the frame (the judge's bands wobble) is pre-marked NO.
const fitFails = (m) => [m.gritty && 'gritty', m.aspirational === false && 'not aspirational', m.dayFit === false && 'wrong for its day', m.weatherFit === false && 'wrong weather strength', m.posed && 'posed', m.text && 'words in the picture', m.subjectBottom > 60 && 'subject in the joke band'].filter(Boolean);
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
    l.coversFlag = best?.m && best.m.subjectBottom > 60 ? `On Home the joke would sit on the subject: it reaches ${best.m.subjectBottom} % down the frame.` : null;
    l.gritFlag = best?.m?.gritty ? 'The judge reads grit or poverty in it (house rule: positive, no decay or litter).' : null;
    const off = best?.m ? fitFails(best.m).filter((x) => x !== 'gritty' && x !== 'subject in the joke band') : [];
    l.fitFlag = off.length ? `The judge says: ${off.join(', ')}${best.m.fitNote ? ` (${best.m.fitNote})` : ''}. Al's rules: aspirational settings, clothes that fit the day, weather at the folder's strength, a candid moment.` : null;
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

Composition: ${l.composition} The subject sits in the top half of the frame; nothing important below the middle — the joke is written across the lower half.

${SETTING} Clothes and activity fit the slot's day and time. The weather shows at exactly the slot's strength, no stronger and no weaker. Someone (or an animal) is visibly reacting to the weather, caught mid-moment.

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

// ---- the rolling page ------------------------------------------------------------------------------------
function waitingPairs() {
  const out = [];
  for (const [id, p] of Object.entries(state.pairs)) {
    if (p.ruled) continue;
    const b = J(path.join(DATA, `batch-${p.batch}`, 'batch.json'));
    const pair = b.pairs.find((x) => x.id === id);
    if (pair) out.push({ ...pair, batch: p.batch });
  }
  return out;
}
async function rebuildPage() {
  const waiting = waitingPairs();
  const allTargets = J(targetsPath).targets;
  const page = await buildPage({ kept: waiting, targets: allTargets, sharp, repo: REPO, maxWaiting: MAX_WAITING });
  if (!DRY) writeFileSync(path.join(REPO, 'review', PAGE_NAME), page);
  return waiting.length;
}

// --page-only: rebuild the rolling page from the saved batches (no Codex).
if (process.argv.includes('--page-only')) { log(`page rebuilt: ${await rebuildPage()} pairs waiting`); process.exit(0); }

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
  log(`remake ${plan.name}: judged (${made.map((p) => `${p.id} ${p.pick == null ? 'no pick' : `take ${p.pick + 1}`}${p.realOk ? '' : ' NO'}`).join(', ')})`);
  process.exit(0);
}

// ---- 1-2: the stops ----------------------------------------------------------------------------------
if (existsSync(path.join(DATA, 'PAUSE'))) { log('paused by Al (PAUSE file) — nothing made'); process.exit(0); }
if (state.backoff?.until > Date.now()) { log(`backing off after a rate limit until ${new Date(state.backoff.until).toISOString()} — nothing made`); process.exit(0); }
if (state.stoppedUntil && state.stoppedUntil > Date.now()) { log(`stopped for the week (Codex weekly usage passed ${USAGE_CEILING} %) until ${new Date(state.stoppedUntil).toISOString()} — nothing made`); process.exit(0); }
function weeklyStop() {
  const lim = codexLimits();
  if (lim && lim.used > USAGE_CEILING) {
    state.stoppedUntil = lim.resetsAt && lim.resetsAt > Date.now() ? lim.resetsAt : Date.now() + 6 * 3600e3;
    saveState();
    log(`Codex weekly usage ${lim.used} % passed ${USAGE_CEILING} % — stopped for the week, until ${new Date(state.stoppedUntil).toISOString()}`);
    return true;
  }
  return false;
}
if (weeklyStop()) process.exit(0);
// Codex's usage record unreadable (a new session format, the folder moved): the 90 % stop cannot be checked, so
// at most one batch a day until it can, and it says so (Fable, 26 Sept).
if (!DRY && codexLimits() == null) {
  if (state.blindRun && Date.now() - state.blindRun < 24 * 3600e3) { log('WARNING: Codex weekly usage unreadable — one batch a day until it reads again; nothing made'); process.exit(0); }
  state.blindRun = Date.now();
  saveState();
  log('WARNING: Codex weekly usage unreadable — making one batch, then one a day until it reads again');
}

// ---- 3: Al's exports ------------------------------------------------------------------------------------
// The rolling page: every pair on the page when he pressed Export is ruled (his pre-marked picks stand where he
// changed nothing). Browsers name repeat downloads "pairs-rolling-ruled (1).json", so read them all, once each.
mkdirSync(path.join(DATA, 'rolling-ruled'), { recursive: true });
for (const f of readdirSync(DOWNLOADS).filter((n) => /^pairs-rolling-ruled( \(\d+\))?\.json$/.test(n))) {
  let ex; try { ex = J(path.join(DOWNLOADS, f)); } catch { continue; }
  if (!ex.generated || state.ingested.includes(ex.generated)) continue;
  copyFileSync(path.join(DOWNLOADS, f), path.join(DATA, 'rolling-ruled', `${ex.generated.replace(/[:.]/g, '-')}.json`));
  const ids = (ex.pairs || []).map((p) => p.id).filter((id) => state.pairs[id] && !state.pairs[id].ruled);
  for (const id of ids) state.pairs[id].ruled = ex.generated;
  state.ingested.push(ex.generated);
  saveState();
  log(`Al ruled ${ids.length} pairs on the rolling page (${f}); copied to rolling-ruled/ for the wiring session`);
}
// The meh-photo page: REPLACE queues a pair for the photo's spots; KEEP drops it if not yet made.
ingestMeh();
function ingestMeh() {
  const files = readdirSync(DOWNLOADS).filter((n) => /^meh-photos-ruled( \(\d+\))?\.json$/.test(n))
    .map((n) => ({ n, t: statSync(path.join(DOWNLOADS, n)).mtimeMs })).sort((a, b) => a.t - b.t);
  for (const { n } of files) {
    let ex; try { ex = J(path.join(DOWNLOADS, n)); } catch { continue; }
    if (!ex.generated || state.ingested.includes(ex.generated)) continue;
    copyFileSync(path.join(DOWNLOADS, n), path.join(DATA, `meh-photos-ruled-${ex.generated.replace(/[:.]/g, '-')}.json`));
    const q = J(targetsPath);
    let seq = Math.max(0, ...q.targets.filter((t) => /^R\d+$/.test(t.id)).map((t) => Number(t.id.slice(1))));
    let added = 0, dropped = 0, madeKept = [];
    const photos = [...(ex.photos || [])].sort((a, b) => (b.spots || 0) - (a.spots || 0));
    for (const p of photos) {
      const mine = q.targets.filter((t) => t.replaces?.sha256 === p.sha256);
      if (p.pick === 'KEEP') {
        for (const t of mine) {
          if (state.done.includes(t.id)) madeKept.push(t.id);
          else if (!t.kept) { t.kept = ex.generated; dropped++; }
        }
        continue;
      }
      if (p.pick !== 'REPLACE') continue;
      // Kept in an earlier export, REPLACE now: the kept targets come back (Fable, 26 Sept).
      if (mine.length && mine.every((t) => t.kept && !state.done.includes(t.id))) { for (const t of mine) delete t.kept; added += mine.length; continue; }
      if (mine.length) continue;
      const groups = {};
      for (const s of p.slots || []) { const [folder, , time] = s.split('/'); (groups[`${folder}/${time}`] ||= { folder, time, slots: [] }).slots.push(s); }
      for (const g of Object.values(groups)) {
        seq++;
        q.targets.push({ id: `R${String(seq).padStart(2, '0')}`, tier: 2, kind: 'replace', bin: g.folder, folder: g.folder, time: g.time, slots: g.slots,
          why: `replaces: ${p.note}`, note: `it replaces a photo being retired from these spots (${p.note}) — do not repeat its problem`,
          replaces: { sha256: p.sha256, note: p.note, slot: g.slots[0] }, queued: ex.generated });
        added++;
      }
    }
    writeFileSync(targetsPath, JSON.stringify(q, null, 1));
    state.ingested.push(ex.generated);
    saveState();
    log(`Al's meh-photo ruling (${n}): ${added} replacements queued, ${dropped} queued ones dropped (kept)${madeKept.length ? `; already made but kept: ${madeKept.join(', ')} (the wiring session leaves those photos in)` : ''}`);
  }
}

// ---- 4: room on the page, then targets ------------------------------------------------------------------
const waitingNow = Object.values(state.pairs).filter((p) => !p.ruled).length;
if (waitingNow >= MAX_WAITING) { await rebuildPage(); log(`${waitingNow} pairs wait for Al on the rolling page (the limit is ${MAX_WAITING}) — nothing made`); process.exit(0); }
const room = Math.min(PAIRS_PER_RUN, Math.floor(MAX_IMAGES / 2), MAX_WAITING - waitingNow);
const allTargets = J(targetsPath).targets;
const queue = allTargets.map((t, i) => ({ t, i })).filter(({ t }) => !state.done.includes(t.id) && !t.kept && (t.tier ?? 5) < 9)
  .sort((a, b) => (a.t.tier ?? 5) - (b.t.tier ?? 5) || a.i - b.i).map(({ t }) => t);
const targets = queue.slice(0, room);
if (!targets.length) { await rebuildPage(); log('queue empty — nothing made'); process.exit(0); }
const n = state.batches.length + 1;
const dir = path.join(DATA, `batch-${n}`);
mkdirSync(dir, { recursive: true });
const usageBefore = codexUsage();
log(`batch ${n}: ${targets.map((t) => t.id).join(', ')}; Codex weekly usage ${usageBefore ?? '?'} %; ${waitingNow} pairs already waiting; checks took ${Math.round((Date.now() - T0) / 1000)} s`);

// ---- 5: lines (joke first) ----------------------------------------------------------------------------
const recipe = readFileSync(path.join(HERE, 'RECIPE.md'), 'utf8');
const WEATHER_WORDS = { 'rain-possible': 'might rain', 'partly-cloudy': 'partly cloudy', 'cold-clear': 'cold and clear (dry, frosty, bright)', cold: 'cold and wet (Cape winter)', weekend: 'a clear weekend day', night: 'a clear night', uv: 'strong sun' };
const brief = `You write for Probably Weather, a South African weather app. Its home screen shows one photo and one short joke about the weather now. Below is the owner's recipe, from his own grades. Follow it exactly.

${recipe}

For each target below, first write ONE line to the recipe (about the weather now, one twist, spoken straight to the reader, short), then its Afrikaans (natural, conceived in Afrikaans, not word for word), then a photo brief that SETS UP the joke — a real South African scene where the weather is visibly doing something to one subject, caught in a candid reaction — without illustrating the line's words. The photo brief keeps the owner's photo rules (section 3): an aspirational setting (a cared-for home, garden, suburb, town or farm; never a shack, poverty, decay or grit — the stock look is fixed by a candid reaction to the weather, not by a grittier place), clothes and activity that fit the target's day and time, the weather at the target's strength, the subject in the top half of the frame. No weekday, month or season words; no Eskom or load shedding; never describe a photo in the line.

Targets:
${targets.map((t) => `- ${t.id}: weather ${WEATHER_WORDS[t.bin || t.folder] || t.bin || t.folder}, time of day ${t.time}; day ${dayOf(t)}; the photo's weather at its strength: ${STRENGTH[t.folder] || t.folder}${t.meh ? `; it replaces this line the owner found flat: "${t.meh}"` : ''}${t.note ? `; ${t.note}` : ''}`).join('\n')}

Reply with ONLY a JSON array, one object per target: {"id","line","af","twist":"character|exaggeration|confession|SA truth","scene":"place, time, day, weather at its strength, the one subject cast specifically (age, who, clothes for that day), what the weather is doing to them, the cared-for home, garden, suburb, town or farm named","composition":"where the subject sits (upper half) and what fills the calm lower half"}`;
let lines = [];
try {
  if (DRY) lines = targets.map((t) => ({ id: t.id, line: '(dry run)', af: '', scene: '', composition: '' }));
  else {
    const r = codex(brief, { out: path.join(dir, 'writer.txt'), cwd: dir });
    try { lines = firstJson(r.text); } catch (e) { log(`writer reply did not parse: ${e.message}`); process.exit(1); }
  }
} catch (e) { if (e instanceof RateLimited) { backOff(e.message); process.exit(0); } throw e; }

// ---- 6: the recipe filter -----------------------------------------------------------------------------
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
  if (!targets.some((t) => t.id === l.id)) continue;
  const words = String(l.line).split(/\s+/).filter(Boolean).length;
  const why = HARD.filter(([re]) => re.test(l.line)).map(([, w]) => w);
  if (words > 16) why.push(`${words} words`);
  if (bank.has(String(l.line).toLowerCase())) why.push('already in the bank');
  if (why.length && !DRY) { log(`${l.id}: dropped by the recipe filter (${why.join(', ')}): ${l.line}`); continue; }
  kept.push(l);
}

// ---- 7: photos, two takes each (a rate limit keeps what is made and backs off) ------------------------
// Each take is copied out of Codex's own folder (which Codex may prune) into %USERPROFILE%\pw-pairs-job\takes\,
// so the wiring session always has the full-size photograph (Fable, 26 Sept).
let images = 0, limited = null;
const noTakes = [];
const keepDir = path.join(os.homedir(), 'pw-pairs-job', 'takes', `batch-${n}`);
for (const l of kept) {
  if (DRY || limited || images + 2 > MAX_IMAGES) { l.takes = []; continue; }
  if (Date.now() - T0 > PHOTO_BUDGET_MS) { log(`${l.id}: left for the next run (${Math.round((Date.now() - T0) / 60e3)} min in; the photo budget is ${PHOTO_BUDGET_MS / 60e3})`); l.takes = []; continue; }
  try { l.takes = makeTakes(l, targets.find((t) => t.id === l.id), dir); }
  catch (e) { if (!(e instanceof RateLimited)) throw e; limited = e.message; l.takes = []; continue; }
  if (!l.takes.length) noTakes.push(l.id);
  else {
    mkdirSync(keepDir, { recursive: true });
    l.takes = l.takes.map((t, i) => { const to = path.join(keepDir, `${l.id}-${i + 1}.png`); try { copyFileSync(t, to); return to; } catch { return t; } });
  }
  images += l.takes.length;
  log(`${l.id}: ${l.takes.length} takes`);
}
const withTakes = kept.filter((l) => l.takes?.length);
const made = DRY ? [] : withTakes;
const saveBatch = () => {
  writeFileSync(path.join(dir, 'batch.json'), JSON.stringify({ n, made: new Date().toISOString(), writer: WRITER, pairs: made.map((l) => ({ id: l.id, line: l.line, af: l.af, scene: l.scene, composition: l.composition, takes: l.takes, pick: l.pick, judge: l.judge, coversFlag: l.coversFlag, gritFlag: l.gritFlag, fitFlag: l.fitFlag, realOk: l.realOk, anchorY: l.anchorY })) }, null, 1));
  writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ note: 'Who wrote each line. Not on the page.', key: Object.fromEntries(made.map((l) => [l.id, WRITER])) }, null, 1));
};
if (!DRY) {
  saveBatch();
  state.batches.push({ n, made: new Date().toISOString(), page: path.join(REPO, 'review', PAGE_NAME), targets: made.map((l) => l.id), images, usageBefore, usageAfter: null });
  for (const l of made) state.pairs[l.id] = { batch: n, made: new Date().toISOString(), ruled: null };
  // A target is done once its pair is made. One whose line the recipe filter dropped, or whose photos came
  // back empty (not a rate limit), is tried again next run, three tries at most; a pair left without takes by
  // a rate limit or the photo budget stays queued.
  state.attempts ||= {};
  const retry = [...targets.filter((t) => !kept.some((l) => l.id === t.id)).map((t) => t.id), ...noTakes];
  for (const id of retry) state.attempts[id] = (state.attempts[id] || 0) + 1;
  state.done.push(...made.map((l) => l.id), ...retry.filter((id) => state.attempts[id] >= 3));
  saveState();
}

// ---- 8: blind judge ------------------------------------------------------------------------------------
try { if (!limited) judgeAndChoose(withTakes, dir, 'judge.txt', (id) => targets.find((t) => t.id === id)); }
catch (e) { if (!(e instanceof RateLimited)) throw e; limited = e.message; }
if (limited && withTakes.some((l) => l.pick === undefined)) for (const l of withTakes) { l.pick ??= 0; l.judge ??= []; l.realOk ??= false; l.fitFlag ??= 'Not judged: the judge hit a rate limit. Check the takes by eye.'; }

// ---- 9: the batch again (with the judge), then the rolling page -----------------------------------------
const usageAfter = codexUsage();
if (!DRY) {
  saveBatch();
  const rec = state.batches.find((b) => b.n === n);
  if (rec) rec.usageAfter = usageAfter;
  if (!limited && state.backoff) delete state.backoff;
  saveState();
}
if (limited) backOff(limited);
const waitingAfter = await rebuildPage();
log(`batch ${n} ${DRY ? '(dry) ' : ''}done: ${made.length} pairs, ${images} images; ${waitingAfter} pairs waiting on ${PAGE_NAME}; Codex weekly usage ${usageBefore ?? '?'} -> ${usageAfter ?? '?'} %`);
if (!DRY) weeklyStop();
