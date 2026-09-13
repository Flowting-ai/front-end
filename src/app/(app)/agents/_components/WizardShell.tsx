'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { m } from 'framer-motion'
import { CancelOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Tooltip } from '@/components/Tooltip'
import CancelCreationModal from './CancelCreationModal'
import { AGENTS_ROUTE } from '@/lib/routes'
import { trackBrowserEvent } from '@/lib/analytics/events'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepState = 'active' | 'completed' | 'future'

export interface WizardStep {
  label: string
  state: StepState
}

// ── Stepper ───────────────────────────────────────────────────────────────────
// Numbered circle + label per step, joined by a connecting line whose fill
// tracks progress (solid once the step before it is done). Circle reads at a
// glance: filled+check = done, ringed+number = here, flat+number = not yet.
// Each transition animates: the circle pops in on every state change, the
// connector wipes left-to-right when it fills, and the tick draws in
// TICK_DRAW_DELAY_MS after the circle fill lands — same two-beat pattern as
// Checkbox (src/components/Checkbox) so a completed step doesn't just snap.

const TICK_DRAW_DELAY_MS = 120

function StepNode({ index, label, state }: WizardStep & { index: number }) {
  const isActive    = state === 'active'
  const isCompleted = state === 'completed'

  const [tickOn, setTickOn] = useState(isCompleted)
  useEffect(() => {
    if (isCompleted) {
      const id = window.setTimeout(() => setTickOn(true), TICK_DRAW_DELAY_MS)
      return () => window.clearTimeout(id)
    }
    setTickOn(false)
  }, [isCompleted])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <m.div
        key={state}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isCompleted ? 'var(--blue-600)' : isActive ? 'var(--neutral-white)' : 'var(--neutral-100)',
          border: isCompleted ? 'none' : isActive ? '2px solid var(--blue-600)' : '1.5px solid var(--neutral-300)',
          boxShadow: isActive ? '0px 0px 0px 3px rgba(13,110,178,0.15)' : 'none',
        }}
      >
        {isCompleted ? (
          <span style={{ lineHeight: 0, opacity: tickOn ? 1 : 0, transition: 'opacity 100ms' }}>
            <TickTwoIcon size={12} color="var(--neutral-white)" triggered={tickOn} />
          </span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-semibold)',
            fontSize: 11,
            // Line-height matches the circle's diameter (not `1`) — flex
            // centering aligns the line box, and most fonts render a digit
            // off-center within a tight `lineHeight: 1` box. A line-height
            // equal to the container size is the reliable way to center it.
            lineHeight: '22px',
            color: isActive ? 'var(--blue-700)' : 'var(--neutral-400)',
            textAlign: 'center',
          }}>
            {index}
          </span>
        )}
      </m.div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)',
        fontSize: 13, lineHeight: '16px',
        color: isActive ? 'var(--blue-700)' : isCompleted ? 'var(--neutral-700)' : 'var(--neutral-400)',
        whiteSpace: 'nowrap',
        transition: 'color 200ms',
      }}>
        {label}
      </span>
    </div>
  )
}

function StepConnector({ filled }: { filled: boolean }) {
  return (
    <div style={{
      position: 'relative', width: 32, height: 1.5, flexShrink: 0, margin: '0 12px',
      background: 'var(--neutral-200)', borderRadius: 1, overflow: 'hidden',
    }}>
      <m.div
        initial={false}
        animate={{ scaleX: filled ? 1 : 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--blue-600)',
          transformOrigin: 'left',
        }}
      />
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
      paddingBottom: 32,
      minHeight: 0,
      overflowY: 'auto',
    }}>
      {/* Horizontal padding lives on this inner wrapper, not the scrolling
          element above — keeps the scrollbar flush with the card's border. */}
      <div style={{
        width: '100%', boxSizing: 'border-box',
        paddingLeft: 48, paddingRight: 48,
        display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 auto',
      }}>
        {/* Header: step indicators + close */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', marginBottom: 36, flexShrink: 0,
        }}>
          <div style={{ flex: '1 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {steps.map((step, i) => (
              <React.Fragment key={step.label}>
                <StepNode index={i + 1} {...step} />
                {i < steps.length - 1 && <StepConnector filled={step.state === 'completed'} />}
              </React.Fragment>
            ))}
          </div>
          <Tooltip content="Cancel creation" side="top" delayDuration={300}>
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
          </Tooltip>
        </div>

        {children}
      </div>

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
