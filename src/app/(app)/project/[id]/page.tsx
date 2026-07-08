'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowDownOneIcon, FolderOneIcon, MoreVerticalIcon, ShareOneIcon, SettingsOneIcon, PinIcon, GlobalSearchIcon, QuillWriteTwoIcon, UserIcon, InformationCircleIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
import { useProjectPanel } from '@/context/project-panel-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { useFileUpload } from '@/hooks/use-file-upload'
import { ProjectChatRow, ProjectChatEmptyRow } from '@/components/ProjectChatRow'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { ProjectTeamPanel } from '@/components/ProjectTeamPanel'
import { TeamChip } from '@/components/TeamChip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs'
import { setProjectVisibility } from '@/lib/api/projects'
import { setChatVisibility, listChats } from '@/lib/api/chat'
import { listSharedWithMe, forkChatShare, type SharedChatItem } from '@/lib/api/chat-shares'
import { useOrg } from '@/context/org-context'
import { PROJECT_CHAT_NEW_ROUTE, PROJECT_CHAT_ROUTE, PROJECTS_ROUTE, CHAT_SHARE_ROUTE } from '@/lib/routes'
import { AlertCircleIcon } from '@strange-huge/icons'
import type { Chat } from '@/types/chat'
import { EditProjectModal } from '@/components/EditProjectModal'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import type { PinFolder } from '@/lib/api/pins'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { LlmIcon } from '@strange-huge/icons/llm'
import { getModelLlmId } from '@/lib/model-icons'
import Image from 'next/image'
import { fetchPersonas, personasForTeamContext, usePersonaRepoDeduped } from '@/lib/api/personas'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { Tooltip } from '@/components/Tooltip'

// ── Page ───────────────────────────────────────────────────────────────────────

// Team-project chat tabs (private projects render a flat list instead).
// 4 distinct, independently-filterable tabs in one row; a single info
// button right after them explains what each of the four covers.
type TeamTab = 'personal' | 'publish' | 'shared' | 'view-only'

const tabsRowStyle: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        8,
  padding:    '0 4px',
}

// Divider between each line in the "about these tabs" tooltip — light on the
// tooltip's dark neutral-700→900 background (see semantic.css --tooltip-bg-*).
const tooltipDividerStyle: React.CSSProperties = {
  height:          1,
  backgroundColor: 'rgba(255,255,255,0.15)',
}

