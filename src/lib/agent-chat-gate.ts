import { toast } from 'sonner'
import { AGENT_CHAT_ENABLED } from '@/lib/feature-flags'

// Every "use this agent in a chat" action asks here first. While AGENT_CHAT_ENABLED is off the
// backend refuses a chat with an agent, so the action stops with one shared toast instead of
// attaching an agent that would fail the next send.
const TOAST_ID = 'agent-chat-unavailable'

export function agentChatBlocked(): boolean {
  if (AGENT_CHAT_ENABLED) return false
  toast('Chatting with agents is unavailable right now. You can still create, edit and share agents.', { id: TOAST_ID })
  return true
}
