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
import { setProjectVisibility } from '@/lib/api/projects'
import { fetchTeams } from '@/lib/api/teams'
import { useOrg } from '@/context/org-context'
import type { Team } from '@/types/teams'
import { EditProjectModal } from '@/components/EditProjectModal'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatAddMenu, USE_STYLE_OPTIONS, type SelectedPersonaInfo } from '@/components/chat/AddMenu'
import { AttachmentManager, type PendingAttachment } from '@/components/chat/AttachmentManager'
import type { PinFolder } from '@/lib/api/pins'
import { ModelMenu, useModelButtonLabel } from '@/components/chat/ModelMenu'
import { fetchPersonas } from '@/lib/api/personas'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'

// ── Page ───────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const { push }  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, loadProject, uploadFiles, removeFile, removeChat, renameChat, loadProjectChats, loading: projectsLoading } = useProjects()
  const { pins, isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const chatHistory = useChatHistoryContext()
  const { open: openModelSelector } = useModelSelectorContext()
  const modelButtonLabel = useModelButtonLabel()

  const { orgId } = useOrg()
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { processFiles, FILE_ACCEPT } = useFileUpload()

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- React 18+ batches these; useReducer refactor tracked separately
  useEffect(() => {
    if (!personaChipOpen) return
    setLoadingChipPersonas(true)
    fetchPersonas()
      .then(list => setChipPersonas(list.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, modelId: p.modelId, activeVersionId: p.activeVersionId, systemPrompt: null, temperature: null }))))
      .catch(() => setChipPersonas([]))
      .finally(() => setLoadingChipPersonas(false))
  }, [personaChipOpen])

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
      toast.success('Project visibility updated')
      setShareOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update visibility')
    } finally {
      setSharingSaving(false)
    }
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
                <Dropdown.Float
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
                </Dropdown.Float>

                <Button
                  variant="outline"
                  size="md"
                  rightIcon={<ShareOneIcon size={16} />}
                  onClick={handleOpenShare}
                >
                  Share
                </Button>
              </div>
            </div>

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
                      icon={<FolderOneIcon size={20} color="var(--chip-text)" />}
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

          {/* Chat list */}
          <div
            className="kaya-scrollbar"
            style={{ width: '100%', maxWidth: '679px', display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: 3 }}
          >
            {chats.length === 0 ? (
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
                  onRename={(newTitle) => {
                    renameChat(projectId, chat.id, newTitle)
                    void chatHistory.rename(chat.id, newTitle)
                  }}
                  onDelete={() => removeChat(projectId, chat.id)}
                />
              ))
            )}
          </div>
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
                  onSave={(text) => updateProject(projectId, { instructions: text })}
                  onOpenEditor={() => setInstructionsOpen(true)}
                />
                <ProjectFilesPanel
                  files={project.files}
                  pendingFiles={pendingFiles}
                  usedBytes={project.files.reduce((s, f) => s + f.sizeBytes, 0)}
                  totalBytes={100 * 1024 * 1024}
                  onUpload={async (fileList) => {
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
                  }}
                  onRemove={(fileId) => removeFile(projectId, fileId)}
                />
                {project.teamId && (
                  <ProjectMembersPanel
                    teamId={project.teamId}
                    projectId={projectId}
                  />
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <EditProjectModal
        open={editOpen}
        name={project.name}
        description={project.description}
        tags={project.tags}
        onSave={(name, description, tags) => updateProject(projectId, { name, description, tags })}
        onClose={() => setEditOpen(false)}
      />

      <SystemInstructionsModal
        open={instructionsOpen}
        projectName={project.name}
        value={project.instructions}
        onSave={(text) => updateProject(projectId, { instructions: text })}
        onClose={() => setInstructionsOpen(false)}
      />

      {/* ── Project share / visibility modal ─────────────────────────── */}
      {shareOpen && (
        <>
          {/* eslint-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- modal backdrop */}
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
                      {v === 'private' ? 'Only you can see this project.' : 'All members of a team can access it.'}
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
