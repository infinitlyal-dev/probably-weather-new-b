# The 15 routing conflicts — for Al's re-ruling
### Baken, 2026-09-05. Source: `review/set-001-line-matches-ruled.json` → `routingConflicts`.

**Headline: your 15 placements are safe. All 15 will serve exactly as you matched them.**
The conflict report was generated against the *condition-bank* path. Every line you matched
is destined for the *bespoke* path, and the bespoke path does not consult bin routing at all.

`assets/app.js:1621` `applyBespokeLine(src)` looks the photograph up by slot path in
`HERO_LINES`, and if it finds lines it overwrites the headline and returns. It never calls
`eligibleWittyPool`, so weekend pre-empt, night-bin resolution and day tags are all bypassed.
The tool's `wouldRenderToday: false` flags describe what the *bank* would do on that slot,
not what the app will do once your line is wired.

**So the plumbing does not need bending for your matches.** What follows is the residual
question, which is smaller and is genuinely yours to rule.

---

## Where the conflicts still bite

The condition bank still serves in exactly two places, and there the routing stands:

1. **Non-English in-app.** `applyBespokeLine` returns false unless `settings.lang === 'en'`
   (your ruling: you write the Afrikaans, zu/xh/st go to native review). In af/zu/xh/st the
   bank serves, with full bin routing.
2. **Every share card.** `api/og.js` has no `hero-lines` import; `pickWitty()` goes through
   `eligibleWittyPool` for all five languages.

Neither of those is about your pairings. It is about whether the *bank's* own routing rules
are the ones you want.

---

## The three classes

### Class A — weekend pre-empt (8 lines)
`assets/witty-day-tags.js:718` — on Sat/Sun (and Fri from 16:00), if the condition is
`clear` or `heat`, the function returns the **weekend** bin and never falls through. A clear
or heat photograph on a weekend can only ever serve weekend lines.

| photograph | line |
|---|---|
| clear/week_2/dawn/7 (sat) | 'One hour at the beach.' History's most confident lie. |
| clear/week_2/dawn/2 (sun) | Weather this perfect is on loan. The southeaster keeps receipts. |
| clear/week_2/day/4 (sat) | Be honest — you opened this app to confirm Saturday's braai. |
| clear/week_2/day/2 (sun) | Main character weather right here. |
| clear/week_2/dusk/1 (sun) | The evening showed up in its Sunday best. |
| heat/week_1/dawn/6 (sat) | Your makeup has an expiry date of 9am. |
| heat/week_2/day/5 (sat) | Your car seat is a weapon right now. |
| heat/week_2/day/5 (sat) | Your steering wheel is a hot plate. |

**Ruling needed:** keep weekend as a *replacement* pool, or make it *additive* (weekend
lines merged into clear/heat on weekends)?
Cost of additive: a weekend braai-plans line and a plain clear line become equally likely on
a Saturday, so the weekend character of Saturday softens. Cost of leaving it: on share cards
and in the other four languages, no clear or heat line ever fires on a weekend — the pool is
weekend-only for two days in seven.

### Class B — night resolves to the night bin (6 lines)
`eligibleWittyPool` resolves night slots to the `night` bin, so clear-bin and weekend-bin
lines cannot serve there.

| photograph | line | bin |
|---|---|---|
| clear/week_1/night/7 | Sky this clear means tomorrow's a scorcher. Stay a while. | clear |
| clear/week_2/night/5 | Verandah weather. The couch will understand. | clear |
| clear/week_2/night/7 | 'Just one sundowner' — famous last words, every single time. | clear |
| clear/week_1/night/6 | Someone turned the stars up to full volume. | clear |
| clear/week_2/night/7 | Braai weather, boet! No excuses. | weekend |
| clear/week_1/night/3 | No alarm. No agenda. Just vibes. | weekend |

**Ruling needed:** should the night bin be additive with the condition bin after dark, or
stay exclusive?
Cost of additive: daytime-flavoured clear lines can fire at 22:00 in the bank. Cost of
leaving it: night is a single 20-line pool in the other four languages and on every
after-dark share card.

### Class C — weekend line on a weekday slot (1 line)
`clear/week_3/day/7` (wed) — *"If you're working today, we feel sorry for you."*
Weekend lines only render when the day is a weekend **and** the condition is clear or heat.
On a Wednesday the bank will not serve it.

**Ruling needed:** none required for the hero — it will serve there. In the bank it stays
weekend-gated unless you want that specific line re-tagged to any day, which would have it
firing on a Tuesday.

---

## What I recommend, in one line each

- **Class A: make weekend additive.** The braai lines still carry the weekend because the
  photographs do; losing all clear/heat lines for two days in seven is the bigger cost.
- **Class B: leave night exclusive.** Night has its own register and the bespoke path already
  covers the pairings you care about.
- **Class C: leave it.** One line, and it serves on the hero regardless.

Nothing here is changed until you rule. Whichever way you go, it is a change to
`eligibleWittyPool` only, guarded by tests, and it does not touch a single one of your matches.
