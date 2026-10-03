# Design tokens audit — front-end-test

Generated 2026-10-02 from `src/styles/tokens/primitives.css` and a scan of `src/**/*.{ts,tsx,css}`.

**Scan rules.** Tests, stories and the token files themselves are excluded. Comments are skipped (whole-line `//`, `*`, and `/* … */`; trailing `//` comments). 3-digit hex is expanded to 6 digits and upper-cased. `rgb()/rgba()/hsl()/hsla()` are listed as written (whitespace normalised). Colours inside art / brand files are listed but flagged `art` — those are usually intentional (logos, illustrations, avatar themes).

| | |
|---|---|
| Primitive tokens | 196 (145 colours) |
| Distinct hard-coded colour values | 274 (163 hex, 111 functional) |
| Total hard-coded occurrences | 1025 |
| Hex values that EXACTLY equal a primitive | 41 distinct / 208 occurrences |
| Files containing at least one | 158 |

---

## 1. Primitives

Defined in `src/styles/tokens/primitives.css`. The **Dark** column is what the dark theme remaps the same variable to (from `theme.css`), or `—` when it is not remapped.


### Neutral

| Token | Light value | Dark value |
|---|---|---|
| `--neutral-50` | `#FFFFFF` | `#120C08` |
| `--neutral-100` | `#F5F2EF` | `#26211E` |
| `--neutral-200` | `#E4E0DC` | `#3B3632` |
| `--neutral-300` | `#C9C4BF` | `#524B47` |
| `--neutral-400` | `#9C938B` | `#6F665F` |
| `--neutral-500` | `#827A74` | `#968B83` |
| `--neutral-600` | `#6A625D` | `#B9AFA7` |
| `--neutral-700` | `#524B47` | `#D6CDC5` |
| `--neutral-800` | `#3B3632` | `#E6DED7` |
| `--neutral-900` | `#26211E` | `#F4EFEA` |
| `--neutral-950` | `#120C08` | `#FFFFFF` |
| `--neutral-white` | `#FFFFFF` | `#1C1613` |
| `--neutral-black` | `#000000` | `#FFFFFF` |

### Neutral opacity variants

| Token | Light value | Dark value |
|---|---|---|
| `--neutral-50-30` | `rgba(255, 255, 255, 0.30)` | `rgba(18, 12, 8, 0.3)` |
| `--neutral-50-50` | `rgba(255, 255, 255, 0.50)` | `rgba(18, 12, 8, 0.5)` |
| `--neutral-100-60` | `rgba(245, 242, 239, 0.60)` | `rgba(255, 255, 255, 0.07)` |
| `--neutral-white-25` | `rgba(255, 255, 255, 0.25)` | `rgba(28, 22, 19, 0.25)` |
| `--neutral-black-25` | `rgba(0, 0, 0, 0.25)` | — |
| `--neutral-50-61` | `rgba(255, 255, 255, 0.61)` | `rgba(18, 12, 8, 0.61)` |
| `--neutral-300-40` | `rgba(201, 196, 191, 0.40)` | `rgba(255, 255, 255, 0.16)` |
| `--neutral-500-12` | `rgba(130, 122, 116, 0.12)` | `rgba(150, 139, 131, 0.12)` |
| `--neutral-500-60` | `rgba(130, 122, 116, 0.60)` | `rgba(150, 139, 131, 0.6)` |
| `--neutral-600-05` | `rgba(106, 98, 93, 0.05)` | `rgba(255, 255, 255, 0.025)` |
| `--neutral-700-12` | `rgba(82, 75, 71, 0.12)` | `rgba(255, 255, 255, 0.06)` |
| `--neutral-700-15` | `rgba(82, 75, 71, 0.15)` | `rgba(255, 255, 255, 0.075)` |
| `--neutral-800-05` | `rgba(59, 54, 50, 0.05)` | `rgba(255, 255, 255, 0.025)` |
| `--neutral-800-10` | `rgba(59, 54, 50, 0.10)` | `rgba(255, 255, 255, 0.05)` |
| `--neutral-800-15` | `rgba(59, 54, 50, 0.15)` | `rgba(255, 255, 255, 0.075)` |
| `--neutral-800-30` | `rgba(59, 54, 50, 0.30)` | `rgba(255, 255, 255, 0.15)` |
| `--neutral-800-40` | `rgba(59, 54, 50, 0.40)` | `rgba(255, 255, 255, 0.2)` |
| `--neutral-800-50` | `rgba(59, 54, 50, 0.50)` | `rgba(255, 255, 255, 0.25)` |
| `--neutral-200-50` | `rgba(228, 224, 220, 0.50)` | `rgba(255, 255, 255, 0.10)` |

### Red opacity variants - used by InputGroup error states

| Token | Light value | Dark value |
|---|---|---|
| `--red-400-10` | `rgba(238, 48, 48, 0.10)` | `rgba(250, 105, 91, 0.1)` |
| `--red-400-50` | `rgba(238, 48, 48, 0.50)` | `rgba(250, 105, 91, 0.5)` |
| `--red-100-60` | `rgba(255, 191, 182, 0.60)` | `rgba(53, 17, 14, 0.6)` |
| `--red-600-20` | `rgba(159,  38,  35, 0.20)` | `rgba(250, 105, 91, 0.2)` |
| `--red-600-51` | `rgba(159,  38,  35, 0.51)` | `rgba(250, 105, 91, 0.51)` |
| `--neutral-900-10` | `rgba(38, 33, 30, 0.10)` | `rgba(255, 255, 255, 0.05)` |
| `--neutral-900-15` | `rgba(38, 33, 30, 0.15)` | `rgba(255, 255, 255, 0.075)` |
| `--neutral-950-20` | `rgba(18, 12, 8, 0.20)` | `rgba(255, 255, 255, 0.1)` |
| `--neutral-950-30` | `rgba(18, 12, 8, 0.30)` | `rgba(255, 255, 255, 0.15)` |
| `--neutral-white-30` | `rgba(255, 255, 255, 0.30)` | `rgba(28, 22, 19, 0.3)` |
| `--neutral-white-70` | `rgba(255, 255, 255, 0.70)` | `rgba(28, 22, 19, 0.7)` |
| `--neutral-white-90` | `rgba(255, 255, 255, 0.90)` | `rgba(28, 22, 19, 0.9)` |

### Blue

| Token | Light value | Dark value |
|---|---|---|
| `--blue-50` | `#E7F4FD` | `#020F18` |
| `--blue-100` | `#CADCF1` | `#0E253A` |
| `--blue-200` | `#ACC5E4` | `#123C5F` |
| `--blue-300` | `#8EAED8` | `#135487` |
| `--blue-400` | `#6E98CB` | `#8EAED8` |
| `--blue-500` | `#4A83BF` | `#6E98CB` |
| `--blue-600` | `#0D6EB2` | `#6E98CB` |
| `--blue-700` | `#135487` | `#8EAED8` |
| `--blue-800` | `#123C5F` | `#ACC5E4` |
| `--blue-900` | `#0E253A` | `#CADCF1` |
| `--blue-950` | `#020F18` | `#E7F4FD` |

### Blue opacity variants

| Token | Light value | Dark value |
|---|---|---|
| `--blue-50-70` | `rgba(231, 244, 253, 0.70)` | `rgba(2, 15, 24, 0.7)` |
| `--blue-100-43` | `rgba(202, 220, 241, 0.43)` | `rgba(14, 37, 58, 0.43)` |
| `--blue-600-10` | `rgba(13, 110, 178, 0.10)` | `rgba(110, 152, 203, 0.1)` |
| `--blue-600-30` | `rgba(13, 110, 178, 0.30)` | `rgba(110, 152, 203, 0.3)` |
| `--blue-600-50` | `rgba(13, 110, 178, 0.50)` | `rgba(110, 152, 203, 0.5)` |
| `--blue-700-40` | `rgba( 19,  84, 135, 0.40)` | `rgba(142, 174, 216, 0.4)` |
| `--blue-700-70` | `rgba( 19,  84, 135, 0.70)` | `rgba(142, 174, 216, 0.7)` |
| `--blue-800-15` | `rgba( 18,  60,  95, 0.15)` | `rgba(172, 197, 228, 0.15)` |
| `--blue-950-20` | `rgba(  2,  15,  24, 0.20)` | `rgba(231, 244, 253, 0.2)` |

### Red

| Token | Light value | Dark value |
|---|---|---|
| `--red-50` | `#FDE7E7` | `#180202` |
| `--red-100` | `#FFBFB6` | `#35110E` |
| `--red-200` | `#FF9687` | `#561916` |
| `--red-300` | `#FA695B` | `#7A201C` |
| `--red-400` | `#EE3030` | `#FA695B` |
| `--red-500` | `#C62B29` | `#FA695B` |
| `--red-600` | `#9F2623` | `#FA695B` |
| `--red-700` | `#7A201C` | `#FA695B` |
| `--red-800` | `#561916` | `#FF9687` |
| `--red-900` | `#35110E` | `#FFBFB6` |
| `--red-950` | `#180202` | `#FDE7E7` |

### Green

| Token | Light value | Dark value |
|---|---|---|
| `--green-50` | `#F7FEE6` | `#111901` |
| `--green-100` | `#E5F2C5` | `#293B0E` |
| `--green-200` | `#D2E6A5` | `#456211` |
| `--green-300` | `#BFDA84` | `#628B10` |
| `--green-400` | `#ABCF63` | `#BFDA84` |
| `--green-500` | `#96C33F` | `#ABCF63` |
| `--green-600` | `#80B707` | `#ABCF63` |
| `--green-700` | `#628B10` | `#BFDA84` |
| `--green-800` | `#456211` | `#D2E6A5` |
| `--green-900` | `#293B0E` | `#E5F2C5` |
| `--green-950` | `#111901` | `#F7FEE6` |

### Yellow

| Token | Light value | Dark value |
|---|---|---|
| `--yellow-50` | `#FAF6EB` | `#141005` |
| `--yellow-100` | `#E9DFC9` | `#2F2712` |
| `--yellow-200` | `#D8C9A7` | `#4D3F1A` |
| `--yellow-300` | `#C7B387` | `#6D5921` |
| `--yellow-400` | `#B59D67` | `#C7B387` |
| `--yellow-500` | `#A28847` | `#B59D67` |
| `--yellow-600` | `#8F7427` | `#B59D67` |
| `--yellow-700` | `#6D5921` | `#C7B387` |
| `--yellow-800` | `#4D3F1A` | `#D8C9A7` |
| `--yellow-900` | `#2F2712` | `#E9DFC9` |
| `--yellow-950` | `#141005` | `#FAF6EB` |

### Brown

| Token | Light value | Dark value |
|---|---|---|
| `--brown-50` | `#FAF1EB` | `#140C05` |
| `--brown-100` | `#E6D5CA` | `#2E1D10` |
| `--brown-200` | `#D1BAAA` | `#4A2D16` |
| `--brown-300` | `#BD9F8B` | `#683D1B` |
| `--brown-400` | `#A8856E` | `#BD9F8B` |
| `--brown-500` | `#936C51` | `#A8856E` |
| `--brown-600` | `#7E5435` | `#A8856E` |
| `--brown-700` | `#683D1B` | `#BD9F8B` |
| `--brown-800` | `#4A2D16` | `#D1BAAA` |
| `--brown-900` | `#2E1D10` | `#E6D5CA` |
| `--brown-950` | `#140C05` | `#FAF1EB` |

### Purple

| Token | Light value | Dark value |
|---|---|---|
| `--purple-50` | `#F8ECF9` | `#120613` |
| `--purple-100` | `#DED0DF` | `#270D2A` |
| `--purple-200` | `#C5B5C6` | `#3B223E` |
| `--purple-300` | `#AD9AAE` | `#513853` |
| `--purple-400` | `#958096` | `#AD9AAE` |
| `--purple-500` | `#7D677F` | `#958096` |
| `--purple-600` | `#674F68` | `#958096` |
| `--purple-700` | `#513853` | `#AD9AAE` |
| `--purple-800` | `#3B223E` | `#C5B5C6` |
| `--purple-900` | `#270D2A` | `#DED0DF` |
| `--purple-950` | `#120613` | `#F8ECF9` |

### Success (vivid green)

| Token | Light value | Dark value |
|---|---|---|
| `--success-50` | `#F0FDF4` | `#052E16` |
| `--success-100` | `#DCFCE7` | `#14532D` |
| `--success-200` | `#BBF7D0` | `#166534` |
| `--success-300` | `#86EFAC` | `#15803D` |
| `--success-400` | `#4ADE80` | `#86EFAC` |
| `--success-500` | `#22C55E` | `#4ADE80` |
| `--success-600` | `#16A34A` | `#4ADE80` |
| `--success-700` | `#15803D` | `#86EFAC` |
| `--success-800` | `#166534` | `#BBF7D0` |
| `--success-900` | `#14532D` | `#DCFCE7` |
| `--success-950` | `#052E16` | `#F0FDF4` |

### Danger (vivid red)

| Token | Light value | Dark value |
|---|---|---|
| `--danger-50` | `#FEF2F2` | `#450A0A` |
| `--danger-100` | `#FEE2E2` | `#7F1D1D` |
| `--danger-200` | `#FECACA` | `#991B1B` |
| `--danger-300` | `#FCA5A5` | `#B91C1C` |
| `--danger-400` | `#F87171` | `#FCA5A5` |
| `--danger-500` | `#EF4444` | `#F87171` |
| `--danger-600` | `#DC2626` | `#F87171` |
| `--danger-700` | `#B91C1C` | `#FCA5A5` |
| `--danger-800` | `#991B1B` | `#FECACA` |
| `--danger-900` | `#7F1D1D` | `#FEE2E2` |
| `--danger-950` | `#450A0A` | `#FEF2F2` |

### Warning (amber)

| Token | Light value | Dark value |
|---|---|---|
| `--warning-50` | `#FFFBEB` | `#451A03` |
| `--warning-100` | `#FEF3C7` | `#78350F` |
| `--warning-200` | `#FDE68A` | `#92400E` |
| `--warning-300` | `#FCD34D` | `#B45309` |
| `--warning-400` | `#FBBF24` | `#FCD34D` |
| `--warning-500` | `#F59E0B` | `#FBBF24` |
| `--warning-600` | `#D97706` | `#FBBF24` |
| `--warning-700` | `#B45309` | `#FCD34D` |
| `--warning-800` | `#92400E` | `#FDE68A` |
| `--warning-900` | `#78350F` | `#FEF3C7` |
| `--warning-950` | `#451A03` | `#FFFBEB` |

