# DESIGN.md

> **Frontend-design skill compatible, Stitch-inspired.** PW's distinctive voice takes precedence over any generic best-practice. Anti-slop is the primary directive. This document captures the shipped design system so future work stays inside the brand, not so the brand bends to a template.

---

## 1. Brand

**Probably Weather** — a South African PWA that turns the country's "Ja-Nee-Miskien" (Yes-No-Maybe) weather into an honest, warm, slightly dry forecast.

- **Tagline:** *"No more Ja-No-Maybe weather. Just Probably."*
- **Voice:** Warm, self-aware, never gritty. Confident in spite of uncertainty. Speaks 5 SA languages with equal weight (English, Afrikaans, isiZulu, isiXhosa, Sesotho).
- **Personality cue:** The yellow "Probably" — a sun-yellow accent that says hello before the temperature does.
- **Visual register:** Photo-heavy, scrim-darkened, type sits on real SA locations. The image carries the mood; type stays out of its way.

The brand's superpower is the SA cultural texture (hadeda, fynbos, Cape Dutch architecture, Helderberg light, braai weekends). Strip that and PW becomes another weather app.

---

## 2. Anti-slop guardrails (explicit, non-negotiable)

If a change would introduce any of these, stop and rethink:

- **No generic purple-blue gradients.** PW's accent gradient is `#FFDD44 → #FFAA00` (sun gold). Cool gradients only appear as weather-state tints (cold/storm/rain), never as decorative furniture.
- **No Inter, no Roboto-as-default-shrug.** The shipped stack is `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Use the system stack. If a custom face is ever introduced, it must be deliberate, named, and braai-warm (not "AI-startup geometric").
- **No three-icon-card AI-dashboard layouts.** PW is a single hero per screen: temperature, condition, headline. Resist the "feature card grid" reflex.
- **No chatbot UI.** No assistant bubble, no "Ask Probably anything", no LLM-on-rails veneer.
- **No emoji-only buttons** as primary actions. Emoji + label is fine (`📍 Use my location`); emoji-only is a regression.
- **No "AI" in user-facing copy.** PW combines four real forecast sources. The word for that is *forecast*, not "AI prediction".
- **No gritty/dystopian imagery.** No load-shedding jokes, no poverty aesthetic, no graffiti scrim, no horror tone. Authentic SA = beautiful SA.
- **No skeuomorphic weather chrome.** No fake glass orbs, no 3D bezelled buttons, no analog-thermometer kitsch.
- **No "Loading…" purgatory without copy personality.** Use lines like *"Fetching probable weather…"* — the loader is voice-bearing.

If you catch yourself reaching for one of the above, the answer is almost always "lean harder on the photograph and the typography we already have."

---

## 3. Typography

### Stack

```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

System stack is intentional: PW reads native on each device, which makes it feel like a local utility, not a launched-yesterday startup.

### Scale (as shipped, do not "tidy")

| Token | Size | Weight | Use |
|---|---|---|---|
| `--type-hero` | 4rem (`.temp`) | 800 | The "29°" — sun-gold, glowing |
| `--type-headline` | 2.2rem (`.headline`) | 800 | The witty line ("Stuur die rooiwyn") |
| `--type-condition` | 1.8rem (`.description`) | 600 | "Dit reën" — orange-tinted |
| `--type-hilo` | 1.5rem (`.temp-hilo`) | 700 | "H 28° L 14°" — tabular nums |
| `--type-tagline` | 1.2rem (`.tagline`) | 700 | "No more Ja-No-Maybe…" |
| `--type-screen-title` | clamp(28px, 3vw, 44px) | 700 | Hourly / Week / Search / Settings |
| `--type-body` | 0.95–1rem | 400–600 | Default reading size |
| `--type-byline` | 0.95rem | 400 | Wind • Rain • UV row |
| `--type-meta` | 0.85rem | 400 | Footers, hints, version |
| `--type-eyebrow` | 0.75rem, +0.5px tracking, uppercase | 700 | Section eyebrows |

### Rules

- **Tabular numerals** on all temperatures, percentages, and times (`font-variant-numeric: tabular-nums`).
- **Tracking:** body 0; uppercase eyebrows +0.5px; tagline +0.5px. Never letter-space body copy.
- **Line-height:** 1.1 on hero temp; 1.25–1.35 on body; 1.4 on dense source-detail.
- **Weight contrast** does the work, not size alone. PW's voice is bold-confident — 800 on the hero, 600+ on body, never below 400.
- **Text shadows** are part of the brand, because type sits on photographs. Keep the existing pattern: a tight `rgba(0,0,0,0.9)` drop plus an optional coloured glow that matches the element (gold glow on temp, red on hi, blue on lo). Do not flatten these without replacing them with a stronger scrim.

---

## 4. Colour

### Brand

