'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import { AnimatePresence, m } from 'framer-motion'
import {
  WorkflowSquareTenIcon,
  AlertCircleIcon,
  CheckmarkCircleTwoIcon,
  CancelCircleIcon,
  TickTwoIcon,
  PenOneIcon,
  ArrowUpRightOneIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { springs } from '@/lib/springs'
import type { PlanStep, ConnectorRequirement } from './lib/phase'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(59,54,50,0.1)'

let planStepsAnimatedOnce = false

// ── Step grouping ─────────────────────────────────────────────────────────────
// Consecutive steps sharing the same parallelGroup string execute simultaneously.

type SequentialItem = { kind: 'step';     step:  PlanStep;   globalIndex: number }
type ParallelItem   = { kind: 'parallel'; steps: PlanStep[]; startIndex:  number }
type PlanItem = SequentialItem | ParallelItem

function groupSteps(steps: PlanStep[]): PlanItem[] {
  const result: PlanItem[] = []
  let i = 0
  while (i < steps.length) {
    const step = steps[i]
    if (!step.parallelGroup) {
      result.push({ kind: 'step', step, globalIndex: i })
      i++
    } else {
      const groupId    = step.parallelGroup
      const group      = [step]
      const startIndex = i
      while (i + 1 < steps.length && steps[i + 1].parallelGroup === groupId) {
        group.push(steps[++i])
      }
      result.push({ kind: 'parallel', steps: group, startIndex })
      i++
    }
  }
  return result
}

// ── StepCircle ────────────────────────────────────────────────────────────────

interface StepCircleProps {
  status: PlanStep['status']
  index:  number
  size?:  number
}

function StepCircle({ status, index, size = 28 }: StepCircleProps) {
  const base: React.CSSProperties = {
    width:          size,
    height:         size,
    borderRadius:   '50%',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }

  if (status === 'executing') {
    return <div style={base}><Spinner size={size - 10} color="var(--neutral-600)" /></div>
  }
  if (status === 'complete') {
    return <div style={base}><CheckmarkCircleTwoIcon size={size - 6} color="var(--color-tag-Green-text)" /></div>
  }
  if (status === 'failed') {
    return <div style={base}><CancelCircleIcon size={size - 6} color="var(--color-tag-Red-text)" /></div>
  }
  if (status === 'skipped') {
    return (
      <div style={{
        ...base,
        border:     '1.5px dashed var(--neutral-200)',
        color:      'var(--neutral-300)',
        fontSize:   size <= 22 ? '11px' : '12px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}>
        {'—'}
      </div>
    )
  }
  return (
    <div style={{
      ...base,
      border:     '1.5px solid var(--neutral-300)',
      color:      'var(--neutral-500)',
      fontSize:   size <= 22 ? '11px' : '12px',
      fontFamily: 'var(--font-body)',
      fontWeight: 500,
    }}>
      {index + 1}
    </div>
  )
}

// ── StepBadges — critical / needs-connection inline labels ─────────────────────

function StepBadges({ step }: { step: PlanStep }) {
  const needsAuth = !!step.requiresConnector && !step.requiresConnector.isConnected
  return (
    <>
      {step.isCritical && (
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
      {needsAuth && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <AlertCircleIcon size={12} color="var(--color-tag-Yellow-text)" />
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--color-tag-Yellow-text)',
          }}>
            Needs connection
          </span>
        </div>
      )}
    </>
  )
}

// ── ConnectorRow ──────────────────────────────────────────────────────────────

function ConnectorRow({ connector }: { connector: ConnectorRequirement }) {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             10,
      padding:         '8px 10px',
      borderRadius:    12,
      backgroundColor: 'var(--neutral-50)',
      border:          '1px solid var(--neutral-100)',
      marginTop:       6,
    }}>
      <div style={{
        width:           28,
        height:          28,
        borderRadius:    8,
        backgroundColor: 'var(--neutral-100)',
        flexShrink:      0,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
      }}>
        {connector.logoUrl
          ? <Image src={connector.logoUrl} alt="" width={20} height={20} unoptimized style={{ objectFit: 'contain' }} />
          : <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: 'var(--neutral-200)' }} />
        }
      </div>

      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-800)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {connector.name}
        </span>
        {connector.description && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--neutral-400)',
          }}>
            {connector.description}
          </span>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        rightIcon={<ArrowUpRightOneIcon />}
        onClick={connector.onConnect}
        style={{ flexShrink: 0 }}
      >
        Connect
      </Button>
    </div>
  )
}

