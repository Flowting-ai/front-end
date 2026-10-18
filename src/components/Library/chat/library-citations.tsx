'use client'

// Library citations in chat answers (LIBRARY_FLOW_A_BACKEND_TICKET.md Part 2). The answer text carries a marker
// after each sentence that relied on a Library passage, `[[L1]]`, and the stream's `library_citations`
// event (or the message history's `libraryCitations`) says which file and place each id means. A
// marker renders as a LibraryCitationChip that opens the file with the passage highlighted. A marker
// with no matching citation renders nothing: chips are never made up from the text.

import React, { createContext, useContext } from 'react'
import { z } from 'zod'
import { openChatFilePanel } from '@/lib/library/chat-file-panel'
import { formatSchema, type CiteLocator } from '@/lib/library/schemas'
import type { FileRef } from '@/lib/library/sources'
import { LibraryCitationChip } from './LibraryCitationChip'

const locatorSchema = z.object({
  type: z.enum(['page', 'row', 'time']),
  value: z.coerce.string().min(1).max(200),
  passage: z.string().max(500).optional(),
})

const citationSchema = z.discriminatedUnion('state', [
  z.object({ id: z.string().min(1), fileId: z.string().min(1), state: z.literal('open'), title: z.string(), format: formatSchema, locator: locatorSchema.nullish() }),
  z.object({ id: z.string().min(1), fileId: z.string().min(1), state: z.literal('locked') }),
  z.object({ id: z.string().min(1), fileId: z.string().min(1), state: z.literal('deleted') }),
])

export type LibraryCitation = z.infer<typeof citationSchema>

/** Reads the citations from the stream event or history; entries that do not parse are dropped. */
export function parseLibraryCitations(raw: unknown): LibraryCitation[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const parsed = citationSchema.safeParse(entry)
    return parsed.success ? [parsed.data] : []
  })
}

/** `[[L1]]`, as the model writes it. */
export const LIBRARY_MARKER = /\[\[(L\d{1,4})\]\]/g

/**
 * Turns markers into `libcite://` links so they survive markdown parsing (like web `citation://N`).
 * While streaming, a marker cut off at the end of the text so far is hidden until it completes.
 */
export function preprocessLibraryMarkers(content: string, streaming = false): string {
  if (!content.includes('[[')) return content
  const linked = content.replace(LIBRARY_MARKER, (_, id: string) => `[${id}](libcite://${id})`)
  return streaming ? linked.replace(/\[\[L?\d*\]?$/, '') : linked
}

/** The answer text without markers, for copying and sharing. */
export function stripLibraryMarkers(content: string): string {
  return content.replace(LIBRARY_MARKER, '')
}

const LibraryCitationsContext = createContext<readonly LibraryCitation[]>([])

export function LibraryCitationsProvider({ citations, children }: { citations?: readonly LibraryCitation[]; children: React.ReactNode }) {
  if (!citations?.length) return <>{children}</>
  return <LibraryCitationsContext.Provider value={citations}>{children}</LibraryCitationsContext.Provider>
}

function toFileRef(citation: LibraryCitation): FileRef {
  if (citation.state === 'open') return { id: citation.fileId, state: 'open', title: citation.title, format: citation.format }
  return { id: citation.fileId, state: citation.state }
}

/** One marker in the answer. */
export function LibraryCiteMarker({ id }: { id: string }) {
  const citation = useContext(LibraryCitationsContext).find((entry) => entry.id === id)
  if (!citation) return null
  const locator: CiteLocator | null = citation.state === 'open' ? citation.locator ?? null : null
  return <LibraryCitationChip fileRef={toFileRef(citation)} locator={locator} onOpenLocked={openChatFilePanel} />
}
