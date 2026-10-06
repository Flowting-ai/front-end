#!/usr/bin/env node
/**
 * Generates src/styles/tokens/theme.css — the dark theme — from the real tokens.
 *
 * ADDITIVE. Nothing here edits primitives.css / aliases.css / semantic.css. The
 * output defines a few NEW light-safe tokens in `:root` (each equal to today's
 * value) and overrides tokens only inside `:root[data-theme="dark"]`. With no
 * attribute (the default, and always when the THEMING flag is off) the light
 * theme is untouched.
 *
 * Design intent (dark):
 *   • Main pages are a deep warm brown-black, cards a step above it — the brand's
 *     own browns (#161616 / #1C1C1C / #222222 / #383838), NOT light greys.
 *   • No light-grey fills: the primary button, tooltips and toast actions stay a
 *     dark elevated brown with white text and a visible border.
 *   • Text is a warm off-white ramp with high contrast; WHITE is the hover colour
 *     for interactive text (see the hover block at the bottom).
 *   • Coloured accents (blue/red/green/yellow/brown/purple) keep their hues; light
 *     tints become dark tints and strong text tones become light, via a mirror.
 *
 * Contrast is enforced by src/lib/theme.test.tsx (normal + hover pairs).
 *
 * Run:  node scripts/generate-dark-theme.mjs        (writes the file)
 *       node scripts/generate-dark-theme.mjs --check (exits 1 if out of date)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGACY } from './theme-legacy-colors.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS = resolve(ROOT, 'src/styles/tokens')
const OUT = resolve(TOKENS, 'theme.css')

// ── The dark neutral ramp (hand-designed; every value is a role decision) ─────
//   Surfaces/borders (50–300) are the brand's own dark browns.
//   Text tones (400–950) are tuned to hold the same contrast RELATIONSHIPS as the
//   light theme (primary ≈ 15:1, default ≈ 9:1, muted ≈ 5:1, disabled ≈ 3:1) on
//   the dark card, on a neutral grey ramp (Perplexity-style: #DEDEDE primary text).
const DARK_NEUTRAL = {
  '50':  '#161616', // page background
  '100': '#222222', // subtle fill, hover tint, light border
  '200': '#383838', // borders, dividers
  '300': '#4A4A4A', // strong border, disabled fill
  '400': '#6E6E6E', // disabled text / icons
  '500': '#989898', // muted text
  '600': '#ABABAB', // secondary / placeholder text
  '700': '#C4C4C4', // default labels
  '800': '#D2D2D2', // strong text
  '900': '#DEDEDE', // primary text
  '950': '#FFFFFF', // emphasis / hover
}
const DARK_SURFACE = { r: 28, g: 28, b: 28 } // #1C1C1C — cards, inputs, panels ("white")
const DARK_SURFACE_HEX = '#1C1C1C'
const WHITE = '#FFFFFF'

// Dark equivalents of the few literal-only / role-specific alias values.
const HOVER_TINT = 'rgba(255, 255, 255, 0.07)'   // hover background on any dark surface
const HOVER_BORDER = 'rgba(255, 255, 255, 0.16)'
const STRONG_BORDER = 'rgba(255, 255, 255, 0.16)'
const GLASS_FILL = 'rgba(255, 255, 255, 0.04)'
const HIGHLIGHT = 'rgba(255, 255, 255, 0.08)'
const RING = 'rgba(255, 255, 255, 0.12)'
const PRIMARY_FROM = '#4A4A4A' // identical to the primary button's existing gradient
const PRIMARY_TO = '#222222'
const PRIMARY_DISABLED_TO = '#383838'
const PRIMARY_BORDER = '#5C5C5C'
const TOOLTIP_TO = '#2A2A2A'
// Dark-mode brand pink for the default Button + Tooltip (light mode stays black).
const PINK_FROM = '#F92064'
const PINK_TO = '#C4124C'
const PINK_BORDER = '#FF6B97'
const PINK_TOOLTIP_TO = '#D81857'
const GREY_SURFACE = '#1C1C1C' // the dark card surface (same as --neutral-white) that tabs and agent cards sit on
const TAB_TRACK = '#262626' // tab bar track: lifted well above the page so the tab strip reads as a control
const FIELD_BG = '#2E2E2E'  // every input surface (--field-surface): clearly brighter than the #1C1C1C page and cards, with a visible ring
const AGENT_CARD = GREY_SURFACE

// Content on that lighter grey needs its muted tones lifted or it becomes hard to read
// (neutral-500 text is 3.2:1 on it, neutral-400 icons 1.9:1, neutral-200 fills 1.1:1).
// Applied only inside an element marked data-surface="raised" (see the scoped block below).
const RAISED_RAMP = {
  '--neutral-200': '#4D4D4D', // fills / dividers   (1.1 -> 1.4:1)
  '--neutral-300': '#6A6A6A', // strong border / disabled text (1.3 -> 2.3:1)
  '--neutral-400': '#989898', // icons              (1.9 -> 3.2:1)
  '--neutral-500': '#B0B0B0', // muted text         (3.2 -> 4.8:1)
}
const SHADOW_ALPHA_BOOST = 2
const SHADOW_ALPHA_CAP = 0.6
const TRANSLUCENT_TEXT_FACTOR = 0.5 // light-on-dark translucents read stronger than dark-on-light

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
// Accent scales (blue/red/green/yellow/brown/purple): which LIGHT step supplies each
// DARK step. Tints (50–200) and strong tones (700–950) mirror; the mid steps
// (400–600), which are used as text, icons and ring colours, are lifted instead of
// mirrored so accent text stays readable on dark (a pure mirror turned red-400
// text into a DARKER red, ~2:1). Fills at 500/600 get lighter, same hue.
const ACCENT_MAP = {
  '50': '950', '100': '900', '200': '800', '300': '700',
  '400': '300', '500': '400', '600': '400',
  '700': '300', '800': '200', '900': '100', '950': '50',
}
// Accent TEXT steps (400–700) must stay readable on the dark card: if the mapped
// tone doesn't clear this contrast, lift it (toward the lighter steps) until it does.
const ACCENT_TEXT_MIN_CONTRAST = 4.6

const read = (f) => readFileSync(resolve(TOKENS, f), 'utf8')
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const decls = (css) => {
  const out = {}
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}
const rgbOf = ({ r, g, b }) => `${r}, ${g}, ${b}`
const hex = ({ r, g, b }) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()
const dist = (a, b) => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
const fmtAlpha = (a) => String(Number(a.toFixed(3)))

// ── Parse primitives ─────────────────────────────────────────────────────────
const prim = read('primitives.css')
const solid = {}
const variants = []
for (const line of prim.split(/\r?\n/)) {
  let m = line.match(/^\s*--([a-z]+)-(\d+):\s*(#[0-9a-fA-F]{6})\s*;/)
  if (m && STEPS.includes(m[2])) {
    ;(solid[m[1]] ??= {})[m[2]] = hexToRgb(m[3])
    continue
  }
  m = line.match(/^\s*--([a-z]+)-(\d+|white|black)-(\d+):\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*;/)
  if (m) {
    variants.push({
      name: `--${m[1]}-${m[2]}-${m[3]}`, palette: m[1], step: m[2],
      rgb: { r: +m[4], g: +m[5], b: +m[6] }, alpha: parseFloat(m[7]),
    })
  }
}

// Guard: the designed ramp must cover exactly the neutral steps that exist.
for (const s of STEPS) {
  if (!solid.neutral?.[s]) throw new Error(`primitives.css has no --neutral-${s}`)
  if (!DARK_NEUTRAL[s]) throw new Error(`DARK_NEUTRAL has no step ${s}`)
}

const relLum = ({ r, g, b }) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** The dark colour for an accent palette step (see ACCENT_MAP + the contrast lift). */
function accentDark(palette, step) {
  const pal = solid[palette]
  let idx = STEPS.indexOf(ACCENT_MAP[step])
  const n = Number(step)
  if (n >= 400 && n <= 700) { // text / icon steps only — 300 is a border/ring tone and stays quiet
    while (idx > 0 && contrast(pal[STEPS[idx]], DARK_SURFACE) < ACCENT_TEXT_MIN_CONTRAST) idx--
  }
  return pal[STEPS[idx]]
}

