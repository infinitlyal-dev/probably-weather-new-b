// GATE-1 contact sheet for reroll-wave-1.
// Per slot: ORIGINAL rejected pair (a+b) + Al's verbatim NO reason + the two NEW candidates,
// with per-slot radios A / B / BOTH / NEITHER + a notes field. Exports rulings JSON.
// Copies the new candidates from the minnie session-outputs deliverables into
// review/reroll-candidates/ so the HTML references them by a repo-relative path.
//
// Run:  node review/tools/build-reroll-contact-sheet.mjs
import fs from "node:fs";

const REPO = "C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c";
const HOME = (process.env.USERPROFILE || process.env.HOME).replace(/\\/g, "/");
const DELIV = HOME + "/.claude/skills/minnie/session-outputs/2026-07-18-pw-reroll-leonardo/deliverables";
const CANDIR = REPO + "/review/reroll-candidates";
const OUT = REPO + "/review/reroll-contact-sheet.html";

const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slots = JSON.parse(fs.readFileSync(REPO + "/review/reroll-prompts.json", "utf8")).prompts;
// optional QA-adversary flags: { "<id>": { "A": "<reason>", "B": "<reason>" } } — badges the candidate as still-suspect
let qaFlags = {};
try { qaFlags = JSON.parse(fs.readFileSync(REPO + "/review/reroll-qa-flags.json", "utf8")); } catch (e) { /* none */ }

// resolve the two ORIGINAL reject images for a slot (batch dir, else pilot dir, else pilot-cinematic)
function origPair(id) {
  const sets = [
    ["output/meme-gen/batch/" + id + "-a.jpg", "output/meme-gen/batch/" + id + "-b.jpg"],
    ["output/meme-gen/pilot/" + id + "-a.jpg", "output/meme-gen/pilot/" + id + "-b.jpg"],
    ["output/meme-gen/pilot/" + id + "-cinematic-a.jpg", "output/meme-gen/pilot/" + id + "-cinematic-b.jpg"],
  ];
  for (const [a, b] of sets) if (fs.existsSync(REPO + "/" + a) && fs.existsSync(REPO + "/" + b)) return [a, b];
  return [null, null];
}

// copy the new candidates into the repo (portable relative refs); report which are present
fs.mkdirSync(CANDIR, { recursive: true });
let candOk = 0, candMissing = [];
for (const s of slots) {
  for (const suf of ["A", "B"]) {
    const src = DELIV + "/" + s.id + "_" + suf + ".jpg";
    const dst = CANDIR + "/" + s.id + "_" + suf + ".jpg";
    if (fs.existsSync(src)) { fs.copyFileSync(src, dst); candOk++; }
    else candMissing.push(s.id + "_" + suf);
  }
}

const cards = slots.map((s, n) => {
  const [oa, ob] = origPair(s.id);
  const origHtml = (oa && ob)
    ? `<img class="thumb zoom" loading="lazy" src="../${oa}" alt="orig a"><img class="thumb zoom" loading="lazy" src="../${ob}" alt="orig b">`
    : `<div class="missing">original not found</div>`;
  const cA = "reroll-candidates/" + s.id + "_A.jpg";
  const cB = "reroll-candidates/" + s.id + "_B.jpg";
  const haveA = fs.existsSync(CANDIR + "/" + s.id + "_A.jpg");
  const haveB = fs.existsSync(CANDIR + "/" + s.id + "_B.jpg");
  const flag = s.flag ? `<div class="flagnote">⚑ ${esc(s.flag)}</div>` : "";
  const qf = qaFlags[s.id] || {};
  const flagA = qf.A ? `<div class="qaflag">⚠ QA: ${esc(qf.A)}</div>` : "";
  const flagB = qf.B ? `<div class="qaflag">⚠ QA: ${esc(qf.B)}</div>` : "";
  return `
<section class="slot" data-id="${esc(s.id)}" data-condition="${esc(s.condition)}" data-bin="${esc(s.bin)}">
  <div class="slothead">
    <span class="num">#${n + 1}/36</span>
    <span class="sid">${esc(s.id)}</span>
    <span class="tag">${esc(s.condition)} · ${esc(s.bin)}</span>
    <span class="region">📍 ${esc(s.region_lock)}</span>
    <span class="vbadge" data-for="${esc(s.id)}"></span>
  </div>
  <div class="reason"><b>Your NO:</b> “${esc(s.reason)}”</div>
  <div class="counter"><b>Reroll targets →</b> ${esc(s.counter)}</div>
  ${flag}
  <div class="row">
    <div class="col orig"><div class="lbl bad">ORIGINAL — you rejected</div><div class="imgs">${origHtml}</div></div>
    <div class="col cand"><div class="lbl newA">NEW — Candidate A</div>${haveA ? `<img class="big zoom" loading="lazy" src="${cA}" alt="A">` : `<div class="missing">A pending / not generated</div>`}${flagA}</div>
    <div class="col cand"><div class="lbl newB">NEW — Candidate B</div>${haveB ? `<img class="big zoom" loading="lazy" src="${cB}" alt="B">` : `<div class="missing">B pending / not generated</div>`}${flagB}</div>
  </div>
  <div class="controls">
    <div class="radios">
      <label class="r rA"><input type="radio" name="v_${esc(s.id)}" value="A"><span>A</span></label>
      <label class="r rB"><input type="radio" name="v_${esc(s.id)}" value="B"><span>B</span></label>
      <label class="r rBoth"><input type="radio" name="v_${esc(s.id)}" value="BOTH"><span>BOTH</span></label>
      <label class="r rNeither"><input type="radio" name="v_${esc(s.id)}" value="NEITHER"><span>NEITHER</span></label>
    </div>
    <input type="text" class="notes" data-id="${esc(s.id)}" placeholder="notes — required for NEITHER (goes on the residual reroll ledger with your reason)">
  </div>
</section>`;
}).join("\n");