### Info (vivid blue)

| Token | Light value | Dark value |
|---|---|---|
| `--info-50` | `#EFF6FF` | `#172554` |
| `--info-100` | `#DBEAFE` | `#1E3A8A` |
| `--info-200` | `#BFDBFE` | `#1E40AF` |
| `--info-300` | `#93C5FD` | `#1D4ED8` |
| `--info-400` | `#60A5FA` | `#93C5FD` |
| `--info-500` | `#3B82F6` | `#60A5FA` |
| `--info-600` | `#2563EB` | `#60A5FA` |
| `--info-700` | `#1D4ED8` | `#93C5FD` |
| `--info-800` | `#1E40AF` | `#BFDBFE` |
| `--info-900` | `#1E3A8A` | `#DBEAFE` |
| `--info-950` | `#172554` | `#EFF6FF` |

### Violet

| Token | Light value | Dark value |
|---|---|---|
| `--violet-50` | `#F5F3FF` | `#2E1065` |
| `--violet-100` | `#EDE9FE` | `#4C1D95` |
| `--violet-200` | `#DDD6FE` | `#5B21B6` |
| `--violet-300` | `#C4B5FD` | `#6D28D9` |
| `--violet-400` | `#A78BFA` | `#C4B5FD` |
| `--violet-500` | `#8B5CF6` | `#A78BFA` |
| `--violet-600` | `#7C3AED` | `#A78BFA` |
| `--violet-700` | `#6D28D9` | `#C4B5FD` |
| `--violet-800` | `#5B21B6` | `#DDD6FE` |
| `--violet-900` | `#4C1D95` | `#EDE9FE` |
| `--violet-950` | `#2E1065` | `#F5F3FF` |
| `--brand-slack-green` | `#2EB67D` | — |
| `--brand-slack-cyan` | `#36C5F0` | — |
| `--brand-slack-yellow` | `#ECB22E` | — |
| `--brand-slack-red` | `#E01E5A` | — |
| `--brand-slack-aubergine` | `#4A154B` | — |
| `--brand-google-blue` | `#4285F4` | — |
| `--brand-google-green` | `#34A853` | — |
| `--brand-google-yellow` | `#FBBC05` | — |
| `--brand-google-red` | `#EA4335` | — |
| `--static-white` | `#FFFFFF` | — |
| `--static-black` | `#000000` | — |
| `--space-0` | `0` | — |
| `--space-1` | `4px` | — |
| `--space-2` | `8px` | — |
| `--space-3` | `12px` | — |
| `--space-4` | `16px` | — |
| `--space-5` | `20px` | — |
| `--space-6` | `24px` | — |
| `--space-7` | `32px` | — |
| `--space-8` | `40px` | — |
| `--space-9` | `48px` | — |
| `--space-10` | `64px` | — |

---

## 2. Hard-coded colours — by value

Sorted by number of occurrences. **Nearest primitive** is the closest colour primitive by RGB distance (`exact` when identical; otherwise the distance, where ~0–10 is visually the same and larger is a real design decision). Every occurrence is listed as `file:line`.

