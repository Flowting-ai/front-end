import { toast } from 'sonner'
import { getPersona } from '@/lib/api/persona-list'
import { resolveSelectableChatPersonas } from '@/lib/chat-personas'
import { emitSidebarNewChat } from '@/hooks/use-sidebar-events'
import { PENDING_PERSONA_KEY } from '@/lib/storage-keys'
import { CHAT_ROUTE } from '@/lib/routes'
import { agentChatBlocked } from '@/lib/agent-chat-gate'

// Agents have no chat page of their own: they are only used by attaching them to a normal
// /chat (+ menu, @mention, or "Use in chat"). Everything that used to open an agent's own
// chat now goes through here.

/** Where an existing agent chat opens: the normal chat page (the chat stays bound to its agent). */
export function existingAgentChatHref(chatId: string): string {
  return `${CHAT_ROUTE}?id=${encodeURIComponent(chatId)}`
}

/**
 * Where an old `/agents/<id>/chat[?chatId=]` link goes. With a chatId it is that chat on
 * /chat; without one it is a fresh /chat with the agent attached (`null` = hand the agent
 * off with openAgentInChat).
 */
export function legacyAgentChatTarget(chatId: string | null | undefined): string | null {
  const id = chatId?.trim()
  return id ? existingAgentChatHref(id) : null
}

/**
 * Open a fresh /chat with the agent pre-attached as a chip — the same sessionStorage hand-off
 * as the Agents page's "Use in chat". Agents owned by someone else are copied first (chat only
 * accepts the caller's own version). Returns false when blocked or the agent can't be used.
 */
export async function openAgentInChat(
  repoId: string,
  navigate: (href: string) => void,
): Promise<boolean> {
  if (agentChatBlocked()) return false
  try {
    const persona = await getPersona(repoId)
    const [selected] = await resolveSelectableChatPersonas([persona], {}, null, false)
    if (!selected) throw new Error('agent not usable')
    sessionStorage.setItem(PENDING_PERSONA_KEY, JSON.stringify(selected))
    // /chat may already be mounted; force the same reset the sidebar's "New chat" uses so the
    // pending-persona read runs.
    emitSidebarNewChat()
    navigate(CHAT_ROUTE)
    return true
  } catch {
    toast.error('Failed to open agent. Please try again.')
    return false
  }
}
