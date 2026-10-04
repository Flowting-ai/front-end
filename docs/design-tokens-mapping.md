# Design tokens — proposed mapping for every hard-coded colour

Companion to [design-tokens-audit.md](design-tokens-audit.md) (generated 2026-10-02). **This is a proposal — no source files were changed.** Each distinct hard-coded colour found in `src` is mapped to the closest primitive in `src/styles/tokens/primitives.css`.

## How the mapping works

- **Solid colours** go to the nearest solid primitive using CIE76 ΔE in Lab space (a perceptual distance: ≈1 is invisible, ≈2–3 is barely noticeable, >8 is a clear difference).
- **Translucent colours** (`rgba`, 8-digit hex) first look for an existing opacity primitive (e.g. `--neutral-700-12`) with the same RGB and an alpha within 0.015; otherwise they become `color-mix(in srgb, var(--base) N%, transparent)` on the nearest solid.
- **Confidence:** `exact` identical value · `close` ΔE ≤ 3 (safe to swap) · `near` ΔE ≤ 8 (small visible shift in light mode) · `review` ΔE > 8 or unparsed (needs a design call) · `decide` white / black (depends on whether it is a surface or fixed text) · `keep` shadows, white highlights and brand / illustration art.
- **Dark theme:** a swap makes the colour follow the dark theme. The `Dark` column shows what the target becomes there — check it is sensible for that use (e.g. a light-grey *background* becoming a dark surface is right; a light-grey *text* on a pinned-white card is not).

## Summary

| Confidence | Distinct values | Uses | Share of uses |
|---|---:|---:|---:|
| exact | 31 | 172 | 16.8% |
| close | 14 | 77 | 7.5% |
| near | 16 | 22 | 2.1% |
| decide | 1 | 12 | 1.2% |
| keep | 212 | 742 | 72.4% |
| **total** | **274** | **1025** | |

**249 of 1025 uses (24%) are `exact` or `close`** — safe to swap automatically (light mode unchanged to the eye).

## Mapping

