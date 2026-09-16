# isiXhosa residue — served lines lang-check flagged and this pass could not settle

2026-09-15, item 5. Scope: the 887 isiXhosa bank lines the picker can serve, intersected with
the 105 lang-check triage items. 10 corrected (review/lang-check-apply-xh.md), 78 cleared as
checker false positives (see review/xh-voice.md), these 17 left for a native reader.
One line of doubt each; the line itself is live as shown.

- `witty.heat[83]` "i-sprinkler ifefa khona. Yintlanganiso yamabhaqo" — is -fefa right for a sprinkler, and is "intlanganiso yamabhaqo" a way to say "coincidence"?
- `witty.wind[21]` "Ilaphu belisel' landlelwe" — elided "sele" plus "landlelwe" for "had been laid"; the passive of -andlala would be -andlalwa.
- `witty.cold[88]` "Ngomso iyabe imkile" — future-perfect "will be gone": natural, or "iya kuba imkile"?
- `witty.cold-clear[57]` "Ezo shiti ziza kususwa emgceni zisemxhomeni njenge-carton" — "shiti" without a class prefix; "zisemxhomeni" unclear.
- `witty.cold-clear[68]` "Ubusika baseMzansi bwenza umbala njengokungenamntu" — subject concord "bwenza"; "njengokungenamntu" for "like nobody else".
- `witty.wind[27]` "ingabhatalisi" — "not charging": the loan bhatala, or -hlawulisa?
- `witty.wind[48]` "akukho swithi yokucima" — wind[26] spells it "switshi"; which one?
- `witty.cold[76]` "Iingabangaba … ngaba" — is this the word for seagulls? (the zu pack lists seagull as needs-native too)
- `witty.cold[38]` "Uyakumangala umsebenzi wolwakhiwo" — reads "you'll be amazed"; the English is "architecture is a beautiful thing".
- `witty.cold-clear[90]` "sele lisiye emotweni" — "has already gone": "sele liye"?
- `witty.heat[59]` "xa unepuli" — pool as a loan, or "ichibi lokudada"?
- `witty.fog[93]` "iphakethe elinye leetship" — chips: "iitshiphusi"?
- `witty.clear[62]` "kwicala elingazikiyo" — "the shallow end": "elingenzulu"?
- `witty.wind[29]` "Intaba iyandlele itafile" — recent past of -andlala ("yandlale")?
- `witty.cold[96]` "izinga elingu-2" — degrees as "izinga" (level) or "iidigri"?
- `witty.heat[74]` "izinga elingama-30" — same question.
- `witty.cold-clear[77]` "Nezinga nalo alikho" — same question ("not a degree either").

## 2026-09-16 — `headlines.wind` "Umoya uphezulu": left as it is

Judged this pass; not replaced. The question was whether `uphezulu` is the right word for
"Wind's up." The evidence does not support changing it, and it does not fully clear it either:

- **The checker passes it, barely.** "Umoya uphezulu" scores 0.05 against the 0.25 threshold —
  a pass, but with a LOW semantic note on `uphezulu` rather than a clean one.
- **The voice notes flag the word as unattested, not as wrong.** `lang-packs/xh/errors-observed.md`
  lists `uphezulu` among the words the drafter could not confirm in the corpus, under its own
  caveat: "None are auto-wrong — but each is UNCONFIRMED." It is a plausible copulative
  ("the wind is up"), and it mirrors the English idiom closely, which is what the headline wants.
- **The corpus file already accepts it.** `lang-packs/xh/corpus-confirmed.jsonl` carries
  `headlines.wind` with `"status":"confirmed-live"`.

So: no strong corpus evidence of an error, and the house rule is to propose a fix only on strong
evidence. The live string stays.

**The open question for a native reader**, which is why this is written down rather than closed:
the app already ships a second isiXhosa wind phrasing for the same condition — `middleware.js:123`
sends "Umoya uvuthuza." in the xh share/meta description, and the checker scores that one 0.00
(cleaner than the headline). Both are live, on the same weather, one screen apart. A native
reader should settle two things at once: whether `uphezulu` is idiomatic here, and whether the
headline and the share text should be saying the same thing. If the answer is `uvuthuza`, the
change is one string in `assets/weather-copy.js` plus a rebuild of the copy split.