| # | Value | Uses | Files | Nearest primitive | Notes |
|---:|---|---:|---:|---|---|
| 1 | `rgba(82, 75, 71, 0.12)` | 151 | 87 | `--neutral-700` (exact) |  |
| 2 | `#F5F5F5` | 45 | 22 | `--neutral-100` (Δ7) |  |
| 3 | `rgba(59, 54, 50, 0.05)` | 43 | 24 | `--neutral-800` (exact) |  |
| 4 | `rgba(38, 33, 30, 0.15)` | 32 | 20 | `--neutral-900` (exact) |  |
| 5 | `#524B47` | 28 | 19 | `--neutral-700` (exact) |  |
| 6 | `#26211E` | 28 | 18 | `--neutral-900` (exact) |  |
| 7 | `#6A625D` | 25 | 10 | `--neutral-600` (exact) |  |
| 8 | `rgba(59, 54, 50, 0.3)` | 24 | 16 | `--neutral-800` (exact) |  |
| 9 | `rgba(59, 54, 50, 0.1)` | 19 | 14 | `--neutral-800` (exact) |  |
| 10 | `#827A74` | 17 | 8 | `--neutral-500` (exact) |  |
| 11 | `rgba(59, 54, 50, 0.4)` | 15 | 13 | `--neutral-800` (exact) |  |
| 12 | `rgba(212, 212, 212, 0.4)` | 15 | 12 | `--purple-100` (Δ15) |  |
| 13 | `#9C938B` | 14 | 8 | `--neutral-400` (exact) |  |
| 14 | `#E5E5E5` | 14 | 7 | `--neutral-200` (Δ10) | partly art |
| 15 | `rgba(2, 15, 24, 0.2)` | 12 | 12 | `--blue-950` (exact) |  |
| 16 | `#FFFFFF` | 12 | 5 | `--neutral-50` (exact) | partly art; ambiguous: neutral-50 and neutral-white are both #FFFFFF |
| 17 | `rgba(18, 12, 8, 0.15)` | 11 | 11 | `--neutral-950` (exact) |  |
| 18 | `rgba(106, 98, 93, 0.05)` | 11 | 9 | `--neutral-600` (exact) |  |
| 19 | `#120C08` | 10 | 9 | `--neutral-950` (exact) |  |
| 20 | `rgba(130, 122, 116, 0.1)` | 10 | 10 | `--neutral-500` (exact) |  |
| 21 | `rgba(13, 110, 178, 0.5)` | 9 | 9 | `--blue-600` (exact) |  |
| 22 | `rgba(229, 229, 229, 0.5)` | 9 | 8 | `--neutral-200` (Δ10) |  |
| 23 | `#EDE1D7` | 9 | 1 | `--neutral-200` (Δ10) |  |
| 24 | `rgba(59, 54, 50, 0.12)` | 9 | 7 | `--neutral-800` (exact) |  |
| 25 | `#DC2626` | 8 | 5 | `--danger-600` (exact) |  |
| 26 | `rgba(82, 75, 71, 0.18)` | 8 | 8 | `--neutral-700` (exact) |  |
| 27 | `rgba(38, 33, 30, 0.16)` | 7 | 7 | `--neutral-900` (exact) |  |
| 28 | `rgba(59, 54, 50, 0.08)` | 7 | 5 | `--neutral-800` (exact) |  |
| 29 | `rgba(24, 2, 2, 0.05)` | 7 | 5 | `--red-950` (exact) |  |
| 30 | `rgba(24, 2, 2, 0.15)` | 7 | 5 | `--red-950` (exact) |  |
| 31 | `#3B3632` | 7 | 5 | `--neutral-800` (exact) |  |
| 32 | `rgba(20, 12, 5, 0.2)` | 6 | 6 | `--brown-950` (exact) |  |
| 33 | `rgba(126, 84, 53, 0.5)` | 6 | 6 | `--brown-600` (exact) |  |
| 34 | `rgba(250, 241, 235, 0.7)` | 6 | 6 | `--brown-50` (exact) |  |
| 35 | `rgba(126, 84, 53, 0.1)` | 6 | 6 | `--brown-600` (exact) |  |
| 36 | `rgba(20, 16, 5, 0.2)` | 6 | 6 | `--yellow-950` (exact) |  |
| 37 | `rgba(26, 23, 20, 0.24)` | 6 | 4 | `--yellow-950` (Δ18) |  |
| 38 | `rgba(82, 75, 71, 0.09)` | 6 | 5 | `--neutral-700` (exact) |  |
| 39 | `rgba(231, 244, 253, 0.7)` | 5 | 5 | `--blue-50` (exact) |  |
| 40 | `rgba(13, 110, 178, 0.1)` | 5 | 5 | `--blue-600` (exact) |  |
| 41 | `rgba(18, 12, 8, 0.2)` | 5 | 3 | `--neutral-950` (exact) |  |
| 42 | `rgba(106, 98, 93, 0.5)` | 5 | 3 | `--neutral-600` (exact) |  |
| 43 | `rgba(128, 183, 7, 0.5)` | 5 | 5 | `--green-600` (exact) |  |
| 44 | `rgba(250, 246, 235, 0.7)` | 5 | 5 | `--yellow-50` (exact) |  |
| 45 | `rgba(143, 116, 39, 0.1)` | 5 | 5 | `--yellow-600` (exact) |  |
| 46 | `#0D6EB2` | 5 | 4 | `--blue-600` (exact) |  |
| 47 | `rgba(130, 122, 116, 0.12)` | 5 | 5 | `--neutral-500` (exact) |  |
| 48 | `rgba(82, 75, 71, 0.08)` | 5 | 4 | `--neutral-700` (exact) |  |
| 49 | `#6E98CB` | 4 | 2 | `--blue-400` (exact) |  |
| 50 | `#FFF5F5` | 4 | 3 | `--danger-50` (Δ4) |  |
| 51 | `rgba(143, 116, 39, 0.5)` | 4 | 4 | `--yellow-600` (exact) |  |
| 52 | `rgba(17, 25, 1, 0.2)` | 4 | 4 | `--green-950` (exact) |  |
| 53 | `rgba(247, 254, 230, 0.7)` | 4 | 4 | `--green-50` (exact) |  |
| 54 | `rgba(128, 183, 7, 0.1)` | 4 | 4 | `--green-600` (exact) |  |
| 55 | `rgba(82, 75, 71, 0.06)` | 4 | 3 | `--neutral-700` (exact) |  |
| 56 | `rgba(59, 54, 50, 0.28)` | 4 | 4 | `--neutral-800` (exact) |  |
| 57 | `rgba(82, 75, 71, 0.05)` | 4 | 4 | `--neutral-700` (exact) |  |
| 58 | `rgba(82, 75, 71, 0.07)` | 4 | 3 | `--neutral-700` (exact) |  |
| 59 | `#5E6AD2` | 4 | 1 | `--blue-500` (Δ37) | art |
| 60 | `rgba(38, 33, 30, 0.18)` | 3 | 3 | `--neutral-900` (exact) |  |
| 61 | `rgba(59, 54, 50, 0.10)` | 3 | 3 | `--neutral-800` (exact) |  |
| 62 | `#CADCF1` | 3 | 3 | `--blue-100` (exact) |  |
| 63 | `rgba(74, 131, 191, 0.25)` | 3 | 3 | `--blue-500` (exact) |  |
| 64 | `#F87171` | 3 | 2 | `--danger-400` (exact) |  |
| 65 | `#6D5921` | 3 | 2 | `--yellow-700` (exact) |  |
| 66 | `rgba(114, 105, 98, 0.08)` | 3 | 1 | `--neutral-600` (Δ12) |  |
| 67 | `#C62B29` | 3 | 1 | `--red-500` (exact) |  |
| 68 | `rgba(59, 54, 50, 0.2)` | 3 | 2 | `--neutral-800` (exact) |  |
| 69 | `#A09890` | 3 | 2 | `--neutral-400` (Δ8) |  |
| 70 | `#004A97` | 3 | 1 | `--blue-700` (Δ27) | art |
| 71 | `#EF4444` | 3 | 2 | `--danger-500` (exact) |  |
| 72 | `rgba(59, 54, 50, 0.06)` | 3 | 2 | `--neutral-800` (exact) |  |
| 73 | `rgba(18, 60, 95, 0.65)` | 3 | 3 | `--blue-800` (exact) |  |
| 74 | `#D4D4D4` | 2 | 2 | `--purple-100` (Δ15) |  |
| 75 | `rgba(106, 98, 93, 0.1)` | 2 | 2 | `--neutral-600` (exact) |  |
| 76 | `rgba(110, 152, 203, 0.85)` | 2 | 1 | `--blue-400` (exact) |  |
| 77 | `#EFF6FF` | 2 | 2 | `--info-50` (exact) |  |
| 78 | `#BFDBFE` | 2 | 2 | `--info-200` (exact) |  |
| 79 | `rgba(238, 48, 48, 0.22)` | 2 | 2 | `--red-400` (exact) |  |
| 80 | `#FECACA` | 2 | 2 | `--danger-200` (exact) |  |
| 81 | `#135487` | 2 | 2 | `--blue-700` (exact) |  |
| 82 | `#16A34A` | 2 | 2 | `--success-600` (exact) |  |
| 83 | `rgba(18, 12, 8, 0.18)` | 2 | 2 | `--neutral-950` (exact) |  |
| 84 | `rgba(82, 75, 71, 0.10)` | 2 | 2 | `--neutral-700` (exact) |  |
| 85 | `#E21836` | 2 | 1 | `--danger-600` (Δ22) | art |
| 86 | `#999999` | 2 | 1 | `--neutral-400` (Δ16) | art |
| 87 | `rgba(59, 54, 50, 0.14)` | 2 | 2 | `--neutral-800` (exact) |  |
| 88 | `rgba(59, 54, 50, 0.5)` | 2 | 2 | `--neutral-800` (exact) |  |
| 89 | `rgba(18, 12, 8, 0.22)` | 2 | 2 | `--neutral-950` (exact) |  |
| 90 | `rgba(30, 28, 27, .28)` | 2 | 2 | `--neutral-900` (Δ10) |  |
| 91 | `#111111` | 2 | 1 | `--neutral-950` (Δ10) |  |
| 92 | `#000000` | 2 | 1 | `--neutral-black` (exact) | art; neutral-black |
| 93 | `#E01E5A` | 2 | 1 | `--brand-slack-red` (exact) | art |
| 94 | `#36C5F0` | 2 | 1 | `--brand-slack-cyan` (exact) | art |
| 95 | `#2EB67D` | 2 | 1 | `--brand-slack-green` (exact) | art |
| 96 | `#ECB22E` | 2 | 1 | `--brand-slack-yellow` (exact) | art |
| 97 | `#C2600F` | 1 | 1 | `--warning-700` (Δ20) |  |
| 98 | `#9CA3AF` | 1 | 1 | `--purple-300` (Δ19) |  |
| 99 | `rgba(82, 75, 71, 0.45)` | 1 | 1 | `--neutral-700` (exact) |  |
| 100 | `rgba(255, 255, 255, 0.7)` | 1 | 1 | `--neutral-50` (exact) |  |
| 101 | `#FFEDD5` | 1 | 1 | `--warning-100` (Δ15) |  |
| 102 | `#C2410C` | 1 | 1 | `--warning-700` (Δ23) |  |
| 103 | `rgba(194, 65, 12, 0.2)` | 1 | 1 | `--warning-700` (Δ23) |  |
| 104 | `rgba(110, 152, 203, 0.08)` | 1 | 1 | `--blue-400` (exact) |  |
| 105 | `rgba(110, 152, 203, 0.35)` | 1 | 1 | `--blue-400` (exact) |  |
| 106 | `rgba(110, 152, 203, 0.5)` | 1 | 1 | `--blue-400` (exact) |  |
| 107 | `#3B6FA8` | 1 | 1 | `--blue-500` (Δ34) |  |
| 108 | `rgba(110, 152, 203, 0.4)` | 1 | 1 | `--blue-400` (exact) |  |
| 109 | `rgba(59, 54, 50, 0.07)` | 1 | 1 | `--neutral-800` (exact) |  |
| 110 | `#2563EB` | 1 | 1 | `--info-600` (exact) |  |
| 111 | `rgba(220, 38, 38, 0.4)` | 1 | 1 | `--danger-600` (exact) |  |
| 112 | `rgba(18, 12, 8, 0.08)` | 1 | 1 | `--neutral-950` (exact) |  |
| 113 | `rgba(17, 25, 1, 0.1)` | 1 | 1 | `--green-950` (exact) |  |
| 114 | `rgba(38, 33, 30, 0.55)` | 1 | 1 | `--neutral-900` (exact) |  |
| 115 | `#FFBFB6` | 1 | 1 | `--red-100` (exact) |  |
| 116 | `#7A201C` | 1 | 1 | `--red-700` (exact) |  |
| 117 | `#C7B387` | 1 | 1 | `--yellow-300` (exact) |  |
| 118 | `#0485F7` | 1 | 1 | `--info-600` (Δ49) |  |
| 119 | `#EE3030` | 1 | 1 | `--red-400` (exact) |  |
| 120 | `rgba(59, 54, 50, 0.15)` | 1 | 1 | `--neutral-800` (exact) |  |
| 121 | `rgba(13, 110, 178, 0.15)` | 1 | 1 | `--blue-600` (exact) |  |
| 122 | `rgba(82, 75, 71, .03)` | 1 | 1 | `--neutral-700` (exact) |  |
| 123 | `rgba(82, 75, 71, .14)` | 1 | 1 | `--neutral-700` (exact) |  |
| 124 | `rgba(82, 75, 71, .12)` | 1 | 1 | `--neutral-700` (exact) |  |
| 125 | `rgba(82, 75, 71, 0.04)` | 1 | 1 | `--neutral-700` (exact) |  |
| 126 | `#DCD1C8` | 1 | 1 | `--brown-100` (Δ11) |  |
| 127 | `#8A8078` | 1 | 1 | `--neutral-500` (Δ11) |  |
| 128 | `#BFDA84` | 1 | 1 | `--green-300` (exact) |  |
| 129 | `#EEF4FB` | 1 | 1 | `--info-50` (Δ5) |  |
| 130 | `rgba(24, 2, 2, 0.2)` | 1 | 1 | `--red-950` (exact) |  |
| 131 | `rgba(159, 38, 35, 0.5)` | 1 | 1 | `--red-600` (exact) |  |
| 132 | `rgba(253, 231, 231, 0.7)` | 1 | 1 | `--red-50` (exact) |  |
| 133 | `rgba(159, 38, 35, 0.1)` | 1 | 1 | `--red-600` (exact) |  |
| 134 | `rgba(10, 2, 24, 0.2)` | 1 | 1 | `--purple-950` (Δ10) |  |
| 135 | `rgba(109, 40, 217, 0.5)` | 1 | 1 | `--violet-700` (exact) |  |
| 136 | `rgba(237, 233, 254, 0.7)` | 1 | 1 | `--violet-100` (exact) |  |
| 137 | `rgba(109, 40, 217, 0.1)` | 1 | 1 | `--violet-700` (exact) |  |
| 138 | `#6D28D9` | 1 | 1 | `--violet-700` (exact) |  |
| 139 | `rgba(0, 0, 0, 0.2)` | 1 | 1 | `--neutral-black` (exact) | art |
| 140 | `#1A1F71` | 1 | 1 | `--violet-950` (Δ28) | art |
| 141 | `#252525` | 1 | 1 | `--neutral-900` (Δ8) | art |
| 142 | `#006FCF` | 1 | 1 | `--blue-600` (Δ32) | art |
| 143 | `#EB001B` | 1 | 1 | `--danger-600` (Δ42) | art |
| 144 | `#F79E1B` | 1 | 1 | `--warning-500` (Δ16) | art |
| 145 | `#FF5F00` | 1 | 1 | `--warning-600` (Δ45) | art |
| 146 | `#FF6600` | 1 | 1 | `--warning-600` (Δ42) | art |
| 147 | `#0E4C96` | 1 | 1 | `--blue-700` (Δ18) | art |
| 148 | `#007B40` | 1 | 1 | `--success-700` (Δ22) | art |
| 149 | `#BBBBBB` | 1 | 1 | `--purple-200` (Δ16) | art |
| 150 | `rgba(220, 195, 140, 0.6)` | 1 | 1 | `--yellow-300` (Δ27) |  |
| 151 | `rgba(220, 195, 140, 0.25)` | 1 | 1 | `--yellow-300` (Δ27) |  |
| 152 | `#D8C9A7` | 1 | 1 | `--yellow-200` (exact) |  |
| 153 | `#8A7F79` | 1 | 1 | `--neutral-500` (Δ11) |  |
| 154 | `#4A4A4A` | 1 | 1 | `--neutral-700` (Δ9) | art |
| 155 | `#030303` | 1 | 1 | `--neutral-black` (Δ5) | art |
| 156 | `#8CC8FF` | 1 | 1 | `--info-300` (Δ8) | art |
| 157 | `#0A4FB0` | 1 | 1 | `--info-800` (Δ25) | art |
| 158 | `#B4CEF0` | 1 | 1 | `--blue-200` (Δ17) | art |
| 159 | `#2F5F9E` | 1 | 1 | `--blue-700` (Δ38) | art |
| 160 | `#D9A28A` | 1 | 1 | `--yellow-300` (Δ25) | art |
| 161 | `#8A3F22` | 1 | 1 | `--warning-800` (Δ22) | art |
| 162 | `#A9C7B9` | 1 | 1 | `--neutral-300` (Δ33) | art |
| 163 | `#2F6A55` | 1 | 1 | `--success-700` (Δ42) | art |
| 164 | `#C3BDE6` | 1 | 1 | `--violet-300` (Δ24) | art |
| 165 | `#4B4392` | 1 | 1 | `--violet-900` (Δ38) | art |
| 166 | `rgba(212, 212, 212, 0.3)` | 1 | 1 | `--purple-100` (Δ15) |  |
| 167 | `#1D4ED8` | 1 | 1 | `--info-700` (exact) |  |
| 168 | `rgba(38, 33, 30, 0.04)` | 1 | 1 | `--neutral-900` (exact) |  |
| 169 | `#1E1A17` | 1 | 1 | `--neutral-900` (Δ13) |  |
| 170 | `rgba(59, 54, 50, 0.35)` | 1 | 1 | `--neutral-800` (exact) |  |
| 171 | `#683D1B` | 1 | 1 | `--brown-700` (exact) |  |
| 172 | `#80B707` | 1 | 1 | `--green-600` (exact) |  |
| 173 | `#EEF5FC` | 1 | 1 | `--info-50` (Δ3) |  |
| 174 | `#A8CDEC` | 1 | 1 | `--blue-200` (Δ12) |  |
| 175 | `rgba(18, 12, 8, 0.28)` | 1 | 1 | `--neutral-950` (exact) |  |
| 176 | `#FFF8E8` | 1 | 1 | `--warning-50` (Δ4) | art |
| 177 | `#FFFDF8` | 1 | 1 | `--neutral-50` (Δ7) | art |
| 178 | `#F8EBDD` | 1 | 1 | `--red-50` (Δ12) | art |
| 179 | `#D98A21` | 1 | 1 | `--warning-600` (Δ33) | art |
| 180 | `rgba(217, 138, 33, 0.18)` | 1 | 1 | `--warning-600` (Δ33) | art |
| 181 | `rgba(244, 177, 61, 0.30)` | 1 | 1 | `--brand-slack-yellow` (Δ17) | art |
| 182 | `#7B4C16` | 1 | 1 | `--yellow-700` (Δ22) | art |
| 183 | `#F2F7FC` | 1 | 1 | `--info-50` (Δ4) | art |
| 184 | `#FCFAF7` | 1 | 1 | `--danger-50` (Δ10) | art |
| 185 | `#EEE8E0` | 1 | 1 | `--neutral-200` (Δ13) | art |
| 186 | `#6684A5` | 1 | 1 | `--blue-500` (Δ38) | art |
| 187 | `rgba(102, 132, 165, 0.16)` | 1 | 1 | `--blue-500` (Δ38) | art |
| 188 | `rgba(123, 161, 199, 0.25)` | 1 | 1 | `--blue-400` (Δ16) | art |
| 189 | `#3F5870` | 1 | 1 | `--purple-600` (Δ42) | art |
| 190 | `#F1F2F3` | 1 | 1 | `--neutral-100` (Δ6) | art |
| 191 | `#FCFBFA` | 1 | 1 | `--neutral-50` (Δ7) | art |
| 192 | `#E9E6E2` | 1 | 1 | `--neutral-200` (Δ10) | art |
| 193 | `#75808A` | 1 | 1 | `--neutral-500` (Δ26) | art |
| 194 | `rgba(117, 128, 138, 0.16)` | 1 | 1 | `--neutral-500` (Δ26) | art |
| 195 | `rgba(144, 153, 162, 0.24)` | 1 | 1 | `--neutral-400` (Δ27) | art |
| 196 | `#505961` | 1 | 1 | `--purple-600` (Δ26) | art |
| 197 | `#EAF3FA` | 1 | 1 | `--blue-50` (Δ4) | art |
| 198 | `#F8FBFC` | 1 | 1 | `--neutral-50` (Δ9) | art |
| 199 | `#E5ECF2` | 1 | 1 | `--blue-50` (Δ14) | art |
| 200 | `#3979A7` | 1 | 1 | `--blue-500` (Δ31) | art |
| 201 | `rgba(57, 121, 167, 0.16)` | 1 | 1 | `--blue-500` (Δ31) | art |
| 202 | `rgba(71, 142, 193, 0.24)` | 1 | 1 | `--blue-500` (Δ12) | art |
| 203 | `#285A7D` | 1 | 1 | `--blue-700` (Δ24) | art |
| 204 | `#ECEAF1` | 1 | 1 | `--neutral-100` (Δ12) | art |
| 205 | `#F8F7FA` | 1 | 1 | `--violet-50` (Δ7) | art |
| 206 | `#E3DFE8` | 1 | 1 | `--neutral-200` (Δ12) | art |
| 207 | `#6D5C91` | 1 | 1 | `--purple-500` (Δ26) | art |
| 208 | `rgba(109, 92, 145, 0.16)` | 1 | 1 | `--purple-500` (Δ26) | art |
| 209 | `rgba(114, 90, 161, 0.24)` | 1 | 1 | `--purple-500` (Δ38) | art |
| 210 | `#4F426B` | 1 | 1 | `--purple-700` (Δ26) | art |
| 211 | `#ECF7FA` | 1 | 1 | `--info-50` (Δ6) | art |
| 212 | `#E7F0F4` | 1 | 1 | `--blue-50` (Δ10) | art |
| 213 | `#5C92A8` | 1 | 1 | `--blue-500` (Δ33) | art |
| 214 | `rgba(92, 146, 168, 0.15)` | 1 | 1 | `--blue-500` (Δ33) | art |
| 215 | `rgba(114, 180, 204, 0.22)` | 1 | 1 | `--blue-400` (Δ28) | art |
| 216 | `#416B7B` | 1 | 1 | `--purple-600` (Δ51) | art |
| 217 | `#F0F0ED` | 1 | 1 | `--neutral-100` (Δ6) | art |
| 218 | `#FCFBF8` | 1 | 1 | `--neutral-50` (Δ9) | art |
| 219 | `#E8E6E1` | 1 | 1 | `--neutral-200` (Δ9) | art |
| 220 | `#7F817D` | 1 | 1 | `--neutral-500` (Δ12) | art |
| 221 | `rgba(127, 129, 125, 0.14)` | 1 | 1 | `--neutral-500` (Δ12) | art |
| 222 | `rgba(154, 155, 151, 0.22)` | 1 | 1 | `--neutral-400` (Δ15) | art |
| 223 | `#5C5E5A` | 1 | 1 | `--neutral-600` (Δ15) | art |
| 224 | `#EDF7F5` | 1 | 1 | `--success-50` (Δ7) | art |
| 225 | `#FAFCFB` | 1 | 1 | `--neutral-50` (Δ7) | art |
| 226 | `#E5EFEC` | 1 | 1 | `--neutral-100` (Δ17) | art |
| 227 | `#4D8B7B` | 1 | 1 | `--brand-slack-green` (Δ53) | art |
| 228 | `rgba(77, 139, 123, 0.15)` | 1 | 1 | `--brand-slack-green` (Δ53) | art |
| 229 | `rgba(83, 158, 139, 0.22)` | 1 | 1 | `--brand-slack-green` (Δ46) | art |
| 230 | `#356558` | 1 | 1 | `--neutral-700` (Δ42) | art |
| 231 | `#F5F1EC` | 1 | 1 | `--neutral-100` (Δ3) | art |
| 232 | `#FFFDFC` | 1 | 1 | `--neutral-50` (Δ4) | art |
| 233 | `#EEE9E3` | 1 | 1 | `--neutral-200` (Δ15) | art |
| 234 | `#82766C` | 1 | 1 | `--neutral-500` (Δ9) | art |
| 235 | `rgba(130, 118, 108, 0.14)` | 1 | 1 | `--neutral-500` (Δ9) | art |
| 236 | `rgba(149, 134, 121, 0.20)` | 1 | 1 | `--brown-400` (Δ22) | art |
| 237 | `#5F564F` | 1 | 1 | `--neutral-700` (Δ19) | art |
| 238 | `rgba(255, 255, 255, 0.72)` | 1 | 1 | `--neutral-50` (exact) | art |
| 239 | `#E2D9D1` | 1 | 1 | `--brown-100` (Δ9) |  |
| 240 | `#E1E1E1` | 1 | 1 | `--neutral-200` (Δ6) |  |
| 241 | `#222222` | 1 | 1 | `--neutral-900` (Δ6) |  |
| 242 | `#888888` | 1 | 1 | `--purple-400` (Δ21) |  |
| 243 | `#666666` | 1 | 1 | `--neutral-600` (Δ11) |  |
| 244 | `#444444` | 1 | 1 | `--neutral-700` (Δ16) |  |
| 245 | `#555555` | 1 | 1 | `--neutral-700` (Δ17) |  |
| 246 | `#92400E` | 1 | 1 | `--warning-800` (exact) |  |
| 247 | `#4FACDE` | 1 | 1 | `--info-400` (Δ33) | art |
| 248 | `#2D8BBF` | 1 | 1 | `--blue-500` (Δ30) | art |
| 249 | `#9B6FE0` | 1 | 1 | `--violet-500` (Δ33) | art |
| 250 | `#7B4FC0` | 1 | 1 | `--violet-700` (Δ48) | art |
| 251 | `#F59542` | 1 | 1 | `--brand-slack-yellow` (Δ36) | art |
| 252 | `#D4742A` | 1 | 1 | `--warning-600` (Δ36) | art |
| 253 | `#4CAF78` | 1 | 1 | `--brand-slack-green` (Δ31) | art |
| 254 | `#2D8F58` | 1 | 1 | `--brand-google-green` (Δ26) | art |
| 255 | `#E06060` | 1 | 1 | `--red-300` (Δ28) | art |
| 256 | `#B83C3C` | 1 | 1 | `--red-500` (Δ29) | art |
| 257 | `#60A8E0` | 1 | 1 | `--info-400` (Δ26) | art |
| 258 | `#3C80C0` | 1 | 1 | `--blue-500` (Δ14) | art |
| 259 | `#22C55E` | 1 | 1 | `--success-500` (exact) |  |
| 260 | `#FEF08A` | 1 | 1 | `--warning-200` (Δ10) |  |
| 261 | `#7856FF` | 1 | 1 | `--violet-500` (Δ22) | art |
| 262 | `#EA4335` | 1 | 1 | `--brand-google-red` (exact) | art |
| 263 | `#4285F4` | 1 | 1 | `--brand-google-blue` (exact) | art |
| 264 | `#F24E1E` | 1 | 1 | `--brand-google-red` (Δ27) | art |
| 265 | `#181717` | 1 | 1 | `--purple-950` (Δ18) | art |
| 266 | `#18BFFF` | 1 | 1 | `--brand-slack-cyan` (Δ34) | art |
| 267 | `#F06A6A` | 1 | 1 | `--danger-400` (Δ13) | art |
| 268 | `#0052CC` | 1 | 1 | `--info-700` (Δ32) | art |
| 269 | `#FF7A59` | 1 | 1 | `--red-300` (Δ18) | art |
| 270 | `#635BFF` | 1 | 1 | `--violet-500` (Δ41) | art |
| 271 | `#FF4F00` | 1 | 1 | `--warning-600` (Δ55) | art |
| 272 | `#03363D` | 1 | 1 | `--blue-900` (Δ20) | art |
| 273 | `#1F8EED` | 1 | 1 | `--info-500` (Δ32) | art |
| 274 | `#146EF5` | 1 | 1 | `--info-600` (Δ23) | art |

