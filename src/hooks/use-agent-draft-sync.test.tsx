// @vitest-environment jsdom
import React, { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useAgentDraftSync } from './use-agent-draft-sync'
import type { AgentDraft } from '@/lib/agent-draft'
import type { AgentRecord } from '@/lib/agent-record'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SAVED: AgentDraft = {
  name: 'Support Triage', description: 'd', instructions: 'i', modelId: 'claude', temperature: 0.5, avatarUrl: '', tags: [],
}
const record = (over: Partial<AgentDraft> = {}, versionId = 'v1'): AgentRecord => ({
  repoId: 'r1', versionId, isLive: true, handle: '@t', isPaused: false, saved: { ...SAVED, ...over },
})

type Api = ReturnType<typeof useAgentDraftSync>
const seen: Array<string | undefined> = []
let api: Api
function Probe({ rec }: { rec: AgentRecord | null }) {
  const result = useAgentDraftSync(rec)
  useLayoutEffect(() => { api = result; seen.push(result.draft?.name) })
  return null
}

describe('useAgentDraftSync', () => {
  it('has the record loaded on the first committed render (no empty frame)', () => {
    seen.length = 0
    const root = createRoot(document.createElement('div'))
    const rec = record()
    act(() => root.render(<Probe rec={rec} />))
    expect(seen.every((n) => n === 'Support Triage')).toBe(true)
    expect(api.dirty).toBe(false)
    act(() => root.unmount())
  })

  it('keeps unsaved edits across re-renders with the same record, flags a conflict on a new version', () => {
    const root = createRoot(document.createElement('div'))
    const rec = record()
    act(() => root.render(<Probe rec={rec} />))
    act(() => api.edit({ name: 'Mine' }))
    act(() => root.render(<Probe rec={rec} />))
    expect(api.draft?.name).toBe('Mine')
    act(() => root.render(<Probe rec={record({ description: 'remote' }, 'v2')} />))
    expect(api.draft?.name).toBe('Mine')
    expect(api.notice).toBe('conflict')
    act(() => root.unmount())
  })

  it('adopts a new version straight away when there are no edits', () => {
    const root = createRoot(document.createElement('div'))
    act(() => root.render(<Probe rec={record()} />))
    act(() => root.render(<Probe rec={record({ name: 'Remote' }, 'v2')} />))
    expect(api.draft?.name).toBe('Remote')
    act(() => root.unmount())
  })
})
