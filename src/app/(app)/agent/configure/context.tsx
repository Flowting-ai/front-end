'use client'

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  Suspense,
} from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import {
  testVersionStream,
  guidePersonaStream,
  listVersions,
  getVersion,
  getPersonaRepo,
  setActiveVersion,
  bustPersonasCache,
  type PersonaChatStreamCallbacks,
  type PersonaVersionListItem,
  type PersonaVersionResponse,
  type GuideMessage,
  type PersonaConnectPrompt,
  type PersonaPermissionPrompt,
  type PersonaActivityItem,
} from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { stableKey } from '@/hooks/use-model-selection'
import { useFileUpload } from '@/hooks/use-file-upload'
import type { PinFolder } from '@/lib/api/pins'
import type { PendingAttachment } from '@/components/chat/AttachmentManager'
import type { ActivityItem } from '@/hooks/use-chat-state'
import { AGENT_CHAT_ROUTE, AGENT_CONFIGURE_INSTRUCTIONS_ROUTE } from '@/lib/routes'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfigureTabKey = 'instructions' | 'profile' | 'knowledge' | 'connectors' | 'sharing'

export type GuideMsg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  isStreaming?: boolean
}

export type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  isStreaming?: boolean
  connectPrompts?: PersonaConnectPrompt[]
  permissionPrompts?: PersonaPermissionPrompt[]
  activities?: ActivityItem[]
  attachments?: Array<{ file_name: string; mime_type: string; file_size?: number }>
}

export interface PersonaInfo {
  repoId: string
  versionId: string
  personaName: string
  imageUrl: string | null
  connectorSlugs: string[]
  disabledConnectorSlugs: string[]
  guidePrompt: string
  guideModelId: string | null
  guideTemperature: number
  guideModelName: string
}

interface PersonaConfigureContextValue {
  personaInfo: PersonaInfo
  updatePersonaInfo: (patch: Partial<PersonaInfo>) => void

  // Help panel open state — shared so the panels island and the tab card can be positioned independently
  helpOpen: boolean
  setHelpOpen: (v: boolean) => void
  helpActiveId: string
  setHelpActiveId: (id: string) => void

  // Configure progress (A)
  knowledgeFileCount: number
  setKnowledgeFileCount: (n: number) => void
  hasShareLink: boolean
  setHasShareLink: (v: boolean) => void

  // Auto-save on tab switch
  registerAutoSave: (fn: (() => Promise<void>) | null) => void

  // Continue handler registered by the active tab — used by ConfigureStepNav
  registerContinueHandler: (fn: (() => void) | null) => void
  invokeTabContinue: () => void

  // Publication state — single source of truth, derived from the backend's
  // published_version_id (NOT client storage) so every tab agrees on Live vs
  // Unpublished and never shows a spurious "not published" warning.
  activeVersionId: string | null
  publishedVersionId: string | null
  /** Re-read the backend's active version id for the current repo. */
  refreshActiveVersion: () => void
  /** Optimistically mark a version as live after a successful publish, and
   *  invalidate the personas list cache so the library reflects it. */
  markPublished: (versionId: string) => void

  // Leave-confirm guard (shared across all 5 configure tabs)
  needsRepublish: boolean
  setNeedsRepublish: (v: boolean) => void
  leaveConfirmHref: string | null
  setLeaveConfirmHref: (href: string | null) => void
  safeNavigate: (href: string) => void
  safeBack: () => void
  hasPublishAndLeave: boolean
  setOnPublishAndLeave: (fn: (() => void) | null) => void
  handlePublishAndLeave: () => void

  // Panel state
  testChatOpen: boolean
  testChatExpanded: boolean
  aiSuggestOpen: boolean
  guideExpanded: boolean
  versionsOpen: boolean
  anyPanelOpen: boolean
  panelsLocked: boolean
  // Track-changes rail — independent of the exclusive test-chat/AI-suggest/versions
  // panel group above; shared across all 5 configure tabs.
  changesTrackerOpen: boolean
  // Per-attribute "touched this session" flags for each tab's track-changes rail,
  // keyed by tab. Lives here (not local state in each tab's page.tsx) because
  // navigating to another tab and back unmounts/remounts that page — this context
  // persists across tab switches within /agent/configure/*, so the dots only
  // clear on that tab's explicit save, not on tab-switch autosave.
  touchedFieldsByTab: Record<ConfigureTabKey, Set<string>>