export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const { push }  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, loadProject, uploadFiles, removeFile, removeChat, renameChat, loadProjectChats, addChat, loading: projectsLoading } = useProjects()
  const { pins, isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const { setPanel: setProjectPanel } = useProjectPanel()
  const chatHistory = useChatHistoryContext()
  const { open: openModelSelector, setPersonaActive, museActive, museAdvanced, selectedModel, personaActive, isOpen: modelSelectorOpen } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()
  const modelLlmId = museActive ? null : getModelLlmId(selectedModel?.companyName, selectedModel?.modelName)

  const { orgId, caps, members, currentUserRole, teams: orgTeams } = useOrg()
  const project = getProject(params.id)
  const chats   = getChats(params.id)

  useEffect(() => {
    setProjectLoading(true)
    Promise.all([
      loadProject(params.id),
      loadProjectChats(params.id),
    ]).finally(() => setProjectLoading(false))
  }, [params.id, loadProject, loadProjectChats])

  const [menuOpen,         setMenuOpen]         = useState(false)
  const [editOpen,         setEditOpen]         = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [chatInputValue,   setChatInputValue]   = useState('')
  const [panelOpen,        setPanelOpen]        = useState(true)
  const [teamPanelOpen,    setTeamPanelOpen]    = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [selectedStyleId,  setSelectedStyleId]  = useState<string | null>(null)
  const [styleChipOpen,    setStyleChipOpen]    = useState(false)
  const [selectedFolders,  setSelectedFolders]  = useState<PinFolder[]>([])
  const [selectedPersona,      setSelectedPersona]      = useState<SelectedPersonaInfo | null>(null)
  const [personaChipOpen,      setPersonaChipOpen]      = useState(false)
  const [chipPersonas,         setChipPersonas]         = useState<SelectedPersonaInfo[]>([])
  const [loadingChipPersonas,  setLoadingChipPersonas]  = useState(false)
  const teamPersonaCopyCache = useRef<Map<string, SelectedPersonaInfo>>(new Map())
  const [newChatAttachments,   setNewChatAttachments]   = useState<PendingAttachment[]>([])
  const [pendingFiles,     setPendingFiles]     = useState<File[]>([])
  const [projectLoading,   setProjectLoading]   = useState(true)
  const [shareOpen,        setShareOpen]        = useState(false)
  const [shareTeamId,      setShareTeamId]      = useState('')
  const [shareVisibility,  setShareVisibility]  = useState<'private' | 'team'>('private')
  const [shareTeamsOpen,   setShareTeamsOpen]   = useState(false)
  const [sharingSaving,    setSharingSaving]    = useState(false)
  const [activeTab,        setActiveTab]        = useState<TeamTab>('personal')
  const [teamChats,        setTeamChats]        = useState<Chat[]>([])
  const [sharedItems,      setSharedItems]      = useState<SharedChatItem[]>([])
  const [sharedLoading,    setSharedLoading]    = useState(false)
  const [sharedError,      setSharedError]      = useState<string | null>(null)
  const [forkingShareId,   setForkingShareId]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)

    const teamId = project?.teamId ?? null
    const needsCopy = Boolean(teamId) && currentUserRole !== 'admin'
    let cancelled = false

    async function loadChipPersonas() {
      const list = await fetchPersonas()
      if (cancelled) return
      const teamPersonas = personasForTeamContext(list, teamId)

      if (!needsCopy) {
        setChipPersonas(teamPersonas.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null })))
        return
      }

      const resolved = await Promise.all(teamPersonas.map(async p => {
        const base: SelectedPersonaInfo = { id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }
        if (p.visibility !== 'team') return base
        const cached = teamPersonaCopyCache.current.get(p.id)
        if (cached) return cached
        try {
          const copy = await usePersonaRepoDeduped(p.id)
          const v = copy.published_version ?? copy.active_version
          const info: SelectedPersonaInfo = {
            id: copy.id,
            name: p.name,
            imageUrl: v?.image_url ?? p.imageUrl,
            modelId: v?.model_id ?? p.modelId,
            activeVersionId: copy.published_version_id ?? null,
            systemPrompt: null,
            temperature: v?.temperature ?? p.temperature,
          }
          teamPersonaCopyCache.current.set(p.id, info)
          return info
        } catch {
          return base
        }
      }))
      if (!cancelled) setChipPersonas(resolved)
    }

    loadChipPersonas()
      .catch(() => { if (!cancelled) setChipPersonas([]) })
      .finally(() => { if (!cancelled) setLoadingChipPersonas(false) })
    return () => { cancelled = true }
  }, [personaChipOpen, project?.teamId, currentUserRole])

  // Team projects source their chat list from the global /chats endpoint
  // (which carries visibility/team_id/pins_count), filtered to this project.
  // "Your chats" = all of these; "Publish to team" = the visibility==='team'
  // subset. Private projects keep useProjects().getChats() (see render).
  useEffect(() => {
    if (!project?.teamId) { setTeamChats([]); return }
    let cancelled = false
    ;(async () => {
      const collected: Chat[] = []
      let cursor: string | undefined
      // Page through; cap to avoid an unbounded loop on a misbehaving cursor.
      for (let page = 0; page < 20; page++) {
        const { chats: batch, next_cursor, has_more } = await listChats(cursor)
        collected.push(...batch)
        if (!has_more || !next_cursor) break
        cursor = next_cursor
      }
      if (!cancelled) setTeamChats(collected.filter(c => c.project_id === params.id))
    })().catch(() => { if (!cancelled) setTeamChats([]) })
    return () => { cancelled = true }
  }, [project?.teamId, params.id])

  // Lazy-load chats shared with me (editable → "Shared with you", read-only →
  // "View only"), scoped to this project, when either tab first opens.
  useEffect(() => {
    if (activeTab !== 'shared' && activeTab !== 'view-only') return
    let cancelled = false
    setSharedLoading(true)
    setSharedError(null)
    listSharedWithMe()
      .then(items => {
        if (cancelled) return
        setSharedItems(items.filter(i => i.targetProjectId === params.id))
      })
      .catch(err => { if (!cancelled) setSharedError(err instanceof Error ? err.message : 'Failed to load shared chats') })
      .finally(() => { if (!cancelled) setSharedLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, params.id])

  // Lock the model selector context while an agent chip is active on the project page.
  useEffect(() => {
    setPersonaActive(!!selectedPersona)
  }, [selectedPersona, setPersonaActive])

  // Hand the Instructions/Files/Team panel to AppLayout's shared slot so it
  // renders as its own flex sibling (like Pinboard) instead of living inside
  // this page's own rounded content border. Cleared on close and on unmount
  // so it never lingers after navigating away.
  useEffect(() => {
    if (!project || (!panelOpen && !teamPanelOpen)) {
      setProjectPanel(null)
      return
    }
    if (panelOpen) {
      setProjectPanel({
        title:   'Instructions & Files',
        onClose: () => setPanelOpen(false),
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   12,
                lineHeight: '16px',
                color:      'var(--neutral-500)',
                margin:     '-6px 0 0',
              }}
            >
              Instructions are included as part of the context for every chat in this project.
            </p>
            <ProjectInstructionsPanel
              value={project.instructions}
              onSave={project.canEdit ? (text) => updateProject(project.id, { instructions: text }) : undefined}
              onOpenEditor={project.canEdit ? () => setInstructionsOpen(true) : undefined}
            />
            <ProjectFilesPanel
              files={project.files}
              pendingFiles={pendingFiles}
              usedBytes={project.files.reduce((s, f) => s + f.sizeBytes, 0)}
              totalBytes={100 * 1024 * 1024}
              onUpload={project.canEdit ? async (fileList) => {
                const files = Array.from(fileList)
                setPendingFiles(files)
                try {
                  await uploadFiles(project.id, files)
                  toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`)
                } catch {
                  // errors already toasted by the context
                } finally {
                  setPendingFiles([])
                }
              } : undefined}
              onRemove={project.canEdit ? (fileId) => removeFile(project.id, fileId) : undefined}
            />
          </div>
        ),
      })
      return
    }
    if (teamPanelOpen && project.teamId) {
      setProjectPanel({
        title:   'Team',
        onClose: () => setTeamPanelOpen(false),
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   12,
                lineHeight: '16px',
                color:      'var(--neutral-500)',
                margin:     '-6px 0 0',
              }}
            >
              Everyone on this project&apos;s team, and the agents shared with it.
            </p>
            <ProjectTeamPanel
              teamId={project.teamId}
              projectId={project.id}
              ownerUserId={project.ownerUserId}
              canEdit={project.canEdit}
            />
          </div>
        ),
      })
    }
  }, [project, panelOpen, teamPanelOpen, pendingFiles, setProjectPanel, updateProject, uploadFiles, removeFile])

  useEffect(() => () => setProjectPanel(null), [setProjectPanel])

  if (!project) {
    if (projectsLoading || projectLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Loading…</p>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Project not found.</p>
      </div>
    )
  }

  const projectId = project.id

  function handleModelClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (selectedPersona) return
    openModelSelector(e.currentTarget)
  }

  function handleSendChat(text: string) {
    if (!text.trim() && !newChatAttachments.length) return
    if (selectedPersona) {
      sessionStorage.setItem('project-chat-pending-persona', JSON.stringify(selectedPersona))
    } else {
      sessionStorage.removeItem('project-chat-pending-persona')
    }
    if (newChatAttachments.length > 0) {
      ;(window as any).__pendingProjectChatFiles = newChatAttachments.map(a => a.file)
      setNewChatAttachments([])
    }
    const q = text.trim()
    push(PROJECT_CHAT_NEW_ROUTE(projectId) + (q ? `?q=${encodeURIComponent(q)}` : ''))
    setChatInputValue('')
  }

  function handleOpenShare() {
    setShareVisibility(project?.teamId ? 'team' : 'private')
    setShareTeamId(project?.teamId ?? '')
    setShareTeamsOpen(false)
    setShareOpen(true)
  }

  async function handleSaveVisibility() {
    setSharingSaving(true)
    try {
      await setProjectVisibility(projectId, shareVisibility, shareVisibility === 'team' ? shareTeamId : undefined)
      await loadProject(projectId)
      toast.success('Project visibility updated')
      setShareOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update visibility')
    } finally {
      setSharingSaving(false)
    }
  }

  // Publish / unpublish a single chat to the project's team. Optimistic — the
  // row's "Published" badge follows `teamChats`; revert on failure.
  async function handlePublishToggle(chatId: string, next: boolean) {
    const teamId = project?.teamId
    setTeamChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: next ? 'team' : 'private' } : c))
    try {
      await setChatVisibility(chatId, next ? 'team' : 'private', next ? teamId ?? undefined : undefined)
      toast.success(next ? 'Chat published to team' : 'Chat unpublished from team')
    } catch (err) {
      setTeamChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: next ? 'private' : 'team' } : c))
      toast.error(err instanceof Error ? err.message : 'Failed to update chat')
    }
  }

  // Fork a chat shared with me into my own workspace. If a fork already
  // exists, reuse it instead of creating a duplicate — forkChatShare itself
  // is idempotent per share+user, so this is safe to call repeatedly.
  // forkChatShare hands back a bare, project-less chat, so it must be linked
  // into this project (addChat) — otherwise the chat page's local chats-list
  // lookup can't find it and renders "Chat not found." It's also pushed into
  // `teamChats` directly so the "Personal" tab on *this* page updates without
  // waiting on a refetch — addChat only reaches the sidebar/other pages via
  // the shared projects context.
  async function copySharedChat(item: SharedChatItem, opts: { navigate: boolean }) {
    if (item.forkedChatId) {
      addChat(projectId, item.forkedChatId, item.chatTitle)
      if (opts.navigate) push(PROJECT_CHAT_ROUTE(projectId, item.forkedChatId))
      else toast.success('Chat copied to your personal chats')
      return
    }
    setForkingShareId(item.shareId)
    try {
      const { chatId } = await forkChatShare(item.shareId)
      const now = new Date().toISOString()
      addChat(projectId, chatId, item.chatTitle)
      setTeamChats(prev => [
        { id: chatId, can_edit: true, visibility: 'private', title: item.chatTitle, created_at: now, updated_at: now, starred: false, project_id: projectId },
        ...prev.filter(c => c.id !== chatId),
      ])
      toast.success(opts.navigate ? 'Chat forked to your workspace' : 'Chat copied to your personal chats')
      if (opts.navigate) push(PROJECT_CHAT_ROUTE(projectId, chatId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy chat')
    } finally {
      setForkingShareId(null)
    }
  }

  const projectTeam = project.teamId ? orgTeams.find(t => t.id === project.teamId) : undefined
  const ownerName   = members.find(m => m.id === project.ownerUserId)?.name
  // Publish CTA gate — editor+ on this team (owner/admin resolve true). Members
  // (and editors whose grants aren't loaded yet) get no publish affordance.
  const canPublishChat = !!project.teamId && caps.canPublishToTeam(project.teamId)

  // "Personal" is everything in this project you can see via the normal chat
  // list — your own chats AND published-to-team ones (blue badge marks which).
  // "Published to team" is just the filtered subset of the same list.
  const personalChats  = teamChats
  const publishedChats = teamChats.filter(c => c.visibility === 'team')
  // Most-recently-shared first — createdAt is the only recency signal the
  // shared-with-me API gives us, so make the ordering explicit rather than
  // leaning on the backend's own default sort.
  const sharedItemsSorted = [...sharedItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  // "Shared with you" is every share targeting this project, editable and
  // view-only alike (red badge marks the view-only ones). "View only" is
  // just the filtered subset of the same list.
  const sharedReadOnly = sharedItemsSorted.filter(i => i.mode === 'read_only')

  // A chat row for the team-project tab (Personal / Published to team).
  function teamChatRow(chat: Chat) {
    return (
      <ProjectChatRow
        key={chat.id}
        title={chat.title}
        timestamp="Just now"
        pinCount={chat.pins_count ?? 0}
        canPublish={canPublishChat}
        published={chat.visibility === 'team'}
        onPublishToggle={(next) => void handlePublishToggle(chat.id, next)}
        onChatClick={() => push(PROJECT_CHAT_ROUTE(projectId, chat.id))}
        onPinsClick={() => togglePinboard()}
        onRename={chat.can_edit ? (newTitle) => {
          void chatHistory.rename(chat.id, newTitle)
          setTeamChats(prev => prev.map(c => c.id === chat.id ? { ...c, title: newTitle } : c))
        } : undefined}
        onDelete={chat.can_edit ? () => {
          removeChat(projectId, chat.id)
          setTeamChats(prev => prev.filter(c => c.id !== chat.id))
        } : undefined}
      />
    )
  }

  // A row for the "Shared with you" / "View only" tabs. Editable shares open
  // (forking first if needed) on click, and offer "Create a copy" from the
  // ⋮ menu to duplicate into Personal without leaving this page. View-only
  // shares open the read-only viewer instead and get no menu at all.
  function sharedChatRow(item: SharedChatItem) {
    const readOnly = item.mode === 'read_only'
    return (
      <div key={item.shareId} style={{ display: 'flex', flexDirection: 'column' }}>
        <ProjectChatRow
          title={item.chatTitle}
          timestamp={readOnly ? '' : (item.forkedChatId ? 'Forked · editable' : 'Editable')}
          author={item.sharedByName ?? undefined}
          pinCount={0}
          readOnly={readOnly}
          onChatClick={() => {
            if (readOnly) { push(CHAT_SHARE_ROUTE(item.shareId)); return }
            if (forkingShareId !== item.shareId) void copySharedChat(item, { navigate: true })
          }}
          onCreateCopy={readOnly ? undefined : () => {
            if (forkingShareId !== item.shareId) void copySharedChat(item, { navigate: false })
          }}
        />
        {readOnly && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 16px 10px', marginTop: -2 }}>
            <AlertCircleIcon size={14} color="var(--neutral-400)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)' }}>
              This is a copy of the chat between Souvenir and {item.sharedByName ?? 'a teammate'}. Content may include unverified information. Shared snapshot may not contain all attachments.
            </span>
          </div>
        )}
      </div>
    )
  }

  // Private projects keep the flat list, sourced from useProjects().
  const privateChatList = chats.length === 0 ? (
    <ProjectChatEmptyRow />
  ) : (
    chats.map((chat) => (
      <ProjectChatRow
        key={chat.id}
        title={chat.title}
        timestamp="Just now"
        pinCount={pins.filter(p => p.chatId === chat.id).length}
        onChatClick={() => push(PROJECT_CHAT_ROUTE(projectId, chat.id))}
        onPinsClick={() => togglePinboard()}
        onRename={chat.canEdit ? (newTitle) => {
          renameChat(projectId, chat.id, newTitle)
          void chatHistory.rename(chat.id, newTitle)
        } : undefined}
        onDelete={chat.canEdit ? () => removeChat(projectId, chat.id) : undefined}
      />
    ))
  )

  // Loading / error / empty notice shared by the "Shared with you" and
  // "View only" tabs. Returns null when there's real content to render.
  function sharedNotice(items: SharedChatItem[], emptyText: string): React.ReactNode | null {
    if (sharedLoading) {
      return <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', padding: '12px 4px', margin: 0 }}>Loading shared chats…</p>
    }
    if (sharedError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--red-600, #b83c3c)' }}>
          <AlertCircleIcon size={16} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>{sharedError}</span>
        </div>
      )
    }
    if (items.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--neutral-500)' }}>
          <AlertCircleIcon size={16} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>{emptyText}</span>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Back button - anchored in the TopBar zone, top-left */}
      <button
        onClick={() => push(PROJECTS_ROUTE)}
        style={{
          position:     'absolute',
          top:          26,
          left:         8,
          zIndex:       10,
          display:      'flex',
          alignItems:   'center',
          background:   'transparent',
          border:       'none',
          cursor:       'pointer',
          padding:      '8px',
          borderRadius: '10px',
          flexShrink:   0,
        }}
        aria-label="Back to Projects"
      >
        <ArrowLeftOneIcon style={{ width: 20, height: 20, color: '#524b47' }} />
      </button>

      {/* Model selector - top-right, same row as back button */}
      <div style={{ position: 'absolute', top: 26, right: 16, zIndex: 10 }}>
        <Button
          variant="default"
          size="sm"
          rightIcon={<ArrowDownOneIcon />}
          onClick={(e) => {
            if (personaActive) {
              toast.info('Model locked to agent', {
                description: "This chat uses the agent's model. Remove the agent chip to unlock model selection.",
              })
              return
            }
            openModelSelector(e.currentTarget)
          }}
          aria-haspopup="listbox"
          aria-expanded={modelSelectorOpen && !personaActive}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: personaActive ? 'var(--button-default-text-disabled)' : undefined }}>
            {(museActive || modelLlmId) && (
              <span style={{ width: 16, height: 16, borderRadius: 4, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {museActive
                  ? <Image src="/icons/souvenir-logo-white.svg" width={16} height={16} alt="" unoptimized style={{ display: 'block' }} />
                  : <LlmIcon id={modelLlmId!} variant={modelLlmId === 'OpenAI' ? 'color' : 'avatar'} size={16} style={modelLlmId === 'OpenAI' ? { filter: 'brightness(0) invert(1)' } : undefined} />
                }
              </span>
            )}
            {modelButtonLabel ?? 'Souvenir AI · Muse'}
          </span>
        </Button>
      </div>

      {/* ── Left column - fixed header + scrollable chat list ─────────── */}
      <div
        style={{
          flex:      '1 0 0',
          minWidth:  0,
          height:    '100%',
          overflow:  'hidden',
          display:   'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            padding:       '87px 24px 40px',
            boxSizing:     'border-box',
            gap:           '12px',
            height:        '100%',
          }}
        >
          {/* Title section */}
          <div style={{ width: '100%', maxWidth: '679px', marginBottom: '27px', flexShrink: 0 }}>
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   '5px',
              }}
            >
              <h1
                style={{
                  flex:         '1 0 0',
                  minWidth:     0,
                  fontFamily:   'var(--font-title)',
                  fontWeight:   'var(--font-weight-regular)',
                  fontSize:     '24px',
                  lineHeight:   '32px',
                  color:        '#3b3632',
                  margin:       0,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {project.name}
              </h1>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                {project.canEdit && <Dropdown.Float
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  placement="bottom-end"
                  trigger={
                    <IconButton
                      variant="secondary"
                      size="md"
                      icon={<MoreVerticalIcon triggered={menuOpen} />}
                      aria-label="Project options"
                    />
                  }
                >
                  <Dropdown size="md">
                    <Dropdown.Section fluid>
                      <Dropdown.Item
                        label="Edit"
                        onClick={() => { setMenuOpen(false); setEditOpen(true) }}
                        fluid
                      />
                      <Dropdown.Item
                        label="Archive"
                        disabled
                        fluid
                      />
                    </Dropdown.Section>
                    <Dropdown.Section divider fluid>
                      <Dropdown.Item
                        label="Delete"
                        variant="danger"
                        onClick={() => { setMenuOpen(false); deleteProject(projectId).then(() => push(PROJECTS_ROUTE)) }}
                        fluid
                      />
                    </Dropdown.Section>
                  </Dropdown>
                </Dropdown.Float>}

                {project.canManageVisibility && <Button
                  variant="outline"
                  size="md"
                  rightIcon={<ShareOneIcon size={16} />}
                  onClick={handleOpenShare}
                >
                  Share
                </Button>}
              </div>
            </div>

            {project.teamId && (projectTeam || ownerName) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: project.description ? 6 : 0 }}>
                {ownerName && (
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                    Created by {ownerName}
                  </span>
                )}
                {ownerName && projectTeam && (
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-300)' }}>·</span>
                )}
                {projectTeam && <TeamChip teamName={projectTeam.name} size="sm" />}
              </div>
            )}

            {project.description && (
              <p
                style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-regular)',
                  fontSize:     '16px',
                  lineHeight:   '22px',
                  color:        '#1a1714',
                  margin:       0,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {project.description}
              </p>
            )}
          </div>

          {/* Chat input */}
          <div style={{ width: '100%', maxWidth: '679px', flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const files = Array.from(e.target.files)
                  setNewChatAttachments(prev => processFiles(files, prev))
                  e.target.value = ''
                }
              }}
              style={{ display: 'none' }}
              aria-hidden
            />
            <ChatInput
              placeholder="Ask anything, or use your voice..."
              value={chatInputValue}
              onChange={setChatInputValue}
              onSend={handleSendChat}
              onFilePaste={(files) => setNewChatAttachments((prev) => processFiles(files, prev))}
              hasAttachments={newChatAttachments.length > 0}
              modelName={modelButtonLabel}
              onModelClick={selectedPersona ? undefined : handleModelClick}
              modelMenu={selectedPersona ? undefined : <ModelMenu />}
              disabledModelSelector={!!selectedPersona}
              addMenu={
                <ChatAddMenu
                  webSearchEnabled={webSearchEnabled}
                  onWebSearchChange={setWebSearchEnabled}
                  onAddFilesClick={() => fileInputRef.current?.click()}
                  selectedStyleId={selectedStyleId}
                  onStyleChange={setSelectedStyleId}
                  selectedFolders={selectedFolders}
                  onFolderToggle={(folder) => setSelectedFolders(prev =>
                    prev.some(f => f.id === folder.id) ? prev.filter(f => f.id !== folder.id) : [...prev, folder]
                  )}
                  selectedPersonaId={selectedPersona?.id ?? null}
                  onPersonaChange={setSelectedPersona}
                  teamId={project.teamId ?? null}
                />
              }
              chips={
                <>
                  {(USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId)) && (
                    <Dropdown.Float
                      open={styleChipOpen}
                      onOpenChange={setStyleChipOpen}
                      placement="top-start"
                      trigger={
                        <Chip
                          label={USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId)!.label}
                          icon={<QuillWriteTwoIcon size={20} color="var(--chip-text)" />}
                          onRemove={() => setSelectedStyleId(null)}
                          onExpand={() => setStyleChipOpen(v => !v)}
                        />
                      }
                    >
                      <Dropdown size="md">
                        <Dropdown.Section fluid>
                          {USE_STYLE_OPTIONS.map(opt => (
                            <Dropdown.Item
                              key={opt.id}
                              label={opt.label}
                              subLabel={opt.subLabel}
                              selected={opt.id === 'none' ? selectedStyleId === null : selectedStyleId === opt.id}
                              onClick={() => { setSelectedStyleId(opt.id === 'none' ? null : opt.id); setStyleChipOpen(false) }}
                              fluid
                            />
                          ))}
                        </Dropdown.Section>
                      </Dropdown>
                    </Dropdown.Float>
                  )}
                  {selectedFolders.map(folder => (
                    <Chip
                      key={folder.id}
                      label={folder.name}
                      icon={<FolderOneIcon size={20} color="var(--chip-text)" variant="static" />}
                      onRemove={() => setSelectedFolders(prev => prev.filter(f => f.id !== folder.id))}
                    />
                  ))}
                  {webSearchEnabled && (
                    <Chip
                      size="Medium"
                      icon={<GlobalSearchIcon size={20} color="var(--chip-text)" />}
                      label="Web search"
                      onRemove={() => setWebSearchEnabled(false)}
                    />
                  )}
                  {selectedPersona && (
                    <Dropdown.Float
                      open={personaChipOpen}
                      onOpenChange={setPersonaChipOpen}
                      placement="top-start"
                      trigger={
                        <Chip
                          label={selectedPersona.name}
                          personaImage={selectedPersona.imageUrl ?? undefined}
                          onRemove={() => setSelectedPersona(null)}
                          onExpand={() => setPersonaChipOpen(v => !v)}
                          title={undefined}
                          style={undefined}
                        />
                      }
                    >
                      <Dropdown size="md" style={{ minWidth: 200 }} maxHeight="min(280px, calc(100dvh - 120px))">
                        <Dropdown.Section fluid>
                          {loadingChipPersonas
                            ? <Dropdown.Item label="Loading…" fluid disabled />
                            : chipPersonas.length > 0
                              ? chipPersonas.map(p => (
                                  <Dropdown.Item
                                    key={p.id}
                                    label={p.name}
                                    fluid
                                    selected={selectedPersona.id === p.id}
                                    onClick={() => { setSelectedPersona(p); setPersonaChipOpen(false) }}
                                  />
                                ))
                              : <Dropdown.Item label={project.teamId ? 'No shared team agents' : 'No agents yet'} fluid disabled />
                          }
                        </Dropdown.Section>
                      </Dropdown>
                    </Dropdown.Float>
                  )}
                </>
              }
              attachmentsSlot={
                <AttachmentManager
                  attachments={newChatAttachments}
                  onAttachmentsChange={setNewChatAttachments}
                />
              }
            />
          </div>

          {/* Chat list — 4 tabs on team projects (grouped in 2 labeled pairs), flat list on private */}
          {project.teamId ? (
            <div style={{ width: '100%', maxWidth: '679px', flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as TeamTab)}
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}
              >
                {/* All 4 tabs in one row; the info button explains what each covers. */}
                <div style={tabsRowStyle}>
                  <TabsList>
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                    <TabsTrigger value="publish">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        Published to team
                        {publishedChats.length > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                            backgroundColor: 'var(--blue-100)', fontFamily: 'var(--font-body)',
                            fontWeight: 600, fontSize: 9, color: 'var(--blue-700)', flexShrink: 0,
                          }}>
                            {publishedChats.length}
                          </span>
                        )}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="shared">Shared with you</TabsTrigger>
                    <TabsTrigger value="view-only">View only</TabsTrigger>
                  </TabsList>

                  <Tooltip
                    side="left"
                    maxWidth={280}
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div><b>Personal</b> — your own chats here, plus what&apos;s published to the team.</div>
                        <div style={tooltipDividerStyle} />
                        <div><b>Published to team</b> — just the chats published to the team.</div>
                        <div style={tooltipDividerStyle} />
                        <div><b>Shared with you</b> — chats teammates shared directly, editable and view-only.</div>
                        <div style={tooltipDividerStyle} />
                        <div><b>View only</b> — just the view-only shares; you can copy, not edit.</div>
                      </div>
                    }
                  >
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={<InformationCircleIcon size={18} />}
                      aria-label="About these tabs"
                    />
                  </Tooltip>
                </div>

                {/* Personal — everything in this project you can see: your own
                    chats plus published-to-team ones (blue "Published" badge). */}
                <TabsContent value="personal" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {personalChats.length === 0 ? <ProjectChatEmptyRow /> : personalChats.map(teamChatRow)}
                  </div>
                </TabsContent>

                {/* Published to team — the published-only subset, visible to and manageable by editor+ */}
                <TabsContent value="publish" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {publishedChats.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--neutral-500)' }}>
                        <AlertCircleIcon size={16} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
                          {canPublishChat ? 'Hover a chat under “Personal” to publish it to the team.' : 'No chats have been published to the team yet.'}
                        </span>
                      </div>
                    ) : publishedChats.map(teamChatRow)}
                  </div>
                </TabsContent>

                {/* Shared with you — editable AND view-only shares (red "View only"
                    badge marks the latter); click an editable one to fork it. */}
                <TabsContent value="shared" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {sharedNotice(sharedItemsSorted, 'No chats have been shared with you in this project yet.') ?? (
                      sharedItemsSorted.map(sharedChatRow)
                    )}
                  </div>
                </TabsContent>

                {/* View only — the view-only-only subset; open the shared view, no forking */}
                <TabsContent value="view-only" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {sharedNotice(sharedReadOnly, 'No view-only chats in this project yet.') ?? (
                      sharedReadOnly.map(sharedChatRow)
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div
              className="kaya-scrollbar"
              style={{ width: '100%', maxWidth: '679px', display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: 3 }}
            >
              {privateChatList}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating menu ─────────────────────────────────────────────── */}
      {/* The panel itself now renders as its own flex sibling in AppLayout
          (see project-panel-context) — same as Pinboard — so, like
          FloatingPanel's own toolbar, this never needs to shift for it: the
          rounded container already shrinks on its own when the sibling opens. */}
      <div
        style={{
          position:   'absolute',
          top:        '50%',
          right:      16,
          transform:  'translateY(-50%)',
          zIndex:     20,
        }}
      >
        <FloatingMenu aria-label="Project tools">
          <FloatingMenuItem
            icon={<SettingsOneIcon size={20} animated />}
            label="Instructions & Files"
            active={panelOpen}
            onClick={() => {
              if (!panelOpen) {
                closePinboard()
                setTeamPanelOpen(false)
              }
              setPanelOpen(v => !v)
            }}
          />
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pinboard"
            active={pinboardOpen}
            onClick={() => {
              if (!pinboardOpen) {
                setPanelOpen(false)
                setTeamPanelOpen(false)
              }
              togglePinboard()
            }}
          />
          {project.teamId && (
            <FloatingMenuItem
              icon={<UserIcon size={20} />}
              label="Team"
              active={teamPanelOpen}
              onClick={() => {
                if (!teamPanelOpen) {
                  closePinboard()
                  setPanelOpen(false)
                }
                setTeamPanelOpen(v => !v)
              }}
            />
          )}
        </FloatingMenu>
      </div>


      {/* ── Modals ───────────────────────────────────────────────────── */}
      {project.canEdit && <EditProjectModal
        open={editOpen}
        name={project.name}
        description={project.description}
        tags={project.tags}
        onSave={(name, description, tags) => updateProject(projectId, { name, description, tags })}
        onClose={() => setEditOpen(false)}
      />}

      {project.canEdit && <SystemInstructionsModal
        open={instructionsOpen}
        projectName={project.name}
        value={project.instructions}
        onSave={(text) => updateProject(projectId, { instructions: text })}
        onClose={() => setInstructionsOpen(false)}
      />}

      {/* ── Project share / visibility modal ─────────────────────────── */}
      {shareOpen && (
        <>
          <div
            onClick={() => setShareOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(18,12,8,0.4)', backdropFilter: 'blur(2px)', zIndex: 50 }}
          />
          <div
            style={{
              position:        'fixed',
              top:             '50%',
              left:            '50%',
              transform:       'translate(-50%, -50%)',
              zIndex:          51,
              width:           480,
              maxWidth:        'calc(100vw - 48px)',
              borderRadius:    16,
              backgroundColor: 'white',
              boxShadow:       '0px 8px 32px rgba(18,12,8,0.18), 0px 0px 0px 1px var(--neutral-100)',
              padding:         24,
              display:         'flex',
              flexDirection:   'column',
              gap:             16,
            }}
          >
            <div>
              <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                Share project
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                Control who can access this project.
              </p>
            </div>

            {(() => {
              const shareableTeams = orgTeams.filter(t => !t.archived)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%' }}>
                    <div style={{ flex: '1 0 0', minWidth: 0 }}>
                      <ModelFeaturedCard
                        title="Private"
                        description="Only you can see this project."
                        selected={shareVisibility === 'private'}
                        onSelectedChange={next => { if (next) setShareVisibility('private') }}
                        style={{ height: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: '1 0 0', minWidth: 0 }}>
                      <ModelFeaturedCard
                        title="Team"
                        description={shareableTeams.length === 0 ? 'No teams available' : 'Team editors and assigned members can access it.'}
                        selected={shareVisibility === 'team'}
                        onSelectedChange={next => { if (next && shareableTeams.length > 0) setShareVisibility('team') }}
                        style={{
                          height:    '100%',
                          boxSizing: 'border-box',
                          opacity:   shareableTeams.length === 0 ? 0.45 : 1,
                          cursor:    shareableTeams.length === 0 ? 'not-allowed' : 'pointer',
                        }}
                      />
                    </div>
                  </div>

                  {/* Team picker — its own row below the cards, not stacked on
                      top of the "Team" button, so the two controls stay
                      isolated: one picks the visibility, the other the team. */}
                  {shareVisibility === 'team' && shareableTeams.length > 0 && (
                    <Dropdown.Float
                      open={shareTeamsOpen}
                      onOpenChange={setShareTeamsOpen}
                      placement="bottom-start"
                      trigger={
                        <button
                          type="button"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                            width: '100%', padding: '10px 12px', borderRadius: 8,
                            border: '1px solid var(--neutral-200)', cursor: 'pointer',
                            backgroundColor: 'white',
                            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '20px',
                            color: shareTeamId ? 'var(--neutral-900)' : 'var(--neutral-500)',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {shareTeamId ? (shareableTeams.find(t => t.id === shareTeamId)?.name ?? 'Select team') : 'Select team'}
                          </span>
                          <div style={{ flexShrink: 0, lineHeight: 0, transform: shareTeamsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>
                            <ArrowDownOneIcon size={14} />
                          </div>
                        </button>
                      }
                    >
                      <Dropdown size="md">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                          {shareableTeams.map(team => {
                            const isSelected = team.id === shareTeamId
                            const select = () => { setShareTeamId(team.id); setShareTeamsOpen(false) }
                            return (
                              <div
                                key={team.id}
                                role="button"
                                tabIndex={0}
                                onClick={select}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select() } }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '8px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                                  backgroundColor: isSelected ? 'var(--neutral-100)' : 'transparent',
                                }}
                              >
                                <span style={{
                                  flex: '1 0 0', minWidth: 0,
                                  fontFamily: 'var(--font-body)', fontWeight: isSelected ? 600 : 400,
                                  fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {team.name}
                                </span>
                                {isSelected && <TickTwoIcon size={16} color="var(--blue-600, #0a7aff)" />}
                              </div>
                            )
                          })}
                        </div>
                        <p style={{ margin: '4px 8px 8px', fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)' }}>
                          The selected team&apos;s editors and assigned project members will have access.
                        </p>
                      </Dropdown>
                    </Dropdown.Float>
                  )}
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <Button variant="outline" size="sm" onClick={() => setShareOpen(false)}>Cancel</Button>
              <Button
                variant="default"
                size="sm"
                disabled={sharingSaving || (shareVisibility === 'team' && !shareTeamId)}
                onClick={() => void handleSaveVisibility()}
              >
                {sharingSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
