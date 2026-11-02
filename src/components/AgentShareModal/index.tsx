'use client'

import React from 'react'
import { CancelOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/ui/button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { ShareAgentPanel } from '@/components/ShareAgentPanel'

// ── Agent share modal ─────────────────────────────────────────────────────────
// Opens from an agent card's Share button / ⋯ → Share and the Super Links tab.
// The content is ShareAgentPanel (Super Link + email invites), the same panel
// the agent's published page uses. Built on the shared Radix dialog shell
// (portal, focus trap, Escape, focus return).

export interface AgentShareModalProps {
  open:      boolean
  onClose:   () => void
  /** The persona repo to share. */
  repoId:    string
  agentName: string
}

export function AgentShareModal({ open, onClose, repoId, agentName }: AgentShareModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      {open && (
        <DialogContent
          key={repoId}
          hideClose
          aria-label={`Share ${agentName}`}
          style={{
            width: 680, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 96px)', minHeight: 380,
            gap: 24, padding: 32, background: 'var(--modal-bg)',
            boxShadow: '0px 8px 32px rgba(18,12,8,0.18), 0px 0px 0px 1px var(--neutral-100)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogPrimitive.Title asChild>
                <p className="m-0 mb-1 font-[family-name:var(--font-title)] text-2xl leading-8 font-normal text-[var(--neutral-900)]">Share agent</p>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <p className="m-0 truncate text-sm leading-[22px] text-[var(--neutral-500)]">{agentName}</p>
              </DialogPrimitive.Description>
            </div>
            <DialogClose asChild>
              <IconButton variant="ghost" size="xs" icon={<CancelOneIcon />} aria-label="Close" />
            </DialogClose>
          </div>
          <div className="kaya-scrollbar -m-2 min-h-0 overflow-y-auto p-2">
            <ShareAgentPanel repoId={repoId} />
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

export default AgentShareModal
