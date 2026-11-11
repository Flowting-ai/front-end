'use client'

import React from 'react'
import { AiIdeaIcon, CheckmarkCircleTwoIcon, TickTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { LinkButton } from '../LinkButton'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import chatStyles from '../chat/LibraryChat.module.css'
import { RUN_OUTPUTS_HREF } from './RoutineLibrarySections'

// ── Clarify ──────────────────────────────────────────────────────────────────

export type ClarifyAnswer = { question: string; answer: string }

export interface RoutineClarifyCardProps {
  /** What the assistant understood so far ("What should it make?" → "Product copy for new arrivals"). */
  answers: ClarifyAnswer[]
  /** The attach offer, naming the files ("Attach the Return policy and Shipping rates?"). */
  attachQuestion: string
  /** Names for the answered line ("Return policy 2026 and Shipping rates"). */
  attachNames: string
  /** null until answered. */
  attach: boolean | null
  /** The routine was created: answers are read-only. */
  done: boolean
  onAttach: (attach: boolean) => void
  onCreate: () => void
}

/** "Routine details": the plan, the offer to attach the files the chat used, and Create routine (off until answered). */
export function RoutineClarifyCard({ answers, attachQuestion, attachNames, attach, done, onAttach, onCreate }: RoutineClarifyCardProps) {
  return (
    <div className={chatStyles.card}>
      <div className={chatStyles.cardHead}>
        <AiIdeaIcon size={18} />
        {CHAT_MESSAGES.routineDetails}
      </div>
      {answers.map((item) => (
        <div className={chatStyles.cardQ} key={item.question}>
          <div className={chatStyles.q}>{item.question}</div>
          <div className={chatStyles.a}>{item.answer}</div>
        </div>
      ))}
      <div className={chatStyles.cardQ}>
        <div className={chatStyles.q}>{attachQuestion}</div>
        <div className={chatStyles.a}>
          {done ? (
            <span>{attach ? `Attached ${attachNames}` : CHAT_MESSAGES.noFilesAttachedShort}</span>
          ) : (
            <>
              <Button variant="secondary" size="sm" aria-pressed={attach === true} active={attach === true} leftIcon={attach === true ? <TickTwoIcon size={14} /> : undefined} onClick={() => onAttach(true)}>
                {CHAT_MESSAGES.attachBoth}
              </Button>
              <Button variant="secondary" size="sm" aria-pressed={attach === false} active={attach === false} leftIcon={attach === false ? <TickTwoIcon size={14} /> : undefined} onClick={() => onAttach(false)}>
                {CHAT_MESSAGES.notNow}
              </Button>
            </>
          )}
        </div>
      </div>
      {!done && (
        <div className={chatStyles.cardFoot}>
          <Button size="sm" disabled={attach === null} onClick={onCreate}>{CHAT_MESSAGES.createRoutine}</Button>
        </div>
      )}
    </div>
  )
}

// ── Created ──────────────────────────────────────────────────────────────────

export interface RoutineCreatedCardProps {
  title: string
  schedule: string
  deliversTo: string
  /** Names of attached files; empty shows "None". */
  attachedNames: string[]
  /** Link to the routine (Schedules page). */
  routineHref: string
  /** The test run saved a Run output. */
  testRunSaved?: boolean
}

/** "Routine created": the summary, Open routine, and Run outputs (All files filtered to Generated). */
export function RoutineCreatedCard({ title, schedule, deliversTo, attachedNames, routineHref, testRunSaved = true }: RoutineCreatedCardProps) {
  return (
    <div className={chatStyles.card}>
      <div className={chatStyles.cardHead}>
        <CheckmarkCircleTwoIcon size={18} className={chatStyles.okIcon} />
        {CHAT_MESSAGES.routineCreated}
      </div>
      <div className={chatStyles.cardLine}><b>Name</b>{title}</div>
      <div className={chatStyles.cardLine}><b>Schedule</b>{schedule}</div>
      <div className={chatStyles.cardLine}><b>Delivers to</b>{deliversTo}</div>
      <div className={chatStyles.cardLine}><b>{CHAT_MESSAGES.attachedFiles}</b>{attachedNames.length ? attachedNames.join(', ') : 'None'}</div>
      {testRunSaved && <div className={chatStyles.cardLine}><b>Test run</b><span>{CHAT_MESSAGES.testRunDone}</span></div>}
      <div className={chatStyles.cardFoot}>
        <LinkButton variant="default" size="sm" href={routineHref}>{CHAT_MESSAGES.openRoutine}</LinkButton>
        <LinkButton variant="secondary" size="sm" href={RUN_OUTPUTS_HREF}>{CHAT_MESSAGES.runOutputs}</LinkButton>
      </div>
    </div>
  )
}
