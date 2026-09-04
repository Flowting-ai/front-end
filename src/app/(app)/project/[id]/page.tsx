'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, ArrowDownOneIcon, FolderOneIcon, MoreVerticalIcon, ShareOneIcon, SettingsOneIcon, PinIcon, GlobalSearchIcon, QuillWriteTwoIcon, UserAiIcon, UserIcon, InformationCircleIcon, CancelOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { SouvenirModelIcon } from '@/components/SouvenirModelIcon'
import { Chip } from '@/components/Chip'
import { Badge } from '@/components/Badge'
import { ModelFeaturedCard } from '@/components/ModelFeaturedCard'
import { useProjects } from '@/context/projects-context'
import { useAuth } from '@/context/auth-context'
import { usePinboard } from '@/context/pinboard-context'
import { useProjectPanel } from '@/context/project-panel-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { pickDefaultModel } from '@/lib/ai-models'
import { formatRelativeTime } from '@/lib/utils/format-utils'
import { useWorkspaceCreditNotice } from '@/hooks/use-workspace-credit-notice'
import { InlineCreditNotice } from '@/components/InlineCreditNotice'
import { useFileUpload } from '@/hooks/use-file-upload'
import { ProjectChatRow, ProjectChatEmptyRow } from '@/components/ProjectChatRow'
import { Divider } from '@/components/Divider'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { AgentsPanelContent, AGENT_SELECT_EVENT } from '@/components/AgentsPanel'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs'
import { setProjectVisibility } from '@/lib/api/projects'
import { setChatVisibility, listChats } from '@/lib/api/chat'
import { listSharedWithMe, forkChatShare, type SharedChatItem } from '@/lib/api/chat-shares'
import { useOrg } from '@/context/org-context'
import { PROJECT_CHAT_NEW_ROUTE, PROJECT_CHAT_ROUTE, PROJECTS_ROUTE, CHAT_SHARE_ROUTE } from '@/lib/routes'
import { trackFeature } from '@/lib/analytics/events'
import { AlertCircleIcon } from '@strange-huge/icons'
import type { Chat } from '@/types/chat'
import { EditProjectModal } from '@/components/EditProjectModal'
import { LeaveProjectModal } from '@/components/LeaveProjectModal'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import type { PinFolder } from '@/lib/api/pins'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { resolveViewerUserId } from '@/lib/api/teams'
import { useSelectableChatPersonas } from '@/hooks/use-selectable-chat-personas'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { Tooltip } from '@/components/Tooltip'

// ── Page ───────────────────────────────────────────────────────────────────────

// Team-project chat tabs (private projects render a flat list instead).
// 4 distinct, independently-filterable tabs in one row; a single info
// button right after them explains what each of the four covers.
type TeamTab = 'personal' | 'publish' | 'shared'

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

// Row separation comes from a divider between items, not a per-row border —
// intersperses one before every row after the first.
function withDividers(rows: React.ReactNode[]): React.ReactNode[] {
  return rows.flatMap((row, i) => (i === 0 ? [row] : [<Divider key={`divider-${i}`} />, row]))
}

