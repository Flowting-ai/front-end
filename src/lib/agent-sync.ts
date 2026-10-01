/**
 * Keeps an open editing view in step with the one agent record.
 *
 * The editor page, the sidebar details and the Advanced Personalize modal all
 * read and write the same saved record. This reducer decides what an incoming
 * copy of that record means for one view's local edits:
 *
 *  - nothing changed        → ignore it;
 *  - changed, view is clean → adopt it and show an "Updated" note;
 *  - changed, view is dirty → keep the user's edits and offer to reload instead
 *    of silently overwriting them (the latest *save* wins; unsaved typing is
 *    never discarded without being asked).
 */

import { isDraftDirty, type AgentDraft } from '@/lib/agent-draft'
import type { AgentRecord } from '@/lib/agent-record'

export type SyncNotice = 'updated' | 'conflict' | null

export interface SyncState {
  /** What is saved, as this view last understood it. Null until the first record. */
  baseline:      AgentDraft | null
  /** What the user sees and edits. */
  draft:         AgentDraft | null
  versionId:     string | null
  notice:        SyncNotice
  /** The newer saved copy held back while the view has unsaved edits. */
  incoming:      AgentRecord | null
  /**
   * The baseline from before this view's own latest save. A refetch that was
   * already in flight when the save landed returns that older copy; it must not
   * be mistaken for someone else reverting the agent.
   */
  staleBaseline: AgentDraft | null
}

export const INITIAL_SYNC_STATE: SyncState = {
  baseline: null, draft: null, versionId: null, notice: null, incoming: null, staleBaseline: null,
}

export type SyncAction =
  | { type: 'record';  record: AgentRecord }
  | { type: 'edit';    patch: Partial<AgentDraft> }
  | { type: 'saved';   draft: AgentDraft }
  | { type: 'accept' }
  | { type: 'dismiss' }

function sameSaved(a: AgentDraft, b: AgentDraft): boolean {
  return !isDraftDirty(a, b)
}

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'record': {
      const { record } = action
      if (!state.baseline || !state.draft) {
        return { ...INITIAL_SYNC_STATE, baseline: record.saved, draft: record.saved, versionId: record.versionId }
      }
      const sameVersion = record.versionId === state.versionId
      if (sameVersion && sameSaved(record.saved, state.baseline)) {
        // The server has caught up with this view's own save (or nothing changed).
        return state.staleBaseline || state.incoming ? { ...state, staleBaseline: null, incoming: null } : state
      }
      if (sameVersion && state.staleBaseline && sameSaved(record.saved, state.staleBaseline)) {
        return state // an older copy that was already in flight
      }
      if (!isDraftDirty(state.draft, state.baseline)) {
        return {
          baseline: record.saved, draft: record.saved, versionId: record.versionId,
          notice: 'updated', incoming: null, staleBaseline: null,
        }
      }
      return { ...state, notice: 'conflict', incoming: record }
    }
    case 'edit':
      return state.draft ? { ...state, draft: { ...state.draft, ...action.patch } } : state
    case 'saved':
      return {
        baseline: action.draft, draft: action.draft, versionId: state.versionId,
        notice: null, incoming: null, staleBaseline: state.baseline,
      }
    case 'accept': {
      if (state.incoming) {
        const { saved, versionId } = state.incoming
        return { baseline: saved, draft: saved, versionId, notice: 'updated', incoming: null, staleBaseline: null }
      }
      return state.baseline ? { ...state, draft: state.baseline, notice: null } : state
    }
    case 'dismiss':
      return state.notice === null ? state : { ...state, notice: null }
  }
}
