'use client'

import React, { useState, Suspense, useEffect, useEffectEvent, useRef, useCallback } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftOneIcon,
  ArrowRightOneIcon,
  MoreHorizontalIcon,
  QuillWriteOneIcon,
  ArrowUpRightOneIcon,
  ArrowDownOneIcon,
  AtomOneIcon,
  PlusSignIcon,
  CancelOneIcon,
} from '@strange-huge/icons'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { EnhancePromptField } from '@/components/EnhancePromptField'
import ExampleConversationModal from '@/app/(app)/persona/configure/components/ExampleConversationModal'
import RepublishModal from '@/app/(app)/persona/configure/components/RepublishModal'
import { useInstructionHistory } from '@/app/(app)/persona/configure/hooks/use-instruction-history'
import {
  createPersonaRepo,
  createVersion,
  getPersonaRepo,
  getVersion,
  setActiveVersion,
  listVersions,
  bustPersonasCache,
} from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import type { AIModel } from '@/types/ai-model'
import { LlmIcon } from '@strange-huge/icons/llm'
import { getModelLlmId } from '@/lib/model-icons'
import { TEMPLATE_PRESETS } from '@/app/(app)/personas/_data/template-presets'
import { pickTemplateAvatar } from '@/lib/persona-template-avatars'
import { usePersonaConfigure } from '@/app/(app)/persona/configure/context'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Instructions', 'Profile', 'Knowledge', 'Connectors', 'Sharing'] as const
type Tab = (typeof TABS)[number]

const MUTED_TABS = new Set<Tab>(['Sharing'])

const TAB_ROUTES: Partial<Record<Tab, string>> = {
  Profile:    '/persona/configure/profile',
  Knowledge:  '/persona/configure/knowledge',
  Connectors: '/persona/configure/connectors',
  Sharing:    '/persona/configure/sharing',
}

const MAX_VERSIONS = 5

function formatVersionDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

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

