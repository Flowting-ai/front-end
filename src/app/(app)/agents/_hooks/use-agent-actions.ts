'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { copyPersonaRepoDeduped, type Persona } from '@/lib/api/personas'
import type { ReceivedShareResponse } from '@/lib/api/persona-shares'
import { useDeleteAgent, useTogglePauseAgent } from '@/lib/queries/personas'
import { toSelectedPersona, toSelectedPersonaFromCopy, type SelectedPersonaInfo } from '@/lib/chat-personas'
import { emitSidebarNewChat } from '@/hooks/use-sidebar-events'
import { PENDING_PERSONA_KEY } from '@/lib/storage-keys'
import { AGENT_EDIT_ROUTE, CHAT_ROUTE } from '@/lib/routes'
import { agentChatBlocked } from '@/lib/agent-chat-gate'

interface Inputs {
  personas: Persona[]
  /** Called after a delete so the "Shared with me" list can drop the agent too. */
  onDeleted: (id: string) => void
}

/**
 * What the agent cards and menus do: delete, pause/resume, copy-and-edit, and
 * the "use in chat" hand-offs. Pause and delete are optimistic mutations (the
 * card changes at once and reverts on failure — see lib/queries/personas).
 */
export function useAgentActions({ personas, onDeleted }: Inputs) {
  const { push } = useRouter()
  const pauseAgent = useTogglePauseAgent()
  const deleteAgent = useDeleteAgent()
  const [pausingIds, setPausingIds] = useState<Set<string>>(new Set())

  /**
   * Hand an agent to a fresh /chat as a pre-attached chip. /chat may already be
   * mounted (e.g. the user was just there) — a plain push() to the same route
   * won't remount it, so the pending-persona sessionStorage read (a mount-time-
   * only lazy initializer) would never fire and the chip would silently never
   * appear. emitSidebarNewChat() forces the same reset the sidebar's own
   * "New chat" button uses.
   */
  function openInChat(selected: SelectedPersonaInfo) {
    if (agentChatBlocked()) return
    sessionStorage.setItem(PENDING_PERSONA_KEY, JSON.stringify(selected))
    emitSidebarNewChat()
    push(CHAT_ROUTE)
  }

  /** Use one of the viewer's own agents in a new chat. */
  function handleUseInChat(persona: Persona, isOwned: boolean) {
    openInChat(toSelectedPersona(persona, isOwned))
  }

  async function handleDelete(id: string, name?: string) {
    try {
      // The card leaves the list at once and is restored if the request fails.
      // deletePersona() already busts the cache itself — a second bust here
      // would only double the list re-fetches per delete.
      await deleteAgent.mutateAsync(id)
      onDeleted(id)
      toast.success(name ? `"${name}" deleted` : 'Agent deleted')
    } catch (err) {
      console.error('Failed to delete persona:', err)
      toast.error('Failed to delete agent. Please try again.')
    }
  }

  async function handleCopyAndEdit(persona: Persona) {
    const toastId = toast.loading(`Copying "${persona.name}"…`)
    try {
      const copy = await copyPersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.success(`Copied "${persona.name}" — editing your copy`, { id: toastId })
      push(AGENT_EDIT_ROUTE(copy.id))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to copy agent. Please try again.')
    }
  }

  // Team-shared originals aren't owned by this account, and chat execution
  // only accepts a persona version owned by the caller (same reasoning as
  // resolveSelectableChatPersonas in lib/chat-personas.ts) — clone into the
  // member's own account first, same as handleCopyAndEdit, then hand the
  // clone off to a fresh /chat.
  async function handleUseTeamSharedInChat(persona: Persona) {
    // Before the copy, so a blocked use leaves no stray private copy behind.
    if (agentChatBlocked()) return
    const toastId = toast.loading(`Opening "${persona.name}"…`)
    try {
      const copy = await copyPersonaRepoDeduped(persona.id, persona.activeVersionId)
      toast.dismiss(toastId)
      openInChat(toSelectedPersonaFromCopy(copy, persona))
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to open agent. Please try again.')
    }
  }

  // Super Link received shares work on a genuinely different backend contract
  // than every other "use in chat" path: they're repo-scoped and credit-metered
  // server-side (see ReceivedShareResponse's persona_repo_id/persona_id doc
  // comments in lib/api/persona-shares.ts), not an owned version the caller
  // already has. The main /chat surface's persona-chip send path requires an
  // OWNED version id (see resolveSelectableChatPersonas in lib/chat-personas.ts)
  // — so, same as team-shared personas above, clone into the viewer's own
  // account first via copyPersonaRepoDeduped (seeded from the share's frozen
  // version id), then chip the resulting owned copy onto a fresh /chat.
  async function handleUseReceivedShareInChat(share: ReceivedShareResponse) {
    // Before the copy, same as the team-shared path: a blocked use leaves no stray private copy.
    if (agentChatBlocked()) return
    const toastId = toast.loading(`Opening "${share.name}"…`)
    try {
      const copy = await copyPersonaRepoDeduped(share.persona_repo_id, share.persona_id)
      const version = copy.published_version ?? copy.active_version
      toast.dismiss(toastId)
      openInChat({
        id:              copy.id,
        name:            share.name,
        handle:          version?.handler ? `@${version.handler}` : '',
        imageUrl:        version?.image_url ?? share.image_url,
        modelId:         version?.model_id ?? null,
        activeVersionId: copy.published_version_id ?? null,
        systemPrompt:    null,
        temperature:     version?.temperature ?? null,
        visibility:      'private',
        ownedByViewer:   false,
        description:     share.description ?? '',
        tags:            [],
        paused:          false,
        shared:          true,
      })
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to open agent. Please try again.')
    }
  }

  async function handlePauseToggle(id: string, name: string, currentlyPaused: boolean) {
    // Guardrail: only published agents (those with a live version) can be paused.
    // An unpublished draft has nothing live to pause, so block it with guidance.
    if (!currentlyPaused) {
      const target = personas.find(p => p.id === id)
      if (target && !target.activeVersionId) {
        toast.error('Publish this agent before pausing it.')
        return
      }
    }
    setPausingIds(prev => new Set(prev).add(id))
    try {
      // The card flips at once (see useTogglePauseAgent) and reverts if the request fails.
      await pauseAgent.mutateAsync(id)
      toast.success(currentlyPaused ? `"${name}" resumed` : `"${name}" paused`)
    } catch (err) {
      console.error('Failed to toggle pause:', err)
      toast.error(`Failed to ${currentlyPaused ? 'resume' : 'pause'} agent. Please try again.`)
    } finally {
      setPausingIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  return {
    pausingIds,
    handleDelete,
    handleCopyAndEdit,
    handleUseInChat,
    handleUseTeamSharedInChat,
    handleUseReceivedShareInChat,
    handlePauseToggle,
  }
}
