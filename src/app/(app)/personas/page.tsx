'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  PlusSignIcon,
  SearchOneIcon,
  ArrowDownOneIcon,
  MoreVerticalIcon,
  CopyOneIcon,
  PenOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { fetchPersonas, deletePersona, type Persona } from '@/lib/api/personas'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'my-personas' | 'super-links' | 'community'
type SortKey = 'activity' | 'recent' | 'alphabetical'

// ── Mock recommended personas (community templates) ───────────────────────────

const RECOMMENDED: Persona[] = [
  {
    id: 'rec-1',
    name: 'General Assistant',
    handle: '@general_assistant',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    tags: [],
    temperature: 0.5,
    isActive: true,
    status: 'completed',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'rec-2',
    name: 'Research Analyst',
    handle: '@research_analyst',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    tags: [],
    temperature: 0.3,
    isActive: true,
    status: 'completed',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'rec-3',
    name: 'Code Reviewer',
    handle: '@code_reviewer',
    description: 'Example: The key distinction is that replicants possess artificial intelligence. It\'s all there. Let me walk you through what\'s built.',
    imageUrl: null,
    tags: [],
    temperature: 0.3,
    isActive: true,
    status: 'completed',
    createdAt: '',
    updatedAt: '',
  },
]

// ── PersonaAvatar ─────────────────────────────────────────────────────────────

function PersonaAvatar({ imageUrl, name, size = 65 }: { imageUrl: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false)
  const initials = name.slice(0, 2).toUpperCase()

  if (imageUrl && !error) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
          position: 'relative',
        }}
      >
        <img
          src={imageUrl}
          alt={name}
          onError={() => setError(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        flexShrink: 0,
        background: 'var(--neutral-100)',
        boxShadow: '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-medium)',
        fontSize: 20,
        color: 'var(--neutral-500)',
      }}
    >
      {initials}
    </div>
  )
}

// ── PersonaCard ───────────────────────────────────────────────────────────────

interface PersonaCardProps {
  persona: Persona
  onChat: () => void
  onEdit: () => void
  onDelete: () => void
}

function PersonaCard({ persona, onChat, onEdit, onDelete }: PersonaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const btnRef = React.useRef<HTMLSpanElement>(null)

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuAnchor({ top: rect.bottom + 4, left: rect.right - 160 })
    }
    setMenuOpen(true)
  }

  return (
    <div
      onClick={onChat}
      style={{
        background: 'var(--neutral-white)',
        borderRadius: 16,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        boxShadow: '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
        cursor: 'pointer',
        transition: 'box-shadow 150ms',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
        <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} />

        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Name row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ minWidth: 0, flex: '1 0 0' }}>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 16,
                lineHeight: '22px',
                color: 'var(--neutral-900)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0,
              }}>
                {persona.name}
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 13,
                lineHeight: '16px',
                color: 'var(--neutral-500)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: 0,
              }}>
                {persona.handle}
              </p>
            </div>

            <span ref={btnRef}>
              <IconButton
                variant="ghost-2"
                size="sm"
                icon={<MoreVerticalIcon size={20} />}
                aria-label={`Actions for ${persona.name}`}
                onClick={openMenu}
              />
            </span>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge label="Private" color="Neutral" />
            <Badge label="Research" color="Neutral" />
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-regular)',
        fontSize: 11,
        lineHeight: '16px',
        color: '#857a72',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        margin: 0,
      }}>
        {persona.description || 'No description provided.'}
      </p>

      {/* Context menu */}
      <AnimatePresence>
        {menuOpen && menuAnchor && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
            />
            <motion.div
              {...DROPDOWN_SCALE_PRESET}
              style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, zIndex: 50 }}
            >
              <Dropdown>
                <Dropdown.Section>
                  <Dropdown.Item label="Edit configuration" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit() }} fluid />
                  <Dropdown.Item label="Delete" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }} fluid />
                </Dropdown.Section>
              </Dropdown>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── RecommendedCard ───────────────────────────────────────────────────────────