### Occurrences

#### `rgba(82, 75, 71, 0.12)` — 151

- `src/app/(app)/agent/configure/components/ConnectorsTab.tsx` : 288
- `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` : 81, 149, 195
- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 128, 557, 785
- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 222, 255, 293
- `src/app/(app)/agent/configure/connectors/page.tsx` : 266
- `src/app/(app)/agent/configure/instructions/page.tsx` : 1462
- `src/app/(app)/agent/configure/knowledge/page.tsx` : 602
- `src/app/(app)/agent/configure/layout.tsx` : 373, 975, 1189
- `src/app/(app)/agent/configure/profile/page.tsx` : 468
- `src/app/(app)/agent/configure/sharing/page.tsx` : 230
- `src/app/(app)/agents/new/page.tsx` : 96, 130
- `src/app/(app)/agents/page.tsx` : 361, 362, 1295
- `src/app/(app)/agents/templates/page.tsx` : 201
- `src/app/(app)/brain/schedules/page.tsx` : 587
- `src/app/(app)/projects/new/page.tsx` : 249, 258, 264
- `src/app/(app)/settings/(shell)/(org)/activity/page.tsx` : 87
- `src/app/(app)/settings/(shell)/(org)/analytics/page.tsx` : 158, 352, 353
- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 45, 79, 311, 1024
- `src/app/(app)/settings/(shell)/(org)/members/page.tsx` : 34, 35
- `src/app/(app)/settings/(shell)/SettingsSkeleton.tsx` : 56
- `src/app/(app)/settings/(shell)/account/page.tsx` : 290
- `src/app/(app)/settings/(shell)/files/page.tsx` : 19, 714
- `src/app/(app)/settings/(shell)/help/page.tsx` : 129
- `src/app/(app)/settings/(shell)/notifications/page.tsx` : 193, 511
- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 97, 98, 100, 1436, 1437, 1450, 1451
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 181, 230, 231, 262, 362, 394
- `src/app/(app)/settings/(shell)/security/page.tsx` : 119, 383, 455
- `src/app/(app)/settings/(shell)/usage/page.tsx` : 19, 20
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 45
- `src/app/(app)/share/[id]/page.tsx` : 437
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 148
- `src/app/(onboarding)/onboarding/hello/page.tsx` : 72
- `src/app/(onboarding)/onboarding/invite/page.tsx` : 255
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 69, 94
- `src/app/(onboarding)/onboarding/profile/page.tsx` : 75, 152
- `src/app/(onboarding)/onboarding/team/[inviteId]/_components/invite-ui.tsx` : 60
- `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` : 82, 155
- `src/app/(onboarding)/onboarding/tone/page.tsx` : 43, 44
- `src/app/(onboarding)/onboarding/workspace/page.tsx` : 62, 165
- `src/app/globals.css` : 365
- `src/components/AgentEditor/ToneField.tsx` : 39
- `src/components/AgentEditor/styles.ts` : 26
- `src/components/AiModelsView/index.tsx` : 160, 220, 505, 521, 557, 629
- `src/components/ChatInput/index.tsx` : 154
- `src/components/ChatRow/index.tsx` : 20
- `src/components/ConnectorCard/index.tsx` : 15
- `src/components/ConnectorCatalogCard/index.tsx` : 124
- `src/components/ConnectorRequestModal/index.tsx` : 14, 15, 16
- `src/components/ConnectorRequestRow/index.tsx` : 12
- `src/components/ConnectorRow/index.tsx` : 15, 142
- `src/components/ContactSalesModal/index.tsx` : 23
- `src/components/CreditStatusBanner/index.tsx` : 26
- `src/components/DocumentCard/index.tsx` : 45
- `src/components/EditProjectModal/index.tsx` : 30, 155, 161
- `src/components/InlineCreditNotice/index.tsx` : 32
- `src/components/InviteModal/index.tsx` : 16, 17
- `src/components/OptionBadge/index.tsx` : 19
- `src/components/OptionRow/index.tsx` : 36
- `src/components/Pinboard/index.tsx` : 141
- `src/components/PinboardExpanded/index.tsx` : 340
- `src/components/ProjectCard/index.tsx` : 61, 62, 63
- `src/components/ProjectChatRow/index.tsx` : 424
- `src/components/ProjectFilesPanel/index.tsx` : 139
- `src/components/ProjectInstructionsPanel/index.tsx` : 34
- `src/components/ProjectListRow/index.tsx` : 43
- `src/components/QuestionCard/index.tsx` : 65
- `src/components/ReportBugModal/index.tsx` : 12
- `src/components/RequestDemoModal/index.tsx` : 12
- `src/components/RequestFeatureModal/index.tsx` : 12
- `src/components/SaveVersionModal/index.tsx` : 130
- `src/components/SettingsTable/index.tsx` : 38
- `src/components/ShareModal/index.tsx` : 23, 25
- `src/components/SidebarProjectsSection/index.tsx` : 382
- `src/components/SlackChannelMappingRow/index.tsx` : 12
- `src/components/SlackConnectModal/index.tsx` : 13, 14
- `src/components/SystemInstructionsModal/index.tsx` : 147, 256
- `src/components/TeamSwitcher/index.tsx` : 198
- `src/components/TeamSwitcherRow/index.tsx` : 157
- `src/components/VersionCard/index.tsx` : 13
- `src/components/VisibilityRow/index.tsx` : 12
- `src/components/chat/AnimatedSearchTimeout.tsx` : 25
- `src/components/chat/AnimatedTable.tsx` : 175, 295
- `src/components/chat/ChatShareOverlay.tsx` : 348
- `src/components/chat/XmlMap.module.css` : 9, 12, 230
- `src/components/compare/CompareModels.tsx` : 70, 71, 71, 82, 1663
- `src/templates/Brain/PauseCard.tsx` : 9
- `src/templates/Brain/ScheduleCard.tsx` : 81, 82

#### `#F5F5F5` — 45

- `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` : 149, 195
- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 128, 785
- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 163, 222, 255, 293
- `src/app/(app)/settings/(shell)/account/page.tsx` : 139
- `src/app/(app)/settings/(shell)/help/page.tsx` : 42
- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 1434
- `src/app/(onboarding)/onboarding/_components/onboarding-shell.tsx` : 12
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 148, 289
- `src/app/(onboarding)/onboarding/account-type/page.tsx` : 84
- `src/app/(onboarding)/onboarding/hello/page.tsx` : 72
- `src/app/(onboarding)/onboarding/invite/page.tsx` : 255
- `src/app/(onboarding)/onboarding/join/page.tsx` : 84
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 16, 92, 161, 199, 480, 592, 592, 730
- `src/app/(onboarding)/onboarding/profile/page.tsx` : 75, 152
- `src/app/(onboarding)/onboarding/team/[inviteId]/_components/invite-ui.tsx` : 18, 60
- `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` : 82, 155
- `src/app/(onboarding)/onboarding/workspace/page.tsx` : 59, 62, 165
- `src/components/ApprovalCard/index.tsx` : 96
- `src/components/OptionRow/index.tsx` : 32
- `src/components/chat/ReasoningBlock.tsx` : 417
- `src/components/compare/CompareModels.tsx` : 70, 71, 80, 81, 82
- `src/components/onboarding/WelcomeModal.tsx` : 43, 280

#### `rgba(59, 54, 50, 0.05)` — 43

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 163
- `src/app/(app)/agent/configure/instructions/page.tsx` : 1597
- `src/app/(app)/agent/configure/layout.tsx` : 979
- `src/app/(app)/agents/page.tsx` : 131, 154
- `src/app/(app)/agents/published/page.tsx` : 426
- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 218
- `src/app/(app)/settings/(shell)/(org)/members/page.tsx` : 167
- `src/app/(app)/settings/(shell)/account/page.tsx` : 139, 682
- `src/app/(app)/settings/(shell)/files/page.tsx` : 349
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 466
- `src/app/(app)/settings/(shell)/security/page.tsx` : 486
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 302, 348, 425, 476, 518, 662
- `src/app/(onboarding)/onboarding/account-type/page.tsx` : 84
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 454, 484, 592, 629, 662
- `src/app/(onboarding)/onboarding/tone/page.tsx` : 66
- `src/app/(standalone)/org/change-plan/page.tsx` : 753
- `src/components/ReportBugModal/index.tsx` : 13
- `src/components/RequestDemoModal/index.tsx` : 13
- `src/components/VersionCard/index.tsx` : 14
- `src/components/chat/ActivityRow.tsx` : 280
- `src/components/chat/AnimatedBarChart.tsx` : 106, 269
- `src/components/chat/AnimatedTable.tsx` : 163, 165, 170, 174, 189, 223, 230, 299
- `src/components/chat/ChatMessage.tsx` : 1019
- `src/components/onboarding/WelcomeModal.tsx` : 237

#### `rgba(38, 33, 30, 0.15)` — 32

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 163
- `src/app/(app)/agent/configure/instructions/page.tsx` : 1597
- `src/app/(app)/agent/configure/layout.tsx` : 979
- `src/app/(app)/agents/page.tsx` : 131, 154
- `src/app/(app)/agents/published/page.tsx` : 426
- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 218
- `src/app/(app)/settings/(shell)/(org)/members/page.tsx` : 167
- `src/app/(app)/settings/(shell)/account/page.tsx` : 139, 682
- `src/app/(app)/settings/(shell)/files/page.tsx` : 349
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 466
- `src/app/(app)/settings/(shell)/security/page.tsx` : 486
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 302, 348, 425, 476, 518, 662
- `src/app/(onboarding)/onboarding/account-type/page.tsx` : 83, 84
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 454, 484, 592, 629, 662
- `src/app/(onboarding)/onboarding/tone/page.tsx` : 66
- `src/app/(standalone)/org/change-plan/page.tsx` : 753
- `src/components/ReportBugModal/index.tsx` : 13
- `src/components/RequestDemoModal/index.tsx` : 13
- `src/components/VersionCard/index.tsx` : 14
- `src/components/onboarding/WelcomeModal.tsx` : 237

#### `#524B47` — 28

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 200
- `src/app/(app)/agent/configure/layout.tsx` : 1024
- `src/app/(app)/settings/(shell)/account/page.tsx` : 146
- `src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx` : 88, 98
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 86
- `src/app/(onboarding)/onboarding/hello/page.tsx` : 33
- `src/app/(onboarding)/onboarding/import/page.tsx` : 153, 304
- `src/app/(onboarding)/onboarding/join/page.tsx` : 89
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 144, 467, 542, 592
- `src/app/(onboarding)/onboarding/pricing/confirmation/page.tsx` : 18
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 127, 188
- `src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx` : 109
- `src/app/(onboarding)/onboarding/tone/page.tsx` : 212
- `src/app/(onboarding)/onboarding/workspace/page.tsx` : 67
- `src/components/ApprovalCard/index.tsx` : 104, 327
- `src/components/OptionRow/index.tsx` : 146, 231
- `src/components/QuestionCard/index.tsx` : 93, 139
- `src/components/ReportBugModal/index.tsx` : 73
- `src/components/RequestDemoModal/index.tsx` : 103

#### `#26211E` — 28