const lines = []
const report = { exact: 0, approx: [], skipped: [], explicit: 0 }
const darkValue = {} // token name -> final dark value, used by the alpha rules below

// ── 1. Solid scales ──────────────────────────────────────────────────────────
lines.push('  /* ── Neutral ramp — designed, not mirrored (see generator header) ───────── */')
for (const step of STEPS) {
  lines.push(`  --neutral-${step}: ${DARK_NEUTRAL[step]};`)
  darkValue[`--neutral-${step}`] = hexToRgb(DARK_NEUTRAL[step])
}
lines.push(`  --neutral-white: ${DARK_SURFACE_HEX};   /* a surface in ~97% of uses */`)
lines.push(`  --neutral-black: ${WHITE};   /* only ever used as strong text / hover text */`)
lines.push('')
lines.push('  /* ── Accent scales — mirrored (tints → dark tints, strong text → light) ─── */')
for (const palette of Object.keys(solid)) {
  if (palette === 'neutral') continue
  for (const step of STEPS) {
    if (!solid[palette][step]) continue
    const d = accentDark(palette, step)
    lines.push(`  --${palette}-${step}: ${hex(d)};`)
    darkValue[`--${palette}-${step}`] = d
  }
  lines.push('')
}

// ── 2. Opacity variants ──────────────────────────────────────────────────────
// Hover/border tints are explicit (they must read on ANY dark surface). Other
// neutral variants follow their step's dark colour; strong-text steps (600+) are
// scaled down because light-on-dark translucents look heavier than dark-on-light.
const EXPLICIT_VARIANT = {
  '--neutral-100-60': HOVER_TINT,    // hover tint (ghost/secondary/outline)
  '--neutral-200-50': 'rgba(255, 255, 255, 0.10)',
  '--neutral-300-40': HOVER_BORDER,  // hover border
}
const alphaByName = {}
lines.push('  /* ── Opacity variants ───────────────────────────────────────────────────── */')
for (const v of variants) {
  alphaByName[v.name] = v.alpha
  if (v.step === 'black') { report.skipped.push(`${v.name} (black overlay — unchanged)`); continue }
  if (EXPLICIT_VARIANT[v.name]) {
    lines.push(`  ${v.name}: ${EXPLICIT_VARIANT[v.name]};`); report.explicit++
    continue
  }
  let outRgb, alpha = v.alpha
  if (v.step === 'white') {
    outRgb = DARK_SURFACE
  } else if (v.palette === 'neutral') {
    const pal = solid.neutral
    if (dist(pal[v.step], v.rgb) !== 0) {
      report.approx.push(`${v.name}: literal rgb(${rgbOf(v.rgb)}) != neutral-${v.step}`)
    } else report.exact++
    if (Number(v.step) >= 600) {
      // Strong dark tone in light → light tone in dark, but quieter.
      outRgb = { r: 255, g: 255, b: 255 }
      alpha = Math.min(0.4, v.alpha * TRANSLUCENT_TEXT_FACTOR)
    } else {
      outRgb = hexToRgb(DARK_NEUTRAL[v.step])
    }
  } else {
    const pal = solid[v.palette]
    if (!pal) { report.skipped.push(`${v.name} (no palette)`); continue }
    const lightSelf = pal[v.step]
    if (lightSelf && dist(lightSelf, v.rgb) === 0) { outRgb = accentDark(v.palette, v.step); report.exact++ }
    else {
      let best = null, bestD = Infinity
      for (const s of STEPS) { const d = dist(pal[s], v.rgb); if (d < bestD) { bestD = d; best = s } }
      outRgb = accentDark(v.palette, best)
      report.approx.push(`${v.name}: literal rgb(${rgbOf(v.rgb)}) != ${v.palette}-${v.step}; mirrored nearest step ${best}`)
    }
  }
  lines.push(`  ${v.name}: rgba(${rgbOf(outRgb)}, ${fmtAlpha(alpha)});`)
}
lines.push('')

