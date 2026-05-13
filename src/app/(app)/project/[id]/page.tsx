'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftOneIcon, MoreVerticalIcon, PinIcon, ShareOneIcon } from '@strange-huge/icons'
import { Settings } from 'lucide-react'
import { Divider } from '@/components/Divider'
import { Button } from '@/components/Button'
import { useProjects } from '@/context/projects-context'
import { usePinboard } from '@/context/pinboard-context'
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
  const { getProject, getChats, updateProject, deleteProject, addChat, addFile, removeFile } = useProjects()
  const { toggle: togglePinboard, isOpen: pinboardOpen, close: closePinboard } = usePinboard()

  const project = getProject(params.id)
  const chats   = getChats(params.id)

  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [menuOpen,         setMenuOpen]         = useState(false)
  const [editOpen,         setEditOpen]         = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [chatInputValue,   setChatInputValue]   = useState('')

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
    const chat = addChat(projectId, text.trim().slice(0, 60))
    router.push(`/project/${projectId}/chat/${chat.id}?q=${encodeURIComponent(text.trim())}`)
    setChatInputValue('')
  }

  function handleSettingsToggle() {
    if (!settingsOpen) closePinboard()
    setSettingsOpen((v) => !v)
  }

  function handlePinboardToggle() {
    if (!pinboardOpen) setSettingsOpen(false)
    togglePinboard()
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── Main content wrapper — position:relative so FloatingMenu
              stays within this column when settings panel is open ── */}
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          position:      'relative',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
        }}
      >
        {/* Scrollable content */}
        <div
          style={{
            flex:          '1 1 0',
            minHeight:     0,
            overflowY:     'auto',
            padding:       '87px 24px 40px',
            boxSizing:     'border-box',
          }}
        >
          {/* Top bar: back + title + more options — constrained to chat-input width */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '39px' }}>
            <div style={{ width: '100%', maxWidth: '754px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                  {/* Back button */}
                  <button
                    onClick={() => router.push('/projects')}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      background:   'transparent',
                      border:       'none',
                      cursor:       'pointer',
                      padding:      '8px',
                      marginLeft:   '-8px',
                      borderRadius: '10px',
                      flexShrink:   0,
                    }}
                    aria-label="Back to Projects"
                  >
                    <ArrowLeftOneIcon style={{ width: 20, height: 20, color: '#524b47' }} />
                  </button>

                  {/* Title */}
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

                  {/* More options dropdown */}
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
                          onClick={() => { setMenuOpen(false); deleteProject(projectId); router.push('/projects') }}
                          fluid
                        />
                      </Dropdown.Section>
                    </Dropdown>
                  </Dropdown.Float>

                  {/* Share button */}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ShareOneIcon size={16} />}
                    disabled
                  >
                    Share
                  </Button>
                </div>

                {/* Description */}
                {project.description && (
                  <p
                    style={{
                      fontFamily:   'var(--font-body)',
                      fontWeight:   'var(--font-weight-regular)',
                      fontSize:     '16px',
                      lineHeight:   '22px',
                      color:        '#1a1714',
                      margin:       '0 0 0 36px',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chat input */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ width: '100%', maxWidth: '754px' }}>
              <ChatInput
                placeholder="Ask anything, or use your voice..."
                value={chatInputValue}
                onChange={setChatInputValue}
                onSend={handleSendChat}
              />
            </div>
          </div>

          {/* Chat list */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '754px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {chats.length === 0 ? (
                <ProjectChatEmptyRow />
              ) : (
                chats.map((chat) => (
                  <ProjectChatRow
                    key={chat.id}
                    title={chat.title}
                    timestamp="Just now"
                    pinCount={chat.pinCount}
                    onChatClick={() => router.push(`/project/${projectId}/chat/${chat.id}`)}
                    onPinsClick={() => togglePinboard()}
                  />
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Floating menu — absolute in outer container, slides with settings panel ── */}
      <motion.div
        style={{ position: 'absolute', top: '50%', y: '-50%', zIndex: 20 }}
        animate={{ right: settingsOpen ? 407 : 16 }}
        initial={{ right: 16 }}
        transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
      >
        <FloatingMenu aria-label="Project tools">
          <FloatingMenuItem
            icon={<Settings size={20} />}
            label="Instructions & Files"
            active={settingsOpen}
            onClick={handleSettingsToggle}
          />
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pin board"
            active={pinboardOpen}
            onClick={handlePinboardToggle}
          />
        </FloatingMenu>
      </motion.div>

      {/* ── Settings panel: instructions + files ─────────────────────────── */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 395, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
            style={{
              flexShrink:    0,
              height:        '100%',
              overflow:      'hidden',
              display:       'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                flex:          '1 0 0',
                minHeight:     0,
                overflowY:     'auto',
                overflowX:     'hidden',
                display:       'flex',
                flexDirection: 'column',
                gap:           '14px',
                padding:       '87px 24px 24px',
                boxSizing:     'border-box',
              }}
            >
              <ProjectInstructionsPanel
                value={project.instructions}
                onSave={(text) => updateProject(projectId, { instructions: text })}
                onOpenEditor={() => setInstructionsOpen(true)}
              />
              <ProjectFilesPanel
                files={project.files}
                usedBytes={project.files.reduce((s, f) => s + f.sizeBytes, 0)}
                totalBytes={100 * 1024 * 1024}
                onUpload={(fileList) => {
                  Array.from(fileList).forEach((f) => {
                    addFile(projectId, {
                      id:         `file-${Date.now()}-${Math.random()}`,
                      name:       f.name,
                      type:       f.name.split('.').pop()?.toUpperCase() ?? 'FILE',
                      sizeBytes:  f.size,
                      sizeLabel:  f.size < 1024 * 1024
                                    ? `${(f.size / 1024).toFixed(0)} KB`
                                    : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                      uploadedAt: 'Just now',
                      url:        URL.createObjectURL(f),
                    })
                  })
                }}
                onRemove={(fileId) => removeFile(projectId, fileId)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
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