- `src/app/(app)/agent/configure/layout.tsx` : 1024
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 165, 299
- `src/app/(onboarding)/onboarding/account-type/page.tsx` : 83
- `src/app/(onboarding)/onboarding/connectors/page.tsx` : 97
- `src/app/(onboarding)/onboarding/hello/page.tsx` : 83
- `src/app/(onboarding)/onboarding/join/page.tsx` : 132
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 144, 542
- `src/app/(onboarding)/onboarding/pricing/confirmation/page.tsx` : 17
- `src/app/(onboarding)/onboarding/profile/page.tsx` : 86, 163
- `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` : 93, 166
- `src/app/(onboarding)/onboarding/tone/page.tsx` : 90
- `src/app/(onboarding)/onboarding/workspace/page.tsx` : 183, 194
- `src/components/ApprovalCard/index.tsx` : 310
- `src/components/QuestionCard/index.tsx` : 139, 524, 539
- `src/components/ReportBugModal/index.tsx` : 73
- `src/components/RequestDemoModal/index.tsx` : 103
- `src/components/chat/AnimatedLineChart.tsx` : 116
- `src/components/onboarding/WelcomeModal.tsx` : 93, 440, 497, 571

#### `#6A625D` — 25

- `src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx` : 91
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 35
- `src/app/(onboarding)/onboarding/account-type/page.tsx` : 118, 133
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 457, 460, 495, 633, 640, 651, 673
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 130, 191
- `src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx` : 125, 149
- `src/components/OptionRow/index.tsx` : 259
- `src/components/QuestionCard/index.tsx` : 552, 559, 666, 679
- `src/components/chat/ActivityRow.tsx` : 218
- `src/components/onboarding/WelcomeModal.tsx` : 105, 454, 511, 585

#### `rgba(59, 54, 50, 0.3)` — 24

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 210, 612
- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 194, 395
- `src/app/(app)/agent/configure/instructions/page.tsx` : 146
- `src/app/(app)/agent/configure/layout.tsx` : 598, 1045
- `src/app/(app)/settings/(shell)/account/page.tsx` : 763
- `src/app/(app)/settings/(shell)/help/page.tsx` : 43
- `src/app/(app)/settings/(shell)/notifications/page.tsx` : 49
- `src/app/(app)/settings/(shell)/security/page.tsx` : 189, 235, 293, 557
- `src/components/ChatRow/index.tsx` : 19
- `src/components/ConnectorRow/index.tsx` : 142
- `src/components/LeaveProjectModal/index.tsx` : 150
- `src/components/LeaveWorkspaceModal/index.tsx` : 110
- `src/components/ProjectChatRow/index.tsx` : 425
- `src/components/ProjectFilesPanel/index.tsx` : 287
- `src/components/QuestionCard/index.tsx` : 85
- `src/components/ShareModal/index.tsx` : 24, 150, 153

#### `rgba(59, 54, 50, 0.1)` — 19

- `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` : 237
- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 758
- `src/app/(app)/agent/configure/layout.tsx` : 373, 1024
- `src/app/(app)/settings/(shell)/security/page.tsx` : 425
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 598
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 148, 357
- `src/app/(standalone)/org/change-plan/page.tsx` : 516, 715
- `src/components/QuestionCard/index.tsx` : 65, 130
- `src/components/ReportBugModal/index.tsx` : 14
- `src/components/RequestDemoModal/index.tsx` : 14
- `src/components/TeamSwitcher/index.tsx` : 248
- `src/components/compare/CompareModels.tsx` : 83, 1482
- `src/components/onboarding/WelcomeModal.tsx` : 163
- `src/templates/Brain/PauseCard.tsx` : 9

#### `#827A74` — 17

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 170
- `src/app/(onboarding)/onboarding/connectors/page.tsx` : 115
- `src/app/(onboarding)/onboarding/join/page.tsx` : 140, 198, 202
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 120, 155, 448, 542, 551, 623, 709
- `src/app/(onboarding)/onboarding/pricing/confirmation/page.tsx` : 19
- `src/app/(onboarding)/onboarding/team/[inviteId]/_components/invite-ui.tsx` : 96
- `src/app/org-invite/[inviteId]/page.tsx` : 104
- `src/components/ApprovalCard/index.tsx` : 293, 474

#### `rgba(59, 54, 50, 0.4)` — 15

- `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` : 237
- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 758
- `src/app/(app)/agent/configure/layout.tsx` : 1024
- `src/app/(app)/settings/(shell)/security/page.tsx` : 425
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 598
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 149, 358
- `src/app/(standalone)/org/change-plan/page.tsx` : 516, 715
- `src/components/ApprovalCard/index.tsx` : 98
- `src/components/QuestionCard/index.tsx` : 130
- `src/components/ReportBugModal/index.tsx` : 14
- `src/components/RequestDemoModal/index.tsx` : 14
- `src/components/compare/CompareModels.tsx` : 83
- `src/components/onboarding/WelcomeModal.tsx` : 163

#### `rgba(212, 212, 212, 0.4)` — 15

- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 1437, 1451
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 230
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 45
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 69, 95
- `src/components/ChatRow/index.tsx` : 20
- `src/components/OptionBadge/index.tsx` : 19
- `src/components/OptionRow/index.tsx` : 36
- `src/components/ProjectChatRow/index.tsx` : 424
- `src/components/SidebarProjectsSection/index.tsx` : 382
- `src/components/TeamSwitcher/index.tsx` : 198
- `src/components/TeamSwitcherRow/index.tsx` : 157
- `src/components/compare/CompareModels.tsx` : 71, 82

#### `#9C938B` — 14

- `src/app/(app)/settings/(shell)/account/page.tsx` : 62
- `src/app/(onboarding)/onboarding/hello/page.tsx` : 83, 91
- `src/app/(onboarding)/onboarding/join/page.tsx` : 58
- `src/app/(onboarding)/onboarding/profile/page.tsx` : 86, 94, 163, 171
- `src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx` : 57
- `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` : 93, 101, 174
- `src/components/chat/ActivityRow.tsx` : 235
- `src/components/chat/ReasoningBlock.tsx` : 176

#### `#E5E5E5` — 14

- `src/app/(onboarding)/onboarding/_components/onboarding-shell.tsx` : 12
- `src/app/(onboarding)/onboarding/connectors/page.tsx` : 65, 65, 115
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 16, 442, 548, 609
- `src/app/(onboarding)/onboarding/team/[inviteId]/_components/invite-ui.tsx` : 18
- `src/app/(onboarding)/onboarding/workspace/page.tsx` : 61
- `src/components/CardBrandLogo/index.tsx` : 68
- `src/components/onboarding/WelcomeModal.tsx` : 142, 230, 237

#### `rgba(2, 15, 24, 0.2)` — 12

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 86
- `src/app/(app)/settings/(shell)/files/page.tsx` : 95
- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 149
- `src/app/(onboarding)/onboarding/import/page.tsx` : 209
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 73
- `src/app/(standalone)/org/change-plan/page.tsx` : 603
- `src/components/AiModelsView/index.tsx` : 66
- `src/components/FlatSidebarProfileRow/index.tsx` : 97
- `src/components/ProjectChatRow/index.tsx` : 290
- `src/components/RoleBadge/index.tsx` : 50
- `src/components/VisibilityRow/index.tsx` : 15
- `src/components/compare/CompareModels.tsx` : 57

#### `#FFFFFF` — 12

- `src/app/(app)/settings/(shell)/account/page.tsx` : 138
- `src/components/CardBrandLogo/index.tsx` : 52, 56, 60
- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 75, 95, 118, 344, 350, 377
- `src/components/chat/XmlWeather.tsx` : 72
- `src/lib/export-pins.ts` : 87

#### `rgba(18, 12, 8, 0.15)` — 11

- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 99
- `src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx` : 83
- `src/components/ConfirmModal/index.tsx` : 14
- `src/components/ContactSalesModal/index.tsx` : 22
- `src/components/LeaveProjectModal/index.tsx` : 15
- `src/components/LeaveWorkspaceModal/index.tsx` : 16
- `src/components/Pinboard/index.tsx` : 1854
- `src/components/ReportBugModal/index.tsx` : 11
- `src/components/RequestDemoModal/index.tsx` : 11
- `src/components/RequestFeatureModal/index.tsx` : 11
- `src/components/compare/CompareModels.tsx` : 80

#### `rgba(106, 98, 93, 0.05)` — 11

- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 1451
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 230
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 45
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 69, 97
- `src/components/ChatRow/index.tsx` : 21
- `src/components/OptionBadge/index.tsx` : 20
- `src/components/OptionRow/index.tsx` : 37, 39
- `src/components/ProjectChatRow/index.tsx` : 487
- `src/components/compare/CompareModels.tsx` : 72

#### `#120C08` — 10

- `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` : 261
- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 758
- `src/app/(app)/agent/configure/layout.tsx` : 1025
- `src/app/(app)/settings/(shell)/security/page.tsx` : 425
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 598
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 151, 360
- `src/components/QuestionCard/index.tsx` : 147
- `src/components/chat/AnimatedCodeBlock.tsx` : 101
- `src/components/onboarding/WelcomeModal.tsx` : 206

#### `rgba(130, 122, 116, 0.1)` — 10

- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 99
- `src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx` : 83
- `src/components/ConfirmModal/index.tsx` : 14
- `src/components/ContactSalesModal/index.tsx` : 22
- `src/components/LeaveProjectModal/index.tsx` : 15
- `src/components/LeaveWorkspaceModal/index.tsx` : 16
- `src/components/ReportBugModal/index.tsx` : 11
- `src/components/RequestDemoModal/index.tsx` : 11
- `src/components/RequestFeatureModal/index.tsx` : 11
- `src/components/compare/CompareModels.tsx` : 80

#### `rgba(13, 110, 178, 0.5)` — 9

- `src/app/(app)/agent/configure/components/SharingTab.tsx` : 77
- `src/app/(app)/agents/published/page.tsx` : 68
- `src/app/(app)/settings/(shell)/files/page.tsx` : 95
- `src/app/(standalone)/org/change-plan/page.tsx` : 603
- `src/components/AiModelsView/index.tsx` : 66
- `src/components/FlatSidebarProfileRow/index.tsx` : 97
- `src/components/ProjectChatRow/index.tsx` : 290
- `src/components/QuestionCard/index.tsx` : 243
- `src/components/VisibilityRow/index.tsx` : 15

#### `rgba(229, 229, 229, 0.5)` — 9

- `src/app/(app)/agent/configure/connectors/page.tsx` : 242
- `src/app/(app)/agent/configure/instructions/page.tsx` : 1431
- `src/app/(app)/agent/configure/knowledge/page.tsx` : 578
- `src/app/(app)/agent/configure/profile/page.tsx` : 437
- `src/app/(app)/agent/configure/sharing/page.tsx` : 206
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 161
- `src/components/Sidebar/index.tsx` : 1034, 1071
- `src/components/compare/CompareModels.tsx` : 81

#### `#EDE1D7` — 9

- `src/app/(onboarding)/onboarding/plans/page.tsx` : 454, 454, 484, 484, 629, 646, 650, 662, 662

#### `rgba(59, 54, 50, 0.12)` — 9

- `src/components/ApprovalCard/index.tsx` : 17
- `src/components/EditProjectModal/index.tsx` : 202
- `src/components/SystemInstructionsModal/index.tsx` : 117
- `src/components/chat/AnimatedCodeBlock.tsx` : 86
- `src/components/chat/ChatShareOverlay.tsx` : 236
- `src/components/compare/CompareModels.tsx` : 1487
- `src/components/layout/RightSidebar.tsx` : 544, 618, 701

#### `#DC2626` — 8

- `src/app/(app)/agent/configure/layout.tsx` : 1036, 1037
- `src/components/ChatSelectionBar/index.tsx` : 48
- `src/components/chat/AttachmentManager.tsx` : 313, 431
- `src/components/chat/ConnectorPrompts.tsx` : 92, 255
- `src/components/connectors/SetupModal.tsx` : 203

#### `rgba(82, 75, 71, 0.18)` — 8

- `src/app/(app)/agents/page.tsx` : 2248
- `src/components/ChangeAgentModelModal/shared.tsx` : 16
- `src/components/DeleteProjectModal/index.tsx` : 78
- `src/components/GlobalSearchModal/index.tsx` : 24
- `src/components/MoveToProjectModal/index.tsx` : 14
- `src/components/QuestionCard/index.tsx` : 170
- `src/components/onboarding/WelcomeModal.tsx` : 43
- `src/context/nav-guard-context.tsx` : 224

#### `rgba(38, 33, 30, 0.16)` — 7

- `src/app/(app)/agent/configure/connectors/page.tsx` : 266
- `src/app/(app)/agent/configure/instructions/page.tsx` : 1462
- `src/app/(app)/agent/configure/knowledge/page.tsx` : 602
- `src/app/(app)/agent/configure/layout.tsx` : 1189
- `src/app/(app)/agent/configure/profile/page.tsx` : 468
- `src/app/(app)/agent/configure/sharing/page.tsx` : 230
- `src/components/chat/XmlMap.module.css` : 270

#### `rgba(59, 54, 50, 0.08)` — 7

- `src/app/(app)/agent/configure/instructions/page.tsx` : 1819
- `src/app/(app)/agent/configure/layout.tsx` : 1082, 1107
- `src/components/HighlightCard/index.tsx` : 22
- `src/components/MessageBubble/index.tsx` : 191
- `src/lib/pin-markdown.tsx` : 34, 52

#### `rgba(24, 2, 2, 0.05)` — 7

- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 1323, 1359, 1398
- `src/app/(app)/settings/(shell)/(org)/members/page.tsx` : 36
- `src/app/(app)/settings/(shell)/account/page.tsx` : 990
- `src/app/(app)/settings/(shell)/files/page.tsx` : 388
- `src/app/(app)/settings/(shell)/security/page.tsx` : 601

#### `rgba(24, 2, 2, 0.15)` — 7

- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 1323, 1359, 1398
- `src/app/(app)/settings/(shell)/(org)/members/page.tsx` : 36
- `src/app/(app)/settings/(shell)/account/page.tsx` : 990
- `src/app/(app)/settings/(shell)/files/page.tsx` : 388
- `src/app/(app)/settings/(shell)/security/page.tsx` : 601

#### `#3B3632` — 7

- `src/app/(onboarding)/onboarding/_components/onboarding-shell.tsx` : 75, 88
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 64
- `src/app/(onboarding)/onboarding/connectors/page.tsx` : 63
- `src/app/org-invite/[inviteId]/page.tsx` : 78, 87
- `src/components/compare/CompareModels.tsx` : 83