// ── 3. Shadow tokens ─────────────────────────────────────────────────────────
// Shadows must stay shadows: dark-neutral translucents → black (alpha ×2, capped);
// a solid --neutral-black hairline ring (now white) → a soft light ring.
const alias = read('aliases.css')
const semantic = read('semantic.css')
const tokenRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
const shadowVar = /var\(\s*(--neutral-(?:600|700|800|900|950|black)-\d+)\s*\)/g
const blackRing = /var\(\s*--neutral-black\s*\)/g
const shadowOut = []
const seen = new Set()
for (const src of [alias, semantic]) {
  let m
  while ((m = tokenRe.exec(src))) {
    const [, name, value] = m
    if (!/shadow/i.test(name) || seen.has(name)) continue
    const hasVar = new RegExp(shadowVar.source).test(value)
    const hasRing = new RegExp(blackRing.source).test(value)
    if (!hasVar && !hasRing) continue
    seen.add(name)
    let next = value.replace(new RegExp(shadowVar.source, 'g'), (_, v) => {
      const a = alphaByName[v]
      if (a === undefined) return `var(${v})`
      return `rgba(0, 0, 0, ${fmtAlpha(Math.min(SHADOW_ALPHA_CAP, a * SHADOW_ALPHA_BOOST))})`
    })
    next = next.replace(new RegExp(blackRing.source, 'g'), RING)
    shadowOut.push(`  ${name}: ${next.replace(/\s+/g, ' ').trim()};`)
  }
}
lines.push('  /* ── Shadows: stay shadows (dark-neutral colours → black; hairline → soft ring) ── */')
lines.push(...shadowOut)
lines.push('')

