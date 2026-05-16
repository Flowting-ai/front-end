'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PlusSignIcon,
  SearchOneIcon,
  DownloadOneIcon,
  FilterMailIcon,
  ArrowRightOneIcon,
} from '@strange-huge/icons'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorScope = 'workspace' | 'personal'
export type ConnectorLogo = 'figma' | 'slack' | 'cursor' | 'generic'

export type Connector = {
  id: string
  name: string
  description: string
  logo: ConnectorLogo
  scope: ConnectorScope
  workspaceName?: string   // workspace scope only
  authorized?: boolean     // personal scope: user is signed into the service
  enabled?: boolean        // personal + authorized: toggle is on/off
}

type ConnectorsTabProps = {
  connectors: Connector[]
  onChange: (next: Connector[]) => void
}

// ── Brand logo marks ──────────────────────────────────────────────────────────

function FigmaMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 38) / 26} viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M6.5 38a6.5 6.5 0 0 0 6.5-6.5V25H6.5a6.5 6.5 0 0 0 0 13Z" fill="#0ACF83" />
      <path d="M0 19a6.5 6.5 0 0 1 6.5-6.5H13v13H6.5A6.5 6.5 0 0 1 0 19Z" fill="#A259FF" />
      <path d="M0 6.5A6.5 6.5 0 0 1 6.5 0H13v13H6.5A6.5 6.5 0 0 1 0 6.5Z" fill="#F24E1E" />
      <path d="M13 0h6.5a6.5 6.5 0 0 1 0 13H13V0Z" fill="#FF7262" />
      <path d="M26 19a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" fill="#1ABCFE" />
    </svg>
  )
}

function SlackMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52ZM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313Z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834ZM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312Z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834ZM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312Z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52ZM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313Z" fill="#ECB22E" />
    </svg>
  )
}

function CursorMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M11.925.087 2.397 5.5v13l9.528 5.5 9.527-5.5v-13L11.925.087Z" fill="#000" />
    </svg>
  )
}

function GenericMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#827a74" strokeWidth={1.5} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function LogoBox({ logo }: { logo: ConnectorLogo }) {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        flexShrink: 0,
        backgroundColor: 'white',
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {logo === 'figma'  ? <FigmaMark size={20} /> :
       logo === 'slack'  ? <SlackMark size={22} /> :
       logo === 'cursor' ? <CursorMark size={22} /> :
                           <GenericMark size={22} />}
    </div>
  )
}

// ── Small primitives ──────────────────────────────────────────────────────────

