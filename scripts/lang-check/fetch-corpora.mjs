// Rebuilds .lang-check-cache/ from the public sources verified reachable on 2026-09-06.
// Everything here was downloaded and used to build the shipped indexes; this script exists so
// a fresh clone can reproduce the cache (it is git-ignored — ~500 MB unpacked).
//
//   node scripts/lang-check/fetch-corpora.mjs            # download + unpack everything reachable
//   node scripts/lang-check/lang-check.mjs --build-index # then compile the indexes
//
// Needs: node 24 (fetch), system `tar`, and — optional, for three conversions — python 3 with
// `pymupdf` (constitution PDFs → text), `xlrd` (NCHLT .xls annotations → tsv). Without python the
// index builder still runs; it just lacks those two sources.
//
// Licences (full list in lib/build-index.mjs SOURCES): kaikki/Wiktionary CC BY-SA; Leipzig LCC
// (research/non-commercial per their download page — verify before any commercial reuse);
// NCHLT / Autshumato CC BY 2.5 ZA; SADiLaR morph data and African Wordnet CC BY 4.0; Bukantswe
// CC BY 3.0 ZA; Hunspell af_ZA LGPL, nl_NL BSD, en_US MIT/BSD; Constitution: SA government text.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CACHE } from './lib/build-index.mjs';

const UA = 'ProbablyWeather-langcheck/0.1 (infinitlyal@gmail.com)';
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);
const mk = (p) => fs.mkdirSync(p, { recursive: true });

async function dl(url, dest, { skipIfExists = true } = {}) {
  if (skipIfExists && fs.existsSync(dest) && fs.statSync(dest).size > 0) { console.log(`  have ${path.basename(dest)}`); return true; }
  process.stdout.write(`  ${url} → ${path.relative(CACHE, dest)} … `);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) { console.log(`HTTP ${r.status}`); return false; }
    const buf = Buffer.from(await r.arrayBuffer());
    mk(path.dirname(dest));
    fs.writeFileSync(dest, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
    return true;
  } catch (e) { console.log(`FAILED ${e.message}`); return false; }
}
function py(script, label) {
  try { execFileSync('python', ['-c', script], { stdio: 'inherit', cwd: CACHE }); return true; }
  catch { console.log(`  (python step skipped: ${label})`); return false; }
}

const SADILAR = 'https://repo.sadilar.org/server/api/core/bitstreams';
const SADILAR_FILES = {
  'sadilar/morph-zu.txt': '2c569cf8-103d-4c7c-b6d5-f9fb460709e1', 'sadilar/morph-xh.txt': 'c437acf1-c975-4c35-bdc5-c1daf6667a1b', 'sadilar/morph-st.txt': 'a2215d47-0556-44db-aff5-b559808f89bb',
  'sadilar/README.Morph.txt': 'ba1cf41b-ac07-4749-a192-58567264e715',
  'sadilar/bukantswe.zip': 'b3fa21ff-4c9d-4acf-b6e7-e3df978c0485', 'sadilar/wordnet-zu.zip': '68f7ac3d-0cad-4249-a548-98001f76165e', 'sadilar/wordnet-xh.zip': '519cda34-0ff4-40a4-a02d-2341d9d7499c',
  'sadilar/autshumato-wordphrase.zip': '66816a90-04cc-47e3-bb3d-c41beecf75ed',
  'sadilar/nchlt-zu.zip': '2e8b06fb-a5cd-4d96-9271-177b69c49961', 'sadilar/nchlt-xh.zip': '653ef3e7-9d26-4394-a954-e02c8f5c82bf', 'sadilar/nchlt-af.zip': '79909f82-6965-4036-a360-d5b9f5574689',
  'sadilar/nchlt-st.zip': 'e6791ffa-4816-43f2-b52b-bff33934c9a3', 'sadilar/nchlt-tn.zip': '482d37d3-8318-4a2d-ace7-96f3904b0d0b', 'sadilar/nchlt-nso.zip': '0cdd50ea-7dea-4ef0-a29e-2cfd165a1b44',
};
const LEIPZIG = ['zul_community_2017', 'zul_mixed_2014_100K', 'zul-za_web_2018_30K', 'xho_community_2017', 'xho-za_web_2018_30K', 'sot_community_2017', 'sot-za_web_2018_10K', 'afr_mixed_2019_300K', 'tsn_community_2017', 'nso-za_web_2018_10K'];

