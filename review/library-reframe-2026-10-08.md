# Library reframes — 8 Oct 2026 (Vonk)

Al's ruling (8 Oct): the 80 library photographs no crop anchor could save (`review/crop-audit-2026-10-08.md` — faces
under the number, "Probably …", the buttons or the joke on his phone) regenerated through the new-sets loop, one at a time,
up to three rounds, same pass/fail list (`review/new-sets-qc-2026-10-08.md`), each photograph keeping its lines where the
new picture still fits them.

**Result: 77 replaced, 3 kept as they were (still fail after three rounds).** Lines unchanged on all 80; two listed below
for Maat. Phone sheet: `review/new-sets-phone-2026-10-08/library-reframes.jpg`.

## How

- **Driver:** Codex `gpt-5.6-sol` with its built-in image tool (`scripts/regen-library-photo.mjs`). Al asked for GPT 6.1
  Sol; Codex refuses it on the ChatGPT login ("not supported when using Codex with a ChatGPT account"). The image model
  behind the tool is not reported.
- **Scenes:** no original prompt exists in `review/` for any of the 80 (searched every review JSON by hash). 29 use the
  description the line writers made from the photograph ("seen", the v2/v3 worklists); 51 were written from the
  photograph on 8 Oct. All in `review/library-reframe-2026-10-08/scenes.json`.
- **Prompt:** weekday + time slot + scene + the folder's weather + the house tail + Al's two sentences (the dry-ground
  sentence left out for rain and storm, whose ground is wet by nature).
- **Round 1 (80):** "every face between 40 % and 55 % of the frame height". 53 passed the face rule.
- **Round 2 (28):** tighter band + "no recognisable landmark" (Table Mountain had appeared in most round-1 takes; the
  brief is countrywide). 8 passed. The model does not follow a percentage.
- **Round 3 (21):** framing in camera terms — "camera pulled well back, people full-length in the vertical middle, top
  40 % open sky or wall". 18 passed.
