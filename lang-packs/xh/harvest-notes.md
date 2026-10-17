# isiXhosa — harvest notes (contemporary register evidence)

First-pass harvest (bootstrap for the monthly Hermes/GPT seat). Patterns paraphrased — **no
sentences copied into the app**. Dated + sourced.

## 2026-07-17 — register & code-switching

**Urban colloquial, code-switched.** isiXhosa is Nguni (sister to isiZulu); the same urban-vs-pure
split applies. I'solezwe lesiXhosa (Independent Media's isiXhosa daily) and Umhlobo Wenene FM
(SABC isiXhosa radio) both run a contemporary, accessible register with routine English code-mixing
— the target for this app. Avoid literary/liturgical isiXhosa. `Source: Umhlobo Wenene FM (SABC) station profile; I'solezwe lesiXhosa (Independent Media) (2026-07-17). Quality: medium (station/masthead descriptions; direct fetch blocked, pattern cross-checked with isiZulu corpus work).`

**Attestation is the isiXhosa-specific risk** (see errors-observed.md): the failure here was ornate
UNATTESTED tokens, not calque. Harvest priority is confirming plain everyday words, not collecting
fancy ones. Prefer the word a Umhlobo Wenene presenter would actually say.

## 2026-07-17 — weather-talk construction (attested Nguni patterns)

- **`imozulu`** = the weather (the noun the app's condition lines orbit).
- **Impersonal `ku-` ambient state:** cold = `kuyabanda`, hot = `kuyatshisa`, mirroring isiZulu's
  frame with isiXhosa orthography (tsh). Rain as sky-subject parallels isiZulu `izulu liyana`.
- **Watch word boundaries** — isiXhosa agglutinates but words separate; the observed error was
  fused morphemes (`lwengqeleolukwenza`). `Source: wisc.pb.unizin.org Xhosa: The Weather (LCTL); quizlet Xhosa weather phrases; bu.edu isiXhosa proverbs (2026-07-17). Quality: medium (teaching + proverb resources).`
- **Humour register:** colloquial spoken frame + a punch, not a proverb. Proverbs read formal.

## Gaps to fill next harvest
- Confirm attested everyday forms for the future_review flagged tokens (errors-observed.md list).
- Sample I'solezwe lesiXhosa / Umhlobo Wenene social posts for weather-humour register.
- Decide code-switch threshold per word (crows → amahlungulu vs "ii-crows") with a native.

## 2026-10-09 — counts from current text (Vonk; `node scripts/lang-check/fetch-corpora.mjs ngrams`)
Stored as word / pair / triple counts only (`.lang-check-cache/ngrams/xh.json`); no sentence was kept. What each source gave:
I'solezwe lesiXhosa 300 article pages (from 1 029 in its section sitemaps) → 71 267 tokens; gov.za isiXhosa pages 67 pages
→ 1 522 tokens; SABC News unreachable (redirect loop, not worked around); PanSALB not fetched (robots.txt disallows all).
Local corpora counted the same way: 2.1 M tokens.
Paraphrased observations:
- Time words: namhlanje 524 (today); ngokuhlwanje only 8 — tonight is rare in print but is the form the bank uses.
  kusasa 80 against ngentsasa 18: kusasa is common and also means "tomorrow"; for "this morning" prefer ngentsasa
  (the native review asked exactly this about the morning-rain badge).
- Weather: umoya 227, ilanga 136, ubushushu 127, imozulu 106, imvula 74; ingqele 10, inkungu 8, amafu 11 — the weather
  vocabulary of the bank is attested but thin, which is why single-word lookup over-flags isiXhosa.
- Neither "umoya uvuthuza" nor "umoya uphezulu" appears as a pair: the open question on the wind headline is not
  settled by the corpus.