#### `rgba(20, 12, 5, 0.2)` — 6

- `src/app/(app)/settings/(shell)/files/page.tsx` : 148
- `src/app/(app)/settings/(shell)/security/page.tsx` : 67
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 254
- `src/app/(standalone)/org/change-plan/page.tsx` : 71
- `src/components/AiModelsView/index.tsx` : 90
- `src/components/compare/CompareModels.tsx` : 54

#### `rgba(126, 84, 53, 0.5)` — 6

- `src/app/(app)/settings/(shell)/files/page.tsx` : 148
- `src/app/(app)/settings/(shell)/security/page.tsx` : 67
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 254
- `src/app/(standalone)/org/change-plan/page.tsx` : 71
- `src/components/AiModelsView/index.tsx` : 90
- `src/components/compare/CompareModels.tsx` : 54

#### `rgba(250, 241, 235, 0.7)` — 6

- `src/app/(app)/settings/(shell)/files/page.tsx` : 169
- `src/app/(app)/settings/(shell)/security/page.tsx` : 67
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 257
- `src/app/(standalone)/org/change-plan/page.tsx` : 76
- `src/components/AiModelsView/index.tsx` : 91
- `src/components/compare/CompareModels.tsx` : 63

#### `rgba(126, 84, 53, 0.1)` — 6

- `src/app/(app)/settings/(shell)/files/page.tsx` : 169
- `src/app/(app)/settings/(shell)/security/page.tsx` : 67
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 257
- `src/app/(standalone)/org/change-plan/page.tsx` : 76
- `src/components/AiModelsView/index.tsx` : 91
- `src/components/compare/CompareModels.tsx` : 63

#### `rgba(20, 16, 5, 0.2)` — 6

- `src/app/(app)/settings/(shell)/security/page.tsx` : 94
- `src/app/(app)/settings/(shell)/usage/page.tsx` : 60
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 458
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 133
- `src/app/(standalone)/org/change-plan/page.tsx` : 72
- `src/components/RoleBadge/index.tsx` : 40

#### `rgba(26, 23, 20, 0.24)` — 6

- `src/components/EditProjectModal/index.tsx` : 202
- `src/components/SystemInstructionsModal/index.tsx` : 117
- `src/components/chat/ChatShareOverlay.tsx` : 236
- `src/components/layout/RightSidebar.tsx` : 544, 618, 701

#### `rgba(82, 75, 71, 0.09)` — 6

- `src/components/chat/XmlEmail.tsx` : 308
- `src/components/chat/XmlFunnel.tsx` : 54
- `src/components/chat/XmlKanban.tsx` : 50
- `src/components/chat/XmlMap.module.css` : 196
- `src/components/chat/XmlSchedule.tsx` : 43, 143

#### `rgba(231, 244, 253, 0.7)` — 5

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 86
- `src/app/(app)/settings/(shell)/files/page.tsx` : 115
- `src/app/(standalone)/org/change-plan/page.tsx` : 603
- `src/components/AiModelsView/index.tsx` : 67
- `src/components/VisibilityRow/index.tsx` : 16

#### `rgba(13, 110, 178, 0.1)` — 5

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 86
- `src/app/(app)/settings/(shell)/files/page.tsx` : 115
- `src/app/(standalone)/org/change-plan/page.tsx` : 603
- `src/components/AiModelsView/index.tsx` : 67
- `src/components/VisibilityRow/index.tsx` : 16

#### `rgba(18, 12, 8, 0.2)` — 5

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 691, 711, 731
- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 420
- `src/components/AiModelsView/index.tsx` : 72

#### `rgba(106, 98, 93, 0.5)` — 5

- `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` : 691, 711, 731
- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 420
- `src/components/AiModelsView/index.tsx` : 72

#### `rgba(128, 183, 7, 0.5)` — 5

- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 138
- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 438
- `src/app/(app)/settings/(shell)/security/page.tsx` : 40
- `src/components/AiModelsView/index.tsx` : 84
- `src/components/compare/CompareModels.tsx` : 56

#### `rgba(250, 246, 235, 0.7)` — 5

- `src/app/(app)/settings/(shell)/security/page.tsx` : 94
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 461
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 133
- `src/app/(standalone)/org/change-plan/page.tsx` : 77
- `src/components/RoleBadge/index.tsx` : 42

#### `rgba(143, 116, 39, 0.1)` — 5

- `src/app/(app)/settings/(shell)/security/page.tsx` : 94
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 461
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 133
- `src/app/(standalone)/org/change-plan/page.tsx` : 77
- `src/components/RoleBadge/index.tsx` : 43

#### `#0D6EB2` — 5

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 85
- `src/app/(onboarding)/onboarding/join/page.tsx` : 121
- `src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx` : 98
- `src/app/org-invite/[inviteId]/page.tsx` : 105, 106

#### `rgba(130, 122, 116, 0.12)` — 5

- `src/app/(app)/slack/link/page.tsx` : 32
- `src/components/ConnectorRequestModal/index.tsx` : 14
- `src/components/InviteModal/index.tsx` : 16
- `src/components/ShareModal/index.tsx` : 23
- `src/components/SlackConnectModal/index.tsx` : 13

#### `rgba(82, 75, 71, 0.08)` — 5

- `src/components/SystemInstructionsModal/index.tsx` : 245, 262
- `src/components/WorkspaceConnectorCard/index.tsx` : 33
- `src/components/chat/XmlEmail.tsx` : 181
- `src/components/chat/XmlMap.module.css` : 255

#### `#6E98CB` — 4

- `src/app/(app)/agent/configure/layout.tsx` : 400, 441, 451
- `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` : 1434

#### `#FFF5F5` — 4

- `src/app/(app)/brain/BrainSidebarSections.tsx` : 199
- `src/components/layout/ChatHistoryItem.tsx` : 234
- `src/components/layout/LeftSidebar.tsx` : 463, 886

#### `rgba(143, 116, 39, 0.5)` — 4

- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 993
- `src/app/(app)/settings/(shell)/security/page.tsx` : 94
- `src/app/(app)/settings/billing/change-plan/page.tsx` : 458
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 133

#### `rgba(17, 25, 1, 0.2)` — 4

- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 438
- `src/app/(app)/settings/(shell)/security/page.tsx` : 40
- `src/components/AiModelsView/index.tsx` : 84
- `src/components/compare/CompareModels.tsx` : 56

#### `rgba(247, 254, 230, 0.7)` — 4

- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 438
- `src/app/(app)/settings/(shell)/security/page.tsx` : 40
- `src/components/AiModelsView/index.tsx` : 85
- `src/components/compare/CompareModels.tsx` : 65

#### `rgba(128, 183, 7, 0.1)` — 4

- `src/app/(app)/settings/(shell)/preferences/page.tsx` : 438
- `src/app/(app)/settings/(shell)/security/page.tsx` : 40
- `src/components/AiModelsView/index.tsx` : 85
- `src/components/compare/CompareModels.tsx` : 65

#### `rgba(82, 75, 71, 0.06)` — 4

- `src/components/AiModelsView/index.tsx` : 219
- `src/components/ApprovalCard/index.tsx` : 18
- `src/components/chat/XmlEmail.tsx` : 265, 374

#### `rgba(59, 54, 50, 0.28)` — 4

- `src/components/ChatSelectionBar/index.tsx` : 8
- `src/components/EditProjectModal/index.tsx` : 306
- `src/components/MoveToProjectModal/index.tsx` : 145
- `src/components/chat/AnimatedCodeBlock.tsx` : 86

#### `rgba(82, 75, 71, 0.05)` — 4

- `src/components/ConnectorCard/index.tsx` : 17
- `src/components/ConnectorRequestRow/index.tsx` : 13
- `src/components/UndoToast/index.tsx` : 14
- `src/components/chat/XmlSchedule.tsx` : 143

#### `rgba(82, 75, 71, 0.07)` — 4

- `src/components/chat/XmlFunnel.tsx` : 54
- `src/components/chat/XmlKanban.tsx` : 50, 144
- `src/components/chat/XmlSchedule.tsx` : 43

#### `#5E6AD2` — 4

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 10, 10, 10, 10

#### `rgba(38, 33, 30, 0.18)` — 3

- `src/app/(app)/agent/configure/components/ConnectorsTab.tsx` : 224
- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 289
- `src/components/chat/XmlMap.module.css` : 264

#### `rgba(59, 54, 50, 0.10)` — 3

- `src/app/(app)/agent/configure/layout.tsx` : 695
- `src/components/HighlightCard/index.tsx` : 21
- `src/components/chat/AnimatedCodeBlock.tsx` : 101

#### `#CADCF1` — 3

- `src/app/(app)/agents/page.tsx` : 183
- `src/app/(app)/settings/(shell)/usage/page.tsx` : 33
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 71

#### `rgba(74, 131, 191, 0.25)` — 3

- `src/app/(app)/projects/new/page.tsx` : 258
- `src/components/EditProjectModal/index.tsx` : 155
- `src/components/SystemInstructionsModal/index.tsx` : 256

#### `#F87171` — 3

- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 309
- `src/components/chat/AttachmentManager.tsx` : 256, 373

#### `#6D5921` — 3

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 32
- `src/app/(onboarding)/onboarding/plans/page.tsx` : 131, 700

#### `rgba(114, 105, 98, 0.08)` — 3

- `src/app/(app)/souvenir-slack/slack-config.module.css` : 71, 185, 208

#### `#C62B29` — 3

- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 86, 103, 147

#### `rgba(59, 54, 50, 0.2)` — 3

- `src/app/(onboarding)/onboarding/plans/page.tsx` : 265, 406
- `src/components/ApprovalCard/index.tsx` : 99

#### `#A09890` — 3

- `src/app/(onboarding)/onboarding/plans/page.tsx` : 721, 722
- `src/components/ApprovalCard/index.tsx` : 486

#### `#004A97` — 3

- `src/components/CardBrandLogo/index.tsx` : 147, 148, 149

#### `#EF4444` — 3

- `src/components/EditProjectModal/index.tsx` : 51, 322
- `src/components/ProjectFilesPanel/index.tsx` : 229

#### `rgba(59, 54, 50, 0.06)` — 3

- `src/components/HighlightCard/index.tsx` : 21
- `src/lib/pin-markdown.tsx` : 28, 48

#### `rgba(18, 60, 95, 0.65)` — 3

- `src/components/TeamSwitcher/index.tsx` : 59
- `src/components/TeamSwitcherDropdown/index.tsx` : 143
- `src/components/TeamSwitcherRow/index.tsx` : 105

#### `#D4D4D4` — 2

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 323
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 113

#### `rgba(106, 98, 93, 0.1)` — 2

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 420
- `src/components/AiModelsView/index.tsx` : 73

#### `rgba(110, 152, 203, 0.85)` — 2

- `src/app/(app)/agent/configure/layout.tsx` : 267, 275

#### `#EFF6FF` — 2

- `src/app/(app)/agent/configure/layout.tsx` : 925
- `src/components/SaveVersionModal/index.tsx` : 44

#### `#BFDBFE` — 2

- `src/app/(app)/agent/configure/layout.tsx` : 925
- `src/components/SaveVersionModal/index.tsx` : 48

#### `rgba(238, 48, 48, 0.22)` — 2

- `src/app/(app)/agents/page.tsx` : 2302
- `src/components/DeleteProjectModal/index.tsx` : 132

#### `#FECACA` — 2

- `src/app/(app)/settings/(shell)/SettingsSkeleton.tsx` : 64
- `src/components/chat/ConnectorPrompts.tsx` : 93

#### `#135487` — 2

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 33
- `src/app/(onboarding)/onboarding/setup/page.tsx` : 82

#### `#16A34A` — 2

- `src/app/(app)/souvenir-slack/page.tsx` : 126
- `src/components/chat/AttachmentManager.tsx` : 418

#### `rgba(18, 12, 8, 0.18)` — 2

- `src/components/AgentShareModal/index.tsx` : 160
- `src/components/ProjectShareModal/index.tsx` : 73

#### `rgba(82, 75, 71, 0.10)` — 2

- `src/components/ApprovalCard/index.tsx` : 17
- `src/components/chat/XmlEmail.tsx` : 181

#### `#E21836` — 2

- `src/components/CardBrandLogo/index.tsx` : 64, 160

#### `#999999` — 2

- `src/components/CardBrandLogo/index.tsx` : 194, 195

#### `rgba(59, 54, 50, 0.14)` — 2

- `src/components/HighlightCard/index.tsx` : 22
- `src/components/MoveToProjectModal/index.tsx` : 16

#### `rgba(59, 54, 50, 0.5)` — 2

- `src/components/QuestionCard/index.tsx` : 85
- `src/components/UsageBarChart/index.tsx` : 109

#### `rgba(18, 12, 8, 0.22)` — 2

- `src/components/chat/AnimatedLineChart.tsx` : 116
- `src/components/chat/XmlChart.tsx` : 393

#### `rgba(30, 28, 27, .28)` — 2

- `src/components/connectors/RemoveModal.tsx` : 38
- `src/components/connectors/SetupModal.tsx` : 47

#### `#111111` — 2

- `src/lib/export-pins.ts` : 59, 91

#### `#000000` — 2

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 8, 40

#### `#E01E5A` — 2

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 42, 42

#### `#36C5F0` — 2

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 42, 42

#### `#2EB67D` — 2

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 42, 42

#### `#ECB22E` — 2

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 42, 42

#### `#C2600F` — 1

- `src/app/(app)/agent/configure/components/AttributeTrackerRail.tsx` : 90

#### `#9CA3AF` — 1

- `src/app/(app)/agent/configure/components/AttributeTrackerRail.tsx` : 90

#### `rgba(82, 75, 71, 0.45)` — 1

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 153

#### `rgba(255, 255, 255, 0.7)` — 1

- `src/app/(app)/agent/configure/components/ProfileTab.tsx` : 420

#### `#FFEDD5` — 1

- `src/app/(app)/agent/configure/instructions/page.tsx` : 1821

#### `#C2410C` — 1

- `src/app/(app)/agent/configure/instructions/page.tsx` : 1821

#### `rgba(194, 65, 12, 0.2)` — 1

- `src/app/(app)/agent/configure/instructions/page.tsx` : 1821

#### `rgba(110, 152, 203, 0.08)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 396

#### `rgba(110, 152, 203, 0.35)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 396