- **Face check:** `node scripts/anchor-faces.mjs --reframes` (414x715, each photograph's longest English line).
  13 takes pass only with a new anchor; those are written to `review/set-001-crop-offsets.json`.
- **Ingest:** `node scripts/ingest-library-reframes.mjs` — new bytes into every slot the photograph held (211 slots),
  lines kept by hash (`reframed: true`, `replacedHash`), the old crop rulings dropped (they were made on a frame that no
  longer exists; the desktop falls back to its default for those).

## Still failing — kept as they were

| photograph | why |
|---|---|
| storm/week_1/day/5 `20f3d07d3c47` (the dog under the table in a storm) | three takes, every one with a head under "Probably …" |
| heat/week_1/night/6 `87546db18e01` (the night pool party) | faces under the joke in all three |
| rain/week_1/day/2 `fbaca052756a` (the blanket fort) | the father's head under "Probably …" in all three |

## For Maat — lines that fit the new picture less well

| photograph | line | why |
|---|---|---|
| heat/week_1/dawn/3 `fc06880aeadb` → `07134d7dde78` | "It's so hot even the ice tray looks nervous." | the ice tray is now small, mid-frame; the joke needs it close |
| wind/week_1/day/7 `92ef82c2d34a` | "That walk was somebody else's idea and the dog is registering a complaint." | the new dog trots along happily |

Everything else was read against its lines and still fits (the gym line, the umbrellas, the ice-cream van, the blanket
on the frosty car …). Round-3 takes are wider shots — people are smaller in the frame; that is the cost of keeping their
faces clear of the number.

## Not on the pass/fail list, worth Al's eye

- Table Mountain is in the background of many round-1 takes (it passed the list; the brief asks for countrywide places).
- storm/week_1/night/7 `14c56f85c353`: the man smiles into the camera while filming the lightning.

## Every replacement

| photograph | old → new hash | round | face anchor |
|---|---|---|---|
| wind/week_1/dusk/1.webp | `002f0c1d5187` → `662416d2616f` | 1 | — |
| cold-clear/week_1/day/3.webp | `042ba0a95388` → `686dbce6f903` | 1 | 26 |
| cloudy/week_2/day/7.webp | `04bdf14c306b` → `21f5fa9c142b` | 1 | 77 |
| clear/week_1/day/4.webp | `0d7c5c34c6a0` → `18fdc648ed5f` | 2 | 6 |
| clear/week_1/dawn/7.webp | `1108cfd1192f` → `28438356788a` | 1 | — |
| cold/week_1/night/6.webp | `13efc9191981` → `f7ca873cf943` | 1 | 77 |
| fog/week_1/dusk/3.webp | `13f616637843` → `96583bc75518` | 1 | — |
| storm/week_1/night/7.webp | `14c56f85c353` → `f6c5ce087817` | 1 | — |
| heat/week_2/dusk/5.webp | `15e8f0aa4baa` → `f0b88f3e50db` | 1 | — |
| rain/week_1/dawn/4.webp | `1914aa132481` → `6e5870ded321` | 1 | 20 |
| clear/week_3/day/1.webp | `1c3c5a763f13` → `263d2fd72df1` | 3 | — |
| cold/week_1/dawn/3.webp | `1c5f757ee79a` → `627b15e8ad3b` | 1 | 30 |
| heat/week_1/night/4.webp | `1d12b604469e` → `fbc82d23d064` | 1 | — |
| heat/week_1/night/2.webp | `2a3a60226c30` → `3cd876a7abd9` | 3 | — |
| rain/week_2/day/5.webp | `2c5a9b3813f4` → `bb008f83ac69` | 1 | — |
| cold-clear/week_1/day/7.webp | `32dec9fbdcaa` → `bb69d0bf426a` | 1 | — |
| cold-clear/week_2/dawn/6.webp | `34890f7d9e5c` → `94a29876fb2a` | 1 | — |
| cold/week_1/day/7.webp | `36ffe52cf7ec` → `a3bf3df24516` | 1 | — |
| cold-clear/week_1/dusk/5.webp | `3bb43b4437ad` → `33670cf75642` | 1 | — |
| cloudy/week_4/day/7.webp | `3c8fb431fafe` → `f70235ea3239` | 3 | — |
| fog/week_1/dusk/7.webp | `4191f6a7d49f` → `4c306b0743ae` | 1 | 12 |
| wind/week_2/day/6.webp | `454c5a6995aa` → `ba0c0e838ef3` | 2 | — |
| cloudy/week_2/day/2.webp | `47550fce6c98` → `dea898fa4fee` | 3 | — |
| fog/week_1/night/5.webp | `4b77f610c3f8` → `395ad8d85838` | 2 | — |
| wind/week_2/night/6.webp | `4cbd692804c1` → `55bb6b48141f` | 1 | — |
| wind/week_1/day/2.webp | `4d3a786acf48` → `f66c7621c29c` | 1 | — |
| storm/week_1/dawn/6.webp | `4e474a9a4873` → `de0391a5031f` | 1 | — |
| heat/week_2/day/2.webp | `4e7c3b6e7580` → `264eb3f1ed31` | 1 | — |
| storm/week_1/night/6.webp | `504caee429a0` → `e369a2fb706e` | 1 | — |
| clear/week_4/day/6.webp | `508a39ca3436` → `69cf33d36063` | 3 | — |
| rain/week_2/dusk/3.webp | `5542dfc7215d` → `0e37d6239e5c` | 1 | — |
| clear/week_2/day/3.webp | `5976dea068f8` → `ef09644d9669` | 1 | — |
| cold-clear/week_1/dawn/3.webp | `5a6dd26eb7db` → `f584e04899ee` | 1 | 77 |
| rain/week_1/dawn/6.webp | `60d5a3416f6b` → `91920d6f2b61` | 1 | — |
| fog/week_2/dawn/3.webp | `614ba5459c4a` → `15f344f270c2` | 1 | — |
| cold/week_2/night/5.webp | `636c4074f988` → `74918c9daa5b` | 3 | — |
| heat/week_1/day/3.webp | `6591bd91d1fc` → `445b3ba3d63d` | 2 | — |
| cloudy/week_1/night/2.webp | `68317318c85d` → `9303c4484c0a` | 1 | 74 |
| wind/week_1/night/1.webp | `6bb604217e96` → `6d670d148ed4` | 1 | — |
| rain/week_1/dusk/1.webp | `71fdebcd3deb` → `68f63b198ea7` | 3 | — |
| clear/week_4/day/7.webp | `744643e152b8` → `0a159cc2ace1` | 3 | — |
| wind/week_2/dawn/1.webp | `775f4f1b47b4` → `38b862d7d61d` | 1 | — |
| clear/week_4/day/1.webp | `7d13aaa156f4` → `c423ac36650f` | 3 | — |
| cold/week_2/dusk/5.webp | `7d459440d824` → `88cfd7e971e0` | 1 | — |
| heat/week_1/dawn/5.webp | `7d4fb2e85dbf` → `f33fb544b3e0` | 1 | — |
| clear/week_1/dusk/3.webp | `7d50ec606bfc` → `b20be24d4aaf` | 1 | — |
| clear/week_1/dawn/2.webp | `844f8b7f5b89` → `6f184ded336b` | 3 | — |
| cold/week_1/dusk/2.webp | `8d215e14d9ba` → `d8c45c88a27b` | 1 | — |
| cold-clear/week_1/night/6.webp | `8fd1944f303b` → `c611a4090ff0` | 1 | — |
| wind/week_1/day/7.webp | `92ef82c2d34a` → `430bc0e3d41c` | 3 | — |
| heat/week_1/dusk/7.webp | `9728bed72ec6` → `c522fe1e6bc8` | 1 | 77 |
| storm/week_1/day/1.webp | `99d0821cdd98` → `5c01cb0b7179` | 2 | — |
| clear/week_2/dawn/6.webp | `a300495d4526` → `3b5babdebfa1` | 1 | — |
| cold/week_2/day/5.webp | `a373f1d83e2f` → `ae1ddd4aa45b` | 1 | — |
| clear/week_2/day/2.webp | `aa3420ca4da1` → `9a2af24c29e0` | 3 | — |
| cloudy/week_1/night/6.webp | `aa3ccab85b60` → `f733a3c46589` | 1 | — |
| rain/week_1/dusk/5.webp | `b4ee9d16720e` → `3b6c8808dc5e` | 3 | — |
| wind/week_1/dawn/6.webp | `bbf6b6ef796a` → `0aa6f0dc51d4` | 1 | — |
| wind/week_1/night/6.webp | `be8276f7384b` → `f2d463be492c` | 1 | — |
| clear/week_2/dawn/4.webp | `c0246be3744d` → `8ee01c935b1d` | 1 | — |
| cloudy/week_1/day/6.webp | `c16f8303d56e` → `affa6944aeb6` | 1 | — |
| cold/week_1/night/7.webp | `c50ba2c591aa` → `f613a92f234d` | 2 | — |
| clear/week_1/day/5.webp | `ca6d821f7c9b` → `61c5b91771e8` | 1 | 77 |
| cold/week_2/night/6.webp | `cd4bd5c64c5d` → `d1b9fe13af2e` | 1 | — |
| heat/week_1/day/2.webp | `d6593f52fb76` → `25d67e168752` | 3 | — |
| wind/week_2/dusk/1.webp | `d68ae3f7c914` → `a5dcb910cb0d` | 2 | — |
| rain/week_2/day/4.webp | `d86d4f5699c2` → `e306e812d307` | 1 | — |
| rain/week_2/day/2.webp | `d878b96a3f71` → `5968109fcab9` | 1 | 14 |
| cold-clear/week_1/night/2.webp | `da90853b2ccb` → `ba580c1b22f6` | 2 | — |
| cloudy/week_1/dawn/2.webp | `de1df07bf268` → `7cf3b4855d01` | 3 | — |
| cold-clear/week_1/day/5.webp | `decff597fe6c` → `15a779ccb271` | 1 | — |
| storm/week_1/dawn/7.webp | `e400ca864a50` → `63d53beeeadc` | 1 | — |
| cold/week_2/dusk/6.webp | `e499768237ef` → `afefa4bfce14` | 3 | — |
| wind/week_2/day/4.webp | `e8500f5dfaee` → `71db5bd2e853` | 1 | — |
| clear/week_3/day/3.webp | `f9f55b1dcfeb` → `d595c5abbbc9` | 3 | — |
| storm/week_1/night/3.webp | `faaf0b2003be` → `9c2cd5b76064` | 1 | — |
| heat/week_1/dawn/3.webp | `fc06880aeadb` → `07134d7dde78` | 3 | 10 |