  // Toggles
  toggleTestChat: () => void
  toggleAiSuggest: () => void
  toggleVersions: () => void
  toggleChangesTracker: () => void
  markFieldTouched: (tab: ConfigureTabKey, field: string) => void
  resetTouchedFields: (tab: ConfigureTabKey, field?: string) => void
  setTestChatOpen: React.Dispatch<React.SetStateAction<boolean>>
  setTestChatExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setGuideExpanded: React.Dispatch<React.SetStateAction<boolean>>
  setVersionsOpen: (open: boolean) => void
  setAiSuggestOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Guide
  guideMessages: GuideMsg[]
  guideIsStreaming: boolean
  guideScrollRef: React.RefObject<HTMLDivElement | null>
  handleGuideSend: (value: string) => void

  // Test chat
  chatMessages: ChatMsg[]
  isStreaming: boolean
  chatScrollRef: React.RefObject<HTMLDivElement | null>
  handleTestChatSend: (value: string) => void
  testChatWebSearch: boolean
  testChatStyleId: string | null
  testChatFolders: PinFolder[]
  testChatPersonaId: string | null
  testChatAttachments: PendingAttachment[]
  setTestChatWebSearch: React.Dispatch<React.SetStateAction<boolean>>
  setTestChatStyleId: React.Dispatch<React.SetStateAction<string | null>>
  setTestChatFolders: React.Dispatch<React.SetStateAction<PinFolder[]>>
  setTestChatPersonaId: React.Dispatch<React.SetStateAction<string | null>>
  setTestChatAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>
  handleTestChatAddFiles: () => void
  handleTestChatFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTestChatFilePaste: (files: File[]) => void
  testChatFileInputRef: React.RefObject<HTMLInputElement | null>
  FILE_ACCEPT: string

  // Versions
  versions: PersonaVersionListItem[]
  versionsLoading: boolean
  restoringId: string | null
  handleRestoreVersion: (id: string) => void
  refreshVersions: () => void
  registerVersionRestoreCallback: (fn: ((version: PersonaVersionResponse) => void) | null) => void

  // Pending change tags (auto-detected as user edits)
  pendingChangeTags: string[]
  addPendingChangeTag: (tag: string) => void
  setPendingChangeTags: (tags: string[]) => void

  // Per-tab dirty flags (ungated — works for unpublished personas too)
  tabDirtyFlags: Record<string, boolean>
  setTabDirty: (tab: string, dirty: boolean) => void
  tabAutoSavedFlags: Record<string, boolean>
  setTabAutoSaved: (tab: string, saved: boolean) => void
}

const PersonaConfigureContext = createContext<PersonaConfigureContextValue | null>(null)

