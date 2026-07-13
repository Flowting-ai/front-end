'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CancelOneIcon } from '@strange-huge/icons'
import CancelCreationModal from './CancelCreationModal'
import { AGENTS_ROUTE } from '@/lib/routes'
import { trackBrowserEvent } from '@/lib/analytics/events'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepState = 'active' | 'completed' | 'future'

export interface WizardStep {
  label: string
  state: StepState
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ label, state }: WizardStep) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 2, borderRadius: 6, flexShrink: 0, position: 'relative',
        background: state === 'completed' ? 'var(--blue-200)' : 'var(--blue-100)',
        opacity: state === 'future' ? 0.5 : 1,
        boxShadow: '0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px rgba(13,110,178,0.5)',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
        boxShadow: 'inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)',
      }} />
      <span style={{
        padding: '0 2px',
        fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
        fontSize: 12, lineHeight: '16px', color: 'var(--blue-700)', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Shell wrapper ─────────────────────────────────────────────────────────────

interface WizardShellProps {
  steps: WizardStep[]
  children: React.ReactNode
}

export function WizardShell({ steps, children }: WizardShellProps) {
  const { push } = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)

  return (
    <div className="kaya-scrollbar" style={{
      background: 'rgba(255,255,255,0.2)',
      border: '1px solid var(--neutral-200)',
      borderRadius: 22,
      flex: '1 0 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 32,
      paddingLeft: 48,
      paddingRight: 48,
      paddingBottom: 32,
      minHeight: 0,
      overflowY: 'auto',
    }}>
      {/* Header: step indicators + close */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', marginBottom: 36, flexShrink: 0,
      }}>
        <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {steps.map(step => <StepBadge key={step.label} {...step} />)}
        </div>
        <button
          onClick={() => setCancelOpen(true)}
          aria-label="Close"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,255,255,0)', border: 'none', cursor: 'pointer',
            boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)', padding: 8,
          }}
        >
          <CancelOneIcon size={20} />
        </button>
      </div>

      {children}

      {cancelOpen && (
        <CancelCreationModal
          onCancel={() => {
            setCancelOpen(false)
            try { sessionStorage.removeItem('persona_wizard_draft') } catch { /* ignore */ }
            try { sessionStorage.removeItem('persona_wizard_starter') } catch { /* ignore */ }
            try { sessionStorage.removeItem('persona_wizard_repo') } catch { /* ignore */ }
            // Analytics: where the wizard loses people.
            trackBrowserEvent('agent_wizard_abandoned', { last_step: steps.find(s => s.state === 'active')?.label })
            push(AGENTS_ROUTE)
          }}
          onKeep={() => setCancelOpen(false)}
        />
      )}
    </div>
  )
}

// ── Shared step configs ───────────────────────────────────────────────────────

export const STEPS_TEMPLATE: WizardStep[] = [
  { label: 'Template',  state: 'active'    },
  { label: 'Basics',    state: 'future'    },
  { label: 'Configure', state: 'future'    },
]

export const STEPS_BASICS: WizardStep[] = [
  { label: 'Template',  state: 'completed' },
  { label: 'Basics',    state: 'active'    },
  { label: 'Configure', state: 'future'    },
]

export const STEPS_CONFIGURE: WizardStep[] = [
  { label: 'Template',  state: 'completed' },
  { label: 'Basics',    state: 'completed' },
  { label: 'Configure', state: 'active'    },
]
