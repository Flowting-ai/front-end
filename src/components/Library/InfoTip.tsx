'use client'

import React from 'react'
import { InformationCircleIcon } from '@strange-huge/icons'
import { Tooltip } from '@/components/Tooltip'

/** Hints live behind an info icon, not in body text: the page stays quiet. */
export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  return (
    <Tooltip content={text} maxWidth={260}>
      <button
        type="button"
        aria-label={`${label}: ${text}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, border: 'none',
          background: 'transparent', color: 'var(--neutral-400)', cursor: 'help', borderRadius: 6,
        }}
      >
        <InformationCircleIcon size={14} />
      </button>
    </Tooltip>
  )
}
