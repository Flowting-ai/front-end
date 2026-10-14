'use client'

import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/ui/button'
import { ShareAgentPanel } from '@/components/ShareAgentPanel'
import { useFocusTrap } from '@/hooks/use-focus-trap'

// ── Agent share modal ─────────────────────────────────────────────────────────
// Opens from an agent card's Share button / ⋯ → Share and the Super Links tab.
// The content is ShareAgentPanel (Super Link + email invites), the same panel
// the agent's published page uses.
//
// Portaled to document.body for the same reason ProjectShareModal is: AppLayout's
// rounded content container isolates its stacking context, which would trap a
// fixed modal beneath the side panels.

export interface AgentShareModalProps {
  open:      boolean
  onClose:   () => void
  /** The persona repo to share. */
  repoId:    string
  agentName: string
}

export function AgentShareModal({ open, onClose, repoId, agentName }: AgentShareModalProps) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(<ModalBody key={repoId} repoId={repoId} agentName={agentName} onClose={onClose} />, document.body)
}

function ModalBody({ repoId, agentName, onClose }: Omit<AgentShareModalProps, 'open'>) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Tab stays inside; Esc closes; focus returns to the opener.
  useFocusTrap(dialogRef, true, onClose)

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[100] bg-[var(--overlay-bg)] backdrop-blur-[2px]" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${agentName}`}
        className="fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100vh-96px)] min-h-[380px] w-[680px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-hidden rounded-2xl bg-[var(--modal-bg)] p-8 shadow-[0px_8px_32px_rgba(18,12,8,0.18),0px_0px_0px_1px_var(--neutral-100)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 mb-1 font-[family-name:var(--font-title)] text-2xl leading-8 font-normal text-[var(--neutral-900)]">Share agent</p>
            <p className="m-0 truncate text-sm leading-[22px] text-[var(--neutral-500)]">{agentName}</p>
          </div>
          <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="kaya-scrollbar -m-2 min-h-0 overflow-y-auto p-2">
          <ShareAgentPanel repoId={repoId} />
        </div>
      </div>
    </>
  )
}

export default AgentShareModal
