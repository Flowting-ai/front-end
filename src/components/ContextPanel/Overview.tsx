'use client'

import { useMemo, useState } from 'react'
import { DownloadOneIcon, FileTwoIcon, ImageTwoIcon, ShapesOneIcon } from '@strange-huge/icons'
import { SourceFileRow } from '@/components/Library/chat/SourceFileRow'
import { useChatLibrarySources, type ChatLibrarySources } from '@/components/Library/chat/useChatLibrarySources'
import { Spinner } from '@/components/Spinner'
import { Tooltip } from '@/components/Tooltip'
import { useChatContext, turnTiming, type TurnTiming } from '@/lib/chat-context-store'
import { toConnector } from '@/lib/connector'
import type { UIMessage } from '@/types/chat'
import { useUnmountTimeouts } from '@/hooks/use-unmount-timeouts'
import { openChatFilePanel } from '@/lib/library/chat-file-panel'
import { CHAT_MESSAGES } from '@/lib/library/messages'
import type { SourceRow } from '@/lib/library/sources'
import { AgentFace, ConnectorLogo, connectorSpecialistSlug, useConnectorIdentities } from './identity'
import { AnimatedList, EmptyHint, ItemRow, PanelCard, PanelSection } from './overview/blocks'
import { deriveOverview, downloadFile, extensionOf, formatElapsed, stepCount, turnState, type SourceItem, type UploadItem } from './overview/derive'
import { useExecutionSeconds, useShowAll, type SectionKey } from './overview/hooks'
import { Favicon, PlanList, statusAside, TurnStatus } from './overview/marks'
import { ROW_CLASS, TEXT } from './overview/styles'

// The Context panel's overview: one card of collapsible sections — what the latest turn
// is doing, and the agents, connectors, sources, outputs and skills the chat has used.
// Everything comes from the activity the chat already streams (see use-streaming-chat),
// so it reflects this session's turns; a chat reloaded from history shows what its saved
// messages carry (sources, files) but no tool activity until it runs again.
// The pieces live in ./overview: derive (pure data), blocks (card, section, row), marks
// (status marks and the to-do list), hooks (elapsed time, "Show more").

export { AnimatedList, EmptyHint, ItemRow, PanelCard, PanelSection } from './overview/blocks'
export { deriveOverview, downloadFile, formatElapsed, isRunning, stepCount, turnState } from './overview/derive'
export type { OutputItem, OverviewData, SourceItem, TurnState, UploadItem } from './overview/derive'
export { StepIcon, stepLabelStyle } from './overview/marks'

// ── Overview ──────────────────────────────────────────────────────────────────

/** The overview for the open chat. */
export function OverviewTab() {
  const { chatId, messages } = useChatContext()
  const latest = messages.filter(message => message.role === 'assistant').at(-1)
  // Read here, while the panel is open, so names load before Sources is even expanded.
  const library = useChatLibrarySources(chatId, messages)
  return <OverviewView messages={messages} timing={turnTiming(latest)} library={library} />
}

type SourceEntry =
  | { kind: 'file'; key: string; row: SourceRow; toggle: (fileId: string) => void }
  | { kind: 'upload'; key: string; upload: UploadItem }
  | { kind: 'web'; key: string; source: SourceItem }

