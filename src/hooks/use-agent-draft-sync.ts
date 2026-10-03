'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { isDraftDirty, type AgentDraft } from '@/lib/agent-draft'
import type { AgentRecord } from '@/lib/agent-record'
import { INITIAL_SYNC_STATE, syncReducer } from '@/lib/agent-sync'

/**
 * Local edits to one agent, kept in step with the saved record. See
 * `lib/agent-sync.ts` for the rules; this is the React binding.
 *
 * `record` must be referentially stable between renders unless the agent changed.
 */
export function useAgentDraftSync(record: AgentRecord | null) {
  const [state, dispatch] = useReducer(syncReducer, INITIAL_SYNC_STATE)

  useEffect(() => {
    if (record) dispatch({ type: 'record', record })
  }, [record])

  const edit = useCallback((patch: Partial<AgentDraft>) => dispatch({ type: 'edit', patch }), [])
  const markSaved = useCallback((draft: AgentDraft) => dispatch({ type: 'saved', draft }), [])
  const accept = useCallback(() => dispatch({ type: 'accept' }), [])
  const dismissNotice = useCallback(() => dispatch({ type: 'dismiss' }), [])

  return {
    draft:    state.draft,
    baseline: state.baseline,
    dirty:    state.draft && state.baseline ? isDraftDirty(state.draft, state.baseline) : false,
    notice:   state.notice,
    edit,
    markSaved,
    accept,
    dismissNotice,
  }
}
