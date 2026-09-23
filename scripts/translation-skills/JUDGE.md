# Back-translation judge — the rubric (2026-09-23)

Each item has an English source line from a South African weather app (`en`) and a
back-translation (`back`): someone translated the app's Afrikaans, isiZulu, isiXhosa or Sesotho
line into English WITHOUT seeing the English. Compare the two English sentences and judge
whether the translated line says what the source says.

| Verdict | Use when |
|---|---|
| `MATCH` | Same meaning. Different wording, word order or small paraphrase is fine; nothing a reader of the app would notice has changed. |
| `DRIFT` | The core meaning survives but something a reader would notice changed: a detail (a named thing made generic, a time, place, number or object changed), the joke or punchline flattened, a South African reference lost, the tone clearly different. |
| `MISMATCH` | It says something else, contradicts the source, reverses an instruction, or loses the point entirely. |

Judge meaning, not style: a back-translation is itself a translation, so literal or clumsy English
in `back` is not a fault on its own. Advice matters most — if the source tells someone to do
something (headlights on, sunscreen, stay inside, cover the car) and the back-translation tells
them something else or nothing, that is `MISMATCH`.

Output a JSON array, one object per item, same order:
`{ "k": "...", "verdict": "MATCH" | "DRIFT" | "MISMATCH", "reason": "≤ 15 words; empty for MATCH" }`