function StatusBadge({ tone, children }: { tone: 'neutral' | 'yellow'; children: React.ReactNode }) {
  const tones = {
    neutral: { bg: 'var(--neutral-100)', fg: 'var(--neutral-700)', edge: 'rgba(106,98,93,0.5)', innerTop: 'rgba(247,242,237,0.7)', innerBot: 'rgba(106,98,93,0.1)' },
    yellow:  { bg: 'var(--yellow-100)',  fg: 'var(--yellow-700)',  edge: 'rgba(143,116,39,0.5)', innerTop: 'rgba(250,246,235,0.7)', innerBot: 'rgba(143,116,39,0.1)' },
  } as const
  const c = tones[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 20,
        padding: '0 4px',
        borderRadius: 6,
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: '16px',
        color: c.fg,
        backgroundColor: c.bg,
        boxShadow: `0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px ${c.edge}, inset 0px 1px 0px 0px ${c.innerTop}, inset 0px -1px 0px 0px ${c.innerBot}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 34,
        height: 20,
        flexShrink: 0,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        borderRadius: 20,
        backgroundColor: on ? 'var(--blue-400)' : 'var(--neutral-200)',
        boxShadow: on
          ? '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.7), inset 0px 1px 0px 0px rgba(202,220,241,0.43), inset 0px -1px 0px 0px rgba(18,60,95,0.15)'
          : '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(106,98,93,0.4)',
        transition: 'background-color 150ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: 9.5,
          backgroundColor: 'white',
          boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px rgba(19,84,135,0.4), inset 0px -1px 0px 0px rgba(18,60,95,0.15)',
          transition: 'left 150ms',
        }}
      />
    </button>
  )
}

// Dark-gradient primary button (matches Continue / Add connectors / Publish style).
function PrimaryDarkButton({
  children,
  leftIcon,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode
  leftIcon?: React.ReactNode
  onClick?: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 10px 8px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow:
          '0px 0px 0px 1px var(--neutral-black, black), 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4)',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)', pointerEvents: 'none' }} />
      {leftIcon && <span style={{ position: 'relative', display: 'inline-flex' }}>{leftIcon}</span>}
      <span
        style={{
          position: 'relative',
          padding: '0 2px',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 14,
          lineHeight: '22px',
          color: 'var(--neutral-50)',
          textShadow: '0px -0.727px 0.364px rgba(0,0,0,0.25), 0px 0.364px 0.364px rgba(255,255,255,0.25)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </button>
  )
}

// ── Row + inline prompt ───────────────────────────────────────────────────────

function ConnectorRow({
  connector,
  onToggle,
  onConnect,
}: {
  connector: Connector
  onToggle: () => void
  onConnect: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        padding: '0 12px',
        borderRadius: 12,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flex: '1 0 0', minWidth: 0, gap: 8, alignItems: 'center' }}>
        <LogoBox logo={connector.logo} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#3b3632', margin: 0 }}>
            {connector.name}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: 'var(--neutral-500)', margin: 0 }}>
            {connector.description}
          </p>
        </div>
      </div>

      {connector.scope === 'workspace' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {connector.workspaceName && (
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6a625d', whiteSpace: 'nowrap' }}>
              {connector.workspaceName}
            </span>
          )}
          <StatusBadge tone="neutral">Connected</StatusBadge>
        </div>
      ) : connector.authorized ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <StatusBadge tone="yellow">{connector.enabled ? 'ON' : 'OFF'}</StatusBadge>
          <ToggleSwitch on={!!connector.enabled} onChange={onToggle} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '5px 8px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
            flexShrink: 0,
          }}
        >
          <span style={{ padding: '0 2px', fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '22px', color: '#3b3632', whiteSpace: 'nowrap' }}>
            Connect
          </span>
          <ArrowRightOneIcon size={16} color="#3b3632" />
        </button>
      )}
    </div>
  )
}

function ConnectPrompt({ connector }: { connector: Connector }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 12px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, lineHeight: '21px', letterSpacing: '0.07px', color: '#0a0a0a', margin: 0 }}>
          Connect {connector.name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 11, lineHeight: '16px', color: '#6a625d', margin: 0 }}>
          Sign in to {connector.name} to allow Souvenir to read and send messages.<br />
          This connection is stored in Settings and can be removed at any time.
        </p>
      </div>
      <PrimaryDarkButton onClick={() => { /* OAuth handoff handled by parent integration */ }}>
        Continue with {connector.name}
      </PrimaryDarkButton>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectorsTab({ connectors, onChange }: ConnectorsTabProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activePromptId, setActivePromptId] = useState<string | null>(null)

  const matches = (c: Connector) =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())

  const workspace = connectors.filter(c => c.scope === 'workspace' && matches(c))
  const personal  = connectors.filter(c => c.scope === 'personal'  && matches(c))

  const toggleEnabled = (id: string) =>
    onChange(connectors.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))

  const iconBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    fontSize: 14,
    lineHeight: '22px',
    color: '#0a0a0a',
    margin: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>

      {/* Heading + Add connectors */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 400,
            fontSize: 24,
            lineHeight: '32px',
            color: '#1a1916',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Connectors Management
        </h2>
        <PrimaryDarkButton
          leftIcon={<PlusSignIcon size={16} color="var(--neutral-50)" />}
          ariaLabel="Add connectors"
          onClick={() => router.push('/settings/connectors')}
        >
          Add connectors
        </PrimaryDarkButton>
      </div>

      {/* Search + secondary actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
        <div
          style={{
            flex: '1 0 0',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '7px 10px',
            borderRadius: 10,
            backgroundColor: 'white',
            boxShadow: '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
          }}
        >
          <SearchOneIcon size={16} color="#6a625d" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search knowledge…"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0 2px',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 14,
              lineHeight: '22px',
              color: '#6a625d',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px', flexShrink: 0 }}>
          <button type="button" aria-label="Download" style={iconBtn}>
            <DownloadOneIcon size={20} color="var(--neutral-700)" />
          </button>
          <button type="button" aria-label="Filter" style={iconBtn}>
            <FilterMailIcon size={20} color="var(--neutral-700)" />
          </button>
        </div>
      </div>

      {/* Workspace Connectors */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <p style={sectionLabel}>Workspace Connectors</p>
        {workspace.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {workspace.map(c => (
              <ConnectorRow
                key={c.id}
                connector={c}
                onToggle={() => { /* not applicable for workspace */ }}
                onConnect={() => { /* not applicable for workspace */ }}
              />
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: '#9c938b', margin: '4px 0 0' }}>
            No workspace connectors yet.
          </p>
        )}
      </section>

      {/* Personal Connectors */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <p style={sectionLabel}>Personal Connectors</p>
        {personal.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {personal.map(c => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                <ConnectorRow
                  connector={c}
                  onToggle={() => toggleEnabled(c.id)}
                  onConnect={() => setActivePromptId(prev => prev === c.id ? null : c.id)}
                />
                {activePromptId === c.id && !c.authorized && (
                  <ConnectPrompt connector={c} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: '20px', color: '#9c938b', margin: '4px 0 0' }}>
            No personal connectors yet.
          </p>
        )}
      </section>

    </div>
  )
}