// ── 4. Role overrides (alias + semantic layer) ───────────────────────────────
lines.push('  /* ── Role overrides ─────────────────────────────────────────────────────── */')
const overrides = [
  // Primary button / icon button / tooltip / toast action: a dark ELEVATED brown with
  // white text and a visible border — never a light fill.
  ['--color-interactive-primary-surface-from', PINK_FROM],
  ['--color-interactive-primary-surface-to', PINK_TO],
  ['--color-interactive-primary-surface-disabled-from', PRIMARY_FROM],
  ['--color-interactive-primary-surface-disabled-to', PRIMARY_DISABLED_TO],
  ['--color-interactive-primary-border', PINK_BORDER],
  ['--color-interactive-primary-border-disabled', '#5C5C5C'],
  ['--color-interactive-primary-text', WHITE],
  ['--color-interactive-primary-text-disabled', '#BDBDBD'],
  // Disabled ghost / outline / icon-button content + outline borders: readable, still clearly dimmer than enabled (#C4C4C4).
  ['--color-interactive-subtle-text-disabled', '#A3A3A3'],
  ['--button-outline-border-disabled', 'rgba(255, 255, 255, 0.32)'],
  ['--icon-button-outline-border-disabled', 'rgba(255, 255, 255, 0.32)'],
  ['--button-default-hover-glow', 'linear-gradient(180deg, rgb(255,240,246) 0%, rgb(255,140,178) 12%, rgb(249,32,100) 24%, rgb(150,10,70) 36%, rgb(40,4,20) 48%, rgb(10,0,6) 56%, rgb(110,8,52) 68%, rgb(215,25,92) 80%, rgb(255,92,140) 90%, rgb(255,158,191) 100%)'],
  // Default-button 3D edge: light pink instead of the (dark-mirrored) white neutral-950.
  ['--shadow-button-default-inner', 'inset 0px 1px 0.364px 0px rgba(255, 179, 204, 0.4), inset 0px -2.182px 0.364px 0px #FFB3CC, inset 0px -2.545px 4px -2.182px rgba(255, 179, 204, 0.5)'],
  // Dropdown / popover / floating-menu 1px ring: light silver, with a deep drop shadow.
  ['--shadow-popover', '0px 4px 10px -3px rgba(192, 192, 192, 0.22), 0px 2px 4px -1px rgba(192, 192, 192, 0.16), 0px 1px 2px 0px rgba(192, 192, 192, 0.12), 0px 0px 0px 1px var(--neutral-200)'],
  ['--shadow-floating-menu-outer', '0px 4px 10px -3px rgba(192, 192, 192, 0.22), 0px 2px 4px -1px rgba(192, 192, 192, 0.16), 0px 1px 2px 0px rgba(192, 192, 192, 0.12), 0px 0px 0px 1px var(--neutral-200)'],
  // ⌘-shortcut pill: a raised dark chip with a soft light ring instead of the white one.
  ['--shortcut-pill-bg', '#383838'],
  ['--shortcut-pill-ring', 'rgba(255, 255, 255, 0.14)'],
  ['--shortcut-pill-shadow', 'rgba(0, 0, 0, 0.35)'],
  ['--shortcut-pill-text', '#C4C4C4'],
  ['--tooltip-bg-from', '#FFFFFF'],
  ['--tooltip-bg-to', '#EBEBEB'],
  ['--tooltip-text', '#222222'],
  // Every toast type shares the same dark surface; only the text (and border) colour differs.
  ['--toast-success-bg', '#1C1C1C'],
  ['--toast-error-bg', '#1C1C1C'],
  ['--toast-warning-bg', '#1C1C1C'],
  ['--toast-info-bg', '#1C1C1C'],
  ['--toast-action-bg', PRIMARY_FROM],
  ['--toast-action-text', WHITE],
  // Hover / borders / glass.
  ['--color-interactive-subtle-surface-hover', HOVER_TINT],
  ['--color-interactive-subtle-border-hover', HOVER_BORDER],
  ['--color-border-interactive', STRONG_BORDER],
  ['--color-surface-glass', GLASS_FILL],
  // Main page containers: no fill in dark, so the container is the SAME surrounding
  // black as the page (white @20% over the dark page rendered as a grey #414141).
  ['--color-surface-container', 'transparent'],
  // Translucent "veils" (frosted overlays, drop zones, chips over tinted cards) are
  // written rgba(var(--surface-rgb), A): white in light, the dark card colour here.
  ['--surface-rgb', rgbOf(DARK_SURFACE)],
  // White is the hover colour for text in dark. Light has NO --text-hover, so every
  // `var(--text-hover, <today's colour>)` falls back to today's colour there.
  ['--text-hover', WHITE],
  // Modal / dialog / drawer backdrop: a black scrim. The light value is a warm near-black, but the
  // components that used to build it from --neutral-950 got WHITE in dark (neutral-950 flips).
  ['--overlay-bg', 'rgba(0, 0, 0, 0.6)'],
  // Secondary Button / IconButton and the selected tab pill: raised dark greys with a light hairline
  // ring (they are white in light mode; a white block on a near-black page is harsh).
  ['--button-secondary-bg', '#2E2E2E'],
  ['--button-secondary-text', 'var(--neutral-900)'],
  ['--button-secondary-text-disabled', '#828282'],
  ['--button-secondary-bg-hover', '#3A3A3A'],
  ['--icon-button-secondary-bg', '#2E2E2E'],
  ['--icon-button-secondary-icon', 'var(--neutral-900)'],
  ['--icon-button-secondary-icon-disabled', '#828282'],
  ['--icon-button-secondary-bg-hover', '#3A3A3A'],
  ['--tab-item-bg-selected', '#404040'],
  ['--tab-item-text-selected', '#FFFFFF'],
  ['--shadow-button-secondary-outer', '0px 1px 2px 0px rgba(0, 0, 0, 0.45), 0px 0px 0px 1px rgba(255, 255, 255, 0.10)'],
  ['--shadow-button-secondary-outer-hover', '0px 1px 2px 0px rgba(0, 0, 0, 0.45), 0px 0px 0px 1px rgba(255, 255, 255, 0.18)'],
  ['--shadow-button-secondary-inner', 'inset 0px 1px 0px 0px rgba(255, 255, 255, 0.08)'],
  ['--shadow-button-secondary-inner-hover', 'inset 0px 1px 0px 0px rgba(255, 255, 255, 0.12)'],
  ['--shadow-tab-item-selected', '0px 1px 2px 0px rgba(0, 0, 0, 0.45), 0px 0px 0px 1px rgba(255, 255, 255, 0.14)'],
  ['--shadow-tab-item-selected-inner', 'inset 0px 1px 0px 0px rgba(255, 255, 255, 0.10)'],
  // Text fields: a brighter fill than cards plus a clearly visible ring, so inputs stand out.
  ['--field-surface', FIELD_BG],
  ['--text-field-bg', FIELD_BG],
  ['--text-field-ring', 'rgba(255, 255, 255, 0.22)'],
  ['--text-field-ring-hover', 'rgba(255, 255, 255, 0.34)'],
  // The user's message bubble is a raised dark-grey card (light mode keeps white with dark text).
  ['--message-bubble-user-bg', '#2A2A2A'],
  ['--message-bubble-user-text', 'var(--neutral-900)'],
  // Light mode keeps the chat input pure white; in dark it follows the card surface as before.
  ['--chat-input-bg', '#262626'],
  ['--input-group-bg-focus', FIELD_BG],
  ['--shadow-message-bubble-user', '0px 1px 2px 0px rgba(255, 255, 255, 0.12), 0px 3px 8px 0px rgba(255, 255, 255, 0.09), 0px 0px 0px 1px rgba(255, 255, 255, 0.14)'],
  ['--shadow-message-bubble-user-inner', 'inset 0px -2px 1.5px 0px rgba(255, 255, 255, 0.1)'],
  // Chat input: a soft LIGHT glow + hairline ring instead of a dark drop shadow (a black shadow is
  // invisible on a near-black page). Hover and focus step the glow up.
  ['--shadow-chat-input', '0px 0px 0px 1px rgba(255, 255, 255, 0.10), 0px 0px 22px -2px rgba(255, 255, 255, 0.07)'],
  ['--shadow-chat-input-hover', '0px 0px 0px 1px rgba(255, 255, 255, 0.16), 0px 0px 26px -2px rgba(255, 255, 255, 0.10), 0px 0px 0px 3px rgba(255, 255, 255, 0.04)'],
  ['--shadow-chat-input-focus', '0px 0px 0px 1px rgba(255, 255, 255, 0.26), 0px 0px 30px -2px rgba(255, 255, 255, 0.13), 0px 0px 0px 5px rgba(255, 255, 255, 0.06)'],
  // Sidebar rows hover/active on the sidebar surface: a flat #222222.
  ['--sidebar-menu-item-hover-bg', '#222222'],
  // Sidebar icons (new/all projects, section headers, chevrons, row icons) are pure white in dark.
  // Light defines neither, so var(--sidebar-icon, <today's colour>) falls back to today's colour.
  ['--sidebar-icon', WHITE],
  ['--sidebar-icon-muted', WHITE],
  ['--sidebar-selected-text', WHITE],
  ['--sidebar-section-header-text', '#ABABAB'],
  ['--sidebar-section-header-muted', '#858585'],
  ['--tab-item-text-hover', WHITE],
  ['--message-bubble-action-icon', '#D4D4D4'],
  // Tab bar: the mid grey (#414141) behind the white selected pill. It is lighter than the
  // near-black track the labels were tuned for, so unselected labels step up one palette
  // tone (3.2:1 -> 5.0:1) and disabled ones sit at the old default (dimmer, still visible).
  ['--tab-bg', TAB_TRACK],
  ['--agent-card-bg', AGENT_CARD],
  ['--agent-card-gradient', 'linear-gradient(to bottom right, #262626 0%, #161616 50%, #202020 100%)'],
  ['--shadow-undo-toast', '0px 4px 10px -3px rgba(192, 192, 192, 0.22), 0px 2px 4px -1px rgba(192, 192, 192, 0.16), 0px 0px 0px 1px var(--neutral-200)'],
  // Thinking text, high contrast on dark: label/meta ≈ 11:1, icons/bullets ≈ 8:1, and the
  // shimmer sweeps WHITE across a clearly visible resting colour (light mode sweeps dark
  // across light — that pairing vanishes into the dark page).
  ['--thinking-text', '#8A8A8A'],
  ['--thinking-text-faint', '#707070'],
  ['--thinking-icon-strong', '#707070'],
  ['--thinking-icon-active', '#8A8A8A'],
  ['--thinking-rule', '#4A4A4A'],
  ['--thinking-shimmer-edge', '#5C5C5C'],
  ['--thinking-shimmer-peak', '#A3A3A3'],
  ['--model-name-text', '#8A8A8A'],
  ['--tab-item-text-default', 'var(--neutral-600)'],
  ['--tab-item-text-disabled', 'var(--neutral-500)'],
]
for (const [name, value] of overrides) { lines.push(`  ${name}: ${value};`); report.explicit++ }

