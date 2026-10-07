'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ConnectorGlyph } from '@/components/ConnectorGlyph'
import { MentionAvatar } from '@/components/chat/AgentMentionMenu'
import { getConnector, resolveConnector } from '@/lib/api/connectors'
import { usePersonas } from '@/lib/queries/personas'
import type { Connector } from '@/lib/connector'

// The faces the Context panel puts on connectors and agents — the same ones /connectors
// and /agents show: the catalog logo, and the agent's live avatar on its banner colour.

// ── Connectors ────────────────────────────────────────────────────────────────

// The catalog cache (lib/api/connectors) only holds what something already loaded — the
// six featured apps app-wide. Anything else is fetched once per session here; a slug that
// fails (unknown, offline) keeps its letter tile rather than being retried.
const requested = new Set<string>()

/** Catalog identity (name + logo) for each slug, filling in as lookups land. */
export function useConnectorIdentities(slugs: string[]): Map<string, Connector> {
  const [loaded, setLoaded] = useState(0)
  const key = [...new Set(slugs)].sort().join(',')

  useEffect(() => {
    let live = true
    for (const slug of key ? key.split(',') : []) {
      if (requested.has(slug) || resolveConnector(slug).logo) continue
      requested.add(slug)
      getConnector(slug)
        .then(() => { if (live) setLoaded(count => count + 1) })
        .catch(() => { /* keeps the letter tile */ })
    }
    return () => { live = false }
  }, [key])

  return useMemo(() => {
    void loaded   // re-resolve whenever a lookup lands
    return new Map((key ? key.split(',') : []).map(slug => [slug, resolveConnector(slug)]))
  }, [key, loaded])
}

export function ConnectorLogo({ connector, size = 20 }: { connector: Connector; size?: number }) {
  return <ConnectorGlyph slug={connector.slug} name={connector.name} logoUrl={connector.logo} size={size} />
}

// ── Agents ────────────────────────────────────────────────────────────────────

const bareHandle = (handle: string | undefined) => (handle ?? '').trim().replace(/^@/, '').toLowerCase()

/** Built-in helpers the backend names by handle; never connector slugs. */
const BUILT_IN_AGENTS = new Set(['browser', 'researcher', 'coder'])

/** Whether an agent row's handle could be a connector specialist's (a connector slug). */
export function connectorSpecialistSlug(handle: string | undefined): string | null {
  const bare = bareHandle(handle)
  return bare && !BUILT_IN_AGENTS.has(bare) && /^[a-z0-9_]+$/.test(bare) ? bare : null
}

/** The viewer's agent behind an agent row: by handle first, else by name. */
export function matchPersona<P extends { id: string; name: string; handle: string }>(personas: P[] | undefined, name: string, handle: string | undefined): P | undefined {
  const bare = bareHandle(handle)
  const byName = name.trim().toLowerCase()
  return (bare ? personas?.find(p => bareHandle(p.handle) === bare) : undefined)
    ?? personas?.find(p => p.name.trim().toLowerCase() === byName)
}

/**
 * The agent's face: one of the viewer's own agents → its /agents avatar; a connector
 * specialist → that app's logo; anything else → a stable avatar seeded by its name.
 */
export function AgentFace({ name, handle, connector }: { name: string; handle?: string; connector?: Connector }) {
  const { data: personas } = usePersonas()
  const bare = bareHandle(handle)
  const persona = matchPersona(personas, name, handle)

  if (persona) return <MentionAvatar agent={{ id: persona.id, name: persona.name }} />
  if (connector?.logo) {
    return (
      <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-white)', boxShadow: 'inset 0 0 0 1px var(--neutral-200)', flexShrink: 0 }}>
        <ConnectorLogo connector={connector} size={18} />
      </span>
    )
  }
  return <MentionAvatar agent={{ id: bare || name, name }} />
}
