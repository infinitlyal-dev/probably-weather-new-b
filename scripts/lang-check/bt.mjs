// Back-translation pass (9 Oct 2026): a second model — Sonnet 5.5, run as a subagent — translates each line back to
// English BLIND, then compares its own back-translation with the English source. This script prepares the batches and
// folds the answers into the cache the rebuilt checker reads (data/bt-cache.jsonl, one record per lang + text).
//
//   node scripts/lang-check/bt.mjs export <set.json> [--out data/bt/<name>] [--size 260]
//       <set.json>: an array of {lang, text, en} (or {items: […]}). Writes <name>-NN-blind.json (id, lang, text — no English,
//       no source, no label: ids are opaque) and <name>-NN-src.json (id, en), plus <name>-map.json.
//   node scripts/lang-check/bt.mjs merge <dir-or-prefix>
//       reads every *-out.json beside its -blind.json and writes/updates data/bt-cache.jsonl.
//
// The subagent brief is BT_BRIEF below (the skills quote it): step 1 writes *-bt.json before step 2 opens *-src.json.

import fs from 'node:fs';
import path from 'node:path';
import { BT_CACHE, btKey } from './lib/checker-v2.mjs';

export const BT_BRIEF = (blind, src, bt, out) => `You are a careful translator of South African languages (isiZulu "zu", isiXhosa "xh", Sesotho "st" in South African orthography, Afrikaans "af"). You are the back-translation pass of a translation checker for a weather app's short witty lines. Work only with the files named below; do not edit anything else.

STEP 1 — blind back-translation. Read ${blind} (an array of {id, lang, text}). Do NOT open the -src file yet. For every item, translate the text into plain, literal English as a translator who has never seen any source line. Keep the sense, tense, time of day and intensity exactly as written. If a word is unknown to you, doubtful, or not a real word of that language, keep it in brackets with a question mark, e.g. "[?imbatata]". If the line is not in the stated language (for example isiZulu where isiXhosa is stated, Setswana or Sepedi where Sesotho is stated, Dutch where Afrikaans is stated), still translate it, and note the language you think it is. Write ${bt} as an array of {"id","bt","langSeen"} where langSeen is the language you believe the text is in (zu/xh/st/af/tn/nso/nl/en/mixed). Write this file completely before step 2.

STEP 2 — compare. Now read ${src} (array of {id, en}: the English source each line was meant to carry). For each id, compare YOUR back-translation (not a fresh reading) with the English and give one verdict:
- "same": says what the English says (wording may differ).
- "loose": a transcreation — a different joke, image or idiom, or a plain warm remark, about the SAME weather, time and situation. This is normal and fine for witty copy.
- "drift": the meaning changed in a way a reader would notice — the weather condition, time of day (today/tonight/tomorrow/morning), intensity, yes/no (rain vs no rain), the subject, or a fact is wrong, added or missing so the line no longer says what the English says.
- "wrong-language": wholly or largely in another language than the stated one.
- "untranslated": English words left in that are not normal South African code-switching (braai, bakkie, OK, Weber, brand names are normal).
- "garbled": cannot be read as the stated language (non-words, broken grammar that blocks the meaning).
Judge plainly; do not invent problems, and do not excuse real changes of meaning as "loose". Write ${out} as an array of {"id","bt","langSeen","verdict","confidence","note"} — confidence 0.0–1.0 in your verdict, note at most 12 words saying what changed (empty for same/loose). Every id in the input must appear exactly once. Valid JSON only.

When done, reply with one line: the counts per verdict.`;

const [cmd, target] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };

if (cmd === 'export') {
  const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
  const set = (Array.isArray(raw) ? raw : raw.items).filter((x) => x.text && x.lang);
  const prefix = path.resolve(arg('--out', path.join(import.meta.dirname, 'data', 'bt', path.basename(target, '.json'))));
  const size = Number(arg('--size', 260));
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  const map = {};
  let b = 0;
  for (let i = 0; i < set.length; i += size, b++) {
    const nn = String(b + 1).padStart(2, '0');
    const sl = set.slice(i, i + size).map((x, k) => ({ ...x, id: `${path.basename(prefix)}-${nn}-${String(k + 1).padStart(3, '0')}` }));
    for (const x of sl) map[x.id] = { lang: x.lang, text: x.text, en: x.en || '', ref: x.ref || x.key || null };
    fs.writeFileSync(`${prefix}-${nn}-blind.json`, JSON.stringify(sl.map(({ id, lang, text }) => ({ id, lang, text }))));
    fs.writeFileSync(`${prefix}-${nn}-src.json`, JSON.stringify(sl.map(({ id, en }) => ({ id, en: en || '' }))));
    console.log(`${prefix}-${nn}: ${sl.length} lines — brief:\n${BT_BRIEF(`${prefix}-${nn}-blind.json`, `${prefix}-${nn}-src.json`, `${prefix}-${nn}-bt.json`, `${prefix}-${nn}-out.json`).slice(0, 0)}`);
  }
  fs.writeFileSync(`${prefix}-map.json`, JSON.stringify(map));
  console.log(`${b} batch(es). Give each to a Sonnet 5.5 subagent with BT_BRIEF (bt.mjs), then: node scripts/lang-check/bt.mjs merge ${path.relative(process.cwd(), path.dirname(prefix))}`);
} else if (cmd === 'merge') {
  const dir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? target : path.dirname(target);
  const cache = new Map();
  let added = 0, missing = 0, bad = 0, invalid = 0;
  const VERDICTS = new Set(['same', 'loose', 'drift', 'wrong-language', 'untranslated', 'garbled']);
  // a real number in 0..1, or a numeric string; never a boolean, null or blank (Sol, 10 Oct 2026: Number(false) is 0)
  const confOk = (c) => (typeof c === 'number' || (typeof c === 'string' && c.trim() !== '')) && Number.isFinite(Number(c)) && Number(c) >= 0 && Number(c) <= 1;
  // records already cached are held to the same shape; a broken one is dropped, so its line counts as unchecked
  if (fs.existsSync(BT_CACHE)) for (const l of fs.readFileSync(BT_CACHE, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let r; try { r = JSON.parse(l); } catch { invalid++; continue; }
    if (!r || typeof r.lang !== 'string' || typeof r.text !== 'string' || typeof r.bt !== 'string' || r.bt.trim() === '' || !VERDICTS.has(r.verdict) || !confOk(r.confidence)) { invalid++; continue; }
    cache.set(btKey(r.lang, r.text, r.en), r);
  }
  // Files merge in name order and a later run's answer for the same line and English replaces an earlier one — on
  // purpose: a revised draft is re-checked under a later name (drafts-xh-r2 after drafts-xh-01).
  for (const f of fs.readdirSync(dir).filter((f) => /-out\.json$/.test(f)).sort()) {
    let out;
    try { out = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { console.log(`  ${f}: not valid JSON — skipped`); bad++; continue; }
    if (!Array.isArray(out)) { console.log(`  ${f}: not an array of answers — skipped`); bad++; continue; }
    const blind = JSON.parse(fs.readFileSync(path.join(dir, f.replace('-out.json', '-blind.json')), 'utf8'));
    const src = JSON.parse(fs.readFileSync(path.join(dir, f.replace('-out.json', '-src.json')), 'utf8'));
    // Every answer must be well formed and given once (Sol, 9 Oct 2026); anything else is not cached, so the gate
    // treats that line as never back-translated and holds it.
    const count = new Map(); for (const o of out) count.set(o?.id, (count.get(o?.id) || 0) + 1);
    const valid = (o) => o && count.get(o.id) === 1 && VERDICTS.has(o.verdict) && typeof o.bt === 'string' && o.bt.trim() !== ''
      && confOk(o.confidence);
    const byId = new Map(out.filter(valid).map((o) => [o.id, o]));
    invalid += out.length - byId.size;
    const enOf = new Map(src.map((s) => [s.id, s.en]));
    for (const x of blind) {
      const o = byId.get(x.id);
      if (!o) { missing++; continue; }
      const en = enOf.get(x.id) || '';
      cache.set(btKey(x.lang, x.text, en), { lang: x.lang, text: x.text, en, bt: o.bt, langSeen: o.langSeen, verdict: o.verdict, confidence: Number(o.confidence), note: o.note || '', model: 'claude-sonnet-5-5', run: path.basename(f, '-out.json'), at: new Date().toISOString().slice(0, 10) });
      added++;
    }
  }
  fs.writeFileSync(BT_CACHE, [...cache.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`bt-cache: ${cache.size} records (${added} from this merge, ${missing} ids without a valid answer, ${invalid} malformed or duplicate answers dropped, ${bad} unreadable files)`);
} else {
  console.log('usage: bt.mjs export <set.json> [--out prefix] | bt.mjs merge <dir>');
}