// Literal-only alias values (tag highlights / button shadows).
let highlightCount = 0, buttonShadowCount = 0
{
  let m
  const re = /(--color-tag-[A-Za-z]+-(?:highlight|button-shadow))\s*:\s*([^;]+);/g
  while ((m = re.exec(alias))) {
    const [, name, value] = m
    if (name.endsWith('-highlight')) { lines.push(`  ${name}: ${HIGHLIGHT};`); highlightCount++ }
    else {
      lines.push(`  ${name}: ${value.replace(/rgba\(255,\s*255,\s*255,\s*0\.9\)/g, HIGHLIGHT).replace(/\s+/g, ' ').trim()};`)
      buttonShadowCount++
    }
  }
}
lines.push('')
lines.push('  /* Text / icon sitting ON a fixed coloured fill stays white in both themes. */')
lines.push('  --color-text-on-accent: #FFFFFF;')
lines.push('')
lines.push('  /* Legacy hard-coded colours that follow the theme (see theme-legacy-colors.mjs). */')
for (const [, v] of Object.entries(LEGACY)) lines.push(`  ${v.token}: ${v.dark};`)

// ── 4b. Tabs and buttons that are WHITE in light stay WHITE in dark ──────────
// The selected-tab pill, secondary buttons, secondary icon buttons and the user's
// message bubble are white surfaces with dark text in light. They keep exactly their
// LIGHT values here (surface, text, hover tint and the shadows that depend on them).
const lightVars = { ...decls(noComments(read('primitives.css'))), ...decls(noComments(read('aliases.css'))), ...decls(noComments(read('semantic.css'))) }
lightVars['--icon-button-secondary-bg'] = '#FFFFFF' // new light-safe token (see :root block)
function resolveLight(value, trail = []) {
  return value.replace(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,[^)]*)?\)/g, (_, n) => {
    if (trail.includes(n)) throw new Error(`token cycle: ${[...trail, n].join(' -> ')}`)
    if (lightVars[n] === undefined) throw new Error(`cannot resolve ${n} while pinning light values`)
    return resolveLight(lightVars[n], [...trail, n])
  }).replace(/\s+/g, ' ').trim()
}
// (Secondary buttons / icon buttons / the selected tab pill used to be pinned to their WHITE light values.
// They are now raised dark surfaces in dark: see the overrides list below.)
const WHITE_SURFACE_TOKENS = []
const pinned = new Set(WHITE_SURFACE_TOKENS)
// (a pinned token must not also be emitted by the shadow rewrite above)
for (let i = lines.length - 1; i >= 0; i--) {
  const m = lines[i].match(/^\s*(--[a-zA-Z0-9-]+):/)
  if (m && pinned.has(m[1])) lines.splice(i, 1)
}
lines.push('')
lines.push('  /* ── Pinned light values (none: secondary buttons and tabs are dark surfaces in dark) ── */')
for (const name of WHITE_SURFACE_TOKENS) lines.push(`  ${name}: ${resolveLight(lightVars[name])};`)

