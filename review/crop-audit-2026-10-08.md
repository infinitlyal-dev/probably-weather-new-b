# Crop audit — faces against Home D, 2026-10-08

`node scripts/anchor-faces.mjs`. Detector: Human 3.3.6 (TensorFlow.js 4.22 WASM): MoveNet MultiPose + CenterNet + BlazeFace; heads v2. Decided at **414x715** (Al's iPhone 11 + Chrome); 414x896 (installed) beside it. A head under 2.5 % of the photograph's height is not judged.

| | photographs | pass | moved | cannot be saved | retire with the new cloudy set | no head found |
|---|---:|---:|---:|---:|---:|---:|
| library (1,008 slots) | 322 | 214 | 16 | 80 | 12 | 147 |
| new sets | 69 | 64 | 4 | 1 | 0 | 19 |

**What the anchor can do on Al's phone:** at 414x715 the photograph can slide 21 px; at 414x896 not at all. The anchor's real effect is where the joke goes (home-d.js raises it when the anchored subject would sit under it). "Cannot be saved" therefore means: the faces sit under the number or the buttons, or under the joke wherever it goes — only a re-framed photograph fixes it.

## Test case: the outdoor gym

`7d13aaa156f4` clear/week_4/day/1.webp, line "Blue sky: the outdoor gym has suddenly found new members.". Heads (photograph px): [205, 125, 90, 112] pose; [782, 299, 74, 92] pose.
Before (anchor 25): head at screen 46–92 px under the number / Probably / buttons; head at screen 118–155 px under the number / Probably / buttons. Verdict: **cannot be saved**. Sheet: `review/crop-audit-2026-10-08/outdoor-gym.jpg`.

## Moved — 20

Sheet: `review/crop-audit-2026-10-08/moved.jpg` (before | after, as the phone shows them).

| photograph | hash | anchor now | anchor after | hidden at 414x715 now | 414x896 now → after |
|---|---|---|---|---|---|
| clear/week_2/day/6.webp | `6e598ae56c12` | 55 | **73** | pose 297–393 px under the joke | pass → pass |
| clear/week_1/dusk/2.webp | `1bd6b90924a1` | 77 | **81** (joke raised) | pose 423–468 px under the joke; pose 436–465 px under the joke | hidden → pass |
| clear/week_1/dusk/6.webp | `d097525bf5cf` | 87 | **88** (joke raised) | pose 480–502 px under the credit line | pass → pass |
| clear/week_1/night/4.webp | `05cd0ad39fd6` | 58 | **6** | person-box 199–265 px under the number / Probably / buttons | pass → pass |
| cloudy/week_1/dawn/6.webp | `b5793c36b69d` | 90 | **77** | pose 349–378 px under the joke (raised) | pass → pass |
| cloudy/week_1/night/4.webp | `bdc2741f86fb` | 68 | **71** | pose 369–389 px under the joke | pass → pass |
| cold/week_2/day/1.webp | `999e68c47bfc` | 86 | **77** | pose 300–345 px under the joke (raised) | hidden → pass |
| cold/week_1/dusk/6.webp | `39e28d40ecf1` | 96 | **74** | pose 333–364 px under the joke (raised); person-box 363–386 px under the joke (raised); person-box 347–375 px under the joke (raised) | pass → pass |
| cold-clear/week_1/day/4.webp | `bbb3d8348b00` | 41 | **54** | pose 277–391 px under the joke | pass → pass |
| cold-clear/week_1/night/3.webp | `d298c8c1f224` | 55 | **67** | face 341–429 px under the joke | pass → pass |
| cold-clear/week_1/night/7.webp | `da60a92cafd2` | 61 | **77** | pose 358–391 px under the joke | pass → pass |
| heat/week_1/dusk/4.webp | `3e88aef1fb06` | 81 | **77** | pose 310–336 px under the joke (raised) | hidden → pass |
| heat/week_1/dusk/5.webp | `93f4a43551af` | 89 | **77** | pose 346–378 px under the joke (raised); pose 319–358 px under the joke (raised); pose 355–384 px under the joke (raised) | hidden → pass |
| storm/week_2/day/4.webp | `8c5812bded23` | 71 | **75** (joke raised) | pose 413–433 px under the joke | pass → pass |
| wind/week_1/dusk/2.webp | `bdc6900c5689` | 91 | **77** | pose 313–370 px under the joke (raised) | hidden → pass |
| heat/week_3/day/2.webp | `0fe1f7c40461` | 35 | **14** | person-box 205–231 px under the number / Probably / buttons | pass → pass |
| new partly-cloudy/day-2.png | `6ff8e640620e` | default 78 | **81** (joke raised) | pose 406–452 px under the joke | hidden → pass |
| new breezy/dawn-2.png | `7ee2cbed2261` | default 78 | **6** | pose 195–238 px under the number / Probably / buttons | pass → pass |
| new breezy/day-1.png | `d61ade6631c5` | default 78 | **26** | pose 199–327 px under the number / Probably / buttons | pass → pass |
| new cloudy/dawn-1.png | `b7ed327860b0` | default 78 | **67** | person-box 207–301 px under the number / Probably / buttons | pass → pass |

## Cannot be saved — 81

Sheet: `review/crop-audit-2026-10-08/cannot-be-saved.jpg` (as the phone shows them now).

| photograph | hash | anchor now | anchor after | hidden at 414x715 now | 414x896 now → after |
|---|---|---|---|---|---|
| clear/week_1/day/5.webp | `ca6d821f7c9b` | 99 | — | pose 380–404 px under the joke (raised); person-box 368–405 px under the joke (raised) | pass → pass |
| clear/week_2/day/2.webp | `aa3420ca4da1` | 60 | — | pose 197–221 px under the number / Probably / buttons; pose 369–396 px under the joke; person-box 190–233 px under the number / Probably / buttons; person-box 188–219 px under the number / Probably / buttons | pass → pass |
| clear/week_1/dusk/3.webp | `7d50ec606bfc` | 37 | — | pose 201–265 px under the number / Probably / buttons | pass → pass |
| cloudy/week_1/dawn/2.webp | `de1df07bf268` | 14 | — | pose 95–135 px under the number / Probably / buttons | hidden → hidden |
| cloudy/week_1/day/6.webp | `c16f8303d56e` | 51 | — | pose 163–223 px under the number / Probably / buttons | pass → pass |
| cloudy/week_2/day/2.webp | `47550fce6c98` | 51 | — | pose 167–243 px under the number / Probably / buttons | pass → pass |
| cloudy/week_2/day/7.webp | `04bdf14c306b` | 88 | — | pose 368–397 px under the joke (raised) | pass → pass |
| cloudy/week_1/night/2.webp | `68317318c85d` | 53 | — | pose 414–441 px under the joke | hidden → hidden |
| cold/week_1/dawn/3.webp | `1c5f757ee79a` | 33 | — | pose 151–229 px under the number / Probably / buttons | hidden → hidden |
| cold/week_1/day/7.webp | `36ffe52cf7ec` | 55 | — | pose 192–251 px under the number / Probably / buttons; face 205–271 px under the number / Probably / buttons | pass → pass |
| cold/week_2/day/5.webp | `a373f1d83e2f` | 30 | — | pose 123–291 px under the number / Probably / buttons | hidden → hidden |
| cold/week_1/night/6.webp | `13efc9191981` | 100 | — | pose-box 400–448 px under the joke (raised); pose 395–439 px under the joke (raised) | pass → pass |
| cold/week_1/night/7.webp | `c50ba2c591aa` | 36 | — | pose 131–249 px under the number / Probably / buttons | hidden → hidden |
| cold-clear/week_1/dawn/3.webp | `5a6dd26eb7db` | 87 | — | person-box 346–399 px under the joke (raised); person-box 402–428 px under the joke (raised) | pass → pass |
| cold-clear/week_1/day/3.webp | `042ba0a95388` | 50 | — | pose 375–395 px under the joke | pass → pass |
| cold-clear/week_1/day/5.webp | `decff597fe6c` | 74 | — | pose 359–391 px under the joke | pass → pass |
| cold-clear/week_1/day/7.webp | `32dec9fbdcaa` | 63 | — | person-box 372–397 px under the joke; person-box 366–392 px under the joke | pass → pass |
| cold-clear/week_1/night/2.webp | `da90853b2ccb` | 68 | — | pose 378–401 px under the joke | pass → pass |
| cold-clear/week_1/night/6.webp | `8fd1944f303b` | 72 | — | pose 402–425 px under the joke; pose 415–435 px under the joke | pass → pass |
| heat/week_1/day/2.webp | `d6593f52fb76` | 59 | — | pose 359–393 px under the joke; pose 362–393 px under the joke | pass → pass |
| heat/week_1/day/3.webp | `6591bd91d1fc` | 53 | — | pose 185–238 px under the number / Probably / buttons; pose 186–246 px under the number / Probably / buttons | pass → pass |
| heat/week_1/dusk/7.webp | `9728bed72ec6` | 87 | — | pose 378–404 px under the joke (raised) | pass → pass |
| heat/week_1/night/2.webp | `2a3a60226c30` | 31 | — | pose 177–221 px under the number / Probably / buttons | pass → pass |
| heat/week_1/night/6.webp | `87546db18e01` | 68 | — | pose 445–478 px under the joke; person-box 391–426 px under the joke; person-box 363–390 px under the joke; person-box 396–428 px under the joke | hidden → hidden |
| rain/week_2/day/2.webp | `d878b96a3f71` | 26 | — | pose 167–234 px under the number / Probably / buttons | hidden → hidden |
| rain/week_2/day/4.webp | `d86d4f5699c2` | 25 | — | pose 134–176 px under the number / Probably / buttons | hidden → hidden |
| rain/week_1/dusk/1.webp | `71fdebcd3deb` | 38 | — | pose 200–296 px under the number / Probably / buttons | pass → pass |
| rain/week_1/dusk/5.webp | `b4ee9d16720e` | 32 | — | pose 192–232 px under the number / Probably / buttons | pass → pass |
| storm/week_1/dawn/6.webp | `4e474a9a4873` | 31 | — | pose 159–230 px under the number / Probably / buttons | hidden → hidden |
| storm/week_1/day/1.webp | `99d0821cdd98` | 71 | — | pose 361–398 px under the joke | pass → pass |
| storm/week_1/day/5.webp | `20f3d07d3c47` | 69 | — | face 360–581 px under the joke | hidden → hidden |
| storm/week_1/night/3.webp | `faaf0b2003be` | 29 | — | pose 194–275 px under the number / Probably / buttons | pass → pass |
| storm/week_1/night/7.webp | `14c56f85c353` | 23 | — | pose 138–198 px under the number / Probably / buttons | hidden → hidden |
| wind/week_1/day/2.webp | `4d3a786acf48` | 16 | — | pose 91–204 px under the number / Probably / buttons | hidden → hidden |
| wind/week_1/day/7.webp | `92ef82c2d34a` | 61 | — | pose-box 2–88 px under off the top of the screen | hidden → hidden |
| wind/week_1/dusk/1.webp | `002f0c1d5187` | 75 | — | pose 352–438 px under the joke; pose 326–429 px under the joke | pass → pass |
| wind/week_1/night/6.webp | `be8276f7384b` | 64 | — | pose 267–403 px under the joke | pass → pass |
| heat/week_2/day/2.webp | `4e7c3b6e7580` | 40 | — | pose 191–233 px under the number / Probably / buttons | pass → pass |
| rain/week_2/day/5.webp | `2c5a9b3813f4` | 30 | — | pose 75–131 px under the number / Probably / buttons | hidden → hidden |
| fog/week_2/dawn/3.webp | `614ba5459c4a` | 42 | — | pose 195–223 px under the number / Probably / buttons | pass → pass |
| cold-clear/week_2/dawn/6.webp | `34890f7d9e5c` | 50 | — | pose 163–192 px under the number / Probably / buttons | pass → pass |
| cold/week_2/dusk/6.webp | `e499768237ef` | 25 | — | pose 76–129 px under the number / Probably / buttons; person-box 65–138 px under the number / Probably / buttons | hidden → hidden |
| cold/week_2/night/6.webp | `cd4bd5c64c5d` | 15 | — | pose 65–102 px under the number / Probably / buttons | hidden → hidden |
| cloudy/week_1/night/6.webp | `aa3ccab85b60` | 23 | — | pose 122–170 px under the number / Probably / buttons | hidden → hidden |
| clear/week_1/dawn/7.webp | `1108cfd1192f` | 18 | — | pose 79–104 px under the number / Probably / buttons | hidden → hidden |
| clear/week_1/dawn/2.webp | `844f8b7f5b89` | 26 | — | pose 137–172 px under the number / Probably / buttons | hidden → hidden |
| heat/week_2/dusk/5.webp | `15e8f0aa4baa` | 20 | — | pose 56–95 px under the number / Probably / buttons | hidden → hidden |
| storm/week_1/dawn/7.webp | `e400ca864a50` | 20 | — | pose 96–135 px under the number / Probably / buttons | hidden → hidden |
| wind/week_1/night/1.webp | `6bb604217e96` | 28 | — | pose 137–180 px under the number / Probably / buttons | hidden → hidden |
| wind/week_2/day/4.webp | `e8500f5dfaee` | 18 | — | pose 59–89 px under the number / Probably / buttons | hidden → hidden |
| heat/week_1/dawn/3.webp | `fc06880aeadb` | 19 | — | pose 16–148 px under the number / Probably / buttons; pose 85–187 px under the number / Probably / buttons | hidden → hidden |
| clear/week_2/day/3.webp | `5976dea068f8` | 20 | — | pose 87–139 px under the number / Probably / buttons | hidden → hidden |
| wind/week_1/dawn/6.webp | `bbf6b6ef796a` | 30 | — | pose 148–192 px under the number / Probably / buttons | hidden → hidden |
| wind/week_2/dawn/1.webp | `775f4f1b47b4` | 38 | — | pose 189–243 px under the number / Probably / buttons | pass → pass |
| wind/week_2/dusk/1.webp | `d68ae3f7c914` | 38 | — | pose 198–247 px under the number / Probably / buttons; person-box 206–233 px under the number / Probably / buttons | pass → pass |
| wind/week_2/night/6.webp | `4cbd692804c1` | 40 | — | pose 187–216 px under the number / Probably / buttons | pass → pass |
| cold/week_2/dusk/5.webp | `7d459440d824` | 33 | — | pose 181–203 px under the number / Probably / buttons; pose 182–210 px under the number / Probably / buttons; person-box 143–175 px under the number / Probably / buttons | hidden → hidden |
| fog/week_1/night/5.webp | `4b77f610c3f8` | 33 | — | pose 154–183 px under the number / Probably / buttons | hidden → hidden |
| clear/week_4/day/7.webp | `744643e152b8` | 35 | — | pose 145–173 px under the number / Probably / buttons | hidden → hidden |
| clear/week_4/day/6.webp | `508a39ca3436` | 33 | — | pose 58–130 px under the number / Probably / buttons; pose 193–232 px under the number / Probably / buttons; pose 206–236 px under the number / Probably / buttons | hidden → hidden |
| clear/week_3/day/3.webp | `f9f55b1dcfeb` | 35 | — | pose 171–232 px under the number / Probably / buttons; person-box 198–236 px under the number / Probably / buttons | pass → pass |
| cloudy/week_4/day/7.webp | `3c8fb431fafe` | 30 | — | pose 117–169 px under the number / Probably / buttons | hidden → hidden |
| rain/week_1/day/2.webp | `fbaca052756a` | 33 | — | pose 53–102 px under the number / Probably / buttons | hidden → hidden |
| storm/week_1/night/6.webp | `504caee429a0` | 35 | — | pose 158–198 px under the number / Probably / buttons | hidden → hidden |
| wind/week_2/day/6.webp | `454c5a6995aa` | 33 | — | pose 172–223 px under the number / Probably / buttons | pass → pass |
| clear/week_2/dawn/6.webp | `a300495d4526` | 30 | — | pose 171–226 px under the number / Probably / buttons; pose 149–180 px under the number / Probably / buttons; pose 158–183 px under the number / Probably / buttons; person-box 156–185 px under the number / Probably / buttons | hidden → hidden |
| clear/week_1/day/4.webp | `0d7c5c34c6a0` | 30 | — | pose 90–143 px under the number / Probably / buttons; pose 190–216 px under the number / Probably / buttons; person-box 180–201 px under the number / Probably / buttons; person-box 184–204 px under the number / Probably / buttons; person-box 175–196 px under the number / Probably / buttons | hidden → hidden |
| cold/week_2/night/5.webp | `636c4074f988` | 30 | — | pose 85–131 px under the number / Probably / buttons | hidden → hidden |
| cold-clear/week_1/dusk/5.webp | `3bb43b4437ad` | 30 | — | pose 145–181 px under the number / Probably / buttons | hidden → hidden |
| fog/week_1/dusk/3.webp | `13f616637843` | 30 | — | pose 186–215 px under the number / Probably / buttons; pose 172–205 px under the number / Probably / buttons | pass → pass |
| fog/week_1/dusk/7.webp | `4191f6a7d49f` | 22 | — | person-box 96–129 px under the number / Probably / buttons | hidden → hidden |
| clear/week_3/day/1.webp | `1c3c5a763f13` | 30 | — | pose 144–181 px under the number / Probably / buttons; pose 160–197 px under the number / Probably / buttons; pose 114–166 px under the number / Probably / buttons; person-box 209–237 px under the number / Probably / buttons | hidden → hidden |
| clear/week_4/day/1.webp | `7d13aaa156f4` | 25 | — | pose 46–92 px under the number / Probably / buttons; pose 118–155 px under the number / Probably / buttons | hidden → hidden |
| clear/week_2/dawn/4.webp | `c0246be3744d` | 28 | — | pose 121–155 px under the number / Probably / buttons; person-box 185–206 px under the number / Probably / buttons | hidden → hidden |
| heat/week_1/night/4.webp | `1d12b604469e` | 22 | — | pose 96–162 px under the number / Probably / buttons | hidden → hidden |
| rain/week_1/dawn/4.webp | `1914aa132481` | 30 | — | pose 153–179 px under the number / Probably / buttons | hidden → hidden |
| rain/week_2/dusk/3.webp | `5542dfc7215d` | 30 | — | pose 193–224 px under the number / Probably / buttons; pose 163–186 px under the number / Probably / buttons; pose 174–219 px under the number / Probably / buttons; person-box 155–207 px under the number / Probably / buttons; person-box 168–208 px under the number / Probably / buttons | hidden → hidden |
| cold/week_1/dusk/2.webp | `8d215e14d9ba` | 30 | — | pose 193–226 px under the number / Probably / buttons; person-box 151–207 px under the number / Probably / buttons; person-box 209–245 px under the number / Probably / buttons | hidden → hidden |
| heat/week_1/dawn/5.webp | `7d4fb2e85dbf` | 28 | — | pose 69–128 px under the number / Probably / buttons | hidden → hidden |
| rain/week_1/dawn/6.webp | `60d5a3416f6b` | 28 | — | pose 47–100 px under the number / Probably / buttons; pose 84–123 px under the number / Probably / buttons | hidden → hidden |
| new breezy/dusk-5.png | `ec190a5efd7f` | default 78 | — | pose 149–214 px under the number / Probably / buttons | hidden → hidden |

## Pass — 278

Every head clears at the current anchor; nothing changed. Full per-photograph detail (heads, bands, the anchors that pass) in `review/crop-audit-2026-10-08.json`.

