// The pairs job's ONE rolling page for Al (26 Sept 2026): every pair still waiting, each pre-marked with the
// judge's pick. Every run rebuilds it; pairs leave it once Al's export (pairs-rolling-ruled.json) is read.
// The job makes no more pairs while `maxWaiting` wait here.
import { existsSync } from 'node:fs';
import path from 'node:path';

export async function buildPage({ kept, targets, sharp, repo, maxWaiting }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dataUrl = async (f, w) => 'data:image/jpeg;base64,' + (await sharp(f).resize(w, Math.round((w * 16) / 9), { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()).toString('base64');
  const WEATHER = { clear: 'Clear', heat: 'Heat', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', wind: 'Wind', cold: 'Cold and wet', 'cold-clear': 'Cold and clear', fog: 'Fog' };
  const DAY = [null, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cards = [];
  for (const l of kept) {
    const T = targets.find((t) => t.id === l.id) || {};
    const imgs = [];
    for (const t of l.takes || []) { try { imgs.push(await dataUrl(t, 420)); } catch { imgs.push(null); } }
    let old = null;
    const oldFile = T.replaces?.slot && repo ? path.join(repo, 'assets', 'images', 'bg', T.replaces.slot) : null;
    if (oldFile && existsSync(oldFile)) { try { old = await dataUrl(oldFile, 200); } catch {} }
    const days = [...new Set((T.slots || []).map((s) => Number(s.split('/').pop().replace('.webp', ''))))].sort().map((d) => DAY[d]).filter(Boolean).join(', ');
    cards.push(`<section class="pair" id="${esc(l.id)}"><p class="chip">${esc(WEATHER[T.folder] || T.folder || '')} · ${esc(T.time || '')}${days ? ` · ${esc(days)}` : ''} · ${esc(l.id)}</p>
  ${T.replaces ? `<div class="old">${old ? `<img src="${old}" alt="the photo it replaces">` : ''}<p>Replaces: ${esc(T.replaces.note)}</p></div>` : T.why ? `<p class="chip">${esc(T.why)}</p>` : ''}
  <p class="line">“${esc(l.line)}”</p>
  <div class="takes">${imgs.map((src, i) => src ? `<figure><img src="${src}" alt="take ${i + 1}"><figcaption>Take ${i + 1}${l.pick === i ? ' · the judge\'s pick' : ''}</figcaption></figure>` : '').join('')}</div>
  ${l.coversFlag ? `<p class="flag">${esc(l.coversFlag)}</p>` : ''}
  ${l.gritFlag ? `<p class="flag">${esc(l.gritFlag)}</p>` : ''}
  ${l.fitFlag ? `<p class="flag">${esc(l.fitFlag)}</p>` : ''}
  <div class="q"><span class="lab">Pair</span><div class="act" data-q="${esc(l.id)}.use"><button data-v="USE">Use</button><button data-v="NO">No</button></div></div>
  ${imgs.length > 1 ? `<div class="q"><span class="lab">Photo</span><div class="act" data-q="${esc(l.id)}.take">${imgs.map((_, i) => `<button data-v="${i + 1}">Take ${i + 1}</button>`).join('')}<button data-v="NEITHER">Neither</button></div></div>` : ''}
  <div class="q"><span class="lab">The line (optional)</span><div class="act" data-q="${esc(l.id)}.grade"><button data-v="LOVE">Love</button><button data-v="MEH">Meh</button></div></div>
  <div class="q"><span class="lab">Afrikaans</span><p class="afline">${esc(l.af)}</p><div class="act" data-q="${esc(l.id)}.af"><button data-v="OK">OK</button><button data-v="FIX">Fix</button></div><textarea data-note="${esc(l.id)}.af" placeholder="Your Afrikaans (only if Fix)" hidden></textarea></div>
  </section>`);
  }
  const PRE = {};
  for (const l of kept) { PRE[`${l.id}.use`] = l.realOk ? 'USE' : 'NO'; if ((l.takes || []).length > 1) PRE[`${l.id}.take`] = l.pick != null ? String(l.pick + 1) : 'NEITHER'; PRE[`${l.id}.af`] = 'OK'; }
  const ITEMS = kept.map((l) => ({ id: l.id, batch: l.batch, line: l.line, af: l.af }));
  const full = kept.length >= maxWaiting;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pairs waiting</title>
  <style>:root{--bg:#f6f4ee;--fg:#1d1b18;--muted:#6b665c;--line:#dcd7cb;--card:#fffdf8;--accent:#1f5f8b;--on:#2e7d4f;--off:#a5452b}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15140f;--fg:#eeebe3;--muted:#a8a296;--line:#35322b;--card:#1f1d18;--accent:#7fb6dd;--on:#7ccf9c;--off:#e08a6e}}
  :root[data-theme="dark"]{--bg:#15140f;--fg:#eeebe3;--muted:#a8a296;--line:#35322b;--card:#1f1d18;--accent:#7fb6dd;--on:#7ccf9c;--off:#e08a6e}
  *{box-sizing:border-box}body{margin:0;padding:18px 16px 110px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:900px;margin:0 auto}
  .pair{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}.chip{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:0}
  .old{display:flex;gap:10px;align-items:center;margin:6px 0;color:var(--muted);font-size:.9rem}.old img{width:56px;aspect-ratio:9/16;object-fit:cover;border-radius:6px;opacity:.8}.old p{margin:0}
  .line{font-size:1.2rem;margin:4px 0 10px}.takes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.takes img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;display:block}figure{margin:0}figcaption{font-size:.8rem;color:var(--muted)}
  .flag{color:var(--off);font-size:.9rem}.q{margin-top:10px}.lab{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);display:block;margin-bottom:4px}.afline{margin:0 0 6px}
  .act{display:flex;flex-wrap:wrap;gap:6px}.act button{font:inherit;min-height:44px;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;cursor:pointer}.act button.on{background:var(--on);border-color:var(--on);color:#fff}
  textarea{width:100%;min-height:44px;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;background:transparent;color:inherit;margin-top:8px}textarea[hidden]{display:none!important}
  .bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:8px;align-items:center}.bar button{font:inherit;min-height:42px;padding:8px 16px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff}#count{margin-right:auto;color:var(--muted);font-size:.9rem}#out{display:none;width:100%;min-height:100px}</style></head>
  <body><main><h1>Pairs waiting</h1><p>${kept.length} pair${kept.length === 1 ? '' : 's'} made by the job to your recipe, each marked with the judge's pick. Change only what you disagree with, then Export: everything on this page counts as ruled, and those pairs leave it on the job's next run (hourly). Nothing goes into the app until a session wires what you ticked.${full ? ` <b>The page is full (${maxWaiting}): the job makes no more until you export.</b>` : ` The job stops making more while ${maxWaiting} wait.`}</p>
  <p class="chip">Optional: tap Love or Meh on a line (blank counts as Fine) — it teaches the recipe.</p>
  ${cards.join('\n') || '<p>Nothing waiting right now.</p>'}<textarea data-note="other" placeholder="Anything else (optional)"></textarea><textarea id="out" readonly></textarea></main>
  <div class="bar"><span id="count"></span><button id="export">Export</button></div>
  <script>var KEY='pw-pairs-rolling',PRE=${JSON.stringify(PRE)},ITEMS=${JSON.stringify(ITEMS)};var s={};try{s=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
  function pick(q){return (s[q]&&s[q].pick)||PRE[q]||null}function save(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}paint()}
  function paint(){document.querySelectorAll('.act').forEach(function(a){var v=pick(a.dataset.q);a.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});var t=document.querySelector('textarea[data-note="'+a.dataset.q+'"]');if(t){t.hidden=v!=='FIX';t.value=(s[a.dataset.q]||{}).note||''}});var c=ITEMS.reduce(function(n,i){return n+['use','take','af'].filter(function(k){var q=i.id+'.'+k;return s[q]&&s[q].pick&&s[q].pick!==PRE[q]}).length},0);document.getElementById('count').textContent=ITEMS.length?(c?c+' changed from the judge\\'s picks':'All the judge\\'s picks'):''}
  document.addEventListener('click',function(e){var b=e.target.closest('.act button');if(!b)return;var q=b.parentElement.dataset.q,o=s[q]=s[q]||{};o.pick=(o.pick===b.dataset.v&&!PRE[q])?null:b.dataset.v;save()});
  document.addEventListener('input',function(e){var t=e.target;if(!t.matches('textarea[data-note]'))return;var o=s[t.dataset.note]=s[t.dataset.note]||{};o.note=t.value;try{localStorage.setItem(KEY,JSON.stringify(s))}catch(x){}});
  document.getElementById('export').addEventListener('click',function(){var n=function(q){return (s[q]||{}).note||''};var j=JSON.stringify({generated:new Date().toISOString(),ruledBy:'Al, pairs waiting (review/pairs-rolling.html)',pairs:ITEMS.map(function(i){return{id:i.id,batch:i.batch,line:i.line,use:pick(i.id+'.use'),take:pick(i.id+'.take'),grade:pick(i.id+'.grade')||'FINE',af:{verdict:pick(i.id+'.af'),proposal:i.af,text:n(i.id+'.af')}}}),other:n('other')},null,1);var o=document.getElementById('out');o.style.display='block';o.value=j;try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='pairs-rolling-ruled.json';a.click()}catch(x){}});paint();</script></body></html>`;
}
