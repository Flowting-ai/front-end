'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowDownOneIcon, ArrowUpTwoIcon, BrainTwoIcon, CancelOneIcon, DeleteTwoIcon, PenOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/lib/markdown-utils'
import { editMemory, fetchMemorySummary, type MemoryGroup, type MemoryNote, type MemorySummary } from '@/lib/api/memory'

// One memory store on the settings Memory page: its notes topic by topic, each opening to the note itself, then the written summary and the edit chat.

const USER_GROUPS: { group: MemoryGroup; label: string }[] = [
  { group: 'profile', label: 'You' },
  { group: 'topics',  label: 'Topics' },
  { group: 'areas',   label: 'Areas' },
  { group: 'people',  label: 'People' },
]

const ORG_GROUPS: { group: MemoryGroup; label: string }[] = [
  { group: 'mission',    label: 'Mission & values' },
  { group: 'company',    label: 'Company' },
  { group: 'product',    label: 'Product & pricing' },
  { group: 'customers',  label: 'Customers & partners' },
  { group: 'team',       label: 'Team' },
  { group: 'operations', label: 'How we work' },
  { group: 'decisions',  label: 'Key decisions' },
]

const BODY = 'var(--font-body)'
const HOVER = 'color-mix(in srgb, var(--neutral-100) 60%, transparent)'
const CARD: React.CSSProperties = {
  border:          '1px solid var(--border-default)',
  borderRadius:    16,
  boxShadow:       '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
  overflow:        'hidden',
  backgroundColor: 'var(--neutral-white)',
}

type Exchange = { id: number; asked: string; reply: string | null; failed?: boolean }

function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`
  const days = Math.floor(minutes / 1_440)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function matches(note: MemoryNote, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return !needle || [note.title, note.description, note.content].some(text => text.toLowerCase().includes(needle))
}

function teaser(markdown: string): string {
  return markdown.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('#'))?.replace(/[*_`]/g, '') ?? ''
}

function NoteRow({ note, open, onToggle, onAsk }: {
  note:     MemoryNote
  open:     boolean
  onToggle: () => void
  onAsk:    (draft: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ borderTop: '1px solid var(--neutral-100)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:             'grid',
          gridTemplateColumns: '16px minmax(110px, 0.9fr) minmax(0, 2fr) auto',
          alignItems:          'center',
          gap:                 14,
          width:               '100%',
          padding:             '12px 24px 12px 18px',
          border:              'none',
          cursor:              'pointer',
          textAlign:           'left',
          backgroundColor:     open || hovered ? HOVER : 'transparent',
          transition:          'background-color 120ms ease',
          fontFamily:          BODY,
          fontSize:            14,
          lineHeight:          '22px',
        }}
      >
        <m.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', color: 'var(--neutral-400)' }}
        >
          <ArrowDownOneIcon size={14} />
        </m.span>
        <span style={{ fontWeight: 500, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
        <span style={{ color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.description}</span>
        <span style={{ color: 'var(--neutral-400)', fontSize: 13, whiteSpace: 'nowrap' }}>Updated {ago(note.updatedAt)}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                className="kaya-scrollbar"
                style={{
                  maxHeight:       360,
                  overflowY:       'auto',
                  padding:         '12px 16px',
                  borderRadius:    12,
                  backgroundColor: 'var(--field-surface)',
                  boxShadow:       '0px 0px 0px 1px var(--neutral-100)',
                  fontSize:        14,
                }}
              >
                <MarkdownRenderer content={note.content} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => onAsk(`About my “${note.title}” note: `)}>
                  <PenOneIcon size={14} /> Ask to change
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAsk(`Forget everything in my “${note.title}” note.`)}>
                  <DeleteTwoIcon size={14} /> Forget
                </Button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading memory">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px 8px', color: 'var(--neutral-400)' }}>
        <BrainTwoIcon size={16} />
        <span className="kaya-shimmer-text" style={{ fontFamily: BODY, fontSize: 14, lineHeight: '22px' }}>Organizing memory…</span>
      </div>
      {[0.55, 0.8, 0.65, 0.9, 0.5].map((width, i) => (
        <div key={width} style={{ display: 'grid', gridTemplateColumns: '16px minmax(110px, 0.9fr) minmax(0, 2fr) 72px', gap: 14, alignItems: 'center', padding: '14px 24px 14px 18px', borderTop: '1px solid var(--neutral-100)' }}>
          <div className="kaya-skeleton" style={{ width: 10, height: 10, animationDelay: `${i * 120}ms` }} />
          <div className="kaya-skeleton" style={{ width: '70%', height: 12, animationDelay: `${i * 120}ms` }} />
          <div className="kaya-skeleton" style={{ width: `${width * 100}%`, height: 12, animationDelay: `${i * 120}ms` }} />
          <div className="kaya-skeleton" style={{ width: 72, height: 12, animationDelay: `${i * 120}ms` }} />
        </div>
      ))}
    </div>
  )
}

