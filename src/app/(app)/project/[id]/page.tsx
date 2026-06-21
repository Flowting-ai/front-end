'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnimatePresence, m } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, FolderOneIcon, MoreVerticalIcon, ShareOneIcon, SettingsOneIcon, PinIcon, GlobalSearchIcon, QuillWriteTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useModelSelectorContext } from '@/context/model-selector-context'
import { useFileUpload } from '@/hooks/use-file-upload'
import { ProjectChatRow, ProjectChatEmptyRow } from '@/components/ProjectChatRow'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { ProjectMembersPanel } from '@/components/ProjectMembersPanel'
import { TeamChip } from '@/components/TeamChip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs'
import { setProjectVisibility } from '@/lib/api/projects'
import { setChatVisibility, listChats } from '@/lib/api/chat'
import { listSharedWithMe, forkChatShare, type SharedChatItem } from '@/lib/api/chat-shares'
import { fetchTeams } from '@/lib/api/teams'
import { useOrg } from '@/context/org-context'
import { AlertCircleIcon } from '@strange-huge/icons'
import type { Team } from '@/types/teams'
import type { Chat } from '@/types/chat'
import { EditProjectModal } from '@/components/EditProjectModal'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import type { PinFolder } from '@/lib/api/pins'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { fetchPersonas, personasForTeamContext } from '@/lib/api/personas'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'

// ── Page ───────────────────────────────────────────────────────────────────────

// Team-project chat tabs (private projects render a flat list instead).
type TeamTab = 'your-chats' | 'publish' | 'shared' | 'view-only'

