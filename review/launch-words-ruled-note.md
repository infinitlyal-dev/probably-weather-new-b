# Launch words, Al's ruling (review/launch-words-ruled.json, exported 02 Oct 2026 06:59)

- All six words are OK as pre-marked: weather.upTo, home.fallbackSaved, home.fallbackApprox, home.pickPlace, misc.agoMins, misc.agoHours.
- One change Al agreed in chat after the export: the Afrikaans for misc.agoHours is "{h} uur gelede", not "{h} h gelede" ("h" is not an Afrikaans short form).
- The chat ruling is Al's ruling; the export file is left unchanged and still says "{h} h gelede" for that key.
- Applied in assets/app.js (T.misc.agoHours af). EN for agoMins/agoHours and every other word is as exported.
- tests/launch-words-ruling.test.js holds the six keys to the export, with the one agoHours exception.