function publishedVersionKey(repoId: string) {
  return `persona_live_version_${repoId}`
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

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function PersonaConfigureInstructionsContent() {
  const { push, back } = useRouter()
  const searchParams = useSearchParams()

  // URL params - repoId/versionId present when editing existing persona
  const repoIdParam    = searchParams.get('repoId')    ?? ''
  const versionIdParam = searchParams.get('versionId') ?? ''

  // ── State ───────────────────────────────────────────────────────────────────

  const [repoId,    setRepoId]    = useState(repoIdParam)
  const [versionId, setVersionId] = useState(versionIdParam)
  const [personaName, setPersonaName] = useState('Persona Name')
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
  const [connectorSlugs, setConnectorSlugs] = useState<string[] | null>(null)
  const [isInitialising, setIsInitialising] = useState(true)
  const [isSaving,      setIsSaving]      = useState(false)
  const [isPublishing,  setIsPublishing]  = useState(false)

  const { anyPanelOpen, updatePersonaInfo, registerVersionRestoreCallback } = usePersonaConfigure()

  const [exampleConvOpen, setExampleConvOpen] = useState(false)
  const [exampleConvExpanded, setExampleConvExpanded] = useState(false)
  const [exampleConversations, setExampleConversations] = useState<Array<{ id: string; userSays: string; personaReplies: string }>>([])
  const [republishModalOpen, setRepublishModalOpen] = useState(false)

  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)
  const hasInitialisedRef = useRef(false)
  const savedSnapshotRef  = useRef<{ instruction: string; modelId: string; temperature: number } | null>(null)

  // ── Initialise: fetch models, then create or load persona ──────────────────

  const initialise = useCallback(async () => {
    // Guard against React Strict Mode double-invocation: reading sessionStorage
    // a second time would find an empty draft (already removed on the first run)
    // and create a second repo named "Untitled Persona".
    if (hasInitialisedRef.current) return
    hasInitialisedRef.current = true
    setIsInitialising(true)
    try {
      // Read wizard state from sessionStorage (new-persona flow)
      // These are set by the basics wizard pages and cleared here after use
      let wizardName = ''
      let wizardPurpose = ''
      let wizardTone = ''
      let wizardTemplate = ''
      if (typeof window !== 'undefined' && !repoIdParam) {
        try {
          const draft = JSON.parse(sessionStorage.getItem('persona_wizard_draft') ?? '{}')
          wizardName     = draft.name     ?? ''
          wizardPurpose  = draft.purpose  ?? ''
          wizardTone     = draft.tone     ?? ''
          wizardTemplate = draft.template ?? ''
          sessionStorage.removeItem('persona_wizard_draft')
        } catch { /* ignore */ }
      }

      // Fetch all available models with proper normalization
      let fetchedModels: AIModel[] = []
      try {
        fetchedModels = await fetchModelsWithCache()
      } catch {
        // proceed without model list
      }
      setAllModels(fetchedModels)
      const firstModel = fetchedModels[0] ?? null

      if (repoIdParam && versionIdParam) {
        // ── Edit existing persona ─────────────────────────────────────────────
        const [repo, version] = await Promise.all([
          getPersonaRepo(repoIdParam),
          getVersion(repoIdParam, versionIdParam),
        ])
        const prompt = version.prompt ?? ''
        setPersonaName(repo.name)
        resetInstructionHistory(prompt)
        setTemperature(version.temperature ?? 0.5)
        setImageUrl(readProfileAvatar(repoIdParam) ?? version.image_url ?? null)
        if (version.connectors.length > 0) setConnectorSlugs(version.connectors)
        const resolvedModel1 = matchModel(fetchedModels, version.model_id, repoIdParam, firstModel)
        setSelectedModel(resolvedModel1)
        setBackendModelId(version.model_id ?? null)
        if (resolvedModel1) writePersonaModelCache(repoIdParam, resolvedModel1)
        // Restore example conversation cards from saved prompt text
        const examples = parseExampleConversations(prompt)
        if (examples.length > 0) setExampleConversations(examples)
        // Set baseline snapshot so save button starts disabled
        savedSnapshotRef.current = {
          instruction: prompt,
          modelId:     version.model_id ?? '',
          temperature: version.temperature ?? 0.5,
        }
        setPublishedVersionId(repo.active_version?.id ?? null)
      } else if (repoIdParam) {
        // ── Repo exists but no specific version — load most-recently saved version
        const [repo, versionList] = await Promise.all([
          getPersonaRepo(repoIdParam),
          listVersions(repoIdParam),
        ])
        setPersonaName(repo.name)
        // Most-recent version = highest created_at
        const sorted = versionList.slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const latestItem = sorted[0] ?? null

        if (latestItem) {
          const fullVersion = await getVersion(repoIdParam, latestItem.id)
          const prompt = fullVersion.prompt ?? ''
          resetInstructionHistory(prompt)
          setTemperature(fullVersion.temperature ?? 0.5)
          setImageUrl(readProfileAvatar(repoIdParam) ?? fullVersion.image_url ?? null)
          if (fullVersion.connectors.length > 0) setConnectorSlugs(fullVersion.connectors)
          setVersionId(fullVersion.id)
          // Stamp URL so a reload goes straight to this version
          window.history.replaceState(null, '', `?repoId=${repoIdParam}&versionId=${fullVersion.id}`)
          const resolvedModel2 = matchModel(fetchedModels, fullVersion.model_id, repoIdParam, firstModel)
          setSelectedModel(resolvedModel2)
          setBackendModelId(fullVersion.model_id ?? null)
          if (resolvedModel2) writePersonaModelCache(repoIdParam, resolvedModel2)
          const examples = parseExampleConversations(prompt)
          if (examples.length > 0) setExampleConversations(examples)
          savedSnapshotRef.current = {
            instruction: prompt,
            modelId:     fullVersion.model_id ?? '',
            temperature: fullVersion.temperature ?? 0.5,
          }
        } else if (repo.active_version) {
          // Fallback: version list empty but active_version exists
          const prompt = repo.active_version.prompt ?? ''
          resetInstructionHistory(prompt)
          setTemperature(repo.active_version.temperature ?? 0.5)
          setImageUrl(readProfileAvatar(repoIdParam) ?? repo.active_version.image_url ?? null)
          if (repo.active_version.connectors.length > 0) setConnectorSlugs(repo.active_version.connectors)
          setVersionId(repo.active_version.id)
          window.history.replaceState(null, '', `?repoId=${repoIdParam}&versionId=${repo.active_version.id}`)
          const resolvedModel3 = matchModel(fetchedModels, repo.active_version.model_id, repoIdParam, firstModel)
          setSelectedModel(resolvedModel3)
          setBackendModelId(repo.active_version.model_id ?? null)
          if (resolvedModel3) writePersonaModelCache(repoIdParam, resolvedModel3)
          const examples = parseExampleConversations(prompt)
          if (examples.length > 0) setExampleConversations(examples)
          savedSnapshotRef.current = {
            instruction: prompt,
            modelId:     repo.active_version.model_id ?? '',
            temperature: repo.active_version.temperature ?? 0.5,
          }
        } else {
          setSelectedModel(firstModel)
        }
        setPublishedVersionId(repo.active_version?.id ?? null)
      } else {
        // ── New persona - create repo + initial version ───────────────────────
        if (!firstModel) {
          toast.error('No AI models available. Please contact support.')
          push('/personas')
          return
        }

        const effectiveName = wizardName || 'Untitled Persona'
        if (wizardName) setPersonaName(wizardName)

        // Resolve template preset (if the wizard was started from a template card)
        const templatePreset = wizardTemplate ? (TEMPLATE_PRESETS[wizardTemplate] ?? null) : null

        // Use the template's system instruction, or start empty for blank personas
        const initialPrompt = templatePreset?.systemInstruction ?? ''

        // Pick the best model: try to match the template's model hint first, fall back to firstModel
        let chosenModel = firstModel
        if (templatePreset?.modelHint && fetchedModels.length > 0) {
          const hint = templatePreset.modelHint.toLowerCase()
          const hinted = fetchedModels.find(m => m.modelName.toLowerCase().includes(hint))
          if (hinted) chosenModel = hinted
        }
        setSelectedModel(chosenModel)

        const chosenModelKey = stableKey(chosenModel) ?? ''
        const repo = await createPersonaRepo({
          name:    effectiveName,
          modelId: chosenModelKey,
          prompt:  initialPrompt,
        })

        const newRepoId    = repo.id
        const newVersionId = repo.active_version?.id ?? ''

        setRepoId(newRepoId)
        setVersionId(newVersionId)
        setPersonaName(repo.name)
        resetInstructionHistory(initialPrompt)
        setBackendModelId(repo.active_version?.model_id ?? chosenModelKey)
        writePersonaModelCache(newRepoId, chosenModel)
        savedSnapshotRef.current = {
          instruction: initialPrompt,
          modelId:     chosenModelKey,
          temperature: 0.5,
        }

        // Update URL with IDs only - no user data in the URL
        window.history.replaceState(null, '', `?repoId=${newRepoId}&versionId=${newVersionId}`)

        // Preserve wizard purpose for the Profile tab to use as description
        if (wizardPurpose) {
          sessionStorage.setItem(`persona_wizard_purpose_${newRepoId}`, wizardPurpose)
        }

        // Assign a random avatar for template-created personas so the card has
        // a face immediately. Blank ("Custom") personas keep the initials fallback.
        if (wizardTemplate) {
          const avatarPath = pickTemplateAvatar()
          setImageUrl(avatarPath)
          try {
            const profileKey = `persona_profile_${newRepoId}`
            const existing = JSON.parse(sessionStorage.getItem(profileKey) ?? '{}') as Record<string, unknown>
            sessionStorage.setItem(profileKey, JSON.stringify({ ...existing, avatarUrl: avatarPath }))
          } catch { /* ignore quota errors */ }
        }
      }
    } catch (err) {
      console.error('[PersonaConfigure] init error:', err)
      toast.error('Failed to load persona. Please try again.')
    } finally {
      setIsInitialising(false)
    }
  }, []) // run once on mount

  useEffect(() => {
    initialise()
  }, [initialise])

  useEffect(() => {
    // Use the backend's stored model_id (exact format the guide endpoint expects).
    // Fall back to stableKey only when no backend value is available (e.g. model changed but not yet saved).
    const modelId = backendModelId ?? (selectedModel ? stableKey(selectedModel) : null)
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
      setBackendModelId(full.model_id ?? null)
      setExampleConversations(parseExampleConversations(prompt))
      setVersionId(full.id)
      savedSnapshotRef.current = null
    })
    return () => registerVersionRestoreCallback(null)
  }, [repoId, allModels, registerVersionRestoreCallback])

  // ── Save version ─────────────────────────────────────────────────────────────

  async function executeSave() {
    const modelId = selectedModel ? stableKey(selectedModel) : null
    if (!repoId || !modelId) return
    setIsSaving(true)
    try {
      let imageFile: File | null = null
      let preserveImageUrl: string | null = null
      const avatarDataUrl = readProfileAvatar(repoId)
      if (avatarDataUrl?.startsWith('data:')) {
        imageFile = dataUrlToFile(avatarDataUrl, 'avatar.jpg')
      } else if (imageUrl) {
        preserveImageUrl = imageUrl
      }

      const version = await createVersion({
        repoId,
        name:        personaName,
        modelId,
        prompt:      instruction,
        temperature,
        image:       imageFile,
        imageUrl:    preserveImageUrl,
      })

      // Save version only — does NOT publish or change the active version.
      // The persona only becomes live in the library when the user clicks Publish.

      setVersionId(version.id)
      if (version.image_url) setImageUrl(version.image_url)
      setBackendModelId(version.model_id ?? modelId)
      updatePersonaInfo({ versionId: version.id })
      const params = new URLSearchParams(searchParams.toString())
      params.set('versionId', version.id)
      window.history.replaceState(null, '', `?${params.toString()}`)

      savedSnapshotRef.current = { instruction, modelId, temperature }
      bustPersonasCache()

      toast.success('Version saved')
    } catch (err) {
      console.error('[PersonaConfigure] save error:', err)
      toast.error('Failed to save version')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveVersion() {
    if (!canSave) return
    await executeSave()
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!repoId || !versionId) return

    const wasPublished = !!publishedVersionId
    setIsPublishing(true)

    try {
      // If the editor has unsaved changes, save them as a new version first so the
      // published persona always reflects exactly what the user sees in the editor.
      let publishVersionId = versionId
      if (isDirty && hasContent) {
        const modelId = selectedModel ? stableKey(selectedModel) : null
        if (modelId) {
          let imageFile: File | null = null
          let preserveImageUrl: string | null = null
          const avatarDataUrl = readProfileAvatar(repoId)
          if (avatarDataUrl?.startsWith('data:')) {
            imageFile = dataUrlToFile(avatarDataUrl, 'avatar.jpg')
          } else if (imageUrl) {
            preserveImageUrl = imageUrl
          }
          const version = await createVersion({
            repoId,
            name:        personaName,
            modelId,
            prompt:      instruction,
            temperature,
            image:       imageFile,
            imageUrl:    preserveImageUrl,
          })
          publishVersionId = version.id
          setVersionId(version.id)
          if (version.image_url) setImageUrl(version.image_url)
          const params = new URLSearchParams(searchParams.toString())
          params.set('versionId', version.id)
          window.history.replaceState(null, '', `?${params.toString()}`)
          savedSnapshotRef.current = { instruction, modelId, temperature }
        }
      }

      // Make the version live — this is what creates/updates the persona card in the library.
      await setActiveVersion(repoId, publishVersionId)
      bustPersonasCache()

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(publishedVersionKey(repoId), publishVersionId)
      }
      setPublishedVersionId(publishVersionId)

      const base = `/personas/published?name=${encodeURIComponent(personaName)}&repoId=${repoId}&versionId=${publishVersionId}`
      push(wasPublished ? `${base}&republished=true` : base)
    } catch (err) {
      console.error('[PersonaConfigure] publish error:', err)
      toast.error('Failed to publish persona')
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
  const hasContent = instruction.trim().length > 0

  // isPublished: current version IS the published one with no pending changes.
  // needsRepublish: user has published before but the editor is now ahead of what's live.
  const isPublished    = !!publishedVersionId && publishedVersionId === versionId && !isDirty
  const needsRepublish = !!publishedVersionId && (publishedVersionId !== versionId || isDirty)

  const canPublish = hasContent && !!repoId && !!versionId && !isPublishing && !isPublished
  const canSave    = isDirty && hasContent && !!repoId && !!selectedModel && !isSaving

  // Warn the browser when navigating away (tab close / external nav) if there are unpublished changes.
  useEffect(() => {
    if (!needsRepublish) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [needsRepublish])

  function safeNavigate(href: string) {
    if (needsRepublish && !window.confirm('You have unpublished changes. Leave without publishing?')) return
    push(href)
  }
  function safeBack() {
    if (needsRepublish && !window.confirm('You have unpublished changes. Leave without publishing?')) return
    back()
  }

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

  // ── Tab navigation ────────────────────────────────────────────────────────────

  function navigateTab(tab: Tab) {
    const route = TAB_ROUTES[tab]
    if (!route) return
    const params = new URLSearchParams(searchParams.toString())
    if (repoId)    params.set('repoId',    repoId)
    if (versionId) params.set('versionId', versionId)
    safeNavigate(`${route}?${params.toString()}`)
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: anyPanelOpen ? 'flex-start' : 'space-between', gap: anyPanelOpen ? 8 : 0, height: 36, position: 'relative' }}>
            {/* Back arrow */}
            <div style={{ flexShrink: 0 }}>
              <IconButton
                variant="ghost"
                size="md"
                icon={<ArrowLeftOneIcon size={20} />}
                aria-label="Go back"
                onClick={safeBack}
              />
            </div>

            {/* Tabs — centered when no panel open, left-aligned when a panel is open */}
            <div style={anyPanelOpen
              ? { display: 'inline-flex', alignItems: 'flex-start', position: 'relative' }
              : { position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'flex-start' }
            }>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow:
                    'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
                {TABS.map(tab => {
                  const isActive = tab === 'Instructions'
                  return (
                    <button
                      key={tab}
                      onClick={() => navigateTab(tab)}
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
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: anyPanelOpen ? 'auto' : undefined }}>
              <IconButton
                variant="outline"
                size="md"
                icon={<MoreHorizontalIcon size={20} />}
                aria-label="More options"
              />
              {anyPanelOpen ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  icon={<QuillWriteOneIcon size={16} />}
                  aria-label="Save version"
                  onClick={handleSaveVersion}
                  disabled={!canSave}
                  loading={isSaving}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<QuillWriteOneIcon size={16} />}
                  onClick={handleSaveVersion}
                  disabled={!canSave}
                  loading={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save version'}
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                disabled={!canPublish}
                rightIcon={<ArrowUpRightOneIcon size={16} />}
                onClick={handlePublish}
              >
                {isPublishing ? 'Publishing…' : publishedVersionId ? 'Republish' : 'Publish'}
              </Button>
            </div>

            {/* Live / Unpublished badge — centered below the tab bar */}
            {(isPublished || needsRepublish) && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 6,
                pointerEvents: 'none',
                zIndex: 1,
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1px 8px',
                  borderRadius: 6,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 11,
                  lineHeight: '16px',
                  whiteSpace: 'nowrap',
                  ...(isPublished
                    ? { backgroundColor: '#d1fae5', color: '#065f46', boxShadow: '0px 0px 0px 1px rgba(6,95,70,0.2)' }
                    : { backgroundColor: '#fef3c7', color: '#92400e', boxShadow: '0px 1px 1.5px 0px rgba(24,15,2,0.15), 0px 0px 0px 1px rgba(146,64,14,0.3)' }
                  ),
                }}>
                  {isPublished ? 'Live' : 'Unpublished'}
                </span>
              </div>
            )}
          </div>

          <div style={{ height: 32, flexShrink: 0 }} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 714 }}>

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
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                  >
                    {personaName || 'Persona Name'}
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      borderRadius: 6,
                      alignSelf: 'flex-start',
                      backgroundColor: 'var(--neutral-100)',
                      boxShadow: '0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)',
                      position: 'relative',
                    }}
                  >
                    <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0px 0px rgba(247,242,237,0.7), inset 0px -1px 0px 0px rgba(106,98,93,0.1)', pointerEvents: 'none' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-700)', padding: '0 2px', whiteSpace: 'nowrap' }}>
                      Private
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Model selector ────────────────────────────────────────────── */}
              <ModelDropdown
                models={allModels}
                selectedModel={selectedModel}
                open={modelSelectorOpen}
                onOpenChange={setModelSelectorOpen}
                onSelect={(m) => { setSelectedModel(m); setModelSelectorOpen(false) }}
              />

              {/* ── System instruction ────────────────────────────────────────── */}
              <EnhancePromptField
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
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
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 500,
                          fontSize: 12,
                          lineHeight: '16px',
                          color: 'var(--neutral-700)',
                          backgroundColor: 'var(--neutral-100)',
                          border: '1px solid rgba(106,98,93,0.3)',
                          borderRadius: 6,
                          padding: '1px 6px',
                          flexShrink: 0,
                        }}
                      >
                        {exampleConversations.length}
                      </span>
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
                          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-600)' }}>Persona replies</span>
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
            push('/personas')
          }}
        />
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
