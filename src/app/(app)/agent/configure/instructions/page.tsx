'use client'

import React, { useState, Suspense, useEffect, useEffectEvent, useRef, useCallback } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  ArrowDownOneIcon,
  AtomOneIcon,
  AtomTwoIcon,
  PlusSignIcon,
  CancelOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  SearchOneIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { InputField } from '@/components/InputField'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { ModelSelectItem } from '@/components/ModelSelectItem'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import ExampleConversationModal from '@/app/(app)/agent/configure/components/ExampleConversationModal'
import RepublishModal from '@/app/(app)/agent/configure/components/RepublishModal'
import { useInstructionHistory } from '@/app/(app)/agent/configure/hooks/use-instruction-history'
import {
  createVersion,
  deleteVersion,
  getPersonaRepo,
  getVersion,
  setActiveVersion,
  publishPersonaVersion,
  updateVersion,
  listVersions,
  inheritKnowledge,
  bustPersonasCache,
} from '@/lib/api/personas'
import {
  derivePublicationState,
  pickVersionToEdit,
} from '@/lib/persona-version-logic'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import { recordModelUsage, sortModelsByUsage } from '@/lib/model-usage'
import type { AIModel } from '@/types/ai-model'
import { LlmIcon } from '@strange-huge/icons/llm'
import { getModelLlmId } from '@/lib/model-icons'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { personaProfileKey } from '@/lib/storage-keys'
import { AGENT_CONFIGURE_INSTRUCTIONS_ROUTE, AGENTS_ROUTE } from '@/lib/routes'
import { setVersionTags } from '@/lib/version-tags'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Divider } from '@/components/Divider'
import { Slider } from '@/components/Slider'
import { AttributeTocRail, ATTRIBUTE_HEADER_STYLE, type AttributeTocItem } from '@/app/(app)/agent/configure/components/AttributeTrackerRail'

// ── Table-of-contents rail items for this tab ─────────────────────────────────
// Rail component itself + ATTRIBUTE_HEADER_STYLE are shared across all 5
// configure tabs — see components/AttributeTrackerRail.tsx.

const INSTRUCTIONS_TOC_ITEMS: AttributeTocItem[] = [
  { id: 'model',       label: 'Model',        anchor: 'help-model' },
  { id: 'instruction', label: 'Instructions', anchor: 'help-instruction' },
  { id: 'temperature', label: 'Creativity',   anchor: 'help-temperature' },
  { id: 'examples',    label: 'Examples',     anchor: 'help-examples' },
]

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Profile:    '/agent/configure/profile',
  Knowledge:  '/agent/configure/knowledge',
  Connectors: '/agent/configure/connectors',
  Sharing:    '/agent/configure/sharing',
}

const MAX_VERSIONS = 5

function nameInitials(name: string): string {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function parseExampleConversations(text: string): Array<{ id: string; userSays: string; personaReplies: string }> {
  const results: Array<{ id: string; userSays: string; personaReplies: string }> = []
  const regex = /<example>([\s\S]*?)<\/example>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const block = match[1].trim()
    const userLine      = block.match(/^User:\s*(.+)/m)
    const assistantLine = block.match(/Assistant:\s*([\s\S]+)/m)
    results.push({
      id:             crypto.randomUUID(),
      userSays:       userLine?.[1]?.trim() ?? '',
      personaReplies: assistantLine?.[1]?.trim() ?? '',
    })
  }
  return results
}

function removeExampleBlock(text: string, userSays: string, personaReplies: string): string {
  const lines = ['<example>']
  if (userSays.trim()) lines.push(`User: ${userSays.trim()}`)
  lines.push(`Assistant: ${personaReplies.trim()}`)
  lines.push('</example>')
  const block = lines.join('\n')
  return text.replace(`\n\n${block}`, '').replace(`${block}\n\n`, '').replace(block, '').trim()
}

function getTemperatureLabel(v: number): string {
  if (v <= 0.12) return 'Very Precise'
  if (v <= 0.37) return 'Precise'
  if (v <= 0.62) return 'Balanced'
  if (v <= 0.87) return 'Creative'
  return 'Very Creative'
}

// ── Undo / redo group — matches Figma node 848:54854 footer button group ─────

function UndoRedoGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean
  canRedo: boolean
  onUndo:  () => void
  onRedo:  () => void
}) {
  const baseStyle: React.CSSProperties = {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           36,
    height:          36,
    padding:         8,
    border:          'none',
    backgroundColor: 'transparent',
    boxShadow:       '0px 0px 0px 1px rgba(59,54,50,0.3)',
    cursor:          'pointer',
    color:           'var(--neutral-700)',
    transition:      'background-color 150ms, opacity 150ms',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        style={{
          ...baseStyle,
          borderTopLeftRadius:    10,
          borderBottomLeftRadius: 10,
          opacity:                canUndo ? 1 : 0.4,
          cursor:                 canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        <ArrowLeftOneIcon size={20} />
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={onRedo}
        style={{
          ...baseStyle,
          borderTopRightRadius:    10,
          borderBottomRightRadius: 10,
          opacity:                 canRedo ? 1 : 0.4,
          cursor:                  canRedo ? 'pointer' : 'not-allowed',
        }}
      >
        <ArrowRightOneIcon size={20} />
      </button>
    </div>
  )
}

// ── Model row helpers — mirror PresetModelSelectorDialog's real filtering/
// capability logic so this picker reads as the same design-system component,
// minus the Muse/Advanced cards and category tabs (not applicable to picking
// one fixed model for an agent).

// Deterministic tag → Badge color, same hash as ModelSelector.tsx's local
// tagColor (not exported there, so duplicated here rather than forcing a
// shared-utils extraction for a 4-line pure function).
const TAG_PALETTE: BadgeColor[] = ['Green', 'Blue', 'Purple', 'Brown', 'Yellow']
function tagColor(tag: string): BadgeColor {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

function modelTagBadges(model: AIModel): React.ReactNode {
  if (!model.tags || model.tags.length === 0) return undefined
  return (
    <>
      {model.tags.map(tag => (
        <Badge key={tag} label={tag} color={tagColor(tag)} />
      ))}
    </>
  )
}

// The tooltip renders on the dark gradient background (--tooltip-bg-from/to),
// unlike MODEL_PICKER_CAPTION_STYLE's dropdown-panel captions below — headers
// and empty-state copy here dim the light --tooltip-text color via opacity
// instead of using a light-mode neutral shade that would read low-contrast.
const TOOLTIP_SECTION_HEADER_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--tooltip-text)',
  opacity:    0.6,
}

const TOOLTIP_EMPTY_TEXT_STYLE: React.CSSProperties = {
  color:      'var(--tooltip-text)',
  opacity:    0.6,
  fontStyle:  'italic',
}

function modelInfoSection(header: string, emptyText: string, content: React.ReactNode | null): React.ReactNode {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={TOOLTIP_SECTION_HEADER_STYLE}>{header}</span>
      {content ?? <span style={TOOLTIP_EMPTY_TEXT_STYLE}>{emptyText}</span>}
    </span>
  )
}

function modelInfoContent(model: AIModel): React.ReactNode {
  const hasEfforts = !!(model.thinkingEfforts && model.thinkingEfforts.length > 0)

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {modelInfoSection(
        'Description',
        'No information on this model yet.',
        model.description ? <span>{model.description}</span> : null,
      )}

      <Divider decorative />

      {modelInfoSection(
        'Reasoning effort',
        'No reasoning effort levels for this model yet.',
        hasEfforts ? (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {model.thinkingEfforts!.map((effort) => (
              <Badge key={effort} label={effort} color="Purple" />
            ))}
          </span>
        ) : null,
      )}
    </span>
  )
}