// ── 5. White on hover for interactive text ───────────────────────────────────
// Custom properties inherit, so overriding the TEXT tokens on a hovered
// interactive element recolours everything inside it that reads those tokens —
// no per-component edits. Primary/danger variants and disabled controls are
// excluded (their tokens aren't in the list / the :not() chain skips them).
const HOVER_TOKENS = [
  // NOT the secondary button/icon button (white surfaces in both themes — white text there would vanish).
  '--button-ghost-text', '--button-outline-text',
  '--icon-button-ghost-icon', '--icon-button-ghost-2-icon', '--icon-button-outline-icon',
  '--dropdown-menu-item-text', '--dropdown-menu-item-muted', '--dropdown-menu-item-sublabel',
  '--model-select-item-text', '--model-select-item-icon',
  '--floating-menu-item-label',
  '--sidebar-menu-item-text', '--sidebar-menu-item-muted',
  '--color-text-default', '--color-text-muted',
]
const INTERACTIVE = [
  'button', '[role="button"]', '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
  '[role="option"]', '[role="tab"]', 'a[href]',
]
const ENABLED = ':not(:disabled):not([aria-disabled="true"]):not([data-disabled])'
const hoverSelectors = INTERACTIVE
  .flatMap((s) => [`${s}:hover${ENABLED}`, `${s}[data-highlighted]${ENABLED}`])
  .map((s) => `:root[data-theme="dark"] ${s}`)
  .join(',\n')

