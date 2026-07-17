# Language packs — operating model

> Reconstructed on disk (2026-07-17) because the ruled spec `LANGUAGE-PACK-ARCHITECTURE.md` was
> not present in the repo or Son-Memory at build time. Built to the brief's binding principle and
> the on-disk exemplars (the closed Sesotho review, the xh future_review convention, the ZU
> corrections, Al's AF rulings). If the canonical doc surfaces, reconcile this against it.

## The principle: native wording is FINAL, not FIRST
Models **draft**, a cross-family engine **checks**, drafts ship **PROVISIONAL**, and native
speakers **confirm** later in cheap, prioritised batches. The goal is raising first-pass acceptance
— not blocking on humans to translate everything. "Never again translate everything."

## The prime rule: imbatata
`imbatata` is an isiZulu word a model **invented** for this app (caught before it shipped). It is
the origin of the language-deference rule: **the outsider is wrong until a native says otherwise.**
A model's confidence in a low-resource language is not evidence. Never coin a word — use a plain
attested word or a descriptive phrase and tag it LOW. See `zu/lexicon-protected.md` row #1.

## Pack layout (per language: zu, xh, st, af)
| File | Role |
|---|---|
| `PACK.md` | register & drafting rules — witty, warm, colloquial, code-switched (NOT textbook) |
| `corpus-confirmed.jsonl` | every native string currently LIVE in the copy banks (the voice) |
| `lexicon-protected.md` | confirmed-correct words; never "improve" them (imbatata anchor) |
| `errors-observed.md` | every past native correction, categorised — the negative prompt |
| `banned-words.json` | machine-readable subset of errors (hard = always wrong; soft = verify) |
| `harvest-notes.md` | dated, sourced contemporary-register patterns (paraphrased, never copied) |
| `debt-ledger.jsonl` | one entry per missing `""` string (key, EN, AF, status) |
| `drafts-batch-1.jsonl` | model drafts for the debt (key, en, af, <lang>, confidence) — PROVISIONAL |
| `checker-verdicts.jsonl` | cross-family (Codex) screen: PASS/FLAG per draft — written by Al's Codex run |
| `provisional-manifest.jsonl` | after apply: which live strings are provisional pending native confirm |

AF is fully filled (0 debt) — its pack is a **voice reference** (Al is the native), not a drafting
target.

## The pipeline (and where each tool sits)
1. **Seed** — `lang-packs/tools/seed-corpus.mjs` → corpus-confirmed + debt from the live banks.
2. **Draft** (Claude) → `drafts-batch-1.jsonl`, confidence-tagged, conceived in-register.
3. **Pre-screen** (mechanical) — `lang-packs/tools/audit-drafts.mjs` catches hard banned tokens.
4. **Check** (cross-family, GPT/Codex) — paste `CHECKER_PROMPT.md` into Codex → `checker-verdicts.jsonl`.
5. **Apply** — `scripts/apply-provisional-drafts.mjs --apply` folds PASS drafts into the `""` slots
   as PROVISIONAL (row-aligned); FLAG drafts stay in the debt ledger. Then regenerate splits + gates.
6. **Confirm** — `scripts/generate-review-batch.mjs --lang <l> --limit <N>` emits a native batch,
   prioritised by how often each line serves. Native confirms; answers fold back. Repeat cheaply.

## Monthly cadence
The harvest seat (Hermes/GPT) refreshes `harvest-notes.md` monthly. Native confirmation runs at
Al's pace via the batch tool. Drafting/apply run whenever a new wave adds debt.
