#!/usr/bin/env node
/**
 * One-off, reviewable migration: make inline hard-coded colours follow the theme
 * WITHOUT changing a single light-theme pixel.
 *
 * Every replacement swaps a whole-value literal for a token that resolves to the
 * EXACT same value in light (a palette token, or a `--legacy-*` token defined in
 * theme.css with the original hex). Only the dark theme differs.
 *
 * Context rules (the reason this isn't a blind find/replace):
 *   • TEXT colour  — only DARK text literals are tokenised (they must flip to light
 *     on dark surfaces). Light text literals are left alone: in this codebase they
 *     are text ON a fixed dark fill (dark buttons), which stays dark in both themes.
 *   • BACKGROUND   — only LIGHT literals are tokenised (they must flip to dark).
 *     Dark fills are left alone for the same reason.
 *   • An enclosing style object that pairs a dark text with a FIXED non-token
 *     background (gradient / rgba / other hex), or a light bg with a fixed light
 *     text, is skipped and listed so a human can decide.
 *   • Only regular CSS-in-JS properties are touched (colon form: `color: '#...'`).
 *     Raw SVG attributes (`fill="#..."`), canvas / chart / PDF / HTML-string colour
 *     and anything that parses the hex are never edited.
 *
 * Usage:  node scripts/migrate-inline-colors.mjs            (dry run + report)
 *         node scripts/migrate-inline-colors.mjs --apply    (writes the files)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGACY } from './theme-legacy-colors.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')

// Never rewrite a file that has uncommitted work in progress (someone may have it
// open), or that no longer exists on disk. Skipped files are listed in the report.
const dirty = new Set(
  execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop()),
)
// Scoped runs (--only + --include-dirty) also cover brand-new, not-yet-committed files.
const gitList = (...extra) => execFileSync('git', ['ls-files', ...extra, 'src/*.tsx', 'src/*.ts'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
const SCOPED = process.argv.some((a) => a.startsWith('--only=')) && process.argv.includes('--include-dirty')
const tracked = [...gitList(), ...(SCOPED ? gitList('--others', '--exclude-standard') : [])]
  .filter((f, i, all) => f && !/(\.test\.|\.d\.ts$)/.test(f) && all.indexOf(f) === i)

// A file that is "dirty" ONLY because of a previous run of this script is safe to
// process again: same number of lines, and every changed line resolves to the same
// LIGHT colours as the committed version. Anything else (a real edit by someone) is
// off-limits. Needs the palette/legacy token values, so it is defined further down.
let isColourOnlyDirty
const skippedDirty = []
let files = []
// Scope + override flags (used when the owner of an area explicitly asks for it):
//   --only=<regex>        process only files whose path matches
//   --include-dirty       with --only: also process matching files that have OTHER uncommitted
//                         edits (read-modify-write is immediate, replacements are whole-value
//                         colour swaps; verify afterwards against a pre-run snapshot)
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3)
const ONLY = arg('only') ? new RegExp(arg('only')) : null
const INCLUDE_DIRTY = process.argv.includes('--include-dirty')
const selectFiles = () => {
  for (const f of tracked) {
    if (ONLY && !ONLY.test(f)) continue
    if (!existsSync(resolve(ROOT, f))) continue
    if (!dirty.has(f)) { files.push(f); continue }
    if (isColourOnlyDirty(f) || (INCLUDE_DIRTY && ONLY)) files.push(f); else skippedDirty.push(f)
  }
}

// Files where colours are consumed by non-DOM code (canvas colour drawing, charts, PDF
// export, hex maths) — never edited. A canvas used only to resize/encode an image
// (drawImage / toDataURL) does not read any colour, so it does not count.
const NON_DOM = /fillStyle|strokeStyle|createLinearGradient|createRadialGradient|addColorStop|maplibre|html2canvas|jspdf|hexToRgb|parseInt\([^)]*,\s*16\)|ImageResponse|@react-pdf/i

// ── Palette tokens (exact match → token) ─────────────────────────────────────
const prim = readFileSync(resolve(ROOT, 'src/styles/tokens/primitives.css'), 'utf8')
const hexToToken = {}
for (const m of prim.matchAll(/--([a-z]+-(?:\d+|white|black))\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  hexToToken[m[2].toUpperCase()] ??= `var(--${m[1]})`
}

for (const [hex, v] of Object.entries(LEGACY)) hexToToken[hex] ??= `var(${v.token})`

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const norm = (v) => {
  const s = v.trim().replace(/,$/, '').replace(/^(['"`])(.*)\1$/, '$2').trim()
  if (/^(white|#fff|#ffffff)$/i.test(s)) return '#FFFFFF'
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null
}

// ── "Is this file only dirty from earlier colour swaps?" ─────────────────────
// Light value of every token a swap can introduce (so old/new lines compare equal).
const LIGHT_TOKEN = { '--surface-rgb': '255, 255, 255', '--color-text-on-accent': '#FFFFFF', '--color-surface-container': 'rgba(255, 255, 255, 0.2)' }
for (const m of prim.matchAll(/(--[a-z]+-(?:\d+|white|black))\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) LIGHT_TOKEN[m[1]] = m[2].toUpperCase()
for (const [hex, v] of Object.entries(LEGACY)) LIGHT_TOKEN[v.token] = hex.toUpperCase()
const normLine = (s) => s
  .replace(/var\((--[a-z0-9-]+)\)/g, (w, n) => LIGHT_TOKEN[n] ?? w)
  .replace(/(['"`])white\1/g, (_, q) => `${q}#FFFFFF${q}`)
  .replace(/#fff\b(?![0-9a-fA-F])/gi, '#FFFFFF')
  .replace(/#[0-9a-fA-F]{6}\b/g, (h) => h.toUpperCase())
  .replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, (_, r, g, b, a) => `rgba(${r},${g},${b},${parseFloat(a)})`)
isColourOnlyDirty = (f) => {
  try {
    const oldTxt = execFileSync('git', ['show', `HEAD:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, '\n').replace(/^﻿/, '')
    const newTxt = readFileSync(resolve(ROOT, f), 'utf8').replace(/\r\n/g, '\n').replace(/^﻿/, '')
    const a = oldTxt.split('\n'), b = newTxt.split('\n')
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && normLine(a[i]) !== normLine(b[i])) return false
    return true
  } catch { return false }   // untracked / unreadable → treat as someone else's
}
selectFiles()

const TEXT_PROPS = new Set(['color', 'fill', 'stroke', 'caretColor'])
const BG_PROPS = new Set(['background', 'backgroundColor'])
const VEIL = /^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)$/
// colon-form, whole-value:  prop: 'value'
const re = /\b(color|fill|stroke|caretColor|background|backgroundColor)(\s*:\s*)(['"`])([^'"`\n]+)\3/g

// Enclosing `{ ... }` of an index (approximate brace matching; good enough to find
// the sibling style props, and verified by the printed report).
function enclosingObject(src, idx) {
  let depth = 0, start = -1
  for (let i = idx; i >= 0; i--) {
    const ch = src[i]
    if (ch === '}') depth++
    else if (ch === '{') { if (depth === 0) { start = i; break } depth-- }
  }
  if (start < 0) return ''
  depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return src.slice(start, start + 600)
}
function siblingColours(obj) {
  const out = { bg: [], text: [] }
  // The value may contain commas inside parentheses (rgba(1,2,3,.4), gradients, var(--x, #fff)),
  // so match balanced one-level parentheses instead of stopping at the first comma.
  for (const m of obj.matchAll(/\b(background|backgroundColor|color)\s*:\s*((?:[^,}\n(]|\([^)]*\))+)/g)) {
    ;(m[1] === 'color' ? out.text : out.bg).push(m[2].trim())
  }
  return out
}
// Sibling values come straight from source, so strip quotes / trailing commas first.
const clean = (v) => v.trim().replace(/,$/, '').replace(/^(['"`])(.*)\1$/, '$2').trim()
const isTransparentish = (raw) => {
  const v = clean(raw)
  if (/^(transparent|none|inherit|unset|currentColor)$/i.test(v)) return true
  // A low-alpha rgba() is a tint that adapts to whatever surface is under it.
  const m = v.match(/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/)
  return !!m && parseFloat(m[1]) <= 0.35
}
const isTokenValue = (raw) => /var\(--/.test(raw) && !/gradient/i.test(raw)

const report = { applied: 0, skipped: [], byFile: {}, legacyUsed: new Set(), nonDom: [] }
for (const f of files) {
  const path = resolve(ROOT, f)
  const bytes = readFileSync(path)
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const src = bytes.subarray(bom ? 3 : 0).toString('utf8')
  if (NON_DOM.test(src)) { if (new RegExp(re.source, 'g').test(src)) report.nonDom.push(f); continue }

  let out = '', last = 0, count = 0
  for (const m of src.matchAll(re)) {
    const [whole, prop, sep, quote, rawValue] = m
    const isText = TEXT_PROPS.has(prop), isBg = BG_PROPS.has(prop)
    // A translucent white "veil" background: rgba(255,255,255,A) → rgba(var(--surface-rgb), A).
    // Light: --surface-rgb is 255,255,255, so it is the identical colour. Dark: the card colour.
    const veil = isBg ? rawValue.trim().match(VEIL) : null
    let hex = null, token
    if (veil) {
      const a = parseFloat(veil[1])
      if (a < 0.1 || a > 0.95) continue            // faint code-block washes stay (dark-on-dark by design)
      token = `rgba(var(--surface-rgb), ${veil[1]})`
      // A 0.2 white fill on a 22px-radius box is the MAIN PAGE CONTAINER (same spec as
      // AppLayout / Settings / Brain): it must be the exact container token, which is
      // transparent in dark so the container matches the surrounding black.
      if (a === 0.2 && /borderRadius\s*:\s*['"`]?22(px)?['"`]?\b/.test(enclosingObject(src, m.index))) {
        token = 'var(--color-surface-container)'
      }
    } else {
      hex = norm(rawValue)
      if (!hex) continue
      token = hexToToken[hex]
      if (!token) continue
      const L = lum(hex)
      // Role/luminance gate.
      if (isText && !(L < 0.30)) continue          // light text stays (text on fixed dark fills)
      if (isBg && !(L > 0.50)) continue            // dark fills stay
      if (hex === '#FFFFFF' && isText) continue    // white text stays white
    }
    const line = src.slice(0, m.index).split('\n').length

    // Sibling gate.
    const sib = siblingColours(enclosingObject(src, m.index))
    let skip = null
    if (isText) {
      const fixedBg = sib.bg.find((b) => !isTransparentish(b) && !isTokenValue(b) && !(norm(b) && hexToToken[norm(b)] && lum(norm(b)) > 0.5))
      if (fixedBg) skip = `dark text next to a fixed background: ${fixedBg.slice(0, 60)}`
    } else if (isBg) {
      const fixedText = sib.text.find((t) => { const n = norm(t); return n && lum(n) > 0.6 && !hexToToken[n] })
        ?? sib.text.find((t) => { const n = norm(t); return n && lum(n) > 0.6 })
      if (fixedText) skip = `light background next to fixed light text: ${fixedText.slice(0, 40)}`
    }
    if (skip) { report.skipped.push(`${f}:${line}  ${prop}: ${rawValue}  — ${skip}`); continue }

    if (hex && LEGACY[hex]) report.legacyUsed.add(hex)
    out += src.slice(last, m.index) + `${prop}${sep}${quote}${token}${quote}`
    last = m.index + whole.length
    count++
    ;(report.byFile[f] ??= []).push(`${line}: ${prop} ${rawValue} -> ${token}`)
  }
  const afterColours = count ? out + src.slice(last) : src

  // Pass 2 — border / outline shorthands: `border: '1px solid #d1c6bd'`. Only LIGHT palette/
  // legacy hexes inside the string become tokens (so light borders flip to dark ones); `var(...)`
  // fallbacks and dark hexes are left alone. Skipped next to a fixed background we can't judge.
  const borderRe = /\b(border|borderTop|borderBottom|borderLeft|borderRight|outline)(\s*:\s*)(['"`])([^'"`\n]*#[0-9a-fA-F]{6}[^'"`\n]*)\3/g
  let bCount = 0
  const afterBorders = afterColours.replace(borderRe, (...a) => {
    const [whole, prop, sep, q, val] = a
    const offset = a[a.length - 2]
    const fixedBg = siblingColours(enclosingObject(afterColours, offset)).bg
      .find((b) => !isTransparentish(b) && !isTokenValue(b) && !(norm(b) && hexToToken[norm(b)] && lum(norm(b)) > 0.5))
    if (fixedBg) { report.skipped.push(`${f}  ${prop}: ${val.slice(0, 40)}  — border next to a fixed background: ${fixedBg.slice(0, 40)}`); return whole }
    const replaced = val.replace(/var\([^)]*\)|#[0-9a-fA-F]{6}\b/g, (tok) => {
      if (tok.startsWith('var(')) return tok
      const h = tok.toUpperCase(), t = hexToToken[h]
      if (!t || !(lum(h) > 0.3)) return tok
      if (LEGACY[h]) report.legacyUsed.add(h)
      return t
    })
    if (replaced === val) return whole
    bCount++
    const line = afterColours.slice(0, offset).split('\n').length
    ;(report.byFile[f] ??= []).push(`${line}: ${prop} ${val} -> ${replaced}`)
    return `${prop}${sep}${q}${replaced}${q}`
  })

  if (afterBorders !== src) {
    report.applied += count + bCount
    if (APPLY) writeFileSync(path, Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(afterBorders, 'utf8')]))
  }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'}: ${report.applied} replacements in ${Object.keys(report.byFile).length} files`)
console.log(`skipped by context rule: ${report.skipped.length}; files skipped as non-DOM colour consumers: ${report.nonDom.length}`)
console.log(`legacy literals used: ${[...report.legacyUsed].join(', ') || '(none)'}`)
if (process.argv.includes('--verbose')) {
  for (const [f, rows] of Object.entries(report.byFile)) { console.log('\n' + f); for (const r of rows) console.log('   ' + r) }
}
console.log('\n--- SKIPPED (for human review) ---')
for (const s of report.skipped) console.log(s)
console.log('\n--- NON-DOM files left untouched ---')
for (const f of report.nonDom) console.log(f)
console.log('\n--- files with uncommitted changes: NOT touched ---')
for (const f of skippedDirty) console.log(f)
