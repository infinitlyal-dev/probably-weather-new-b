# Warmth pass — for Al's eyes before anything ships

Built 2026-08-10 against Al's ruled brief. Nothing is committed. Two things need
his ruling before this can go anywhere: **the EN strings** and **the caption
treatment**.

## Look at these three things

| What | Where |
|---|---|
| Before / after — Home, Hourly, Weekly, Plekke, Instellings, Bronne × 3 phones, same photo, same joke | `output/warmth/before/` vs `output/warmth/after/` |
| The witty line — 4 treatments on one photograph | `output/caption-variants/index.html` |
| Desktop parity frames | `*-desktop-1280x900.png` in both folders |

The before frames come out of the *same build* as the after frames, with the
exact inverse of the **visual** pass layered over them (`REVERT` in
`scripts/shoot-warmth.mjs`). Same photograph, same caption text, same payload —
the only difference in the pair is the colour, the texture and the caption.

One thing that inverse does not undo: the new **voice lines** are JavaScript, so
they appear in both columns. Judge the strings from the list below, not from the
pair.

---

## 1. Strings that need your yes (EN proposed, nothing shipped)

These are the only new user-facing strings in the pass. Until you rule, they are
**English-only by construction**: they are held outside the translation bank and
read through `voiceLine()`, which has *no* English fallback. An Afrikaans phone
therefore shows the copy it shows today — never an English voice line.

### Hourly — the tail of the subtitle (`<place> · <line>`)

Time-aware, binned on the **location's** hour, not the phone's.

| Hour (local) | Proposed EN |
|---|---|
| 20:00–05:00 | Through the night |
| 05:00–08:00 | The morning ahead |
| 08:00–12:00 | Next few hours |
| 12:00–17:00 | Rest of the afternoon |
| 17:00–20:00 | Into the evening |

Your two named lines are in verbatim. Today the same slot reads
`Somerset West, Western Cape · Today`.

### Weekly — the quiet one-liner under the title

Proposed: **The week, as the five sources see it**

Two alternates if that is too long on a small phone:
- *Seven days, five sources*
- *The long view*

The slot is built and hidden when there is no approved line, so if you kill this
one the Weekly screen simply looks as it does now.

### Afrikaans, zu, xh, st

Not written, deliberately. AF is yours; zu/xh/st go to the native-review backlog
with the rest. Say the word on the EN wording and the AF slot is one line each.

---

## 2. The caption — pick one

`output/caption-variants/index.html`, four columns on one photograph:

- **C0** — before the pass (the control).
- **C1** — bigger + true ink. **This is what is in the code right now.** Size
  curve up ~25% across all three terms; ink from `#24211d` to `#1b1813`.
- **C2** — C1 plus a handwriting slant (`font-style: oblique 4deg` — it leans the
  letters, not the cream foot).
- **C3** — C2 plus a deeper foot, so the writing sits high in the print with
  cream under it.

Only the size bump raises the caption on Al's own phone: at 375×812 the middle
term of the clamp binds, not the ceiling, which is why the whole curve moved.

**My read, for what it is worth: C2.** The slant is what turns it from "a nice
font" into handwriting on a print — and it costs nothing in height, so the fold
budget does not care. The call is yours.

### The one real cost, measured

Home still fits everywhere (72/72), but the bigger caption is paid for out of the
**photograph** — the print is the flexible child of the column, so it gives back
whatever the caption takes. Measured on the fold matrix, EN:

| Caption | Al's iPhone X (375×812) | Smallest (320×488) |
|---|---|---|
| A normal short line | photo −1.4% | photo −1.7% |
| The longest line in the bank | photo −13.6% | photo −18.7% |

So: on an ordinary line it costs nothing, and on the longest lines in the bank it
costs a visible slice of picture (and wraps one line further). Three ways out if
that bothers you, in order of how much I would recommend them: leave it (the long
lines are rare), pull the middle term of the size curve back a notch so long
lines grow less, or shorten the handful of longest lines in the M6 copy pass.

---

## 2b. Two more things to rule on, both shot

Neither is in the app — both are layered over the same build the way the before
frames are, so you can see them and say yes or no.

- **A deeper espresso** (`output/warmth/warm-strong/`). The shipped strength is
  deliberately conservative — same darkness as before, warm hue. If it reads too
  subtle on your actual phone, this is the next stop: `--page-bg #17120b`,
  `--surface #261e14`. One line each to adopt.
- **Muted icon gold** (`output/warmth/icons-muted/`). At full `--brand-gold` the
  Hourly screen now has three golds on it — the active toggle, the temperature
  line and every condition icon. The muted version (`#d9bc5c`) keeps the warmth
  and gives the toggle its hierarchy back. Your ruling said warm yellow icons, so
  full gold is what shipped in the code; this is the alternative, not a
  counter-proposal.

## 3. What changed, in one list

