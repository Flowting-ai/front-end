/**
 * highlight-loader.ts
 *
 * Lazy, shared loading of the highlight.js bundle (lib/highlight.ts) for code
 * blocks. Kept out of CodeBlock.tsx so that file only exports components
 * (Fast Refresh), and so ContentRenderer can start the download as soon as a
 * reply contains a fence, before the first CodeBlock mounts.
 *
 * Exposes a tiny external store: the snapshot changes when the bundle
 * finishes loading and whenever a lazy language gets registered, so code
 * blocks re-highlight exactly then — and highlight synchronously on first
 * render once everything they need is already in place.
 */

import type hljsInstance from "@/lib/highlight"

type HighlightModule = typeof import("@/lib/highlight")
export type Hljs = typeof hljsInstance

export interface HighlighterSnapshot {
  /** null until the bundle has loaded. */
  hljs: Hljs | null
}

const SERVER_SNAPSHOT: HighlighterSnapshot = { hljs: null }

let snapshot: HighlighterSnapshot = SERVER_SNAPSHOT
let modulePromise: Promise<HighlightModule> | null = null
const listeners = new Set<() => void>()

function publish(hljs: Hljs) {
  snapshot = { hljs }
  listeners.forEach((listener) => listener())
}

function loadModule(): Promise<HighlightModule> {
  if (!modulePromise) {
    modulePromise = import("@/lib/highlight").then(
      (mod) => {
        publish(mod.default)
        return mod
      },
      (error: unknown) => {
        modulePromise = null // let a later code block retry the chunk
        throw error
      },
    )
  }
  return modulePromise
}

/** Starts downloading the highlighter without waiting for it. */
export function prefetchHighlighter(): void {
  loadModule().catch(() => {
    // A failed chunk load only means plain, unhighlighted code.
  })
}

/**
 * Loads the highlighter and, when given, the grammar for `language` (lazy
 * languages like sql/java/go/rust are not in the base bundle). Resolves once
 * both are registered; subscribers are notified when anything new arrived.
 */
export async function ensureHighlighter(language?: string): Promise<void> {
  const mod = await loadModule()
  if (!language || mod.default.getLanguage(language)) return
  await mod.ensureLanguage(language)
  if (mod.default.getLanguage(language)) publish(mod.default)
}

export function subscribeHighlighter(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getHighlighterSnapshot(): HighlighterSnapshot {
  return snapshot
}

export function getHighlighterServerSnapshot(): HighlighterSnapshot {
  return SERVER_SNAPSHOT
}