#### `rgba(110, 152, 203, 0.5)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 400

#### `#3B6FA8` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 406

#### `rgba(110, 152, 203, 0.4)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 459

#### `rgba(59, 54, 50, 0.07)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 695

#### `#2563EB` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 926

#### `rgba(220, 38, 38, 0.4)` — 1

- `src/app/(app)/agent/configure/layout.tsx` : 1034

#### `rgba(18, 12, 8, 0.08)` — 1

- `src/app/(app)/chats/page.tsx` : 632

#### `rgba(17, 25, 1, 0.1)` — 1

- `src/app/(app)/settings/(shell)/(org)/general/page.tsx` : 993

#### `rgba(38, 33, 30, 0.55)` — 1

- `src/app/(app)/settings/(shell)/account/page.tsx` : 717

#### `#FFBFB6` — 1

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 34

#### `#7A201C` — 1

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 34

#### `#C7B387` — 1

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 37

#### `#0485F7` — 1

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 38

#### `#EE3030` — 1

- `src/app/(app)/settings/(shell)/usage/page.tsx` : 39

#### `rgba(59, 54, 50, 0.15)` — 1

- `src/app/(app)/share/[id]/page.tsx` : 245

#### `rgba(13, 110, 178, 0.15)` — 1

- `src/app/(app)/share/[id]/page.tsx` : 356

#### `rgba(82, 75, 71, .03)` — 1

- `src/app/(app)/souvenir-slack/slack-config.module.css` : 157

#### `rgba(82, 75, 71, .14)` — 1

- `src/app/(app)/souvenir-slack/slack-config.module.css` : 263

#### `rgba(82, 75, 71, .12)` — 1

- `src/app/(app)/souvenir-slack/slack-config.module.css` : 271

#### `rgba(82, 75, 71, 0.04)` — 1

- `src/app/(app)/souvenir-slack/slack-config.module.css` : 287

#### `#DCD1C8` — 1

- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 35

#### `#8A8078` — 1

- `src/app/(onboarding)/onboarding/_components/step-shell.tsx` : 311

#### `#BFDA84` — 1

- `src/app/(onboarding)/onboarding/plans/page.tsx` : 66

#### `#EEF4FB` — 1

- `src/components/AgentEditor/SyncNotice.tsx` : 26

#### `rgba(24, 2, 2, 0.2)` — 1

- `src/components/AiModelsView/index.tsx` : 78

#### `rgba(159, 38, 35, 0.5)` — 1

- `src/components/AiModelsView/index.tsx` : 78

#### `rgba(253, 231, 231, 0.7)` — 1

- `src/components/AiModelsView/index.tsx` : 79

#### `rgba(159, 38, 35, 0.1)` — 1

- `src/components/AiModelsView/index.tsx` : 79

#### `rgba(10, 2, 24, 0.2)` — 1

- `src/components/AiModelsView/index.tsx` : 96

#### `rgba(109, 40, 217, 0.5)` — 1

- `src/components/AiModelsView/index.tsx` : 96

#### `rgba(237, 233, 254, 0.7)` — 1

- `src/components/AiModelsView/index.tsx` : 97

#### `rgba(109, 40, 217, 0.1)` — 1

- `src/components/AiModelsView/index.tsx` : 97

#### `#6D28D9` — 1

- `src/components/AiModelsView/index.tsx` : 98

#### `rgba(0, 0, 0, 0.2)` — 1

- `src/components/CardBrandLogo/index.tsx` : 27

#### `#1A1F71` — 1

- `src/components/CardBrandLogo/index.tsx` : 40

#### `#252525` — 1

- `src/components/CardBrandLogo/index.tsx` : 44

#### `#006FCF` — 1

- `src/components/CardBrandLogo/index.tsx` : 48

#### `#EB001B` — 1

- `src/components/CardBrandLogo/index.tsx` : 91

#### `#F79E1B` — 1

- `src/components/CardBrandLogo/index.tsx` : 92

#### `#FF5F00` — 1

- `src/components/CardBrandLogo/index.tsx` : 95

#### `#FF6600` — 1

- `src/components/CardBrandLogo/index.tsx` : 131

#### `#0E4C96` — 1

- `src/components/CardBrandLogo/index.tsx` : 159

#### `#007B40` — 1

- `src/components/CardBrandLogo/index.tsx` : 161

#### `#BBBBBB` — 1

- `src/components/CardBrandLogo/index.tsx` : 196

#### `rgba(220, 195, 140, 0.6)` — 1

- `src/components/ModelFeaturedCard/index.tsx` : 232

#### `rgba(220, 195, 140, 0.25)` — 1

- `src/components/ModelFeaturedCard/index.tsx` : 232

#### `#D8C9A7` — 1

- `src/components/OptionRow/index.tsx` : 39

#### `#8A7F79` — 1

- `src/components/OptionRow/index.tsx` : 286

#### `#4A4A4A` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 133

#### `#030303` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 133

#### `#8CC8FF` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 134

#### `#0A4FB0` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 134

#### `#B4CEF0` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 135

#### `#2F5F9E` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 135

#### `#D9A28A` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 140

#### `#8A3F22` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 140

#### `#A9C7B9` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 141

#### `#2F6A55` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 141

#### `#C3BDE6` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 142

#### `#4B4392` — 1

- `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` : 142

#### `rgba(212, 212, 212, 0.3)` — 1

- `src/components/QuestionCard/index.tsx` : 170

#### `#1D4ED8` — 1

- `src/components/SaveVersionModal/index.tsx` : 54

#### `rgba(38, 33, 30, 0.04)` — 1

- `src/components/TeamSwitcher/index.tsx` : 157

#### `#1E1A17` — 1

- `src/components/chat/AnimatedCodeBlock.tsx` : 86

#### `rgba(59, 54, 50, 0.35)` — 1

- `src/components/chat/AnimatedCodeBlock.tsx` : 101

#### `#683D1B` — 1

- `src/components/chat/ChatMessage.tsx` : 1192

#### `#80B707` — 1

- `src/components/chat/ChatMessage.tsx` : 1199

#### `#EEF5FC` — 1

- `src/components/chat/ChatShareOverlay.tsx` : 345

#### `#A8CDEC` — 1

- `src/components/chat/ChatShareOverlay.tsx` : 347

#### `rgba(18, 12, 8, 0.28)` — 1

- `src/components/chat/MermaidDiagram.tsx` : 157

#### `#FFF8E8` — 1

- `src/components/chat/XmlWeather.tsx` : 37

#### `#FFFDF8` — 1

- `src/components/chat/XmlWeather.tsx` : 37

#### `#F8EBDD` — 1

- `src/components/chat/XmlWeather.tsx` : 37

#### `#D98A21` — 1

- `src/components/chat/XmlWeather.tsx` : 38

#### `rgba(217, 138, 33, 0.18)` — 1

- `src/components/chat/XmlWeather.tsx` : 39

#### `rgba(244, 177, 61, 0.30)` — 1

- `src/components/chat/XmlWeather.tsx` : 40

#### `#7B4C16` — 1

- `src/components/chat/XmlWeather.tsx` : 41

#### `#F2F7FC` — 1

- `src/components/chat/XmlWeather.tsx` : 44

#### `#FCFAF7` — 1

- `src/components/chat/XmlWeather.tsx` : 44

#### `#EEE8E0` — 1

- `src/components/chat/XmlWeather.tsx` : 44

#### `#6684A5` — 1

- `src/components/chat/XmlWeather.tsx` : 45

#### `rgba(102, 132, 165, 0.16)` — 1

- `src/components/chat/XmlWeather.tsx` : 46

#### `rgba(123, 161, 199, 0.25)` — 1

- `src/components/chat/XmlWeather.tsx` : 47

#### `#3F5870` — 1

- `src/components/chat/XmlWeather.tsx` : 48

#### `#F1F2F3` — 1

- `src/components/chat/XmlWeather.tsx` : 51

#### `#FCFBFA` — 1

- `src/components/chat/XmlWeather.tsx` : 51

#### `#E9E6E2` — 1

- `src/components/chat/XmlWeather.tsx` : 51

#### `#75808A` — 1

- `src/components/chat/XmlWeather.tsx` : 52

#### `rgba(117, 128, 138, 0.16)` — 1

- `src/components/chat/XmlWeather.tsx` : 53

#### `rgba(144, 153, 162, 0.24)` — 1

- `src/components/chat/XmlWeather.tsx` : 54

#### `#505961` — 1

- `src/components/chat/XmlWeather.tsx` : 55

#### `#EAF3FA` — 1

- `src/components/chat/XmlWeather.tsx` : 58

#### `#F8FBFC` — 1

- `src/components/chat/XmlWeather.tsx` : 58

#### `#E5ECF2` — 1

- `src/components/chat/XmlWeather.tsx` : 58

#### `#3979A7` — 1

- `src/components/chat/XmlWeather.tsx` : 59

#### `rgba(57, 121, 167, 0.16)` — 1

- `src/components/chat/XmlWeather.tsx` : 60

#### `rgba(71, 142, 193, 0.24)` — 1

- `src/components/chat/XmlWeather.tsx` : 61

#### `#285A7D` — 1

- `src/components/chat/XmlWeather.tsx` : 62

#### `#ECEAF1` — 1

- `src/components/chat/XmlWeather.tsx` : 65

#### `#F8F7FA` — 1

- `src/components/chat/XmlWeather.tsx` : 65

#### `#E3DFE8` — 1

- `src/components/chat/XmlWeather.tsx` : 65

#### `#6D5C91` — 1

- `src/components/chat/XmlWeather.tsx` : 66

#### `rgba(109, 92, 145, 0.16)` — 1

- `src/components/chat/XmlWeather.tsx` : 67

#### `rgba(114, 90, 161, 0.24)` — 1

- `src/components/chat/XmlWeather.tsx` : 68

#### `#4F426B` — 1

- `src/components/chat/XmlWeather.tsx` : 69

#### `#ECF7FA` — 1

- `src/components/chat/XmlWeather.tsx` : 72

#### `#E7F0F4` — 1

- `src/components/chat/XmlWeather.tsx` : 72

#### `#5C92A8` — 1

- `src/components/chat/XmlWeather.tsx` : 73

#### `rgba(92, 146, 168, 0.15)` — 1

- `src/components/chat/XmlWeather.tsx` : 74

#### `rgba(114, 180, 204, 0.22)` — 1

- `src/components/chat/XmlWeather.tsx` : 75

#### `#416B7B` — 1

- `src/components/chat/XmlWeather.tsx` : 76

#### `#F0F0ED` — 1

- `src/components/chat/XmlWeather.tsx` : 79

#### `#FCFBF8` — 1

- `src/components/chat/XmlWeather.tsx` : 79

#### `#E8E6E1` — 1

- `src/components/chat/XmlWeather.tsx` : 79

#### `#7F817D` — 1

- `src/components/chat/XmlWeather.tsx` : 80

#### `rgba(127, 129, 125, 0.14)` — 1

- `src/components/chat/XmlWeather.tsx` : 81

#### `rgba(154, 155, 151, 0.22)` — 1

- `src/components/chat/XmlWeather.tsx` : 82

#### `#5C5E5A` — 1

- `src/components/chat/XmlWeather.tsx` : 83

#### `#EDF7F5` — 1

- `src/components/chat/XmlWeather.tsx` : 86

#### `#FAFCFB` — 1

- `src/components/chat/XmlWeather.tsx` : 86

#### `#E5EFEC` — 1

- `src/components/chat/XmlWeather.tsx` : 86

#### `#4D8B7B` — 1

- `src/components/chat/XmlWeather.tsx` : 87

#### `rgba(77, 139, 123, 0.15)` — 1

- `src/components/chat/XmlWeather.tsx` : 88

#### `rgba(83, 158, 139, 0.22)` — 1

- `src/components/chat/XmlWeather.tsx` : 89

#### `#356558` — 1

- `src/components/chat/XmlWeather.tsx` : 90

#### `#F5F1EC` — 1

- `src/components/chat/XmlWeather.tsx` : 93

#### `#FFFDFC` — 1

- `src/components/chat/XmlWeather.tsx` : 93

#### `#EEE9E3` — 1

- `src/components/chat/XmlWeather.tsx` : 93

#### `#82766C` — 1

- `src/components/chat/XmlWeather.tsx` : 94

#### `rgba(130, 118, 108, 0.14)` — 1

- `src/components/chat/XmlWeather.tsx` : 95

#### `rgba(149, 134, 121, 0.20)` — 1

- `src/components/chat/XmlWeather.tsx` : 96

#### `#5F564F` — 1

- `src/components/chat/XmlWeather.tsx` : 97

#### `rgba(255, 255, 255, 0.72)` — 1

- `src/components/chat/XmlWeather.tsx` : 202

#### `#E2D9D1` — 1

- `src/components/onboarding/WelcomeModal.tsx` : 78

#### `#E1E1E1` — 1

- `src/lib/export-pins.ts` : 50

#### `#222222` — 1

- `src/lib/export-pins.ts` : 63

#### `#888888` — 1

- `src/lib/export-pins.ts` : 67

#### `#666666` — 1

- `src/lib/export-pins.ts` : 72

#### `#444444` — 1

- `src/lib/export-pins.ts` : 78

#### `#555555` — 1

- `src/lib/export-pins.ts` : 97

#### `#92400E` — 1

- `src/lib/pin-markdown.tsx` : 85

#### `#4FACDE` — 1

- `src/lib/team-gradients.ts` : 8

#### `#2D8BBF` — 1

- `src/lib/team-gradients.ts` : 8

#### `#9B6FE0` — 1

- `src/lib/team-gradients.ts` : 9

#### `#7B4FC0` — 1

- `src/lib/team-gradients.ts` : 9

#### `#F59542` — 1

- `src/lib/team-gradients.ts` : 10

#### `#D4742A` — 1

- `src/lib/team-gradients.ts` : 10

#### `#4CAF78` — 1

- `src/lib/team-gradients.ts` : 11

#### `#2D8F58` — 1

- `src/lib/team-gradients.ts` : 11

#### `#E06060` — 1

- `src/lib/team-gradients.ts` : 12

#### `#B83C3C` — 1

- `src/lib/team-gradients.ts` : 12

#### `#60A8E0` — 1

- `src/lib/team-gradients.ts` : 13

#### `#3C80C0` — 1

- `src/lib/team-gradients.ts` : 13

#### `#22C55E` — 1

- `src/templates/Brain/BrainContentRenderer.tsx` : 174

