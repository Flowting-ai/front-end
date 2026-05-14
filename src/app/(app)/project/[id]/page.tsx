'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, MoreVerticalIcon, PinIcon, ShareOneIcon, SettingsOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { ProjectChatRow, ProjectChatEmptyRow } from '@/components/ProjectChatRow'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { EditProjectModal } from '@/components/EditProjectModal'
import { SystemInstructionsModal } from '@/components/SystemInstructionsModal'
import { ChatInput } from '@/components/ChatInput'
import { IconButton } from '@/components/IconButton'
import { Dropdown } from '@/components/Dropdown'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, uploadFiles, removeFile, removeChat, renameChat, loadProjectChats } = useProjects()
  const { toggle: togglePinboard, isOpen: pinboardOpen, pins } = usePinboard()
  const chatHistory = useChatHistoryContext()

  const project = getProject(params.id)
  const chats   = getChats(params.id)

  useEffect(() => { loadProjectChats(params.id) }, [params.id, loadProjectChats])

  const [menuOpen,         setMenuOpen]         = useState(false)
  const [editOpen,         setEditOpen]         = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [chatInputValue,   setChatInputValue]   = useState('')
  const [panelOpen,        setPanelOpen]        = useState(true)

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Project not found.</p>
      </div>
    )
  }

  const projectId = project.id

  function handleSendChat(text: string) {
    if (!text.trim()) return
    // Navigate to a new project chat — ChatInterface will create the chat and
    // the page's onChatCreated callback links it back to this project.
    router.push(`/project/${projectId}/chat/new?q=${encodeURIComponent(text.trim())}`)
    setChatInputValue('')
  }

  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Back button — anchored in the TopBar zone, top-left */}
      <button
        onClick={() => router.push('/projects')}
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

      {/* ── Left column — scrollable main content ─────────────────────── */}
      <div
        className="kaya-scrollbar"
        style={{
          flex:      '1 0 0',
          minWidth:  0,
          height:    '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
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
          }}
        >
          {/* Title section */}
          <div style={{ width: '100%', maxWidth: '679px', marginBottom: '27px' }}>
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
                        onClick={() => { setMenuOpen(false); deleteProject(projectId).then(() => router.push('/projects')) }}
                        fluid
                      />
                    </Dropdown.Section>
                  </Dropdown>
                </Dropdown.Float>

                <Button
                  variant="outline"
                  size="md"
                  rightIcon={<ShareOneIcon size={16} />}
                  disabled
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
          <div style={{ width: '100%', maxWidth: '679px' }}>
            <ChatInput
              placeholder="Ask anything, or use your voice..."
              value={chatInputValue}
              onChange={setChatInputValue}
              onSend={handleSendChat}
            />
          </div>

          {/* Chat list */}
          <div style={{ width: '100%', maxWidth: '679px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {chats.length === 0 ? (
              <ProjectChatEmptyRow />
            ) : (
              chats.map((chat) => (
                <ProjectChatRow
                  key={chat.id}
                  title={chat.title}
                  timestamp="Just now"
                  pinCount={pins.filter(p => p.chatId === chat.id).length}
                  onChatClick={() => router.push(`/project/${projectId}/chat/${chat.id}`)}
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

      {/* ── Floating menu — tracks the right panel ───────────────────── */}
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
            onClick={() => setPanelOpen(v => !v)}
          />
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pin board"
            active={pinboardOpen}
            onClick={togglePinboard}
          />
        </FloatingMenu>
      </div>

      {/* ── Right panel — toggled by the floating menu ────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
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
                  usedBytes={project.files.reduce((s, f) => s + f.sizeBytes, 0)}
                  totalBytes={100 * 1024 * 1024}
                  onUpload={(fileList) => uploadFiles(projectId, Array.from(fileList))}
                  onRemove={(fileId) => removeFile(projectId, fileId)}
                />
              </div>
            </div>
          </motion.div>
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
    </div>
  )
}
