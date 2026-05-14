'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, MoreVerticalIcon, PinIcon, ShareOneIcon, SettingsOneIcon } from '@strange-huge/icons'
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
  const { toggle: togglePinboard, isOpen: pinboardOpen } = usePinboard()

  const project = getProject(params.id)
  const chats   = getChats(params.id)

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
          <div style={{ width: '100%', maxWidth: '754px', marginBottom: '27px' }}>
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
                        onClick={() => { setMenuOpen(false); deleteProject(projectId); router.push('/projects') }}
                        fluid
                      />
                    </Dropdown.Section>
                  </Dropdown>
                </Dropdown.Float>

                <Button
                  variant="outline"
                  size="sm"
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
          <div style={{ width: '100%', maxWidth: '754px' }}>
            <ChatInput
              placeholder="Ask anything, or use your voice..."
              value={chatInputValue}
              onChange={setChatInputValue}
              onSend={handleSendChat}
            />
          </div>

          {/* Chat list */}
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

      {/* ── Floating menu — between left content and right panel ─────── */}
      <div
        style={{
          position:  'absolute',
          top:       '50%',
          right:     405,
          transform: 'translateY(-50%)',
          zIndex:    20,
        }}
      >
        <FloatingMenu aria-label="Project tools">
          <FloatingMenuItem
            icon={<SettingsOneIcon animated />}
            label="Instructions & Files"
            active
          />
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pin board"
            active={pinboardOpen}
            onClick={togglePinboard}
          />
        </FloatingMenu>
      </div>

      {/* ── Right panel — always visible ──────────────────────────────── */}
      <div
        className="kaya-scrollbar"
        style={{
          width:     '395px',
          flexShrink: 0,
          height:    '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding:   '87px 24px 24px',
          boxSizing: 'border-box',
        }}
      >
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
      </div>

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
