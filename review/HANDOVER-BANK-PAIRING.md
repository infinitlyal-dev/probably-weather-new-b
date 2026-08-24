# Handover — pair Al's 379 rescued bank lines to photographs

Paste everything below the line into a fresh Opus 5 Claude Code session in
`C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c`.

---

PW — PAIR THE RESCUED BANK LINES TO PHOTOGRAPHS.

You are Baken (Opus 5). Read `C:\Users\27741\Son-Memory\directives\BAKEN.md` and
`directives\VIGIL-CORE.md` first and echo the kernel before anything else.

**The task.** Al has gone back through the original condition bank — the 903 EN
lines written for a *condition* rather than for a photograph — and kept 379 he
wants reused. Assign each kept line to the single photograph it fits best, one
line to one image, no line used twice. Then report how many line-slots per
condition are still unfilled.

Before the mechanics, read "Al's ruling on what these lines ARE" below. These
are not spare parts being fitted into gaps. They are the voice the app is meant
to have, and the pass fails if you treat them as inventory.

## Read these before writing anything

- `review/PAIRING-TASTE.md` — the taste profile, 293 lines, all of it. It is the
  brief, not background.
- `review/set-001-bank-ruled.json` — Al's 379 keeps. Each carries its pass-1
  record: `pass1: {shown, kept}`, or `null` if it had never been shown to him.
- `review/bespoke-worklist-remaining.json` — the 252 open photographs with their
  slot context (condition, time, week, day) and every duplicate path.
- `review/set-001-swap-test-audit.json` — a verdict on all 1,260 lines written
  in the previous session, and why each failed or passed.

## The numbers, already computed — verify, do not re-derive from memory

Wind is **finished**: all 12 wind photographs are 5/5 approved in
`review/set-001-lines-bespoke-wind-ruled.json`. Do not touch them. That leaves
**240 open photographs** and 1,200 slots at five lines each.

| condition | images | slots | bank keeps | slots left |
|---|---|---|---|---|
| clear | 34 | 170 | 58 | 112 |
| cloudy | 35 | 175 | 59 | 116 |
| cold | 35 | 175 | 34 | 141 |
| cold-clear | 28 | 140 | 50 | 90 |
| fog | 28 | 140 | 29 | 111 |
| heat | 18 | 90 | 29 | 61 |
| rain | 31 | 155 | 32 | 123 |
| storm | 31 | 155 | 37 | 118 |
| **total** | **240** | **1200** | **328** | **872** |

Plus **27 cross-bin keeps** (night 8, weekend 19) which are not tied to a
condition folder — they are placeable on any condition at that time of day or on
Sat/Sun. And **24 wind keeps that have nowhere to go**, because the wind
photographs are already full. Flag those 24 to Al rather than forcing them.

Bin-to-folder aliases when you map a bank line's condition to an image folder:
`rain-possible` and `partly-cloudy` → cloudy, `thunder` and `hail` → storm,
`uv` → clear. `night` and `weekend` are cross-cutting bins, not folders.

## The rule that governs this pass, and it is NOT the swap test

The swap test (PAIRING-TASTE §1a) was built for lines written *to* a photograph.
These lines were written to a condition, so they cannot pass it and it is the
wrong instrument here. Al has already approved them as lines. **Your job is the
pairing, not the writing.** The rules that govern a pairing are:

- **§0 — judge the pair, not the line.** Of 214 lines proposed three or more
  times in pass 1, 174 got different verdicts on different images. A 4/4 line
  will still be wrong on the wrong frame. Rank by how hard line and frame lock
  together, never by how good the line is.
- **§1 — the contribution test.** Does the line say something the picture cannot
  say by itself? If the picture already says it, the pairing is dead however
  good the line is. `storm#16` "The lightning is putting on a proper show" went
  1/13 because it was put on thirteen photographs of lightning.
- **§2 — match the line's internal picture.** A pose is singular and held; a heap
  is aftermath; a burrito is one enclosed body; heavy rain is accumulation, not
  pretty texture. Name the shape the line implies and confirm that exact shape
  is in the frame before you place it.
- **§3 — anchor to a thing or a body, not the sky.** On storm and wind
  especially, sky-only pairings underperform badly.
- **§7 — the ten never-dos.** Particularly: never place a line naming an object,
  landmark or region that is not in that frame; never mock someone working or
  taking a real risk competently; never place an instruction whose object is not
  in shot.