export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const { push }  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, loadProject, uploadFiles, removeFile, removeChat, renameChat, loadProjectChats, addChat, loading: projectsLoading, refreshProjects } = useProjects()
  const { pins, isLoading: pinsLoading, isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const { panel: sharedPanel, setPanel: setProjectPanel } = useProjectPanel()
  const chatHistory = useChatHistoryContext()
  const { open: openModelSelector, setPersonaActive, personaActive, museActive, selectedModel, models, selectModel } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()

  const { orgId, org, caps, members } = useOrg()
  const { status: creditNoticeStatus, isAdmin: isOrgAdmin, dismiss: dismissCreditNotice, goToPlans } = useWorkspaceCreditNotice()
  const { user } = useAuth()
  // `user?.id` is never populated by the backend's /users/me — resolve the
  // viewer's internal id via the org member list instead (see resolveViewerUserId).
  const viewerUserId = resolveViewerUserId(members, user?.email)
  const project = getProject(params.id)
  const chats   = getChats(params.id)
  // Only the project's original creator may take it back to Private — the
  // backend's set_resource_visibility rejects the PATCH with a 403 for
  // anyone else (a team editor/admin managing a teammate's project, say).
  // Hiding the option for non-owners avoids surfacing that 403 at all.
  const isProjectOwner = !!project && !!viewerUserId && String(project.ownerUserId) === String(viewerUserId)

  useEffect(() => {
    setProjectLoading(true)
    Promise.all([
      loadProject(params.id),
      loadProjectChats(params.id),
    ]).finally(() => setProjectLoading(false))
  }, [params.id, loadProject, loadProjectChats])

  const [menuOpen,         setMenuOpen]         = useState(false)
  const [editOpen,         setEditOpen]         = useState(false)
  const [leaveOpen,        setLeaveOpen]        = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [chatInputValue,   setChatInputValue]   = useState('')
  const [panelOpen,        setPanelOpen]        = useState(true)
  const [agentsPanelOpen,  setAgentsPanelOpen]  = useState(false)
  const [membersPanelOpen, setMembersPanelOpen] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [selectedStyleId,  setSelectedStyleId]  = useState<string | null>(null)
  const [styleChipOpen,    setStyleChipOpen]    = useState(false)
  const [selectedFolders,  setSelectedFolders]  = useState<PinFolder[]>([])
  const [selectedPersona,      setSelectedPersona]      = useState<SelectedPersonaInfo | null>(null)
  const [personaChipOpen,      setPersonaChipOpen]      = useState(false)
  const { personas: chipPersonas, loading: loadingChipPersonas } = useSelectableChatPersonas(personaChipOpen)
  const [newChatAttachments,   setNewChatAttachments]   = useState<PendingAttachment[]>([])
  const [pendingFiles,     setPendingFiles]     = useState<File[]>([])
  const [projectLoading,   setProjectLoading]   = useState(true)
  const [shareOpen,        setShareOpen]        = useState(false)
  const [shareVisibility,  setShareVisibility]  = useState<'private' | 'team'>('private')
  const [sharingSaving,    setSharingSaving]    = useState(false)
  const [activeTab,        setActiveTab]        = useState<TeamTab>('personal')
  const [teamChats,        setTeamChats]        = useState<Chat[]>([])
  const [sharedItems,      setSharedItems]      = useState<SharedChatItem[]>([])
  const [sharedLoading,    setSharedLoading]    = useState(false)
  const [sharedError,      setSharedError]      = useState<string | null>(null)
  const [forkingShareId,   setForkingShareId]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  // Workspace/Shared projects source their chat list from the global /chats
  // endpoint (which carries visibility/team_id/pins_count), filtered to this
  // project. "Your chats" = all of these; "Publish to team" = the
  // visibility==='team' subset. Personal projects keep useProjects().getChats()
  // (see render). Keyed on project.visibility, NOT project.teamId — the
  // backend stamps organizationId on org members' Personal projects too, so
  // teamId alone can't tell Personal apart from Workspace/Shared.
  useEffect(() => {
    if (!project || project.visibility === 'personal') { setTeamChats([]); return }
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
  }, [project?.visibility, params.id])

  // Lazy-load chats shared with me (editable → "Shared with you", read-only →
  // "View only"), scoped to this project, when either tab first opens.
  useEffect(() => {
    if (activeTab !== 'shared') return
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

  // This page is always a "start a new chat" surface — reset the global model
  // selection back to the default tier on arrival, same as the regular
  // chat page's blank-landing reset, so a model picked in a previous chat
  // doesn't silently carry over. Mount-only: doesn't touch whatever the user
  // explicitly picks afterward on this same page before sending.
  useEffect(() => {
    const defaultModel = pickDefaultModel(models)
    if (defaultModel) selectModel(defaultModel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // AgentsPanelContent (the same "Add agent" panel /chat uses) closes itself
  // by calling the shared setPanel(null) directly — it has no onClose prop to
  // hook into — so agentsPanelOpen can't just be reset from this page's own
  // onClose handlers alone. Re-sync it whenever the shared slot goes null out
  // from under us while we still think it's open, so the toggle button's
  // active state and the effect below (which re-derives content from these
  // booleans every render) don't end up fighting a panel that already closed.
  useEffect(() => {
    if (agentsPanelOpen && sharedPanel === null) setAgentsPanelOpen(false)
  }, [sharedPanel, agentsPanelOpen])

  // Listen for AgentsPanelContent's selection — same cross-tree pattern
  // /chat/page.tsx uses (the panel renders via the shared AppLayout tree,
  // outside this page's own component tree). No extra toast here, matching
  // /chat exactly — the panel closing and the chip appearing in the composer
  // is its own feedback.
  useEffect(() => {
    const handler = (e: Event) => {
      const persona = (e as CustomEvent<SelectedPersonaInfo>).detail
      if (persona) setSelectedPersona(persona)
    }
    window.addEventListener(AGENT_SELECT_EVENT, handler)
    return () => window.removeEventListener(AGENT_SELECT_EVENT, handler)
  }, [])

  // Hand the Instructions/Files/Team panel to AppLayout's shared slot so it
  // renders as its own flex sibling (like Pinboard) instead of living inside
  // this page's own rounded content border. Cleared on close and on unmount
  // so it never lingers after navigating away.
  useEffect(() => {
    if (!project || (!panelOpen && !agentsPanelOpen && !membersPanelOpen)) {
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
              editable={project.canEdit}
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
    if (agentsPanelOpen) {
      // Same panel /chat uses (AgentsPanelContent) — same search/filter/list/
      // footer, same AGENT_SELECT_EVENT selection mechanism (listened for
      // above), same sidePadding: 8 flush layout FloatingPanel.tsx gives it.
      setProjectPanel({
        title:       'Agents',
        onClose:     () => setAgentsPanelOpen(false),
        content:     <AgentsPanelContent />,
        sidePadding: 8,
      })
      return
    }
    if (membersPanelOpen) {
      setProjectPanel({
        title:       'Members',
        onClose:     () => setMembersPanelOpen(false),
        content:     <ProjectMembersPanel projectId={project.id} ownerUserId={project.ownerUserId} canManage={project.canEdit} />,
        // Same flush 8px layout as the sibling Agents panel — ProjectMembersPanel
        // no longer renders its own 24px-padded title/header internally.
        sidePadding: 8,
      })
    }
  }, [project, panelOpen, agentsPanelOpen, membersPanelOpen, pendingFiles, setProjectPanel, updateProject, uploadFiles, removeFile])

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

  // Org owners/admins can delete a colleague's shared project even though
  // they don't own it — see the matching note in projects-context.tsx's
  // deleteProject guardrail, which is the actual enforcement point.
  const canDeleteProject = project.canEdit || (isOrgAdmin && !!orgId && project.teamId === orgId)
  // Personal projects have no membership to leave (backend 400s) — leaving
  // applies to both the owner (triggers successor/archive/convert) and any
  // collaborator on a workspace/shared project.
  const canLeaveProject = project.visibility !== 'personal'
  const hasMenuActions = canDeleteProject || canLeaveProject

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
    setShareOpen(true)
  }

  // Dismiss without saving — X button, Cancel button, and clicking the
  // backdrop all count as "cancelled" and should say so.
  function handleCancelShare() {
    setShareOpen(false)
    toast.info('Visibility change cancelled')
  }

  async function handleSaveVisibility() {
    setSharingSaving(true)
    try {
      await setProjectVisibility(projectId, shareVisibility, shareVisibility === 'team' ? (orgId ?? undefined) : undefined)
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

  const ownerName   = members.find(m => m.id === project.ownerUserId)?.name
  // Publish CTA gate — editor+ on this team (owner/admin resolve true). Members
  // (and editors whose grants aren't loaded yet) get no publish affordance.
  // Gated on visibility, not just teamId — an org member's own Personal
  // project also carries the org's teamId, but there's no "team" to publish to.
  const canPublishChat = project.visibility !== 'personal' && !!project.teamId && caps.canPublishToTeam(project.teamId)

  // "Personal" is everything in this project you can see via the normal chat
  // list — your own chats AND published-to-workspace ones (blue badge marks which).
  // "Published to Workspace" is just the filtered subset of the same list.
  const personalChats  = teamChats
  const publishedChats = teamChats.filter(c => c.visibility === 'team')
  // Most-recently-shared first — createdAt is the only recency signal the
  // shared-with-me API gives us, so make the ordering explicit rather than
  // leaning on the backend's own default sort.
  const sharedItemsSorted = [...sharedItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  // "Shared with you" is every share targeting this project, editable and
  // view-only alike (red badge marks the view-only ones) — there's no
  // separate view-only-only tab any more, so this is the one place both show.

  // A chat row for the team-project tab (Personal / Published to Workspace).
  function teamChatRow(chat: Chat) {
    return (
      <ProjectChatRow
        key={chat.id}
        title={chat.title}
        timestamp={formatRelativeTime(chat.updated_at)}
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
    withDividers(chats.map((chat) => (
      <ProjectChatRow
        key={chat.id}
        title={chat.title}
        timestamp={formatRelativeTime(chat.updatedAt)}
        pinCount={pinsLoading ? null : pins.filter(p => p.chatId === chat.id).length}
        onChatClick={() => push(PROJECT_CHAT_ROUTE(projectId, chat.id))}
        onPinsClick={() => togglePinboard()}
        onRename={chat.canEdit ? (newTitle) => {
          renameChat(projectId, chat.id, newTitle)
          void chatHistory.rename(chat.id, newTitle)
        } : undefined}
        onDelete={chat.canEdit ? () => removeChat(projectId, chat.id) : undefined}
      />
    )))
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
    <div style={{ position: 'relative', display: 'flex', width: '100%', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>

      {/* Back button - anchored in the TopBar zone, top-left */}
      <button
        onClick={() => push(PROJECTS_ROUTE)}
        style={{
          position:     'absolute',
          top:          6,
          left:         8,
          zIndex:       10,
          display:      'flex',
          alignItems:   'center',
          background:   'transparent',
          border:       'none',
          cursor:       'pointer',
          padding:      '4px',
          borderRadius: '10px',
          flexShrink:   0,
        }}
        aria-label="Back to Projects"
      >
        <ArrowLeftOneIcon style={{ width: 20, height: 20, color: '#524b47' }} />
      </button>

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
            padding:       '32px 16px 8px',
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
                {project.canManageVisibility && <IconButton
                  variant="outline"
                  size="md"
                  icon={<ShareOneIcon animated />}
                  aria-label="Project visibility"
                  onClick={handleOpenShare}
                />}

                {hasMenuActions && <Dropdown.Float
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  placement="bottom-end"
                  trigger={
                    <IconButton
                      variant="outline"
                      size="md"
                      icon={<MoreVerticalIcon triggered={menuOpen} />}
                      aria-label="Project options"
                    />
                  }
                >
                  <Dropdown size="md">
                    {project.canEdit && <Dropdown.Section fluid>
                      <Dropdown.Item
                        label="Edit"
                        onClick={() => { setMenuOpen(false); setEditOpen(true) }}
                        fluid
                      />
                    </Dropdown.Section>}
                    {canLeaveProject && <Dropdown.Section divider={project.canEdit} fluid>
                      <Dropdown.Item
                        label="Leave project"
                        onClick={() => { setMenuOpen(false); setLeaveOpen(true) }}
                        fluid
                      />
                    </Dropdown.Section>}
                    {canDeleteProject && <Dropdown.Section divider fluid>
                      <Dropdown.Item
                        label="Delete"
                        variant="danger"
                        onClick={() => { setMenuOpen(false); deleteProject(projectId).then(() => push(PROJECTS_ROUTE)) }}
                        fluid
                      />
                    </Dropdown.Section>}
                  </Dropdown>
                </Dropdown.Float>}

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
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: personaActive ? 'var(--button-default-text-disabled)' : undefined }}>
                    {/* Always the Souvenir mark — every model behind this
                        button is one of the 3 Souvenir Muse tiers. */}
                    {(museActive || !!selectedModel) && (
                      <span style={{ width: 16, height: 16, borderRadius: 4, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SouvenirModelIcon size={16} variant="light" />
                      </span>
                    )}
                    {modelButtonLabel ?? 'Souvenir AI · Muse'}
                  </span>
                </Button>
              </div>
            </div>

            {project.visibility !== 'personal' ? (
              ownerName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: project.description ? 6 : 0 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                    Created by {ownerName}
                  </span>
                </div>
              )
            ) : (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize:   11,
                  lineHeight: '16px',
                  color:      'var(--neutral-500)',
                  margin:     0,
                  marginTop:  2,
                  marginBottom: project.description ? 6 : 0,
                }}
              >
                Personal Project
              </p>
            )}

            {project.description && (
              <p
                style={{
                  width:            '60%',
                  fontFamily:       'var(--font-body)',
                  fontWeight:       'var(--font-weight-regular)',
                  fontSize:         '14px',
                  lineHeight:       '20px',
                  color:            '#1a1714',
                  margin:           0,
                  overflow:         'hidden',
                  textOverflow:     'ellipsis',
                  display:          '-webkit-box',
                  WebkitBoxOrient:  'vertical',
                  WebkitLineClamp:  2,
                }}
              >
                {project.description}
              </p>
            )}
          </div>

          {/* Chat input */}
          <div style={{ width: '100%', maxWidth: '679px', flexShrink: 0 }}>
            <AnimatePresence>
              {creditNoticeStatus && (
                <InlineCreditNotice
                  key={creditNoticeStatus}
                  status={creditNoticeStatus}
                  isAdmin={isOrgAdmin}
                  onAdminAction={goToPlans}
                  onDismiss={dismissCreditNotice}
                />
              )}
            </AnimatePresence>
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
                                    onClick={() => { trackFeature('project_agent_attached', { persona_id: p.id }); setSelectedPersona(p); setPersonaChipOpen(false) }}
                                  />
                                ))
                              : <Dropdown.Item label="No agents yet" fluid disabled />
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

          {/* Chat list — 3 tabs on Workspace/Shared projects, flat list on
              Personal. Keyed on visibility, not teamId (see effect above). */}
          {project.visibility !== 'personal' ? (
            <div style={{ width: '100%', maxWidth: '679px', flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as TeamTab)}
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}
              >
                {/* All 3 tabs in one row, centered; the info button explains what
                    each covers. A spacer matching the info button's width (32px,
                    IconButton size="sm") balances it out so the tabs land dead
                    center in the row instead of shifted left by the button. */}
                <div style={{ ...tabsRowStyle, justifyContent: 'center' }}>
                  <div style={{ width: 32, flexShrink: 0 }} aria-hidden />

                  <TabsList size="small">
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                    <TabsTrigger value="publish">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        Published to Workspace
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
                  </TabsList>

                  <Tooltip
                    side="left"
                    maxWidth={280}
                    content={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div><b>Personal</b> — your own chats here, plus what&apos;s published to the workspace.</div>
                        <div style={tooltipDividerStyle} />
                        <div><b>Published to Workspace</b> — just the chats published to the workspace.</div>
                        <div style={tooltipDividerStyle} />
                        <div><b>Shared with you</b> — chats teammates shared directly, editable and view-only (a red badge marks the view-only ones).</div>
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
                    chats plus published-to-workspace ones (blue "Published" badge). */}
                <TabsContent value="personal" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 3 }}>
                    {personalChats.length === 0 ? <ProjectChatEmptyRow /> : withDividers(personalChats.map(teamChatRow))}
                  </div>
                </TabsContent>

                {/* Published to Workspace — the published-only subset, visible to and manageable by editor+ */}
                <TabsContent value="publish" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 3 }}>
                    {publishedChats.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--neutral-500)' }}>
                        <AlertCircleIcon size={16} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
                          {canPublishChat ? 'Hover a chat under “Personal” to publish it to the workspace.' : 'No chats have been published to the workspace yet.'}
                        </span>
                      </div>
                    ) : withDividers(publishedChats.map(teamChatRow))}
                  </div>
                </TabsContent>

                {/* Shared with you — editable AND view-only shares (red "View only"
                    badge marks the latter); click an editable one to fork it. */}
                <TabsContent value="shared" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 3 }}>
                    {sharedNotice(sharedItemsSorted, 'No chats have been shared with you in this project yet.') ?? (
                      withDividers(sharedItemsSorted.map(sharedChatRow))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div
              className="kaya-scrollbar"
              style={{ width: '100%', maxWidth: '679px', display: 'flex', flexDirection: 'column', gap: 0, flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: 3 }}
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
                setAgentsPanelOpen(false)
                setMembersPanelOpen(false)
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
                setAgentsPanelOpen(false)
                setMembersPanelOpen(false)
              }
              togglePinboard()
            }}
          />
          <FloatingMenuItem
            icon={<UserAiIcon size={20} animated />}
            label="Agents"
            active={agentsPanelOpen}
            onClick={() => {
              if (!agentsPanelOpen) {
                closePinboard()
                setPanelOpen(false)
                setMembersPanelOpen(false)
              }
              setAgentsPanelOpen(v => !v)
            }}
          />
          {project.visibility !== 'personal' && (
            <FloatingMenuItem
              icon={<UserIcon size={20} animated />}
              label="Members"
              active={membersPanelOpen}
              onClick={() => {
                if (!membersPanelOpen) {
                  closePinboard()
                  setPanelOpen(false)
                  setAgentsPanelOpen(false)
                }
                setMembersPanelOpen(v => !v)
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

      {leaveOpen && user?.auth0Id && (
        <LeaveProjectModal
          projectId={projectId}
          isOwner={project.canEdit}
          currentUserId={user.auth0Id}
          onClose={() => setLeaveOpen(false)}
          onLeft={() => {
            // refreshProjects() has no built-in error handling — a failure
            // here just means /projects looks stale until the next reload;
            // the leave itself already succeeded and already toasted, and
            // we're navigating away from this page regardless.
            refreshProjects().catch(() => {})
            push(PROJECTS_ROUTE)
          }}
        />
      )}

      {project.canEdit && <SystemInstructionsModal
        open={instructionsOpen}
        projectName={project.name}
        value={project.instructions}
        onSave={(text) => updateProject(projectId, { instructions: text })}
        onClose={() => setInstructionsOpen(false)}
      />}

      {/* ── Project share / visibility modal ─────────────────────────────
          Portaled to document.body: AppLayout's rounded content container
          sets `isolation: isolate` for its own z-index scoping, which traps
          any z-index set on a descendant — including a `position: fixed`
          one — inside that local stacking context. Since the Instructions/
          Team panel and Pinboard render as siblings OUTSIDE that container
          (see project-panel-context / RightSidebar), nothing rendered
          in-place here could ever paint above them, no matter how high the
          z-index. Portaling escapes the trap the same way EditProjectModal/
          SystemInstructionsModal already do. */}
      {shareOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={handleCancelShare}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(18,12,8,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }}
          />
          <div
            style={{
              position:        'fixed',
              top:             '50%',
              left:            '50%',
              transform:       'translate(-50%, -50%)',
              zIndex:          101,
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: '0 0 4px' }}>
                  Project visibility
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0 }}>
                  Control who this project is visible to.
                </p>
              </div>
              <IconButton
                variant="ghost"
                size="xs"
                icon={<CancelOneIcon />}
                aria-label="Close"
                onClick={handleCancelShare}
              />
            </div>

            {/* Reflects the project's actual saved visibility (project.teamId),
                not the in-progress card selection below — it must not change
                on every click, only once a save actually goes through. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)' }}>
                Currently
              </span>
              {!project.teamId ? (
                <Badge color="Neutral" label="Private" />
              ) : (
                <Badge color="Blue" label="Shared" />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              {/* Private / Shared — stacked, not side by side, each boxed in
                  its own matching border so the two options read as equal
                  peers. Private only shows for the project's actual
                  creator, and only while the project is still private —
                  Workspace Model v2 makes Shared one-way (no path back to
                  Private; restrict access by removing members instead), so
                  once shared this option is never offered to anyone,
                  independent of the backend's own 403 for non-owners. */}
              {isProjectOwner && !project.teamId && (
                <div style={{ padding: 8, borderRadius: 16, border: '1px solid var(--neutral-200)' }}>
                  <ModelFeaturedCard
                    title="Private"
                    description="Only you can see this project."
                    selected={shareVisibility === 'private'}
                    onSelectedChange={next => { if (next) setShareVisibility('private') }}
                  />
                </div>
              )}

              <div style={{ padding: 8, borderRadius: 16, border: '1px solid var(--neutral-200)' }}>
                <ModelFeaturedCard
                  title="Shared"
                  description={`Everyone in ${org.name || 'your workspace'} can access it.`}
                  selected={shareVisibility === 'team'}
                  onSelectedChange={next => { if (next) setShareVisibility('team') }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <Button variant="outline" size="sm" onClick={handleCancelShare}>Cancel</Button>
              <Button
                variant="default"
                size="sm"
                disabled={sharingSaving || (shareVisibility === 'team' && !orgId) || (shareVisibility === 'private' && !isProjectOwner)}
                onClick={() => void handleSaveVisibility()}
              >
                {sharingSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