const meta = JSON.stringify(slots.map(s => ({ id: s.id, condition: s.condition, bin: s.bin, candidateA: "reroll-candidates/" + s.id + "_A.jpg", candidateB: "reroll-candidates/" + s.id + "_B.jpg" })));

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reroll wave 1 — GATE 1 (36 slots)</title><style>
:root{--bg:#12141a;--panel:#1c1f27;--ink:#eceef2;--dim:#9aa2b1;--gold:#ffd24a;--good:#39d98a;--bad:#ff6b6b;--blue:#5aa9ff}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:Segoe UI,system-ui,sans-serif;margin:0;padding:0 16px 80px}
.bar{position:sticky;top:0;background:linear-gradient(#12141a,#12141aee);backdrop-filter:blur(4px);padding:12px 0;z-index:20;display:flex;gap:18px;align-items:center;border-bottom:1px solid #2a2e38;flex-wrap:wrap}
.bar h1{font-size:16px;margin:0}
#count{font-weight:800;color:var(--gold)}
button{background:var(--gold);color:#111;border:none;border-radius:999px;padding:9px 20px;font-weight:800;font-size:13px;cursor:pointer}
button.ghost{background:#2a2e38;color:var(--ink)}
.hint{color:var(--dim);font-size:12px}
.slot{background:var(--panel);border-radius:14px;padding:14px 16px;margin:16px 0;border:2px solid #262a34}
.slot.ruled{border-color:#2f7d55}.slot.neither{border-color:#7d3a3a}
.slothead{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.num{color:var(--dim);font-size:12px;font-weight:700}
.sid{font-weight:800;font-size:15px}
.tag{background:#2a2e38;border-radius:999px;padding:2px 10px;font-size:12px;color:var(--blue)}
.region{color:var(--dim);font-size:12px}
.vbadge{margin-left:auto;font-weight:800;font-size:13px}
.reason{background:#241d1d;border-left:3px solid var(--bad);padding:7px 10px;border-radius:6px;font-size:13px;margin:4px 0}
.counter{color:var(--dim);font-size:12.5px;margin:4px 0 8px;line-height:1.45}
.flagnote{background:#2a2410;border-left:3px solid var(--gold);color:var(--gold);padding:6px 10px;border-radius:6px;font-size:12.5px;margin-bottom:8px}
.qaflag{background:#3a2a10;border-left:3px solid #ffb020;color:#ffb020;padding:5px 8px;border-radius:5px;font-size:11px;margin-top:6px;line-height:1.35}
.row{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:12px;align-items:start}
.col{background:#151821;border-radius:10px;padding:8px}
.lbl{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}
.lbl.bad{color:var(--bad)}.lbl.newA{color:var(--good)}.lbl.newB{color:var(--blue)}
.imgs{display:flex;gap:6px}
.thumb{width:50%;aspect-ratio:9/16;object-fit:cover;border-radius:6px;cursor:zoom-in;opacity:.85}
.big{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:8px;cursor:zoom-in}
.missing{color:var(--dim);font-style:italic;font-size:12px;padding:20px 8px;text-align:center;border:1px dashed #333;border-radius:8px}
.controls{display:flex;gap:14px;align-items:center;margin-top:12px;flex-wrap:wrap}
.radios{display:flex;gap:8px}
.r{cursor:pointer;user-select:none;border:2px solid #333;border-radius:10px;padding:8px 16px;font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px}
.r input{transform:scale(1.25)}
.rA.on{border-color:var(--good);background:#173427}.rB.on{border-color:var(--blue);background:#152738}
.rBoth.on{border-color:var(--gold);background:#332b12}.rNeither.on{border-color:var(--bad);background:#331b1b}
.notes{flex:1;min-width:220px;background:#0f1118;border:1px solid #333;border-radius:8px;color:var(--ink);padding:9px 12px;font-size:13px}
#lb{position:fixed;inset:0;background:#000d;display:none;align-items:center;justify-content:center;z-index:50;cursor:zoom-out}
#lb img{max-width:96vw;max-height:96vh;border-radius:8px}
</style></head><body>
<div class="bar">
  <h1>Reroll wave 1 — GATE 1</h1>
  <span id="count">0 / 36 ruled</span>
  <button onclick="exportRulings()">⬇ Export rulings JSON</button>
  <button class="ghost" onclick="jumpNext()">↓ Next unruled</button>
  <span class="hint">A / B / BOTH / NEITHER per slot. Progress auto-saves in this browser. NEITHER → residual ledger (add a reason in notes).</span>
</div>
${cards}
<div id="lb" onclick="this.style.display='none'"><img alt="zoom"></div>
<script>
const META = ${meta};
const KEY = "reroll-wave-1-rulings";
function load(){ try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return {}} }
function save(st){ localStorage.setItem(KEY, JSON.stringify(st)); }
let state = load();

function paint(){
  let ruled=0;
  document.querySelectorAll(".slot").forEach(sec=>{
    const id=sec.dataset.id; const v=state[id]&&state[id].verdict;
    sec.querySelectorAll(".r").forEach(l=>{ const on=l.querySelector("input").value===v; l.classList.toggle("on",on); l.querySelector("input").checked=on; });
    const badge=sec.querySelector(".vbadge");
    sec.classList.toggle("ruled", !!v); sec.classList.toggle("neither", v==="NEITHER");
    badge.textContent = v?("✓ "+v):""; badge.style.color = v==="NEITHER"?"#ff6b6b":(v?"#39d98a":"");
    const nt=sec.querySelector(".notes"); if(state[id]&&state[id].notes!=null && nt.value!==state[id].notes) nt.value=state[id].notes;
    if(v) ruled++;
  });
  document.getElementById("count").textContent = ruled + " / 36 ruled";
}
document.querySelectorAll(".r input").forEach(inp=>inp.addEventListener("change",()=>{
  const id=inp.closest(".slot").dataset.id; state[id]=state[id]||{}; state[id].verdict=inp.value; save(state); paint();
}));
document.querySelectorAll(".notes").forEach(nt=>nt.addEventListener("input",()=>{
  const id=nt.dataset.id; state[id]=state[id]||{}; state[id].notes=nt.value; save(state);
}));
document.querySelectorAll(".zoom").forEach(img=>img.addEventListener("click",()=>{
  const lb=document.getElementById("lb"); lb.querySelector("img").src=img.src; lb.style.display="flex";
}));
function jumpNext(){ for(const sec of document.querySelectorAll(".slot")){ if(!(state[sec.dataset.id]&&state[sec.dataset.id].verdict)){ sec.scrollIntoView({behavior:"smooth",block:"center"}); return; } } alert("All 36 ruled 🎉"); }
function exportRulings(){
  const rulings = META.map(m=>({ id:m.id, condition:m.condition, bin:m.bin,
    verdict:(state[m.id]&&state[m.id].verdict)||"", notes:(state[m.id]&&state[m.id].notes)||"",
    candidateA:m.candidateA, candidateB:m.candidateB }));
  const ruledN = rulings.filter(r=>r.verdict).length;
  const neither = rulings.filter(r=>r.verdict==="NEITHER").length;
  if(ruledN<36 && !confirm(ruledN+" of 36 ruled. Export anyway?")) return;
  const blob=new Blob([JSON.stringify({generated:new Date().toISOString(),wave:"reroll-wave-1",total:36,ruled:ruledN,neither,rulings},null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="reroll-wave-1-rulings.json"; a.click();
}
paint();
</script></body></html>`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT);
console.log("candidates copied:", candOk, "| missing:", candMissing.length, candMissing.length ? "(" + candMissing.slice(0, 8).join(",") + (candMissing.length > 8 ? "…" : "") + ")" : "");