function RecommendedCard({ persona }: { persona: Persona }) {
  return (
    <div style={{
      background: 'var(--neutral-white)',
      borderRadius: 16,
      paddingTop: 12,
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      boxShadow: '0px 2px 2.8px 0px var(--blue-100, #cadcf1), 0px 0px 0px 1px var(--neutral-100)',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <PersonaAvatar imageUrl={persona.imageUrl} name={persona.name} size={65} />

        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize: 16,
            lineHeight: '22px',
            color: 'var(--neutral-900)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}>
            {persona.name}
          </p>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--font-weight-regular)',
            fontSize: 13,
            lineHeight: '16px',
            color: 'var(--neutral-500)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}>
            {persona.handle}
          </p>
        </div>

        <IconButton
          variant="ghost-2"
          size="sm"
          icon={<CopyOneIcon size={20} />}
          aria-label={`Copy ${persona.name}`}
        />
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-regular)',
        fontSize: 11,
        lineHeight: '16px',
        color: '#857a72',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        margin: 0,
        minHeight: 32,
      }}>
        {persona.description}
      </p>

      {/* Action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
      }}>
        <IconButton
          variant="ghost-2"
          size="sm"
          icon={<PenOneIcon size={20} />}
          aria-label={`Edit ${persona.name}`}
        />
        <Button variant="outline" size="sm">
          Use in chat
        </Button>
      </div>
    </div>
  )
}

// ── Inline tab bar ────────────────────────────────────────────────────────────

interface TabBarProps {
  active: TabId
  onChange: (id: TabId) => void
  personaCount: number
}

function TabBar({ active, onChange, personaCount }: TabBarProps) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'my-personas', label: `My Personas (${personaCount})` },
    { id: 'super-links', label: 'Super Links' },
    { id: 'community',   label: 'Community' },
  ]

  return (
    <div style={{
      display: 'inline-flex',
      padding: 3,
      borderRadius: 10,
      background: 'rgba(247,242,237,0.5)',
      boxShadow: 'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 8px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 14,
              lineHeight: '22px',
              color: isActive ? 'var(--neutral-700)' : 'var(--neutral-500)',
              background: isActive ? 'var(--neutral-white)' : 'transparent',
              boxShadow: isActive
                ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                : 'none',
              whiteSpace: 'nowrap',
              transition: 'all 150ms',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onCancel} />
      <div style={{
        position: 'relative',
        background: 'var(--neutral-white)',
        borderRadius: 16,
        padding: 24,
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0px 20px 40px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: 20, fontWeight: 400, color: 'var(--neutral-900)', margin: 0 }}>Delete Persona</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-600)', margin: 0 }}>
          Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const router = useRouter()

  const [activeTab, setActiveTab]   = useState<TabId>('my-personas')
  const [personas,  setPersonas]    = useState<Persona[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [search,    setSearch]      = useState('')
  const [sortOpen,  setSortOpen]    = useState(false)
  const [sort,      setSort]        = useState<SortKey>('activity')
  const [sortAnchor, setSortAnchor] = useState<{ top: number; left: number } | null>(null)
  const sortBtnRef = React.useRef<HTMLSpanElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null)

  // Load personas on mount
  useEffect(() => {
    setIsLoading(true)
    fetchPersonas()
      .then(setPersonas)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...personas]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    if (sort === 'alphabetical') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'recent')  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return list
  }, [personas, search, sort])

  const sortLabels: Record<SortKey, string> = {
    activity:     'Activity',
    recent:       'Recent',
    alphabetical: 'Alphabetical',
  }

  async function handleDelete(id: string) {
    try {
      await deletePersona(id)
      setPersonas(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete persona:', err)
    }
  }

  function openSort(e: React.MouseEvent) {
    e.stopPropagation()
    if (sortBtnRef.current) {
      const rect = sortBtnRef.current.getBoundingClientRect()
      setSortAnchor({ top: rect.bottom + 4, left: rect.right - 180 })
    }
    setSortOpen(true)
  }

  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 22,
        flex: '1 0 0',
        display: 'flex',
        flexDirection: 'column',
        padding: '36px 12px 24px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 967,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 41,
        }}>

          {/* ── Header + Tabs + Toolbar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize: 24,
                lineHeight: '32px',
                color: '#1a1916',
                margin: 0,
              }}>
                Persona
              </h1>
              <Button
                variant="default"
                leftIcon={<PlusSignIcon size={16} />}
                onClick={() => router.push('/personas/templates')}
              >
                New persona
              </Button>
            </div>

            {/* Tabs + toolbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TabBar active={activeTab} onChange={setActiveTab} personaCount={personas.length} />

              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* All filter button */}
                  <Button variant="outline" rightIcon={<ArrowDownOneIcon size={16} />}>
                    All
                  </Button>

                  {/* Search */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '7px 10px',
                    borderRadius: 10,
                    background: 'white',
                    boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
                    width: 450,
                  }}>
                    <SearchOneIcon size={16} style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search persona"
                      style={{
                        flex: '1 0 0',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 14,
                        lineHeight: '22px',
                        color: 'var(--neutral-600)',
                        padding: '0 2px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Sort button */}
                  <span ref={sortBtnRef}>
                    <Button variant="outline" onClick={openSort}>
                      Sort by : {sortLabels[sort]}
                    </Button>
                  </span>

                  {/* Filter button */}
                  <Button variant="outline">
                    Filter
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Persona grid ── */}
          {activeTab === 'my-personas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isLoading ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 314px)',
                  gap: 16,
                }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      height: 140,
                      borderRadius: 16,
                      background: 'var(--neutral-100)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                search.trim() ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '80px 24px',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 'var(--font-weight-regular)',
                      fontSize: 14,
                      lineHeight: '22px',
                      color: 'var(--neutral-500)',
                      textAlign: 'center',
                      margin: 0,
                    }}>
                      No personas matching &ldquo;{search}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 24,
                    padding: '112px 24px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                      <p style={{
                        fontFamily: 'var(--font-title)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 24,
                        lineHeight: '32px',
                        color: '#1a1916',
                        margin: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        No personas yet
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 'var(--font-weight-regular)',
                        fontSize: 16,
                        lineHeight: '22px',
                        color: '#1a1916',
                        textAlign: 'center',
                        maxWidth: 427,
                        margin: 0,
                      }}>
                        Personas are your custom AI configurations — define behavior, connect knowledge, and share via link.
                      </p>
                    </div>
                    <Button variant="default" onClick={() => router.push('/personas/templates')}>
                      Create your first persona
                    </Button>
                  </div>
                )
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                }}>
                  {filtered.map(persona => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      onChat={() => router.push(`/personas/${persona.id}/chat`)}
                      onEdit={() => router.push(`/personas/new/configure?personaId=${persona.id}`)}
                      onDelete={() => setDeleteTarget(persona)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Recommended for you ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--neutral-400)',
              margin: 0,
            }}>
              Recommended for you
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}>
              {RECOMMENDED.map(p => (
                <RecommendedCard key={p.id} persona={p} />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Sort dropdown ── */}
      <AnimatePresence>
        {sortOpen && sortAnchor && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setSortOpen(false)} />
            <motion.div
              {...DROPDOWN_SCALE_PRESET}
              style={{ position: 'fixed', top: sortAnchor.top, left: sortAnchor.left, zIndex: 50 }}
            >
              <Dropdown>
                <Dropdown.Section>
                  {(['activity', 'recent', 'alphabetical'] as SortKey[]).map(k => (
                    <Dropdown.Item
                      key={k}
                      label={sortLabels[k]}
                      selected={sort === k}
                      onClick={() => { setSort(k); setSortOpen(false) }}
                      fluid
                    />
                  ))}
                </Dropdown.Section>
              </Dropdown>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onConfirm={() => {
            handleDelete(deleteTarget.id)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
