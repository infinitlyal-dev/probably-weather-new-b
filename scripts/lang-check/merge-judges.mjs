// Merges the two Afrikaans humour judges (review/af-judge-fable.json, review/af-judge-astra.json).
//
//   agree KEEP                → accepted (the drafted line stands)
//   agree FIX/KILL            → accepted-rewrite: the proposal that passes lang-check; if both pass,
//                               the one lang-check doubts less (lower confidence), tie → judge one
//   disagree, or no passing proposal → al (Al decides; both proposals and both reasons shown)
//
// Outputs review/af-judge-merged.json, review/af-judge-al.html (the al sheet) and
// review/af-accepted.json (english → afrikaans for every accepted row, ready for the gate).
//
//   node scripts/lang-check/merge-judges.mjs

import fs from 'node:fs';
import path from 'node:path';
import { check } from './lib/checker.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const J1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', 'af-judge-fable.json'), 'utf8'));
const J2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', 'af-judge-astra.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', 'af-judge-rows.json'), 'utf8')).blue;
const by = (j) => new Map(j.rows.map((r) => [r.id, r]));
const m1 = by(J1), m2 = by(J2);

const lc = (en, text) => { const v = check({ lang: 'af', en, text }); return { action: v.action, confidence: v.confidence, findings: v.findings.filter((f) => f.severity !== 'low').map((f) => f.message) }; };

const merged = [];
const counts = { accepted: 0, 'accepted-rewrite': 0, al: 0, missing: 0 };
for (const r of rows) {
  const a = m1.get(r.id), b = m2.get(r.id);
  if (!a || !b) { counts.missing++; merged.push({ id: r.id, outcome: 'al', why: `missing verdict from ${!a ? J1.judge : J2.judge}`, english: r.english, drafted: r.drafted, j1: a || null, j2: b || null }); continue; }
  const keepA = a.verdict === 'KEEP', keepB = b.verdict === 'KEEP';
  let outcome, final = r.drafted, why = '', chosen = null;
  if (keepA && keepB) { outcome = 'accepted'; why = 'both KEEP'; }
  else if (!keepA && !keepB) {
    const cands = [];
    for (const [judge, row] of [[J1.judge, a], [J2.judge, b]]) {
      if (!row.proposed_line) continue;
      const res = row.lang_check_result && typeof row.lang_check_result.confidence === 'number' ? row.lang_check_result : lc(r.english, row.proposed_line);
      cands.push({ judge, line: row.proposed_line, res, score: row.score });
    }
    const passing = cands.filter((c) => c.res.action === 'pass');
    if (passing.length) {
      passing.sort((x, y) => x.res.confidence - y.res.confidence || (x.judge === J1.judge ? -1 : 1));
      chosen = passing[0]; outcome = 'accepted-rewrite'; final = chosen.line; why = `both ${a.verdict}/${b.verdict}; ${chosen.judge}'s proposal passes lang-check${passing.length > 1 ? ' (both did; lower doubt wins)' : ''}`;
    } else { outcome = 'al'; why = cands.length ? 'both want a change but no proposal passes lang-check' : 'both want a change and neither proposed a line'; }
  } else { outcome = 'al'; why = `disagree: ${J1.judge} ${a.verdict} (${a.score}) vs ${J2.judge} ${b.verdict} (${b.score})`; }
  counts[outcome]++;
  merged.push({ id: r.id, outcome, why, english: r.english, drafted: r.drafted, final, chosen: chosen ? chosen.judge : null, condition: r.condition, time: r.time,
    j1: { verdict: a.verdict, score: a.score, reason: a.reason, proposed_line: a.proposed_line, lang_check: a.lang_check_result },
    j2: { verdict: b.verdict, score: b.score, reason: b.reason, proposed_line: b.proposed_line, lang_check: b.lang_check_result } });
}

fs.writeFileSync(path.join(ROOT, 'review', 'af-judge-merged.json'), JSON.stringify({ generated: new Date().toISOString(), judges: [J1.judge, J2.judge], counts, j1_counts: J1.counts, j2_counts: J2.counts, j1_worst: J1.worst_recurring_failures, j2_worst: J2.worst_recurring_failures, rows: merged }, null, 1));
fs.writeFileSync(path.join(ROOT, 'review', 'af-accepted.json'), JSON.stringify({ generated: new Date().toISOString(), rows: merged.filter((r) => r.outcome !== 'al').map((r) => ({ id: r.id, english: r.english, afrikaans: r.final, outcome: r.outcome, chosen: r.chosen, condition: r.condition, time: r.time })) }, null, 1));

