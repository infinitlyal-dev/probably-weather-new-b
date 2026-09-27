// THE PAIRS JOB — makes line + photo pairs to the recipe, for Al to tick. Hourly (Al, 26 Sept 2026).
// Nothing it makes reaches the app: it writes pairs, checks them and adds them to ONE rolling page, every pair
// pre-marked with the judge's pick; only Al's ticks ship, wired by a later session.
//
// Rewritten 27 Sept 2026 after Al's verdict on batches 2-9: "a Complete and utter fail in creativity. We basically
// got the same theme and setup across almost all of them." Every brief had come off one template (a place, a time,
// one person reacting in front of a cared-for home); the joke never shaped the picture. Now the writer writes the
// picture WITH the line — the joke's own situation — every idea is checked against every photo already in the app
// (live-photos.json) and the rest of the batch before anything is made, and the judge sees the batch side by side.
//
// Each run, in order:
//   1. stops if <data>/PAUSE exists (Al's pause switch; --manual runs once by hand and leaves it in place)
//   2. stops while backing off after a rate limit, or for the week once Codex's weekly usage passed 90 %
//   3. reads Al's exports from Downloads: the newest pairs-rolling-ruled*.json (its pairs and lines leave the page;
//      a pair he ruled No or Neither puts its spot back on the queue) and meh-photos-ruled.json (every photo he
//      left on REPLACE is queued; a queued photo he kept is dropped)
//   4. makes nothing while 40 pairs wait on the page; otherwise takes the next targets from <data>/targets.json
//   5. Sol writes three candidate lines per target, each with its PICTURE (the joke's situation, or none: a mood line)
//   6. the recipe filter drops any line that breaks the hard rules
//   7. the variety check: every idea against the live-photo catalogue, the pairs waiting and the batch, the banned
//      setups, and a mix of subjects across the batch; one idea per target, or the target waits
//   8. Sol makes two takes per chosen idea (built-in image tool, ChatGPT plan), each made for its slot
//   9. Sol judges all the takes side by side, blind to the lines: each photo alone, then lookalikes across the batch
//  10. adds the pairs — and the mood lines, as lines for the bank — to review\pairs-rolling.html
//
//   node run.mjs --data <folder> [--repo <OneDrive working copy>] [--dry] [--manual] [--pairs <n>]
//   node run.mjs --data <folder> --page-only          rebuild the rolling page (no Codex)
//   node run.mjs --data <folder> --remake <plan.json> [--ceiling <percent>]   remake photos for ruled lines
import { spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPage } from './page.mjs';

const T0 = Date.now();                // the 21:00 run of 26 Sept spent 15 min before its first line: timed now
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('--data');
const REPO = arg('--repo', 'C:\\Users\\27741\\OneDrive\\Desktop\\Probably weather new\\probably-weather-new-c');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const DRY = process.argv.includes('--dry');
const MANUAL = process.argv.includes('--manual');   // a run by hand: goes ahead with the PAUSE file in place
const PAIRS_PER_RUN = Number(arg('--pairs', 5));    // about 10 images an hour (Al, 26 Sept 2026)
const MAX_IMAGES = 10;                // two takes each
const MAX_WAITING = 40;               // the job makes no more while 40 pairs wait for Al
const MAX_MOOD_LINES = 5;             // lines without a picture offered for the bank, per run
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
state.pairs ||= {};                   // pair id -> { batch, made, ruled }
state.lines ||= {};                   // mood-line id -> { batch, made, ruled } (lines for the bank, no photo)
state.ingested ||= [];                // `generated` stamps of Al's exports already read
state.requeued ||= {};                // target id -> [{ on, why }]: spots Al sent back for a new pair
state.checks ||= {};                  // check id -> { made, ruled, card }: an Afrikaans proposal on a pair already wired (27 Sept 2026)
const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 1));
const targetsPath = path.join(DATA, 'targets.json');
// A pair's id is its target's id, with a letter when the spot is made again (R04, then R04b, R04c).
const tid = (id) => String(id).replace(/[a-z]+$/, '');
const pairIdFor = (t) => { if (!state.pairs[t.id]) return t.id; for (const c of 'bcdefghijk') if (!state.pairs[`${t.id}${c}`]) return `${t.id}${c}`; throw new Error(`${t.id}: made too often`); };

function firstJson(s) { const a = s.indexOf('['), o = s.indexOf('{'); const i = a >= 0 && (o < 0 || a < o) ? a : o; return JSON.parse(s.slice(i, (i === a ? s.lastIndexOf(']') : s.lastIndexOf('}')) + 1)); }