const MODEL_PICKER_CAPTION_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-medium)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-500)',
  whiteSpace: 'nowrap',
}

// ── Inline anchored model dropdown ───────────────────────────────────────────
// The chat-style ModelSelector renders a centered modal — wrong for this page,
// where the dropdown must drop under its trigger and span the trigger's width.
// Panel content mirrors ModelSelector/PresetModelSelectorDialog (search + tier
// + provider tabs, ModelSelectItem rows).

function ModelDropdown({
  models,
  selectedModel,
  open,
  onOpenChange,
  onSelect,
}: {
  models:        AIModel[]
  selectedModel: AIModel | null
  open:          boolean
  onOpenChange:  (open: boolean) => void
  onSelect:      (model: AIModel) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [search,   setSearch]   = useState('')
  const [provider, setProvider] = useState('all')
  const [atTop,    setAtTop]    = useState(true)
  const [atBottom, setAtBottom] = useState(false)
  // Tracks the dropdown's own rendered width so each row's info tooltip can
  // be capped to match it, rather than an arbitrary fixed pixel value.
  const [dropdownWidth, setDropdownWidth] = useState(280)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setDropdownWidth(el.getBoundingClientRect().width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close on outside click + Escape
  const closeDropdown = useEffectEvent((v: boolean) => onOpenChange(v))
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Sorted company list (most models first) — same derivation as ModelSelector.
  const companies = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of models) counts[m.companyName] = (counts[m.companyName] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c)
  }, [models])

  const filtered = models.filter(m => {
    if (provider !== 'all' && m.companyName !== provider) return false
    if (search) {
      const q = search.toLowerCase()
      if (!m.modelName.toLowerCase().includes(q) && !m.companyName.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Clump models by company, most-populous company first (same order as the
  // provider tabs), so switching tabs doesn't reshuffle groups already seen.
  // Within each company, this browser's most-used models float to the top —
  // models never picked here or in chat keep their original relative order.
  const groupedFiltered = React.useMemo(() => {
    const byCompany = new Map<string, AIModel[]>()
    for (const m of filtered) {
      const list = byCompany.get(m.companyName)
      if (list) list.push(m)
      else byCompany.set(m.companyName, [m])
    }
    return companies
      .filter(c => byCompany.has(c))
      .map(c => ({ company: c, items: sortModelsByUsage(byCompany.get(c)!) }))
  }, [filtered, companies])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setAtTop(el.scrollTop < 34)
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={ATTRIBUTE_HEADER_STYLE}>
          Model
        </span>
        {!selectedModel && (
          <Badge
            label="Required"
            color="Red"
            className="animate-pulse"
          />
        )}
      </div>
      <Button
        type="button"
        variant="secondary"
        fluid
        // Note: `className` targets Button's inner element, which has
        // `overflow: hidden` and would clip an outward box-shadow ring — the
        // animation must go on `style` instead, which Button applies to the
        // OUTER wrapper span (no overflow clipping there).
        style={!selectedModel ? { animation: 'kaya-warning-blink 1.4s ease-in-out infinite' } : undefined}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={!selectedModel}
        leftIcon={
          selectedModel ? (
            <LlmIcon
              id={getModelLlmId(selectedModel.companyName, selectedModel.modelName) ?? ''}
              variant="color"
              size={16}
            />
          ) : (
            <AtomOneIcon size={16} />
          )
        }
        rightIcon={
          <ArrowDownOneIcon
            size={16}
            style={{
              transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms',
            }}
          />
        }
      >
        {selectedModel?.modelName ?? 'Select model'}
      </Button>

      <AnimatePresence>
        {open && (
          <m.div
            role="dialog"
            aria-modal
            aria-label="Select model"
            initial={{ opacity: 0, scaleY: 0.85, y: -4 }}
            animate={{ opacity: 1, scaleY: 1,    y:  0 }}
            exit={{    opacity: 0, scaleY: 0.9,  y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position:        'absolute',
              top:             'calc(100% + 4px)',
              left:            0,
              right:           0,
              zIndex:          50,
              backgroundColor: 'var(--popover-bg)',
              borderRadius:    18,
              boxShadow:       'var(--shadow-popover)',
              transformOrigin: 'top center',
              overflow:        'hidden',
              isolation:       'isolate',
            }}
          >
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 16, height: 380, maxHeight: 380 }}>

              {/* Search */}
              <div style={{ display: 'flex', width: '100%', flexShrink: 0 }}>
                <InputField
                  size="small"
                  showLabel={false}
                  label="Search models"
                  showSubtitle={false}
                  leftIcon={<SearchOneIcon size={16} />}
                  rightIcon={search ? (
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Clear search"
                      icon={<CancelOneIcon size={12} />}
                      onClick={() => setSearch('')}
                    />
                  ) : undefined}
                  placeholder="Look up your model…"
                  value={search}
                  onChange={setSearch}
                  fluid
                />
              </div>

              {/* Provider tabs */}
              {companies.length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <Tabs value={provider} onValueChange={setProvider}>
                    <TabsList size="small" scrollable>
                      <TabsTrigger value="all" icon={<AtomTwoIcon size={16} />}>All</TabsTrigger>
                      {companies.map(company => {
                        const rep   = models.find(m => m.companyName === company)
                        const llmId = rep ? (getModelLlmId(rep.companyName, rep.modelName) ?? '') : ''
                        return (
                          <TabsTrigger
                            key={company}
                            value={company}
                            icon={llmId ? <LlmIcon id={llmId} variant="color" size={16} /> : undefined}
                          >
                            {company}
                          </TabsTrigger>
                        )
                      })}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Model list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 0 0', minHeight: 0, width: '100%' }}>
                {filtered.length > 0 ? (
                  <div style={{ flex: '1 0 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', flex: '1 0 0', minHeight: 0 }}>
                      <div
                        className="kaya-scrollbar"
                        onScroll={handleScroll}
                        style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', padding: 2, paddingRight: 8 }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginRight: -6 }}>
                          {groupedFiltered.map(({ company, items }) => (
                            <div key={company} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ ...MODEL_PICKER_CAPTION_STYLE, padding: '2px 8px 2px 34px' }}>
                                {company}
                              </div>
                              {items.map(m => {
                                const isSelected = !!selectedModel && (m.modelId ?? m.id) === (selectedModel.modelId ?? selectedModel.id)
                                return (
                                  <ModelSelectItem
                                    key={String(m.modelId ?? m.id)}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={isSelected}
                                    llm={getModelLlmId(m.companyName, m.modelName) ?? undefined}
                                    label={m.modelName}
                                    icons={modelTagBadges(m)}
                                    info={modelInfoContent(m)}
                                    alwaysShowInfo
                                    infoMaxWidth={dropdownWidth}
                                    selected={isSelected}
                                    onClick={() => onSelect(m)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m) } }}
                                  />
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top fade: progressive blur + color */}
                      {[{ height: 40, blur: 2 }, { height: 28, blur: 3 }, { height: 18, blur: 5 }, { height: 10, blur: 6 }].map(({ height, blur }) => (
                        <div key={`top-${blur}`} aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)', pointerEvents: 'none', zIndex: 10, opacity: atTop ? 0 : 1, transition: 'opacity 150ms ease' }} />
                      ))}
                      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, white 0%, transparent 100%)', pointerEvents: 'none', zIndex: 11, opacity: atTop ? 0 : 1, transition: 'opacity 150ms ease' }} />

                      {/* Bottom fade: progressive blur + color */}
                      {[{ height: 40, blur: 2 }, { height: 28, blur: 3 }, { height: 18, blur: 5 }, { height: 10, blur: 6 }].map(({ height, blur }) => (
                        <div key={`bottom-${blur}`} aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, maskImage: 'linear-gradient(to top, black 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)', pointerEvents: 'none', zIndex: 10, opacity: atBottom ? 0 : 1, transition: 'opacity 150ms ease' }} />
                      ))}
                      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to top, white 0%, transparent 100%)', pointerEvents: 'none', zIndex: 11, opacity: atBottom ? 0 : 1, transition: 'opacity 150ms ease' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 0 0', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>
                    {search ? `No models matching "${search}"` : 'No models available'}
                  </div>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Per-repo model cache (mirrors useModelSelection's localStorage cache) ─────
// Stores {modelName, companyName} in sessionStorage so that if the backend ever
// changes its model IDs the name+company fallback can still resolve the right model.

function personaModelCacheKey(repoId: string) {
  return `persona_model_cache_${repoId}`
}

function writePersonaModelCache(repoId: string, model: AIModel): void {
  if (!repoId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      personaModelCacheKey(repoId),
      JSON.stringify({ modelName: model.modelName, companyName: model.companyName }),
    )
  } catch { /* ignore quota errors */ }
}

function readPersonaModelCache(repoId: string): { modelName: string; companyName: string } | null {
  if (!repoId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(personaModelCacheKey(repoId))
    return raw ? (JSON.parse(raw) as { modelName: string; companyName: string }) : null
  } catch { return null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns true when modelId resolves to an entry in the current models list.
function isModelIdAvailable(models: AIModel[], modelId: string | null | undefined): boolean {
  if (!modelId) return false
  return models.some(m =>
    (m.modelId != null && String(m.modelId) !== 'undefined' && String(m.modelId) === modelId) ||
    (m.id     != null && String(m.id)      !== 'undefined' && String(m.id)      === modelId),
  )
}

// ── Model lookup (3-tier — same strategy as useModelSelection) ────────────────
// Tier 1: exact match by modelId (string slug, stable) or id (numeric DB key)
// Tier 2: modelName + companyName from the per-repo sessionStorage cache
//         — guards against API id changes between saves
function matchModel(
  models: AIModel[],
  modelId: string | null | undefined,
  repoId: string,
  fallback: AIModel | null,
): AIModel | null {
  if (!modelId) return null

  const byId = models.find(m =>
    (m.modelId != null && String(m.modelId) !== 'undefined' && String(m.modelId) === modelId) ||
    (m.id     != null && String(m.id)      !== 'undefined' && String(m.id)      === modelId),
  )
  if (byId) return byId

  const cached = readPersonaModelCache(repoId)
  if (cached?.modelName && cached?.companyName) {
    const byName = models.find(
      m => m.modelName === cached.modelName && m.companyName === cached.companyName,
    )
    if (byName) return byName
  }

  return fallback
}

// ── Session-storage keys ─────────────────────────────────────────────────────

function instructionsDraftKey(repoId: string) {
  return `persona_instructions_draft_${repoId}`
}

// The wizard stamps the freshly-created v001 here. While present, the first
// explicit Save updates that version in place (staying v001) rather than
// creating a duplicate v002. The marker is consumed on that first save.
function initialVersionKey(repoId: string) {
  return `persona_initial_version_${repoId}`
}
function clearInitialVersionId(repoId: string): void {
  if (!repoId || typeof window === 'undefined') return
  try { sessionStorage.removeItem(initialVersionKey(repoId)) } catch { /* ignore */ }
}

// Reads the avatar data-URL saved by the Profile tab.
// Falls back to the 'new' key in case the user uploaded before the repo was created.
function readProfileAvatar(repoId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      sessionStorage.getItem(personaProfileKey(repoId)) ??
      sessionStorage.getItem(personaProfileKey(''))
    const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
    const url = draft?.avatarUrl
    return typeof url === 'string' ? url : null
  } catch {
    return null
  }
}

// Converts a base64 data-URL to a File so it can be sent as multipart form data.
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

// ── Main page content ─────────────────────────────────────────────────────────

function PersonaConfigureInstructionsContent() {
  const { push, back, replace } = useRouter()
  const searchParams = useSearchParams()

  // URL params - repoId/versionId present when editing existing persona
  const repoIdParam    = searchParams.get('repoId')    ?? ''
  const versionIdParam = searchParams.get('versionId') ?? ''

  // ── State ───────────────────────────────────────────────────────────────────

  const [repoId,    setRepoId]    = useState(repoIdParam)
  const [versionId, setVersionId] = useState(versionIdParam)
  const [personaName, setPersonaName] = useState('Agent Name')
  const {
    currentInstruction: instruction,
    setInstruction,
    undo: undoInstruction,
    redo: redoInstruction,
    canUndo,
    canRedo,
    reset: resetInstructionHistory,
  } = useInstructionHistory('')
  const [temperature, setTemperature] = useState(0.5)
  const [allModels,      setAllModels]      = useState<AIModel[]>([])
  const [selectedModel,  setSelectedModel]  = useState<AIModel | null>(null)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  // The raw model_id as stored by the backend — used for the guide endpoint
  // which may not recognize the stableKey format.
  const [backendModelId, setBackendModelId] = useState<string | null>(null)
  const [imageUrl,    setImageUrl]    = useState<string | null>(() => readProfileAvatar(repoIdParam))
  const [profileTags, setProfileTags] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = sessionStorage.getItem(personaProfileKey(repoIdParam)) ?? sessionStorage.getItem(personaProfileKey(''))
      const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
      return Array.isArray(draft?.personaTags) ? (draft!.personaTags as string[]) : []
    } catch { return [] }
  })
  const [connectorSlugs, setConnectorSlugs] = useState<string[] | null>(null)
  const [isInitialising,  setIsInitialising]  = useState(true)
  // True once the draft-restore effect has finished (applied or skipped the draft).
  // Gates the auto-detect change effects so they never fire during the initial
  // state-hydration phase and the traffic-light only shows its stable final state.
  const [isDraftApplied,  setIsDraftApplied]  = useState(false)
  const [isSaving,        setIsSaving]        = useState(false)
  const [showInfo,      setShowInfo]      = useState(false)
  const [isPublishing,  setIsPublishing]  = useState(false)

  const {
    anyPanelOpen, updatePersonaInfo, registerVersionRestoreCallback, pendingChangeTags, addPendingChangeTag,
    setPendingChangeTags, refreshVersions, versions, setNeedsRepublish, safeNavigate: ctxSafeNavigate,
    safeBack: ctxSafeBack, setOnPublishAndLeave, registerAutoSave, registerContinueHandler, setVersionsOpen,
    publishedVersionId, markPublished, tabDirtyFlags, setTabDirty, changesTrackerOpen,
    // Per-attribute "touched this session" flags for the table-of-contents rail — lives in
    // shared context (not local state) so it survives navigating to another tab and back;
    // lights up the moment a field is edited, clears only on an explicit save/publish.
    touchedFieldsByTab, markFieldTouched, resetTouchedFields,
  } = usePersonaConfigure()
  const touchedFields = touchedFieldsByTab.instructions
  const markTouched = useCallback((field: string) => markFieldTouched('instructions', field), [markFieldTouched])
  const resetInstructionsTouched = useCallback(() => resetTouchedFields('instructions'), [resetTouchedFields])

  const [exampleConvOpen, setExampleConvOpen] = useState(false)
  const [exampleConvExpanded, setExampleConvExpanded] = useState(false)
  const [exampleConversations, setExampleConversations] = useState<Array<{ id: string; userSays: string; personaReplies: string }>>([])
  const [republishModalOpen,   setRepublishModalOpen]   = useState(false)
  const [maxVersionsModalOpen, setMaxVersionsModalOpen] = useState(false)
  const [isDeletingOldest,     setIsDeletingOldest]     = useState(false)

  // Publication state comes from the backend via context (publishedVersionId) —
  // never from client-only storage — so it's correct on first open.
  const hasInitialisedRef  = useRef(false)
  const savedSnapshotRef   = useRef<{ instruction: string; modelId: string; temperature: number } | null>(null)
  const hasDraftLoadedRef  = useRef(false)
  const handlePublishRef   = useRef<() => void>(() => { /* set after mount */ })
  const instructionAutoSaveRef    = useRef<() => Promise<void>>(() => Promise.resolve())
  const instructionContinueRef    = useRef<() => void>(() => {})

  // ── Initialise: fetch models, then create or load persona ──────────────────

  const initialise = useCallback(async () => {
    // Guard against React Strict Mode double-invocation: reading sessionStorage
    // a second time would find an empty draft (already removed on the first run)
    // and create a second repo named "Untitled Agent".
    if (hasInitialisedRef.current) return
    hasInitialisedRef.current = true
    setIsInitialising(true)
    try {
      // Start the models fetch but DON'T await it yet — it's independent of the
      // persona fetches below. Awaiting it up-front created a network waterfall
      // (models → persona) of two sequential round-trips. Instead each branch
      // awaits it together with its persona calls so the round-trips overlap.
      const modelsPromise = fetchModelsWithCache().catch(() => [] as AIModel[])
      let fetchedModels: AIModel[] = []
      const applyModels = (models: AIModel[]) => {
        fetchedModels = models
        setAllModels(models)
      }

      if (repoIdParam && versionIdParam) {
        // ── Edit existing persona ─────────────────────────────────────────────
        const [models, repo, version] = await Promise.all([
          modelsPromise,
          getPersonaRepo(repoIdParam),
          getVersion(repoIdParam, versionIdParam),
        ])
        applyModels(models)
        const prompt = version.prompt ?? ''
        setPersonaName(repo.name)
        resetInstructionHistory(prompt)
        setTemperature(version.temperature ?? 0.5)
        setImageUrl(readProfileAvatar(repoIdParam) ?? version.image_url ?? null)
        if (version.blocked_connectors?.length > 0) setConnectorSlugs(version.blocked_connectors)
        // For custom (non-template) agents created from scratch, the model must
        // be explicitly chosen by the user — don't pre-select firstModel.
        const noModelFlag = `persona_wizard_no_model_${repoIdParam}`
        const isCustomNoModel = typeof window !== 'undefined' && !!sessionStorage.getItem(noModelFlag)
        const resolvedModel1 = isCustomNoModel
          ? null
          : matchModel(fetchedModels, version.model_id, repoIdParam, null)
        if (isCustomNoModel) {
          // Consume the flag so subsequent visits (after user has selected a model) fall through normally.
          sessionStorage.removeItem(noModelFlag)
          setSelectedModel(null)
          setBackendModelId(null)
        } else {
          setSelectedModel(resolvedModel1)
          setBackendModelId(isModelIdAvailable(fetchedModels, version.model_id) ? (version.model_id ?? null) : null)
          if (resolvedModel1) writePersonaModelCache(repoIdParam, resolvedModel1)
        }
        // Restore example conversation cards from saved prompt text
        const examples = parseExampleConversations(prompt)
        if (examples.length > 0) setExampleConversations(examples)
        // Set baseline snapshot so the save button starts disabled. For a custom
        // "no model" agent the model is intentionally unselected in the UI, so the
        // snapshot's modelId must be empty too — otherwise the seeded backend model
        // would read as an unsaved change the moment the page opens.
        savedSnapshotRef.current = {
          instruction: prompt,
          modelId:     isCustomNoModel ? '' : (resolvedModel1 ? (stableKey(resolvedModel1) ?? '') : ''),
          temperature: version.temperature ?? 0.5,
        }
        if (version.persona_tags?.length) setProfileTags(prev => prev.length ? prev : version.persona_tags)
      } else if (repoIdParam) {
        // ── Repo exists but no specific version (e.g. "Edit" from the library) ──
        // Prefer the PUBLISHED (active) version so the user edits what is live and
        // the status reads "Live" — falling back to the most-recent version only
        // when nothing has been published yet.
        const [models, repo, versionList] = await Promise.all([
          modelsPromise,
          getPersonaRepo(repoIdParam),
          listVersions(repoIdParam),
        ])
        applyModels(models)
        setPersonaName(repo.name)
        const sorted = versionList.slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const targetVersionId = pickVersionToEdit({
          publishedVersionId: repo.published_version_id ?? null,
          versionsByRecency: sorted.map(v => v.id),
        })
        const latestItem = targetVersionId
          ? (sorted.find(v => v.id === targetVersionId) ?? sorted[0] ?? null)
          : (sorted[0] ?? null)

        if (latestItem) {
          const fullVersion = await getVersion(repoIdParam, latestItem.id)
          const prompt = fullVersion.prompt ?? ''
          resetInstructionHistory(prompt)
          setTemperature(fullVersion.temperature ?? 0.5)
          setImageUrl(readProfileAvatar(repoIdParam) ?? fullVersion.image_url ?? null)
          if (fullVersion.blocked_connectors?.length > 0) setConnectorSlugs(fullVersion.blocked_connectors)
          setVersionId(fullVersion.id)
          // Stamp URL so a reload goes straight to this version, and keep
          // useSearchParams in sync so tab navigation carries the right versionId.
          replace(`?repoId=${repoIdParam}&versionId=${fullVersion.id}`)
          const resolvedModel2 = matchModel(fetchedModels, fullVersion.model_id, repoIdParam, null)
          setSelectedModel(resolvedModel2)
          setBackendModelId(isModelIdAvailable(fetchedModels, fullVersion.model_id) ? (fullVersion.model_id ?? null) : null)
          if (resolvedModel2) writePersonaModelCache(repoIdParam, resolvedModel2)
          const examples = parseExampleConversations(prompt)
          if (examples.length > 0) setExampleConversations(examples)
          if (fullVersion.persona_tags?.length) setProfileTags(prev => prev.length ? prev : fullVersion.persona_tags)
          savedSnapshotRef.current = {
            instruction: prompt,
            modelId:     resolvedModel2 ? (stableKey(resolvedModel2) ?? '') : '',
            temperature: fullVersion.temperature ?? 0.5,
          }
        } else if (repo.active_version) {
          // Fallback: version list empty but active_version exists
          const prompt = repo.active_version.prompt ?? ''
          resetInstructionHistory(prompt)
          setTemperature(repo.active_version.temperature ?? 0.5)
          setImageUrl(readProfileAvatar(repoIdParam) ?? repo.active_version.image_url ?? null)
          if (repo.active_version.blocked_connectors?.length > 0) setConnectorSlugs(repo.active_version.blocked_connectors)
          setVersionId(repo.active_version.id)
          replace(`?repoId=${repoIdParam}&versionId=${repo.active_version.id}`)
          const resolvedModel3 = matchModel(fetchedModels, repo.active_version.model_id, repoIdParam, null)
          setSelectedModel(resolvedModel3)
          setBackendModelId(isModelIdAvailable(fetchedModels, repo.active_version.model_id) ? (repo.active_version.model_id ?? null) : null)
          if (resolvedModel3) writePersonaModelCache(repoIdParam, resolvedModel3)
          const examples = parseExampleConversations(prompt)
          if (examples.length > 0) setExampleConversations(examples)
          savedSnapshotRef.current = {
            instruction: prompt,
            modelId:     resolvedModel3 ? (stableKey(resolvedModel3) ?? '') : '',
            temperature: repo.active_version.temperature ?? 0.5,
          }
        } else {
          setSelectedModel(null)
        }
      } else {
        // ── No URL params — repo creation now happens on the tone wizard page.
        // If persona_wizard_repo exists (e.g. direct navigation after wizard), redirect to it.
        try {
          const wizardRepo = JSON.parse(sessionStorage.getItem('persona_wizard_repo') ?? 'null') as { repoId?: string; versionId?: string } | null
          if (wizardRepo?.repoId && wizardRepo?.versionId) {
            push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(wizardRepo.repoId, { versionId: wizardRepo.versionId }))
            return
          }
        } catch { /* ignore */ }
        // Nothing to load — send back to wizard start
        push(AGENTS_ROUTE)
        return
      }
    } catch (err) {
      console.error('[PersonaConfigure] init error:', err)
      toast.error('Failed to load agent. Please try again.')
    } finally {
      setIsInitialising(false)
    }
  }, []) // run once on mount

  useEffect(() => {
    initialise()
  }, [initialise])

  useEffect(() => {
    // Always prefer the currently selected model so the test chat reflects unsaved changes.
    const modelId = selectedModel ? stableKey(selectedModel) : (backendModelId ?? null)
    updatePersonaInfo({
      repoId,
      versionId,
      personaName:      personaName || undefined,
      imageUrl,
      connectorSlugs:   connectorSlugs ?? [],
      guidePrompt:      instruction,
      guideModelId:     modelId,
      guideTemperature: temperature,
      guideModelName:   selectedModel?.modelName ?? 'AI',
    })
  }, [repoId, versionId, personaName, imageUrl, connectorSlugs, instruction, selectedModel, backendModelId, temperature, updatePersonaInfo])

  useEffect(() => {
    registerVersionRestoreCallback((full) => {
      const prompt = full.prompt ?? ''
      setInstruction(prompt)
      resetInstructionHistory(prompt)
      setTemperature(full.temperature ?? 0.5)
      const model = matchModel(allModels, full.model_id, repoId, null)
      if (model) { setSelectedModel(model); writePersonaModelCache(repoId, model) }
      setBackendModelId(isModelIdAvailable(allModels, full.model_id) ? (full.model_id ?? null) : null)
      setExampleConversations(parseExampleConversations(prompt))
      setVersionId(full.id)
      savedSnapshotRef.current = null
      // Clear draft — version was explicitly restored from history
      try { sessionStorage.removeItem(instructionsDraftKey(repoId)) } catch { /* ignore */ }
    })
    return () => registerVersionRestoreCallback(null)
  }, [repoId, allModels, registerVersionRestoreCallback])

  // ── Load auto-saved draft once after initialisation ───────────────────────
  useEffect(() => {
    if (isInitialising || !repoId || hasDraftLoadedRef.current) return
    hasDraftLoadedRef.current = true
    try {
      const raw = sessionStorage.getItem(instructionsDraftKey(repoId))
      if (!raw) { setIsDraftApplied(true); return }
      const draft = JSON.parse(raw) as { instruction?: string; temperature?: number; modelId?: string | null }
      const snapshot = savedSnapshotRef.current
      // Skip applying the draft when all of its values already match the saved
      // version. Applying identical values would still cause React re-renders
      // and trigger the change-detection effects, which can spuriously mark the
      // page as dirty even though nothing has changed.
      if (
        snapshot &&
        (typeof draft.instruction !== 'string' || draft.instruction === snapshot.instruction) &&
        (typeof draft.temperature !== 'number' || draft.temperature === snapshot.temperature) &&
        // treat undefined (field absent in old drafts) as "no preference", but
        // null means the user explicitly cleared the model — don't skip that.
        (draft.modelId === undefined            || draft.modelId     === snapshot.modelId)
      ) { setIsDraftApplied(true); return }
      if (typeof draft.instruction === 'string') {
        setInstruction(draft.instruction)
        resetInstructionHistory(draft.instruction)
        setExampleConversations(parseExampleConversations(draft.instruction))
      }
      if (typeof draft.temperature === 'number') setTemperature(draft.temperature)
      if (draft.modelId === null) {
        // User explicitly had no model selected — restore that state so the
        // picker stays empty instead of falling back to whatever init resolved.
        setSelectedModel(null)
      } else if (draft.modelId && allModels.length > 0) {
        const m = allModels.find(mm => stableKey(mm) === draft.modelId)
        if (m) { setSelectedModel(m); writePersonaModelCache(repoId, m) }
      }
    } catch { /* ignore */ }
    setIsDraftApplied(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fire only when init completes; allModels captured from closure
  }, [isInitialising, repoId])

  // ── Save version ─────────────────────────────────────────────────────────────

  async function executeSave(openPanel = true): Promise<string | null> {
    const modelId = selectedModel ? stableKey(selectedModel) : null
    if (!repoId || !modelId || !versionId) return null
    setIsSaving(true)
    try {
      let imageFile: File | null = null
      let preserveImageUrl: string | null = null
      const avatarDataUrl = readProfileAvatar(repoId)
      if (avatarDataUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarDataUrl, 'avatar.jpg')
      } else {
        // Prefer the sessionStorage path (e.g. /persona-avatars/ template) over the
        // imageUrl state, which may be an S3 pre-signed URL that fails CORS when
        // re-fetched browser-side during new version creation.
        preserveImageUrl = avatarDataUrl ?? imageUrl
      }

      // Save always forks a brand-new version and points the editor at it — it
      // never overwrites the version currently loaded. (Only Publish updates a
      // version in place; see handlePublish.)
      const sourceVersionId = versionId
      let sourceDescription: string | null = null
      try {
        sourceDescription = (await getVersion(repoId, sourceVersionId)).description ?? null
      } catch { /* non-fatal — a missing description should not block saving */ }
      const version = await createVersion({
        repoId,
        name:        personaName,
        modelId,
        prompt:      instruction,
        description: sourceDescription,
        temperature,
        image:       imageFile,
        imageUrl:    preserveImageUrl,
      })
      const savedVersionId = version.id
      if (version.image_url) setImageUrl(version.image_url)
      setBackendModelId(version.model_id ?? modelId)
      setVersionId(version.id)
      updatePersonaInfo({ versionId: version.id })
      const params = new URLSearchParams(searchParams.toString())
      params.set('versionId', version.id)
      replace(`?${params.toString()}`)
      // New versions inherit the prior version's knowledge files so nothing
      // disappears across versions. Best-effort — warn if any couldn't carry.
      try {
        const carried = await inheritKnowledge(repoId, sourceVersionId, version.id)
        if (carried.documentsFailed > 0) {
          toast.warning(`${carried.documentsFailed} knowledge file(s) couldn't be carried over — re-add them on the Knowledge tab.`)
        }
      } catch { /* non-fatal */ }

      // Saving makes the saved version the repo's active version so the test
      // chat and versions panel point at what was just saved. It does not publish.
      try {
        await setActiveVersion(repoId, savedVersionId)
        if (typeof window !== 'undefined') {
          try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
        }
      } catch {
        toast.warning('Version saved but could not be selected as the working version.')
      }

      savedSnapshotRef.current = { instruction, modelId, temperature }
      resetInstructionsTouched()
      setVersionTags(savedVersionId, pendingChangeTags)
      setPendingChangeTags([])
      bustPersonasCache()
      refreshVersions()
      if (openPanel) setVersionsOpen(true)
      try { sessionStorage.removeItem(instructionsDraftKey(repoId)) } catch { /* ignore */ }

      toast.success('Version saved')
      return savedVersionId
    } catch (err) {
      console.error('[PersonaConfigure] save error:', err)
      toast.error('Failed to save version')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  function handleSaveVersion() {
    if (!selectedModel) {
      toast.error('Please select a model before saving a version.')
      return
    }
    if (!hasContent) {
      toast.error('Please add agent instructions before saving a version.')
      return
    }
    if (!isDirty) return
    if (versions.length >= MAX_VERSIONS) {
      setMaxVersionsModalOpen(true)
      return
    }
    void executeSave()
  }

  async function handleProceedWithOverwrite() {
    const oldest = versions[versions.length - 1]
    if (!oldest || !repoId) return
    setIsDeletingOldest(true)
    try {
      await deleteVersion(repoId, oldest.id)
      setMaxVersionsModalOpen(false)
      void executeSave()
    } catch (err) {
      console.error('[InstructionsPage] delete oldest version error:', err)
      toast.error('Failed to delete oldest version')
    } finally {
      setIsDeletingOldest(false)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!repoId || !versionId) return

    const wasPublished = !!publishedVersionId
    setIsPublishing(true)

    try {
      // If dirty, update the current version in place (no new version created)
      if (isDirty && hasContent) {
        const modelId = selectedModel ? stableKey(selectedModel) : null
        if (modelId) {
          let imageFile: File | null = null
          let preserveImageUrl: string | null = null
          const avatarDataUrl = readProfileAvatar(repoId)
          if (avatarDataUrl?.startsWith('data:')) {
            imageFile = dataUrlToFile(avatarDataUrl, 'avatar.jpg')
          } else {
            preserveImageUrl = avatarDataUrl ?? imageUrl
          }
          const updated = await updateVersion({
            repoId,
            versionId,
            name:        personaName,
            modelId,
            prompt:      instruction,
            temperature,
            image:       imageFile ?? undefined,
            imageUrl:    preserveImageUrl,
          })
          if (updated.image_url) setImageUrl(updated.image_url)
          savedSnapshotRef.current = { instruction, modelId, temperature }
          resetInstructionsTouched()
          setVersionTags(versionId, pendingChangeTags)
          setPendingChangeTags([])
        }
      }

      // Make the version live — this is what creates/updates the persona card in the library.
      await publishPersonaVersion(repoId, versionId)
      bustPersonasCache()
      refreshVersions()

      if (typeof window !== 'undefined') {
        // Clear wizard-session markers now that the persona has been explicitly published.
        try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
        // A published version is locked in — editing it later should fork a new
        // version, so the provisional-initial marker must no longer apply.
        clearInitialVersionId(repoId)
      }
      // Update the single source of truth so all tabs immediately read "Live".
      markPublished(versionId)

      const base = `/agents/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${versionId}`
      push(wasPublished ? `${base}&republished=true` : base)
    } catch (err) {
      console.error('[PersonaConfigure] publish error:', err)
      toast.error('Failed to publish agent')
    } finally {
      setIsPublishing(false)
    }
  }

  const currentModelId = (selectedModel ? stableKey(selectedModel) : null) ?? ''
  const isDirty =
    !savedSnapshotRef.current ||
    instruction !== savedSnapshotRef.current.instruction ||
    currentModelId !== savedSnapshotRef.current.modelId ||
    temperature !== savedSnapshotRef.current.temperature

  // Auto-detect change tags — guarded by isDraftApplied so they never fire
  // during the initial hydration phase (init load + draft restore). Once
  // isDraftApplied is true the effects behave exactly as before.
  useEffect(() => {
    if (!isDraftApplied || !savedSnapshotRef.current) return
    if (instruction !== savedSnapshotRef.current.instruction) addPendingChangeTag('Instructions')
  }, [isDraftApplied, instruction, addPendingChangeTag])
  useEffect(() => {
    if (!isDraftApplied || !savedSnapshotRef.current) return
    if (currentModelId !== savedSnapshotRef.current.modelId || temperature !== savedSnapshotRef.current.temperature) addPendingChangeTag('Model')
  }, [isDraftApplied, currentModelId, temperature, addPendingChangeTag])

  // When the instructions page confirms the content is clean (matches the saved
  // snapshot), remove any Instructions/Model tags that may have been added
  // spuriously (e.g. from intermediate state during tab-switch initialisation).
  useEffect(() => {
    if (isInitialising || isDirty) return
    const cleaned = pendingChangeTags.filter(t => t !== 'Instructions' && t !== 'Model')
    if (cleaned.length < pendingChangeTags.length) setPendingChangeTags(cleaned)
  }, [isInitialising, isDirty, pendingChangeTags, setPendingChangeTags])

  // Sync dirty state to context for traffic light
  useEffect(() => { setTabDirty('Instructions', isDirty) }, [isDirty, setTabDirty])

  // ── Auto-save draft to sessionStorage ─────────────────────────────────────
  useEffect(() => {
    if (!repoId || isInitialising) return
    try {
      sessionStorage.setItem(instructionsDraftKey(repoId), JSON.stringify({
        instruction,
        temperature,
        modelId: selectedModel ? stableKey(selectedModel) : null,
      }))
    } catch { /* ignore quota errors */ }
  }, [repoId, instruction, temperature, selectedModel, isInitialising])

  // Re-read profile tags whenever repoId resolves (after new-persona creation)
  useEffect(() => {
    if (!repoId || typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(personaProfileKey(repoId))
      const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
      if (Array.isArray(draft?.personaTags)) setProfileTags(draft!.personaTags as string[])
    } catch { /* ignore */ }
  }, [repoId])

  const hasContent = instruction.trim().length > 0

  // isPublished: current version IS the live (backend active) one with no pending changes.
  // needsRepublish: persona exists but isn't fully published — covers first-time
  //   publish and re-publish. Suppressed for an empty, never-published draft so we
  //   don't nag when there's nothing to publish yet.
  const pub = derivePublicationState({
    repoId,
    versionId,
    publishedVersionId,
    hasUnsavedChanges: (!isInitialising && isDirty) || pendingChangeTags.length > 0,
  })
  const isPublished    = pub.isPublished
  const needsRepublish = pub.needsRepublish && (hasContent || !!publishedVersionId)

  const canPublish = hasContent && !!repoId && !!versionId && !!selectedModel && !isPublishing && !isPublished
  const canSave    = isDirty && hasContent && !!repoId && !!selectedModel && !isSaving

  const anyDirty     = pendingChangeTags.length > 0 || TABS.some(tab => tabDirtyFlags[tab] === true)

  // Sync needsRepublish to shared context so the leave-guard works on all 5 tabs.
  useEffect(() => {
    setNeedsRepublish(needsRepublish)
  }, [needsRepublish, setNeedsRepublish])

  // Register handlePublish as the "Publish & leave" callback for the shared dialog.
  const handlePublishStable = handlePublish  // captured each render; ref keeps it live
  useEffect(() => {
    handlePublishRef.current = handlePublishStable
  })
  useEffect(() => {
    setOnPublishAndLeave(() => () => handlePublishRef.current())
    return () => setOnPublishAndLeave(null)
  }, [setOnPublishAndLeave])

  // Warn the browser when navigating away (tab close / external nav) if there are unpublished changes.
  useEffect(() => {
    if (!needsRepublish) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [needsRepublish])

  const safeNavigate = ctxSafeNavigate
  const safeBack     = ctxSafeBack

  const handleAddConversation = (userSays: string, personaReplies: string) => {
    setExampleConversations(prev => [...prev, { id: crypto.randomUUID(), userSays, personaReplies }])
    const lines = ['<example>']
    if (userSays.trim()) lines.push(`User: ${userSays.trim()}`)
    lines.push(`Assistant: ${personaReplies.trim()}`)
    lines.push('</example>')
    const block = lines.join('\n')
    setInstruction(instruction ? `${instruction}\n\n${block}` : block)
    markTouched('examples')
  }
  const handleRemoveConversation = (id: string) => {
    const conv = exampleConversations.find(c => c.id === id)
    if (conv) setInstruction(removeExampleBlock(instruction, conv.userSays, conv.personaReplies))
    setExampleConversations(prev => prev.filter(c => c.id !== id))
    markTouched('examples')
  }

  // Auto-save on tab switch — updates the current version in place (never forks).
  // createVersion is only called by the wizard (initial creation) and handleSaveVersion (explicit).
  instructionAutoSaveRef.current = async () => {
    const modelId = selectedModel ? stableKey(selectedModel) : null
    if (!repoId || !versionId || !modelId) return
    const snapshot = savedSnapshotRef.current
    const isDirtyNow =
      !snapshot ||
      instruction !== snapshot.instruction ||
      currentModelId !== snapshot.modelId ||
      temperature !== snapshot.temperature
    if (!isDirtyNow) return
    try {
      let imageFile: File | null = null
      let preserveImageUrl: string | null = null
      const avatarDataUrl = readProfileAvatar(repoId)
      if (avatarDataUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarDataUrl, 'avatar.jpg')
      } else {
        preserveImageUrl = avatarDataUrl ?? imageUrl
      }
      await updateVersion({
        repoId,
        versionId,
        name:        personaName,
        modelId,
        prompt:      instruction,
        temperature,
        image:       imageFile ?? undefined,
        imageUrl:    preserveImageUrl,
      })
      toast.success('Changes autosaved')
    } catch (err) {
      console.error('[InstructionsPage] auto-save error:', err)
    }
  }

  useEffect(() => {
    registerAutoSave(() => instructionAutoSaveRef.current())
    return () => registerAutoSave(null)
  }, [registerAutoSave])

  // Continue handler for the ConfigureStepNav Continue button — validates model +
  // instruction before autosaving and navigating to the next tab.
  instructionContinueRef.current = () => {
    if (!isInitialising) {
      if (!selectedModel) {
        toast.error('Please select a model before continuing.')
        return
      }
      if (!hasContent) {
        toast.error('Please add agent instructions before continuing.')
        return
      }
    }
    const params = new URLSearchParams(searchParams.toString())
    if (repoId)    params.set('repoId',    repoId)
    if (versionId) params.set('versionId', versionId)
    safeNavigate(`/agent/configure/profile?${params.toString()}`)
  }

  useEffect(() => {
    registerContinueHandler(() => instructionContinueRef.current())
    return () => registerContinueHandler(null)
  }, [registerContinueHandler])

  // ── Tab navigation ────────────────────────────────────────────────────────────

  function navigateTab(tab: Tab) {
    const route = TAB_ROUTES[tab]
    if (!route) return
    // Block tab switching until required fields are filled (only relevant for new/custom personas)
    if (!isInitialising) {
      if (!selectedModel) {
        toast.error('Please select a model before switching tabs.')
        return
      }
      if (!hasContent) {
        toast.error('Please add agent instructions before switching tabs.')
        return
      }
    }
    const params = new URLSearchParams(searchParams.toString())
    if (repoId)    params.set('repoId',    repoId)
    if (versionId) params.set('versionId', versionId)
    safeNavigate(`${route}?${params.toString()}`)
  }

  function handleTabClick(tab: Tab) {
    if (!TAB_ROUTES[tab]) return
    navigateTab(tab)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          position: 'relative',
          paddingBottom: 12,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
          width: '100%',
          height: '100%',
          minWidth: 0,
        }}
      >
        {/* ── Top navigation bar ─────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, position: 'relative' }}>
            {/* Back arrow + label — left column. Equal flex on both side columns
               keeps the centre tabs perfectly centred at any width. */}
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              {anyPanelOpen ? (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeftOneIcon size={20} animated />}
                  aria-label="Back to Agents"
                  onClick={() => safeNavigate('/agents')}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeftOneIcon size={20} animated />}
                  onClick={() => safeNavigate('/agents')}
                >
                  Back to Agents
                </Button>
              )}
            </div>

            {/* Tabs — centre column, centred between the back button and actions. */}
            <div style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'flex-start', position: 'relative' }}>
              {/* Frosted glass — only covers the tab button row, not the traffic lights */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow:
                    'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                }}
              />
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: TABS.map(() => 'auto').join(' '), columnGap: 4, rowGap: 6, justifyContent: 'start' }}>
                {/* Info legend */}
                <div style={{ position: 'absolute', right: 'calc(100% + 8px)', top: 0, height: 36, display: 'flex', alignItems: 'center', zIndex: 9999 }}>
                  <button type="button" onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--neutral-400)', backgroundColor: 'transparent', cursor: 'default', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)', padding: 0 }}>i</button>
                  {showInfo && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', border: '1px solid var(--neutral-200)', borderRadius: 8, padding: '8px 10px', boxShadow: '0px 4px 12px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 6, whiteSpace: 'nowrap', zIndex: 9999 }}>
                      {([{ color: '#D1D5DB', border: '#9CA3AF', label: 'No changes' }, { color: '#F97316', border: '#C2600F', label: 'Unsaved changes' }, { color: '#6FCF97', border: '#27AE60', label: 'Saved' }] as const).map(({ color, border, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 4, backgroundColor: color, border: `1px solid ${border}`, borderRadius: 2, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-600)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {TABS.map(tab => {
                  const isActive = tab === 'Instructions'
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabClick(tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 8px',
                        borderRadius: 10,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--neutral-white)' : 'transparent',
                        boxShadow: isActive
                          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100), inset 0px -1px 0px 0px rgba(38,33,30,0.1)'
                          : 'none',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: isActive ? 'var(--blue-600)' : 'var(--neutral-700)',
                        whiteSpace: 'nowrap',
                        transition: 'background-color 150ms, box-shadow 150ms, color 150ms',
                        position: 'relative',
                      }}
                    >
                      {isActive && (
                        <div
                          aria-hidden
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'inherit',
                            boxShadow: 'inset 0px -1px 0px 0px rgba(38,33,30,0.1)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      {tab}
                    </button>
                  )
                })}
                {TABS.map(tab => {
                  const hasFlag   = tabDirtyFlags[tab] !== undefined
                  const isDirtyT  = hasFlag ? tabDirtyFlags[tab] ?? false : pendingChangeTags.includes(tab)
                  const isPristine  = !hasFlag && !pendingChangeTags.includes(tab)
                  const showGray    = isPristine && (!publishedVersionId || isInitialising || !isDraftApplied)
                  const bgColor     = showGray ? '#D1D5DB' : (isDirtyT ? '#F97316' : '#6FCF97')
                  const borderColor = showGray ? '#9CA3AF' : (isDirtyT ? '#C2600F' : '#27AE60')
                  return (
                    <div key={`${tab}-light`} aria-hidden style={{ height: 4, backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: 2, transition: 'background-color 300ms, border-color 300ms' }} />
                  )
                })}
                {isDraftApplied && !isInitialising && (anyDirty || publishedVersionId != null || (!!repoId && !!versionId)) && (
                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 10, pointerEvents: 'none', zIndex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(anyDirty || publishedVersionId != null) && (
                      <>
                        {anyDirty ? <Badge color="Red" label="Unsaved" /> : <Badge color="Green" label="Saved" />}
                        <div aria-hidden style={{ width: 1, height: 12, backgroundColor: 'var(--neutral-300)', flexShrink: 0 }} />
                      </>
                    )}
                    {isPublished
                      ? <Badge color="Green" label="Live" />
                      : <Badge color="Red" label="Unpublished" />
                    }
                  </div>
                )}
              </div>
            </div>



            {/* Action buttons — right column (equal flex mirrors the left column) */}
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
              {anyPanelOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  loading={isSaving}
                  disabled={!hasContent || !repoId || !selectedModel || isSaving || isInitialising}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  loading={isSaving}
                  disabled={!hasContent || !repoId || !selectedModel || isSaving || isInitialising}
                >
                  {isSaving ? 'Saving…' : 'Save version'}
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                rightIcon={<ArrowUpRightOneIcon size={16} />}
                onClick={() => void handlePublish()}
                loading={isPublishing}
                disabled={!canPublish || isInitialising}
              >
                {isPublishing
                  ? (publishedVersionId != null ? 'Republishing…' : 'Publishing…')
                  : (publishedVersionId != null ? 'Republish' : 'Publish')}
              </Button>
            </div>
          </div>

          <div style={{ height: 35, flexShrink: 0 }} />
        </div>

        <AttributeTocRail
          items={INSTRUCTIONS_TOC_ITEMS}
          touchedFields={touchedFields}
          open={!isInitialising && changesTrackerOpen && !anyPanelOpen}
        />

        {/* ── Scrollable content area ────────────────────────────────────────── */}
        {isInitialising ? (
          <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
              Loading…
            </p>
          </div>
        ) : (
          <div
            className="kaya-scrollbar"
            style={{
              flex: '1 0 0',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 714, paddingTop: 3 }}>

              {/* ── Persona header ────────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 65,
                    height: 65,
                    borderRadius: 8,
                    flexShrink: 0,
                    backgroundColor: 'var(--neutral-100)',
                    boxShadow:
                      '0px 1.091px 1.09px 0px rgba(59,54,50,0.05), 0px 1.455px 1px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt="" fill sizes="65px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 20, color: 'var(--neutral-500)', lineHeight: 1, userSelect: 'none' }}>
                      {nameInitials(personaName)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontWeight: 400,
                      fontSize: 24,
                      lineHeight: '32px',
                      color: 'var(--neutral-900)',
                      margin: 0,
                    }}
                  >
                    {personaName || 'Agent Name'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {profileTags.map(tag => (
                      <Badge key={tag} color="Neutral" label={tag} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Model selector ────────────────────────────────────────────── */}
              <div data-help-id="help-model">
                <ModelDropdown
                  models={allModels}
                  selectedModel={selectedModel}
                  open={modelSelectorOpen}
                  onOpenChange={setModelSelectorOpen}
                  onSelect={(m) => { setSelectedModel(m); setModelSelectorOpen(false); markTouched('model'); recordModelUsage(m) }}
                />
              </div>

              {/* ── System instruction ────────────────────────────────────────── */}
              <div data-help-id="help-instruction" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={ATTRIBUTE_HEADER_STYLE}>System Instruction</span>
                <EnhancePromptField
                  label={null}
                  value={instruction}
                  onChange={(v) => { setInstruction(v); markTouched('instruction') }}
                  footerLeft={
                    <UndoRedoGroup
                      canUndo={canUndo}
                      canRedo={canRedo}
                      onUndo={undoInstruction}
                      onRedo={redoInstruction}
                    />
                  }
                />
              </div>

              {/* ── Temperature slider ────────────────────────────────────────── */}
              <div data-help-id="help-temperature" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={ATTRIBUTE_HEADER_STYLE}>
                  Creativity Level (Temperature)
                </span>
                {/* Same idle container treatment as System Instruction: white bg, 18px radius. */}
                <div
                  style={{
                    display:         'flex',
                    flexDirection:   'column',
                    gap:             12,
                    // Extra top padding reserves room for the drag-value tooltip above the thumb.
                    padding:         '28px 16px 16px',
                    borderRadius:    18,
                    border:          '1px solid #E5E5E5',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Slider
                    value={[temperature]}
                    onValueChange={([v]) => { setTemperature(v); markTouched('temperature') }}
                    min={0}
                    max={1}
                    step={0.01}
                    showValue
                    valueFormat={getTemperatureLabel}
                    fillColor="var(--blue-600)"
                    aria-label="Creativity level"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-800)' }}>0 (Precise &amp; consistent)</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-700)' }}>(Creative &amp; varied) 1</span>
                  </div>
                </div>
              </div>

              {/* ── Example conversations ─────────────────────────────────────── */}
              <div data-help-id="help-examples" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <span style={ATTRIBUTE_HEADER_STYLE}>Example Conversations (Optional)</span>
                <button
                  type="button"
                  onClick={() => setExampleConvExpanded(v => !v)}
                  aria-expanded={exampleConvExpanded}
                  aria-controls="example-conversations-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    height: 64,
                    width: '100%',
                    // Same idle container treatment as System Instruction: white bg, 18px radius.
                    border: '1px solid #E5E5E5',
                    borderRadius: 18,
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily:   'var(--font-body)',
                        fontWeight:   500,
                        fontSize:     14,
                        lineHeight:   '22px',
                        color:        '#0a0a0a',
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}
                    >
                      {exampleConversations.length > 0
                        ? `${exampleConversations.length} example${exampleConversations.length === 1 ? '' : 's'} added`
                        : 'Add example conversation'}
                    </span>
                    {exampleConversations.length > 0 && (
                      <Badge color="Neutral" label={String(exampleConversations.length)} />
                    )}
                  </div>
                  <ArrowDownOneIcon
                    size={20}
                    color="var(--neutral-700)"
                    style={{
                      flexShrink: 0,
                      transform: exampleConvExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms',
                    }}
                  />
                </button>

                {exampleConvExpanded && (
                  <div
                    id="example-conversations-panel"
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {exampleConversations.map((conv) => (
                      <div
                        key={conv.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, backgroundColor: 'var(--neutral-white)', border: '1px solid var(--neutral-200)', position: 'relative' }}
                      >
                        <button
                          onClick={() => handleRemoveConversation(conv.id)}
                          aria-label="Remove conversation"
                          style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: 6, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                        >
                          <CancelOneIcon size={14} color="var(--neutral-500)" />
                        </button>
                        {conv.userSays && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: '#ee3030' }}>User says</span>
                            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0 }}>{conv.userSays}</p>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>Agent replies</span>
                          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-700)', margin: 0, paddingRight: 24 }}>{conv.personaReplies}</p>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<PlusSignIcon size={16} />}
                      onClick={() => setExampleConvOpen(true)}
                    >
                      Add conversation
                    </Button>
                  </div>
                )}
              </div>

              <div style={{ height: 24, flexShrink: 0 }} />
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────────── */}
      <ExampleConversationModal
        open={exampleConvOpen}
        onClose={() => setExampleConvOpen(false)}
        onAdd={handleAddConversation}
      />
      {republishModalOpen && (
        <RepublishModal
          personaName={personaName || 'Persona'}
          superLinkActive={false}
          onClose={() => setRepublishModalOpen(false)}
          onDone={() => {
            setRepublishModalOpen(false)
            push(AGENTS_ROUTE)
          }}
        />
      )}

      {/* ── Max versions confirmation modal ────────────────────────────────── */}
      {maxVersionsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Version limit reached"
          onClick={() => { if (!isDeletingOldest) setMaxVersionsModalOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'var(--neutral-white)', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0px 8px 24px rgba(0,0,0,0.15), 0px 0px 0px 1px rgba(59,54,50,0.08)' }}
          >
            <span style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', backgroundColor: '#ffedd5', color: '#c2410c', boxShadow: '0px 0px 0px 1px rgba(194,65,12,0.2)' }}>
              Warning
            </span>
            <p style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
              Oldest version will be deleted
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
              You&apos;ve reached the 5-version limit. Creating a new version will permanently delete{' '}
              <strong style={{ color: 'var(--neutral-900)', fontWeight: 500 }}>
                {versions[versions.length - 1]?.name || 'the oldest version'}
              </strong>{' '}
              (v001) to make room. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMaxVersionsModalOpen(false)}
                disabled={isDeletingOldest}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => void handleProceedWithOverwrite()}
                loading={isDeletingOldest}
              >
                {isDeletingOldest ? 'Deleting…' : 'Proceed'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PersonaConfigureInstructionsPage() {
  return (
    <Suspense>
      <PersonaConfigureInstructionsContent />
    </Suspense>
  )
}