// ── PlanStepRow ───────────────────────────────────────────────────────────────

interface PlanStepRowProps {
  step:      PlanStep
  index:     number
  isLast:    boolean
  animDelay: number
  dimmed:    boolean
}

function PlanStepRow({ step, index, isLast, animDelay, dimmed }: PlanStepRowProps) {
  const needsAuth = !!step.requiresConnector && !step.requiresConnector.isConnected

  return (
    <m.div
      style={{ overflow: 'hidden' }}
      initial={planStepsAnimatedOnce ? false : { height: 0 }}
      animate={{ height: 'auto' }}
      transition={{ ...springs.slow, delay: animDelay }}
    >
      <m.div
        initial={planStepsAnimatedOnce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: animDelay + 0.08, ease: 'easeOut' }}
      >
        <div style={{
          display:    'flex',
          gap:        10,
          opacity:    dimmed ? 0.45 : 1,
          transition: 'opacity 0.3s ease',
        }}>
          {/* Circle + connector line */}
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            flexShrink:    0,
            width:         28,
          }}>
            <StepCircle status={step.status} index={index} />
            {!isLast && (
              <div style={{
                flex:            '1 0 0',
                width:           1,
                backgroundColor: 'var(--neutral-200)',
                marginTop:       4,
                minHeight:       12,
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
            gap:           4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 'var(--font-weight-medium)',
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-800)',
              }}>
                {step.label}
              </span>
              <StepBadges step={step} />
            </div>

            {step.connector && !isLast && !needsAuth && (
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

            {needsAuth && <ConnectorRow connector={step.requiresConnector!} />}
          </div>
        </div>
      </m.div>
    </m.div>
  )
}

// ── CompactStepRow — used inside PlanParallelGroup ────────────────────────────

function CompactStepRow({ step, globalIndex }: { step: PlanStep; globalIndex: number }) {
  const needsAuth = !!step.requiresConnector && !step.requiresConnector.isConnected
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <StepCircle status={step.status} index={globalIndex} size={20} />

      <div style={{
        flex:          '1 0 0',
        minWidth:      0,
        paddingTop:    1,
        display:       'flex',
        flexDirection: 'column',
        gap:           3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-800)',
          }}>
            {step.label}
          </span>
          <StepBadges step={step} />
        </div>
        {needsAuth && <ConnectorRow connector={step.requiresConnector!} />}
      </div>
    </div>
  )
}

// ── PlanParallelGroup ─────────────────────────────────────────────────────────

interface PlanParallelGroupProps {
  steps:      PlanStep[]
  startIndex: number
  isLast:     boolean
  animDelay:  number
  dimmed:     boolean
}