// Codex's own usage record: the newest "rate_limits" block for the main `codex` limit (not a per-model limit
// such as Spark's), with its weekly window's used % and reset time. (The first version read the last
// "used_percent" of the newest file, which could be another model's limit — 0 % while the real one stood at 83 %.)
// It reads the job's OWN session file after each call (small, finished) and keeps the last reading in state.json;
// only with neither does it scan, and then only recent files under 64 MB. On 26 Sept two runs sat blocked for
// 5-15 minutes with no CPU while the old scan opened the busiest files (a 217 MB session the Codex app keeps
// writing, which the virus scanner re-reads on every open).
function limitsIn(f) {
  let best = null;
  try {
    const fd = openSync(f, 'r');
    const size = fstatSync(fd).size, len = Math.min(size, 4 * 1024 * 1024);
    const buf = Buffer.alloc(len); readSync(fd, buf, 0, len, size - len); closeSync(fd);
    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.includes('"limit_id":"codex"')) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      const rl = ev?.payload?.rate_limits || ev?.rate_limits || ev?.payload?.info?.rate_limits;
      if (!rl || rl.limit_id !== 'codex') continue;
      const weekly = [rl.primary, rl.secondary].find((w) => w && w.window_minutes >= 7 * 24 * 60);
      if (!weekly) continue;
      const ts = Date.parse(ev.timestamp || '') || 0;
      if (!best || ts >= best.ts) best = { ts, used: Number(weekly.used_percent), resetsAt: weekly.resets_at ? weekly.resets_at * 1000 : null, reached: rl.rate_limit_reached_type || null };
    }
  } catch { /* unreadable: no reading */ }
  return best;
}
// Codex files sessions by local date: today's and yesterday's folders are the only ones a fresh call writes to.
function recentSessionDirs() {
  const root = path.join(os.homedir(), '.codex', 'sessions');
  return [0, 1].map((d) => { const t = new Date(Date.now() - d * 864e5); return path.join(root, String(t.getFullYear()), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')); }).filter((d) => existsSync(d));
}
let lastSeen = null;
function noteLimits(thread) {
  if (!thread) return;
  for (const d of recentSessionDirs()) {
    const f = readdirSync(d).find((n) => n.endsWith(`${thread}.jsonl`));
    if (!f) continue;
    const l = limitsIn(path.join(d, f));
    if (l && (!lastSeen || l.ts >= lastSeen.ts)) { lastSeen = l; state.lastLimits = l; }
    return;
  }
}
function codexLimits() {
  if (lastSeen) return lastSeen;
  const saved = state.lastLimits;
  if (saved && Date.now() - saved.ts < 24 * 3600e3 && (!saved.resetsAt || saved.resetsAt > Date.now())) return saved;
  let best = null;
  const files = recentSessionDirs().flatMap((d) => readdirSync(d).filter((n) => n.endsWith('.jsonl')).map((n) => path.join(d, n)))
    .map((f) => { try { const st = statSync(f); return { f, t: st.mtimeMs, size: st.size }; } catch { return null; } })
    .filter((x) => x && x.size < 64 * 1024 * 1024).sort((a, b) => b.t - a.t).slice(0, 8);
  for (const { f } of files) { const l = limitsIn(f); if (l && (!best || l.ts >= best.ts)) best = l; }
  if (best) state.lastLimits = best;
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
  clear: 'pleasant sun: bright and comfortably warm, nobody suffering (not a heat wave: that is the heat folder)',
  heat: 'real heat, 33 °C and up, visibly too hot (not just a nice sunny day)',
  cold: 'cold, wet and grey (Cape winter), not frost',
  'cold-clear': 'cold, dry and bright: frost, breath fogging, a clear sky (not rain)',
  rain: 'steady rain falling now, not a thunderstorm and not after the rain',
  storm: 'a thunderstorm: lightning, a downpour',
  wind: 'strong wind, visibly pushing things and people',
  fog: 'thick fog',
  cloudy: 'overcast, a grey sky, no rain falling',
};
const SETTING = "Aspirational setting (the owner's ruling): cared-for homes, kitchens, gardens, streets, towns, farms, roads and beaches in real South Africa. No shack, no informal settlement, no poverty, decay, litter or graffiti, nothing run-down. The stock look is fixed by a candid moment, never by a grittier place.";
const CASTING = 'Casting across the set (the owner\'s rules): diverse South African casting, named specifically; no red face-brick by default; not coastal or Cape Dutch by default; no romantic couples; no text, signs, logos or number plates; a real place drawn right or not drawn at all (no invented skylines); at night and in frost, people small or turned away.';
const slotWords = (t) => (t ? `${t.folder} weather at its strength: ${STRENGTH[t.folder] || t.folder}; time of day ${t.time}; day ${dayOf(t)}` : 'slot unknown');
const SUBJECTS = ['one person', 'two or three people', 'group', 'animal', 'object', 'vehicle', 'place'];
// Who is cast, for the mix across the set (Al's casting rule: diverse South African casting, named specifically).
// The first test run of the rewrite (27 Sept 2026) picked five ideas that all cast Black South Africans, though the
// writer had offered Indian and Coloured casts too: the batch now keeps its casting mixed.
const CAST_TAGS = ['nobody', 'Black', 'Coloured', 'Indian', 'white', 'mixed'];
const castTagOf = (p) => p.castTag || (!p.cast || /^nobody/i.test(p.cast) ? 'nobody' : /\bcoloured\b/i.test(p.cast) ? 'Coloured' : /\bindian\b/i.test(p.cast) ? 'Indian' : /\bwhite\b/i.test(p.cast) ? 'white' : /\bblack\b|\bzulu\b|\bxhosa\b|\bsotho\b|\btswana\b/i.test(p.cast) ? 'Black' : null);
const SETTINGS = ['garden or lawn', 'gate, door or driveway', 'stoep or patio', 'indoors', 'kitchen', 'street or town', 'road or car', 'farm or veld', 'beach or coast', 'mountain or view', 'park or field', 'other'];
// Al, 27 Sept 2026: "Banned for now".
const BANNED_SETUPS = ['a person outside squinting into the sun (or shielding their eyes)', 'hair or clothes blown about in front of a house', 'a person standing on a lawn in heat', 'a person at their gate or front door'];

// The live-photo catalogue (catalogue.mjs): one line for every photograph in the app, written once and kept.
const CAT = existsSync(path.join(HERE, 'live-photos.json')) ? J(path.join(HERE, 'live-photos.json')) : null;
const catalogueText = () => Object.entries(CAT?.photos || {}).map(([h, p]) => `${h} (${p.folder} ${p.time}): ${p.line}`).join('\n');

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
  noteLimits(thread);
  return { status: r.status, thread, text: out && existsSync(out) ? readFileSync(out, 'utf8') : '' };
}

// The judge sees every take of the batch at once, blind to the lines but told each photo's slot and the picture
// it was meant to show: each photo alone (realism, Al's rules, the banned setups), then the batch side by side
// (lookalikes across pairs) and against the app's own photos.
function judgePrompt(all) {
  return `You are judging ${all.length} photographs for a South African weather app, attached in order and numbered 1 to ${all.length}. Photos made for the same pair are two takes of one idea; different pairs must be different ideas. Each was made for one slot and one intended picture:
${all.map((a, k) => `- ${k + 1}: pair ${a.l.id}; slot: ${slotWords(a.target)}; intended picture: ${a.l.picture || a.l.scene || '(not given)'}`).join('\n')}

The photos already in the app (one line each; the key before the colon):
${catalogueText() || '(none given)'}

Look hard at every person's body (the owner, 27 Sept 2026: "no fucking idea where the limbs are or what they are doing"): where each arm and leg is, how they sit, stand or hold things, whether the pose is physically possible. Anything unclear is a failure.

Reply with JSON only: {"photos": an array of {"n", "realism": 1-5 (5 = indistinguishable from a real camera photo), "waxy": true if any skin looks smoothed, plastic or waxy, "aiTells": short list of visible AI artefacts or [], "gritty": true if it reads as poverty, decay, litter, graffiti or squalor, "aspirational": true only if the setting is cared-for (false for a shack, an informal or run-down place), "dayFit": true only if the clothes and activity suit its slot's day and time (false for work clothes or a work scene on a weekend slot), "weatherFit": true only if the weather's strength matches its slot (false when a clear slot reads as a heat wave, a heat slot reads as a nice day, or cold and frost are swapped), "posed": true if anyone is posing or smiling at the camera, "text": true if any words, letters, signs or logos are visible, "bodies": true only if every person's body makes sense — the right number of arms, legs, hands and fingers, each attached where it belongs, hands holding things the way hands do, a pose a real body can hold while sitting, standing, leaning or reaching; false when anything about a body is unclear or impossible (true when nobody is in the photo), "bodyNote": what is wrong with a body, or "", "shows": true only if the intended picture's key thing is clearly visible, "banned": a list of any of these setups the photo shows, else []: ${BANNED_SETUPS.map((b) => `"${b}"`).join(', ')}, "repeatsApp": the key of the app photo it repeats (the same kind of subject doing the same thing in the same kind of place), or "", "description": one line of at most 18 words saying who or what is in it, doing what, where, how close, "fitNote": one short phrase on what is off, or "", "subjectTop": % of the image height where the main subject starts, "subjectBottom": % where it ends, "calmBottom": true if the bottom third is calm and empty}, "lookalikes": a list of groups of photo numbers from DIFFERENT pairs that read as the same idea or setup side by side (the same kind of subject doing the same kind of thing in the same kind of place), e.g. [[2, 7]], or []}. Judge only what you can see. Do not run commands or read files.`;
}
// The pick: realism first (no waxy skin), then Al's rules (no grit, aspirational, fits its day, weather at the
// folder's strength, a candid moment, no words, shows its picture, no banned setup, no repeat of an app photo),
// then the composition; then, pair by pair, never a take that looks like a pick already made for another pair.
// Home D is Home (26 Sept 2026): its joke sits 55-75 % down the screen, so a subject past 60 % is pre-marked NO.
const fitFails = (m) => [m.gritty && 'gritty', m.aspirational === false && 'not aspirational', m.dayFit === false && 'wrong for its day', m.weatherFit === false && 'wrong weather strength', m.posed && 'posed', m.text && 'words in the picture', m.bodies === false && `a body that does not make sense${m.bodyNote ? ` (${m.bodyNote})` : ''}`, m.shows === false && 'does not show its picture', m.banned?.length && `a banned setup (${m.banned.join('; ')})`, m.repeatsApp && 'repeats a photo in the app', m.subjectBottom > 60 && 'subject in the joke band'].filter(Boolean);
function judgeAndChoose(pairs, cwd, outName, targetOf) {
  const all = pairs.flatMap((l) => (l.takes || []).map((t, i) => ({ l, t, i, target: targetOf(l.id) })));
  let looks = [];
  if (all.length) {
    // Asked twice at most: batch 4's judge (26 Sept) came back empty once and its five pairs went up unjudged.
    let marks = [];
    for (let attempt = 1; attempt <= 2 && !marks.length; attempt++) {
      const jr = codex(judgePrompt(all), { images: all.map((a) => a.t), out: path.join(cwd, outName), cwd });
      try { const r = firstJson(jr.text); marks = Array.isArray(r) ? r : r.photos || []; looks = Array.isArray(r) ? [] : r.lookalikes || []; } catch (e) { log(`judge reply did not parse (try ${attempt} of 2): ${e.message}`); }
    }
    all.forEach((a, k) => { a.n = k + 1; a.m = marks.find((m) => Number(m.n) === k + 1) || null; });
  }
  const lookOf = (n) => looks.filter((g) => Array.isArray(g) && g.map(Number).includes(n)).flat().map(Number).filter((x) => x !== n);
  const chosen = [];
  for (const l of pairs) {
    const mine = all.filter((a) => a.l === l);
    const score = (a) => (a.m ? a.m.realism * 10 - (a.m.waxy ? 20 : 0) - fitFails(a.m).length * 20 - (a.m.aiTells?.length || 0) * 3 + (a.m.calmBottom ? 2 : 0) - (a.m.subjectBottom > 55 ? 5 : 0) : 0);
    const clashWith = (a) => chosen.find((c) => c.l !== l && lookOf(a.n).includes(c.n));
    const ranked = [...mine].sort((a, b) => score(b) - score(a));
    const best = ranked.find((a) => !clashWith(a)) || ranked[0];
    if (best) chosen.push(best);
    l.pick = best ? best.i : null;
    l.judge = mine.map((a) => ({ take: a.i + 1, ...a.m }));
    l.description = best?.m?.description || null;
    const twin = best && clashWith(best);
    l.lookFlag = twin ? `Side by side, the judge reads this as the same idea as ${twin.l.id}'s photo.` : null;
    l.repeatFlag = best?.m?.repeatsApp ? `The judge: the same setup as a photo already in the app${CAT?.photos?.[best.m.repeatsApp] ? ` (${CAT.photos[best.m.repeatsApp].line})` : ` (${best.m.repeatsApp})`}.` : null;
    l.coversFlag = best?.m && best.m.subjectBottom > 60 ? `On Home the joke would sit on the subject: it reaches ${best.m.subjectBottom} % down the frame.` : null;
    l.gritFlag = best?.m?.gritty ? 'The judge reads grit or poverty in it (house rule: positive, no decay or litter).' : null;
    const off = best?.m ? fitFails(best.m).filter((x) => x !== 'gritty' && x !== 'subject in the joke band' && x !== 'repeats a photo in the app') : [];
    l.fitFlag = off.length ? `The judge says: ${off.join(', ')}${best.m.fitNote ? ` (${best.m.fitNote})` : ''}. Al's rules: aspirational settings, clothes that fit the day, weather at the folder's strength, a candid moment, the picture the joke needs, no repeat setups, bodies that make sense.` : null;
    l.realOk = !!(best?.m && !best.m.waxy && best.m.realism >= 4 && !fitFails(best.m).length && !twin);
    l.anchorY = best?.m ? Math.max(15, Math.min(60, Math.round((best.m.subjectTop + best.m.subjectBottom) / 2) - 10)) : 40;
  }
}
// The photo brief for one pair (RECIPE.md section 4): the writer's picture, cast and camera, made for its slot.
// No template: the place, the subject and the camera come from the idea.
const REALISM = 'Realism: a real camera photograph, available light only, slight film grain, true unsaturated colour. Any skin natural, with visible pores, fine lines and small flaws; no retouched or smoothed skin, no glossy sheen, no plastic or waxy faces, no stock-photo lighting.';
function photoPrompt(l, t) {
  const picture = l.picture || l.scene;
  return `Make TWO separate images with your image generation tool: two takes of the same brief, one tool call each. Call the tool with only the prompt argument. If a call fails validation, fix the arguments and call again. Do not run any commands and do not read or write files. Reply with one line when both are made.

BRIEF:
A real camera photograph, not an illustration and not a render. Vertical portrait, 9:16.

The picture: ${picture}
${l.cast ? `Who or what is in it: ${l.cast}\n` : ''}${l.shot ? `Camera: a ${l.shot} shot. ` : ''}${l.composition || ''} The main subject sits in the upper half of the frame; the lower part of the frame is calm, because a line of text is written across it later.

It is the setup for this joke, which is written onto the photo later — the picture shows the joke's situation; put no words in it: "${l.line}"

The slot it is made for: ${slotWords(t)}. The weather shows at exactly that strength, no stronger and no weaker. Clothes and activity fit the slot's day and time.

${SETTING} If a person or an animal is in it, they are caught mid-moment, candid — never posing or looking at the camera.

${REALISM}

Every person's body makes sense: the right number of arms, legs, hands and fingers, each attached where it belongs; hands hold things the way hands do; a pose a real body can hold while sitting, standing, leaning or reaching. Nothing written anywhere: no text, letters, signs, logos, labels or number plates.`;
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
function waiting(kind) {
  const out = [];
  for (const [id, p] of Object.entries(state[kind])) {
    if (p.ruled) continue;
    const b = J(path.join(DATA, `batch-${p.batch}`, 'batch.json'));
    const item = (kind === 'pairs' ? b.pairs : b.lines || []).find((x) => x.id === id);
    if (item) out.push({ ...item, batch: p.batch });
  }
  return out;
}
async function rebuildPage() {
  const pairs = waiting('pairs');
  const lines = waiting('lines');
  const checks = Object.entries(state.checks).filter(([, c]) => !c.ruled).map(([id, c]) => ({ id, ...c.card }));
  const page = await buildPage({ kept: pairs, lines, checks, targets: J(targetsPath).targets, sharp, repo: REPO, maxWaiting: MAX_WAITING });
  if (!DRY) writeFileSync(path.join(REPO, 'review', PAGE_NAME), page);
  return pairs.length;
}

// --page-only: rebuild the rolling page from the saved batches (no Codex).
if (process.argv.includes('--page-only')) { log(`page rebuilt: ${await rebuildPage()} pairs waiting`); process.exit(0); }
// --rejudge <n>: judge a batch's takes again (a judge that failed) and rebuild the page; makes no new images.
if (process.argv.includes('--rejudge')) {
  const rn = Number(arg('--rejudge'));
  const bdir = path.join(DATA, `batch-${rn}`);
  const b = J(path.join(bdir, 'batch.json'));
  const tAll = J(targetsPath).targets;
  judgeAndChoose(b.pairs, bdir, 'judge-again.txt', (id) => tAll.find((t) => t.id === tid(id)));
  writeFileSync(path.join(bdir, 'batch.json'), JSON.stringify(b, null, 1));
  saveState();
  log(`batch ${rn}: judged again (${b.pairs.map((p) => `${p.id} ${p.pick == null ? 'no pick' : `take ${p.pick + 1}`}${p.realOk ? '' : ' NO'}`).join(', ')}); page: ${await rebuildPage()} pairs waiting`);
  process.exit(0);
}

// --remake <plan.json>: remake the photos of pairs whose lines Al has already ruled (their photos were out).
// The plan: { name, pairs: [{ id, line, af, scene | picture, composition, target: { folder, time, slots } }] }. Two
// takes each with this job's photo brief, judged the same way; writes <data>/remakes/<name>/batch.json (resumable)
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
if (existsSync(path.join(DATA, 'PAUSE'))) {
  if (!MANUAL) { log('paused by Al (PAUSE file) — nothing made'); process.exit(0); }
  log('run by hand (--manual): the PAUSE file stays, so nothing runs on its own afterwards');
}
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
// The rolling page: the NEWEST export is read (every pair and line on the page when he pressed Export is ruled; his
// pre-marked picks stand where he changed nothing). Browsers name repeat downloads "pairs-rolling-ruled (1).json"
// or "pairs-rolling-ruled(1).json"; an older export not yet read is superseded by the newer one (Al, 27 Sept 2026:
// three exports in a row, "the newest of three … the other two are earlier and differ, so ignore them").
// A pair he ruled No, or Neither take, sends its spot back to the queue for a new idea (twice at most).
mkdirSync(path.join(DATA, 'rolling-ruled'), { recursive: true });
function requeue(id, why) {
  const q = J(targetsPath);
  const t = q.targets.find((x) => x.id === id);
  if (!t || t.kept || !['replace', 'thin'].includes(t.kind)) return false;
  const n = (state.requeued[id] ||= []).length;
  if (n >= 2) { log(`${id}: not queued again (sent back ${n} times already) — it waits for a session`); return false; }
  state.requeued[id].push({ on: new Date().toISOString(), why });
  state.done = state.done.filter((x) => x !== id);
  return true;
}
const rollingExports = readdirSync(DOWNLOADS).filter((n) => /^pairs-rolling-ruled ?(\(\d+\))?\.json$/.test(n))
  .map((n) => { try { return { n, ex: J(path.join(DOWNLOADS, n)) }; } catch { return null; } })
  .filter((x) => x?.ex?.generated && !state.ingested.includes(x.ex.generated))
  .sort((a, b) => Date.parse(b.ex.generated) - Date.parse(a.ex.generated));
if (rollingExports.length) {
  const [{ n: f, ex }, ...older] = rollingExports;
  copyFileSync(path.join(DOWNLOADS, f), path.join(DATA, 'rolling-ruled', `${ex.generated.replace(/[:.]/g, '-')}.json`));
  const ids = (ex.pairs || []).map((p) => p.id).filter((id) => state.pairs[id] && !state.pairs[id].ruled);
  for (const id of ids) state.pairs[id].ruled = ex.generated;
  const lineIds = (ex.lines || []).map((l) => l.id).filter((id) => state.lines[id] && !state.lines[id].ruled);
  for (const id of lineIds) state.lines[id].ruled = ex.generated;
  const checkIds = (ex.afChecks || []).map((c) => c.id).filter((id) => state.checks[id] && !state.checks[id].ruled);
  for (const id of checkIds) state.checks[id].ruled = ex.generated;
  const back = (ex.pairs || []).filter((p) => ids.includes(p.id) && (p.use === 'NO' || p.take === 'NEITHER') && requeue(tid(p.id), `Al: ${p.use === 'NO' ? 'No' : 'neither take'} on ${p.id} (${ex.generated})`)).map((p) => tid(p.id));
  state.ingested.push(ex.generated, ...older.map((o) => o.ex.generated));
  saveState();
  log(`Al ruled ${ids.length} pairs, ${lineIds.length} lines and ${checkIds.length} Afrikaans checks on the rolling page (${f}); copied to rolling-ruled/ for the wiring session${back.length ? `; back on the queue: ${back.join(', ')}` : ''}${older.length ? `; older exports not read (superseded): ${older.map((o) => o.n).join(', ')}` : ''}`);
}
// The meh-photo page: REPLACE queues a pair for the photo's spots; KEEP drops it if not yet made.
ingestMeh();
function ingestMeh() {
  const files = readdirSync(DOWNLOADS).filter((n) => /^meh-photos-ruled ?(\(\d+\))?\.json$/.test(n))
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
          if (state.done.includes(t.id)) { madeKept.push(t.id); t.kept = ex.generated; }   // the page says so
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
if (!CAT?.photos || !Object.keys(CAT.photos).length) { await rebuildPage(); log('WARNING: live-photos.json (the catalogue of the app\'s photos) is missing — the variety check cannot run, so nothing is made. Run catalogue.mjs and reinstall.'); process.exit(0); }
const room = Math.min(PAIRS_PER_RUN, Math.floor(MAX_IMAGES / 2), MAX_WAITING - waitingNow);
const allTargets = J(targetsPath).targets;
const queue = allTargets.map((t, i) => ({ t, i })).filter(({ t }) => !state.done.includes(t.id) && !t.kept && (t.tier ?? 5) < 9)
  .sort((a, b) => (a.t.tier ?? 5) - (b.t.tier ?? 5) || a.i - b.i).map(({ t }) => t);
// Two spare targets are written too: a target whose ideas all fail the variety check leaves room for the next.
const SPARES = 2;
const targets = queue.slice(0, room + SPARES);
if (!targets.length) { await rebuildPage(); log('queue empty — nothing made'); process.exit(0); }
const n = state.batches.length + 1;
const dir = path.join(DATA, `batch-${n}`);
mkdirSync(dir, { recursive: true });
const usageBefore = codexUsage();
log(`batch ${n}: ${targets.map((t) => t.id).join(', ')}; Codex weekly usage ${usageBefore ?? '?'} %; ${waitingNow} pairs already waiting; checks took ${Math.round((Date.now() - T0) / 1000)} s`);

// Everything the job has made before (its own batches): casting is tracked across the whole set, and a line it
// has already written is never offered twice.
const madeBefore = state.batches.flatMap((b) => { try { const d = J(path.join(DATA, `batch-${b.n}`, 'batch.json')); return [...d.pairs, ...(d.lines || [])]; } catch { return []; } });
const waitingPictures = waiting('pairs').map((p) => `${p.id} (${p.subject || '?'}, ${p.setting || '?'}): ${p.picture || p.scene}`);
const tally = (key) => {
  const c = {};
  for (const p of Object.values(CAT.photos)) if (p[key]) c[p[key]] = (c[p[key]] || 0) + 1;
  for (const p of madeBefore) if (p[key]) c[p[key]] = (c[p[key]] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
};
const recentCasts = madeBefore.filter((p) => p.cast && p.cast !== 'nobody').slice(-15).map((p) => p.cast);
// The lines a reader of these weathers already sees (the bank) and every line the job has written: a new line must
// not repeat one's formula or joke. Al, 27 Sept 2026: "Where lines share a formula ('clocked in', 'arguing with',
// 'before you', 'knows where you live'), keep only the best one". (The first test run of this job wrote "Daylight
// beat your alarm again." beside the bank's "The sun clocked in before your alarm even tried.")
let BANK = {};
try { BANK = (await import(pathToFileURL(path.join(REPO, 'assets', 'weather-copy.js')).href)).WEATHER_COPY.witty || {}; } catch { log('WARNING: the line bank did not load — lines are checked against the job\'s own lines only'); }
const seenLines = [
  ...[...new Set(targets.map((t) => t.bin || t.folder))].flatMap((b) => (BANK[b]?.en || []).map((line, i) => ({ key: `${b}#${i}`, line }))),
  ...madeBefore.filter((p) => p.line).map((p) => ({ key: p.id, line: p.line })),
];
const USED_FORMULAS = ['X clocked in / started its shift / is working overtime', 'X was up, awake or here before you / beat your alarm / got here first or early', 'X is arguing with you / picked a fight with / wins the argument', 'X knows where you live', 'X is keeping Y to itself', 'X put Y on mute', 'X is behaving (itself)', 'X has no off switch', 'X should pay rent / you pay rent in Y', 'X is showing off', 'X saved its best for last', 'X sent Y home early / has no plans to go home', 'this heat has fired, evicted or sacked something from your bed', 'X took the last of your dignity'];

// ---- 5: three candidate lines per target, each with its picture (or none: a mood line) --------------------
const recipe = readFileSync(path.join(HERE, 'RECIPE.md'), 'utf8');
const WEATHER_WORDS = { 'rain-possible': 'might rain', 'partly-cloudy': 'partly cloudy', 'cold-clear': 'cold and clear (dry, frosty, bright)', cold: 'cold and wet (Cape winter)', weekend: 'a clear weekend day', night: 'a clear night', uv: 'strong sun' };
const brief = `You write for Probably Weather, a South African weather app. Its home screen shows one photo with one short joke written across it. Below is the owner's recipe, from his own grades. Follow it exactly.

${recipe}

THE TASK: for each target below, write THREE different candidate lines for its weather, each to the recipe (about the weather now, one twist, straight to the reader, short), each with its Afrikaans (natural, conceived in Afrikaans, not word for word), and — written together with the line — its PICTURE.

THE LINE STANDS ON ITS OWN (the owner, 27 Sept 2026). Every line names the weather and works without its photo. Before you answer, read each line with no picture in mind: if it only makes sense with the picture, rewrite it. "Even the ice tray looks nervous." fails; "It's so hot even the ice tray looks nervous." passes. "The sun has reserved the passenger seat." fails (too vague on its own); "The sun is turning your car seat into a snackwich machine." passes. The photo makes the joke funnier; it never carries it.

The picture is the joke's own situation, caught by a real camera: the thing the line talks about, happening. The owner's pairs that worked: "The wind took the washing. It's keeping the pegs." (a washing line with every peg still clipped on and nothing left on it, one shirt sailing off out of reach); "Rain this hard, even the taxis start indicating." (a minibus taxi in a downpour, its indicator blinking); "This heat has fired the cold side of your pillow." (a pillow flipped over on a rumpled bed on a hot night, a fan aimed at it). Some lines are pure mood with nothing to show ("The sky's keeping tonight to itself."): they are fine lines — give them "picture": null. They go to the owner as lines for the bank, with no photo made.

VARIETY — why the job was rewritten. The owner rejected a whole run: "We basically got the same theme and setup across almost all of them." Nearly every photo was one person outside a house reacting to the weather. So:
- Never these setups (banned for now): ${BANNED_SETUPS.join('; ')}.
- Never repeat a setup the app already has (the same kind of subject doing the same kind of thing in the same kind of place): LIVE PHOTOS below, and the PAIRS WAITING for the owner.
- Mix the subject: objects, animals, cars and bakkies, kitchens and indoors, groups, close-ups, wide shots — single people too, but not by default. Give each target's three candidates three different subjects and settings.
- COUNTS below says what the set already leans on; reach for what it has least of. Vary who is cast (age, who they are, what they are doing) away from the RECENT CASTS.

The owner's photo rules still hold for every picture: the weather at the target's strength; clothes and activity that fit its day and time; a person or animal in it caught mid-moment, candid, never posing; the main subject in the upper half with calm space below (the joke is written there); ${SETTING} ${CASTING}

No weekday, month or season words; no Eskom or load shedding; never describe the photo in the line.

LINES — no near-repeats. The owner: where lines share a formula, only the best one stays. These formulas are used up; never write another: ${USED_FORMULAS.join('; ')}. Never repeat the formula or the joke of a line in LINES ALREADY WRITTEN below (the lines readers already see for these weathers, and every line this job has written), and never reuse a line from the recipe's own examples.

TARGETS:
${targets.map((t) => `- ${t.id}: weather ${WEATHER_WORDS[t.bin || t.folder] || t.bin || t.folder}, time of day ${t.time}; day ${dayOf(t)}; the photo's weather at its strength: ${STRENGTH[t.folder] || t.folder}${t.meh ? `; it replaces this line the owner found flat: "${t.meh}"` : ''}${t.replaces ? `; it replaces a photo the owner found flat (${t.replaces.note})` : ''}${state.requeued[t.id]?.length ? '; the owner already turned down a pair for this spot because its photo was the same setup as the rest' : ''}`).join('\n')}

LIVE PHOTOS (the app's photos, one line each):
${catalogueText()}

PAIRS WAITING FOR THE OWNER:
${waitingPictures.join('\n') || '(none)'}

COUNTS (the app's photos and the job's pairs so far):
subjects: ${tally('subject')}
settings: ${tally('setting')}
shots: ${tally('shot')}
casts (the job's pairs): ${(() => { const c = {}; for (const p of madeBefore) { const k = castTagOf(p); if (k) c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '(none yet)'; })()}
RECENT CASTS: ${recentCasts.join(' | ') || '(none yet)'}

LINES ALREADY WRITTEN:
${seenLines.map((s) => s.line).join('\n')}

Reply with ONLY a JSON array, one object per candidate (three per target): {"id": the target id, "cand": 1, 2 or 3, "line", "af", "twist": "character|exaggeration|confession|SA truth", "picture": the joke's situation as the camera catches it — what is in the frame and what the weather is doing to it — or null for a mood line, "subject": one of ${SUBJECTS.map((s) => `"${s}"`).join(' | ')}, "setting": one of ${SETTINGS.map((s) => `"${s}"`).join(' | ')}, "shot": "close-up" | "medium" | "wide", "cast": who is in it (age, who they are, what they wear for the slot's day and time) or "nobody", "castTag": one of ${CAST_TAGS.map((s) => `"${s}"`).join(' | ')}, "composition": what sits in the upper half and what fills the calm lower part}`;
let cands = [];
try {
  if (DRY) cands = targets.map((t) => ({ id: t.id, cand: 1, line: '(dry run)', af: '', picture: '(dry run)', subject: 'object', setting: 'other', shot: 'medium', cast: 'nobody', composition: '' }));
  else {
    const r = codex(brief, { out: path.join(dir, 'writer.txt'), cwd: dir });
    try { cands = firstJson(r.text); } catch (e) { log(`writer reply did not parse: ${e.message}`); process.exit(1); }
  }
} catch (e) { if (e instanceof RateLimited) { backOff(e.message); process.exit(0); } throw e; }
cands = cands.filter((c) => targets.some((t) => t.id === c.id) && c.line);
for (const c of cands) { if (c.picture === 'null' || c.picture === '') c.picture = null; }

// ---- 6: the recipe filter -----------------------------------------------------------------------------
const HARD = [
  [/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|summer|winter|spring|autumn|christmas|easter|holiday)\b/i, 'names the calendar'],
  [/eskom|load.?shed/i, 'Eskom / load shedding'],
  [/^(he|she|they|his|her|their)\b|\b(he|she)\b/i, 'describes a person in a photo'],
  [/\bvibes?\b/i, '"vibes"'],
];
const bank = new Set();
try { const W = readFileSync(path.join(REPO, 'assets', 'weather-copy.js'), 'utf8'); for (const m of W.matchAll(/"([^"]{8,})"/g)) bank.add(m[1].toLowerCase()); } catch {}
for (const p of madeBefore) if (p.line) bank.add(String(p.line).toLowerCase());
for (const c of cands) {
  const words = String(c.line).split(/\s+/).filter(Boolean).length;
  const why = HARD.filter(([re]) => re.test(c.line)).map(([, w]) => w);
  if (words > 16) why.push(`${words} words`);
  if (bank.has(String(c.line).toLowerCase())) why.push('already written');
  c.dropWhy = why.length && !DRY ? why.join(', ') : null;
  if (c.dropWhy) log(`${c.id}/${c.cand}: dropped by the recipe filter (${c.dropWhy}): ${c.line}`);
}

// ---- 7: the variety check, before anything is made --------------------------------------------------------
// (a) the banned setups, read off the picture itself — a backstop for the plainest wordings only; Sol's check
// below reads the setups by meaning. A clause that says what is NOT in the picture ("he is not at a gate") is
// dropped first: the first version banned such an idea on its own disclaimer (27 Sept 2026, R22/1).
const PERSON = /person|people|group|two or three/;
function bannedIn(c) {
  const p = String(c.picture || '').replace(/\b(not|never|no|without|nor)\b[^.;]*/gi, ' ');
  const out = [];
  const someone = PERSON.test(c.subject || '');
  if (/\bsquint\w*|shield\w* (his|her|their) eyes|sun in (his|her|their) eyes/i.test(p)) out.push(BANNED_SETUPS[0]);
  if (someone && (c.setting === 'gate, door or driveway' || /\bat (his|her|their|the) (front )?(gate|door)\b|\bin (his|her|their) doorway\b|\bon (his|her|their) doorstep\b/i.test(p))) out.push(BANNED_SETUPS[3]);
  return out;
}
for (const c of cands) c.banned = c.picture ? bannedIn(c) : [];
// (b) Sol reads every idea against the catalogue, the pairs waiting and the other ideas, and every line against the
// lines already written (text only). A mood line (no picture) is checked for its line alone.
const ideas = cands.filter((c) => c.picture && !c.dropWhy);
const checked = cands.filter((c) => !c.dropWhy);
let verdicts = [];
if (checked.length && !DRY) {
  const vprompt = `You check new ideas for a South African weather app — a short joke line, usually with a photo idea — against what the app already has, so it never shows the same setup or the same joke twice.

PHOTOS. A setup is the same when it is the same kind of subject doing the same kind of thing in the same kind of place: a woman shielding her eyes on a lawn and a man squinting in his garden are the same setup; a dog asleep under a table and a woman at a window are not; two different people each hurrying down a street in the rain are the same setup. Banned setups (any idea that is one of these is "banned"): ${BANNED_SETUPS.join('; ')}.

LINES. A line repeats another when it uses the same formula or makes the same joke, even in other words or about other weather: "The sun clocked in angry." and "The cold's clocked in early." share a formula; "Daylight beat your alarm again." repeats "The sun clocked in before your alarm even tried."; "The wind's arguing with everything you own." repeats "The wind's arguing with everyone. You're next." Formulas already used up: ${USED_FORMULAS.join('; ')}.

THE LINE ON ITS OWN. Read each new line WITHOUT its picture. It passes only if it names the weather (or what the weather is doing) and makes sense by itself; it fails if it only works once you have seen the photo. "Even the ice tray looks nervous." fails; "It's so hot even the ice tray looks nervous." passes. "The sun has reserved the passenger seat." fails (vague on its own); "The sun is turning your car seat into a snackwich machine." passes.

LIVE PHOTOS (key: line):
${catalogueText()}

PAIRS WAITING (key: picture):
${waitingPictures.join('\n') || '(none)'}

LINES ALREADY WRITTEN (key: line):
${seenLines.map((s) => `${s.key}: ${s.line}`).join('\n')}

NEW IDEAS (key: line | picture | subject | setting | shot):
${checked.map((c) => `${c.id}/${c.cand}: ${c.line} | ${c.picture || '(no picture: a line for the bank)'} | ${c.subject || ''} | ${c.setting || ''} | ${c.shot || ''}`).join('\n')}

For every new idea reply with JSON only, an array of {"key": "<id>/<cand>", "verdict": "ok" | "repeat" | "banned" (for the photo idea; "ok" when there is no picture), "same_as": the key of the live photo or waiting pair it repeats, or "", "like": the keys of other NEW ideas (for other targets) whose photo idea is the same setup as this one, or [], "line_same_as": the key of a line already written, or of another NEW idea, whose formula or joke this line repeats, or "", "line_alone": true if the line names the weather and makes sense without its picture, false if it needs the photo, "alone_why": a short phrase when false, else "", "why": a short phrase}. Do not run commands or read files.`;
  try {
    const vr = codex(vprompt, { out: path.join(dir, 'variety.txt'), cwd: dir });
    try { verdicts = firstJson(vr.text); } catch (e) { log(`variety check did not parse: ${e.message} — nothing made this run (the check comes first)`); await rebuildPage(); process.exit(1); }
  } catch (e) { if (e instanceof RateLimited) { backOff(e.message); process.exit(0); } throw e; }
}
for (const c of checked) {
  const v = verdicts.find((x) => x.key === `${c.id}/${c.cand}`);
  c.variety = v || { verdict: 'unchecked' };
  if (c.picture && v?.verdict === 'banned' && !c.banned.length) c.banned.push(v.why || 'a banned setup');
  // Two new ideas that repeat each other's line: the later one gives way (the earlier stays eligible).
  const sameAs = String(v?.line_same_as || '');
  const other = checked.find((x) => `${x.id}/${x.cand}` === sameAs);
  c.lineRepeat = sameAs && !(other && (other.id > c.id || (other.id === c.id && other.cand > c.cand))) ? sameAs : null;
  // The line on its own (Al, 27 Sept 2026): a line that needs its picture is not made, photo or not.
  c.needsPhoto = v && v.line_alone === false ? (v.alone_why || 'the line only works with its picture') : null;
}
// (c) one idea per target, in queue order: a picture, through the filter, no banned setup, no repeat, not like an
// idea already picked, and the batch keeps its mix (at most 2 of any subject, 2 in one setting, 1 in a garden or
// at a gate; never the same subject in the same setting twice). A target with no such idea waits for the next run.
const CAPS = { subject: 2, setting: 2, 'garden or lawn': 1, 'gate, door or driveway': 1, cast: 2 };
const chosen = [];
// A run with room for fewer than five counts the newest pairs waiting on the page into its mix, so any five pairs
// side by side keep the caps (the remake of 27 Sept 2026 made three beside two already waiting).
const MIX = 5;
const prior = waiting('pairs').slice(-Math.max(0, MIX - room));
const inMix = () => [...prior, ...chosen];
const reached = [];
const passes = (c) => c.picture && !c.dropWhy && !c.banned.length && !c.lineRepeat && !c.needsPhoto && (DRY || c.variety?.verdict === 'ok');
for (const t of targets) {
  if (chosen.length >= room) break;                     // the spares are used only while there is room
  reached.push(t.id);
  const mine = ideas.filter((c) => c.id === t.id && passes(c)).sort((a, b) => a.cand - b.cand);
  const fits = (c) => inMix().filter((x) => x.subject === c.subject).length < CAPS.subject
    && inMix().filter((x) => x.setting === c.setting).length < (CAPS[c.setting] ?? CAPS.setting)
    && !inMix().some((x) => x.subject === c.subject && x.setting === c.setting)
    && (!castTagOf(c) || ['nobody', 'mixed'].includes(castTagOf(c)) || inMix().filter((x) => castTagOf(x) === castTagOf(c)).length < CAPS.cast)
    && !chosen.some((x) => (c.variety?.like || []).includes(`${x.id}/${x.cand}`) || (x.variety?.like || []).includes(`${c.id}/${c.cand}`));
  const pick = mine.find(fits);
  if (pick) chosen.push(pick);
}
for (const c of cands.filter((x) => x.picture && !chosen.includes(x))) {
  const lineRepeat = c.lineRepeat ? `the line repeats ${c.lineRepeat}${seenLines.find((s) => s.key === c.lineRepeat) ? ` ("${seenLines.find((s) => s.key === c.lineRepeat).line}")` : ''}` : null;
  const why = c.dropWhy ? `filter: ${c.dropWhy}` : c.banned.length ? `banned: ${c.banned.join('; ')}` : lineRepeat ? lineRepeat
    : c.needsPhoto ? `the line does not stand on its own (${c.needsPhoto})`
    : c.variety?.verdict !== 'ok' ? `${c.variety?.verdict || 'unchecked'}${c.variety?.same_as ? ` of ${c.variety.same_as}` : ''} (${c.variety?.why || ''})`
    : !reached.includes(c.id) ? 'a spare target, not needed this run' : chosen.some((x) => x.id === c.id) ? 'another idea for its target was picked' : 'it would break the batch mix';
  log(`${c.id}/${c.cand}: not made — ${why}: ${c.picture}`);
}
const skipped = reached.filter((id) => !chosen.some((c) => c.id === id));
if (skipped.length) log(`no idea passed the variety check for ${skipped.join(', ')} — they wait for the next run`);
// Mood lines: the lines with no picture, offered to Al for the bank (no photo made).
const moodLines = cands.filter((c) => !c.picture && !c.dropWhy && !c.lineRepeat && !c.needsPhoto && (DRY || c.variety)).slice(0, MAX_MOOD_LINES).map((c, k) => ({ id: `B${n}-${k + 1}`, target: c.id, bin: targets.find((t) => t.id === c.id)?.bin, time: targets.find((t) => t.id === c.id)?.time, line: c.line, af: c.af, twist: c.twist }));
for (const c of chosen) { c.target = c.id; c.id = pairIdFor(targets.find((t) => t.id === c.target)); }

// ---- 8: photos, two takes each (a rate limit keeps what is made and backs off) ------------------------
// Each take is copied out of Codex's own folder (which Codex may prune) into %USERPROFILE%\pw-pairs-job\takes\,
// so the wiring session always has the full-size photograph (Fable, 26 Sept).
let images = 0, limited = null;
const noTakes = [];
const keepDir = path.join(os.homedir(), 'pw-pairs-job', 'takes', `batch-${n}`);
const targetOf = (id) => allTargets.find((t) => t.id === tid(id));
for (const l of chosen) {
  if (DRY || limited || images + 2 > MAX_IMAGES) { l.takes = []; continue; }
  if (Date.now() - T0 > PHOTO_BUDGET_MS) { log(`${l.id}: left for the next run (${Math.round((Date.now() - T0) / 60e3)} min in; the photo budget is ${PHOTO_BUDGET_MS / 60e3})`); l.takes = []; continue; }
  try { l.takes = makeTakes(l, targetOf(l.id), dir); }
  catch (e) { if (!(e instanceof RateLimited)) throw e; limited = e.message; l.takes = []; continue; }
  if (!l.takes.length) noTakes.push(l.target);
  else {
    mkdirSync(keepDir, { recursive: true });
    l.takes = l.takes.map((t, i) => { const to = path.join(keepDir, `${l.id}-${i + 1}.png`); try { copyFileSync(t, to); return to; } catch { return t; } });
  }
  images += l.takes.length;
  log(`${l.id}: ${l.takes.length} takes (${l.subject}, ${l.setting}, ${l.shot})`);
}
const withTakes = chosen.filter((l) => l.takes?.length);
const made = DRY ? [] : withTakes;
const saveBatch = () => {
  writeFileSync(path.join(dir, 'batch.json'), JSON.stringify({ n, made: new Date().toISOString(), writer: WRITER,
    pairs: made.map((l) => ({ id: l.id, target: l.target, line: l.line, af: l.af, twist: l.twist, picture: l.picture, subject: l.subject, setting: l.setting, shot: l.shot, cast: l.cast, castTag: castTagOf(l), composition: l.composition, takes: l.takes, pick: l.pick, judge: l.judge, description: l.description, lookFlag: l.lookFlag, repeatFlag: l.repeatFlag, coversFlag: l.coversFlag, gritFlag: l.gritFlag, fitFlag: l.fitFlag, realOk: l.realOk, anchorY: l.anchorY })),
    lines: DRY ? [] : moodLines,
    considered: cands.map((c) => ({ key: `${c.target || c.id}/${c.cand}`, line: c.line, picture: c.picture, subject: c.subject, setting: c.setting, shot: c.shot, castTag: castTagOf(c), dropWhy: c.dropWhy, banned: c.banned, variety: c.variety, lineRepeat: c.lineRepeat, needsPhoto: c.needsPhoto, chosen: chosen.includes(c) })) }, null, 1));
  writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ note: 'Who wrote each line. Not on the page.', key: Object.fromEntries([...made, ...moodLines].map((l) => [l.id, WRITER])) }, null, 1));
};
if (!DRY) {
  saveBatch();
  state.batches.push({ n, made: new Date().toISOString(), page: path.join(REPO, 'review', PAGE_NAME), targets: made.map((l) => l.id), lines: moodLines.map((l) => l.id), images, usageBefore, usageAfter: null });
  for (const l of made) state.pairs[l.id] = { batch: n, made: new Date().toISOString(), ruled: null };
  for (const l of moodLines) state.lines[l.id] = { batch: n, made: new Date().toISOString(), ruled: null };
  // A target is done once its pair is made. One with no idea through the checks, or whose photos came back
  // empty (not a rate limit), is tried again next run, three tries at most; one left without takes by a rate
  // limit or the photo budget stays queued.
  state.attempts ||= {};
  const retry = [...skipped, ...noTakes];
  for (const id of retry) state.attempts[id] = (state.attempts[id] || 0) + 1;
  state.done.push(...made.map((l) => l.target), ...retry.filter((id) => state.attempts[id] >= 3));
  saveState();
}

// ---- 9: the judge, the whole batch side by side ----------------------------------------------------------
try { if (!limited) judgeAndChoose(withTakes, dir, 'judge.txt', targetOf); }
catch (e) { if (!(e instanceof RateLimited)) throw e; limited = e.message; }
if (limited && withTakes.some((l) => l.pick === undefined)) for (const l of withTakes) { l.pick ??= 0; l.judge ??= []; l.realOk ??= false; l.fitFlag ??= 'Not judged: the judge hit a rate limit. Check the takes by eye.'; }

// ---- 10: the batch again (with the judge), then the rolling page -----------------------------------------
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
log(`batch ${n} ${DRY ? '(dry) ' : ''}done: ${made.length} pairs (${made.map((l) => `${l.id} ${l.subject}/${l.setting}/${l.shot}`).join('; ')}), ${images} images, ${moodLines.length} lines for the bank; ${waitingAfter} pairs waiting on ${PAGE_NAME}; Codex weekly usage ${usageBefore ?? '?'} -> ${usageAfter ?? '?'} %`);
if (!DRY) weeklyStop();
