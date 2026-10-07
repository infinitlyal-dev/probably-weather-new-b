# Probably Weather — image brief, 7 Oct 2026
## Three sets: PARTLY CLOUDY (28 new), BREEZY (28 new), CLOUDY (13 replacements)

Ruled by Al, 7 Oct 2026. One generation per prompt. 69 images.

### What these are for
The app shows one photograph behind the weather, with a short joke written across the
bottom of the picture over a dark scrim. The photograph has to prove the weather true.
This morning the app said "Cloudy" over a blue Strand sky with thin high cloud; the fix in
the code now calls that "partly cloudy", and partly cloudy has no photographs of its own.
Likewise "windy" today means a 20 km/h afternoon and a gale alike, and the wind photos are
all gale. And the cloudy set reads like a storm is coming; an ordinary grey day isn't that.

### The look (this is the house style — every frame)
- Documentary photograph. Not stock, not a render, not an advert. A moment someone caught.
- Vertical 9:16. Final files are 1008×1792; generate at the model's highest 9:16 size.
- 35mm lens feel, available light only, real shadows for the time of day given.
- Countrywide South Africa, suburban and small-town, not only Cape Town: face-brick and
  plaster houses, palisade and security gates, burglar bars, paving, aloes, fynbos and
  jacarandas where they belong, corrugated roofs, spaza shops, taxi ranks, school fields.
- Real-world texture: damp patches, rust, sun-faded paint, cracks, a hose reel, a wheelie
  bin standing upright, marks where things have leaned. The difference between a photo
  and a render is texture.
- People are welcome and the cast is mixed across the set — Black, Coloured, Indian and
  white South Africans, every age — never one group only. People doing ordinary things
  with dignity; nobody is the joke.
- No readable text, logos, signage or number plates anywhere (the model mangles them).
- No cream walls with a green cast. No plastic skin. No CGI sheen.
- Nothing blown over, broken or lying flat. No white plastic chairs.
- The lower third of the frame stays visually quiet and uncluttered: the joke is written
  there. Put the subject in the middle and upper two-thirds.

### The tail — append this verbatim to every prompt
> Documentary photograph, vertical 9:16, 35mm lens, available light only. Real weathered
> surfaces — damp patches, rust, hairline cracks, sun-faded paint, marks where things have
> been leaned. No CGI or 3D-render look, no plastic sheen on skin or surfaces, no green
> colour cast on cream or white walls. No readable text, logos or signs. Nothing blown
> over or lying broken. Keep the lower third of the frame visually quiet and uncluttered.

### Time of day and weekday are not optional
Each prompt names a time slot and a weekday. The app serves slot `dawn-3` only on a
Wednesday at dawn. Monday frames look like Monday (commute, school gate), Saturday frames
may have a braai in them, Sunday frames are slow. Dawn = first 75 minutes after sunrise,
dusk = the hour around sunset, night = full dark with its own light source in frame.

### What each set must and must not be

**PARTLY CLOUDY** — at least half the sky is blue. Fair-weather cumulus, white on top,
light grey underneath, no dark bases. The sun is out and lighting the scene; cloud shadows
move across the ground. Life carries on: the washing dries, the braai happens, the match
goes ahead. It must NOT look like cloudy (no grey blanket) and must NOT look like clear
(there is real cloud in the frame, not a wisp).

**BREEZY** — the wind is visible in light things only: flags out at 45°, hair in a face,
washing swinging, a kite up, leaves and petals skittering, grass rippling in waves,
braai smoke going sideways, a wind-pump turning, small whitecaps. People are relaxed,
not braced; nothing is torn, lost or inverted. The sky is clear or partly cloudy and the
light is pleasant. It must NOT look like the windy set (no gale, no hats flying, no
umbrellas inside out, no leaning into it).

**CLOUDY (replacements)** — a flat, even, grey overcast. The Tupperware-lid sky.
Shadowless soft light, no sunset colour, no storm cell, no god-rays, no bruised purple,
no wind. Ordinary and a bit dull: a 6/10 day. It must NOT look like the storm set.