export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const { push }  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, loadProject, uploadFiles, removeFile, removeChat, renameChat, loadProjectChats, loading: projectsLoading } = useProjects()
  const { pins, isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const chatHistory = useChatHistoryContext()
  const { open: openModelSelector } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()

  const { orgId, caps, members } = useOrg()
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
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [selectedStyleId,  setSelectedStyleId]  = useState<string | null>(null)
  const [styleChipOpen,    setStyleChipOpen]    = useState(false)
  const [selectedFolders,  setSelectedFolders]  = useState<PinFolder[]>([])
  const [selectedPersona,      setSelectedPersona]      = useState<SelectedPersonaInfo | null>(null)
  const [personaChipOpen,      setPersonaChipOpen]      = useState(false)
  const [chipPersonas,         setChipPersonas]         = useState<SelectedPersonaInfo[]>([])
  const [loadingChipPersonas,  setLoadingChipPersonas]  = useState(false)
  const [newChatAttachments,   setNewChatAttachments]   = useState<PendingAttachment[]>([])
  const [pendingFiles,     setPendingFiles]     = useState<File[]>([])
  const [projectLoading,   setProjectLoading]   = useState(true)
  const [shareOpen,        setShareOpen]        = useState(false)
  const [teams,            setTeams]            = useState<Team[]>([])
  const [shareTeamId,      setShareTeamId]      = useState('')
  const [shareVisibility,  setShareVisibility]  = useState<'private' | 'team'>('private')
  const [sharingSaving,    setSharingSaving]    = useState(false)
  const [activeTab,        setActiveTab]        = useState<TeamTab>('your-chats')
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
    fetchPersonas()
      // Team projects offer only team-shared agents; private projects show all.
      .then(list => setChipPersonas(personasForTeamContext(list, project?.teamId ?? null).map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen, project?.teamId])

  // Team name for the header chip — only team projects need it.
  useEffect(() => {
    if (orgId && project?.teamId && teams.length === 0) {
      fetchTeams(orgId).then(setTeams).catch(() => {})
    }
  }, [orgId, project?.teamId, teams.length])

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
    openModelSelector(e.currentTarget)
  }

  function handleSendChat(text: string) {
    if (!text.trim()) return
    // Navigate to a new project chat - ChatInterface will create the chat and
    // the page's onChatCreated callback links it back to this project.
    push(`/project/${projectId}/chat/new?q=${encodeURIComponent(text.trim())}`)
    setChatInputValue('')
  }

  function handleOpenShare() {
    setShareVisibility(project?.teamId ? 'team' : 'private')
    setShareTeamId(project?.teamId ?? '')
    setShareOpen(true)
    if (orgId && teams.length === 0) {
      fetchTeams(orgId).then(setTeams).catch(console.error)
    }
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

  // Fork a chat shared with me into my workspace, then open it. If a fork
  // already exists, jump straight to it instead of creating a duplicate.
  async function handleOpenShared(item: SharedChatItem) {
    if (item.forkedChatId) { push(`/chat/${item.forkedChatId}`); return }
    setForkingShareId(item.shareId)
    try {
      const { chatId } = await forkChatShare(item.shareId)
      toast.success('Chat forked to your workspace')
      push(`/chat/${chatId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fork chat')
    } finally {
      setForkingShareId(null)
    }
  }

  const projectTeam = project.teamId ? teams.find(t => t.id === project.teamId) : undefined
  const ownerName   = members.find(m => m.id === project.ownerUserId)?.name
  // Publish CTA gate — editor+ on this team (owner/admin resolve true). Members
  // (and editors whose grants aren't loaded yet) get no publish affordance.
  const canPublishChat = !!project.teamId && caps.canPublishToTeam(project.teamId)

  const publishedChats = teamChats.filter(c => c.visibility === 'team')
  const sharedEditable = sharedItems.filter(i => i.mode === 'editable')
  const sharedReadOnly = sharedItems.filter(i => i.mode === 'read_only')

  // A chat row for the team-project tabs (Your chats / Publish to team).
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
        onChatClick={() => push(`/project/${projectId}/chat/${chat.id}`)}
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
        onChatClick={() => push(`/project/${projectId}/chat/${chat.id}`)}
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
        onClick={() => push('/projects')}
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
                        onClick={() => { setMenuOpen(false); deleteProject(projectId).then(() => push('/projects')) }}
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
              modelName={modelButtonLabel}
              onModelClick={handleModelClick}
              modelMenu={<ModelMenu />}
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

          {/* Chat list — 4-tab layout on team projects, flat list on private */}
          {project.teamId ? (
            <div style={{ width: '100%', maxWidth: '679px', flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={activeTab}
                onValueChange={(v: string) => setActiveTab(v as TeamTab)}
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}
              >
                <TabsList size="small">
                  <TabsTrigger value="your-chats">Your chats</TabsTrigger>
                  <TabsTrigger value="publish">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      Publish to team
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

                {/* Your chats — all my chats in this project */}
                <TabsContent value="your-chats" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {teamChats.length === 0 ? <ProjectChatEmptyRow /> : teamChats.map(teamChatRow)}
                  </div>
                </TabsContent>

                {/* Publish to team — my chats published to the team */}
                <TabsContent value="publish" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {publishedChats.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--neutral-500)' }}>
                        <AlertCircleIcon size={16} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
                          {canPublishChat ? 'Hover a chat under “Your chats” to publish it to the team.' : 'No chats have been published to the team yet.'}
                        </span>
                      </div>
                    ) : publishedChats.map(teamChatRow)}
                  </div>
                </TabsContent>

                {/* Shared with you — editable shares; click to fork into your workspace */}
                <TabsContent value="shared" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {sharedNotice(sharedEditable, 'No chats have been shared with you in this project yet.') ?? (
                      sharedEditable.map(item => (
                        <ProjectChatRow
                          key={item.shareId}
                          title={item.chatTitle}
                          timestamp={item.forkedChatId ? 'Forked · editable' : 'Editable'}
                          author={item.sharedByName ?? undefined}
                          pinCount={0}
                          onChatClick={() => { if (forkingShareId !== item.shareId) void handleOpenShared(item) }}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* View only — read-only snapshots; open the shared view, no forking */}
                <TabsContent value="view-only" className="kaya-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 3 }}>
                    {sharedNotice(sharedReadOnly, 'No view-only chats in this project yet.') ?? (
                      sharedReadOnly.map(item => (
                        <div key={item.shareId} style={{ display: 'flex', flexDirection: 'column' }}>
                          <ProjectChatRow
                            title={item.chatTitle}
                            timestamp="View only"
                            author={item.sharedByName ?? undefined}
                            pinCount={0}
                            onChatClick={() => push(`/chat-shares/${item.shareId}`)}
                          />
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 16px 10px', marginTop: -2 }}>
                            <AlertCircleIcon size={14} color="var(--neutral-400)" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-400)' }}>
                              This is a copy of the chat between Souvenir and {item.sharedByName ?? 'a teammate'}. Content may include unverified information. Shared snapshot may not contain all attachments.
                            </span>
                          </div>
                        </div>
                      ))
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

      {/* ── Floating menu - tracks the right panel ───────────────────── */}
      <div
        style={{
          position:   'absolute',
          top:        '50%',
          right:      panelOpen ? 366 : 16,
          transform:  'translateY(-50%)',
          zIndex:     20,
          transition: 'right 380ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <FloatingMenu aria-label="Project tools">
          <FloatingMenuItem
            icon={<SettingsOneIcon size={20} animated />}
            label="Instructions & Files"
            active={panelOpen}
            onClick={() => {
              if (!panelOpen) closePinboard()
              setPanelOpen(v => !v)
            }}
          />
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pinboard"
            active={pinboardOpen}
            onClick={() => {
              if (!pinboardOpen) setPanelOpen(false)
              togglePinboard()
            }}
          />
        </FloatingMenu>
      </div>

      {/* ── Right panel - toggled by the floating menu ────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <m.div
            key="project-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 356, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            className="kaya-scrollbar"
            style={{
              flexShrink: 0,
              height:     '100%',
              overflowY:  'auto',
              overflowX:  'hidden',
              boxSizing:  'border-box',
            }}
          >
            <div style={{ width: 356, padding: '87px 24px 24px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <ProjectInstructionsPanel
                  value={project.instructions}
                  onSave={project.canEdit ? (text) => updateProject(projectId, { instructions: text }) : undefined}
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
                      await uploadFiles(projectId, files)
                      toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`)
                    } catch {
                      // errors already toasted by the context
                    } finally {
                      setPendingFiles([])
                    }
                  } : undefined}
                  onRemove={project.canEdit ? (fileId) => removeFile(projectId, fileId) : undefined}
                />
                {project.teamId && project.canEdit && (
                  <ProjectMembersPanel
                    teamId={project.teamId}
                    projectId={projectId}
                    ownerUserId={project.ownerUserId}
                  />
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['private', 'team'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setShareVisibility(v)}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             10,
                    padding:         '10px 14px',
                    borderRadius:    10,
                    border:          'none',
                    cursor:          'pointer',
                    backgroundColor: 'white',
                    textAlign:       'left',
                    width:           '100%',
                    boxShadow:       shareVisibility === v
                      ? '0px 0px 0px 2px var(--blue-500, #4a83bf)'
                      : '0px 0px 0px 1px var(--neutral-200)',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${shareVisibility === v ? '#0a7aff' : 'var(--neutral-300)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {shareVisibility === v && <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#0a7aff' }} />}
                  </span>
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-900)', margin: 0 }}>
                      {v === 'private' ? 'Private' : 'Team'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-500)', margin: 0 }}>
                      {v === 'private' ? 'Only you can see this project.' : 'Team editors and assigned project members can access it.'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {shareVisibility === 'team' && (
              <select
                value={shareTeamId}
                onChange={e => setShareTeamId(e.target.value)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-900)', border: '1px solid var(--neutral-200)', borderRadius: 8, padding: '8px 12px', backgroundColor: 'white', width: '100%' }}
              >
                <option value="">Select team…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

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
