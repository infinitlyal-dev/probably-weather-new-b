#!/usr/bin/env node
// lang-check — corpus-backed translation checker for Probably Weather (af / zu / xh / st).
//
//   node scripts/lang-check.mjs --lang zu --en "Rain tonight" --text "Imvula namhlanje"
//   node scripts/lang-check.mjs --file lines.json [--json] [--verbose] [--out report.json]
//        lines.json: [{ "lang": "zu", "en": "...", "text": "...", "key": "witty.rain[3]" }, ...]
//        (or a JSONL file with one such object per line)
//   node scripts/lang-check.mjs --build-index [zu xh st af tn nso nl en]
//   node scripts/lang-check.mjs --sources          # what each index was built from, with licences
//
// Verdict shape (see scripts/lang-check/lib/checker.mjs):
//   { lang, en, text, key, confidence, action: pass|triage|triage-high, ok, findings: [
//       { check: lexical|morphology|semantic|contamination, severity, token, message, evidence } ],
//     coverage: { contentTokens, attested, unknown, enContent, enMatched, enUnmatched, expectations },
//     back: [{ token, form, glosses, matchesSource }] }
//
// Confidence is confidence that the line has a problem. It never auto-applies a fix: 'triage'
// and 'triage-high' mean a native reader decides; 'pass' means the corpora found nothing to
// object to, which is not the same as the line being right (see the skill files for what this
// tool cannot see).

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  if (has('--build-index')) {
    const { buildIndex } = await import('./lang-check/lib/build-index.mjs');
    const langs = args.filter((a) => /^(zu|xh|st|af|tn|nso|nl|en)$/.test(a));
    for (const l of langs.length ? langs : ['en', 'nl', 'tn', 'nso', 'st', 'xh', 'af', 'zu']) {
      const r = buildIndex(l);
      console.log(`${l}: ${r.words} forms, ${r.lemmas} lemmas, ${r.glossed} glossed, ${r.examples} with examples, ${(r.bytes / 1e6).toFixed(1)} MB, ${r.ms} ms — sources ${JSON.stringify(r.sources)}`);
    }
    return;
  }
  if (has('--sources')) {
    const { INDEX_DIR, SOURCES } = await import('./lang-check/lib/build-index.mjs');
    for (const f of fs.existsSync(INDEX_DIR) ? fs.readdirSync(INDEX_DIR) : []) {
      const j = JSON.parse(fs.readFileSync(path.join(INDEX_DIR, f), 'utf8'));
      console.log(`${j.lang}: built ${j.builtAt} — ${JSON.stringify(j.sources)}`);
    }
    for (const [k, s] of Object.entries(SOURCES)) console.log(`  ${k}: ${s.name} — ${s.licence} — ${s.url}`);
    return;
  }
  const { check, formatVerdict } = await import('./lang-check/lib/checker.mjs');
  const verbose = has('--verbose');
  let items = [];
  if (val('--file')) {
    const raw = fs.readFileSync(val('--file'), 'utf8');
    items = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } else if (val('--lang') && val('--text') !== undefined) {
    items = [{ lang: val('--lang'), en: val('--en') || '', text: val('--text') }];
  } else {
    console.error('usage: --lang <zu|xh|st|af> --en "<source>" --text "<translation>" | --file lines.json | --build-index | --sources');
    process.exit(2);
  }
  const results = [];
  for (const it of items) {
    if (!/^(zu|xh|st|af)$/.test(it.lang)) { console.error(`skip: unsupported lang ${it.lang}`); continue; }
    const v = check(it);
    results.push(v);
    if (!has('--json')) console.log(formatVerdict(v, { verbose }));
  }
  if (has('--json')) console.log(JSON.stringify(results, null, 1));
  if (val('--out')) fs.writeFileSync(val('--out'), JSON.stringify(results, null, 1));
  const n = results.length; const t = results.filter((r) => !r.ok).length;
  if (n > 1 && !has('--json')) console.log(`\n${n} lines: ${n - t} pass, ${t} to triage (${results.filter((r) => r.action === 'triage-high').length} high)`);
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
