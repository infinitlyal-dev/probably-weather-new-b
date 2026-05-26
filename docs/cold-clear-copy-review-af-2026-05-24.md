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

---

## 2026-05-24 (Al rewrite) — Round 1 + 2 appendix

Al rewrote the EN canonical with 30 Highveld-specific lived references (Bloemfontein 6am, Free State, Welkom, Karoo, Maluti, Sasolburg, Kroonstad, N1 cattle, Toyota, etc.) replacing the previous 20-line bin. AF retranslated with stricter SA code-switching preservation: proper nouns and SA Afrikaans phrases (`takkies`, `lapa`, `lekker koud`, `koue belt`, `hadedas`, `koppies`, `jacaranda`, `stoep`, `braai`, `bakkie`, `geyser`) preserved verbatim; English words used in SA code-switching (`crispy`, `keen`, `Highveld classic`, `try`, `export`, `winter-setting`, `fine`) retained.

### Round 1 — codex review (2026-05-24)

**CRITICAL (2)**
- L2: `"Die Vrystaat"` → `"Die Free State"` (proper-noun rule)
- L13: `"bleek"` (pale) → `"troosteloos"` (preserves "bleak" image)

**MAJOR (8)**
- L1: `"'n dapper gesig"` → `"'n gesig wat maak of alles fine is"`
- L2: `"winter-instelling"` → `"winter-setting"` (code-switch joke)
- L5: `"steeds reg / altyd reg"` → `"nog steeds keen / altyd keen"`
- L9: `"bros"` → `"crispy"` (preserve sharper code-switch image)
- L16: `"Ketel-twee-keer-kook weer"` → `"Kook-die-ketel-twee-keer weer"`
- L22: `"Google na 'vloerverwarming...'"` → `"Google: vloerverwarming Bloemfontein."`

**MINOR (8)**
- L3: `"ingestem het om te vat"` → `"besluit het om te vat"`
- L8: `"troeteldier se bak"` → `"hond se bak"` (later revised to `"troeteldierbak"` in round 2)
- L11: `"maak of hy nie het nie"` → `"voorgee hy nie het nie"`
- L14: `"Trek iets aan jou voete aan"` → `"Sit iets aan jou voete"`
- L20: `"Hoëveld-klassiek"` → `"Highveld classic"` (preserve English punchline)
- L25: `"eerste probeerslag"` → `"eerste try"` (code-switch)
- L27: `"saamgedruk"` → `"in 'n bondel"`
- L29: `"voer dit verniet uit"` → `"export dit gratis"`

### Round 2 — codex review (2026-05-24)

Only one finding:
- L8 [MINOR]: `"hond se bak"` narrows source "pet bowl" to dog-specific. Suggested `"troeteldierbak"` (compound). **Applied.**

**Verdict**: CLEAN after round 2 — round 1 CRITICAL/MAJOR all resolved; sole minor folded in.
