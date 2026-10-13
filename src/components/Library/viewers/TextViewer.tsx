'use client'

import React, { useEffect, useRef } from 'react'
import { parsePageCite, splitPassage } from '@/lib/library/cite'
import { FILE_MESSAGES } from '@/lib/library/messages'
import { CITED_MARK, CitedLabel } from './CitedLabel'

export interface TextViewerProps {
  pages: { label: string; text: string }[]
  /** A page citation's value ("2", "Page 2"). */
  citePage?: string | null
  /** The cited sentence on that page: it is marked and scrolled into view. Without it the page is outlined. */
  passage?: string | null
}

/**
 * Extracted text, one section per page, shown as plain text (never HTML), with the cited passage marked.
 * Documents, slides, email, web pages and text files all preview this way until a rendered preview exists.
 */
export default function TextViewer({ pages, citePage, passage }: TextViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cited = citePage ? parsePageCite(citePage) : null
  // A label match wins ("Slide 2"), otherwise the page's position.
  const citedIndex = citePage ? pages.findIndex((page, index) => page.label === citePage || (cited !== null && index + 1 === cited)) : -1
  const split = citedIndex >= 0 ? splitPassage(pages[citedIndex].text, passage) : null

  useEffect(() => {
    if (citedIndex < 0) return
    const target = rootRef.current?.querySelector('[data-cited]') ?? document.getElementById(`text-page-${citedIndex}`)
    target?.scrollIntoView({ block: 'center' })
  }, [citedIndex, passage])

  if (pages.length === 0) {
    return <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)' }}>This file has no readable text.</p>
  }

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 720 }}>
      {pages.map((page, index) => {
        const marked = index === citedIndex && split
        return (
          <section
            key={index}
            id={`text-page-${index}`}
            aria-label={page.label}
            style={{
              padding: '20px 24px', borderRadius: 12, background: 'var(--card-bg)', boxShadow: 'var(--shadow-card-default)',
              // No passage to mark: the cited page itself is outlined.
              outline: index === citedIndex && !split ? '3px solid var(--color-tag-Yellow-text)' : 'none', outlineOffset: 2,
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{page.label}</h3>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '24px', color: 'var(--neutral-900)' }}>
              {marked ? (
                <>
                  {marked.before}
                  <mark data-cited="true" style={{ ...CITED_MARK, padding: '0 2px' }}>{marked.match}</mark>
                  <CitedLabel>{FILE_MESSAGES.citedPassage}</CitedLabel>
                  {marked.after}
                </>
              ) : (
                page.text
              )}
            </p>
          </section>
        )
      })}
    </div>
  )
}