// ---------- the al sheet ----------
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const al = merged.filter((r) => r.outcome === 'al');
const cell = (j, name) => `<div class="j"><b>${h(name)}</b> · ${h(j.verdict)} ${j.score}/5<br><i>${h(j.reason)}</i>${j.proposed_line ? `<div class="prop">${h(j.proposed_line)}</div>${j.lang_check ? `<div class="lc">lang-check: ${h(j.lang_check.action)} ${Number(j.lang_check.confidence).toFixed(2)}${j.lang_check.findings?.length ? ' — ' + h(j.lang_check.findings.join(' | ')) : ''}</div>` : ''}` : '<div class="prop none">no proposal</div>'}</div>`;
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PW — AF humour judge: ${al.length} rows for Al</title><style>
body{background:#14161a;color:#eee;font-family:Segoe UI,sans-serif;margin:0;padding:16px;line-height:1.45}h1{font-size:18px;margin:0}
.bar{position:sticky;top:0;background:#14161a;padding:10px 0;z-index:5;display:flex;gap:16px;align-items:center;border-bottom:1px solid #333;flex-wrap:wrap}
#count{font-weight:800;color:#ffd700}button{background:#ffd700;color:#111;border:none;border-radius:999px;padding:10px 22px;font-weight:800;font-size:14px;cursor:pointer}
.intro{color:#bbb;font-size:13px;max-width:900px;margin:10px 0}
.row{background:#1e2126;border-radius:10px;padding:12px 14px;margin:12px 0;border:2px solid transparent}.row.drafted{border-color:#3cb371}.row.j1{border-color:#8fb7ff}.row.j2{border-color:#e6a23c}.row.own{border-color:#ffd700}
.head{font-size:12px;color:#aaa}.en{color:#bbb;margin-top:4px}.cur{margin-top:4px;font-size:15px;color:#fff}
.js{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.j{background:#14161a;border-radius:8px;padding:8px 10px;font-size:13px}.prop{margin-top:6px;font-size:14px;color:#fff}.prop.none{color:#777}.lc{font-size:11.5px;color:#9a9}
.dec{margin-top:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}label{cursor:pointer;user-select:none;font-weight:700}input[type=radio]{transform:scale(1.3);margin-right:4px}
.own-line{flex:1;min-width:240px;background:#111;color:#eee;border:1px solid #444;border-radius:6px;padding:6px 8px}
</style></head><body>
<div class="bar"><h1>Afrikaans humour judge — ${al.length} rows for Al</h1><span id="count">0 decided</span><button onclick="exportDecisions()">Export af-judge-al-decisions.json</button></div>
<div class="intro">Two judges (${h(J1.judge)}, ${h(J2.judge)}) disagreed here, or agreed a change but no proposal passed lang-check. Pick the drafted line, either proposal, or type your own. Decisions persist in this browser.</div>
${al.map((r) => `<div class="row" data-id="${r.id}">
  <div class="head"><b>${r.id}</b> · ${h(r.condition)}/${h(r.time)} · ${h(r.why)}</div>
  <div class="en">EN: ${h(r.english)}</div>
  <div class="cur">drafted: ${h(r.drafted)}</div>
  <div class="js">${cell(r.j1, J1.judge)}${cell(r.j2, J2.judge)}</div>
  <div class="dec">
    <label><input type="radio" name="d-${r.id}" value="drafted"> keep drafted</label>
    <label><input type="radio" name="d-${r.id}" value="j1"${r.j1.proposed_line ? '' : ' disabled'}> ${h(J1.judge)}'s line</label>
    <label><input type="radio" name="d-${r.id}" value="j2"${r.j2.proposed_line ? '' : ' disabled'}> ${h(J2.judge)}'s line</label>
    <label><input type="radio" name="d-${r.id}" value="own"> my own:</label><input class="own-line" data-id="${r.id}" placeholder="your line">
  </div>
</div>`).join('\n')}
<script>
const KEY='af-judge-al';const state=JSON.parse(localStorage.getItem(KEY)||'{}');const rows=[...document.querySelectorAll('.row')];
function paint(){let n=0;for(const r of rows){const s=state[r.dataset.id]||{};r.classList.remove('drafted','j1','j2','own');if(s.decision){r.classList.add(s.decision);n++;const rb=r.querySelector('input[value="'+s.decision+'"]');if(rb)rb.checked=true;}const o=r.querySelector('.own-line');if(o&&s.own!=null)o.value=s.own;}document.getElementById('count').textContent=n+' / '+rows.length+' decided';}
document.addEventListener('change',e=>{if(e.target.type==='radio'){const id=e.target.name.slice(2);state[id]={...(state[id]||{}),decision:e.target.value};localStorage.setItem(KEY,JSON.stringify(state));paint();}});
document.addEventListener('input',e=>{if(e.target.classList.contains('own-line')){const id=e.target.dataset.id;state[id]={...(state[id]||{}),own:e.target.value,decision:'own'};localStorage.setItem(KEY,JSON.stringify(state));paint();}});
const data=${JSON.stringify(al.map((r) => ({ id: r.id, english: r.english, drafted: r.drafted, j1: r.j1.proposed_line, j2: r.j2.proposed_line })))};
function exportDecisions(){const out={generated:new Date().toISOString(),decisions:data.map(d=>{const s=state[d.id]||{};const line=s.decision==='drafted'?d.drafted:s.decision==='j1'?d.j1:s.decision==='j2'?d.j2:s.decision==='own'?s.own:null;return {...d,decision:s.decision||null,afrikaans:line};})};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='af-judge-al-decisions.json';a.click();}
paint();
</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', 'af-judge-al.html'), html);
console.log(`merged: ${JSON.stringify(counts)} — ${J1.judge} ${JSON.stringify(J1.counts)} · ${J2.judge} ${JSON.stringify(J2.counts)} → review/af-judge-merged.json, review/af-accepted.json, review/af-judge-al.html (${al.length} rows)`);