function ManageDialog({ open, onOpenChange, orgId, summary, onSummary, draft, onDraft }: {
  open:         boolean
  onOpenChange: (open: boolean) => void
  orgId:        string | null
  summary:      MemorySummary
  onSummary:    (summary: MemorySummary) => void
  draft:        string
  onDraft:      (draft: string) => void
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [updating,  setUpdating]  = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  async function send() {
    const asked = draft.trim()
    if (!asked || updating) return
    onDraft('')
    setUpdating(true)
    const id = Date.now()
    setExchanges(previous => [...previous, { id, asked, reply: null }])
    try {
      const result = await editMemory(orgId, asked)
      onSummary(result.summary)
      setExchanges(previous => previous.map(item => item.id === id ? { ...item, reply: result.reply } : item))
    } catch {
      setExchanges(previous => previous.map(item => item.id === id ? { ...item, reply: 'That didn’t go through. Try again.', failed: true } : item))
    } finally {
      setUpdating(false)
    }
  }

  const ready = draft.trim() && !updating
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
      <Dialog.Overlay style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--overlay-bg)', backdropFilter: 'blur(2px)' }} />
      <Dialog.Content
        aria-describedby={undefined}
        style={{
          position:      'fixed',
          top:           '50%',
          left:          '50%',
          transform:     'translate(-50%, -50%)',
          zIndex:        9999,
          width:         760,
          maxWidth:      'calc(100vw - 32px)',
          height:        'calc(100dvh - 64px)',
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--neutral-white)',
          borderRadius:  16,
          boxShadow:     '0px 19px 32px 0px rgba(18,12,8,0.15), 0px 2px 2.8px 0px rgba(130,122,116,0.1)',
          outline:       'none',
          overflow:      'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 14px 24px', borderBottom: '1px solid var(--neutral-100)' }}>
          <Dialog.Title style={{ margin: 0, fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)' }}>
            {orgId ? 'Organization memory summary' : 'Memory summary'}
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', color: 'var(--neutral-500)' }}
          >
            <CancelOneIcon size={14} />
          </Dialog.Close>
        </div>

        <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', padding: '16px 24px' }}>
          <MarkdownRenderer content={summary.summary} />
          {exchanges.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--neutral-100)' }}>
              {exchanges.map(item => (
                <m.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: BODY, fontSize: 14, lineHeight: '22px' }}
                >
                  <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '8px 12px', borderRadius: 12, backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-900)' }}>{item.asked}</div>
                  {item.reply === null ? (
                    <span className="kaya-shimmer-text">Updating memory…</span>
                  ) : (
                    <div style={{ color: item.failed ? 'var(--red-600)' : 'var(--neutral-700)' }}>
                      <MarkdownRenderer content={item.reply} />
                    </div>
                  )}
                </m.div>
              ))}
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={event => { event.preventDefault(); void send() }} style={{ padding: '12px 24px 20px' }}>
          <div style={{
            display:         'flex',
            alignItems:      'center',
            gap:             8,
            padding:         '6px 6px 6px 16px',
            borderRadius:    999,
            backgroundColor: 'var(--field-surface)',
            boxShadow:       '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          }}>
            <input
              autoFocus
              value={draft}
              onChange={event => onDraft(event.target.value)}
              placeholder="Ask or update"
              maxLength={4000}
              style={{ flex: '1 0 0', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: BODY, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!ready}
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                width:           32,
                height:          32,
                borderRadius:    999,
                border:          'none',
                cursor:          ready ? 'pointer' : 'default',
                backgroundColor: ready ? 'var(--neutral-900)' : 'var(--neutral-300)',
                color:           'var(--neutral-white)',
                transition:      'background-color 120ms ease',
              }}
            >
              <ArrowUpTwoIcon size={16} />
            </button>
          </div>
        </form>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** `orgId` set = the organization's shared memory (the backend allows admins only); null = the user's own. */
export function MemorySection({ title, hint, orgId, query }: { title: string; hint: string; orgId: string | null; query: string }) {
  const groups = orgId ? ORG_GROUPS : USER_GROUPS
  const [summary,  setSummary]  = useState<MemorySummary | null>(null)
  const [failed,   setFailed]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialog,   setDialog]   = useState(false)
  const [draft,    setDraft]    = useState('')

  useEffect(() => {
    let cancelled = false
    fetchMemorySummary(orgId)
      .then(result => { if (!cancelled) { setSummary(result); setFailed(false) } })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [orgId])

  function ask(seed: string) {
    setDraft(seed)
    setDialog(true)
  }

  const shown = summary?.notes.filter(note => matches(note, query)) ?? []

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, paddingLeft: 4 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>{title}</h2>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: 0 }}>{hint}</p>
        </div>
        {summary && summary.notes.length > 0 && (
          <span style={{ fontFamily: BODY, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-400)', whiteSpace: 'nowrap' }}>
            {summary.notes.length} notes · summarized {ago(summary.generatedAt)}
          </span>
        )}
      </div>

      <div style={CARD}>
        {summary === null ? (
          failed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 24px', color: 'var(--neutral-400)', fontFamily: BODY, fontSize: 14 }}>
              <BrainTwoIcon size={32} />
              Couldn’t load this memory. Try again in a moment.
            </div>
          ) : <Skeleton />
        ) : summary.notes.length === 0 ? (
          <div style={{ padding: '16px 24px', fontFamily: BODY, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>{summary.summary}</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: '16px 24px', fontFamily: BODY, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)' }}>No notes match “{query.trim()}”.</div>
        ) : (
          groups.map(({ group, label }, index) => {
            const notes = shown.filter(note => note.group === group)
            if (notes.length === 0) return null
            return (
              <div key={group} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--neutral-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px 10px' }}>
                  <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)' }}>{label}</span>
                  <span style={{
                    display:         'inline-flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    minWidth:        20,
                    height:          20,
                    padding:         '0 6px',
                    borderRadius:    99,
                    backgroundColor: 'var(--neutral-100)',
                    color:           'var(--neutral-600)',
                    fontFamily:      BODY,
                    fontSize:        12,
                    fontWeight:      500,
                  }}>
                    {notes.length}
                  </span>
                </div>
                {notes.map(note => (
                  <NoteRow
                    key={note.path}
                    note={note}
                    open={expanded === note.path}
                    onToggle={() => setExpanded(current => current === note.path ? null : note.path)}
                    onAsk={ask}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px' }}>
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           36,
          height:          36,
          flexShrink:      0,
          borderRadius:    10,
          backgroundColor: 'var(--neutral-100)',
          color:           'var(--neutral-600)',
        }}>
          <BrainTwoIcon size={18} />
        </div>
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-900)', margin: 0 }}>Manage memory</p>
          <p style={{
            fontFamily:      BODY,
            fontSize:        14,
            lineHeight:      '22px',
            color:           'var(--neutral-500)',
            margin:          0,
            display:         '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow:        'hidden',
          }}>
            {summary && summary.notes.length > 0 ? teaser(summary.summary) : 'Read the full summary and ask Souvenir to add, change or forget anything.'}
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={summary === null} onClick={() => ask('')}>Open summary</Button>
      </div>

      {summary && (
        <ManageDialog
          open={dialog}
          onOpenChange={setDialog}
          orgId={orgId}
          summary={summary}
          onSummary={setSummary}
          draft={draft}
          onDraft={setDraft}
        />
      )}
    </section>
  )
}

export default MemorySection