export function usePersonaConfigure() {
  const ctx = useContext(PersonaConfigureContext)
  if (!ctx) throw new Error('usePersonaConfigure must be used within PersonaConfigureProvider')
  return ctx
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTabName(path: string): string {
  if (path.includes('/instructions')) return 'Instructions'
  if (path.includes('/profile'))      return 'Profile'
  if (path.includes('/knowledge'))    return 'Knowledge'
  if (path.includes('/connectors'))   return 'Connectors'
  if (path.includes('/sharing'))      return 'Sharing'
  return 'Agent'
}

// ── Provider (inner — uses hooks that need Suspense) ─────────────────────────

function PersonaConfigureProviderInner({ children }: { children: React.ReactNode }) {
  const { push, replace, back } = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [personaInfo, _setPersonaInfo] = useState<PersonaInfo>(() => ({
    repoId:           searchParams.get('repoId')    ?? '',
    versionId:        searchParams.get('versionId') ?? '',
    personaName:      '',
    imageUrl:         null,
    connectorSlugs:          [],
    disabledConnectorSlugs:  [],
    guidePrompt:      '',
    guideModelId:     null,
    guideTemperature: 0.5,
    guideModelName:   'AI',
  }))

  const updatePersonaInfo = useCallback((patch: Partial<PersonaInfo>) => {
    _setPersonaInfo(prev => ({ ...prev, ...patch }))
  }, [])

  // Keep a ref so handlers always read the latest values without stale closures
  const infoRef = useRef(personaInfo)
  useEffect(() => { infoRef.current = personaInfo }, [personaInfo])

  // ── Eagerly bootstrap guide model from the saved version ────────────────────
  // This ensures the AI suggestions panel has the correct model_id even before
  // the instructions tab mounts (e.g. when the user is on the profile tab).
  // The model bootstrap is skipped on the instructions tab — that page calls
  // getVersion in its own initialise() and pushes the result via updatePersonaInfo.
  // The received-persona guard always runs regardless of tab.
  useEffect(() => {
    const repoId    = personaInfo.repoId
    const versionId = personaInfo.versionId
    if (!repoId || !versionId) return

    const isInstructionsTab = pathname.includes('/configure/instructions')

    let cancelled = false
    ;(async () => {
      try {
        const [version, repo, models] = await Promise.all([
          getVersion(repoId, versionId),
          getPersonaRepo(repoId),
          isInstructionsTab ? Promise.resolve([]) : fetchModelsWithCache(),
        ])
        if (cancelled) return

        // Received personas are read-only — redirect away from all configure tabs
        if (version.source_share_id) {
          push(AGENT_CHAT_ROUTE(repoId))
          return
        }

        // Always update name and avatar so the test-chat header stays correct on
        // reload and session/tab changes (even when the instructions page is unmounted).
        _setPersonaInfo(prev => ({
          ...prev,
          personaName: prev.personaName || repo.name || prev.personaName,
          imageUrl:    prev.imageUrl    ?? version.image_url ?? null,
        }))

        // Skip the model bootstrap for the instructions tab — it does this itself
        if (isInstructionsTab) return

        const vModelId = version.model_id ?? null
        const vPrompt  = version.prompt   ?? ''

        const matched = models.find(m =>
          (m.modelId != null && String(m.modelId) !== 'undefined' && String(m.modelId) === vModelId) ||
          (m.id     != null && String(m.id)      !== 'undefined' && String(m.id)      === vModelId),
        )
        const modelName = matched?.modelName ?? (models[0]?.modelName ?? 'AI')

        // Use the stored model_id only when it's valid (exists in the current models list).
        // If stale (e.g. retired OpenRouter slug), fall back to the first available model.
        const resolvedModelId = matched
          ? vModelId
          : (models.length > 0 ? stableKey(models[0]) : null)

        _setPersonaInfo(prev => {
          if (prev.guideModelId) return prev
          return {
            ...prev,
            guideModelId:   resolvedModelId ?? prev.guideModelId,
            guideModelName: modelName,
            guidePrompt:    prev.guidePrompt || vPrompt,
          }
        })
      } catch { /* version or models fetch failed — guide will rely on pre-fetch in guidePersonaStream */ }
    })()
    return () => { cancelled = true }
  }, [personaInfo.repoId, personaInfo.versionId])

  // ── Help panel state ─────────────────────────────────────────────────────────

  const [helpOpen,    setHelpOpen]    = useState(false)
  const [helpActiveId, setHelpActiveId] = useState('')

  // ── Configure progress ───────────────────────────────────────────────────────

  const [knowledgeFileCount, setKnowledgeFileCount] = useState(0)
  const [hasShareLink,       setHasShareLink]       = useState(false)

  // ── Auto-save on tab switch ──────────────────────────────────────────────────

  const autoSaveRef = useRef<(() => Promise<void>) | null>(null)
  const registerAutoSave = useCallback((fn: (() => Promise<void>) | null) => {
    autoSaveRef.current = fn
  }, [])

  const continueHandlerRef = useRef<(() => void) | null>(null)
  const registerContinueHandler = useCallback((fn: (() => void) | null) => {
    continueHandlerRef.current = fn
  }, [])
  const invokeTabContinue = useCallback(() => {
    continueHandlerRef.current?.()
  }, [])

  // ── Leave-confirm guard ──────────────────────────────────────────────────────

  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  const needsRepublishRef = useRef(false)
  const [needsRepublish,   _setNeedsRepublish]   = useState(false)
  const [leaveConfirmHref, setLeaveConfirmHref]  = useState<string | null>(null)
  const [hasPublishAndLeave, setHasPublishAndLeave] = useState(false)
  const onPublishAndLeaveRef = useRef<(() => void) | null>(null)

  const setNeedsRepublish = useCallback((v: boolean) => {
    needsRepublishRef.current = v
    _setNeedsRepublish(v)
  }, [])

  const setOnPublishAndLeave = useCallback((fn: (() => void) | null) => {
    onPublishAndLeaveRef.current = fn
    setHasPublishAndLeave(fn !== null)
  }, [])

  const handlePublishAndLeave = useCallback(() => {
    onPublishAndLeaveRef.current?.()
  }, [])

  const safeNavigate = useCallback((href: string) => {
    const isLeavingConfigure = !href.includes('/agent/configure/')
    // Prompt to save a version when leaving configure with unsaved changes
    if (isLeavingConfigure && pendingChangeTagsRef.current.length > 0) {
      setLeaveConfirmHref(href)
      return
    }
    const save = autoSaveRef.current
    if (save) {
      save().catch(() => {}).finally(() => push(href))
    } else {
      push(href)
    }
  }, [push])

  const safeBack = useCallback(() => {
    if (needsRepublishRef.current) { setLeaveConfirmHref('__back__'); return }
    const save = autoSaveRef.current
    if (save) {
      save().catch(() => {}).finally(() => back())
    } else {
      back()
    }
  }, [back])

  // ── Panel state ─────────────────────────────────────────────────────────────

  const [testChatOpen,     setTestChatOpen]      = useState(false)
  const [testChatExpanded, setTestChatExpanded]  = useState(false)
  const [aiSuggestOpen,    setAiSuggestOpen]     = useState(false)
  const [guideExpanded,    setGuideExpanded]     = useState(false)
  const [versionsOpen,     _setVersionsOpen]     = useState(false)
  // Defaults on — user must explicitly turn it off. Auto-suppressed (not toggled
  // off) while the test-chat/AI-suggest/versions panel group is open; reappears
  // on its own once all three close, since this preference is untouched by that.
  const [changesTrackerOpen, setChangesTrackerOpen] = useState(true)
  const [touchedFieldsByTab, setTouchedFieldsByTab] = useState<Record<ConfigureTabKey, Set<string>>>({
    instructions: new Set(),
    profile:      new Set(),
    knowledge:    new Set(),
    connectors:   new Set(),
    sharing:      new Set(),
  })
  const anyPanelOpen = testChatOpen || aiSuggestOpen || versionsOpen

  const markFieldTouched = useCallback((tab: ConfigureTabKey, field: string) => {
    setTouchedFieldsByTab(prev => {
      const current = prev[tab]
      if (current.has(field)) return prev
      return { ...prev, [tab]: new Set(current).add(field) }
    })
  }, [])

  // Omit `field` to clear every touched flag for the tab (e.g. after a whole-tab
  // save); pass `field` to clear just that one (e.g. Sharing's Visibility save
  // shouldn't clear its independent Super Link / Email Invite touched flags).
  const resetTouchedFields = useCallback((tab: ConfigureTabKey, field?: string) => {
    setTouchedFieldsByTab(prev => {
      if (!field) return { ...prev, [tab]: new Set() }
      if (!prev[tab].has(field)) return prev
      const next = new Set(prev[tab])
      next.delete(field)
      return { ...prev, [tab]: next }
    })
  }, [])

  // Wrapped setter: opening versions always closes test-chat and AI-suggest first
  // so at most one panel is visible at any time (including after Save Version).
  const setVersionsOpen = useCallback((open: boolean) => {
    if (open) { setTestChatOpen(false); setAiSuggestOpen(false) }
    _setVersionsOpen(open)
  }, [])

  const panelsLockedRef = useRef(false)

  const toggleTestChat = useCallback(() => {
    if (panelsLockedRef.current) {
      toast.error('Save a version first to unlock Test Chat', { duration: 3000 })
      return
    }
    setTestChatOpen(prev => { const next = !prev; if (next) { setAiSuggestOpen(false); _setVersionsOpen(false) }; return next })
  }, [])

  const toggleAiSuggest = useCallback(() => {
    if (panelsLockedRef.current) {
      toast.error('Save a version first to unlock AI Suggestions', { duration: 3000 })
      return
    }
    setAiSuggestOpen(prev => { const next = !prev; if (next) { setTestChatOpen(false); _setVersionsOpen(false) }; return next })
  }, [])

  const toggleVersions = useCallback(() => {
    _setVersionsOpen(prev => { const next = !prev; if (next) { setTestChatOpen(false); setAiSuggestOpen(false) }; return next })
  }, [])

  const toggleChangesTracker = useCallback(() => {
    setChangesTrackerOpen(prev => !prev)
  }, [])

  // ── Guide state ─────────────────────────────────────────────────────────────

  const [guideMessages,    setGuideMessages]    = useState<GuideMsg[]>([])
  const [guideHistory,     setGuideHistory]     = useState<GuideMessage[]>([])
  const [guideIsStreaming, setGuideIsStreaming] = useState(false)
  const guideStreamingRef = useRef(false)
  const guideHistoryRef   = useRef<GuideMessage[]>([])
  const guideScrollRef    = useRef<HTMLDivElement | null>(null)

  useEffect(() => { guideHistoryRef.current = guideHistory }, [guideHistory])
  useEffect(() => {
    const el = guideScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [guideMessages])

  const handleGuideSend = useCallback(async (value: string) => {
    const question = value.trim()
    const { repoId } = infoRef.current
    if (!question || !repoId || guideStreamingRef.current) return

    const userMsgId = `guide-user-${Date.now()}`
    const asstMsgId = `guide-asst-${Date.now()}`
    const historySnapshot = guideHistoryRef.current.slice()
    const info = infoRef.current

    setGuideMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user',      text: question },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    guideStreamingRef.current = true
    setGuideIsStreaming(true)

    let accumulated = ''
    const callbacks: PersonaChatStreamCallbacks = {
      onChunk: (delta) => {
        accumulated += delta
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m))
      },
      onDone: () => {
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m))
        setGuideHistory(prev => [
          ...prev,
          { role: 'user',      content: question    },
          { role: 'assistant', content: accumulated },
        ])
        guideStreamingRef.current = false
        setGuideIsStreaming(false)
      },
      onError: (err) => {
        setGuideMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m))
        guideStreamingRef.current = false
        setGuideIsStreaming(false)
      },
    }

    try {
      await guidePersonaStream(
        repoId,
        {
          question,
          prompt:      info.guidePrompt,
          name:        info.personaName || null,
          model_id:    info.guideModelId,
          temperature: info.guideTemperature,
          history:     historySnapshot,
        },
        callbacks,
      )
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to get suggestions')
    }
  }, [])

  // ── Test chat state ─────────────────────────────────────────────────────────

  const [chatMessages,  setChatMessages]  = useState<ChatMsg[]>([])
  const [isStreaming,   setIsStreaming]   = useState(false)
  const chatStreamingRef   = useRef(false)
  const abortStreamRef     = useRef<(() => void) | null>(null)
  const chatScrollRef      = useRef<HTMLDivElement | null>(null)
  const testChatFileInputRef = useRef<HTMLInputElement | null>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  const [testChatWebSearch,   setTestChatWebSearch]   = useState(false)
  const [testChatStyleId,     setTestChatStyleId]     = useState<string | null>(null)
  const [testChatFolders,     setTestChatFolders]     = useState<PinFolder[]>([])
  const [testChatPersonaId,   setTestChatPersonaId]   = useState<string | null>(null)
  const [testChatAttachments, setTestChatAttachments] = useState<PendingAttachment[]>([])

  // Refs for mutable test chat options so handleTestChatSend is stable
  const testChatOptsRef = useRef({
    webSearch: false, styleId: null as string | null,
    folders: [] as PinFolder[], personaId: null as string | null,
    attachments: [] as PendingAttachment[],
  })
  useEffect(() => {
    testChatOptsRef.current = {
      webSearch: testChatWebSearch, styleId: testChatStyleId,
      folders: testChatFolders, personaId: testChatPersonaId,
      attachments: testChatAttachments,
    }
  }, [testChatWebSearch, testChatStyleId, testChatFolders, testChatPersonaId, testChatAttachments])

  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages])

  const handleTestChatAddFiles = useCallback(() => {
    testChatFileInputRef.current?.click()
  }, [])

  const handleTestChatFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const captured = Array.from(e.target.files)
      e.target.value = ''
      setTestChatAttachments(prev => processFiles(captured, prev))
    }
  }, [processFiles])

  const handleTestChatFilePaste = useCallback((files: File[]) => {
    setTestChatAttachments(prev => processFiles(files, prev))
  }, [processFiles])

  const handleTestChatSend = useCallback(async (value: string) => {
    const trimmedValue = value.trim()
    const { repoId, versionId, connectorSlugs, disabledConnectorSlugs, guideModelId } = infoRef.current
    const { attachments } = testChatOptsRef.current
    const filesToSend = attachments.map(a => a.file)
    if (!trimmedValue && filesToSend.length === 0) return
    if (!repoId || !versionId) {
      toast.error('Save your agent first to test the chat.')
      return
    }
    if (chatStreamingRef.current) return

    setTestChatAttachments([])

    const userMsgId = `user-${Date.now()}`
    const asstMsgId = `asst-${Date.now()}`

    setChatMessages(prev => [
      ...prev,
      {
        id: userMsgId, role: 'user', text: trimmedValue,
        attachments: filesToSend.length > 0
          ? filesToSend.map(f => ({ file_name: f.name, mime_type: f.type, file_size: f.size }))
          : undefined,
      },
      { id: asstMsgId, role: 'assistant', text: '', isStreaming: true },
    ])
    chatStreamingRef.current = true
    setIsStreaming(true)

    const callbacks: PersonaChatStreamCallbacks = {
      onChunk: (delta) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: m.text + delta } : m)),
      onDone:  ()      => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, isStreaming: false } : m)); chatStreamingRef.current = false; setIsStreaming(false) },
      onError: (err)   => { setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, text: `⚠ ${err}`, isStreaming: false } : m)); chatStreamingRef.current = false; setIsStreaming(false) },
      onConnectPrompt:    (prompt) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, connectPrompts:    [...(m.connectPrompts    ?? []), prompt] } : m)),
      onPermissionPrompt: (prompt) => setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, permissionPrompts: [...(m.permissionPrompts ?? []), prompt] } : m)),
      onToolActivity: (item: PersonaActivityItem) => setChatMessages(prev => prev.map(m => {
        if (m.id !== asstMsgId) return m
        const acts = m.activities ?? []
        const idx  = acts.findIndex(a => a.id === item.id)
        if (idx >= 0) { const u = [...acts]; u[idx] = { ...acts[idx], ...item } as ActivityItem; return { ...m, activities: u } }
        return { ...m, activities: [...acts, item as ActivityItem] }
      })),
    }

    try {
      abortStreamRef.current = await testVersionStream(
        repoId, versionId, trimmedValue, callbacks,
        {
          files:                filesToSend.length > 0 ? filesToSend : undefined,
          connectorSlugs:       connectorSlugs.length > 0 ? connectorSlugs : undefined,
          disabledConnectors:   disabledConnectorSlugs.length > 0 ? disabledConnectorSlugs : undefined,
          modelId:              guideModelId ?? undefined,
        },
      )
    } catch (err) {
      callbacks.onError?.((err as Error).message ?? 'Failed to send message')
    }
  }, [])

  // ── Versions state ──────────────────────────────────────────────────────────

  const [versions,          setVersions]          = useState<PersonaVersionListItem[]>([])
  const [versionsLoading,   setVersionsLoading]   = useState(false)

  // Panels unlock when the backend says the persona is published, or after the
  // user explicitly saves a version in configure.
  const [panelsUnlocked, setPanelsUnlocked] = useState(false)
  useEffect(() => {
    const repoId = personaInfo.repoId
    if (!repoId) return
    const savedInConfigure = typeof window !== 'undefined' && localStorage.getItem(`persona_configure_saved_${repoId}`) === '1'
    let cancelled = false
    getPersonaRepo(repoId)
      .then(repo => {
        if (!cancelled) setPanelsUnlocked(savedInConfigure || !!repo.published_version_id)
      })
      .catch(() => { if (!cancelled) setPanelsUnlocked(savedInConfigure) })
    return () => { cancelled = true }
  }, [personaInfo.repoId])

  const panelsLocked = !panelsUnlocked
  useEffect(() => { panelsLockedRef.current = panelsLocked }, [panelsLocked])

  // Bootstrap versions on initial load so panelsLocked reflects the server state immediately,
  // without requiring the user to open the versions panel first.
  useEffect(() => {
    const repoId = personaInfo.repoId
    if (!repoId) return
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5),
      ))
      .catch(() => {})
  }, [personaInfo.repoId])

  // ── Publication state (backend source of truth) ─────────────────────────────
  // activeVersionId is the working/configure pointer. publishedVersionId is the
  // live pointer used for chips, publish guards, library/chat behavior, and
  // reload-safe first-publish state.
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)

  const refreshActiveVersion = useCallback(() => {
    const repoId = infoRef.current.repoId
    if (!repoId) return
    getPersonaRepo(repoId)
      .then(repo => {
        setActiveVersionId(repo.active_version_id ?? null)
        setPublishedVersionId(repo.published_version_id ?? null)
      })
      .catch(() => {})
  }, [])

  // Fetch the live version id whenever the repo changes. (No synchronous
  // setState in the effect body — the update happens in the async callback.)
  useEffect(() => {
    const repoId = personaInfo.repoId
    if (!repoId) return
    let cancelled = false
    getPersonaRepo(repoId)
      .then(repo => {
        if (!cancelled) {
          setActiveVersionId(repo.active_version_id ?? null)
          setPublishedVersionId(repo.published_version_id ?? null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [personaInfo.repoId])

  const markPublished = useCallback((versionId: string) => {
    setActiveVersionId(versionId)
    setPublishedVersionId(versionId)
    setPanelsUnlocked(true)
    bustPersonasCache()
  }, [])

  const [restoringId,       setRestoringId]       = useState<string | null>(null)
  const [pendingChangeTags, _setPendingChangeTags] = useState<string[]>([])
  const pendingChangeTagsRef        = useRef<string[]>([])
  const [tabDirtyFlags, setTabDirtyFlags] = useState<Record<string, boolean>>({})
  const [tabAutoSavedFlags, setTabAutoSavedFlags] = useState<Record<string, boolean>>({})
  const setTabDirty = useCallback((tab: string, dirty: boolean) => {
    setTabDirtyFlags(prev => {
      if (dirty) {
        if (prev[tab] === true) return prev
        return { ...prev, [tab]: true }
      } else {
        // Only mark saved (false) if the tab was previously dirty (true).
        // Ignore false calls when tab is still undefined — avoids turning gray → green on initial load.
        if (prev[tab] !== true) return prev
        return { ...prev, [tab]: false }
      }
    })
  }, [])
  const setTabAutoSaved = useCallback((tab: string, saved: boolean) => {
    setTabAutoSavedFlags(prev => {
      if (prev[tab] === saved) return prev
      return { ...prev, [tab]: saved }
    })
  }, [])
  const tagsCountOnTabArrivalRef    = useRef(0)
  const versionRestoreCallbackRef = useRef<((version: PersonaVersionResponse) => void) | null>(null)
  const restoringRef = useRef(false)
  // Mirror of publishedVersionId so addPendingChangeTag (stable, deps []) can read
  // the current publication state without re-creating the callback.
  const publishedVersionIdRef = useRef<string | null>(null)
  useEffect(() => { publishedVersionIdRef.current = publishedVersionId }, [publishedVersionId])

  // Update the baseline tag count whenever the user lands on a new configure tab.
  // safeNavigate compares the current count against this baseline to decide whether
  // any changes were actually made on the tab being left.
  useEffect(() => {
    tagsCountOnTabArrivalRef.current = pendingChangeTagsRef.current.length
  }, [pathname])

  const addPendingChangeTag = useCallback((tag: string) => {
    // New (never-published) personas have no prior version to diff against, so
    // change tags are meaningless noise — don't track them until the persona is
    // published. Tracking resumes once publishedVersionId is set.
    if (publishedVersionIdRef.current == null) return
    _setPendingChangeTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      pendingChangeTagsRef.current = next
      return next
    })
  }, [])
  const setPendingChangeTags = useCallback((tags: string[]) => {
    pendingChangeTagsRef.current = tags
    // Reset the arrival baseline so the toast condition stays correct after
    // a Save Version or Publish clears the tag list mid-visit.
    tagsCountOnTabArrivalRef.current = tags.length
    _setPendingChangeTags(tags)
  }, [])

  const registerVersionRestoreCallback = useCallback(
    (fn: ((version: PersonaVersionResponse) => void) | null) => {
      versionRestoreCallbackRef.current = fn
    },
    [],
  )

  useEffect(() => {
    if (!versionsOpen) return
    const repoId = infoRef.current.repoId
    if (!repoId) return
    setVersionsLoading(true)
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5),
      ))
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [versionsOpen])

  const refreshVersions = useCallback(() => {
    const repoId = infoRef.current.repoId
    if (!repoId) return
    // Mark panels unlocked — refreshVersions is called after every explicit Save version action.
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(`persona_configure_saved_${repoId}`, '1') } catch { /* ignore */ }
    }
    setPanelsUnlocked(true)
    listVersions(repoId)
      .then(v => setVersions(
        v.slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5),
      ))
      .catch(() => {})
  }, [])

  const handleRestoreVersion = useCallback(async (targetId: string) => {
    const repoId = infoRef.current.repoId
    if (!repoId || restoringRef.current) return
    restoringRef.current = true
    setRestoringId(targetId)
    try {
      const full = await getVersion(repoId, targetId)
      // Make the restored version the repo's working version on the backend.
      await setActiveVersion(repoId, targetId)
      setActiveVersionId(targetId)
      bustPersonasCache()
      // Update URL without navigating — use router.replace so useSearchParams updates in tabs
      const params = new URLSearchParams(window.location.search)
      params.set('versionId', targetId)
      replace(`${window.location.pathname}?${params.toString()}`)
      // Update shared guide prompt
      updatePersonaInfo({ versionId: targetId, guidePrompt: full.prompt ?? '' })
      // Reorder versions list
      setVersions(prev => {
        const target = prev.find(x => x.id === targetId)
        if (!target) return prev
        return [target, ...prev.filter(x => x.id !== targetId)]
      })
      // Delegate page-specific side effects (editor update, model switch, etc.)
      if (versionRestoreCallbackRef.current) {
        versionRestoreCallbackRef.current(full)
        toast.success('Version restored — it is now the working version')
      } else {
        // Not on Instructions tab — navigate there so the editor picks up the restore
        toast.success('Version restored — it is now the working version')
        push(AGENT_CONFIGURE_INSTRUCTIONS_ROUTE(repoId, { versionId: targetId }))
      }
    } catch {
      toast.error('Failed to restore version')
    } finally {
      restoringRef.current = false
      setRestoringId(null)
    }
  }, [push, replace, updatePersonaInfo])

  // ── Context value ───────────────────────────────────────────────────────────

  const value: PersonaConfigureContextValue = {
    personaInfo,
    updatePersonaInfo,

    helpOpen,
    setHelpOpen,
    helpActiveId,
    setHelpActiveId,

    knowledgeFileCount,
    setKnowledgeFileCount,
    hasShareLink,
    setHasShareLink,

    registerAutoSave,
    registerContinueHandler,
    invokeTabContinue,

    activeVersionId,
    publishedVersionId,
    refreshActiveVersion,
    markPublished,

    needsRepublish,
    setNeedsRepublish,
    leaveConfirmHref,
    setLeaveConfirmHref,
    safeNavigate,
    safeBack,
    hasPublishAndLeave,
    setOnPublishAndLeave,
    handlePublishAndLeave,

    testChatOpen,
    testChatExpanded,
    aiSuggestOpen,
    guideExpanded,
    versionsOpen,
    anyPanelOpen,
    panelsLocked,
    changesTrackerOpen,
    touchedFieldsByTab,

    toggleTestChat,
    toggleAiSuggest,
    toggleVersions,
    toggleChangesTracker,
    markFieldTouched,
    resetTouchedFields,
    setTestChatOpen,
    setTestChatExpanded,
    setGuideExpanded,
    setVersionsOpen,
    setAiSuggestOpen,

    guideMessages,
    guideIsStreaming,
    guideScrollRef,
    handleGuideSend,

    chatMessages,
    isStreaming,
    chatScrollRef,
    handleTestChatSend,
    testChatWebSearch,
    testChatStyleId,
    testChatFolders,
    testChatPersonaId,
    testChatAttachments,
    setTestChatWebSearch,
    setTestChatStyleId,
    setTestChatFolders,
    setTestChatPersonaId,
    setTestChatAttachments,
    handleTestChatAddFiles,
    handleTestChatFileChange,
    handleTestChatFilePaste,
    testChatFileInputRef,
    FILE_ACCEPT,

    versions,
    versionsLoading,
    restoringId,
    handleRestoreVersion,
    refreshVersions,
    registerVersionRestoreCallback,

    pendingChangeTags,
    addPendingChangeTag,
    setPendingChangeTags,

    tabDirtyFlags,
    setTabDirty,
    tabAutoSavedFlags,
    setTabAutoSaved,
  }

  return (
    <PersonaConfigureContext.Provider value={value}>
      {children}
    </PersonaConfigureContext.Provider>
  )
}

// ── Public provider (wraps inner in Suspense for useSearchParams) ─────────────

export function PersonaConfigureProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PersonaConfigureProviderInner>{children}</PersonaConfigureProviderInner>
    </Suspense>
  )
}
