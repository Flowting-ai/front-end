'use client'

import React from 'react'
import { m } from 'framer-motion'
import {
  WorkflowSquareTenIcon,
  AlertCircleIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
} from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'
import { StreamingIndicator as ModelStreamingIndicator } from '@/components/StreamingIndicator'
import { getModelLlmId } from '@/lib/model-icons'
import { springs } from '@/lib/springs'
import type { PlanStep } from './lib/phase'

// ── Step status circle (live variant — no auth rows, no dimming) ───────────────

interface LiveStepCircleProps {
  status: PlanStep['status']
  index:  number
}

function LiveStepCircle({ status, index }: LiveStepCircleProps) {
  const base: React.CSSProperties = {
    width:          28,
    height:         28,
    borderRadius:   '50%',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }

  if (status === 'executing') {
    return <div style={base}><Spinner size={18} color="var(--neutral-600)" /></div>
  }
  if (status === 'complete') {
    return <div style={base}><CheckmarkCircleTwoIcon size={22} color="var(--color-tag-Green-text)" /></div>
  }
  if (status === 'failed') {
    return <div style={base}><CancelCircleIcon size={22} color="var(--color-tag-Red-text)" /></div>
  }
  if (status === 'skipped') {
    return (
      <div style={{
        ...base,
        border:     '1.5px dashed var(--neutral-200)',
        color:      'var(--neutral-300)',
        fontSize:   '12px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}>
        {'—'}
      </div>
    )
  }
  // pending / upcoming
  return (
    <div style={{
      ...base,
      border:     '1.5px solid var(--neutral-200)',
      color:      'var(--neutral-400)',
      fontSize:   '12px',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
    }}>
      {index + 1}
    </div>
  )
}

// ── LiveStepRow ────────────────────────────────────────────────────────────────

interface LiveStepRowProps {
  step:    PlanStep
  index:   number
  isLast:  boolean
}

function NodeModelIndicator({ step }: { step: PlanStep }) {
  const modelName = step.modelName || 'Model'
  const llmId = getModelLlmId(step.modelCompany, step.modelName)
  const isWorking = step.status === 'executing'

  return (
    <ModelStreamingIndicator
      phase={isWorking ? 'streaming' : 'complete'}
      label={isWorking ? `${modelName} · Working…` : modelName}
      llmId={llmId ?? undefined}
      style={{ marginTop: 2 }}
    />
  )
}

function LiveStepRow({ step, index, isLast }: LiveStepRowProps) {
  const isActive = step.status === 'executing'
  const isDone   = step.status === 'complete' || step.status === 'skipped'
  const isFailed = step.status === 'failed'

  return (
    <div style={{
      display:    'flex',
      gap:        10,
      // Active step gets a very subtle warm background to signal "this is running"
      backgroundColor: isActive ? 'var(--neutral-50)' : 'transparent',
      borderRadius:    isActive ? 12 : 0,
      padding:         isActive ? '4px 6px 4px 4px' : '0',
      margin:          isActive ? '0 -6px' : '0',
      transition:      'background-color 150ms ease',
    }}>
      {/* Circle + connector */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        flexShrink:    0,
        width:         28,
      }}>
        <LiveStepCircle status={step.status} index={index} />
        {!isLast && (
          <div style={{
            flex:            '1 0 0',
            width:           1,
            // Completed connector is slightly darker; upcoming is lighter
            backgroundColor: isDone
              ? 'var(--neutral-300)'
              : 'var(--neutral-200)',
            marginTop:       4,
            minHeight:       12,
            transition:      'background-color 150ms ease',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex:          '1 0 0',
        minWidth:      0,
        paddingTop:    4,
        paddingBottom: isLast ? 0 : 14,
        display:       'flex',
        flexDirection: 'column',
        gap:           3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-body)',
            fontWeight:  isActive ? 'var(--font-weight-medium)' : 400,
            lineHeight:  'var(--line-height-body)',
            color:       isFailed
              ? 'var(--color-tag-Red-text)'
              : isDone
                ? 'var(--neutral-500)'
                : 'var(--neutral-800)',
            textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
            transition:  'color 150ms ease',
          }}>
            {step.label}
          </span>
          {step.isCritical && isFailed && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <AlertCircleIcon size={12} color="var(--color-tag-Red-text)" />
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--color-tag-Red-text)',
              }}>
                Critical
              </span>
            </div>
          )}
        </div>

        {isActive && step.streamDetail && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
            fontStyle:  'italic',
          }}>
            {step.streamDetail}
          </span>
        )}

        {(step.modelId || step.modelName) && (
          <NodeModelIndicator step={step} />
        )}

        {step.connector && isActive && !step.connectorDisclosure?.length && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            fontStyle:  'italic',
            color:      'var(--neutral-400)',
            lineHeight: 'var(--line-height-caption)',
          }}>
            via {step.connector}
          </span>
        )}

        {step.connectorDisclosure && step.connectorDisclosure.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {step.connectorDisclosure.map(c => (
              <span key={c} style={{
                fontFamily:      'var(--font-body)',
                fontSize:        'var(--font-size-caption)',
                lineHeight:      'var(--line-height-caption)',
                color:           'var(--neutral-400)',
                backgroundColor: 'var(--neutral-100)',
                borderRadius:    4,
                padding:         '1px 6px',
              }}>
                via {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityBlockProps {
  steps:           PlanStep[]
  interpretation?: string
}

// ── ActivityBlock ─────────────────────────────────────────────────────────────

export function ActivityBlock({ steps, interpretation }: ActivityBlockProps) {
  const doneCount      = steps.filter(s => s.status === 'complete' || s.status === 'skipped').length

  return (
    <m.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={springs.moderate}
      style={{
        display:        'flex',
        flexDirection:  'column',
        gap:            12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <WorkflowSquareTenIcon size={14} color="var(--neutral-400)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-600)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          Running
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
          marginLeft: 'auto',
        }}>
          {doneCount} / {steps.length}
        </span>
      </div>

      {/* Interpretation — Brain's stated goal */}
      {interpretation && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontStyle:  'italic',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {interpretation}
        </p>
      )}

      {/* Steps — no mount animation, steps were already shown in PlanCard */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, i) => (
          <LiveStepRow
            key={step.id}
            step={step}
            index={i}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>
    </m.div>
  )
}

ActivityBlock.displayName = 'ActivityBlock'
