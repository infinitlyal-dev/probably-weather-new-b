<!--
work-like-fable v3 — Codex / GPT-5.5 dialect.
Drop this at a repo root (it is already named AGENTS.md). Commands block filled for Probably Weather.
A global copy may live at ~/.codex/AGENTS.md. Terse by design: Codex is action-biased and stops
early when over-prompted, so this file carries durable rules and done-when gates instead of
plan-narration. Same behavioural spine as the work-like-fable Claude skill, phrased for Codex.
-->

# AGENTS.md

## Commands
- Build: `npm run build` (scripts/build.mjs — copy-split drift gate + import-scan + minify + sw precache check)
- Test: `npm test` (vitest run) — or `npx vitest run` for a single-shot; `npx vitest run <name>` to scope
- Lint / typecheck: none configured — the build gate is the static check (copy-split drift + dead-import scan)
- Run / preview: no dev server; `npx serve dist` after a build, or push to `main` for a Vercel preview/prod deploy

Project note: Probably Weather is a South African PWA weather app (5-source weighted ensemble; 5 languages:
en/af/zu/xh/st). weather-copy.js is the server-side copy source of truth, split to assets/copy/<lang>.js at
build time — edit weather-copy.js then `npm run build` or the drift gate fails. Deploy = push to main (Vercel).

## Task file (arms the contract)
- Before the first edit: confirm repo + branch with git (never from memory), then write `.fable/TASK.md`:
  `task:` one line; `status: active`; `branch:` from git output; `done-when:` checklist where every item names its exact verify command.
- Flip `status: done` only in the same reply as the `[SIGN-OFF]` block.
- Ensure `.fable/` is gitignored.

## Working rules
- Read the file before editing. Never speculate about unopened code. Open reference images as images.
- State the suspected cause, confirm it against the source, then edit. No edit on a bug before the real cause is read.
- Stateful bugs (upgrade paths, caches, service workers, returning users) are reproduced in that state — a clean-profile test of an upgrade-path bug proves nothing.
- If inferring a rendered or runtime value, measure it with a probe — don't assert it.
- Prefer dedicated tools over raw shell (apply_patch, rg, read_file, git). Batch independent reads.
- Do the work; do not narrate an upfront plan or post status preambles.
- Stay inside the given scope, both directions: no silent expansion, no silently shipping a smaller version of the ask. Flag any scope change out loud.
- Multi-part tasks: atomic sequenced commits, gates green after every group, so any commit reverts clean.
- Owner-taste decisions (UI look, design direction, copy voice, product trade-offs) are not yours to make — exit BLOCKED and recommend.
- Review-phrasing rule: adversarial passes are worded as defect-finding — find defects, falsify the claim, construct a failing input — never attack/exploit vocabulary.

## Integrity (hard rules)
- Never special-case test inputs, hardcode expected values, or edit test files to make a gate pass. If a gate cannot honestly pass, report it failing with the real output.
- A sign-off written to satisfy the contract's shape without real evidence is the worst violation possible — worse than reporting blocked. BLOCKED is always available and never penalised.
- Quoted verification output must be reproducible: the parent will re-run the exact commands in a clean shell. A summary of tests is a claim, not evidence.
- Tag every factual claim in reports: verified (command/path given) / inferred / theory. One verified file ≠ a verified system.
- Low-confidence or low-resource output (isiZulu, isiXhosa, Sesotho copy; Afrikaans idiom) marked "provisional — needs native-speaker confirm." Never override a native speaker's wording.

## Done-when (sign-off contract — per task)
End the task with exactly this block (and flip TASK.md to done):
```
[SIGN-OFF]
Gates: <command> -> <pass/total + real output line, quoted>
Deploy: <deploy verified live + production smoke | n/a — nothing shipped>
Visual: <render vs reference verdict | n/a>
Adversary: <what reviewed it + findings addressed | n/a + why>
Commits: <sha → one-line what, per commit | single commit: sha>
Claims: <tags applied: verified/inferred/theory>
Still open: <honest list | none>
```
If genuinely blocked (blocking ambiguity, destructive action needing sign-off, owner-taste decision, same failure three times, hard resource limit):
```
[SIGN-OFF: BLOCKED]
Blocker: <what and why terminal>
State: <what is committed/safe>
Next: <recommendation>
```
Prose-only "done" / "all tests pass" is not a sign-off. A shaped sign-off with hollow evidence is worse.

<solution_persistence>
Persist until the task is fully handled end-to-end within the turn. Do not stop at analysis, partial fixes, or progress summaries — a status report is not a stop condition. If a directive's intent is clear, act on it without asking. Only stop for a genuinely blocking condition, and exit through [SIGN-OFF: BLOCKED].
</solution_persistence>

## Reasoning effort
- Interactive edits: medium.
- Hard autonomous run / deep adversarial audit (codex-rescue): high or xhigh.