Also live, from `CLAUDE.md`: no Eskom or load-shedding material on the home
screen. A handful of the keeps may carry it — surface them, do not place them.

## How to work

Go condition by condition, largest first. For each condition, **view every open
photograph in it** — the Read tool renders `.webp` directly, and you must look
at the actual file, not at a description of it. Then place its bank keeps on the
frames they lock to hardest.

You will have fewer keeps than slots in every condition, so **placement is a
choice, not an allocation**. Leave a line unplaced rather than forcing it onto a
frame it only half fits — a bad pairing costs more than an empty slot, because
Al then has to reject a line he already told you he liked.

Record, per placement: the image, the line id and text, and one sentence naming
what in the frame it locks to. That sentence is the evidence; without it the
pairing is a guess.

## What to build

A review page per condition, same pattern as
`scripts/build-lines-review-tool.mjs` — the photograph at its real hero size
with the line on it, because Al judges the pair and a list beside a thumbnail
makes him judge the writing instead. Reuse that script if it fits; give the
sources and pages **new filenames**, never overwrite an existing one. The tool
keys Al's saved ticks by source filename and reusing a name would restore his
old ticks against different lines — that bug has already bitten him twice.

Then report per condition: images covered, lines placed, slots still open, and
which keeps you could not find a home for.

## Al's ruling on what these lines ARE — read this twice

Ruled 2026-08-23, in his words: the bank keeps **fill** the five slots per
photograph, "because they are genuinely funny and speak to the conditions and
are less image observational. They convey SA humour and a feeling... they are
the feeling we need for the app, the rest we fill in as we go."

That is the whole brief and it outranks the arithmetic. Three consequences:

1. **These lines set the register.** They are not filler taking up space until
   something better arrives. They are what Probably Weather is supposed to sound
   like — warm, recognisably South African, working at the level of the
   condition rather than cataloguing the frame. Treat them as the standard the
   rest of the copy has to reach.

2. **Placement follows the line's own nature.** Where a line names a concrete
   thing — a dog, a bakkie, a kettle, a heater — put it on a frame that contains
   that thing; those are near-automatic. The rest place by feeling and by
   condition, and they are deliberately flexible. Al kept them *because* they
   travel. Do not agonise over a perfect frame for a line that works on twenty.

3. **The remaining 872 are a later decision, not an assumption.** Do not plan to
   fill them with more observational bespoke writing by default. Al: "the rest
   we fill in as we go."

**And the caveat that matters most.** The 1,200 v2 lines already written for
these photographs are *observational by construction* — the swap-test repair of
2026-08-19 optimised for exactly that, lines that could not be moved off their
frame. It fixed a real defect, but it pushed toward noticing things in
photographs and away from feeling. When those pages are ruled on, they are being
judged against the bank's texture, not on how cleverly they read the picture. If
they read as a caption competition beside Al's 379, that is the signal that the
872 should be written in the bank's voice rather than in the v2 voice. Surface
that to Al when you see the answer; do not quietly resolve it yourself.

## State of play, so you do not trip over it

- 42 photographs carry Al-approved bespoke lines and are **live in production**
  (`review/set-001-lines-bespoke-final.json`, wired at `cc7921a` through
  `assets/hero-lines.js`). Do not disturb them.
- Wind's 12 are approved but **not yet merged or wired** — that is a separate
  small job still owed.
- The other 240 have five v2 candidate lines each, written and repaired but
  **not yet ruled on by Al**. They live in
  `review/set-001-lines-bespoke-<condition>-v2.json` with pages at
  `review/lines-review-<condition>-v2.html`. Those pairings compete for the same
  slots as the bank keeps, so the true shortfall is only known once Al has
  ticked them.
- Serve the review pages with `node scripts/serve-review.mjs` → port 8788. It
  does not survive a session ending; restart it and verify a 200 before giving
  Al any URL.

## Do not

- Do not use `review/tools/witty-lines.json`. It holds 483 lines and is stale —
  the 2026-08-05 pairing pass referenced 276 ids absent from it. The live bank
  is 903 lines and the source of truth is `assets/weather-copy.js`.
- Do not re-write, re-word or "improve" any of the 379. Al ruled on them as
  written.
- Do not touch the wind photographs.
- Do not wire anything into the app. Nothing ships until Al has ticked the
  pairings. Gates for a wiring commit, when it comes: suite, fold 72/72,
  language gate on the real `lang` key (not `pw_lang`), gate shots on real
  pairings, production fetch.
