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
  PlusSignIcon,
  CancelOneIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
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
import type { AIModel } from '@/types/ai-model'
import { LlmIcon } from '@strange-huge/icons/llm'
import { getModelLlmId } from '@/lib/model-icons'
import { usePersonaConfigure } from '@/app/(app)/agent/configure/context'
import { setVersionTags } from '@/lib/version-tags'
import { Badge } from '@/components/Badge'

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

// ── Inline anchored model dropdown ───────────────────────────────────────────
// The chat-style ModelSelector renders a centered modal — wrong for this page,
// where the dropdown must drop under its trigger and span the trigger's width.

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

  const grouped = models.reduce<Record<string, AIModel[]>>((acc, m) => {
    const k = m.companyName || 'Other'
    if (!acc[k]) acc[k] = []
    acc[k].push(m)
    return acc
  }, {})

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
        Model
      </span>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '8px 12px',
          border:          '1px solid var(--neutral-200)',
          borderRadius:    6,
          backgroundColor: 'transparent',
          cursor:          'pointer',
          width:           '100%',
          textAlign:       'left',
          transition:      'border-color 150ms',
        }}
      >
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          {selectedModel ? (
            <LlmIcon
              id={getModelLlmId(selectedModel.companyName, selectedModel.modelName) ?? ''}
              variant="color"
              size={20}
            />
          ) : (
            <AtomOneIcon size={20} color="var(--neutral-700)" />
          )}
        </span>
        <span
          style={{
            flex:         '1 0 0',
            minWidth:     0,
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     14,
            lineHeight:   '22px',
            color:        'var(--neutral-700)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {selectedModel?.modelName ?? 'Select model'}
        </span>
        <ArrowDownOneIcon
          size={20}
          color="var(--neutral-700)"
          style={{
            flexShrink: 0,
            transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            role="listbox"
            aria-label="Select model"
            initial={{ opacity: 0, scaleY: 0.85, y: -4 }}
            animate={{ opacity: 1, scaleY: 1,    y:  0 }}
            exit={{    opacity: 0, scaleY: 0.9,  y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="kaya-scrollbar"
            style={{
              position:        'absolute',
              top:             'calc(100% + 4px)',
              left:            0,
              right:           0,
              zIndex:          50,
              maxHeight:       320,
              overflowY:       'auto',
              backgroundColor: 'var(--neutral-white)',
              border:          '1px solid var(--neutral-200)',
              borderRadius:    12,
              padding:         4,
              boxShadow:
                '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15)',
              transformOrigin: 'top center',
            }}
          >
            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  style={{
                    padding:    '8px 8px 4px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: '16px',
                    color:      'var(--neutral-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {provider}
                </div>
                {providerModels.map((m) => {
                  const isSelected = !!selectedModel && (m.modelId ?? m.id) === (selectedModel.modelId ?? selectedModel.id)
                  return (
                    <button
                      key={String(m.modelId ?? m.id)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelect(m)}
                      style={{
                        display:         'flex',
                        alignItems:      'center',
                        gap:             8,
                        width:           '100%',
                        padding:         '8px',
                        border:          'none',
                        borderRadius:    8,
                        cursor:          'pointer',
                        backgroundColor: isSelected ? 'var(--neutral-100)' : 'transparent',
                        textAlign:       'left',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--neutral-50)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <span style={{ flexShrink: 0, lineHeight: 0 }}>
                        <LlmIcon id={getModelLlmId(m.companyName, m.modelName) ?? ''} variant="color" size={20} />
                      </span>
                      <span
                        style={{
                          flex:         '1 0 0',
                          minWidth:     0,
                          fontFamily:   'var(--font-body)',
                          fontWeight:   500,
                          fontSize:     14,
                          lineHeight:   '22px',
                          color:        'var(--neutral-700)',
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                        }}
                      >
                        {m.modelName}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {models.length === 0 && (
              <div
                style={{
                  padding:    12,
                  fontFamily: 'var(--font-body)',
                  fontSize:   14,
                  color:      'var(--neutral-500)',
                }}
              >
                No models available
              </div>
            )}
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
  if (!modelId) return fallback

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
      sessionStorage.getItem(`persona_profile_${repoId}`) ??
      sessionStorage.getItem('persona_profile_new')
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
      const raw = sessionStorage.getItem(`persona_profile_${repoIdParam}`) ?? sessionStorage.getItem('persona_profile_new')
      const draft = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
      return Array.isArray(draft?.personaTags) ? (draft!.personaTags as string[]) : []
    } catch { return [] }
  })
  const [connectorSlugs, setConnectorSlugs] = useState<string[] | null>(null)
  const [isInitialising, setIsInitialising] = useState(true)
  const [isSaving,      setIsSaving]      = useState(false)
  const [showInfo,      setShowInfo]      = useState(false)
  const [isPublishing,  setIsPublishing]  = useState(false)

  const { anyPanelOpen, updatePersonaInfo, registerVersionRestoreCallback, pendingChangeTags, addPendingChangeTag, setPendingChangeTags, refreshVersions, versions, setNeedsRepublish, safeNavigate: ctxSafeNavigate, safeBack: ctxSafeBack, setOnPublishAndLeave, registerAutoSave, setVersionsOpen, publishedVersionId, markPublished, tabDirtyFlags, setTabDirty } = usePersonaConfigure()

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
  const instructionAutoSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())

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
      let firstModel: AIModel | null = null
      const applyModels = (models: AIModel[]) => {
        fetchedModels = models
        setAllModels(models)
        firstModel = models[0] ?? null
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
          : matchModel(fetchedModels, version.model_id, repoIdParam, firstModel)
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
          const resolvedModel2 = matchModel(fetchedModels, fullVersion.model_id, repoIdParam, firstModel)
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
          const resolvedModel3 = matchModel(fetchedModels, repo.active_version.model_id, repoIdParam, firstModel)
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
          setSelectedModel(firstModel)
        }
      } else {
        // ── No URL params — repo creation now happens on the tone wizard page.
        // If persona_wizard_repo exists (e.g. direct navigation after wizard), redirect to it.
        try {
          const wizardRepo = JSON.parse(sessionStorage.getItem('persona_wizard_repo') ?? 'null') as { repoId?: string; versionId?: string } | null
          if (wizardRepo?.repoId && wizardRepo?.versionId) {
            push(`/agent/configure/instructions?repoId=${wizardRepo.repoId}&versionId=${wizardRepo.versionId}`)
            return
          }
        } catch { /* ignore */ }
        // Nothing to load — send back to wizard start
        push('/agents')
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
      if (!raw) return
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
        (!draft.modelId                        || draft.modelId     === snapshot.modelId)
      ) return
      if (typeof draft.instruction === 'string') {
        setInstruction(draft.instruction)
        resetInstructionHistory(draft.instruction)
        setExampleConversations(parseExampleConversations(draft.instruction))
      }
      if (typeof draft.temperature === 'number') setTemperature(draft.temperature)
      if (draft.modelId && allModels.length > 0) {
        const m = allModels.find(mm => stableKey(mm) === draft.modelId)
        if (m) { setSelectedModel(m); writePersonaModelCache(repoId, m) }
      }
    } catch { /* ignore */ }
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
      toast.error('Please add system instructions before saving a version.')
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

  // Auto-detect change tags
  useEffect(() => {
    if (!savedSnapshotRef.current) return
    if (instruction !== savedSnapshotRef.current.instruction) addPendingChangeTag('Instructions')
  }, [instruction, addPendingChangeTag])
  useEffect(() => {
    if (!savedSnapshotRef.current) return
    if (currentModelId !== savedSnapshotRef.current.modelId || temperature !== savedSnapshotRef.current.temperature) addPendingChangeTag('Model')
  }, [currentModelId, temperature, addPendingChangeTag])

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
      const raw = sessionStorage.getItem(`persona_profile_${repoId}`)
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
  }
  const handleRemoveConversation = (id: string) => {
    const conv = exampleConversations.find(c => c.id === id)
    if (conv) setInstruction(removeExampleBlock(instruction, conv.userSays, conv.personaReplies))
    setExampleConversations(prev => prev.filter(c => c.id !== id))
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
        toast.error('Please add system instructions before switching tabs.')
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
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 22,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, height: 36, position: 'relative' }}>
            {/* Back arrow + label */}
            <div style={{ flexShrink: 0 }}>
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

            {/* Tabs — centered when no panel open, left-aligned when a panel is open */}
            <div style={anyPanelOpen
              ? { display: 'inline-flex', alignItems: 'flex-start', position: 'relative' }
              : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }
            }>
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
                  const bgColor     = isPristine ? '#D1D5DB' : (isDirtyT ? '#F97316' : '#6FCF97')
                  const borderColor = isPristine ? '#9CA3AF' : (isDirtyT ? '#C2600F' : '#27AE60')
                  return (
                    <div key={`${tab}-light`} aria-hidden style={{ height: 4, backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: 2, transition: 'background-color 300ms, border-color 300ms' }} />
                  )
                })}
                {(anyDirty || publishedVersionId != null || (!!repoId && !!versionId)) && (
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



            {/* Action buttons — top right */}
            <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
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
                  onSelect={(m) => { setSelectedModel(m); setModelSelectorOpen(false) }}
                />
              </div>

              {/* ── System instruction ────────────────────────────────────────── */}
              <EnhancePromptField
                data-help-id="help-instruction"
                value={instruction}
                onChange={setInstruction}
                footerLeft={
                  <UndoRedoGroup
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undoInstruction}
                    onRedo={redoInstruction}
                  />
                }
              />

              {/* ── Temperature slider ────────────────────────────────────────── */}
              <div data-help-id="help-temperature" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
                    Creativity level (Temperature)
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#0a0a0a' }}>
                    {getTemperatureLabel(temperature)}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 4, borderRadius: 2, backgroundColor: 'white', cursor: 'pointer' }}>
                  <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${temperature * 100}%`, backgroundColor: 'var(--blue-600)', borderRadius: 2, pointerEvents: 'none' }} />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    aria-label="Creativity level"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
                  />
                  <div aria-hidden style={{ position: 'absolute', top: '50%', left: `${temperature * 100}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--blue-600)', pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-800)' }}>0 (Precise &amp; consistent)</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-700)' }}>(Creative &amp; varied) 1</span>
                </div>
              </div>

              {/* ── Example conversations ─────────────────────────────────────── */}
              <div data-help-id="help-examples" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setExampleConvExpanded(v => !v)}
                  aria-expanded={exampleConvExpanded}
                  aria-controls="example-conversations-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    height: 64,
                    width: '100%',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 6,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 0', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: '22px',
                        color: '#0a0a0a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Example conversations ( optional )
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
            push('/agents')
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
