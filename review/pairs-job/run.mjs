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
//   7. Sol makes two takes per pair (built-in image tool, ChatGPT plan); images are capped per run
//   8. Sol judges the takes blind (realism, waxy look, where the subject sits); the job picks one and
//      flags any whose subject sits where the joke goes (below ~55 % of the frame)
//   9. writes review\pairs-batch-<n>.html (every item pre-marked with the job's pick) and records the batch
//
//   node run.mjs --data <folder> [--repo <OneDrive working copy>] [--dry]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function codex(prompt, { images = [], out } = {}) {
  const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'read-only', '-m', WRITER, '-c', 'model_reasoning_effort="low"'];
  for (const i of images) args.push('-i', i);
  if (out) args.push('-o', out);
  args.push('-');
  // Codex's own script through node, no shell: the data folder's path has spaces.
  const r = spawnSync(process.execPath, [CODEX_JS, ...args], { input: prompt, cwd: dir, encoding: 'utf8', timeout: 15 * 60000, maxBuffer: 64 * 1024 * 1024 });
  const thread = (/"thread_id":"([^"]+)"/.exec(r.stdout || '') || [])[1] || null;
  return { status: r.status, thread, text: out && existsSync(out) ? readFileSync(out, 'utf8') : '' };
}
const firstJson = (s) => { const a = s.indexOf('['), o = s.indexOf('{'); const i = a >= 0 && (o < 0 || a < o) ? a : o; return JSON.parse(s.slice(i, (i === a ? s.lastIndexOf(']') : s.lastIndexOf('}')) + 1)); };

