'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CancelOneIcon, SearchOneIcon } from '@strange-huge/icons'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { MAX_SEARCH_LENGTH, type LibraryQuery } from '@/lib/library/query-params'
import type { SetLibraryQuery } from '@/lib/library/use-library-query'

/**
 * The search pill. The text you type is a local draft that stays instant; only the debounced value is
 * written to the URL (and so becomes the request key). The scope toggle ("In All files" or
 * "All of Library") lives in the header.
 */
export function LibrarySearch({ query, setQuery }: { query: LibraryQuery; setQuery: SetLibraryQuery }) {
  const [draft, setDraft] = useState(query.q)
  const lastWritten = useRef(query.q)
  // Set when the person types, cleared when the URL changes from outside: only their own typing is
  // written back. Without it the debounced value, still holding the old search for 250ms, would undo
  // a "Clear filters" or a Back.
  const typed = useRef(false)
  const debounced = useDebouncedValue(draft.trim(), 250)
  const edit = (value: string) => {
    typed.current = true
    setDraft(value)
  }

  // URL to input: Back/Forward, "Clear filters" or a shared link changes q from outside.
  useEffect(() => {
    if (query.q !== lastWritten.current) {
      lastWritten.current = query.q
      typed.current = false
      setDraft(query.q)
    }
  }, [query.q])

  // Input to URL: only once the person pauses, and only when it actually differs.
  useEffect(() => {
    if (typed.current && debounced === draft.trim() && debounced !== lastWritten.current) {
      lastWritten.current = debounced
      setQuery({ q: debounced })
    }
  })

  return (
    <div
      role="search"
      style={{
        // Up to 240px, and it shrinks (to 160px) before the header's tools wrap, as in the prototype.
        display: 'flex', alignItems: 'center', gap: 2, padding: '7px 10px', margin: '0 4px', flex: '0 1 240px', minWidth: 160, boxSizing: 'border-box', borderRadius: 10,
        background: 'var(--text-field-bg)', boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--text-field-ring)',
      }}
    >
      <SearchOneIcon size={16} style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />
      <input
        type="search"
        value={draft}
        maxLength={MAX_SEARCH_LENGTH}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape' && draft) { event.preventDefault(); edit('') } }}
        placeholder="Search library"
        aria-label="Search library"
        autoComplete="off"
        style={{
          flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '0 2px', appearance: 'none',
          fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)',
        }}
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => edit('')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--neutral-400)', flexShrink: 0, borderRadius: 4 }}
        >
          <CancelOneIcon size={12} />
        </button>
      )}
    </div>
  )
}