async function main() {
  mk(CACHE);
  if (want('kaikki')) {
    console.log('kaikki (English Wiktionary extracts)');
    for (const L of ['Zulu', 'Xhosa', 'Sotho', 'Afrikaans']) await dl(`https://kaikki.org/dictionary/${L}/kaikki.org-dictionary-${L}.jsonl`, path.join(CACHE, 'kaikki', `${L}.jsonl`));
  }
  if (want('leipzig')) {
    console.log('Leipzig Corpora Collection');
    for (const c of LEIPZIG) {
      const tgz = path.join(CACHE, 'leipzig', `${c}.tar.gz`);
      if (await dl(`https://downloads.wortschatz-leipzig.de/corpora/${c}.tar.gz`, tgz) && !fs.existsSync(path.join(CACHE, 'leipzig', c))) execFileSync('tar', ['-xzf', tgz], { cwd: path.join(CACHE, 'leipzig') });
    }
  }
  if (want('sadilar')) {
    console.log('SADiLaR (NCHLT, morph, Bukantswe, Wordnet, Autshumato)');
    for (const [rel, uuid] of Object.entries(SADILAR_FILES)) await dl(`${SADILAR}/${uuid}/content`, path.join(CACHE, rel));
    for (const z of ['bukantswe', 'wordnet-zu', 'wordnet-xh', 'autshumato-wordphrase', 'nchlt-zu', 'nchlt-xh', 'nchlt-af', 'nchlt-st', 'nchlt-tn', 'nchlt-nso']) {
      const dir = path.join(CACHE, 'sadilar', z);
      if (!fs.existsSync(dir) && fs.existsSync(`${dir}.zip`)) { mk(dir); execFileSync('tar', ['-xf', `${dir}.zip`, '-C', dir]); }
    }
    // NCHLT .xls token/lemma/POS → tsv (python + xlrd)
    mk(path.join(CACHE, 'nchlt'));
    py(`import xlrd,glob,os
for kind,sub in [('lemma','1.Lemmatized'),('pos','2.POS Annotated')]:
  for lang in ['zu','xh','st','af','tn','nso']:
    out=open(f'nchlt/{lang}.{kind}.tsv','w',encoding='utf8')
    for f in sorted(glob.glob(f'sadilar/nchlt-{lang}/{lang}/{sub}/*.xls')):
      sh=xlrd.open_workbook(f).sheet_by_index(0)
      for r in range(sh.nrows):
        vals=[str(sh.cell_value(r,c)).strip() for c in range(sh.ncols)]
        if any(vals): out.write('\\t'.join(vals)+'\\n')
    out.close()
# LARA2 containers hold the raw running text as a zip after a short header
import zipfile,io
for f in glob.glob('sadilar/nchlt-*/*/1.Lemmatized/*.lemma.full.lara2'):
  b=open(f,'rb').read(); i=b.find(b'PK\\x03\\x04'); lang=f.split(os.sep)[1].split('-')[1]
  z=zipfile.ZipFile(io.BytesIO(b[i:]))
  for n in z.namelist(): open(f'nchlt/{lang}.lemma.{os.path.basename(f).replace(".lara2","")}.data','wb').write(z.read(n))`, 'xlrd not installed (python -m pip install xlrd)');
  }
  if (want('constitution')) {
    console.log('Constitution of South Africa (official translations)');
    for (const l of ['zul', 'xho', 'sot', 'afr', 'eng']) await dl(`https://www.justice.gov.za/constitution/SAConstitution-web-${l}.pdf`, path.join(CACHE, 'constitution', `SAConstitution-web-${l}.pdf`));
    mk(path.join(CACHE, 'text'));
    py(`import fitz
for l in ['zul','xho','sot','afr','eng']:
  d=fitz.open(f'constitution/SAConstitution-web-{l}.pdf'); open(f'text/constitution-{l}.txt','w',encoding='utf8').write('\\n'.join(p.get_text() for p in d))`, 'pymupdf not installed');
  }
  if (want('wiki')) {
    console.log('Wikipedia dumps (zu, xh, st) → plain text');
    for (const w of ['zuwiki', 'xhwiki', 'stwiki']) await dl(`https://dumps.wikimedia.org/${w}/latest/${w}-latest-pages-articles.xml.bz2`, path.join(CACHE, 'wiki', `${w}-latest-pages-articles.xml.bz2`));
    py(`import bz2,re
for w,code in [('zuwiki','zu'),('xhwiki','xh'),('stwiki','st')]:
  raw=bz2.open(f'wiki/{w}-latest-pages-articles.xml.bz2','rt',encoding='utf8').read()
  out=[]
  for title,body in re.findall(r'<title>(.*?)</title>.*?<text[^>]*>(.*?)</text>',raw,re.S):
    if ':' in title or body.lstrip().lower().startswith('#redirect'): continue
    t=re.sub(r'\\{\\{[^{}]*\\}\\}',' ',body); t=re.sub(r'\\{\\{[^{}]*\\}\\}',' ',t)
    t=re.sub(r'<ref[^>]*/>',' ',t); t=re.sub(r'<ref[^>]*>.*?</ref>',' ',t,flags=re.S); t=re.sub(r'<[^>]+>',' ',t)
    t=re.sub(r'\\[\\[(?:[^|\\]]*\\|)?([^\\]]*)\\]\\]',r'\\1',t); t=re.sub(r'\\[https?://[^\\s\\]]+\\s*([^\\]]*)\\]',r'\\1',t)
    t=re.sub(r\"'{2,}\",'',t); t=re.sub(r'^[=\\*#:;|!{}\\-]+.*$',' ',t,flags=re.M); t=re.sub(r'&[a-z]+;',' ',t); t=re.sub(r'[ \\t]+',' ',t)
    out.append(t)
  open(f'text/wiki-{code}.txt','w',encoding='utf8').write('\\n'.join(out))`, 'python not available');
  }
  if (want('wiktionary')) {
    console.log('zu / st Wiktionary (native-language dictionaries, full page text via the API)');
    mk(path.join(CACHE, 'wiktionary'));
    for (const code of ['zu', 'st']) {
      const out = path.join(CACHE, 'wiktionary', `${code}-wiktionary.jsonl`);
      if (fs.existsSync(out)) { console.log(`  have ${path.basename(out)}`); continue; }
      const lines = [];
      let params = { action: 'query', generator: 'allpages', gapnamespace: 0, gaplimit: 50, prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: 2 };
      for (;;) {
        const r = await fetch(`https://${code}.wiktionary.org/w/api.php?${new URLSearchParams(params)}`, { headers: { 'User-Agent': UA } });
        const d = await r.json();
        for (const p of d.query?.pages || []) lines.push(JSON.stringify({ title: p.title, text: p.revisions?.[0]?.slots?.main?.content || '' }));
        if (d.continue) { params = { ...params, ...d.continue }; await new Promise((res) => setTimeout(res, 300)); } else break;
      }
      fs.writeFileSync(out, lines.join('\n') + '\n');
      console.log(`  ${code}.wiktionary: ${lines.length} pages`);
    }
  }
  if (want('hunspell')) {
    console.log('Hunspell dictionaries (LibreOffice)');
    for (const [d, dir] of [['af_ZA', 'af_ZA'], ['nl_NL', 'nl_NL'], ['en_US', 'en']]) for (const ext of ['dic', 'aff']) await dl(`https://raw.githubusercontent.com/LibreOffice/dictionaries/master/${dir}/${d}.${ext}`, path.join(CACHE, 'hunspell', `${d}.${ext}`));
  }
  console.log('done. next: node scripts/lang-check.mjs --build-index');
}
main().catch((e) => { console.error(e); process.exit(1); });