function PlanParallelGroup({ steps, startIndex, isLast, animDelay, dimmed }: PlanParallelGroupProps) {
  return (
    <m.div
      style={{ overflow: 'hidden' }}
      initial={planStepsAnimatedOnce ? false : { height: 0 }}
      animate={{ height: 'auto' }}
      transition={{ ...springs.slow, delay: animDelay }}
    >
      <m.div
        initial={planStepsAnimatedOnce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, delay: animDelay + 0.08, ease: 'easeOut' }}
      >
        <div style={{
          display:    'flex',
          gap:        10,
          opacity:    dimmed ? 0.45 : 1,
          transition: 'opacity 0.3s ease',
        }}>
          {/* Left col — connector line only, no circle, flows through the group */}
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            flexShrink:     0,
            width:          28,
          }}>
            <div style={{
              flex:            '1 0 0',
              width:           1,
              backgroundColor: 'var(--neutral-200)',
              minHeight:       12,
            }} />
            {!isLast && (
              <div style={{
                flex:            '1 0 0',
                width:           1,
                backgroundColor: 'var(--neutral-200)',
                minHeight:       12,
              }} />
            )}
          </div>

          {/* Right col — group container */}
          <div style={{
            flex:          '1 0 0',
            minWidth:      0,
            paddingBottom: isLast ? 0 : 14,
            paddingTop:    2,
            display:       'flex',
            flexDirection: 'column',
            gap:           6,
          }}>
            {/* "Runs at the same time" label */}
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              fontStyle:  'italic',
              color:      'var(--neutral-400)',
              lineHeight: 'var(--line-height-caption)',
            }}>
              Runs at the same time
            </span>

            {/* Bracket container */}
            <div style={{
              paddingLeft:  12,
              borderLeft:   '1.5px solid var(--neutral-200)',
              display:      'flex',
              flexDirection:'column',
              gap:          10,
              paddingTop:   2,
              paddingBottom:2,
            }}>
              {steps.map((step, i) => (
                <CompactStepRow
                  key={step.id}
                  step={step}
                  globalIndex={startIndex + i}
                />
              ))}
            </div>
          </div>
        </div>
      </m.div>
    </m.div>
  )
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

export interface PlanCardProps {
  steps:           PlanStep[]
  interpretation?: string
  onApprove?:      () => void
  onCounter?:      () => void
  onCancel?:       () => void
  /** Disable all three action buttons. Used while the user_prompt is not
   *  yet available, or while a decision is mid-flight, to prevent races
   *  that would silently no-op on the backend. */
  actionsDisabled?: boolean
}

export function PlanCard({ steps, interpretation, onApprove, onCounter, onCancel, actionsDisabled = false }: PlanCardProps) {
  const items           = groupSteps(steps)
  const allConnected = steps.every(s => !s.requiresConnector || s.requiresConnector.isConnected)

  useEffect(() => { planStepsAnimatedOnce = true }, [])

  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    24,
      padding:         20,
      boxShadow:       CARD_SHADOW,
      maxWidth:        '100%',
      display:         'flex',
      flexDirection:   'column',
      gap:             12,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <WorkflowSquareTenIcon size={14} color="var(--neutral-400)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          color:      'var(--neutral-500)',
          lineHeight: 'var(--line-height-caption)',
        }}>
          Plan
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          color:      'var(--neutral-300)',
          lineHeight: 'var(--line-height-caption)',
          marginLeft: 'auto',
        }}>
          {steps.length} step{steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Interpretation */}
      {interpretation && (
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          fontStyle:  'italic',
          color:      'var(--neutral-600)',
          lineHeight: 'var(--line-height-body)',
        }}>
          {interpretation}
        </p>
      )}

      {/* Steps — grouped */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, itemIndex) => {
          const isLast    = itemIndex === items.length - 1
          const dimmed    = itemIndex > 0
          const animDelay = 0.12 + itemIndex * 0.08

          if (item.kind === 'step') {
            return (
              <PlanStepRow
                key={item.step.id}
                step={item.step}
                index={item.globalIndex}
                isLast={isLast}
                animDelay={animDelay}
                dimmed={dimmed}
              />
            )
          }
          return (
            <PlanParallelGroup
              key={item.steps[0].id}
              steps={item.steps}
              startIndex={item.startIndex}
              isLast={isLast}
              animDelay={animDelay}
              dimmed={dimmed}
            />
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={actionsDisabled}>Cancel</Button>
          <div style={{ flex: '1 0 0' }} />
          <Button variant="outline" size="sm" rightIcon={<PenOneIcon />} onClick={onCounter} disabled={actionsDisabled}>Counter</Button>
          <Button
            variant="default"
            size="sm"
            rightIcon={<TickTwoIcon />}
            disabled={!allConnected || actionsDisabled}
            onClick={onApprove}
          >
            Approve
          </Button>
        </div>

      </div>
    </div>
  )
}

PlanCard.displayName = 'PlanCard'
