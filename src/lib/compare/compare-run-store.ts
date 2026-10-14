import { create } from 'zustand'
import type { ConnectorConnectPrompt, ConnectorPermissionPrompt } from '@/types/chat'
import type { ReasoningSection } from '@/lib/reasoning'

// One run per model in the Compare modal, keyed by the model's request id. Each column subscribes to
// its own entry (useModelRun), so a token streamed into one model re-renders that column only, not
// the whole modal. One Compare modal is open at a time, so the store is module-level.

export type CompareReasoning = { text: string; sections: ReasoningSection[] }

export interface ModelRun {
  response?: string
  reasoning?: CompareReasoning
  /** A failure for this model only; never written into the answer text. */
  error?: string
  streaming: boolean
  credits?: number
  /** The saved message id, needed to pin the answer. */
  messageId?: string
  connectPrompts: ConnectorConnectPrompt[]
  permissionPrompts: ConnectorPermissionPrompt[]
}

export const EMPTY_RUN: ModelRun = { streaming: false, connectPrompts: [], permissionPrompts: [] }

interface CompareRunState {
  runs: Record<string, ModelRun>
  /** Changes one model's run; other models' entries keep their identity. */
  update: (id: string, change: Partial<ModelRun> | ((run: ModelRun) => Partial<ModelRun>)) => void
  /** Forgets one model's run (per-model retry). */
  reset: (id: string) => void
  /** Forgets every run (a new prompt, or the modal closing). */
  resetAll: () => void
}

export const useCompareRunStore = create<CompareRunState>()((set) => ({
  runs: {},
  update: (id, change) =>
    set((state) => {
      const current = state.runs[id] ?? EMPTY_RUN
      const patch = typeof change === 'function' ? change(current) : change
      return { runs: { ...state.runs, [id]: { ...current, ...patch } } }
    }),
  reset: (id) =>
    set((state) => {
      if (!(id in state.runs)) return state
      const runs = { ...state.runs }
      delete runs[id]
      return { runs }
    }),
  resetAll: () => set({ runs: {} }),
}))

/** One model's run, re-rendering only when that model's entry changes. */
export function useModelRun(id: string): ModelRun {
  return useCompareRunStore((state) => state.runs[id] ?? EMPTY_RUN)
}