// ── 6. Raised surface scope ──────────────────────────────────────────────────
// Custom properties that use var() are resolved where they are DECLARED and then
// inherited as finished values, so lifting --neutral-500 on a card would not reach
// --color-text-muted (computed once at the root). Inside the scope we therefore lift the
// ramp AND restate every alias that depends on it, with exactly its dark value, so they
// recompute against the lifted ramp. Pinned / literal tokens don't depend on it and are
// never restated (a test enforces that no dark value is changed).
const darkEffective = {}
for (const l of lines) {
  const m = l.match(/^\s*(--[a-zA-Z0-9-]+):\s*(.+?);\s*(?:\/\*.*\*\/)?\s*$/)
  if (m) darkEffective[m[1]] = m[2].trim()
}
const aliasAndSemantic = { ...decls(noComments(read('aliases.css'))), ...decls(noComments(read('semantic.css'))) }
const effective = (n) => darkEffective[n] ?? aliasAndSemantic[n] ?? lightVars[n]
const dependsMemo = new Map()
function dependsOnRamp(name, trail = new Set()) {
  if (name in RAISED_RAMP) return true
  if (dependsMemo.has(name)) return dependsMemo.get(name)
  if (trail.has(name)) return false
  trail.add(name)
  const v = effective(name)
  let result = false
  if (v) for (const m of v.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) if (dependsOnRamp(m[1], trail)) { result = true; break }
  dependsMemo.set(name, result)
  return result
}
const raisedLines = [
  ...Object.entries(RAISED_RAMP).map(([n, v]) => `  ${n}: ${v};`),
  ...Object.keys(aliasAndSemantic)
    .filter((n) => !(n in RAISED_RAMP) && dependsOnRamp(n))
    .map((n) => `  ${n}: ${effective(n).replace(/\s+/g, ' ')};`),
]

