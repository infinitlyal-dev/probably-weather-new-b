# Sesotho — errors observed (negative prompt for the drafter)

Every row is a real correction a native speaker made to AI-drafted Sesotho in this app.
Categories: **calque** (word-for-word from EN), **wrong-word** (real word, wrong meaning),
**wrong-dialect** (Lesotho/Zulu/Xhosa form in SA-Sesotho copy), **wrong-register** (real
word, wrong tone/context), **wrong-meaning**, **untranslated-loan** (English left raw where a
Sesotho word exists), **spelling**. Source: `review/sesotho-replacements.txt` (90 native-
confirmed replacements), `review/NATIVE_REVIEW_ST.md`. **Never reproduce a FROM value.**

## calque — literal EN word order / imagery that isn't idiomatic
| Wrong (calque) | Right | Note |
|---|---|---|
| Tsela ea Lebese (Milky Way, lit. "road of milk") | Molalatladi | native astronomical term, not a translation |
| Leholimo le lebe (Severe weather, lit. "bad sky") | Boemo ba leholimo bo matla | "conditions are strong", not "bad sky" |
| Modumo wa leholimo (Thunder, lit. "noise of sky") | Modumo wa seaduma | seaduma is the thunder term |

## wrong-word — a real Sesotho word meaning the wrong thing
| Wrong | Actually means | Right | Context |
|---|---|---|---|
| lifofane | airplanes (pl. of sefofane) | meea e fokang ka sefutho | wind gusts — THE flagship error, see NATIVE_REVIEW_ST A1 |
| tsie | grasshopper | tswiritswiri | cricket (the insect chirping) |
| dikgogo | chickens | merubisi | owls |
| utsoarela | forgiveness / to forgive | utloela bohloko | "feel sorry for" |

## wrong-dialect — Lesotho-Sesotho or Zulu/Xhosa form in SA-Sesotho copy
| Wrong | Right | Note |
|---|---|---|
| Hlonepha (respect) | Hlompha | Hlonepha is the Zulu/Xhosa form; SA-Sesotho is Hlompha |
| jwalo / jwale | joalo / joale | app uses SA-Sesotho conventions, not Lesotho spelling |

## wrong-register — real word, wrong tone for weather copy
| Wrong | Right | Note |
|---|---|---|
| motle (beautiful) | hotle | "motle" describes a PERSON; weather beauty is "hotle" |
| Mafube (sunrise) | Ho chaba ha letsatsi | Mafube is correct but stiff; the phrase is warmer/less formal |
| Letsatsi le likela (sunset) | Ho likela ha letsatsi | same stiffness fix |

## untranslated-loan — English left raw where Sesotho exists
| Left as English | Sesotho | Note |
|---|---|---|
| soupa | sopho | soup |
| biltong | sehwapa | (biltong is fine as flavour, but sehwapa is the word) |
| setofo (sunscreen, garbled) | setlolo sa letsatsi | "setofo" reads as stove; sunscreen is setlolo sa letsatsi |
| jackets | dijakete | pluralise into Sesotho when the word carries the sentence |

NOTE ON CODE-SWITCHING (this is register, NOT error): jersey, gown, scarf, takkies, braai,
Southeaster, "lekker koud", brand names (Toyota, Instagram), place names (Bloemfontein,
Welkom, Karoo) are KEPT in English/Afrikaans — that is the real colloquial SA-Sesotho voice.
Do not "correct" these into textbook Sesotho. The error is inventing/mistranslating a CONTENT
word, never leaving a naturally code-switched loan alone.

## spelling — global fixes already folded into the confirmed corpus
mohodi → moholi (fog/mist) · tjhesa → chesa (hot) · setofo → setlolo sa letsatsi (sunscreen) ·
Hlonepha → Hlompha (respect)