| # | Value | Uses | Files | Proposed token | Confidence | ΔE | Dark value of target | Note |
|---:|---|---:|---:|---|---|---:|---|---|
| 1 | `rgba(82, 75, 71, 0.12)` | 151 | 87 | keep | keep |  |  | 111 of 151 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-700-12) (exact). |
| 2 | `#F5F5F5` | 45 | 22 | `var(--neutral-100)` | close | 2.1 | `#26211E` | light colour shifts #F5F5F5 → #F5F2EF (25 of 45 uses are inside a shadow — leave those pinned.) |
| 3 | `rgba(59, 54, 50, 0.05)` | 43 | 24 | keep | keep |  |  | 26 of 43 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-05) (exact). |
| 4 | `rgba(38, 33, 30, 0.15)` | 32 | 20 | keep | keep |  |  | 26 of 32 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-900-15) (exact). |
| 5 | `#524B47` | 28 | 19 | `var(--neutral-700)` | exact | 0 | `#D6CDC5` | (3 of 28 uses are inside a shadow — leave those pinned.) |
| 6 | `#26211E` | 28 | 18 | `var(--neutral-900)` | exact | 0 | `#F4EFEA` | (3 of 28 uses are inside a shadow — leave those pinned.) |
| 7 | `#6A625D` | 25 | 10 | `var(--neutral-600)` | exact | 0 | `#B9AFA7` |  |
| 8 | `rgba(59, 54, 50, 0.3)` | 24 | 16 | keep | keep |  |  | 15 of 24 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-30) (exact). |
| 9 | `rgba(59, 54, 50, 0.1)` | 19 | 14 | keep | keep |  |  | 14 of 19 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-10) (exact). |
| 10 | `#827A74` | 17 | 8 | `var(--neutral-500)` | exact | 0 | `#968B83` | (2 of 17 uses are inside a shadow — leave those pinned.) |
| 11 | `rgba(59, 54, 50, 0.4)` | 15 | 13 | keep | keep |  |  | 10 of 15 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-40) (exact). |
| 12 | `rgba(212, 212, 212, 0.4)` | 15 | 12 | keep | keep |  |  | 10 of 15 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-200) 40%, transparent) (near). base colour #D4D4D4 → #E4E0DC |
| 13 | `#9C938B` | 14 | 8 | `var(--neutral-400)` | exact | 0 | `#6F665F` |  |
| 14 | `#E5E5E5` | 14 | 7 | `var(--neutral-200)` | close | 3 | `#3B3632` | light colour shifts #E5E5E5 → #E4E0DC (2 of 14 uses are inside a shadow — leave those pinned.) |
| 15 | `rgba(2, 15, 24, 0.2)` | 12 | 12 | keep | keep |  |  | 8 of 12 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--blue-950-20) (exact). |
| 16 | `#FFFFFF` | 12 | 5 | `var(--neutral-white)  — or keep pinned` | decide | 0 | `#1C1613` | surface → neutral-white (dark: #1C1613). White TEXT on a coloured fill must stay white (neutral-50/white both flip to dark). |
| 17 | `rgba(18, 12, 8, 0.15)` | 11 | 11 | keep | keep |  |  | 10 of 11 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 15%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 18 | `rgba(106, 98, 93, 0.05)` | 11 | 9 | keep | keep |  |  | 7 of 11 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-600-05) (exact). |
| 19 | `#120C08` | 10 | 9 | keep | keep |  |  | 6 of 10 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-950) (exact). |
| 20 | `rgba(130, 122, 116, 0.1)` | 10 | 10 | keep | keep |  |  | 10 of 10 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-500) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 21 | `rgba(13, 110, 178, 0.5)` | 9 | 9 | keep | keep |  |  | 9 of 9 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--blue-600-50) (exact). |
| 22 | `rgba(229, 229, 229, 0.5)` | 9 | 8 | keep | keep |  |  | 7 of 9 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-200) 50%, transparent) (close). base colour #E5E5E5 → #E4E0DC |
| 23 | `#EDE1D7` | 9 | 1 | keep | keep |  |  | 8 of 9 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-200) (near). light colour shifts #EDE1D7 → #E4E0DC |
| 24 | `rgba(59, 54, 50, 0.12)` | 9 | 7 | keep | keep |  |  | 9 of 9 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-800) 12%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 25 | `#DC2626` | 8 | 5 | `var(--danger-600)` | exact | 0 | `#F87171` |  |
| 26 | `rgba(82, 75, 71, 0.18)` | 8 | 8 | keep | keep |  |  | 7 of 8 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 18%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 27 | `rgba(38, 33, 30, 0.16)` | 7 | 7 | keep | keep |  |  | 5 of 7 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-900-15) (close). alpha 0.16 → 0.15 |
| 28 | `rgba(59, 54, 50, 0.08)` | 7 | 5 | keep | keep |  |  | 5 of 7 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-800) 8%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 29 | `rgba(24, 2, 2, 0.05)` | 7 | 5 | keep | keep |  |  | 7 of 7 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 5%, transparent) (near). base colour #180202 → #120C08 |
| 30 | `rgba(24, 2, 2, 0.15)` | 7 | 5 | keep | keep |  |  | 7 of 7 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 15%, transparent) (near). base colour #180202 → #120C08 |
| 31 | `#3B3632` | 7 | 5 | `var(--neutral-800)` | exact | 0 | `#E6DED7` | (1 of 7 uses are inside a shadow — leave those pinned.) |
| 32 | `rgba(20, 12, 5, 0.2)` | 6 | 6 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 20%, transparent) (close). base colour #140C05 → #120C08 |
| 33 | `rgba(126, 84, 53, 0.5)` | 6 | 6 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--brown-600) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 34 | `rgba(250, 241, 235, 0.7)` | 6 | 6 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-100) 70%, transparent) (close). base colour #FAF1EB → #F5F2EF |
| 35 | `rgba(126, 84, 53, 0.1)` | 6 | 6 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--brown-600) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 36 | `rgba(20, 16, 5, 0.2)` | 6 | 6 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 20%, transparent) (near). base colour #141005 → #120C08 |
| 37 | `rgba(26, 23, 20, 0.24)` | 6 | 4 | keep | keep |  |  | 6 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 24%, transparent) (near). base colour #1A1714 → #120C08 |
| 38 | `rgba(82, 75, 71, 0.09)` | 6 | 5 | keep | keep |  |  | 4 of 6 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 9%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 39 | `rgba(231, 244, 253, 0.7)` | 5 | 5 | keep | keep |  |  | 5 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--blue-50-70) (exact). |
| 40 | `rgba(13, 110, 178, 0.1)` | 5 | 5 | keep | keep |  |  | 5 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--blue-600-10) (exact). |
| 41 | `rgba(18, 12, 8, 0.2)` | 5 | 3 | keep | keep |  |  | 4 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-950-20) (exact). |
| 42 | `rgba(106, 98, 93, 0.5)` | 5 | 3 | keep | keep |  |  | 4 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-600) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 43 | `rgba(128, 183, 7, 0.5)` | 5 | 5 | keep | keep |  |  | 3 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--green-600) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 44 | `rgba(250, 246, 235, 0.7)` | 5 | 5 | keep | keep |  |  | 3 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-100) 70%, transparent) (near). base colour #FAF6EB → #F5F2EF |
| 45 | `rgba(143, 116, 39, 0.1)` | 5 | 5 | keep | keep |  |  | 3 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--yellow-600) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 46 | `#0D6EB2` | 5 | 4 | `var(--blue-600)` | exact | 0 | `#6E98CB` | (2 of 5 uses are inside a shadow — leave those pinned.) |
| 47 | `rgba(130, 122, 116, 0.12)` | 5 | 5 | keep | keep |  |  | 5 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-500-12) (exact). |
| 48 | `rgba(82, 75, 71, 0.08)` | 5 | 4 | keep | keep |  |  | 5 of 5 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 8%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 49 | `#6E98CB` | 4 | 2 | `var(--blue-400)` | exact | 0 | `#8EAED8` | (1 of 4 uses are inside a shadow — leave those pinned.) |
| 50 | `#FFF5F5` | 4 | 3 | `var(--neutral-100)` | near | 3.4 | `#26211E` | light colour shifts #FFF5F5 → #F5F2EF |
| 51 | `rgba(143, 116, 39, 0.5)` | 4 | 4 | keep | keep |  |  | 4 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--yellow-600) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 52 | `rgba(17, 25, 1, 0.2)` | 4 | 4 | keep | keep |  |  | 3 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--green-950) 20%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 53 | `rgba(247, 254, 230, 0.7)` | 4 | 4 | keep | keep |  |  | 3 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--green-50) 70%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 54 | `rgba(128, 183, 7, 0.1)` | 4 | 4 | keep | keep |  |  | 3 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--green-600) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 55 | `rgba(82, 75, 71, 0.06)` | 4 | 3 | keep | keep |  |  | 3 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 6%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 56 | `rgba(59, 54, 50, 0.28)` | 4 | 4 | keep | keep |  |  | 3 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-800) 28%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 57 | `rgba(82, 75, 71, 0.05)` | 4 | 4 | keep | keep |  |  | 4 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 5%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 58 | `rgba(82, 75, 71, 0.07)` | 4 | 3 | keep | keep |  |  | 4 of 4 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 7%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 59 | `#5E6AD2` | 4 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 60 | `rgba(38, 33, 30, 0.18)` | 3 | 3 | keep | keep |  |  | 3 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-900) 18%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 61 | `rgba(59, 54, 50, 0.10)` | 3 | 3 | keep | keep |  |  | 2 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-10) (exact). |
| 62 | `#CADCF1` | 3 | 3 | `var(--blue-100)` | exact | 0 | `#0E253A` | (1 of 3 uses are inside a shadow — leave those pinned.) |
| 63 | `rgba(74, 131, 191, 0.25)` | 3 | 3 | keep | keep |  |  | 3 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-500) 25%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 64 | `#F87171` | 3 | 2 | `var(--danger-400)` | exact | 0 | `#FCA5A5` |  |
| 65 | `#6D5921` | 3 | 2 | `var(--yellow-700)` | exact | 0 | `#C7B387` |  |
| 66 | `rgba(114, 105, 98, 0.08)` | 3 | 1 | keep | keep |  |  | 3 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-600) 8%, transparent) (near). base colour #726962 → #6A625D |
| 67 | `#C62B29` | 3 | 1 | `var(--red-500)` | exact | 0 | `#FA695B` |  |
| 68 | `rgba(59, 54, 50, 0.2)` | 3 | 2 | keep | keep |  |  | 2 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-800) 20%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 69 | `#A09890` | 3 | 2 | `var(--neutral-400)` | close | 1.9 | `#6F665F` | light colour shifts #A09890 → #9C938B |
| 70 | `#004A97` | 3 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 71 | `#EF4444` | 3 | 2 | `var(--danger-500)` | exact | 0 | `#F87171` |  |
| 72 | `rgba(59, 54, 50, 0.06)` | 3 | 2 | `var(--neutral-800-05)` | close | 0 | `rgba(255, 255, 255, 0.025)` | alpha 0.06 → 0.05 (1 of 3 uses are inside a shadow — leave those pinned.) |
| 73 | `rgba(18, 60, 95, 0.65)` | 3 | 3 | keep | keep |  |  | 3 of 3 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-800) 65%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 74 | `#D4D4D4` | 2 | 2 | `var(--neutral-200)` | near | 5.1 | `#3B3632` | light colour shifts #D4D4D4 → #E4E0DC |
| 75 | `rgba(106, 98, 93, 0.1)` | 2 | 2 | `color-mix(in srgb, var(--neutral-600) 10%, transparent)` | close | 0 | `#B9AFA7` | no opacity primitive for this alpha — consider adding one (1 of 2 uses are inside a shadow — leave those pinned.) |
| 76 | `rgba(110, 152, 203, 0.85)` | 2 | 1 | `color-mix(in srgb, var(--blue-400) 85%, transparent)` | close | 0 | `#8EAED8` | no opacity primitive for this alpha — consider adding one |
| 77 | `#EFF6FF` | 2 | 2 | `var(--neutral-50)` | near | 6.2 | `#120C08` | light colour shifts #EFF6FF → #FFFFFF |
| 78 | `#BFDBFE` | 2 | 2 | `var(--info-200)` | exact | 0 | `#1E40AF` | (1 of 2 uses are inside a shadow — leave those pinned.) |
| 79 | `rgba(238, 48, 48, 0.22)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--red-400) 22%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 80 | `#FECACA` | 2 | 2 | `var(--danger-200)` | exact | 0 | `#991B1B` |  |
| 81 | `#135487` | 2 | 2 | `var(--blue-700)` | exact | 0 | `#8EAED8` |  |
| 82 | `#16A34A` | 2 | 2 | `var(--success-600)` | exact | 0 | `#4ADE80` |  |
| 83 | `rgba(18, 12, 8, 0.18)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 18%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 84 | `rgba(82, 75, 71, 0.10)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 85 | `#E21836` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 86 | `#999999` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 87 | `rgba(59, 54, 50, 0.14)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-15) (close). alpha 0.14 → 0.15 |
| 88 | `rgba(59, 54, 50, 0.5)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-50) (exact). |
| 89 | `rgba(18, 12, 8, 0.22)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 22%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 90 | `rgba(30, 28, 27, .28)` | 2 | 2 | keep | keep |  |  | 2 of 2 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-900) 28%, transparent) (near). base colour #1E1C1B → #26211E |
| 91 | `#111111` | 2 | 1 | `var(--neutral-950)` | near | 3 | `#FFFFFF` | light colour shifts #111111 → #120C08 |
| 92 | `#000000` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 93 | `#E01E5A` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 94 | `#36C5F0` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 95 | `#2EB67D` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 96 | `#ECB22E` | 2 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 97 | `#C2600F` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--warning-700) (near). light colour shifts #C2600F → #B45309 |
| 98 | `#9CA3AF` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-400) (review). light colour shifts #9CA3AF → #9C938B |
| 99 | `rgba(82, 75, 71, 0.45)` | 1 | 1 | `color-mix(in srgb, var(--neutral-700) 45%, transparent)` | close | 0 | `#D6CDC5` | no opacity primitive for this alpha — consider adding one |
| 100 | `rgba(255, 255, 255, 0.7)` | 1 | 1 | `var(--neutral-white-70)` | exact | 0 | `rgba(28, 22, 19, 0.7)` |  |
| 101 | `#FFEDD5` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--yellow-100) (near). light colour shifts #FFEDD5 → #E9DFC9 |
| 102 | `#C2410C` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--warning-700) (review). light colour shifts #C2410C → #B45309 |
| 103 | `rgba(194, 65, 12, 0.2)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--warning-700) 20%, transparent) (review). base colour #C2410C → #B45309 |
| 104 | `rgba(110, 152, 203, 0.08)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-400) 8%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 105 | `rgba(110, 152, 203, 0.35)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-400) 35%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 106 | `rgba(110, 152, 203, 0.5)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-400) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 107 | `#3B6FA8` | 1 | 1 | `var(--blue-600)` | near | 7.5 | `#6E98CB` | light colour shifts #3B6FA8 → #0D6EB2 |
| 108 | `rgba(110, 152, 203, 0.4)` | 1 | 1 | `color-mix(in srgb, var(--blue-400) 40%, transparent)` | close | 0 | `#8EAED8` | no opacity primitive for this alpha — consider adding one |
| 109 | `rgba(59, 54, 50, 0.07)` | 1 | 1 | `color-mix(in srgb, var(--neutral-800) 7%, transparent)` | close | 0 | `#E6DED7` | no opacity primitive for this alpha — consider adding one |
| 110 | `#2563EB` | 1 | 1 | `var(--info-600)` | exact | 0 | `#60A5FA` |  |
| 111 | `rgba(220, 38, 38, 0.4)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--danger-600) 40%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 112 | `rgba(18, 12, 8, 0.08)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 8%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 113 | `rgba(17, 25, 1, 0.1)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--green-950) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 114 | `rgba(38, 33, 30, 0.55)` | 1 | 1 | `color-mix(in srgb, var(--neutral-900) 55%, transparent)` | close | 0 | `#F4EFEA` | no opacity primitive for this alpha — consider adding one |
| 115 | `#FFBFB6` | 1 | 1 | `var(--red-100)` | exact | 0 | `#35110E` |  |
| 116 | `#7A201C` | 1 | 1 | `var(--red-700)` | exact | 0 | `#FA695B` |  |
| 117 | `#C7B387` | 1 | 1 | `var(--yellow-300)` | exact | 0 | `#6D5921` |  |
| 118 | `#0485F7` | 1 | 1 | `var(--info-500)` | near | 4.9 | `#60A5FA` | light colour shifts #0485F7 → #3B82F6 |
| 119 | `#EE3030` | 1 | 1 | `var(--red-400)` | exact | 0 | `#FA695B` |  |
| 120 | `rgba(59, 54, 50, 0.15)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-800-15) (exact). |
| 121 | `rgba(13, 110, 178, 0.15)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--blue-600) 15%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 122 | `rgba(82, 75, 71, .03)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 3%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 123 | `rgba(82, 75, 71, .14)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-700-15) (close). alpha 0.14 → 0.15 |
| 124 | `rgba(82, 75, 71, .12)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-700-12) (exact). |
| 125 | `rgba(82, 75, 71, 0.04)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-700) 4%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 126 | `#DCD1C8` | 1 | 1 | `var(--neutral-300)` | near | 5.9 | `#524B47` | light colour shifts #DCD1C8 → #C9C4BF |
| 127 | `#8A8078` | 1 | 1 | `var(--neutral-500)` | close | 2.8 | `#968B83` | light colour shifts #8A8078 → #827A74 |
| 128 | `#BFDA84` | 1 | 1 | `var(--green-300)` | exact | 0 | `#628B10` |  |
| 129 | `#EEF4FB` | 1 | 1 | `var(--neutral-50)` | near | 5.8 | `#120C08` | light colour shifts #EEF4FB → #FFFFFF |
| 130 | `rgba(24, 2, 2, 0.2)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 20%, transparent) (near). base colour #180202 → #120C08 |
| 131 | `rgba(159, 38, 35, 0.5)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--red-600-51) (close). alpha 0.50 → 0.51 |
| 132 | `rgba(253, 231, 231, 0.7)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-100) 70%, transparent) (near). base colour #FDE7E7 → #F5F2EF |
| 133 | `rgba(159, 38, 35, 0.1)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--red-600) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 134 | `rgba(10, 2, 24, 0.2)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 20%, transparent) (review). base colour #0A0218 → #120C08 |
| 135 | `rgba(109, 40, 217, 0.5)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--violet-700) 50%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 136 | `rgba(237, 233, 254, 0.7)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-100) 70%, transparent) (review). base colour #EDE9FE → #F5F2EF |
| 137 | `rgba(109, 40, 217, 0.1)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--violet-700) 10%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 138 | `#6D28D9` | 1 | 1 | `var(--violet-700)` | exact | 0 | `#C4B5FD` |  |
| 139 | `rgba(0, 0, 0, 0.2)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 140 | `#1A1F71` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 141 | `#252525` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 142 | `#006FCF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 143 | `#EB001B` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 144 | `#F79E1B` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 145 | `#FF5F00` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 146 | `#FF6600` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 147 | `#0E4C96` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 148 | `#007B40` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 149 | `#BBBBBB` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 150 | `rgba(220, 195, 140, 0.6)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--yellow-300) 60%, transparent) (review). base colour #DCC38C → #C7B387 |
| 151 | `rgba(220, 195, 140, 0.25)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--yellow-300) 25%, transparent) (review). base colour #DCC38C → #C7B387 |
| 152 | `#D8C9A7` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--yellow-200) (exact). |
| 153 | `#8A7F79` | 1 | 1 | `var(--neutral-500)` | close | 2.5 | `#968B83` | light colour shifts #8A7F79 → #827A74 |
| 154 | `#4A4A4A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 155 | `#030303` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 156 | `#8CC8FF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 157 | `#0A4FB0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 158 | `#B4CEF0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 159 | `#2F5F9E` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 160 | `#D9A28A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 161 | `#8A3F22` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 162 | `#A9C7B9` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 163 | `#2F6A55` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 164 | `#C3BDE6` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 165 | `#4B4392` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 166 | `rgba(212, 212, 212, 0.3)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-200) 30%, transparent) (near). base colour #D4D4D4 → #E4E0DC |
| 167 | `#1D4ED8` | 1 | 1 | `var(--info-700)` | exact | 0 | `#93C5FD` |  |
| 168 | `rgba(38, 33, 30, 0.04)` | 1 | 1 | `color-mix(in srgb, var(--neutral-900) 4%, transparent)` | close | 0 | `#F4EFEA` | no opacity primitive for this alpha — consider adding one |
| 169 | `#1E1A17` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--neutral-900) (near). light colour shifts #1E1A17 → #26211E |
| 170 | `rgba(59, 54, 50, 0.35)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-800) 35%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 171 | `#683D1B` | 1 | 1 | `var(--brown-700)` | exact | 0 | `#BD9F8B` |  |
| 172 | `#80B707` | 1 | 1 | `var(--green-600)` | exact | 0 | `#ABCF63` |  |
| 173 | `#EEF5FC` | 1 | 1 | `var(--neutral-50)` | near | 5.7 | `#120C08` | light colour shifts #EEF5FC → #FFFFFF |
| 174 | `#A8CDEC` | 1 | 1 | `var(--blue-200)` | near | 4.3 | `#123C5F` | light colour shifts #A8CDEC → #ACC5E4 |
| 175 | `rgba(18, 12, 8, 0.28)` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: color-mix(in srgb, var(--neutral-950) 28%, transparent) (close). no opacity primitive for this alpha — consider adding one |
| 176 | `#FFF8E8` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 177 | `#FFFDF8` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 178 | `#F8EBDD` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 179 | `#D98A21` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 180 | `rgba(217, 138, 33, 0.18)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 181 | `rgba(244, 177, 61, 0.30)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 182 | `#7B4C16` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 183 | `#F2F7FC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 184 | `#FCFAF7` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 185 | `#EEE8E0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 186 | `#6684A5` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 187 | `rgba(102, 132, 165, 0.16)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 188 | `rgba(123, 161, 199, 0.25)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 189 | `#3F5870` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 190 | `#F1F2F3` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 191 | `#FCFBFA` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 192 | `#E9E6E2` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 193 | `#75808A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 194 | `rgba(117, 128, 138, 0.16)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 195 | `rgba(144, 153, 162, 0.24)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 196 | `#505961` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 197 | `#EAF3FA` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 198 | `#F8FBFC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 199 | `#E5ECF2` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 200 | `#3979A7` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 201 | `rgba(57, 121, 167, 0.16)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 202 | `rgba(71, 142, 193, 0.24)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 203 | `#285A7D` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 204 | `#ECEAF1` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 205 | `#F8F7FA` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 206 | `#E3DFE8` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 207 | `#6D5C91` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 208 | `rgba(109, 92, 145, 0.16)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 209 | `rgba(114, 90, 161, 0.24)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 210 | `#4F426B` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 211 | `#ECF7FA` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 212 | `#E7F0F4` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 213 | `#5C92A8` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 214 | `rgba(92, 146, 168, 0.15)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 215 | `rgba(114, 180, 204, 0.22)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 216 | `#416B7B` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 217 | `#F0F0ED` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 218 | `#FCFBF8` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 219 | `#E8E6E1` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 220 | `#7F817D` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 221 | `rgba(127, 129, 125, 0.14)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 222 | `rgba(154, 155, 151, 0.22)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 223 | `#5C5E5A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 224 | `#EDF7F5` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 225 | `#FAFCFB` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 226 | `#E5EFEC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 227 | `#4D8B7B` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 228 | `rgba(77, 139, 123, 0.15)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 229 | `rgba(83, 158, 139, 0.22)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 230 | `#356558` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 231 | `#F5F1EC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 232 | `#FFFDFC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 233 | `#EEE9E3` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 234 | `#82766C` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 235 | `rgba(130, 118, 108, 0.14)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 236 | `rgba(149, 134, 121, 0.20)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 237 | `#5F564F` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 238 | `rgba(255, 255, 255, 0.72)` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 239 | `#E2D9D1` | 1 | 1 | `var(--neutral-200)` | near | 3.6 | `#3B3632` | light colour shifts #E2D9D1 → #E4E0DC |
| 240 | `#E1E1E1` | 1 | 1 | `var(--neutral-200)` | close | 2.5 | `#3B3632` | light colour shifts #E1E1E1 → #E4E0DC |
| 241 | `#222222` | 1 | 1 | `var(--neutral-900)` | near | 3.4 | `#F4EFEA` | light colour shifts #222222 → #26211E |
| 242 | `#888888` | 1 | 1 | `var(--neutral-500)` | near | 6.9 | `#968B83` | light colour shifts #888888 → #827A74 |
| 243 | `#666666` | 1 | 1 | `var(--neutral-600)` | near | 4.7 | `#B9AFA7` | light colour shifts #666666 → #6A625D |
| 244 | `#444444` | 1 | 1 | `var(--neutral-700)` | near | 5.4 | `#D6CDC5` | light colour shifts #444444 → #524B47 |
| 245 | `#555555` | 1 | 1 | `var(--neutral-700)` | near | 5.5 | `#D6CDC5` | light colour shifts #555555 → #524B47 |
| 246 | `#92400E` | 1 | 1 | `var(--warning-800)` | exact | 0 | `#FDE68A` |  |
| 247 | `#4FACDE` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 248 | `#2D8BBF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 249 | `#9B6FE0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 250 | `#7B4FC0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 251 | `#F59542` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 252 | `#D4742A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 253 | `#4CAF78` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 254 | `#2D8F58` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 255 | `#E06060` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 256 | `#B83C3C` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 257 | `#60A8E0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 258 | `#3C80C0` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 259 | `#22C55E` | 1 | 1 | `var(--success-500)` | exact | 0 | `#4ADE80` |  |
| 260 | `#FEF08A` | 1 | 1 | keep | keep |  |  | 1 of 1 uses are inside a shadow — mapping would turn the shadow into a light glow in dark mode. Was: var(--warning-200) (near). light colour shifts #FEF08A → #FDE68A |
| 261 | `#7856FF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 262 | `#EA4335` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 263 | `#4285F4` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 264 | `#F24E1E` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 265 | `#181717` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 266 | `#18BFFF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 267 | `#F06A6A` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 268 | `#0052CC` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 269 | `#FF7A59` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 270 | `#635BFF` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 271 | `#FF4F00` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 272 | `#03363D` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 273 | `#1F8EED` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
| 274 | `#146EF5` | 1 | 1 | keep | keep |  |  | only used in brand / illustration / avatar-art files |
