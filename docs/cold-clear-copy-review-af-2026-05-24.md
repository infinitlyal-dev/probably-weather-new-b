# Cold-Clear Copy Review Log — Afrikaans

Date: 2026-05-26.
Reviewer: Codex (GPT-5-class) via `codex:codex-rescue` subagent.
Soul anchor: Hoëveld dry-cold-with-blue-sky. Lekker koud maar pragtig.

---

## Round 1 — NEEDS WORK

### Critical fixes (4)
- Line 3: `"Hooglandse winter"` → `"Hoëveld-winter"` (Hooglandse = Highlands, not Highveld — wrong word entirely)
- Line 12: `"Hooglandse droë-koud"` → `"Hoëveldse droë koue"`
- Line 17: typo `"hoofatrraksie"` → `"hoofattraksie"`
- Line 18: ungrammatical `"Koue lug skerp alles"` → `"Koue lug maak alles skerper"`

### Major fixes (7)
| Line | Before | After |
|------|--------|-------|
| 1 | "Koud genoeg om jou koffie te ys, blou genoeg om dit te vergewe." (stiff) | "Koud genoeg om jou koffie af te koel. Die lug maak amper op daarvoor." |
| 4 | "Onder nul met 'n bietjie jakaranda-silhoeët." (awkward) | "Onder nul, met jakarandas in silhoeët." |
| 6 | "Bloemfontein 7-uur-soggens energie." (AI-translation stiff) | "Bloemfontein, sewe-uur-in-die-oggend. Straf en pragtig." |
| 9 | "neushare verkristalliseer" (gross + misery) | "Koud genoeg dat jou asem rook." |
| 10 | "Hemel is asemrowend maar my vingers gaan dalk afval." (misery overlap) | "Asemrowende lug, yskoue hande. Dis 'n billike ruil." |
| 15 | "Pragtig genoeg om die seer te vergewe." (melodramatic) | "Pragtig genoeg dat jy die koue amper vergewe." |
| 20 | "Sonbrille-en-serp weer. Albei nodig, albei pragtig." (clumsy) | "Sonbril-en-serp-weer. Albei nodig." |

### Minor fixes
- Line 7: `"horizon"` → `"horison"` (Afrikaans spelling)
- Line 11: tightened compound rhythm
- Line 16: `"briljante lug"` → `"skitterende lug"` (less Englishy)
- Line 12: `"Vat lae"` → `"Trek lae aan, vat 'n sonbril"` (natural Afrikaans verb choice)
- Line 13: `"Vat die stap"` → `"Gaan stap"` (was English-calque)

## Round 2 — CLEAN

Two new false-alarm "criticals" reported (apostrophe-stripping in the inlined prompt — actual code has clean `'n glimlag` and `foto's neem`).

Two additional minor improvements applied:
- Line 12: list rhythm tightened
- Line 13: `"Vat die stap"` → `"Gaan stap"` (kill the calque)
- Line 1 polish: `"Die lug maak dit amper reg"` → `"Die lug maak amper op daarvoor"`
- Line 10 polish: `"Billike ruil"` → `"Dis 'n billike ruil"`

**Verdict**: CLEAN. Ship-ready. Most-native lines per reviewer: 2, 5, 7, 8, 9, 14, 15, 17, 18, 20.
