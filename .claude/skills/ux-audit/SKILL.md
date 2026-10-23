---
name: ux-audit
description: Run the periodic UX/UI audit of the «گام» app — touch-target size, text contrast, spacing consistency, type hierarchy and phone-size compatibility on the onboarding wizard, Home, Plan and Profile — and report a prioritized list of proposals with before/after comparisons for the owner to approve. Use when the user asks for a UX review, UI audit, accessibility check, «بازبینی UX» or similar. Never changes the app itself.
---

# UX/UI audit for «گام»

This is a **report-only** process. Do not edit `css/`, `js/`, `index.html` or anything that ships, and do not commit or push app changes. The owner picks which proposals to implement; implementation is a separate, later request that follows the repo's normal approve-then-commit rule.

Talk to the owner in Persian.

## 1. Run the measurements

```bash
cd tools/ux-audit
npm install          # first time only (installs Playwright; the app itself has no dependencies)
node audit.js        # all screens × widths 320/360/390/430 × fa/en, ~2 minutes
```

In the Claude Code cloud container Chromium lives at `/opt/pw-browsers/chromium` (picked up automatically); elsewhere set `CHROMIUM_PATH` or run `npx playwright install chromium`.

Useful flags: `--widths 360`, `--langs fa`, `--screens home,plan-week`, `--no-shots`, `--css proposal.css --out out/try` (inject a proposal's CSS before measuring, to show its effect in numbers without touching the app).

Outputs (git-ignored) in `tools/ux-audit/out/`:
- `report.md` — findings grouped by rule + element, sorted high → low, with screens/widths where they occur, plus the font-size and spacing inventories.
- `report.json` — the same data, machine-readable (compare with a previous run to show regressions/improvements).
- `shots/<screen>-<lang>-<width>.jpg` — full-page screenshots with offending elements outlined (magenta = touch < 24px, orange = touch < 44px, purple = contrast, blue = small font, red = layout).

Screens audited (defined in `lib.js`, edit there if new main pages appear): `onb-1`…`onb-5` (wizard, opened in edit mode so every step is reachable), `home`, `plan-week`, `plan-month`, `plan-doneform` (the form that opens after «انجامش دادم»), `profile`, `profile-cycle`, `progress`, `checkin`, `settings`, `fitness`, `learn`, `learn-article`, `guide`. Data comes from the deterministic fixture in `fixture.js` and a fixed date, so runs are comparable over time.

## 2. What the rules mean (and their thresholds)

| Rule | Check | Severity |
|---|---|---|
| `touch-min` | interactive target smaller than 24×24 px and not spaced 24 px from neighbours (WCAG 2.5.8 AA). Inline links inside sentences are exempt. | high |
| `touch-rec` | smaller than 44×44 px (Apple HIG / WCAG 2.5.5 AAA; Material uses 48) | medium if < 32, else low |
| `contrast` | text (including the typed value and placeholder of text, number, date and time fields) vs. its real composited background below 4.5:1 (3:1 for ≥ 24 px or ≥ 18.7 px bold), WCAG 1.4.3. Faded/decorative text (aria-hidden, opacity < 0.6, picker neighbours) is "info". Gradients are approximate. | high if < 3, else medium |
| `font-small` | text under 12 px | medium |
| `line-height` | multi-line body text with line-height < 1.35 | low |
| `heading-*` | skipped heading levels, h1 not larger than h2, several h1 | low/medium |
| `spacing-grid` | margin/padding/gap values that are not even numbers (usually `em`-based leftovers like 11.1 px) | low |
| `layout-hscroll` | page wider than the phone (sideways scrolling) | high |
| `layout-overflow` | element sticking out of its container (the usual cause of hscroll) | high if > 8 px |
| `layout-under-tabbar` | last content hidden under the bottom tab bar | high |
| `layout-clipped` | text cut off by `overflow: hidden` | medium |
| `justify-missing` | multi-line paragraph not justified. The owner wants all long text justified in both languages; deliberate exceptions (meta lines with badges, rows of links, centred text, very narrow columns) are listed in `css/style.css` and stay in the report as expected | medium |
| `justify-gap` | a justified line with a gap between two words over 4× a normal space and over 16 px; "(پیش‌بینی)" marks the gap a not-yet-justified paragraph would get. Headless Chromium on Linux has no hyphenation, so English gaps are overstated | medium if justified now, else low |

The automated pass cannot judge everything. **Always also look at the annotated screenshots yourself** (at least fa 320 and fa 390, plus en 360) for:
- visual hierarchy (is the primary action obvious? is sand used only for the main action and active states?),
- awkward wrapping (an icon alone on a line, labels breaking mid-phrase),
- justified text creating large gaps in narrow boxes (the `justify-gap` rule finds candidates; confirm on the screenshot),
- copy that no longer matches the UI (e.g. hints pointing to moved settings),
- consistency between similar components on different pages.

## 3. Verify before reporting

Every finding must be real. For each high/medium group, open the screenshot or reproduce in Playwright and confirm it. Known false-positive sources: intentional negative margins, elements hidden in collapsed sections, deliberately faded decorative text. Drop or downgrade anything that is not a real problem, and fix the probe in `audit.js` if a false positive is systematic.

## 4. Build the before/after comparisons

For each proposal, write an entry in a proposals file (see `tools/ux-audit/proposals.json` for the format and the first audit's examples) with the CSS (and optional JS) that would implement it, then:

```bash
node compare.js proposals.json      # → out/compare/<id>-before.png and <id>-after.png
```

The CSS is only injected into the test browser; nothing in the app changes. Look at every pair — if the "after" does not clearly show the improvement, adjust the CSS or the crop.

When proposing colours, use only the tokens in `css/theme.css` (Gaam, dark-only): `--bg` background, `--surface` cards, `--surface-elevated` inputs/modals/sheets, `--border` dividers and secondary-button borders, `--primary` (sand) for the primary action, active and selected states with `--on-primary` text, `--success/--warning/--error/--info` for status, `--zone-1`…`--zone-5` for training zones. Never add a literal colour outside `css/theme.css`. Check ratios numerically before proposing them.

## 5. Report

Publish the report as a page (an Artifact, private by default) and give the owner the link. Structure:

1. Short summary: date, what was audited, counts by priority, top three problems in one line each.
2. The prioritized list, most important first. Order by real user impact: broken layout / unusable controls → unreadable text on key actions → small targets → readability of secondary text → consistency/polish. Each item has:
   - an ID (`UX-01`, …) so the owner can approve by ID,
   - priority (بالا / متوسط / پایین),
   - where (screens, phone widths, languages),
   - **problem** — what is wrong and why it matters to a runner using the app, with the measured value vs. the standard,
   - **proposal** — the concrete change (colour values, sizes, layout),
   - **current vs. proposed** — the two comparison images side by side,
   - effort estimate (کوچک / متوسط / بزرگ) and anything it could affect.
3. System-level notes (type scale, spacing scale) with the inventories from `report.md`.
4. A closing line asking which IDs to implement.

In the chat reply, give a compact Persian list (ID, one-line problem, priority) and the link, then stop and wait. Do not implement anything until the owner names the IDs.

## 6. Re-runs

On later runs, compare `out/report.json` with the previous report (keep a copy, e.g. `out/report-<date>.json`) and state what was fixed, what is new, and what remains. If the app gained a new main page, add it to `SCREENS` in `lib.js` first.
