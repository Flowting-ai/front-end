'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { AgentSaveError, saveAgentChanges } from '@/lib/agent-save'
import type { AgentDraft } from '@/lib/agent-draft'
import type { AgentRecord } from '@/lib/agent-record'

/**
 * Saves edits to an existing agent in place. One behaviour for every view:
 * success updates the shared baseline, failure leaves the edits on screen.
 */
export function useSaveAgent(args: {
  record:    AgentRecord | null
  baseline:  AgentDraft | null
  markSaved: (draft: AgentDraft) => void
}) {
  const { record, baseline, markSaved } = args
  const [saving, setSaving] = useState(false)

  /** Resolves true when the changes were saved. Errors are toasted, never thrown. */
  const save = useCallback(async (next: AgentDraft, options: { quiet?: boolean } = {}): Promise<boolean> => {
    if (!record || !baseline) return false
    setSaving(true)
    try {
      const result = await saveAgentChanges({
        repoId:    record.repoId,
        versionId: record.versionId,
        isLive:    record.isLive,
        draft:     next,
        baseline,
      })
      markSaved({ ...next, avatarUrl: result.imageUrl ?? next.avatarUrl })
      if (!result.published) {
        toast.warning('Changes saved, but the agent could not be made live. Save again to retry.')
      } else if (!options.quiet) {
        toast.success('Agent saved')
      }
      return true
    } catch (error) {
      toast.error(error instanceof AgentSaveError ? error.message : 'Failed to save the agent. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [record, baseline, markSaved])

  return { save, saving }
}