// ---- 5: lines (joke first) ----------------------------------------------------------------------
const recipe = readFileSync(path.join(HERE, 'RECIPE.md'), 'utf8');
const WEATHER_WORDS = { 'rain-possible': 'might rain', 'partly-cloudy': 'partly cloudy', 'cold-clear': 'cold and clear (dry, frosty, bright)', cold: 'cold and wet (Cape winter)', weekend: 'a clear weekend day', night: 'a clear night', uv: 'strong sun' };
const brief = `You write for Probably Weather, a South African weather app. Its home screen shows one photo and one short joke about the weather now. Below is the owner's recipe, from his own grades. Follow it exactly.

${recipe}

For each target below, first write ONE line to the recipe (about the weather now, one twist, spoken straight to the reader, short), then its Afrikaans (natural, conceived in Afrikaans, not word for word), then a photo brief that SETS UP the joke — a real South African scene where the weather is visibly doing something to one subject — without illustrating the line's words. No weekday, month or season words; no Eskom or load shedding; never describe a photo in the line.

Targets:
${targets.map((t) => `- ${t.id}: weather ${WEATHER_WORDS[t.bin || t.folder] || t.bin || t.folder}, time of day ${t.time}${t.meh ? `; it replaces this line the owner found flat: "${t.meh}"` : ''}${t.note ? `; ${t.note}` : ''}`).join('\n')}

Reply with ONLY a JSON array, one object per target: {"id","line","af","twist":"character|exaggeration|confession|SA truth","scene":"place, time, weather, the one subject cast specifically (age, who), what the weather is doing to them, the architecture named","composition":"where the subject sits (upper half) and what fills the calm bottom third"}`;
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
const REALISM = 'Realism: natural skin with visible pores, fine lines and small flaws; a candid, unposed moment caught mid-action; available light only; slight film grain; true, unsaturated colour. No retouched or smoothed skin, no glossy sheen, no plastic or waxy faces, no stock-photo lighting, nobody posing or smiling at the camera.';
let images = 0;
for (const l of kept) {
  if (DRY || images + 2 > MAX_IMAGES) { l.takes = []; continue; }
  const prompt = `Make TWO separate images with your image generation tool: two takes of the same brief, one tool call each. Call the tool with only the prompt argument. If a call fails validation, fix the arguments and call again. Do not run any commands and do not read or write files. Reply with one line when both are made.

BRIEF:
A real camera photograph, not an illustration and not a render. Vertical portrait, 9:16.

It sets up this joke, which is written onto the photo later (do not illustrate its words, and put no words in the picture): "${l.line}"

The scene: ${l.scene}

Composition: ${l.composition}

${REALISM}

Nothing written anywhere: no text, letters, signs, logos, labels or number plates.`;
  const r = codex(prompt);
  const g = r.thread ? path.join(os.homedir(), '.codex', 'generated_images', r.thread) : null;
  l.takes = g && existsSync(g) ? readdirSync(g).filter((f) => f.endsWith('.png')).map((f) => path.join(g, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs) : [];
  images += l.takes.length;
  log(`${l.id}: ${l.takes.length} takes`);
}

// ---- 8: blind judge + the covers-the-subject check ------------------------------------------------
const all = kept.flatMap((l) => (l.takes || []).map((t, i) => ({ l, t, i })));
if (all.length) {
  const jr = codex(`You are judging ${all.length} photographs for realism. They are attached in order, numbered 1 to ${all.length}. For each, reply with JSON only: an array of {"n", "realism": 1-5 (5 = indistinguishable from a real camera photo), "waxy": true if any skin looks smoothed, plastic or waxy, "aiTells": short list of visible AI artefacts or [], "subjectTop": % of the image height where the main subject starts, "subjectBottom": % where it ends, "calmBottom": true if the bottom third is calm and empty}. Judge only what you can see. Do not run commands or read files.`, { images: all.map((a) => a.t), out: path.join(dir, 'judge.txt') });
  let marks = [];
  try { marks = firstJson(jr.text); } catch (e) { log(`judge reply did not parse: ${e.message}`); }
  all.forEach((a, k) => { a.m = marks.find((m) => Number(m.n) === k + 1) || null; });
}
for (const l of kept) {
  const mine = all.filter((a) => a.l === l);
  const score = (a) => (a.m ? a.m.realism * 10 - (a.m.waxy ? 20 : 0) - (a.m.aiTells?.length || 0) * 3 + (a.m.calmBottom ? 2 : 0) - (a.m.subjectBottom > 55 ? 5 : 0) : 0);
  const best = mine.sort((a, b) => score(b) - score(a))[0];
  l.pick = best ? best.i : null;
  l.judge = mine.map((a) => ({ take: a.i + 1, ...a.m }));
  l.coversFlag = best?.m && best.m.subjectBottom > 55 ? `the subject reaches ${best.m.subjectBottom} % down the frame; the joke sits from about 55 % on Home D` : null;
  l.anchorY = best?.m ? Math.max(15, Math.min(60, Math.round((best.m.subjectTop + best.m.subjectBottom) / 2) - 10)) : 40;
}

// ---- 9: the page ---------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUrl = async (f, w) => 'data:image/jpeg;base64,' + (await sharp(f).resize(w, Math.round((w * 16) / 9), { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()).toString('base64');
const cards = [];
for (const l of kept) {
  const imgs = [];
  for (const t of l.takes || []) imgs.push(await dataUrl(t, 420));
  const T = targets.find((t) => t.id === l.id);
  cards.push(`<section class="pair" id="${l.id}"><p class="chip">${esc(T.bin || T.folder)} · ${esc(T.time)}${T.meh ? ` · replaces “${esc(T.meh)}”` : ''}${T.slots ? ` · ${esc(T.why)}` : ''}</p>
<p class="line">“${esc(l.line)}”</p>
<div class="takes">${imgs.map((src, i) => `<figure><img src="${src}" alt="take ${i + 1}"><figcaption>Take ${i + 1}</figcaption></figure>`).join('')}</div>
${l.coversFlag ? `<p class="flag">${esc(l.coversFlag)}</p>` : ''}
<div class="q"><span class="lab">Pair</span><div class="act" data-q="${l.id}.use"><button data-v="USE">Use</button><button data-v="NO">No</button></div></div>
${imgs.length > 1 ? `<div class="q"><span class="lab">Photo</span><div class="act" data-q="${l.id}.take">${imgs.map((_, i) => `<button data-v="${i + 1}">Take ${i + 1}</button>`).join('')}<button data-v="NEITHER">Neither</button></div></div>` : ''}
<div class="q"><span class="lab">The line (optional)</span><div class="act" data-q="${l.id}.grade"><button data-v="LOVE">Love</button><button data-v="MEH">Meh</button></div></div>
<div class="q"><span class="lab">Afrikaans</span><p class="afline">${esc(l.af)}</p><div class="act" data-q="${l.id}.af"><button data-v="OK">OK</button><button data-v="FIX">Fix</button></div><textarea data-note="${l.id}.af" placeholder="Your Afrikaans (only if Fix)" hidden></textarea></div>
</section>`);
}
const PRE = {};
for (const l of kept) { PRE[`${l.id}.use`] = l.coversFlag ? 'NO' : 'USE'; if ((l.takes || []).length > 1) PRE[`${l.id}.take`] = l.pick != null ? String(l.pick + 1) : 'NEITHER'; PRE[`${l.id}.af`] = 'OK'; }
const ITEMS = kept.map((l) => ({ id: l.id, line: l.line, af: l.af }));
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pairs batch ${n} — for Al</title>
<style>:root{--bg:#f6f4ee;--fg:#1d1b18;--muted:#6b665c;--line:#dcd7cb;--card:#fffdf8;--accent:#1f5f8b;--on:#2e7d4f;--off:#a5452b}
@media (prefers-color-scheme:dark){:root{--bg:#15140f;--fg:#eeebe3;--muted:#a8a296;--line:#35322b;--card:#1f1d18;--accent:#7fb6dd;--on:#7ccf9c;--off:#e08a6e}}
*{box-sizing:border-box}body{margin:0;padding:18px 16px 110px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:900px;margin:0 auto}
.pair{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}.chip{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:0}
.line{font-size:1.2rem;margin:4px 0 10px}.takes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.takes img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;display:block}figure{margin:0}figcaption{font-size:.8rem;color:var(--muted)}
.flag{color:var(--off);font-size:.9rem}.q{margin-top:10px}.lab{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);display:block;margin-bottom:4px}.afline{margin:0 0 6px}
.act{display:flex;flex-wrap:wrap;gap:6px}.act button{font:inherit;min-height:44px;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;cursor:pointer}.act button.on{background:var(--on);border-color:var(--on);color:#fff}
textarea{width:100%;min-height:44px;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;background:transparent;color:inherit;margin-top:8px}textarea[hidden]{display:none!important}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:8px;align-items:center}.bar button{font:inherit;min-height:42px;padding:8px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff}#count{margin-right:auto;color:var(--muted);font-size:.9rem}#out{display:none;width:100%;min-height:100px}</style></head>
<body><main><h1>Pairs, batch ${n}</h1><p>Made by the pairs job to your recipe. Everything is marked with the job's pick; change only what you disagree with, then Export. Nothing goes into the app until a session wires what you ticked. The job waits for this before it makes the next batch.</p>
<p class="chip">Optional: tap Love or Meh on a line (blank counts as Fine) — it teaches the recipe.</p>
${cards.join('\n')}<textarea data-note="other" placeholder="Anything else (optional)"></textarea><textarea id="out" readonly></textarea></main>
<div class="bar"><span id="count"></span><button id="export">Export</button></div>
<script>var KEY='pw-pairs-batch-${n}',PRE=${JSON.stringify(PRE)},ITEMS=${JSON.stringify(ITEMS)};var s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
function pick(q){return (s[q]&&s[q].pick)||PRE[q]||null}function save(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}paint()}
function paint(){document.querySelectorAll('.act').forEach(function(a){var v=pick(a.dataset.q);a.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});var t=document.querySelector('textarea[data-note="'+a.dataset.q+'"]');if(t){t.hidden=v!=='FIX';t.value=(s[a.dataset.q]||{}).note||''}});var c=Object.keys(s).filter(function(q){return s[q]&&s[q].pick&&s[q].pick!==PRE[q]}).length;document.getElementById('count').textContent=c?c+' changed from the job\\'s picks':'All the job\\'s picks'}
document.addEventListener('click',function(e){var b=e.target.closest('.act button');if(!b)return;var q=b.parentElement.dataset.q,o=s[q]=s[q]||{};o.pick=(o.pick===b.dataset.v&&!PRE[q])?null:b.dataset.v;save()});
document.addEventListener('input',function(e){var t=e.target;if(!t.matches('textarea[data-note]'))return;var o=s[t.dataset.note]=s[t.dataset.note]||{};o.note=t.value;try{localStorage.setItem(KEY,JSON.stringify(s))}catch(x){}});
document.getElementById('export').addEventListener('click',function(){var n=function(q){return (s[q]||{}).note||''};var j=JSON.stringify({generated:new Date().toISOString(),batch:${n},ruledBy:'Al, pairs batch ${n}',pairs:ITEMS.map(function(i){return{id:i.id,line:i.line,use:pick(i.id+'.use'),take:pick(i.id+'.take'),grade:pick(i.id+'.grade')||'FINE',af:{verdict:pick(i.id+'.af'),proposal:i.af,text:n(i.id+'.af')}}}),other:n('other')},null,1);var o=document.getElementById('out');o.style.display='block';o.value=j;try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='pairs-batch-${n}-ruled.json';a.click()}catch(x){}});paint();</script></body></html>`;
const pagePath = path.join(REPO, 'review', `pairs-batch-${n}.html`);
if (!DRY) writeFileSync(pagePath, page);
writeFileSync(path.join(dir, 'batch.json'), JSON.stringify({ n, made: new Date().toISOString(), writer: WRITER, mixedWithOpus: mixing, pairs: kept.map((l) => ({ id: l.id, line: l.line, af: l.af, scene: l.scene, composition: l.composition, takes: l.takes, pick: l.pick, judge: l.judge, coversFlag: l.coversFlag, anchorY: l.anchorY })) }, null, 1));
writeFileSync(path.join(dir, 'key.json'), JSON.stringify({ note: 'Who wrote each line. Not on the page.', key }, null, 1));
const usageAfter = codexUsage();
if (!DRY) {
  state.batches.push({ n, made: new Date().toISOString(), page: pagePath, ruled: null, targets: kept.map((l) => l.id), images, usageBefore, usageAfter });
  state.done.push(...targets.map((t) => t.id));
  writeFileSync(statePath, JSON.stringify(state, null, 1));
}
log(`batch ${n} ${DRY ? '(dry) ' : ''}done: ${kept.length} pairs, ${images} images, page ${pagePath}; Codex usage ${usageBefore ?? '?'} -> ${usageAfter ?? '?'} %`);