#### `#FEF08A` — 1

- `src/templates/Brain/ScheduleDetailView.tsx` : 284

#### `#7856FF` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 12

#### `#EA4335` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 14

#### `#4285F4` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 16

#### `#F24E1E` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 18

#### `#181717` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 20

#### `#18BFFF` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 22

#### `#F06A6A` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 24

#### `#0052CC` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 26

#### `#FF7A59` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 28

#### `#635BFF` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 30

#### `#FF4F00` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 32

#### `#03363D` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 34

#### `#1F8EED` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 36

#### `#146EF5` — 1

- `src/templates/Brain/lib/ConnectorIcon.tsx` : 38

---

## 3. Hard-coded colours — by file

| File | Uses | Distinct values | Art/brand |
|---|---:|---:|---|
| `src/app/(onboarding)/onboarding/plans/page.tsx` | 75 | 24 |  |
| `src/components/chat/XmlWeather.tsx` | 64 | 64 | yes |
| `src/app/(app)/agent/configure/layout.tsx` | 34 | 25 |  |
| `src/components/AiModelsView/index.tsx` | 31 | 26 |  |
| `src/components/compare/CompareModels.tsx` | 30 | 20 |  |
| `src/templates/Brain/lib/ConnectorIcon.tsx` | 28 | 20 | yes |
| `src/app/(app)/settings/(shell)/security/page.tsx` | 26 | 21 |  |
| `src/app/(app)/settings/billing/change-plan/page.tsx` | 26 | 16 |  |
| `src/components/CardBrandLogo/index.tsx` | 22 | 16 | yes |
| `src/components/onboarding/WelcomeModal.tsx` | 20 | 11 |  |
| `src/app/(app)/agent/configure/components/KnowledgeTab.tsx` | 19 | 11 |  |
| `src/app/(app)/agent/configure/components/ProfileTab.tsx` | 19 | 13 |  |
| `src/components/QuestionCard/index.tsx` | 19 | 12 |  |
| `src/components/PersonaCard/AnimatedPersonaAvatar.tsx` | 18 | 13 | yes |
| `src/app/(standalone)/org/change-plan/page.tsx` | 17 | 15 |  |
| `src/app/(app)/settings/(shell)/plans-and-billing/page.tsx` | 16 | 9 |  |
| `src/app/(app)/settings/(shell)/(org)/general/page.tsx` | 15 | 8 |  |
| `src/app/(app)/settings/(shell)/files/page.tsx` | 14 | 13 |  |
| `src/app/(app)/settings/(shell)/preferences/page.tsx` | 14 | 9 |  |
| `src/app/(onboarding)/onboarding/_components/step-shell.tsx` | 14 | 10 |  |
| `src/app/(app)/settings/(shell)/account/page.tsx` | 13 | 11 |  |
| `src/app/(app)/settings/(shell)/usage/page.tsx` | 12 | 11 |  |
| `src/components/ApprovalCard/index.tsx` | 12 | 10 |  |
| `src/lib/team-gradients.ts` | 12 | 12 | yes |
| `src/app/(app)/agent/configure/instructions/page.tsx` | 10 | 10 |  |
| `src/app/(app)/agents/page.tsx` | 10 | 6 |  |
| `src/app/(onboarding)/onboarding/profile/page.tsx` | 10 | 4 |  |
| `src/components/OptionRow/index.tsx` | 10 | 8 |  |
| `src/components/chat/AnimatedTable.tsx` | 10 | 2 |  |
| `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` | 9 | 4 |  |
| `src/app/(onboarding)/onboarding/workspace/page.tsx` | 9 | 5 |  |
| `src/components/EditProjectModal/index.tsx` | 9 | 6 |  |
| `src/components/ReportBugModal/index.tsx` | 9 | 9 |  |
| `src/components/RequestDemoModal/index.tsx` | 9 | 9 |  |
| `src/lib/export-pins.ts` | 9 | 8 |  |
| `src/app/(app)/agent/configure/components/ExampleConversationModal.tsx` | 8 | 5 |  |
| `src/app/(onboarding)/onboarding/join/page.tsx` | 8 | 6 |  |
| `src/app/(onboarding)/onboarding/setup/page.tsx` | 8 | 6 |  |
| `src/components/SystemInstructionsModal/index.tsx` | 7 | 5 |  |
| `src/components/chat/XmlMap.module.css` | 7 | 5 |  |
| `src/app/(onboarding)/onboarding/account-type/page.tsx` | 7 | 5 |  |
| `src/app/(app)/souvenir-slack/slack-config.module.css` | 7 | 5 |  |
| `src/app/(app)/settings/(shell)/(org)/members/page.tsx` | 6 | 5 |  |
| `src/app/(onboarding)/onboarding/hello/page.tsx` | 6 | 5 |  |
| `src/app/(onboarding)/onboarding/tone/page.tsx` | 6 | 5 |  |
| `src/components/ProjectChatRow/index.tsx` | 6 | 6 |  |
| `src/components/ShareModal/index.tsx` | 6 | 3 |  |
| `src/app/(onboarding)/onboarding/connectors/page.tsx` | 6 | 4 |  |
| `src/components/chat/AnimatedCodeBlock.tsx` | 6 | 6 |  |
| `src/components/layout/RightSidebar.tsx` | 6 | 2 |  |
| `src/app/(onboarding)/onboarding/team/[inviteId]/_components/invite-ui.tsx` | 5 | 4 |  |
| `src/components/TeamSwitcher/index.tsx` | 5 | 5 |  |
| `src/components/VisibilityRow/index.tsx` | 5 | 5 |  |
| `src/components/chat/ChatShareOverlay.tsx` | 5 | 5 |  |
| `src/app/(onboarding)/onboarding/_components/add-to-slack-modal.tsx` | 5 | 4 |  |
| `src/app/(onboarding)/onboarding/team/[inviteId]/page.tsx` | 5 | 4 |  |
| `src/app/org-invite/[inviteId]/page.tsx` | 5 | 3 |  |
| `src/components/chat/AttachmentManager.tsx` | 5 | 3 |  |
| `src/lib/pin-markdown.tsx` | 5 | 3 |  |
| `src/components/chat/XmlEmail.tsx` | 5 | 4 |  |
| `src/app/(app)/projects/new/page.tsx` | 4 | 2 |  |
| `src/components/ChatRow/index.tsx` | 4 | 4 |  |
| `src/components/ConnectorRequestModal/index.tsx` | 4 | 2 |  |
| `src/components/SaveVersionModal/index.tsx` | 4 | 4 |  |
| `src/app/(onboarding)/onboarding/_components/onboarding-shell.tsx` | 4 | 3 |  |
| `src/components/RoleBadge/index.tsx` | 4 | 4 |  |
| `src/components/HighlightCard/index.tsx` | 4 | 4 |  |
| `src/components/chat/XmlSchedule.tsx` | 4 | 3 |  |
| `src/app/(app)/agent/configure/connectors/page.tsx` | 3 | 3 |  |
| `src/app/(app)/agent/configure/knowledge/page.tsx` | 3 | 3 |  |
| `src/app/(app)/agent/configure/profile/page.tsx` | 3 | 3 |  |
| `src/app/(app)/agent/configure/sharing/page.tsx` | 3 | 3 |  |
| `src/app/(app)/settings/(shell)/(org)/analytics/page.tsx` | 3 | 1 |  |
| `src/app/(app)/settings/(shell)/help/page.tsx` | 3 | 3 |  |
| `src/app/(app)/settings/(shell)/notifications/page.tsx` | 3 | 2 |  |
| `src/app/(app)/share/[id]/page.tsx` | 3 | 3 |  |
| `src/components/ConnectorRow/index.tsx` | 3 | 2 |  |
| `src/components/ContactSalesModal/index.tsx` | 3 | 3 |  |
| `src/components/InviteModal/index.tsx` | 3 | 2 |  |
| `src/components/OptionBadge/index.tsx` | 3 | 3 |  |
| `src/components/ProjectCard/index.tsx` | 3 | 1 |  |
| `src/components/ProjectFilesPanel/index.tsx` | 3 | 3 |  |
| `src/components/RequestFeatureModal/index.tsx` | 3 | 3 |  |
| `src/components/SlackConnectModal/index.tsx` | 3 | 2 |  |
| `src/components/TeamSwitcherRow/index.tsx` | 3 | 3 |  |
| `src/components/VersionCard/index.tsx` | 3 | 3 |  |
| `src/app/(app)/agents/published/page.tsx` | 3 | 3 |  |
| `src/components/chat/ActivityRow.tsx` | 3 | 3 |  |
| `src/components/chat/ChatMessage.tsx` | 3 | 3 |  |
| `src/app/(onboarding)/onboarding/import/page.tsx` | 3 | 2 |  |
| `src/app/(onboarding)/onboarding/pricing/confirmation/page.tsx` | 3 | 3 |  |
| `src/components/LeaveProjectModal/index.tsx` | 3 | 3 |  |
| `src/components/LeaveWorkspaceModal/index.tsx` | 3 | 3 |  |
| `src/components/chat/ConnectorPrompts.tsx` | 3 | 2 |  |
| `src/components/MoveToProjectModal/index.tsx` | 3 | 3 |  |
| `src/components/chat/XmlKanban.tsx` | 3 | 2 |  |
| `src/app/(app)/agent/configure/components/ConnectorsTab.tsx` | 2 | 2 |  |
| `src/app/(app)/agents/new/page.tsx` | 2 | 1 |  |
| `src/app/(app)/settings/(shell)/SettingsSkeleton.tsx` | 2 | 2 |  |
| `src/app/(onboarding)/onboarding/invite/page.tsx` | 2 | 2 |  |
| `src/components/ConnectorCard/index.tsx` | 2 | 2 |  |
| `src/components/ConnectorRequestRow/index.tsx` | 2 | 2 |  |
| `src/components/Pinboard/index.tsx` | 2 | 2 |  |
| `src/components/SidebarProjectsSection/index.tsx` | 2 | 2 |  |
| `src/templates/Brain/PauseCard.tsx` | 2 | 2 |  |
| `src/templates/Brain/ScheduleCard.tsx` | 2 | 1 |  |
| `src/components/chat/ReasoningBlock.tsx` | 2 | 2 |  |
| `src/components/chat/AnimatedBarChart.tsx` | 2 | 1 |  |
| `src/components/chat/AnimatedLineChart.tsx` | 2 | 2 |  |
| `src/components/FlatSidebarProfileRow/index.tsx` | 2 | 2 |  |
| `src/components/ConfirmModal/index.tsx` | 2 | 2 |  |
| `src/components/Sidebar/index.tsx` | 2 | 1 |  |
| `src/components/ChatSelectionBar/index.tsx` | 2 | 2 |  |
| `src/components/connectors/SetupModal.tsx` | 2 | 2 |  |
| `src/components/DeleteProjectModal/index.tsx` | 2 | 2 |  |
| `src/components/chat/XmlFunnel.tsx` | 2 | 2 |  |
| `src/components/layout/LeftSidebar.tsx` | 2 | 1 |  |
| `src/app/(app)/agent/configure/components/AttributeTrackerRail.tsx` | 2 | 2 |  |
| `src/components/ModelFeaturedCard/index.tsx` | 2 | 2 |  |
| `src/app/(app)/agents/templates/page.tsx` | 1 | 1 |  |
| `src/app/(app)/brain/schedules/page.tsx` | 1 | 1 |  |
| `src/app/(app)/settings/(shell)/(org)/activity/page.tsx` | 1 | 1 |  |
| `src/app/globals.css` | 1 | 1 |  |
| `src/components/AgentEditor/ToneField.tsx` | 1 | 1 |  |
| `src/components/AgentEditor/styles.ts` | 1 | 1 |  |
| `src/components/ChatInput/index.tsx` | 1 | 1 |  |
| `src/components/ConnectorCatalogCard/index.tsx` | 1 | 1 |  |
| `src/components/CreditStatusBanner/index.tsx` | 1 | 1 |  |
| `src/components/DocumentCard/index.tsx` | 1 | 1 |  |
| `src/components/InlineCreditNotice/index.tsx` | 1 | 1 |  |
| `src/components/PinboardExpanded/index.tsx` | 1 | 1 |  |
| `src/components/ProjectInstructionsPanel/index.tsx` | 1 | 1 |  |
| `src/components/ProjectListRow/index.tsx` | 1 | 1 |  |
| `src/components/SettingsTable/index.tsx` | 1 | 1 |  |
| `src/components/SlackChannelMappingRow/index.tsx` | 1 | 1 |  |
| `src/components/chat/AnimatedSearchTimeout.tsx` | 1 | 1 |  |
| `src/app/(app)/agent/configure/components/SharingTab.tsx` | 1 | 1 |  |
| `src/components/ChangeAgentModelModal/shared.tsx` | 1 | 1 |  |
| `src/components/GlobalSearchModal/index.tsx` | 1 | 1 |  |
| `src/context/nav-guard-context.tsx` | 1 | 1 |  |
| `src/components/MessageBubble/index.tsx` | 1 | 1 |  |
| `src/app/(app)/slack/link/page.tsx` | 1 | 1 |  |
| `src/components/WorkspaceConnectorCard/index.tsx` | 1 | 1 |  |
| `src/app/(app)/brain/BrainSidebarSections.tsx` | 1 | 1 |  |
| `src/components/layout/ChatHistoryItem.tsx` | 1 | 1 |  |
| `src/components/UndoToast/index.tsx` | 1 | 1 |  |
| `src/components/TeamSwitcherDropdown/index.tsx` | 1 | 1 |  |
| `src/app/(app)/souvenir-slack/page.tsx` | 1 | 1 |  |
| `src/components/AgentShareModal/index.tsx` | 1 | 1 |  |
| `src/components/ProjectShareModal/index.tsx` | 1 | 1 |  |
| `src/components/UsageBarChart/index.tsx` | 1 | 1 |  |
| `src/components/chat/XmlChart.tsx` | 1 | 1 |  |
| `src/components/connectors/RemoveModal.tsx` | 1 | 1 |  |
| `src/app/(app)/chats/page.tsx` | 1 | 1 |  |
| `src/components/AgentEditor/SyncNotice.tsx` | 1 | 1 |  |
| `src/components/chat/MermaidDiagram.tsx` | 1 | 1 |  |
| `src/templates/Brain/BrainContentRenderer.tsx` | 1 | 1 |  |
| `src/templates/Brain/ScheduleDetailView.tsx` | 1 | 1 |  |