### Output
Save each image as PNG with the exact filename given, into
`C:\Users\27741\pw-launch-run\review\new-sets-2026-10-07\<set>\` where `<set>` is
`partly-cloudy`, `breezy` or `cloudy`. Keep a `log.md` in that folder listing every
filename, the model used, and any prompt you had to change (say what and why). Do not
touch `assets/images/bg/`.

---

## PARTLY CLOUDY — 28

### dawn (1 = Monday … 7 = Sunday)

**partly-cloudy/dawn-1.png · Monday · Soweto, Gauteng**
Sunrise over a Soweto street. Broken fair-weather cloud lit pink from below, more than
half the sky blue. A man in a reflective work jacket walks past a spaza shop whose
shutter is half up, long shadows across the tarmac, a cooling tower far off. Monday
morning energy; cloud shadow on the far houses, sun on the near ones.

**partly-cloudy/dawn-2.png · Tuesday · Durban North promenade, KZN**
Just after sunrise on the Durban North promenade. Cumulus over the sea with the sun
coming out from behind a cloud edge, blue sky above. Two joggers mid-stride, a surfer
carrying a board down the steps, a lifeguard tower, wet sand shining. Humid gold light.

**partly-cloudy/dawn-3.png · Wednesday · Free State mealie farm**
Dawn on a Free State farm road between tall mealies. Scattered cumulus with pink
undersides, blue sky between. A farmer leans on a steel gate with an enamel coffee mug,
his bakkie idling behind him, a wind-pump still. Dust hanging low in the light.

**partly-cloudy/dawn-4.png · Thursday · Stellenbosch vineyards, Western Cape**
Early morning in a spring vineyard under the Simonsberg. New green leaves on the vines,
a cloud shadow sliding across the slope while the next row is in full sun. A worker on a
small tractor between the rows. Cumulus building over the mountain, blue above.

**partly-cloudy/dawn-5.png · Friday · Pretoria east, Gauteng**
A Pretoria suburban street carpeted purple with jacaranda blossom in October. A woman in
a dressing gown bends to pick up the morning paper at her gate, a school bus turning at
the corner. Puffy white clouds in a blue sky, the sun low and sharp on the face-brick.

**partly-cloudy/dawn-6.png · Saturday · Sardinia Bay, Gqeberha, Eastern Cape**
Saturday dawn on the dunes at Sardinia Bay. Park-run runners in a loose line along the
beach path, a dog running ahead off-lead, sea mist burning off. Fair-weather cloud over
the sea, blue overhead, long cool shadows on the sand.

**partly-cloudy/dawn-7.png · Sunday · Limpopo village**
Sunday dawn in a Limpopo village. A woman sweeps the swept-earth yard in front of a
brick house, goats at the fence, a baobab beyond the road. Cumulus lit from below,
blue sky, the first smoke of the day rising straight up. Unhurried.

### day

**partly-cloudy/day-1.png · Monday · Cape Town city centre**
Midday on a Cape Town city street. Table Mountain behind with half a tablecloth of
cloud sitting on it, the rest of the sky blue with cumulus. Office workers at a
pavement coffee kiosk, a minibus taxi pulling off, sun on one side of the street and
cloud shadow on the other.

**partly-cloudy/day-2.png · Tuesday · Bloemfontein school cricket, Free State**
A school cricket match on a Bloemfontein oval. Big Free State sky, blue with a procession
of fair-weather cumulus, cloud shadows crossing the outfield. A bowler mid run-up, the
scorer under a bluegum with a scorebook, a few parents on camp chairs.

**partly-cloudy/day-3.png · Wednesday · Durban suburb, KZN**
A Durban suburban street in the afternoon. Vervet monkeys along a garden wall, kids on
bikes in school uniform, banana and strelitzia leaves bright in the sun. Cumulus over
the ridge, humid blue sky, dappled light.

**partly-cloudy/day-4.png · Thursday · Prince Albert, Karoo**
The main road of a Karoo town at noon. Whitewashed Cape Dutch gables, a water furrow
along the pavement, a dog asleep exactly on the line between sun and cloud shadow. Huge
sky, blue with white cumulus, the Swartberg behind.

**partly-cloudy/day-5.png · Friday · Melville, Johannesburg**
Friday afternoon on a Melville pub stoep. A mixed group of friends at an outside table,
beers, sunglasses on and off as the sun goes behind a cloud. Jacarandas over the street,
cumulus drifting over the suburb, warm light.

**partly-cloudy/day-6.png · Saturday · Paarl backyard braai, Western Cape**
Saturday braai in a Paarl backyard. The fire just lit, smoke going straight up, a family
around it, kids standing on a trampoline in the background, a blue pool. Fair-weather
cloud over Paarl Rock, blue sky, sun and cloud-shadow across the lawn.

**partly-cloudy/day-7.png · Sunday · Rustenburg lapa, North West**
Sunday lunch under a thatched lapa in Rustenburg. A potjie on the coals, an extended
family at a long table, a grandmother in the best chair. Cumulus over the Magaliesberg,
blue sky, cloud shadow crossing the lawn beyond the lapa.

### dusk

**partly-cloudy/dusk-1.png · Monday · Sea Point promenade, Cape Town**
Sunset on the Sea Point promenade. Broken cloud glowing orange and pink over the sea,
blue still showing above, Lion's Head catching the last light. Walkers, a woman with a
pram, a man on a bench with a takeaway coffee. Monday, winding down.

**partly-cloudy/dusk-2.png · Tuesday · Polokwane suburb, Limpopo**
Dusk in a Polokwane suburb. A man waters his lawn with a hose, the spray catching gold
light, his dog waiting. Cumulus lit gold on one side, blue sky going pale above,
face-brick house, palisade fence.

**partly-cloudy/dusk-3.png · Wednesday · Nahoon beach, East London, Eastern Cape**
Dusk on the rocks at Nahoon. Two fishermen with long rods, the surf lit pink, cumulus
over the sea in orange and grey, blue overhead. A cooler box on the rocks, wet sand.

**partly-cloudy/dusk-4.png · Thursday · Orange River vineyards, Upington, Northern Cape**
Dusk over the Orange River vineyards at Upington. Sprinklers running down a row, the
river silver behind, red dunes far off. Scattered cloud gone pink against a deep blue sky.
A worker closing a valve at the end of the row.

**partly-cloudy/dusk-5.png · Friday · Hatfield, Pretoria**
Friday dusk on a student balcony in Hatfield. A small braai going, four students
laughing, fairy lights not yet needed. Cumulus over the city lit orange underneath,
blue sky above, the sun just gone.

**partly-cloudy/dusk-6.png · Saturday · Durban Golden Mile, KZN**
Saturday dusk on the Durban beachfront. Families packing up, kids still in the paddling
pools, the pier lights coming on. Cumulus over the sea in pink and grey, blue above,
warm humid air.

**partly-cloudy/dusk-7.png · Sunday · Drakensberg foothills, KZN Midlands**
Sunday dusk on a farm road in the Drakensberg foothills. Cattle coming home along the
fence, a herdsman behind them on foot, the escarpment catching the last light. Broken
cloud gone pink, blue sky fading to pale.

### night

**partly-cloudy/night-1.png · Monday · Johannesburg northern suburbs**
Night in a Johannesburg suburb. A near-full moon behind broken cloud, cloud edges lit
silver, stars in the gaps. A security light on a face-brick wall, a cat on the wall,
an electric fence line. Quiet, Monday.

**partly-cloudy/night-2.png · Tuesday · Cape Town southern suburbs**
Night in Rondebosch. Moonlit cloud drifting past Devil's Peak, gaps of stars. A man
wheels the bin to the gate under a stoep light, oak trees, a parked car.

**partly-cloudy/night-3.png · Wednesday · Bloemfontein**
Night at the edge of Bloemfontein. The moon coming and going behind cloud over a quiet
road, a minibus taxi at a forecourt with its interior light on, a tall mast light,
flat veld behind.

**partly-cloudy/night-4.png · Thursday · Durban balcony, KZN**
A humid night on a Durban flat balcony. Moon over the sea behind broken cloud, the
cloud edges silver, ships' lights on the horizon. A couple leaning on the rail with
cold drinks, a ceiling fan in the room behind.

**partly-cloudy/night-5.png · Friday · Soweto, Gauteng**
Friday night on a Soweto street. The glow of a shisa nyama fire, people standing around
with plates, music implied in the body language. Moon through gaps in the cloud above
the rooftops, a streetlight, a parked car with its boot open.

**partly-cloudy/night-6.png · Saturday · Stellenbosch backyard**
Saturday night braai in a Stellenbosch backyard. Fairy lights in a tree, people laughing
at a long table, the fire down to coals. Moonlit cumulus over the mountains, stars
between.

**partly-cloudy/night-7.png · Sunday · Karoo farmhouse**
Sunday night at a Karoo farmhouse. Moon behind broken cloud, a wind-pump silhouette,
the stoep light on, a dog asleep on the stoep step. Corrugated roof, a water tank,
absolute quiet.

---

## BREEZY — 28

### dawn

**breezy/dawn-1.png · Monday · Muizenberg, Cape Town**
Early morning at Muizenberg beach. The row of coloured beach huts, two surfers checking
the water, their hair and towels moving in a steady breeze. A flag on a pole out at 45°,
small whitecaps, blue sky with a little cloud. Nothing dramatic; it's just up.

**breezy/dawn-2.png · Tuesday · Johannesburg bus stop**
A woman at a Johannesburg bus stop at dawn, her scarf lifting off her shoulder, jacaranda
petals skittering along the kerb past her shoes. Low sun, face-brick wall behind, blue
sky. She is composed; the wind is a detail.

**breezy/dawn-3.png · Wednesday · Free State farm**
A wind-pump turning steadily at dawn on a Free State farm, long grass rippling in waves
across the camp, a farm dog trotting with its ears back. Clear sky going gold, a
corrugated shed.

**breezy/dawn-4.png · Thursday · Durban beachfront, KZN**
Sunrise on the Durban beachfront. Palms swaying gently, a jogger holding her cap on
with one hand mid-stride, a beach umbrella already up and fluttering at the edges. Small
whitecaps, humid gold light, clear sky.

**breezy/dawn-5.png · Friday · Gqeberha suburb, Eastern Cape**
Dawn in a Gqeberha suburb. A full washing line already out and swinging gently, a boy
at the gate in school uniform with his tie over his shoulder, a palm moving behind the
wall. Clear blue sky, cool light.

**breezy/dawn-6.png · Saturday · Karoo dirt road**
A Saturday morning cyclist on a Karoo dirt road, jersey rippling, a thin dust devil
spinning on the road ahead of him, grass seed-heads bending. Clear sky, low sun, a
windmill far off.

**breezy/dawn-7.png · Sunday · Cape Winelands village**
Sunday morning in a Winelands village. A woman walking to the bakery with her dress and
hair moving, pine trees swaying along the road, a few petals on the move. Clear sky,
soft early light, white gables.

### day

**breezy/day-1.png · Monday · Cape Town school break**
Monday break-time in a Cape Town schoolyard. Kids with hair in their faces, a teacher
holding a stack of papers flat against her chest, leaves skittering across the paving.
Table Mountain behind, clear sky, bright.

**breezy/day-2.png · Tuesday · Durban fruit stall, KZN**
A fruit seller at her pavement stall in Durban, the cloth awning fluttering steadily,
her headscarf moving, pineapples and litchis stacked. Sun, blue sky, a palm swaying
behind her. She's laughing with a customer.

**breezy/day-3.png · Wednesday · Zoo Lake, Johannesburg**
A kite up high over Zoo Lake, a family on the grass looking up, the dog's ears flapping,
the willows along the water moving. Blue sky with a few small clouds, afternoon light.

**breezy/day-4.png · Thursday · Bloemfontein rugby practice**
School rugby practice in Bloemfontein. The corner flags standing straight out, grass
rippling across the field, boys in a line drill with jerseys fluttering. Big clear
Free State sky.

**breezy/day-5.png · Friday · Gqeberha backyard**
A Gqeberha backyard full of washing lines, sheets and school shirts swinging together in
a steady breeze, a boy on a bike towing a plastic-bag kite behind him. Blue sky, sun,
corrugated roofs.

**breezy/day-6.png · Saturday · Paarl braai**
Saturday braai in Paarl. Braai smoke blowing flat sideways across the yard, a man
shielding the fire with a lid, a tablecloth lifting at one corner, ripples across the
pool. Everyone relaxed. Blue sky, a little cloud.

**breezy/day-7.png · Sunday · Langebaan lagoon, West Coast**
Sunday picnic at Langebaan. A blanket with its corners pinned down by shoes, a family
eating, windsurfers skimming the lagoon in the distance, small whitecaps. Clear sky,
white houses along the shore.

### dusk

**breezy/dusk-1.png · Monday · Blouberg, Cape Town**
Dusk on a Blouberg restaurant deck. Table Mountain across the bay in gold light, flags
on the railing standing out stiff, a woman's hair moving as she holds a glass of wine.
Small whitecaps, clear sky.

**breezy/dusk-2.png · Tuesday · Soweto street**
Dusk on a Soweto street. Kids playing soccer, shirts fluttering, dust lifting gold in
the low light, a tyre swing moving on its rope. Clear sky, a streetlight just on.

**breezy/dusk-3.png · Wednesday · KZN Midlands**
Long grass bending in waves across a Midlands hill at dusk, cattle grazing, the last
light raking across. A farm gate, a line of gums swaying. Clear sky.

**breezy/dusk-4.png · Thursday · Pretoria stoep**
Dusk on a Pretoria stoep. Jacaranda blossoms streaming across the street in the breeze,
a woman holding her coffee watching them, a wind chime moving. Face-brick, clear sky
going pink.

**breezy/dusk-5.png · Friday · Durban North balcony**
Sundowners on a Durban North balcony. A woman's sarong lifting, palms moving against a
pink sky, small whitecaps on the sea below. Friday ease, a cold drink, a cat on the
rail.

**breezy/dusk-6.png · Saturday · Karoo farmhouse braai**
A Saturday braai at a Karoo farmhouse at dusk. Smoke going horizontal, the washing left
out still swinging on the line, a girl's hair across her face as she laughs. Clear sky,
gold light, a wind-pump turning.

**breezy/dusk-7.png · Sunday · Gqeberha harbour**
Sunday evening at the small-boat harbour in Gqeberha. Flags on the masts fluttering, a
man packing a bakkie, rigging lines moving. Clear sky, soft pink light.

### night

**breezy/night-1.png · Monday · Johannesburg**
Night in a Johannesburg suburb. A security light on a wall with leaves blowing through
its beam, a palm moving above, moths. Face-brick, electric fence, clear starry sky.

**breezy/night-2.png · Tuesday · Cape Town**
Washing forgotten on the line at night in a Cape Town backyard, swinging gently in the
glow of a kitchen window. A tree moving, stars, a cat on the step.

**breezy/night-3.png · Wednesday · Durban beachfront**
A warm night on the Durban beachfront. Palms moving under the streetlights, a couple
walking with their clothes rippling, the sea breaking white in the dark. Clear sky.

**breezy/night-4.png · Thursday · Free State farm**
A wind-pump turning in moonlight on a Free State farm, grass rippling silver, the farm
lights far off, a dog at the fence. Clear sky, stars.

**breezy/night-5.png · Friday · Soweto shisa nyama**
Friday night at a Soweto shisa nyama. Smoke blowing sideways under the lights, people
in jackets with the breeze moving their collars, plates of meat, music implied.
Streetlight, parked cars, clear sky.

**breezy/night-6.png · Saturday · Stellenbosch garden party**
Saturday night in a Stellenbosch garden. Fairy lights swinging slightly in the trees, a
tablecloth clipped to the table, people laughing, a woman's hair moving. Clear sky.

**breezy/night-7.png · Sunday · Paternoster, West Coast**
Sunday night in Paternoster. White fishermen's cottages, one streetlight, a thin ribbon
of sand blowing across the road, a dog crossing. Clear sky, stars, the sea beyond.

---

## CLOUDY — 13 replacements (exact slot in the filename)

These replace the storm-and-sunset frames. Flat grey, shadowless, ordinary.

**cloudy/dawn-1.png · Monday · Johannesburg taxi rank**
Monday dawn at a Johannesburg taxi rank under a flat grey sky. A man with a paper cup of
coffee waiting in the queue, a minibus loading, dry tarmac. No shadows, soft even light.

**cloudy/dawn-3.png · Wednesday · Durban beach**
Grey dawn at a Durban beach. A lone swimmer in a cap walking into a flat grey sea, the
sky one even sheet of cloud, wet sand without a shadow on it.

**cloudy/dawn-4.png · Thursday · Bloemfontein suburb**
A Bloemfontein suburban street at dawn under a grey lid of cloud. A woman walking a
dog, every roof the same flat grey, a hadeda on a lawn. Even, shadowless light.

**cloudy/dawn-5.png · Friday · Cape Town**
A Cape Town morning with Table Mountain fully capped in grey, the whole sky overcast.
A cyclist waiting at a traffic light, a bakery delivery van, flat light.

**cloudy/day-1.png · Monday · Pretoria office park**
An office-park car park in Pretoria at midday under an even grey sky. A man with a
laptop bag walking between the cars, a security boom, aloes along the kerb. No shadows.

**cloudy/day-2.png · Tuesday · Gqeberha suburb**
A woman washing her car in a Gqeberha driveway under flat grey cloud, a bucket and a
hose, the neighbour's palisade fence. Soft shadowless light.

**cloudy/day-3-weekB.png · Wednesday · Karoo sheep farm**
A Karoo sheep farm under an even grey sky. Sheep at a water trough, a farmer in a jacket
on the back of a bakkie counting them, flat veld, a wind-pump. No rays, no drama.

**cloudy/day-4.png · Thursday · Pietermaritzburg school**
A school cricket oval in Pietermaritzburg under grey cloud, a scorer under the
grandstand looking bored, players in whites, the hills behind lost in grey. Flat light.

**cloudy/day-5.png · Friday · Soweto school gate**
Friday afternoon at a Soweto school gate under an overcast sky. Kids coming out in
jerseys, a spaza shop opposite, a taxi waiting, no shadows anywhere.

**cloudy/dusk-1.png · Monday · Sea Point, Cape Town**
Grey dusk at Sea Point. An ash-grey sky with no colour in it, the promenade lights
coming on, a man walking a dog, the sea flat and pewter.

**cloudy/dusk-3.png · Wednesday · Johannesburg**
Grey dusk in a Johannesburg suburb. A man closing his driveway gate, the security light
just on, a flat grey sky over the rooftops, a jacaranda in leaf.

**cloudy/dusk-4.png · Thursday · Durban promenade**
Grey dusk on the Durban promenade. A woman walking a dog, the sea a flat grey sheet
under a flat grey sky, the pier lights on, humid still air.

**cloudy/dusk-7.png · Sunday · Free State farm**
Sunday dusk on a Free State farm under an even grey sky. Cattle in the kraal, a farmer
closing the gate, a corrugated shed, bare light bulb on the shed wall just on.
