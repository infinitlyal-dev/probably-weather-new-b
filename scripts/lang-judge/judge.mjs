// The native-ear judge (Al's brief, 11 Oct 2026): steps 2–4. A judge is a separate model call (Sonnet 5.5 or Opus 5.5,
// run as a subagent) that sees only the judge bundle — judge-prompt.md, the language pack with every EXAM line taken out,
// the humour doctrine, twelve TRAIN anchor rows — and a blind batch of lines: English + draft, each with two TRAIN lines
// of the same weather to compare against. It never sees a drafter's confidence tag, a back-translation, the checker's
// verdict, or an EXAM row's native verdict.
//
//   node scripts/lang-judge/judge.mjs export --set exam|october --lang zu|xh|st --dir <dir> [--judge sonnet|opus]
//       writes <dir>/bundle-<lang>.md and <dir>/<set>-<lang>-NN-blind.json (ids opaque, order shuffled, at most 25
//       lines a batch); the id → row map goes to data/runs/<set>-<lang>-map.json, never to <dir>. October export
//       needs --judge, and only a judge that passed that language's exam on these same inputs gets a batch.
//   node scripts/lang-judge/judge.mjs merge --set exam|october --lang L --judge sonnet|opus --dir <dir> --model <id>
//       reads <dir>/<judge>/<set>-<lang>-NN-out.json, keeps only well-formed answers given once, and writes
//       data/judgments/<set>-<judge>-<lang>.json
//   node scripts/lang-judge/judge.mjs score     → review/lang-judge-exam-2026-10.md + data/exam-result.json
//   node scripts/lang-judge/judge.mjs report    → review/lang-judge-verdicts-2026-10.md (judges that passed, and
//       judges run as a detector)
//   node scripts/lang-judge/judge.mjs leads     → review/live-bank-errors-from-exam-2026-10.md
//
// --as-detector "<reason>" (export --set october only; Maat's ruling, 12 Oct 2026): a judge that failed its exam may
// still read the October lines as a detector — its flags are leads for Maat, not verdicts — when it kept nothing the
// natives cut in that language's exam. Same exam inputs, byte for byte, or it refuses. The reason is recorded in the run,
// the merged answers and the report header.
//
// The subagent brief is JUDGE_BRIEF below.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEATHER_COPY } from '../../assets/weather-copy.js';
import { mulberry32, norm, shuffle, stToSa, SEED } from './build-verdicts.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HERE = import.meta.dirname;
const DATA = path.join(HERE, 'data');
export const LANGS = { zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
export const JUDGES = { sonnet: 'Sonnet 5.5', opus: 'Opus 5.5' };
export const BATCH_MAX = 25;
// languages with October lines (Sesotho has none: it sits the exam only)
export const OCTOBER_LANGS = ['xh', 'zu'];
// Al's pass bar, per language per judge
export const PASS = { keepVsNot: 0.8, falseKeepsOfCuts: 0.1 };
// Maat's ruling (12 Oct 2026): only Opus 5.5 may run as a detector — it kept nothing the natives cut in any language
export const DETECTOR_JUDGES = ['opus'];
const VERDICTS = ['KEEP', 'FIX', 'CUT'];
const SPELLING = {
  zu: '- Both "namuhla" and "namhlanje" are isiZulu for today; neither is wrong in a line.',
  xh: '- isiXhosa and isiZulu share many words; a word that is isiZulu but not isiXhosa (or reads as isiZulu to an isiXhosa speaker) is a fault.',
  st: '- The house spelling is South African Sesotho (jwale, jwalo, dipula, tjhesa, mohodi, ya/wa). Lines in the older Lesotho spelling (joale, lipula, chesa, moholi, ea/oa) are not wrong for that reason alone: judge the wording, not the orthography, and write your rewrites in the South African spelling.',
};

export const JUDGE_BRIEF = (lang, bundle, batch, out) => `You are a ${LANGS[lang]} native-ear judge for Probably Weather, a South African weather app. Work only with the two files named below; do not open, list or search any other file, in the repository or anywhere else, and do not edit anything except the file you are asked to write.

1. Read ${bundle} in full. It is your brief (the judge prompt), the ${LANGS[lang]} language pack, the humour doctrine and twelve anchor rows ruled on by native speakers.
2. Read ${batch}: an array of {id, en, draft, compare}. "compare" holds two lines native speakers ruled on, about the same kind of weather.
3. Judge every line exactly as the brief says, and write ${out}: a JSON array of {"id","speaker","joke","verdict","reason","rewrite"} — every id once, valid JSON only.

When done, reply with three lines: the counts per verdict; the files you opened; your model id.`;

// ---------- shared ----------
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (s) => crypto.createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
// --again must carry a reason in words, not the next option
const again = () => {
  if (!process.argv.includes('--again')) return null;
  const why = arg('--again');
  if (!why || !why.trim() || why.startsWith('--')) throw new Error('--again needs a reason: --again "<why this runs a second time>"');
  return why.trim();
};
// --as-detector carries its reason the same way
const asDetector = () => {
  if (!process.argv.includes('--as-detector')) return null;
  const why = arg('--as-detector');
  if (!why || !why.trim() || why.startsWith('--')) throw new Error('--as-detector needs a reason: --as-detector "<the ruling this runs under>"');
  return why.trim();
};
const loadVerdicts = () => readJson(path.join(DATA, 'native-verdicts.json'));
const lineRows = (V, lang, split) => V.rows.filter((r) => r.lang === lang && r.scope === 'line' && !r.excluded && (!split || r.split === split));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const hash32 = (s) => parseInt(sha(s).slice(0, 8), 16);

// ---------- the twelve anchors and the compare pairs (TRAIN only, fixed by SEED) ----------
export function pickAnchors(V, lang) {
  const train = lineRows(V, lang, 'train');
  const rand = mulberry32(SEED + 100 + Object.keys(LANGS).indexOf(lang));
  const words = (s) => s.split(/\s+/).length;
  const spread = (cands, n) => {
    const out = [], conds = new Set();
    for (const pass of [0, 1]) for (const r of cands) {
      if (out.length >= n) break;
      if (out.includes(r) || (pass === 0 && conds.has(r.cond))) continue;
      out.push(r); conds.add(r.cond);
    }
    return out;
  };
  const order = (rows, prio) => shuffle(rows, rand).sort((a, b) => prio(b) - prio(a));
  const keeps = spread(order(train.filter((r) => r.verdict === 'KEEP' && words(r.draft) >= 4), (r) => (/both/i.test(r.record || '') ? 1 : 0)), 6);
  const cuts = spread(order(train.filter((r) => r.verdict === 'CUT'), (r) => (r.reason ? 1 : 0)), 2);
  const fixes = spread(order(train.filter((r) => r.verdict === 'FIX' && !cuts.includes(r)), (r) => (r.reason ? 1 : 0)), 6 - cuts.length);
  return [...keeps, ...cuts, ...fixes];
}
const shown = (r) => ({ en: r.en, draft: r.draft, native: r.verdict, ...(r.verdict !== 'KEEP' ? { line: r.rewrite } : {}), ...(r.reason ? { reason: r.reason } : {}) });
export function comparePair(V, lang, cond, itemKey) {
  const train = lineRows(V, lang, 'train');
  const rand = mulberry32(hash32(`${lang}|${itemKey}`));
  const pick = (rows) => (rows.length ? rows[Math.floor(rand() * rows.length)] : null);
  const same = train.filter((r) => r.cond === cond);
  const keep = pick(same.filter((r) => r.verdict === 'KEEP')) || pick(train.filter((r) => r.verdict === 'KEEP'));
  const changed = pick(same.filter((r) => r.verdict !== 'KEEP')) || pick(train.filter((r) => r.verdict !== 'KEEP'));
  return (rand() < 0.5 ? [keep, changed] : [changed, keep]).filter(Boolean).map(shown);
}

// ---------- the bundle ----------
const WITHHELD = '[a line withheld here: it is in the exam]';
export function buildBundle(V, lang) {
  const exam = lineRows(V, lang, 'exam');
  const examEn = new Set(exam.map((r) => norm(r.en)));
  const examText = new Set(exam.flatMap((r) => [r.draft, r.rewrite]).filter(Boolean).map(norm));
  // every exam line has two words or more (a one-word line is a label, build-verdicts.mjs), so every one can be withheld
  // as a phrase without wiping single words out of the pack
  const short = [...examText].filter((t) => t.split(' ').length < 2);
  if (short.length) throw new Error(`bundle-${lang}: one-word exam line(s) cannot be withheld safely: "${short[0]}"`);
  const phrase = (t) => new RegExp(`(?<![\\p{L}\\p{N}])${t.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`, 'giu');
  // every exam line (draft or native line) is withheld from the pack files and the doctrine, wherever it appears
  const redact = (text) => {
    let out = text;
    for (const t of examText) out = out.replace(phrase(t), WITHHELD);
    return out;
  };
  // a confirmed line goes when its English is an exam English, or it is an exam line, or it contains one (two words
  // or more) — a native's line for one English can be the first half of their line for another
  const long = [...examText].filter((t) => t.split(' ').length >= 2).map((t) => ` ${t} `);
  const corpus = fs.readFileSync(path.join(ROOT, 'lang-packs', lang, 'corpus-confirmed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r[lang] && !examEn.has(norm(r.en)) && !examText.has(norm(r[lang])) && !long.some((t) => ` ${norm(r[lang])} `.includes(t)));
  const anchors = pickAnchors(V, lang);
  const prompt = read('scripts/lang-judge/judge-prompt.md').replace(/\{\{LANGUAGE\}\}/g, LANGS[lang]).replace('{{SPELLING_NOTE}}', SPELLING[lang]);
  const anchorText = anchors.map((r, i) => {
    const why = r.verdict === 'KEEP'
      ? (r.record && !/^git /.test(r.record) ? `kept as written (${r.record})` : 'kept as written')
      : r.reason ? `their reason: ${r.reason}` : 'no reason written down — their line is their answer';
    return `${i + 1}. English: ${r.en}\n   Draft: ${r.draft}\n   Native verdict: ${r.verdict}${r.verdict !== 'KEEP' ? `\n   Native's line: ${r.rewrite}` : ''}\n   ${why}`;
  }).join('\n\n');
  const packs = {
    pack: redact(read(`lang-packs/${lang}/PACK.md`)),
    errors: redact(read(`lang-packs/${lang}/errors-observed.md`)),
    banned: redact(read(`lang-packs/${lang}/banned-words.json`)).trim(),
    doctrine: redact(read('review/HUMOUR-DOCTRINE.md')),
  };
  const parts = [
    prompt,
    `---\n\n# The ${LANGS[lang]} language pack\n\n## PACK.md\n\n${packs.pack}`,
    `## errors-observed.md\n\n${packs.errors}`,
    `## banned-words.json\n\n\`\`\`json\n${packs.banned}\n\`\`\``,
    `## Lines native speakers confirmed (corpus-confirmed — ${corpus.length} lines; the exam's lines are taken out)\n\nkey | English | ${LANGS[lang]}\n${corpus.map((r) => `${r.key} | ${r.en} | ${r[lang]}`).join('\n')}`,
    `---\n\n# The humour doctrine\n\n${packs.doctrine}`,
    `---\n\n# The twelve anchor rows — ${LANGS[lang]} native speakers' rulings\n\n${anchorText}\n`,
  ];
  const text = parts.join('\n\n');
  // nothing from the exam may survive: no exam line in the free text (prompt, packs, doctrine), and no exam line or exam
  // English as a confirmed line or an anchor
  const free = [prompt, ...Object.values(packs)].join('\n');
  const leaked = [...examText].filter((t) => phrase(t).test(free));
  const holds = (s) => examText.has(norm(s)) || long.some((t) => ` ${norm(s)} `.includes(t));
  for (const r of [...corpus.map((c) => ({ en: c.en, draft: c[lang] })), ...anchors]) {
    if (holds(r.draft) || (r.rewrite && holds(r.rewrite)) || examEn.has(norm(r.en))) leaked.push(norm(r.draft));
  }
  if (leaked.length) throw new Error(`bundle-${lang}: ${leaked.length} exam line(s) still in the bundle, e.g. "${leaked[0]}"`);
  return { text, anchors: anchors.map((r) => r.id), corpusLines: corpus.length, withheld: (text.match(new RegExp(WITHHELD.replace(/[[\]]/g, '\\$&'), 'g')) || []).length };
}

// ---------- the October lines: every applied line, as it is live now ----------
export async function octoberItems(lang) {
  const drafts = fs.readFileSync(path.join(ROOT, 'lang-packs', lang, 'drafts-2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const table = (await import(pathToFileURL(path.join(ROOT, 'assets', `hero-lines-${lang}.js`)).href))[`HERO_LINES_${lang.toUpperCase()}`];
  const bankText = new Map();
  for (const [group, bins] of Object.entries({ witty: WEATHER_COPY.witty, witty_low_confidence: WEATHER_COPY.witty_low_confidence })) {
    for (const [cond, bank] of Object.entries(bins || {})) (bank.en || []).forEach((en, i) => bankText.set(`${en}|${bank[lang]?.[i] ?? ''}`, { cond, key: `${group}.${cond}[${i}]` }));
  }
  const sets = readJson(path.join(ROOT, 'review', 'new-sets-lines-2026-10-07.json')).set || [];
  const condOfEn = new Map();
  for (const s of sets) for (const c of s.candidates || []) if (c.en && !condOfEn.has(c.en)) condOfEn.set(c.en, s.condition);
  // a reworded line ("changed-lines") is not in the new sets: its photograph's folder names the weather
  const { HERO_LINES } = await import(pathToFileURL(path.join(ROOT, 'assets', 'hero-lines.js')).href);
  for (const [photo, lines] of Object.entries(HERO_LINES)) {
    const cond = photo.match(/^bg\/([a-z-]+)\//)?.[1];
    if (cond) for (const en of lines) if (!condOfEn.has(en)) condOfEn.set(en, cond);
  }
  // the held lines go in too, marked held (Maat's brief, 12 Oct 2026: he sees them beside the applied ones), with the
  // reason review/lines-backtranslation-2026-10.md gives for holding each
  const heldWhy = new Map();
  let inLang = false;
  for (const line of read('review/lines-backtranslation-2026-10.md').split('\n')) {
    if (line.startsWith('## ')) inLang = line.startsWith(`## ${LANGS[lang]} `);
    else if (line.startsWith('### ')) inLang = false;
    if (!inLang || !line.startsWith('| ')) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim().replace(/\\\|/g, '|'));
    if (cells.length === 7) heldWhy.set(`${cells[0]}|${cells[2]}`, cells[6]);
  }
  const items = [], seen = new Set();
  for (const d of drafts) {
    const text = d[lang];
    const live = d.set === 'debt' ? bankText.get(`${d.en}|${text}`) : table[d.en] === text ? { cond: condOfEn.get(d.en) || null, key: d.key } : null;
    if (!live || seen.has(`${d.en}|${text}`)) continue;
    seen.add(`${d.en}|${text}`);
    items.push({ ref: d.key, set: d.set, en: d.en, draft: text, cond: live.cond });
  }
  for (const d of drafts) {
    const text = d[lang];
    if (seen.has(`${d.en}|${text}`)) continue;
    seen.add(`${d.en}|${text}`);
    const cond = condOfEn.get(d.en) || /^[a-zA-Z_]+\.([a-z-]+)/.exec(d.key || '')?.[1] || null;
    const held = heldWhy.get(`${d.key}|${text}`);
    if (!held || /^applied/.test(held)) throw new Error(`${d.key}: not live, and review/lines-backtranslation-2026-10.md gives no reason for holding it ("${held || 'no row'}") — rebuild that report first`);
    items.push({ ref: d.key, set: d.set, en: d.en, draft: text, cond, held });
  }
  return items;
}

// ---------- export ----------
function chunk(rows) {
  const k = Math.ceil(rows.length / BATCH_MAX);
  return Array.from({ length: k }, (_, i) => rows.slice(Math.floor((i * rows.length) / k), Math.floor(((i + 1) * rows.length) / k)));
}
// What a pass is earned on: the prompt, the verdict set, the bundle the judge read, and the code that picks its anchors,
// its compare lines and its brief. (The scoring and report code is left out: fixing a table cannot change what a judge
// saw.)
export function inputsHash(lang, bundleText) {
  return {
    prompt: sha(read('scripts/lang-judge/judge-prompt.md')),
    verdicts: sha(read('scripts/lang-judge/data/native-verdicts.json')),
    bundle: sha(bundleText),
    code: sha([pickAnchors, comparePair, shown, buildBundle, JUDGE_BRIEF, chunk].map(String).join('\n') + JSON.stringify(SPELLING)),
  };
}
// The exam is shared by both judges; an October run is one judge's. A run is exported once: exporting it again (or
// merging a judge's answers again) needs --again "<reason>", and the reason is kept in the run's record.
const mapFile = (set, lang, judge) => path.join(DATA, 'runs', set === 'exam' ? `exam-${lang}-map.json` : `october-${judge}-${lang}-map.json`);
// a directory outside the repository: compared as real paths, without regard to case on Windows
export function outsideRepo(dir) {
  const real = (p) => { let q = path.resolve(p), tail = []; while (!fs.existsSync(q)) { tail.unshift(path.basename(q)); q = path.dirname(q); } return path.join(fs.realpathSync.native(q), ...tail); };
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const rel = path.relative(fold(real(ROOT)), fold(real(dir)));
  return rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel));
}
// A judge may judge October lines only on a PASS that still stands: the scored exam answers are the ones on disk now
// (a later merge --again voids the pass until it is scored again), and, when a bundle is given, the inputs it passed on
// are the inputs now. Returns the pass; throws with the reason otherwise.
// As a detector (Maat's ruling, 12 Oct 2026) no pass is asked for: the judge must be a detector judge that sat the whole
// exam in that language, with native cuts in it, and kept none of them. Every other check is the same.
export function passedExam(judge, lang, bundleText = null, detector = null) {
  const f = path.join(DATA, 'exam-result.json');
  const result = fs.existsSync(f) ? readJson(f) : null;
  const res = result?.results?.[judge]?.[lang];
  if (detector) {
    if (!DETECTOR_JUDGES.includes(judge)) throw new Error(`${JUDGES[judge] || judge} may not run as a detector (Maat's ruling: ${DETECTOR_JUDGES.map((j) => JUDGES[j]).join(', ')} only)`);
    if (!res || res.unjudged || !(res.cuts > 0) || res.falseKeeps !== 0) throw new Error(`${JUDGES[judge]} kept ${res?.falseKeeps ?? '?'} of ${res?.cuts ?? '?'} native cuts in the ${LANGS[lang] || lang} exam — a detector must have sat the whole exam and kept none`);
  } else if (!res?.pass) throw new Error(`${JUDGES[judge] || judge} did not pass the ${LANGS[lang] || lang} exam — no October run (Al's brief, step 4)`);
  const jf = path.join(DATA, 'judgments', `exam-${judge}-${lang}.json`);
  if (!fs.existsSync(jf) || sha(fs.readFileSync(jf, 'utf8')) !== res.judgment) throw new Error(`exam-${judge}-${lang}.json changed after it was scored — score the exam again first`);
  if (bundleText != null) {
    const now = inputsHash(lang, bundleText), then = result.inputs?.[lang] || {};
    const stale = Object.keys(now).filter((k) => now[k] !== then[k]);
    if (stale.length) throw new Error(`the exam was passed on different inputs (${stale.join(', ')} changed since) — run the exam again first`);
  }
  return { res, inputs: result.inputs[lang] };
}
async function exportSet() {
  const set = arg('--set'), lang = arg('--lang'), judge = arg('--judge'), dir = path.resolve(arg('--dir', ''));
  if (!['exam', 'october'].includes(set) || !LANGS[lang] || !arg('--dir') || (set === 'october' && !JUDGES[judge])) throw new Error('usage: export --set exam|october --lang zu|xh|st --dir <dir> [--judge sonnet|opus] [--again "<reason>"] [--as-detector "<reason>"]');
  const detector = asDetector();
  if (detector && set !== 'october') throw new Error('--as-detector is for an October run only; the exam is the exam');
  if (set === 'october' && !OCTOBER_LANGS.includes(lang)) throw new Error(`no October ${LANGS[lang]} lines exist — ${LANGS[lang]} sits the exam only`);
  if (!outsideRepo(dir)) throw new Error('--dir must be outside the repository, so a judge never sits next to the answers');
  const prior = fs.existsSync(mapFile(set, lang, judge)) ? readJson(mapFile(set, lang, judge)) : null;
  if (prior && !again()) throw new Error(`${path.basename(mapFile(set, lang, judge))} exists: this run was exported on ${prior.built}. The exam runs once — export again only with --again "<reason>"`);
  const V = loadVerdicts();
  const bundle = buildBundle(V, lang);
  let items;
  if (set === 'exam') items = lineRows(V, lang, 'exam').map((r) => ({ ref: r.id, en: r.en, draft: r.draft, cond: r.cond }));
  else {
    // only a judge that passed this language's exam (or may run as a detector), on these same inputs, judges the
    // October lines
    passedExam(judge, lang, bundle.text, detector);
    items = await octoberItems(lang);
  }
  const rand = mulberry32(SEED + 7 + Object.keys(LANGS).indexOf(lang) + (set === 'october' ? 50 : 0));
  const batches = chunk(shuffle(items, rand));
  // no compare line may be an exam line or carry one as its native line
  const examText = new Set(lineRows(V, lang, 'exam').flatMap((r) => [r.draft, r.rewrite]).filter(Boolean).map(norm));
  const long = [...examText].filter((t) => t.split(' ').length >= 2).map((t) => ` ${t} `);
  const holds = (s) => examText.has(norm(s)) || long.some((t) => ` ${norm(s)} `.includes(t));
  const files = {}, map = {}, sub = set === 'exam' ? '' : judge;
  fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.mkdirSync(path.join(DATA, 'runs'), { recursive: true });
  fs.writeFileSync(path.join(dir, sub, `bundle-${lang}.md`), bundle.text);
  files[`bundle-${lang}.md`] = sha(bundle.text);
  batches.forEach((b, bi) => {
    const nn = String(bi + 1).padStart(2, '0');
    const blind = b.map((it, k) => {
      const id = `${lang}${nn}-${String(k + 1).padStart(2, '0')}`;
      map[id] = { ref: it.ref, en: it.en, draft: it.draft, cond: it.cond, set: it.set || 'exam', ...(it.held ? { held: it.held } : {}) };
      const compare = comparePair(V, lang, it.cond, it.ref);
      for (const c of compare) if (holds(c.draft) || (c.line && holds(c.line))) throw new Error(`compare line for ${id} is or holds an exam line: "${c.draft}"`);
      return { id, en: it.en, draft: it.draft, compare };
    });
    const text = JSON.stringify(blind, null, 1);
    fs.writeFileSync(path.join(dir, sub, `${set}-${lang}-${nn}-blind.json`), text);
    files[`${set}-${lang}-${nn}-blind.json`] = sha(text);
  });
  const attempts = [...(prior?.attempts || []), { built: new Date().toISOString(), again: prior ? again() : null }];
  fs.writeFileSync(mapFile(set, lang, judge), JSON.stringify({ set, lang, judge: set === 'exam' ? null : judge, built: new Date().toISOString().slice(0, 10), exportedAt: Date.now(), attempts, ...(detector ? { detector } : {}), inputs: inputsHash(lang, bundle.text), files, anchors: bundle.anchors, map }, null, 1) + '\n');
  if (detector) console.log(`run as a detector — ${detector}`);
  console.log(`${set} ${lang}: ${items.length} lines${items.some((it) => it.held) ? ` (${items.filter((it) => it.held).length} held)` : ''} in ${batches.length} batches (${batches.map((b) => b.length).join('/')}); bundle ${bundle.text.length} chars, ${bundle.corpusLines} confirmed lines, ${bundle.withheld} exam line(s) withheld from the pack files`);
  for (let i = 0; i < batches.length; i++) {
    const nn = String(i + 1).padStart(2, '0');
    console.log(`  brief ${nn}: JUDGE_BRIEF('${lang}', '${path.join(dir, sub, `bundle-${lang}.md`)}', '${path.join(dir, sub, `${set}-${lang}-${nn}-blind.json`)}', '${path.join(dir, judge || '<judge>', `${set}-${lang}-${nn}-out.json`)}')`);
  }
}

// ---------- merge ----------
export function validAnswer(o, count) {
  return o && typeof o === 'object' && count.get(o.id) === 1
    && Number.isInteger(o.speaker) && o.speaker >= 1 && o.speaker <= 5
    && Number.isInteger(o.joke) && o.joke >= 1 && o.joke <= 5
    && VERDICTS.includes(o.verdict)
    && typeof o.reason === 'string' && o.reason.trim() !== ''
    && (o.verdict === 'KEEP' ? o.rewrite == null || o.rewrite === '' : typeof o.rewrite === 'string' && o.rewrite.trim() !== '');
}
function merge() {
  const set = arg('--set'), lang = arg('--lang'), judge = arg('--judge'), dir = path.resolve(arg('--dir', '')), model = arg('--model');
  if (!['exam', 'october'].includes(set) || !LANGS[lang] || !JUDGES[judge] || !arg('--dir') || !model || model.startsWith('--')) throw new Error('usage: merge --set exam|october --lang L --judge sonnet|opus --dir <dir> --model <id> [--again "<reason>"]');
  if (set === 'october' && !OCTOBER_LANGS.includes(lang)) throw new Error(`no October ${LANGS[lang]} lines exist`);
  const run = readJson(mapFile(set, lang, judge));
  // October answers count only from the very model that passed (or sat the exam it runs as a detector on), on the
  // inputs it sat the exam on; a detector run stays a detector run
  if (set === 'october') {
    const { res, inputs } = passedExam(judge, lang, buildBundle(loadVerdicts(), lang).text, run.detector || null);
    if (model !== res.model) throw new Error(`the ${LANGS[lang]} exam was passed by ${res.model}, not ${model}`);
    const stale = Object.keys(inputs).filter((k) => inputs[k] !== run.inputs?.[k]);
    if (stale.length) throw new Error(`this October run was exported on other inputs than the passed exam (${stale.join(', ')})`);
  }
  const target = path.join(DATA, 'judgments', `${set}-${judge}-${lang}.json`);
  if (fs.existsSync(target) && !again()) throw new Error(`${path.basename(target)} exists: these answers were merged once already — merge again only with --again "<reason>"`);
  // The answers must belong to this run: the files beside them are byte-for-byte the ones it exported, and every
  // answer file was written after the export (an older answer was given to other inputs).
  const sub = set === 'exam' ? '' : judge;
  for (const [f, h] of Object.entries(run.files || {})) {
    const p = path.join(dir, sub, f);
    if (!fs.existsSync(p) || sha(fs.readFileSync(p, 'utf8')) !== h) throw new Error(`${f} in ${dir} is not the file this run exported`);
  }
  const rows = [];
  let missing = 0, invalid = 0, unknown = 0;
  const outs = fs.readdirSync(path.join(dir, judge)).filter((f) => f.startsWith(`${set}-${lang}-`) && f.endsWith('-out.json')).sort();
  const answers = [];
  for (const f of outs) {
    const p = path.join(dir, judge, f);
    if (fs.statSync(p).mtimeMs < run.exportedAt) throw new Error(`${f} was written before this run was exported — it answers other inputs`);
    let out;
    try { out = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new Error(`${f}: not valid JSON`); }
    if (!Array.isArray(out)) throw new Error(`${f}: not an array`);
    answers.push(...out);
  }
  const count = new Map();
  for (const o of answers) count.set(o?.id, (count.get(o?.id) || 0) + 1);
  const byId = new Map();
  for (const o of answers) {
    if (!o || !run.map[o.id]) { unknown++; continue; }
    if (!validAnswer(o, count)) { invalid++; continue; }
    byId.set(o.id, o);
  }
  for (const [id, m] of Object.entries(run.map)) {
    const o = byId.get(id);
    if (!o) { missing++; continue; }
    rows.push({ id, ref: m.ref, en: m.en, draft: m.draft, cond: m.cond, set: m.set, ...(m.held ? { held: m.held } : {}), speaker: o.speaker, joke: o.joke, verdict: o.verdict, reason: o.reason.trim(), rewrite: o.verdict === 'KEEP' ? null : o.rewrite.trim() });
  }
  fs.mkdirSync(path.join(DATA, 'judgments'), { recursive: true });
  const prior = fs.existsSync(target) ? readJson(target) : null;
  const merges = [...(prior?.merges || []), { at: new Date().toISOString(), again: prior ? again() : null }];
  // `run` ties these answers to the exact run record they were merged against (report() checks it for October)
  fs.writeFileSync(target, JSON.stringify({ set, lang, judge, model, ...(run.detector ? { detector: run.detector } : {}), inputs: run.inputs, run: sha(fs.readFileSync(mapFile(set, lang, judge), 'utf8')), merged: new Date().toISOString().slice(0, 10), exportAttempts: run.attempts, merges, missing, invalid, unknown, rows }, null, 1) + '\n');
  console.log(`${set} ${judge} ${lang}: ${rows.length} judged, ${missing} without a valid answer, ${invalid} malformed or duplicate answers dropped, ${unknown} unknown ids`);
}

// ---------- score (step 3) ----------
export function scoreRows(pairs) {
  // pairs: [{native, judge}] with verdicts KEEP / FIX / CUT
  const n = pairs.length;
  const by = (f) => pairs.filter(f).length;
  const cuts = by((p) => p.native === 'CUT'), keeps = by((p) => p.native === 'KEEP'), changed = by((p) => p.native !== 'KEEP');
  const s = {
    n, keeps, fixes: by((p) => p.native === 'FIX'), cuts,
    exact: n ? by((p) => p.judge === p.native) / n : null,
    keepVsNot: n ? by((p) => (p.judge === 'KEEP') === (p.native === 'KEEP')) / n : null,
    falseKeeps: by((p) => p.native === 'CUT' && p.judge === 'KEEP'),
    falseCuts: by((p) => p.native === 'KEEP' && p.judge === 'CUT'),
    changesMissed: by((p) => p.native !== 'KEEP' && p.judge === 'KEEP'), changed,
    matrix: Object.fromEntries(VERDICTS.map((a) => [a, Object.fromEntries(VERDICTS.map((b) => [b, by((p) => p.native === a && p.judge === b)]))])),
  };
  s.falseKeepRate = cuts ? s.falseKeeps / cuts : null;
  s.falseCutRate = keeps ? s.falseCuts / keeps : null;
  // with no native cut in the exam, the dangerous error cannot be measured, so the bar cannot be met
  s.pass = n > 0 && cuts > 0 && s.keepVsNot >= PASS.keepVsNot && s.falseKeepRate <= PASS.falseKeepsOfCuts;
  return s;
}
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
function score() {
  const V = loadVerdicts();
  const native = new Map(V.rows.map((r) => [r.id, r]));
  const results = {}, inputs = {}, judged = {};
  for (const lang of Object.keys(LANGS)) {
    const run = readJson(mapFile('exam', lang));
    inputs[lang] = run.inputs;
    for (const judge of Object.keys(JUDGES)) {
      const f = path.join(DATA, 'judgments', `exam-${judge}-${lang}.json`);
      if (!fs.existsSync(f)) continue;
      const J = readJson(f);
      const stale = Object.keys(run.inputs).filter((k) => run.inputs[k] !== J.inputs?.[k]);
      if (stale.length) throw new Error(`exam-${judge}-${lang}: judged on other inputs than the current run (${stale.join(', ')})`);
      const exam = Object.values(run.map).length;
      const pairs = J.rows.map((j) => ({ native: native.get(j.ref).verdict, judge: j.verdict }));
      const s = scoreRows(pairs);
      // a judge that left lines unjudged has not sat the whole exam
      s.unjudged = exam - J.rows.length;
      if (s.unjudged) s.pass = false;
      // how many times this exam was exported and these answers merged: more than once is shown in the report
      // the pass is tied to these exact answers: passedExam() re-hashes the file before any October run
      (results[judge] ||= {})[lang] = { ...s, model: J.model, judgment: sha(fs.readFileSync(f, 'utf8')), exports: (run.attempts || []).length, merges: (J.merges || []).length };
      for (const j of J.rows) ((judged[lang] ||= {})[j.ref] ||= {})[judge] = j;
    }
  }
  const out = { scored: new Date().toISOString().slice(0, 10), bar: PASS, inputs, results };
  fs.writeFileSync(path.join(DATA, 'exam-result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(ROOT, 'review', 'lang-judge-exam-2026-10.md'), examReport(V, out, judged, native));
  for (const [judge, langs] of Object.entries(results)) for (const [lang, s] of Object.entries(langs)) console.log(`${judge} ${lang}: keep-vs-not ${pct(s.keepVsNot)}, exact ${pct(s.exact)}, false keeps ${s.falseKeeps}/${s.cuts}, false cuts ${s.falseCuts}/${s.keeps} → ${s.pass ? 'PASS' : 'FAIL'}`);
}

function examReport(V, out, judged, native) {
  const L = [];
  const c = V.counts;
  L.push('# Native-ear judge — the exam (October 2026)', '');
  // "every line" only when the record shows it: all six exams scored, none with an unjudged line
  const sat = Object.keys(LANGS).flatMap((l) => Object.keys(JUDGES).map((j) => out.results[j]?.[l]));
  const whole = sat.every((x) => x && !x.unjudged);
  L.push(`Run ${out.scored}. Two judges — ${Object.values(JUDGES).join(' and ')}, each run as subagents in batches of at most ${BATCH_MAX} — ${whole ? 'judged every EXAM line blind' : 'judged the EXAM lines blind; the pass/fail table shows which exams ran and any lines left unjudged'}. Pass bar per language per judge: keep-vs-not agreement with the natives at least ${pct(PASS.keepVsNot)}, and false keeps at most ${pct(PASS.falseKeepsOfCuts)} of the natives' cuts. Ground truth, inputs and method: \`scripts/lang-judge/\`.`, '');
  L.push('## The verdict set', '');
  L.push('Every line a native reviewer ruled on (`scripts/lang-judge/data/native-verdicts.json`). The exam uses the witty lines; hero labels, headlines and app buttons are recorded but not examined (no joke to judge).', '');
  L.push('| language | rows on record | witty lines scored | KEEP | FIX | CUT | left out | TRAIN (K/F/C) | EXAM (K/F/C) |', '|---|---|---|---|---|---|---|---|---|');
  for (const lang of Object.keys(LANGS)) {
    const x = c[lang];
    const scored = x.line.KEEP + x.line.FIX + x.line.CUT;
    L.push(`| ${LANGS[lang]} | ${x.all} | ${scored} | ${x.line.KEEP} | ${x.line.FIX} | ${x.line.CUT} | ${x.excluded} | ${x.train.KEEP}/${x.train.FIX}/${x.train.CUT} | ${x.exam.KEEP}/${x.exam.FIX}/${x.exam.CUT} |`);
  }
  L.push('');
  const weak = Object.keys(LANGS).filter((l) => c[l].exam.CUT < 10);
  for (const lang of Object.keys(LANGS)) {
    const x = c[lang];
    const notes = [];
    if (x.line.KEEP + x.line.FIX + x.line.CUT < 40) notes.push('fewer than 40 rows — the exam is weak');
    if (x.exam.CUT < 10) notes.push(`only ${x.exam.CUT} native cut${x.exam.CUT === 1 ? '' : 's'} in its exam, so "false keeps" rests on ${x.exam.CUT === 1 ? 'one line' : `${x.exam.CUT} lines`}: a pass there shows the judge keeps what natives keep, not that it catches bad lines`);
    if (x.exam.FIX + x.exam.CUT < 20) notes.push(`${x.exam.FIX + x.exam.CUT} native changes in all in its exam`);
    if (notes.length) L.push(`- **${LANGS[lang]}:** ${notes.join('; ')}.`);
  }
  if (weak.length) L.push('');
  L.push('Where the verdicts come from: isiZulu — the native review commit d51b173 (30 May 2026), the bank before vs after; isiXhosa — `review/Xhosa-Review-Merge.xlsx` (two reviewers, July 2026: 333 approved, 256 changed); Sesotho — commit ecdfe11 and `review/sesotho-replacements.txt` (1 Jun 2026). The natives wrote lines, not labels: a line they left is KEEP; a changed line is FIX when their line still shares 30% or more of the draft\'s letter sequences, CUT below that (they wrote a new line). Reasons in the natives\' own words survive for 14 witty lines (isiXhosa 8, Sesotho 6, isiZulu none). `docs/cold-clear-copy-review-*` were written by Codex, not a native, and are not used.', '');
  const exL = {};
  for (const r of V.rows) if (r.scope === 'line' && r.excluded) { const k = r.excluded.replace(/\(.*$/, '').replace(/".*?"/, '"…"').trim(); (exL[r.lang] ||= {})[k] = ((exL[r.lang] ||= {})[k] || 0) + 1; }
  L.push('Left out of the exam, before it ran: ' + Object.entries(exL).map(([l, m]) => `${LANGS[l]} — ${Object.entries(m).map(([k, n]) => `${n} ${k}`).join('; ')}`).join('. ') + '.', '');

  L.push('## Pass / fail', '');
  L.push('| language | judge | lines | keep-vs-not | exact (3-way) | false keeps (of native cuts) | false cuts (of native keeps) | native changes kept as-is | result |', '|---|---|---|---|---|---|---|---|---|');
  for (const lang of Object.keys(LANGS)) for (const judge of Object.keys(JUDGES)) {
    const s = out.results[judge]?.[lang];
    if (!s) { L.push(`| ${LANGS[lang]} | ${JUDGES[judge]} | — | — | — | — | — | — | not run |`); continue; }
    L.push(`| ${LANGS[lang]} | ${JUDGES[judge]} | ${s.n}${s.unjudged ? ` (+${s.unjudged} unjudged)` : ''} | ${pct(s.keepVsNot)} | ${pct(s.exact)} | ${s.falseKeeps} of ${s.cuts} (${pct(s.falseKeepRate)}) | ${s.falseCuts} of ${s.keeps} (${pct(s.falseCutRate)}) | ${s.changesMissed} of ${s.changed} | **${s.pass ? 'PASS' : 'FAIL'}**${s.exports > 1 || s.merges > 1 ? ` (exam exported ${s.exports}×, answers merged ${s.merges}× — see data/runs)` : ''} |`);
  }
  L.push('', '"Native changes kept as-is" counts every line the natives fixed or cut that the judge would have kept — it is not part of the bar, but it is the number to watch where the natives cut few lines.', '');
  // what the failure is made of: how often each judge wanted to change a line, by what the natives did with it
  L.push('### How often a judge wanted to change a line, by what the natives did', '');
  L.push('| language | judge | lines the natives kept | lines the natives fixed | lines the natives cut |', '|---|---|---|---|---|');
  for (const lang of Object.keys(LANGS)) for (const judge of Object.keys(JUDGES)) {
    const s = out.results[judge]?.[lang];
    if (!s) continue;
    const share = (v) => { const row = s.matrix[v], n = row.KEEP + row.FIX + row.CUT; return n ? `${row.FIX + row.CUT} of ${n} (${pct((row.FIX + row.CUT) / n)})` : '—'; };
    L.push(`| ${LANGS[lang]} | ${JUDGES[judge]} | ${share('KEEP')} | ${share('FIX')} | ${share('CUT')} |`);
  }
  L.push('', 'A useful judge flags few of the first column and most of the last. Both judges flag the natives\' cuts, but they also want to change roughly half of the lines the natives kept, and about as often as the lines the natives fixed: they cannot tell a line a native would leave alone from one a native would touch. The exam takes the natives\' keeps as right. Some of the judges\' objections to kept lines may be fair — they name real words — but nothing on record can say which, so they count as errors.', '');

  for (const lang of Object.keys(LANGS)) {
    const rowsJ = Object.entries(judged[lang] || {}).map(([ref, j]) => ({ n: native.get(ref), j }));
    if (!rowsJ.length) continue;
    const both = (r) => Object.keys(JUDGES).every((k) => r.j[k]);
    const kv = (v) => (v === 'KEEP' ? 'KEEP' : 'NOT');
    const agree = rowsJ.filter((r) => both(r) && Object.keys(JUDGES).every((k) => r.j[k].verdict === r.n.verdict));
    const disagree = rowsJ.filter((r) => both(r) && Object.keys(JUDGES).some((k) => kv(r.j[k].verdict) !== kv(r.n.verdict)));
    const rank = (r) => (r.n.verdict === 'CUT' ? 0 : r.n.verdict === 'FIX' ? 1 : 2);
    const rand = mulberry32(SEED + 900 + Object.keys(LANGS).indexOf(lang));
    const pickAgree = [...shuffle(agree.filter((r) => r.n.verdict !== 'KEEP'), rand).slice(0, 3), ...shuffle(agree.filter((r) => r.n.verdict === 'KEEP'), rand)].slice(0, 5);
    // both kinds of miss: up to two lines the natives changed that a judge kept, the rest lines the natives kept that
    // both judges wanted changed (the failure that sinks the exam)
    const missed = shuffle(disagree.filter((r) => r.n.verdict !== 'KEEP'), rand).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
    const overFlagged = shuffle(disagree.filter((r) => r.n.verdict === 'KEEP' && Object.keys(JUDGES).every((k) => r.j[k].verdict !== 'KEEP')), rand);
    const pickDis = [...missed, ...overFlagged].slice(0, 5);
    const nat = (n) => `${n.verdict}${n.rewrite ? ` → "${md(n.rewrite)}"` : ''}${n.reason ? ` — *${md(n.reason)}*` : ''}`;
    const jd = (j) => (j ? `${j.verdict} (${j.speaker}/${j.joke}) ${md(j.reason)}${j.rewrite ? ` → "${md(j.rewrite)}"` : ''}` : '—');
    const table = (rows) => ['| English | draft | native | Sonnet 5.5 | Opus 5.5 |', '|---|---|---|---|---|', ...rows.map((r) => `| ${md(r.n.en)} | ${md(r.n.draft)} | ${nat(r.n)} | ${jd(r.j.sonnet)} | ${jd(r.j.opus)} |`)];
    L.push(`## ${LANGS[lang]} — examples`, '', `Agreed (both judges gave the native's verdict; ${agree.length} lines did):`, '', ...table(pickAgree), '', `Disagreed (a judge kept what the native changed, or changed what the native kept; ${disagree.length} lines). The first ${missed.length} are lines the native changed and a judge kept; the rest are lines the native kept and both judges wanted changed:`, '', ...table(pickDis), '');
  }

  L.push('## Method — what was fixed before the exam, what I would change', '');
  L.push('- **Fixed before any judge ran:** the verdict set and its KEEP/FIX/CUT rule (30% letter-sequence overlap), the left-out rows and their reasons, the 50/50 split (seed 20261011; rows sharing an English, a draft or a native line kept on one side; stratified by verdict; balanced by rows), the judge prompt (`scripts/lang-judge/judge-prompt.md`), the twelve anchors and the compare-pair rule, and the pass bar. No anchor, prompt line or threshold was changed after a result was seen.');
  L.push('- **Blind:** each judge saw only its bundle (the prompt, the language pack with every EXAM line removed from the confirmed lines and withheld from the pack files, the humour doctrine, twelve TRAIN anchors) and its batch (English + draft + two TRAIN compare lines). No confidence tag, back-translation or checker verdict exists for these lines, and no EXAM verdict was in any file it was given. Batch files sat outside the repository; the id → line map stayed in it.');
  L.push('- **Bound to its inputs:** `data/exam-result.json` records the hash of the prompt, the verdict set, each bundle, the code that picks anchors and batches, and each judge\'s scored answers; an October run refuses to start if any of them has changed since.' + attemptsNote(out));
  L.push('- **What I would change next time:** calibrate the judge\'s bar for "fix" on TRAIN before the exam — these natives left most lines alone, and both judges hold a far stricter bar than they do; ask the natives to tick KEEP / FIX / CUT themselves — reading it off how much they changed is coarse in isiZulu and isiXhosa, where one prefix changes a whole word; get far more native cuts (isiZulu\'s whole review cut two witty lines); have both isiXhosa reviewers rule every row (35 of the changes are one reviewer\'s against the other\'s approval); and collect a written reason per row, so anchors can teach the ear rather than only show it.');
  return L.join('\n') + '\n';
}

// the attempt counts as recorded, not assumed
function attemptsNote(out) {
  const pairs = Object.keys(LANGS).flatMap((l) => Object.keys(JUDGES).map((j) => out.results[j]?.[l]));
  const run = pairs.filter(Boolean);
  if (run.length < pairs.length) return ` ${run.length} of the ${pairs.length} judge-and-language exams were run; attempts are counted in \`data/runs\` and \`data/judgments\`.`;
  return run.every((x) => x.exports === 1 && x.merges === 1)
    ? ` Each of the ${pairs.length} judge-and-language exams was exported once and its answers merged once (\`data/runs\`, \`data/judgments\`).`
    : ' Attempts are counted in `data/runs` and `data/judgments`; the pass/fail table marks any exam exported or merged more than once.';
}

// ---------- report (step 4) ----------
// The types a judge's reason names, for the list under each table (Maat's brief, 12 Oct 2026: where the drafter's
// habits are). Read off the reason's words; a reason can name more than one, and one that names none is counted as such.
export const REASON_TYPES = [
  ['wrong word', /\bmeans?\b|\bmeaning\b|wrong word|not the (?:word|verb|noun)|the (?:word|verb|noun) (?:for|is)\b|reads as|(?:is|reads|shaped like|an?) (?:isi)?zulu|(?:isi)?zulu (?:word|form|verb)|neighbouring|not (?:an? )?(?:isixhosa|isizulu) word|no such word|not a word|coined|wrong verb|wrong noun|misspel|\bsays\b|\bis wrong\b|, not '|\bis '|the app's word|not a sure|pictures an?\b|leans to/i],
  ['wrong concord', /concord|agreement|\bagree(?:s|ing)? with|noun class|\bclass \d|prefix|\btense\b|locative|copula|subject marker|object marker|possessive|\b-ya-|plural|singular|negative form|marker|passive|participial|subjunctive/i],
  ['raw English loan where the language has a word', /(?:forced|raw|english|bare) loan|loan where|(?:raw|bare|forced|plain) english|(?:leaves?|left) (?:the )?english|english (?:word|noun|verb|adjective|phrase|compound|left|carrying|where)|\bin english\b/i],
  ['translated where people keep the English', /code-?switch|keeps? (?:the )?(?:loan|name|english)|people (?:just )?(?:keep|say) (?:the |ii-|i-|')|natives (?:keep|kept)|translated (?:nickname|coinage)|as loans/i],
  ['joke lost', /\bjoke|punch|\bthe turn\b|turn (?:is )?(?:lost|gone)|\bflat\b|\blost\b|\bloses\b|\bdropp?(?:ed|s)\b|disappears|wordplay|\bpun\b/i],
  ['register', /stiff|formal|literal|calque|translat|unnatural|awkward|clunky|bookish|wordy|long-winded|register|a speaker (?:would )?(?:says?|writes?)|people (?:just )?(?:say|write)|\bodd\b|heavy|unusual|back to front|laboured|clumsy|not the everyday|abrupt/i],
];
export function reasonTypes(reason) {
  return REASON_TYPES.filter(([, re]) => re.test(reason || '')).map(([t]) => t);
}

// The judgments to publish for a language: a judge that passed, or a judge run as a detector, each only while what it
// stands on still holds — the exam answers it was scored on, the exam inputs (byte for byte), the October run on record,
// the model that sat the exam. Returns [{ judge, J, why }] (why = the reason it is not shown, or null).
function octoberJudgments(V, result, lang) {
  const out = [];
  let bundleText = null;
  for (const judge of Object.keys(JUDGES)) {
    const f = path.join(DATA, 'judgments', `october-${judge}-${lang}.json`);
    const J = fs.existsSync(f) ? readJson(f) : null;
    const passed = !!result.results?.[judge]?.[lang]?.pass;
    if (!passed && !J?.detector) continue;
    if (!J) { out.push({ judge, J: null, why: `${JUDGES[judge]} passed but has not been run on the October lines yet` }); continue; }
    let why = null;
    try {
      bundleText ??= buildBundle(V, lang).text;
      const { res, inputs } = passedExam(judge, lang, bundleText, J.detector || null);
      const stale = Object.keys(inputs).filter((k) => inputs[k] !== J.inputs?.[k]);
      const mf = mapFile('october', lang, judge);
      const run = fs.existsSync(mf) ? readJson(mf) : null;
      if (!run || sha(fs.readFileSync(mf, 'utf8')) !== J.run) stale.push('the October run (exported again since these answers)');
      else if ((run.detector || null) !== (J.detector || null)) stale.push('the detector reason');
      if (J.model !== res.model) why = `answers are from ${J.model}, the exam was sat by ${res.model}`;
      else if (stale.length) why = `answers were given on other inputs than the exam (${stale.join(', ')})`;
    } catch (e) { why = e.message; }
    out.push({ judge, J, why });
  }
  return out;
}

function report() {
  const result = readJson(path.join(DATA, 'exam-result.json'));
  const V = loadVerdicts();
  const date = new Date().toISOString().slice(0, 10);
  const found = Object.fromEntries(OCTOBER_LANGS.map((lang) => [lang, octoberJudgments(V, result, lang)]));
  const visible = Object.values(found).flat().filter((x) => x.J && !x.why);
  const reasons = [...new Set(visible.filter((x) => x.J.detector).map((x) => x.J.detector))];
  const L = ['# Native-ear judge — verdicts on the October lines', ''];
  if (visible.length) {
    for (const r of reasons) L.push(`> **${r}**`, '');
    L.push(`Built ${date} by \`scripts/lang-judge/judge.mjs report\`. The October lines were written by Claude Opus 5.5 and seen by no native. ${reasons.length ? 'A judge marked *run as a detector* failed its exam (`review/lang-judge-exam-2026-10.md`); it read these lines blind, on the exam\'s exact inputs, and every flag it gives is a lead, not a verdict. ' : ''}${visible.some((x) => !x.J.detector) ? 'A judge marked *passed the exam* passed the language\'s exam (`review/lang-judge-exam-2026-10.md`) and judged the lines blind on the same inputs. ' : ''}Lines marked **held** are not in the app; they are here so they are seen beside the applied ones. **Nothing in the app was changed by this run: no line was edited, held, released or shipped. Maat rules from this file; Al rules from Maat.**`, '');
    L.push('Scores: speaker = reads like a speaker (1–5), joke = the joke lands (1–5). Sorted CUT, then FIX, then KEEP; within each, lowest speaker score first.', '');
  } else {
    L.push(`Built ${date} by \`scripts/lang-judge/judge.mjs report\`. **No judge passed its exam (\`review/lang-judge-exam-2026-10.md\`), so no October line was judged.** Al's brief: a judge that cannot reproduce the natives' calls has no business judging new lines. The October isiXhosa and isiZulu lines stay exactly as they are — provisional, waiting for a native reader. Nothing in the app was changed.`, '');
  }
  for (const lang of OCTOBER_LANGS) {
    L.push(`## ${LANGS[lang]}`, '');
    if (!found[lang].length) { L.push(`Neither judge passed the ${LANGS[lang]} exam, and none was run as a detector, so no judge read these lines. They stay as they are: provisional, waiting for a native reader.`, ''); continue; }
    for (const { judge, J, why } of found[lang]) {
      if (!J || why) { L.push(`${JUDGES[judge]}'s October answers are not shown: ${why}.`, ''); continue; }
      const order = { CUT: 0, FIX: 1, KEEP: 2 };
      const rows = [...J.rows].sort((a, b) => order[a.verdict] - order[b.verdict] || a.speaker - b.speaker || a.joke - b.joke || a.en.localeCompare(b.en));
      const n = (v, rs = rows) => rs.filter((r) => r.verdict === v).length;
      const held = rows.filter((r) => r.held);
      L.push(`### ${JUDGES[judge]} (${J.model})${J.detector ? ' — run as a detector' : ' — passed the exam'}`, '');
      L.push(`${rows.length} lines judged (${rows.length - held.length} applied, ${held.length} held): **CUT ${n('CUT')} · FIX ${n('FIX')} · KEEP ${n('KEEP')}**.${held.length ? ` The held lines alone: CUT ${n('CUT', held)} · FIX ${n('FIX', held)} · KEEP ${n('KEEP', held)}.` : ''}${J.missing ? ` ${J.missing} line(s) got no valid answer and are not in the table.` : ''}`, '');
      L.push('| key | English | draft | speaker | joke | verdict | judge\'s reason | judge\'s proposed rewrite |', '|---|---|---|---|---|---|---|---|');
      for (const r of rows) L.push(`| ${md(r.ref)}${r.held ? ` — **held** (${md(r.held.replace(/^held after Maat fix: held: /, 'after a Maat fix: ').replace(/^held: /, ''))})` : ''} | ${md(r.en)} | ${md(r.draft)} | ${r.speaker} | ${r.joke} | **${r.verdict}** | ${md(r.reason)} | ${md(r.rewrite || '')} |`);
      const flagged = rows.filter((r) => r.verdict !== 'KEEP');
      const tally = new Map(REASON_TYPES.map(([t]) => [t, 0]));
      let none = 0;
      for (const r of flagged) { const ts = reasonTypes(r.reason); if (!ts.length) none++; for (const t of ts) tally.set(t, tally.get(t) + 1); }
      L.push('', `**The judge's reasons by type** — the ${flagged.length} lines it flagged (CUT or FIX). Read off the words of each reason; one reason can name more than one type.`, '');
      for (const [t, c] of [...tally].sort((a, b) => b[1] - a[1])) L.push(`- ${t.replace('the language', LANGS[lang])} — ${c}`);
      if (none) L.push(`- none of these named — ${none}`);
      L.push('');
    }
  }
  L.push('## Sesotho', '', 'Exam only, as the brief says: no October Sesotho lines exist.', '');
  fs.writeFileSync(path.join(ROOT, 'review', 'lang-judge-verdicts-2026-10.md'), L.join('\n'));
  console.log('wrote review/lang-judge-verdicts-2026-10.md');
}

// ---------- leads: live-bank errors the exam surfaced (Maat's brief, 12 Oct 2026) ----------
// Every EXAM line the natives kept where both judges said FIX or CUT, each with a 2 or lower on its speaker or joke
// score. For Maat to rule on after launch; nothing is changed.
export function leadRows(native, sonnetRows, opusRows) {
  const op = new Map(opusRows.map((j) => [j.ref, j]));
  const low = (j) => j && j.verdict !== 'KEEP' && Math.min(j.speaker, j.joke) <= 2;
  return sonnetRows.filter((s) => native.get(s.ref)?.verdict === 'KEEP' && low(s) && low(op.get(s.ref))).map((s) => ({ n: native.get(s.ref), s, o: op.get(s.ref) }));
}
async function leads() {
  const V = loadVerdicts();
  const native = new Map(V.rows.map((r) => [r.id, r]));
  // is the kept line still the live line? (later passes may have replaced it; Sesotho was respelled to the South African
  // orthography on 6 Sept 2026, so a respelled line counts as the same line)
  const same = (lang, t) => (lang === 'st' ? stToSa(t) : t);
  const live = {};
  for (const lang of Object.keys(LANGS)) {
    const set = new Set();
    for (const group of ['witty', 'witty_low_confidence']) for (const bank of Object.values(WEATHER_COPY[group] || {})) for (const t of bank[lang] || []) set.add(same(lang, t));
    const f = path.join(ROOT, 'assets', `hero-lines-${lang}.js`);
    if (fs.existsSync(f)) for (const t of Object.values((await import(pathToFileURL(f).href))[`HERO_LINES_${lang.toUpperCase()}`] || {})) set.add(same(lang, t));
    live[lang] = set;
    live[lang].holds = (t) => set.has(same(lang, t));
  }
  const by = {};
  for (const lang of Object.keys(LANGS)) {
    const J = (judge) => readJson(path.join(DATA, 'judgments', `exam-${judge}-${lang}.json`)).rows;
    by[lang] = leadRows(native, J('sonnet'), J('opus')).sort((a, b) => Math.min(a.s.speaker, a.s.joke, a.o.speaker, a.o.joke) - Math.min(b.s.speaker, b.s.joke, b.o.speaker, b.o.joke) || a.n.key.localeCompare(b.n.key));
  }
  const L = ['# Live-bank errors the exam surfaced (October 2026)', ''];
  L.push(`Built ${new Date().toISOString().slice(0, 10)} by \`scripts/lang-judge/judge.mjs leads\`, from the exam's answers (\`scripts/lang-judge/data/judgments/exam-*\`). Every EXAM line the native reviewers **kept** where **both** judges (Sonnet 5.5 and Opus 5.5) said FIX or CUT, each giving a 2 or lower on its speaker or joke score. Neither judge passed the exam; these are leads for Maat to rule on after launch, not verdicts. The judge was not re-run over the live bank. Nothing in the app was changed.`, '');
  L.push('| language | leads | still live |', '|---|---|---|');
  for (const lang of Object.keys(LANGS)) L.push(`| ${LANGS[lang]} | ${by[lang].length} | ${by[lang].filter((x) => live[lang].holds(x.n.draft)).length} |`);
  L.push('', '"Still live" = the kept line is in the bank or the photo table today exactly as the natives saw it (Sesotho: allowing for the 6 Sept 2026 respelling to South African orthography); where it is not, a later pass has already changed it.', '');
  const jd = (j) => `${j.verdict} (${j.speaker}/${j.joke}) ${md(j.reason)}${j.rewrite ? ` → "${md(j.rewrite)}"` : ''}`;
  for (const lang of Object.keys(LANGS)) {
    L.push(`## ${LANGS[lang]} — ${by[lang].length}`, '');
    if (!by[lang].length) { L.push('None.', ''); continue; }
    L.push('| key | English | the kept line | live now | Sonnet 5.5 | Opus 5.5 |', '|---|---|---|---|---|---|');
    for (const { n, s, o } of by[lang]) L.push(`| ${md(n.key)} | ${md(n.en)} | ${md(n.draft)} | ${live[lang].holds(n.draft) ? 'yes' : 'no'} | ${jd(s)} | ${jd(o)} |`);
    L.push('');
  }
  fs.writeFileSync(path.join(ROOT, 'review', 'live-bank-errors-from-exam-2026-10.md'), L.join('\n'));
  console.log(`wrote review/live-bank-errors-from-exam-2026-10.md — ${Object.entries(by).map(([l, x]) => `${l} ${x.length}`).join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const cmd = process.argv[2];
  if (cmd === 'export') await exportSet();
  else if (cmd === 'merge') merge();
  else if (cmd === 'score') score();
  else if (cmd === 'report') report();
  else if (cmd === 'leads') await leads();
  else console.log('usage: judge.mjs export | merge | score | report | leads (see the header)');
}
