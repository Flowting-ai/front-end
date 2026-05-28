'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftOneIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  CircleIcon,
  SettingsOneIcon,
  PlusSignIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { springs } from '@/lib/springs'
import { ProjectConfigPanel, type ProjectConfig } from './ProjectConfigPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectThread {
  id:           string
  /** Original user query — shown as the thread title. */
  query:        string
  /** Display timestamp — "Today · 2:03 PM", "Yesterday · 9:14 AM", "May 21 · 4:30 PM" */
  timestamp:    string
  status:       'complete' | 'failed' | 'cancelled'
  doneCount:    number
  skippedCount?: number
  failedCount?:  number
}

export interface BrainProjectViewProps {
  project:             { id: string; name: string }
  threads:             ProjectThread[]
  projectConfig?:      Omit<ProjectConfig, 'name'>
  onBack?:             () => void
  onNewLoop?:          () => void
  onOpenThread?:       (threadId: string) => void
  onSaveConfig?:       (config: ProjectConfig) => void
}

// ── Status icon ───────────────────────────────────────────────────────────────

function ThreadStatusIcon({ status }: { status: ProjectThread['status'] }) {
  if (status === 'complete') {
    return <CheckmarkCircleTwoIcon size={14} color="var(--color-tag-Green-text)" />
  }
  if (status === 'failed') {
    return <CancelCircleIcon size={14} color="var(--color-tag-Red-text)" />
  }
  return <CircleIcon size={14} color="var(--neutral-300)" />
}

// ── Stats line ────────────────────────────────────────────────────────────────

function ThreadStats({ thread }: { thread: ProjectThread }) {
  const parts: React.ReactNode[] = []

  parts.push(
    <span key="done" style={{ color: 'var(--color-tag-Green-text)' }}>
      {thread.doneCount} done
    </span>
  )

  if (thread.skippedCount && thread.skippedCount > 0) {
    parts.push(
      <span key="skip-sep" style={{ color: 'var(--neutral-400)' }}> · </span>,
      <span key="skipped" style={{ color: 'var(--neutral-500)' }}>
        {thread.skippedCount} skipped
      </span>
    )
  }

  if (thread.failedCount && thread.failedCount > 0) {
    parts.push(
      <span key="fail-sep" style={{ color: 'var(--neutral-400)' }}> · </span>,
      <span key="failed" style={{ color: 'var(--color-tag-Red-text)' }}>
        {thread.failedCount} failed
      </span>
    )
  }

  return (
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize:   'var(--font-size-caption)',
      lineHeight: 'var(--line-height-caption)',
    }}>
      {parts}
    </span>
  )
}

// ── ThreadRow ─────────────────────────────────────────────────────────────────

function ThreadRow({
  thread,
  onClick,
}: {
  thread:  ProjectThread
  onClick: () => void
}) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        alignItems:      'flex-start',
        gap:             12,
        padding:         '10px 16px',
        width:           '100%',
        background:      hovered ? 'var(--neutral-50)' : 'none',
        border:          'none',
        borderRadius:    10,
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'background-color 120ms ease',
      }}
    >
      {/* Status icon — aligned to first text line */}
      <div style={{ marginTop: 3, flexShrink: 0, lineHeight: 0 }}>
        <ThreadStatusIcon status={thread.status} />
      </div>

      {/* Text column */}
      <div style={{
        flex:      '1 0 0',
        minWidth:  0,
        display:   'flex',
        flexDirection: 'column',
        gap:       2,
      }}>
        <span style={{
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body)',
          lineHeight:   'var(--line-height-body)',
          color:        'var(--neutral-800)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {thread.query}
        </span>
        <ThreadStats thread={thread} />
      </div>

      {/* Timestamp */}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        lineHeight: 'var(--line-height-caption)',
        color:      'var(--neutral-500)',
        flexShrink: 0,
        marginTop:  2,
      }}>
        {thread.timestamp}
      </span>
    </button>
  )
}

// ── BrainProjectView ──────────────────────────────────────────────────────────

/**
 * "Inside a project" view — list of past loops for a Brain project.
 * Replaces BrainHome in BrainShell when the user navigates into a project.
 *
 * Three layers (Dubberly concept model):
 *   Identity   → project name + configure button
 *   History    → ordered thread list with status + stats (feedback loop)
 *   Entry      → "New loop" CTA (inherits project config)
 */
export function BrainProjectView({
  project,
  threads,
  projectConfig,
  onBack,
  onNewLoop,
  onOpenThread,
  onSaveConfig,
}: BrainProjectViewProps) {
  const [configOpen, setConfigOpen] = React.useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', isolation: 'isolate' }}>
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={springs.moderate}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        width:         '100%',
        paddingTop:    48,
        paddingBottom: 40,
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        paddingBottom:  20,
        paddingLeft:    4,
        paddingRight:   4,
      }}>
        {/* Back */}
        {onBack && (
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Back"
            onClick={onBack}
            icon={<ArrowLeftOneIcon />}
          />
        )}

        {/* Project name */}
        <span style={{
          flex:       '1 0 0',
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body-lg)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-900)',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.name}
        </span>

        {/* Configure */}
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Configure project"
          onClick={() => setConfigOpen(true)}
          icon={<SettingsOneIcon />}
        />

        {/* New loop */}
        <Button
          variant="default"
          size="sm"
          leftIcon={<PlusSignIcon />}
          onClick={onNewLoop}
        >
          New loop
        </Button>
      </div>

      {/* ── Thread list ── */}
      {threads.length === 0 ? (
        <div style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            16,
          paddingTop:     60,
          paddingBottom:  40,
        }}>
          <p style={{
            margin:     0,
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-400)',
            textAlign:  'center',
          }}>
            No loops yet in this project.
          </p>
          <Button variant="secondary" size="sm" onClick={onNewLoop}>
            Start the first loop
          </Button>
        </div>
      ) : (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           0,
        }}>
          {threads.map((thread, i) => (
            <React.Fragment key={thread.id}>
              {i > 0 && (
                <div style={{ height: 1, backgroundColor: 'var(--neutral-100)', marginLeft: 42 }} />
              )}
              <ThreadRow
                thread={thread}
                onClick={() => onOpenThread?.(thread.id)}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </motion.div>

    {/* ── Config panel overlay ── */}
    <AnimatePresence initial={false}>
      {configOpen && (
        <ProjectConfigPanel
          name={project.name}
          {...projectConfig}
          onClose={() => setConfigOpen(false)}
          onSave={(cfg) => {
            onSaveConfig?.(cfg)
            setConfigOpen(false)
          }}
        />
      )}
    </AnimatePresence>
    </div>
  )
}

BrainProjectView.displayName = 'BrainProjectView'
