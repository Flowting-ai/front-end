'use client'

import { useMemo } from 'react'
import { useChatContext } from '@/lib/chat-context-store'
import type { ActivityStatus, UIMessage } from '@/types/chat'

// The agent's live browser for the open chat — the single seam the UI reads from. NOT
// wired yet. What the backend offers today (souvenir-server, services/skills/web):
//   • One E2B Chrome per user + site, driven by `browser_*` tools.
//   • A live view (noVNC page on the API origin, 36-min token) only via the
//     `browser_handover` tool: a `user_prompt` event, kind "confirm", carrying
//     `metadata.live_view_url`. It is interactive, for sign-in/captcha takeovers.
//   • `GET /chats/{chat_id}/browser/live` (still in devapi.json) was removed on the
//     backend on 2026-09-19; watching without a handover needs it back.
//
// Before linking, the API host has to be allowed by next.config.ts's CSP: there is no
// `frame-src` today, so `default-src 'self'` blocks the live-view iframe.

export type BrowserSessionStatus =
  /** No browser for this chat yet. */
  | 'idle'
  /** Live view requested; waiting for the URL / first frame. */
  | 'connecting'
  /** Live view URL in hand and framed. */
  | 'live'
  /** The live view expired or the sandbox shut down — can be resumed. */
  | 'ended'
  /** The live view could not be fetched. */
  | 'error'

/** `BrowserLiveViewResponse`, camel-cased. */
export interface BrowserLiveView {
  url:       string
  /** True when the viewer can watch but not drive the page (backend default). */
  viewOnly:  boolean
  expiresAt: string | null
}

export function toBrowserLiveView(raw: { url: string; view_only?: boolean; expires_at?: string | null }): BrowserLiveView {
  return { url: raw.url, viewOnly: raw.view_only ?? true, expiresAt: raw.expires_at ?? null }
}

/** One thing the agent did in the browser, from this chat's `browser` activities. */
export interface BrowserStep {
  id:     string
  label:  string
  status: ActivityStatus
}

export interface BrowserSession {
  status:   BrowserSessionStatus
  liveView: BrowserLiveView | null
  /** What the agent is doing in the browser right now, while a step is running. */
  currentAction?: string
  /** The page the agent is on, for the address bar. Unknown until the backend reports it. */
  pageUrl?: string
  /** Oldest first. */
  steps:    BrowserStep[]
  /** Re-request the live view after it ended or failed. */
  reconnect: () => void
}

const RUNNING: ReadonlySet<ActivityStatus> = new Set(['start', 'executing', 'reading'])
export const isRunningStep = (step: BrowserStep) => RUNNING.has(step.status)

/** The chat's browser activity as steps, oldest first. */
export function browserStepsOf(messages: UIMessage[]): BrowserStep[] {
  return messages
    .filter(message => message.role === 'assistant')
    .flatMap(message => message.activities ?? [])
    .filter(activity => activity.type === 'browser')
    .map((activity): BrowserStep => ({
      id:     activity.id,
      label:  activity.progressMessage || activity.label || activity.detail || 'Browsing',
      status: activity.status,
    }))
}

export function useBrowserSession(): BrowserSession {
  const { messages } = useChatContext()

  const steps = useMemo(() => browserStepsOf(messages), [messages])

  const current = steps.findLast(isRunningStep)

  // TODO(browser-live): drive status/liveView from the handover prompt's live_view_url (or
  // a restored watch endpoint — see the header). Until then the session stays idle.
  return {
    status:        'idle',
    liveView:      null,
    currentAction: current?.label,
    steps,
    reconnect:     () => {},
  }
}