| Token | Hex | Role |
|---|---|---|
| `--brand-sun` | `#FFDD44` | The "Probably" yellow. Primary accent. |
| `--brand-sun-deep` | `#FFAA00` | Gradient end-stop, hover state. |
| `--brand-ink` | `#1a1a2e` | Sits on yellow (install button, "Use my location"). |
| `--brand-amber` | `#F5A623` | Email link, secondary warm accent. |
| `--brand-cream` | `#FFF8F0` | Default body text on photo backgrounds. |

The gradient `linear-gradient(135deg, #FFDD44, #FFAA00)` is reserved for **primary CTAs** (install, share, save-current) and the logo sun. Do not use it as decorative chrome.

### Weather-state text tints

PW shifts the body text colour to match the weather mood — this is one of its signature moves. Keep it.

| Body class | Body text | Card label |
|---|---|---|
| `.weather-clear` | `#FFFDE7` | `#FFF59D` |
| `.weather-heat` | `#FFEFD5` | `#FFDAB9` |
| `.weather-cold` | `#E0F7FA` | `#B3E5FC` |
| `.weather-rain` | `#BBDEFB` | `#90CAF9` |
| `.weather-storm` | `#E8EAF6` | `#C5CAE9` |
| `.weather-wind` | `#F0F4F8` | `#E3E9ED` |
| `.weather-fog` | `#CFD8DC` | `#B0BEC5` |

Screen titles also tint per state (gold on clear, orange on heat, sky-blue on cold, sapphire on rain, lavender on storm). These tints are subtle but they are the bones of PW's "this app knows what the sky is doing" feel.

### Neutrals (all over photographic backgrounds)

- **Glass panel:** `rgba(255,255,255,0.08–0.12)` with `backdrop-filter: blur(16px) saturate(120%)`.
- **Dark panel:** `rgba(0,0,0,0.5)` (the `--panel-bg` token). Used for screen panels and the nav.
- **Border:** `rgba(255,255,255,0.15–0.25)` — always low-opacity white, never a hard line.
- **Hi / Lo:** `#ff6b6b` (hi) and `#5ddfff` (lo). These are the only "hot" pinks/cyans in the system.

### Don't introduce

- No teal/mint accents. No purple/violet brand colour. No neon green confirmations.
- No solid white surfaces. The app lives on photographs; surfaces are always translucent glass.

---

## 5. Background system (the photographic spine)

PW backgrounds are the product. Treat them as first-class assets, not decoration.

### Folder structure

```
assets/images/bg/[condition]/[filename].jpg
```

Conditions: `clear`, `cloudy`, `rain`, `wind`, `storm`, `cold`, `hot`, plus aliases `uv → clear` and `rain-possible → cloudy`.

### Time slots (filename suffix)

| Slot | Window |
|---|---|
| `dawn` | 05:00–08:00 |
| `day`  | 08:00–17:00 |
| `dusk` | 17:00–20:00 |
| `night`| 20:00–05:00 |

### 14-day rotation (target)

- `day_1.jpg` … `day_10.jpg` — weekdays (Mon–Fri × 2-week cycle)
- `day_11.jpg`, `day_12.jpg` — Saturday
- `day_13.jpg`, `day_14.jpg` — Sunday
- `dawn_1..3`, `dusk_1..3`, `night_1..3`
- `day.jpg` — fallback only, never primary

The rotation prevents the "I've seen this background before" tax.

### Image rules

- 1920×1080, JPG, high quality, optimised.
- Subject in lower two-thirds; sky/headroom for type in the upper third.
- Authentic SA: Cape Town, Karoo, Drakensberg, Garden Route, Helderberg, Lowveld. Hadeda > generic seagull. Cape Dutch > generic suburb. Fynbos > generic flower.
- Braai content only on Saturday/Sunday filenames (`day_11`–`day_14`).
- Positive vibes only — no rubble, no dystopia, no AI-melt artefacts (six-fingered hands, melted railings, plastic skin).

### Scrim

A single `#scrim` element sits between `#bgImg` and the content. Keep it. It guarantees text contrast across every photo without per-image work.

---

## 6. Spacing, radii, motion

### Spacing rhythm

Container padding is `max(2rem, env(safe-area-inset-*))`. Vertical rhythm uses `0.25rem / 0.5rem / 0.75rem / 1rem / 1.5rem / 2rem` — an informal 4/8/12/16/24/32 scale. Hero sections use `clamp()` to breathe between phone and desktop. Don't tighten everything to a rigid 8-pt grid; the warmth comes from a slightly loose rhythm.

### Radii (the shipped scale)

| Token | Value | Use |
|---|---|---|
| `--radius-pill` | 999px | Pills: language picker, save, share, "Use my location" |
| `--radius-card` | 16px | Cards, screen panels, language menu, install banner |
| `--radius-control` | 12px | Inputs, list rows, language options, hourly/daily cards |
| `--radius-chip` | 10px | Install banner CTA, small chips |
| `--radius-tiny` | 4px | Focus outlines, precip bars, tight indicators |
| `--radius-circle` | 50% | Logo, dots, avatars |