1. **Warm base.** `--page-bg #0d0d12 → #14110d`, `--surface #16171d → #1f1a14`,
   `--ink #ffffff → #fffaf3`, `--ink-2 #aab0bd → #b5ab9d`. Same darkness, espresso
   undertone. `--ink-2` moved to the top `:root` so it is one definition at every
   width (two unscoped rules were carrying the old grey as a literal).
2. **Film grain.** A committed 64px tile — `assets/images/grain.png`, 3.2KB,
   generated deterministically by `scripts/generate-grain.mjs` — repeated on
   `body`, `.screenPanel` and `.nav`. No SVG filter, no runtime generation.
   (It was on `#bg` first and never painted on Home — see the defects note at the
   bottom of the vibrancy report.)
3. **The caption got bolder** (C1 above), ink-dark on the cream foot, still on the
   polaroid foot where you ruled it stays.
4. **The stock travels.** Cream ink on section labels and page subtitles; a thin
   cream wash on the Bronne consensus legend and on empty states. Every data
   surface — rows, values, charts, the range plot — stays dark. On Weekly that
   means the subtitle only: its DAY / HIGH / LOW / RAIN strip is a data header,
   not a section label, so it kept its own weight.
5. **Header voice slots** built on Hourly and Weekly (strings above).
6. **Warm yellow icons** on the Hourly rows, the Weekly rows and the Hourly
   chart. Orange stays warnings-only.

## 4. Gates

| Gate | Result |
|---|---|
| Fold matrix (`verify-home-fold.mjs`) | PASS — 72/72, with the bigger caption and the grain on |
| Fold matrix, per caption variant | PASS 72/72 each for C0, C1, C2 **and** C3 — whichever you pick, Home fits |
| Test suite, serial | 86 files, 21,727 tests, all green (includes 13 new warmth guards) |
| Build | clean; 13/13 precache paths resolve |
| Grain cost, measured | no measurable cost — see below |

Caption size on your own phone (375×812), measured by the variant harness:
**19.1px → 24px**, i.e. a quarter bigger, at the same 7px of headroom above the
nav.

### What the grain costs, measured

`scripts/measure-grain-cost.mjs` — same build, same payload, same pinned
photograph, 375×812 at 4× CPU throttle, 7 runs per arm. The only difference: one
arm blocks the request for the tile so the texture never paints.

| | with grain | without grain |
|---|---|---|
| LCP, median (min–max) | 356 ms (292–504) | 468 ms (348–532) |
| FCP, median (min–max) | 116 ms (92–172) | 140 ms (88–188) |

The grain arm comes out *faster* on the median, which is the honest way of saying
**the difference is noise** — the two spreads sit on top of each other. The tile
is 3.5KB on the wire, requested at ~130 ms and finished 2 ms later, after first
paint. (Pinning the photograph was necessary to see this at all: with the picker
free to choose, LCP swung 916–4324 ms and no 3.5KB asset is visible inside that.)

Note on the number: the fold gate is **72** combinations now, not 64 — it grew
when your iPhone X was added to the matrix on 2026-08-09. Same gate, two more
viewports.

## 5. Flagged, not done

- **Desktop is deliberately almost untouched.** Its surfaces are translucent
  black over a photograph, so warming them would tint the picture rather than the
  chrome. The only desktop change is the one shared secondary ink (`--ink-2`) on
  two rules that carried it as a literal. Parity frames are in both shot folders.
- **The grain is not precached.** The service worker routes every image through
  its own image cache, so a `CORE_ASSETS` entry would sit in the wrong cache and
  never be read. It caches on first load like every other image; a first-ever
  offline open is flat, and nothing else changes.
- **No Grok mockups were on disk** when this was built, so the palette is the
  ruling's own direction (espresso / night-veld), not a match to their frames.
- **The adversarial pass on this diff was mine, not codex-rescue's.** The BAKEN
  kernel bars subagents on my own work; the older standing discipline says run
  codex-rescue on substantial code. Kernel wins unless you say otherwise — say
  the word and I hand the diff over. For what my own pass caught, see below.

## 6. What the adversarial pass caught (before you see it)

Recorded because the value of the pass is in what it found, not in the fact that
it happened:

1. Two contrast ratios in the CSS comments were wrong (6.4:1 and 9.3:1 asserted;
   7.5:1 and 9.5:1 measured). Corrected — a comment nobody can trust is worse
   than none.
2. The empty-state theming landed on the Recent list and missed the Favourites
   list twenty lines below it. Caught by its own new guard, then fixed.
3. The first before/after run used a different random photograph in each column
   and a different random joke — a pair that compares pictures, not treatments.
   The shooter now pins both.
4. Bronne shot as a plain list with no range chart: the harness payload used
   `lowC/highC` where the renderer reads `minTemp/maxTemp`. Fixed, so the frames
   actually show the consensus band the pass touches.
5. Two tokens I defined and never used (`--paper`, `--paper-edge`). Removed.
