"use client"

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/Button'
import { connectorLogoSrc } from '@/lib/connectorLogos'
import type { ConnectorPermissionPrompt, PermissionPromptOption } from '@/lib/api/prompts'

// The one permission card — chat, persona, agent configure, compare, and brain
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
   *  Persistence is server-side: the backend saves allow/block (scope-aware,
   *  personal vs shared account) when the prompt resolves — the card never
   *  writes settings itself. */
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

  const logoSrc = connectorLogoSrc(prompt.connector_slug) ?? prompt.icon_url ?? connectorLogoSrc(prompt.display_name)
  const displayName = prompt.display_name || prompt.connector_slug || '?'
  const options = prompt.options.length > 0
    ? prompt.options
    : persistable ? PERSISTENT_OPTIONS : ONE_TIME_OPTIONS

  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
      padding:         '16px',
      borderRadius:    16,
      border:          '1px solid var(--neutral-200)',
      backgroundColor: 'var(--color-surface-glass)',
      boxShadow:       'var(--shadow-card-default)',
      maxWidth:        480,
    }}>
      {/* Header: connector logo + title + tool slug */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- bundled asset or provider CDN URL
          <img
            src={logoSrc}
            alt=""
            width={32}
            height={32}
            style={{ objectFit: 'contain', display: 'block', flexShrink: 0, borderRadius: 8, marginTop: 1 }}
          />
        ) : (
          <span style={{
            width:           32,
            height:          32,
            borderRadius:    8,
            backgroundColor: 'var(--neutral-100)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontFamily:      'var(--font-body)',
            fontSize:        14,
            fontWeight:      600,
            color:           'var(--neutral-600)',
            flexShrink:      0,
            textTransform:   'uppercase',
            userSelect:      'none',
            marginTop:       1,
          }}>
            {displayName.charAt(0)}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 0 0', minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-800)',
          }}>
            Allow {displayName} to run this action?
          </span>
          <span style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {persistable
              ? <>The AI wants to call <code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.tool_name}</code>. Your choice applies to future calls too.</>
              : <><code style={{ fontFamily: 'var(--font-code)', fontSize: 'inherit' }}>{prompt.summary || prompt.tool_name}</code> — one-time request, applies to this call only.</>}
          </span>
        </div>
      </div>

      {/* Actions — rendered from the backend event's options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {options.map((opt) => {
          const isPrimary = opt.style === 'primary' || opt.value === 'allow' || opt.value === 'allow_once'
          const isDanger  = opt.style === 'danger'
          const variant = isDanger ? 'danger' : isPrimary ? 'default' : 'secondary'
          return (
            <Button
              key={opt.value}
              size="sm"
              variant={variant}
              disabled={disabled}
              onClick={() => handleDecide(opt.value)}
            >
              {opt.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