export function OverviewView({ messages, timing, library }: {
  messages: UIMessage[]
  timing:   TurnTiming | undefined
  /** The chat's Library files (useChatLibrarySources); listed in Sources above the web pages. */
  library?: ChatLibrarySources
}) {
  const showAll = useShowAll()
  // Download all is staggered; closing the panel cancels the downloads not yet started.
  const later = useUnmountTimeouts()
  const data = useMemo(() => deriveOverview(messages), [messages])

  const state = turnState(data.latest)
  const seconds = useExecutionSeconds(timing, state === 'working')

  // Catalog names + logos for every app used, and for connector-specialist agents.
  const identities = useConnectorIdentities(
    data.connectors.map(connector => connector.slug),
    data.agents.flatMap(agent => connectorSpecialistSlug(agent.agentHandle) ?? []),
  )

  const counts: Record<SectionKey, number> = {
    progress:   data.plan?.length ?? 0,
    agents:     data.agents.length,
    connectors: data.connectors.length,
    sources:    (library?.count ?? 0) + data.uploads.length + data.sources.length,
    outputs:    data.outputs.length,
    skills:     data.skills.length,
  }

  // A section opens on its own once it has something in it; after the viewer toggles it,
  // their choice sticks.
  const [toggled, setToggled] = useState<Partial<Record<SectionKey, boolean>>>({})
  const isOpen = (key: SectionKey) => toggled[key] ?? (key === 'progress' || counts[key] > 0)
  const section = (key: SectionKey) => ({
    open:     isOpen(key),
    onToggle: () => setToggled(current => ({ ...current, [key]: !isOpen(key) })),
  })

  if (messages.length === 0) {
    return (
      <PanelCard>
        <p style={{ ...TEXT, color: 'var(--neutral-500)', padding: 14 }}>
          Nothing here yet. To-dos, agents, connectors, sources and outputs for this chat show up as soon as it starts working.
        </p>
      </PanelCard>
    )
  }

  // What the chat was given first (its Library files, then other uploads), then the web pages it
  // read; "Show more" folds them all.
  const sources: SourceEntry[] = [
    ...(library ? library.rows.map(row => ({ kind: 'file' as const, key: `file:${row.id}`, row, toggle: library.toggle })) : []),
    ...data.uploads.map(upload => ({ kind: 'upload' as const, key: upload.key, upload })),
    ...data.sources.map(source => ({ kind: 'web' as const, key: source.key, source })),
  ]

  return (
    <PanelCard>
      <PanelSection
        first
        title="To-dos"
        aside={<TurnStatus state={state} seconds={seconds} count={stepCount(data.plan)} />}
        loading={state === 'working'}
        {...section('progress')}
      >
        {data.plan && <PlanList plan={data.plan} steps={data.steps} />}
      </PanelSection>

      <PanelSection title="Agents" count={counts.agents} {...section('agents')}>
        {data.agents.length === 0 ? <EmptyHint>No agents were asked to help.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('agents', data.agents).map(agent => (
              <ItemRow
                key={agent.id}
                icon={<AgentFace name={agent.label || 'Agent'} handle={agent.agentHandle} connector={identities.get(connectorSpecialistSlug(agent.agentHandle) ?? '')} />}
                label={agent.label || 'Agent'}
                detail={agent.detail !== agent.label ? agent.detail : undefined}
                right={statusAside(agent, agent.durationS ? formatElapsed(Math.round(agent.durationS)) : undefined)}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('agents', data.agents, 'agents')}
      </PanelSection>

      <PanelSection title="Connectors" count={counts.connectors} {...section('connectors')}>
        {data.connectors.length === 0 ? <EmptyHint>No connected apps were used.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('connectors', data.connectors).map(connector => (
              <ItemRow
                key={connector.slug}
                icon={<ConnectorLogo connector={identities.get(connector.slug) ?? toConnector(connector.slug)} />}
                label={identities.get(connector.slug)?.name ?? connector.name}
                right={connector.active ? <Spinner size={12} color="var(--blue-500)" />
                  : connector.failed ? <span style={{ color: 'var(--red-400)' }}>Failed</span>
                  : connector.used > 1 ? `${connector.used} calls` : '1 call'}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('connectors', data.connectors, 'connectors')}
      </PanelSection>

      <PanelSection title="Sources" count={counts.sources} {...section('sources')}>
        {sources.length === 0 ? <EmptyHint>{CHAT_MESSAGES.noSourcesYet}</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('sources', sources).map(entry => entry.kind === 'file' ? (
              <SourceFileRow key={entry.key} row={entry.row} onToggle={entry.toggle} onOpen={openChatFilePanel} />
            ) : entry.kind === 'upload' ? (
              <ItemRow
                key={entry.key}
                onClick={entry.upload.url ? () => downloadFile(entry.upload.url!, entry.upload.name) : undefined}
                icon={entry.upload.image ? <ImageTwoIcon size={16} /> : <FileTwoIcon size={16} />}
                label={entry.upload.name}
                detail={[CHAT_MESSAGES.attached, extensionOf(entry.upload.name)].filter(Boolean).join(' · ')}
              />
            ) : (
              <ItemRow key={entry.key} href={entry.source.url} icon={<Favicon domain={entry.source.domain} />} label={entry.source.title} detail={entry.source.domain} />
            ))}
          </AnimatedList>
        )}
        {showAll.more('sources', sources, 'sources')}
      </PanelSection>

      <PanelSection
        title="Outputs"
        count={counts.outputs}
        action={data.outputs.length > 1 && (
          <Tooltip content={`Download all ${data.outputs.length}`}>
            <button
              type="button"
              aria-label={`Download all ${data.outputs.length} outputs`}
              onClick={() => data.outputs.forEach((doc, index) => later(() => downloadFile(doc.url, doc.name), index * 250))}
              className={ROW_CLASS}
              style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, cursor: 'pointer', color: 'var(--neutral-500)' }}
            >
              <DownloadOneIcon size={16} />
            </button>
          </Tooltip>
        )}
        {...section('outputs')}
      >
        {data.outputs.length === 0 ? <EmptyHint>Nothing created yet.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('outputs', data.outputs).map(doc => (
              <ItemRow
                key={doc.key}
                onClick={() => downloadFile(doc.url, doc.name)}
                icon={doc.image ? <ImageTwoIcon size={16} /> : <FileTwoIcon size={16} />}
                label={doc.name}
                detail={['Created', extensionOf(doc.name)].filter(Boolean).join(' · ')}
                right={<span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" style={{ display: 'inline-flex' }}><DownloadOneIcon size={16} /></span>}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('outputs', data.outputs, 'outputs')}
      </PanelSection>

      <PanelSection title="Skills" count={counts.skills} {...section('skills')}>
        {data.skills.length === 0 ? <EmptyHint>No skills were loaded.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('skills', data.skills).map(({ name, activity }) => (
              <ItemRow
                key={name}
                icon={<ShapesOneIcon size={16} />}
                label={name}
                right={statusAside(activity)}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('skills', data.skills, 'skills')}
      </PanelSection>
    </PanelCard>
  )
}
