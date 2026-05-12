'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftOneIcon, QuillWriteTwoIcon, PinIcon, FolderOneIcon } from '@strange-huge/icons'
import { useProjects } from '@/context/projects-context'
import { ProjectInstructionsPanel } from '@/components/ProjectInstructionsPanel'
import { ProjectFilesPanel } from '@/components/ProjectFilesPanel'
import { EditProjectModal } from '@/components/EditProjectModal'
import { ChatInput } from '@/components/ChatInput'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { Pinboard, DEFAULT_PINBOARD_VIEWS } from '@/components/Pinboard'
import { motion, AnimatePresence } from 'framer-motion'

type RightPanelMode = 'instructions' | 'files' | 'pinboard'

export default function ProjectChatPage() {
  const params  = useParams<{ id: string; chatId: string }>()
  const router  = useRouter()
  const { getProject, getChats, updateProject, addFile, removeFile } = useProjects()

  const project = getProject(params.id)
  const chats   = getChats(params.id)
  const chat    = chats.find((c) => c.id === params.chatId)

  const [rightPanel,       setRightPanel]       = useState<RightPanelMode>('pinboard')
  const [activeChatFilter, setActiveChatFilter] = useState(`chat-${params.chatId}`)
  const [editOpen,         setEditOpen]         = useState(false)
  const [inputValue,       setInputValue]       = useState('')

  if (!project || !chat) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: '#857a72' }}>Chat not found.</p>
      </div>
    )
  }

  // Capture for use inside closures (TS doesn't narrow across callbacks)
  const projectId = project.id

  const pinboardViews = [
    ...DEFAULT_PINBOARD_VIEWS,
    ...chats.map((c) => ({ id: `chat-${c.id}`, label: c.title })),
  ]

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div
        style={{
          flex:          '1 0 0',
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          position:      'relative',
        }}
      >
        {/* Header breadcrumb */}
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             '8px',
            padding:         '12px 24px',
            borderBottom:    '1px solid var(--neutral-100)',
            flexShrink:      0,
          }}
        >
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            style={{
              display:      'flex',
              alignItems:   'center',
              background:   'transparent',
              border:       'none',
              cursor:       'pointer',
              padding:      '6px',
              borderRadius: '8px',
              color:        '#524b47',
            }}
            aria-label="Back to project"
          >
            <ArrowLeftOneIcon style={{ width: 20, height: 20 }} />
          </button>
          <p
            style={{
              fontFamily:  'var(--font-body)',
              fontWeight:  'var(--font-weight-medium)',
              fontSize:    '14px',
              lineHeight:  '22px',
              color:       '#524b47',
              margin:      0,
            }}
          >
            {project.name} · {chat.title}
          </p>
        </div>

        {/* Chat thread (empty — real messages out of scope) */}
        <div
          style={{
            flex:      '1 1 0',
            overflowY: 'auto',
            padding:   '24px',
            display:   'flex',
            flexDirection: 'column',
            gap:       '16px',
          }}
        >
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-regular)',
                fontSize:   '14px',
                lineHeight: '22px',
                color:      '#a39b95',
              }}
            >
              Start the conversation…
            </p>
          </div>
        </div>

        {/* Floating action buttons */}
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
              aria-label="Instructions"
              onClick={() => setRightPanel('instructions')}
            />
          </Tooltip>
          <Tooltip content="Files" side="left">
            <IconButton
              variant={rightPanel === 'files' ? 'secondary' : 'ghost'}
              size="sm"
              icon={<FolderOneIcon />}
              aria-label="Files"
              onClick={() => setRightPanel('files')}
            />
          </Tooltip>
          <Tooltip content="Pinboard" side="left">
            <IconButton
              variant={rightPanel === 'pinboard' ? 'secondary' : 'ghost'}
              size="sm"
              icon={<PinIcon />}
              aria-label="Pinboard"
              onClick={() => setRightPanel('pinboard')}
            />
          </Tooltip>
        </div>

        {/* Chat input footer */}
        <div
          style={{
            padding:     '12px 24px 24px',
            flexShrink:  0,
          }}
        >
          <p
            style={{
              fontFamily:  'var(--font-body)',
              fontWeight:  'var(--font-weight-regular)',
              fontSize:    '11px',
              lineHeight:  '16px',
              color:       '#a39b95',
              textAlign:   'center',
              marginBottom:'8px',
            }}
          >
            Claude is AI and can make mistakes. Please double-check responses.
          </p>
          <ChatInput
            placeholder="How can I help you today?"
            value={inputValue}
            onChange={setInputValue}
            onSend={(text) => {
              setInputValue('')
            }}
          />
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
            width:         '395px',
            flexShrink:    0,
            display:       'flex',
            flexDirection: 'column',
            gap:           '14px',
            padding:       '24px',
            overflowY:     'auto',
            boxSizing:     'border-box',
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
