"use client"

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConnectorPromptShell } from '@/components/shared/ConnectorHeading'
import type { ConnectorPermissionPrompt, PermissionPromptOption } from '@/lib/api/prompts'

// The one permission card — chat, persona, agent configure, and compare
// all render this for kind="permission" prompts. Buttons come from the backend
// event's options; these are only the fallback for streams that omit them.
const PERSISTENT_OPTIONS: PermissionPromptOption[] = [
  { value: 'allow',      label: 'Allow',      style: 'primary' },
  { value: 'allow_once', label: 'Allow once', style: undefined },
  { value: 'block',      label: 'Block',      style: 'danger' },
]

const ONE_TIME_OPTIONS: PermissionPromptOption[] = [
  { value: 'allow', label: 'Allow this request', style: 'primary' },
  { value: 'block', label: 'Block this request', style: 'danger' },
]

interface PermissionPromptCardProps {
  prompt:    ConnectorPermissionPrompt
  /** Called with the chosen option value; the caller unblocks the stream.
   *  Persistence is server-side for personal accounts. Shared-team policy is
   *  changed only through team settings; its inline prompts are one-time. */
  onDecided?: (value: string) => void
  disabled?: boolean
  /** Chat-style surfaces let the card remove itself after a decision; the
   *  brain keeps it mounted (disabled) until the respond POST succeeds. */
  hideAfterDecide?: boolean
}

export function PermissionPromptCard({
  prompt,
  onDecided,
  disabled = false,
  hideAfterDecide = true,
}: PermissionPromptCardProps) {
  const [decided, setDecided] = useState(false)

  const persistable = prompt.persistable && !prompt.tool_name.startsWith('raw_')

  const handleDecide = useCallback((value: string) => {
    if (disabled || decided) return
    if (hideAfterDecide) setDecided(true)
    onDecided?.(value)
  }, [disabled, decided, hideAfterDecide, onDecided])

  // prompt.decision is the durable answered marker (recorded in the owning
  // surface's message state); the local flag only covers surfaces that don't
  // record it. Without the durable check, remounts resurrect answered cards.
  if (decided || prompt.decision) return null

  const options = prompt.options.length > 0
    ? prompt.options
    : persistable ? PERSISTENT_OPTIONS : ONE_TIME_OPTIONS

  return (
    <ConnectorPromptShell
      connector={prompt.connector}
      title={<>Allow {prompt.connector.name} to run this action?</>}
      caption={persistable
        ? <>The AI wants to call <code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.tool_name}</code>. Your choice applies to future calls too.</>
        : <><code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.summary || prompt.tool_name}</code> — one-time request, applies to this call only.</>}
    >

      {/* Actions — rendered from the backend event's options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {options.map((opt) => {
          const isPrimary = opt.style === 'primary' || opt.value === 'allow' || opt.value === 'allow_once'
          const isDanger  = opt.style === 'danger'
          // shadcnspace 23 Permissions: allow = Approve, block = Reject; the main allow pulses (04) while it waits.
          const variant = isDanger ? 'reject' : isPrimary ? 'approve' : 'secondary'
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={variant}
              attention={!disabled && opt.style === 'primary'}
              disabled={disabled}
              onClick={() => handleDecide(opt.value)}
            >
              {opt.label}
            </Button>
          )
        })}
      </div>
    </ConnectorPromptShell>
  )
}