const css = `/* ── Theme: dark ──────────────────────────────────────────────────────────────
   GENERATED by scripts/generate-dark-theme.mjs — do not edit by hand.
   Re-generate after changing primitives/aliases/semantic tokens:
     node scripts/generate-dark-theme.mjs

   ADDITIVE: nothing in primitives.css / aliases.css / semantic.css is changed.
   Light is the default; the dark values below apply ONLY while the root element
   has data-theme="dark" (set by ThemeProvider, and only when the theming flag
   is on).
   ─────────────────────────────────────────────────────────────────────────── */

:root {
  /* New tokens. Each equals today's value, so light is pixel-identical. */
  --color-text-on-accent: var(--neutral-white);

  /* Main page container fill (AppLayout, Settings, Brain). Light = the exact
     rgba(255,255,255,0.2) those containers hard-coded; dark = transparent. */
  --color-surface-container: rgba(255, 255, 255, 0.20);

  /* RGB triplet of the surface colour, for translucent veils: rgba(var(--surface-rgb), A).
     Light = white (so every veil is exactly the rgba(255,255,255,A) it replaced). */
  --surface-rgb: 249, 248, 245;

  /* Secondary icon button surface (was hard-coded var(--neutral-white) in the component). */
  --icon-button-secondary-bg: #FFFFFF;

  /* Agent cards stay warm against the white page canvas. */
  --agent-card-bg: var(--neutral-100);
  --agent-card-gradient: none;
  --shadow-undo-toast: 0px 2px 4px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px rgba(59,54,50,0.10);

  /* Thinking / reasoning text: the "Thinking…" label, step meta text, bullets, icons, the
     rail and the shimmer sweep. Light = the literals these replaced (#9A9089 etc.), with --thinking-text darkened to #776F69 for 4.5:1. */
  --thinking-text: #776F69;
  --thinking-text-faint: #C0B5AD;
  --thinking-icon-strong: var(--neutral-200);
  --thinking-icon-active: #A89488;
  --thinking-rule: var(--neutral-100);
  --thinking-shimmer-edge: var(--neutral-300);
  --thinking-shimmer-peak: #3B3632;

  /* Assistant model name in the message header. Light = the neutral-700 it replaced. */
  --model-name-text: var(--neutral-700);

  /* Legacy hard-coded colours, now themeable. Light values may be normalized to the neutral palette. */
${Object.entries(LEGACY).map(([hex, v]) => `  ${v.token}: ${v.light ?? hex};`).join('\n')}
}

:root[data-theme="dark"] {
  color-scheme: dark;

${lines.join('\n')}
}

/* ── White text on hover (dark only) ───────────────────────────────────────────
   Overrides the text/icon tokens on the hovered (or keyboard-highlighted) element;
   descendants that read these tokens turn white. Disabled controls are skipped. */
${hoverSelectors} {
${HOVER_TOKENS.map((t) => `  ${t}: var(--text-hover);`).join('\n')}
}

/* ── Active sidebar item (dark only) ───────────────────────────────────────────
   The selected sidebar row reads like a hovered one: same tokens, same white. Rows opt in with
   data-sidebar-active; light mode has no rule for it, so it is a no-op there. */
:root[data-theme="dark"] [data-sidebar-active] {
${HOVER_TOKENS.map((t) => `  ${t}: var(--text-hover);`).join('\n')}
}

:root[data-theme="dark"] [data-sidebar-selected] {
  --sidebar-menu-item-text: var(--sidebar-selected-text);
  --sidebar-menu-item-muted: var(--sidebar-selected-text);
  --sidebar-icon: var(--sidebar-selected-text);
  --sidebar-icon-muted: var(--sidebar-selected-text);
}

/* ── Raised surface (dark only) ────────────────────────────────────────────────
   Content on the lighter grey surface (agent cards). Mark the element with
   data-surface="raised"; light mode has no rule for it, so it is a no-op there. */
:root[data-theme="dark"] [data-surface="raised"] {
${raisedLines.join('\n')}
}

/* ── Logos ─────────────────────────────────────────────────────────────────────
   SouvenirLogo and ThemedLlmIcon render a light-mode image AND a dark-mode image when
   theming is on; exactly one shows. The dark-only images are hidden by default, so with
   theming off (they are not rendered at all) or in light mode nothing changes.
   !important is needed because both components set display inline. */
.kds-logo-dark,
.kds-llm-mono {
  display: none !important;
}
:root[data-theme="dark"] .kds-logo-light,
:root[data-theme="dark"] .kds-llm-color {
  display: none !important;
}
:root[data-theme="dark"] .kds-logo-dark {
  display: var(--kds-logo-display, block) !important;
}
:root[data-theme="dark"] .kds-llm-mono {
  display: inline-block !important;
  /* currentColor inside an <img> is black; flatten the mono mark to pure white. */
  filter: brightness(0) invert(1);
}

/* Light has no explicit body background (pages paint their own); in dark make
   sure any gap shows the dark page colour, not the browser default. */
:root[data-theme="dark"] body {
  background-color: var(--neutral-50);
  color: var(--color-text-primary);
}
`

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current.replace(/\r\n/g, '\n') !== css.replace(/\r\n/g, '\n')) { console.error('theme.css is out of date — run: node scripts/generate-dark-theme.mjs'); process.exit(1) }
  console.log('theme.css is up to date')
} else {
  writeFileSync(OUT, css, 'utf8')
  console.log(`wrote ${OUT}`)
  console.log(`  accent scales    : ${Object.keys(solid).filter((p) => p !== 'neutral').join(', ')} (mirrored)`)
  console.log(`  neutral ramp     : designed (${STEPS.length} steps) + surface ${DARK_SURFACE_HEX}`)
  console.log(`  variants         : ${variants.length} total, ${report.exact} exact, ${report.explicit} explicit, ${report.approx.length} approximated, ${report.skipped.length} skipped`)
  console.log(`  shadow tokens    : ${shadowOut.length} rewritten`)
  console.log(`  tag highlights   : ${highlightCount}, button-shadows: ${buttonShadowCount}`)
  console.log(`  hover text rules : ${INTERACTIVE.length * 2} selectors x ${HOVER_TOKENS.length} tokens`)
  for (const a of report.approx) console.log('  ~ ' + a)
  for (const s of report.skipped) console.log('  - ' + s)
}