Use the pill for any "this is a touch target" CTA. Use the card 16px for any surface that holds content. Don't invent a new radius — pick the closest one.

### Motion principles — "subtle, not show-off"

- **Default duration:** 0.2s for hover/press, 0.3s for state shifts, 0.32s for the install banner slide.
- **Default easing:** `ease` for most, `cubic-bezier(0.2, 0.8, 0.2, 1)` for the install banner slide (the one "considered" motion in the app).
- **Press feedback:** `transform: scale(0.97–0.98)` on `:active`. Hover `scale(1.02)` on pills. Never bigger.
- **Reduced motion:** the `prefers-reduced-motion` block already collapses animations to 0.01ms and hides `#particles`. Anything new must respect this — no exceptions.
- **No bounce, no spring, no parallax.** Motion is utility, not personality. The personality is in the words and the photograph.

---

## 7. Voice principles

### Tone

- Warm, dry, slightly amused at the sky.
- Self-aware about uncertainty — that's the whole product. "Probably" is honest.
- Never punching down. Never cynical. Never load-shedding-joke energy.

### SA references

- **Braai content** — Saturday and Sunday only, both in copy and imagery.
- **Welcome:** hadeda, fynbos, Cape Dutch, Helderberg, the Karoo wind, the berg, the bushveld, hadedas at 5am, southeaster, the Cape Doctor.
- **Avoid:** dated political jokes, Eskom punchlines (removed deliberately), brand-name SA references (no Checkers, no Pick n Pay).

### 5-language parity

Every user-facing string must exist in all five languages or it doesn't ship. The translations object in `assets/app.js` is the source of truth. If a string is English-only, that is a bug.

### Specifically for headlines (the witty line under the temperature)

- One short sentence. Often imperative ("Stuur die rooiwyn").
- Implies behaviour, not weather (the temperature already showed the weather).
- Lands the joke in the user's language. A direct translation usually flops; rewrite per language.

---

## 8. Component patterns

These are the recurring shapes in the app. Future components should adapt one of these, not invent a sixth.

### 8.1 Hero card (Home)

- Full-bleed photographic background with scrim.
- Left-aligned stack: brand → location → tagline → temp → hi/lo → condition → witty headline.
- Sidebar (desktop) or stacked (mobile): wind / rain / UV byline + sources card.
- No surface — the photo *is* the surface.

### 8.2 Screen panel (Hourly / Week / Search / Settings / Day-detail)

- Fixed position, insets via `--panel-top / --panel-side / --panel-bottom` tokens.
- Translucent dark glass (`var(--panel-bg)` + backdrop blur).
- `border-radius: 16px`, max-height 70vh, internal scroll.
- Header → body → optional footer, separated by 12–16px gaps.
- The screen title is centred, weight 700, and tints to weather state.

### 8.3 Pill button (CTAs and chrome buttons)

- `border-radius: 999px`, min 44×44px tap target.
- Glass variant: `rgba(0,0,0,0.5)` background, `rgba(255,255,255,0.25)` border, blurred backdrop.
- Solid variant (primary CTA): `linear-gradient(135deg, #FFDD44, #FFAA00)`, `color: #1a1a2e`, ink-on-gold.
- Hover: `scale(1.02)` + slightly lighter background. Active: `scale(0.97–0.98)`.

### 8.4 Language picker

- Pill button in the top-right of the home header (`Language`).
- Opens a glass menu (`border-radius: 16px`, `backdrop-filter: blur(14px)`).
- Each option is a 12px-radius button, left-aligned, with `aria-selected` highlight.
- Hidden on non-home screens (settings holds the persistent language selector).

### 8.5 Share pill

- Mobile-only fixed pill at bottom-left, above the nav.
- Glass background, white text, 20px radius, no gradient — it sits next to the gold CTAs and should not compete with them.
- Hidden when an install modal is active.

### 8.6 Settings rows

- Section title (`h3`, eyebrow case is fine here at body weight) → label + select pair.
- Inputs/selects use the 12px control radius and inherit the glass surface treatment.
- Email link is `--brand-amber`; footer copy is reduced opacity, never lower than 0.5.

### 8.7 Loader, toast, banner

- Single live region per role (`role="status"`, `aria-live="polite"`).
- Loader copy is voice-bearing — *"Fetching probable weather…"* — not "Loading".
- Install banner slides up over the nav with the cubic-bezier easing above and dismisses with `opacity` + `translateY`.

---

## 9. What this document is NOT

- It is not a redesign brief. The shipped UI is the spec; this codifies it.
- It is not a license to mass-token-replace existing values. Renaming `#FFDD44` to `var(--brand-sun)` is a separate, deliberate refactor — not part of the audit polish.
- It is not above the brand. If a "best practice" from the frontend-design skill clashes with the SA voice or the photographic spine, the brand wins.

If a future change wants to violate any rule above, that's a conversation, not a commit.
