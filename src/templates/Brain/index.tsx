'use client'

import React, { useCallback, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChatInput, type ChatInputProps } from '@/components/chat/ChatInput'
import { ExhaustionBanner } from '@/components/ExhaustionBanner'
import { BrainHome } from './BrainHome'
import { ClarificationCard, type ClarificationCardProps } from './ClarificationCard'
export { ClarificationCard, type ClarificationCardProps }
import { PlanCard, type PlanCardProps } from './PlanCard'
export { PlanCard, type PlanCardProps }
import { ActivityBlock, type ActivityBlockProps } from './ActivityBlock'
export { ActivityBlock, type ActivityBlockProps }
import { StreamingIndicator, type StreamingIndicatorProps, type StreamingPhase } from './StreamingIndicator'
export { StreamingIndicator, type StreamingIndicatorProps, type StreamingPhase }
import { PauseCard, type PauseCardProps } from './PauseCard'
export { PauseCard, type PauseCardProps }
import { NodeFailureCard, type NodeFailureCardProps } from './NodeFailureCard'
export { NodeFailureCard, type NodeFailureCardProps }
import { LoopHistoryCard, type LoopHistoryCardProps } from './LoopHistoryCard'
export { LoopHistoryCard, type LoopHistoryCardProps }
import { StreamingMessageBubble, type StreamingMessageBubbleProps } from './StreamingMessageBubble'
export { StreamingMessageBubble, type StreamingMessageBubbleProps }
import { PhaseRecord, type PhaseRecordProps, type PhaseRecordStatus } from './PhaseRecord'
export { PhaseRecord, type PhaseRecordProps, type PhaseRecordStatus }
import { BrainNarration, type BrainNarrationProps } from './BrainNarration'
export { BrainNarration, type BrainNarrationProps }
import { BrainTimeline, type BrainTimelineProps, type BrainTimelineItem, type BrainTimelineResult, type BrainTimelineResultVariant } from './BrainTimeline'
export { BrainTimeline, type BrainTimelineProps, type BrainTimelineItem, type BrainTimelineResult, type BrainTimelineResultVariant }
import { BrainPhaseGroup, type BrainPhaseGroupProps } from './BrainPhaseGroup'
export { BrainPhaseGroup, type BrainPhaseGroupProps }
import { ClarificationSummary, type ClarificationSummaryProps, type ClarificationSummaryItem, type ClarificationAnswerDisplay } from './ClarificationSummary'
export { ClarificationSummary, type ClarificationSummaryProps, type ClarificationSummaryItem, type ClarificationAnswerDisplay }
import { ArtifactCard, type ArtifactCardProps } from './ArtifactCard'
export { ArtifactCard, type ArtifactCardProps }
import { PinConfirmationCard, type PinConfirmationCardProps, type PinConfirmationPin } from './PinConfirmationCard'
export { PinConfirmationCard, type PinConfirmationCardProps, type PinConfirmationPin }
import { PersonaSelectionCard, type PersonaSelectionCardProps, type PersonaSelectionItem } from './PersonaSelectionCard'
export { PersonaSelectionCard, type PersonaSelectionCardProps, type PersonaSelectionItem }
import { BrainResultHeader, type BrainResultHeaderProps } from './BrainResultHeader'
export { BrainResultHeader, type BrainResultHeaderProps }
import { LoopCancelledCard, type LoopCancelledCardProps } from './LoopCancelledCard'
export { LoopCancelledCard, type LoopCancelledCardProps }
import { LoopFailedCard, type LoopFailedCardProps } from './LoopFailedCard'
export { LoopFailedCard, type LoopFailedCardProps }
import { ScheduleCard, type ScheduleCardProps } from './ScheduleCard'
export { ScheduleCard, type ScheduleCardProps }
import { ScheduleListView, type ScheduleListViewProps, type ScheduleListItem } from './ScheduleListView'
export { ScheduleListView, type ScheduleListViewProps, type ScheduleListItem }
import { ScheduleDetailView, type ScheduleDetailViewProps, type ScheduleDetailItem, type ScheduleRunRecord } from './ScheduleDetailView'
export { ScheduleDetailView, type ScheduleDetailViewProps, type ScheduleDetailItem, type ScheduleRunRecord }
import { PersonaActiveBar, type PersonaActiveBarProps } from './PersonaActiveBar'
export { PersonaActiveBar, type PersonaActiveBarProps }
import { ScheduleEditModal, type ScheduleEditModalProps, type ScheduleEditData } from './ScheduleEditModal'
export { ScheduleEditModal, type ScheduleEditModalProps, type ScheduleEditData }
import { ScheduleDeleteModal, type ScheduleDeleteModalProps } from './ScheduleDeleteModal'
export { ScheduleDeleteModal, type ScheduleDeleteModalProps }
import { ContextRail, type ContextRailProps, type ContextRailData, type ContextRailPersona, type ContextRailPin, type ContextRailConnector } from './ContextRail'
export { ContextRail, type ContextRailProps, type ContextRailData, type ContextRailPersona, type ContextRailPin, type ContextRailConnector }
import { InformationCircleIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { ExternalOutputCard, type ExternalOutputCardProps, type ExternalOutputAction } from './ExternalOutputCard'
export { ExternalOutputCard, type ExternalOutputCardProps, type ExternalOutputAction }
import { BrainDigestCard, type BrainDigestCardProps, type DigestItem } from './BrainDigestCard'
export { BrainDigestCard, type BrainDigestCardProps, type DigestItem }
import { FixProposalCard, type FixProposalCardProps, type FixProposalDiff } from './FixProposalCard'
export { FixProposalCard, type FixProposalCardProps, type FixProposalDiff }
import { LoopRecord, type LoopRecordProps } from './LoopRecord'
export { LoopRecord, type LoopRecordProps }
import { BrainProjectView, type BrainProjectViewProps, type ProjectThread } from './BrainProjectView'
export { BrainProjectView, type BrainProjectViewProps, type ProjectThread }
import { ProjectConfigPanel, type ProjectConfigPanelProps, type ProjectConfig } from './ProjectConfigPanel'
export { ProjectConfigPanel, type ProjectConfigPanelProps, type ProjectConfig }
import { StuckCard, type StuckCardProps } from './StuckCard'
export { StuckCard, type StuckCardProps }
import { type Phase } from './lib/phase'

// ── Phases where the ContextRail is visible ───────────────────────────────────
// Rail slides in once a plan exists (planning → complete), AND whenever any
// context is attached at page load (persona, pins, or connectors). The latter
// lets the rail show during idle / thinking / clarifying-goal too, so the
// user can see what's in scope before the first turn.
const CONTEXT_RAIL_PHASES = new Set<Phase>([
  'user-sent',
  'thinking',
  'clarifying-goal',
  'souvenir',
  'confirming-pins',
  'planning',
  'executing',
  'paused',
  'node-failed',
  'fix-proposed',
  'stuck',
  'streaming',
  'complete',
])

function hasAnyContext(data: ContextRailData | undefined): boolean {
  if (!data) return false
  return !!data.persona
      || (data.pins?.length ?? 0) > 0
      || (data.files?.length ?? 0) > 0
      || (data.connectors?.length ?? 0) > 0
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrainShellProps {
  /** Slot for the active thread content — rendered when phase !== 'idle'. */
  children?: React.ReactNode
  /** Disclaimer shown beneath the ChatInput. */
  disclaimer?: string
  /** Starting phase — used by Storybook to jump to a specific state. @default 'idle' */
  defaultPhase?: Phase
  /** Props forwarded to the ChatInput. */
  chatInputProps?: Partial<ChatInputProps>
  /**
   * Clarification question to show during the 'clarifying-goal' phase.
   * When provided and phase === 'clarifying-goal', replaces ChatInput with QuestionCard.
   */
  clarificationProps?: ClarificationCardProps
  /** Called when the user submits a message. Receives the text that was sent. */
  onSend?: (value: string) => void
  /** Real content for the ContextRail — persona, pins, connectors. */
  contextRailData?: ContextRailData
  /** Ref forwarded to the scrollable thread container — used by the page for auto-scroll. */
  threadRef?: React.RefObject<HTMLDivElement | null>
  /** Pre-populate the chat input with this text (e.g. from a schedule creation flow). */
  initialInputValue?: string
  /** Changes when the same initialInputValue should be applied again. */
  initialInputKey?: string | number
}

// ── Shell ─────────────────────────────────────────────────────────────────────

/**
 * Brain — top-level layout template.
 *
 * Mirrors ChatBoard's layout contract exactly:
 *   Sidebar (left) · Glass card center column · ContextRail (right, loop-only)
 *
 * The center column has the same inner glass container, absolute top bar,
 * 28px horizontal padding, and ChatInput-at-bottom structure as ChatBoard.
 * The thread slot (`children`) is empty by default; phase cards fill it.
 *
 * ContextRail slides in automatically when the phase enters the active-loop
 * set (planning → complete). It is never user-toggled.
 */
export function BrainShell({
  children,
  disclaimer        = 'Brain can make mistakes. Review important outputs.',
  defaultPhase      = 'idle',
  chatInputProps,
  clarificationProps,
  onSend,
  contextRailData,
  threadRef,
  initialInputValue,
  initialInputKey,
}: BrainShellProps) {
  const normalizedInitialInputValue = initialInputValue ?? ''
  const normalizedInitialInputKey = `${initialInputKey ?? ''}:${normalizedInitialInputValue}`
  const [optimisticPhase, setOptimisticPhase] = useState<{ basePhase: Phase; phase: Phase } | null>(null)
  const [inputState, setInputState] = useState({
    initialKey:   normalizedInitialInputKey,
    value:        normalizedInitialInputValue,
  })
  const [userClosed, setUserClosed] = useState(false)
  const phase = optimisticPhase?.basePhase === defaultPhase ? optimisticPhase.phase : defaultPhase
  const inputValue = inputState.initialKey === normalizedInitialInputKey
    ? inputState.value
    : normalizedInitialInputValue
  const setInputValue = useCallback((value: string) => {
    setInputState({ initialKey: normalizedInitialInputKey, value })
  }, [normalizedInitialInputKey])

  const contextRailOpen = (CONTEXT_RAIL_PHASES.has(phase) || hasAnyContext(contextRailData)) && !userClosed
  const isIdle          = phase === 'idle'
  const isClarifying    = phase === 'clarifying-goal' && clarificationProps != null

  const handleSend = (value: string) => {
    if (!value.trim()) return
    // idle → user-sent on send. Consumer drives subsequent phases.
    if (phase === 'idle') {
      setOptimisticPhase({ basePhase: defaultPhase, phase: 'user-sent' })
      setUserClosed(false)
    }
    setInputValue('')
    onSend?.(value)
  }

  const handleSuggestion = (text: string) => {
    setInputValue(text)
  }

  return (
    /* The left Sidebar is owned by the app shell (AppLayout → LeftSidebar) so it
       stays the SAME instance across Chats / Agents / Brain. BrainShell only
       renders the center column + ContextRail and fills the space the shell
       gives it. */
    <div style={{
      position:        'relative',
      display:         'flex',
      alignItems:      'stretch',
      flex:            '1 0 0',
      minWidth:        0,
      height:          '100svh',
      backgroundColor: 'var(--neutral-white)',
    }}>

      {/* ── Center — main Brain container ── */}
      {/* Matches ChatBoard center: neutral-50 bg, 10px vertical padding, flex col */}
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--neutral-50)',
        padding:         '10px 10px 10px 0',
      }}>

        {/* Inner glass card — identical spec to ChatBoard Figma 3220:33871 */}
        <div style={{
            position:        'relative',
            flex:            '1 0 0',
            minHeight:       0,
            display:         'flex',
            flexDirection:   'column',
            alignItems:      'flex-start',
            gap:             '2px',
            padding:         '12px',
            borderRadius:    '22px',
            border:          '1px solid var(--neutral-200)',
            backgroundColor: 'var(--color-surface-glass)',
            isolation:       'isolate',
        }}>

          {/* Content area — no horizontal padding; thread slot + bottom area each own theirs */}
          <div style={{
            display:       'flex',
            flex:          '1 0 0',
            minHeight:     0,
            flexDirection: 'column',
            alignItems:    'stretch',
            justifyContent:'flex-end',
            gap:           '12px',
            width:         '100%',
          }}>

            {/* Thread slot — spans full content-area width; scrollbar sits at glass card inner edge.
                Inner wrapper owns the 28px horizontal padding so content aligns with inputs below. */}
            <div
              ref={threadRef}
              data-slot="brain-thread"
              style={{
                flex:                '1 0 0',
                minHeight:           0,
                width:               '100%',
                overflowY:           'auto',
                overscrollBehaviorY: 'contain',
                scrollbarGutter:      'stable',
              }}
              className="kaya-scrollbar"
            >
              <div style={{
                maxWidth:   '810px',
                width:      '100%',
                margin:     '0 auto',
                paddingLeft:  28,
                paddingRight: 28,
                boxSizing:  'border-box',
              }}>
                {children ?? (isIdle ? <BrainHome onSuggestion={handleSuggestion} /> : null)}
              </div>
            </div>

            {/* Bottom area — ChatInput + disclaimer, padded to align with thread content */}
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           12,
              width:         '100%',
              paddingLeft:   28,
              paddingRight:  28,
            }}>
              <AnimatePresence mode="wait" initial={false}>
                {isClarifying ? (
                  <m.div
                    key="clarification"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
                    exit={{    opacity: 0, y: 6,  filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ width: '100%', maxWidth: '754px' }}
                  >
                    <ClarificationCard {...clarificationProps!} />
                  </m.div>
                ) : (
                  <m.div
                    key="chat-input"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
                    exit={{    opacity: 0, y: 6,  filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ width: '100%', maxWidth: '754px' }}
                  >
                    <ExhaustionBanner>
                      <ChatInput
                        placeholder="Tell Brain what to do"
                        textareaLabel="Brain instruction"
                        value={inputValue}
                        onChange={setInputValue}
                        onSend={handleSend}
                        {...chatInputProps}
                      />
                    </ExhaustionBanner>
                  </m.div>
                )}
              </AnimatePresence>

              <p style={{
                margin:     0,
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-caption)',
                lineHeight: 'var(--line-height-caption)',
                color:      'var(--neutral-600)',
                whiteSpace: 'nowrap',
              }}>
                {disclaimer}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Right — ContextRail info icon for connections/conenctors (loop-active only) ── */}
      {userClosed && (CONTEXT_RAIL_PHASES.has(phase) || hasAnyContext(contextRailData)) && (
        <div style={{ position: 'absolute', right: 35, top: 22, zIndex: 10 }}>
          <Tooltip content="View connections" side="left">
            <IconButton
              variant="ghost"
              size="sm"
              icon={<InformationCircleIcon size={20} />}
              aria-label="View connections"
              onClick={() => setUserClosed(false)}
            />
          </Tooltip>
        </div>
      )}
      <div className="kds-context-rail" data-open={contextRailOpen}>
        <div className="kds-context-rail-inner">
          <ContextRail data={contextRailData ?? {}} onClose={() => setUserClosed(true)} />
        </div>
      </div>

    </div>
  )
}

BrainShell.displayName = 'BrainShell'

export default BrainShell
