'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftOneIcon,
  MoreVerticalIcon,
  ShareOneIcon,
  QuillWriteTwoIcon,
  PinIcon,
} from '@strange-huge/icons'
import { useProjects } from '@/context/projects-context'
import { ProjectChatRow, ProjectChatEmptyRow } from '@/components/ProjectChatRow'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { EditProjectModal } from '@/components/EditProjectModal'
import { ChatInput } from '@/components/ChatInput'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { Tooltip } from '@/components/Tooltip'
import { Dropdown } from '@/components/Dropdown'
import { Pinboard, DEFAULT_PINBOARD_VIEWS } from '@/components/Pinboard'

// ── Types ──────────────────────────────────────────────────────────────────────

type RightPanelMode = 'instructions' | 'files' | 'pinboard'

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const { getProject, getChats, updateProject, deleteProject, addChat, addFile, removeFile } = useProjects()

  const project = getProject(params.id)
  const chats   = getChats(params.id)

  const [rightPanel,       setRightPanel]       = useState<RightPanelMode>('instructions')
  const [menuOpen,         setMenuOpen]         = useState(false)
  const [editOpen,         setEditOpen]         = useState(false)
  const [activeChatFilter, setActiveChatFilter] = useState('all')
  const [chatInputValue,   setChatInputValue]   = useState('')

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Project not found.</p>
      </div>
    )
  }

  // project is non-null from here — use directly (TS narrows in JSX, not in closures)
  const projectId = project.id

  const pinboardViews = [
    ...DEFAULT_PINBOARD_VIEWS,
    ...chats.map((c) => ({ id: `chat-${c.id}`, label: c.title })),
  ]

  function handleSendChat(text: string) {
    if (!text.trim()) return
    const chat = addChat(projectId, text.trim().slice(0, 60))
    router.push(`/project/${projectId}/chat/${chat.id}`)
    setChatInputValue('')
  }

  function handlePinsClick(chatId: string) {
    setActiveChatFilter(`chat-${chatId}`)
    setRightPanel('pinboard')
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          overflowY:     'auto',
          padding:       '87px 24px 40px',
          boxSizing:     'border-box',
          position:      'relative',
        }}
      >
        {/* Top bar: back + title + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '39px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
            <div
              style={{
                flex:          '1 0 0',
                minWidth:      0,
                marginLeft:    '8px',
              }}
            >
              <h1
                style={{
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
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <Dropdown.Float
                open={menuOpen}
                onOpenChange={setMenuOpen}
                placement="bottom-end"
                trigger={
                  <IconButton
                    variant="secondary"
                    size="md"
                    icon={<MoreVerticalIcon />}
                    aria-label="Project options"
                  />
                }
              >
                <Dropdown size="sm">
                  <Dropdown.Section>
                    <Dropdown.Item label="Edit"    onClick={() => { setMenuOpen(false); setEditOpen(true) }} fluid />
                    <Dropdown.Item label="Archive" onClick={() => setMenuOpen(false)} fluid />
                    <Dropdown.Item
                      label="Delete"
                      variant="danger"
                      onClick={() => { deleteProject(projectId); router.push('/projects') }}
                      fluid
                    />
                  </Dropdown.Section>
                </Dropdown>
              </Dropdown.Float>

              <Button variant="outline" rightIcon={<ShareOneIcon style={{ width: 16, height: 16 }} />}>
                Share
              </Button>
            </div>
          </div>

          {/* Subtitle / description */}
          {project.description && (
            <p
              style={{
                fontFamily:   'var(--font-body)',
                fontWeight:   'var(--font-weight-regular)',
                fontSize:     '16px',
                lineHeight:   '22px',
                color:        '#1a1714',
                margin:       '0 0 0 40px',
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

        {/* Chat list / empty state */}
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
                  onPinsClick={() => handlePinsClick(chat.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Floating panel-toggle buttons */}
        <div
          style={{
            position:      'absolute',
            right:         '10px',
            top:           '50%',
            transform:     'translateY(-50%)',
            display:       'flex',
            flexDirection: 'column',
            gap:           '4px',
            padding:       '4px 4px 6px',
            borderRadius:  '12px',
            background:    'var(--neutral-white)',
            boxShadow:     '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-200)',
          }}
        >
          <Tooltip content="Instructions" side="left">
            <IconButton
              variant={rightPanel === 'instructions' ? 'secondary' : 'ghost'}
              size="sm"
              icon={<QuillWriteTwoIcon />}
              aria-label="Toggle instructions panel"
              onClick={() => setRightPanel(rightPanel === 'instructions' ? 'files' : 'instructions')}
            />
          </Tooltip>
          <Tooltip content="Pinboard" side="left">
            <IconButton
              variant={rightPanel === 'pinboard' ? 'secondary' : 'ghost'}
              size="sm"
              icon={<PinIcon />}
              aria-label="Toggle pinboard"
              onClick={() => setRightPanel(rightPanel === 'pinboard' ? 'files' : 'pinboard')}
            />
          </Tooltip>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={rightPanel}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }}
          style={{
            width:          '395px',
            flexShrink:     0,
            display:        'flex',
            flexDirection:  'column',
            gap:            '14px',
            padding:        '87px 24px 24px',
            overflowY:      'auto',
            boxSizing:      'border-box',
          }}
        >
          {rightPanel === 'instructions' && (
            <ProjectInstructionsPanel
              value={project.instructions}
              onSave={(text) => updateProject(projectId, { instructions: text })}
            />
          )}

          {rightPanel === 'files' && (
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
          )}

          {rightPanel === 'pinboard' && (
            <Pinboard
              pins={[]}
              views={pinboardViews}
              view={activeChatFilter}
              onViewChange={setActiveChatFilter}
              onExport={() => {}}
              onOrganize={() => {}}
              onClose={() => setRightPanel('files')}
              fluid
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Edit modal */}
      <EditProjectModal
        open={editOpen}
        name={project.name}
        description={project.description}
        onSave={(name, description) => updateProject(projectId, { name, description })}
        onClose={() => setEditOpen(false)}
      />
    </div>
  )
}
