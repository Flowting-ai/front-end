'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs'
import { AgentsPanelContent } from '@/components/AgentsPanel'
import { BrowserScreen } from '@/components/BrowserPanel/BrowserScreen'
import { useBrowserSession, type BrowserSession } from '@/components/BrowserPanel/use-browser-session'
import { setChatPanelTab, useChatPanelTab, type ChatPanelTab } from '@/lib/chat-panel-tab'
import { AnimatedList, ItemRow, OverviewTab, PanelCard, PanelSection, StepIcon, stepLabelStyle } from './Overview'

// The chat's right-hand panel, with Context · Browser · Agents in tabs at its top. Context (see
// ./Overview) shows what the current turn is doing and what the chat has used; Browser shows the
// agent's live screen; Agents lists the agents the viewer can bring into the chat.
// Which tab shows lives in lib/chat-panel-tab, so whatever opens the panel can choose it.

export function ContextPanelContent({ inProject = false, agentsDisabled = false }: {
  /** A project chat: Agents lists the project's agents too. */
  inProject?:      boolean
  /** A read-only chat: agents can't be added, so the Agents tab is disabled. */
  agentsDisabled?: boolean
}) {
  const session = useBrowserSession()

  // Until a tab is chosen, follow the agent: once it opens a browser, show it.
  // A chosen tab always wins after that.
  const chosenTab = useChatPanelTab()
  const followed: ChatPanelTab = session.status === 'idle' ? 'context' : 'browser'
  const tab: ChatPanelTab = chosenTab === 'agents' && agentsDisabled ? followed : chosenTab ?? followed
  const browserActive = session.status === 'live' || session.status === 'connecting'

  return (
    // Full panel height, so Agents (which sizes its own scrolling list to its box) gets the space
    // under the tab bar; Context and Browser just flow and let the panel scroll.
    <Tabs value={tab} onValueChange={value => setChatPanelTab(value as ChatPanelTab)} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <TabsList fluid size="small" aria-label="Chat panel views">
        <TabsTrigger value="context">Context</TabsTrigger>
        <TabsTrigger value="browser">
          Browser
          {browserActive && (
            <>
              <span
                aria-hidden
                style={{ position: 'absolute', top: 1, right: -6, width: 6, height: 6, borderRadius: 999, backgroundColor: session.status === 'live' ? 'var(--green-500)' : 'var(--blue-500)' }}
              />
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                {session.status === 'live' ? ', live' : ', connecting'}
              </span>
            </>
          )}
        </TabsTrigger>
        <TabsTrigger value="agents" disabled={agentsDisabled}>Agents</TabsTrigger>
      </TabsList>
      {/* Context and Browser stay mounted so switching tabs never drops the live view's connection. */}
      <TabsContent value="context" forceMount hidden={tab !== 'context'}>
        <OverviewTab />
      </TabsContent>
      <TabsContent value="browser" forceMount hidden={tab !== 'browser'}>
        <BrowserTab session={session} />
      </TabsContent>
      <TabsContent value="agents" style={{ flex: '1 1 0', minHeight: 0 }}>
        <AgentsPanelContent inProject={inProject} />
      </TabsContent>
    </Tabs>
  )
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try { return new URL(url).host } catch { return undefined }
}

function BrowserTab({ session }: { session: BrowserSession }) {
  const [expandRequested, setExpanded] = useState(false)
  // Nothing left to watch (e.g. the chat changed under the panel) — stay in the panel.
  const expanded = expandRequested && session.status !== 'idle'
  const [stepsOpen, setStepsOpen] = useState(true)

  const busy = session.status === 'live' || session.status === 'connecting'
  const host = hostOf(session.pageUrl)
  // Who is on the screen and what it is doing; nothing while no browser is running (the screen
  // itself says so).
  const label = busy && session.currentAction ? session.currentAction : session.control ? 'Your browser' : 'Agent’s screen'
  const mode = session.status === 'live' ? (session.control ? 'You’re driving' : 'Watching') : session.status === 'connecting' ? 'Connecting…' : null
  const dot = session.status === 'live' ? 'var(--green-500)' : session.status === 'connecting' ? 'var(--blue-500)' : 'var(--neutral-300)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BrowserScreen session={session} expanded={expanded} onExpandedChange={setExpanded} />
        {session.status !== 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '2px 6px' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, backgroundColor: dot, boxShadow: session.status === 'live' ? '0 0 0 3px color-mix(in srgb, var(--green-500) 20%, transparent)' : undefined }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 0' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
              </p>
              {mode && (
                <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>{mode}</p>
              )}
            </div>
            {host && (
              <span style={{ flexShrink: 1, minWidth: 0, maxWidth: '45%', padding: '2px 8px', borderRadius: 999, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {host}
              </span>
            )}
          </div>
        )}
      </div>

      {session.steps.length > 0 && (
        <PanelCard>
          <PanelSection first title="Browser steps" count={session.steps.length} open={stepsOpen} onToggle={() => setStepsOpen(open => !open)}>
            <AnimatedList>
              {session.steps.map(step => (
                <ItemRow key={step.id} wrap icon={<StepIcon status={step.status} />} label={step.label} labelStyle={stepLabelStyle(step.status)} />
              ))}
            </AnimatedList>
          </PanelSection>
        </PanelCard>
      )}

    </div>
  )
}
