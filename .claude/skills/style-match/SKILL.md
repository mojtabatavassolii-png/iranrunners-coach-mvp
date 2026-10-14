---
name: style-match
description: Analyse screenshots of another app or website (e.g. Runna, Nike Run Club, Strava) the owner sends — colour palette, spacing, typography, button and icon style, overall mood — and propose how to bring that visual feel into «مربی خودت باش» while keeping its own brand identity. Use when the user shares reference screenshots and asks for style analysis, «سبک بصری», «حس و حال طراحی» or "make it feel like X". Proposal only; never changes the app.
---

# Style analysis from reference screenshots

The owner sends one or more screenshots of another product and wants to know how to get a similar *feel* without becoming a copy. This is **analysis and proposal only**: do not edit the app, do not commit. Reply in Persian.

## Non-negotiables (brand identity)

- Mint `#00866b` (and its family `--brand-*`) stays the identity / navigation colour; coral `#ff6b57` (`--accent-*`) stays the primary-action colour. The owner explicitly chose to keep this palette. You may tune shades, add neutrals, or add a secondary accent, but never replace mint or coral.
- The logo, the app name «مربی خودت باش», the bilingual RTL/LTR support and Persian digits stay.
- Do not copy another brand's logo, icons, illustrations, wording or proprietary fonts. Borrow *principles* (density, rhythm, contrast, shape language), not assets.
- Every proposed colour combination must still pass WCAG AA contrast (4.5:1 body text, 3:1 large text / UI parts). Check numerically.

## 1. Look at the screenshots carefully

Read each image yourself first. Note which screen it is (home, plan, workout detail, onboarding, stats…) so you compare like with like.

Then extract the palette numerically (anti-aliased text blends into backgrounds, so treat the numbers as a guide and confirm against what you see):

```bash
mkdir -p "$SCRATCH/ref" && cp <screenshots> "$SCRATCH/ref/"   # keep downloaded/received images in their own folder
python3 -I tools/ux-audit/palette.py "$SCRATCH/ref/"*.png --k 10
```

It prints the dominant colours with their share, luminance, contrast with white/black and the nearest current app token.

## 2. Analyse along these dimensions

For each, describe the reference, then the current app, then the gap:

1. **Colour** — background (pure white, off-white, dark?), surface vs. background contrast, how many accent colours, how saturated, where accents are used (only CTAs? data? headers?), dark mode.
2. **Spacing & density** — outer margins, gap between cards, inner padding; airy vs. dense; estimate in px using a known element (body text ≈ 16 px, iOS tab bar ≈ 49 pt + safe area) as the ruler.
3. **Typography** — classic or geometric sans, weights used, size contrast between headline numbers and labels (sports apps often use very large bold numerals with small uppercase labels), letter-spacing, number style (tabular?). For Persian text, map to a suitable Persian-capable font (e.g. Vazirmatn, IRANSansX) — suggest, do not add web fonts without approval since the app works offline.
4. **Shape language** — corner radii (cards, buttons, chips), borders vs. shadows, pill vs. rounded-rect buttons, card elevation.
5. **Buttons & controls** — primary/secondary/tertiary styles, height, full-width or not, icon + label, tab bar style (labels? filled icons for active?).
6. **Icons & imagery** — outline vs. filled, stroke width, rounded/sharp terminals, use of photos/illustrations/gradients.
7. **Data display** — how stats, charts, progress and workouts are visualised.
8. **Mood** — 3–5 adjectives (e.g. energetic, premium, calm, playful, technical) and what creates each.

## 3. Translate into proposals for this app

Map each borrowed principle onto the app's existing design tokens in `css/style.css` (`:root` variables: `--brand*`, `--accent*`, `--bg`, `--card`, `--panel`, `--muted`, `--faint`, `--radius`, `--shadow`, and the session colours `--c-*`). Prefer changing tokens over one-off rules. Group proposals as:

- **Quick wins** (token tweaks: radius, shadow, background tint, font weights),
- **Component updates** (buttons, cards, tab bar, stat tiles),
- **Larger moves** (new font, dark theme, new illustration style) with their cost (offline caching, bundle size, effort).

For each proposal give: what to change (exact values), why it produces the reference's feel, and how it preserves the brand.

## 4. Show it

Make it concrete with real before/after renders of *this* app, not mock-ups:

```bash
cd tools/ux-audit
# write a proposals file with a "css" override per idea (format in compare.js / proposals.json)
node compare.js my-style-proposals.json --out out/style
```

A whole-theme preview works too: one proposal whose `css` overrides the `:root` tokens and a `crop` of `#app` (set `maxHeight`) on `home` and `plan-week`.

Publish a page (private Artifact) with: the reference screenshots' analysis per dimension, a side-by-side palette (reference vs. current vs. proposed, with contrast numbers), and the before/after images for each proposal, each with an ID (`ST-01`, …). In chat give a short Persian summary and the link, and ask which IDs to apply. Do not implement until the owner chooses.
